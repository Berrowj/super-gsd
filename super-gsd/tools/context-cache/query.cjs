// ============================================================================
// SGSD - context-cache/query.cjs (Phase 46 -- INDEX-04)
// ============================================================================
// FTS5 read-only query API: query() + querySnippet() + open() + close().
// Per-row Phase 44 validateOne filter (default filter_invalid:true).
//
// Sources:
//   46-RESEARCH.md sec 6 (FTS5 MATCH + bm25 + snippet),
//                  sec 6.4 (validateOne filter at query time),
//                  sec 7.4 (limit clamp).
//   46-01 PLAN <task T3>.
//
// Lock 13: never throws upward. Returns [] on error.
// Read-only: opens DB with SQLITE_OPEN_READONLY. NEVER writes.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (_e) {
  Database = null;
}

let phase44 = null;
try {
  phase44 = require(path.join(__dirname, '..', 'context-registry', 'check.cjs'));
} catch (_e) {
  phase44 = null;
}

const rebuildMod = require('./rebuild.cjs');
const KIND_VOCAB = rebuildMod.KIND_VOCAB;
const DB_PATH = rebuildMod.DB_PATH;
const QUERY_LIMIT_DEFAULT = rebuildMod.QUERY_LIMIT_DEFAULT;
const QUERY_LIMIT_MAX = rebuildMod.QUERY_LIMIT_MAX;
const SNIPPET_TOKEN_BUDGET = rebuildMod.SNIPPET_TOKEN_BUDGET;

// Singleton handle cache (per resolved dbPath).
const _handleCache = new Map();

function _resolveDbPath(opts) {
  if (opts && opts.dbPath) return path.resolve(opts.dbPath);
  return path.resolve(path.join(__dirname, '..', '..', '..', DB_PATH));
}

function open(opts) {
  try {
    if (!Database) return null;
    const dbPath = _resolveDbPath(opts);
    if (!fs.existsSync(dbPath)) return null;
    if (_handleCache.has(dbPath)) return _handleCache.get(dbPath);
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    _handleCache.set(dbPath, db);
    return db;
  } catch (_e) {
    return null;
  }
}

function close() {
  try {
    for (const [k, db] of _handleCache.entries()) {
      try { db.close(); } catch (_e) {}
      _handleCache.delete(k);
    }
  } catch (_e) {}
}

