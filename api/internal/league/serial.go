package league

import (
	"encoding/json"

	"github.com/brassfoot/api/internal/match"
	"github.com/brassfoot/api/internal/model"
)

// seasonJSON is the serialisable mirror of Season including its unexported
// fields. It is never exposed outside the package.
type seasonJSON struct {
	Fixtures  []Fixture           `json:"fixtures"`
	Results   []Played            `json:"results"`
	TeamIDs   []string            `json:"team_ids"`
	Squads    map[string]squadDTO `json:"squads"`
	Seed      int64               `json:"seed"`
	NextRound int                 `json:"next_round"`
}

// squadDTO is a serialisable copy of match.TeamInput (which has no json tags
// on TeamID/Name, so we use our own DTO to get stable key names).
type squadDTO struct {
	TeamID  string         `json:"team_id"`
	Name    string         `json:"name"`
	Players []model.Player `json:"players"`
}

// MarshalJSON serialises a Season including all unexported fields needed for a
// faithful round-trip.
func (s *Season) MarshalJSON() ([]byte, error) {
	squads := make(map[string]squadDTO, len(s.squads))
	for id, ti := range s.squads {
		squads[id] = squadDTO{TeamID: ti.TeamID, Name: ti.Name, Players: ti.Players}
	}
	return json.Marshal(seasonJSON{
		Fixtures:  s.Fixtures,
		Results:   s.Results,
		TeamIDs:   s.teamIDs,
		Squads:    squads,
		Seed:      s.seed,
		NextRound: s.nextRound,
	})
}

// UnmarshalJSON restores a Season from the form written by MarshalJSON.
func (s *Season) UnmarshalJSON(data []byte) error {
	var js seasonJSON
	if err := json.Unmarshal(data, &js); err != nil {
		return err
	}
	s.Fixtures = js.Fixtures
	s.Results = js.Results
	s.teamIDs = js.TeamIDs
	s.seed = js.Seed
	s.nextRound = js.NextRound
	s.squads = make(map[string]match.TeamInput, len(js.Squads))
	for id, sq := range js.Squads {
		s.squads[id] = match.TeamInput{TeamID: sq.TeamID, Name: sq.Name, Players: sq.Players}
	}
	return nil
}

// LeagueSnapshot is the complete state persisted in save_games. It wraps the
// Season plus the display metadata that lives outside the Season itself.
type LeagueSnapshot struct {
	Country string            `json:"country"`
	Names   map[string]string `json:"names"` // team ID → display name
	Season  *Season           `json:"season"`
}
