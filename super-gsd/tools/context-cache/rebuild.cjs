// ============================================================================
// SGSD - context-cache/rebuild.cjs (Phase 46 -- INDEX-01..05)
// ============================================================================
// Source of truth: canonical = .planning + git. SQLite is a PROJECTION.
// Owned outputs: .planning/cache/context-index.db (gitignored binary)
//                .planning/cache/context-index.manifest.json (git-tracked)
//                .planning/metrics/context-complaints.jsonl (APPEND-ONLY)
//
// Sources:
//   46-RESEARCH.md sec 4.3 (4 walkers), sec 5 (DDL), sec 6 (FTS5),
//                  sec 7 (better-sqlite3 + .gitignore + Lock 13),
//                  sec 12.2 (read-only invariant), sec 15.3 (30-path
//                  fingerprint guard).
//   46-01-sqlite-context-index-PLAN.md <frozen_constants>, <schema_ddl>,
//                  <manifest_contract>, <tasks T1-T4>.
//
// Architectural mirrors:
//   super-gsd/tools/phase-capsule/write.cjs (Phase 43; banner template,
//     __dirname-anchored canonical paths, SCHEMA_VERSION pattern,
//     atomic writes, complaints emitter).
//   super-gsd/tools/context-registry/check.cjs (Phase 44; Lock 13
//     never-throws-upward + closed-flag CLI parser).
//   super-gsd/tools/token-attribution/report.cjs (Phase 41; envelope-v1
//     emitter; ledgerPath imported by reference where relevant).
//
// Controlling correctness rule:
//   "SQLite is a PROJECTION; canonical = .planning + git."
//   Deleting context-index.db and re-running rebuild() MUST produce a
//   manifest deep-equal to the previous one (A3 binding).
//
// Lock 13 binding: rebuild, dropAndRebuild, status, emitManifest wrap
// internals in try/catch and NEVER throw upward. On error: stderr-warn
// + APPEND row to context-complaints.jsonl + return falsey sentinel.
// CLI exits 0 on graceful sentinel (better_sqlite3_missing).
//
// Read-only invariant (LOCK 4):
//   READ-ONLY against 13 canonical metric streams + ALL canonical
//   phase-folder content (CONTEXT.md, RESEARCH.md, PLAN.md,
//   VERIFICATION.md, REVIEW.md, ATC-REVIEW.md, codex-review.md,
//   commit-reviews.jsonl). ONLY owned writes:
//     - .planning/cache/context-index.db
//     - .planning/cache/context-index.manifest.json
//     - .planning/metrics/context-complaints.jsonl (APPEND-ONLY)
//   F7 fixture binds 30-path fingerprint guard.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const child_process = require('child_process');

// ----------------------------------------------------------------------------
// OPTIONAL UPSTREAM IMPORTS (Lock 13: try/catch wrapped)
// ----------------------------------------------------------------------------

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (_e) {
  Database = null;
}

// Phase 41 informational (optional).
let phase41 = null;
try {
  phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
} catch (_e) {
  phase41 = null;
}

// Phase 43 imports BY REFERENCE (informational; rebuild path uses
// fs.readFileSync direct per RESEARCH sec 4.3.1).
let phase43 = null;
try {
  phase43 = require(path.join(__dirname, '..', 'phase-capsule', 'write.cjs'));
} catch (_e) {
  phase43 = null;
}

// Phase 44 imports BY REFERENCE (used at query time; here informational).
let phase44 = null;
try {
  phase44 = require(path.join(__dirname, '..', 'context-registry', 'check.cjs'));
} catch (_e) {
  phase44 = null;
}

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS
// ----------------------------------------------------------------------------

const SCHEMA_VERSION = 1;

const KIND_VOCAB = Object.freeze([
  'capsule',
  'decision',
  'gate_definition',
  'file_summary',
]);

const FTS_TOKENIZER = Object.freeze({ value: 'porter unicode61' });

const DB_PATH = '.planning/cache/context-index.db';
const MANIFEST_PATH = '.planning/cache/context-index.manifest.json';

const FILE_SUMMARY_PATHS = Object.freeze([
  '.planning/milestones/v1.9/REQUIREMENTS.md',
  '.planning/milestones/v1.9/ROADMAP.md',
  '.planning/milestones/v1.9/SGSD-HANDOVER.md',
  '.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md',
  '.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md',
  '.planning/analyses/2026-04-27-agent-context-bloat-audit.md',
  '.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md',
  '.planning/analyses/2026-04-27-intent-english-meaning-compiler.md',
  '.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-CONTEXT.md',
  '.planning/milestones/v1.9/phases/42-token-budget-admission/42-CONTEXT.md',
  '.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-CONTEXT.md',
  '.planning/milestones/v1.9/phases/44-legal-context-registry/44-CONTEXT.md',
  '.planning/milestones/v1.9/phases/45-context-packet-builder/45-CONTEXT.md',
  '.planning/milestones/v1.9/phases/46-sqlite-context-index/46-CONTEXT.md',
  '.planning/milestones/v1.9/phases/47-dispatch-routing-substitution/47-CONTEXT.md',
  '.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-CONTEXT.md',
  '.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-CONTEXT.md',
  '.planning/milestones/v1.9/phases/50-cockpit-research-dashboard/50-CONTEXT.md',
  '.planning/milestones/v1.9/phases/51-context-stress-benchmark/51-CONTEXT.md',
  '.planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-CONTEXT.md',
]);

