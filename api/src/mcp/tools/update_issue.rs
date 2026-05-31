use chrono::Utc;
use diesel::{BoolExpressionMethods, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::{validate_status, Issue, IssueChangeset},
    schema::issues,
    state::AppState,
};

use super::{body_markdown, map_db_error, parse_priority, parse_snowflake_id};
use crate::mcp::{
    auth::ApiKeyIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct UpdateIssueArgs {
    id: String,
    patch: UpdateIssuePatch,
}

#[derive(Default, Deserialize)]
struct UpdateIssuePatch {
    title: Option<String>,
    body_markdown: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    assignee_id: Option<Option<String>>,
}

pub async fn call(
    identity: &ApiKeyIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: UpdateIssueArgs = serde_json::from_value(args).map_err(|_| {
        JsonRpcError::new(INVALID_PARAMS, "invalid dispatch_update_issue arguments")
    })?;

    let issue_id = parse_snowflake_id(&args.id, "id")?;
    if args.patch.is_empty() {
        return Err(JsonRpcError::new(INVALID_PARAMS, "patch must not be empty"));
    }

    if let Some(status) = &args.patch.status {
        if !validate_status(status) {
            return Err(JsonRpcError::new(
                INVALID_PARAMS,
                format!("invalid status: {status}"),
            ));
        }
    }

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let current: Issue = issues::table
        .filter(issues::id.eq(issue_id))
        .filter(
            issues::author_id
                .eq(identity.user_id)
                .or(issues::assignee_id.eq(Some(identity.user_id))),
        )
        .select(Issue::as_select())
        .first(&mut conn)
        .await
        .map_err(|error| map_db_error(error, Some(&args.id)))?;

    let mut changeset = IssueChangeset::default();
    let mut updated_fields = Vec::new();

    if let Some(title) = args.patch.title {
        if title != current.title {
            changeset.title = Some(title);
            updated_fields.push("title");
        }
    }

    if let Some(status) = args.patch.status {
        if status != current.status {
            changeset.status = Some(status);
            updated_fields.push("status");
        }
    }

    if let Some(priority) = args.patch.priority {
        let priority = parse_priority(&priority)?;
        if priority != current.priority {
            changeset.priority = Some(priority);
            updated_fields.push("priority");
        }
    }

    if let Some(assignee_id) = args.patch.assignee_id {
        let assignee_id = assignee_id
            .as_deref()
            .map(|id| parse_snowflake_id(id, "assignee_id"))
            .transpose()?;
        if assignee_id != current.assignee_id {
            changeset.assignee_id = Some(assignee_id);
            updated_fields.push("assignee_id");
        }
    }

    if let Some(markdown) = args.patch.body_markdown {
        if let Some(blocks) =
            body_markdown_changeset(&current.blocks, &markdown, || state.next_id().to_string())?
        {
            changeset.blocks = Some(blocks);
            updated_fields.push("body_markdown");
        }
    }

    if !updated_fields.is_empty() {
        changeset.updated_at = Some(Utc::now());
        diesel::update(issues::table.find(issue_id))
            .set(&changeset)
            .execute(&mut conn)
            .await
            .map_err(|error| map_db_error(error, Some(&args.id)))?;
    }

    json_text_result(json!({
        "id": args.id,
        "updated_fields": updated_fields,
    }))
}

fn body_markdown_changeset<F>(
    current_blocks: &Value,
    markdown: &str,
    next_id: F,
) -> Result<Option<Value>, JsonRpcError>
where
    F: FnMut() -> String,
{
    if markdown == body_markdown(current_blocks.clone())? {
        return Ok(None);
    }

    let blocks = dispatch_issue_body_markdown::from_markdown_with_ids(markdown, next_id)
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "body conversion failed"))?;
    let blocks = serde_json::to_value(blocks)
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "body conversion failed"))?;

    Ok(Some(blocks))
}

impl UpdateIssuePatch {
    fn is_empty(&self) -> bool {
        self.title.is_none()
            && self.body_markdown.is_none()
            && self.status.is_none()
            && self.priority.is_none()
            && self.assignee_id.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_patch_is_detected() {
        assert!(UpdateIssuePatch::default().is_empty());
        assert!(!UpdateIssuePatch {
            title: Some("Title".to_owned()),
            ..Default::default()
        }
        .is_empty());
    }

    #[test]
    fn unchanged_body_markdown_does_not_regenerate_blocks() {
        let current_blocks = json!([
            { "id": "stable-id", "kind": "markdown", "content": "Body" }
        ]);

        let changeset =
            body_markdown_changeset(&current_blocks, "Body\n", || "new-id".to_owned()).unwrap();

        assert_eq!(changeset, None);
    }

    #[test]
    fn changed_body_markdown_generates_blocks() {
        let current_blocks = json!([
            { "id": "stable-id", "kind": "markdown", "content": "Body" }
        ]);

        let changeset =
            body_markdown_changeset(&current_blocks, "Changed\n", || "new-id".to_owned())
                .unwrap()
                .unwrap();

        assert_eq!(changeset[0]["id"], "new-id");
        assert_eq!(changeset[0]["content"], "Changed");
    }
}
