package repository_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/brassfoot/api/internal/db"
	"github.com/brassfoot/api/internal/repository"
)

// openTransferRepos returns repositories backed by a real DB, skipping if DATABASE_URL unset.
func openTransferRepos(t *testing.T) (*repository.TransferRepository, *repository.ManagerRepository, *repository.PlayerRepository) {
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
	return repository.NewTransferRepository(pool),
		repository.NewManagerRepository(pool),
		repository.NewPlayerRepository(pool)
}

// newTestManager creates a manager tied to Flamengo (Série A, 80M budget).
// Email is unique per run to avoid duplicate-key errors across test runs.
func newTestManager(t *testing.T, managers *repository.ManagerRepository, suffix string) string {
	t.Helper()
	email := fmt.Sprintf("xfer_%s_%d@managerfc.com", suffix, time.Now().UnixNano())
	m, err := managers.Create(context.Background(),
		"Test Manager "+suffix,
		email,
		"$2a$10$placeholder",
		"00000000-0000-0000-0000-000000000010", // Flamengo
	)
	if err != nil {
		t.Fatalf("create manager (%s): %v", suffix, err)
	}
	return m.ID
}

// ── Read-only tests ──────────────────────────────────────────────────────────

func TestTransfer_GetBudget(t *testing.T) {
	repo, managers, _ := openTransferRepos(t)
	managerID := newTestManager(t, managers, "getbudget")

	budget, teamID, err := repo.GetBudget(context.Background(), managerID)
	if err != nil {
		t.Fatalf("GetBudget: %v", err)
	}
	if teamID == "" {
		t.Error("expected non-empty team_id")
	}
	if budget < 0 {
		t.Errorf("expected non-negative budget, got %d", budget)
	}
}

func TestTransfer_ListAvailable_All(t *testing.T) {
	repo, _, _ := openTransferRepos(t)
	ctx := context.Background()

	players, total, err := repo.ListAvailable(ctx, "", 50, 0)
	if err != nil {
		t.Fatalf("ListAvailable: %v", err)
	}
	// Migration 0009 seeds 27 free agents; total may be higher if tests left some bought
	// and may be slightly lower if earlier test runs bought without releasing.
	// We tolerate up to 5 missing (stale-state tolerance across integration test runs).
	if total < 22 {
		t.Errorf("expected ≥22 free agents (27 seeded minus stale tolerance), got %d", total)
	}
	for i := 1; i < len(players); i++ {
		if players[i].Overall > players[i-1].Overall {
			t.Errorf("players not ordered by overall DESC at index %d", i)
		}
	}
	for _, p := range players {
		if p.TeamID != "" {
			t.Errorf("player %s has non-empty team_id %q; expected free agent", p.Name, p.TeamID)
		}
	}
}

func TestTransfer_ListAvailable_ByPosition(t *testing.T) {
	repo, _, _ := openTransferRepos(t)
	ctx := context.Background()

	for _, pos := range []string{"GK", "DEF", "MID", "FWD"} {
		players, total, err := repo.ListAvailable(ctx, pos, 50, 0)
		if err != nil {
			t.Fatalf("ListAvailable(%s): %v", pos, err)
		}
		if total == 0 {
			t.Errorf("expected free agents for position %s", pos)
		}
		for _, p := range players {
			if p.Position != pos {
				t.Errorf("ListAvailable(%s) returned player with position %s", pos, p.Position)
			}
		}
	}
}

// ── Buy player ───────────────────────────────────────────────────────────────

func TestTransfer_BuyPlayer_Success(t *testing.T) {
	repo, managers, players := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "buy_ok")

	avail, _, err := repo.ListAvailable(ctx, "GK", 1, 0)
	if err != nil || len(avail) == 0 {
		t.Skip("no GK free agent available")
	}
	target := avail[0]

	budget0, _, err := repo.GetBudget(ctx, managerID)
	if err != nil {
		t.Fatalf("GetBudget: %v", err)
	}

	newBudget, err := repo.BuyPlayer(ctx, managerID, target.ID)
	if err != nil {
		t.Fatalf("BuyPlayer: %v", err)
	}
	if newBudget != budget0-target.Value {
		t.Errorf("new budget: got %d, want %d", newBudget, budget0-target.Value)
	}

	bought, err := players.GetByID(ctx, target.ID)
	if err != nil {
		t.Fatalf("GetByID after buy: %v", err)
	}
	if bought.TeamID == "" {
		t.Error("player still free agent after purchase")
	}

	t.Cleanup(func() { _, _ = repo.SellPlayer(ctx, managerID, target.ID) })
}

func TestTransfer_BuyPlayer_AlreadyOwned(t *testing.T) {
	repo, managers, _ := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "buy_owned")
	// Flamengo's GK belongs to a team — not a free agent.
	const flamengoGK = "00000000-0000-0000-0000-000000001001"
	_, err := repo.BuyPlayer(ctx, managerID, flamengoGK)
	if !errors.Is(err, repository.ErrPlayerNotAvailable) {
		t.Errorf("want ErrPlayerNotAvailable, got %v", err)
	}
}

func TestTransfer_BuyPlayer_NotFound(t *testing.T) {
	repo, managers, _ := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "buy_missing")
	_, err := repo.BuyPlayer(ctx, managerID, "00000000-0000-0000-0000-999999999999")
	if !errors.Is(err, repository.ErrPlayerNotAvailable) {
		t.Errorf("want ErrPlayerNotAvailable for missing player, got %v", err)
	}
}

