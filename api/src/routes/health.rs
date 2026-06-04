use axum::Json;
use serde_json::{json, Value};

pub async fn get_health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "commit_hash": env!("GIT_COMMIT_HASH"),
    }))
}
