use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use std::time::Instant;

use crate::{
    auth::kratos::KratosIdentity,
    error::{ApiResult, AppError},
    models::label::{
        CreateLabelRequest, Label, LabelChangeset, LabelResponse, NewLabel, UpdateLabelRequest,
    },
    models::project::{
        CreateProjectRequest, NewProject, Project, ProjectChangeset, ProjectResponse,
        UpdateProjectRequest, build_project_tree,
    },
    schema::{labels, projects},
    state::AppState,
};

const DEFAULT_PROJECT_LABELS: &[(&str, &str)] = &[
    ("bug", "#e11d48"),
    ("feature", "#2563eb"),
    ("improvement", "#7c3aed"),
    ("docs", "#0891b2"),
];

async fn insert_default_project_labels(
    state: &AppState,
    conn: &mut diesel_async::AsyncPgConnection,
    project: &Project,
) -> Result<(), AppError> {
    let team_id = project.team_id.unwrap_or(1);
    let rows: Vec<NewLabel> = DEFAULT_PROJECT_LABELS
        .iter()
        .map(|(name, color)| NewLabel {
            id: state.next_id(),
            team_id,
            project_id: project.id,
            name: (*name).to_owned(),
            color: (*color).to_owned(),
        })
        .collect();

    diesel::insert_into(labels::table)
        .values(&rows)
        .on_conflict_do_nothing()
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn list_projects(
    _identity: KratosIdentity,
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<ProjectResponse>>> {
    let started_at = Instant::now();
    let mut conn = state.db.get().await?;
    let all: Vec<Project> = projects::table
        .order(projects::created_at.asc())
        .load(&mut conn)
        .await?;
    tracing::info!(
        target: "api",
        elapsed_ms = started_at.elapsed().as_millis(),
        count = all.len(),
        "list_projects"
    );
    Ok(Json(build_project_tree(all)))
}

pub async fn create_project(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Json(body): Json<CreateProjectRequest>,
) -> ApiResult<(StatusCode, Json<ProjectResponse>)> {
    let parent_id = body
        .parent_id
        .as_deref()
        .map(|s| {
            s.parse::<i64>()
                .map_err(|_| AppError::BadRequest("invalid parent_id".into()))
        })
        .transpose()?;

    let new_project = NewProject {
        id: state.next_id(),
        key: body.key.to_uppercase(),
        name: body.name,
        color: body.color,
        parent_id,
    };

    let mut conn = state.db.get().await?;
    let created: Project = diesel::insert_into(projects::table)
        .values(&new_project)
        .get_result(&mut conn)
        .await?;
    insert_default_project_labels(&state, &mut conn, &created).await?;

    Ok((
        StatusCode::CREATED,
        Json(ProjectResponse::from_flat(created)),
    ))
}

pub async fn list_project_labels(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<LabelResponse>>> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let mut conn = state.db.get().await?;

    let project_exists: i64 = projects::table
        .filter(projects::id.eq(project_id))
        .count()
        .get_result(&mut conn)
        .await?;

    if project_exists == 0 {
        return Err(AppError::NotFound);
    }

    let rows: Vec<Label> = labels::table
        .filter(labels::project_id.eq(project_id))
        .order_by(labels::name.asc())
        .select(Label::as_select())
        .load(&mut conn)
        .await?;

    Ok(Json(rows.into_iter().map(LabelResponse::from).collect()))
}

pub async fn create_project_label(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<CreateLabelRequest>,
) -> ApiResult<(StatusCode, Json<LabelResponse>)> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let name = body.name.trim().to_owned();
    let color = body.color.trim().to_owned();

    if name.is_empty() {
        return Err(AppError::BadRequest("label name is required".into()));
    }

    if color.is_empty() {
        return Err(AppError::BadRequest("label color is required".into()));
    }

    let mut conn = state.db.get().await?;
    let project: Project = projects::table
        .find(project_id)
        .select(Project::as_select())
        .first(&mut conn)
        .await?;

    let new_label = NewLabel {
        id: state.next_id(),
        team_id: project.team_id.unwrap_or(1),
        project_id: project.id,
        name,
        color,
    };

    let created: Label = diesel::insert_into(labels::table)
        .values(&new_label)
        .get_result(&mut conn)
        .await?;

    Ok((StatusCode::CREATED, Json(LabelResponse::from(created))))
}

pub async fn update_project_label(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path((id, label_id)): Path<(String, String)>,
    Json(body): Json<UpdateLabelRequest>,
) -> ApiResult<Json<LabelResponse>> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let label_id: i64 = label_id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid label_id".into()))?;

    let name = body.name.map(|value| value.trim().to_owned());
    let color = body.color.map(|value| value.trim().to_owned());

    if name.as_ref().is_some_and(|value| value.is_empty()) {
        return Err(AppError::BadRequest("label name is required".into()));
    }

    if color.as_ref().is_some_and(|value| value.is_empty()) {
        return Err(AppError::BadRequest("label color is required".into()));
    }

    if name.is_none() && color.is_none() {
        return Err(AppError::BadRequest("no label changes provided".into()));
    }

    let changeset = LabelChangeset { name, color };
    let mut conn = state.db.get().await?;
    let updated: Label = diesel::update(
        labels::table
            .filter(labels::id.eq(label_id))
            .filter(labels::project_id.eq(project_id)),
    )
    .set(changeset)
    .get_result(&mut conn)
    .await?;

    Ok(Json(LabelResponse::from(updated)))
}

