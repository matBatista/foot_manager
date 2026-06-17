package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"sync"

	"github.com/brassfoot/api/internal/league"
	"github.com/brassfoot/api/internal/match"
	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/model"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

// activeLeagueStore is the persistence contract for automatic league state
// durability. *repository.ActiveLeagueRepository satisfies it; a fake is used
// in tests without a database.
type activeLeagueStore interface {
	Upsert(ctx context.Context, id string, snap league.LeagueSnapshot) error
	Load(ctx context.Context, id string) (league.LeagueSnapshot, error)
}

// LeagueHandler manages in-memory league simulations backed by Postgres for
// automatic durability (active field) and manual user saves (saves field).
//
// Durability design — cache-aside:
//   - Create and Advance write to DB immediately after mutating memory.
//   - Get, Table, and Advance try memory first; on miss they load from DB and
//     re-populate the cache. This makes the server restart-transparent.
//   - DB writes are best-effort: failures are logged but do not abort the
//     request, so the API stays available even if the DB is momentarily slow.
type LeagueHandler struct {
	teams   *repository.TeamRepository
	players *repository.PlayerRepository
	saves   *repository.SaveGameRepository
	active  activeLeagueStore // nil = no automatic persistence

	mu      sync.Mutex
	leagues map[string]*leagueState
}

// leagueState is one running season plus the team display names.
type leagueState struct {
	season  *league.Season
	names   map[string]string // team ID → display name
	country string
}

func NewLeagueHandler(
	teams *repository.TeamRepository,
	players *repository.PlayerRepository,
	saves *repository.SaveGameRepository,
	active activeLeagueStore,
) *LeagueHandler {
	return &LeagueHandler{
		teams:   teams,
		players: players,
		saves:   saves,
		active:  active,
		leagues: make(map[string]*leagueState),
	}
}

// ---- requests / responses ----

type createLeagueRequest struct {
	Country  string   `json:"country"`  // optional: restrict to one country
	Division string   `json:"division"` // optional: 'serie_a' or 'serie_b' (country=BR only)
	TeamIDs  []string `json:"team_ids"` // optional: explicit teams (overrides country)
	Seed     int64    `json:"seed"`     // optional: 0 = random
}

type leagueSummary struct {
	ID          string `json:"id"`
	Country     string `json:"country,omitempty"`
	Teams       int    `json:"teams"`
	TotalRounds int    `json:"total_rounds"`
	NextRound   int    `json:"next_round"`
	Done        bool   `json:"done"`
}

type tableRowResponse struct {
	Position int    `json:"position"`
	TeamID   string `json:"team_id"`
	Name     string `json:"name"`
	Played   int    `json:"played"`
	Won      int    `json:"won"`
	Drawn    int    `json:"drawn"`
	Lost     int    `json:"lost"`
	GoalsFor int    `json:"goals_for"`
	GoalsAg  int    `json:"goals_against"`
	GoalDiff int    `json:"goal_diff"`
	Points   int    `json:"points"`
}

type resultResponse struct {
	Round     int    `json:"round"`
	HomeID    string `json:"home_team_id"`
	HomeName  string `json:"home_name"`
	AwayID    string `json:"away_team_id"`
	AwayName  string `json:"away_name"`
	HomeGoals int    `json:"home_goals"`
	AwayGoals int    `json:"away_goals"`
}

// ---- handlers ----

// Create builds a new league from all teams (optionally filtered by country, or
// an explicit team list), loads their squads, and starts a season.
func (h *LeagueHandler) Create(c *fiber.Ctx) error {
	var req createLeagueRequest
	_ = c.BodyParser(&req)

	ctx := c.Context()
	teams, err := h.resolveTeams(ctx, req)
	if err != nil {
		return err
	}
	if len(teams) < 2 {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "a league needs at least 2 teams")
	}

	squads := make([]league.Squad, 0, len(teams))
	names := make(map[string]string, len(teams))
	for _, t := range teams {
		players, err := h.players.ListByTeam(ctx, t.ID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to load squads")
		}
		squads = append(squads, league.Squad{TeamID: t.ID, Name: t.Name, Players: players})
		names[t.ID] = t.Name
	}

	st := &leagueState{
		season:  league.NewSeason(squads, req.Seed),
		names:   names,
		country: req.Country,
	}
	id := newLeagueID()

	h.mu.Lock()
	h.leagues[id] = st
	h.mu.Unlock()

	h.persist(ctx, id, st)

	return c.Status(fiber.StatusCreated).JSON(summaryOf(id, st))
}

// Get returns a league's summary (round progress, team count).
func (h *LeagueHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	st, ok := h.lookupOrLoad(c.Context(), id)
	if !ok {
		return fiber.NewError(fiber.StatusNotFound, "league not found")
	}
	h.mu.Lock()
	summary := summaryOf(id, st)
	h.mu.Unlock()
	return c.JSON(summary)
}

