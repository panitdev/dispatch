pub mod create_issue;
pub mod delete_issue;
pub mod get_issue;
pub mod get_project;
pub mod list_projects;
pub mod search_issues;
pub mod update_issue;

// Kept but not registered in the MCP surface
pub mod bulk_update_issues;
pub mod comment_on_issue;
pub mod get_current_context;
pub mod get_workspace_metadata;
pub mod list_issues;
pub mod relate_issues;

use chrono::{DateTime, Utc};
use diesel::result::Error as DieselError;
use serde_json::{json, Value};

use crate::models::issue::IssueBodyBlock;

use super::protocol::{dispatch_error_result, JsonRpcError, Tool, INVALID_PARAMS};

pub fn all() -> Vec<Tool> {
    vec![
        Tool {
            name: "list_projects",
            description: "List all available projects. Returns slug and name for each. Use when the target project slug is not yet known.",
            input_schema: json!({
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }),
        },
        Tool {
            name: "get_project",
            description: "Fetch a project by slug, including its label names. Call before create_issue to know which labels are valid for the project.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "slug": { "type": "string", "description": "Project slug, e.g. \"strophe\"." }
                },
                "required": ["slug"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "get_issue",
            description: "Fetch a single issue by key (e.g. STR-11). Returns full content including description and relations. Use directly when you have the key — no prior search needed.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "Issue key, e.g. \"STR-11\"." }
                },
                "required": ["key"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "create_issue",
            description: "Create a new issue. project_slug and title are required. Call get_project first to get valid label names.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project_slug":    { "type": "string" },
                    "title":           { "type": "string" },
                    "description":     { "type": "string" },
                    "status":          { "type": "string", "description": "One of: backlog, todo, in_progress, done, cancelled. Defaults to backlog." },
                    "priority":        { "type": "string", "description": "One of: no_priority, urgent, high, medium, low. Defaults to no_priority." },
                    "labels":          { "type": "array", "items": { "type": "string" }, "description": "Label names from the project." },
                    "assignee":        { "type": "string", "description": "Username or \"me\"." },
                    "idempotency_key": { "type": "string", "description": "Unique key to safely retry on network failure." }
                },
                "required": ["project_slug", "title"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "update_issue",
            description: "Partially update an issue by key. Omitted fields are unchanged. Explicit null clears nullable fields. labels replaces the full label set. relations is an additive delta.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "Issue key, e.g. \"STR-11\"." },
                    "patch": {
                        "type": "object",
                        "properties": {
                            "title":       { "type": "string" },
                            "description": { "type": ["string", "null"], "description": "String to replace, or null to clear." },
                            "status":      { "type": "string", "description": "One of: backlog, todo, in_progress, done, cancelled." },
                            "priority":    { "type": "string", "description": "One of: no_priority, urgent, high, medium, low." },
                            "labels":      { "type": "array", "items": { "type": "string" }, "description": "Replaces the full label set." },
                            "assignee":    { "type": ["string", "null"], "description": "Username, \"me\", or null to clear." },
                            "project_slug":{ "type": "string", "description": "Move issue to another project (clears labels)." },
                            "relations": {
                                "type": "array",
                                "description": "Additive delta. Each element adds or removes a relation.",
                                "items": {
                                    "oneOf": [
                                        {
                                            "type": "object",
                                            "properties": {
                                                "type":      { "type": "string", "description": "blocks, blocked_by, related, or duplicate." },
                                                "issue_key": { "type": "string" }
                                            },
                                            "required": ["type", "issue_key"],
                                            "additionalProperties": false
                                        },
                                        {
                                            "type": "object",
                                            "properties": {
                                                "remove": { "type": "string", "description": "Issue key to remove any relation to." }
                                            },
                                            "required": ["remove"],
                                            "additionalProperties": false
                                        }
                                    ]
                                }
                            }
                        },
                        "additionalProperties": false,
                        "minProperties": 1
                    }
                },
                "required": ["key", "patch"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "delete_issue",
            description: "Delete an issue by key. This is irreversible.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "Issue key, e.g. \"STR-11\"." }
                },
                "required": ["key"],
                "additionalProperties": false
            }),
        },
        Tool {
            name: "search_issues",
            description: "Filter issues by project, status, label, or assignee. Returns issue summaries (no description). Does not match issue keys — use get_issue when the key is known.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Full-text search across title only." },
                    "filter": {
                        "type": "object",
                        "properties": {
                            "project_slug":  { "type": "string" },
                            "status":        { "type": "array", "items": { "type": "string", "description": "backlog, todo, in_progress, done, or cancelled." } },
                            "assignee":      { "type": "string", "description": "Username or \"me\"." },
                            "labels":        { "type": "array", "items": { "type": "string" }, "description": "Label names; issues must have ALL listed labels." },
                            "priority":      { "type": "array", "items": { "type": "string", "description": "no_priority, urgent, high, medium, or low." } },
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
    ]
}

// ---- Status and priority conversion ----

