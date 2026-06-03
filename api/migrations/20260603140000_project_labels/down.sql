DROP INDEX IF EXISTS idx_labels_project_id;

ALTER TABLE labels ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE labels DROP CONSTRAINT labels_project_id_name_key;

INSERT INTO labels (id, team_id, project_id, name, color) VALUES
    (10, 1, NULL, 'bug',         '#e11d48'),
    (11, 1, NULL, 'feature',     '#2563eb'),
    (12, 1, NULL, 'improvement', '#7c3aed'),
    (13, 1, NULL, 'docs',        '#0891b2')
ON CONFLICT (id) DO NOTHING;

UPDATE issue_label_refs ilr
SET label_id = team_labels.id
FROM labels project_labels, labels team_labels
WHERE ilr.label_id = project_labels.id
  AND project_labels.project_id IS NOT NULL
  AND team_labels.project_id IS NULL
  AND team_labels.name = project_labels.name
  AND team_labels.team_id = project_labels.team_id;

DELETE FROM labels WHERE project_id IS NOT NULL;

ALTER TABLE labels DROP COLUMN project_id;
ALTER TABLE labels ADD CONSTRAINT labels_team_id_name_key UNIQUE (team_id, name);