// Table returns the current standings.
func (h *LeagueHandler) Table(c *fiber.Ctx) error {
	id := c.Params("id")
	st, ok := h.lookupOrLoad(c.Context(), id)
	if !ok {
		return fiber.NewError(fiber.StatusNotFound, "league not found")
	}
	h.mu.Lock()
	resp := fiber.Map{
		"league": summaryOf(id, st),
		"table":  st.tableRows(),
	}
	h.mu.Unlock()
	return c.JSON(resp)
}

type advanceRequest struct {
	Rounds int  `json:"rounds"` // how many rounds to play (default 1)
	ToEnd  bool `json:"to_end"` // play the rest of the season at once
}

// Advance plays one or more rounds and returns the new results plus the updated
// table. With to_end=true it simulates the entire remaining season instantly.
func (h *LeagueHandler) Advance(c *fiber.Ctx) error {
	id := c.Params("id")
	var req advanceRequest
	_ = c.BodyParser(&req)

	// load from DB if not in memory (transparent after restart)
	if _, ok := h.lookupOrLoad(c.Context(), id); !ok {
		return fiber.NewError(fiber.StatusNotFound, "league not found")
	}

	h.mu.Lock()
	st, ok := h.leagues[id]
	if !ok {
		h.mu.Unlock()
		return fiber.NewError(fiber.StatusNotFound, "league not found")
	}
	if st.season.Done() {
		h.mu.Unlock()
		return fiber.NewError(fiber.StatusConflict, "season is already complete")
	}

	var played []league.Played
	advance := func() error {
		round, err := st.season.PlayRound()
		if err != nil {
			return err
		}
		played = append(played, round...)
		return nil
	}

	var playErr error
	switch {
	case req.ToEnd:
		for !st.season.Done() {
			if err := advance(); err != nil {
				playErr = err
				break
			}
		}
	default:
		n := req.Rounds
		if n <= 0 {
			n = 1
		}
		for i := 0; i < n && !st.season.Done(); i++ {
			if err := advance(); err != nil {
				playErr = err
				break
			}
		}
	}

	// snapshot data for response before releasing the lock
	summary := summaryOf(id, st)
	results := st.resultRows(played)
	table := st.tableRows()
	h.mu.Unlock()

	if playErr != nil {
		return mapSimError(playErr)
	}

	// persist outside the lock (best-effort; st is only mutated while holding mu)
	h.persist(c.Context(), id, st)

	return c.JSON(fiber.Map{
		"league":  summary,
		"results": results,
		"table":   table,
	})
}

// ---- helpers ----

// lookupOrLoad returns the leagueState for id. It checks the in-memory cache
// first; on a miss it tries the DB (cache-aside). The loaded state is added to
// the cache so subsequent requests don't hit the DB.
func (h *LeagueHandler) lookupOrLoad(ctx context.Context, id string) (*leagueState, bool) {
	h.mu.Lock()
	st, ok := h.leagues[id]
	h.mu.Unlock()
	if ok {
		return st, true
	}

	if h.active == nil {
		return nil, false
	}

	snap, err := h.active.Load(ctx, id)
	if err != nil {
		// ErrActiveLeagueNotFound is expected for unknown IDs; other errors are
		// DB failures that we log and treat as a miss.
		if !errors.Is(err, repository.ErrActiveLeagueNotFound) {
			log.Printf("active league load error (id=%s): %v", id, err)
		}
		return nil, false
	}

	st = &leagueState{season: snap.Season, names: snap.Names, country: snap.Country}

	h.mu.Lock()
	// guard against a race where another goroutine loaded the same id
	if existing, ok := h.leagues[id]; ok {
		h.mu.Unlock()
		return existing, true
	}
	h.leagues[id] = st
	h.mu.Unlock()
	return st, true
}

// persist writes the current leagueState to the DB. It is best-effort:
// failures are logged but never surfaced to the caller, so a transient DB
// hiccup doesn't break gameplay.
func (h *LeagueHandler) persist(ctx context.Context, id string, st *leagueState) {
	if h.active == nil {
		return
	}
	snap := league.LeagueSnapshot{Country: st.country, Names: st.names, Season: st.season}
	if err := h.active.Upsert(ctx, id, snap); err != nil {
		log.Printf("active league persist error (id=%s): %v", id, err)
	}
}

