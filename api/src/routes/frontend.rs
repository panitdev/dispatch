use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue},
    response::IntoResponse,
};
use serde::Serialize;

use crate::config::Config;

#[derive(Serialize)]
struct BrowserEnv<'a> {
    #[serde(rename = "apiBaseUrl", skip_serializing_if = "Option::is_none")]
    api_base_url: Option<&'a str>,
    #[serde(rename = "kratosPublicUrl")]
    kratos_public_url: &'a str,
}

pub async fn env_js(State(config): State<Config>) -> impl IntoResponse {
    let env = BrowserEnv {
        api_base_url: config.dispatch_api_url.as_deref(),
        kratos_public_url: &config.kratos_public_url,
    };
    let json = serde_json::to_string(&env).expect("browser env config must serialize");
    let body = format!("window.__ENV__ = Object.assign(window.__ENV__ || {{}}, {json});\n");

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/javascript; charset=utf-8"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, no-cache, must-revalidate"),
    );

    (headers, body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_config(dispatch_api_url: Option<String>) -> Config {
        Config {
            database_url: "postgres://dispatch:dispatch@localhost/dispatch".into(),
            kratos_public_url: "https://kratos.example.test".into(),
            kratos_browser_url: "https://kratos.example.test".into(),
            dispatch_public_url: "https://dispatch.example.test".into(),
            hydra_public_url: "https://hydra.example.test".into(),
            hydra_admin_url: "https://hydra-admin.example.test".into(),
            dispatch_api_url,
            api_port: 8080,
            frontend_dist_dir: PathBuf::from("ui/dist"),
            frontend_origin: "https://dispatch.example.test".into(),
            cors_allowed_origins: vec!["https://dispatch.example.test".into()],
            snowflake_machine_id: 1,
            snowflake_node_id: 1,
        }
    }

    #[tokio::test]
    async fn env_js_omits_api_base_without_runtime_override() {
        let response = env_js(State(test_config(None))).await.into_response();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body = String::from_utf8(body.to_vec()).unwrap();

        assert!(!body.contains("apiBaseUrl"));
        assert!(body.contains("\"kratosPublicUrl\":\"https://kratos.example.test\""));
    }

    #[tokio::test]
    async fn env_js_includes_api_base_runtime_override() {
        let response = env_js(State(test_config(Some("https://api.example.test".into()))))
            .await
            .into_response();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body = String::from_utf8(body.to_vec()).unwrap();

        assert!(body.contains("\"apiBaseUrl\":\"https://api.example.test\""));
    }
}
