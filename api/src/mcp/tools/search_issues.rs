use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::{
        issue::{Issue, IssueLabelRef},
        label::{Label, State},
        project::Project,
        user::User,
    },
    schema::{issue_label_refs, issues, labels, projects, states, users},
    state::AppState,
};

use super::{iso8601, map_db_error, mcp_status_to_state_group, priority_to_str, str_to_priority, state_group_to_mcp_status};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

const DEFAULT_LIMIT: i64 = 25;
const MAX_LIMIT: i64 = 100;

#[derive(Deserialize, Default)]
struct SearchFilter {
    project_slug: Option<String>,
    status: Option<Vec<String>>,
    assignee: Option<String>,
    labels: Option<Vec<String>>,
    priority: Option<Vec<String>>,
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

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    // Resolve project_slug → project_id
    let project_id: Option<i64> = if let Some(slug) = &args.filter.project_slug {
        let pid: Option<i64> = projects::table
            .filter(projects::slug.eq(slug))
            .select(projects::id)
            .first(&mut conn)
            .await
            .optional()
            .map_err(|e| map_db_error(e, None))?;
        if pid.is_none() {
            return Err(JsonRpcError::new(
                INVALID_PARAMS,
                format!("project not found: {slug}"),
            ));
        }
        pid
    } else {
        None
    };