const FILE_SUMMARY_MAX_SECTIONS_PER_FILE = 5;
const FILE_SUMMARY_BODY_TRUNCATE_CHARS = 800;
const QUERY_LIMIT_DEFAULT = 10;
const QUERY_LIMIT_MAX = 100;
const SNIPPET_TOKEN_BUDGET = 32;

// Mass-discuss source path (relative to planningDir).
const MASS_DISCUSS_REL = 'discussions/2026-04-26-mass-discuss.md';
// Gates source (relative to repoRoot).
const GATES_YAML_REL = 'super-gsd/registry/gates.yaml';
// Complaints output (relative to planningDir).
const COMPLAINTS_REL = 'metrics/context-complaints.jsonl';

// ----------------------------------------------------------------------------
// __DIRNAME-ANCHORED RESOLVERS
// ----------------------------------------------------------------------------

function _resolveRepoRoot() {
  // tools/context-cache -> tools -> super-gsd -> repo
  return path.resolve(__dirname, '..', '..', '..');
}

function _resolvePlanningDir(opts) {
  if (opts && opts.planningDir) return path.resolve(opts.planningDir);
  return path.join(_resolveRepoRoot(), '.planning');
}

function _resolveDbPath(planningDir, opts) {
  if (opts && opts.dbPath) return path.resolve(opts.dbPath);
  return path.join(planningDir, 'cache', 'context-index.db');
}

function _resolveManifestPath(planningDir, opts) {
  if (opts && opts.manifestPath) return path.resolve(opts.manifestPath);
  return path.join(planningDir, 'cache', 'context-index.manifest.json');
}

function _normalize(opts) {
  opts = opts || {};
  const planningDir = _resolvePlanningDir(opts);
  return {
    planningDir: planningDir,
    dbPath: _resolveDbPath(planningDir, opts),
    manifestPath: _resolveManifestPath(planningDir, opts),
    repoRoot: opts.repoRoot ? path.resolve(opts.repoRoot) : _resolveRepoRoot(),
  };
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function _isoNow() {
  return new Date().toISOString();
}

function _sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function _sha256OfFile(absPath) {
  try {
    const buf = fs.readFileSync(absPath);
    return _sha256Bytes(buf);
  } catch (_e) {
    return null;
  }
}

function _sha256OfString(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function _ensureParentDir(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch (_e) {
    // ignore
  }
}

function _atomicWriteJson(absPath, obj) {
  _ensureParentDir(absPath);
  const json = JSON.stringify(obj, null, 2) + '\n';
  const tmp = absPath + '.tmp.' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, absPath);
}

function _emitContextIndexComplaint(rec, opts) {
  try {
    const norm = _normalize(opts || {});
    const compPath = path.join(norm.planningDir, COMPLAINTS_REL);
    _ensureParentDir(compPath);
    const row = Object.assign({
      type: 'contextIndexComplaint',
      ts: _isoNow(),
    }, rec || {});
    fs.appendFileSync(compPath, JSON.stringify(row) + '\n', 'utf8');
  } catch (_e) {
    // Lock 13: never throw on complaint write failure.
  }
}

function _assertManifestSchema(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest: not an object');
  }
  if (manifest.schema_version !== 1) {
    throw new Error('manifest.schema_version must be 1');
  }
  if (typeof manifest.doc_count !== 'number') {
    throw new Error('manifest.doc_count must be number');
  }
  if (!manifest.by_kind || typeof manifest.by_kind !== 'object') {
    throw new Error('manifest.by_kind must be object');
  }
  for (const k of KIND_VOCAB) {
    if (typeof manifest.by_kind[k] !== 'number') {
      throw new Error('manifest.by_kind.' + k + ' must be number');
    }
  }
  if (typeof manifest.manifest_hash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(manifest.manifest_hash)) {
    throw new Error('manifest.manifest_hash must be 64-hex string');
  }
  if (!Array.isArray(manifest.documents)) {
    throw new Error('manifest.documents must be array');
  }
  return true;
}

// ----------------------------------------------------------------------------
// DDL CONSTANT (mirror schema.sql)
// ----------------------------------------------------------------------------

