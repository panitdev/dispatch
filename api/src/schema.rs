// @generated — keep in sync with migrations

diesel::table! {
    dispatch_api_keys (id) {
        id           -> Int8,
        user_id      -> Int8,
        key_hash     -> Binary,
        name         -> Text,
        scopes       -> Array<Text>,
        agent_id     -> Nullable<Text>,
        last_used_at -> Nullable<Timestamptz>,
        created_at   -> Timestamptz,
        revoked_at   -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    users (id) {
        id         -> Int8,
        kratos_id  -> Uuid,
        username   -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        email      -> Nullable<Varchar>,
    }
}

diesel::table! {
    teams (id) {
        id         -> Int8,
        name       -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    states (id) {
        id         -> Int8,
        team_id    -> Int8,
        name       -> Varchar,
        group_name -> Varchar,
        color      -> Varchar,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    labels (id) {
        id         -> Int8,
        team_id    -> Int8,
        project_id -> Int8,
        name       -> Varchar,
        color      -> Varchar,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    projects (id) {
        id             -> Int8,
        key            -> Varchar,
        name           -> Varchar,
        color          -> Varchar,
        parent_id      -> Nullable<Int8>,
        issue_sequence -> Int4,
        created_at     -> Timestamptz,
        updated_at     -> Timestamptz,
        team_id        -> Nullable<Int8>,
    }
}

diesel::table! {
    issues (id) {
        id          -> Int8,
        key         -> Varchar,
        project_id  -> Int8,
        parent_id   -> Nullable<Int8>,
        title       -> Text,
        status      -> Varchar,
        priority    -> Int4,
        author_id   -> Int8,
        assignee_id -> Nullable<Int8>,
        blocks      -> Jsonb,
        created_at  -> Timestamptz,
        updated_at  -> Timestamptz,
        state_id    -> Nullable<Int8>,
    }
}

diesel::table! {
    issue_labels (issue_id, label) {
        issue_id -> Int8,
        label    -> Varchar,
    }
}

diesel::table! {
    issue_label_refs (issue_id, label_id) {
        issue_id -> Int8,
        label_id -> Int8,
    }
}

diesel::table! {
    issue_relations (issue_id, related_issue_id, relation_type) {
        issue_id         -> Int8,
        related_issue_id -> Int8,
        relation_type    -> Varchar,
    }
}

diesel::table! {
    issue_comments (id) {
        id         -> Int8,
        issue_id   -> Int8,
        author_id  -> Int8,
        body       -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    issue_history (id) {
        id          -> Int8,
        issue_id    -> Int8,
        actor_id    -> Int8,
        field       -> Varchar,
        from_value  -> Nullable<Text>,
        to_value    -> Nullable<Text>,
        created_at  -> Timestamptz,
    }
}

diesel::table! {
    issue_idempotency_keys (key) {
        key          -> Text,
        issue_id     -> Int8,
        payload_hash -> Binary,
        created_at   -> Timestamptz,
    }
}

diesel::joinable!(issues -> projects (project_id));
diesel::joinable!(issues -> states (state_id));
diesel::joinable!(issue_labels -> issues (issue_id));
diesel::joinable!(issue_label_refs -> issues (issue_id));
diesel::joinable!(issue_label_refs -> labels (label_id));
diesel::joinable!(issue_comments -> issues (issue_id));
diesel::joinable!(issue_comments -> users (author_id));
diesel::joinable!(issue_history -> issues (issue_id));
diesel::joinable!(dispatch_api_keys -> users (user_id));
diesel::joinable!(states -> teams (team_id));
diesel::joinable!(labels -> teams (team_id));
diesel::joinable!(labels -> projects (project_id));
diesel::joinable!(projects -> teams (team_id));

diesel::allow_tables_to_appear_in_same_query!(
    dispatch_api_keys,
    users,
    teams,
    states,
    labels,
    projects,
    issues,
    issue_labels,
    issue_label_refs,
    issue_relations,
    issue_comments,
    issue_history,
    issue_idempotency_keys,
);
