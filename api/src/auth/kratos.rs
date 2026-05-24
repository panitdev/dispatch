use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use reqwest::Client;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    config::Config,
    error::AppError,
    models::user::{NewUser, User},
    state::AppState,
};

/// Verified Kratos session extracted from the incoming request.
#[derive(Debug, Clone)]
pub struct KratosIdentity {
    pub session_id: String,
    pub kratos_user_id: Uuid,
    pub username: String,
}

// ---- Internal Kratos JSON shapes ----

#[derive(Deserialize)]
struct WhoAmIResponse {
    id: String,
    identity: KratosIdentityPayload,
}

#[derive(Deserialize)]
struct KratosIdentityPayload {
    id: Uuid,
    traits: KratosTraits,
}

#[derive(Deserialize)]
struct KratosTraits {
    username: String,
}

// ---- Axum extractor ----

impl<S> FromRequestParts<S> for KratosIdentity
where
    S: Send + Sync,
    Config: FromRef<S>,
    Client: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let config = Config::from_ref(state);
        let http = Client::from_ref(state);

        let cookie_header = parts
            .headers
            .get(header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);

        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);

        let has_session_cookie = cookie_header
            .as_deref()
            .map(|c| c.contains("ory_kratos_session"))
            .unwrap_or(false);
        let has_bearer = auth_header
            .as_deref()
            .map(|a| a.starts_with("Bearer "))
            .unwrap_or(false);

        if !has_session_cookie && !has_bearer {
            return Err(AppError::Unauthorized(
                "missing session cookie or Bearer token".into(),
            ));
        }

        let whoami_url = format!("{}/sessions/whoami", config.kratos_public_url);
        let mut req = http.get(&whoami_url);

        if let Some(cookies) = &cookie_header {
            req = req.header(header::COOKIE, cookies);
        }
        if let Some(auth) = &auth_header {
            req = req.header(header::AUTHORIZATION, auth);
        }

        let resp = req.send().await.map_err(AppError::Http)?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED
            || resp.status() == reqwest::StatusCode::FORBIDDEN
        {
            return Err(AppError::Unauthorized("invalid or expired session".into()));
        }

        if !resp.status().is_success() {
            return Err(AppError::Unauthorized(
                "identity provider session verification failed".into(),
            ));
        }

        let payload: WhoAmIResponse = resp.json().await.map_err(|_| {
            AppError::Unauthorized("unexpected response from identity provider".into())
        })?;

        Ok(KratosIdentity {
            session_id: payload.id,
            kratos_user_id: payload.identity.id,
            username: payload.identity.traits.username,
        })
    }
}

// ---- Lazy provisioning ----

impl KratosIdentity {
    /// Returns the local `User` row, creating it on first login (lazy provisioning).
    pub async fn resolve_user(&self, state: &AppState) -> Result<User, AppError> {
        use crate::schema::users::{self, dsl::*};

        let mut conn = state.db.get().await?;

        let existing: Option<User> = users::table
            .filter(kratos_id.eq(self.kratos_user_id))
            .select(User::as_select())
            .first(&mut conn)
            .await
            .optional()?;

        if let Some(u) = existing {
            return Ok(u);
        }

        let new_user = NewUser {
            id: state.next_id(),
            kratos_id: self.kratos_user_id,
            username: self.username.clone(),
        };

        diesel::insert_into(users::table)
            .values(&new_user)
            .returning(User::as_returning())
            .get_result(&mut conn)
            .await
            .map_err(AppError::Db)
    }
}