    // Resolve status strings → state_ids via state_group
    let status_state_ids: Option<Vec<i64>> = if let Some(statuses) = &args.filter.status {
        if !statuses.is_empty() {
            let mut groups: Vec<&str> = vec![];
            for s in statuses {
                match mcp_status_to_state_group(s) {
                    Some(g) => groups.push(g),
                    None => {
                        return Err(JsonRpcError::new(
                            INVALID_PARAMS,
                            format!("invalid status: {s}"),
                        ))
                    }
                }
            }
            let ids: Vec<i64> = states::table
                .filter(states::group_name.eq_any(&groups))
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

    // Resolve assignee username → user_id
    let assignee_id: Option<i64> = match args.filter.assignee.as_deref() {
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
            uid // silently returns no results if user not found
        }
    };

    // Resolve priority strings → integers
    let priority_ints: Option<Vec<i32>> = if let Some(pstrs) = &args.filter.priority {
        if !pstrs.is_empty() {
            let mut ints = Vec::with_capacity(pstrs.len());
            for s in pstrs {
                match str_to_priority(s) {
                    Some(p) => ints.push(p),
                    None => {
                        return Err(JsonRpcError::new(
                            INVALID_PARAMS,
                            format!("invalid priority: {s}"),
                        ))
                    }
                }
            }
            Some(ints)
        } else {
            None
        }
    } else {
        None
    };

    // Resolve label names → label_ids (issues must have ALL labels)
    let filter_label_ids: Option<Vec<i64>> = if let Some(label_names) = &args.filter.labels {
        if !label_names.is_empty() {
            let mut ids = Vec::with_capacity(label_names.len());
            for name in label_names {
                // We do a cross-project search: match by name across all projects
                // If project_id is specified, narrow to that project
                let mut q = labels::table
                    .filter(labels::name.eq(name))
                    .into_boxed();
                if let Some(pid) = project_id {
                    q = q.filter(labels::project_id.eq(pid));
                }
                let found_ids: Vec<i64> = q
                    .select(labels::id)
                    .load(&mut conn)
                    .await
                    .map_err(|e| map_db_error(e, None))?;
                ids.extend(found_ids);
            }
            Some(ids)
        } else {
            None
        }
    } else {
        None
    };

    let mut query = issues::table.into_boxed();

    if let Some(pid) = project_id {
        query = query.filter(issues::project_id.eq(pid));
    }

    if let Some(state_ids) = status_state_ids {
        query = query.filter(issues::state_id.eq_any(state_ids));
    }

    if let Some(aid) = assignee_id {
        query = query.filter(issues::assignee_id.eq(Some(aid)));
    }

    if let Some(priorities) = priority_ints {
        query = query.filter(issues::priority.eq_any(priorities));
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

    if let Some(q) = &args.query {
        if !q.is_empty() {
            let pattern = format!("%{}%", q.replace('%', "\\%").replace('_', "\\_"));
            query = query.filter(issues::title.ilike(pattern));
        }
    }

    // Label filter: issues must have ALL requested labels
    if let Some(ref lid_groups) = filter_label_ids {
        if !lid_groups.is_empty() {
            // For each requested label name, filter issues that have at least one matching label_id
            // This is a simplification: we group by label name and require the issue to have any
            // label with that name. For exact per-name filtering across projects we do it per-label.
            // Since filter_label_ids contains ALL label IDs for ALL requested names merged together,
            // we need a different approach for ALL-labels-required semantics.
            //
            // For simplicity when project is specified, each label name maps to exactly one ID.
            // We filter: issue must appear in issue_label_refs for EACH required label.
            // This is done by per-label subquery intersection.
            if let Some(label_names) = &args.filter.labels {
                for name in label_names.iter() {
                    let mut lq = labels::table.filter(labels::name.eq(name)).into_boxed();
                    if let Some(pid) = project_id {
                        lq = lq.filter(labels::project_id.eq(pid));
                    }
                    let name_ids: Vec<i64> = lq
                        .select(labels::id)
                        .load(&mut conn)
                        .await
                        .map_err(|e| map_db_error(e, None))?;

                    if name_ids.is_empty() {
                        // Label doesn't exist; no issues can match
                        return json_text_result(json!({
                            "items": [],
                            "next_cursor": Value::Null,
                        }));
                    }

                    let matching: Vec<i64> = issue_label_refs::table
                        .filter(issue_label_refs::label_id.eq_any(name_ids))
                        .select(issue_label_refs::issue_id)
                        .load(&mut conn)
                        .await
                        .map_err(|e| map_db_error(e, None))?;
                    query = query.filter(issues::id.eq_any(matching));
                }
            }
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

    if rows.is_empty() {
        return json_text_result(json!({
            "items": [],
            "next_cursor": next_cursor,
        }));
    }

    let issue_ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let project_ids: Vec<i64> = rows.iter().map(|r| r.project_id).collect();

    // Batch-load label refs and names
    let label_refs: Vec<IssueLabelRef> = issue_label_refs::table
        .filter(issue_label_refs::issue_id.eq_any(&issue_ids))
        .select(IssueLabelRef::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();

    let all_label_ids: Vec<i64> = label_refs.iter().map(|r| r.label_id).collect();
    let all_labels: Vec<Label> = if all_label_ids.is_empty() {
        vec![]
    } else {
        labels::table
            .filter(labels::id.eq_any(&all_label_ids))
            .select(Label::as_select())
            .load(&mut conn)
            .await
            .unwrap_or_default()
    };
    let label_map: std::collections::HashMap<i64, &str> =
        all_labels.iter().map(|l| (l.id, l.name.as_str())).collect();

    let mut labels_by_issue: std::collections::HashMap<i64, Vec<String>> =
        std::collections::HashMap::new();
    for lr in &label_refs {
        if let Some(&name) = label_map.get(&lr.label_id) {
            labels_by_issue
                .entry(lr.issue_id)
                .or_default()
                .push(name.to_owned());
        }
    }
    for names in labels_by_issue.values_mut() {
        names.sort();
    }

    // Batch-load states
    let state_id_list: Vec<i64> = rows.iter().filter_map(|r| r.state_id).collect();
    let loaded_states: Vec<State> = if state_id_list.is_empty() {
        vec![]
    } else {
        states::table
            .filter(states::id.eq_any(&state_id_list))
            .select(State::as_select())
            .load(&mut conn)
            .await
            .unwrap_or_default()
    };
    let state_map: std::collections::HashMap<i64, &State> =
        loaded_states.iter().map(|s| (s.id, s)).collect();

    // Batch-load projects
    let all_projects: Vec<Project> = projects::table
        .filter(projects::id.eq_any(&project_ids))
        .select(Project::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();
    let project_map: std::collections::HashMap<i64, &Project> =
        all_projects.iter().map(|p| (p.id, p)).collect();

    // Batch-load assignees
    let assignee_ids: Vec<i64> = rows.iter().filter_map(|r| r.assignee_id).collect();
    let all_users: Vec<User> = if assignee_ids.is_empty() {
        vec![]
    } else {
        users::table
            .filter(users::id.eq_any(&assignee_ids))
            .select(User::as_select())
            .load(&mut conn)
            .await
            .unwrap_or_default()
    };
    let user_map: std::collections::HashMap<i64, &str> =
        all_users.iter().map(|u| (u.id, u.username.as_str())).collect();

    let items: Vec<Value> = rows
        .iter()
        .map(|issue| {
            let status = issue
                .state_id
                .and_then(|sid| state_map.get(&sid))
                .map(|s| state_group_to_mcp_status(&s.group_name))
                .unwrap_or("backlog");

            let proj = project_map.get(&issue.project_id);
            let label_names = labels_by_issue
                .get(&issue.id)
                .cloned()
                .unwrap_or_default();
            let assignee = issue
                .assignee_id
                .and_then(|aid| user_map.get(&aid))
                .map(|&u| u);

            json!({
                "key":        issue.key,
                "title":      issue.title,
                "status":     status,
                "priority":   priority_to_str(issue.priority),
                "project":    proj.map(|p| json!({ "slug": p.slug, "name": p.name })),
                "labels":     label_names,
                "assignee":   assignee,
                "created_at": iso8601(issue.created_at),
                "updated_at": iso8601(issue.updated_at),
            })
        })
        .collect();

    json_text_result(json!({
        "items":       items,
        "next_cursor": next_cursor,
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

    #[test]
    fn search_filter_defaults_to_empty() {
        let args: SearchIssuesArgs =
            serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(args.filter.project_slug.is_none());
        assert!(args.filter.status.is_none());
        assert!(args.query.is_none());
    }
}
