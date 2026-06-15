package model

type Team struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ShortName string `json:"short_name"`
	Country   string `json:"country"`
	Budget    int64  `json:"budget"`
}
