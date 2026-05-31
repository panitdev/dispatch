use axum::{routing::get, Router};

use crate::mcp;
use crate::{oauth, state::AppState};

pub mod health;
pub mod issues;
pub mod me;
pub mod projects;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::get_health))
        .route(
            "/.well-known/oauth-authorization-server",
            get(oauth::handlers::oauth_metadata),
        )
        .route("/oauth/login", get(oauth::handlers::oauth_login))
        .route(
            "/oauth/consent",
            get(oauth::handlers::oauth_consent_show).post(oauth::handlers::oauth_consent_submit),
        )
        .route("/oauth/error", get(oauth::handlers::oauth_error))
        .nest("/mcp", mcp::router())
        .nest(
            "/api/v1",
            Router::new()
                .route("/me", get(me::get_me))
                .route("/now", get(issues::get_new_issues))
                .route(
                    "/projects",
                    get(projects::list_projects).post(projects::create_project),
                )
                .route(
                    "/projects/{id}",
                    get(projects::get_project)
                        .patch(projects::update_project)
                        .delete(projects::delete_project),
                )
                .route(
                    "/projects/{id}/issues",
                    get(issues::list_project_issues).post(issues::create_issue),
                )
                .route("/issues/{id}/body.md", get(issues::get_issue_body_markdown))
                .route(
                    "/issues/{id}",
                    get(issues::get_issue)
                        .patch(issues::update_issue)
                        .delete(issues::delete_issue),
                ),
        )
}
