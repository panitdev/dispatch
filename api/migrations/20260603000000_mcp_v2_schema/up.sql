-- MCP v2 schema additions
-- Adds teams, states, labels, comments, history, idempotency, and issue_label_refs

CREATE TABLE teams (
    id         BIGINT      PRIMARY KEY,
    name       VARCHAR     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE states (
    id         BIGINT      PRIMARY KEY,
    team_id    BIGINT      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       VARCHAR     NOT NULL,
    group_name VARCHAR     NOT NULL CHECK (group_name IN ('backlog','unstarted','started','completed','cancelled')),
    color      VARCHAR     NOT NULL DEFAULT '#888888',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE labels (
    id         BIGINT      PRIMARY KEY,
    team_id    BIGINT      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       VARCHAR     NOT NULL,
    color      VARCHAR     NOT NULL DEFAULT '#888888',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, name)
);

-- MCP-layer issue-to-label associations (using normalized label IDs)
CREATE TABLE issue_label_refs (
    issue_id  BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label_id  BIGINT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE issue_comments (
    id         BIGINT      PRIMARY KEY,
    issue_id   BIGINT      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE issue_history (
    id          BIGINT      PRIMARY KEY,
    issue_id    BIGINT      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    actor_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    field       VARCHAR     NOT NULL,
    from_value  TEXT,
    to_value    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys for create_issue
CREATE TABLE issue_idempotency_keys (
    key          TEXT   PRIMARY KEY,
    issue_id     BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    payload_hash BYTEA  NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add state_id FK to issues (nullable for safe backfill)
ALTER TABLE issues ADD COLUMN state_id BIGINT REFERENCES states(id) ON DELETE SET NULL;

-- Add email to users (nullable; populated at login via Kratos traits when available)
ALTER TABLE users ADD COLUMN email VARCHAR;

-- Add team_id to projects
ALTER TABLE projects ADD COLUMN team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL;

-- Update issue_relations constraint to support canonical blocks and duplicate types
-- (blocked_by is derived on read; not stored)
ALTER TABLE issue_relations DROP CONSTRAINT issue_relations_relation_type_check;

-- Normalise existing blocked_by rows → canonical blocks direction
INSERT INTO issue_relations (issue_id, related_issue_id, relation_type)
SELECT related_issue_id, issue_id, 'blocks'
FROM issue_relations
WHERE relation_type = 'blocked_by'
ON CONFLICT DO NOTHING;

DELETE FROM issue_relations WHERE relation_type = 'blocked_by';

ALTER TABLE issue_relations ADD CONSTRAINT issue_relations_relation_type_check
    CHECK (relation_type IN ('blocks', 'related', 'duplicate'));

-- ---- Seed data ----

INSERT INTO teams (id, name) VALUES (1, 'Default');

INSERT INTO states (id, team_id, name, group_name, color) VALUES
    (1, 1, 'Backlog',      'backlog',    '#888888'),
    (2, 1, 'Todo',         'unstarted',  '#aaaaaa'),
    (3, 1, 'In Progress',  'started',    '#4488ff'),
    (4, 1, 'Done',         'completed',  '#44bb44'),
    (5, 1, 'Cancelled',    'cancelled',  '#cccccc');

INSERT INTO labels (id, team_id, name, color) VALUES
    (10, 1, 'bug',         '#e11d48'),
    (11, 1, 'feature',     '#2563eb'),
    (12, 1, 'improvement', '#7c3aed'),
    (13, 1, 'docs',        '#0891b2');

-- Assign all existing projects to default team
UPDATE projects SET team_id = 1;

-- Backfill state_id from existing status column
UPDATE issues SET state_id = CASE status
    WHEN 'draft'      THEN 1
    WHEN 'next'       THEN 2
    WHEN 'doing'      THEN 3
    WHEN 'done'       THEN 4
    WHEN 'cancelled'  THEN 5
    ELSE 1
END;

-- Backfill issue_label_refs from the string-based issue_labels table
INSERT INTO issue_label_refs (issue_id, label_id)
SELECT il.issue_id, l.id
FROM issue_labels il
JOIN labels l ON l.name = il.label AND l.team_id = 1
ON CONFLICT DO NOTHING;

CREATE INDEX idx_issue_comments_issue_id   ON issue_comments(issue_id);
CREATE INDEX idx_issue_history_issue_id    ON issue_history(issue_id, created_at DESC);
CREATE INDEX idx_issue_label_refs_issue_id ON issue_label_refs(issue_id);
CREATE INDEX idx_issues_state_id           ON issues(state_id);
CREATE INDEX idx_issues_parent_id_non_null ON issues(parent_id) WHERE parent_id IS NOT NULL;
