use diesel::{BoolExpressionMethods, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{models::issue::Issue, schema::issues, state::AppState};

use super::{body_markdown, iso8601, map_db_error, parse_snowflake_id, priority_output};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct GetIssueArgs {
    id: String,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: GetIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid dispatch_get_issue arguments"))?;
    let issue_id = parse_snowflake_id(&args.id, "id")?;
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
        .map_err(|error| map_db_error(error, Some(&args.id)))?;

    result_for_issue(issue)
}

pub(crate) fn result_for_issue(issue: Issue) -> Result<Value, JsonRpcError> {
    let body = body_markdown(issue.blocks.clone())?;

    json_text_result(json!({
        "id": issue.id.to_string(),
        "title": issue.title,
        "body_markdown": body,
        "status": issue.status,
        "priority": priority_output(issue.priority),
        "assignee_id": issue.assignee_id.map(|id| id.to_string()),
        "parent_id": issue.parent_id.map(|id| id.to_string()),
        "created_at": iso8601(issue.created_at),
        "updated_at": iso8601(issue.updated_at),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use serde_json::json;

    #[test]
    fn get_issue_result_uses_string_ids_and_markdown_body() {
        let at = Utc.with_ymd_and_hms(2026, 5, 31, 1, 2, 3).unwrap();
        let issue = Issue {
            id: 123,
            key: "DIS-1".to_owned(),
            project_id: 9,
            parent_id: Some(122),
            title: "Example".to_owned(),
            status: "doing".to_owned(),
            priority: 2,
            author_id: 7,
            assignee_id: Some(8),
            blocks: json!([{ "id": "b1", "kind": "markdown", "content": "Body" }]),
            created_at: at,
            updated_at: at,
        };

        let result = result_for_issue(issue).unwrap();
        let text = result["content"][0]["text"].as_str().unwrap();
        let output: Value = serde_json::from_str(text).unwrap();

        assert_eq!(output["id"], "123");
        assert_eq!(output["assignee_id"], "8");
        assert_eq!(output["parent_id"], "122");
        assert_eq!(output["priority"], "2");
        assert_eq!(output["body_markdown"], "Body\n");
        assert!(output.get("blocks").is_none());
    }
}
