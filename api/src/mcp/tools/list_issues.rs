use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Utc};
use diesel::{BoolExpressionMethods, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::{validate_status, Issue},
    schema::issues,
    state::AppState,
};

use super::{iso8601, parse_snowflake_id, priority_output};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

const DEFAULT_LIMIT: i64 = 20;
const MAX_LIMIT: i64 = 100;

#[derive(Deserialize)]
struct ListIssuesArgs {
    project_id: String,
    status: Option<String>,
    assignee_id: Option<String>,
    limit: Option<i64>,
    cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Cursor {
    updated_at: DateTime<Utc>,
    id: i64,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: ListIssuesArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid dispatch_list_issues arguments"))?;

    let project_id = parse_snowflake_id(&args.project_id, "project_id")?;
    let limit = args.limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(JsonRpcError::new(
            INVALID_PARAMS,
            "limit must be between 1 and 100",
        ));
    }

    if let Some(status) = &args.status {
        if !validate_status(status) {
            return Err(JsonRpcError::new(
                INVALID_PARAMS,
                format!("invalid status: {status}"),
            ));
        }
    }

    let assignee_id = args
        .assignee_id
        .as_deref()
        .map(|id| parse_snowflake_id(id, "assignee_id"))
        .transpose()?;
    let cursor = args.cursor.as_deref().map(decode_cursor).transpose()?;

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let mut query = issues::table
        .filter(issues::project_id.eq(project_id))
        .filter(
            issues::author_id
                .eq(identity.user_id())
                .or(issues::assignee_id.eq(Some(identity.user_id()))),
        )
        .into_boxed();

    if let Some(status) = &args.status {
        query = query.filter(issues::status.eq(status));
    }

    if let Some(assignee_id) = assignee_id {
        query = query.filter(issues::assignee_id.eq(Some(assignee_id)));
    }

    if let Some(cursor) = cursor {
        let updated_at = cursor.updated_at;
        let updated_at_eq = updated_at.clone();
        query = query.filter(
            issues::updated_at.lt(updated_at).or(issues::updated_at
                .eq(updated_at_eq)
                .and(issues::id.lt(cursor.id))),
        );
    }

    let mut rows: Vec<Issue> = query
        .order_by((issues::updated_at.desc(), issues::id.desc()))
        .limit(limit + 1)
        .select(Issue::as_select())
        .load(&mut conn)
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;

    let next_cursor = if rows.len() > limit as usize {
        rows.truncate(limit as usize);
        rows.last()
            .map(|issue| encode_cursor(issue.updated_at.clone(), issue.id))
    } else {
        None
    };

    let items: Vec<Value> = rows
        .into_iter()
        .map(|issue| {
            json!({
                "id": issue.id.to_string(),
                "title": issue.title,
                "status": issue.status,
                "priority": priority_output(issue.priority),
                "assignee_id": issue.assignee_id.map(|id| id.to_string()),
                "updated_at": iso8601(issue.updated_at),
            })
        })
        .collect();

    json_text_result(json!({
        "items": items,
        "next_cursor": next_cursor,
    }))
}

pub(crate) fn encode_cursor(updated_at: DateTime<Utc>, id: i64) -> String {
    STANDARD.encode(format!("{}:{id}", updated_at.to_rfc3339()))
}

pub(crate) fn decode_cursor(cursor: &str) -> Result<Cursor, JsonRpcError> {
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
    fn cursor_round_trips_updated_at_and_id() {
        let updated_at = Utc.with_ymd_and_hms(2026, 5, 31, 12, 13, 14).unwrap();
        let cursor = encode_cursor(updated_at, 123);

        assert_ne!(cursor, format!("{}:123", updated_at.to_rfc3339()));
        assert_eq!(
            decode_cursor(&cursor).unwrap(),
            Cursor {
                updated_at,
                id: 123
            }
        );
    }

    #[test]
    fn rejects_invalid_cursor() {
        assert_eq!(
            decode_cursor("not-base64").unwrap_err().code,
            INVALID_PARAMS
        );
    }
}
