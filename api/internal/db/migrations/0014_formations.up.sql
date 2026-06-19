-- Add preferred formation to managers (default 4-4-2)
ALTER TABLE managers ADD COLUMN IF NOT EXISTS formation TEXT NOT NULL DEFAULT '4-4-2';
-- Add shirt number to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS shirt_number INT NOT NULL DEFAULT 0;
-- Assign shirt numbers by position within each team
-- GK=1, DEF=2-5, MID=6-8,9,10, FWD=9,10,11 (rough)
UPDATE players p
SET shirt_number = sub.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY team_id
      ORDER BY
        CASE position
          WHEN 'GK'  THEN 1
          WHEN 'DEF' THEN 2
          WHEN 'MID' THEN 3
          WHEN 'FWD' THEN 4
        END,
        overall DESC
    ) AS rn
  FROM players
  WHERE team_id IS NOT NULL
) sub
WHERE p.id = sub.id;
-- Clamp to 1-99
UPDATE players SET shirt_number = shirt_number % 99 WHERE shirt_number > 99;
UPDATE players SET shirt_number = 1 WHERE shirt_number = 0;
-- Free agents: use 0 to indicate no team shirt
UPDATE players SET shirt_number = 0 WHERE team_id IS NULL;
