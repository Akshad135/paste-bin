use std::sync::Arc;
use sqlx::SqlitePool;
use tokio::sync::broadcast;

/// Shared application state passed to all route handlers.
pub struct AppState {
    pub db: SqlitePool,
    pub auth_key: String,
    pub dist_dir: String,
    pub ws_sender: broadcast::Sender<String>,
}

impl AppState {
    pub fn new(db: SqlitePool, auth_key: String, dist_dir: String) -> Self {
        // Create a broadcast channel with a capacity of 100 messages
        let (ws_sender, _) = broadcast::channel(100);
        Self {
            db,
            auth_key,
            dist_dir,
            ws_sender,
        }
    }
}

/// Type alias used throughout route handlers.
pub type SharedState = Arc<AppState>;
