CREATE TABLE IF NOT EXISTS pastes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_file INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    encrypted_paste_key TEXT NOT NULL,
    encrypted_preview TEXT,
    share_wrapped_paste_key TEXT,
    share_auth_salt TEXT,
    share_auth_verifier TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    paste_slug TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    file_size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paste_slug) REFERENCES pastes(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pastes_expires_at ON pastes(expires_at);
