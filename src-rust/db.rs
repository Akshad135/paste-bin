use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use std::path::Path;

/// Create and return a SQLite connection pool.
pub async fn init_pool(db_path: &str) -> SqlitePool {
    let url = format!("sqlite:{db_path}?mode=rwc");

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .expect("Failed to connect to SQLite database")
}

/// Run the schema migration (CREATE TABLE IF NOT EXISTS).
pub async fn run_migrations(pool: &SqlitePool) {
    // Enable WAL mode for better concurrent read performance
    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(pool)
        .await
        .ok();

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(pool)
        .await
        .ok();

    let schema = include_str!("../schema.sql");

    // Execute each statement separately (sqlx doesn't support multi-statement execute)
    for statement in schema.split(';') {
        let trimmed = statement.trim();
        if trimmed.is_empty() || trimmed.starts_with("--") {
            continue;
        }
        sqlx::query(trimmed)
            .execute(pool)
            .await
            .unwrap_or_else(|e| panic!("Failed to run migration: {e}\nStatement: {trimmed}"));
    }

    // Column migrations: add new columns for existing databases.
    // Each statement ignores "duplicate column name" so it is idempotent.
    let alter_statements = [
        // Drop legacy columns that are no longer used
        "ALTER TABLE pastes DROP COLUMN is_file",
        "ALTER TABLE pastes DROP COLUMN file_name",
        "ALTER TABLE pastes DROP COLUMN mime_type",
        "ALTER TABLE pastes DROP COLUMN file_size",
        "ALTER TABLE pastes DROP COLUMN encrypted_preview",
        "ALTER TABLE pastes DROP COLUMN shared_encrypted_key",
        
        // New secure-share columns
        "ALTER TABLE pastes ADD COLUMN share_wrapped_paste_key TEXT",
        "ALTER TABLE pastes ADD COLUMN share_auth_salt TEXT",
        "ALTER TABLE pastes ADD COLUMN share_auth_verifier TEXT",
        "CREATE INDEX IF NOT EXISTS idx_pastes_expires_at ON pastes(expires_at)",
    ];

    for stmt in &alter_statements {
        match sqlx::query(stmt).execute(pool).await {
            Ok(_) => tracing::info!("Migration applied: {stmt}"),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column name") {
                    // Column already exists — this is fine
                } else {
                    tracing::warn!("Migration skipped ({stmt}): {msg}");
                }
            }
        }
    }

    tracing::info!("Schema migrations applied");
}

/// Ensure a persistent salt file exists in the data directory.
/// If it doesn't exist, generate 32 random bytes, base64-encode them,
/// and write to `{data_dir}/salt.txt`. Returns the base64-encoded salt.
pub fn ensure_salt(data_dir: &str) -> String {
    let salt_path = Path::new(data_dir).join("salt.txt");
    if salt_path.exists() {
        return std::fs::read_to_string(&salt_path)
            .expect("Failed to read salt.txt")
            .trim()
            .to_string();
    }

    use base64::Engine;
    use rand::Rng;

    let mut rng = rand::rng();
    let mut salt_bytes = [0u8; 32];
    rng.fill(&mut salt_bytes);
    let salt = base64::engine::general_purpose::STANDARD.encode(salt_bytes);

    std::fs::create_dir_all(data_dir).expect("Failed to create data directory for salt");
    std::fs::write(&salt_path, &salt).expect("Failed to write salt.txt");
    tracing::info!("Generated new E2EE salt at {}", salt_path.display());

    salt
}
