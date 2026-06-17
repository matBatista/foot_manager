package promotion_test

import (
	"fmt"
	"testing"

	"github.com/brassfoot/api/internal/league"
	"github.com/brassfoot/api/internal/promotion"
)

// makeTable builds a []league.TableRow slice with the given team IDs
// and synthetic point values (first team gets the most points).
func makeTable(ids ...string) []league.TableRow {
	rows := make([]league.TableRow, len(ids))
	for i, id := range ids {
		rows[i] = league.TableRow{
			TeamID: id,
			Points: (len(ids) - i) * 3,
		}
	}
	return rows
}

func TestApply_StandardCase(t *testing.T) {
	serieA := makeTable("a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10",
		"a11", "a12", "a13", "a14", "a15", "a16", "a17", "a18", "a19", "a20")
	serieB := makeTable("b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10",
		"b11", "b12", "b13", "b14", "b15", "b16", "b17", "b18", "b19", "b20")

	res := promotion.Apply(serieA, serieB)

	if len(res.Relegated) != promotion.ZoneSize {
		t.Fatalf("want %d relegated, got %d", promotion.ZoneSize, len(res.Relegated))
	}
	if len(res.Promoted) != promotion.ZoneSize {
		t.Fatalf("want %d promoted, got %d", promotion.ZoneSize, len(res.Promoted))
	}

	// Last 4 of Série A must be relegated.
	wantRelegated := []string{"a17", "a18", "a19", "a20"}
	for i, id := range res.Relegated {
		if id != wantRelegated[i] {
			t.Errorf("relegated[%d]: want %s, got %s", i, wantRelegated[i], id)
		}
	}

	// Top 4 of Série B must be promoted.
	wantPromoted := []string{"b1", "b2", "b3", "b4"}
	for i, id := range res.Promoted {
		if id != wantPromoted[i] {
			t.Errorf("promoted[%d]: want %s, got %s", i, wantPromoted[i], id)
		}
	}
}

func TestApply_EmptyTables(t *testing.T) {
	res := promotion.Apply(nil, nil)
	if len(res.Relegated) != 0 || len(res.Promoted) != 0 {
		t.Fatal("expected empty result for empty tables")
	}
}

func TestApply_TablesSmaller_ThanZoneSize(t *testing.T) {
	// Only 2 teams in each division — both should be affected.
	serieA := makeTable("a1", "a2")
	serieB := makeTable("b1", "b2")

	res := promotion.Apply(serieA, serieB)

	if len(res.Relegated) != 2 {
		t.Fatalf("want 2 relegated from tiny division, got %d", len(res.Relegated))
	}
	if len(res.Promoted) != 2 {
		t.Fatalf("want 2 promoted from tiny division, got %d", len(res.Promoted))
	}
}

func TestApply_TieInZone_Deterministic(t *testing.T) {
	// Two teams tied on points at positions 17-18 in a 20-team league.
	rows := make([]league.TableRow, 20)
	for i := range rows {
		rows[i] = league.TableRow{TeamID: fmt.Sprintf("team%02d", i+1), Points: (20 - i) * 3}
	}
	// Force a tie for positions 17 and 18 — same points, same goal diff.
	rows[16].Points = 10
	rows[17].Points = 10

	serieB := makeTable("b1", "b2", "b3", "b4")

	res1 := promotion.Apply(rows, serieB)
	res2 := promotion.Apply(rows, serieB)

	if len(res1.Relegated) != promotion.ZoneSize {
		t.Fatalf("want %d relegated, got %d", promotion.ZoneSize, len(res1.Relegated))
	}
	// Same input → same output every call (determinism).
	for i, id := range res1.Relegated {
		if id != res2.Relegated[i] {
			t.Errorf("non-deterministic result at position %d", i)
		}
	}
}

func TestApply_ManagerTeamRelegated(t *testing.T) {
	// Manager's team is last → should appear in relegated.
	serieA := makeTable("a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10",
		"a11", "a12", "a13", "a14", "a15", "a16", "a17", "a18", "a19", "manager_team")
	serieB := makeTable("b1", "b2", "b3", "b4")

	res := promotion.Apply(serieA, serieB)

	found := false
	for _, id := range res.Relegated {
		if id == "manager_team" {
			found = true
			break
		}
	}
	if !found {
		t.Error("manager_team should be in relegated list but was not")
	}
}

func TestApply_ManagerTeamPromoted(t *testing.T) {
	// Manager's team wins Série B → should appear in promoted.
	serieA := makeTable("a1", "a2", "a3", "a4")
	serieB := makeTable("manager_team", "b2", "b3", "b4", "b5")

	res := promotion.Apply(serieA, serieB)

	found := false
	for _, id := range res.Promoted {
		if id == "manager_team" {
			found = true
			break
		}
	}
	if !found {
		t.Error("manager_team should be in promoted list but was not")
	}
}

func TestOtherDivision(t *testing.T) {
	if promotion.OtherDivision("serie_a") != "serie_b" {
		t.Error("OtherDivision(serie_a) should return serie_b")
	}
	if promotion.OtherDivision("serie_b") != "serie_a" {
		t.Error("OtherDivision(serie_b) should return serie_a")
	}
}
