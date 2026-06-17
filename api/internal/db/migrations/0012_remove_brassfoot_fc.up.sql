-- Remove the fictional Brassfoot FC club (00000000-0000-0000-0000-000000000001)
-- and its 12 original fictional players (IDs ...000101 to ...000112).
--
-- FK behavior when the team row is deleted:
--   players.team_id  → ON DELETE SET NULL  (players become free agents)
--   managers.team_id → ON DELETE SET NULL  (manager gets team_id = NULL)
--
-- We delete the 12 fictional players explicitly so they don't become free agents.
-- Any manager whose team_id pointed to Brassfoot FC will have team_id set to NULL
-- by the FK and will be prompted to select a real team on next login.
--
-- active_leagues and save_games store team UUIDs as JSONB strings; existing
-- references to 00000000-0000-0000-0000-000000000001 in saved game states will
-- simply not resolve to an active team — existing saves become stale but cause
-- no FK violations.
--
-- season_records stores champion_id / relegated_ids / promoted_ids as TEXT/JSONB
-- strings with no formal FK — no action needed.

DELETE FROM players
WHERE id IN (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000106',
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000108',
    '00000000-0000-0000-0000-000000000109',
    '00000000-0000-0000-0000-000000000110',
    '00000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-000000000112'
);

-- Deleting the team triggers ON DELETE SET NULL on managers.team_id
-- for any manager still pointing to this club.
DELETE FROM teams WHERE id = '00000000-0000-0000-0000-000000000001';
