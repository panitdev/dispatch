use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};
use chrono::Utc;
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl};
use diesel_async::RunQueryDsl;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    oauth::hydra,
    schema::{dispatch_api_keys, users},
    state::AppState,
};

use super::protocol::McpError;

#[derive(Debug, Clone)]
pub enum McpIdentity {
    ApiKey {
        user_id: i64,
        agent_id: Option<String>,
    },
    OAuth {
        user_id: i64,
        subject: String,
        scopes: Vec<String>,
    },
}

impl McpIdentity {
    pub fn user_id(&self) -> i64 {
        match self {
            Self::ApiKey { user_id, .. } | Self::OAuth { user_id, .. } => *user_id,
        }
    }

    pub fn has_scope(&self, scope: &str) -> bool {
        match self {
            Self::ApiKey { .. } => true,
            Self::OAuth { scopes, .. } => scopes.iter().any(|s| s == scope),
        }
    }
}

impl<S> FromRequestParts<S> for McpIdentity
where
    S: Send + Sync,
    AppState: axum::extract::FromRef<S>,
{
    type Rejection = McpError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let raw = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "))
            .ok_or(McpError::Unauthorized)?;

        let state = AppState::from_ref(state);
        if raw.starts_with("dsp_") {
            return verify_api_key(&state, raw).await;
        }

        verify_hydra_token(&state, raw).await
    }
}

async fn verify_api_key(state: &AppState, raw_key: &str) -> Result<McpIdentity, McpError> {
    if !is_valid_api_key(raw_key) {
        return Err(McpError::Unauthorized);
    }

    let hash = Sha256::digest(raw_key.as_bytes()).to_vec();
    let mut conn = state.db.get().await.map_err(|_| McpError::Internal)?;

    let row = dispatch_api_keys::table
        .filter(dispatch_api_keys::key_hash.eq(hash.clone()))
        .filter(dispatch_api_keys::revoked_at.is_null())
        .select((dispatch_api_keys::user_id, dispatch_api_keys::agent_id))
        .first::<(i64, Option<String>)>(&mut conn)
        .await
        .optional()
        .map_err(|_| McpError::Internal)?
        .ok_or(McpError::Unauthorized)?;

    drop(conn);

    let update_pool = state.db.clone();
    tokio::spawn(async move {
        if let Ok(mut conn) = update_pool.get().await {
            let _ = diesel::update(
                dispatch_api_keys::table
                    .filter(dispatch_api_keys::key_hash.eq(hash))
                    .filter(dispatch_api_keys::revoked_at.is_null()),
            )
            .set(dispatch_api_keys::last_used_at.eq(Utc::now()))
            .execute(&mut conn)
            .await;
        }
    });

    Ok(McpIdentity::ApiKey {
        user_id: row.0,
        agent_id: row.1,
    })
}

async fn verify_hydra_token(state: &AppState, token: &str) -> Result<McpIdentity, McpError> {
    let introspection = hydra::introspect(state, token).await.map_err(|err| {
        tracing::debug!(?err, "hydra token introspection failed");
        McpError::Internal
    })?;
    if !introspection.active {
        tracing::info!("mcp oauth rejected: inactive token");
        return Err(McpError::Unauthorized);
    }

    let subject = introspection.sub.ok_or_else(|| {
        tracing::info!("mcp oauth rejected: missing subject");
        McpError::Unauthorized
    })?;
    let kratos_id = Uuid::parse_str(&subject).map_err(|_| {
        tracing::info!(subject = %subject, "mcp oauth rejected: subject is not a uuid");
        McpError::Unauthorized
    })?;
    let _expires_at = introspection.exp;
    let scopes = introspection
        .scope
        .split_whitespace()
        .map(str::to_owned)
        .collect::<Vec<_>>();

    let mut conn = state.db.get().await.map_err(|_| McpError::Internal)?;
    let user_id = users::table
        .filter(users::kratos_id.eq(kratos_id))
        .select(users::id)
        .first::<i64>(&mut conn)
        .await
        .optional()
        .map_err(|_| McpError::Internal)?
        .ok_or_else(|| {
            tracing::info!(
                kratos_id = %kratos_id,
                scopes = ?scopes,
                "mcp oauth rejected: no local dispatch user for token subject"
            );
            McpError::Unauthorized
        })?;

    Ok(McpIdentity::OAuth {
        user_id,
        subject,
        scopes,
    })
}

fn is_valid_api_key(raw_key: &str) -> bool {
    let Some(secret) = raw_key.strip_prefix("dsp_") else {
        return false;
    };

    secret.len() == 32
        && secret
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

#[cfg(test)]
mod tests {
    use super::is_valid_api_key;

    #[test]
    fn accepts_dispatch_api_key_shape() {
        assert!(is_valid_api_key("dsp_0123456789abcdefghijklmnopqrstuv"));
        assert!(is_valid_api_key("dsp_0123456789abcdefABCDEF-_xyz12345"));
    }

    #[test]
    fn rejects_non_dispatch_key_shapes() {
        assert!(!is_valid_api_key("not-a-dispatch-key"));
        assert!(!is_valid_api_key("dsp_short"));
        assert!(!is_valid_api_key("dsp_0123456789abcdefghijklmnopqrstu/"));
    }
}
