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

const managerColumns = `id, name, email, password_hash, COALESCE(team_id::text, ''), reputation, formation, created_at`

func scanManager(row pgx.CollectableRow) (model.Manager, error) {
	var m model.Manager
	err := row.Scan(&m.ID, &m.Name, &m.Email, &m.PasswordHash, &m.TeamID, &m.Reputation, &m.Formation, &m.CreatedAt)
	return m, err
}

// Create inserts a new manager and returns the stored record.
// Pass an empty teamID to leave team_id NULL (manager must select a team later).
func (r *ManagerRepository) Create(ctx context.Context, name, email, passwordHash, teamID string) (model.Manager, error) {
	var tid interface{}
	if teamID != "" {
		tid = teamID
	}
	query := fmt.Sprintf(`INSERT INTO managers (name, email, password_hash, team_id)
		VALUES ($1, $2, $3, $4) RETURNING %s`, managerColumns)
	rows, err := r.pool.Query(ctx, query, name, email, passwordHash, tid)
	if err != nil {
		return model.Manager{}, fmt.Errorf("creating manager: %w", err)
	}
	return pgx.CollectOneRow(rows, scanManager)
}

// UpdateTeamID sets the manager's team. Pass an empty teamID to clear the assignment.
func (r *ManagerRepository) UpdateTeamID(ctx context.Context, managerID, teamID string) error {
	var tid interface{}
	if teamID != "" {
		tid = teamID
	}
	_, err := r.pool.Exec(ctx,
		`UPDATE managers SET team_id = $1 WHERE id = $2`,
		tid, managerID,
	)
	if err != nil {
		return fmt.Errorf("updating manager team: %w", err)
	}
	return nil
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

// UpdateFormation sets the manager's preferred formation.
func (r *ManagerRepository) UpdateFormation(ctx context.Context, managerID, formation string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE managers SET formation = $1 WHERE id = $2`,
		formation, managerID,
	)
	return err
}
