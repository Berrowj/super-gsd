---
schema_version: 2
phase: 46
plan: 01
phase_name: sqlite-context-index
milestone: v1.9
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/tools/context-cache/rebuild.cjs
  - super-gsd/tools/context-cache/query.cjs
  - super-gsd/tools/context-cache/rebuild.test.cjs
  - .planning/cache/context-index.manifest.json
  - package.json
  - package-lock.json
  - .gitignore
autonomous: true
requirements:
  - INDEX-01
  - INDEX-02
  - INDEX-03
  - INDEX-04
  - INDEX-05
tags:
  - sqlite
  - fts5
  - context-cache
  - rebuildable-projection
  - lock-13
  - read-only-invariant
upstream:
  - phase-41-token-attribution
  - phase-43-phase-capsule
  - phase-44-context-registry
  - phase-45-context-packet
unblocks:
  - phase-49-memory-governance
  - phase-51-bench-context-stress
  - phase-52-redis-cache

must_haves:
  truths:
    - "rebuild() walks 4 canonical content types and indexes them into SQLite FTS5 (capsules, decisions, gate definitions, file summaries)."
    - "query() returns rows whose source_path resolves to a real canonical file and whose source_hash matches sha256 of the file at index time."
    - "Deleting context-index.db and re-running rebuild() produces a manifest.json that is deep-equal to the manifest captured before deletion."
    - "Every documents row has a non-null source_path and non-null source_hash; SQLite DDL rejects NULL inserts."
    - "When better-sqlite3 is not installed, rebuild() and query() return {ok:false, error:'better_sqlite3_missing', install_hint:'npm install better-sqlite3 --save'} sentinels and never throw upward."
    - "Phase 46 NEVER writes to canonical streams or canonical phase-folder content; only writes .planning/cache/context-index.db (gitignored), .planning/cache/context-index.manifest.json (git-tracked), and APPEND-ONLY to .planning/metrics/context-complaints.jsonl on error."
    - "Query results are filtered through Phase 44 validateOne by default (filter_invalid:true), so superseded/unknown legal-keys drop from output."
  artifacts:
    - path: super-gsd/tools/context-cache/rebuild.cjs
      provides: "rebuild + dropAndRebuild + status + emitManifest + 4 walkers + frozen consts (KIND_VOCAB, SCHEMA_VERSION, DB_PATH, MANIFEST_PATH); CLI verbs --rebuild, --drop-and-rebuild, --status, --self-test"
      contains: "module.exports = { rebuild, dropAndRebuild, status, emitManifest, SCHEMA_VERSION, KIND_VOCAB, DB_PATH, MANIFEST_PATH }"
      min_lines: 500
    - path: super-gsd/tools/context-cache/query.cjs
      provides: "query + querySnippet + open + close; FTS5 MATCH + bm25 + snippet() + Phase 44 validateOne filter; CLI verbs --query, --query-snippet"
      contains: "module.exports = { query, querySnippet, open, close }"
      min_lines: 200
    - path: super-gsd/tools/context-cache/rebuild.test.cjs
      provides: "F1-F8 binding fixtures + 5 secondary assertions = 13 total; tmpdir self-test harness with F7 fingerprint guard"
      contains: "F1, F2, F3, F4, F5, F5b, F6, F7, F8"
      min_lines: 400
    - path: .planning/cache/context-index.manifest.json
      provides: "git-tracked A3 regression evidence (schema_version, doc_count, by_kind, manifest_hash, sorted documents[])"
      contains: '"schema_version": 1'
    - path: package.json
      provides: "better-sqlite3 ^12.9.0 in dependencies (NOT devDependencies)"
      contains: '"better-sqlite3"'
    - path: .gitignore
      provides: "*.db / *.db-wal / *.db-shm rule (already present at .gitignore:3-5; no edit unless absent)"
      contains: "*.db"
  key_links:
    - from: super-gsd/tools/context-cache/rebuild.cjs
      to: super-gsd/tools/phase-capsule/write.cjs
      via: "imports SCHEMA_VERSION, capsulePath, readCapsule by reference (try/catch require; never duplicate)"
      pattern: "require.*phase-capsule/write"
    - from: super-gsd/tools/context-cache/query.cjs
      to: super-gsd/tools/context-registry/check.cjs
      via: "imports validateOne, REASONS by reference; query-time per-row filter (NOT index-time)"
      pattern: "require.*context-registry/check"
    - from: super-gsd/tools/context-cache/rebuild.cjs
      to: .planning/cache/context-index.db
      via: "fs.unlink + better-sqlite3 Database open + DDL + INSERT walkers (only owned write target)"
      pattern: "context-index\\.db"
    - from: super-gsd/tools/context-cache/rebuild.cjs
      to: .planning/cache/context-index.manifest.json
      via: "atomic tmp+rename write of sorted documents[] + manifest_hash"
      pattern: "context-index\\.manifest\\.json"
---

<objective>
Phase 46 ships the **rebuildable SQLite FTS5 projection** that fills Phase 45
step-6's `_index_snippets: []` stub (build.cjs:702-703) and provides the
read-time substrate for Phase 49 governance and Phase 51 benchmark.

The phase delivers two production tools and one git-tracked manifest under
`super-gsd/tools/context-cache/`:

1. **rebuild.cjs** -- walks 4 canonical content types (capsules, mass-discuss
   decisions, gates.yaml, milestone+phase file summaries) and ingests them
   into a single `documents` table + FTS5 virtual table. CLI verbs
   `--rebuild`, `--drop-and-rebuild`, `--status`, `--self-test`.
2. **query.cjs** -- read-only `query(text, opts)` returning
   `{kind, doc_id, milestone, phase, source_path, source_hash, snippet, score, registry_valid}`
   rows; results filtered through Phase 44 `validateOne` by default. CLI
   verbs `--query`, `--query-snippet`.
3. **context-index.manifest.json** -- sorted, hash-bound A3 regression
   artifact. Deleting the DB and rebuilding MUST produce a deep-equal
   manifest.

Purpose: replace whole-file fs.readFileSync fallbacks with FTS-ranked
paragraph snippets carrying per-snippet source hashes. Expected per-packet
token savings: ~1000-2000 tokens (Phase 51 BENCH-04 measures aggregate).

Output: 3 NEW files under `super-gsd/tools/context-cache/`, 1 EDIT of
package.json (add `better-sqlite3` to dependencies), 1 git-tracked manifest,
and a gitignored `.planning/cache/context-index.db` binary.

Acceptance binding (ROADMAP sec 46:180-195 verbatim):
- A1: rebuild indexes capsules, decisions, gate definitions, and file summaries.
- A2: query returns source-backed snippets with source hashes.
- A3: deleting the DB and rebuilding preserves document count and hash manifest.
- A4: no phase decision, debt, or evidence exists only in SQLite.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/MILESTONE-READINESS.md
@.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md
@.planning/milestones/v1.9/phases/46-sqlite-context-index/46-CONTEXT.md
@.planning/milestones/v1.9/phases/46-sqlite-context-index/46-RESEARCH.md
@.planning/discussions/2026-04-26-mass-discuss.md
@super-gsd/tools/phase-capsule/write.cjs
@super-gsd/tools/context-registry/check.cjs
@super-gsd/tools/context-packet/build.cjs
@super-gsd/registry/gates.yaml
@super-gsd/tools/context-registry/legal-keys.json
@.gitignore

<interfaces>
<!-- Phase 43 imports BY REFERENCE (try/catch require; never duplicate). -->
<!-- Source: super-gsd/tools/phase-capsule/write.cjs (Phase 43 production). -->

```javascript
// Phase 43 exports (consume by reference):
module.exports = {
  writeCapsule,
  writeAllCapsulesForMilestone,
  readCapsule,                  // (planningDir, milestone, phase) -> capsule | null
  capsulePath,                  // (planningDir, milestone, phase) -> path string
  backfillFromCanonical,
  SCHEMA_VERSION: 1,
  STATUS_VOCAB,                 // frozen 5-entry enum
  BYPASS_KIND_VOCAB,            // frozen 7-entry enum
  CAPSULE_FILE_KINDS,           // frozen 5-entry enum
  ROLES: PHASE41_ROLES,
};
```

<!-- Phase 44 imports BY REFERENCE. -->
<!-- Source: super-gsd/tools/context-registry/check.cjs (Phase 44 production). -->

```javascript
// Phase 44 exports (consume by reference):
module.exports = {
  validateReferences,           // (packet, opts?) -> {valid, invalid_keys[], ...}
  validateOne,                  // (key, category, opts?) -> {valid, reason?, ...}
  isLegal,                      // (key, category) -> bool (never throws)
  loadRegistry,                 // re-exported from build.cjs (mtime-cached singleton)
  registryPath,
  REASONS,                      // Object.freeze(['unknown_key','superseded_key', ...])
  DEFAULT_CATEGORIES,           // Object.freeze(['phases','gates','agents','artifacts','providers'])
  validateAllCapsules,
};
```

<!-- Phase 45 step-6 contract Phase 46 satisfies (Phase 46 does NOT modify build.cjs). -->
<!-- Source: super-gsd/tools/context-packet/build.cjs:702-703 (closed phase). -->

```javascript
// Current state in Phase 45 (closed; Phase 46 does NOT touch this file):
// Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct).
const indexSnippets = []; // No-op fallback; explicit empty.

// Future state owned by Phase 49 GOV-02 (NOT this phase):
// Phase 49 will require Phase 46's query.cjs and populate indexSnippets[]
// with the result row shape locked in this PLAN.
```

<!-- Phase 46 result row shape (Q7 LOCKED; stable across major versions): -->

```javascript
{
  kind:                'capsule' | 'decision' | 'gate_definition' | 'file_summary',
  doc_id:              string,        // 'v1.9/43' | 'mass-discuss-row-43' | 'gate:per-dispatch-ATC' | 'CONTEXT:v1.9/46:section-3'
  milestone:           string | null,
  phase:               string | null,
  source_path:         string,        // canonical file (NEVER null per A4)
  source_hash:         string,        // sha256 (NEVER null per A2)
  source_byte_offset:  number | null,
  source_byte_length:  number | null,
  title:               string | null,
  snippet:             string,        // FTS5 snippet() output ~32 tokens with [hl]...[/hl] markers
  score:               number,        // -bm25() so higher = better
  registry_valid:      boolean,       // Phase 44 validateOne result
}
```
</interfaces>

