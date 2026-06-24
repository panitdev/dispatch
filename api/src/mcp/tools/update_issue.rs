use chrono::Utc;
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::{Issue, IssueChangeset, IssueLabelRef, IssueRelation, NewIssueHistoryEntry},
    schema::{
        issue_history, issue_label_refs, issue_relations, issues, label_aliases, labels, projects,
        states, users,
    },
    state::AppState,
};

use super::{
    body_markdown, invalid_field_error, invalid_reference_error, iso8601, map_db_error,
    mcp_status_to_state_group, not_found_error, parse_issue_identifier, priority_to_str,
    state_group_to_mcp_status, status_from_state_group, str_to_priority, IssueIdentifier,
};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};
use crate::models::{label::State, project::Project};

fn deserialize_optional_nullable<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Ok(Some(Option::<T>::deserialize(deserializer)?))
}

#[derive(Deserialize)]
#[serde(untagged)]
enum RelationPatch {
    Add {
        #[serde(rename = "type")]
        relation_type: String,
        issue_key: String,
    },
    Remove {
        remove: String,
    },
}

#[derive(Deserialize)]
struct UpdateIssueArgs {
    key: String,
    patch: UpdateIssuePatch,
}

#[derive(Deserialize, Default)]
struct UpdateIssuePatch {
    title: Option<String>,
    description: Option<Value>,
    status: Option<String>,
    priority: Option<String>,
    labels: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    assignee: Option<Option<String>>,
    project_slug: Option<String>,
    #[serde(default)]
    relations: Vec<RelationPatch>,
}

