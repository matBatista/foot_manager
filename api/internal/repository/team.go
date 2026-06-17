package repository

import (
	"context"
	"fmt"

	"github.com/brassfoot/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TeamWithStats extends Team with squad average overall for the team-picker UI.
type TeamWithStats struct {
	model.Team
	AvgOverall int `json:"avg_overall"`
}

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

// ListForSelection returns all BR teams with computed avg_overall for the
// team-picker screen, ordered by division (serie_a first) then name.
func (r *TeamRepository) ListForSelection(ctx context.Context) ([]TeamWithStats, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.name, t.short_name, t.country, t.budget, t.division,
		       COALESCE(ROUND(AVG(p.overall))::int, 0) AS avg_overall
		FROM teams t
		LEFT JOIN players p ON p.team_id = t.id
		WHERE t.country = 'BR'
		GROUP BY t.id
		ORDER BY
		  CASE t.division WHEN 'serie_a' THEN 0 ELSE 1 END,
		  t.name
	`)
	if err != nil {
		return nil, fmt.Errorf("querying teams for selection: %w", err)
	}
	defer rows.Close()

	var result []TeamWithStats
	for rows.Next() {
		var ts TeamWithStats
		if err := rows.Scan(
			&ts.ID, &ts.Name, &ts.ShortName, &ts.Country,
			&ts.Budget, &ts.Division, &ts.AvgOverall,
		); err != nil {
			return nil, fmt.Errorf("scanning team: %w", err)
		}
		result = append(result, ts)
	}
	return result, rows.Err()
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
