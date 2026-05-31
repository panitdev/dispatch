use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};
use chrono::Utc;
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl};
use diesel_async::RunQueryDsl;
use sha2::{Digest, Sha256};

use crate::{db::DbPool, schema::dispatch_api_keys};

use super::protocol::McpError;

#[derive(Debug, Clone)]
pub struct ApiKeyIdentity {
    pub user_id: i64,
    pub agent_id: Option<String>,
    pub scopes: Vec<String>,
}

impl<S> FromRequestParts<S> for ApiKeyIdentity
where
    S: Send + Sync,
    DbPool: FromRef<S>,
{
    type Rejection = McpError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let raw_key = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "))
            .ok_or(McpError::Unauthorized)?;

        if !is_valid_api_key(raw_key) {
            return Err(McpError::Unauthorized);
        }

        let hash = Sha256::digest(raw_key.as_bytes()).to_vec();
        let pool = DbPool::from_ref(state);
        let mut conn = pool.get().await.map_err(|_| McpError::Internal)?;

        let row = dispatch_api_keys::table
            .filter(dispatch_api_keys::key_hash.eq(hash.clone()))
            .filter(dispatch_api_keys::revoked_at.is_null())
            .select((
                dispatch_api_keys::user_id,
                dispatch_api_keys::agent_id,
                dispatch_api_keys::scopes,
            ))
            .first::<(i64, Option<String>, Vec<String>)>(&mut conn)
            .await
            .optional()
            .map_err(|_| McpError::Internal)?
            .ok_or(McpError::Unauthorized)?;

        drop(conn);

        let update_pool = pool.clone();
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

        Ok(ApiKeyIdentity {
            user_id: row.0,
            agent_id: row.1,
            scopes: row.2,
        })
    }
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
