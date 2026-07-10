use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use sqlx::SqlitePool;
use tokio::sync::broadcast;

/// Tracks recent failed login attempts from a single IP, for simple
/// fixed-window rate limiting.
pub struct LoginAttempts {
    pub count: u32,
    pub window_start: Instant,
}

/// Shared application state passed to all route handlers.
pub struct AppState {
    pub db: SqlitePool,
    pub auth_key: String,
    pub dist_dir: String,
    pub uploads_dir: String,
    pub max_upload_size: usize,
    pub salt: String,
    pub ws_sender: broadcast::Sender<String>,
    pub login_attempts: Mutex<HashMap<IpAddr, LoginAttempts>>,
}

impl AppState {
    pub fn new(
        db: SqlitePool,
        auth_key: String,
        dist_dir: String,
        uploads_dir: String,
        max_upload_size: usize,
        salt: String,
    ) -> Self {
        // Create a broadcast channel with a capacity of 100 messages
        let (ws_sender, _) = broadcast::channel(100);
        Self {
            db,
            auth_key,
            dist_dir,
            uploads_dir,
            max_upload_size,
            salt,
            ws_sender,
            login_attempts: Mutex::new(HashMap::new()),
        }
    }
}

/// Type alias used throughout route handlers.
pub type SharedState = Arc<AppState>;