const DDL = [
  'PRAGMA user_version = 1;',
  'PRAGMA journal_mode = WAL;',
  '',
  'CREATE TABLE IF NOT EXISTS documents (',
  '  id                 INTEGER PRIMARY KEY AUTOINCREMENT,',
  "  kind               TEXT NOT NULL CHECK (kind IN ('capsule','decision','gate_definition','file_summary')),",
  '  doc_id             TEXT NOT NULL,',
  '  milestone          TEXT,',
  '  phase              TEXT,',
  '  source_path        TEXT NOT NULL,',
  '  source_hash        TEXT NOT NULL,',
  '  source_byte_offset INTEGER,',
  '  source_byte_length INTEGER,',
  '  title              TEXT,',
  '  body               TEXT NOT NULL,',
  '  indexed_at         TEXT NOT NULL,',
  '  UNIQUE (kind, doc_id)',
  ');',
  '',
  'CREATE INDEX IF NOT EXISTS idx_documents_kind         ON documents(kind);',
  'CREATE INDEX IF NOT EXISTS idx_documents_ms_phase     ON documents(milestone, phase);',
  'CREATE INDEX IF NOT EXISTS idx_documents_source_hash  ON documents(source_hash);',
  '',
  'CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(',
  '  body,',
  '  title,',
  '  kind UNINDEXED,',
  "  content='documents',",
  "  content_rowid='id',",
  "  tokenize='porter unicode61'",
  ');',
  '',
  'CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN',
  '  INSERT INTO documents_fts(rowid, body, title, kind)',
  '    VALUES (new.id, new.body, new.title, new.kind);',
  'END;',
  '',
  'CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN',
  "  INSERT INTO documents_fts(documents_fts, rowid, body, title, kind)",
  "    VALUES ('delete', old.id, old.body, old.title, old.kind);",
  'END;',
].join('\n');

// ----------------------------------------------------------------------------
// WALKER 1: CAPSULES
// ----------------------------------------------------------------------------

function _walkCapsules(planningDir) {
  const rows = [];
  const milestonesDir = path.join(planningDir, 'milestones');
  let milestones = [];
  try {
    milestones = fs.readdirSync(milestonesDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory() && /^v\d/.test(d.name); })
      .map(function (d) { return d.name; })
      .sort();
  } catch (_e) {
    return rows;
  }
  for (const ms of milestones) {
    const phasesDir = path.join(milestonesDir, ms, 'phases');
    let phaseDirs = [];
    try {
      phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(function (d) { return d.isDirectory(); })
        .map(function (d) { return d.name; })
        .sort();
    } catch (_e) {
      continue;
    }
    for (const phaseDir of phaseDirs) {
      const realPath = path.join(phasesDir, phaseDir, 'PHASE-CAPSULE.json');
      if (!fs.existsSync(realPath)) continue;
      let buf = null;
      let json = null;
      try {
        buf = fs.readFileSync(realPath);
        json = JSON.parse(buf.toString('utf8'));
      } catch (_e) {
        continue;
      }
      if (!json || typeof json !== 'object') continue;
      const sourceHash = _sha256Bytes(buf);
      const phaseNumMatch = /^(\d+(?:\.\d+)?)-/.exec(phaseDir);
      const phaseNum = phaseNumMatch ? phaseNumMatch[1] : phaseDir;
      const docId = ms + '/' + phaseNum;
      // Build body: goal + decisions text + bypass passthroughs + constraints.
      const bodyParts = [];
      if (typeof json.goal === 'string' && json.goal) bodyParts.push('Goal: ' + json.goal);
      if (Array.isArray(json.decisions)) {
        for (const d of json.decisions) {
          if (d && typeof d.text === 'string') bodyParts.push('Decision: ' + d.text);
        }
      }
      if (Array.isArray(json.bypass_refs)) {
        for (const b of json.bypass_refs) {
          if (b && typeof b.summary_passthrough === 'string') {
            bodyParts.push('Bypass: ' + b.summary_passthrough);
          }
        }
      }
      if (Array.isArray(json.constraints)) {
        for (const c of json.constraints) {
          if (typeof c === 'string') bodyParts.push('Constraint: ' + c);
          else if (c && typeof c.text === 'string') bodyParts.push('Constraint: ' + c.text);
        }
      }
      const body = bodyParts.join('\n\n') || (json.phase_name || phaseDir);
      const title = (typeof json.phase_name === 'string') ? json.phase_name : phaseDir;
      const relSource = path.relative(path.dirname(planningDir), realPath).split(path.sep).join('/');
      rows.push({
        kind: 'capsule',
        doc_id: docId,
        milestone: ms,
        phase: phaseNum,
        source_path: relSource,
        source_hash: sourceHash,
        source_byte_offset: 0,
        source_byte_length: buf.length,
        title: title,
        body: body,
      });
    }
  }
  return rows;
}

