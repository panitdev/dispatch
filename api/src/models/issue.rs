use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::{issue_labels, issue_relations, issues};

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = issues)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Issue {
    pub id: i64,
    pub key: String,
    pub project_id: i64,
    pub parent_id: Option<i64>,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub assignee_id: Option<i64>,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = issues)]
pub struct NewIssue {
    pub id: i64,
    pub key: String,
    pub project_id: i64,
    pub parent_id: Option<i64>,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub assignee_id: Option<i64>,
    pub body: String,
}

#[derive(AsChangeset, Default)]
#[diesel(table_name = issues)]
pub struct IssueChangeset {
    pub title: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<Option<i64>>,
    pub body: Option<String>,
    pub parent_id: Option<Option<i64>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Queryable, Selectable, Insertable)]
#[diesel(table_name = issue_labels)]
pub struct IssueLabel {
    pub issue_id: i64,
    pub label: String,
}

#[derive(Debug, Queryable, Selectable, Insertable)]
#[diesel(table_name = issue_relations)]
pub struct IssueRelation {
    pub issue_id: i64,
    pub related_issue_id: i64,
    pub relation_type: String,
}

// ---- Request types ----

#[derive(Deserialize)]
pub struct CreateIssueRequest {
    pub project_id: String,
    pub title: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default)]
    pub labels: Vec<String>,
    pub parent_id: Option<String>,
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub body: String,
}

fn default_status() -> String { "backlog".into() }
fn default_priority() -> String { "none".into() }

#[derive(Deserialize, Default)]
pub struct UpdateIssueRequest {
    pub title: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<Option<String>>,
    pub body: Option<String>,
    pub parent_id: Option<Option<String>>,
    pub labels: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct ListIssuesQuery {
    pub status: Option<String>,
}

// ---- Response type ----

#[derive(Serialize)]
pub struct IssueResponse {
    pub id: String,
    pub key: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub labels: Vec<String>,
    pub assignee_id: Option<String>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub blocked_by: Vec<String>,
    pub related_to: Vec<String>,
}

impl IssueResponse {
    pub fn new(issue: Issue, labels: Vec<IssueLabel>, relations: Vec<IssueRelation>) -> Self {
        let blocked_by = relations
            .iter()
            .filter(|r| r.relation_type == "blocked_by")
            .map(|r| r.related_issue_id.to_string())
            .collect();
        let related_to = relations
            .iter()
            .filter(|r| r.relation_type == "related")
            .map(|r| r.related_issue_id.to_string())
            .collect();
        Self {
            id: issue.id.to_string(),
            key: issue.key,
            project_id: issue.project_id.to_string(),
            parent_id: issue.parent_id.map(|id| id.to_string()),
            title: issue.title,
            status: issue.status,
            priority: issue.priority,
            labels: labels.into_iter().map(|l| l.label).collect(),
            assignee_id: issue.assignee_id.map(|id| id.to_string()),
            body: issue.body,
            created_at: issue.created_at.to_rfc3339(),
            updated_at: issue.updated_at.to_rfc3339(),
            blocked_by,
            related_to,
        }
    }
}

// ---- Validation helpers ----

const VALID_STATUSES: &[&str] = &["backlog", "todo", "in-progress", "done", "cancelled"];
const VALID_PRIORITIES: &[&str] = &["urgent", "high", "medium", "low", "none"];
const VALID_LABELS: &[&str] = &["bug", "feature", "improvement", "docs"];

pub fn validate_status(s: &str) -> bool { VALID_STATUSES.contains(&s) }
pub fn validate_priority(p: &str) -> bool { VALID_PRIORITIES.contains(&p) }
pub fn validate_labels(labels: &[String]) -> bool {
    labels.iter().all(|l| VALID_LABELS.contains(&l.as_str()))
}
