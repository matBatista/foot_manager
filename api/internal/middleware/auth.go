package middleware

import (
	"strings"

	"github.com/brassfoot/api/internal/auth"
	"github.com/gofiber/fiber/v2"
)

// ManagerIDKey is the fiber locals key holding the authenticated manager's id.
const ManagerIDKey = "managerID"

func bearerToken(c *fiber.Ctx) string {
	header := c.Get(fiber.HeaderAuthorization)
	if token, ok := strings.CutPrefix(header, "Bearer "); ok {
		return token
	}
	return ""
}

// RequireAuth rejects requests without a valid Bearer token.
func RequireAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := bearerToken(c)
		if token == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "missing bearer token")
		}
		managerID, err := auth.ParseToken(jwtSecret, token)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}
		c.Locals(ManagerIDKey, managerID)
		return c.Next()
	}
}

// OptionalAuth sets the manager id when a valid token is present, but lets
// unauthenticated requests through.
func OptionalAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if token := bearerToken(c); token != "" {
			if managerID, err := auth.ParseToken(jwtSecret, token); err == nil {
				c.Locals(ManagerIDKey, managerID)
			}
		}
		return c.Next()
	}
}

// ManagerID returns the authenticated manager's id, or "" if unauthenticated.
func ManagerID(c *fiber.Ctx) string {
	id, _ := c.Locals(ManagerIDKey).(string)
	return id
}