// ----------------------------------------------------------------------------
// WALKER 2: MASS-DISCUSS DECISIONS
// ----------------------------------------------------------------------------

function _walkDecisions(planningDir) {
  const rows = [];
  const mdPath = path.join(planningDir, MASS_DISCUSS_REL);
  if (!fs.existsSync(mdPath)) return rows;
  let buf = null;
  let text = null;
  try {
    buf = fs.readFileSync(mdPath);
    text = buf.toString('utf8');
  } catch (_e) {
    return rows;
  }
  const sourceHash = _sha256Bytes(buf);
  const relSource = path.relative(path.dirname(planningDir), mdPath).split(path.sep).join('/');

  // Pass 1: locked-decisions table rows (decimal phase numbers like 26.1).
  const tableRe = /^\|\s*(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*([^|]*?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
  let m;
  const seenIds = new Set();
  while ((m = tableRe.exec(text)) !== null) {
    const phaseId = m[1];
    const question = (m[3] || '').trim();
    const decision = (m[4] || '').trim();
    if (!phaseId || !question || !decision) continue;
    // Skip rows that look like header / non-content.
    if (/^[-:|\s]+$/.test(decision)) continue;
    if (question.length < 3 || decision.length < 3) continue;
    const docId = 'mass-discuss-row-' + phaseId + '-' + (m.index);
    if (seenIds.has(docId)) continue;
    seenIds.add(docId);
    const body = 'Phase ' + phaseId + ': ' + question + '\n\n' + decision;
    const phaseFloor = String(Math.floor(parseFloat(phaseId)));
    rows.push({
      kind: 'decision',
      doc_id: docId,
      milestone: null,
      phase: phaseFloor,
      source_path: relSource,
      source_hash: sourceHash,
      source_byte_offset: m.index,
      source_byte_length: m[0].length,
      title: 'Decision ' + phaseId + ': ' + question.slice(0, 60),
      body: body,
    });
  }

  // Pass 2: ### Phase N prose blocks.
  const proseRe = /^### Phase (\d+(?:\.\d+)?)([^\n]*)\n([\s\S]*?)(?=^### Phase |^## |\n---+\n|$)/gm;
  while ((m = proseRe.exec(text)) !== null) {
    const phaseId = m[1];
    const headerSuffix = (m[2] || '').trim();
    const body = (m[3] || '').trim();
    if (!body) continue;
    const docId = 'mass-discuss-prose-' + phaseId + '-' + m.index;
    if (seenIds.has(docId)) continue;
    seenIds.add(docId);
    rows.push({
      kind: 'decision',
      doc_id: docId,
      milestone: null,
      phase: String(Math.floor(parseFloat(phaseId))),
      source_path: relSource,
      source_hash: sourceHash,
      source_byte_offset: m.index,
      source_byte_length: m[0].length,
      title: ('Phase ' + phaseId + ' ' + headerSuffix).trim(),
      body: body.slice(0, 4000),
    });
  }

  // Sort by source_byte_offset ASC (deterministic ordering).
  rows.sort(function (a, b) {
    if (a.source_byte_offset !== b.source_byte_offset) {
      return a.source_byte_offset - b.source_byte_offset;
    }
    return a.doc_id < b.doc_id ? -1 : 1;
  });
  return rows;
}

// ----------------------------------------------------------------------------
// WALKER 3: GATES
// ----------------------------------------------------------------------------

function _walkGates(repoRoot) {
  const rows = [];
  const gatesPath = path.join(repoRoot, GATES_YAML_REL);
  if (!fs.existsSync(gatesPath)) return rows;
  let buf = null;
  let text = null;
  try {
    buf = fs.readFileSync(gatesPath);
    text = buf.toString('utf8');
  } catch (_e) {
    return rows;
  }
  const sourceHash = _sha256Bytes(buf);
  const relSource = path.relative(repoRoot, gatesPath).split(path.sep).join('/');

  // Block-parse: "  - name: GATE-NAME" begins; ends at next "  - name: "
  // or at a top-level (column 0) lowercase key, or at EOF.
  // JavaScript regex has no \Z; we use $(?![\s\S]) as end-of-string anchor.
  const blockRe = /^  - name: (\S+)\s*\n([\s\S]*?)(?=^  - name: |^[a-z][a-zA-Z_]*:|$(?![\s\S]))/gm;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const name = m[1];
    const block = m[2] || '';
    const offset = m.index;
    const length = m[0].length;
    function _field(re) {
      const fm = re.exec(block);
      return fm ? fm[1].trim() : '';
    }
    const category = _field(/^\s+category:\s*(\S+)/m);
    const step = _field(/^\s+step:\s*(\S+)/m);
    const enforcement = _field(/^\s+enforcement_mode:\s*(\S+)/m);
    const repair = _field(/^\s+repair_instruction:\s*"([^"]*)"/m) ||
                   _field(/^\s+repair_instruction:\s*(.+)$/m);
    const reviewerAgent = _field(/^\s+reviewer_agent:\s*(\S+)/m);
    const reviewerProvider = _field(/^\s+reviewer_provider:\s*(\S+)/m);
    const sourceDlb = _field(/^\s+source_dlb:\s*(\S+)/m);
    // checks list: lines after "checks:" indented "      - "
    const checks = [];
    const checksMatch = /^\s+checks:\s*\n((?:^\s+-\s+.+\n)+)/m.exec(block);
    if (checksMatch) {
      const lines = checksMatch[1].split('\n');
      for (const line of lines) {
        const lm = /^\s+-\s+(.+)$/.exec(line);
        if (lm) checks.push(lm[1].trim());
      }
    }
    const body = 'Category: ' + category +
                 '\nStep: ' + step +
                 '\nEnforcement: ' + enforcement +
                 '\nRepair: ' + repair +
                 '\nChecks: ' + checks.join('; ') +
                 '\nReviewer: ' + reviewerAgent + '/' + reviewerProvider +
                 '\nSource: ' + sourceDlb;
    rows.push({
      kind: 'gate_definition',
      doc_id: 'gate:' + name,
      milestone: null,
      phase: null,
      source_path: relSource,
      source_hash: sourceHash,
      source_byte_offset: offset,
      source_byte_length: length,
      title: 'Gate: ' + name,
      body: body,
    });
  }
  return rows;
}