pub async fn call(
    identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: UpdateIssueArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid update_issue arguments"))?;

    let identifier = parse_issue_identifier(Some(args.key), "key")?;
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

    let current: Issue = match query.select(Issue::as_select()).first(&mut conn).await {
        Ok(i) => i,
        Err(diesel::result::Error::NotFound) => return not_found_error(&identifier_label),
        Err(e) => return Err(map_db_error(e, Some(&identifier_label))),
    };
    let issue_id = current.id;

    let mut changeset = IssueChangeset::default();
    let mut history_entries: Vec<(&'static str, Option<String>, Option<String>)> = vec![];
    let mut project_changed_to: Option<i64> = None;

    if let Some(title) = patch_title(&args.patch) {
        if title != current.title {
            history_entries.push(("title", Some(current.title.clone()), Some(title.clone())));
            changeset.title = Some(title);
        }
    }

    if let Some(desc_val) = args.patch.description {
        let new_blocks = match &desc_val {
            Value::Null => Value::Array(vec![]),
            Value::String(md) => {
                let id_gen = || state.next_id().to_string();
                match dispatch_issue_body_markdown::from_markdown_with_ids(md, id_gen) {
                    Ok(blks) => serde_json::to_value(blks).unwrap_or(Value::Array(vec![])),
                    Err(_) => Value::Array(vec![]),
                }
            }
            _ => {
                return Err(JsonRpcError::new(
                    INVALID_PARAMS,
                    "description must be a string or null",
                ))
            }
        };
        let old_md = body_markdown(current.blocks.clone()).ok();
        let new_md = body_markdown(new_blocks.clone()).ok();
        if old_md != new_md {
            history_entries.push(("description", old_md, new_md));
            changeset.blocks = Some(new_blocks);
        }
    }

    if let Some(status_str) = &args.patch.status {
        let group = match mcp_status_to_state_group(status_str) {
            Some(g) => g,
            None => {
                return invalid_field_error(
                    "status",
                    "status must be one of: backlog, todo, in_progress, done, cancelled",
                )
            }
        };

        // Find the project's team to look up states
        let team_id: i64 = projects::table
            .find(current.project_id)
            .select(projects::team_id)
            .first::<Option<i64>>(&mut conn)
            .await
            .ok()
            .flatten()
            .unwrap_or(1);

        let new_state: Option<State> = states::table
            .filter(states::team_id.eq(team_id))
            .filter(states::group_name.eq(group))
            .order_by(states::id.asc())
            .select(State::as_select())
            .first(&mut conn)
            .await
            .optional()
            .map_err(|e| map_db_error(e, None))?;

        if let Some(ns) = new_state {
            if Some(ns.id) != current.state_id {
                let old_status = current
                    .state_id
                    .and_then(|_| None::<String>)
                    .unwrap_or_else(|| "backlog".to_owned());
                history_entries.push((
                    "state_id",
                    Some(old_status),
                    Some(state_group_to_mcp_status(&ns.group_name).to_owned()),
                ));
                changeset.state_id = Some(ns.id);
                changeset.status = Some(status_from_state_group(&ns.group_name).to_owned());
            }
        }
    }

    if let Some(assignee_val) = &args.patch.assignee {
        let new_assignee: Option<i64> = match assignee_val {
            None => None,
            Some(username) => {
                let uid = if username == "me" {
                    Some(identity.user_id())
                } else {
                    users::table
                        .filter(users::username.eq(username))
                        .select(users::id)
                        .first::<i64>(&mut conn)
                        .await
                        .optional()
                        .map_err(|e| map_db_error(e, None))?
                };
                match uid {
                    Some(id) => Some(id),
                    None => {
                        return invalid_reference_error(
                            "assignee",
                            &format!("user not found: {username}"),
                            None,
                        )
                    }
                }
            }
        };
        if new_assignee != current.assignee_id {
            history_entries.push((
                "assignee_id",
                current.assignee_id.map(|id| id.to_string()),
                new_assignee.map(|id| id.to_string()),
            ));
            changeset.assignee_id = Some(new_assignee);
        }
    }

    if let Some(priority_str) = &args.patch.priority {
        let priority = match str_to_priority(priority_str) {
            Some(p) => p,
            None => {
                return invalid_field_error(
                    "priority",
                    "priority must be one of: no_priority, urgent, high, medium, low",
                )
            }
        };
        if priority != current.priority {
            history_entries.push((
                "priority",
                Some(priority_to_str(current.priority).to_owned()),
                Some(priority_to_str(priority).to_owned()),
            ));
            changeset.priority = Some(priority);
        }
    }

    if let Some(slug) = &args.patch.project_slug {
        let new_project: Option<Project> = projects::table
            .filter(projects::slug.eq(slug))
            .select(Project::as_select())
            .first(&mut conn)
            .await
            .optional()
            .map_err(|e| map_db_error(e, None))?;
        match new_project {
            None => {
                return invalid_reference_error(
                    "project_slug",
                    &format!("project not found: {slug}"),
                    None,
                )
            }
            Some(np) if np.id != current.project_id => {
                history_entries.push((
                    "project_id",
                    Some(current.project_id.to_string()),
                    Some(np.id.to_string()),
                ));
                changeset.project_id = Some(np.id);
                project_changed_to = Some(np.id);
            }
            _ => {}
        }
    }

    // Apply changeset
    let updated: Issue = if changeset.title.is_some()
        || changeset.blocks.is_some()
        || changeset.state_id.is_some()
        || changeset.status.is_some()
        || changeset.assignee_id.is_some()
        || changeset.priority.is_some()
        || changeset.project_id.is_some()
        || changeset.parent_id.is_some()
    {
        changeset.updated_at = Some(Utc::now());
        diesel::update(issues::table.find(issue_id))
            .set(&changeset)
            .get_result(&mut conn)
            .await
            .map_err(|e| map_db_error(e, Some(&identifier_label)))?
    } else {
        current.clone()
    };

    // Replace label set if provided
    if let Some(label_names) = &args.patch.labels {
        let target_project_id = updated.project_id;
        let lids = match resolve_label_ids(&mut conn, target_project_id, label_names).await {
            Ok(ids) => ids,
            Err(err) => return err,
        };

        diesel::delete(issue_label_refs::table.filter(issue_label_refs::issue_id.eq(issue_id)))
            .execute(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;

        if !lids.is_empty() {
            let refs: Vec<IssueLabelRef> = lids
                .iter()
                .map(|&lid| IssueLabelRef {
                    issue_id,
                    label_id: lid,
                })
                .collect();
            diesel::insert_into(issue_label_refs::table)
                .values(&refs)
                .on_conflict_do_nothing()
                .execute(&mut conn)
                .await
                .map_err(|e| map_db_error(e, None))?;
        }
    } else if project_changed_to.is_some() {
        // Clear labels when moving project
        diesel::delete(issue_label_refs::table.filter(issue_label_refs::issue_id.eq(issue_id)))
            .execute(&mut conn)
            .await
            .map_err(|e| map_db_error(e, None))?;
    }

    // Apply relations delta
    for rel_patch in &args.patch.relations {
        match rel_patch {
            RelationPatch::Add {
                relation_type,
                issue_key,
            } => {
                let valid_types = ["blocks", "blocked_by", "related", "duplicate"];
                if !valid_types.contains(&relation_type.as_str()) {
                    return invalid_field_error(
                        "relations",
                        &format!("invalid relation type: {relation_type}"),
                    );
                }

                let parsed = super::parse_issue_identifier_value(issue_key, "issue_key")?;
                let target_id: Option<i64> = match &parsed {
                    IssueIdentifier::Key(k) => issues::table
                        .filter(issues::key.eq(k))
                        .select(issues::id)
                        .first(&mut conn)
                        .await
                        .optional()
                        .map_err(|e| map_db_error(e, None))?,
                    IssueIdentifier::Id(id) => Some(*id),
                };
                let target_id = match target_id {
                    Some(id) => id,
                    None => {
                        return not_found_error(issue_key);
                    }
                };

                if target_id == issue_id {
                    return Err(JsonRpcError::new(
                        INVALID_PARAMS,
                        "issue cannot relate to itself",
                    ));
                }

                // Normalize blocked_by → canonical blocks direction
                let (canonical_from, canonical_to, stored_type) =
                    match relation_type.as_str() {
                        "blocked_by" => (target_id, issue_id, "blocks"),
                        other => (issue_id, target_id, other),
                    };

                // Skip if relation already exists
                let exists: i64 = issue_relations::table
                    .filter(issue_relations::issue_id.eq(canonical_from))
                    .filter(issue_relations::related_issue_id.eq(canonical_to))
                    .filter(issue_relations::relation_type.eq(stored_type))
                    .count()
                    .get_result(&mut conn)
                    .await
                    .unwrap_or(0);

                if exists == 0 {
                    diesel::insert_into(issue_relations::table)
                        .values(IssueRelation {
                            issue_id: canonical_from,
                            related_issue_id: canonical_to,
                            relation_type: stored_type.to_owned(),
                        })
                        .on_conflict_do_nothing()
                        .execute(&mut conn)
                        .await
                        .map_err(|e| map_db_error(e, None))?;
                }
            }
            RelationPatch::Remove { remove } => {
                let parsed = super::parse_issue_identifier_value(remove, "remove")?;
                let target_id: Option<i64> = match &parsed {
                    IssueIdentifier::Key(k) => issues::table
                        .filter(issues::key.eq(k))
                        .select(issues::id)
                        .first(&mut conn)
                        .await
                        .optional()
                        .map_err(|e| map_db_error(e, None))?,
                    IssueIdentifier::Id(id) => Some(*id),
                };
                if let Some(target_id) = target_id {
                    // Remove in both directions (cascade FK handles it, but delete explicitly)
                    diesel::delete(
                        issue_relations::table
                            .filter(issue_relations::issue_id.eq(issue_id))
                            .filter(issue_relations::related_issue_id.eq(target_id)),
                    )
                    .execute(&mut conn)
                    .await
                    .map_err(|e| map_db_error(e, None))?;

                    diesel::delete(
                        issue_relations::table
                            .filter(issue_relations::issue_id.eq(target_id))
                            .filter(issue_relations::related_issue_id.eq(issue_id)),
                    )
                    .execute(&mut conn)
                    .await
                    .map_err(|e| map_db_error(e, None))?;
                }
            }
        }
    }

    // Write history
    for (field, from_val, to_val) in history_entries {
        let entry = NewIssueHistoryEntry {
            id: state.next_id(),
            issue_id,
            actor_id: identity.user_id(),
            field: field.to_owned(),
            from_value: from_val,
            to_value: to_val,
        };
        let _ = diesel::insert_into(issue_history::table)
            .values(&entry)
            .execute(&mut conn)
            .await;
    }

    // Reload current label names
    let label_refs: Vec<IssueLabelRef> = issue_label_refs::table
        .filter(issue_label_refs::issue_id.eq(issue_id))
        .select(IssueLabelRef::as_select())
        .load(&mut conn)
        .await
        .unwrap_or_default();

    let label_ids_out: Vec<i64> = label_refs.iter().map(|r| r.label_id).collect();
    let label_names_out: Vec<String> = if label_ids_out.is_empty() {
        vec![]
    } else {
        let label_rows: Vec<crate::models::label::Label> = labels::table
            .filter(labels::id.eq_any(&label_ids_out))
            .select(crate::models::label::Label::as_select())
            .load(&mut conn)
            .await
            .unwrap_or_default();
        let mut names: Vec<String> = label_rows.into_iter().map(|l| l.name).collect();
        names.sort();
        names
    };

    // Reload project for slug/name
    let project: Project = projects::table
        .find(updated.project_id)
        .select(Project::as_select())
        .first(&mut conn)
        .await
        .map_err(|e| map_db_error(e, None))?;

    // Resolve status
    let status = if let Some(sid) = updated.state_id {
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

    // Resolve assignee
    let assignee: Option<String> = if let Some(aid) = updated.assignee_id {
        users::table
            .filter(users::id.eq(aid))
            .select(users::username)
            .first::<String>(&mut conn)
            .await
            .ok()
    } else {
        None
    };

    let description = body_markdown(updated.blocks.clone()).ok();

    json_text_result(json!({
        "key":         updated.key,
        "title":       updated.title,
        "description": description,
        "status":      status,
        "priority":    priority_to_str(updated.priority),
        "project":     { "slug": project.slug, "name": project.name },
        "labels":      label_names_out,
        "assignee":    assignee,
        "relations":   Value::Array(vec![]),
        "created_at":  iso8601(updated.created_at),
        "updated_at":  iso8601(updated.updated_at),
    }))
}

// ---- Helpers ----

fn patch_title(patch: &UpdateIssuePatch) -> Option<String> {
    patch.title.clone()
}

async fn resolve_label_ids(
    conn: &mut diesel_async::AsyncPgConnection,
    project_id: i64,
    names: &[String],
) -> Result<Vec<i64>, Result<Value, JsonRpcError>> {
    let mut ids = Vec::with_capacity(names.len());
    for name in names {
        let direct: Option<i64> = labels::table
            .filter(labels::project_id.eq(project_id))
            .filter(labels::name.eq(name))
            .select(labels::id)
            .first(conn)
            .await
            .optional()
            .map_err(|e| Err::<Value, _>(map_db_error(e, None)))?;

        if let Some(id) = direct {
            ids.push(id);
            continue;
        }

        let alias_target: Option<String> = label_aliases::table
            .filter(label_aliases::project_id.eq(project_id))
            .filter(label_aliases::old_name.eq(name))
            .select(label_aliases::current_name)
            .first(conn)
            .await
            .optional()
            .map_err(|e| Err::<Value, _>(map_db_error(e, None)))?;

        if let Some(current_name) = alias_target {
            let aliased_id: Option<i64> = labels::table
                .filter(labels::project_id.eq(project_id))
                .filter(labels::name.eq(&current_name))
                .select(labels::id)
                .first(conn)
                .await
                .optional()
                .map_err(|e| Err::<Value, _>(map_db_error(e, None)))?;

            if let Some(id) = aliased_id {
                ids.push(id);
                continue;
            }
        }

        return Err(invalid_field_error(
            "labels",
            &format!(
                "Label '{}' not found. Fetch project again to get current label names.",
                name
            ),
        ));
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn patch_parses_null_assignee() {
        let args: UpdateIssueArgs = serde_json::from_value(json!({
            "key": "STR-1",
            "patch": { "assignee": null }
        }))
        .unwrap();
        assert_eq!(args.patch.assignee, Some(None));
    }

    #[test]
    fn patch_absent_assignee_is_none() {
        let args: UpdateIssueArgs =
            serde_json::from_value(json!({ "key": "STR-1", "patch": { "title": "T" } })).unwrap();
        assert_eq!(args.patch.assignee, None);
    }

    #[test]
    fn patch_parses_relations_delta() {
        let args: UpdateIssueArgs = serde_json::from_value(json!({
            "key": "STR-1",
            "patch": {
                "relations": [
                    { "type": "blocks", "issue_key": "STR-9" },
                    { "remove": "STR-7" }
                ]
            }
        }))
        .unwrap();
        assert_eq!(args.patch.relations.len(), 2);
        match &args.patch.relations[0] {
            RelationPatch::Add { relation_type, issue_key } => {
                assert_eq!(relation_type, "blocks");
                assert_eq!(issue_key, "STR-9");
            }
            _ => panic!("expected Add"),
        }
        match &args.patch.relations[1] {
            RelationPatch::Remove { remove } => assert_eq!(remove, "STR-7"),
            _ => panic!("expected Remove"),
        }
    }
}
