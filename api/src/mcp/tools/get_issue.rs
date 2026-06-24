use diesel::{ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::{
        issue::{Issue, IssueLabelRef, IssueRelation},
        label::{Label, State},
        project::Project,
    },
    schema::{issue_label_refs, issue_relations, issues, labels, projects, states, users},
    state::AppState,
};

use super::{
    body_markdown, iso8601, map_db_error, not_found_error, parse_issue_identifier,
    priority_to_str, state_group_to_mcp_status, IssueIdentifier,
};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct GetIssueArgs {
    key: Option<String>,
}

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: GetIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid get_issue arguments"))?;

    let identifier = parse_issue_identifier(args.key, "key")?;
    let identifier_label = identifier.label();

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let mut query = issues::table.into_boxed();
    query = match &identifier {
        IssueIdentifier::Id(id) => query.filter(issues::id.eq(*id)),
        IssueIdentifier::Key(key) => query.filter(issues::key.eq(key.as_str())),
    };

    let issue: Issue = match query.select(Issue::as_select()).first(&mut conn).await {
        Ok(i) => i,
        Err(diesel::result::Error::NotFound) => return not_found_error(&identifier_label),
        Err(e) => return Err(map_db_error(e, Some(&identifier_label))),
    };
    let issue_id = issue.id;

    let description = body_markdown(issue.blocks.clone()).ok();

    // Resolve status from state
    let status = if let Some(sid) = issue.state_id {
        states::table
            .filter(states::id.eq(sid))
            .select(State::as_select())
            .first(&mut conn)
            .await
            .ok()
            .map(|s: State| state_group_to_mcp_status(&s.group_name).to_owned())
            .unwrap_or_else(|| "backlog".to_owned())
    } else {
        "backlog".to_owned()
    };

    // Resolve project slug and name
    let project: Project = projects::table
        .find(issue.project_id)
        .select(Project::as_select())
        .first(&mut conn)
        .await
        .map_err(|e| map_db_error(e, None))?;

    // Resolve label names
    let label_refs: Vec<IssueLabelRef> = issue_label_refs::table
        .filter(issue_label_refs::issue_id.eq(issue_id))
        .select(IssueLabelRef::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();

    let label_names: Vec<String> = if label_refs.is_empty() {
        vec![]
    } else {
        let label_id_list: Vec<i64> = label_refs.iter().map(|r| r.label_id).collect();
        let label_rows: Vec<Label> = labels::table
            .filter(labels::id.eq_any(&label_id_list))
            .select(Label::as_select())
            .load(&mut conn)
            .await
            .unwrap_or_default();
        let mut names: Vec<String> = label_rows.into_iter().map(|l| l.name).collect();
        names.sort();
        names
    };

    // Resolve assignee username
    let assignee: Option<String> = if let Some(aid) = issue.assignee_id {
        users::table
            .filter(users::id.eq(aid))
            .select(users::username)
            .first::<String>(&mut conn)
            .await
            .ok()
    } else {
        None
    };

    // Resolve relations with related issue keys and titles
    let as_source: Vec<IssueRelation> = issue_relations::table
        .filter(issue_relations::issue_id.eq(issue_id))
        .load(&mut conn)
        .await
        .unwrap_or_default();
    let as_target: Vec<IssueRelation> = issue_relations::table
        .filter(issue_relations::related_issue_id.eq(issue_id))
        .load(&mut conn)
        .await
        .unwrap_or_default();

    // Collect all related issue IDs to batch-fetch their keys/titles
    let mut related_ids: Vec<i64> = vec![];
    for r in &as_source {
        related_ids.push(r.related_issue_id);
    }
    for r in &as_target {
        related_ids.push(r.issue_id);
    }
    related_ids.dedup();

    let related_issues: Vec<(i64, String, String)> = if related_ids.is_empty() {
        vec![]
    } else {
        issues::table
            .filter(issues::id.eq_any(&related_ids))
            .select((issues::id, issues::key, issues::title))
            .load(&mut conn)
            .await
            .unwrap_or_default()
    };
    let related_map: std::collections::HashMap<i64, (&str, &str)> = related_issues
        .iter()
        .map(|(id, key, title)| (*id, (key.as_str(), title.as_str())))
        .collect();

    let mut relations: Vec<Value> = vec![];
    for r in &as_source {
        if let Some((key, title)) = related_map.get(&r.related_issue_id) {
            relations.push(json!({
                "type":      r.relation_type,
                "issue_key": key,
                "title":     title,
            }));
        }
    }
    for r in &as_target {
        if let Some((key, title)) = related_map.get(&r.issue_id) {
            // From this issue's perspective, the direction is reversed for "blocks"
            let rel_type = match r.relation_type.as_str() {
                "blocks" => "blocked_by",
                other => other,
            };
            relations.push(json!({
                "type":      rel_type,
                "issue_key": key,
                "title":     title,
            }));
        }
    }

    json_text_result(json!({
        "key":         issue.key,
        "title":       issue.title,
        "description": description,
        "status":      status,
        "priority":    priority_to_str(issue.priority),
        "project":     { "slug": project.slug, "name": project.name },
        "labels":      label_names,
        "assignee":    assignee,
        "relations":   relations,
        "created_at":  iso8601(issue.created_at),
        "updated_at":  iso8601(issue.updated_at),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn get_issue_args_requires_key() {
        let args: GetIssueArgs = serde_json::from_value(json!({ "key": "STR-11" })).unwrap();
        assert_eq!(args.key.as_deref(), Some("STR-11"));
    }

    #[test]
    fn get_issue_args_key_absent_is_none() {
        let args: GetIssueArgs = serde_json::from_value(json!({})).unwrap();
        assert!(args.key.is_none());
    }
}
