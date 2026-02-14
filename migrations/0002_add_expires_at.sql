-- Migration: 0002_add_expires_at
-- Adds expiration support for time-based pastes

ALTER TABLE pastes ADD COLUMN expires_at TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pastes_expires_at ON pastes(expires_at);
