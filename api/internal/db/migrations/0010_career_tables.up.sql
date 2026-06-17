-- Multi-season support: division column on teams, career progression, season history.
--
-- Design decisions:
--   - division = 'serie_a' | 'serie_b' stored directly on teams (global state,
--     consistent with the single-manager design of the whole game).
--   - careers tracks one manager's season progression (season number, current
--     division, link to the active league).
--   - season_records stores the permanent history of each concluded season per
--     manager: champion, manager's final position, relegated/promoted team IDs.
--   - relegated_ids and promoted_ids are JSONB arrays (TEXT) matching the
--     project's existing JSONB-for-structured-data pattern.

ALTER TABLE teams ADD COLUMN division TEXT NOT NULL DEFAULT 'serie_a';

CREATE TABLE careers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id       UUID NOT NULL UNIQUE REFERENCES managers(id) ON DELETE CASCADE,
    season_number    INT NOT NULL DEFAULT 1,
    active_league_id TEXT,
    division         TEXT NOT NULL DEFAULT 'serie_a',
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE season_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id       UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    season_number    INT NOT NULL,
    division         TEXT NOT NULL,
    champion_id      TEXT,
    manager_position INT NOT NULL DEFAULT 0,
    relegated_ids    JSONB NOT NULL DEFAULT '[]',
    promoted_ids     JSONB NOT NULL DEFAULT '[]',
    recorded_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON season_records (manager_id, season_number);
