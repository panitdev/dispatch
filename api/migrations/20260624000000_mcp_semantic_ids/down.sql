DROP TABLE IF EXISTS label_aliases;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_slug_key;
DROP INDEX IF EXISTS idx_projects_slug;
ALTER TABLE projects DROP COLUMN IF EXISTS slug;
