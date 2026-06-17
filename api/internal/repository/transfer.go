package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/brassfoot/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Transfer-specific sentinel errors returned by TransferRepository methods.
var (
	ErrInsufficientBudget = errors.New("insufficient budget")
	ErrPlayerNotAvailable = errors.New("player is not available for transfer")
	ErrPlayerNotOwned     = errors.New("player does not belong to your squad")
	ErrSquadTooSmall      = errors.New("squad would fall below minimum size of 11")
	ErrSquadTooLarge      = errors.New("squad has reached maximum size of 25")
)

const (
	MinSquadSize = 11
	MaxSquadSize = 25
)

type TransferRepository struct {
	pool *pgxpool.Pool
}

func NewTransferRepository(pool *pgxpool.Pool) *TransferRepository {
	return &TransferRepository{pool: pool}
}

// GetBudget returns the manager's team budget and the team's UUID.
func (r *TransferRepository) GetBudget(ctx context.Context, managerID string) (budget int64, teamID string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT t.budget, t.id::text
		FROM managers m
		JOIN teams t ON t.id = m.team_id
		WHERE m.id = $1
	`, managerID).Scan(&budget, &teamID)
	if err != nil {
		return 0, "", fmt.Errorf("getting manager budget: %w", err)
	}
	return budget, teamID, nil
}

// ListAvailable returns free agents (team_id IS NULL), ordered by overall DESC.
// Pass an empty position string to return all positions.
func (r *TransferRepository) ListAvailable(ctx context.Context, position string, limit, offset int) ([]model.Player, int, error) {
	if position != "" {
		var total int
		if err := r.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM players WHERE team_id IS NULL AND position = $1`, position,
		).Scan(&total); err != nil {
			return nil, 0, fmt.Errorf("counting available players: %w", err)
		}
		rows, err := r.pool.Query(ctx,
			fmt.Sprintf(`SELECT %s FROM players WHERE team_id IS NULL AND position = $1 ORDER BY overall DESC LIMIT $2 OFFSET $3`, playerColumns),
			position, limit, offset,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("listing available players: %w", err)
		}
		players, err := pgx.CollectRows(rows, scanPlayer)
		return players, total, err
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM players WHERE team_id IS NULL`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting available players: %w", err)
	}
	rows, err := r.pool.Query(ctx,
		fmt.Sprintf(`SELECT %s FROM players WHERE team_id IS NULL ORDER BY overall DESC LIMIT $1 OFFSET $2`, playerColumns),
		limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("listing available players: %w", err)
	}
	players, err := pgx.CollectRows(rows, scanPlayer)
	return players, total, err
}

// BuyPlayer transactionally purchases a free-agent player for the manager's team.
// The player's value is deducted from the team's budget.
func (r *TransferRepository) BuyPlayer(ctx context.Context, managerID, playerID string) (newBudget int64, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// Resolve manager's team.
	var teamID string
	if err = tx.QueryRow(ctx,
		`SELECT COALESCE(team_id::text, '') FROM managers WHERE id = $1`, managerID,
	).Scan(&teamID); err != nil {
		return 0, fmt.Errorf("getting manager: %w", err)
	}
	if teamID == "" {
		return 0, fmt.Errorf("manager has no team assigned")
	}

	// Lock team row and read budget.
	var budget int64
	if err = tx.QueryRow(ctx,
		`SELECT budget FROM teams WHERE id = $1 FOR UPDATE`, teamID,
	).Scan(&budget); err != nil {
		return 0, fmt.Errorf("locking team: %w", err)
	}

	// Lock player row; must be a free agent (team_id IS NULL).
	var playerTeamID *string
	var playerValue int64
	if err = tx.QueryRow(ctx,
		`SELECT team_id::text, value FROM players WHERE id = $1 FOR UPDATE`, playerID,
	).Scan(&playerTeamID, &playerValue); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrPlayerNotAvailable
		}
		return 0, fmt.Errorf("getting player: %w", err)
	}
	if playerTeamID != nil {
		return 0, ErrPlayerNotAvailable
	}

	if budget < playerValue {
		return 0, ErrInsufficientBudget
	}

	var squadSize int
	if err = tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM players WHERE team_id = $1`, teamID,
	).Scan(&squadSize); err != nil {
		return 0, fmt.Errorf("counting squad: %w", err)
	}
	if squadSize >= MaxSquadSize {
		return 0, ErrSquadTooLarge
	}

	newBudget = budget - playerValue
	if _, err = tx.Exec(ctx, `UPDATE teams SET budget = $1 WHERE id = $2`, newBudget, teamID); err != nil {
		return 0, fmt.Errorf("updating budget: %w", err)
	}
	if _, err = tx.Exec(ctx, `UPDATE players SET team_id = $1 WHERE id = $2`, teamID, playerID); err != nil {
		return 0, fmt.Errorf("assigning player: %w", err)
	}

	return newBudget, tx.Commit(ctx)
}

// SellPlayer releases a player from the manager's squad (they become a free agent)
// and credits the player's value to the team budget.
func (r *TransferRepository) SellPlayer(ctx context.Context, managerID, playerID string) (newBudget int64, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// Resolve manager's team.
	var teamID string
	if err = tx.QueryRow(ctx,
		`SELECT COALESCE(team_id::text, '') FROM managers WHERE id = $1`, managerID,
	).Scan(&teamID); err != nil {
		return 0, fmt.Errorf("getting manager: %w", err)
	}
	if teamID == "" {
		return 0, fmt.Errorf("manager has no team assigned")
	}

	// Lock team row and read budget.
	var budget int64
	if err = tx.QueryRow(ctx,
		`SELECT budget FROM teams WHERE id = $1 FOR UPDATE`, teamID,
	).Scan(&budget); err != nil {
		return 0, fmt.Errorf("locking team: %w", err)
	}

	// Lock player row; must belong to manager's team.
	var playerTeamID *string
	var playerValue int64
	if err = tx.QueryRow(ctx,
		`SELECT team_id::text, value FROM players WHERE id = $1 FOR UPDATE`, playerID,
	).Scan(&playerTeamID, &playerValue); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrPlayerNotOwned
		}
		return 0, fmt.Errorf("getting player: %w", err)
	}
	if playerTeamID == nil || *playerTeamID != teamID {
		return 0, ErrPlayerNotOwned
	}

	var squadSize int
	if err = tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM players WHERE team_id = $1`, teamID,
	).Scan(&squadSize); err != nil {
		return 0, fmt.Errorf("counting squad: %w", err)
	}
	if squadSize <= MinSquadSize {
		return 0, ErrSquadTooSmall
	}

	newBudget = budget + playerValue
	if _, err = tx.Exec(ctx, `UPDATE teams SET budget = $1 WHERE id = $2`, newBudget, teamID); err != nil {
		return 0, fmt.Errorf("updating budget: %w", err)
	}
	if _, err = tx.Exec(ctx, `UPDATE players SET team_id = NULL WHERE id = $1`, playerID); err != nil {
		return 0, fmt.Errorf("releasing player: %w", err)
	}

	return newBudget, tx.Commit(ctx)
}
