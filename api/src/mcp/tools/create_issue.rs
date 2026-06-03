use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::{
    models::issue::{IssueLabelRef, NewIssue, NewIssueHistoryEntry},
    schema::{issue_history, issue_idempotency_keys, issue_label_refs, issues, labels, projects, states, users},
    state::AppState,
};

use super::{body_markdown, invalid_reference_error, iso8601, map_db_error, parse_snowflake_id, status_from_state_group};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{dispatch_error_result, json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};
use crate::models::label::State;

#[derive(Deserialize)]
struct CreateIssueArgs {
    title: String,
    project_id: String,
    description: Option<String>,
    state_id: Option<String>,
    assignee_id: Option<String>,
    #[serde(default)]
    priority: i32,
    #[serde(default)]
    label_ids: Vec<String>,
    parent_id: Option<String>,
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
        return dispatch_error_result(
            "INVALID_FIELD",
            "title must not be empty",
            Some("title"),
            None,
        );
    }
    if !(0..=4).contains(&args.priority) {
        return dispatch_error_result(
            "INVALID_FIELD",
            "priority must be 0-4",
            Some("priority"),
            None,
        );
    }

    let project_id = parse_snowflake_id(&args.project_id, "project_id")?;
    let parent_id: Option<i64> = args
        .parent_id
        .as_deref()
        .map(|id| parse_snowflake_id(id, "parent_id"))
        .transpose()?;
    let assignee_id: Option<i64> = args
        .assignee_id
        .as_deref()
        .map(|id| {
            if id == "me" {
                Ok(identity.user_id())
            } else {
                parse_snowflake_id(id, "assignee_id")
            }
        })
        .transpose()?;
    let state_id_arg: Option<i64> = args
        .state_id
        .as_deref()
        .map(|id| parse_snowflake_id(id, "state_id"))
        .transpose()?;
    let label_ids: Vec<i64> = args
        .label_ids
        .iter()
        .map(|id| parse_snowflake_id(id, "label_ids"))
        .collect::<Result<Vec<_>, _>>()?;

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    // Atomically increment issue_sequence and capture key + seq
    let (project_key, seq): (String, i32) = diesel::update(projects::table.find(project_id))
        .set(projects::issue_sequence.eq(projects::issue_sequence + 1))
        .returning((projects::key, projects::issue_sequence))
        .get_result(&mut conn)
        .await
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                JsonRpcError::new(INVALID_PARAMS, "project not found")
            }
            other => map_db_error(other, None),
        })?;

    // Validate and resolve state_id
    let resolved_state: Option<State> = if let Some(sid) = state_id_arg {
        match states::table
            .find(sid)
            .select(State::as_select())
            .first(&mut conn)
            .await
        {
            Ok(s) => Some(s),
            Err(diesel::result::Error::NotFound) => {
                // Best-effort undo sequence increment
                let _ = diesel::update(projects::table.find(project_id))
                    .set(projects::issue_sequence.eq(projects::issue_sequence - 1))
                    .execute(&mut conn)
                    .await;
                return invalid_reference_error("state_id", "state not found", None);
            }
            Err(e) => return Err(map_db_error(e, None)),
        }
    } else {
        // Default: first backlog state
        states::table
            .filter(states::group_name.eq("backlog"))
            .order_by(states::id.asc())
            .select(State::as_select())
            .first(&mut conn)
            .await
            .ok()
    };

    // Validate assignee_id
    if let Some(aid) = assignee_id {
        let exists: i64 = users::table
            .filter(users::id.eq(aid))
            .count()
            .get_result(&mut conn)
            .await
            .unwrap_or(0);
        if exists == 0 {
            return invalid_reference_error("assignee_id", "assignee not found", None);
        }
    }

    // Validate label_ids
    for &lid in &label_ids {
        let exists: i64 = labels::table
            .filter(labels::id.eq(lid))
            .count()
            .get_result(&mut conn)
            .await
            .unwrap_or(0);
        if exists == 0 {
            return invalid_reference_error(
                "label_ids",
                &format!("label not found: {lid}"),
                None,
            );
        }
    }

    // Validate parent_id
    if let Some(pid) = parent_id {
        let exists: i64 = issues::table
            .filter(issues::id.eq(pid))
            .count()
            .get_result(&mut conn)
            .await
            .unwrap_or(0);
        if exists == 0 {
            return invalid_reference_error("parent_id", "parent issue not found", None);
        }
    }

    let status = resolved_state
        .as_ref()
        .map(|s| status_from_state_group(&s.group_name))
        .unwrap_or("draft");
    let state_id = resolved_state.as_ref().map(|s| s.id);

    // Convert description markdown to blocks
    let blocks = if let Some(desc) = &args.description {
        let id_gen = || state.next_id().to_string();
        match dispatch_issue_body_markdown::from_markdown_with_ids(desc, id_gen) {
            Ok(blks) => serde_json::to_value(blks).unwrap_or(Value::Array(vec![])),
            Err(_) => Value::Array(vec![]),
        }
    } else {
        Value::Array(vec![])
    };

    let issue_key = format!("{}-{}", project_key, seq);

    // Idempotency check
    if let Some(ref idem_key) = args.idempotency_key {
        let payload_str = format!(
            "{}|{}|{}|{}|{}",
            args.title,
            args.project_id,
            args.description.as_deref().unwrap_or(""),
            args.priority,
            args.label_ids.join(",")
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
                return dispatch_error_result(
                    "CONFLICT",
                    "idempotency key already used with different payload",
                    None,
                    None,
                );
            }
            // Same payload → return existing issue
            let issue = issues::table
                .find(existing_issue_id)
                .select(crate::models::issue::Issue::as_select())
                .first(&mut conn)
                .await
                .map_err(|e| map_db_error(e, None))?;
            let desc_out = body_markdown(issue.blocks.clone()).ok();
            return json_text_result(issue_to_json(&issue, desc_out, issue.state_id, &label_ids));
        }

        // New key — create and record
        let new_issue = do_insert_issue(
            state,
            &mut conn,
            project_id,
            parent_id,
            args.title.clone(),
            status.to_string(),
            args.priority,
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

        let desc_out = body_markdown(new_issue.blocks.clone()).ok();
        return json_text_result(issue_to_json(&new_issue, desc_out, state_id, &label_ids));
    }

    // No idempotency key
    let new_issue = do_insert_issue(
        state,
        &mut conn,
        project_id,
        parent_id,
        args.title.clone(),
        status.to_string(),
        args.priority,
        identity.user_id(),
        assignee_id,
        blocks,
        state_id,
        &issue_key,
    )
    .await?;

    insert_label_refs(&mut conn, new_issue.id, &label_ids).await?;
    insert_creation_history(state, &mut conn, new_issue.id, identity.user_id()).await;

    let desc_out = body_markdown(new_issue.blocks.clone()).ok();
    json_text_result(issue_to_json(&new_issue, desc_out, state_id, &label_ids))
}

