package handler

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/brassfoot/api/internal/league"
	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/model"
	"github.com/brassfoot/api/internal/promotion"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

// allowedFormations is the set of valid formation strings.
var allowedFormations = map[string]bool{
	"4-4-2":   true,
	"4-3-3":   true,
	"4-5-1":   true,
	"3-5-2":   true,
	"5-3-2":   true,
	"4-2-3-1": true,
}

// CareerHandler drives multi-season progression: start career, conclude a
// season (with auto-simulated second division), advance to the next season.
type CareerHandler struct {
	career   *repository.CareerRepository
	managers *repository.ManagerRepository
	teams    *repository.TeamRepository
	players  *repository.PlayerRepository
	league   *LeagueHandler
}

func NewCareerHandler(
	career *repository.CareerRepository,
	managers *repository.ManagerRepository,
	teams *repository.TeamRepository,
	players *repository.PlayerRepository,
	league *LeagueHandler,
) *CareerHandler {
	return &CareerHandler{career: career, managers: managers, teams: teams, players: players, league: league}
}

// ---- helpers ----

func requireManagerID(c *fiber.Ctx) (string, error) {
	id := middleware.ManagerID(c)
	if id == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}
	return id, nil
}

// createLeagueForDivision loads all BR teams in the given division, builds
// their squads, and registers a new season in the LeagueHandler. Returns the
// new league ID and its leagueState.
func (h *CareerHandler) createLeagueForDivision(ctx context.Context, division string) (string, *leagueState, error) {
	teams, err := h.teams.ListByCountryAndDivision(ctx, "BR", division)
	if err != nil {
		return "", nil, fiber.NewError(fiber.StatusInternalServerError, "failed to load teams")
	}
	if len(teams) < 2 {
		return "", nil, fiber.NewError(fiber.StatusUnprocessableEntity, "not enough teams in division")
	}

	squads := make([]league.Squad, 0, len(teams))
	names := make(map[string]string, len(teams))
	for _, t := range teams {
		players, err := h.players.ListByTeam(ctx, t.ID)
		if err != nil {
			return "", nil, fiber.NewError(fiber.StatusInternalServerError, "failed to load squads")
		}
		squads = append(squads, league.Squad{TeamID: t.ID, Name: t.Name, Players: players})
		names[t.ID] = t.Name
	}

	st := &leagueState{
		season:  league.NewSeason(squads, 0),
		names:   names,
		country: "BR",
	}
	leagueID := newLeagueID()

	h.league.mu.Lock()
	h.league.leagues[leagueID] = st
	h.league.mu.Unlock()

	h.league.persist(ctx, leagueID, st)
	return leagueID, st, nil
}

// autoSimulateDivision creates and fully simulates a league for the given
// division, returning the final standings. Used to determine which teams get
// promoted when the manager's own league concludes.
func (h *CareerHandler) autoSimulateDivision(ctx context.Context, division string) ([]league.TableRow, error) {
	teams, err := h.teams.ListByCountryAndDivision(ctx, "BR", division)
	if err != nil {
		return nil, fmt.Errorf("loading %s teams: %w", division, err)
	}
	if len(teams) == 0 {
		return nil, nil
	}

	squads := make([]league.Squad, 0, len(teams))
	for _, t := range teams {
		players, err := h.players.ListByTeam(ctx, t.ID)
		if err != nil {
			return nil, fmt.Errorf("loading squad for %s: %w", t.Name, err)
		}
		squads = append(squads, league.Squad{TeamID: t.ID, Name: t.Name, Players: players})
	}

	s := league.NewSeason(squads, 0)
	if err := s.PlaySeason(); err != nil {
		return nil, fmt.Errorf("simulating %s: %w", division, err)
	}
	return s.Table(), nil
}

// ---- handlers ----

// StartCareer creates a new career for the authenticated manager. Multiple
// careers per manager are allowed. Accepts an optional JSON body
// {"nickname": "..."} to label the career.
//
// POST /api/v1/career
func (h *CareerHandler) StartCareer(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	var body struct {
		Nickname string `json:"nickname"`
	}
	// Ignore parse errors — nickname is optional.
	_ = c.BodyParser(&body)

	division := "serie_a"

	leagueID, st, err := h.createLeagueForDivision(c.Context(), division)
	if err != nil {
		return err
	}

	career, err := h.career.Create(c.Context(), managerID, division, body.Nickname)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create career")
	}
	career.ActiveLeagueID = leagueID
	if err := h.career.Update(c.Context(), career); err != nil {
		log.Printf("career update after create (manager=%s): %v", managerID, err)
	}

	h.league.mu.Lock()
	summary := summaryOf(leagueID, st)
	h.league.mu.Unlock()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"career": career,
		"league": summary,
	})
}

