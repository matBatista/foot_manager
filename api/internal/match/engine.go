// Package match contains Brassfoot's match simulation engine.
//
// The engine simulates a single 90-minute football match minute by minute.
// Each team's strength is derived from its players' attributes, split into
// attack / midfield / defence / goalkeeping "lines". Every simulated minute,
// one team wins possession (weighted by midfield strength) and may create a
// chance; chances become shots, shots may be on target, and on-target shots
// may become goals. The result includes a full event timeline plus per-team
// stats (goals, shots, possession, cards).
//
// Realism layers on top of the base flow:
//   - Fatigue: each line's effective rating decays over the 90 minutes. Decay
//     is slower for lines with high average Physical (stamina).
//   - Red cards: a second yellow, or a straight red, sends a player off. The
//     team then plays a man down, applying a penalty to its effective ratings.
//
// Injuries/substitutions are deliberately NOT modelled here — they require a
// bench/subs model that belongs with the lineup-selection (career) layer.
package match

import (
	"math/rand"
	"sort"

	"github.com/brassfoot/api/internal/model"
)

// matchMinutes is the length of a simulated match.
const matchMinutes = 90

// Tunable constants. These were picked to produce realistic-looking matches
// (roughly 1–3 goals and 8–14 shots per team). Adjust here to rebalance the
// game without touching the simulation logic.
const (
	baseChancePerMinute = 0.34  // P(possessing team creates a chance) this minute
	shotOnTargetBase    = 0.40  // baseline P(shot is on target)
	goalConversionBase  = 0.34  // baseline P(on-target shot is a goal)
	yellowCardPerMinute = 0.012 // P(a foul earns a yellow) per minute
	straightRedPerMinute = 0.0009 // P(a straight red) per minute, per team

	// Fatigue: at full time a line with average Physical loses up to
	// maxFatigue of its rating. Higher Physical (stamina) softens this via
	// fatigueResistance (0..1), where 1.0 = halves the loss.
	maxFatigue = 0.14

	// Man-down: each player sent off costs the team this fraction of its
	// outfield ratings, floored so a team is never reduced below minViability.
	manDownPenalty = 0.07
	minViability   = 0.40
)

// EventType enumerates the kinds of events the timeline can contain.
type EventType string

const (
	EventGoal       EventType = "goal"
	EventShot       EventType = "shot" // off target or saved
	EventYellowCard EventType = "yellow_card"
	EventRedCard    EventType = "red_card"
)

// Event is a single moment in the match timeline.
type Event struct {
	Minute int       `json:"minute"`
	Type   EventType `json:"type"`
	TeamID string    `json:"team_id"`
	Player string    `json:"player"`
	Detail string    `json:"detail,omitempty"`
}

// TeamInput is one side of the fixture passed into the engine.
type TeamInput struct {
	TeamID  string
	Name    string
	Players []model.Player
}

// TeamStats summarises a team's performance after the match.
type TeamStats struct {
	TeamID        string `json:"team_id"`
	Name          string `json:"name"`
	Goals         int    `json:"goals"`
	Shots         int    `json:"shots"`
	ShotsOnTarget int    `json:"shots_on_target"`
	Possession    int    `json:"possession"` // percentage, home + away = 100
	YellowCards   int    `json:"yellow_cards"`
	RedCards      int    `json:"red_cards"`
}

// Result is the full outcome of a simulated match.
type Result struct {
	Home   TeamStats `json:"home"`
	Away   TeamStats `json:"away"`
	Events []Event   `json:"events"`
	Seed   int64     `json:"seed"`
}

// lineup holds a team's selected XI and its derived line ratings (0–100).
type lineup struct {
	teamID      string
	name        string
	players     []model.Player // players currently on the pitch (XI minus sent-off)
	attack      float64
	midfield    float64
	defence     float64
	goalkeeping float64
	// scorers is the set of players who can plausibly score, with shooting
	// weights pre-computed for picking a scorer.
	scorers []model.Player
	// fatigueResistance (0..1) is derived from the XI's average Physical; it
	// softens how fast the team tires over 90 minutes.
	fatigueResistance float64
	// bookings tracks yellow cards per player ID so a second yellow → red.
	bookings map[string]int
	// sentOff counts players dismissed; it drives the man-down penalty.
	sentOff int
}

