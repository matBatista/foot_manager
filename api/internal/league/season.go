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
		homeStats := r.Home
		awayStats := r.Away
		played := Played{
			Fixture:   f,
			Score:     Score{Home: r.Home.Goals, Away: r.Away.Goals},
			HomeStats: &homeStats,
			AwayStats: &awayStats,
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

// TeamAggStats holds aggregated match statistics for one team over the season.
type TeamAggStats struct {
	TeamID        string  `json:"team_id"`
	Name          string  `json:"name"`
	Played        int     `json:"played"`
	AvgPossession float64 `json:"avg_possession"`
	XGFor         float64 `json:"xg_for"`
	XGAgainst     float64 `json:"xg_against"`
	AvgXGFor      float64 `json:"avg_xg_for"`
	AvgXGAgainst  float64 `json:"avg_xg_against"`
	AvgShots      float64 `json:"avg_shots"`
	WinRate       float64 `json:"win_rate"`
}

// AggStats computes per-team aggregated match statistics from all results
// played so far. names maps team ID to display name. Teams with no results
// still appear (all zeros). Results without stats (legacy data) are skipped
// for the analytics fields but still counted for win/draw/loss.
func (s *Season) AggStats(names map[string]string) []TeamAggStats {
	type acc struct {
		played      int
		won         int
		possSum     float64
		xgFor       float64
		xgAgainst   float64
		shotsSum    float64
		statsPlayed int // matches that have analytics data
	}
	m := make(map[string]*acc, len(s.teamIDs))
	for _, id := range s.teamIDs {
		m[id] = &acc{}
	}

	for _, p := range s.Results {
		ha, hok := m[p.Home]
		aa, aok := m[p.Away]
		if !hok || !aok {
			continue
		}

		ha.played++
		aa.played++
		if p.Score.Home > p.Score.Away {
			ha.won++
		} else if p.Score.Away > p.Score.Home {
			aa.won++
		}

		if p.HomeStats != nil && p.AwayStats != nil {
			ha.statsPlayed++
			aa.statsPlayed++
			ha.possSum += float64(p.HomeStats.Possession)
			aa.possSum += float64(p.AwayStats.Possession)
			ha.xgFor += p.HomeStats.XG
			aa.xgFor += p.AwayStats.XG
			ha.xgAgainst += p.AwayStats.XG
			aa.xgAgainst += p.HomeStats.XG
			ha.shotsSum += float64(p.HomeStats.Shots)
			aa.shotsSum += float64(p.AwayStats.Shots)
		}
	}

	out := make([]TeamAggStats, 0, len(s.teamIDs))
	for _, id := range s.teamIDs {
		a := m[id]
		row := TeamAggStats{
			TeamID: id,
			Name:   names[id],
			Played: a.played,
			XGFor:  round2(a.xgFor),
			XGAgainst: round2(a.xgAgainst),
		}
		if a.statsPlayed > 0 {
			n := float64(a.statsPlayed)
			row.AvgPossession = round2(a.possSum / n)
			row.AvgXGFor = round2(a.xgFor / n)
			row.AvgXGAgainst = round2(a.xgAgainst / n)
			row.AvgShots = round2(a.shotsSum / n)
		}
		if a.played > 0 {
			row.WinRate = round2(float64(a.won) / float64(a.played) * 100)
		}
		out = append(out, row)
	}
	return out
}

func round2(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}
