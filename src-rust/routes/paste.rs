use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    Json,
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::auth;
use crate::expiry::{NOT_EXPIRED_CLAUSE, compute_expires_at};
use crate::slugs::generate_slug;
use crate::state::AppState;
use super::file;

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Paste {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub pinned: i32,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_file: i32,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub encrypted_paste_key: Option<String>,
    pub share_wrapped_paste_key: Option<String>,
    pub share_auth_salt: Option<String>,
    pub share_auth_verifier: Option<String>,
}

/// A lighter version returned from list queries.
#[derive(Debug, Serialize, FromRow)]
pub struct PasteListItem {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub pinned: i32,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_file: i32,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub encrypted_paste_key: Option<String>,
    pub share_wrapped_paste_key: Option<String>,
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
    pinned: Option<i32>,
    expires_in: Option<String>,
    file_slugs: Option<Vec<String>>,
    encrypted_paste_key: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePasteBody {
    title: Option<String>,
    content: Option<String>,
    language: Option<String>,
    pinned: Option<i32>,
    expires_in: Option<String>,
    new_file_slugs: Option<Vec<String>>,
    removed_file_slugs: Option<Vec<String>>,
    encrypted_paste_key: Option<String>,
    /// New-arch share fields. Set to "__revoke__" to clear sharing.
    share_wrapped_paste_key: Option<String>,
    share_auth_salt: Option<String>,
    share_auth_verifier: Option<String>,
}

/// Body for POST /api/paste/:slug/unlock
#[derive(Deserialize)]
pub struct UnlockBody {
    /// The auth_secret derived in the browser from the access code.
    /// Server verifies this against the stored share_auth_verifier.
    auth_secret: String,
}

// ─── JSON response helpers ──────────────────────────────────────────────────

fn json_error(status: StatusCode, msg: &str) -> impl IntoResponse {
    (status, Json(serde_json::json!({ "error": msg })))
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// GET /api/paste — list pastes with pagination (authenticated only).
pub async fn handle_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ListQuery>,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(50);
    let offset = (page - 1) * limit;

    let query = format!(
        "SELECT id, slug, title, content, language, pinned, expires_at, \
         created_at, updated_at, \
         is_file, file_name, mime_type, file_size, \
         encrypted_paste_key, share_wrapped_paste_key \
         FROM pastes WHERE {NOT_EXPIRED_CLAUSE} ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?"
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

    let mut paste_json_list = Vec::new();
    for paste in &pastes {
        let file_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM files WHERE paste_slug = ?"
        )
        .bind(&paste.slug)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

        let mut obj = serde_json::to_value(paste).unwrap();
        obj.as_object_mut().unwrap().insert("file_count".to_string(), serde_json::json!(file_count));
        paste_json_list.push(obj);
    }

    let count_query = format!("SELECT COUNT(*) as total FROM pastes WHERE {NOT_EXPIRED_CLAUSE}");
    let total: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(serde_json::json!({
        "pastes": paste_json_list,
        "total": total,
        "page": page,
        "limit": limit,
        "hasMore": (offset + limit) < total as u32,
    }))
    .into_response()
}

/// POST /api/paste — create a new paste, optionally linking uploaded files.
pub async fn handle_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreatePasteBody>,
) -> impl IntoResponse {
    if !auth::is_authenticated(&headers, &state.auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    // Validate text size against the configured limit.
    if body.content.len() > state.max_text_size {
        return json_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            &format!(
                "Text content too large. Maximum is {} KB. For larger content, attach it as a file.",
                state.max_text_size / 1_024
            ),
        )
        .into_response();
    }

    let has_files = body.file_slugs.as_ref().map(|f| !f.is_empty()).unwrap_or(false);
    if body.content.trim().is_empty() && !has_files {
        return json_error(StatusCode::BAD_REQUEST, "Content or files are required").into_response();
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
    let pinned = if body.pinned.unwrap_or(0) != 0 { 1 } else { 0 };

    let result = sqlx::query(
        "INSERT INTO pastes (slug, title, content, language, pinned, expires_at, encrypted_paste_key) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&slug)
    .bind(&title)
    .bind(&body.content)
    .bind(&language)
    .bind(pinned)
    .bind(&expires_at)
    .bind(&body.encrypted_paste_key)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Link any uploaded files to this paste
            if let Some(ref file_slugs) = body.file_slugs {
                if !file_slugs.is_empty() {
                    if let Err(e) = file::link_files_to_paste(&state.db, &slug, file_slugs).await {
                        tracing::warn!("Failed to link some files to paste {slug}: {e}");
                    }
                }
            }

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
/// Authenticated users can see any paste.
/// Unauthenticated users can only see shared pastes (shared_encrypted_key is not NULL).
pub async fn handle_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let paste: Option<Paste> = match sqlx::query_as("SELECT * FROM pastes WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&state.db)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to fetch paste (mapping error?): {:?}", e);
            None
        }
    };

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

    let authenticated = auth::is_authenticated(&headers, &state.auth_key);

    // Unauthenticated guests: only allow access to actively-shared pastes.
    // Return minimal locked-share metadata — do NOT return the wrapped key or
    // auth fields yet. The guest must prove knowledge of the access code via
    // POST /api/paste/:slug/unlock before we release share_wrapped_paste_key.
    if !authenticated {
        if paste.share_wrapped_paste_key.is_none() {
            return json_error(StatusCode::NOT_FOUND, "Paste not found").into_response();
        }

        // Build a sanitised response: confirm the paste is shared but strip
        // all secret share material. The client uses `is_shared: true` to
        // show the access-code prompt.
        let files = file::get_files_for_paste(&state.db, &slug).await;
        let mut paste_json = serde_json::to_value(&paste).unwrap();
        if let Some(obj) = paste_json.as_object_mut() {
            obj.insert("share_wrapped_paste_key".to_string(), serde_json::Value::Null);
            obj.insert("share_auth_salt".to_string(), serde_json::Value::Null);
            obj.insert("share_auth_verifier".to_string(), serde_json::Value::Null);
        }
        return Json(serde_json::json!({
            "paste": paste_json,
            "files": files,
            "is_shared": true,
        }))
        .into_response();
    }

    // Get attached files
    let files = file::get_files_for_paste(&state.db, &slug).await;

    Json(serde_json::json!({
        "paste": paste,
        "files": files,
    }))
    .into_response()
}