// Simulate runs a full match between home and away. If seed is 0 a random
// seed is generated so results vary; pass a fixed seed for reproducibility
// (used by tests). Returns the result, or an error if a side has no players.
func Simulate(home, away TeamInput, seed int64) (Result, error) {
	if len(home.Players) == 0 {
		return Result{}, ErrEmptySquad{Side: "home", TeamID: home.TeamID}
	}
	if len(away.Players) == 0 {
		return Result{}, ErrEmptySquad{Side: "away", TeamID: away.TeamID}
	}

	if seed == 0 {
		seed = rand.Int63()
	}
	rng := rand.New(rand.NewSource(seed))

	h := buildLineup(home)
	a := buildLineup(away)

	result := Result{
		Home:   TeamStats{TeamID: h.teamID, Name: h.name},
		Away:   TeamStats{TeamID: a.teamID, Name: a.name},
		Events: []Event{},
		Seed:   seed,
	}

	homeMinutes := 0
	for minute := 1; minute <= matchMinutes; minute++ {
		// Possession is recomputed each minute from effective midfield, so a
		// red card or fatigue shifts the balance of play as the game wears on.
		hMid := h.effMidfield(minute) * 1.08 // small home advantage
		aMid := a.effMidfield(minute)
		homePossWeight := hMid / (hMid + aMid)

		if rng.Float64() < homePossWeight {
			homeMinutes++
			simulateMinute(rng, minute, &h, &a, &result.Home, &result.Away, &result.Events)
		} else {
			simulateMinute(rng, minute, &a, &h, &result.Away, &result.Home, &result.Events)
		}
	}

	// Convert possession-minutes into a clean percentage.
	result.Home.Possession = int(float64(homeMinutes)/matchMinutes*100 + 0.5)
	result.Away.Possession = 100 - result.Home.Possession

	// Timeline is built in minute order already, but sort defensively in case
	// two events share a minute.
	sort.SliceStable(result.Events, func(i, j int) bool {
		return result.Events[i].Minute < result.Events[j].Minute
	})

	return result, nil
}

// simulateMinute resolves one minute for the team in possession (att) against
// the defending team (def), appending any events produced.
func simulateMinute(rng *rand.Rand, minute int, att, def *lineup, attStats, defStats *TeamStats, events *[]Event) {
	// Chance creation scales with effective attack vs the opponent's defence.
	atk := att.effAttack(minute)
	dfc := def.effDefence(minute)
	chanceProb := baseChancePerMinute * atk / (atk + dfc)
	if rng.Float64() >= chanceProb {
		// No chance — but discipline events can still happen.
		applyDiscipline(rng, minute, def, defStats, events)
		return
	}

	// A chance was created → it becomes a shot.
	attStats.Shots++
	shooter := att.pickScorer(rng)

	// On target?
	onTargetProb := shotOnTargetBase * float64(shooter.Shooting) / 75.0
	if onTargetProb > 0.9 {
		onTargetProb = 0.9
	}
	if rng.Float64() >= onTargetProb {
		// Off target.
		*events = append(*events, Event{
			Minute: minute, Type: EventShot, TeamID: att.teamID,
			Player: shooter.Name, Detail: "off target",
		})
		return
	}
	attStats.ShotsOnTarget++

	// On target → goal or save. Striker's shooting vs keeper's defence + line.
	goalProb := goalConversionBase * float64(shooter.Shooting) / (float64(shooter.Shooting) + def.goalkeeping)
	if rng.Float64() < goalProb {
		attStats.Goals++
		*events = append(*events, Event{
			Minute: minute, Type: EventGoal, TeamID: att.teamID,
			Player: shooter.Name, Detail: "goal",
		})
	} else {
		*events = append(*events, Event{
			Minute: minute, Type: EventShot, TeamID: att.teamID,
			Player: shooter.Name, Detail: "saved",
		})
	}
}

