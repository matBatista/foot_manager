package repository

import (
	"context"
	"fmt"

	"github.com/brassfoot/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ManagerRepository struct {
	pool *pgxpool.Pool
}

func NewManagerRepository(pool *pgxpool.Pool) *ManagerRepository {
	return &ManagerRepository{pool: pool}
}

const managerColumns = `id, name, email, password_hash, COALESCE(team_id::text, ''), reputation, created_at`

func scanManager(row pgx.CollectableRow) (model.Manager, error) {
	var m model.Manager
	err := row.Scan(&m.ID, &m.Name, &m.Email, &m.PasswordHash, &m.TeamID, &m.Reputation, &m.CreatedAt)
	return m, err
}

// Create inserts a new manager and returns the stored record.
func (r *ManagerRepository) Create(ctx context.Context, name, email, passwordHash, teamID string) (model.Manager, error) {
	query := fmt.Sprintf(`INSERT INTO managers (name, email, password_hash, team_id)
		VALUES ($1, $2, $3, $4) RETURNING %s`, managerColumns)
	rows, err := r.pool.Query(ctx, query, name, email, passwordHash, teamID)
	if err != nil {
		return model.Manager{}, fmt.Errorf("creating manager: %w", err)
	}
	return pgx.CollectOneRow(rows, scanManager)
}

// GetByEmail returns the manager with the given email, or pgx.ErrNoRows.
func (r *ManagerRepository) GetByEmail(ctx context.Context, email string) (model.Manager, error) {
	query := fmt.Sprintf(`SELECT %s FROM managers WHERE email = $1`, managerColumns)
	rows, err := r.pool.Query(ctx, query, email)
	if err != nil {
		return model.Manager{}, fmt.Errorf("querying manager by email: %w", err)
	}
	return pgx.CollectOneRow(rows, scanManager)
}

// GetByID returns the manager with the given id, or pgx.ErrNoRows.
func (r *ManagerRepository) GetByID(ctx context.Context, id string) (model.Manager, error) {
	query := fmt.Sprintf(`SELECT %s FROM managers WHERE id = $1`, managerColumns)
	rows, err := r.pool.Query(ctx, query, id)
	if err != nil {
		return model.Manager{}, fmt.Errorf("querying manager by id: %w", err)
	}
	return pgx.CollectOneRow(rows, scanManager)
}
