use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::projects;

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = projects)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Project {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub color: String,
    pub parent_id: Option<i64>,
    pub issue_sequence: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub team_id: Option<i64>,
}

#[derive(Insertable)]
#[diesel(table_name = projects)]
pub struct NewProject {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub color: String,
    pub parent_id: Option<i64>,
}

#[derive(AsChangeset, Default)]
#[diesel(table_name = projects)]
pub struct ProjectChangeset {
    pub name: Option<String>,
    pub color: Option<String>,
    pub parent_id: Option<Option<i64>>,
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub key: String,
    pub name: String,
    #[serde(default = "default_color")]
    pub color: String,
    pub parent_id: Option<String>,
}

fn default_color() -> String {
    "#5b5bd6".into()
}

#[derive(Deserialize, Default)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub parent_id: Option<Option<String>>,
}

#[derive(Serialize, Clone)]
pub struct ProjectResponse {
    pub id: String,
    pub key: String,
    pub name: String,
    pub color: String,
    pub parent_id: Option<String>,
    pub sub_projects: Vec<ProjectResponse>,
    pub created_at: String,
    pub updated_at: String,
}

impl ProjectResponse {
    pub fn from_flat(p: Project) -> Self {
        Self {
            id: p.id.to_string(),
            key: p.key,
            name: p.name,
            color: p.color,
            parent_id: p.parent_id.map(|id| id.to_string()),
            sub_projects: vec![],
            created_at: p.created_at.to_rfc3339(),
            updated_at: p.updated_at.to_rfc3339(),
        }
    }
}

/// Build a nested project tree from a flat list.
pub fn build_project_tree(projects: Vec<Project>) -> Vec<ProjectResponse> {
    use std::collections::HashMap;

    let mut responses: HashMap<i64, ProjectResponse> = projects
        .iter()
        .map(|p| {
            (
                p.id,
                ProjectResponse {
                    id: p.id.to_string(),
                    key: p.key.clone(),
                    name: p.name.clone(),
                    color: p.color.clone(),
                    parent_id: p.parent_id.map(|id| id.to_string()),
                    sub_projects: vec![],
                    created_at: p.created_at.to_rfc3339(),
                    updated_at: p.updated_at.to_rfc3339(),
                },
            )
        })
        .collect();

    let ids: Vec<i64> = projects.iter().map(|p| p.id).collect();
    let parent_ids: Vec<Option<i64>> = projects.iter().map(|p| p.parent_id).collect();

    // Collect children into parents (process leaves first using stable order)
    let mut roots: Vec<i64> = vec![];
    for (i, &id) in ids.iter().enumerate() {
        if let Some(parent_id) = parent_ids[i] {
            let child = responses.remove(&id).unwrap();
            if let Some(parent) = responses.get_mut(&parent_id) {
                parent.sub_projects.push(child);
            }
            // if parent isn't in the map (shouldn't happen) the child is dropped
        } else {
            roots.push(id);
        }
    }

    roots
        .into_iter()
        .filter_map(|id| responses.remove(&id))
        .collect()
}
