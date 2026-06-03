pub mod bulk_update_issues;
pub mod comment_on_issue;
pub mod create_issue;
pub mod get_current_context;
pub mod get_issue;
pub mod get_workspace_metadata;
pub mod relate_issues;
pub mod search_issues;
pub mod update_issue;

use chrono::{DateTime, Utc};
use diesel::result::Error as DieselError;
use serde_json::{json, Value};

use crate::models::issue::IssueBodyBlock;

use super::protocol::{dispatch_error_result, JsonRpcError, Tool, INVALID_PARAMS};

pub fn all() -> Vec<Tool> {
    vec![
        Tool {
            name: "search_issues",
            description: "Search and filter issues by structured criteria and optional full-text query. Returns lightweight summaries; no descriptions. Paginated with opaque cursor.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Full-text search across title and description." },
                    "filter": {
                        "type": "object",
                        "properties": {
                            "project_id":    { "type": "string" },
                            "team_id":       { "type": "string" },
                            "state_id":      { "type": "array", "items": { "type": "string" } },
                            "state_group":   { "type": "array", "items": { "type": "string", "enum": ["backlog","unstarted","started","completed","cancelled"] } },
                            "assignee_id":   { "type": "string", "description": "SnowflakeId or \"me\"." },
                            "label_id":      { "type": "array", "items": { "type": "string" } },
                            "priority":      { "type": "array", "items": { "type": "integer", "minimum": 0, "maximum": 4 } },
                            "parent_id":     { "type": "string" },
                            "created_after": { "type": "string", "format": "date-time" },
                            "created_before":{ "type": "string", "format": "date-time" },
                            "updated_after": { "type": "string", "format": "date-time" },
                            "updated_before":{ "type": "string", "format": "date-time" }
                        },
                        "additionalProperties": false
                    },
                    "cursor": { "type": "string" },
                    "limit":  { "type": "integer", "minimum": 1, "maximum": 100, "default": 25 }
                },
                "additionalProperties": false
            }),
        },
        Tool {
            name: "get_issue",
            description: "Fetch a single issue by issue ID with full content (description included). Prefer the id from Dispatch web URLs or search/list results; key is also accepted. Optionally include comments, edit history, and linked relations.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Issue ID from the Dispatch web URL or search/list results." },
                    "key": { "type": "string", "description": "Issue key visible in Dispatch, such as PROJ-123." },
                    "include": {
                        "type": "array",
                        "items": { "type": "string", "enum": ["comments", "history", "relations"] }
                    }
                },
                "oneOf": [
                    { "required": ["id"] },
                    { "required": ["key"] }
                ],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "get_workspace_metadata",
            description: "Fetch reference data (projects, teams, labels, states, members) required to construct valid IDs for mutations. Call once per session; data is slow-changing.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "array",
                        "items": { "type": "string", "enum": ["projects","teams","labels","states","members"] }
                    }
                },
                "additionalProperties": false
            }),
        },
        Tool {
            name: "get_current_context",
            description: "Return the authenticated user's identity, team memberships, and default project. Resolves the 'me' sentinel without a round-trip on every mutation.",
            input_schema: json!({
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }),
        },
        Tool {
            name: "create_issue",
            description: "Create a new issue. title and project_id are required. Provide an idempotency_key to safely retry on network failure.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title":           { "type": "string" },
                    "project_id":      { "type": "string" },
                    "description":     { "type": "string" },
                    "state_id":        { "type": "string" },
                    "assignee_id":     { "type": "string" },
                    "priority":        { "type": "integer", "minimum": 0, "maximum": 4 },
                    "label_ids":       { "type": "array", "items": { "type": "string" } },
                    "parent_id":       { "type": "string" },
                    "idempotency_key": { "type": "string" }
                },
                "required": ["title", "project_id"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "update_issue",
            description: "Partially update an issue by issue ID. Prefer the id from Dispatch web URLs or search/list results; key is also accepted. Omitted fields are unchanged. Explicit null clears nullable fields (description, assignee_id, parent_id). label_ids replaces the full label set.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Issue ID from the Dispatch web URL or search/list results." },
                    "key": { "type": "string", "description": "Issue key visible in Dispatch, such as PROJ-123." },
                    "patch": {
                        "type": "object",
                        "properties": {
                            "title":       { "type": "string" },
                            "description": { "oneOf": [{ "type": "string" }, { "type": "null" }] },
                            "state_id":    { "type": "string" },
                            "assignee_id": { "oneOf": [{ "type": "string" }, { "type": "null" }] },
                            "priority":    { "type": "integer", "minimum": 0, "maximum": 4 },
                            "label_ids":   { "type": "array", "items": { "type": "string" } },
                            "project_id":  { "type": "string" },
                            "parent_id":   { "oneOf": [{ "type": "string" }, { "type": "null" }] }
                        },
                        "additionalProperties": false,
                        "minProperties": 1
                    }
                },
                "required": ["patch"],
                "oneOf": [
                    { "required": ["id"] },
                    { "required": ["key"] }
                ],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "comment_on_issue",
            description: "Add a Markdown comment to an issue.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id":   { "type": "string" },
                    "body": { "type": "string", "description": "Markdown content." }
                },
                "required": ["id", "body"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "relate_issues",
            description: "Create a typed relation between two issues. blocks/blocked_by are symmetric inverses stored as a single directed edge.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "from_id": { "type": "string" },
                    "to_id":   { "type": "string" },
                    "type":    { "type": "string", "enum": ["blocks","blocked_by","related","duplicate"] }
                },
                "required": ["from_id", "to_id", "type"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "bulk_update_issues",
            description: "Apply a uniform patch to multiple issues by explicit ID list (max 50). Per-item result: partial failure does not abort remaining items. No filter-based bulk — always search first, then pass the IDs you intend to modify.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "ids": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "maxItems": 50
                    },
                    "patch": {
                        "type": "object",
                        "properties": {
                            "state_id":    { "type": "string" },
                            "assignee_id": { "oneOf": [{ "type": "string" }, { "type": "null" }] },
                            "priority":    { "type": "integer", "minimum": 0, "maximum": 4 },
                            "label_ids":   { "type": "array", "items": { "type": "string" } },
                            "project_id":  { "type": "string" }
                        },
                        "additionalProperties": false,
                        "minProperties": 1
                    }
                },
                "required": ["ids", "patch"],
                "additionalProperties": false
            }),
        },
    ]
}

