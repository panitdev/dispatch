// @generated — keep in sync with migrations/00000000000000_initial/up.sql

diesel::table! {
    users (id) {
        id         -> Int8,
        kratos_id  -> Uuid,
        name       -> Varchar,
        email      -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
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
    }
}

diesel::table! {
    issue_labels (issue_id, label) {
        issue_id -> Int8,
        label    -> Varchar,
    }
}

diesel::table! {
    issue_relations (issue_id, related_issue_id, relation_type) {
        issue_id         -> Int8,
        related_issue_id -> Int8,
        relation_type    -> Varchar,
    }
}

diesel::joinable!(issues -> projects (project_id));
diesel::joinable!(issue_labels -> issues (issue_id));

diesel::allow_tables_to_appear_in_same_query!(
    users,
    projects,
    issues,
    issue_labels,
    issue_relations,
);
