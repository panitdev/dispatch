use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use std::time::Instant;

use crate::{
    auth::kratos::KratosIdentity,
    error::{ApiResult, AppError},
    models::project::{
        build_project_tree, CreateProjectRequest, NewProject, Project, ProjectChangeset,
        ProjectResponse, UpdateProjectRequest,
    },
    schema::projects,
    state::AppState,
};

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

    Ok((
        StatusCode::CREATED,
        Json(ProjectResponse::from_flat(created)),
    ))
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
