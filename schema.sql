CREATE TABLE IF NOT EXISTS pastes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    burn_trigger TEXT CHECK (burn_trigger IN ('time', 'unlock_count') OR burn_trigger IS NULL),
    burn_action TEXT NOT NULL DEFAULT 'delete' CHECK (burn_action IN ('revoke_share', 'delete')),
    burn_at TEXT,
    burn_after_unlocks INTEGER CHECK (burn_after_unlocks IS NULL OR (burn_after_unlocks > 0 AND burn_after_unlocks <= 100000)),
    burn_unlocks_used INTEGER NOT NULL DEFAULT 0 CHECK (burn_unlocks_used >= 0),
    burn_pending_delete_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    encrypted_paste_key TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_pastes_burn_at ON pastes(burn_at);
CREATE INDEX IF NOT EXISTS idx_pastes_burn_pending_delete_at ON pastes(burn_pending_delete_at);
CREATE INDEX IF NOT EXISTS idx_pastes_burn_trigger ON pastes(burn_trigger);