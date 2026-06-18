package match

import (
	"testing"

	"github.com/brassfoot/api/internal/model"
)

// makeSquad builds a generic 11-player squad with a fixed overall, so tests
// can pit teams of known relative strength against each other.
func makeSquad(teamID string, rating int) []model.Player {
	mk := func(pos string, n int) model.Player {
		return model.Player{
			ID: teamID + pos + string(rune('0'+n)), TeamID: teamID,
			Name: teamID + "-" + pos + string(rune('0'+n)), Position: pos,
			Pace: rating, Shooting: rating, Passing: rating,
			Dribbling: rating, Defending: rating, Physical: rating, Overall: rating,
		}
	}
	var sq []model.Player
	sq = append(sq, mk("GK", 1))
	for i := 1; i <= 4; i++ {
		sq = append(sq, mk("DEF", i))
	}
	for i := 1; i <= 3; i++ {
		sq = append(sq, mk("MID", i))
	}
	for i := 1; i <= 3; i++ {
		sq = append(sq, mk("FWD", i))
	}
	return sq
}

func TestSimulate_Deterministic(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 75)}

	r1, err := Simulate(home, away, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	r2, err := Simulate(home, away, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r1.Home.Goals != r2.Home.Goals || r1.Away.Goals != r2.Away.Goals {
		t.Errorf("same seed should give same score: %d-%d vs %d-%d",
			r1.Home.Goals, r1.Away.Goals, r2.Home.Goals, r2.Away.Goals)
	}
}

func TestSimulate_Invariants(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 80)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 80)}

	r, err := Simulate(home, away, 7)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Possession must sum to 100.
	if r.Home.Possession+r.Away.Possession != 100 {
		t.Errorf("possession should sum to 100, got %d + %d", r.Home.Possession, r.Away.Possession)
	}

	// Goal events must match the goal tallies.
	homeGoals, awayGoals := 0, 0
	for _, e := range r.Events {
		if e.Minute < 1 || e.Minute > matchMinutes {
			t.Errorf("event minute out of range: %d", e.Minute)
		}
		if e.Type == EventGoal {
			switch e.TeamID {
			case "H":
				homeGoals++
			case "A":
				awayGoals++
			}
		}
	}
	if homeGoals != r.Home.Goals {
		t.Errorf("home goal events (%d) != home goals (%d)", homeGoals, r.Home.Goals)
	}
	if awayGoals != r.Away.Goals {
		t.Errorf("away goal events (%d) != away goals (%d)", awayGoals, r.Away.Goals)
	}

	// Goals can never exceed shots on target.
	if r.Home.Goals > r.Home.ShotsOnTarget || r.Away.Goals > r.Away.ShotsOnTarget {
		t.Errorf("goals exceeded shots on target")
	}
}

func TestSimulate_StrongerTeamWinsOnAverage(t *testing.T) {
	strong := TeamInput{TeamID: "S", Name: "Strong", Players: makeSquad("S", 90)}
	weak := TeamInput{TeamID: "W", Name: "Weak", Players: makeSquad("W", 55)}

	strongWins, weakWins := 0, 0
	for seed := int64(1); seed <= 200; seed++ {
		r, err := Simulate(strong, weak, seed)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		switch {
		case r.Home.Goals > r.Away.Goals:
			strongWins++
		case r.Away.Goals > r.Home.Goals:
			weakWins++
		}
	}
	if strongWins <= weakWins {
		t.Errorf("stronger team should win more often: strong=%d weak=%d", strongWins, weakWins)
	}
}

func TestSimulate_EmptySquad(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: nil}
	if _, err := Simulate(home, away, 1); err == nil {
		t.Error("expected error for empty away squad")
	}
}

