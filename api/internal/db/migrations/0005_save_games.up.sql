CREATE TABLE save_games (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id  UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    season_json JSONB NOT NULL,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_save_games_manager_id ON save_games(manager_id);
