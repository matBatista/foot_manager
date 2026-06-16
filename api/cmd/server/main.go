package main

import (
	"context"
	"log"
	"os"

	"github.com/brassfoot/api/internal/db"
	"github.com/brassfoot/api/internal/handler"
	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is not set")
	}

	// Run migrations, then open the pool.
	if err := db.Migrate(databaseURL); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}
	pool, err := db.Connect(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	// Repositories & handlers
	playerRepo := repository.NewPlayerRepository(pool)
	managerRepo := repository.NewManagerRepository(pool)
	teamRepo := repository.NewTeamRepository(pool)
	saveGameRepo := repository.NewSaveGameRepository(pool)
	activeLeagueRepo := repository.NewActiveLeagueRepository(pool)
	squadHandler := handler.NewSquadHandler(playerRepo, managerRepo)
	authHandler := handler.NewAuthHandler(managerRepo, jwtSecret)
	managerHandler := handler.NewManagerHandler(managerRepo)
	teamHandler := handler.NewTeamHandler(teamRepo)
	matchHandler := handler.NewMatchHandler(playerRepo)
	leagueHandler := handler.NewLeagueHandler(teamRepo, playerRepo, saveGameRepo, activeLeagueRepo)

	app := fiber.New(fiber.Config{AppName: "Brassfoot API"})

	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	v1 := app.Group("/api/v1")

	// Auth
	v1.Post("/auth/register", authHandler.Register)
	v1.Post("/auth/login", authHandler.Login)

	// Manager
	v1.Get("/manager/me", middleware.RequireAuth(jwtSecret), managerHandler.Me)

	// Squad (manager's team when authenticated, default team otherwise)
	v1.Get("/squad", middleware.OptionalAuth(jwtSecret), squadHandler.GetSquad)

	// Teams
	v1.Get("/teams", teamHandler.List)

	// Match
	v1.Post("/match/simulate", matchHandler.Simulate)

	// Leagues (in-memory seasons; see handler note on persistence)
	leagues := v1.Group("/leagues")
	leagues.Post("/", leagueHandler.Create)
	leagues.Get("/:id", leagueHandler.Get)
	leagues.Get("/:id/table", leagueHandler.Table)
	leagues.Post("/:id/advance", leagueHandler.Advance)
	leagues.Post("/:id/save", middleware.RequireAuth(jwtSecret), leagueHandler.Save)

	// Save-game list & restore
	v1.Get("/saves", middleware.RequireAuth(jwtSecret), leagueHandler.ListSaves)
	v1.Post("/saves/:save_id/restore", leagueHandler.Restore)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Fatal(app.Listen(":" + port))
}
