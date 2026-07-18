use std::{net::SocketAddr, path::Path, sync::Arc};

use axum::Router;
use axum::http::HeaderValue;
use tower_http::cors::{Any, AllowOrigin, CorsLayer};
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
                 This passphrase protects your ghostbin login and is also used\n\
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
        std::env::var("DATABASE_PATH").unwrap_or_else(|_| "./data/ghostbin.sqlite".to_string());
    let auth_key = require_auth_key();
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8788);
    let dist_dir = std::env::var("DIST_DIR").unwrap_or_else(|_| "./dist".to_string());
    let uploads_dir = std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "./data/uploads".to_string());
    let max_file_size: usize = std::env::var("MAX_FILE_SIZE")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(52_428_800); // 50 MB default
    let max_text_size: usize = std::env::var("MAX_TEXT_SIZE")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(524_288); // 512 KB default

    // ALLOWED_ORIGINS controls the CORS policy.
    // Set to your public URL (e.g. https://paste.example.com) to restrict
    // cross-origin access and protect the /unlock endpoint from CPU-exhaustion
    // attacks via malicious third-party pages.
    // If unset, defaults to "*" (allow all origins) — fine for local dev,
    // but a WARNING is logged to remind self-hosters to configure this.
    let allowed_origins_raw = std::env::var("ALLOWED_ORIGINS").unwrap_or_default();
    let cors_layer = build_cors_layer(&allowed_origins_raw);

    // ── Database ───────────────────────────────────────────────────────
    if let Some(parent) = Path::new(&db_path).parent() {
        std::fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    let pool = db::init_pool(&db_path).await;
    db::run_migrations(&pool).await;
    tracing::info!("Database ready at {db_path}");

    // ── E2EE salt ──────────────────────────────────────────────────────
    let data_dir = Path::new(&db_path)
        .parent()
        .map(|p| p.to_str().unwrap_or("./data"))
        .unwrap_or("./data");
    let salt = db::ensure_salt(data_dir);
    tracing::info!("E2EE salt ready");

    // ── Uploads directory ──────────────────────────────────────────────
    std::fs::create_dir_all(&uploads_dir).expect("Failed to create uploads directory");
    tracing::info!("Uploads directory ready at {uploads_dir}");

    // ── Shared state ───────────────────────────────────────────────────
    let state = Arc::new(AppState::new(
        pool,
        auth_key,
        dist_dir,
        uploads_dir,
        max_file_size,
        max_text_size,
        salt,
    ));

    tracing::info!(
        "Limits: text={} KB, file={} MB",
        max_text_size / 1_024,
        max_file_size / 1_048_576
    );

    // ── Background Cleanup Task ────────────────────────────────────────
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            tracing::info!("Running cleanup task...");

            let orphan_files: Result<Vec<(String,)>, _> = sqlx::query_as(
                "SELECT slug FROM files
                 WHERE paste_slug IS NULL AND created_at <= datetime('now', '-15 minutes')",
            )
            .fetch_all(&cleanup_state.db)
            .await;

            if let Ok(files) = orphan_files {
                for (slug,) in files {
                    tracing::info!("Deleting orphaned upload: {}", slug);
                    let path = std::path::Path::new(&cleanup_state.uploads_dir).join(&slug);
                    if path.exists() {
                        if let Err(e) = tokio::fs::remove_file(&path).await {
                            tracing::warn!("Failed to remove file {} from disk: {e}", slug);
                        }
                    }
                    if let Err(e) = sqlx::query("DELETE FROM files WHERE slug = ?")
                        .bind(&slug)
                        .execute(&cleanup_state.db)
                        .await
                    {
                        tracing::error!("Failed to remove file {} from DB: {}", slug, e);
                    }
                }
            }

            let due_delete_slugs: Result<Vec<(String,)>, _> = sqlx::query_as(
                "SELECT slug FROM pastes
                 WHERE (burn_trigger = 'time' AND burn_action = 'delete' AND burn_at IS NOT NULL AND burn_at <= datetime('now'))
                    OR (burn_pending_delete_at IS NOT NULL AND burn_pending_delete_at <= datetime('now'))"
            )
            .fetch_all(&cleanup_state.db)
            .await;

            match due_delete_slugs {
                Ok(slugs) => {
                    for (slug,) in slugs {
                        tracing::info!("Deleting burned paste: {}", slug);
                        if let Err(e) =
                            routes::paste::delete_paste_unchecked(&cleanup_state, &slug).await
                        {
                            tracing::error!("Failed to delete burned paste {}: {}", slug, e);
                        }
                    }
                }
                Err(e) => tracing::error!("Failed to fetch burned pastes for deletion: {}", e),
            }

            let due_revoke_slugs: Result<Vec<(String,)>, _> = sqlx::query_as(
                "SELECT slug FROM pastes
                 WHERE burn_trigger = 'time'
                   AND burn_action = 'revoke_share'
                   AND burn_at IS NOT NULL
                   AND burn_at <= datetime('now')",
            )
            .fetch_all(&cleanup_state.db)
            .await;

            match due_revoke_slugs {
                Ok(slugs) => {
                    for (slug,) in slugs {
                        tracing::info!("Revoking burned share access: {}", slug);
                        if let Err(e) = sqlx::query(
                            "UPDATE pastes SET
                                share_wrapped_paste_key = NULL,
                                share_auth_salt = NULL,
                                share_auth_verifier = NULL,
                                burn_trigger = NULL,
                                burn_action = 'delete',
                                burn_at = NULL,
                                burn_after_unlocks = NULL,
                                burn_unlocks_used = 0,
                                burn_pending_delete_at = NULL,
                                updated_at = datetime('now')
                             WHERE slug = ?",
                        )
                        .bind(&slug)
                        .execute(&cleanup_state.db)
                        .await
                        {
                            tracing::error!("Failed to revoke burned share {}: {}", slug, e);
                            continue;
                        }
                        let msg = serde_json::json!({ "type": "paste_updated", "slug": slug });
                        let _ = cleanup_state.ws_sender.send(msg.to_string());
                    }
                }
                Err(e) => tracing::error!("Failed to fetch burned shares for revoke: {}", e),
            }
        }
    });
    // ── Router ─────────────────────────────────────────────────────────
    let app = Router::new()
        .nest("/api", routes::api_router())
        .fallback_service(
            tower_http::services::ServeDir::new(&state.dist_dir).not_found_service(
                tower_http::services::ServeFile::new(format!("{}/index.html", state.dist_dir)),
            ),
        )
        .layer(RequestBodyLimitLayer::new(state.max_file_size))
        .layer(cors_layer)
        .with_state(state);

    // ── Start ──────────────────────────────────────────────────────────
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("GhostBin server listening on http://{addr}");

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