// applyDiscipline resolves fouls by the defending team: a foul may earn a
// yellow (a second yellow becomes a red), and independently a reckless
// challenge may be a straight red.
func applyDiscipline(rng *rand.Rand, minute int, def *lineup, defStats *TeamStats, events *[]Event) {
	// Straight red (rare).
	if rng.Float64() < straightRedPerMinute {
		if p, ok := def.pickOnField(rng); ok {
			sendOff(minute, def, defStats, p, "straight red", events)
			return
		}
	}

	// Ordinary foul → maybe a yellow.
	if rng.Float64() >= yellowCardPerMinute {
		return
	}
	p, ok := def.pickOnField(rng)
	if !ok {
		return
	}
	def.bookings[p.ID]++
	defStats.YellowCards++
	*events = append(*events, Event{
		Minute: minute, Type: EventYellowCard, TeamID: def.teamID,
		Player: p.Name, Detail: "foul",
	})
	if def.bookings[p.ID] >= 2 {
		sendOff(minute, def, defStats, p, "second yellow", events)
	}
}

// sendOff dismisses a player: records the red card, removes them from the
// pitch (and the scorer pool), and increments the man-down counter.
func sendOff(minute int, l *lineup, stats *TeamStats, p model.Player, detail string, events *[]Event) {
	stats.RedCards++
	l.sentOff++
	l.players = removePlayer(l.players, p.ID)
	l.scorers = removePlayer(l.scorers, p.ID)
	if len(l.scorers) == 0 {
		l.scorers = l.players // never leave the scorer pool empty
	}
	*events = append(*events, Event{
		Minute: minute, Type: EventRedCard, TeamID: l.teamID,
		Player: p.Name, Detail: detail,
	})
}

// condition is the multiplier applied to outfield ratings at a given minute,
// combining fatigue (rises over time, eased by stamina) and the man-down
// penalty for any sent-off players.
func (l *lineup) condition(minute int) float64 {
	progress := float64(minute) / matchMinutes
	fatigue := maxFatigue * progress * (1 - 0.5*l.fatigueResistance)
	manDown := 1 - manDownPenalty*float64(l.sentOff)
	if manDown < minViability {
		manDown = minViability
	}
	return (1 - fatigue) * manDown
}

func (l *lineup) effAttack(minute int) float64   { return l.attack * l.condition(minute) }
func (l *lineup) effMidfield(minute int) float64 { return l.midfield * l.condition(minute) }
func (l *lineup) effDefence(minute int) float64  { return l.defence * l.condition(minute) }

// buildLineup selects a starting XI and computes its line ratings.
func buildLineup(in TeamInput) lineup {
	xi := selectStartingXI(in.Players)

	l := lineup{teamID: in.TeamID, name: in.Name, players: xi, bookings: map[string]int{}}

	var atkSum, atkN float64
	var midSum, midN float64
	var defSum, defN float64
	var gkSum, gkN float64
	var physSum float64

	for _, p := range xi {
		physSum += float64(p.Physical)
		switch p.Position {
		case "FWD":
			atkSum += float64(p.Shooting)*0.5 + float64(p.Dribbling)*0.3 + float64(p.Pace)*0.2
			atkN++
			l.scorers = append(l.scorers, p)
		case "MID":
			// Midfielders contribute to both attack and the midfield battle.
			atkSum += (float64(p.Shooting)*0.4 + float64(p.Passing)*0.4 + float64(p.Dribbling)*0.2) * 0.6
			atkN += 0.6
			midSum += float64(p.Passing)*0.5 + float64(p.Dribbling)*0.25 + float64(p.Physical)*0.25
			midN++
			l.scorers = append(l.scorers, p)
		case "DEF":
			defSum += float64(p.Defending)*0.6 + float64(p.Physical)*0.4
			defN++
			midSum += float64(p.Passing) * 0.4 // defenders help build-up
			midN += 0.4
		case "GK":
			gkSum += float64(p.Defending)*0.7 + float64(p.Physical)*0.3
			gkN++
		}
	}

	l.attack = safeAvg(atkSum, atkN, 45)
	l.midfield = safeAvg(midSum, midN, 45)
	l.defence = safeAvg(defSum, defN, 45)
	l.goalkeeping = safeAvg(gkSum, gkN, 45)

	// Average Physical (0–100) → fatigue resistance (0–1).
	if len(xi) > 0 {
		l.fatigueResistance = (physSum / float64(len(xi))) / 100.0
	}

	// A team with no recognised forwards can still shoot through anyone.
	if len(l.scorers) == 0 {
		l.scorers = xi
	}
	return l
}

