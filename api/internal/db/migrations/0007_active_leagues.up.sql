CREATE TABLE active_leagues (
    id          TEXT PRIMARY KEY,
    season_json JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
