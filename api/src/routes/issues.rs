use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Serialize;
use std::collections::HashMap;

use crate::{
    auth::kratos::KratosIdentity,
    error::{ApiResult, AppError},
    models::issue::{
        validate_labels, validate_priority, validate_status, CreateIssueRequest, Issue,
        IssueChangeset, IssueLabel, IssueRelation, IssueResponse, ListIssuesQuery, NewIssue,
        UpdateIssueRequest,
    },
    models::project::Project,
    schema::{issue_labels, issue_relations, issues, projects},
    state::AppState,
};

async fn fetch_issue_extras(
    conn: &mut diesel_async::AsyncPgConnection,
    issue_id: i64,
) -> Result<(Vec<IssueLabel>, Vec<IssueRelation>), crate::error::AppError> {
    let labels: Vec<IssueLabel> = issue_labels::table
        .filter(issue_labels::issue_id.eq(issue_id))
        .load(conn)
        .await?;
    let relations: Vec<IssueRelation> = issue_relations::table
        .filter(issue_relations::issue_id.eq(issue_id))
        .load(conn)
        .await?;
    Ok((labels, relations))
}

#[derive(Serialize)]
pub struct NewIssuesResponse {
    #[serde(rename = "continue")]
    pub r#continue: Vec<NowIssueSummary>,
    pub next: Vec<NowIssueSummary>,
    pub drafts: Vec<NowIssueSummary>,
}

#[derive(Serialize)]
pub struct NowIssueSummary {
    pub title: String,
    pub description: Option<String>,
    pub project: NowProjectSummary,
    pub status: String,
    pub labels: Vec<String>,
}

#[derive(Serialize)]
pub struct NowProjectSummary {
    pub id: String,
    pub key: String,
    pub name: String,
    pub color: String,
}

pub async fn list_project_issues(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Query(query): Query<ListIssuesQuery>,
) -> ApiResult<Json<Vec<IssueResponse>>> {
    let pid: i64 = project_id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid project id".into()))?;

    let mut conn = state.db.get().await?;

    let mut base = issues::table
        .filter(issues::project_id.eq(pid))
        .order(issues::created_at.asc())
        .into_boxed();

    if let Some(status) = &query.status {
        if !validate_status(status) {
            return Err(AppError::BadRequest(format!("invalid status: {status}")));
        }
        base = base.filter(issues::status.eq(status));
    }

    let rows: Vec<Issue> = base.load(&mut conn).await?;

    let mut responses = Vec::with_capacity(rows.len());
    for issue in rows {
        let (labels, relations) = fetch_issue_extras(&mut conn, issue.id).await?;
        responses.push(IssueResponse::new(issue, labels, relations));
    }

    Ok(Json(responses))
}

