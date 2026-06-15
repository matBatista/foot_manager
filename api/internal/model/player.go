package model

type Player struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Position   string `json:"position"` // GK, DEF, MID, FWD
	Nationality string `json:"nationality"`
	Age        int    `json:"age"`
	TeamID     string `json:"team_id"`

	// Attributes (0–100)
	Pace       int `json:"pace"`
	Shooting   int `json:"shooting"`
	Passing    int `json:"passing"`
	Dribbling  int `json:"dribbling"`
	Defending  int `json:"defending"`
	Physical   int `json:"physical"`

	// Derived
	Overall    int `json:"overall"`
	Value      int64 `json:"value"` // in credits
}
