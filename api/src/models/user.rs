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
    pub name: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn initials(&self) -> String {
        self.name
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
    pub name: String,
    pub email: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: String,
    pub kratos_id: String,
    pub name: String,
    pub initials: String,
    pub email: String,
    pub created_at: String,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        let initials = u.initials();
        Self {
            id: u.id.to_string(),
            kratos_id: u.kratos_id.to_string(),
            name: u.name,
            initials,
            email: u.email,
            created_at: u.created_at.to_rfc3339(),
        }
    }
}
