package repository

import (
	"context"
	"fmt"

	"github.com/brassfoot/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TeamRepository struct {
	pool *pgxpool.Pool
}

func NewTeamRepository(pool *pgxpool.Pool) *TeamRepository {
	return &TeamRepository{pool: pool}
}

const teamColumns = `id, name, short_name, country, budget, division`

func scanTeam(row pgx.CollectableRow) (model.Team, error) {
	var t model.Team
	err := row.Scan(&t.ID, &t.Name, &t.ShortName, &t.Country, &t.Budget, &t.Division)
	return t, err
}

// ListAll returns every team, ordered by name.
func (r *TeamRepository) ListAll(ctx context.Context) ([]model.Team, error) {
	query := fmt.Sprintf(`SELECT %s FROM teams ORDER BY name`, teamColumns)
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying teams: %w", err)
	}
	return pgx.CollectRows(rows, scanTeam)
}

// ListByCountry returns every team in a country, ordered by name.
func (r *TeamRepository) ListByCountry(ctx context.Context, country string) ([]model.Team, error) {
	query := fmt.Sprintf(`SELECT %s FROM teams WHERE country = $1 ORDER BY name`, teamColumns)
	rows, err := r.pool.Query(ctx, query, country)
	if err != nil {
		return nil, fmt.Errorf("querying teams by country: %w", err)
	}
	return pgx.CollectRows(rows, scanTeam)
}

// ListByCountryAndDivision returns teams filtered by country and division tier.
func (r *TeamRepository) ListByCountryAndDivision(ctx context.Context, country, division string) ([]model.Team, error) {
	query := fmt.Sprintf(`SELECT %s FROM teams WHERE country = $1 AND division = $2 ORDER BY name`, teamColumns)
	rows, err := r.pool.Query(ctx, query, country, division)
	if err != nil {
		return nil, fmt.Errorf("querying teams by country and division: %w", err)
	}
	return pgx.CollectRows(rows, scanTeam)
}

// GetByID returns a single team.
func (r *TeamRepository) GetByID(ctx context.Context, id string) (model.Team, error) {
	query := fmt.Sprintf(`SELECT %s FROM teams WHERE id = $1`, teamColumns)
	rows, err := r.pool.Query(ctx, query, id)
	if err != nil {
		return model.Team{}, fmt.Errorf("querying team: %w", err)
	}
	return pgx.CollectOneRow(rows, scanTeam)
}

// UpdateDivision changes the division column for a team.
func (r *TeamRepository) UpdateDivision(ctx context.Context, teamID, division string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE teams SET division = $1 WHERE id = $2`,
		division, teamID,
	)
	if err != nil {
		return fmt.Errorf("updating team division: %w", err)
	}
	return nil
}
