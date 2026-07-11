use std::sync::Arc;

use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::IntoResponse,
};
use serde::Serialize;
use sqlx::FromRow;
use tokio_util::io::ReaderStream;

use crate::auth;
use crate::slugs::generate_slug;
use crate::state::AppState;

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct FileEntry {
    pub id: i64,
    pub slug: String,
    pub paste_slug: Option<String>,
    pub file_name: String,
    pub mime_type: String,
    pub file_size: i64,
    pub created_at: String,
}

fn json_error(status: StatusCode, msg: &str) -> impl IntoResponse {
    (status, Json(serde_json::json!({ "error": msg })))
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// POST /api/file/upload — upload a file (not yet linked to a paste).
/// Returns the file's slug so the frontend can reference it when creating a paste.
pub async fn handle_upload(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut mime_type: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name == "file" {
            file_name = field.file_name().map(|s| s.to_string());
            mime_type = field.content_type().map(|s| s.to_string());
            match field.bytes().await {
                Ok(bytes) => {
                    if bytes.len() > state.max_file_size {
                        return json_error(
                            StatusCode::PAYLOAD_TOO_LARGE,
                            &format!(
                                "File too large. Maximum size is {} MB",
                                state.max_file_size / 1_048_576
                            ),
                        )
                        .into_response();
                    }
                    file_data = Some(bytes.to_vec());
                }
                Err(e) => {
                    tracing::error!("Failed to read file field: {e}");
                    return json_error(StatusCode::BAD_REQUEST, "Failed to read file")
                        .into_response();
                }
            }
        }
    }

    let Some(data) = file_data else {
        return json_error(StatusCode::BAD_REQUEST, "No file provided").into_response();
    };

    if data.is_empty() {
        return json_error(StatusCode::BAD_REQUEST, "File is empty").into_response();
    }

    // Generate a unique slug for this file
    let mut slug = generate_slug();
    for _ in 0..5 {
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM files WHERE slug = ?")
                .bind(&slug)
                .fetch_optional(&state.db)
                .await
                .unwrap_or(None);
        if exists.is_none() {
            break;
        }
        slug = generate_slug();
    }

    let file_size = data.len() as i64;
    let actual_file_name = file_name.unwrap_or_else(|| "unnamed".to_string());
    let actual_mime = mime_type.unwrap_or_else(|| "application/octet-stream".to_string());

    // Save the file to disk
    let file_path = std::path::Path::new(&state.uploads_dir).join(&slug);
    if let Err(e) = tokio::fs::write(&file_path, &data).await {
        tracing::error!("Failed to save file to disk: {e}");
        return json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to save file")
            .into_response();
    }

    // Insert into the files table (paste_slug is NULL — not linked yet)
    let result = sqlx::query(
        "INSERT INTO files (slug, file_name, mime_type, file_size) VALUES (?, ?, ?, ?)",
    )
    .bind(&slug)
    .bind(&actual_file_name)
    .bind(&actual_mime)
    .bind(file_size)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "slug": slug,
                "file_name": actual_file_name,
                "mime_type": actual_mime,
                "file_size": file_size,
            })),
        )
            .into_response(),
        Err(e) => {
            let _ = tokio::fs::remove_file(&file_path).await;
            tracing::error!("Failed to insert file record: {e}");
            json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to save file record")
                .into_response()
        }
    }
}

/// DELETE /api/file/:slug — delete a single file (must be authenticated).
pub async fn handle_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    let file: Option<FileEntry> = sqlx::query_as("SELECT * FROM files WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let Some(_file) = file else {
        return json_error(StatusCode::NOT_FOUND, "File not found").into_response();
    };

    match sqlx::query("DELETE FROM files WHERE slug = ?")
        .bind(&slug)
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            // Remove from disk
            let file_path = std::path::Path::new(&state.uploads_dir).join(&slug);
            if file_path.exists() {
                if let Err(e) = tokio::fs::remove_file(&file_path).await {
                    tracing::warn!("Failed to delete file from disk for {slug}: {e}");
                }
            }
            Json(serde_json::json!({ "success": true })).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to delete file record: {e}");
            json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete file").into_response()
        }
    }
}

