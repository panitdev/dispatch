use axum::http::{header, HeaderName, HeaderValue, Method};
use diesel::Connection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod auth;
mod config;
mod db;
mod error;
mod ids;
mod mcp;
mod models;
mod oauth;
mod routes;
mod schema;
mod state;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "api=debug,tower_http=debug".parse().unwrap()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env();

    // Run pending migrations synchronously before the async pool is built.
    // diesel_migrations requires a synchronous connection.
    {
        let mut sync_conn = diesel::PgConnection::establish(&config.database_url)
            .expect("failed to connect to Postgres for migrations");
        sync_conn
            .run_pending_migrations(MIGRATIONS)
            .expect("failed to run database migrations");
        tracing::info!("migrations applied");
    }

    let db = db::init_pool(&config.database_url).await;

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("failed to build HTTP client");

    let ids = ids::IdGen::new(config.snowflake_machine_id, config.snowflake_node_id);

    let hydra_admin = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("failed to build Hydra Admin HTTP client");

    let state = state::AppState {
        db,
        http,
        hydra_admin,
        ids,
        config: config.clone(),
    };

    let cors = {
        let origins: Vec<HeaderValue> = config
            .cors_allowed_origins
            .iter()
            .map(|origin| {
                origin
                    .parse()
                    .unwrap_or_else(|_| panic!("CORS origin is not a valid header value: {origin}"))
            })
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::CONTENT_TYPE,
                header::AUTHORIZATION,
                header::COOKIE,
                header::ACCEPT,
                HeaderName::from_static("mcp-protocol-version"),
            ])
            .expose_headers([header::WWW_AUTHENTICATE])
            .allow_credentials(true)
    };

    let app = routes::router(&config)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.api_port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind");
    tracing::info!("listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}
