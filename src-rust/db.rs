use sqlx::{Row, SqlitePool, sqlite::SqlitePoolOptions};
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

async fn table_has_column(pool: &SqlitePool, table: &str, column: &str) -> bool {
    let query = format!("PRAGMA table_info({table})");
    match sqlx::query(&query).fetch_all(pool).await {
        Ok(rows) => rows
            .iter()
            .any(|row| row.get::<String, _>("name") == column),
        Err(e) => {
            tracing::warn!("Failed to inspect {table} columns: {e}");
            false
        }
    }
}

async fn rebuild_pastes_for_burn_rules(pool: &SqlitePool) {
    tracing::info!("Rebuilding pastes table for Burn Rules migration");

    sqlx::query("PRAGMA foreign_keys = OFF;")
        .execute(pool)
        .await
        .ok();

    let statements = [
        "DROP TABLE IF EXISTS pastes_new",
        "CREATE TABLE pastes_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            language TEXT NOT NULL,
            pinned INTEGER NOT NULL DEFAULT 0,
            burn_trigger TEXT CHECK (burn_trigger IN ('time', 'unlock_count') OR burn_trigger IS NULL),
            burn_action TEXT NOT NULL DEFAULT 'delete' CHECK (burn_action IN ('revoke_share', 'delete')),
            burn_at TEXT,
            burn_after_unlocks INTEGER,
            burn_unlocks_used INTEGER NOT NULL DEFAULT 0,
            burn_pending_delete_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            encrypted_paste_key TEXT NOT NULL,
            share_wrapped_paste_key TEXT,
            share_auth_salt TEXT,
            share_auth_verifier TEXT
        )",
        "INSERT INTO pastes_new (
            id, slug, title, content, language, pinned,
            burn_trigger, burn_action, burn_at, burn_after_unlocks,
            burn_unlocks_used, burn_pending_delete_at,
            created_at, updated_at, encrypted_paste_key,
            share_wrapped_paste_key, share_auth_salt, share_auth_verifier
        )
        SELECT
            id, slug, title, content, language, pinned,
            CASE WHEN expires_at IS NOT NULL THEN 'time' ELSE NULL END,
            'delete',
            expires_at,
            NULL,
            0,
            NULL,
            created_at, updated_at, encrypted_paste_key,
            share_wrapped_paste_key, share_auth_salt, share_auth_verifier
        FROM pastes",
        "DROP TABLE pastes",
        "ALTER TABLE pastes_new RENAME TO pastes",
    ];

    for stmt in statements {
        if let Err(e) = sqlx::query(stmt).execute(pool).await {
            sqlx::query("PRAGMA foreign_keys = ON;")
                .execute(pool)
                .await
                .ok();
            panic!("Failed Burn Rules table rebuild: {e}\nStatement: {stmt}");
        }
    }

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(pool)
        .await
        .ok();
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

    for statement in schema.split(';') {
        let trimmed = statement.trim();
        if trimmed.is_empty() || trimmed.starts_with("--") {
            continue;
        }
        match sqlx::query(trimmed).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if trimmed.contains("idx_pastes_burn") && msg.contains("no such column") {
                    // Existing pre-Burn-Rules databases are rebuilt below before
                    // these indexes are created for real.
                    continue;
                }
                panic!("Failed to run migration: {e}\nStatement: {trimmed}");
            }
        }
    }

    // Clean migration from the old expiration model to Burn Rules. Existing
    // expiring pastes become time-triggered delete rules; the old column is removed.
    if table_has_column(pool, "pastes", "expires_at").await {
        rebuild_pastes_for_burn_rules(pool).await;
    }

    let alter_statements = [
        // Drop legacy columns that are no longer used.
        "ALTER TABLE pastes DROP COLUMN is_file",
        "ALTER TABLE pastes DROP COLUMN file_name",
        "ALTER TABLE pastes DROP COLUMN mime_type",
        "ALTER TABLE pastes DROP COLUMN file_size",
        "ALTER TABLE pastes DROP COLUMN encrypted_preview",
        "ALTER TABLE pastes DROP COLUMN shared_encrypted_key",
        "CREATE INDEX IF NOT EXISTS idx_pastes_burn_at ON pastes(burn_at)",
        "CREATE INDEX IF NOT EXISTS idx_pastes_burn_pending_delete_at ON pastes(burn_pending_delete_at)",
        "CREATE INDEX IF NOT EXISTS idx_pastes_burn_trigger ON pastes(burn_trigger)",
    ];

    for stmt in &alter_statements {
        match sqlx::query(stmt).execute(pool).await {
            Ok(_) => tracing::info!("Migration applied: {stmt}"),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column name")
                    || msg.contains("no such column")
                    || msg.contains("cannot drop")
                {
                    // Column/index state is already compatible enough for this idempotent migration.
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
