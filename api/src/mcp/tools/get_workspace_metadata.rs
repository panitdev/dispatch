use diesel::{QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::{label::{Label, State, Team}, project::Project, user::User},
    schema::{labels, projects, states, teams, users},
    state::AppState,
};

use super::iso8601;
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize, Default)]
struct GetWorkspaceMetadataArgs {
    #[serde(default)]
    scope: Vec<String>,
}

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: GetWorkspaceMetadataArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid get_workspace_metadata arguments"))?;

    let fetch_all = args.scope.is_empty();
    let fetch = |key: &str| fetch_all || args.scope.iter().any(|s| s == key);

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let mut result = json!({});

    if fetch("teams") {
        let rows: Vec<Team> = teams::table
            .select(Team::as_select())
            .load(&mut conn)
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;
        result["teams"] = Value::Array(
            rows.iter()
                .map(|t| json!({ "id": t.id.to_string(), "name": t.name }))
                .collect(),
        );
    }

    if fetch("states") {
        let rows: Vec<State> = states::table
            .select(State::as_select())
            .load(&mut conn)
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;
        result["states"] = Value::Array(
            rows.iter()
                .map(|s| json!({
                    "id":      s.id.to_string(),
                    "name":    s.name,
                    "group":   s.group_name,
                    "color":   s.color,
                    "team_id": s.team_id.to_string(),
                }))
                .collect(),
        );
    }

    if fetch("labels") {
        let rows: Vec<Label> = labels::table
            .select(Label::as_select())
            .load(&mut conn)
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;
        result["labels"] = Value::Array(
            rows.iter()
                .map(|l| json!({
                    "id":      l.id.to_string(),
                    "name":    l.name,
                    "color":   l.color,
                    "team_id": l.team_id.to_string(),
                }))
                .collect(),
        );
    }

    if fetch("projects") {
        let rows: Vec<Project> = projects::table
            .select(Project::as_select())
            .load(&mut conn)
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;
        result["projects"] = Value::Array(
            rows.iter()
                .map(|p| json!({
                    "id":      p.id.to_string(),
                    "name":    p.name,
                    "team_id": p.team_id.map(|id| id.to_string()),
                }))
                .collect(),
        );
    }

    if fetch("members") {
        let rows: Vec<User> = users::table
            .select(User::as_select())
            .load(&mut conn)
            .await
            .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;
        result["members"] = Value::Array(
            rows.iter()
                .map(|u| json!({
                    "id":    u.id.to_string(),
                    "name":  u.username,
                    "email": u.email.as_deref().unwrap_or(&format!("{}@dispatch.local", u.username)),
                }))
                .collect(),
        );
    }

    json_text_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_scope_means_fetch_all() {
        let args: GetWorkspaceMetadataArgs =
            serde_json::from_value(json!({})).unwrap();
        assert!(args.scope.is_empty());
    }

    #[test]
    fn partial_scope_parsed() {
        let args: GetWorkspaceMetadataArgs =
            serde_json::from_value(json!({ "scope": ["teams", "states"] })).unwrap();
        assert_eq!(args.scope, vec!["teams", "states"]);
    }
}