// ----------------------------------------------------------------------------
// WALKER 4: FILE SUMMARIES
// ----------------------------------------------------------------------------

function _walkFileSummaries(repoRoot) {
  const rows = [];
  for (let pi = 0; pi < FILE_SUMMARY_PATHS.length; pi++) {
    const relPath = FILE_SUMMARY_PATHS[pi];
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) continue;
    let buf = null;
    let text = null;
    try {
      buf = fs.readFileSync(absPath);
      text = buf.toString('utf8');
    } catch (_e) {
      continue;
    }
    const sourceHash = _sha256Bytes(buf);
    // Split by H2 (^## ) headers preserving offsets.
    const h2Re = /^## (.+)$/gm;
    const sections = [];
    let last = null;
    let m;
    while ((m = h2Re.exec(text)) !== null) {
      if (last) {
        last.endOffset = m.index;
        sections.push(last);
      }
      last = {
        title: m[1].trim(),
        startOffset: m.index,
        bodyStart: m.index + m[0].length,
        endOffset: text.length,
      };
    }
    if (last) sections.push(last);
    let chosen;
    if (sections.length === 0) {
      // No H2 -> whole file as 1 section.
      const baseName = path.basename(relPath, path.extname(relPath));
      chosen = [{
        title: baseName,
        startOffset: 0,
        bodyStart: 0,
        endOffset: Math.min(text.length, FILE_SUMMARY_BODY_TRUNCATE_CHARS),
      }];
    } else {
      chosen = sections.slice(0, FILE_SUMMARY_MAX_SECTIONS_PER_FILE);
    }
    for (let si = 0; si < chosen.length; si++) {
      const s = chosen[si];
      const body = text.slice(s.startOffset, Math.min(s.endOffset, s.startOffset + FILE_SUMMARY_BODY_TRUNCATE_CHARS));
      rows.push({
        kind: 'file_summary',
        doc_id: 'summary:' + relPath + ':' + si,
        milestone: null,
        phase: null,
        source_path: relPath,
        source_hash: sourceHash,
        source_byte_offset: s.startOffset,
        source_byte_length: s.endOffset - s.startOffset,
        title: s.title,
        body: body,
      });
    }
  }
  return rows;
}

// ----------------------------------------------------------------------------
// MANIFEST BUILD
// ----------------------------------------------------------------------------

function _buildManifestFromDb(db) {
  const rows = db.prepare(
    'SELECT kind, doc_id, source_path, source_hash, body FROM documents ORDER BY kind ASC, doc_id ASC'
  ).all();
  const documents = rows.map(function (r) {
    return {
      kind: r.kind,
      doc_id: r.doc_id,
      source_path: r.source_path,
      source_hash: r.source_hash,
      body_hash: _sha256OfString(r.body || ''),
    };
  });
  const byKind = { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 };
  for (const d of documents) {
    if (typeof byKind[d.kind] === 'number') byKind[d.kind]++;
  }
  const manifestHash = _sha256OfString(JSON.stringify(documents));
  return {
    documents: documents,
    by_kind: byKind,
    doc_count: documents.length,
    manifest_hash: manifestHash,
  };
}

