use std::{net::SocketAddr, path::Path, sync::Arc};

use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tracing_subscriber::{EnvFilter, fmt};

mod auth;
mod db;
mod expiry;
mod routes;
mod slugs;
mod state;

use state::AppState;

/// Known placeholder/example values that must never be used as a real
/// AUTH_KEY. If any of these show up, the server refuses to start rather
/// than silently running with a guessable passphrase (which also doubles
/// as the E2EE key-derivation secret).
const INSECURE_AUTH_KEYS: &[&str] = &[
    "dev123",
    "default_secure_key",
    "change_me_to_a_secure_passphrase",
];

/// Read AUTH_KEY from the environment, refusing to start if it is missing,
/// empty, a known placeholder, or too short to be a meaningful secret.
fn require_auth_key() -> String {
    let key = match std::env::var("AUTH_KEY") {
        Ok(k) => k,
        Err(_) => {
            eprintln!(
                "\nFATAL: AUTH_KEY environment variable is not set.\n\n\
                 This passphrase protects your pastebin login and is also used\n\
                 to derive your end-to-end encryption key, so it must be set\n\
                 explicitly to a unique secret — the server will not start\n\
                 with a guessable built-in default.\n\n\
                 Set it via `.env`, `docker-compose.yml`, or your platform's\n\
                 secrets manager, e.g.:\n\
                 AUTH_KEY=$(openssl rand -base64 32)\n"
            );
            std::process::exit(1);
        }
    };

    let trimmed = key.trim();
    if trimmed.is_empty() || INSECURE_AUTH_KEYS.contains(&trimmed) {
        eprintln!(
            "\nFATAL: AUTH_KEY is set to a known placeholder/default value.\n\n\
             Set AUTH_KEY to a unique, secret passphrase before starting the\n\
             server — refusing to start with a publicly-known default.\n\n\
             Example:\n\
             AUTH_KEY=$(openssl rand -base64 32)\n"
        );
        std::process::exit(1);
    }

    if trimmed.len() < 8 {
        eprintln!(
            "\nFATAL: AUTH_KEY is too short ({} characters).\n\n\
             Use a longer, unique passphrase (at least 8 characters, ideally\n\
             much longer since it also derives your E2EE key).\n",
            trimmed.len()
        );
        std::process::exit(1);
    }

    key
}

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
    let auth_key = require_auth_key();
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8788);
    let dist_dir = std::env::var("DIST_DIR").unwrap_or_else(|_| "./dist".to_string());
    let uploads_dir =
        std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "./data/uploads".to_string());
    let max_upload_size: usize = std::env::var("MAX_UPLOAD_SIZE")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(52_428_800); // 50 MB default

    // ── Database ───────────────────────────────────────────────────────
    if let Some(parent) = Path::new(&db_path).parent() {
        std::fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    let pool = db::init_pool(&db_path).await;
    db::run_migrations(&pool).await;
    tracing::info!("Database ready at {db_path}");

    // ── E2EE salt ──────────────────────────────────────────────────────
    let data_dir = Path::new(&db_path).parent().map(|p| p.to_str().unwrap_or("./data")).unwrap_or("./data");
    let salt = db::ensure_salt(data_dir);
    tracing::info!("E2EE salt ready");

    // ── Uploads directory ──────────────────────────────────────────────
    std::fs::create_dir_all(&uploads_dir).expect("Failed to create uploads directory");
    tracing::info!(
        "Uploads directory ready at {uploads_dir} (max size: {} MB)",
        max_upload_size / 1_048_576
    );

    // ── Shared state ───────────────────────────────────────────────────
    let state = Arc::new(AppState::new(pool, auth_key, dist_dir, uploads_dir, max_upload_size, salt));

    // ── Background Cleanup Task ────────────────────────────────────────
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(10)); // 10 seconds
        loop {
            interval.tick().await;
            tracing::info!("Running cleanup task for expired pastes...");
            
            let expired_pastes: Result<Vec<(String,)>, _> = sqlx::query_as(
                "SELECT slug FROM pastes WHERE expires_at <= datetime('now')"
            )
            .fetch_all(&cleanup_state.db)
            .await;

            match expired_pastes {
                Ok(pastes) => {
                    for (slug,) in pastes {
                        tracing::info!("Cleaning up expired paste: {}", slug);
                        
                        // Delete associated files from disk first
                        routes::file::delete_files_for_paste(&cleanup_state.db, &cleanup_state.uploads_dir, &slug).await;
                        
                        // Delete from DB (which may CASCADE delete `files` records)
                        if let Err(e) = sqlx::query("DELETE FROM pastes WHERE slug = ?")
                            .bind(&slug)
                            .execute(&cleanup_state.db)
                            .await
                        {
                            tracing::error!("Failed to delete expired paste {} from DB: {}", slug, e);
                        }
                    }
                }
                Err(e) => tracing::error!("Failed to fetch expired pastes: {}", e),
            }
        }
    });

    // ── Router ─────────────────────────────────────────────────────────
    let app = Router::new()
        .nest("/api", routes::api_router())
        .fallback_service(
            tower_http::services::ServeDir::new(&state.dist_dir)
                .not_found_service(tower_http::services::ServeFile::new(
                    format!("{}/index.html", state.dist_dir)
                ))
        )
        .layer(RequestBodyLimitLayer::new(state.max_upload_size))
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
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("Server error");
}
