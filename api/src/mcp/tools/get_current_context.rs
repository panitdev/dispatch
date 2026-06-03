use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde_json::{json, Value};

use crate::{
    models::{label::Team, project::Project, user::User},
    schema::{projects, teams, users},
    state::AppState,
};

use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR},
};

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    _args: Value,
) -> Result<Value, JsonRpcError> {
    let user_id = identity.user_id();
    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let user: User = users::table
        .filter(users::id.eq(user_id))
        .select(User::as_select())
        .first(&mut conn)
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "user not found"))?;

    let all_teams: Vec<Team> = teams::table
        .select(Team::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();

    // Default project: the first project assigned to the first team
    let default_project: Option<Project> = projects::table
        .filter(projects::team_id.is_not_null())
        .order_by(projects::created_at.asc())
        .select(Project::as_select())
        .first(&mut conn)
        .await
        .optional()
        .unwrap_or(None);

    json_text_result(json!({
        "user": {
            "id":    user.id.to_string(),
            "name":  user.username,
            "email": user.email.as_deref().unwrap_or(&format!("{}@dispatch.local", user.username)),
        },
        "teams": all_teams.iter().map(|t| json!({
            "id":   t.id.to_string(),
            "name": t.name,
        })).collect::<Vec<_>>(),
        "default_project": default_project.map(|p| json!({
            "id":   p.id.to_string(),
            "name": p.name,
        })),
    }))
}