// ----------------------------------------------------------------------------
// CORE: rebuild
// ----------------------------------------------------------------------------

function rebuild(opts) {
  try {
    const norm = _normalize(opts);
    if (!Database) {
      _emitContextIndexComplaint({
        status: 'degraded',
        reason: 'better_sqlite3_missing',
        details: { install_command: 'npm install better-sqlite3 --save' },
      }, opts);
      return {
        ok: false,
        error: 'better_sqlite3_missing',
        install_hint: 'npm install better-sqlite3 --save',
        doc_count: 0,
        by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
        manifest_path: norm.manifestPath,
        manifest_hash: null,
      };
    }
    _ensureParentDir(norm.dbPath);

    // Schema-version self-heal: if existing DB has user_version != 1, drop.
    if (fs.existsSync(norm.dbPath)) {
      try {
        const probe = new Database(norm.dbPath, { readonly: true });
        const v = probe.pragma('user_version', { simple: true });
        probe.close();
        if (v !== SCHEMA_VERSION) {
          try { fs.unlinkSync(norm.dbPath); } catch (_e) {}
          try { fs.unlinkSync(norm.dbPath + '-wal'); } catch (_e) {}
          try { fs.unlinkSync(norm.dbPath + '-shm'); } catch (_e) {}
        }
      } catch (_e) {
        // probe failed -> drop and recreate
        try { fs.unlinkSync(norm.dbPath); } catch (_e2) {}
      }
    }

    const db = new Database(norm.dbPath);
    try {
      db.exec('DROP TABLE IF EXISTS documents_fts; DROP TABLE IF EXISTS documents;');
      db.exec(DDL);

      const insert = db.prepare(
        'INSERT INTO documents (kind, doc_id, milestone, phase, source_path, source_hash, source_byte_offset, source_byte_length, title, body, indexed_at) ' +
        'VALUES (@kind, @doc_id, @milestone, @phase, @source_path, @source_hash, @source_byte_offset, @source_byte_length, @title, @body, @indexed_at)'
      );

      const tx = db.transaction(function (rowsList) {
        for (const r of rowsList) {
          // Walker invariants (Lock 13: throw locally; orchestrator catches).
          if (typeof r.source_path !== 'string' || !r.source_path) {
            throw new Error('walker invariant: source_path missing');
          }
          if (typeof r.source_hash !== 'string' || !/^[0-9a-f]{64}$/.test(r.source_hash)) {
            throw new Error('walker invariant: source_hash must be 64-hex');
          }
          if (!KIND_VOCAB.includes(r.kind)) {
            throw new Error('walker invariant: kind not in vocab: ' + r.kind);
          }
          if (typeof r.doc_id !== 'string' || !r.doc_id) {
            throw new Error('walker invariant: doc_id missing');
          }
          if (typeof r.body !== 'string') {
            throw new Error('walker invariant: body must be string');
          }
          insert.run({
            kind: r.kind,
            doc_id: r.doc_id,
            milestone: r.milestone || null,
            phase: r.phase || null,
            source_path: r.source_path,
            source_hash: r.source_hash,
            source_byte_offset: (typeof r.source_byte_offset === 'number') ? r.source_byte_offset : null,
            source_byte_length: (typeof r.source_byte_length === 'number') ? r.source_byte_length : null,
            title: r.title || null,
            body: r.body,
            indexed_at: _isoNow(),
          });
        }
      });

      // Walk in canonical order: capsule -> decision -> gate -> file_summary.
      const capsules = _walkCapsules(norm.planningDir);
      const decisions = _walkDecisions(norm.planningDir);
      const gates = _walkGates(norm.repoRoot);
      const fileSummaries = _walkFileSummaries(norm.repoRoot);

      tx(capsules);
      tx(decisions);
      tx(gates);
      tx(fileSummaries);

      // Build manifest from DB (deterministic SELECT order).
      const m = _buildManifestFromDb(db);
      const manifest = {
        schema_version: SCHEMA_VERSION,
        generated_at: _isoNow(),
        generated_by: 'super-gsd/tools/context-cache/rebuild.cjs',
        doc_count: m.doc_count,
        by_kind: m.by_kind,
        manifest_hash: m.manifest_hash,
        documents: m.documents,
      };
      _assertManifestSchema(manifest);
      _atomicWriteJson(norm.manifestPath, manifest);
      db.close();

      return {
        ok: true,
        doc_count: m.doc_count,
        by_kind: m.by_kind,
        manifest_path: norm.manifestPath,
        manifest_hash: m.manifest_hash,
      };
    } catch (e) {
      try { db.close(); } catch (_e) {}
      _emitContextIndexComplaint({
        status: 'rebuild_error',
        reason: 'walker_or_db_error',
        details: { error: e && e.message ? e.message : String(e) },
      }, opts);
      return {
        ok: false,
        error: 'rebuild_error',
        detail: e && e.message ? e.message : String(e),
        doc_count: 0,
        by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
        manifest_path: norm.manifestPath,
        manifest_hash: null,
      };
    }
  } catch (e) {
    _emitContextIndexComplaint({
      status: 'rebuild_error',
      reason: 'orchestrator_error',
      details: { error: e && e.message ? e.message : String(e) },
    }, opts);
    return {
      ok: false,
      error: 'rebuild_error',
      detail: e && e.message ? e.message : String(e),
      doc_count: 0,
      by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
      manifest_path: null,
      manifest_hash: null,
    };
  }
}

