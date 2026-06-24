use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::{
    models::issue::{IssueLabelRef, NewIssue, NewIssueHistoryEntry},
    schema::{
        issue_history, issue_idempotency_keys, issue_label_refs, issues, label_aliases, labels,
        projects, states, users,
    },
    state::AppState,
};

use super::{
    body_markdown, invalid_field_error, invalid_reference_error, iso8601, map_db_error,
    mcp_status_to_state_group, priority_to_str, state_group_to_mcp_status, status_from_state_group,
    str_to_priority,
};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{
        dispatch_error_result, json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS,
    },
};
use crate::models::{label::State, project::Project};

#[derive(Deserialize)]
struct CreateIssueArgs {
    project_slug: String,
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    #[serde(default)]
    labels: Vec<String>,
    assignee: Option<String>,
    idempotency_key: Option<String>,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: CreateIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid create_issue arguments"))?;

    if args.title.trim().is_empty() {
        return invalid_field_error("title", "title must not be empty");
    }

    let priority: i32 = match &args.priority {
        None => 0,
        Some(s) => match str_to_priority(s) {
            Some(p) => p,
            None => {
                return invalid_field_error(
                    "priority",
                    "priority must be one of: no_priority, urgent, high, medium, low",
                )
            }
        },
    };

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    // Resolve project by slug
    let project: Project = match projects::table
        .filter(projects::slug.eq(&args.project_slug))
        .select(Project::as_select())
        .first(&mut conn)
        .await
    {
        Ok(p) => p,
        Err(diesel::result::Error::NotFound) => {
            return invalid_reference_error(
                "project_slug",
                &format!("project not found: {}", args.project_slug),
                None,
            )
        }
        Err(e) => return Err(map_db_error(e, None)),
    };
    let project_id = project.id;
    let team_id = project.team_id.unwrap_or(1);

    // Resolve assignee
    let assignee_id: Option<i64> = match args.assignee.as_deref() {
        None => None,
        Some("me") => Some(identity.user_id()),
        Some(username) => {
            let uid: Option<i64> = users::table
                .filter(users::username.eq(username))
                .select(users::id)
                .first(&mut conn)
                .await
                .optional()
                .map_err(|e| map_db_error(e, None))?;
            match uid {
                Some(id) => Some(id),
                None => {
                    return invalid_reference_error(
                        "assignee",
                        &format!("user not found: {username}"),
                        None,
                    )
                }
            }
        }
    };

    // Resolve status to state
    let state_group = match &args.status {
        None => "backlog",
        Some(s) => match mcp_status_to_state_group(s) {
            Some(g) => g,
            None => {
                return invalid_field_error(
                    "status",
                    "status must be one of: backlog, todo, in_progress, done, cancelled",
                )
            }
        },
    };

    let resolved_state: Option<State> = states::table
        .filter(states::team_id.eq(team_id))
        .filter(states::group_name.eq(state_group))
        .order_by(states::id.asc())
        .select(State::as_select())
        .first(&mut conn)
        .await
        .optional()
        .map_err(|e| map_db_error(e, None))?;

    let state_id = resolved_state.as_ref().map(|s| s.id);
    let db_status = resolved_state
        .as_ref()
        .map(|s| status_from_state_group(&s.group_name))
        .unwrap_or("draft");

    // Resolve label names to IDs
    let label_ids = match resolve_label_ids(&mut conn, project_id, &args.labels).await {
        Ok(ids) => ids,
        Err(err) => return err,
    };

    // Convert description to blocks
    let blocks = if let Some(desc) = &args.description {
        let id_gen = || state.next_id().to_string();
        match dispatch_issue_body_markdown::from_markdown_with_ids(desc, id_gen) {
            Ok(blks) => serde_json::to_value(blks).unwrap_or(Value::Array(vec![])),
            Err(_) => Value::Array(vec![]),
        }
    } else {
        Value::Array(vec![])
    };

    // Atomically increment issue_sequence
    let (project_key, seq): (String, i32) = diesel::update(projects::table.find(project_id))
        .set(projects::issue_sequence.eq(projects::issue_sequence + 1))
        .returning((projects::key, projects::issue_sequence))
        .get_result(&mut conn)
        .await
        .map_err(|e| map_db_error(e, None))?;

    let issue_key = format!("{}-{}", project_key, seq);

