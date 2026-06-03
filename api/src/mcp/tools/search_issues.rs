use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::{
        issue::{Issue, IssueLabelRef},
        label::State,
    },
    schema::{issue_label_refs, issues, states},
    state::AppState,
};

use super::{iso8601, map_db_error, parse_snowflake_id};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

const DEFAULT_LIMIT: i64 = 25;
const MAX_LIMIT: i64 = 100;

#[derive(Deserialize, Default)]
struct SearchFilter {
    project_id: Option<String>,
    team_id: Option<String>,
    state_id: Option<Vec<String>>,
    state_group: Option<Vec<String>>,
    assignee_id: Option<String>,
    label_id: Option<Vec<String>>,
    priority: Option<Vec<i32>>,
    parent_id: Option<String>,
    created_after: Option<DateTime<Utc>>,
    created_before: Option<DateTime<Utc>>,
    updated_after: Option<DateTime<Utc>>,
    updated_before: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
struct SearchIssuesArgs {
    query: Option<String>,
    #[serde(default)]
    filter: SearchFilter,
    cursor: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Cursor {
    updated_at: DateTime<Utc>,
    id: i64,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: SearchIssuesArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid search_issues arguments"))?;

    let limit = args.limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(JsonRpcError::new(
            INVALID_PARAMS,
            "limit must be between 1 and 100",
        ));
    }

    let cursor = args.cursor.as_deref().map(decode_cursor).transpose()?;

    let project_id = args
        .filter
        .project_id
        .as_deref()
        .map(|id| parse_snowflake_id(id, "project_id"))
        .transpose()?;
    let team_id = args
        .filter
        .team_id
        .as_deref()
        .map(|id| parse_snowflake_id(id, "team_id"))
        .transpose()?;
    let parent_id_filter = args
        .filter
        .parent_id
        .as_deref()
        .map(|id| parse_snowflake_id(id, "parent_id"))
        .transpose()?;