// resolveTeams turns the request into the set of teams to play: explicit IDs if
// given, else all teams in a country (optionally filtered by division), else
// every team. When country=BR and division is empty, defaults to 'serie_a' to
// maintain backward compatibility (20 teams, not 40).
func (h *LeagueHandler) resolveTeams(ctx context.Context, req createLeagueRequest) ([]model.Team, error) {
	switch {
	case len(req.TeamIDs) > 0:
		teams := make([]model.Team, 0, len(req.TeamIDs))
		for _, id := range req.TeamIDs {
			t, err := h.teams.GetByID(ctx, id)
			if err != nil {
				return nil, fiber.NewError(fiber.StatusUnprocessableEntity, "team not found: "+id)
			}
			teams = append(teams, t)
		}
		return teams, nil
	case req.Country != "":
		div := req.Division
		if div == "" && req.Country == "BR" {
			div = "serie_a" // default for BR to avoid mixing 40 teams
		}
		if div != "" {
			teams, err := h.teams.ListByCountryAndDivision(ctx, req.Country, div)
			if err != nil {
				return nil, fiber.NewError(fiber.StatusInternalServerError, "failed to load teams")
			}
			return teams, nil
		}
		teams, err := h.teams.ListByCountry(ctx, req.Country)
		if err != nil {
			return nil, fiber.NewError(fiber.StatusInternalServerError, "failed to load teams")
		}
		return teams, nil
	default:
		teams, err := h.teams.ListAll(ctx)
		if err != nil {
			return nil, fiber.NewError(fiber.StatusInternalServerError, "failed to load teams")
		}
		return teams, nil
	}
}

func summaryOf(id string, st *leagueState) leagueSummary {
	return leagueSummary{
		ID:          id,
		Country:     st.country,
		Teams:       len(st.names),
		TotalRounds: st.season.TotalRounds(),
		NextRound:   st.season.NextRound(),
		Done:        st.season.Done(),
	}
}

func (st *leagueState) tableRows() []tableRowResponse {
	rows := st.season.Table()
	out := make([]tableRowResponse, len(rows))
	for i, r := range rows {
		out[i] = tableRowResponse{
			Position: i + 1,
			TeamID:   r.TeamID,
			Name:     st.names[r.TeamID],
			Played:   r.Played,
			Won:      r.Won,
			Drawn:    r.Drawn,
			Lost:     r.Lost,
			GoalsFor: r.GoalsFor,
			GoalsAg:  r.GoalsAgainst,
			GoalDiff: r.GoalDiff,
			Points:   r.Points,
		}
	}
	return out
}

func (st *leagueState) resultRows(played []league.Played) []resultResponse {
	out := make([]resultResponse, len(played))
	for i, p := range played {
		out[i] = resultResponse{
			Round:     p.Round,
			HomeID:    p.Home,
			HomeName:  st.names[p.Home],
			AwayID:    p.Away,
			AwayName:  st.names[p.Away],
			HomeGoals: p.Score.Home,
			AwayGoals: p.Score.Away,
		}
	}
	return out
}

func mapSimError(err error) error {
	var empty match.ErrEmptySquad
	if errors.As(err, &empty) {
		return fiber.NewError(fiber.StatusUnprocessableEntity, empty.Error())
	}
	return fiber.NewError(fiber.StatusInternalServerError, "simulation failed")
}

func newLeagueID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ---- save-game handlers ----

type saveResponse struct {
	SaveID string `json:"save_id"`
}

// Save persists the in-memory league to the save_games table. Requires an
// authenticated manager (manager ID is read from the JWT via RequireAuth).
func (h *LeagueHandler) Save(c *fiber.Ctx) error {
	if h.saves == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "save-game not configured")
	}
	id := c.Params("id")
	managerID := middleware.ManagerID(c)
	if managerID == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}

	st, ok := h.lookupOrLoad(c.Context(), id)
	if !ok {
		return fiber.NewError(fiber.StatusNotFound, "league not found")
	}

	snap := league.LeagueSnapshot{
		Country: st.country,
		Names:   st.names,
		Season:  st.season,
	}
	saveID, err := h.saves.Save(c.Context(), managerID, snap)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to save game")
	}
	return c.Status(fiber.StatusCreated).JSON(saveResponse{SaveID: saveID})
}

// ListSaves returns all save metadata for the authenticated manager.
func (h *LeagueHandler) ListSaves(c *fiber.Ctx) error {
	if h.saves == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "save-game not configured")
	}
	managerID := middleware.ManagerID(c)
	if managerID == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}
	saves, err := h.saves.ListByManager(c.Context(), managerID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list saves")
	}
	if saves == nil {
		saves = []repository.SaveMeta{}
	}
	return c.JSON(saves)
}

// Restore loads a save from the DB and registers it as a new in-memory league,
// returning the new league ID and its summary.
func (h *LeagueHandler) Restore(c *fiber.Ctx) error {
	if h.saves == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "save-game not configured")
	}
	saveID := c.Params("save_id")

	snap, err := h.saves.Load(c.Context(), saveID)
	if errors.Is(err, repository.ErrSaveNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "save not found")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load save")
	}

	st := &leagueState{
		season:  snap.Season,
		names:   snap.Names,
		country: snap.Country,
	}
	leagueID := newLeagueID()

	h.mu.Lock()
	h.leagues[leagueID] = st
	h.mu.Unlock()

	// also persist to active_leagues so the restored session survives a restart
	h.persist(c.Context(), leagueID, st)

	return c.JSON(fiber.Map{
		"league_id": leagueID,
		"league":    summaryOf(leagueID, st),
	})
}
