package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/brassfoot/api/internal/league"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrActiveLeagueNotFound = errors.New("active league not found")

type ActiveLeagueRepository struct {
	pool *pgxpool.Pool
}

func NewActiveLeagueRepository(pool *pgxpool.Pool) *ActiveLeagueRepository {
	return &ActiveLeagueRepository{pool: pool}
}

// Upsert persists or overwrites the active league state. Called on every create
// and advance so the DB always reflects the latest in-memory state.
func (r *ActiveLeagueRepository) Upsert(ctx context.Context, id string, snap league.LeagueSnapshot) error {
	data, err := json.Marshal(snap)
	if err != nil {
		return fmt.Errorf("marshaling snapshot: %w", err)
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO active_leagues (id, season_json) VALUES ($1, $2)
		 ON CONFLICT (id) DO UPDATE
		   SET season_json = EXCLUDED.season_json,
		       updated_at  = now()`,
		id, data,
	)
	if err != nil {
		return fmt.Errorf("upserting active league: %w", err)
	}
	return nil
}

// Load fetches a previously persisted league. Returns ErrActiveLeagueNotFound
// when the id has no row (e.g. league predates persistence or was never saved).
func (r *ActiveLeagueRepository) Load(ctx context.Context, id string) (league.LeagueSnapshot, error) {
	var data []byte
	err := r.pool.QueryRow(ctx,
		`SELECT season_json FROM active_leagues WHERE id = $1`,
		id,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return league.LeagueSnapshot{}, ErrActiveLeagueNotFound
	}
	if err != nil {
		return league.LeagueSnapshot{}, fmt.Errorf("querying active league: %w", err)
	}
	var snap league.LeagueSnapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return league.LeagueSnapshot{}, fmt.Errorf("unmarshaling snapshot: %w", err)
	}
	return snap, nil
}
