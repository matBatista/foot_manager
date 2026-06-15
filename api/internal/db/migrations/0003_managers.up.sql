CREATE TABLE managers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
    reputation    INT NOT NULL DEFAULT 50 CHECK (reputation BETWEEN 0 AND 100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_managers_team_id ON managers(team_id);
