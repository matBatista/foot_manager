package handler

import (
	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

// DefaultTeamID is the seeded team, used for unauthenticated requests and as
// the starting club for new managers until team selection lands.
const DefaultTeamID = "00000000-0000-0000-0000-000000000001"

type SquadHandler struct {
	players  *repository.PlayerRepository
	managers *repository.ManagerRepository
}

func NewSquadHandler(players *repository.PlayerRepository, managers *repository.ManagerRepository) *SquadHandler {
	return &SquadHandler{players: players, managers: managers}
}

// GetSquad returns the authenticated manager's squad, or the default team's
// squad for unauthenticated requests.
func (h *SquadHandler) GetSquad(c *fiber.Ctx) error {
	teamID := DefaultTeamID
	if managerID := middleware.ManagerID(c); managerID != "" {
		manager, err := h.managers.GetByID(c.Context(), managerID)
		if err == nil && manager.TeamID != "" {
			teamID = manager.TeamID
		}
	}

	squad, err := h.players.ListByTeam(c.Context(), teamID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load squad")
	}
	return c.JSON(fiber.Map{"players": squad, "total": len(squad)})
}
