package league

import (
	"fmt"
	"testing"

	"github.com/brassfoot/api/internal/model"
)

func teamIDs(n int) []string {
	ids := make([]string, n)
	for i := 0; i < n; i++ {
		ids[i] = fmt.Sprintf("T%02d", i)
	}
	return ids
}

// unorderedPair gives a stable key for {a,b} regardless of order.
func unorderedPair(a, b string) string {
	if a < b {
		return a + "|" + b
	}
	return b + "|" + a
}

func TestGenerateFixtures_EachPairTwiceHomeAndAway(t *testing.T) {
	for _, n := range []int{2, 4, 5, 20} {
		ids := teamIDs(n)
		fixtures := GenerateFixtures(ids)

		if want := n * (n - 1); len(fixtures) != want {
			t.Errorf("n=%d: got %d fixtures, want %d", n, len(fixtures), want)
		}

		meetings := map[string]int{}
		homeCount := map[string]int{} // "home>away" oriented
		for _, f := range fixtures {
			meetings[unorderedPair(f.Home, f.Away)]++
			homeCount[f.Home+">"+f.Away]++
		}

		// Every unordered pair must meet exactly twice.
		for i := 0; i < n; i++ {
			for j := i + 1; j < n; j++ {
				key := unorderedPair(ids[i], ids[j])
				if meetings[key] != 2 {
					t.Errorf("n=%d: pair %s met %d times, want 2", n, key, meetings[key])
				}
				// And each orientation exactly once (balanced home/away).
				if homeCount[ids[i]+">"+ids[j]] != 1 || homeCount[ids[j]+">"+ids[i]] != 1 {
					t.Errorf("n=%d: pair %s home/away not balanced", n, key)
				}
			}
		}
	}
}

func TestGenerateFixtures_NoTeamTwicePerRound(t *testing.T) {
	for _, n := range []int{4, 5, 20} {
		fixtures := GenerateFixtures(teamIDs(n))
		seenInRound := map[int]map[string]bool{}
		for _, f := range fixtures {
			if seenInRound[f.Round] == nil {
				seenInRound[f.Round] = map[string]bool{}
			}
			for _, id := range []string{f.Home, f.Away} {
				if seenInRound[f.Round][id] {
					t.Errorf("n=%d: team %s appears twice in round %d", n, id, f.Round)
				}
				seenInRound[f.Round][id] = true
			}
		}
	}
}

func TestBuildTable_PointsAndOrder(t *testing.T) {
	ids := []string{"A", "B", "C"}
	results := []Played{
		{Fixture{1, "A", "B"}, Score{2, 0}}, // A wins
		{Fixture{1, "B", "C"}, Score{1, 1}}, // draw
		{Fixture{2, "A", "C"}, Score{0, 0}}, // draw
	}
	table := BuildTable(ids, results)

	// A: W+D = 4 pts, GD +2. B: L+D = 1 pt. C: D+D = 2 pts.
	got := map[string]TableRow{}
	for _, r := range table {
		got[r.TeamID] = r
	}
	if got["A"].Points != 4 || got["A"].GoalDiff != 2 {
		t.Errorf("A: got %d pts GD %d, want 4 / +2", got["A"].Points, got["A"].GoalDiff)
	}
	if got["B"].Points != 1 {
		t.Errorf("B: got %d pts, want 1", got["B"].Points)
	}
	if got["C"].Points != 2 {
		t.Errorf("C: got %d pts, want 2", got["C"].Points)
	}
	// Order: A (4) first, then C (2), then B (1).
	if table[0].TeamID != "A" || table[1].TeamID != "C" || table[2].TeamID != "B" {
		t.Errorf("order wrong: %s %s %s", table[0].TeamID, table[1].TeamID, table[2].TeamID)
	}
}

// makeSquad mirrors the match package's helper: a generic 11 with a fixed
// overall, varied by team so seasons produce a spread of results.
func makeSquad(teamID string, rating int) []model.Player {
	mk := func(pos string, n int) model.Player {
		return model.Player{
			ID: fmt.Sprintf("%s-%s-%d", teamID, pos, n), TeamID: teamID,
			Name: fmt.Sprintf("%s %s%d", teamID, pos, n), Position: pos,
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

func buildSquads(n int) []Squad {
	squads := make([]Squad, n)
	for i := 0; i < n; i++ {
		id := fmt.Sprintf("T%02d", i)
		// Ratings spread 60..88 so the table isn't a coin flip.
		rating := 60 + (i*28)/maxInt(n-1, 1)
		squads[i] = Squad{TeamID: id, Name: id, Players: makeSquad(id, rating)}
	}
	return squads
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func TestSeason_PlaysEveryFixtureAndConservesPoints(t *testing.T) {
	const n = 8
	s := NewSeason(buildSquads(n), 99)

	if err := s.PlaySeason(); err != nil {
		t.Fatalf("PlaySeason: %v", err)
	}
	if !s.Done() {
		t.Fatal("season should be complete after PlaySeason")
	}
	if len(s.Results) != n*(n-1) {
		t.Errorf("played %d fixtures, want %d", len(s.Results), n*(n-1))
	}

	table := s.Table()

	// Every team plays 2*(n-1) matches.
	totalPlayed, totalPoints, totalGF, totalGA := 0, 0, 0, 0
	for _, r := range table {
		if r.Played != 2*(n-1) {
			t.Errorf("team %s played %d, want %d", r.TeamID, r.Played, 2*(n-1))
		}
		totalPlayed += r.Played
		totalPoints += r.Points
		totalGF += r.GoalsFor
		totalGA += r.GoalsAgainst
	}
	// Goals for and against must net out across the whole league.
	if totalGF != totalGA {
		t.Errorf("league GF (%d) != GA (%d)", totalGF, totalGA)
	}
	// Points conservation: each match awards 3 (decisive) or 2 (draw).
	games := len(s.Results)
	draws := 0
	for _, res := range s.Results {
		if res.Score.Home == res.Score.Away {
			draws++
		}
	}
	wantPoints := 3*(games-draws) + 2*draws
	if totalPoints != wantPoints {
		t.Errorf("total points %d, want %d (games=%d draws=%d)", totalPoints, wantPoints, games, draws)
	}
}

func TestSeason_Deterministic(t *testing.T) {
	s1 := NewSeason(buildSquads(6), 12345)
	s2 := NewSeason(buildSquads(6), 12345)
	if err := s1.PlaySeason(); err != nil {
		t.Fatal(err)
	}
	if err := s2.PlaySeason(); err != nil {
		t.Fatal(err)
	}
	t1, t2 := s1.Table(), s2.Table()
	for i := range t1 {
		if t1[i] != t2[i] {
			t.Errorf("row %d differs: %+v vs %+v", i, t1[i], t2[i])
		}
	}
}

func TestSeason_StrongerTeamsFinishHigher(t *testing.T) {
	// T07 is the strongest (rating ~88), T00 the weakest (~60).
	const n = 8
	s := NewSeason(buildSquads(n), 2024)
	if err := s.PlaySeason(); err != nil {
		t.Fatal(err)
	}
	pos := map[string]int{}
	for i, r := range s.Table() {
		pos[r.TeamID] = i
	}
	if pos["T07"] >= pos["T00"] {
		t.Errorf("strongest team T07 (pos %d) should finish above weakest T00 (pos %d)",
			pos["T07"], pos["T00"])
	}
}
