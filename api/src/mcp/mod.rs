pub mod auth;
pub mod protocol;
pub mod resources;
pub mod tools;

use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::state::AppState;

use self::{
    auth::McpIdentity,
    protocol::{
        InitializeResult, JsonRpcError, JsonRpcRequest, JsonRpcResponse, ResourcesCapability,
        ServerCapabilities, ServerInfo, ToolsCapability, INVALID_PARAMS, INVALID_REQUEST,
        METHOD_NOT_FOUND, PARSE_ERROR,
    },
};

pub fn router() -> Router<AppState> {
    Router::new().route("/", post(handle_mcp))
}

async fn handle_mcp(
    identity: McpIdentity,
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let sse = accepts_sse(&headers);
    let body: JsonRpcRequest = match serde_json::from_slice(&body) {
        Ok(body) => body,
        Err(_) => {
            tracing::warn!("mcp request rejected: invalid json-rpc payload");
            return json_rpc_response(
                sse,
                JsonRpcResponse {
                    jsonrpc: "2.0",
                    id: None,
                    result: None,
                    error: Some(JsonRpcError::new(PARSE_ERROR, "parse error")),
                },
            );
        }
    };
    tracing::info!(
        method = %body.method,
        has_id = body.id.is_some(),
        sse,
        user_id = identity.user_id(),
        "handling mcp json-rpc request"
    );

    if body.id.is_none() {
        handle_notification(&body.method, &body.params).await;
        return StatusCode::NO_CONTENT.into_response();
    }

    let result = if body.jsonrpc != "2.0" {
        Err(JsonRpcError::new(
            INVALID_REQUEST,
            "jsonrpc must be \"2.0\"",
        ))
    } else {
        match body.method.as_str() {
            "initialize" => handle_initialize(),
            "tools/list" => handle_tools_list(),
            "tools/call" => handle_tools_call(&identity, &state, &body.params).await,
            "resources/list" => {
                if let Err(error) = require_scope(&identity, "dispatch:read") {
                    Err(error)
                } else {
                    resources::issue::list(&identity, &state).await
                }
            }
            "resources/read" => {
                if let Err(error) = require_scope(&identity, "dispatch:read") {
                    Err(error)
                } else {
                    resources::issue::read(&identity, &state, &body.params).await
                }
            }
            _ => Err(JsonRpcError::new(METHOD_NOT_FOUND, "method not found")),
        }
    };

    json_rpc_response(
        sse,
        JsonRpcResponse {
            jsonrpc: "2.0",
            id: body.id.clone(),
            result: result.as_ref().ok().cloned(),
            error: result.err(),
        },
    )
}

async fn handle_notification(_method: &str, _params: &Option<Value>) {}

pub(crate) fn handle_initialize() -> Result<Value, JsonRpcError> {
    serde_json::to_value(InitializeResult {
        protocol_version: "2025-03-26",
        capabilities: ServerCapabilities {
            tools: Some(ToolsCapability {
                list_changed: false,
            }),
            resources: Some(ResourcesCapability {
                subscribe: false,
                list_changed: false,
            }),
        },
        server_info: ServerInfo {
            name: "dispatch-mcp",
            version: env!("CARGO_PKG_VERSION"),
        },
    })
    .map_err(|_| JsonRpcError::new(protocol::INTERNAL_ERROR, "initialize failed"))
}

fn handle_tools_list() -> Result<Value, JsonRpcError> {
    Ok(json!({ "tools": tools::all() }))
}

#[derive(Deserialize)]
struct ToolCallParams {
    name: String,
    #[serde(default)]
    arguments: Value,
}

async fn handle_tools_call(
    identity: &McpIdentity,
    state: &AppState,
    params: &Option<Value>,
) -> Result<Value, JsonRpcError> {
    let params: ToolCallParams = serde_json::from_value(params.clone().unwrap_or(Value::Null))
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid tools/call params"))?;

    match params.name.as_str() {
        "list_projects" => {
            require_scope(identity, "dispatch:read")?;
            tools::list_projects::call(identity, state, params.arguments).await
        }
        "get_project" => {
            require_scope(identity, "dispatch:read")?;
            tools::get_project::call(identity, state, params.arguments).await
        }
        "get_issue" => {
            require_scope(identity, "dispatch:read")?;
            tools::get_issue::call(identity, state, params.arguments).await
        }
        "search_issues" => {
            require_scope(identity, "dispatch:read")?;
            tools::search_issues::call(identity, state, params.arguments).await
        }
        "create_issue" => {
            require_scope(identity, "dispatch:write")?;
            tools::create_issue::call(identity, state, params.arguments).await
        }
        "update_issue" => {
            require_scope(identity, "dispatch:write")?;
            tools::update_issue::call(identity, state, params.arguments).await
        }
        "delete_issue" => {
            require_scope(identity, "dispatch:write")?;
            tools::delete_issue::call(identity, state, params.arguments).await
        }
        _ => Err(JsonRpcError::new(INVALID_PARAMS, "unknown tool")),
    }
}

fn require_scope(identity: &McpIdentity, scope: &str) -> Result<(), JsonRpcError> {
    if identity.has_scope(scope) {
        Ok(())
    } else {
        Err(JsonRpcError::new(
            INVALID_REQUEST,
            format!("insufficient scope: {scope}"),
        ))
    }
}

fn accepts_sse(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|accept| {
            accept
                .split(',')
                .any(|part| part.trim().starts_with("text/event-stream"))
        })
        .unwrap_or(false)
}

fn json_rpc_response(sse: bool, response: JsonRpcResponse) -> Response {
    if !sse {
        return axum::Json(response).into_response();
    }

    match serde_json::to_string(&response) {
        Ok(json) => (
            [(header::CONTENT_TYPE, "text/event-stream; charset=utf-8")],
            format!("event: message\ndata: {json}\n\n"),
        )
            .into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn initialize_advertises_mcp_capabilities() {
        let value = handle_initialize().unwrap();

        assert_eq!(value["protocolVersion"], "2025-03-26");
        assert_eq!(value["serverInfo"]["name"], "dispatch-mcp");
        assert_eq!(value["capabilities"]["tools"]["listChanged"], false);
        assert_eq!(value["capabilities"]["resources"]["subscribe"], false);
        assert_eq!(value["capabilities"]["resources"]["listChanged"], false);
    }

    #[test]
    fn detects_sse_accept_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ACCEPT,
            HeaderValue::from_static("application/json, text/event-stream"),
        );

        assert!(accepts_sse(&headers));
    }

    #[test]
    fn api_key_identity_bypasses_scope_checks() {
        let identity = McpIdentity::ApiKey {
            user_id: 1,
            agent_id: None,
        };

        assert!(require_scope(&identity, "dispatch:write").is_ok());
    }

    #[test]
    fn oauth_identity_requires_matching_scope() {
        let identity = McpIdentity::OAuth {
            user_id: 1,
            subject: "00000000-0000-0000-0000-000000000000".to_owned(),
            scopes: vec!["dispatch:read".to_owned()],
        };

        assert!(require_scope(&identity, "dispatch:read").is_ok());
        let error = require_scope(&identity, "dispatch:write").unwrap_err();
        assert_eq!(error.code, INVALID_REQUEST);
        assert_eq!(error.message, "insufficient scope: dispatch:write");
    }
}