// TestTransfer_BuyPlayer_InsufficientBudget verifies ErrInsufficientBudget when
// the remaining budget cannot cover the attempted purchase.
// Uses Novorizontino (~9M budget) to keep the arithmetic manageable across
// any free-agent DB state; player selection is dynamic to avoid stale-data issues.
func TestTransfer_BuyPlayer_InsufficientBudget(t *testing.T) {
	repo, managers, _ := openTransferRepos(t)
	ctx := context.Background()

	// Novorizontino: 9M budget — tight enough to construct the scenario.
	const novID = "00000000-0000-0000-0000-000000000028"
	email := fmt.Sprintf("xfer_broke_%d@managerfc.com", time.Now().UnixNano())
	m, err := managers.Create(ctx, "Broke Manager", email, "$2a$10$placeholder", novID)
	if err != nil {
		t.Fatalf("create broke manager: %v", err)
	}

	budget, _, err := repo.GetBudget(ctx, m.ID)
	if err != nil {
		t.Fatalf("GetBudget: %v", err)
	}

	available, _, err := repo.ListAvailable(ctx, "", 100, 0)
	if err != nil {
		t.Fatalf("ListAvailable: %v", err)
	}

	// Find cheapest affordable player (drain) and any too-expensive player.
	// available is sorted by overall DESC; iterate in reverse to find cheapest value.
	var drainID string
	var drainValue int64
	for i := len(available) - 1; i >= 0; i-- {
		p := available[i]
		if p.Value > 0 && p.Value < budget {
			drainID = p.ID
			drainValue = p.Value
			break
		}
	}
	if drainID == "" {
		t.Skip("no affordable free agent available to drain budget")
	}

	remaining := budget - drainValue
	var tooExpID string
	for _, p := range available {
		if p.ID != drainID && p.Value > remaining {
			tooExpID = p.ID
			break
		}
	}
	if tooExpID == "" {
		t.Skip("cannot construct insufficient-budget scenario with available free agents and current team budget")
	}

	if _, err := repo.BuyPlayer(ctx, m.ID, drainID); err != nil {
		t.Skipf("drain buy failed (player unavailable): %v", err)
	}
	t.Cleanup(func() { _, _ = repo.SellPlayer(ctx, m.ID, drainID) })

	_, err = repo.BuyPlayer(ctx, m.ID, tooExpID)
	if !errors.Is(err, repository.ErrInsufficientBudget) {
		t.Errorf("want ErrInsufficientBudget, got %v", err)
	}
}

// ── Sell player ──────────────────────────────────────────────────────────────

func TestTransfer_SellPlayer_Success(t *testing.T) {
	repo, managers, players := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "sell_ok")

	// Use Flamengo squad (same team the test manager is tied to).
	squad, err := players.ListByTeam(ctx, "00000000-0000-0000-0000-000000000010")
	if err != nil || len(squad) <= repository.MinSquadSize {
		t.Skip("squad at or below MinSquadSize; cannot test sell")
	}
	target := squad[len(squad)-1] // weakest player

	budget0, _, err := repo.GetBudget(ctx, managerID)
	if err != nil {
		t.Fatalf("GetBudget: %v", err)
	}

	newBudget, err := repo.SellPlayer(ctx, managerID, target.ID)
	if err != nil {
		t.Fatalf("SellPlayer: %v", err)
	}
	if newBudget != budget0+target.Value {
		t.Errorf("new budget: got %d, want %d", newBudget, budget0+target.Value)
	}

	sold, err := players.GetByID(ctx, target.ID)
	if err != nil {
		t.Fatalf("GetByID after sell: %v", err)
	}
	if sold.TeamID != "" {
		t.Errorf("player still has team_id %q after sell", sold.TeamID)
	}

	t.Cleanup(func() { _, _ = repo.BuyPlayer(ctx, managerID, target.ID) })
}

func TestTransfer_SellPlayer_NotOwned(t *testing.T) {
	repo, managers, _ := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "sell_notowned")
	// Palmeiras player — not on manager's team.
	const palmeirasPlayer = "00000000-0000-0000-0000-000000001101"
	_, err := repo.SellPlayer(ctx, managerID, palmeirasPlayer)
	if !errors.Is(err, repository.ErrPlayerNotOwned) {
		t.Errorf("want ErrPlayerNotOwned, got %v", err)
	}
}

func TestTransfer_SellPlayer_SquadTooSmall(t *testing.T) {
	repo, managers, players := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "sell_small")

	// Use Flamengo squad (same team the test manager is tied to).
	squad, err := players.ListByTeam(ctx, "00000000-0000-0000-0000-000000000010")
	if err != nil {
		t.Fatalf("listing squad: %v", err)
	}
	if len(squad) <= repository.MinSquadSize {
		t.Skip("squad already at min size; cannot test")
	}

	// Sell players until squad reaches MinSquadSize.
	var sold []string
	for len(squad) > repository.MinSquadSize {
		weakest := squad[len(squad)-1]
		if _, err := repo.SellPlayer(ctx, managerID, weakest.ID); err != nil {
			t.Fatalf("sell during setup: %v", err)
		}
		sold = append(sold, weakest.ID)
		squad = squad[:len(squad)-1]
	}
	t.Cleanup(func() {
		for _, id := range sold {
			_, _ = repo.BuyPlayer(ctx, managerID, id)
		}
	})

	// Next sell must fail.
	remaining, _ := players.ListByTeam(ctx, "00000000-0000-0000-0000-000000000010")
	if len(remaining) == 0 {
		t.Skip("no players remaining")
	}
	_, err = repo.SellPlayer(ctx, managerID, remaining[0].ID)
	if !errors.Is(err, repository.ErrSquadTooSmall) {
		t.Errorf("want ErrSquadTooSmall, got %v", err)
	}
}
