use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    Json,
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
};
use serde::Deserialize;

use crate::auth;
use crate::state::{AppState, LoginAttempts};

#[derive(Deserialize)]
pub struct LoginBody {
    passphrase: Option<String>,
}

/// Simple fixed-window rate limit for login attempts, keyed by client IP.
/// This is intentionally basic (in-memory, resets on restart, no cleanup of
/// old entries) — it's meant to blunt naive online brute-forcing of the
/// single shared passphrase, not to be a hardened defense.
const MAX_LOGIN_ATTEMPTS: u32 = 5;
const LOGIN_WINDOW: Duration = Duration::from_secs(60);

/// POST /api/auth/login — authenticate with a passphrase.
pub async fn handle_login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(body): Json<LoginBody>,
) -> impl IntoResponse {
    let ip = addr.ip();

    // Check (and lazily expire) the rate limit window before doing anything else.
    {
        let mut attempts = state.login_attempts.lock().unwrap();
        if let Some(entry) = attempts.get_mut(&ip) {
            if entry.window_start.elapsed() > LOGIN_WINDOW {
                entry.count = 0;
                entry.window_start = Instant::now();
            }
            if entry.count >= MAX_LOGIN_ATTEMPTS {
                let retry_after = LOGIN_WINDOW
                    .saturating_sub(entry.window_start.elapsed())
                    .as_secs()
                    .max(1);
                return (
                    StatusCode::TOO_MANY_REQUESTS,
                    Json(serde_json::json!({
                        "error": format!(
                            "Too many login attempts. Try again in {retry_after}s."
                        ),
                    })),
                )
                    .into_response();
            }
        }
    }

    let Some(passphrase) = body.passphrase.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Passphrase is required" })),
        )
            .into_response();
    };

    if passphrase != state.auth_key {
        let mut attempts = state.login_attempts.lock().unwrap();
        let entry = attempts.entry(ip).or_insert_with(|| LoginAttempts {
            count: 0,
            window_start: Instant::now(),
        });
        if entry.window_start.elapsed() > LOGIN_WINDOW {
            entry.count = 0;
            entry.window_start = Instant::now();
        }
        entry.count += 1;

        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid passphrase" })),
        )
            .into_response();
    }

    // Successful login — clear any tracked failures for this IP.
    {
        let mut attempts = state.login_attempts.lock().unwrap();
        attempts.remove(&ip);
    }

    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, auth::create_auth_cookie(&state.auth_key));

    (StatusCode::OK, headers, Json(serde_json::json!({ "success": true }))).into_response()
}

/// GET /api/auth/login — check current authentication status.
pub async fn handle_auth_check(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let authenticated = auth::is_authenticated(&headers, &state.auth_key);
    Json(serde_json::json!({ "authenticated": authenticated }))
}

/// POST /api/auth/logout — clear the auth cookie.
pub async fn handle_logout() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, auth::clear_auth_cookie());

    (StatusCode::OK, headers, Json(serde_json::json!({ "success": true })))
}

/// GET /api/auth/salt — return the E2EE salt for client-side key derivation.
pub async fn handle_salt(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(serde_json::json!({ "salt": state.salt }))
}
