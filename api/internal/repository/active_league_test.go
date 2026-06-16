package repository_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/brassfoot/api/internal/db"
	"github.com/brassfoot/api/internal/league"
	"github.com/brassfoot/api/internal/model"
	"github.com/brassfoot/api/internal/repository"
)

// openPool skips the test when DATABASE_URL is not set.
func openPool(t *testing.T) *repository.ActiveLeagueRepository {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := db.Connect(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return repository.NewActiveLeagueRepository(pool)
}

func makeSnap(n int, country string) league.LeagueSnapshot {
	squads := make([]league.Squad, n)
	for i := range squads {
		id := fmt.Sprintf("IT%02d", i)
		players := make([]model.Player, 11)
		for j := range players {
			players[j] = model.Player{ID: fmt.Sprintf("%s-P%d", id, j), TeamID: id}
		}
		squads[i] = league.Squad{TeamID: id, Name: id, Players: players}
	}
	season := league.NewSeason(squads, 42)
	names := make(map[string]string, n)
	for i := range squads {
		names[squads[i].TeamID] = squads[i].Name
	}
	return league.LeagueSnapshot{Country: country, Names: names, Season: season}
}

func TestActiveLeagueRepository_RoundTrip(t *testing.T) {
	repo := openPool(t)
	ctx := context.Background()

	const id = "integration-test-league-001"
	snap := makeSnap(4, "BR")

	if err := repo.Upsert(ctx, id, snap); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	t.Cleanup(func() {
		// best-effort cleanup so the row doesn't litter the dev DB
		_ = repo.Upsert(ctx, id+"__gone", league.LeagueSnapshot{})
	})

	loaded, err := repo.Load(ctx, id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if loaded.Country != "BR" {
		t.Errorf("country: got %q, want BR", loaded.Country)
	}
	if loaded.Season.TotalRounds() != snap.Season.TotalRounds() {
		t.Errorf("total_rounds: got %d, want %d", loaded.Season.TotalRounds(), snap.Season.TotalRounds())
	}
	if len(loaded.Names) != len(snap.Names) {
		t.Errorf("names len: got %d, want %d", len(loaded.Names), len(snap.Names))
	}
}

func TestActiveLeagueRepository_Upsert_Overwrites(t *testing.T) {
	repo := openPool(t)
	ctx := context.Background()

	const id = "integration-test-league-002"
	snap1 := makeSnap(4, "EN")
	snap2 := makeSnap(4, "ES")

	if err := repo.Upsert(ctx, id, snap1); err != nil {
		t.Fatalf("first Upsert: %v", err)
	}
	if err := repo.Upsert(ctx, id, snap2); err != nil {
		t.Fatalf("second Upsert: %v", err)
	}

	loaded, err := repo.Load(ctx, id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if loaded.Country != "ES" {
		t.Errorf("country after overwrite: got %q, want ES", loaded.Country)
	}
}

func TestActiveLeagueRepository_Load_NotFound(t *testing.T) {
	repo := openPool(t)
	_, err := repo.Load(context.Background(), "this-id-does-not-exist")
	if !errors.Is(err, repository.ErrActiveLeagueNotFound) {
		t.Errorf("want ErrActiveLeagueNotFound, got %v", err)
	}
}
