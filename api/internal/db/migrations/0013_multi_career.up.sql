-- Allow multiple careers per manager (remove unique constraint)
ALTER TABLE careers DROP CONSTRAINT IF EXISTS careers_manager_id_key;
-- Add nickname so user can label careers
ALTER TABLE careers ADD COLUMN IF NOT EXISTS nickname TEXT NOT NULL DEFAULT '';
