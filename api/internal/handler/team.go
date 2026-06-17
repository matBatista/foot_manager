package handler

import (
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

type TeamHandler struct {
	teams *repository.TeamRepository
}

func NewTeamHandler(teams *repository.TeamRepository) *TeamHandler {
	return &TeamHandler{teams: teams}
}

// List returns all teams ordered by division then name.
func (h *TeamHandler) List(c *fiber.Ctx) error {
	teams, err := h.teams.ListAll(c.Context())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load teams")
	}
	return c.JSON(fiber.Map{"teams": teams, "total": len(teams)})
}

// ListForSelection returns all BR teams with avg_overall, grouped-friendly for
// the team-picker screen (Série A first, then Série B, alphabetical within each).
func (h *TeamHandler) ListForSelection(c *fiber.Ctx) error {
	teams, err := h.teams.ListForSelection(c.Context())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load teams")
	}
	return c.JSON(fiber.Map{"teams": teams, "total": len(teams)})
}