/// Map a DB state group_name to the MCP status string exposed to agents.
pub(crate) fn state_group_to_mcp_status(group: &str) -> &'static str {
    match group {
        "backlog" => "backlog",
        "unstarted" => "todo",
        "started" => "in_progress",
        "completed" => "done",
        "cancelled" => "cancelled",
        _ => "backlog",
    }
}

/// Map an MCP status string to the DB state group_name.
pub(crate) fn mcp_status_to_state_group(status: &str) -> Option<&'static str> {
    match status {
        "backlog" => Some("backlog"),
        "todo" => Some("unstarted"),
        "in_progress" => Some("started"),
        "done" => Some("completed"),
        "cancelled" => Some("cancelled"),
        _ => None,
    }
}

/// Map a priority integer (0–4) to an MCP priority string.
pub(crate) fn priority_to_str(p: i32) -> &'static str {
    match p {
        1 => "urgent",
        2 => "high",
        3 => "medium",
        4 => "low",
        _ => "no_priority",
    }
}

/// Map an MCP priority string to a priority integer (0–4).
pub(crate) fn str_to_priority(s: &str) -> Option<i32> {
    match s {
        "no_priority" => Some(0),
        "urgent" => Some(1),
        "high" => Some(2),
        "medium" => Some(3),
        "low" => Some(4),
        _ => None,
    }
}

// ---- Issue key parsing ----

fn normalize_issue_key(value: &str) -> Option<String> {
    let (prefix, number) = value.rsplit_once('-')?;
    if prefix.is_empty() || number.is_empty() {
        return None;
    }

    let mut prefix_chars = prefix.chars();
    let first = prefix_chars.next()?;
    if !first.is_ascii_alphabetic() {
        return None;
    }
    if !prefix_chars.all(|ch| ch.is_ascii_alphanumeric()) {
        return None;
    }
    if !number.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }

    Some(format!("{}-{}", prefix.to_ascii_uppercase(), number))
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
    value: Option<String>,
    field: &str,
) -> Result<IssueIdentifier, JsonRpcError> {
    let value =
        value.ok_or_else(|| JsonRpcError::new(INVALID_PARAMS, format!("provide {field}")))?;
    parse_issue_identifier_value(&value, field)
}

pub(crate) fn parse_issue_identifier_value(
    value: &str,
    field: &str,
) -> Result<IssueIdentifier, JsonRpcError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(JsonRpcError::new(
            INVALID_PARAMS,
            format!("{field} must not be empty"),
        ));
    }

    if let Ok(id) = value.parse::<i64>() {
        return Ok(IssueIdentifier::Id(id));
    }

    if let Some(key) = normalize_issue_key(value) {
        return Ok(IssueIdentifier::Key(key));
    }

    Err(JsonRpcError::new(
        INVALID_PARAMS,
        format!("invalid {field}: {value}"),
    ))
}

pub(crate) fn parse_snowflake_id(value: &str, field: &str) -> Result<i64, JsonRpcError> {
    value
        .parse::<i64>()
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, format!("invalid {field}: {value}")))
}

// ---- Shared error helpers ----

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

/// Legacy: maps DB state group to internal DB status column value (not the MCP surface).
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
    fn lists_seven_dispatch_tools() {
        let tools = all();
        assert_eq!(tools.len(), 7);
        assert_eq!(tools[0].name, "list_projects");
        assert_eq!(tools[1].name, "get_project");
        assert_eq!(tools[2].name, "get_issue");
        assert_eq!(tools[3].name, "create_issue");
        assert_eq!(tools[4].name, "update_issue");
        assert_eq!(tools[5].name, "delete_issue");
        assert_eq!(tools[6].name, "search_issues");
    }

    #[test]
    fn accepts_issue_identifier_id_or_key() {
        assert_eq!(
            parse_issue_identifier(Some("123".to_owned()), "identifier").unwrap(),
            IssueIdentifier::Id(123)
        );
        assert_eq!(
            parse_issue_identifier(Some("dis-1".to_owned()), "identifier").unwrap(),
            IssueIdentifier::Key("DIS-1".to_owned())
        );
        assert_eq!(
            parse_issue_identifier(None, "identifier")
                .unwrap_err()
                .message,
            "provide identifier"
        );
        assert_eq!(
            parse_issue_identifier(Some("not-an-issue".to_owned()), "identifier")
                .unwrap_err()
                .message,
            "invalid identifier: not-an-issue"
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
    fn status_conversion_round_trips() {
        for (status, group) in &[
            ("backlog", "backlog"),
            ("todo", "unstarted"),
            ("in_progress", "started"),
            ("done", "completed"),
            ("cancelled", "cancelled"),
        ] {
            assert_eq!(mcp_status_to_state_group(status), Some(*group));
            assert_eq!(state_group_to_mcp_status(group), *status);
        }
    }

    #[test]
    fn priority_conversion_round_trips() {
        for (s, i) in &[
            ("no_priority", 0),
            ("urgent", 1),
            ("high", 2),
            ("medium", 3),
            ("low", 4),
        ] {
            assert_eq!(str_to_priority(s), Some(*i));
            assert_eq!(priority_to_str(*i), *s);
        }
    }
}
