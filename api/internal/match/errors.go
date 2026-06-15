package match

import "fmt"

// ErrEmptySquad is returned by Simulate when one side has no players.
type ErrEmptySquad struct {
	Side   string // "home" or "away"
	TeamID string
}

func (e ErrEmptySquad) Error() string {
	return fmt.Sprintf("%s team %s has no players to field", e.Side, e.TeamID)
}