<frozen_constants>
<!-- These constants MUST be Object.freeze'd at module top of rebuild.cjs. -->

```javascript
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
  // 5 v1.9 milestone-level docs (capsules don't cover these):
  '.planning/milestones/v1.9/REQUIREMENTS.md',
  '.planning/milestones/v1.9/ROADMAP.md',
  '.planning/milestones/v1.9/SGSD-HANDOVER.md',
  '.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md',
  '.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md',
  // 3 audit/analysis source docs:
  '.planning/analyses/2026-04-27-agent-context-bloat-audit.md',
  '.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md',
  '.planning/analyses/2026-04-27-intent-english-meaning-compiler.md',
  // 12 v1.9 phase context files (41-52):
  '.planning/milestones/v1.9/phases/41-token-attribution/41-CONTEXT.md',
  '.planning/milestones/v1.9/phases/42-token-waste-budget/42-CONTEXT.md',
  '.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-CONTEXT.md',
  '.planning/milestones/v1.9/phases/44-legal-context-registry/44-CONTEXT.md',
  '.planning/milestones/v1.9/phases/45-context-packet-builder/45-CONTEXT.md',
  '.planning/milestones/v1.9/phases/46-sqlite-context-index/46-CONTEXT.md',
  '.planning/milestones/v1.9/phases/47-dispatch-routing/47-CONTEXT.md',
  '.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-CONTEXT.md',
  '.planning/milestones/v1.9/phases/49-memory-governance/49-CONTEXT.md',
  '.planning/milestones/v1.9/phases/50-cockpit-dashboard/50-CONTEXT.md',
  '.planning/milestones/v1.9/phases/51-bench-context-stress/51-CONTEXT.md',
  '.planning/milestones/v1.9/phases/52-redis-cache/52-CONTEXT.md',
]);

const FILE_SUMMARY_MAX_SECTIONS_PER_FILE = 5;
const FILE_SUMMARY_BODY_TRUNCATE_CHARS = 800;
const QUERY_LIMIT_DEFAULT = 10;
const QUERY_LIMIT_MAX = 100;
const SNIPPET_TOKEN_BUDGET = 32;        // FTS5 snippet() token argument
```

Mass-discuss decisions source: `.planning/discussions/2026-04-26-mass-discuss.md`
- Locked decision table parsed by row regex `/^\|\s*(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm`
  -> ~30 rows.
- Per-Phase Locked Decisions prose blocks parsed by `/^### Phase (\d+(?:\.\d+)?)/gm`
  with body running to next `^### ` or `^## ` header -> ~22 rows.
- Total expected: ~52 decision documents.

Gates source: `super-gsd/registry/gates.yaml`
- `^  - name: (\S+)` -> 13 gate blocks.
- Each block ends at next `^  - name:` or `^[a-z]` top-level key.
- Body fields concatenated: `Category: ... | Step: ... | Enforcement: ... | Repair: ... | Checks: ... | Reviewer: ... | Source: ...`
</frozen_constants>

<schema_ddl>
<!-- Phase 46 owns these. Mirror Phase 43 SCHEMA_VERSION pattern verbatim. -->

```sql
PRAGMA user_version = 1;
PRAGMA journal_mode = WAL;            -- match better-sqlite3 default; allows readers during rebuild

CREATE TABLE IF NOT EXISTS documents (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  kind               TEXT NOT NULL CHECK (kind IN ('capsule','decision','gate_definition','file_summary')),
  doc_id             TEXT NOT NULL,
  milestone          TEXT,
  phase              TEXT,
  source_path        TEXT NOT NULL,    -- A4 binding: NEVER NULL
  source_hash        TEXT NOT NULL,    -- A2 + A3 binding: NEVER NULL; sha256 of source_path bytes at index time
  source_byte_offset INTEGER,
  source_byte_length INTEGER,
  title              TEXT,
  body               TEXT NOT NULL,    -- searchable text; FTS5 reads from here
  indexed_at         TEXT NOT NULL,    -- ISO-8601; excluded from manifest hash
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

-- External-content FTS5 sync triggers (canonical recipe):
CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, body, title, kind)
    VALUES (new.id, new.body, new.title, new.kind);
END;

CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, body, title, kind)
    VALUES ('delete', old.id, old.body, old.title, old.kind);
END;
```

NOTE: Phase 46 uses **full DROP+rebuild**, not row-level update; the `_au`
update trigger from the FTS5 external-content recipe is intentionally
omitted (rebuild path: DROP TABLE -> CREATE -> INSERT).
</schema_ddl>

<manifest_contract>
<!-- A3 binding mechanism. Manifest is git-tracked; DB binary is gitignored. -->

```json
{
  "schema_version": 1,
  "generated_at": "ISO-8601",
  "generated_by": "super-gsd/tools/context-cache/rebuild.cjs",
  "doc_count": 99,
  "by_kind": {
    "capsule": 44,
    "decision": 52,
    "gate_definition": 13,
    "file_summary": 20
  },
  "manifest_hash": "<sha256 of canonical JSON of documents[] sorted (kind ASC, doc_id ASC)>",
  "documents": [
    {
      "kind": "capsule",
      "doc_id": "v1.9/41",
      "source_path": ".planning/milestones/v1.9/phases/41-token-attribution/PHASE-CAPSULE.json",
      "source_hash": "<sha256 of source bytes>",
      "body_hash":   "<sha256 of body string written to documents.body>"
    }
  ]
}
```

Rules:
1. `documents[]` array sorted by `(kind ASC, doc_id ASC)` -- insertion-order independent.
2. `manifest_hash` = sha256 of `JSON.stringify(documents)` after sort.
3. `indexed_at` is in DB but **NOT** in manifest (timestamp differs across rebuilds).
4. F2 fixture asserts deep-equal `manifest_v1.documents` vs `manifest_v2.documents`
   AND `manifest_v1.manifest_hash === manifest_v2.manifest_hash`.
</manifest_contract>
</context>

<tasks>

<!-- ========================================================================
T1 (Wave 1) - SCAFFOLD: dirs + frozen consts + DDL + manifest schema
              + 13-assertion test scaffold (red, all tests skip/pending).
COMMIT: feat(46-01): context-cache schema + frozen consts + manifest contract
        + 13-assertion test scaffold
======================================================================== -->

