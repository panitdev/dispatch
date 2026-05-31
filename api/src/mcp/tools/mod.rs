pub mod get_issue;
pub mod list_issues;
pub mod update_issue;

use chrono::{DateTime, Utc};
use diesel::result::Error as DieselError;
use serde_json::{json, Value};

use crate::models::issue::IssueBodyBlock;

use super::protocol::{JsonRpcError, Tool, INVALID_PARAMS};

pub fn all() -> Vec<Tool> {
    vec![
        Tool {
            name: "dispatch_get_issue",
            description: "Fetch a single issue by Snowflake ID. Returns title, Markdown body, status, priority, assignee, timestamps.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Snowflake issue ID" }
                },
                "required": ["id"]
            }),
        },
        Tool {
            name: "dispatch_list_issues",
            description: "List issues in a project with optional status/assignee filter. Returns metadata only, not body. Use dispatch_get_issue for body.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project_id": { "type": "string" },
                    "status": { "type": "string" },
                    "assignee_id": { "type": "string" },
                    "limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 },
                    "cursor": { "type": "string", "description": "Opaque pagination cursor from previous response" }
                },
                "required": ["project_id"]
            }),
        },
        Tool {
            name: "dispatch_update_issue",
            description: "Update one or more fields on an issue. body_markdown is accepted as Markdown and converted to storage format automatically.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "patch": {
                        "type": "object",
                        "properties": {
                            "title": { "type": "string" },
                            "body_markdown": { "type": "string" },
                            "status": { "type": "string" },
                            "priority": { "type": "string" },
                            "assignee_id": { "type": "string" }
                        },
                        "minProperties": 1
                    }
                },
                "required": ["id", "patch"]
            }),
        },
    ]
}

pub(crate) fn parse_snowflake_id(value: &str, field: &str) -> Result<i64, JsonRpcError> {
    value
        .parse::<i64>()
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, format!("invalid {field}: {value}")))
}

pub(crate) fn issue_not_found(id: &str) -> JsonRpcError {
    JsonRpcError::new(INVALID_PARAMS, format!("issue not found: {id}"))
}

pub(crate) fn map_db_error(error: DieselError, id: Option<&str>) -> JsonRpcError {
    match (error, id) {
        (DieselError::NotFound, Some(id)) => issue_not_found(id),
        (DieselError::NotFound, None) => JsonRpcError::new(INVALID_PARAMS, "not found"),
        _ => JsonRpcError::new(super::protocol::INTERNAL_ERROR, "database error"),
    }
}

pub(crate) fn body_markdown(blocks: Value) -> Result<String, JsonRpcError> {
    let blocks: Vec<IssueBodyBlock> = serde_json::from_value(blocks).map_err(|_| {
        JsonRpcError::new(super::protocol::INTERNAL_ERROR, "body conversion failed")
    })?;
    Ok(dispatch_issue_body_markdown::to_markdown(&blocks))
}

pub(crate) fn priority_output(priority: i32) -> Option<String> {
    Some(priority.to_string())
}

pub(crate) fn parse_priority(value: &str) -> Result<i32, JsonRpcError> {
    let priority = value
        .parse::<i32>()
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, format!("invalid priority: {value}")))?;

    if crate::models::issue::validate_priority(priority) {
        Ok(priority)
    } else {
        Err(JsonRpcError::new(
            INVALID_PARAMS,
            format!("invalid priority: {value}"),
        ))
    }
}

pub(crate) fn iso8601(value: DateTime<Utc>) -> String {
    value.to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_three_dispatch_tools_with_required_schemas() {
        let tools = all();

        assert_eq!(tools.len(), 3);
        assert_eq!(tools[0].name, "dispatch_get_issue");
        assert_eq!(tools[1].name, "dispatch_list_issues");
        assert_eq!(tools[2].name, "dispatch_update_issue");
        assert_eq!(tools[0].input_schema["required"], json!(["id"]));
        assert_eq!(tools[1].input_schema["required"], json!(["project_id"]));
        assert_eq!(tools[2].input_schema["required"], json!(["id", "patch"]));
    }

    #[test]
    fn converts_blocks_to_markdown() {
        let markdown = body_markdown(json!([
            { "id": "1", "kind": "markdown", "content": "# Title" }
        ]))
        .unwrap();

        assert_eq!(markdown, "# Title\n");
    }

    #[test]
    fn validates_priority_against_existing_issue_model() {
        assert_eq!(parse_priority("0").unwrap(), 0);
        assert_eq!(parse_priority("4").unwrap(), 4);
        assert_eq!(parse_priority("urgent").unwrap_err().code, INVALID_PARAMS);
        assert_eq!(parse_priority("5").unwrap_err().code, INVALID_PARAMS);
    }
}