    // Idempotency check
    if let Some(ref idem_key) = args.idempotency_key {
        let payload_str = format!(
            "{}|{}|{}|{}|{}",
            args.title,
            args.project_slug,
            args.description.as_deref().unwrap_or(""),
            priority,
            args.labels.join(",")
        );
        let payload_hash = Sha256::digest(payload_str.as_bytes()).to_vec();

        let existing = issue_idempotency_keys::table
            .find(idem_key.as_str())
            .select((
                issue_idempotency_keys::issue_id,
                issue_idempotency_keys::payload_hash,
            ))
            .first::<(i64, Vec<u8>)>(&mut conn)
            .await
            .optional()
            .map_err(|e| map_db_error(e, None))?;

        if let Some((existing_issue_id, existing_hash)) = existing {
            if existing_hash != payload_hash {
                // Undo sequence increment before returning
                let _ = diesel::update(projects::table.find(project_id))
                    .set(projects::issue_sequence.eq(projects::issue_sequence - 1))
                    .execute(&mut conn)
                    .await;
                return dispatch_error_result(
                    "CONFLICT",
                    "idempotency key already used with different payload",
                    None,
                    None,
                );
            }
            // Same payload → return existing issue as semantic response
            let _ = diesel::update(projects::table.find(project_id))
                .set(projects::issue_sequence.eq(projects::issue_sequence - 1))
                .execute(&mut conn)
                .await;
            return return_issue_by_id(
                existing_issue_id,
                &project,
                &mut conn,
            )
            .await;
        }

        let new_issue = do_insert_issue(
            state,
            &mut conn,
            project_id,
            args.title.clone(),
            db_status.to_owned(),
            priority,
            identity.user_id(),
            assignee_id,
            blocks.clone(),
            state_id,
            &issue_key,
        )
        .await?;

        diesel::insert_into(issue_idempotency_keys::table)
            .values((
                issue_idempotency_keys::key.eq(idem_key.as_str()),
                issue_idempotency_keys::issue_id.eq(new_issue.id),
                issue_idempotency_keys::payload_hash.eq(payload_hash),
            ))
            .execute(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;

        insert_label_refs(&mut conn, new_issue.id, &label_ids).await?;
        insert_creation_history(state, &mut conn, new_issue.id, identity.user_id()).await;

        return build_issue_response(&new_issue, &project, &label_ids, &mut conn).await;
    }

    // No idempotency key
    let new_issue = do_insert_issue(
        state,
        &mut conn,
        project_id,
        args.title.clone(),
        db_status.to_owned(),
        priority,
        identity.user_id(),
        assignee_id,
        blocks,
        state_id,
        &issue_key,
    )
    .await?;

    insert_label_refs(&mut conn, new_issue.id, &label_ids).await?;
    insert_creation_history(state, &mut conn, new_issue.id, identity.user_id()).await;

    build_issue_response(&new_issue, &project, &label_ids, &mut conn).await
}

// ---- Helpers ----

async fn resolve_label_ids(
    conn: &mut diesel_async::AsyncPgConnection,
    project_id: i64,
    names: &[String],
) -> Result<Vec<i64>, Result<Value, JsonRpcError>> {
    let mut ids = Vec::with_capacity(names.len());
    for name in names {
        let direct: Option<i64> = labels::table
            .filter(labels::project_id.eq(project_id))
            .filter(labels::name.eq(name))
            .select(labels::id)
            .first(conn)
            .await
            .optional()
            .map_err(|e| Err::<Value, _>(map_db_error(e, None)))?;

        if let Some(id) = direct {
            ids.push(id);
            continue;
        }

        // Try alias fallback
        let alias_target: Option<String> = label_aliases::table
            .filter(label_aliases::project_id.eq(project_id))
            .filter(label_aliases::old_name.eq(name))
            .select(label_aliases::current_name)
            .first(conn)
            .await
            .optional()
            .map_err(|e| Err::<Value, _>(map_db_error(e, None)))?;

        if let Some(current_name) = alias_target {
            let aliased_id: Option<i64> = labels::table
                .filter(labels::project_id.eq(project_id))
                .filter(labels::name.eq(&current_name))
                .select(labels::id)
                .first(conn)
                .await
                .optional()
                .map_err(|e| Err::<Value, _>(map_db_error(e, None)))?;

            if let Some(id) = aliased_id {
                ids.push(id);
                continue;
            }
        }

        return Err(invalid_field_error(
            "labels",
            &format!(
                "Label '{}' not found. Fetch project again to get current label names.",
                name
            ),
        ));
    }
    Ok(ids)
}

#[allow(clippy::too_many_arguments)]
async fn do_insert_issue(
    state: &AppState,
    conn: &mut diesel_async::AsyncPgConnection,
    project_id: i64,
    title: String,
    status: String,
    priority: i32,
    author_id: i64,
    assignee_id: Option<i64>,
    blocks: Value,
    state_id: Option<i64>,
    key: &str,
) -> Result<crate::models::issue::Issue, JsonRpcError> {
    let new_issue = NewIssue {
        id: state.next_id(),
        key: key.to_owned(),
        project_id,
        parent_id: None,
        title,
        status,
        priority,
        author_id,
        assignee_id,
        blocks,
        state_id,
    };
    diesel::insert_into(issues::table)
        .values(&new_issue)
        .get_result(conn)
        .await
        .map_err(|e| map_db_error(e, None))
}

async fn insert_label_refs(
    conn: &mut diesel_async::AsyncPgConnection,
    issue_id: i64,
    label_ids: &[i64],
) -> Result<(), JsonRpcError> {
    if label_ids.is_empty() {
        return Ok(());
    }
    let refs: Vec<IssueLabelRef> = label_ids
        .iter()
        .map(|&lid| IssueLabelRef {
            issue_id,
            label_id: lid,
        })
        .collect();
    diesel::insert_into(issue_label_refs::table)
        .values(&refs)
        .on_conflict_do_nothing()
        .execute(conn)
        .await
        .map_err(|e| map_db_error(e, None))?;
    Ok(())
}

async fn insert_creation_history(
    state: &AppState,
    conn: &mut diesel_async::AsyncPgConnection,
    issue_id: i64,
    actor_id: i64,
) {
    let entry = NewIssueHistoryEntry {
        id: state.next_id(),
        issue_id,
        actor_id,
        field: "created".to_owned(),
        from_value: None,
        to_value: None,
    };
    let _ = diesel::insert_into(issue_history::table)
        .values(&entry)
        .execute(conn)
        .await;
}

async fn return_issue_by_id(
    issue_id: i64,
    project: &Project,
    conn: &mut diesel_async::AsyncPgConnection,
) -> Result<Value, JsonRpcError> {
    let issue: crate::models::issue::Issue = issues::table
        .find(issue_id)
        .select(crate::models::issue::Issue::as_select())
        .first(conn)
        .await
        .map_err(|e| map_db_error(e, None))?;

    let label_refs: Vec<IssueLabelRef> = issue_label_refs::table
        .filter(issue_label_refs::issue_id.eq(issue_id))
        .select(IssueLabelRef::as_select())
        .load(conn)
        .await
        .unwrap_or_default();
    let label_ids: Vec<i64> = label_refs.iter().map(|r| r.label_id).collect();

    build_issue_response(&issue, project, &label_ids, conn).await
}

async fn build_issue_response(
    issue: &crate::models::issue::Issue,
    project: &Project,
    label_ids: &[i64],
    conn: &mut diesel_async::AsyncPgConnection,
) -> Result<Value, JsonRpcError> {
    let description = body_markdown(issue.blocks.clone()).ok();

    let status = if let Some(sid) = issue.state_id {
        states::table
            .filter(states::id.eq(sid))
            .select(crate::models::label::State::as_select())
            .first::<State>(conn)
            .await
            .ok()
            .map(|s| state_group_to_mcp_status(&s.group_name).to_owned())
            .unwrap_or_else(|| "backlog".to_owned())
    } else {
        "backlog".to_owned()
    };

    let label_names: Vec<String> = if label_ids.is_empty() {
        vec![]
    } else {
        let label_rows: Vec<crate::models::label::Label> = labels::table
            .filter(labels::id.eq_any(label_ids))
            .select(crate::models::label::Label::as_select())
            .load(conn)
            .await
            .unwrap_or_default();
        let mut names: Vec<String> = label_rows.into_iter().map(|l| l.name).collect();
        names.sort();
        names
    };

    let assignee: Option<String> = if let Some(aid) = issue.assignee_id {
        users::table
            .filter(users::id.eq(aid))
            .select(users::username)
            .first::<String>(conn)
            .await
            .ok()
    } else {
        None
    };

    json_text_result(json!({
        "key":         issue.key,
        "title":       issue.title,
        "description": description,
        "status":      status,
        "priority":    priority_to_str(issue.priority),
        "project":     { "slug": project.slug, "name": project.name },
        "labels":      label_names,
        "assignee":    assignee,
        "relations":   Value::Array(vec![]),
        "created_at":  iso8601(issue.created_at),
        "updated_at":  iso8601(issue.updated_at),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn create_issue_args_require_project_slug_and_title() {
        assert!(serde_json::from_value::<CreateIssueArgs>(json!({ "title": "T" })).is_err());
        assert!(
            serde_json::from_value::<CreateIssueArgs>(json!({ "project_slug": "strophe" }))
                .is_err()
        );
    }

    #[test]
    fn create_issue_args_defaults() {
        let args: CreateIssueArgs = serde_json::from_value(json!({
            "project_slug": "strophe",
            "title": "Test"
        }))
        .unwrap();
        assert!(args.status.is_none());
        assert!(args.priority.is_none());
        assert!(args.labels.is_empty());
    }
}