/// GET /api/file/:slug — download a file.
pub async fn handle_download(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    // Look up the file
    let file: Option<FileEntry> = sqlx::query_as("SELECT * FROM files WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let Some(file) = file else {
        return json_error(StatusCode::NOT_FOUND, "File not found").into_response();
    };

    // Access control, mirroring the paste access rules in `paste::handle_get`:
    // - Authenticated (owner) requests can always download.
    // - Unauthenticated requests are only allowed if the file is linked to a
    //   paste that has an active new-scheme share (share_wrapped_paste_key is set).
    //   The legacy `shared_encrypted_key` column is intentionally NOT checked here
    //   — revoke/re-share always clears it, so trusting it would allow stale
    //   old-scheme grants to bypass revocation.
    // - Files not yet linked to any paste (e.g. uploaded but not attached)
    //   are never accessible without authentication.
    let mut paste_is_expired = false;
    let mut is_publicly_shared = false;

    if let Some(paste_slug) = &file.paste_slug {
        let paste_info: Option<(Option<String>, Option<String>)> =
            sqlx::query_as("SELECT share_wrapped_paste_key, expires_at FROM pastes WHERE slug = ?")
                .bind(paste_slug)
                .fetch_optional(&state.db)
                .await
                .unwrap_or(None);

        if let Some((share_wrapped, expires_at)) = paste_info {
            is_publicly_shared = share_wrapped.is_some();

            if let Some(exp) = expires_at {
                paste_is_expired = sqlx::query_scalar("SELECT ? <= datetime('now')")
                    .bind(exp)
                    .fetch_one(&state.db)
                    .await
                    .unwrap_or(false);
            }
        }
    }

    if paste_is_expired {
        return json_error(StatusCode::GONE, "The associated paste has expired").into_response();
    }

    if !auth::is_authenticated(&headers, &state.auth_key) {
        if !is_publicly_shared {
            return json_error(StatusCode::FORBIDDEN, "This file is private").into_response();
        }
    }

    // Stream the file back
    let file_path = std::path::Path::new(&state.uploads_dir).join(&slug);
    let disk_file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(e) => {
            tracing::error!("Failed to open file for slug {slug}: {e}");
            return json_error(StatusCode::NOT_FOUND, "File not found on disk").into_response();
        }
    };

    let stream = ReaderStream::new(disk_file);
    let body = Body::from_stream(stream);

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&file.mime_type).unwrap_or_else(|_| {
            HeaderValue::from_static("application/octet-stream")
        }),
    );
    resp_headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", file.file_name))
            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );
    resp_headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&file.file_size.to_string()).unwrap(),
    );

    (StatusCode::OK, resp_headers, body).into_response()
}

/// Helper: Link a list of file slugs to a paste_slug.
pub async fn link_files_to_paste(
    db: &sqlx::SqlitePool,
    paste_slug: &str,
    file_slugs: &[String],
) -> Result<(), sqlx::Error> {
    for slug in file_slugs {
        sqlx::query("UPDATE files SET paste_slug = ? WHERE slug = ? AND paste_slug IS NULL")
            .bind(paste_slug)
            .bind(slug)
            .execute(db)
            .await?;
    }
    Ok(())
}

/// Helper: Get all files linked to a paste.
pub async fn get_files_for_paste(
    db: &sqlx::SqlitePool,
    paste_slug: &str,
) -> Vec<FileEntry> {
    sqlx::query_as::<_, FileEntry>("SELECT * FROM files WHERE paste_slug = ? ORDER BY created_at ASC")
        .bind(paste_slug)
        .fetch_all(db)
        .await
        .unwrap_or_default()
}

/// Helper: Delete all files linked to a paste from disk.
pub async fn delete_files_for_paste(
    db: &sqlx::SqlitePool,
    uploads_dir: &str,
    paste_slug: &str,
) {
    let files = get_files_for_paste(db, paste_slug).await;
    for file in &files {
        let path = std::path::Path::new(uploads_dir).join(&file.slug);
        if path.exists() {
            if let Err(e) = tokio::fs::remove_file(&path).await {
                tracing::warn!("Failed to delete file {} from disk: {e}", file.slug);
            }
        }
    }
    // DB records are deleted by CASCADE when the paste is deleted
}
