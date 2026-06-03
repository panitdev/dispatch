use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::NewIssueComment,
    schema::{issue_comments, issues},
    state::AppState,
};

use super::{iso8601, map_db_error, not_found_error, parse_snowflake_id};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct CommentOnIssueArgs {
    id: String,
    body: String,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: CommentOnIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid comment_on_issue arguments"))?;

    if args.body.trim().is_empty() {
        return Err(JsonRpcError::new(INVALID_PARAMS, "body must not be empty"));
    }

    let issue_id = parse_snowflake_id(&args.id, "id")?;
    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    // Verify issue exists
    let exists: i64 = issues::table
        .filter(issues::id.eq(issue_id))
        .count()
        .get_result(&mut conn)
        .await
        .unwrap_or(0);
    if exists == 0 {
        return not_found_error(&args.id);
    }

    let new_comment = NewIssueComment {
        id: state.next_id(),
        issue_id,
        author_id: identity.user_id(),
        body: args.body.clone(),
    };

    let created: crate::models::issue::IssueComment =
        diesel::insert_into(issue_comments::table)
            .values(&new_comment)
            .get_result(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;

    json_text_result(json!({
        "id":         created.id.to_string(),
        "author":     { "id": identity.user_id().to_string() },
        "body":       created.body,
        "created_at": iso8601(created.created_at),
        "updated_at": iso8601(created.updated_at),
    }))
}
