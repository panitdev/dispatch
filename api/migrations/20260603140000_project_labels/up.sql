ALTER TABLE labels ADD COLUMN project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE labels DROP CONSTRAINT labels_team_id_name_key;

INSERT INTO labels (id, team_id, project_id, name, color)
SELECT 330000000000000000::BIGINT + ROW_NUMBER() OVER (ORDER BY scoped.project_id, scoped.name),
       scoped.team_id,
       scoped.project_id,
       scoped.name,
       scoped.color
FROM (
    SELECT DISTINCT
           i.project_id,
           COALESCE(p.team_id, old_labels.team_id) AS team_id,
           old_labels.name,
           old_labels.color
    FROM issue_label_refs ilr
    JOIN issues i ON i.id = ilr.issue_id
    JOIN projects p ON p.id = i.project_id
    JOIN labels old_labels ON old_labels.id = ilr.label_id
    WHERE old_labels.project_id IS NULL
) AS scoped;

UPDATE issue_label_refs ilr
SET label_id = project_labels.id
FROM issues i, labels old_labels, labels project_labels
WHERE ilr.issue_id = i.id
  AND ilr.label_id = old_labels.id
  AND old_labels.project_id IS NULL
  AND project_labels.project_id = i.project_id
  AND project_labels.name = old_labels.name;

DELETE FROM labels WHERE project_id IS NULL;

ALTER TABLE labels ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE labels ADD CONSTRAINT labels_project_id_name_key UNIQUE (project_id, name);

CREATE INDEX idx_labels_project_id ON labels(project_id);
