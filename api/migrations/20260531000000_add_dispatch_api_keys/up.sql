CREATE TABLE dispatch_api_keys (
    id           BIGINT       PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash     BYTEA        NOT NULL UNIQUE,
    name         TEXT         NOT NULL,
    scopes       TEXT[]       NOT NULL DEFAULT '{}',
    agent_id     TEXT,
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX idx_dispatch_api_keys_active_key_hash ON dispatch_api_keys(key_hash) WHERE revoked_at IS NULL;
