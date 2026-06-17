package repository_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/brassfoot/api/internal/db"
	"github.com/brassfoot/api/internal/repository"
	"github.com/jackc/pgx/v5"
)

func openManagerRepos(t *testing.T) (*repository.ManagerRepository, *repository.TeamRepository) {
	t.Helper()
	dsn := dsnFromEnv(t)
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := db.Connect(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return repository.NewManagerRepository(pool), repository.NewTeamRepository(pool)
}

// TestManager_CreateNoTeam verifies new managers start with an empty team_id.
func TestManager_CreateNoTeam(t *testing.T) {
	managers, _ := openManagerRepos(t)
	ctx := context.Background()

	m, err := managers.Create(ctx,
		"No-Team Manager",
		fmt.Sprintf("noteam_%d@managerfc.com", uniqueSuffix()),
		"$2a$10$placeholder",
		"",
	)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if m.TeamID != "" {
		t.Errorf("expected empty team_id, got %q", m.TeamID)
	}
}

// TestManager_SelectTeam verifies UpdateTeamID persists and validates FK.
func TestManager_SelectTeam(t *testing.T) {
	managers, teams := openManagerRepos(t)
	ctx := context.Background()

	m, err := managers.Create(ctx,
		"Select-Team Manager",
		fmt.Sprintf("selectteam_%d@managerfc.com", uniqueSuffix()),
		"$2a$10$placeholder",
		"",
	)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	const flamengoID = "00000000-0000-0000-0000-000000000010"
	if err := managers.UpdateTeamID(ctx, m.ID, flamengoID); err != nil {
		t.Fatalf("UpdateTeamID: %v", err)
	}

	updated, err := managers.GetByID(ctx, m.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if updated.TeamID != flamengoID {
		t.Errorf("team_id: got %q, want %q", updated.TeamID, flamengoID)
	}

	// Team must exist and return the right name.
	team, err := teams.GetByID(ctx, flamengoID)
	if err != nil {
		t.Fatalf("GetByID(team): %v", err)
	}
	if team.Name != "Flamengo" {
		t.Errorf("team name: got %q, want Flamengo", team.Name)
	}
}

// TestManager_SelectTeam_InvalidFK verifies that pointing to a non-existent team fails.
func TestManager_SelectTeam_InvalidFK(t *testing.T) {
	managers, teams := openManagerRepos(t)
	ctx := context.Background()

	// Confirm Brassfoot FC is gone.
	const brassfootID = "00000000-0000-0000-0000-000000000001"
	_, err := teams.GetByID(ctx, brassfootID)
	if err == nil {
		t.Skip("Brassfoot FC still exists (migration 0012 not applied); skipping FK test")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("unexpected error querying Brassfoot FC: %v", err)
	}

	m, err := managers.Create(ctx,
		"FK-Test Manager",
		fmt.Sprintf("fktest_%d@managerfc.com", uniqueSuffix()),
		"$2a$10$placeholder",
		"",
	)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Attempting to assign Brassfoot FC must fail (FK violation).
	err = managers.UpdateTeamID(ctx, m.ID, brassfootID)
	if err == nil {
		t.Error("expected FK error when assigning non-existent team, got nil")
	}
}

// TestTeam_NoBrassfootFC verifies the Brassfoot FC team is absent after migration 0012.
func TestTeam_NoBrassfootFC(t *testing.T) {
	_, teams := openManagerRepos(t)
	ctx := context.Background()

	const brassfootID = "00000000-0000-0000-0000-000000000001"
	_, err := teams.GetByID(ctx, brassfootID)
	if err == nil {
		t.Error("Brassfoot FC still exists — migration 0012 may not have run")
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Errorf("unexpected error: %v", err)
	}
}

// TestTeam_ListForSelection checks that the selection list contains only BR teams
// and each entry has an avg_overall > 0.
func TestTeam_ListForSelection(t *testing.T) {
	_, teams := openManagerRepos(t)
	ctx := context.Background()

	list, err := teams.ListForSelection(ctx)
	if err != nil {
		t.Fatalf("ListForSelection: %v", err)
	}
	if len(list) == 0 {
		t.Fatal("expected at least one team for selection")
	}
	for _, ts := range list {
		if ts.Country != "BR" {
			t.Errorf("non-BR team in selection: %s (%s)", ts.Name, ts.Country)
		}
		if ts.AvgOverall <= 0 {
			t.Errorf("team %s has avg_overall = %d", ts.Name, ts.AvgOverall)
		}
	}

	// Série A teams must come before Série B.
	seenSerieB := false
	for _, ts := range list {
		if ts.Division == "serie_b" {
			seenSerieB = true
		}
		if seenSerieB && ts.Division == "serie_a" {
			t.Error("Série A team appeared after a Série B team — wrong ordering")
			break
		}
	}
}

func uniqueSuffix() int64 {
	return time.Now().UnixNano()
}
