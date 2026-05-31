use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const PARSE_ERROR: i32 = -32700;
pub const INVALID_REQUEST: i32 = -32600;
pub const METHOD_NOT_FOUND: i32 = -32601;
pub const INVALID_PARAMS: i32 = -32602;
pub const INTERNAL_ERROR: i32 = -32603;

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: &'static str,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

impl JsonRpcError {
    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug)]
pub enum McpError {
    Unauthorized,
    Internal,
}

impl IntoResponse for McpError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            McpError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            McpError::Internal => (StatusCode::INTERNAL_SERVER_ERROR, "internal error"),
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

#[derive(Debug, Serialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: &'static str,
    pub capabilities: ServerCapabilities,
    #[serde(rename = "serverInfo")]
    pub server_info: ServerInfo,
}

#[derive(Debug, Serialize)]
pub struct ServerCapabilities {
    pub tools: Option<ToolsCapability>,
    pub resources: Option<ResourcesCapability>,
}

#[derive(Debug, Serialize)]
pub struct ToolsCapability {
    #[serde(rename = "listChanged")]
    pub list_changed: bool,
}

#[derive(Debug, Serialize)]
pub struct ResourcesCapability {
    pub subscribe: bool,
    #[serde(rename = "listChanged")]
    pub list_changed: bool,
}

#[derive(Debug, Serialize)]
pub struct ServerInfo {
    pub name: &'static str,
    pub version: &'static str,
}

#[derive(Debug, Serialize)]
pub struct Tool {
    pub name: &'static str,
    pub description: &'static str,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

#[derive(Debug, Serialize)]
pub struct TextContent {
    #[serde(rename = "type")]
    pub content_type: &'static str,
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct ToolResult {
    pub content: Vec<TextContent>,
}

pub fn json_text_result(value: Value) -> Result<Value, JsonRpcError> {
    let text = serde_json::to_string(&value)
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "failed to serialize tool result"))?;

    serde_json::to_value(ToolResult {
        content: vec![TextContent {
            content_type: "text",
            text,
        }],
    })
    .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "failed to serialize tool result"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wraps_tool_output_as_text_content() {
        let result = json_text_result(json!({ "id": "123", "title": "T" })).unwrap();
        let content = result["content"].as_array().unwrap();

        assert_eq!(content[0]["type"], "text");
        assert_eq!(
            serde_json::from_str::<Value>(content[0]["text"].as_str().unwrap()).unwrap(),
            json!({ "id": "123", "title": "T" })
        );
    }

    #[test]
    fn id_null_deserializes_as_notification() {
        let request: JsonRpcRequest = serde_json::from_value(json!({
            "jsonrpc": "2.0",
            "id": null,
            "method": "notifications/initialized"
        }))
        .unwrap();

        assert!(request.id.is_none());
        assert_eq!(request.method, "notifications/initialized");
    }
}
