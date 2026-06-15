package model

import "time"

type Manager struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	TeamID       string    `json:"team_id"`
	Reputation   int       `json:"reputation"`
	CreatedAt    time.Time `json:"created_at"`
}
