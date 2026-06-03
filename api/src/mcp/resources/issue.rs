use diesel::{BoolExpressionMethods, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    mcp::{
        auth::McpIdentity,
        protocol::{JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
        tools::{body_markdown, iso8601, map_db_error, parse_snowflake_id},
    },
    models::issue::Issue,
    schema::issues,
    state::AppState,
};

#[derive(Deserialize)]
struct ReadResourceParams {
    uri: String,
}

pub async fn list(identity: &McpIdentity, state: &AppState) -> Result<Value, JsonRpcError> {
    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let rows: Vec<Issue> = issues::table
        .filter(
            issues::author_id
                .eq(identity.user_id())
                .or(issues::assignee_id.eq(Some(identity.user_id()))),
        )
        .order_by((issues::updated_at.desc(), issues::id.desc()))
        .limit(50)
        .select(Issue::as_select())
        .load(&mut conn)
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;

    let resources: Vec<Value> = rows
        .into_iter()
        .map(|issue| {
            let id = issue.id.to_string();
            json!({
                "uri": format!("dispatch://issue/{id}"),
                "name": format!("Issue #{id}"),
                "mimeType": "text/plain",
            })
        })
        .collect();

    Ok(json!({ "resources": resources }))
}

pub async fn read(
    identity: &McpIdentity,
    state: &AppState,
    params: &Option<Value>,
) -> Result<Value, JsonRpcError> {
    let params: ReadResourceParams = serde_json::from_value(params.clone().unwrap_or(Value::Null))
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid resources/read params"))?;
    let id = parse_issue_uri(&params.uri)?;
    let issue_id = parse_snowflake_id(&id, "id")?;

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let issue: Issue = issues::table
        .filter(issues::id.eq(issue_id))
        .filter(
            issues::author_id
                .eq(identity.user_id())
                .or(issues::assignee_id.eq(Some(identity.user_id()))),
        )
        .select(Issue::as_select())
        .first(&mut conn)
        .await
        .map_err(|error| map_db_error(error, Some(&id)))?;

    let text = text_for_issue(issue)?;
    Ok(json!({
        "contents": [
            {
                "uri": params.uri,
                "mimeType": "text/plain",
                "text": text,
            }
        ]
    }))
}

pub(crate) fn parse_issue_uri(uri: &str) -> Result<String, JsonRpcError> {
    let id = uri
        .strip_prefix("dispatch://issue/")
        .ok_or_else(|| JsonRpcError::new(INVALID_PARAMS, "invalid resource uri"))?;

    if id.is_empty() || id.contains('/') {
        return Err(JsonRpcError::new(INVALID_PARAMS, "invalid resource uri"));
    }

    Ok(id.to_owned())
}

pub(crate) fn text_for_issue(issue: Issue) -> Result<String, JsonRpcError> {
    let id = issue.id.to_string();
    let priority = issue.priority.to_string();
    let assignee = issue
        .assignee_id
        .map(|id| id.to_string())
        .unwrap_or_else(|| "null".to_owned());
    let body = body_markdown(issue.blocks.clone())?;

    Ok(format!(
        "# {}\n\n**ID:** {}\n**Status:** {}\n**Priority:** {}\n**Assignee:** {}\n**Created:** {}\n**Updated:** {}\n\n---\n\n{}",
        issue.title,
        id,
        issue.status,
        priority,
        assignee,
        iso8601(issue.created_at),
        iso8601(issue.updated_at),
        body,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use serde_json::json;

    #[test]
    fn parses_dispatch_issue_uri() {
        assert_eq!(parse_issue_uri("dispatch://issue/123").unwrap(), "123");
        assert_eq!(
            parse_issue_uri("https://example.com/123").unwrap_err().code,
            INVALID_PARAMS
        );
        assert_eq!(
            parse_issue_uri("dispatch://issue/123/extra")
                .unwrap_err()
                .code,
            INVALID_PARAMS
        );
    }

    #[test]
    fn formats_issue_resource_text_with_markdown_body() {
        let at = Utc.with_ymd_and_hms(2026, 5, 31, 1, 2, 3).unwrap();
        let issue = Issue {
            id: 123,
            key: "DIS-1".to_owned(),
            project_id: 1,
            parent_id: None,
            title: "Example".to_owned(),
            status: "doing".to_owned(),
            priority: 2,
            author_id: 7,
            assignee_id: Some(8),
            blocks: json!([{ "id": "b1", "kind": "markdown", "content": "Body" }]),
            created_at: at,
            updated_at: at,
            state_id: None,
        };

        let text = text_for_issue(issue).unwrap();

        assert!(text.starts_with("# Example\n\n**ID:** 123"));
        assert!(text.contains("**Status:** doing"));
        assert!(text.contains("**Priority:** 2"));
        assert!(text.contains("**Assignee:** 8"));
        assert!(text.ends_with("Body\n"));
    }
}