// TestCondition_DecreasesWithMinute verifies fatigue: a fresh team is at full
// strength at kick-off and weaker by full time, and a team with higher Physical
// (stamina) tires less than a low-Physical team.
func TestCondition_DecreasesWithMinute(t *testing.T) {
	l := buildLineup(TeamInput{TeamID: "T", Name: "T", Players: makeSquad("T", 75)})

	start := l.condition(1)
	end := l.condition(matchMinutes)
	if start <= end {
		t.Errorf("condition should fall over the match: minute1=%.4f minute90=%.4f", start, end)
	}
	if start > 1.0001 {
		t.Errorf("a fresh, full-strength team should start at ~1.0, got %.4f", start)
	}

	// Build two squads differing only in Physical and compare late-game decay.
	hardy := makeSquad("Hardy", 75)
	frail := makeSquad("Frail", 75)
	for i := range hardy {
		hardy[i].Physical = 95
	}
	for i := range frail {
		frail[i].Physical = 40
	}
	lh := buildLineup(TeamInput{TeamID: "Hardy", Name: "Hardy", Players: hardy})
	lf := buildLineup(TeamInput{TeamID: "Frail", Name: "Frail", Players: frail})
	if lh.condition(matchMinutes) <= lf.condition(matchMinutes) {
		t.Errorf("higher Physical should tire less: hardy=%.4f frail=%.4f",
			lh.condition(matchMinutes), lf.condition(matchMinutes))
	}
}

// TestSimulate_RedCardStatMatchesEvents ensures the RedCards tally always
// equals the number of red_card events for each side, across many seeds.
func TestSimulate_RedCardStatMatchesEvents(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 78)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 78)}

	for seed := int64(1); seed <= 300; seed++ {
		r, err := Simulate(home, away, seed)
		if err != nil {
			t.Fatalf("seed %d: %v", seed, err)
		}
		homeReds, awayReds := 0, 0
		for _, e := range r.Events {
			if e.Type != EventRedCard {
				continue
			}
			switch e.TeamID {
			case "H":
				homeReds++
			case "A":
				awayReds++
			}
		}
		if homeReds != r.Home.RedCards {
			t.Errorf("seed %d: home red events (%d) != stat (%d)", seed, homeReds, r.Home.RedCards)
		}
		if awayReds != r.Away.RedCards {
			t.Errorf("seed %d: away red events (%d) != stat (%d)", seed, awayReds, r.Away.RedCards)
		}
	}
}

// ---- Analytics stats tests ----

// TestStats_Deterministic ensures new analytics fields are reproduced exactly
// when re-running Simulate with the same seed.
func TestStats_Deterministic(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 75)}

	r1, _ := Simulate(home, away, 99)
	r2, _ := Simulate(home, away, 99)

	if r1.Home.XG != r2.Home.XG || r1.Away.XG != r2.Away.XG {
		t.Errorf("xG not deterministic: %v vs %v", r1.Home.XG, r2.Home.XG)
	}
	if r1.Home.Passes != r2.Home.Passes || r1.Away.Passes != r2.Away.Passes {
		t.Errorf("Passes not deterministic: %d vs %d", r1.Home.Passes, r2.Home.Passes)
	}
	if r1.Home.Corners != r2.Home.Corners {
		t.Errorf("Corners not deterministic")
	}
	if r1.Home.Fouls != r2.Home.Fouls {
		t.Errorf("Fouls not deterministic")
	}
}

// TestStats_XG_Invariants checks hard invariants on expected goals.
func TestStats_XG_Invariants(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 75)}

	for seed := int64(1); seed <= 100; seed++ {
		r, err := Simulate(home, away, seed)
		if err != nil {
			t.Fatalf("seed %d: %v", err, seed)
		}
		if r.Home.XG < 0 || r.Away.XG < 0 {
			t.Errorf("seed %d: negative xG: home=%.2f away=%.2f", seed, r.Home.XG, r.Away.XG)
		}
		// XG is accumulated per chance as onTargetProb * goalProb.
		// Upper bound: shots × max(onTargetProb) × max(goalProb) = shots × 0.9 × goalConversionBase.
		maxXG := float64(r.Home.Shots) * 0.9 * goalConversionBase
		if r.Home.XG > maxXG+0.01 {
			t.Errorf("seed %d: home xG %.2f exceeds theoretical max %.2f", seed, r.Home.XG, maxXG)
		}
	}
}

