CREATE TABLE users (
    id          BIGINT          PRIMARY KEY,
    kratos_id   UUID            NOT NULL UNIQUE,
    name        VARCHAR         NOT NULL,
    email       VARCHAR         NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
    id              BIGINT          PRIMARY KEY,
    key             VARCHAR         NOT NULL UNIQUE,
    name            VARCHAR         NOT NULL,
    color           VARCHAR         NOT NULL DEFAULT '#5b5bd6',
    parent_id       BIGINT          REFERENCES projects(id) ON DELETE SET NULL,
    issue_sequence  INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE issues (
    id          BIGINT          PRIMARY KEY,
    key         VARCHAR         NOT NULL UNIQUE,
    project_id  BIGINT          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id   BIGINT          REFERENCES issues(id) ON DELETE SET NULL,
    title       TEXT            NOT NULL,
    status      VARCHAR         NOT NULL DEFAULT 'backlog'
                    CHECK (status IN ('backlog', 'todo', 'in-progress', 'done', 'cancelled')),
    priority    VARCHAR         NOT NULL DEFAULT 'none'
                    CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
    assignee_id BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    blocks      JSONB           NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(blocks) = 'array'),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE issue_labels (
    issue_id    BIGINT          NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label       VARCHAR         NOT NULL
                    CHECK (label IN ('bug', 'feature', 'improvement', 'docs')),
    PRIMARY KEY (issue_id, label)
);

CREATE TABLE issue_relations (
    issue_id            BIGINT  NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    related_issue_id    BIGINT  NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    relation_type       VARCHAR NOT NULL
                            CHECK (relation_type IN ('blocked_by', 'related')),
    PRIMARY KEY (issue_id, related_issue_id, relation_type),
    CONSTRAINT no_self_relation CHECK (issue_id <> related_issue_id)
);

CREATE INDEX idx_issues_project_id  ON issues(project_id);
CREATE INDEX idx_issues_assignee_id ON issues(assignee_id);
CREATE INDEX idx_issues_status      ON issues(project_id, status);
CREATE INDEX idx_projects_parent_id ON projects(parent_id);
CREATE INDEX idx_users_kratos_id    ON users(kratos_id);
