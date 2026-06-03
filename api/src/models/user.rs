use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::Serialize;
use uuid::Uuid;

use crate::schema::users;

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: i64,
    pub kratos_id: Uuid,
    pub username: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub email: Option<String>,
}

impl User {
    pub fn initials(&self) -> String {
        self.username
            .split_whitespace()
            .filter_map(|w| w.chars().next())
            .take(2)
            .collect::<String>()
            .to_uppercase()
    }
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub id: i64,
    pub kratos_id: Uuid,
    pub username: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: String,
    pub kratos_id: String,
    pub username: String,
    pub initials: String,
    pub created_at: String,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        let initials = u.initials();
        Self {
            id: u.id.to_string(),
            kratos_id: u.kratos_id.to_string(),
            username: u.username,
            initials,
            created_at: u.created_at.to_rfc3339(),
        }
    }
}
