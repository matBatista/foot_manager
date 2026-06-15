package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/brassfoot/api/internal/league"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSaveNotFound is returned when a save_id has no matching row.
var ErrSaveNotFound = errors.New("save not found")

// SaveMeta is a lightweight summary returned by ListByManager.
type SaveMeta struct {
	ID        string    `json:"id"`
	ManagerID string    `json:"manager_id"`
	Country   string    `json:"country,omitempty"`
	SavedAt   time.Time `json:"saved_at"`
}

// SaveGameRepository persists and retrieves league snapshots.
type SaveGameRepository struct {
	pool *pgxpool.Pool
}

func NewSaveGameRepository(pool *pgxpool.Pool) *SaveGameRepository {
	return &SaveGameRepository{pool: pool}
}

// Save serialises snap to JSONB and inserts a new row. It returns the new save
// UUID that the client can use to restore the game later.
func (r *SaveGameRepository) Save(ctx context.Context, managerID string, snap league.LeagueSnapshot) (string, error) {
	data, err := json.Marshal(snap)
	if err != nil {
		return "", fmt.Errorf("marshaling snapshot: %w", err)
	}
	var id string
	err = r.pool.QueryRow(ctx,
		`INSERT INTO save_games (manager_id, season_json) VALUES ($1, $2) RETURNING id`,
		managerID, data,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("inserting save: %w", err)
	}
	return id, nil
}

// Load fetches a save row by UUID and deserialises its snapshot.
func (r *SaveGameRepository) Load(ctx context.Context, saveID string) (league.LeagueSnapshot, error) {
	var data []byte
	err := r.pool.QueryRow(ctx,
		`SELECT season_json FROM save_games WHERE id = $1`,
		saveID,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return league.LeagueSnapshot{}, ErrSaveNotFound
	}
	if err != nil {
		return league.LeagueSnapshot{}, fmt.Errorf("querying save: %w", err)
	}
	var snap league.LeagueSnapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return league.LeagueSnapshot{}, fmt.Errorf("unmarshaling snapshot: %w", err)
	}
	return snap, nil
}

// ListByManager returns all saves for a manager, newest first.
func (r *SaveGameRepository) ListByManager(ctx context.Context, managerID string) ([]SaveMeta, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manager_id, COALESCE(season_json->>'country', ''), saved_at
		 FROM save_games WHERE manager_id = $1 ORDER BY saved_at DESC`,
		managerID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing saves: %w", err)
	}
	defer rows.Close()

	var out []SaveMeta
	for rows.Next() {
		var m SaveMeta
		if err := rows.Scan(&m.ID, &m.ManagerID, &m.Country, &m.SavedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
