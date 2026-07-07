use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::auth;
use crate::expiry::{NOT_EXPIRED_CLAUSE, compute_expires_at};
use crate::slugs::generate_slug;
use crate::state::AppState;

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Paste {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub visibility: String,
    pub pinned: i32,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// A lighter version returned from list queries (includes preview).
#[derive(Debug, Serialize, FromRow)]
pub struct PasteListItem {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub visibility: String,
    pub pinned: i32,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub preview: Option<String>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    page: Option<u32>,
    limit: Option<u32>,
}

#[derive(Deserialize)]
pub struct CreatePasteBody {
    title: Option<String>,
    content: String,
    language: Option<String>,
    visibility: Option<String>,
    pinned: Option<i32>,
    expires_in: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePasteBody {
    title: Option<String>,
    content: Option<String>,
    language: Option<String>,
    visibility: Option<String>,
    pinned: Option<i32>,
    expires_in: Option<String>,
}

// ─── JSON response helpers ──────────────────────────────────────────────────

fn json_error(status: StatusCode, msg: &str) -> impl IntoResponse {
    (status, Json(serde_json::json!({ "error": msg })))
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// GET /api/paste — list pastes with pagination.
pub async fn handle_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ListQuery>,
) -> impl IntoResponse {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(50);
    let offset = (page - 1) * limit;

    let authenticated = auth::is_authenticated(&headers, &state.auth_key);
    let where_clause = if authenticated {
        format!("WHERE {NOT_EXPIRED_CLAUSE}")
    } else {
        format!("WHERE {NOT_EXPIRED_CLAUSE} AND visibility = 'public'")
    };

    let query = format!(
        "SELECT id, slug, title, content, language, visibility, pinned, expires_at, \
         created_at, updated_at, substr(content, 1, 200) as preview \
         FROM pastes {where_clause} ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?"
    );

    let pastes: Vec<PasteListItem> = match sqlx::query_as(&query)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to list pastes: {e}");
            return json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to load pastes")
                .into_response();
        }
    };

    let count_query = format!("SELECT COUNT(*) as total FROM pastes {where_clause}");
    let total: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(serde_json::json!({
        "pastes": pastes,
        "total": total,
        "page": page,
        "limit": limit,
        "hasMore": (offset + limit) < total as u32,
    }))
    .into_response()
}

/// POST /api/paste — create a new paste.
pub async fn handle_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreatePasteBody>,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    if body.content.trim().is_empty() {
        return json_error(StatusCode::BAD_REQUEST, "Content is required").into_response();
    }

    // Generate a unique slug (retry up to 5 times)
    let mut slug = generate_slug();
    for _ in 0..5 {
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM pastes WHERE slug = ?")
                .bind(&slug)
                .fetch_optional(&state.db)
                .await
                .unwrap_or(None);
        if exists.is_none() {
            break;
        }
        slug = generate_slug();
    }

    let expires_at = compute_expires_at(body.expires_in.as_deref());
    let title = body.title.unwrap_or_default();
    let language = body.language.unwrap_or_else(|| "plaintext".to_string());
    let visibility = body.visibility.unwrap_or_else(|| "private".to_string());
    let pinned = if body.pinned.unwrap_or(0) != 0 { 1 } else { 0 };

    let result = sqlx::query(
        "INSERT INTO pastes (slug, title, content, language, visibility, pinned, expires_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&slug)
    .bind(&title)
    .bind(&body.content)
    .bind(&language)
    .bind(&visibility)
    .bind(pinned)
    .bind(&expires_at)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let msg = serde_json::json!({ "type": "paste_created", "slug": slug });
            let _ = state.ws_sender.send(msg.to_string());
            (
                StatusCode::CREATED,
                Json(serde_json::json!({ "slug": slug, "success": true })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to create paste: {e}");
            json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create paste").into_response()
        }
    }
}

/// GET /api/paste/:slug — get a single paste.
pub async fn handle_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let paste: Option<Paste> = sqlx::query_as("SELECT * FROM pastes WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let Some(paste) = paste else {
        return json_error(StatusCode::NOT_FOUND, "Paste not found").into_response();
    };

    // Check expiration
    if let Some(ref exp) = paste.expires_at {
        let expired: bool = sqlx::query_scalar(
            "SELECT ? <= datetime('now')",
        )
        .bind(exp)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false);

        if expired {
            return json_error(StatusCode::GONE, "This paste has expired").into_response();
        }
    }

    if paste.visibility == "private" && !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::FORBIDDEN, "This paste is private").into_response();
    }

    Json(serde_json::json!({ "paste": paste })).into_response()
}

/// PUT /api/paste/:slug — update a paste.
pub async fn handle_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(body): Json<UpdatePasteBody>,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM pastes WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if exists.is_none() {
        return json_error(StatusCode::NOT_FOUND, "Paste not found").into_response();
    }

    let mut updates: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();

    if let Some(ref title) = body.title {
        updates.push("title = ?".to_string());
        values.push(title.clone());
    }
    if let Some(ref content) = body.content {
        updates.push("content = ?".to_string());
        values.push(content.clone());
    }
    if let Some(ref language) = body.language {
        updates.push("language = ?".to_string());
        values.push(language.clone());
    }
    if let Some(ref visibility) = body.visibility {
        updates.push("visibility = ?".to_string());
        values.push(visibility.clone());
    }
    if let Some(pinned) = body.pinned {
        updates.push("pinned = ?".to_string());
        values.push(pinned.to_string());
    }
    if let Some(ref expires_in) = body.expires_in {
        updates.push("expires_at = ?".to_string());
        let exp = compute_expires_at(Some(expires_in.as_str()));
        values.push(exp.unwrap_or_default());
    }

    if updates.is_empty() {
        return json_error(StatusCode::BAD_REQUEST, "No fields to update").into_response();
    }

    updates.push("updated_at = datetime('now')".to_string());

    // Build the dynamic query — we need to bind values dynamically
    let set_clause = updates.join(", ");
    let sql = format!("UPDATE pastes SET {set_clause} WHERE slug = ?");

    // sqlx doesn't support dynamic bind easily, so we use query_builder approach
    let mut query = sqlx::query(&sql);
    for val in &values {
        query = query.bind(val);
    }
    query = query.bind(&slug);

    match query.execute(&state.db).await {
        Ok(_) => {
            let msg = serde_json::json!({ "type": "paste_updated", "slug": slug });
            let _ = state.ws_sender.send(msg.to_string());
            Json(serde_json::json!({ "success": true })).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to update paste: {e}");
            json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update paste").into_response()
        }
    }
}

/// DELETE /api/paste/:slug — delete a paste.
pub async fn handle_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM pastes WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if exists.is_none() {
        return json_error(StatusCode::NOT_FOUND, "Paste not found").into_response();
    }

    match sqlx::query("DELETE FROM pastes WHERE slug = ?")
        .bind(&slug)
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            let msg = serde_json::json!({ "type": "paste_deleted", "slug": slug });
            let _ = state.ws_sender.send(msg.to_string());
            Json(serde_json::json!({ "success": true })).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to delete paste: {e}");
            json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete paste").into_response()
        }
    }
}
