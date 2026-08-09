-- ============================================================================
-- SGSD Phase 46 - context-cache schema (SQLite FTS5 projection)
-- ============================================================================
-- Source: 46-01-sqlite-context-index-PLAN.md <schema_ddl>
-- Controlling correctness: SCHEMA_VERSION = 1 (PRAGMA user_version).
-- A4 binding: source_path NOT NULL + source_hash NOT NULL on documents.
-- A3 binding: rebuild from canonical = byte-identical manifest_hash.
-- Phase 46 owns ALL writes to .planning/cache/context-index.db.
-- ============================================================================

PRAGMA user_version = 1;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS documents (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  kind               TEXT NOT NULL CHECK (kind IN ('capsule','decision','gate_definition','file_summary')),
  doc_id             TEXT NOT NULL,
  milestone          TEXT,
  phase              TEXT,
  source_path        TEXT NOT NULL,
  source_hash        TEXT NOT NULL,
  source_byte_offset INTEGER,
  source_byte_length INTEGER,
  title              TEXT,
  body               TEXT NOT NULL,
  indexed_at         TEXT NOT NULL,
  UNIQUE (kind, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_kind         ON documents(kind);
CREATE INDEX IF NOT EXISTS idx_documents_ms_phase     ON documents(milestone, phase);
CREATE INDEX IF NOT EXISTS idx_documents_source_hash  ON documents(source_hash);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  body,
  title,
  kind UNINDEXED,
  content='documents',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, body, title, kind)
    VALUES (new.id, new.body, new.title, new.kind);
END;

CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, body, title, kind)
    VALUES ('delete', old.id, old.body, old.title, old.kind);
END;
