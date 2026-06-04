use std::{env, path::PathBuf};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub kratos_public_url: String,
    pub kratos_browser_url: String,
    pub dispatch_public_url: String,
    pub hydra_public_url: String,
    pub hydra_admin_url: String,
    pub dispatch_api_url: Option<String>,
    pub api_port: u16,
    pub frontend_dist_dir: PathBuf,
    pub frontend_origin: String,
    pub cors_allowed_origins: Vec<String>,
    pub snowflake_machine_id: i32,
    pub snowflake_node_id: i32,
}

impl Config {
    pub fn from_env() -> Self {
        let kratos_public_url =
            env::var("KRATOS_PUBLIC_URL").unwrap_or_else(|_| "http://localhost:4433".into());
        let frontend_origin =
            env::var("FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".into());
        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS")
            .ok()
            .map(|origins| {
                origins
                    .split(',')
                    .map(str::trim)
                    .filter(|origin| !origin.is_empty())
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .filter(|origins| !origins.is_empty())
            .unwrap_or_else(|| vec![frontend_origin.clone()]);

        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            kratos_browser_url: env::var("KRATOS_BROWSER_URL")
                .unwrap_or_else(|_| kratos_public_url.clone()),
            dispatch_public_url: env::var("DISPATCH_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            hydra_public_url: env::var("HYDRA_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:4444".into()),
            hydra_admin_url: env::var("HYDRA_ADMIN_URL")
                .unwrap_or_else(|_| "http://localhost:4445".into()),
            dispatch_api_url: env::var("DISPATCH_API_URL")
                .ok()
                .map(|url| url.trim().to_owned())
                .filter(|url| !url.is_empty()),
            kratos_public_url,
            api_port: env::var("API_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3000),
            frontend_dist_dir: env::var("FRONTEND_DIST_DIR")
                .unwrap_or_else(|_| "ui/dist".into())
                .into(),
            frontend_origin,
            cors_allowed_origins,
            snowflake_machine_id: env::var("SNOWFLAKE_MACHINE_ID")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1),
            snowflake_node_id: env::var("SNOWFLAKE_NODE_ID")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1),
        }
    }
}