// ----------------------------------------------------------------------------
// dropAndRebuild
// ----------------------------------------------------------------------------

function dropAndRebuild(opts) {
  try {
    const norm = _normalize(opts);
    try { fs.unlinkSync(norm.dbPath); } catch (_e) {}
    try { fs.unlinkSync(norm.dbPath + '-wal'); } catch (_e) {}
    try { fs.unlinkSync(norm.dbPath + '-shm'); } catch (_e) {}
    return rebuild(opts);
  } catch (e) {
    return {
      ok: false,
      error: 'rebuild_error',
      detail: e && e.message ? e.message : String(e),
      doc_count: 0,
      by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
      manifest_path: null,
      manifest_hash: null,
    };
  }
}

// ----------------------------------------------------------------------------
// status
// ----------------------------------------------------------------------------

function status(opts) {
  try {
    const norm = _normalize(opts);
    if (!Database) {
      return {
        ok: false,
        error: 'better_sqlite3_missing',
        install_hint: 'npm install better-sqlite3 --save',
        doc_count: 0,
        by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
      };
    }
    if (!fs.existsSync(norm.dbPath)) {
      return {
        ok: true,
        doc_count: 0,
        by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
        db_size_bytes: 0,
        last_rebuild_at: null,
        manifest_hash: null,
        manifest_age_seconds: null,
        source_drift: { detected: false, drifted_paths: [] },
      };
    }
    const db = new Database(norm.dbPath, { readonly: true, fileMustExist: true });
    let docCount = 0;
    const byKind = { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 };
    let driftedPaths = [];
    try {
      docCount = db.prepare('SELECT COUNT(*) AS c FROM documents').get().c;
      const kindRows = db.prepare('SELECT kind, COUNT(*) AS c FROM documents GROUP BY kind').all();
      for (const r of kindRows) {
        if (typeof byKind[r.kind] === 'number') byKind[r.kind] = r.c;
      }
      // source_drift: walk unique source_path; sha256 vs documents.source_hash.
      const uniqueRows = db.prepare(
        'SELECT DISTINCT source_path, source_hash FROM documents'
      ).all();
      for (const r of uniqueRows) {
        // resolve source_path against repo root or planningDir parent
        let abs = path.join(norm.repoRoot, r.source_path);
        if (!fs.existsSync(abs)) {
          abs = path.join(path.dirname(norm.planningDir), r.source_path);
        }
        if (!fs.existsSync(abs)) {
          driftedPaths.push(r.source_path);
          continue;
        }
        const cur = _sha256OfFile(abs);
        if (cur && cur !== r.source_hash) driftedPaths.push(r.source_path);
      }
    } finally {
      try { db.close(); } catch (_e) {}
    }
    let dbSize = 0;
    try { dbSize = fs.statSync(norm.dbPath).size; } catch (_e) {}
    let manifestHash = null;
    let lastRebuildAt = null;
    let manifestAgeSeconds = null;
    if (fs.existsSync(norm.manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(norm.manifestPath, 'utf8'));
        manifestHash = m.manifest_hash || null;
        lastRebuildAt = m.generated_at || null;
        if (lastRebuildAt) {
          manifestAgeSeconds = Math.max(0, Math.floor((Date.now() - new Date(lastRebuildAt).getTime()) / 1000));
        }
      } catch (_e) {}
    }
    return {
      ok: true,
      doc_count: docCount,
      by_kind: byKind,
      db_size_bytes: dbSize,
      last_rebuild_at: lastRebuildAt,
      manifest_hash: manifestHash,
      manifest_age_seconds: manifestAgeSeconds,
      source_drift: {
        detected: driftedPaths.length > 0,
        drifted_paths: driftedPaths,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: 'status_error',
      detail: e && e.message ? e.message : String(e),
      doc_count: 0,
      by_kind: { capsule: 0, decision: 0, gate_definition: 0, file_summary: 0 },
    };
  }
}

// ----------------------------------------------------------------------------
// emitManifest (read-only re-derivation)
// ----------------------------------------------------------------------------

