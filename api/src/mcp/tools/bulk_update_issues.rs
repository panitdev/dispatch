use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::{IssueLabelRef, IssueChangeset},
    schema::{issue_label_refs, issues, labels, projects, states, users},
    state::AppState,
};

use super::{invalid_reference_error, map_db_error, parse_snowflake_id, status_from_state_group};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};
use crate::models::label::State;

fn deserialize_optional_nullable<'de, T, D>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Option::<Option<T>>::deserialize(deserializer)
}

#[derive(Deserialize)]
struct BulkUpdateArgs {
    ids: Vec<String>,
    patch: BulkPatch,
}

#[derive(Deserialize, Default)]
struct BulkPatch {
    state_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    assignee_id: Option<Option<String>>,
    priority: Option<i32>,
    label_ids: Option<Vec<String>>,
    project_id: Option<String>,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: BulkUpdateArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid bulk_update_issues arguments"))?;

    if args.ids.is_empty() {
        return Err(JsonRpcError::new(INVALID_PARAMS, "ids must not be empty"));
    }
    if args.ids.len() > 50 {
        return Err(JsonRpcError::new(INVALID_PARAMS, "ids must not exceed 50"));
    }

    // Validate and resolve patch fields once (shared across all items)
    let new_state: Option<(i64, &'static str)> = if let Some(ref sid_str) = args.patch.state_id {
        let sid = parse_snowflake_id(sid_str, "state_id")?;
        let mut conn = state
            .db
            .get()
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;
        let s: State = match states::table
            .find(sid)
            .select(crate::models::label::State::as_select())
            .first(&mut conn)
            .await
        {
            Ok(s) => s,
            Err(diesel::result::Error::NotFound) => {
                return invalid_reference_error("state_id", "state not found", None);
            }
            Err(e) => return Err(map_db_error(e, None)),
        };
        Some((s.id, status_from_state_group(&s.group_name)))
    } else {
        None
    };

    let new_assignee: Option<Option<i64>> = if let Some(ref assignee_val) = args.patch.assignee_id {
        match assignee_val {
            None => Some(None),
            Some(id_str) => {
                let aid = if id_str == "me" {
                    identity.user_id()
                } else {
                    parse_snowflake_id(id_str, "assignee_id")?
                };
                let mut conn = state
                    .db
                    .get()
                    .await
                    .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;
                let exists: i64 = users::table
                    .filter(users::id.eq(aid))
                    .count()
                    .get_result(&mut conn)
                    .await
                    .unwrap_or(0);
                if exists == 0 {
                    return invalid_reference_error("assignee_id", "assignee not found", None);
                }
                Some(Some(aid))
            }
        }
    } else {
        None
    };

    if let Some(p) = args.patch.priority {
        if !(0..=4).contains(&p) {
            return Err(JsonRpcError::new(INVALID_PARAMS, "priority must be 0-4"));
        }
    }

    let new_project_id: Option<i64> = if let Some(ref pid_str) = args.patch.project_id {
        let pid = parse_snowflake_id(pid_str, "project_id")?;
        let mut conn = state
            .db
            .get()
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;
        let exists: i64 = projects::table
            .filter(crate::schema::projects::id.eq(pid))
            .count()
            .get_result(&mut conn)
            .await
            .unwrap_or(0);
        if exists == 0 {
            return invalid_reference_error("project_id", "project not found", None);
        }
        Some(pid)
    } else {
        None
    };

    let new_label_ids: Option<Vec<i64>> = if let Some(ref lids) = args.patch.label_ids {
        let mut conn = state
            .db
            .get()
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;
        let parsed: Vec<i64> = lids
            .iter()
            .map(|id| parse_snowflake_id(id, "label_ids"))
            .collect::<Result<Vec<_>, _>>()?;
        for &lid in &parsed {
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
        Some(parsed)
    } else {
        None
    };

    // Process each item
    let mut results: Vec<Value> = Vec::with_capacity(args.ids.len());

    for id_str in &args.ids {
        let result = apply_to_one(
            state,
            id_str,
            new_state,
            new_assignee.clone(),
            args.patch.priority,
            &new_label_ids,
            new_project_id,
        )
        .await;

        match result {
            Ok(()) => results.push(json!({ "id": id_str, "ok": true })),
            Err(msg) => results.push(json!({ "id": id_str, "ok": false, "error": msg })),
        }
    }

    json_text_result(json!({ "results": results }))
}

async fn apply_to_one(
    state: &AppState,
    id_str: &str,
    new_state: Option<(i64, &'static str)>,
    new_assignee: Option<Option<i64>>,
    new_priority: Option<i32>,
    new_label_ids: &Option<Vec<i64>>,
    new_project_id: Option<i64>,
) -> Result<(), String> {
    let issue_id = id_str
        .parse::<i64>()
        .map_err(|_| format!("invalid id: {id_str}"))?;

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| "database unavailable".to_owned())?;

    // Verify issue exists
    let exists: i64 = issues::table
        .filter(issues::id.eq(issue_id))
        .count()
        .get_result(&mut conn)
        .await
        .unwrap_or(0);
    if exists == 0 {
        return Err(format!("not found: {id_str}"));
    }

    let mut changeset = IssueChangeset::default();
    let mut has_changes = false;

    if let Some((sid, status)) = new_state {
        changeset.state_id = Some(sid);
        changeset.status = Some(status.to_owned());
        has_changes = true;
    }
    if let Some(assignee) = new_assignee {
        changeset.assignee_id = Some(assignee);
        has_changes = true;
    }
    if let Some(priority) = new_priority {
        changeset.priority = Some(priority);
        has_changes = true;
    }
    if let Some(pid) = new_project_id {
        changeset.project_id = Some(pid);
        has_changes = true;
    }

    if has_changes {
        changeset.updated_at = Some(Utc::now());
        diesel::update(issues::table.find(issue_id))
            .set(&changeset)
            .execute(&mut conn)
            .await
            .map_err(|_| format!("update failed for {id_str}"))?;
    }

    if let Some(ref lids) = new_label_ids {
        diesel::delete(issue_label_refs::table.filter(issue_label_refs::issue_id.eq(issue_id)))
            .execute(&mut conn)
            .await
            .map_err(|_| format!("label update failed for {id_str}"))?;

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
                .map_err(|_| format!("label insert failed for {id_str}"))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn bulk_update_args_parses_ids_and_patch() {
        let args: BulkUpdateArgs = serde_json::from_value(json!({
            "ids": ["1", "2"],
            "patch": { "priority": 2 }
        }))
        .unwrap();
        assert_eq!(args.ids, vec!["1", "2"]);
        assert_eq!(args.patch.priority, Some(2));
    }

    #[test]
    fn bulk_patch_null_assignee_parses() {
        let args: BulkUpdateArgs = serde_json::from_value(json!({
            "ids": ["1"],
            "patch": { "assignee_id": null }
        }))
        .unwrap();
        assert_eq!(args.patch.assignee_id, Some(None));
    }
}