#[allow(clippy::too_many_arguments)]
async fn do_insert_issue(
    state: &AppState,
    conn: &mut diesel_async::AsyncPgConnection,
    project_id: i64,
    parent_id: Option<i64>,
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
        parent_id,
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

fn issue_to_json(
    issue: &crate::models::issue::Issue,
    description: Option<String>,
    state_id: Option<i64>,
    label_ids: &[i64],
) -> Value {
    json!({
        "id":          issue.id.to_string(),
        "title":       issue.title,
        "description": description,
        "state":       state_id.map(|id| json!({ "id": id.to_string() })),
        "priority":    issue.priority,
        "assignee":    issue.assignee_id.map(|id| json!({ "id": id.to_string() })),
        "project":     { "id": issue.project_id.to_string() },
        "parent_id":   issue.parent_id.map(|id| id.to_string()),
        "label_ids":   label_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>(),
        "created_at":  iso8601(issue.created_at),
        "updated_at":  iso8601(issue.updated_at),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn create_issue_args_require_title_and_project_id() {
        assert!(serde_json::from_value::<CreateIssueArgs>(json!({ "title": "T" })).is_err());
        assert!(serde_json::from_value::<CreateIssueArgs>(json!({ "project_id": "1" })).is_err());
    }

    #[test]
    fn create_issue_args_priority_defaults_to_zero() {
        let args: CreateIssueArgs =
            serde_json::from_value(json!({ "title": "T", "project_id": "1" })).unwrap();
        assert_eq!(args.priority, 0);
    }
}