<task type="auto" tdd="true">
  <name>Task 1: Scaffold context-cache module + frozen consts + DDL + 13-assertion test scaffold</name>
  <files>
    super-gsd/tools/context-cache/rebuild.cjs,
    super-gsd/tools/context-cache/query.cjs,
    super-gsd/tools/context-cache/rebuild.test.cjs
  </files>
  <behavior>
    Test scaffold (rebuild.test.cjs) declares all 13 assertions but each
    runs only the lightweight pre-conditions; full bodies fail until T2-T4
    fill in walkers/query/install.

    - F1 (rebuild produces N rows): test exists, body throws "PENDING T2"
    - F2 (idempotent rebuild): exists, throws "PENDING T2"
    - F3 (source-backed snippets): exists, throws "PENDING T3"
    - F4 (Phase 44 validateOne filter): exists, throws "PENDING T3"
    - F5 (NULL source_path rejected): IMPLEMENTED in T1 -- opens an
      in-memory better-sqlite3 (skip-on-missing), applies DDL, asserts
      INSERT without source_path raises "NOT NULL constraint failed:
      documents.source_path"
    - F5b (source_drift detection): exists, throws "PENDING T2"
    - F6 (better-sqlite3 missing -> graceful sentinel): IMPLEMENTED in T1
      -- uses child_process.spawn with PATH/NODE_PATH manipulated to make
      better-sqlite3 unfindable; asserts result.ok === false,
      error === 'better_sqlite3_missing', install_hint set, no throw.
      [Skip if module IS installed and harness can't simulate missing;
      mark as MUST-PASS in T4 once fully implemented.]
    - F7 (read-only invariant fingerprint guard): IMPLEMENTED in T1 --
      walks the 30 canonical paths from sec 15.3 + frozen FILE_SUMMARY_PATHS,
      captures mtime+size+sha256 BEFORE the test run, runs nothing yet,
      asserts unchanged AFTER (no-op assertion since walker doesn't run
      yet). Becomes meaningful in T2-T4.
    - F8 (never-throws-upward): IMPLEMENTED in T1 -- calls every public
      export with bad inputs (rebuild({planningDir:'/nope'}), query(null),
      query('x',{kinds:['bogus']}), status({dbPath:'/nope'}),
      emitManifest({dbPath:'/nope'})), asserts each returns a sentinel
      object and never throws. (Stubs return graceful sentinel even
      before walkers exist.)
    - 5 secondary assertions (KIND_VOCAB frozen, SCHEMA_VERSION === 1,
      query limit clamp <= 100, walker sort determinism, CLI exit code
      contract): IMPLEMENTED in T1 where they don't depend on walker.
      Determinism check defers to T2.

    rebuild.cjs (scaffold) exports stubs:
    - rebuild(opts) -> graceful sentinel (better-sqlite3 missing OR no
      walkers yet) -- returns {ok:false, error:'not_implemented_T1', ...}
      when Database is loaded; {ok:false, error:'better_sqlite3_missing',
      install_hint:'npm install better-sqlite3 --save', ...} when
      Database is null.
    - dropAndRebuild -> calls rebuild
    - status -> returns {ok:true, doc_count:0, by_kind:{...zeros}, ...}
    - emitManifest -> returns {ok:false, error:'not_implemented_T1',
      manifest:null, manifest_hash:null}
    - SCHEMA_VERSION, KIND_VOCAB, DB_PATH, MANIFEST_PATH all exported.
    - CLI verbs --rebuild, --drop-and-rebuild, --status, --self-test
      parsed; exit codes 0/0/0/0 (only bad invocation = 2).

    query.cjs (scaffold) exports stubs:
    - query(text, opts) -> returns []  (and never throws)
    - querySnippet(text, kind, limit) -> returns []
    - open(opts) -> returns null (lazy stub)
    - close() -> no-op
    - CLI verbs --query, --query-snippet parsed; exit 0.
  </behavior>
  <action>
    1. Create directory `super-gsd/tools/context-cache/` (Write tool;
       Bash `mkdir -p` only if needed for parent).
    2. Create `super-gsd/tools/context-cache/rebuild.cjs` with:
       - Top-of-file banner comment block (mirror Phase 43 write.cjs:1-59
         structure verbatim) listing: phase, sources, mirror templates
         (Phase 41/42/43/44/45 commands), controlling correctness rule
         ("SQLite is a PROJECTION; canonical = .planning + git"), Lock 13
         binding, Read-Only Invariant LOCK 4, Owned writes.
       - `'use strict';`
       - Built-in requires only: fs, path, os, crypto, child_process.
       - Try/catch require for `better-sqlite3` -> `let Database = null`.
       - Phase 41 OPTIONAL UPSTREAM: try/catch require
         `../token-attribution/report.cjs` for ROLES + ledgerPath
         (informational; mirror Phase 43 lines 109-126 fallback exactly).
       - Phase 43 imports BY REFERENCE: try/catch require
         `../phase-capsule/write.cjs` for SCHEMA_VERSION, capsulePath,
         readCapsule (informational; rebuild path uses fs.readFileSync
         direct per RESEARCH sec 4.3.1 to avoid Phase 43 side effects).
       - Phase 44 imports BY REFERENCE: try/catch require
         `../context-registry/check.cjs` for validateOne, REASONS
         (used at query time; here informational).
       - FROZEN CONSTANTS section (verbatim from <frozen_constants> in
         this PLAN's <context>): SCHEMA_VERSION, KIND_VOCAB, FTS_TOKENIZER,
         DB_PATH, MANIFEST_PATH, FILE_SUMMARY_PATHS,
         FILE_SUMMARY_MAX_SECTIONS_PER_FILE,
         FILE_SUMMARY_BODY_TRUNCATE_CHARS, QUERY_LIMIT_DEFAULT,
         QUERY_LIMIT_MAX, SNIPPET_TOKEN_BUDGET. Each Object.freeze'd
         where applicable.
       - __dirname-anchored canonical paths helpers:
         `_resolvePlanningDir(opts)`, `_resolveDbPath(planningDir, opts)`,
         `_resolveManifestPath(planningDir, opts)`. Mirror Phase 43
         lines 128-160 pattern.
       - DDL constant `const DDL = ` (multi-line template literal
         containing the 7 statements from <schema_ddl>; each statement
         terminated with `;`; suitable for db.exec(DDL)).
       - `_normalize` helper for opts: returns
         `{planningDir, dbPath, manifestPath}` resolved.
       - `_assertManifestSchema(manifest)` helper: validates shape
         (schema_version, doc_count, by_kind, manifest_hash, documents[])
         throws-locally only (caller wraps).
       - Stub implementations of rebuild, dropAndRebuild, status,
         emitManifest per <behavior>. Each wraps everything in try/catch
         and returns falsey-sentinel on error (Lock 13).
       - `_emitContextIndexComplaint(rec, opts)` helper: appends
         JSONL row to `.planning/metrics/context-complaints.jsonl`
         atomically; row shape: `{type:'contextIndexComplaint', ts,
         status, reason, details}`. Mirror Phase 45 emitter pattern.
       - CLI parser at bottom (mirror Phase 43 closed-flag style):
         parses --rebuild, --drop-and-rebuild, --status, --self-test,
         --planning-dir, --db-path, --manifest-path, --help.
         Bad invocation exits 2; otherwise exits 0.
       - When run with `--self-test`, requires
         `./rebuild.test.cjs` and calls `runAll()`.
       - module.exports at bottom: { rebuild, dropAndRebuild, status,
         emitManifest, SCHEMA_VERSION, KIND_VOCAB, DB_PATH, MANIFEST_PATH,
         _internal: { _normalize, _assertManifestSchema, DDL,
         _emitContextIndexComplaint } } -- `_internal` is for tests only,
         documented as such in a comment.
    3. Create `super-gsd/tools/context-cache/query.cjs` with:
       - Same banner-comment header (Phase 46 query module).
       - `'use strict';`
       - Built-in requires only.
       - Try/catch require for `better-sqlite3`.
       - Try/catch require for Phase 44 check.cjs -> cache validateOne,
         REASONS references (used in T3).
       - Frozen consts from rebuild.cjs (re-import via
         `const { DB_PATH, KIND_VOCAB, QUERY_LIMIT_DEFAULT,
         QUERY_LIMIT_MAX, SNIPPET_TOKEN_BUDGET } = require('./rebuild.cjs')`).
       - Stubs: query, querySnippet, open, close -- all wrapped in
         try/catch, return [] / null on error. NO real SQL yet.
       - CLI parser for --query, --query-snippet, --kinds, --limit,
         --milestone, --phase, --no-filter-invalid, --help.
       - module.exports = { query, querySnippet, open, close }.
    4. Create `super-gsd/tools/context-cache/rebuild.test.cjs` with:
       - `'use strict';` + built-in requires + os.tmpdir helpers.
       - `_makeTmpPlanning()` helper: creates tmpdir with synthetic
         .planning subtree containing 2 capsules, 1 mass-discuss with
         3 decision rows + 2 prose blocks, 1 gates.yaml with 2 gate
         blocks, 4 file_summary source files (each with 2 H2 sections).
         Returns absolute path. Uses os.tmpdir() + crypto.randomBytes(8).
       - `_captureFingerprints(paths[])` helper: returns
         `{path -> {mtime,size,sha256}}` map for each existing path
         (missing paths recorded as `{missing:true}`).
       - `_assertNoFingerprintDrift(before, after)` helper: walks both
         maps and asserts equality.
       - 13 test functions (F1, F2, F3, F4, F5, F5b, F6, F7, F8 + S9-S13)
         per <behavior>. F1, F2, F3, F4, F5b, S12 (determinism) start as
         pending stubs that throw `'PENDING T2'`/`'PENDING T3'`.
         F5, F6, F7, F8, S9 (KIND_VOCAB frozen), S10 (SCHEMA_VERSION),
         S11 (limit clamp), S13 (CLI exit codes) IMPLEMENTED in T1.
       - `runAll()` orchestrator: runs each fixture in try/catch,
         tallies pass/fail/pending, prints `[F1] PENDING -- T2 walker
         not implemented`, etc. Returns `{ok, results, summary}`.
         CLI exit: 0 if all PASS or PENDING; 1 if any FAIL; 2 if
         bad invocation.
       - module.exports = { runAll, _makeTmpPlanning,
         _captureFingerprints, _assertNoFingerprintDrift }.
    5. Verify ASCII-only on all 3 files (Bash:
       `node -e "...check ASCII..."` or simple `grep -P '[^\x00-\x7F]'`).
    6. Run `node super-gsd/tools/context-cache/rebuild.cjs --self-test`
       -> exit 0 with summary like "PASS: 8 (F5,F6,F7,F8,S9,S10,S11,S13);
       PENDING: 5 (F1,F2,F3,F4,F5b,S12)". (Note: 8+5=13 total -- but
       S12 + F5b also pending; adjust counts in implementation.)
    7. **Atomic commit 1**:
       ```
       feat(46-01): context-cache schema + frozen consts + manifest contract + 13-assertion test scaffold
       ```
       Stage exactly: `super-gsd/tools/context-cache/rebuild.cjs`,
       `super-gsd/tools/context-cache/query.cjs`,
       `super-gsd/tools/context-cache/rebuild.test.cjs`.
  </action>
  <verify>
    <automated>node super-gsd/tools/context-cache/rebuild.cjs --self-test</automated>
    <expected>exit 0; stdout reports 8 PASS + 5 PENDING (or similar split where total=13). No throws. ASCII-only. Banner comments include Phase 46 sources, mirror templates, Lock 13 binding, Read-Only Invariant.</expected>
  </verify>
  <done>
    - 3 files exist under super-gsd/tools/context-cache/
    - All frozen consts Object.freeze'd; SCHEMA_VERSION === 1
    - DDL constant present in rebuild.cjs
    - Manifest schema asserter present
    - 13-assertion scaffold present; F5/F6/F7/F8 + 4 secondary IMPLEMENTED
    - Stubs return graceful sentinels for every error path
    - CLI verbs parsed; bad-invocation exits 2; otherwise 0
    - Atomic commit 1 created
  </done>
</task>

<!-- ========================================================================
T2 (Wave 2) - REBUILD: 4 walkers + manifest_hash + atomic write.
COMMIT: feat(46-01): rebuild.cjs - 4 content-type walkers + manifest_hash computation
======================================================================== -->

