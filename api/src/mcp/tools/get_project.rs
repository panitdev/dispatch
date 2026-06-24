use diesel::{ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::{label::Label, project::Project},
    schema::{labels, projects},
    state::AppState,
};

use super::not_found_error;
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct GetProjectArgs {
    slug: String,
}

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: GetProjectArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid get_project arguments"))?;

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let project: Project = match projects::table
        .filter(projects::slug.eq(&args.slug))
        .select(Project::as_select())
        .first(&mut conn)
        .await
    {
        Ok(p) => p,
        Err(diesel::result::Error::NotFound) => return not_found_error(&args.slug),
        Err(_) => return Err(JsonRpcError::new(INTERNAL_ERROR, "database error")),
    };

    let label_rows: Vec<Label> = labels::table
        .filter(labels::project_id.eq(project.id))
        .order_by(labels::name.asc())
        .select(Label::as_select())
        .load(&mut conn)
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database error"))?;

    let label_names: Vec<&str> = label_rows.iter().map(|l| l.name.as_str()).collect();

    json_text_result(json!({
        "slug":   project.slug,
        "name":   project.name,
        "labels": label_names,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_project_args_requires_slug() {
        assert!(serde_json::from_value::<GetProjectArgs>(serde_json::json!({})).is_err());
        let args: GetProjectArgs =
            serde_json::from_value(serde_json::json!({ "slug": "strophe" })).unwrap();
        assert_eq!(args.slug, "strophe");
    }
}
