use chrono::Utc;
use diesel::{ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::{Issue, IssueLabelRef, IssueChangeset, NewIssueHistoryEntry},
    schema::{issue_history, issue_label_refs, issues, labels, projects, states, users},
    state::AppState,
};

use super::{body_markdown, invalid_reference_error, iso8601, map_db_error, not_found_error, parse_snowflake_id, status_from_state_group};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};
use crate::models::label::State;

// Use Option<Option<T>> for nullable fields:
// None      = field absent from JSON (do not change)
// Some(None) = field explicitly null (clear)
// Some(Some(v)) = field set to v
fn deserialize_optional_nullable<'de, T, D>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    let v = Option::<Option<T>>::deserialize(deserializer)?;
    Ok(v)
}

#[derive(Deserialize)]
struct UpdateIssueArgs {
    id: String,
    patch: UpdateIssuePatch,
}

#[derive(Deserialize, Default)]
struct UpdateIssuePatch {
    title: Option<String>,
    description: Option<Value>,      // String | null
    state_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    assignee_id: Option<Option<String>>,
    priority: Option<i32>,
    label_ids: Option<Vec<String>>,
    project_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    parent_id: Option<Option<String>>,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: UpdateIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid update_issue arguments"))?;

    let issue_id = parse_snowflake_id(&args.id, "id")?;

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let current: Issue = match issues::table
        .find(issue_id)
        .select(Issue::as_select())
        .first(&mut conn)
        .await
    {
        Ok(i) => i,
        Err(diesel::result::Error::NotFound) => return not_found_error(&args.id),
        Err(e) => return Err(map_db_error(e, Some(&args.id))),
    };

