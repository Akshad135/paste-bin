use std::{net::SocketAddr, path::Path, sync::Arc};

use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{EnvFilter, fmt};

mod auth;
mod db;
mod expiry;
mod routes;
mod slugs;
mod state;

use state::AppState;

#[tokio::main]
async fn main() {
    // Load .env file (best-effort)
    dotenvy::dotenv().ok();

    // Initialise tracing
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // ── Config from env ────────────────────────────────────────────────
    let db_path =
        std::env::var("DATABASE_PATH").unwrap_or_else(|_| "./data/pastebin.sqlite".to_string());
    let auth_key = std::env::var("AUTH_KEY").unwrap_or_else(|_| {
        tracing::warn!("AUTH_KEY not set — using default 'dev123'");
        "dev123".to_string()
    });
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8788);
    let dist_dir = std::env::var("DIST_DIR").unwrap_or_else(|_| "./dist".to_string());

    // ── Database ───────────────────────────────────────────────────────
    if let Some(parent) = Path::new(&db_path).parent() {
        std::fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    let pool = db::init_pool(&db_path).await;
    db::run_migrations(&pool).await;

    tracing::info!("Database ready at {db_path}");

    // ── Shared state ───────────────────────────────────────────────────
    let state = Arc::new(AppState::new(pool, auth_key, dist_dir));

    // ── Router ─────────────────────────────────────────────────────────
    let app = Router::new()
        .nest("/api", routes::api_router())
        .fallback_service(
            tower_http::services::ServeDir::new(&state.dist_dir)
                .not_found_service(tower_http::services::ServeFile::new(
                    format!("{}/index.html", state.dist_dir)
                ))
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // ── Start ──────────────────────────────────────────────────────────
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Pastebin server listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind");
    axum::serve(listener, app).await.expect("Server error");
}
