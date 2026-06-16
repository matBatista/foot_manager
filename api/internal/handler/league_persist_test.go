package handler

import (
	"context"
	"fmt"
	"testing"

	"github.com/brassfoot/api/internal/league"
	"github.com/brassfoot/api/internal/model"
	"github.com/brassfoot/api/internal/repository"
)

// fakeActiveStore is an in-memory activeLeagueStore used in tests.
type fakeActiveStore struct {
	data map[string]league.LeagueSnapshot
}

func newFakeStore() *fakeActiveStore {
	return &fakeActiveStore{data: make(map[string]league.LeagueSnapshot)}
}

func (f *fakeActiveStore) Upsert(_ context.Context, id string, snap league.LeagueSnapshot) error {
	f.data[id] = snap
	return nil
}

func (f *fakeActiveStore) Load(_ context.Context, id string) (league.LeagueSnapshot, error) {
	snap, ok := f.data[id]
	if !ok {
		return league.LeagueSnapshot{}, repository.ErrActiveLeagueNotFound
	}
	return snap, nil
}

// makeTestSquads returns minimal squads without real players, sufficient for
// testing the persistence path (PlayRound is not called in these tests).
func makeTestSquads(n int) []league.Squad {
	squads := make([]league.Squad, n)
	for i := range squads {
		id := fmt.Sprintf("T%02d", i)
		// minimal 11-player roster so the season is valid if PlayRound is called
		players := make([]model.Player, 11)
		for j := range players {
			players[j] = model.Player{
				ID:     fmt.Sprintf("%s-P%d", id, j),
				TeamID: id,
				Name:   fmt.Sprintf("Player %d", j),
			}
		}
		squads[i] = league.Squad{TeamID: id, Name: id, Players: players}
	}
	return squads
}

func TestLeagueHandler_LookupOrLoad_Miss_Then_Hit(t *testing.T) {
	store := newFakeStore()
	h := &LeagueHandler{
		active:  store,
		leagues: make(map[string]*leagueState),
	}

	season := league.NewSeason(makeTestSquads(4), 1)
	names := map[string]string{"T00": "A", "T01": "B", "T02": "C", "T03": "D"}
	const id = "league-abc"

	// Persist directly to the store (simulating a previous server instance)
	snap := league.LeagueSnapshot{Country: "BR", Names: names, Season: season}
	if err := store.Upsert(context.Background(), id, snap); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	// Memory cache is empty — lookupOrLoad must find it via the store
	st, ok := h.lookupOrLoad(context.Background(), id)
	if !ok {
		t.Fatal("lookupOrLoad: expected to find league via store, got miss")
	}
	if st.country != "BR" {
		t.Errorf("country: got %q, want BR", st.country)
	}
	if st.season.NextRound() != season.NextRound() {
		t.Errorf("next_round: got %d, want %d", st.season.NextRound(), season.NextRound())
	}

	// Second call must be a cache hit (store.data not mutated further)
	delete(store.data, id) // poison the store so only cache can serve
	st2, ok2 := h.lookupOrLoad(context.Background(), id)
	if !ok2 {
		t.Fatal("lookupOrLoad: expected cache hit on second call")
	}
	if st2 != st {
		t.Error("expected the same *leagueState pointer from cache")
	}
}

func TestLeagueHandler_LookupOrLoad_NotFound(t *testing.T) {
	h := &LeagueHandler{
		active:  newFakeStore(),
		leagues: make(map[string]*leagueState),
	}
	_, ok := h.lookupOrLoad(context.Background(), "does-not-exist")
	if ok {
		t.Error("expected miss for unknown id")
	}
}

func TestLeagueHandler_LookupOrLoad_NilActive(t *testing.T) {
	h := &LeagueHandler{
		active:  nil, // no persistence configured
		leagues: make(map[string]*leagueState),
	}
	_, ok := h.lookupOrLoad(context.Background(), "any-id")
	if ok {
		t.Error("expected miss when active store is nil")
	}
}

func TestLeagueHandler_Persist_WritesAndReloads(t *testing.T) {
	store := newFakeStore()
	h := &LeagueHandler{
		active:  store,
		leagues: make(map[string]*leagueState),
	}

	season := league.NewSeason(makeTestSquads(2), 99)
	st := &leagueState{
		season:  season,
		names:   map[string]string{"T00": "Alpha", "T01": "Beta"},
		country: "EN",
	}
	const id = "league-xyz"

	h.persist(context.Background(), id, st)

	// Verify the store received it
	snap, ok := store.data[id]
	if !ok {
		t.Fatal("expected persist to write to store")
	}
	if snap.Country != "EN" {
		t.Errorf("country: got %q, want EN", snap.Country)
	}
	if snap.Names["T00"] != "Alpha" {
		t.Errorf("name T00: got %q, want Alpha", snap.Names["T00"])
	}

	// Simulate restart: clear memory, reload via lookupOrLoad
	h.leagues = make(map[string]*leagueState)
	loaded, found := h.lookupOrLoad(context.Background(), id)
	if !found {
		t.Fatal("expected to reload from store after memory clear")
	}
	if loaded.country != "EN" {
		t.Errorf("reloaded country: got %q, want EN", loaded.country)
	}
	if loaded.season.TotalRounds() != season.TotalRounds() {
		t.Errorf("total_rounds: got %d, want %d", loaded.season.TotalRounds(), season.TotalRounds())
	}
}