// GetCareer returns the authenticated manager's most recent career state and
// the active league summary. Kept for backward compatibility.
//
// GET /api/v1/career
func (h *CareerHandler) GetCareer(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	career, err := h.career.GetByManagerID(c.Context(), managerID)
	if errors.Is(err, repository.ErrCareerNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "no career found — call POST /career to start one")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load career")
	}

	resp := fiber.Map{"career": career}

	if career.ActiveLeagueID != "" {
		if st, ok := h.league.lookupOrLoad(c.Context(), career.ActiveLeagueID); ok {
			h.league.mu.Lock()
			resp["league"] = summaryOf(career.ActiveLeagueID, st)
			h.league.mu.Unlock()
		}
	}

	return c.JSON(resp)
}

// ListCareers returns all careers for the authenticated manager.
//
// GET /api/v1/career/list
func (h *CareerHandler) ListCareers(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	careers, err := h.career.ListByManagerID(c.Context(), managerID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list careers")
	}
	return c.JSON(careers)
}

// GetCareerByID returns a specific career by ID (must belong to the manager).
//
// GET /api/v1/career/:id
func (h *CareerHandler) GetCareerByID(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	careerID := c.Params("id")
	career, err := h.career.GetByID(c.Context(), careerID, managerID)
	if errors.Is(err, repository.ErrCareerNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "career not found")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load career")
	}

	resp := fiber.Map{"career": career}

	if career.ActiveLeagueID != "" {
		if st, ok := h.league.lookupOrLoad(c.Context(), career.ActiveLeagueID); ok {
			h.league.mu.Lock()
			resp["league"] = summaryOf(career.ActiveLeagueID, st)
			h.league.mu.Unlock()
		}
	}

	return c.JSON(resp)
}

