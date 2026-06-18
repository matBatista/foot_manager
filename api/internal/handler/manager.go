package handler

import (
	"context"
	"errors"
	"strings"

	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/model"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// managerStore is the subset of ManagerRepository used by ManagerHandler.
type managerStore interface {
	GetByID(ctx context.Context, id string) (model.Manager, error)
	UpdateTeamID(ctx context.Context, managerID, teamID string) error
}

// teamLookup is the subset of TeamRepository used by ManagerHandler.
type teamLookup interface {
	GetByID(ctx context.Context, id string) (model.Team, error)
}

// careerLookup is the subset of CareerRepository used by ManagerHandler.
type careerLookup interface {
	GetByManagerID(ctx context.Context, managerID string) (model.Career, error)
}

type ManagerHandler struct {
	managers managerStore
	teams    teamLookup
	careers  careerLookup
}

func NewManagerHandler(managers managerStore, teams teamLookup, careers careerLookup) *ManagerHandler {
	return &ManagerHandler{managers: managers, teams: teams, careers: careers}
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
//
// Team switching is allowed only when the manager has no active career.
// Once a career is started (POST /career), the team is locked in place until
// that career record is removed (career completed or abandoned). Returns 409
// Conflict when the career lock is in effect.
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

	// Block team change when an active career exists.
	if _, err := h.careers.GetByManagerID(c.Context(), managerID); err == nil {
		return fiber.NewError(fiber.StatusConflict,
			"cannot change team while a career is active — complete or abandon the current career first")
	} else if !errors.Is(err, repository.ErrCareerNotFound) {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to check career status")
	}

	if err := h.managers.UpdateTeamID(c.Context(), managerID, req.TeamID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update team")
	}

	manager, err := h.managers.GetByID(c.Context(), managerID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load manager")
	}
	return c.JSON(manager)
}