// selectStartingXI picks a 4-3-3-ish best XI: the strongest GK, 4 DEF, 3 MID,
// 3 FWD by overall. Falls back gracefully when a squad lacks players in a
// position by filling remaining slots with the best available.
func selectStartingXI(players []model.Player) []model.Player {
	byPos := map[string][]model.Player{}
	for _, p := range players {
		byPos[p.Position] = append(byPos[p.Position], p)
	}
	for pos := range byPos {
		sortByOverallDesc(byPos[pos])
	}

	quota := []struct {
		pos string
		n   int
	}{{"GK", 1}, {"DEF", 4}, {"MID", 3}, {"FWD", 3}}

	var xi []model.Player
	used := map[string]bool{}
	for _, q := range quota {
		for i := 0; i < q.n && i < len(byPos[q.pos]); i++ {
			xi = append(xi, byPos[q.pos][i])
			used[byPos[q.pos][i].ID] = true
		}
	}

	// Fill any shortfall (squad < 11 in some positions) with the best leftover
	// players regardless of position.
	if len(xi) < 11 {
		leftovers := make([]model.Player, 0)
		for _, p := range players {
			if !used[p.ID] {
				leftovers = append(leftovers, p)
			}
		}
		sortByOverallDesc(leftovers)
		for _, p := range leftovers {
			if len(xi) >= 11 {
				break
			}
			xi = append(xi, p)
		}
	}
	return xi
}

// pickScorer chooses which attacking player takes the chance, weighted by
// shooting so strikers score more often than they otherwise would.
func (l *lineup) pickScorer(rng *rand.Rand) model.Player {
	total := 0
	for _, p := range l.scorers {
		w := p.Shooting
		if p.Position == "FWD" {
			w = int(float64(w) * 1.5) // forwards get the bulk of the chances
		}
		total += w
	}
	if total <= 0 {
		return l.scorers[rng.Intn(len(l.scorers))]
	}
	r := rng.Intn(total)
	for _, p := range l.scorers {
		w := p.Shooting
		if p.Position == "FWD" {
			w = int(float64(w) * 1.5)
		}
		r -= w
		if r < 0 {
			return p
		}
	}
	return l.scorers[len(l.scorers)-1]
}

// pickOnField returns a random player currently on the pitch (preferring
// outfield players over the keeper for fouls). ok is false if nobody is left.
func (l *lineup) pickOnField(rng *rand.Rand) (model.Player, bool) {
	if len(l.players) == 0 {
		return model.Player{}, false
	}
	outfield := make([]model.Player, 0, len(l.players))
	for _, p := range l.players {
		if p.Position != "GK" {
			outfield = append(outfield, p)
		}
	}
	pool := outfield
	if len(pool) == 0 {
		pool = l.players
	}
	return pool[rng.Intn(len(pool))], true
}

// removePlayer returns ps without the player whose ID matches.
func removePlayer(ps []model.Player, id string) []model.Player {
	out := ps[:0:0]
	for _, p := range ps {
		if p.ID != id {
			out = append(out, p)
		}
	}
	return out
}

func sortByOverallDesc(ps []model.Player) {
	sort.SliceStable(ps, func(i, j int) bool { return ps[i].Overall > ps[j].Overall })
}

func safeAvg(sum, n, fallback float64) float64 {
	if n <= 0 {
		return fallback
	}
	return sum / n
}