// ---- Shared helpers ----

pub(crate) fn parse_snowflake_id(value: &str, field: &str) -> Result<i64, JsonRpcError> {
    value
        .parse::<i64>()
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, format!("invalid {field}: {value}")))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum IssueIdentifier {
    Id(i64),
    Key(String),
}

impl IssueIdentifier {
    pub(crate) fn label(&self) -> String {
        match self {
            Self::Id(id) => id.to_string(),
            Self::Key(key) => key.clone(),
        }
    }
}

pub(crate) fn parse_issue_identifier(
    id: Option<String>,
    key: Option<String>,
) -> Result<IssueIdentifier, JsonRpcError> {
    match (id, key) {
        (Some(id), None) => parse_snowflake_id(&id, "id").map(IssueIdentifier::Id),
        (None, Some(key)) if !key.is_empty() => Ok(IssueIdentifier::Key(key)),
        (None, Some(_)) => Err(JsonRpcError::new(INVALID_PARAMS, "key must not be empty")),
        (None, None) => Err(JsonRpcError::new(INVALID_PARAMS, "provide id or key")),
        (Some(_), Some(_)) => Err(JsonRpcError::new(
            INVALID_PARAMS,
            "provide only one of id or key",
        )),
    }
}

pub(crate) fn parse_issue_identifier_value(value: &str) -> IssueIdentifier {
    parse_snowflake_id(value, "id")
        .map(IssueIdentifier::Id)
        .unwrap_or_else(|_| IssueIdentifier::Key(value.to_owned()))
}

pub(crate) fn not_found_error(id: &str) -> Result<Value, JsonRpcError> {
    dispatch_error_result("NOT_FOUND", format!("not found: {id}"), None, None)
}

pub(crate) fn invalid_reference_error(
    field: &str,
    message: &str,
    valid_values: Option<&[String]>,
) -> Result<Value, JsonRpcError> {
    dispatch_error_result("INVALID_REFERENCE", message, Some(field), valid_values)
}

pub(crate) fn invalid_field_error(field: &str, message: &str) -> Result<Value, JsonRpcError> {
    dispatch_error_result("INVALID_FIELD", message, Some(field), None)
}

pub(crate) fn map_db_error(error: DieselError, id: Option<&str>) -> JsonRpcError {
    match (error, id) {
        (DieselError::NotFound, Some(id)) => {
            JsonRpcError::new(INVALID_PARAMS, format!("not found: {id}"))
        }
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

pub(crate) fn iso8601(value: DateTime<Utc>) -> String {
    value.to_rfc3339()
}

pub(crate) fn status_from_state_group(group: &str) -> &'static str {
    match group {
        "backlog" => "draft",
        "unstarted" => "next",
        "started" => "doing",
        "completed" => "done",
        "cancelled" => "cancelled",
        _ => "draft",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn lists_nine_dispatch_tools_with_required_schemas() {
        let tools = all();

        assert_eq!(tools.len(), 9);
        assert_eq!(tools[0].name, "search_issues");
        assert_eq!(tools[1].name, "get_issue");
        assert_eq!(tools[2].name, "get_workspace_metadata");
        assert_eq!(tools[3].name, "get_current_context");
        assert_eq!(tools[4].name, "create_issue");
        assert_eq!(tools[5].name, "update_issue");
        assert_eq!(tools[6].name, "comment_on_issue");
        assert_eq!(tools[7].name, "relate_issues");
        assert_eq!(tools[8].name, "bulk_update_issues");
        assert_eq!(tools[1].input_schema["oneOf"][0]["required"], json!(["id"]));
        assert_eq!(
            tools[1].input_schema["oneOf"][1]["required"],
            json!(["key"])
        );
        assert_eq!(tools[5].input_schema["required"], json!(["patch"]));
        assert_eq!(tools[5].input_schema["oneOf"][0]["required"], json!(["id"]));
        assert_eq!(
            tools[5].input_schema["oneOf"][1]["required"],
            json!(["key"])
        );
    }

    #[test]
    fn accepts_issue_identifier_id_or_key() {
        assert_eq!(
            parse_issue_identifier(Some("123".to_owned()), None).unwrap(),
            IssueIdentifier::Id(123)
        );
        assert_eq!(
            parse_issue_identifier(None, Some("DIS-1".to_owned())).unwrap(),
            IssueIdentifier::Key("DIS-1".to_owned())
        );
        assert_eq!(
            parse_issue_identifier(None, None).unwrap_err().message,
            "provide id or key"
        );
        assert_eq!(
            parse_issue_identifier(Some("123".to_owned()), Some("DIS-1".to_owned()))
                .unwrap_err()
                .message,
            "provide only one of id or key"
        );
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
    fn status_mapping_covers_all_groups() {
        assert_eq!(status_from_state_group("backlog"), "draft");
        assert_eq!(status_from_state_group("unstarted"), "next");
        assert_eq!(status_from_state_group("started"), "doing");
        assert_eq!(status_from_state_group("completed"), "done");
        assert_eq!(status_from_state_group("cancelled"), "cancelled");
    }
}