function emitManifest(opts) {
  try {
    const norm = _normalize(opts);
    if (!Database) {
      return { ok: false, error: 'better_sqlite3_missing', manifest: null, manifest_hash: null };
    }
    if (!fs.existsSync(norm.dbPath)) {
      return { ok: false, error: 'db_missing', manifest: null, manifest_hash: null };
    }
    const db = new Database(norm.dbPath, { readonly: true, fileMustExist: true });
    try {
      const m = _buildManifestFromDb(db);
      const manifest = {
        schema_version: SCHEMA_VERSION,
        generated_at: _isoNow(),
        generated_by: 'super-gsd/tools/context-cache/rebuild.cjs',
        doc_count: m.doc_count,
        by_kind: m.by_kind,
        manifest_hash: m.manifest_hash,
        documents: m.documents,
      };
      return { ok: true, manifest: manifest, manifest_hash: m.manifest_hash };
    } finally {
      try { db.close(); } catch (_e) {}
    }
  } catch (e) {
    return {
      ok: false,
      error: 'emit_error',
      detail: e && e.message ? e.message : String(e),
      manifest: null,
      manifest_hash: null,
    };
  }
}

// ----------------------------------------------------------------------------
// MODULE EXPORTS
// ----------------------------------------------------------------------------

module.exports = {
  rebuild: rebuild,
  dropAndRebuild: dropAndRebuild,
  status: status,
  emitManifest: emitManifest,
  SCHEMA_VERSION: SCHEMA_VERSION,
  KIND_VOCAB: KIND_VOCAB,
  DB_PATH: DB_PATH,
  MANIFEST_PATH: MANIFEST_PATH,
  FTS_TOKENIZER: FTS_TOKENIZER,
  FILE_SUMMARY_PATHS: FILE_SUMMARY_PATHS,
  QUERY_LIMIT_DEFAULT: QUERY_LIMIT_DEFAULT,
  QUERY_LIMIT_MAX: QUERY_LIMIT_MAX,
  SNIPPET_TOKEN_BUDGET: SNIPPET_TOKEN_BUDGET,
  _internal: {
    _normalize: _normalize,
    _assertManifestSchema: _assertManifestSchema,
    _emitContextIndexComplaint: _emitContextIndexComplaint,
    _resolveRepoRoot: _resolveRepoRoot,
    _walkCapsules: _walkCapsules,
    _walkDecisions: _walkDecisions,
    _walkGates: _walkGates,
    _walkFileSummaries: _walkFileSummaries,
    _buildManifestFromDb: _buildManifestFromDb,
    _sha256OfFile: _sha256OfFile,
    _sha256OfString: _sha256OfString,
    DDL: DDL,
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
  const cliOpts = {};
  if (_flag('--planning-dir')) cliOpts.planningDir = _flag('--planning-dir');
  if (_flag('--db-path')) cliOpts.dbPath = _flag('--db-path');
  if (_flag('--manifest-path')) cliOpts.manifestPath = _flag('--manifest-path');

  if (args.includes('--help') || args.length === 0) {
    process.stdout.write([
      'Usage: node rebuild.cjs <verb> [options]',
      '',
      'Verbs:',
      '  --rebuild              Rebuild context-index.db from canonical state',
      '  --drop-and-rebuild     Delete db then rebuild',
      '  --status               Print doc counts + drift report',
      '  --self-test            Run F1-F8 + secondary fixtures',
      '',
      'Options:',
      '  --planning-dir DIR     Override .planning location',
      '  --db-path PATH         Override db path',
      '  --manifest-path PATH   Override manifest path',
      '',
    ].join('\n'));
    process.exit(args.length === 0 ? 2 : 0);
  } else if (args.includes('--rebuild')) {
    const r = rebuild(cliOpts);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(r.ok || r.error === 'better_sqlite3_missing' ? 0 : 1);
  } else if (args.includes('--drop-and-rebuild')) {
    const r = dropAndRebuild(cliOpts);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(r.ok || r.error === 'better_sqlite3_missing' ? 0 : 1);
  } else if (args.includes('--status')) {
    const r = status(cliOpts);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(r.ok || r.error === 'better_sqlite3_missing' ? 0 : 1);
  } else if (args.includes('--self-test')) {
    let testMod;
    try {
      testMod = require('./build.test.cjs');
    } catch (e) {
      process.stderr.write('[context-cache/rebuild] self-test load failed: ' + (e && e.message ? e.message : e) + '\n');
      process.exit(1);
    }
    const result = testMod.runAll();
    process.stdout.write(testMod.formatSummary(result) + '\n');
    process.exit(result.ok ? 0 : 1);
  } else {
    process.stderr.write('[context-cache/rebuild] unknown verb. See --help.\n');
    process.exit(2);
  }
}