pub async fn get_new_issues(
    identity: KratosIdentity,
    State(state): State<AppState>,
) -> ApiResult<Json<NewIssuesResponse>> {
    let user = identity.resolve_user(&state).await?;
    let mut conn = state.db.get().await?;

    let continue_rows: Vec<(Issue, Project)> = issues::table
        .inner_join(projects::table)
        .filter(issues::assignee_id.eq(user.id))
        .filter(issues::status.eq("doing"))
        .order_by(issues::updated_at.desc())
        .select((Issue::as_select(), Project::as_select()))
        .limit(3)
        .load(&mut conn)
        .await?;

    let next_rows: Vec<(Issue, Project)> = issues::table
        .inner_join(projects::table)
        .filter(issues::assignee_id.eq(user.id))
        .filter(issues::status.eq("next"))
        .order_by((issues::priority.desc(), issues::updated_at.desc()))
        .select((Issue::as_select(), Project::as_select()))
        .limit(3)
        .load(&mut conn)
        .await?;

    let draft_rows: Vec<(Issue, Project)> = issues::table
        .inner_join(projects::table)
        .filter(issues::author_id.eq(user.id))
        .filter(issues::status.eq("draft"))
        .order_by(issues::updated_at.desc())
        .select((Issue::as_select(), Project::as_select()))
        .limit(3)
        .load(&mut conn)
        .await?;

    let issue_ids: Vec<i64> = continue_rows
        .iter()
        .chain(next_rows.iter())
        .chain(draft_rows.iter())
        .map(|(issue, _)| issue.id)
        .collect();

    let label_rows: Vec<IssueLabel> = if issue_ids.is_empty() {
        Vec::new()
    } else {
        issue_labels::table
            .filter(issue_labels::issue_id.eq_any(&issue_ids))
            .order_by((issue_labels::issue_id.asc(), issue_labels::label.asc()))
            .load(&mut conn)
            .await?
    };

    let mut labels_by_issue: HashMap<i64, Vec<String>> = HashMap::new();
    for label in label_rows {
        labels_by_issue
            .entry(label.issue_id)
            .or_default()
            .push(label.label);
    }

    let mut summarize = |rows: Vec<(Issue, Project)>| {
        rows.into_iter()
            .map(|(issue, project)| NowIssueSummary {
                title: issue.title,
                description: None,
                project: NowProjectSummary {
                    id: project.id.to_string(),
                    key: project.key,
                    name: project.name,
                    color: project.color,
                },
                status: issue.status,
                labels: labels_by_issue.remove(&issue.id).unwrap_or_default(),
            })
            .collect()
    };

    Ok(Json(NewIssuesResponse {
        r#continue: summarize(continue_rows),
        next: summarize(next_rows),
        drafts: summarize(draft_rows),
    }))
}

pub async fn create_issue(
    identity: KratosIdentity,
    State(state): State<AppState>,
    Json(body): Json<CreateIssueRequest>,
) -> ApiResult<(StatusCode, Json<IssueResponse>)> {
    if !validate_status(&body.status) {
        return Err(AppError::BadRequest(format!(
            "invalid status: {}",
            body.status
        )));
    }
    if !validate_priority(body.priority) {
        return Err(AppError::BadRequest(format!(
            "invalid priority: {}",
            body.priority
        )));
    }
    if !validate_labels(&body.labels) {
        return Err(AppError::BadRequest("one or more invalid labels".into()));
    }

    let project_id: i64 = body
        .project_id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid project_id".into()))?;

    let parent_id = body
        .parent_id
        .as_deref()
        .map(|s| {
            s.parse::<i64>()
                .map_err(|_| AppError::BadRequest("invalid parent_id".into()))
        })
        .transpose()?;

    let assignee_id = body
        .assignee_id
        .as_deref()
        .map(|s| {
            s.parse::<i64>()
                .map_err(|_| AppError::BadRequest("invalid assignee_id".into()))
        })
        .transpose()?;

    let user = identity.resolve_user(&state).await?;

    // Verify assignee exists if specified
    if let Some(aid) = assignee_id {
        use crate::schema::users;
        let mut conn = state.db.get().await?;
        let exists: i64 = users::table
            .filter(users::id.eq(aid))
            .count()
            .get_result(&mut conn)
            .await?;
        if exists == 0 {
            return Err(AppError::BadRequest("assignee not found".into()));
        }
    }

    let mut conn = state.db.get().await?;

    // Atomically increment issue_sequence and capture key + seq in one round-trip
    let (project_key, seq): (String, i32) = diesel::update(projects::table.find(project_id))
        .set(projects::issue_sequence.eq(projects::issue_sequence + 1))
        .returning((projects::key, projects::issue_sequence))
        .get_result(&mut conn)
        .await
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::BadRequest("project not found".into()),
            other => AppError::Db(other),
        })?;

    let issue_key = format!("{}-{}", project_key, seq);

    let new_issue = NewIssue {
        id: state.next_id(),
        key: issue_key,
        project_id,
        parent_id,
        title: body.title,
        status: body.status,
        priority: body.priority,
        author_id: user.id,
        assignee_id,
        blocks: serde_json::to_value(body.blocks).map_err(|_| AppError::Internal)?,
    };

    let created: Issue = diesel::insert_into(issues::table)
        .values(&new_issue)
        .get_result(&mut conn)
        .await?;

    if !body.labels.is_empty() {
        let label_rows: Vec<IssueLabel> = body
            .labels
            .iter()
            .map(|l| IssueLabel {
                issue_id: created.id,
                label: l.clone(),
            })
            .collect();
        diesel::insert_into(issue_labels::table)
            .values(&label_rows)
            .execute(&mut conn)
            .await?;
    }

    let (labels, relations) = fetch_issue_extras(&mut conn, created.id).await?;
    Ok((
        StatusCode::CREATED,
        Json(IssueResponse::new(created, labels, relations)),
    ))
}

