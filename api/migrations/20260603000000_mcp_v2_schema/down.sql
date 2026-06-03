DROP INDEX IF EXISTS idx_issues_parent_id_non_null;
DROP INDEX IF EXISTS idx_issues_state_id;
DROP INDEX IF EXISTS idx_issue_label_refs_issue_id;
DROP INDEX IF EXISTS idx_issue_history_issue_id;
DROP INDEX IF EXISTS idx_issue_comments_issue_id;

ALTER TABLE issue_relations DROP CONSTRAINT IF EXISTS issue_relations_relation_type_check;
ALTER TABLE issue_relations ADD CONSTRAINT issue_relations_relation_type_check
    CHECK (relation_type IN ('blocked_by', 'related'));

ALTER TABLE projects DROP COLUMN IF EXISTS team_id;
ALTER TABLE users    DROP COLUMN IF EXISTS email;
ALTER TABLE issues   DROP COLUMN IF EXISTS state_id;

DROP TABLE IF EXISTS issue_idempotency_keys;
DROP TABLE IF EXISTS issue_history;
DROP TABLE IF EXISTS issue_comments;
DROP TABLE IF EXISTS issue_label_refs;
DROP TABLE IF EXISTS labels;
DROP TABLE IF EXISTS states;
DROP TABLE IF EXISTS teams;
