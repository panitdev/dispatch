-- Add slug to projects for MCP semantic API
ALTER TABLE projects ADD COLUMN slug VARCHAR;
UPDATE projects SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'));
UPDATE projects SET slug = TRIM(BOTH '-' FROM slug);
ALTER TABLE projects ALTER COLUMN slug SET NOT NULL;
ALTER TABLE projects ADD CONSTRAINT projects_slug_key UNIQUE (slug);
CREATE INDEX idx_projects_slug ON projects(slug);

-- Label alias table for rename tracking (MCP agents use names; aliases survive renames)
CREATE TABLE label_aliases (
    project_id   BIGINT  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    old_name     VARCHAR NOT NULL,
    current_name VARCHAR NOT NULL,
    PRIMARY KEY (project_id, old_name)
);
CREATE INDEX idx_label_aliases_project_id ON label_aliases(project_id);
