package handler

import (
	"errors"

	"github.com/brassfoot/api/internal/match"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

type MatchHandler struct {
	players *repository.PlayerRepository
}

func NewMatchHandler(players *repository.PlayerRepository) *MatchHandler {
	return &MatchHandler{players: players}
}

// simulateRequest is the JSON body for POST /match/simulate.
type simulateRequest struct {
	HomeTeamID string `json:"home_team_id"`
	AwayTeamID string `json:"away_team_id"`
	Seed       int64  `json:"seed"` // optional; 0 = random
}

// Simulate plays a match between two teams and returns the full result.
func (h *MatchHandler) Simulate(c *fiber.Ctx) error {
	var req simulateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if req.HomeTeamID == "" || req.AwayTeamID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "home_team_id and away_team_id are required")
	}
	if req.HomeTeamID == req.AwayTeamID {
		return fiber.NewError(fiber.StatusBadRequest, "a team cannot play itself")
	}

	ctx := c.Context()
	homePlayers, err := h.players.ListByTeam(ctx, req.HomeTeamID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load home squad")
	}
	awayPlayers, err := h.players.ListByTeam(ctx, req.AwayTeamID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load away squad")
	}

	home := match.TeamInput{TeamID: req.HomeTeamID, Name: "Home", Players: homePlayers}
	away := match.TeamInput{TeamID: req.AwayTeamID, Name: "Away", Players: awayPlayers}

	result, err := match.Simulate(home, away, req.Seed)
	if err != nil {
		var empty match.ErrEmptySquad
		if errors.As(err, &empty) {
			return fiber.NewError(fiber.StatusUnprocessableEntity, empty.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "simulation failed")
	}

	return c.JSON(result)
}
