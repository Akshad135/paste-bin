-- Migration: 0001_initial
-- Creates the pastes table and indexes

CREATE TABLE IF NOT EXISTS pastes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  language TEXT DEFAULT 'plaintext',
  visibility TEXT DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
  pinned INTEGER DEFAULT 0 CHECK(pinned IN (0, 1)),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pastes_slug ON pastes(slug);
CREATE INDEX IF NOT EXISTS idx_pastes_visibility ON pastes(visibility);
CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON pastes(created_at DESC);
