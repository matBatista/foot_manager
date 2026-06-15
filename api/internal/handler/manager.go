package handler

import (
	"errors"

	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

type ManagerHandler struct {
	managers *repository.ManagerRepository
}

func NewManagerHandler(managers *repository.ManagerRepository) *ManagerHandler {
	return &ManagerHandler{managers: managers}
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