    let mut changeset = IssueChangeset::default();
    let mut history_entries: Vec<(&'static str, Option<String>, Option<String>)> = vec![];

    if let Some(title) = args.patch.title {
        if title != current.title {
            history_entries.push(("title", Some(current.title.clone()), Some(title.clone())));
            changeset.title = Some(title);
        }
    }

    if let Some(desc_val) = args.patch.description {
        let new_blocks = match &desc_val {
            Value::Null => Value::Array(vec![]),
            Value::String(md) => {
                let id_gen = || state.next_id().to_string();
                match dispatch_issue_body_markdown::from_markdown_with_ids(md, id_gen) {
                    Ok(blks) => serde_json::to_value(blks).unwrap_or(Value::Array(vec![])),
                    Err(_) => Value::Array(vec![]),
                }
            }
            _ => return Err(JsonRpcError::new(INVALID_PARAMS, "description must be a string or null")),
        };
        let old_md = body_markdown(current.blocks.clone()).ok();
        let new_md = body_markdown(new_blocks.clone()).ok();
        if old_md != new_md {
            history_entries.push(("description", old_md, new_md));
            changeset.blocks = Some(new_blocks);
        }
    }

    if let Some(sid_str) = args.patch.state_id {
        let sid = parse_snowflake_id(&sid_str, "state_id")?;
        let new_state: State = match states::table
            .find(sid)
            .select(State::as_select())
            .first(&mut conn)
            .await
        {
            Ok(s) => s,
            Err(diesel::result::Error::NotFound) => {
                return invalid_reference_error("state_id", "state not found", None);
            }
            Err(e) => return Err(map_db_error(e, None)),
        };

        if Some(sid) != current.state_id {
            let old_state_name = if let Some(old_sid) = current.state_id {
                states::table
                    .find(old_sid)
                    .select(states::name)
                    .first::<String>(&mut conn)
                    .await
                    .ok()
            } else {
                None
            };
            history_entries.push((
                "state_id",
                old_state_name,
                Some(new_state.name.clone()),
            ));
            changeset.state_id = Some(sid);
            changeset.status = Some(status_from_state_group(&new_state.group_name).to_owned());
        }
    }

    if let Some(assignee_val) = args.patch.assignee_id {
        let new_assignee: Option<i64> = match assignee_val {
            None => None,
            Some(ref id_str) => {
                let aid = if id_str == "me" {
                    identity.user_id()
                } else {
                    parse_snowflake_id(id_str, "assignee_id")?
                };
                // Validate assignee exists
                let exists: i64 = users::table
                    .filter(users::id.eq(aid))
                    .count()
                    .get_result(&mut conn)
                    .await
                    .unwrap_or(0);
                if exists == 0 {
                    return invalid_reference_error("assignee_id", "assignee not found", None);
                }
                Some(aid)
            }
        };
        if new_assignee != current.assignee_id {
            history_entries.push((
                "assignee_id",
                current.assignee_id.map(|id| id.to_string()),
                new_assignee.map(|id| id.to_string()),
            ));
            changeset.assignee_id = Some(new_assignee);
        }
    }

    if let Some(priority) = args.patch.priority {
        if !(0..=4).contains(&priority) {
            return Err(JsonRpcError::new(INVALID_PARAMS, "priority must be 0-4"));
        }
        if priority != current.priority {
            history_entries.push((
                "priority",
                Some(current.priority.to_string()),
                Some(priority.to_string()),
            ));
            changeset.priority = Some(priority);
        }
    }

    if let Some(pid_str) = args.patch.project_id {
        let pid = parse_snowflake_id(&pid_str, "project_id")?;
        let proj_exists: i64 = projects::table
            .filter(crate::schema::projects::id.eq(pid))
            .count()
            .get_result(&mut conn)
            .await
            .unwrap_or(0);
        if proj_exists == 0 {
            return invalid_reference_error("project_id", "project not found", None);
        }
        if pid != current.project_id {
            history_entries.push((
                "project_id",
                Some(current.project_id.to_string()),
                Some(pid.to_string()),
            ));
            changeset.project_id = Some(pid);
        }
    }

    if let Some(parent_val) = args.patch.parent_id {
        let new_parent: Option<i64> = match parent_val {
            None => None,
            Some(ref id_str) => {
                let pid = parse_snowflake_id(id_str, "parent_id")?;
                if pid == issue_id {
                    return Err(JsonRpcError::new(INVALID_PARAMS, "issue cannot be its own parent"));
                }
                let exists: i64 = issues::table
                    .filter(issues::id.eq(pid))
                    .count()
                    .get_result(&mut conn)
                    .await
                    .unwrap_or(0);
                if exists == 0 {
                    return invalid_reference_error("parent_id", "parent issue not found", None);
                }
                Some(pid)
            }
        };
        if new_parent != current.parent_id {
            history_entries.push((
                "parent_id",
                current.parent_id.map(|id| id.to_string()),
                new_parent.map(|id| id.to_string()),
            ));
            changeset.parent_id = Some(new_parent);
        }
    }

    // Apply changeset if anything changed
    let updated: Issue = if changeset.title.is_some()
        || changeset.blocks.is_some()
        || changeset.state_id.is_some()
        || changeset.status.is_some()
        || changeset.assignee_id.is_some()
        || changeset.priority.is_some()
        || changeset.project_id.is_some()
        || changeset.parent_id.is_some()
    {
        changeset.updated_at = Some(Utc::now());
        diesel::update(issues::table.find(issue_id))
            .set(&changeset)
            .get_result(&mut conn)
            .await
            .map_err(|e| map_db_error(e, Some(&args.id)))?
    } else {
        current.clone()
    };

    // Replace label set if provided
    if let Some(new_label_ids) = args.patch.label_ids {
        let lids: Vec<i64> = new_label_ids
            .iter()
            .map(|id| parse_snowflake_id(id, "label_ids"))
            .collect::<Result<Vec<_>, _>>()?;

        // Validate all label IDs
        for &lid in &lids {
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

        diesel::delete(issue_label_refs::table.filter(issue_label_refs::issue_id.eq(issue_id)))
            .execute(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;

        if !lids.is_empty() {
            let refs: Vec<IssueLabelRef> = lids
                .iter()
                .map(|&lid| IssueLabelRef {
                    issue_id,
                    label_id: lid,
                })
                .collect();
            diesel::insert_into(issue_label_refs::table)
                .values(&refs)
                .on_conflict_do_nothing()
                .execute(&mut conn)
                .await
                .map_err(|e| map_db_error(e, None))?;
        }
    }

    // Write history entries
    for (field, from_val, to_val) in history_entries {
        let entry = NewIssueHistoryEntry {
            id: state.next_id(),
            issue_id,
            actor_id: identity.user_id(),
            field: field.to_owned(),
            from_value: from_val,
            to_value: to_val,
        };
        let _ = diesel::insert_into(issue_history::table)
            .values(&entry)
            .execute(&mut conn)
            .await;
    }

    // Fetch current label_ids for response
    let label_refs: Vec<IssueLabelRef> = issue_label_refs::table
        .filter(issue_label_refs::issue_id.eq(issue_id))
        .select(IssueLabelRef::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();
    let label_ids_out: Vec<String> = label_refs.iter().map(|r| r.label_id.to_string()).collect();

    let description = body_markdown(updated.blocks.clone()).ok();
    let state_ref = updated.state_id.map(|id| json!({ "id": id.to_string() }));

    json_text_result(json!({
        "id":          updated.id.to_string(),
        "title":       updated.title,
        "description": description,
        "state":       state_ref,
        "priority":    updated.priority,
        "assignee":    updated.assignee_id.map(|id| json!({ "id": id.to_string() })),
        "project":     { "id": updated.project_id.to_string() },
        "parent_id":   updated.parent_id.map(|id| id.to_string()),
        "label_ids":   label_ids_out,
        "created_at":  iso8601(updated.created_at),
        "updated_at":  iso8601(updated.updated_at),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn patch_parses_null_assignee() {
        let args: UpdateIssueArgs = serde_json::from_value(json!({
            "id": "1",
            "patch": { "assignee_id": null }
        }))
        .unwrap();
        assert_eq!(args.patch.assignee_id, Some(None));
    }

    #[test]
    fn patch_absent_assignee_is_none() {
        let args: UpdateIssueArgs =
            serde_json::from_value(json!({ "id": "1", "patch": { "title": "T" } })).unwrap();
        assert_eq!(args.patch.assignee_id, None);
    }

    #[test]
    fn patch_null_parent_id_is_clear() {
        let args: UpdateIssueArgs = serde_json::from_value(json!({
            "id": "1",
            "patch": { "parent_id": null }
        }))
        .unwrap();
        assert_eq!(args.patch.parent_id, Some(None));
    }
}
