package handler

import (
	"errors"
	"strings"

	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

type ManagerHandler struct {
	managers *repository.ManagerRepository
	teams    *repository.TeamRepository
}

func NewManagerHandler(managers *repository.ManagerRepository, teams *repository.TeamRepository) *ManagerHandler {
	return &ManagerHandler{managers: managers, teams: teams}
}

// Me returns the authenticated manager's profile.
func (h *ManagerHandler) Me(c *fiber.Ctx) error {
	manager, err := h.managers.GetByID(c.Context(), middleware.ManagerID(c))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fiber.NewError(fiber.StatusUnauthorized, "manager not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load manager")
	}
	return c.JSON(manager)
}

type selectTeamRequest struct {
	TeamID string `json:"team_id"`
}

// SelectTeam sets the authenticated manager's club.
// The team must exist; managers may re-select freely before career start.
func (h *ManagerHandler) SelectTeam(c *fiber.Ctx) error {
	var req selectTeamRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.TeamID = strings.TrimSpace(req.TeamID)
	if req.TeamID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "team_id is required")
	}

	if _, err := h.teams.GetByID(c.Context(), req.TeamID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fiber.NewError(fiber.StatusNotFound, "team not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to validate team")
	}

	managerID := middleware.ManagerID(c)
	if err := h.managers.UpdateTeamID(c.Context(), managerID, req.TeamID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update team")
	}

	manager, err := h.managers.GetByID(c.Context(), managerID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load manager")
	}
	return c.JSON(manager)
}
