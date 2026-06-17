package repository_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

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

// newTestManager creates a manager tied to Brassfoot FC and registers a cleanup no-op.
func newTestManager(t *testing.T, managers *repository.ManagerRepository, suffix string) string {
	t.Helper()
	m, err := managers.Create(context.Background(),
		"Test Manager "+suffix,
		fmt.Sprintf("xfer_test_%s@brassfoot.com", suffix),
		"$2a$10$placeholder",
		"00000000-0000-0000-0000-000000000001", // Brassfoot FC
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
	// Migration 0009 seeds 27 free agents; total may be higher if tests left some.
	if total < 27 {
		t.Errorf("expected ≥27 free agents, got %d", total)
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

// TestTransfer_BuyPlayer_InsufficientBudget buys Felipe Estrela (£8M) first to
// reduce the budget, then attempts to buy Diego Canela (£11M) — which should fail.
func TestTransfer_BuyPlayer_InsufficientBudget(t *testing.T) {
	repo, managers, _ := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "buy_broke")

	const (
		felipeEstrela = "20000000-0000-0000-0000-000000000020" // £8M
		diegoCanela   = "20000000-0000-0000-0000-000000000021" // £11M
	)

	// Buy Felipe Estrela to drain budget: 15M - 8M = 7M remaining.
	if _, err := repo.BuyPlayer(ctx, managerID, felipeEstrela); err != nil {
		t.Skipf("could not buy Felipe Estrela for setup: %v", err)
	}
	t.Cleanup(func() { _, _ = repo.SellPlayer(ctx, managerID, felipeEstrela) })

	// Now try Diego Canela at £11M — should exceed remaining 7M budget.
	_, err := repo.BuyPlayer(ctx, managerID, diegoCanela)
	if !errors.Is(err, repository.ErrInsufficientBudget) {
		t.Errorf("want ErrInsufficientBudget, got %v", err)
	}
}

// ── Sell player ──────────────────────────────────────────────────────────────

func TestTransfer_SellPlayer_Success(t *testing.T) {
	repo, managers, players := openTransferRepos(t)
	ctx := context.Background()

	managerID := newTestManager(t, managers, "sell_ok")

	squad, err := players.ListByTeam(ctx, "00000000-0000-0000-0000-000000000001")
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

	squad, err := players.ListByTeam(ctx, "00000000-0000-0000-0000-000000000001")
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
	remaining, _ := players.ListByTeam(ctx, "00000000-0000-0000-0000-000000000001")
	if len(remaining) == 0 {
		t.Skip("no players remaining")
	}
	_, err = repo.SellPlayer(ctx, managerID, remaining[0].ID)
	if !errors.Is(err, repository.ErrSquadTooSmall) {
		t.Errorf("want ErrSquadTooSmall, got %v", err)
	}
}