    let state_ids: Option<Vec<i64>> = args
        .filter
        .state_id
        .as_deref()
        .map(|ids| {
            ids.iter()
                .map(|id| parse_snowflake_id(id, "state_id"))
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?;

    let label_ids: Option<Vec<i64>> = args
        .filter
        .label_id
        .as_deref()
        .map(|ids| {
            ids.iter()
                .map(|id| parse_snowflake_id(id, "label_id"))
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?;

    let assignee_id: Option<Option<i64>> = match args.filter.assignee_id.as_deref() {
        None => None,
        Some("me") => Some(Some(identity.user_id())),
        Some(id) => Some(Some(parse_snowflake_id(id, "assignee_id")?)),
    };

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    // Resolve state_group filter to state_ids
    let group_state_ids: Option<Vec<i64>> = if let Some(groups) = &args.filter.state_group {
        if !groups.is_empty() {
            let valid = ["backlog", "unstarted", "started", "completed", "cancelled"];
            for g in groups {
                if !valid.contains(&g.as_str()) {
                    return Err(JsonRpcError::new(
                        INVALID_PARAMS,
                        format!("invalid state_group: {g}"),
                    ));
                }
            }
            let ids: Vec<i64> = states::table
                .filter(states::group_name.eq_any(groups))
                .select(states::id)
                .load(&mut conn)
                .await
                .map_err(|e| map_db_error(e, None))?;
            Some(ids)
        } else {
            None
        }
    } else {
        None
    };

    // Resolve team_id filter: if team_id is set, filter projects by team
    // and then filter issues by those project IDs
    let team_project_ids: Option<Vec<i64>> = if let Some(tid) = team_id {
        let ids: Vec<i64> = crate::schema::projects::table
            .filter(crate::schema::projects::team_id.eq(tid))
            .select(crate::schema::projects::id)
            .load(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;
        Some(ids)
    } else {
        None
    };

    let mut query = issues::table.into_boxed();

    if let Some(pid) = project_id {
        query = query.filter(issues::project_id.eq(pid));
    }

    if let Some(pids) = team_project_ids {
        query = query.filter(issues::project_id.eq_any(pids));
    }

    // Combine state_id filter and group-derived state_ids with OR logic
    match (state_ids, group_state_ids) {
        (Some(mut direct), Some(from_group)) => {
            direct.extend(from_group);
            direct.dedup();
            query = query.filter(issues::state_id.eq_any(direct));
        }
        (Some(direct), None) => {
            query = query.filter(issues::state_id.eq_any(direct));
        }
        (None, Some(from_group)) => {
            query = query.filter(issues::state_id.eq_any(from_group));
        }
        (None, None) => {}
    }

    if let Some(Some(aid)) = assignee_id {
        query = query.filter(issues::assignee_id.eq(Some(aid)));
    }

    if let Some(priorities) = args.filter.priority {
        query = query.filter(issues::priority.eq_any(priorities));
    }

    if let Some(pid) = parent_id_filter {
        query = query.filter(issues::parent_id.eq(pid));
    }

    if let Some(after) = args.filter.created_after {
        query = query.filter(issues::created_at.gt(after));
    }
    if let Some(before) = args.filter.created_before {
        query = query.filter(issues::created_at.lt(before));
    }
    if let Some(after) = args.filter.updated_after {
        query = query.filter(issues::updated_at.gt(after));
    }
    if let Some(before) = args.filter.updated_before {
        query = query.filter(issues::updated_at.lt(before));
    }

    // Full-text query: filter by title ilike
    if let Some(q) = &args.query {
        if !q.is_empty() {
            let pattern = format!("%{}%", q.replace('%', "\\%").replace('_', "\\_"));
            query = query.filter(issues::title.ilike(pattern));
        }
    }

    // label_id filter: issues that have ALL requested labels
    if let Some(lids) = &label_ids {
        for &lid in lids {
            let matching: Vec<i64> = issue_label_refs::table
                .filter(issue_label_refs::label_id.eq(lid))
                .select(issue_label_refs::issue_id)
                .load(&mut conn)
                .await
                .map_err(|e| map_db_error(e, None))?;
            query = query.filter(issues::id.eq_any(matching));
        }
    }

    if let Some(cursor) = cursor {
        let updated_at = cursor.updated_at;
        let updated_at_eq = updated_at;
        query = query.filter(
            issues::updated_at
                .lt(updated_at)
                .or(issues::updated_at.eq(updated_at_eq).and(issues::id.lt(cursor.id))),
        );
    }

    let mut rows: Vec<Issue> = query
        .order_by((issues::updated_at.desc(), issues::id.desc()))
        .limit(limit + 1)
        .select(Issue::as_select())
        .load(&mut conn)
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;

    let has_more = rows.len() > limit as usize;
    if has_more {
        rows.truncate(limit as usize);
    }
    let next_cursor = if has_more {
        rows.last()
            .map(|issue| encode_cursor(issue.updated_at, issue.id))
    } else {
        None
    };

    // Fetch state refs and label refs for returned issues
    let issue_ids: Vec<i64> = rows.iter().map(|r| r.id).collect();

    let label_refs: Vec<IssueLabelRef> = if issue_ids.is_empty() {
        vec![]
    } else {
        issue_label_refs::table
            .filter(issue_label_refs::issue_id.eq_any(&issue_ids))
            .select(IssueLabelRef::as_select())
            .load(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?
    };

    // Collect state IDs we need to resolve
    let state_id_list: Vec<i64> = rows.iter().filter_map(|r| r.state_id).collect();
    let loaded_states: Vec<State> = if state_id_list.is_empty() {
        vec![]
    } else {
        states::table
            .filter(states::id.eq_any(&state_id_list))
            .select(State::as_select())
            .load(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?
    };

    let state_map: std::collections::HashMap<i64, &State> =
        loaded_states.iter().map(|s| (s.id, s)).collect();

    let mut labels_by_issue: std::collections::HashMap<i64, Vec<i64>> =
        std::collections::HashMap::new();
    for lr in &label_refs {
        labels_by_issue
            .entry(lr.issue_id)
            .or_default()
            .push(lr.label_id);
    }

    let items: Vec<Value> = rows
        .iter()
        .map(|issue| {
            let state = issue.state_id.and_then(|sid| state_map.get(&sid));
            let label_ids_out: Vec<String> = labels_by_issue
                .get(&issue.id)
                .map(|ids| ids.iter().map(|id| id.to_string()).collect())
                .unwrap_or_default();

            json!({
                "id":          issue.id.to_string(),
                "title":       issue.title,
                "state": state.map(|s| json!({
                    "id":    s.id.to_string(),
                    "name":  s.name,
                    "group": s.group_name,
                })),
                "priority":    issue.priority,
                "assignee":    issue.assignee_id.map(|id| json!({ "id": id.to_string() })),
                "project":     { "id": issue.project_id.to_string() },
                "parent_id":   issue.parent_id.map(|id| id.to_string()),
                "label_ids":   label_ids_out,
                "created_at":  iso8601(issue.created_at),
                "updated_at":  iso8601(issue.updated_at),
            })
        })
        .collect();

    json_text_result(json!({
        "items":       items,
        "next_cursor": next_cursor,
        "total_count": Value::Null,
    }))
}

fn encode_cursor(updated_at: DateTime<Utc>, id: i64) -> String {
    STANDARD.encode(format!("{}:{id}", updated_at.to_rfc3339()))
}

fn decode_cursor(cursor: &str) -> Result<Cursor, JsonRpcError> {
    let bytes = STANDARD
        .decode(cursor)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid cursor"))?;
    let decoded = String::from_utf8(bytes)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid cursor"))?;
    let (updated_at, id) = decoded
        .rsplit_once(':')
        .ok_or_else(|| JsonRpcError::new(INVALID_PARAMS, "invalid cursor"))?;
    let updated_at = DateTime::parse_from_rfc3339(updated_at)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid cursor"))?
        .with_timezone(&Utc);
    let id = id
        .parse::<i64>()
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid cursor"))?;
    Ok(Cursor { updated_at, id })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn cursor_round_trips() {
        let updated_at = Utc.with_ymd_and_hms(2026, 6, 1, 12, 0, 0).unwrap();
        let encoded = encode_cursor(updated_at, 42);
        let decoded = decode_cursor(&encoded).unwrap();
        assert_eq!(decoded, Cursor { updated_at, id: 42 });
    }

    #[test]
    fn rejects_invalid_cursor() {
        assert_eq!(
            decode_cursor("not-base64!!").unwrap_err().code,
            INVALID_PARAMS
        );
    }
}
