// Package promotion implements promotion and relegation logic between
// two Brazilian football divisions (Série A / Série B).
//
// Design:
//   - N = 4 relegated from Série A (positions 17–20) and 4 promoted from
//     Série B (positions 1–4). This mirrors the real Brazilian format.
//   - Ties within the zone are resolved by the table sort that already ran
//     (points → goal diff → goals for → team ID). The result is always
//     deterministic — no tie-breaking playoff is needed at this level.
//   - The package is pure (no I/O, no DB). The caller applies the result.
package promotion

import "github.com/brassfoot/api/internal/league"

// ZoneSize is the number of teams that move between divisions each season.
const ZoneSize = 4

// Result describes which teams change division.
type Result struct {
	// Relegated are the bottom ZoneSize teams from the top division.
	Relegated []string
	// Promoted are the top ZoneSize teams from the lower division.
	Promoted []string
}

// Apply computes the promotion/relegation outcome from two final tables.
//
// topTable is the sorted standings of the higher division (Série A), with
// position 0 = champion. bottomTable is the standings of the lower division
// (Série B), with position 0 = champion. Both tables are assumed to be
// already sorted (as returned by Season.Table / BuildTable).
//
// Edge cases:
//   - If a table has fewer teams than ZoneSize, all teams in that range are
//     affected (no panic, no silent skip).
//   - Empty tables produce an empty Result with no changes.
func Apply(topTable, bottomTable []league.TableRow) Result {
	var res Result

	// Bottom ZoneSize of the top division → relegated.
	start := len(topTable) - ZoneSize
	if start < 0 {
		start = 0
	}
	for _, row := range topTable[start:] {
		res.Relegated = append(res.Relegated, row.TeamID)
	}

	// Top ZoneSize of the bottom division → promoted.
	end := ZoneSize
	if end > len(bottomTable) {
		end = len(bottomTable)
	}
	for _, row := range bottomTable[:end] {
		res.Promoted = append(res.Promoted, row.TeamID)
	}

	return res
}

// OtherDivision returns the complementary division name.
func OtherDivision(div string) string {
	if div == "serie_a" {
		return "serie_b"
	}
	return "serie_a"
}
