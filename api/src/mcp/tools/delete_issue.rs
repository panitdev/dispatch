use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{schema::issues, state::AppState};

use super::{map_db_error, not_found_error, parse_issue_identifier, IssueIdentifier};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct DeleteIssueArgs {
    key: String,
}

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: DeleteIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid delete_issue arguments"))?;

    let identifier = parse_issue_identifier(Some(args.key), "key")?;
    let identifier_label = identifier.label();

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let mut query = issues::table.into_boxed();
    query = match &identifier {
        IssueIdentifier::Id(id) => query.filter(issues::id.eq(*id)),
        IssueIdentifier::Key(key) => query.filter(issues::key.eq(key.as_str())),
    };

    let issue_id: i64 = match query.select(issues::id).first(&mut conn).await {
        Ok(id) => id,
        Err(diesel::result::Error::NotFound) => return not_found_error(&identifier_label),
        Err(e) => return Err(map_db_error(e, Some(&identifier_label))),
    };

    // Cascades to: issue_label_refs, issue_relations (both directions), issue_comments,
    // issue_history, issue_idempotency_keys — all have ON DELETE CASCADE FKs.
    diesel::delete(issues::table.find(issue_id))
        .execute(&mut conn)
        .await
        .map_err(|e| map_db_error(e, Some(&identifier_label)))?;

    json_text_result(json!({ "key": identifier_label, "deleted": true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delete_issue_args_require_key() {
        assert!(serde_json::from_value::<DeleteIssueArgs>(serde_json::json!({})).is_err());
        let args: DeleteIssueArgs =
            serde_json::from_value(serde_json::json!({ "key": "STR-11" })).unwrap();
        assert_eq!(args.key, "STR-11");
    }
}
