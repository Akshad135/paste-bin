use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

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
        if !trimmed.is_empty() {
            sqlx::query(trimmed)
                .execute(pool)
                .await
                .unwrap_or_else(|e| panic!("Failed to run migration: {e}\nStatement: {trimmed}"));
        }
    }

    tracing::info!("Schema migrations applied");
}
