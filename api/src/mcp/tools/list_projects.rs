use diesel::{ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde_json::{json, Value};

use crate::{models::project::Project, schema::projects, state::AppState};

use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR},
};

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    _args: Value,
) -> Result<Value, JsonRpcError> {
    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let rows: Vec<Project> = projects::table
        .order_by(projects::name.asc())
        .select(Project::as_select())
        .load(&mut conn)
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;

    let items: Vec<Value> = rows
        .iter()
        .map(|p| json!({ "slug": p.slug, "name": p.name }))
        .collect();

    json_text_result(Value::Array(items))
}

#[cfg(test)]
mod tests {
    #[test]
    fn list_projects_compiles() {}
}
