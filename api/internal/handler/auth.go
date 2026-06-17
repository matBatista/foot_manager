package handler

import (
	"errors"
	"strings"

	"github.com/brassfoot/api/internal/auth"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type AuthHandler struct {
	managers  *repository.ManagerRepository
	jwtSecret string
}

func NewAuthHandler(managers *repository.ManagerRepository, jwtSecret string) *AuthHandler {
	return &AuthHandler{managers: managers, jwtSecret: jwtSecret}
}

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req registerRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Name == "" || req.Email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name and email are required")
	}
	if !strings.Contains(req.Email, "@") {
		return fiber.NewError(fiber.StatusBadRequest, "invalid email")
	}
	if len(req.Password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "password must be at least 8 characters")
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to process password")
	}

	// New managers start without a team; they must select one via POST /api/v1/manager/team.
	manager, err := h.managers.Create(c.Context(), req.Name, req.Email, hash, "")
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgerrcode.UniqueViolation {
			return fiber.NewError(fiber.StatusConflict, "email already registered")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create manager")
	}

	token, err := auth.IssueToken(h.jwtSecret, manager.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to issue token")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"token": token, "manager": manager})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	manager, err := h.managers.GetByEmail(c.Context(), req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid email or password")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to log in")
	}
	if !auth.CheckPassword(manager.PasswordHash, req.Password) {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid email or password")
	}

	token, err := auth.IssueToken(h.jwtSecret, manager.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to issue token")
	}
	return c.JSON(fiber.Map{"token": token, "manager": manager})
}