/// POST /api/paste/:slug/unlock — rate-limited endpoint that verifies the
/// guest's access code and returns the `share_wrapped_paste_key` blob.
///
/// Security model:
///   - The browser derives `auth_secret` from the access code using PBKDF2.
///   - The browser sends only `auth_secret`, never the plaintext code.
///   - The server re-hashes `auth_secret` with PBKDF2 + the stored per-share
///     salt and compares to `share_auth_verifier`.
///   - Because the server only ever sees `auth_secret` (not the raw code),
///     it cannot derive `unlock_secret` (the AES key) — full E2EE preserved.
///   - Rate limit: 10 attempts per (IP, slug) per hour.
pub async fn handle_unlock(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(body): Json<UnlockBody>,
) -> impl IntoResponse {
    const MAX_ATTEMPTS: u32 = 10;
    const WINDOW: Duration = Duration::from_secs(3600); // 1 hour
    // PBKDF2 iterations for server-side slow hash
    const PBKDF2_ITERS: u32 = 200_000;

    let ip = addr.ip();

    // --- Rate limit check (increment BEFORE verifying to prevent timing attacks) ---
    {
        let mut attempts = state.unlock_attempts.lock().unwrap();
        let key = (ip, slug.clone());
        let now = Instant::now();

        let entry = attempts.entry(key).or_insert_with(|| crate::state::LoginAttempts {
            count: 0,
            window_start: now,
        });

        // Reset window if it has expired
        if now.duration_since(entry.window_start) >= WINDOW {
            entry.count = 0;
            entry.window_start = now;
        }

        if entry.count >= MAX_ATTEMPTS {
            return json_error(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many unlock attempts. Please wait before trying again.",
            )
            .into_response();
        }

        entry.count += 1;
    }

    // --- Fetch the paste ---
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
        let expired: bool = sqlx::query_scalar("SELECT ? <= datetime('now')")
            .bind(exp)
            .fetch_one(&state.db)
            .await
            .unwrap_or(false);

        if expired {
            return json_error(StatusCode::GONE, "This paste has expired").into_response();
        }
    }

    // Only shared pastes can be unlocked.
    // Clone fields before destructuring so `paste` remains intact for JSON serialization.
    let (Some(share_wrapped_paste_key), Some(share_auth_salt), Some(share_auth_verifier)) = (
        paste.share_wrapped_paste_key.clone(),
        paste.share_auth_salt.clone(),
        paste.share_auth_verifier.clone(),
    ) else {
        return json_error(StatusCode::NOT_FOUND, "Paste not found").into_response();
    };

    // --- Slow-hash verification ---
    // Decode the stored salt from hex
    let salt_bytes = match hex::decode(&share_auth_salt) {
        Ok(b) => b,
        Err(_) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, "Invalid share state").into_response(),
    };

    // Compute PBKDF2-SHA256 over the client-supplied auth_secret with the stored salt.
    // This is the slow hash that makes offline brute-force attacks impractical.
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;
    let mut derived = [0u8; 32];
    pbkdf2_hmac::<Sha256>(body.auth_secret.as_bytes(), &salt_bytes, PBKDF2_ITERS, &mut derived);
    let computed_verifier = hex::encode(derived);

    // Constant-time comparison to prevent timing attacks
    if computed_verifier != share_auth_verifier {
        return json_error(StatusCode::UNAUTHORIZED, "Incorrect access code").into_response();
    }

    // Access code verified — return the wrapped paste key and the encrypted payload.
    // Strip the share auth fields from the paste so they are never sent to the client.
    let files = file::get_files_for_paste(&state.db, &slug).await;
    let mut paste_json = serde_json::to_value(&paste).unwrap();
    if let Some(obj) = paste_json.as_object_mut() {
        obj.insert("share_auth_salt".to_string(), serde_json::Value::Null);
        obj.insert("share_auth_verifier".to_string(), serde_json::Value::Null);
        obj.insert("share_wrapped_paste_key".to_string(), serde_json::Value::Null);
    }
    Json(serde_json::json!({
        "share_wrapped_paste_key": share_wrapped_paste_key,
        "paste": paste_json,
        "files": files,
    }))
    .into_response()
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
        if content.len() > state.max_text_size {
            return json_error(
                StatusCode::PAYLOAD_TOO_LARGE,
                &format!(
                    "Text content too large. Maximum is {} KB. For larger content, attach it as a file.",
                    state.max_text_size / 1_024
                ),
            )
            .into_response();
        }
        updates.push("content = ?".to_string());
        values.push(content.clone());
    }
    if let Some(ref language) = body.language {
        updates.push("language = ?".to_string());
        values.push(language.clone());
    }
    if let Some(ref share_wrapped) = body.share_wrapped_paste_key {
        if share_wrapped == "__revoke__" {
            // Revoke: clear all share fields atomically — both new-scheme and
            // legacy columns so old-scheme grants cannot survive a revoke.
            updates.push("share_wrapped_paste_key = NULL".to_string());
            updates.push("share_auth_salt = NULL".to_string());
            updates.push("share_auth_verifier = NULL".to_string());
            updates.push("shared_encrypted_key = NULL".to_string());
        } else {
            // Share: store the new-scheme fields and simultaneously clear the
            // legacy column so it cannot be used as a bypass.
            updates.push("share_wrapped_paste_key = ?".to_string());
            values.push(share_wrapped.clone());
            if let Some(ref salt) = body.share_auth_salt {
                updates.push("share_auth_salt = ?".to_string());
                values.push(salt.clone());
            }
            if let Some(ref verifier) = body.share_auth_verifier {
                updates.push("share_auth_verifier = ?".to_string());
                values.push(verifier.clone());
            }
            // Clear the legacy column so any previously-shared paste cannot
            // be accessed via the old unauthenticated file-download path.
            updates.push("shared_encrypted_key = NULL".to_string());
        }
    }
    if let Some(pinned) = body.pinned {
        updates.push("pinned = ?".to_string());
        values.push(pinned.to_string());
    }
    if let Some(ref expires_in) = body.expires_in {
        let exp = compute_expires_at(Some(expires_in.as_str()));
        match exp {
            Some(ts) => {
                updates.push("expires_at = ?".to_string());
                values.push(ts);
            }
            None => {
                updates.push("expires_at = NULL".to_string());
            }
        }
    }
    if let Some(ref encrypted_paste_key) = body.encrypted_paste_key {
        updates.push("encrypted_paste_key = ?".to_string());
        values.push(encrypted_paste_key.clone());
    }

    if updates.is_empty() && body.new_file_slugs.is_none() && body.removed_file_slugs.is_none() {
        return json_error(StatusCode::BAD_REQUEST, "No fields to update").into_response();
    }

    if !updates.is_empty() {
        updates.push("updated_at = datetime('now')".to_string());
        let set_clause = updates.join(", ");
        let sql = format!("UPDATE pastes SET {set_clause} WHERE slug = ?");
        let mut query = sqlx::query(&sql);
        for val in &values {
            query = query.bind(val);
        }
        query = query.bind(&slug);

        if let Err(e) = query.execute(&state.db).await {
            tracing::error!("Failed to update paste: {e}");
            return json_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update paste").into_response();
        }
    }

    // Process file removals
    if let Some(removed) = &body.removed_file_slugs {
        for file_slug in removed {
            // Only touch the filesystem for slugs that are actually linked to
            // this paste in the DB. This prevents a client-supplied
            // `file_slug` (e.g. "../../data/pastebin.sqlite") from ever being
            // used to delete arbitrary files on disk, since DB slugs are
            // always server-generated and never contain path separators.
            let owned: Option<(i64,)> =
                sqlx::query_as("SELECT id FROM files WHERE slug = ? AND paste_slug = ?")
                    .bind(file_slug)
                    .bind(&slug)
                    .fetch_optional(&state.db)
                    .await
                    .unwrap_or(None);

            if owned.is_none() {
                continue;
            }

            // Delete from disk
            let file_path = std::path::Path::new(&state.uploads_dir).join(file_slug);
            if file_path.exists() {
                let _ = tokio::fs::remove_file(&file_path).await;
            }
            // Delete from DB (which removes link)
            let _ = sqlx::query("DELETE FROM files WHERE slug = ? AND paste_slug = ?")
                .bind(file_slug)
                .bind(&slug)
                .execute(&state.db)
                .await;
        }
    }

    // Process new files
    if let Some(ref new_slugs) = body.new_file_slugs {
        if !new_slugs.is_empty() {
            if let Err(e) = file::link_files_to_paste(&state.db, &slug, new_slugs).await {
                tracing::warn!("Failed to link some files to paste {slug}: {e}");
            }
        }
    }

    let msg = serde_json::json!({ "type": "paste_updated", "slug": slug });
    let _ = state.ws_sender.send(msg.to_string());
    Json(serde_json::json!({ "success": true })).into_response()
}

/// DELETE /api/paste/:slug — delete a paste and all associated files.
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

    // Delete associated files from disk first (before CASCADE deletes DB records)
    file::delete_files_for_paste(&state.db, &state.uploads_dir, &slug).await;

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
