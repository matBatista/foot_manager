CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    short_name  TEXT NOT NULL,
    country     TEXT NOT NULL,
    budget      BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    position    TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
    nationality TEXT NOT NULL,
    age         INT NOT NULL CHECK (age BETWEEN 15 AND 50),
    pace        INT NOT NULL CHECK (pace BETWEEN 0 AND 100),
    shooting    INT NOT NULL CHECK (shooting BETWEEN 0 AND 100),
    passing     INT NOT NULL CHECK (passing BETWEEN 0 AND 100),
    dribbling   INT NOT NULL CHECK (dribbling BETWEEN 0 AND 100),
    defending   INT NOT NULL CHECK (defending BETWEEN 0 AND 100),
    physical    INT NOT NULL CHECK (physical BETWEEN 0 AND 100),
    overall     INT NOT NULL CHECK (overall BETWEEN 0 AND 100),
    value       BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_team_id ON players(team_id);