// FTS5 has its own query syntax; double-quotes wrap phrases.
// Strip double-quote characters and other control bytes so user text
// becomes a safe term-list. AND/OR are still recognized as operators
// but that is acceptable per RESEARCH sec 6.2.
function _sanitizeFtsText(text) {
  if (typeof text !== 'string') return '';
  // Replace " and \\ and control chars with space; collapse whitespace.
  return text.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function _normalizeQueryOpts(opts) {
  opts = opts || {};
  let kinds = null;
  if (Array.isArray(opts.kinds)) {
    const filtered = opts.kinds.filter(function (k) {
      return KIND_VOCAB.includes(k);
    });
    if (filtered.length > 0) kinds = filtered;
  }
  let limit = QUERY_LIMIT_DEFAULT;
  if (typeof opts.limit === 'number' && Number.isFinite(opts.limit)) {
    limit = Math.max(1, Math.min(Math.floor(opts.limit), QUERY_LIMIT_MAX));
  }
  return {
    kinds: kinds,
    kindsJson: kinds ? JSON.stringify(kinds) : null,
    limit: limit,
    milestone: typeof opts.milestone === 'string' ? opts.milestone : null,
    phase: typeof opts.phase === 'string' ? opts.phase : null,
    filter_invalid: opts.filter_invalid !== false,
    dbPath: opts.dbPath || null,
    registryPath: opts.registryPath || null,
  };
}

function _validateRowAgainstRegistry(row, opts) {
  if (!phase44 || typeof phase44.validateOne !== 'function') {
    row.registry_valid = true;
    return row;
  }
  if (row.kind !== 'capsule' || !row.milestone || !row.phase) {
    row.registry_valid = true;
    return row;
  }
  try {
    const key = row.milestone + '/' + row.phase;
    const res = phase44.validateOne(key, 'phases', opts && opts.registryPath ? { registryPath: opts.registryPath } : undefined);
    row.registry_valid = !!(res && res.valid);
  } catch (_e) {
    row.registry_valid = true;
  }
  return row;
}

function query(text, opts) {
  try {
    if (typeof text !== 'string' || !text.trim()) return [];
    const normOpts = _normalizeQueryOpts(opts);
    if (!Database) return [];
    const db = open(normOpts);
    if (!db) return [];
    const matchText = _sanitizeFtsText(text);
    if (!matchText) return [];
    const sql =
      'SELECT ' +
      '  d.kind, d.doc_id, d.milestone, d.phase, d.source_path, ' +
      '  d.source_hash, d.source_byte_offset, d.source_byte_length, ' +
      '  d.title, ' +
      "  snippet(documents_fts, 0, '[hl]', '[/hl]', '...', " + SNIPPET_TOKEN_BUDGET + ') AS snippet, ' +
      '  -bm25(documents_fts) AS score ' +
      'FROM documents_fts ' +
      'JOIN documents d ON d.id = documents_fts.rowid ' +
      'WHERE documents_fts MATCH @text ' +
      '  AND (@kindsJson IS NULL OR d.kind IN (SELECT value FROM json_each(@kindsJson))) ' +
      '  AND (@milestone IS NULL OR d.milestone = @milestone) ' +
      '  AND (@phase IS NULL OR d.phase = @phase) ' +
      'ORDER BY score DESC ' +
      'LIMIT @limit';
    let stmt;
    try {
      stmt = db.prepare(sql);
    } catch (e) {
      return [];
    }
    let rows = [];
    try {
      rows = stmt.all({
        text: matchText,
        kindsJson: normOpts.kindsJson,
        milestone: normOpts.milestone,
        phase: normOpts.phase,
        limit: normOpts.limit,
      });
    } catch (_e) {
      return [];
    }
    // Per-row Phase 44 validation.
    for (const r of rows) {
      _validateRowAgainstRegistry(r, normOpts);
    }
    if (normOpts.filter_invalid) {
      rows = rows.filter(function (r) { return r.registry_valid !== false; });
    }
    return rows;
  } catch (_e) {
    return [];
  }
}

function querySnippet(text, kind, limit) {
  return query(text, {
    kinds: [kind],
    limit: typeof limit === 'number' ? limit : QUERY_LIMIT_DEFAULT,
  });
}

module.exports = {
  query: query,
  querySnippet: querySnippet,
  open: open,
  close: close,
  _internal: {
    _sanitizeFtsText: _sanitizeFtsText,
    _normalizeQueryOpts: _normalizeQueryOpts,
  },
};

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  function _flag(name) {
    const i = args.indexOf(name);
    if (i === -1) return null;
    return args[i + 1] || null;
  }
  if (args.includes('--help') || args.length === 0) {
    process.stdout.write([
      'Usage: node query.cjs --query "<text>" [options]',
      '       node query.cjs --query-snippet "<text>" --kind KIND [--limit N]',
      '',
      'Options:',
      '  --kinds k1,k2          Filter by kinds (comma-separated)',
      '  --kind KIND            Single-kind filter (with --query-snippet)',
      '  --limit N              Result limit (default 10, max 100)',
      '  --milestone MS         Filter by milestone',
      '  --phase PH             Filter by phase',
      '  --no-filter-invalid    Disable Phase 44 validateOne filter',
      '  --db-path PATH         Override db path',
      '',
    ].join('\n'));
    process.exit(args.length === 0 ? 2 : 0);
  }
  const opts = {};
  if (_flag('--kinds')) {
    opts.kinds = _flag('--kinds').split(',').map(function (s) { return s.trim(); });
  }
  if (_flag('--limit')) opts.limit = parseInt(_flag('--limit'), 10);
  if (_flag('--milestone')) opts.milestone = _flag('--milestone');
  if (_flag('--phase')) opts.phase = _flag('--phase');
  if (args.includes('--no-filter-invalid')) opts.filter_invalid = false;
  if (_flag('--db-path')) opts.dbPath = _flag('--db-path');

  if (args.includes('--query')) {
    const text = _flag('--query');
    if (!text) {
      process.stderr.write('[context-cache/query] --query requires text argument\n');
      process.exit(2);
    }
    const rows = query(text, opts);
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    process.exit(0);
  } else if (args.includes('--query-snippet')) {
    const text = _flag('--query-snippet');
    const kind = _flag('--kind') || 'capsule';
    if (!text) {
      process.stderr.write('[context-cache/query] --query-snippet requires text argument\n');
      process.exit(2);
    }
    const rows = querySnippet(text, kind, opts.limit);
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    process.exit(0);
  } else {
    process.stderr.write('[context-cache/query] unknown verb. See --help.\n');
    process.exit(2);
  }
}
