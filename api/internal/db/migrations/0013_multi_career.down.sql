ALTER TABLE careers DROP COLUMN IF EXISTS nickname;
ALTER TABLE careers ADD CONSTRAINT careers_manager_id_key UNIQUE (manager_id);
