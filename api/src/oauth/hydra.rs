use reqwest::StatusCode;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::state::AppState;

const CONSENT_REMEMBER_FOR_SECONDS: i64 = 2_592_000;

#[derive(Debug)]
pub enum HydraError {
    Request(reqwest::Error),
    BadStatus(StatusCode),
}

impl HydraError {
    pub fn as_gateway_status(&self) -> axum::http::StatusCode {
        match self {
            Self::BadStatus(StatusCode::BAD_REQUEST) => axum::http::StatusCode::BAD_REQUEST,
            Self::Request(error) => {
                tracing::debug!(error = %error, "hydra admin request failed");
                axum::http::StatusCode::BAD_GATEWAY
            }
            Self::BadStatus(status) => {
                tracing::debug!(status = %status, "hydra admin returned non-success status");
                axum::http::StatusCode::BAD_GATEWAY
            }
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    #[serde(default)]
    pub skip: bool,
    pub subject: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConsentRequest {
    #[serde(default)]
    pub skip: bool,
    pub subject: Option<String>,
    #[serde(default)]
    pub requested_scope: Vec<String>,
    pub client: HydraClient,
}

#[derive(Debug, Deserialize)]
pub struct HydraClient {
    pub client_id: String,
    pub client_name: Option<String>,
}

impl HydraClient {
    pub fn display_name(&self) -> &str {
        self.client_name
            .as_deref()
            .filter(|name| !name.is_empty())
            .unwrap_or(&self.client_id)
    }
}

#[derive(Debug, Deserialize)]
pub struct RedirectResponse {
    pub redirect_to: String,
}

#[derive(Debug, Deserialize)]
pub struct IntrospectionResult {
    pub active: bool,
    pub sub: Option<String>,
    #[serde(default)]
    pub scope: String,
    pub exp: Option<i64>,
}

#[derive(Serialize)]
struct AcceptLogin<'a> {
    subject: &'a str,
}

#[derive(Serialize)]
struct AcceptConsent<'a> {
    grant_scope: &'a [String],
    remember: bool,
    remember_for: i64,
}

#[derive(Serialize)]
struct RejectConsent<'a> {
    error: &'a str,
    error_description: &'a str,
}

pub async fn get_login_request(
    state: &AppState,
    challenge: &str,
) -> Result<LoginRequest, HydraError> {
    let url = admin_url(state, "/admin/oauth2/auth/requests/login");
    let resp = state
        .hydra_admin
        .get(url)
        .query(&[("login_challenge", challenge)])
        .send()
        .await
        .map_err(HydraError::Request)?;

    parse_json_response(resp).await
}

pub async fn accept_login(
    state: &AppState,
    challenge: &str,
    subject: &str,
) -> Result<RedirectResponse, HydraError> {
    let url = admin_url(state, "/admin/oauth2/auth/requests/login/accept");
    let resp = state
        .hydra_admin
        .put(url)
        .query(&[("login_challenge", challenge)])
        .json(&AcceptLogin { subject })
        .send()
        .await
        .map_err(HydraError::Request)?;

    parse_json_response(resp).await
}

pub async fn get_consent_request(
    state: &AppState,
    challenge: &str,
) -> Result<ConsentRequest, HydraError> {
    let url = admin_url(state, "/admin/oauth2/auth/requests/consent");
    let resp = state
        .hydra_admin
        .get(url)
        .query(&[("consent_challenge", challenge)])
        .send()
        .await
        .map_err(HydraError::Request)?;

    parse_json_response(resp).await
}

pub async fn accept_consent(
    state: &AppState,
    challenge: &str,
    scopes: &[String],
) -> Result<RedirectResponse, HydraError> {
    let url = admin_url(state, "/admin/oauth2/auth/requests/consent/accept");
    let resp = state
        .hydra_admin
        .put(url)
        .query(&[("consent_challenge", challenge)])
        .json(&AcceptConsent {
            grant_scope: scopes,
            remember: true,
            remember_for: CONSENT_REMEMBER_FOR_SECONDS,
        })
        .send()
        .await
        .map_err(HydraError::Request)?;

    parse_json_response(resp).await
}

pub async fn reject_consent(
    state: &AppState,
    challenge: &str,
) -> Result<RedirectResponse, HydraError> {
    let url = admin_url(state, "/admin/oauth2/auth/requests/consent/reject");
    let resp = state
        .hydra_admin
        .put(url)
        .query(&[("consent_challenge", challenge)])
        .json(&RejectConsent {
            error: "access_denied",
            error_description: "The user denied the requested Dispatch access.",
        })
        .send()
        .await
        .map_err(HydraError::Request)?;

    parse_json_response(resp).await
}

pub async fn introspect(state: &AppState, token: &str) -> Result<IntrospectionResult, HydraError> {
    let url = admin_url(state, "/admin/oauth2/introspect");
    let resp = state
        .hydra_admin
        .post(url)
        .form(&[("token", token)])
        .send()
        .await
        .map_err(HydraError::Request)?;

    parse_json_response(resp).await
}

fn admin_url(state: &AppState, path: &str) -> String {
    format!(
        "{}{}",
        state.config.hydra_admin_url.trim_end_matches('/'),
        path
    )
}

async fn parse_json_response<T>(resp: reqwest::Response) -> Result<T, HydraError>
where
    T: DeserializeOwned,
{
    let status = resp.status();
    if !status.is_success() {
        return Err(HydraError::BadStatus(status));
    }

    resp.json::<T>().await.map_err(HydraError::Request)
}
