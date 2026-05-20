use axum::{
    routing::{delete, get, patch, post},
    Router,
};

use crate::state::AppState;

pub mod health;
pub mod issues;
pub mod me;
pub mod projects;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::get_health))
        .route("/api/v1/me", get(me::get_me))
        .route("/api/v1/projects", get(projects::list_projects))
        .route("/api/v1/projects", post(projects::create_project))
        .route("/api/v1/projects/{id}", get(projects::get_project))
        .route("/api/v1/projects/{id}", patch(projects::update_project))
        .route("/api/v1/projects/{id}", delete(projects::delete_project))
        .route("/api/v1/projects/{id}/issues", get(issues::list_project_issues))
        .route("/api/v1/issues", post(issues::create_issue))
        .route("/api/v1/issues/{id}", get(issues::get_issue))
        .route("/api/v1/issues/{id}", patch(issues::update_issue))
        .route("/api/v1/issues/{id}", delete(issues::delete_issue))
}