pub async fn delete_project_label(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path((id, label_id)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let label_id: i64 = label_id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid label_id".into()))?;

    let mut conn = state.db.get().await?;
    let deleted = diesel::delete(
        labels::table
            .filter(labels::id.eq(label_id))
            .filter(labels::project_id.eq(project_id)),
    )
    .execute(&mut conn)
    .await?;

    if deleted == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(StatusCode::NO_CONTENT)
    }
}

pub async fn get_project(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<ProjectResponse>> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let mut conn = state.db.get().await?;

    // Load the root project + all projects that descend from it (one level; recursive later)
    let all: Vec<Project> = projects::table
        .order(projects::created_at.asc())
        .load(&mut conn)
        .await?;

    let tree = build_project_tree(all);
    let found = find_in_tree(&tree, &project_id.to_string()).ok_or(AppError::NotFound)?;

    Ok(Json(found))
}

fn find_in_tree(tree: &[ProjectResponse], id: &str) -> Option<ProjectResponse> {
    for p in tree {
        if p.id == id {
            return Some(p.clone());
        }
        if let Some(found) = find_in_tree(&p.sub_projects, id) {
            return Some(found);
        }
    }
    None
}

pub async fn update_project(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateProjectRequest>,
) -> ApiResult<Json<ProjectResponse>> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;

    let parent_id_change = match body.parent_id {
        Some(Some(ref s)) => {
            let parsed = s
                .parse::<i64>()
                .map_err(|_| AppError::BadRequest("invalid parent_id".into()))?;
            Some(Some(parsed))
        }
        Some(None) => Some(None),
        None => None,
    };

    let changeset = ProjectChangeset {
        name: body.name,
        color: body.color,
        parent_id: parent_id_change,
    };

    let mut conn = state.db.get().await?;
    let updated: Project = diesel::update(projects::table.find(project_id))
        .set((&changeset, projects::updated_at.eq(Utc::now())))
        .get_result(&mut conn)
        .await?;

    Ok(Json(ProjectResponse::from_flat(updated)))
}

pub async fn delete_project(
    _identity: KratosIdentity,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let project_id: i64 = id
        .parse()
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;
    let mut conn = state.db.get().await?;

    let deleted = diesel::delete(projects::table.find(project_id))
        .execute(&mut conn)
        .await?;

    if deleted == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(StatusCode::NO_CONTENT)
    }
}