<task type="auto" tdd="true">
  <name>Task 2: Implement 4 walkers (capsule, decision, gate, file_summary) + manifest emitter + atomic write</name>
  <files>
    super-gsd/tools/context-cache/rebuild.cjs,
    super-gsd/tools/context-cache/rebuild.test.cjs
  </files>
  <behavior>
    rebuild.cjs gains real walkers + manifest emitter. The walker
    contract for each kind is fixed by RESEARCH sec 4.3.1-4.3.4:

    - _walkCapsules(planningDir): walks
      `planningDir + /milestones/v*/phases/*/PHASE-CAPSULE.json`
      via fs.readdirSync (NO `glob` dep -- Phase 41-45 never added one).
      For each capsule file: read bytes, sha256, JSON.parse, build row
      {kind:'capsule', doc_id:`${milestone}/${phase}`, milestone, phase,
       source_path: relative-to-planningDir-parent, source_hash, title:
       capsule.phase_name, body: [goal, ...decisions[].text,
       ...bypass_refs[].summary_passthrough, ...constraints].join('\n\n')}.
      Yields rows in (milestone ASC, phase ASC) order.

    - _walkDecisions(planningDir): reads
      `planningDir + /discussions/2026-04-26-mass-discuss.md` (single
      hardcoded path for v1.9 milestone state; future milestones extend
      via FILE_SUMMARY_PATHS-style enumeration in Phase 49+).
      Two passes:
      1. Locked-decisions table: regex
         `/^\|\s*(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm`
         -> ~30 rows. doc_id = `mass-discuss-row-{phase}`.
      2. Per-Phase prose blocks: regex
         `/^### Phase (\d+(?:\.\d+)?)[^\n]*\n([\s\S]*?)(?=^### Phase |^## |\Z)/gm`
         -> ~22 rows. doc_id = `mass-discuss-prose-{phase}`.
      Both pass shared file source_hash; per-row source_byte_offset +
      source_byte_length captured from regex match.index + match[0].length.
      Yields in source-byte-offset ASC order.

    - _walkGates(planningDir): reads
      `super-gsd/registry/gates.yaml` (RELATIVE to repo root, NOT
      planningDir; resolved via repo-root anchor -- see _resolveRepoRoot
      helper). 13 gate blocks parsed with regex
      `/^  - name: (\S+)$([\s\S]*?)(?=^  - name: |\Z)/gm`. For each
      block: extract category, step, enforcement_mode, repair_instruction,
      checks[], reviewer_agent, reviewer_provider, source_dlb via
      sub-regexes (NO js-yaml dep). Body =
      `Category: ${category}\nStep: ${step}\nEnforcement: ${enforcement_mode}\nRepair: ${repair_instruction}\nChecks: ${(checks||[]).join('; ')}\nReviewer: ${reviewer_agent}/${reviewer_provider}\nSource: ${source_dlb}`.
      doc_id = `gate:${name}`. Yields in source-byte-offset ASC order
      (== gates.yaml file order).

    - _walkFileSummaries(planningDir): walks frozen FILE_SUMMARY_PATHS
      (resolved relative to repo root). For each file:
      1. read bytes, sha256.
      2. Split by H2 regex `/^## ([^\n]+)$/gm`; first 5 sections.
      3. If file has 0 H2 headers, treat whole file as 1 section
         (title = filename basename minus extension; body = first
         FILE_SUMMARY_BODY_TRUNCATE_CHARS chars).
      4. For each captured section: doc_id =
         `summary:${relSourcePath}:${sectionIdx}`;
         title = section heading text;
         body = heading + first FILE_SUMMARY_BODY_TRUNCATE_CHARS chars;
         source_byte_offset + source_byte_length from regex match.
      Yields in (FILE_SUMMARY_PATHS index ASC, section index ASC) order.

    - rebuild() orchestrator (replaces T1 stub):
      1. Resolve {planningDir, dbPath, manifestPath} via _normalize.
      2. Ensure parent dirs exist (mkdirSync recursive).
      3. If !Database -> graceful sentinel (already wired in T1).
      4. Schema-version check: if existing DB user_version !== 1,
         close + unlink db (+ -wal, -shm); recurse rebuild(opts).
      5. Open DB; BEGIN TRANSACTION.
      6. db.exec('DROP TABLE IF EXISTS documents_fts; DROP TABLE IF EXISTS documents;');
      7. db.exec(DDL);
      8. Insert rows from each walker IN ORDER: capsule -> decision ->
         gate_definition -> file_summary. Use prepared INSERT statement
         + iterating, OR transaction-batched insert. Each row sets all
         11 columns explicitly; indexed_at = isoNow().
         If walker throws -> rollback + emit complaint + return sentinel.
      9. COMMIT TRANSACTION.
      10. Build manifest:
          - SELECT kind, doc_id, source_path, source_hash, body FROM
            documents ORDER BY kind ASC, doc_id ASC.
          - For each row: body_hash = sha256(body).
          - documents[] = sorted list of
            {kind, doc_id, source_path, source_hash, body_hash}.
          - manifest_hash = sha256(JSON.stringify(documents)).
          - by_kind = {capsule, decision, gate_definition, file_summary}
            counts from db.
      11. Atomic write via tmp + rename pattern (mirror Phase 43
          write.cjs atomic pattern):
          - tmpPath = manifestPath + '.tmp.' + crypto.randomBytes(4).toString('hex')
          - fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
          - fs.renameSync(tmpPath, manifestPath)
      12. db.close().
      13. Return {ok:true, doc_count: documents.length, by_kind,
          manifest_path: manifestPath, manifest_hash}.

    - emitManifest(opts) (real impl): opens DB read-only, runs the
      same SELECT + body_hash + manifest_hash computation as step 10
      above, returns {ok:true, manifest, manifest_hash} WITHOUT
      writing manifest file. Used by status() and Phase 51 fixture.

    - status(opts): opens DB read-only; SELECT count(*) GROUP BY kind;
      stat() DB file size; reads MANIFEST_PATH if exists for
      manifest_hash; computes source_drift by walking the 4 kinds and
      sha256-ing each unique source_path, comparing to documents'
      source_hash column. Returns {ok, doc_count, by_kind, db_size_bytes,
      last_rebuild_at (from manifest.generated_at), manifest_hash,
      manifest_age_seconds, source_drift:{detected, drifted_paths[]}}.

    - dropAndRebuild(opts): unlink dbPath, dbPath+'-wal', dbPath+'-shm'
      (each in try/catch); recurse rebuild(opts).

    Tests now MUST PASS:
    - F1 (rebuild from synthetic tmpdir produces 11 rows: 2+3+2+4)
    - F2 (idempotent rebuild: delete db, rebuild, manifest deep-equal)
    - F5b (source_drift detection: modify a file, status reports drift)
    - S12 (determinism: back-to-back rebuilds produce byte-identical
      manifests when canonical state unchanged)

    F3, F4, F6 stay PENDING (T3 implements query; T4 simulates module-missing).
  </behavior>
  <action>
    1. Open `super-gsd/tools/context-cache/rebuild.cjs` (Edit tool).
    2. Replace the T1 stubs of rebuild/dropAndRebuild/status/emitManifest
       with real implementations per <behavior>. Add private helpers:
       _walkCapsules, _walkDecisions, _walkGates, _walkFileSummaries,
       _resolveRepoRoot, _isoNow, _sha256Bytes, _atomicWriteJson.
    3. Each walker wraps its body in try/catch and yields rows; the
       rebuild orchestrator wraps walker iteration in try/catch and
       on any error emits complaint + rolls back + returns sentinel.
    4. Walker invariants enforced inside each walker BEFORE pushing row:
       - source_path: typeof === 'string' && length > 0
       - source_hash: typeof === 'string' && /^[0-9a-f]{64}$/.test(...)
       - kind: KIND_VOCAB.includes(kind)
       - doc_id: typeof === 'string' && length > 0
       - body: typeof === 'string'
       Failed assertion -> throw new Error inside walker (caught by
       orchestrator).
    5. Emit complaint helper called on:
       - rebuild_error (any walker throw OR DB error)
       - degraded (better_sqlite3_missing) -- already wired T1
       Row shape: `{type:'contextIndexComplaint', ts, status, reason,
       details:{walker?, error?, install_command?}}`.
       Append-only via fs.appendFileSync to
       `${planningDir}/metrics/context-complaints.jsonl` with newline.
    6. Update `super-gsd/tools/context-cache/rebuild.test.cjs`:
       - Replace F1 PENDING stub with real assertion against tmpdir
         from _makeTmpPlanning():
         result.ok === true; result.doc_count === expected per fixture;
         result.by_kind matches; documents table count matches;
         FTS5 MATCH 'goal' returns >= 1.
       - Replace F2 PENDING stub:
         m1 = rebuild() -> manifest read; fs.unlinkSync(dbPath);
         m2 = rebuild() -> manifest read; assert
         JSON.stringify(m1.documents) === JSON.stringify(m2.documents)
         AND m1.manifest_hash === m2.manifest_hash AND
         m1.documents.length === m2.documents.length.
       - Replace F5b PENDING stub: rebuild() -> status() shows
         drift:false; modify one indexed source (e.g., append text to
         a synthetic capsule) -> status() shows drift:true with the
         modified path in drifted_paths.
       - Replace S12 (determinism) PENDING: two back-to-back rebuilds
         produce byte-identical manifest.json files (compare via
         sha256 of file bytes; ignore the `generated_at` and
         `generated_by` lines if needed by stripping them before
         comparison -- but better is to assert manifest.documents[]
         and manifest.manifest_hash byte-identical, leaving generated_at
         out of the equality check).
       - F3, F4, F6 remain PENDING (T3 + T4).
    7. Also wire `--rebuild` and `--drop-and-rebuild` and `--status`
       CLI verbs through the now-real implementations. Pretty-print
       result JSON to stdout. Exit code: 0 on result.ok === true OR
       result.error === 'better_sqlite3_missing' (graceful sentinel),
       1 on other errors, 2 on bad invocation.
    8. Run `node super-gsd/tools/context-cache/rebuild.cjs --self-test`
       -> ALL of F1, F2, F5, F5b, F7, F8, S9, S10, S11, S12, S13 PASS;
       F3, F4, F6 PENDING. Total: 11 PASS + 3 PENDING (out of 14
       declared assertions; if exact count differs, document in test
       output). [If better-sqlite3 not yet installed, ALL non-T1
       assertions SKIP with reason='better_sqlite3_missing'. T4
       installs it and these assertions become non-skip.]
    9. Verify ASCII-only across both files.
    10. Verify F7 fingerprint guard against the 30 canonical paths
        (RESEARCH sec 15.3): rebuild.test.cjs runs F1-F8 entirely against
        os.tmpdir(); after run, F7 asserts no canonical path mtime/
        size/sha256 changed. This is the read-only invariant binding.
    11. **Atomic commit 2**:
        ```
        feat(46-01): rebuild.cjs - 4 content-type walkers + manifest_hash computation
        ```
        Stage exactly: `super-gsd/tools/context-cache/rebuild.cjs`,
        `super-gsd/tools/context-cache/rebuild.test.cjs`.
  </action>
  <verify>
    <automated>node super-gsd/tools/context-cache/rebuild.cjs --self-test</automated>
    <expected>If better-sqlite3 INSTALLED: >=10 PASS (F1, F2, F5, F5b, F7, F8, S9, S10, S11, S12, S13) + 3 PENDING (F3, F4, F6). If MISSING: 8+ PASS (T1-implemented assertions) + non-T1 assertions SKIP. F7 confirms no canonical path drift. No throws.</expected>
  </verify>
  <done>
    - All 4 walkers implemented and yielding correctly-shaped rows
    - rebuild() returns {ok:true, doc_count, by_kind, manifest_path, manifest_hash}
    - emitManifest() returns deterministic sorted documents[]
    - status() reports source_drift correctly
    - dropAndRebuild() removes db + recurses
    - F1, F2, F5b, S12 PASS (when better-sqlite3 installed)
    - F7 fingerprint guard confirms no canonical drift
    - Atomic commit 2 created
  </done>
