// Package league turns a set of teams into a playable season: it generates a
// fixture list, drives the match engine to play rounds, and computes the
// standings table.
//
// Fixture generation and table building are pure (no I/O, no match engine) so
// they are trivially testable; the Season runner (season.go) wires them to the
// match engine for fast auto-simulation.
package league

import (
	"sort"

	"github.com/brassfoot/api/internal/match"
)

// Fixture is a single scheduled match in a given round.
type Fixture struct {
	Round int    `json:"round"`
	Home  string `json:"home_team_id"`
	Away  string `json:"away_team_id"`
}

// Score is the final scoreline of a played fixture.
type Score struct {
	Home int `json:"home"`
	Away int `json:"away"`
}

// Played is a completed fixture together with its score and match statistics.
// HomeStats and AwayStats are nil for legacy data serialised before analytics
// were introduced (safe to display with zero-value fallbacks).
type Played struct {
	Fixture
	Score     Score             `json:"score"`
	HomeStats *match.TeamStats  `json:"home_stats,omitempty"`
	AwayStats *match.TeamStats  `json:"away_stats,omitempty"`
}

// GenerateFixtures returns a double round-robin schedule: every pair of teams
// meets twice, once at each side's home. It uses the circle method. If the
// number of teams is odd, a dummy "bye" is added so one team rests each round
// (no fixture is emitted for the resting team).
//
// For n teams the schedule has n*(n-1) fixtures across 2*(n-1) rounds (or n
// rounds per leg when n is odd, due to the bye).
func GenerateFixtures(teamIDs []string) []Fixture {
	ids := append([]string(nil), teamIDs...)
	const bye = ""
	if len(ids)%2 == 1 {
		ids = append(ids, bye)
	}
	n := len(ids)
	if n < 2 {
		return nil
	}

	rounds := n - 1
	half := n / 2

	var firstLeg []Fixture
	arr := append([]string(nil), ids...)
	for r := 0; r < rounds; r++ {
		for i := 0; i < half; i++ {
			home, away := arr[i], arr[n-1-i]
			if home == bye || away == bye {
				continue
			}
			// Alternate which side is home to keep home/away counts balanced.
			if (r+i)%2 == 1 {
				home, away = away, home
			}
			firstLeg = append(firstLeg, Fixture{Round: r + 1, Home: home, Away: away})
		}
		arr = rotate(arr)
	}

	// Second leg mirrors the first with home/away swapped, rounds offset so the
	// reverse fixture always falls after the original.
	fixtures := make([]Fixture, 0, len(firstLeg)*2)
	fixtures = append(fixtures, firstLeg...)
	for _, f := range firstLeg {
		fixtures = append(fixtures, Fixture{Round: f.Round + rounds, Home: f.Away, Away: f.Home})
	}
	return fixtures
}

// rotate implements the circle method: element 0 stays fixed while the rest
// rotate one step clockwise (the last element moves to position 1).
func rotate(arr []string) []string {
	n := len(arr)
	out := make([]string, n)
	out[0] = arr[0]
	out[1] = arr[n-1]
	for i := 2; i < n; i++ {
		out[i] = arr[i-1]
	}
	return out
}

// TableRow is one team's line in the standings.
type TableRow struct {
	TeamID       string `json:"team_id"`
	Played       int    `json:"played"`
	Won          int    `json:"won"`
	Drawn        int    `json:"drawn"`
	Lost         int    `json:"lost"`
	GoalsFor     int    `json:"goals_for"`
	GoalsAgainst int    `json:"goals_against"`
	GoalDiff     int    `json:"goal_diff"`
	Points       int    `json:"points"`
}

// BuildTable computes the standings from the given results. Teams with no
// results still appear (all zeros). Rows are sorted by points, then goal
// difference, then goals for, then team ID for a stable tie-break.
func BuildTable(teamIDs []string, results []Played) []TableRow {
	rows := make([]TableRow, len(teamIDs))
	idx := make(map[string]int, len(teamIDs))
	for i, id := range teamIDs {
		rows[i] = TableRow{TeamID: id}
		idx[id] = i
	}

	for _, res := range results {
		hi, hok := idx[res.Home]
		ai, aok := idx[res.Away]
		if !hok || !aok {
			continue
		}
		h, a := &rows[hi], &rows[ai]
		h.Played++
		a.Played++
		h.GoalsFor += res.Score.Home
		h.GoalsAgainst += res.Score.Away
		a.GoalsFor += res.Score.Away
		a.GoalsAgainst += res.Score.Home

		switch {
		case res.Score.Home > res.Score.Away:
			h.Won++
			a.Lost++
			h.Points += 3
		case res.Score.Home < res.Score.Away:
			a.Won++
			h.Lost++
			a.Points += 3
		default:
			h.Drawn++
			a.Drawn++
			h.Points++
			a.Points++
		}
	}

	for i := range rows {
		rows[i].GoalDiff = rows[i].GoalsFor - rows[i].GoalsAgainst
	}

	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Points != rows[j].Points {
			return rows[i].Points > rows[j].Points
		}
		if rows[i].GoalDiff != rows[j].GoalDiff {
			return rows[i].GoalDiff > rows[j].GoalDiff
		}
		if rows[i].GoalsFor != rows[j].GoalsFor {
			return rows[i].GoalsFor > rows[j].GoalsFor
		}
		return rows[i].TeamID < rows[j].TeamID
	})
	return rows
}
