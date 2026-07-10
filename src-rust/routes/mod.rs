use axum::{
    Router,
    routing::{get, post},
};

use crate::state::SharedState;

pub mod auth;
pub mod file;
pub mod paste;
pub mod ping;
pub mod stream;

/// Build the API sub-router (mounted at `/api`).
pub fn api_router() -> Router<SharedState> {
    Router::new()
        .route("/ping", get(ping::handle_ping))
        .route("/stream", get(stream::handle_stream))
        .route(
            "/auth/login",
            get(auth::handle_auth_check).post(auth::handle_login),
        )
        .route("/auth/logout", post(auth::handle_logout))
        .route("/auth/salt", get(auth::handle_salt))
        .route("/paste", get(paste::handle_list).post(paste::handle_create))
        .route("/paste/", get(paste::handle_list).post(paste::handle_create))
        .route(
            "/paste/{slug}",
            get(paste::handle_get)
                .put(paste::handle_update)
                .delete(paste::handle_delete),
        )
        // File endpoints
        .route("/file/upload", post(file::handle_upload))
        .route(
            "/file/{slug}",
            get(file::handle_download).delete(file::handle_delete),
        )
}