// DeleteCareer retires (deletes) a career. Returns 404 if the career does not
// belong to the manager.
//
// DELETE /api/v1/career/:id
func (h *CareerHandler) DeleteCareer(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	careerID := c.Params("id")
	if err := h.career.Delete(c.Context(), careerID, managerID); err != nil {
		if errors.Is(err, repository.ErrCareerNotFound) {
			return fiber.NewError(fiber.StatusNotFound, "career not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to delete career")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ChangeTeam updates the manager's assigned team for a given career. The
// career must belong to the authenticated manager.
//
// PUT /api/v1/career/:id/team
func (h *CareerHandler) ChangeTeam(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	careerID := c.Params("id")

	// Verify career ownership.
	if _, err := h.career.GetByID(c.Context(), careerID, managerID); err != nil {
		if errors.Is(err, repository.ErrCareerNotFound) {
			return fiber.NewError(fiber.StatusNotFound, "career not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to verify career")
	}

	var body struct {
		TeamID string `json:"team_id"`
	}
	if err := c.BodyParser(&body); err != nil || body.TeamID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "team_id is required")
	}

	// Verify team exists.
	if _, err := h.teams.GetByID(c.Context(), body.TeamID); err != nil {
		return fiber.NewError(fiber.StatusNotFound, "team not found")
	}

	if err := h.managers.UpdateTeamID(c.Context(), managerID, body.TeamID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update team")
	}

	return c.JSON(fiber.Map{"team_id": body.TeamID})
}

// UpdateFormation sets the manager's preferred formation.
//
// PUT /api/v1/career/formation
func (h *CareerHandler) UpdateFormation(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	var body struct {
		Formation string `json:"formation"`
	}
	if err := c.BodyParser(&body); err != nil || body.Formation == "" {
		return fiber.NewError(fiber.StatusBadRequest, "formation is required")
	}

	if !allowedFormations[body.Formation] {
		return fiber.NewError(fiber.StatusUnprocessableEntity,
			"invalid formation — allowed: 4-4-2, 4-3-3, 4-5-1, 3-5-2, 5-3-2, 4-2-3-1")
	}

	if err := h.managers.UpdateFormation(c.Context(), managerID, body.Formation); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update formation")
	}

	return c.JSON(fiber.Map{"formation": body.Formation})
}

// NextSeason concludes the current season, applies promotion/relegation,
// auto-simulates the other division, and starts the next season's league.
//
// The active league must be Done (all rounds played) before calling this.
//
// POST /api/v1/career/next-season
func (h *CareerHandler) NextSeason(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	career, err := h.career.GetByManagerID(c.Context(), managerID)
	if errors.Is(err, repository.ErrCareerNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "no career found")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load career")
	}

	if career.ActiveLeagueID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "no active league")
	}

	st, ok := h.league.lookupOrLoad(c.Context(), career.ActiveLeagueID)
	if !ok {
		return fiber.NewError(fiber.StatusNotFound, "active league not found")
	}

	h.league.mu.Lock()
	done := st.season.Done()
	currentTable := st.season.Table()
	seasonNames := st.names
	h.league.mu.Unlock()

	if !done {
		return fiber.NewError(fiber.StatusConflict, "season is not finished yet — play all rounds first")
	}

	// Auto-simulate the other division to determine promoted teams.
	otherDiv := promotion.OtherDivision(career.Division)
	otherTable, simErr := h.autoSimulateDivision(c.Context(), otherDiv)
	if simErr != nil {
		log.Printf("auto-simulate %s (manager=%s): %v", otherDiv, managerID, simErr)
		otherTable = []league.TableRow{}
	}

	// Determine which table is Série A and which is Série B.
	var serieATable, serieBTable []league.TableRow
	if career.Division == "serie_a" {
		serieATable, serieBTable = currentTable, otherTable
	} else {
		serieATable, serieBTable = otherTable, currentTable
	}

	result := promotion.Apply(serieATable, serieBTable)

	// Apply division changes in DB.
	for _, id := range result.Relegated {
		if err := h.teams.UpdateDivision(c.Context(), id, "serie_b"); err != nil {
			log.Printf("relegating team %s: %v", id, err)
		}
	}
	for _, id := range result.Promoted {
		if err := h.teams.UpdateDivision(c.Context(), id, "serie_a"); err != nil {
			log.Printf("promoting team %s: %v", id, err)
		}
	}

	// Determine manager's final position and whether they moved divisions.
	managerTeamID := h.getManagerTeamID(c.Context(), managerID)
	managerPos := positionInTable(currentTable, managerTeamID)

	newDivision := career.Division
	for _, id := range result.Relegated {
		if id == managerTeamID {
			newDivision = "serie_b"
			break
		}
	}
	for _, id := range result.Promoted {
		if id == managerTeamID {
			newDivision = "serie_a"
			break
		}
	}

	// Persist season record.
	championID := ""
	if len(currentTable) > 0 {
		championID = currentTable[0].TeamID
	}
	relegated := result.Relegated
	promoted := result.Promoted
	if relegated == nil {
		relegated = []string{}
	}
	if promoted == nil {
		promoted = []string{}
	}

	rec := model.SeasonRecord{
		ManagerID:       managerID,
		SeasonNumber:    career.SeasonNumber,
		Division:        career.Division,
		ChampionID:      championID,
		ChampionName:    seasonNames[championID],
		ManagerPosition: managerPos,
		RelegatedIDs:    relegated,
		PromotedIDs:     promoted,
	}
	if err := h.career.AddSeasonRecord(c.Context(), rec); err != nil {
		log.Printf("adding season record (manager=%s): %v", managerID, err)
	}

	// Create league for the new season (division may have changed).
	newLeagueID, newSt, err := h.createLeagueForDivision(c.Context(), newDivision)
	if err != nil {
		return err
	}

	career.SeasonNumber++
	career.ActiveLeagueID = newLeagueID
	career.Division = newDivision
	if err := h.career.Update(c.Context(), career); err != nil {
		log.Printf("updating career after next-season (manager=%s): %v", managerID, err)
	}

	h.league.mu.Lock()
	newSummary := summaryOf(newLeagueID, newSt)
	h.league.mu.Unlock()

	return c.JSON(fiber.Map{
		"career":        career,
		"league":        newSummary,
		"season_record": rec,
		"relegated":     relegated,
		"promoted":      promoted,
	})
}

// GetHistory returns all season records for the authenticated manager.
//
// GET /api/v1/career/history
func (h *CareerHandler) GetHistory(c *fiber.Ctx) error {
	managerID, err := requireManagerID(c)
	if err != nil {
		return err
	}

	records, err := h.career.ListSeasonRecords(c.Context(), managerID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load history")
	}
	return c.JSON(records)
}

// ---- internal helpers ----

func (h *CareerHandler) getManagerTeamID(ctx context.Context, managerID string) string {
	m, err := h.managers.GetByID(ctx, managerID)
	if err != nil {
		return ""
	}
	return m.TeamID
}

func positionInTable(table []league.TableRow, teamID string) int {
	if teamID == "" {
		return 0
	}
	for i, row := range table {
		if row.TeamID == teamID {
			return i + 1
		}
	}
	return 0
}
