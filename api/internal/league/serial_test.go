package league

import (
	"encoding/json"
	"testing"
)

func TestSeasonRoundTrip_Partial(t *testing.T) {
	original := NewSeason(buildSquads(6), 42)
	for i := 0; i < 3; i++ {
		if _, err := original.PlayRound(); err != nil {
			t.Fatalf("PlayRound %d: %v", i+1, err)
		}
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var restored Season
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if restored.NextRound() != original.NextRound() {
		t.Errorf("NextRound: got %d, want %d", restored.NextRound(), original.NextRound())
	}
	if len(restored.Results) != len(original.Results) {
		t.Errorf("Results len: got %d, want %d", len(restored.Results), len(original.Results))
	}
	if len(restored.Fixtures) != len(original.Fixtures) {
		t.Errorf("Fixtures len: got %d, want %d", len(restored.Fixtures), len(original.Fixtures))
	}
}

func TestSeasonRoundTrip_DeterministicContinuation(t *testing.T) {
	// Play 3 rounds, save, restore, play the rest from both copies — tables
	// must be identical (same seed reproduces same results).
	const n = 8
	original := NewSeason(buildSquads(n), 777)
	for i := 0; i < 3; i++ {
		if _, err := original.PlayRound(); err != nil {
			t.Fatalf("PlayRound: %v", err)
		}
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var restored Season
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if err := original.PlaySeason(); err != nil {
		t.Fatal("original PlaySeason:", err)
	}
	if err := restored.PlaySeason(); err != nil {
		t.Fatal("restored PlaySeason:", err)
	}

	origTable := original.Table()
	restTable := restored.Table()
	for i := range origTable {
		if origTable[i] != restTable[i] {
			t.Errorf("table row %d differs after continuation:\n  orig:    %+v\n  restored: %+v",
				i, origTable[i], restTable[i])
		}
	}
}

func TestSeasonRoundTrip_Done(t *testing.T) {
	s := NewSeason(buildSquads(4), 1)
	if err := s.PlaySeason(); err != nil {
		t.Fatal(err)
	}
	if !s.Done() {
		t.Fatal("want Done=true before marshal")
	}

	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var r Season
	if err := json.Unmarshal(data, &r); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if !r.Done() {
		t.Error("want Done=true after restore")
	}
	if len(r.Results) != len(s.Results) {
		t.Errorf("Results: got %d, want %d", len(r.Results), len(s.Results))
	}
}

func TestLeagueSnapshotRoundTrip(t *testing.T) {
	season := NewSeason(buildSquads(4), 99)
	if _, err := season.PlayRound(); err != nil {
		t.Fatal(err)
	}

	snap := LeagueSnapshot{
		Country: "Brazil",
		Names:   map[string]string{"T00": "Team Zero", "T01": "Team One", "T02": "Team Two", "T03": "Team Three"},
		Season:  season,
	}

	data, err := json.Marshal(snap)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var restored LeagueSnapshot
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if restored.Country != snap.Country {
		t.Errorf("Country: got %q, want %q", restored.Country, snap.Country)
	}
	for id, want := range snap.Names {
		if got := restored.Names[id]; got != want {
			t.Errorf("Names[%s]: got %q, want %q", id, got, want)
		}
	}
	if restored.Season.NextRound() != snap.Season.NextRound() {
		t.Errorf("NextRound: got %d, want %d", restored.Season.NextRound(), snap.Season.NextRound())
	}
	if len(restored.Season.Results) != len(snap.Season.Results) {
		t.Errorf("Results len: got %d, want %d", len(restored.Season.Results), len(snap.Season.Results))
	}
}
