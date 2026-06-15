package league

import (
	"github.com/brassfoot/api/internal/match"
	"github.com/brassfoot/api/internal/model"
)

// Squad is a team plus the players available to it for the season.
type Squad struct {
	TeamID  string
	Name    string
	Players []model.Player
}

// Season holds a generated schedule and accumulates results as rounds are
// played. It is the bridge between the pure fixture/table logic and the match
// engine. A Season is single-use and not safe for concurrent play.
type Season struct {
	Fixtures []Fixture
	Results  []Played

	teamIDs   []string
	squads    map[string]match.TeamInput
	seed      int64
	nextRound int
}

// NewSeason builds a double round-robin schedule for the given squads. The
// seed makes the whole season reproducible: each fixture is simulated with a
// seed derived from this base, so replaying a season yields identical results.
func NewSeason(squads []Squad, seed int64) *Season {
	ids := make([]string, len(squads))
	inputs := make(map[string]match.TeamInput, len(squads))
	for i, s := range squads {
		ids[i] = s.TeamID
		inputs[s.TeamID] = match.TeamInput{TeamID: s.TeamID, Name: s.Name, Players: s.Players}
	}
	return &Season{
		Fixtures:  GenerateFixtures(ids),
		teamIDs:   ids,
		squads:    inputs,
		seed:      seed,
		nextRound: 1,
	}
}

// TotalRounds is the number of rounds in the schedule.
func (s *Season) TotalRounds() int {
	max := 0
	for _, f := range s.Fixtures {
		if f.Round > max {
			max = f.Round
		}
	}
	return max
}

// NextRound is the round number that PlayRound will simulate next. It exceeds
// TotalRounds once the season is complete.
func (s *Season) NextRound() int { return s.nextRound }

// Done reports whether every round has been played.
func (s *Season) Done() bool { return s.nextRound > s.TotalRounds() }

// PlayRound simulates every fixture in the next unplayed round, appends the
// results to the season, and returns them. It returns nil when the season is
// already complete.
func (s *Season) PlayRound() ([]Played, error) {
	if s.Done() {
		return nil, nil
	}
	var out []Played
	for i, f := range s.Fixtures {
		if f.Round != s.nextRound {
			continue
		}
		home := s.squads[f.Home]
		away := s.squads[f.Away]
		// Per-fixture seed derived from the base seed and the fixture's stable
		// index, keeping the whole season deterministic.
		r, err := match.Simulate(home, away, s.seed+int64(i)+1)
		if err != nil {
			return nil, err
		}
		played := Played{
			Fixture: f,
			Score:   Score{Home: r.Home.Goals, Away: r.Away.Goals},
		}
		s.Results = append(s.Results, played)
		out = append(out, played)
	}
	s.nextRound++
	return out, nil
}

// PlaySeason plays all remaining rounds at once — the fast auto-sim that lets a
// manager blow through a whole season instantly.
func (s *Season) PlaySeason() error {
	for !s.Done() {
		if _, err := s.PlayRound(); err != nil {
			return err
		}
	}
	return nil
}

// Table returns the current standings from all results played so far.
func (s *Season) Table() []TableRow {
	return BuildTable(s.teamIDs, s.Results)
}