// TestStats_XG_CoherentWithGoals verifies that over many seeds, cumulative xG
// is reasonably close to cumulative goals (within 30%).
func TestStats_XG_CoherentWithGoals(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 75)}

	var totalXG, totalGoals float64
	const n = 200
	for seed := int64(1); seed <= n; seed++ {
		r, _ := Simulate(home, away, seed)
		totalXG += r.Home.XG + r.Away.XG
		totalGoals += float64(r.Home.Goals + r.Away.Goals)
	}
	ratio := totalXG / totalGoals
	if ratio < 0.7 || ratio > 1.5 {
		t.Errorf("xG/goals ratio %.2f outside [0.7, 1.5] over %d seeds", ratio, n)
	}
}

// TestStats_Passes_Reasonable checks that passes and pass accuracy are within
// plausible football ranges.
func TestStats_Passes_Reasonable(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 75)}

	for seed := int64(1); seed <= 50; seed++ {
		r, _ := Simulate(home, away, seed)
		for _, s := range []struct {
			label string
			stats TeamStats
		}{{"home", r.Home}, {"away", r.Away}} {
			if s.stats.Passes < 50 || s.stats.Passes > 900 {
				t.Errorf("seed %d %s: Passes=%d outside [50,900]", seed, s.label, s.stats.Passes)
			}
			if s.stats.PassAccuracy < 65 || s.stats.PassAccuracy > 92 {
				t.Errorf("seed %d %s: PassAccuracy=%d outside [65,92]", seed, s.label, s.stats.PassAccuracy)
			}
		}
	}
}

// TestStats_Corners_NonNegative and TestStats_Fouls_NonNegative.
func TestStats_Corners_Fouls(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 75)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 75)}

	for seed := int64(1); seed <= 100; seed++ {
		r, _ := Simulate(home, away, seed)
		if r.Home.Corners < 0 || r.Away.Corners < 0 {
			t.Errorf("seed %d: negative corners", seed)
		}
		if r.Home.Fouls < 0 || r.Away.Fouls < 0 {
			t.Errorf("seed %d: negative fouls h=%d a=%d", seed, r.Home.Fouls, r.Away.Fouls)
		}
		// Fouls scale with cards; verify they're internally consistent:
		// fouls must be at least the base level.
		if r.Home.Fouls < foulBase || r.Away.Fouls < foulBase {
			t.Errorf("seed %d: fouls below base (%d): h=%d a=%d", seed, foulBase, r.Home.Fouls, r.Away.Fouls)
		}
	}
}

// TestSecondYellowIsRed checks the booking model: a player who reaches two
// yellows must appear in a red_card event detailed "second yellow".
func TestSecondYellowIsRed(t *testing.T) {
	home := TeamInput{TeamID: "H", Name: "Home", Players: makeSquad("H", 78)}
	away := TeamInput{TeamID: "A", Name: "Away", Players: makeSquad("A", 78)}

	foundSecondYellow := false
	for seed := int64(1); seed <= 2000 && !foundSecondYellow; seed++ {
		r, err := Simulate(home, away, seed)
		if err != nil {
			t.Fatalf("seed %d: %v", seed, err)
		}
		// Count yellows per player; anyone with 2 must have a red event.
		yellows := map[string]int{}
		reds := map[string]bool{}
		for _, e := range r.Events {
			switch e.Type {
			case EventYellowCard:
				yellows[e.Player]++
			case EventRedCard:
				reds[e.Player] = true
				if e.Detail == "second yellow" {
					foundSecondYellow = true
				}
			}
		}
		for player, n := range yellows {
			if n >= 2 && !reds[player] {
				t.Errorf("seed %d: %s got %d yellows but no red card", seed, player, n)
			}
		}
	}
	if !foundSecondYellow {
		t.Error("expected at least one second-yellow red across 2000 seeds")
	}
}
