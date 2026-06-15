package repository

import (
	"context"
	"fmt"

	"github.com/brassfoot/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PlayerRepository struct {
	pool *pgxpool.Pool
}

func NewPlayerRepository(pool *pgxpool.Pool) *PlayerRepository {
	return &PlayerRepository{pool: pool}
}

const playerColumns = `id, team_id, name, position, nationality, age,
	pace, shooting, passing, dribbling, defending, physical, overall, value`

func scanPlayer(row pgx.CollectableRow) (model.Player, error) {
	var p model.Player
	err := row.Scan(
		&p.ID, &p.TeamID, &p.Name, &p.Position, &p.Nationality, &p.Age,
		&p.Pace, &p.Shooting, &p.Passing, &p.Dribbling, &p.Defending,
		&p.Physical, &p.Overall, &p.Value,
	)
	return p, err
}

// ListByTeam returns all players belonging to a team, strongest first.
func (r *PlayerRepository) ListByTeam(ctx context.Context, teamID string) ([]model.Player, error) {
	query := fmt.Sprintf(`SELECT %s FROM players WHERE team_id = $1 ORDER BY overall DESC`, playerColumns)
	rows, err := r.pool.Query(ctx, query, teamID)
	if err != nil {
		return nil, fmt.Errorf("querying players: %w", err)
	}
	return pgx.CollectRows(rows, scanPlayer)
}

// GetByID returns a single player.
func (r *PlayerRepository) GetByID(ctx context.Context, id string) (model.Player, error) {
	query := fmt.Sprintf(`SELECT %s FROM players WHERE id = $1`, playerColumns)
	rows, err := r.pool.Query(ctx, query, id)
	if err != nil {
		return model.Player{}, fmt.Errorf("querying player: %w", err)
	}
	return pgx.CollectOneRow(rows, scanPlayer)
}