</task>

<!-- ========================================================================
T3 (Wave 3) - QUERY: FTS5 MATCH + bm25 + snippet() + Phase 44 validateOne filter
COMMIT: feat(46-01): query.cjs - FTS5 query + validateOne filter + source-backed snippet shape
======================================================================== -->

<task type="auto" tdd="true">
  <name>Task 3: Implement query.cjs (FTS5 MATCH + bm25 + snippet + Phase 44 validateOne filter)</name>
  <files>
    super-gsd/tools/context-cache/query.cjs,
    super-gsd/tools/context-cache/rebuild.test.cjs
  </files>
  <behavior>
    query.cjs ships the read-only FTS5 query API.

    Public API:
    - query(text, opts?) -> Result[]
    - querySnippet(text, kind, limit?) -> Result[]  (sugar; calls query
      with opts.kinds=[kind], opts.limit=limit)
    - open(opts?) -> handle (lazy; cached singleton per dbPath)
    - close() -> closes cached handle

    query(text, opts) algorithm:
    1. Validate inputs:
       - text: typeof === 'string' && length > 0; else return [].
       - opts.kinds: array of strings, each in KIND_VOCAB; invalid
         entries silently dropped. If opts.kinds undefined, no kind
         filter.
       - opts.limit: integer; clamped to QUERY_LIMIT_MAX (100); default
         QUERY_LIMIT_DEFAULT (10).
       - opts.milestone, opts.phase: optional string filters.
       - opts.filter_invalid: bool; default true.
    2. If !Database -> graceful sentinel: return [] (Lock 13).
    3. Open DB read-only (SQLITE_OPEN_READONLY); if DB doesn't exist
       at dbPath -> return [] (Lock 13).
    4. Sanitize text for FTS5 MATCH: escape any chars that would
       break the FTS5 query parser (but NOT operators like AND/OR/").
       Recommended: wrap user text in double-quotes for phrase match
       safety: `MATCH '"' || @text || '"'` -- but this prevents
       multi-term ranking. Simpler: replace double-quote chars with
       space and pass through; FTS5 default tokenizer handles the rest.
       Document chosen approach in code comment.
    5. Build SQL with the canonical form from RESEARCH sec 6.2:
       ```sql
       SELECT
         d.kind, d.doc_id, d.milestone, d.phase, d.source_path,
         d.source_hash, d.source_byte_offset, d.source_byte_length,
         d.title,
         snippet(documents_fts, 0, '[hl]', '[/hl]', '...', 32) AS snippet,
         -bm25(documents_fts) AS score
       FROM documents_fts
       JOIN documents d ON d.id = documents_fts.rowid
       WHERE documents_fts MATCH @text
         AND (@kindsJson IS NULL OR d.kind IN (
           SELECT value FROM json_each(@kindsJson)))
         AND (@milestone IS NULL OR d.milestone = @milestone)
         AND (@phase IS NULL OR d.phase = @phase)
       ORDER BY score DESC
       LIMIT @limit;
       ```
       Use json_each for kinds IN-list (better-sqlite3 supports it).
    6. Execute prepared statement; map rows into Result objects.
    7. Phase 44 validateOne filter (per-row, RESEARCH sec 6.4):
       - For each row where kind === 'capsule' && milestone && phase:
         build key = `${milestone}/${phase}`; call
         phase44.validateOne(key, 'phases'); set
         row.registry_valid = !!result.valid.
       - For other kinds: registry_valid = true (Phase 44 doesn't
         govern decision/gate/file_summary keys directly).
       - phase44.validateOne wrapped in try/catch; throw -> fail-open
         (registry_valid = true).
    8. If opts.filter_invalid !== false: drop rows where
       registry_valid === false.
    9. Return Result[].

    querySnippet(text, kind, limit): wrapper --
    `return query(text, {kinds:[kind], limit: limit || QUERY_LIMIT_DEFAULT});`

    open(opts): lazy singleton handle keyed on resolved dbPath;
    open in SQLITE_OPEN_READONLY; if file missing -> return null
    (Lock 13). close() closes cached handle and clears.

    CLI:
    - `--query "<text>"` -> opts from --kinds, --limit, --milestone,
      --phase, --no-filter-invalid; pretty-print JSON result.
    - `--query-snippet "<text>" --kind capsule` -> calls querySnippet.
    - Bad invocation exits 2; otherwise 0.

    Tests now MUST PASS:
    - F3 (source-backed snippets): rebuild from F1 fixture; query
      'goal' with kinds=['capsule'] limit=5; assert >=1 row, every
      row has 64-hex source_hash matching sha256 of file at
      source_path, snippet contains [hl] markers, score is finite
      number, kind === 'capsule'.
    - F4 (Phase 44 validateOne filter): rebuild from F1 with one
      synthetic capsule (milestone='v9.9', phase='99') NOT in
      legal-keys; assert query() with default filter_invalid:true
      drops it; assert query() with filter_invalid:false includes it
      with registry_valid:false. Spy on phase44.validateOne to
      confirm called with ('v9.9/99', 'phases').
    - S11 (limit clamp): query('text', {limit:1000}) clamps to <=100.
  </behavior>
  <action>
    1. Open `super-gsd/tools/context-cache/query.cjs` (Edit tool).
    2. Replace T1 stubs of query, querySnippet, open, close with real
       implementations per <behavior>.
    3. Phase 44 import wired at module top:
       ```js
       let phase44 = null;
       try { phase44 = require(path.join(__dirname, '..',
         'context-registry', 'check.cjs')); } catch (_e) {
         phase44 = null;
       }
       ```
       If phase44 === null at query time, fail-open
       (registry_valid = true; no filtering applied).
    4. Open DB with `new Database(dbPath, { readonly: true,
       fileMustExist: true })`. better-sqlite3 throws if DB doesn't
       exist; catch and return [] (Lock 13).
    5. Implement `_sanitizeFtsText(text)` helper: strip double-quotes
       and other FTS5-control chars; document in comment which chars
       are stripped and why (FTS5 query parser docs).
    6. Implement `_normalizeQueryOpts(opts)` returning canonical
       `{kinds, kindsJson, limit, milestone, phase, filter_invalid}`.
       kinds invalid entries dropped via KIND_VOCAB.includes filter;
       if 0 valid kinds remain after dropping, treat as undefined
       (no kind filter -- but this is configurable; document choice).
    7. Implement `_validateRow(row)` per-row Phase 44 filter:
       returns row mutated with row.registry_valid = bool.
    8. Wire query CLI verb: parse --query, --kinds (comma-sep),
       --limit, --milestone, --phase, --no-filter-invalid;
       call query() and JSON.stringify result; exit 0 on success
       (even if [] returned), 2 on bad invocation.
    9. Update `super-gsd/tools/context-cache/rebuild.test.cjs`:
       - Replace F3 PENDING stub with real assertion. _makeTmpPlanning
         must include synthetic legal-keys.json under tmpdir's
         super-gsd/tools/context-registry/ subtree (or set
         opts.registryPath). The synthetic capsule milestone+phase
         present in legal-keys.active.phases. Run rebuild + query;
         assert F3 expectations.
       - Replace F4 PENDING stub: _makeTmpPlanning adds a 3rd capsule
         with milestone='v9.9', phase='99'. Synthetic legal-keys
         deliberately excludes 'v9.9/99'. rebuild + query with
         filter_invalid:true; assert v9.9/99 NOT in result; query
         with filter_invalid:false; assert IN result with
         registry_valid:false. Use a mock/spy on phase44.validateOne
         to confirm call arguments.
       - Implement S11 limit-clamp assertion:
         result = query('text', {limit:1000}); assert result.length
         <= 100 (or assert the clamp signal in a side-channel by
         spying on the prepared statement bind-params).
    10. Run `node super-gsd/tools/context-cache/rebuild.cjs --self-test`
        -> F3, F4, S11 PASS; F6 still PENDING (T4). Total:
        12 PASS + 1 PENDING (out of 13).
    11. Verify ASCII-only.
    12. Verify F7 fingerprint guard still passes (still no canonical
        writes from T3).
    13. **Atomic commit 3**:
        ```
        feat(46-01): query.cjs - FTS5 query + validateOne filter + source-backed snippet shape
        ```
        Stage exactly: `super-gsd/tools/context-cache/query.cjs`,
        `super-gsd/tools/context-cache/rebuild.test.cjs`.
  </action>
  <verify>
    <automated>node super-gsd/tools/context-cache/rebuild.cjs --self-test</automated>
    <expected>If better-sqlite3 installed: >=12 PASS (F1-F5, F5b, F7, F8, S9-S13) + F6 PENDING. snippet() returns [hl]-marked text. bm25 score is finite number. source_hash matches sha256(fs.readFileSync(source_path)) for every result row. Phase 44 validateOne called per capsule row.</expected>
  </verify>
  <done>
    - query() returns Result[] with locked shape (Q7 LOCKED)
    - querySnippet() sugar wrapper works
    - open()/close() singleton handle works
    - Phase 44 validateOne called per capsule row at query time (NOT index time)
    - filter_invalid:true is default; filter_invalid:false returns all with registry_valid flag
    - F3 + F4 + S11 PASS
    - F6 still PENDING (T4 simulates better-sqlite3 missing)
    - Atomic commit 3 created
  </done>
</task>

<!-- ========================================================================
T4 (Wave 4) - INSTALL + GITIGNORE + MANIFEST SEED + F6 fixture + production smoke
COMMIT: feat(46-01): better-sqlite3 install + .gitignore + initial manifest seed
======================================================================== -->

<task type="auto" tdd="true">
  <name>Task 4: Install better-sqlite3, verify .gitignore, seed initial manifest, complete F6 fixture, run production smoke</name>
  <files>
    package.json,
    package-lock.json,
    .gitignore,
    .planning/cache/context-index.manifest.json,
    super-gsd/tools/context-cache/rebuild.test.cjs
  </files>
  <behavior>
    Final wave. Installs the optional native dep, verifies .gitignore
    is correct, completes the F6 graceful-sentinel fixture, runs
    production rebuild against real canonical state, commits the
    seeded manifest as A3 evidence.

    Preconditions verified before install (RESEARCH sec 7.1):
    - node --version reports v22.x (compatible prebuild range).
    - npm install better-sqlite3 --save adds dependency to
      package.json AND package-lock.json.
    - Post-install probe: `node -e "console.log(require('better-sqlite3').name)"`
      prints "Database" or similar (success signal); MUST NOT throw.
    - `.gitignore:3-5` already contains `*.db`, `*.db-wal`, `*.db-shm`
      (verified by Bash: `grep -nE '^\\*\\.db' .gitignore`).
      If missing (defensive -- should never trigger): append the 3 lines.
      The manifest path `.planning/cache/context-index.manifest.json`
      is NOT in .gitignore -- it MUST be git-tracked (A3 evidence per
      RESEARCH sec 4.1 + Phase 51 BENCH-05 dependency).

    F6 fixture full implementation (the last PENDING fixture):
    - Strategy: spawn a child Node process via child_process.execSync
      with NODE_PATH set to a non-existent directory AND env vars
      blanked, so the child cannot find better-sqlite3. Run a small
      script that requires rebuild.cjs and calls rebuild(). Capture
      stdout/exitcode/result.
    - Assert: result.ok === false; result.error ===
      'better_sqlite3_missing'; result.install_hint ===
      'npm install better-sqlite3 --save'; result.doc_count === 0;
      child exited 0 (graceful -- Lock 13); context-complaints.jsonl
      has appended row with reason:'better_sqlite3_missing'.
    - If the child cannot be made to fail (e.g., NODE_PATH
      manipulation insufficient on this platform), fall back to
      mocking via overriding require.cache + reload -- but spawn
      approach is the canonical mirror of Phase 44 stale-registry
      simulation pattern.

    Production smoke run (proves the full pipeline against REAL
    canonical state, NOT tmpdir):
    1. `node super-gsd/tools/context-cache/rebuild.cjs --rebuild`
       -> exit 0; result.ok === true; result.doc_count >= 80
       (per RESEARCH sec 3.2 lower bound); manifest written.
    2. `node super-gsd/tools/context-cache/rebuild.cjs --status`
       -> exit 0; reports doc_count, by_kind, db_size_bytes,
       manifest_hash, source_drift.detected === false (right after
       rebuild, no drift).
    3. `node super-gsd/tools/context-cache/query.cjs --query "phase capsule" --kinds capsule --limit 3`
       -> exit 0; returns ranked rows with [hl] markers.
    4. A3 binding live test:
       a. capture manifest_hash_v1 from
          `.planning/cache/context-index.manifest.json` (jq or node).
       b. `rm .planning/cache/context-index.db` (wal/shm too if exist).
       c. `node super-gsd/tools/context-cache/rebuild.cjs --rebuild`
          -> exit 0.
       d. capture manifest_hash_v2.
       e. assert manifest_hash_v1 === manifest_hash_v2.
       f. assert manifest.documents JSON byte-equivalent across the
          two rebuilds.

    Read-only invariant final check:
    - `git diff --quiet -- $(node -e "console.log([
        '.planning/metrics/agent-token-spend.jsonl',
        '.planning/metrics/token-attribution.jsonl',
        '.planning/metrics/codex-log.jsonl',
        '.planning/metrics/token-log.jsonl',
        '.planning/metrics/activity-log.jsonl',
        '.planning/metrics/token-waste-status.jsonl',
        '.planning/metrics/crit-backlog.jsonl',
        '.planning/metrics/gate-value-log.jsonl',
        '.planning/metrics/review-ledger.jsonl',
        '.planning/metrics/intent-map.jsonl',
        '.planning/metrics/context-packet-log.jsonl'
      ].join(' '))")`
      -> exit 0 (no changes to canonical streams during T4 work).
    - `git diff --quiet -- '.planning/milestones/**/PHASE-CAPSULE.json'
      '.planning/milestones/**/phases/**/*.md' 'super-gsd/registry/gates.yaml'
      'super-gsd/tools/context-registry/legal-keys.json'`
      -> exit 0.
    - context-complaints.jsonl IS modified (allowed; APPEND-ONLY) --
      assert the only changes are appended new rows
      (`git diff --check` for line additions only, no deletions).

    Final commit-set staging plan:
    - package.json + package-lock.json: better-sqlite3 dep added.
    - .gitignore: only if a defensive append happened (else unchanged).
    - .planning/cache/context-index.manifest.json: seeded with real
      v1.9 milestone state (A3 regression artifact).
    - super-gsd/tools/context-cache/rebuild.test.cjs: F6 fully wired.
  </behavior>
  <action>
    1. Pre-install probe:
       ```bash
       node -e "try { require('better-sqlite3'); console.log('PRESENT'); } catch (e) { console.log('MISSING:', e.code || e.message); }"
       ```
       Expected MILESTONE-READINESS state: MISSING. Record probe
       result in commit message details.
    2. Install:
       ```bash
       npm install better-sqlite3@^12.9.0 --save
       ```
       (Use ^ caret to allow minor/patch upgrades but pin major.)
       Verify package.json has `"better-sqlite3": "^12.9.0"` under
       `dependencies` (NOT devDependencies). Verify
       package-lock.json updated.
    3. Post-install probe:
       ```bash
       node -e "console.log(typeof require('better-sqlite3'))"
       ```
       Expected: `function` (Database constructor). If failed
       (binary missing, native build error on Windows):
       - Document the failure in commit message.
       - Phase 46 STILL ships (Lock 13 graceful sentinel covers
         this exact case); CI gate logic can flag the missing
         binary separately.
       - Continue to step 4 with the assumption that the F6
         fixture will exercise the missing path AND production
         smoke will skip with `result.ok:false,
         error:'better_sqlite3_missing'`.
    4. Verify .gitignore:
       ```bash
       grep -nE '^\*\.db(-wal|-shm)?$' .gitignore
       ```
       Expected: 3 lines (*.db, *.db-wal, *.db-shm). If any missing,
       append exactly those lines (use Edit tool, NOT echo>>).
       Verify `.planning/cache/context-index.manifest.json` is NOT
       matched by any .gitignore rule:
       ```bash
       git check-ignore -v .planning/cache/context-index.manifest.json
       ```
       Expected: exit code 1 (not ignored). If ignored: investigate
       and fix.
    5. Open `super-gsd/tools/context-cache/rebuild.test.cjs` (Edit).
    6. Replace F6 PENDING stub with full child-process simulation
       per <behavior>. Pseudocode:
       ```js
       function F6() {
         const tmpScript = path.join(os.tmpdir(),
           `sgsd-46-f6-${crypto.randomBytes(4).toString('hex')}.cjs`);
         fs.writeFileSync(tmpScript, `
           // Disable better-sqlite3 lookup by clearing module paths.
           const Module = require('module');
           const orig = Module._resolveFilename;
           Module._resolveFilename = function (req, parent, ...rest) {
             if (req === 'better-sqlite3') {
               const e = new Error("Cannot find module 'better-sqlite3'");
               e.code = 'MODULE_NOT_FOUND';
               throw e;
             }
             return orig.call(this, req, parent, ...rest);
           };
           const r = require(${JSON.stringify(path.resolve(__dirname, 'rebuild.cjs'))});
           const result = r.rebuild({ planningDir: process.argv[2] });
           console.log(JSON.stringify(result));
         `);
         const tmpPlanning = _makeTmpPlanning();
         const out = child_process.execFileSync(process.execPath,
           [tmpScript, tmpPlanning], { encoding: 'utf8' });
         fs.unlinkSync(tmpScript);
         const result = JSON.parse(out.trim().split('\n').pop());
         assert(result.ok === false, 'F6: result.ok must be false');
         assert(result.error === 'better_sqlite3_missing',
           'F6: error must be better_sqlite3_missing');
         assert(result.install_hint === 'npm install better-sqlite3 --save',
           'F6: install_hint mismatch');
         assert(result.doc_count === 0, 'F6: doc_count must be 0');
         // Verify complaints.jsonl appended:
         const compPath = path.join(tmpPlanning, 'metrics',
           'context-complaints.jsonl');
         const comps = fs.readFileSync(compPath, 'utf8')
           .trim().split('\n').filter(Boolean).map(JSON.parse);
         const last = comps[comps.length - 1];
         assert(last.reason === 'better_sqlite3_missing',
           'F6: complaint not appended with correct reason');
       }
       ```
    7. Run self-test against real canonical state (NOT tmpdir):
       ```bash
       node super-gsd/tools/context-cache/rebuild.cjs --self-test
       ```
       Expected: 13/13 PASS. If 12/13 (F6 quirk on Windows):
       document specific platform note, but F6 mechanism MUST
       still hold via the Module._resolveFilename override.
    8. Production rebuild against REAL .planning state:
       ```bash
       node super-gsd/tools/context-cache/rebuild.cjs --rebuild
       ```
       Expected: exit 0; result.ok:true; result.doc_count >= 80;
       `.planning/cache/context-index.db` exists; manifest written.
       If `result.ok:false, error:'better_sqlite3_missing'` (binary
       failure on this machine despite install): graceful sentinel
       -- exit 0; manifest seeding deferred but PLAN still ships.
       Document this in commit message.
    9. Production status check:
       ```bash
       node super-gsd/tools/context-cache/rebuild.cjs --status
       ```
       Expected: doc_count, by_kind correct; source_drift:false.
    10. Production query smoke:
        ```bash
        node super-gsd/tools/context-cache/query.cjs --query "phase capsule rebuild" --limit 3
        ```
        Expected: 1-3 ranked rows; [hl] markers; source_path resolves;
        source_hash matches sha256 of file (verify via
        `node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('PATH')).digest('hex'))"`).
    11. A3 binding live test:
        ```bash
        node -e "console.log(require('./.planning/cache/context-index.manifest.json').manifest_hash)" > /tmp/m1.txt
        rm .planning/cache/context-index.db
        rm -f .planning/cache/context-index.db-wal .planning/cache/context-index.db-shm
        node super-gsd/tools/context-cache/rebuild.cjs --rebuild
        node -e "console.log(require('./.planning/cache/context-index.manifest.json').manifest_hash)" > /tmp/m2.txt
        diff /tmp/m1.txt /tmp/m2.txt
        ```
        Expected: diff exits 0 (no difference). manifest_hash bytes-
        identical across rebuild.
    12. Read-only invariant final check (per <behavior>): run the
        two `git diff --quiet` commands; both exit 0.
    13. Stage manifest as A3 evidence:
        - `.planning/cache/context-index.manifest.json` already
          written by step 8/11; verify it's git-tracked (not gitignored).
    14. **Atomic commit 4**:
        ```
        feat(46-01): better-sqlite3 install + .gitignore + initial manifest seed

        - Install better-sqlite3@^12.9.0 to dependencies (RESEARCH sec 7.1)
        - Verify .gitignore rules cover *.db / *.db-wal / *.db-shm (already present)
        - Seed .planning/cache/context-index.manifest.json from real v1.9 canonical state
        - Complete F6 graceful-sentinel fixture (Module._resolveFilename override)
        - Production smoke: --rebuild, --status, --query all exit 0
        - A3 binding verified: rm db + rebuild -> manifest_hash unchanged
        - 13/13 self-test fixtures PASS

        INDEX-01..05 closed.
        ```
        Stage exactly: `package.json`, `package-lock.json`,
        `.gitignore` (only if defensively appended; otherwise omit),
        `.planning/cache/context-index.manifest.json`,
        `super-gsd/tools/context-cache/rebuild.test.cjs`.
  </action>
  <verify>
    <automated>node super-gsd/tools/context-cache/rebuild.cjs --self-test &amp;&amp; node super-gsd/tools/context-cache/rebuild.cjs --status</automated>
    <expected>--self-test: exit 0; 13/13 PASS. --status: exit 0; result.doc_count >= 80; result.by_kind matches RESEARCH sec 3.2 (capsule>=40, decision>=10, gate=13, file_summary>=1); source_drift.detected:false; manifest_hash 64-hex string. A3: rm db + rebuild yields byte-identical manifest_hash.</expected>
  </verify>
  <done>
    - better-sqlite3@^12.9.0 in package.json dependencies
    - .gitignore covers *.db rules (no edit needed unless absent)
    - .planning/cache/context-index.manifest.json git-tracked + seeded
      with real v1.9 canonical state
    - F6 fixture fully wired and PASSING
    - 13/13 self-test fixtures PASS
    - Production --rebuild, --status, --query all green
    - A3 binding live-verified (rm db + rebuild = byte-identical manifest)
    - F7 fingerprint guard: no canonical drift
    - Atomic commit 4 created
    - INDEX-01..05 all closed
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| canonical sources -> walker reads | Phase 46 walkers read PHASE-CAPSULE.json, mass-discuss.md, gates.yaml, file_summary.md as untrusted-shape inputs. Malformed JSON, malformed regex matches, or surprise byte sequences MUST NOT crash the walker. |
| query() input -> FTS5 MATCH | User-supplied `text` parameter passed to FTS5 MATCH. FTS5 has its own query syntax with operators (AND/OR/NEAR/double-quote-phrase). Adversarial text containing FTS5 operators could (a) cause FTS5 to throw a parse error, (b) match more/fewer rows than intended, but CANNOT escape sandbox or read DB pages they shouldn't (FTS5 MATCH is read-only against indexed body+title columns). |
| better-sqlite3 native binary -> Node runtime | Native addon. Binary integrity is npm/registry concern (out of scope). Lock 13 graceful-sentinel covers missing/corrupt binary. |
| .planning/cache/context-index.db -> other tools | The DB file is on local disk; other tools MAY open it. Phase 46 query.cjs opens read-only. Phase 49+ also read-only (per RESEARCH sec 6.4 + sec 12.2). NO tool may write the DB except Phase 46 rebuild.cjs. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-46-01 | T (Tampering) | documents.source_hash | mitigate | Walker computes sha256 from raw bytes BEFORE row construction; DDL `source_hash TEXT NOT NULL`; F2 fixture asserts byte-equivalent rebuild; F5b fixture asserts source_drift detection. |
| T-46-02 | I (Information disclosure) | query() result rows | mitigate | Phase 44 validateOne filter (default filter_invalid:true) drops superseded/unknown legal-keys at query time; query.cjs opens DB read-only with SQLITE_OPEN_READONLY; only indexed `body` + `title` columns exposed via FTS5 (no direct PRAGMA exposure). |
| T-46-03 | T (Tampering) | rebuild.cjs writes outside owned paths | mitigate | Read-Only Invariant LOCK 4: only writes are .planning/cache/context-index.{db,manifest.json} + APPEND-ONLY .planning/metrics/context-complaints.jsonl. F7 fixture captures fingerprints of 30 canonical paths and asserts unchanged after self-test (binding test). git diff --quiet against canonical streams in T4 production smoke. |
| T-46-04 | D (Denial of service) | better-sqlite3 missing | accept | Lock 13 graceful sentinel: rebuild()/query() return {ok:false, error:'better_sqlite3_missing', install_hint:'...'}; CLI exit 0; downstream consumers (Phase 49 GOV-02) check result.ok and fall back. F6 fixture binds. Risk: low -- Phase 46 ships gracefully degraded; remediation is single npm install. |
| T-46-05 | D (Denial of service) | adversarial FTS5 query text | mitigate | _sanitizeFtsText strips FTS5-control chars; query() wrapped in try/catch; on FTS5 parse error returns []. limit clamped to QUERY_LIMIT_MAX (100). No unbounded result sets. |
| T-46-06 | E (Elevation of privilege) | direct INSERT bypassing walker | accept | DDL CHECK constraints (`kind IN (...)`) + NOT NULL constraints on source_path and source_hash bind A4. F5 fixture demonstrates SQLite enforcement. Out of band: any tool that opens DB read-write can theoretically bypass -- but the canonical answer is "rebuild from scratch"; Lock 3 says SQLite is disposable, so privilege-elevation has no persistence. |
| T-46-07 | R (Repudiation) | manifest_hash drift undetected | mitigate | Manifest is git-tracked; A3 fixture (F2) asserts deep-equal across rebuilds; Phase 51 BENCH-05 will diff manifest@HEAD vs manifest@last-rebuild; status() reports source_drift.detected at any time. |
| T-46-08 | I (Information disclosure) | source_byte_offset leaks position of secrets in canonical files | accept | Canonical files (REQUIREMENTS.md, ROADMAP.md, gates.yaml, mass-discuss.md, PHASE-CAPSULE.json) are git-tracked public-to-repo content. Index does not introduce new disclosure surface. |
| T-46-09 | S (Spoofing) | path traversal via doc_id | mitigate | doc_id constructed from sanitized inputs (capsule milestone+phase, mass-discuss row number, gate name, file_summary path index). Walker invariants enforce typeof === 'string' and length > 0. No doc_id ever derived from query() input. |
</threat_model>

<verification>

## Phase-level acceptance verification

Run from repo root:

```bash
# 1. Self-test (13/13 fixtures)
node super-gsd/tools/context-cache/rebuild.cjs --self-test
# Expected: exit 0; "PASS: 13/13"

# 2. Production rebuild (proves A1 + A2 against real canonical state)
node super-gsd/tools/context-cache/rebuild.cjs --rebuild
# Expected: exit 0; result.ok:true;
#   result.doc_count >= 80;
#   result.by_kind: capsule >= 40, decision >= 10, gate_definition === 13, file_summary >= 1
#   .planning/cache/context-index.db exists
#   .planning/cache/context-index.manifest.json written

# 3. Status snapshot
node super-gsd/tools/context-cache/rebuild.cjs --status
# Expected: matches step 2 counts; source_drift.detected:false

# 4. Query smoke (proves A2: source-backed snippets with hashes)
node super-gsd/tools/context-cache/query.cjs --query "phase capsule rebuild" --limit 3
# Expected: 1-3 rows; [hl]-marked snippets; 64-hex source_hash;
#   source_path resolves to existing file under repo root

# 5. A3 binding (delete + rebuild -> byte-identical manifest)
M1=$(node -e "console.log(require('./.planning/cache/context-index.manifest.json').manifest_hash)")
rm .planning/cache/context-index.db
rm -f .planning/cache/context-index.db-wal .planning/cache/context-index.db-shm
node super-gsd/tools/context-cache/rebuild.cjs --rebuild
M2=$(node -e "console.log(require('./.planning/cache/context-index.manifest.json').manifest_hash)")
test "$M1" = "$M2" && echo "A3 PASS" || echo "A3 FAIL"
# Expected: A3 PASS

# 6. F4 binding (Phase 44 validateOne filter)
# Implicit in --self-test fixture F4; manual probe:
node -e "
  const q = require('./super-gsd/tools/context-cache/query.cjs');
  const valid = q.query('goal', {kinds:['capsule'], filter_invalid:true});
  const all = q.query('goal', {kinds:['capsule'], filter_invalid:false});
  console.log('valid:', valid.length, 'all:', all.length);
  console.log('every valid has registry_valid:true:', valid.every(r => r.registry_valid === true));
"
# Expected: valid.length <= all.length; every valid row has registry_valid:true

# 7. F5 binding (NULL source_path rejected)
# Implicit in --self-test fixture F5; manual probe:
node -e "
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(\"PRAGMA user_version = 1; CREATE TABLE documents (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, doc_id TEXT NOT NULL, source_path TEXT NOT NULL, source_hash TEXT NOT NULL, body TEXT NOT NULL, indexed_at TEXT NOT NULL);\");
  try {
    db.prepare('INSERT INTO documents (kind, doc_id, source_hash, body, indexed_at) VALUES (?,?,?,?,?)').run('capsule','fake','fake-hash','body','t');
    console.log('F5 FAIL: NULL source_path was accepted');
  } catch (e) {
    console.log('F5 PASS:', /NOT NULL/.test(e.message) ? 'NOT NULL constraint enforced' : e.message);
  }
"
# Expected: F5 PASS: NOT NULL constraint enforced

# 8. F5b binding (source_drift detection)
# Run --status before and after touching a file:
node super-gsd/tools/context-cache/rebuild.cjs --status > /tmp/s1.json
# (touch a file Phase 46 has indexed; e.g., add trailing whitespace to a CONTEXT.md
#  and revert immediately -- DO NOT keep the change)
# After modification: --status shows source_drift.detected:true; revert; rerun.

# 9. F6 binding (better-sqlite3 missing -> graceful sentinel)
# Implicit in --self-test fixture F6; manual probe (UNIX):
node -e "
  const Module = require('module');
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function(req, p, ...r) {
    if (req === 'better-sqlite3') {
      const e = new Error('Cannot find module better-sqlite3');
      e.code = 'MODULE_NOT_FOUND';
      throw e;
    }
    return origResolve.call(this, req, p, ...r);
  };
  delete require.cache[require.resolve('./super-gsd/tools/context-cache/rebuild.cjs')];
  const r = require('./super-gsd/tools/context-cache/rebuild.cjs');
  const result = r.rebuild({});
  console.log(JSON.stringify(result));
"
# Expected: result.ok === false; result.error === 'better_sqlite3_missing';
#   result.install_hint === 'npm install better-sqlite3 --save'; no throw

# 10. F7 binding (read-only invariant)
# Implicit in --self-test; manual probe via git:
git diff --quiet -- \
  .planning/metrics/agent-token-spend.jsonl \
  .planning/metrics/token-attribution.jsonl \
  .planning/metrics/codex-log.jsonl \
  .planning/metrics/token-log.jsonl \
  .planning/metrics/activity-log.jsonl \
  .planning/metrics/token-waste-status.jsonl \
  .planning/metrics/crit-backlog.jsonl \
  .planning/metrics/gate-value-log.jsonl \
  .planning/metrics/review-ledger.jsonl \
  .planning/metrics/intent-map.jsonl \
  .planning/metrics/context-packet-log.jsonl
# Expected: exit 0 (no changes to canonical streams during Phase 46 work).
# context-complaints.jsonl IS allowed to grow (APPEND-ONLY); check additions only:
git diff --check -- .planning/metrics/context-complaints.jsonl
# Expected: no syntax problems flagged (additions OK).

# 11. F8 binding (never throws upward)
# Implicit in --self-test; manual probe:
node -e "
  const r = require('./super-gsd/tools/context-cache/rebuild.cjs');
  const q = require('./super-gsd/tools/context-cache/query.cjs');
  const tests = [
    ['rebuild bad path', () => r.rebuild({ planningDir: '/nope' })],
    ['query null',       () => q.query(null)],
    ['query bad kind',   () => q.query('x', { kinds: ['bogus'] })],
    ['status bad db',    () => r.status({ dbPath: '/nope' })],
    ['emitManifest bad', () => r.emitManifest({ dbPath: '/nope' })],
  ];
  for (const [name, fn] of tests) {
    try { const v = fn(); console.log(name, 'OK ->', JSON.stringify(v).slice(0, 120)); }
    catch (e) { console.log(name, 'FAIL ->', e.message); process.exit(1); }
  }
"
# Expected: every line prints 'OK ->' followed by sentinel JSON; no FAIL.

# 12. ASCII-only check
node -e "
  const fs = require('fs');
  for (const p of [
    'super-gsd/tools/context-cache/rebuild.cjs',
    'super-gsd/tools/context-cache/query.cjs',
    'super-gsd/tools/context-cache/rebuild.test.cjs',
  ]) {
    const buf = fs.readFileSync(p);
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] > 127) {
        console.log('NON-ASCII at', p, 'offset', i, 'byte', buf[i]);
        process.exit(1);
      }
    }
    console.log(p, 'ASCII-only:', buf.length, 'bytes');
  }
"
# Expected: all 3 files print 'ASCII-only'; exit 0
```

## Acceptance criteria binding (verbatim from RESEARCH sec 1.1)

| Acceptance | Binding fixture | Status |
|------------|-----------------|--------|
| A1 (rebuild indexes 4 content types) | F1 + production smoke step 2 | MUST PASS |
| A2 (query returns source-backed snippets w/ hashes) | F3 + manual probe step 4 + step 11 (every result row has 64-hex source_hash matching sha256(file)) | MUST PASS |
| A3 (delete db + rebuild = same doc_count + manifest) | F2 + manual probe step 5 | MUST PASS |
| A4 (no decision/debt/evidence ONLY in SQLite) | F5 (NULL source_path rejected) + F5b (source_drift detection) + F7 (read-only invariant) + step 7 + step 8 + step 10 | MUST PASS |

## INDEX-01..05 binding (verbatim from REQUIREMENTS.md:166-176)

| ID | Description | Binding |
|----|-------------|---------|
| INDEX-01 | rebuildable SQLite FTS index under super-gsd/tools/context-cache/ | T1 scaffold + T2 walkers + T3 query; verified by self-test exit 0 |
| INDEX-02 | index capsules, decisions, gates, file summaries | T2 4 walkers; F1 row-count + production smoke by_kind |
| INDEX-03 | rebuild, query, self-test commands | T1 CLI verbs; production smoke steps 2/3/4 |
| INDEX-04 | delete db + rebuild = same count + hashes | T2 manifest emitter; F2 + step 5 (A3) |
| INDEX-05 | SQLite as projection only; canonical = .planning + git | T2 walker invariants + F5 + F5b + F7 + step 10 |

</verification>

<success_criteria>

Phase 46 ships when ALL of the following hold:

1. **All 4 atomic commits land in order** (one per task):
   - feat(46-01): context-cache schema + frozen consts + manifest contract + 13-assertion test scaffold
   - feat(46-01): rebuild.cjs - 4 content-type walkers + manifest_hash computation
   - feat(46-01): query.cjs - FTS5 query + validateOne filter + source-backed snippet shape
   - feat(46-01): better-sqlite3 install + .gitignore + initial manifest seed

2. **Self-test 13/13 PASS**: `node super-gsd/tools/context-cache/rebuild.cjs --self-test` exits 0 with all 13 fixtures (F1, F2, F3, F4, F5, F5b, F6, F7, F8, S9, S10, S11, S12, S13) reporting PASS. Note: 14 fixtures listed; if the planner committed 13 in S9-S13 mapping, document final count in commit 4 message.

3. **Production rebuild green**: `--rebuild` exits 0 with result.doc_count >= 80, by_kind matches RESEARCH sec 3.2 (capsule >= 40, decision >= 10, gate_definition === 13, file_summary >= 1), .planning/cache/context-index.db exists, manifest written.

4. **A3 binding verified live**: rm db + rebuild produces byte-identical manifest_hash in `.planning/cache/context-index.manifest.json`.

5. **A4 binding verified**: F5 fixture demonstrates SQLite rejects NULL source_path; F5b demonstrates source_drift detection; F7 demonstrates no canonical-stream writes during full self-test.

6. **F6 graceful sentinel verified**: rebuild.cjs returns {ok:false, error:'better_sqlite3_missing', install_hint:'npm install better-sqlite3 --save'} when better-sqlite3 is unfindable; CLI exit code remains 0 (Lock 13).

7. **Read-only invariant holds**: `git diff --quiet` exit 0 against the 13 canonical streams + canonical phase-folder content (CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC-REVIEW md + PHASE-CAPSULE.json + PHASE-INDEX.jsonl + gates.yaml + legal-keys.json) after Phase 46 work.

8. **Phase 44 validateOne wired at query time** (not index time): query() default filter_invalid:true drops superseded/unknown legal-keys; filter_invalid:false returns all with registry_valid flag.

9. **Phase 43/44 imports BY REFERENCE** confirmed: `grep -E "require.*phase-capsule|require.*context-registry"` in rebuild.cjs + query.cjs returns matches; no duplicated SCHEMA_VERSION / STATUS_VOCAB / REASONS / DEFAULT_CATEGORIES.

10. **better-sqlite3 in package.json dependencies** (NOT devDependencies); .gitignore covers *.db / *.db-wal / *.db-shm; .planning/cache/context-index.manifest.json git-tracked.

11. **ASCII-only on all 3 new files**: rebuild.cjs, query.cjs, rebuild.test.cjs.

12. **NO writes to Phase 45 build.cjs** (RESEARCH sec 12.1): Phase 45 step-6 wire-in is owned by Phase 49 GOV-02; Phase 46 ships only the index + query API. Verified via `git diff --stat super-gsd/tools/context-packet/build.cjs` exit 0 across all 4 commits.

13. **NO Redis coupling** (RESEARCH sec 12.4): rebuild.cjs and query.cjs do NOT require any Redis client; Phase 52 layers cache later. Verified via `grep -E "redis|ioredis|node-redis"` returns no hits.

14. **NO LIKE fallback path** (RESEARCH sec 9.2): rebuild.cjs and query.cjs do not implement a non-FTS5 retrieval mode. Verified via grep absence.

15. **NO semantic-similarity reranking** (Lock 11 reaffirmed): query.cjs does NOT call embedding services or compute cosine similarity; ranking is bm25 only.

</success_criteria>

<output>
After Phase 46 completes, create
`.planning/milestones/v1.9/phases/46-sqlite-context-index/46-01-sqlite-context-index-SUMMARY.md`
following `~/.claude/get-shit-done/templates/summary.md` + Phase 41-45 SUMMARY
mirror, including:

- 4 atomic commits SHAs and one-line summaries
- 13/13 self-test result table
- A1-A4 acceptance binding evidence
- INDEX-01..05 closure
- Production rebuild metrics (doc_count, by_kind, manifest_hash, db_size_bytes)
- Phase 49 / Phase 51 / Phase 52 forward contract notes
- Phase 45 step-6 stub remains untouched (delegated to Phase 49 GOV-02)
- Read-only invariant evidence (git diff --quiet results)
- F7 fingerprint guard pre/post fingerprints (sample)
- Mirror tracking: Phase 41 emitter, Phase 42 closed-flag CLI, Phase 43
  walker, Phase 44 validateOne, Phase 45 build.cjs:702-703 contract
- Critical-bypass passthrough verified: capsule.bypass_refs[].summary_passthrough
  body byte-equality across rebuilds (round-trip test in F2)

Then write the PHASE-CAPSULE.json via Phase 43:
```bash
node -e "require('./super-gsd/tools/phase-capsule/write.cjs').writeCapsule({ milestone: 'v1.9', phase: '46' })"
```

Verify Phase 44 validates the new capsule:
```bash
node super-gsd/tools/context-registry/check.cjs --validate-capsules
```
</output>
