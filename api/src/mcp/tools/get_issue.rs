use diesel::{ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::{
        issue::{Issue, IssueComment, IssueHistoryEntry, IssueLabelRef, IssueRelation},
        label::State,
        user::User,
    },
    schema::{
        issue_comments, issue_history, issue_label_refs, issue_relations, issues, states, users,
    },
    state::AppState,
};

use super::{
    body_markdown, iso8601, map_db_error, not_found_error, parse_issue_identifier, IssueIdentifier,
};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct GetIssueArgs {
    id: Option<String>,
    key: Option<String>,
    #[serde(default)]
    include: Vec<String>,
}

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: GetIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid get_issue arguments"))?;
    let GetIssueArgs { id, key, include } = args;
    let identifier = parse_issue_identifier(id, key)?;
    let identifier_label = identifier.label();

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    let mut query = issues::table.into_boxed();
    query = match identifier {
        IssueIdentifier::Id(id) => query.filter(issues::id.eq(id)),
        IssueIdentifier::Key(key) => query.filter(issues::key.eq(key)),
    };

    let issue: Issue = match query.select(Issue::as_select()).first(&mut conn).await {
        Ok(i) => i,
        Err(diesel::result::Error::NotFound) => return not_found_error(&identifier_label),
        Err(e) => return Err(map_db_error(e, Some(&identifier_label))),
    };
    let issue_id = issue.id;

    let description = body_markdown(issue.blocks.clone()).ok();

    let state_ref: Option<Value> = if let Some(sid) = issue.state_id {
        states::table
            .filter(states::id.eq(sid))
            .select(State::as_select())
            .first(&mut conn)
            .await
            .ok()
            .map(|s: State| {
                json!({
                    "id":    s.id.to_string(),
                    "name":  s.name,
                    "group": s.group_name,
                })
            })
    } else {
        None
    };

    let label_refs: Vec<IssueLabelRef> = issue_label_refs::table
        .filter(issue_label_refs::issue_id.eq(issue_id))
        .select(IssueLabelRef::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();
    let label_ids: Vec<String> = label_refs.iter().map(|r| r.label_id.to_string()).collect();

    let include_comments = include.iter().any(|s| s == "comments");
    let include_history = include.iter().any(|s| s == "history");
    let include_relations = include.iter().any(|s| s == "relations");

    let comments_val: Option<Value> = if include_comments {
        let comments: Vec<IssueComment> = issue_comments::table
            .filter(issue_comments::issue_id.eq(issue_id))
            .order_by(issue_comments::created_at.asc())
            .select(IssueComment::as_select())
            .load(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;

        let author_ids: Vec<i64> = comments.iter().map(|c| c.author_id).collect();
        let authors: Vec<User> = if author_ids.is_empty() {
            vec![]
        } else {
            users::table
                .filter(users::id.eq_any(&author_ids))
                .select(User::as_select())
                .load(&mut conn)
                .await
                .unwrap_or_default()
        };
        let author_map: std::collections::HashMap<i64, &User> =
            authors.iter().map(|u| (u.id, u)).collect();

        Some(Value::Array(
            comments
                .iter()
                .map(|c| {
                    let author = author_map.get(&c.author_id);
                    json!({
                        "id":         c.id.to_string(),
                        "author":     { "id": c.author_id.to_string(), "name": author.map(|u| u.username.as_str()).unwrap_or("") },
                        "body":       c.body,
                        "created_at": iso8601(c.created_at),
                        "updated_at": iso8601(c.updated_at),
                    })
                })
                .collect(),
        ))
    } else {
        None
    };

    let history_val: Option<Value> = if include_history {
        let entries: Vec<IssueHistoryEntry> = issue_history::table
            .filter(issue_history::issue_id.eq(issue_id))
            .order_by(issue_history::created_at.asc())
            .select(IssueHistoryEntry::as_select())
            .load(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;

        let actor_ids: Vec<i64> = entries.iter().map(|e| e.actor_id).collect();
        let actors: Vec<User> = if actor_ids.is_empty() {
            vec![]
        } else {
            users::table
                .filter(users::id.eq_any(&actor_ids))
                .select(User::as_select())
                .load(&mut conn)
                .await
                .unwrap_or_default()
        };
        let actor_map: std::collections::HashMap<i64, &User> =
            actors.iter().map(|u| (u.id, u)).collect();

        Some(Value::Array(
            entries
                .iter()
                .map(|e| {
                    let actor = actor_map.get(&e.actor_id);
                    json!({
                        "id":         e.id.to_string(),
                        "actor":      { "id": e.actor_id.to_string(), "name": actor.map(|u| u.username.as_str()).unwrap_or("") },
                        "field":      e.field,
                        "from":       e.from_value,
                        "to":         e.to_value,
                        "created_at": iso8601(e.created_at),
                    })
                })
                .collect(),
        ))
    } else {
        None
    };

    let relations_val: Option<Value> = if include_relations {
        // Return all relations where this issue is from_id OR to_id
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

        let mut rels: Vec<Value> = vec![];
        // For source relations: from_id = issue, to_id = related
        for r in &as_source {
            rels.push(json!({
                "id":      format!("{}-{}-{}", r.issue_id, r.related_issue_id, r.relation_type),
                "from_id": r.issue_id.to_string(),
                "to_id":   r.related_issue_id.to_string(),
                "type":    r.relation_type,
            }));
        }
        // For target relations (this issue is the target): expose the raw edge
        for r in &as_target {
            rels.push(json!({
                "id":      format!("{}-{}-{}", r.issue_id, r.related_issue_id, r.relation_type),
                "from_id": r.issue_id.to_string(),
                "to_id":   r.related_issue_id.to_string(),
                "type":    r.relation_type,
            }));
        }
        Some(Value::Array(rels))
    } else {
        None
    };

    let mut result = json!({
        "id":          issue.id.to_string(),
        "key":         issue.key,
        "title":       issue.title,
        "description": description,
        "state":       state_ref,
        "priority":    issue.priority,
        "assignee":    issue.assignee_id.map(|id| json!({ "id": id.to_string() })),
        "project":     { "id": issue.project_id.to_string() },
        "parent_id":   issue.parent_id.map(|id| id.to_string()),
        "label_ids":   label_ids,
        "created_at":  iso8601(issue.created_at),
        "updated_at":  iso8601(issue.updated_at),
    });

    if let Some(comments) = comments_val {
        result["comments"] = comments;
    }
    if let Some(history) = history_val {
        result["history"] = history;
    }
    if let Some(relations) = relations_val {
        result["relations"] = relations;
    }

    json_text_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn get_issue_args_accepts_id_or_key() {
        let args: GetIssueArgs = serde_json::from_value(json!({ "id": "123" })).unwrap();
        assert_eq!(args.id.as_deref(), Some("123"));

        let args: GetIssueArgs = serde_json::from_value(json!({ "key": "DIS-1" })).unwrap();
        assert_eq!(args.key.as_deref(), Some("DIS-1"));
    }

    #[test]
    fn get_issue_args_include_defaults_to_empty() {
        let args: GetIssueArgs = serde_json::from_value(json!({ "id": "123" })).unwrap();
        assert!(args.include.is_empty());
    }

    #[test]
    fn get_issue_args_parses_include() {
        let args: GetIssueArgs = serde_json::from_value(json!({
            "id": "123",
            "include": ["comments", "history"]
        }))
        .unwrap();
        assert_eq!(args.include, vec!["comments", "history"]);
    }
}
