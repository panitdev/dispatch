use chrono::{DateTime, Utc};
use diesel::prelude::*;

use crate::schema::{labels, states, teams};

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = labels)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Label {
    pub id: i64,
    pub team_id: i64,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
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
