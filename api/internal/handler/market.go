package handler

import (
	"errors"

	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
)

type MarketHandler struct {
	transfers *repository.TransferRepository
}

func NewMarketHandler(transfers *repository.TransferRepository) *MarketHandler {
	return &MarketHandler{transfers: transfers}
}

// Budget returns the authenticated manager's current team budget.
// GET /api/v1/market/budget
func (h *MarketHandler) Budget(c *fiber.Ctx) error {
	managerID := middleware.ManagerID(c)
	budget, teamID, err := h.transfers.GetBudget(c.Context(), managerID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch budget")
	}
	return c.JSON(fiber.Map{"budget": budget, "team_id": teamID})
}

// Available lists free-agent players available for purchase.
// GET /api/v1/market/available?position=MID&limit=20&offset=0
func (h *MarketHandler) Available(c *fiber.Ctx) error {
	position := c.Query("position")
	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)
	if limit > 50 {
		limit = 50
	}
	players, total, err := h.transfers.ListAvailable(c.Context(), position, limit, offset)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list available players")
	}
	return c.JSON(fiber.Map{"players": players, "total": total})
}

// Buy purchases a free-agent player for the manager's team.
// POST /api/v1/market/buy/:player_id
func (h *MarketHandler) Buy(c *fiber.Ctx) error {
	managerID := middleware.ManagerID(c)
	playerID := c.Params("player_id")

	newBudget, err := h.transfers.BuyPlayer(c.Context(), managerID, playerID)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrInsufficientBudget):
			return fiber.NewError(fiber.StatusPaymentRequired, err.Error())
		case errors.Is(err, repository.ErrPlayerNotAvailable):
			return fiber.NewError(fiber.StatusConflict, err.Error())
		case errors.Is(err, repository.ErrSquadTooLarge):
			return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to complete purchase")
		}
	}
	return c.JSON(fiber.Map{"budget": newBudget})
}

// Sell releases a player from the manager's squad (player becomes a free agent).
// POST /api/v1/market/sell/:player_id
func (h *MarketHandler) Sell(c *fiber.Ctx) error {
	managerID := middleware.ManagerID(c)
	playerID := c.Params("player_id")

	newBudget, err := h.transfers.SellPlayer(c.Context(), managerID, playerID)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrPlayerNotOwned):
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		case errors.Is(err, repository.ErrSquadTooSmall):
			return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to complete sale")
		}
	}
	return c.JSON(fiber.Map{"budget": newBudget})
}
