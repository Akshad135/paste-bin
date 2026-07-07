use std::sync::Arc;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
};
use serde::Deserialize;

use crate::auth;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct LoginBody {
    passphrase: Option<String>,
}

/// POST /api/auth/login — authenticate with a passphrase.
pub async fn handle_login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginBody>,
) -> impl IntoResponse {
    let Some(passphrase) = body.passphrase.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Passphrase is required" })),
        )
            .into_response();
    };

    if passphrase != state.auth_key {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid passphrase" })),
        )
            .into_response();
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