pub async fn get_issue(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<IssueResponse>> {
    let issue_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let mut conn = state.db.get().await?;

    let issue: Issue = issues::table.find(issue_id).first(&mut conn).await?;
    let (labels, relations) = fetch_issue_extras(&mut conn, issue.id).await?;
    Ok(Json(IssueResponse::new(issue, labels, relations)))
}

pub async fn update_issue(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateIssueRequest>,
) -> ApiResult<Json<IssueResponse>> {
    let issue_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;

    if let Some(ref s) = body.status {
        if !validate_status(s) {
            return Err(AppError::BadRequest(format!("invalid status: {s}")));
        }
    }
    if let Some(ref p) = body.priority {
        if !validate_priority(*p) {
            return Err(AppError::BadRequest(format!("invalid priority: {p}")));
        }
    }
    if let Some(ref ls) = body.labels {
        if !validate_labels(ls) {
            return Err(AppError::BadRequest("one or more invalid labels".into()));
        }
    }

    let assignee_change = match body.assignee_id {
        Some(Some(ref s)) => {
            let parsed = s
                .parse::<i64>()
                .map_err(|_| AppError::BadRequest("invalid assignee_id".into()))?;
            Some(Some(parsed))
        }
        Some(None) => Some(None),
        None => None,
    };

    let parent_change = match body.parent_id {
        Some(Some(ref s)) => {
            let parsed = s
                .parse::<i64>()
                .map_err(|_| AppError::BadRequest("invalid parent_id".into()))?;
            Some(Some(parsed))
        }
        Some(None) => Some(None),
        None => None,
    };

    let changeset = IssueChangeset {
        title: body.title,
        status: body.status,
        priority: body.priority,
        assignee_id: assignee_change,
        blocks: body
            .blocks
            .map(serde_json::to_value)
            .transpose()
            .map_err(|_| AppError::Internal)?,
        parent_id: parent_change,
        updated_at: Some(Utc::now()),
    };

    let mut conn = state.db.get().await?;

    let updated: Issue = diesel::update(issues::table.find(issue_id))
        .set(&changeset)
        .get_result(&mut conn)
        .await?;

    // Replace labels if provided
    if let Some(new_labels) = body.labels {
        diesel::delete(issue_labels::table.filter(issue_labels::issue_id.eq(issue_id)))
            .execute(&mut conn)
            .await?;

        if !new_labels.is_empty() {
            let label_rows: Vec<IssueLabel> = new_labels
                .into_iter()
                .map(|l| IssueLabel {
                    issue_id: updated.id,
                    label: l,
                })
                .collect();
            diesel::insert_into(issue_labels::table)
                .values(&label_rows)
                .execute(&mut conn)
                .await?;
        }
    }

    let (labels, relations) = fetch_issue_extras(&mut conn, updated.id).await?;
    Ok(Json(IssueResponse::new(updated, labels, relations)))
}

pub async fn delete_issue(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let issue_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let mut conn = state.db.get().await?;

    let deleted = diesel::delete(issues::table.find(issue_id))
        .execute(&mut conn)
        .await?;

    if deleted == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(StatusCode::NO_CONTENT)
    }
}