/// Build a CORS layer from the ALLOWED_ORIGINS environment variable.
///
/// - A non-empty value is treated as the single allowed origin (exact match).
///   Multiple origins are not supported intentionally — use a reverse proxy
///   for that case.
/// - An empty value falls back to `*` with a startup warning, preserving
///   zero-config local development while nudging self-hosters to set it.
fn build_cors_layer(allowed_origins: &str) -> CorsLayer {
    let trimmed = allowed_origins.trim().trim_end_matches('/');

    if trimmed.is_empty() {
        tracing::warn!(
            "ALLOWED_ORIGINS is not set — CORS is open to all origins (*).
             This is fine for local development, but you should set
             ALLOWED_ORIGINS=https://your-domain.com in production to protect
             the /unlock endpoint from cross-origin CPU-exhaustion attacks."
        );
        return CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);
    }

    match trimmed.parse::<HeaderValue>() {
        Ok(origin) => {
            tracing::info!("CORS restricted to origin: {trimmed}");
            CorsLayer::new()
                .allow_origin(AllowOrigin::exact(origin))
                .allow_methods(Any)
                .allow_headers(Any)
        }
        Err(_) => {
            tracing::error!(
                "ALLOWED_ORIGINS value '{}' is not a valid HTTP origin. \
                 Falling back to open CORS (*).",
                trimmed
            );
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        }
    }
}
