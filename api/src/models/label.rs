use chrono::{DateTime, Utc};
use diesel::prelude::*;

use serde::{Deserialize, Serialize};

use crate::schema::{labels, states, teams};

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = labels)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Label {
    pub id: i64,
    pub team_id: i64,
    pub project_id: i64,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = labels)]
pub struct NewLabel {
    pub id: i64,
    pub team_id: i64,
    pub project_id: i64,
    pub name: String,
    pub color: String,
}

#[derive(AsChangeset, Default)]
#[diesel(table_name = labels)]
pub struct LabelChangeset {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateLabelRequest {
    pub name: String,
    pub color: String,
}

#[derive(Deserialize, Default)]
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Serialize)]
pub struct LabelResponse {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub color: String,
}

impl From<Label> for LabelResponse {
    fn from(label: Label) -> Self {
        Self {
            id: label.id.to_string(),
            project_id: label.project_id.to_string(),
            name: label.name,
            color: label.color,
        }
    }
}

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = states)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct State {
    pub id: i64,
    pub team_id: i64,
    pub name: String,
    pub group_name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = teams)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Team {
    pub id: i64,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
