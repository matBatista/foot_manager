package handler

import (
	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

type SquadHandler struct {
	players  *repository.PlayerRepository
	managers *repository.ManagerRepository
}

func NewSquadHandler(players *repository.PlayerRepository, managers *repository.ManagerRepository) *SquadHandler {
	return &SquadHandler{players: players, managers: managers}
}

// GetSquad returns the squad for the authenticated manager's team.
// Unauthenticated callers may pass ?team_id=<uuid> to view any team's squad.
// Returns an empty squad when no team can be resolved.
// The response includes the manager's preferred formation when authenticated.
func (h *SquadHandler) GetSquad(c *fiber.Ctx) error {
	var teamID string
	formation := "4-4-2" // default

	if managerID := middleware.ManagerID(c); managerID != "" {
		manager, err := h.managers.GetByID(c.Context(), managerID)
		if err == nil {
			teamID = manager.TeamID
			if manager.Formation != "" {
				formation = manager.Formation
			}
		}
	}

	if teamID == "" {
		teamID = c.Query("team_id")
	}

	if teamID == "" {
		return c.JSON(fiber.Map{"formation": formation, "players": []struct{}{}, "total": 0})
	}

	squad, err := h.players.ListByTeam(c.Context(), teamID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load squad")
	}
	return c.JSON(fiber.Map{"formation": formation, "players": squad, "total": len(squad)})
}
