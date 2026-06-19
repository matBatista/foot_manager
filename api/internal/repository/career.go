package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/brassfoot/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrCareerNotFound = errors.New("career not found")

type CareerRepository struct {
	pool *pgxpool.Pool
}

func NewCareerRepository(pool *pgxpool.Pool) *CareerRepository {
	return &CareerRepository{pool: pool}
}

// Create inserts a new career record for the manager. Multiple careers per
// manager are allowed; nickname labels this career for display.
func (r *CareerRepository) Create(ctx context.Context, managerID, division, nickname string) (model.Career, error) {
	var c model.Career
	var leagueID *string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO careers (manager_id, division, nickname)
         VALUES ($1, $2, $3)
         RETURNING id, manager_id, season_number, active_league_id, division, nickname, created_at`,
		managerID, division, nickname,
	).Scan(&c.ID, &c.ManagerID, &c.SeasonNumber, &leagueID, &c.Division, &c.Nickname, &c.CreatedAt)
	if err != nil {
		return model.Career{}, fmt.Errorf("creating career: %w", err)
	}
	if leagueID != nil {
		c.ActiveLeagueID = *leagueID
	}
	return c, nil
}

// GetByManagerID returns the most recent career for the given manager.
func (r *CareerRepository) GetByManagerID(ctx context.Context, managerID string) (model.Career, error) {
	var c model.Career
	var leagueID *string
	err := r.pool.QueryRow(ctx,
		`SELECT id, manager_id, season_number, active_league_id, division, nickname, created_at
         FROM careers WHERE manager_id = $1 ORDER BY created_at DESC LIMIT 1`,
		managerID,
	).Scan(&c.ID, &c.ManagerID, &c.SeasonNumber, &leagueID, &c.Division, &c.Nickname, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Career{}, ErrCareerNotFound
	}
	if err != nil {
		return model.Career{}, fmt.Errorf("loading career: %w", err)
	}
	if leagueID != nil {
		c.ActiveLeagueID = *leagueID
	}
	return c, nil
}

// GetByID returns a specific career by ID, verifying manager ownership.
func (r *CareerRepository) GetByID(ctx context.Context, careerID, managerID string) (model.Career, error) {
	var c model.Career
	var leagueID *string
	err := r.pool.QueryRow(ctx,
		`SELECT id, manager_id, season_number, active_league_id, division, nickname, created_at
         FROM careers WHERE id = $1 AND manager_id = $2`,
		careerID, managerID,
	).Scan(&c.ID, &c.ManagerID, &c.SeasonNumber, &leagueID, &c.Division, &c.Nickname, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Career{}, ErrCareerNotFound
	}
	if err != nil {
		return model.Career{}, fmt.Errorf("loading career: %w", err)
	}
	if leagueID != nil {
		c.ActiveLeagueID = *leagueID
	}
	return c, nil
}

// ListByManagerID returns all careers for the given manager, newest first.
func (r *CareerRepository) ListByManagerID(ctx context.Context, managerID string) ([]model.Career, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manager_id, season_number, active_league_id, division, nickname, created_at
         FROM careers WHERE manager_id = $1 ORDER BY created_at DESC`,
		managerID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing careers: %w", err)
	}
	defer rows.Close()
	var careers []model.Career
	for rows.Next() {
		var c model.Career
		var leagueID *string
		if err := rows.Scan(&c.ID, &c.ManagerID, &c.SeasonNumber, &leagueID, &c.Division, &c.Nickname, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning career: %w", err)
		}
		if leagueID != nil {
			c.ActiveLeagueID = *leagueID
		}
		careers = append(careers, c)
	}
	if careers == nil {
		careers = []model.Career{}
	}
	return careers, rows.Err()
}

// Delete removes a career. Returns ErrCareerNotFound if the career does not
// belong to the manager.
func (r *CareerRepository) Delete(ctx context.Context, careerID, managerID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM careers WHERE id = $1 AND manager_id = $2`,
		careerID, managerID,
	)
	if err != nil {
		return fmt.Errorf("deleting career: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrCareerNotFound
	}
	return nil
}

// Update writes the mutable fields of a career back to the DB.
func (r *CareerRepository) Update(ctx context.Context, c model.Career) error {
	var leagueID *string
	if c.ActiveLeagueID != "" {
		leagueID = &c.ActiveLeagueID
	}
	_, err := r.pool.Exec(ctx,
		`UPDATE careers
         SET season_number = $1, active_league_id = $2, division = $3
         WHERE id = $4`,
		c.SeasonNumber, leagueID, c.Division, c.ID,
	)
	if err != nil {
		return fmt.Errorf("updating career: %w", err)
	}
	return nil
}

// AddSeasonRecord persists a concluded-season entry.
func (r *CareerRepository) AddSeasonRecord(ctx context.Context, rec model.SeasonRecord) error {
	relegatedJSON, err := json.Marshal(rec.RelegatedIDs)
	if err != nil {
		return fmt.Errorf("marshalling relegated_ids: %w", err)
	}
	promotedJSON, err := json.Marshal(rec.PromotedIDs)
	if err != nil {
		return fmt.Errorf("marshalling promoted_ids: %w", err)
	}

	var championID *string
	if rec.ChampionID != "" {
		championID = &rec.ChampionID
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO season_records
             (manager_id, season_number, division, champion_id, manager_position, relegated_ids, promoted_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		rec.ManagerID, rec.SeasonNumber, rec.Division, championID,
		rec.ManagerPosition, relegatedJSON, promotedJSON,
	)
	if err != nil {
		return fmt.Errorf("adding season record: %w", err)
	}
	return nil
}

// ListSeasonRecords returns all season history for the manager, oldest first.
func (r *CareerRepository) ListSeasonRecords(ctx context.Context, managerID string) ([]model.SeasonRecord, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manager_id, season_number, division,
                COALESCE(champion_id::text,''), manager_position,
                relegated_ids, promoted_ids, recorded_at
         FROM season_records
         WHERE manager_id = $1
         ORDER BY season_number`,
		managerID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying season records: %w", err)
	}
	defer rows.Close()

	var records []model.SeasonRecord
	for rows.Next() {
		var rec model.SeasonRecord
		var relegatedJSON, promotedJSON []byte
		var recordedAt time.Time
		if err := rows.Scan(
			&rec.ID, &rec.ManagerID, &rec.SeasonNumber, &rec.Division,
			&rec.ChampionID, &rec.ManagerPosition,
			&relegatedJSON, &promotedJSON, &recordedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning season record: %w", err)
		}
		rec.RecordedAt = recordedAt
		if err := json.Unmarshal(relegatedJSON, &rec.RelegatedIDs); err != nil {
			rec.RelegatedIDs = []string{}
		}
		if err := json.Unmarshal(promotedJSON, &rec.PromotedIDs); err != nil {
			rec.PromotedIDs = []string{}
		}
		records = append(records, rec)
	}
	if records == nil {
		records = []model.SeasonRecord{}
	}
	return records, rows.Err()
}
