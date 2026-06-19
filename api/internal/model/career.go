package model

import "time"

// Career tracks a manager's season-over-season progression.
// active_league_id links to the current season's entry in active_leagues.
// Division is 'serie_a' or 'serie_b' — the manager's tier for the current season.
type Career struct {
	ID             string    `json:"id"`
	ManagerID      string    `json:"manager_id"`
	SeasonNumber   int       `json:"season_number"`
	ActiveLeagueID string    `json:"active_league_id,omitempty"`
	Division       string    `json:"division"`
	Nickname       string    `json:"nickname"`
	CreatedAt      time.Time `json:"created_at"`

	// Display fields — not stored in DB, populated by handler.
	TeamName string `json:"team_name,omitempty"`
	TeamAbbr string `json:"team_abbr,omitempty"`
}

// SeasonRecord is the permanent log entry written at the end of each season.
type SeasonRecord struct {
	ID              string    `json:"id"`
	ManagerID       string    `json:"manager_id"`
	SeasonNumber    int       `json:"season_number"`
	Division        string    `json:"division"`
	ChampionID      string    `json:"champion_id"`
	ChampionName    string    `json:"champion_name,omitempty"`
	ManagerPosition int       `json:"manager_position"`
	RelegatedIDs    []string  `json:"relegated_ids"`
	PromotedIDs     []string  `json:"promoted_ids"`
	RecordedAt      time.Time `json:"recorded_at"`
}
