---
phase: 46
phase_name: SQLite Context Index
milestone: v1.9
researched: 2026-04-27
domain: Rebuildable SQLite FTS5 projection over capsules / decisions / gate definitions / file summaries; Phase 45 step-6 consumer; Phase 49/51 read-time-validation source.
confidence: HIGH
controlling_principle: "SQLite is a PROJECTION; canonical = .planning + git. No phase decision, debt, or evidence may exist only in SQLite. Deleting the DB and rebuilding must yield byte-identical document count and hash manifest." (REQUIREMENTS.md:166-176, design lock 3 line 39, ROADMAP §46 lines 180-195, mass-discuss row 46 line 241, VTP-RESEARCH-DELTA Stateless Decision Memory / DDIA evidence)
mirror_template: Phase 41 token-attribution/report.cjs (envelope-v1 emitter + ROLES + ledgerPath + COMMAND_NAME), Phase 42 token-waste/check.cjs (read-only verdict producer + closed-flag CLI + never-throws-upward), Phase 43 phase-capsule/write.cjs (canonical-source walker + sha256 hashing + idempotent rebuild + SCHEMA_VERSION + Lock 13), Phase 44 context-registry/check.cjs (validateReferences boundary + 4-outcome reasons + Lock 13 falsey-sentinel), Phase 45 context-packet/build.cjs (8-step build sequence step 6 = local index snippets contract; current `_index_snippets: []` stub at build.cjs:703).
upstream: Phase 41 (ROLES, COMMAND_NAME, ENVELOPE_VERSION); Phase 43 (readCapsule, capsulePath, SCHEMA_VERSION, CAPSULE_FILE_KINDS, BYPASS_KIND_VOCAB; PHASE-CAPSULE.json files = primary index source); Phase 44 (validateReferences, isLegal, REASONS, DEFAULT_CATEGORIES; legal-keys.json = reference filter for query results); Phase 45 (REASON_VOCAB, ROLE_MODES, PACKET_BUDGETS; build.cjs:702-703 step-6 contract Phase 46 satisfies).
downstream: Phase 49 GOV-02 (memory-write admission reads index for read-time validation against source hashes; GOV-08 every memory write a privileged state transition); Phase 51 BENCH-05 (failure fixture: deleted SQLite DB → rebuild → equivalent doc count + hash manifest); Phase 52 REDIS-06 (Redis caches hot validated-thought projections WITH source hashes; SQLite remains durable rebuild target — Redis NEVER replaces SQLite).
---

# Phase 46 - SQLite Context Index - Research

## 1. Goal Restatement + Acceptance Criteria Mapping (A1-A4)

Phase 46 ships a **rebuildable SQLite FTS5 projection** over four canonical content types. It is the local retrieval layer that fills Phase 45's step-6 stub (`_index_snippets: []`, build.cjs:703) and provides the read-time substrate Phase 49 governance and Phase 51 benchmark consume.

It ships two production tools + one local artifact under `super-gsd/tools/context-cache/`:

1. **`rebuild.cjs`** — walks canonical sources (Phase 43 capsules, Phase 44 legal-keys decisions block, mass-discuss decision rows, gates.yaml, file summaries) and ingests them into a FTS5 virtual table + companion metadata table. CLI `--rebuild`, `--drop-and-rebuild`, `--status`, `--self-test`.
2. **`query.cjs`** — read-only API. `query(text, opts)` returns `{kind, source_path, source_hash, snippet, score}` rows, every row referencing a Phase 44 legal-keys reference filtered through `validateReferences`. CLI `--query "<text>"`, `--query-snippet`.
3. **`.planning/cache/context-index.db`** + **`.planning/cache/context-index.manifest.json`** — local-only generated artifacts under `.gitignore`'s existing `*.db` rule. Manifest is the A3-binding: rebuild equivalence is proven by deep-equal of two manifests captured before and after `rm db && rebuild`.

The mass-discuss / audit driving force: Phase 45 step-6 currently fs.readFileSync-fallbacks (build.cjs:702-703 `// Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct). const indexSnippets = [];`). Phase 46 replaces the empty stub with FTS5-backed snippets so packet builder can pull *one paragraph from one capsule* instead of *the whole capsule body* during retrieval. This is the local-index half of the v1.9 token-reduction pipeline (the other halves being Phase 43 capsules and Phase 45 packets).

### 1.1 ROADMAP §46 acceptance (lines 180-195, verbatim)

| # | Acceptance | Phase 46 binding |
|---|------------|------------------|
| A1 | "rebuild indexes capsules, decisions, gate definitions, and file summaries" | §4 four content-type walkers + §6 rebuild orchestrator + §11 F1 row-count fixture |
| A2 | "query returns source-backed snippets with source hashes" | §6 query API result row shape `{kind,source_path,source_hash,snippet,score}` + §11 F3 source-hash binding fixture |
| A3 | "deleting the DB and rebuilding preserves document count and hash manifest" | §5 hash manifest design + §6 `--drop-and-rebuild` orchestrator + §11 F2 idempotent-rebuild fixture (deep-equal manifest) |
| A4 | "no phase decision, debt, or evidence exists only in SQLite" | §8 every-row-has-source-path invariant + §11 F5 source-path-NULL rejection fixture + §15 read-only invariant against canonical streams |

### 1.2 INDEX-01..05 binding (REQUIREMENTS.md:166-176, verbatim)

| ID | Description | Phase 46 binding |
|----|-------------|------------------|
| INDEX-01 | Implement rebuildable SQLite FTS index under `super-gsd/tools/context-cache/` | §6 module structure (rebuild.cjs + query.cjs + schema-version constant) |
| INDEX-02 | Index phase capsules, accepted decisions, gate definitions, and file summaries | §4 four canonical-source walkers (one per content type, mirrored on Phase 44 build.cjs structure) |
| INDEX-03 | Provide `rebuild`, `query`, and `self-test` commands | §6 three CLI verbs (mirrored on Phase 41 `--summarize`/`--bloat-report`/`--self-test`) |
| INDEX-04 | "deleting the database and rebuilding produces the same indexed document count and hashes" | §5 manifest sha256 chain + §11 F2 fixture `assertDeepEqual(manifestPre, manifestPost)` |
| INDEX-05 | "Keep SQLite as projection only; canonical data stays in `.planning` and git" | §8 source-path-NULL guard + §15 read-only invariant + §1.4 design lock 3 binding |

### 1.3 Design lock binding (REQUIREMENTS.md:34-68, verbatim)

> Lock 1: "Redis is not canonical memory."
> Lock 2: "`.planning` JSONL, phase artifacts, and git commits remain source of truth."
> Lock 3: "SQLite/Redis projections must be rebuildable from canonical state."
> Lock 4: "Agents consume role-specific context packets, not raw milestone history."
> Lock 13: "Autonomy continues; evidence tells the truth. Budget breaches degrade or reroute by policy. They do not become silent overrun."

Phase 46 binding:
- **Lock 1+2+3 (the controlling triad)**: Phase 46 IS the embodiment of "rebuildable projection". The DB never holds a row whose `source_path` is NULL. The DB never owns a decision/debt/evidence that is not also in `.planning + git`. The DB CAN be deleted at any time and rebuild produces byte-equivalent state. §5 + §8 are the mechanical bindings.
- **Lock 4**: Phase 45 step-6 (build.cjs:702-703) is Phase 46's primary downstream consumer. The packet builder's empty `_index_snippets: []` becomes Phase 46's `query(intent_text, {kinds:['capsule','decision','gate','file_summary']}).slice(0, opts.k_per_role)`. Without Phase 46, Phase 45 packets retrieve *whole capsules* via fs.readFileSync; with Phase 46, they retrieve *FTS-ranked paragraph snippets* with per-snippet source hashes.
- **Lock 13**: All public API wraps in try/catch and never throws upward. CLI exit 0 even when `better-sqlite3` is missing (graceful sentinel return); only bad-invocation exits 2. Lock 13 mirrors Phase 41-45 contract.

REQUIREMENTS:284-305 hard-stops carry forward:
- Line 305 hard-stop: "Hard stop if an implementation makes Redis or SQLite canonical." Phase 46's mechanical embodiment: every row's `source_path` is NOT NULL; every row's `source_hash` matches the canonical file's sha256 at index time; deleting the DB is non-destructive. §11 F5 binds.

### 1.4 VTP-RESEARCH-DELTA binding (forward-only addendum)

VTP-RESEARCH-DELTA.md applies to Phase 46 **by construction**, not by reopening:

| VTP source | Lesson | Phase 46 binding |
|------------|--------|------------------|
| Stateless Decision Memory / DDIA | "Append-only truth plus rebuildable projections beats hidden mutable memory for auditability." | §1.3 Lock 3 binding; §5 manifest design; §11 F2 idempotency fixture. Phase 46 IS the canonical example of this lesson in v1.9. |
| Schema-Constrained Agent Memory | "Structural hallucination is a separate failure class. Valid references should be constrained." | §6 query results pass through Phase 44 `validateReferences` BEFORE return; superseded keys filtered (§11 F4). |
| Memory Security Survey | "Memory writes are privileged state transitions." | Phase 46 has NO direct memory-write API (read-only against canonical sources); §15 invariant. Phase 49 GOV-08 layers admission control on TOP of Phase 46. |
| Architecture Matters More Than Scale | "Route by cheap structural signals first." | §6 query returns FTS bm25 score so Phase 47 can route by structural relevance before falling back to LLM synthesis. |

---

## 2. Existing Surface Inventory

### 2.1 Consume by reference, never duplicate

| Surface | Path | Phase 46 use |
|---------|------|--------------|
| Phase 41 reporter | `super-gsd/tools/token-attribution/report.cjs` | **IMPORT** `ROLES`, `COMMAND_NAME`, `ENVELOPE_VERSION`, `ledgerPath` (token cost telemetry for query operations is informational only; not part of A1-A4) |
| Phase 43 capsule writer | `super-gsd/tools/phase-capsule/write.cjs` | **IMPORT** `readCapsule`, `capsulePath`, `SCHEMA_VERSION`, `CAPSULE_FILE_KINDS`, `BYPASS_KIND_VOCAB`, `STATUS_VOCAB`, `_findAllPhases` (or its mirror) |
| Phase 43 capsule schema | `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` | **REFERENCE** as ingestion contract for `kind=capsule` rows |
| Phase 43 capsule files | `.planning/milestones/{ms}/phases/{NN}-name/PHASE-CAPSULE.json` | **PRIMARY INDEX SOURCE** (44 files verified `Glob` 2026-04-27); each file → 1 capsule row (with hash) + N decision rows + N bypass-ref rows derived from capsule.decisions[] / capsule.bypass_refs[] |
| Phase 43 PHASE-INDEX | `.planning/milestones/{ms}/PHASE-INDEX.jsonl` | **READ** for capsule discovery + content_hash cross-check |
| Phase 44 validator | `super-gsd/tools/context-registry/check.cjs` | **IMPORT** `validateReferences`, `isLegal`, `REASONS`, `DEFAULT_CATEGORIES`, `loadRegistry` |
| Phase 44 registry | `super-gsd/tools/context-registry/legal-keys.json` | **READ** via `loadRegistry`; query results filtered against legal-keys before return |
| Phase 45 packet builder | `super-gsd/tools/context-packet/build.cjs` | **DOWNSTREAM CONSUMER** at line 702-703 (step 6 stub); Phase 46 makes this stub real. Phase 46 does NOT modify build.cjs (Phase 45 closed); Phase 49+ wires it. |
| gates.yaml | `super-gsd/registry/gates.yaml` | **READ** for `kind=gate_definition` rows (13 gates verified `grep -c '^  - name:'` 2026-04-27) |
| mass-discuss decisions | `.planning/discussions/2026-04-26-mass-discuss.md` | **READ** for `kind=decision` rows (52 phase locks verified lines 223-260; lines 263 onwards is meta-prose) |
| envelope-v1 | `super-gsd/registry/command-envelope-v1.yaml` | Phase 46 emitter rows (status reports) ride `additionalProperties:true` |
| `.gitignore` | `.gitignore:3-5` | **VERIFIED** `*.db`, `*.db-wal`, `*.db-shm` already present — no edit needed for `context-index.db`. Manifest file `.planning/cache/context-index.manifest.json` is **deliberately git-tracked** for A3 regression evidence (Phase 51 BENCH-05 reads it). |

### 2.2 Phase 46 creates exclusively (3 NEW + 0 EDIT artifacts)

| New artifact | Reason |
|--------------|--------|
| `super-gsd/tools/context-cache/rebuild.cjs` | INDEX-01 + INDEX-02 + INDEX-03 (`--rebuild`, `--drop-and-rebuild`, `--status` CLI verbs); contains four content-type walkers + sha256 manifest emitter |
| `super-gsd/tools/context-cache/query.cjs` | A2 + Phase 45 step-6 contract; `query(text, opts)` + `querySnippet(text, kind, limit)` + `--query "..."` CLI verb |
| `super-gsd/tools/context-cache/rebuild.test.cjs` | F1-F8 self-test fixtures (mirrors Phase 44 build.test.cjs pattern; 8 binding + 5 secondary = 13 assertions) |

**No edit to Phase 45 build.cjs in this phase.** Phase 45 closed; the `_index_snippets: []` stub remains. Phase 49 GOV-02 will be the call site that wires Phase 46's `query()` into packet construction (per Phase 49 cross-phase delta). Phase 46 ships *only* the index + query API; it does NOT mutate Phase 45 code. (This avoids reopening Phase 45 and respects VTP-RESEARCH-DELTA.md "Do not reopen Phases 41-44" extended-by-precedent to closed Phase 45.)

### 2.3 Phase 46 NEVER touches (READ-ONLY invariant; §15)

The 13 canonical streams + canonical phase-folder content (mirrors Phase 43-45 list verbatim):

- `.planning/metrics/agent-token-spend.jsonl` (Phase 41 owner)
- `.planning/metrics/token-attribution.jsonl`
- `.planning/metrics/codex-log.jsonl`
- `.planning/metrics/token-log.jsonl`
- `.planning/metrics/activity-log.jsonl`
- `.planning/metrics/token-waste-status.jsonl` (Phase 42)
- `.planning/metrics/crit-backlog.jsonl`
- `.planning/metrics/gate-value-log.jsonl`
- `.planning/metrics/review-ledger.jsonl`
- `.planning/metrics/intent-map.jsonl` (Phase 45)
- `.planning/metrics/context-packet-log.jsonl` (Phase 45)
- `.planning/metrics/context-complaints.jsonl` (Phase 43+45 append-only; Phase 46 may APPEND a `contextIndexComplaint` row on rebuild error — §6.5)
- All `.planning/milestones/**/PHASE-CAPSULE.json` (Phase 43)
- All `.planning/milestones/**/phases/**/{NN}-CONTEXT.md, RESEARCH.md, PLAN.md, VERIFICATION.md, ATC-REVIEW.md`
- `super-gsd/registry/legal-keys.json` (Phase 44)
- `super-gsd/registry/gates.yaml`

Phase 46 OWNED writes (the only writes Phase 46 performs):
- `.planning/cache/context-index.db` (+ `.db-wal`, `.db-shm`) — gitignored per `.gitignore:3-5`.
- `.planning/cache/context-index.manifest.json` — git-tracked; A3 regression artifact.
- `.planning/metrics/context-complaints.jsonl` — APPEND-ONLY of `contextIndexComplaint` rows on error (mirror of Phase 45 emitter pattern).

**A3 binding restated:** Deleting `.planning/cache/context-index.db` and re-running `--rebuild` MUST produce a manifest that is `deep-equal` to the manifest captured before deletion. F2 fixture asserts.

---

## 3. Audit-Driven Evidence — Why a Local FTS Index Now

### 3.1 Bloat audit's primary evidence (audit lines 168-204; recapitulated here for §13 traceability)

The Phase 40 researcher pulled 122,437 input tokens (98.3% cache-read) primarily because the agent re-walked phase folders during context inheritance. Each capsule was loaded *whole* (Phase 41-44 capsule average ≈ 4-6k tokens). With 44 capsules × 5k avg = 220k tokens just to "have prior context available". Phase 45 dropped this to ~25k per researcher packet by switching from raw inheritance to capsule-keyed retrieval, BUT Phase 45 step 6 still falls back to `fs.readFileSync` of full files when capsules don't cover a topic (build.cjs:702-703).

Phase 46's mechanical fix: replace whole-file reads with **FTS-ranked paragraph snippets**. Concretely:

- BEFORE Phase 46 (Phase 45 step 6 stub): `_index_snippets: []` → forces step 8 raw-file fallback → reads e.g. 2000 tokens of a 5000-token capsule.
- AFTER Phase 46: `query("intent text", {kinds:['capsule'], limit:5})` → returns 5 ranked snippets × ~150 tokens each = 750 tokens with per-snippet source hash + source path.

Reduction per packet (researcher role): expected ~1000-2000 tokens saved per packet build that exercises step 6. Phase 51 BENCH-04 measures the milestone-wide aggregate.

### 3.2 Direct row counts (verified 2026-04-27)

| Content type | Source path | Row count | Verification |
|--------------|-------------|----------:|--------------|
| Phase capsules | `.planning/milestones/*/phases/*/PHASE-CAPSULE.json` | **44** | `Glob` confirmed 44 files; matches Phase 44 audit row 1 (44 capsuled phases) |
| Mass-discuss decisions | `.planning/discussions/2026-04-26-mass-discuss.md` lines 223-260 | **30** rows in the locked table; **22** additional from §"Per-Phase Locked Decisions" prose blocks (165-210); total ~52 decision rows | `grep -c '^\| \d\d \|'` plus prose parse |
| Gate definitions | `super-gsd/registry/gates.yaml` `^  - name:` | **13** | `grep -n '^  - name:'` confirmed 13 entries (per-dispatch-ATC, phase-level-ATC, classifier-haiku, context-selector-haiku, sgsd-recall-queries, intent-injection, MUDA-waste-audit, qualitative-waste-audit, sgsd-curate-learnings, token-log, vtp-enrichment, verifier-row-arithmetic, verifier-detail-vs-summary) |
| File summaries | TBD — see §4.4 below | **N≈12-30** depending on policy | LOCKED in §4.4 |

**Total expected indexed documents: ~99-117** (44 capsules + 52 decisions + 13 gates + 12-30 file summaries). Each file-summary row counts as one document. F1 fixture asserts row count >= 80 (lower bound; hardware variance allowed for file-summary count if §4.4 chooses CONTEXT.md only path).

### 3.3 The fix Phase 46 mechanically embodies

Phase 46 is the *retrieval primitive* that completes the v1.9 pipeline: Phase 43 *compresses* phases into capsules; Phase 44 *validates* references; Phase 45 *constructs* role-specific packets but step 6 (local snippets) is empty; Phase 46 *fills step 6* with FTS-ranked snippets. Without Phase 46, Phase 49 governance has no read-time validator (it would need to walk capsules linearly), and Phase 51 benchmark's "deleted SQLite DB" failure fixture has no DB to delete.

---

## 4. Schema Design (Q1, Q2, Q3 LOCKED)

### 4.1 DB location (Q1 LOCKED)

```
.planning/cache/context-index.db          (SQLite database; gitignored)
.planning/cache/context-index.db-wal      (SQLite WAL; gitignored)
.planning/cache/context-index.db-shm      (SQLite shared-memory; gitignored)
.planning/cache/context-index.manifest.json   (hash manifest; GIT-TRACKED for A3)
```

`.gitignore:3-5` already covers `*.db`, `*.db-wal`, `*.db-shm`. **No `.gitignore` edit needed**. (Verified via `cat .gitignore` 2026-04-27.)

The manifest is deliberately git-tracked because it is the *evidence* that A3 holds. Phase 51 BENCH-05 will diff `manifest@last-rebuild` vs `manifest@HEAD` to detect canonical drift.

### 4.2 Schema design (Q2 LOCKED — hybrid: one FTS5 virtual table + one companion plain table per kind)

The schema uses **one FTS5 virtual table for searchable text + one companion plain table for metadata + source hashes**. This is the SQLite-canonical pattern (per [SQLite FTS5 docs](https://www.sqlite.org/fts5.html) and [better-sqlite3 README](https://www.npmjs.com/package/better-sqlite3) [VERIFIED: npm view better-sqlite3 version → 12.9.0, published 2026-04-12]).

Rejected alternatives:
- **Separate FTS table per kind** (rejected): forces kind-specific UNION queries and complicates cross-kind ranking; the v1.9 use case is "search any context for X" not "search only capsules for X". A single FTS table with `kind` column wins.
- **Plain LIKE-only schema** (rejected for primary path; kept as fallback per §9): no bm25 ranking, no snippet() function, no proximity matching. FTS5 is the standard.

#### 4.2.1 Schema DDL

```sql
-- Schema version frozen const (mirrors Phase 43 SCHEMA_VERSION = 1).
-- Stored in metadata table for migration detection (§10).
PRAGMA user_version = 1;

-- Companion plain table: one row per indexed document.
-- source_path NEVER NULL (A4 binding); source_hash NEVER NULL (A2 + A3 binding).
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK (kind IN ('capsule','decision','gate_definition','file_summary')),
  doc_id        TEXT NOT NULL,        -- e.g., 'v1.9/43' for capsules; 'mass-discuss-row-43' for decisions; 'gate:per-dispatch-ATC' for gates; 'CONTEXT:v1.9/46' for file summaries
  milestone     TEXT,                 -- nullable; only capsules + some decisions have one
  phase         TEXT,                 -- nullable; only capsules + phase-scoped decisions
  source_path   TEXT NOT NULL,        -- A4: ALWAYS the canonical file
  source_hash   TEXT NOT NULL,        -- A2 + A3: sha256 of source_path bytes at index time
  source_byte_offset INTEGER,         -- nullable; for decisions parsed from a multi-row file
  source_byte_length INTEGER,         -- nullable; pairs with offset for slice reproducibility
  title         TEXT,                 -- short label for UI/snippet preview
  indexed_at    TEXT NOT NULL,        -- ISO-8601 timestamp
  UNIQUE (kind, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(kind);
CREATE INDEX IF NOT EXISTS idx_documents_milestone_phase ON documents(milestone, phase);
CREATE INDEX IF NOT EXISTS idx_documents_source_hash ON documents(source_hash);

-- FTS5 virtual table: contentless mode pointing at documents.id.
-- 'content' linkage via 'documents' so updates sync (we use full rebuild, not incremental, so contentless is fine).
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  body,                               -- searchable text
  title,                              -- searchable title (boosted via column weight at query time)
  kind UNINDEXED,                     -- stored, not tokenized; cheap kind filter
  content='documents',
  content_rowid='id',
  tokenize='porter unicode61'         -- standard English stemmer + unicode-aware
);

-- Trigger to keep FTS in sync with documents on insert (rebuild path uses INSERT only;
-- DELETE happens via DROP TABLE on rebuild, not row-level DELETE).
CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, body, title, kind)
    VALUES (new.id, new.body_text_inline, new.title, new.kind);
END;
```

NOTE: the trigger references `new.body_text_inline` which is NOT a column in `documents` above. Two options:
1. **Inline body in `documents`** (chosen, per §4.2.2 below): add `body_text_inline TEXT NOT NULL` column to `documents`; FTS contentless points at it. Trade-off: ~2x storage. Acceptable: 99 docs × ~3KB avg = ~300KB. Negligible.
2. **External-content FTS5** (rejected): FTS5 can read body from documents table directly via `content='documents'` — but then we need a `body` column in documents. Same outcome; option 1 is clearer.

#### 4.2.2 Final documents schema (LOCKED)

```sql
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
  body               TEXT NOT NULL,    -- full searchable text; FTS5 reads from here
  indexed_at         TEXT NOT NULL,
  UNIQUE (kind, doc_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  body, title, kind UNINDEXED,
  content='documents', content_rowid='id',
  tokenize='porter unicode61'
);
-- INSERT triggers: ai (after insert), ad (after delete), au (after update) per FTS5 external-content recipe.
CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, body, title, kind) VALUES (new.id, new.body, new.title, new.kind);
END;
CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, body, title, kind) VALUES ('delete', old.id, old.body, old.title, old.kind);
END;
```

### 4.3 Source ingestion walkers (Q3 LOCKED — one walker per content type)

#### 4.3.1 Capsules walker (`kind='capsule'`)

```javascript
// rebuild.cjs::_walkCapsules
const phase43 = require('../phase-capsule/write.cjs');
const glob = '.planning/milestones/v*/phases/*/PHASE-CAPSULE.json';
// Use Phase 43 readCapsule for shape parity, OR direct fs.readFileSync + JSON.parse.
// Decision: direct read (Phase 46 is read-only against Phase 43 outputs; readCapsule
// has side effects in some paths; direct read is safer). Mirrors Phase 44 build.cjs
// pattern (walks capsule files directly, doesn't call writeCapsule).
for each capsule file:
  const buf = fs.readFileSync(path);                     // full bytes
  const sha = sha256(buf);                               // source_hash
  const cap = JSON.parse(buf.toString('utf8'));
  insert {
    kind: 'capsule',
    doc_id: `${cap.milestone}/${cap.phase}`,             // e.g., 'v1.9/43'
    milestone: cap.milestone,
    phase: cap.phase,
    source_path: relPath(file),
    source_hash: sha,
    title: cap.phase_name,
    body: [
      cap.goal || '',
      ...(cap.decisions || []).map(d => d.text).filter(Boolean),
      ...(cap.bypass_refs || []).map(b => b.summary_passthrough || '').filter(Boolean),
      ...(Array.isArray(cap.downstream_contract && cap.downstream_contract.constraints) ? cap.downstream_contract.constraints : []),
    ].join('\n\n').trim(),
    indexed_at: isoNow(),
  };
```

Each capsule produces **1 document row** (the capsule as a whole). Decisions inside capsules are NOT separately indexed via this walker; the §4.3.2 decisions walker handles mass-discuss decisions only. (Capsule decisions reach the index via the capsule body field; see §4.3.5 dedup rule.)

#### 4.3.2 Decisions walker (`kind='decision'`)

```javascript
// rebuild.cjs::_walkDecisions
const path = '.planning/discussions/2026-04-26-mass-discuss.md';
const buf = fs.readFileSync(path);
const sha = sha256(buf);
const text = buf.toString('utf8');

// Parse the locked decisions table (lines 223-260) row-by-row.
// Each row has shape `| {phase} | {locked_option} | {rationale} |`.
// One document per row; doc_id = 'mass-discuss-row-{phase}'.
const rowRegex = /^\|\s*(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
let m;
while ((m = rowRegex.exec(text)) !== null) {
  const phase = m[1];
  const lockedOption = m[2].trim();
  const rationale = m[3].trim();
  const offset = m.index;
  const length = m[0].length;
  insert {
    kind: 'decision',
    doc_id: `mass-discuss-row-${phase}`,
    milestone: null,                  // mass-discuss decisions span milestones
    phase: phase,                     // free-form; not validated against legal-keys at index time
    source_path: '.planning/discussions/2026-04-26-mass-discuss.md',
    source_hash: sha,                 // whole-file hash
    source_byte_offset: offset,
    source_byte_length: length,
    title: `Phase ${phase} locked decision`,
    body: `${lockedOption}. Rationale: ${rationale}`,
    indexed_at: isoNow(),
  };
}

// Also parse §"Per-Phase Locked Decisions" prose blocks (lines 165-210):
// each `### Phase N -- ...` section. Doc_id = 'mass-discuss-prose-{phase}'.
```

Expected row count: **30 table rows + ~22 prose rows = ~52 decision documents** (per §3.2 verification).

#### 4.3.3 Gate definitions walker (`kind='gate_definition'`)

```javascript
// rebuild.cjs::_walkGates
const path = 'super-gsd/registry/gates.yaml';
const buf = fs.readFileSync(path);
const sha = sha256(buf);
const text = buf.toString('utf8');

// Manual YAML parse (no `js-yaml` dep — Phase 41-45 never added one).
// Walk each `^  - name:` block, capture: name, category, step, enforcement_mode,
// repair_instruction, checks[], reviewer_agent, reviewer_provider,
// evidence_emitted[], escalation, source_dlb, state.
// Mirror Phase 44 build.cjs gates parser EXACTLY (already tested + production).

for each gate block:
  insert {
    kind: 'gate_definition',
    doc_id: `gate:${name}`,           // e.g., 'gate:per-dispatch-ATC'
    milestone: null,
    phase: null,
    source_path: 'super-gsd/registry/gates.yaml',
    source_hash: sha,
    source_byte_offset: blockStartOffset,
    source_byte_length: blockLength,
    title: name,
    body: [
      `Category: ${category}`,
      `Step: ${step}`,
      `Enforcement: ${enforcement_mode}`,
      `Repair: ${repair_instruction}`,
      `Checks: ${(checks || []).join('; ')}`,
      `Reviewer: ${reviewer_agent}/${reviewer_provider}`,
      `Source: ${source_dlb}`,
    ].join('\n'),
    indexed_at: isoNow(),
  };
```

Expected: **13 gate documents** (per §3.2 verification).

#### 4.3.4 File summaries walker (`kind='file_summary'`) — Q3 RESOLVED

> Open question from CONTEXT.md: "file summaries → ??? (which files? all .md? capsules already cover phases — what else?)"

**LOCKED scope**: file summaries cover the **5 v1.9 milestone-level documents that capsules do NOT cover**:

```
.planning/milestones/v1.9/REQUIREMENTS.md
.planning/milestones/v1.9/ROADMAP.md
.planning/milestones/v1.9/SGSD-HANDOVER.md
.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md
.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md
```

Plus the **3 audit/analysis source documents**:

```
.planning/analyses/2026-04-27-agent-context-bloat-audit.md
.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md
.planning/analyses/2026-04-27-intent-english-meaning-compiler.md
```

Plus **all `*-CONTEXT.md` files for currently-active milestone phases** (v1.9 only at index time): 12 phase contexts (phases 41-52).

**Total file_summary count: 5 + 3 + 12 = 20 documents** for the v1.9 milestone state. Future milestones extend the set when their REQUIREMENTS.md / ROADMAP.md / etc. exist.

**Walker policy**:
1. For each file in the set, read full bytes, sha256, then split into **logical sections** by H2 (`^## `) headers. Each section becomes 1 document. Average section count per file: 5-12.
2. **Cap at first 5 sections per file** to avoid bloat (rationale: §3.1 — the index is for snippet retrieval, not full-text reproduction; capsules cover phases, file_summary covers high-level overview only).
3. `body` = section heading + first 800 chars of section text (truncate; FTS5 indexes the truncated body, not the full section).
4. `source_byte_offset` + `source_byte_length` = section span; consumers can reconstruct full section by slicing source file.

Expected: 20 files × ~5 sections capped = **~100 file_summary documents max**, but a more realistic count is 12-30 because many of the listed files have fewer than 5 H2 sections (e.g., 46-CONTEXT.md has zero `## ` headers — the whole file is one document of length 379 bytes).

**Why this scope (alternatives rejected)**:
- "Index all .md files in .planning" (rejected): explosive document count (~500+); duplicates capsules; violates §3.1 token-reduction goal.
- "Index nothing, just capsules+decisions+gates" (rejected): A1 lists "file summaries" as a required content type; ROADMAP §46:192 lists "file summaries" verbatim; cannot drop.
- "Index README.md + top-level docs only" (rejected): too narrow; misses milestone-level orientation files like REQUIREMENTS.md that researcher packets need.

This scope is **deterministic** (file list is enumerated, not glob-discovered) which keeps F1 row-count assertion tight.

#### 4.3.5 Dedup rule

A capsule body (§4.3.1) may include text that is *also* in a file_summary section (e.g., goal text appears in both PHASE-CAPSULE.json and CONTEXT.md). This is acceptable: the index is keyed by `(kind, doc_id)`, so the same string appearing in two `kind` rows is two distinct documents. Query results carry `kind` so consumers can filter ("only capsules" or "only file_summary") if they want to avoid duplicate snippets.

### 4.4 File summaries scope (Q3 LOCKED above; recap as standalone subsection for traceability)

See §4.3.4. LOCKED to the 20-file enumerated set; section-capped to 5 per file; ~12-30 total expected documents.

---

## 5. Hash Manifest Design (Q4, Q8 LOCKED — A3 binding mechanism)

### 5.1 Manifest shape

`.planning/cache/context-index.manifest.json`:

```json
{
  "schema_version": 1,
  "generated_at": "2026-04-27T...",
  "generated_by": "super-gsd/tools/context-cache/rebuild.cjs@<git-sha>",
  "doc_count": 99,
  "by_kind": {
    "capsule": 44,
    "decision": 52,
    "gate_definition": 13,
    "file_summary": 20
  },
  "manifest_hash": "<sha256 of canonical JSON below>",
  "documents": [
    {
      "kind": "capsule",
      "doc_id": "v1.9/43",
      "source_path": ".planning/milestones/v1.9/phases/43-phase-capsule-contract/PHASE-CAPSULE.json",
      "source_hash": "0a1b2c...",
      "body_hash": "9f8e7d..."   // sha256 of the body string written to documents.body; binds A3
    },
    ...
  ]
}
```

The `documents[]` array is sorted by `(kind ASC, doc_id ASC)` to be insertion-order-independent. The top-level `manifest_hash` is `sha256(JSON.stringify(documents))` after sort.

### 5.2 A3 binding mechanism (LOCKED)

```text
1. rebuild --rebuild → emit manifest_v1
2. capture manifest_v1 to memory
3. delete .planning/cache/context-index.db (rm)
4. rebuild --rebuild → emit manifest_v2
5. assert deep-equal(manifest_v1.documents, manifest_v2.documents)
6. assert manifest_v1.manifest_hash === manifest_v2.manifest_hash
```

This sequence is the §11 F2 fixture. It binds A3 directly: "deleting the DB and rebuilding preserves document count AND hash manifest".

**Idempotency requirement**: `body_hash` must be insertion-order-independent. The walker inserts capsules in sorted order (`milestone ASC, phase ASC`); decisions in mass-discuss source-byte-offset ASC; gates in gates.yaml source-byte-offset ASC; file_summaries in enumerated-list-order. This produces deterministic `documents[]` arrays.

**`indexed_at` excluded from manifest**: the timestamp differs between rebuilds; manifest includes only deterministic fields (kind, doc_id, source_path, source_hash, body_hash). The `indexed_at` field is in the DB but not the manifest.

### 5.3 What `source_hash` vs `body_hash` are

- **`source_hash`**: sha256 of the *raw bytes* of the canonical source file (e.g., the entire mass-discuss.md file, the entire gates.yaml file, the entire PHASE-CAPSULE.json file). Multiple documents can share the same `source_hash` (e.g., all 52 mass-discuss decisions share the mass-discuss.md hash; all 13 gates share gates.yaml hash). This is the "did the source change?" signal.
- **`body_hash`**: sha256 of the `body` string written into the `documents.body` column (after the walker's parse + format step). This binds the *index payload* to the source. If a walker bug changes how a capsule's body is extracted, body_hash changes even when source_hash doesn't. This is the "did the index payload change?" signal.

A3 is bound by `body_hash`, not just `source_hash`, because A3 says "preserves document count AND hash manifest" — the manifest must capture the index *contents*, not just source presence.

### 5.4 Edge case: source file modified between rebuilds

If a canonical source changes (e.g., a new capsule is written, or mass-discuss is edited) between rebuilds, the manifests differ. This is **expected and correct**. A3 governs the deterministic-rebuild equivalence path (delete DB → rebuild from same canonical state → equivalent manifest), NOT immutability over time.

Phase 51 BENCH-05 test fixture explicitly: "deleted SQLite DB" — fixture deletes DB and rebuilds without modifying canonical sources. F2 fixture uses a tmp-dir-rooted canonical state to guarantee no concurrent modification.

---

## 6. Public API Design (Q5, Q6, Q7 LOCKED) + Phase 45 Step-6 Contract

### 6.1 rebuild.cjs entry points (Q5 LOCKED)

```javascript
// super-gsd/tools/context-cache/rebuild.cjs

// Public exports (Lock 13: every function in try/catch; never throws upward).
module.exports = {
  rebuild,                  // (opts) -> {ok, doc_count, by_kind, manifest_path, manifest_hash, error?}
  dropAndRebuild,           // (opts) -> same shape; performs rm db + rebuild
  status,                   // (opts) -> {ok, doc_count, by_kind, last_rebuild_at, db_size_bytes, manifest_hash, error?}
  emitManifest,             // (opts) -> {ok, manifest, manifest_hash}; read-only; reads DB and emits manifest WITHOUT touching DB
  SCHEMA_VERSION: 1,
  KIND_VOCAB: Object.freeze(['capsule','decision','gate_definition','file_summary']),
  DB_PATH: '.planning/cache/context-index.db',
  MANIFEST_PATH: '.planning/cache/context-index.manifest.json',
};

// CLI (mirrors Phase 41-45):
//   node rebuild.cjs --rebuild               → exit 0 on success; 1 on rebuild error; 2 on bad-invocation
//   node rebuild.cjs --drop-and-rebuild      → same exit codes
//   node rebuild.cjs --status                → exit 0 always (informational)
//   node rebuild.cjs --self-test             → exit 0 = all pass; 1 = any fixture fails; 2 = bad-invocation
```

`rebuild()` algorithm:
1. Open DB (create if missing) using better-sqlite3.
2. `BEGIN TRANSACTION`.
3. `DROP TABLE IF EXISTS documents_fts; DROP TABLE IF EXISTS documents;` (full rebuild path).
4. Apply schema DDL from §4.2.2.
5. Run 4 walkers in deterministic sort order (capsule → decision → gate_definition → file_summary).
6. `COMMIT`.
7. Emit manifest via `emitManifest(opts)`.
8. Write manifest to `MANIFEST_PATH` atomically (tmp + rename pattern, mirror Phase 44 build.cjs).
9. Return `{ok:true, doc_count, by_kind, manifest_path, manifest_hash}`.

`dropAndRebuild()` is `rebuild()` preceded by `fs.unlinkSync(DB_PATH)`. (`-wal` and `-shm` files auto-clean when the DB handle closes.)

### 6.2 query.cjs entry points (Q5 + Q7 LOCKED)

```javascript
// super-gsd/tools/context-cache/query.cjs

const phase44 = require('../context-registry/check.cjs');

module.exports = {
  query,                    // (text, opts?) -> Result[]
  querySnippet,             // (text, kind, limit?) -> Result[]   (convenience wrapper; calls query with opts.kinds=[kind], opts.limit=limit)
  open,                     // (opts?) -> handle (lazy; cached)
  close,                    // ()  -- close cached handle
};

// Result row shape (Phase 45 step-6 CONTRACT — Q7 LOCKED):
{
  kind:           'capsule' | 'decision' | 'gate_definition' | 'file_summary',
  doc_id:         string,                 // e.g., 'v1.9/43', 'mass-discuss-row-43', 'gate:per-dispatch-ATC'
  milestone:      string | null,
  phase:          string | null,
  source_path:    string,                 // canonical file (NEVER null per A4)
  source_hash:    string,                 // sha256 (NEVER null per A2)
  source_byte_offset: number | null,
  source_byte_length: number | null,
  title:          string | null,
  snippet:        string,                 // FTS5 snippet() output, ~150 chars with [hl]...[/hl] markers
  score:          number,                 // FTS5 bm25 (lower = better; we negate so consumers see higher = better)
  registry_valid: boolean,                // true iff Phase 44 validateReferences accepts this doc_id (Q6 binding)
}

// query(text, opts) options:
{
  kinds:          ['capsule','decision'],   // optional filter; default = all 4
  limit:          10,                       // default 10; max 100
  milestone:      'v1.9',                   // optional milestone filter
  phase:          '46',                     // optional phase filter
  filter_invalid: true,                     // default true; drops rows where Phase 44 validateReferences rejects
  budget_tokens:  null,                     // optional; if set, accumulate tokens until budget reached; mirror Phase 45 elision
}
```

Query SQL (canonical form):

```sql
SELECT
  d.kind,
  d.doc_id,
  d.milestone,
  d.phase,
  d.source_path,
  d.source_hash,
  d.source_byte_offset,
  d.source_byte_length,
  d.title,
  snippet(documents_fts, 0, '[hl]', '[/hl]', '...', 32) AS snippet,
  -bm25(documents_fts) AS score
FROM documents_fts
JOIN documents d ON d.id = documents_fts.rowid
WHERE documents_fts MATCH @text
  AND (@kinds IS NULL OR d.kind IN @kinds)
  AND (@milestone IS NULL OR d.milestone = @milestone)
  AND (@phase IS NULL OR d.phase = @phase)
ORDER BY score DESC
LIMIT @limit;
```

The `snippet()` function (FTS5 builtin, [SQLite docs](https://www.sqlite.org/fts5.html#the_snippet_function)) produces the highlighted excerpt. We use `[hl]...[/hl]` as markers (LLM-safe; no HTML risk to renderers).

### 6.3 Phase 45 step-6 contract (Q7 LOCKED — what the build.cjs:702-703 stub becomes)

**Current state (Phase 45 closed)** — `super-gsd/tools/context-packet/build.cjs` line 702-703:
```javascript
// Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct).
const indexSnippets = []; // No-op fallback; explicit empty.
```

**Future state (Phase 49 wires Phase 46)** — pseudocode for the eventual call site:
```javascript
const phase46 = (function () { try { return require('../context-cache/query.cjs'); } catch (_e) { return null; } })();

// Step 6: local index snippets via Phase 46 FTS index.
let indexSnippets = [];
if (phase46 && phase46.query) {
  try {
    const text = (intent_map && intent_map.canonical) || '';
    if (text) {
      const rows = phase46.query(text, {
        kinds: ['capsule', 'decision', 'gate_definition', 'file_summary'],
        limit: 5,                              // role-tunable; 5 is researcher default
        milestone: milestone || null,
        filter_invalid: true,
      });
      indexSnippets = (rows || []).map(r => ({
        kind: 'index_snippet',                 // matches CONTEXT_SOURCE_MIX_KEYS at build.cjs:118
        source_path: r.source_path,
        source_hash: r.source_hash,
        snippet: r.snippet,
        score: r.score,
        weight: 0.55,                          // shared_gate_or_provider tier; descending-weight elision
        estimated_tokens: _estimateTokens(r.snippet),
      }));
    }
  } catch (_e) { /* Lock 13: silent fall-through to empty array */ }
}
```

The result row shape is **stable across major versions** (Q7 LOCKED). Phase 49 + Phase 51 + Phase 52 all consume this shape.

**Token budget contract**: each result row's `snippet` is ≤32 tokens by FTS5's `snippet(..., 32)` argument. With limit=5, expected per-packet contribution: ≤160 tokens vs ~2000-token raw-file-fallback. This is the per-packet half of §3.1's expected reduction.

### 6.4 Legal-keys integration (Q6 LOCKED)

Per Lock 11 + REQUIREMENTS:284-285 hard-stop: query results referencing invalid keys are **filtered, not propagated**.

```javascript
// query.cjs::query() — after SQL execution, before return:
const phase44 = require('../context-registry/check.cjs');
const filtered = rawRows.map(row => {
  const ref = (row.kind === 'capsule' && row.milestone && row.phase)
    ? { key: `${row.milestone}/${row.phase}`, category: 'phases' }
    : null;
  let registryValid = true;
  if (ref && phase44 && phase44.validateOne) {
    try {
      const r = phase44.validateOne(ref.key, ref.category);
      registryValid = !!r.valid;
    } catch (_e) { /* Lock 13 */ registryValid = true; /* fail-open; we already have the row */ }
  }
  return { ...row, registry_valid: registryValid };
});

const out = (opts && opts.filter_invalid !== false)
  ? filtered.filter(r => r.registry_valid)
  : filtered;
return out;
```

**Key design choice (LOCKED)**: `validateOne` is called **per-row at query time**, NOT at index time. Rationale: legal-keys.json is a moving target (regenerated on every phase close); a row indexed when v1.9/43 was IN_PROGRESS may need re-validation when v1.9/43 status changes. Index-time validation would require rebuilding on every legal-keys change. Query-time validation is cheap (in-memory `loadRegistry` is mtime-cached singleton per Phase 44 build.cjs).

Phase 44 contract reuse (verbatim from check.cjs:25-27): `// build.cjs::loadRegistry consulted at every call (mtime-cached singleton).` — Phase 46 inherits this performance characteristic.

### 6.5 Status command (Q5 LOCKED)

```javascript
status(opts) -> {
  ok: true,
  doc_count: 99,
  by_kind: { capsule:44, decision:52, gate_definition:13, file_summary:20 },
  db_size_bytes: 524288,
  last_rebuild_at: '2026-04-27T...',
  manifest_hash: '...',
  manifest_age_seconds: 42,
  source_drift: {
    detected: false,                    // true if any indexed source file's current sha256 differs from manifest's source_hash
    drifted_paths: [],                  // up to 10 sample paths; full list in stderr
  },
}
```

`status` is read-only; uses `emitManifest()` (which reads DB) + walks the 4 source kinds to compute live source hashes for drift detection. Drift detection mirrors Phase 44 `_detectStaleRegistry` pattern.

---

## 7. Better-sqlite3 Install Policy (Q10 LOCKED) — Graceful Degradation Pattern

### 7.1 Install command

```bash
npm install better-sqlite3 --save
```

**Verified**:
- Latest version: **12.9.0** (published 2026-04-12, 15 days before this research) [VERIFIED: `npm view better-sqlite3 version`]
- Native addon; binary prebuilds exist for node v22 (current project node v22.22.2 [VERIFIED: `node --version`]).
- Pre-flight probe (per MILESTONE-READINESS.md:106): `node -e "require('better-sqlite3')"` currently FAILS with MODULE_NOT_FOUND. Phase 46 wave 0 task = `npm install better-sqlite3 --save`.

Recorded in `package.json` `dependencies` (NOT `devDependencies`) because Phase 46 tools are runtime tools used by Phase 49+ in production paths, not test-only utilities.

### 7.2 Graceful degradation pattern (Lock 13 + cache-degradation contract)

```javascript
// rebuild.cjs top — try/catch require for better-sqlite3.
let Database = null;
try {
  Database = require('better-sqlite3');
} catch (_e) {
  // Lock 13: never throw upward at module load.
  // The error surfaces only at function call time, with a structured sentinel.
}

function rebuild(opts) {
  try {
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
        by_kind: { capsule:0, decision:0, gate_definition:0, file_summary:0 },
        manifest_path: null,
        manifest_hash: null,
      };
    }
    // ... rebuild body
  } catch (e) {
    // Lock 13: never throw upward; emit complaint + falsey-sentinel return.
    _emitContextIndexComplaint({
      status: 'fail',
      reason: 'rebuild_error',
      details: { error: e && e.message ? e.message : String(e) },
    }, opts);
    return { ok: false, error: e && e.message ? e.message : String(e), doc_count: 0 };
  }
}
```

**CLI behavior**:
- `--rebuild` with module missing → exit 0 (degraded — informational only; mirrors Phase 44 check.cjs Lock 13 contract). Stderr prints the install hint. CI gate logic checks `result.ok`, NOT exit code.
- `--self-test` with module missing → fixture F8 (graceful sentinel) PASSES; other fixtures SKIP with reason='better_sqlite3_missing'. Self-test exit 0 (skip is not failure).

**Why graceful, not hard-fail**: Lock 13 + REQUIREMENTS:303 ("Defer Redis if local SQLite/file projection meets performance needs" implies degradation is acceptable). A hard-fail at module load would block all v1.9 tools from loading because Phase 49+ may transitively `require('../context-cache/query.cjs')`. Graceful degradation isolates the missing-dep blast radius to Phase 46 itself.

### 7.3 Native addon caveat

`better-sqlite3` requires a binary that matches the Node version + platform. Prebuilds cover most platforms. On a node-version mismatch (e.g., node 23 with no prebuild), the package would attempt to compile from source (requires Visual Studio Build Tools on Windows). This is a known sharp edge.

Mitigation: pin node version in `.nvmrc` or `engines` field if not already; document in §11 F8 fixture comments. Phase 51 BENCH-05 "deleted SQLite DB" fixture should also test `better_sqlite3_missing` as a degraded case.

### 7.4 SQLite version requirement

better-sqlite3 v12.9.0 ships with bundled SQLite (3.50.x range; verified on this machine: SQLite 3.50.4 with FTS5 compiled in: `sqlite3 :memory: "...pragma_compile_options..."` returned `ENABLE_FTS5`). No external SQLite needed.

---

## 8. No-Canonical (A4) Enforcement (Q9, Q15 LOCKED) — Read-Only Invariant + Every-Row-Has-Source-Hash

### 8.1 The A4 controlling invariants

A4 says "no phase decision, debt, or evidence exists only in SQLite". Mechanically Phase 46 enforces this through **two complementary invariants**:

**Invariant 1 — Every row has a non-null source_path**:
- DB schema enforces `source_path TEXT NOT NULL` (§4.2.2). SQLite rejects NULL inserts at the DDL level.
- Walker code never constructs a row without setting `source_path` (§4.3 walkers all populate explicitly).
- F5 fixture: synthetic test attempts `INSERT INTO documents (kind, doc_id, body) VALUES ('capsule', 'fake', 'body')` (omitting source_path) and asserts SQLite raises a `NOT NULL constraint failed: documents.source_path` error.

**Invariant 2 — Every row has a non-null source_hash**:
- DDL `source_hash TEXT NOT NULL`.
- Walkers ALWAYS sha256 the source bytes BEFORE building the row (§4.3.1-4.3.4 all do this in the same step).
- F2 idempotent rebuild fixture proves this end-to-end: source_hash is in the manifest, manifest is byte-equivalent across rebuilds → source_hash is non-null and stable.

### 8.2 The read-only invariant (Q15 LOCKED)

Phase 46 NEVER writes to canonical streams. The 13 read-only files listed in §2.3 plus all `*.md` / `PHASE-CAPSULE.json` / `PHASE-INDEX.jsonl` / `gates.yaml` / `legal-keys.json` are **read-only inputs**.

Phase 46 OWNED writes (the only writes Phase 46 performs):
- `.planning/cache/context-index.db` (gitignored)
- `.planning/cache/context-index.db-wal`, `.db-shm` (gitignored, transient)
- `.planning/cache/context-index.manifest.json` (git-tracked)
- `.planning/metrics/context-complaints.jsonl` — APPEND-ONLY rows on rebuild error (mirrors Phase 45 emitter)

§11 F7 fixture asserts: capture `mtime + size + sha256` of all 13 canonical streams + 5 milestone-level docs + 12 phase context files BEFORE `--self-test`; after self-test, assert all 30 fingerprints unchanged.

### 8.3 What "exists only in SQLite" would look like (the A4 negative case)

Hypothetical violation:
```sql
INSERT INTO documents (kind, doc_id, body, source_path, source_hash)
  VALUES ('decision', 'lessons-learned-2026-04-27', 'We should never index broad raw context.', NULL, NULL);
```
This violates Invariant 1+2 and SQLite raises NOT NULL constraint.

A more subtle violation:
```sql
INSERT INTO documents (kind, doc_id, body, source_path, source_hash)
  VALUES ('decision', 'cached-only', 'A decision typed at runtime.', 'IN_MEMORY', 'fake-hash-1234');
```
This passes the schema but `source_path = 'IN_MEMORY'` is not a real file. F5b fixture asserts `source_path` resolves to an existing file under repo root.

### 8.4 Lock 13 binding — never throws upward

Every public API is wrapped in try/catch. Errors return `{ok:false, error:'...'}` sentinels. F8 fixture validates this for `rebuild`, `query`, `status`, `emitManifest` paths.

---

## 9. FTS5 Fallback (Q13 LOCKED)

### 9.1 FTS5 availability

FTS5 is **always available** in better-sqlite3:
- better-sqlite3 v12.9.0 ships with bundled SQLite ≥3.50.x.
- SQLite has compiled FTS5 in by default since v3.20 (2017) [CITED: https://www.sqlite.org/fts5.html "FTS5 is included in SQL by default since version 3.9.0; FTS5 is enabled in default SQLite builds"].
- Verified on this machine: `sqlite3 :memory: "SELECT * FROM pragma_compile_options WHERE compile_options LIKE 'ENABLE_FTS5%'"` → returns `ENABLE_FTS5`.

### 9.2 Decision: NO fallback path

**LOCKED**: Phase 46 does NOT ship a LIKE-only fallback. If FTS5 is somehow unavailable in the bundled SQLite (which has not happened in any released better-sqlite3 version), the rebuild fails with `error: 'fts5_unavailable'` and the graceful-degradation path (§7.2) emits a complaint and returns the falsey sentinel.

Rationale:
- Maintaining two query paths (FTS vs LIKE) doubles test surface for low value (FTS5 absence is ~0% probability).
- LIKE-only retrieval has no bm25 ranking → degrades query quality in ways consumers cannot detect → Lock 13 violation in spirit.
- Graceful sentinel return is the v1.9 standard for missing infrastructure (Phase 42 budget breach, Phase 44 stale registry, Phase 46 missing better-sqlite3, Phase 48 VTP unavailable, Phase 52 Redis flush).

### 9.3 If a future SQLite build drops FTS5

If a future bundled SQLite drops FTS5 (extremely unlikely; SQLite never deprecates), the Phase 46 self-test F1 would fail at `CREATE VIRTUAL TABLE ... USING fts5(...)` with a `no such module: fts5` error. Lock 13 catches this; emits `fts5_unavailable` complaint; returns sentinel; CLI exit 0; cockpit shows degraded.

---

## 10. DB Versioning (Q14 LOCKED)

### 10.1 SCHEMA_VERSION = 1 frozen const

```javascript
const SCHEMA_VERSION = 1;   // mirrors Phase 43 phase-capsule/write.cjs:73
```

Stored in DB via `PRAGMA user_version = 1`.

### 10.2 Migration strategy: drop-and-rebuild (NOT in-place migration)

Per Lock 3 ("SQLite/Redis projections must be rebuildable from canonical state"), the v1.9 design intent is that the DB is **always disposable**. There is no in-place migration path because there is no canonical data in the DB to preserve.

**Rebuild on schema bump algorithm**:
```javascript
function rebuild(opts) {
  if (!Database) return _gracefulSentinel('better_sqlite3_missing');
  const dbPath = opts.dbPath || DB_PATH;
  const db = new Database(dbPath);
  const version = db.pragma('user_version', { simple: true });
  if (version !== SCHEMA_VERSION) {
    // Schema mismatch → drop-and-rebuild (NOT in-place migration).
    db.close();
    fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
    return rebuild(opts);   // recurse with fresh DB
  }
  // ... normal rebuild path
}
```

This is intentional and a key v1.9 design feature: schema evolution doesn't require migration scripts because the DB is a projection.

### 10.3 What changes on schema bump

If a future Phase (49+, 52) needs a new column (e.g., `kind='validated_thought'`), the change is:
1. Add new kind to `KIND_VOCAB`.
2. Add walker for new kind.
3. Update `CHECK (kind IN ...)` constraint.
4. Bump `SCHEMA_VERSION` to 2.
5. Existing DBs auto-rebuild on next `--rebuild` (per §10.2).

No migration code, no data preservation logic, no rollback path needed.

### 10.4 Manifest version

`.planning/cache/context-index.manifest.json` carries `schema_version: 1` at top level. Manifest readers (Phase 51 BENCH-05) check this and refuse to compare across schema versions.

---

## 11. Self-Test Design (Q11 LOCKED — 8 binding fixtures + 5 secondary = 13 assertions)

### 11.1 Fixtures (one per major behavior)

**F1 — Rebuild from empty produces N rows (A1 binding):**
- Setup: tmpdir with synthetic .planning structure containing 2 capsule files, 1 mass-discuss with 3 decision rows, 1 gates.yaml with 2 gate blocks, 2 file_summary source files with 2 H2 sections each.
- Run: `rebuild({planningDir: tmpDir, dbPath: tmpDb})`.
- Expected:
  - `result.ok === true`
  - `result.doc_count === 2 + 3 + 2 + 4 = 11`
  - `result.by_kind === {capsule:2, decision:3, gate_definition:2, file_summary:4}`
  - `documents` table row count === 11
  - `documents_fts` virtual table queryable — `SELECT count(*) FROM documents_fts WHERE documents_fts MATCH 'goal'` returns ≥1
  - manifest file written at `tmpDir + '/cache/context-index.manifest.json'`
  - manifest.doc_count === 11; manifest.by_kind matches

**F2 — Idempotent rebuild (A3 binding — THE CENTRAL FIXTURE):**
- Setup: same tmpdir as F1.
- Step 1: `rebuild()` → capture `manifest_v1`
- Step 2: `fs.unlinkSync(tmpDb)` (delete DB; keep canonical sources untouched)
- Step 3: `rebuild()` → capture `manifest_v2`
- Expected:
  - `manifest_v1.documents.length === manifest_v2.documents.length`
  - `JSON.stringify(manifest_v1.documents) === JSON.stringify(manifest_v2.documents)` (after canonical sort)
  - `manifest_v1.manifest_hash === manifest_v2.manifest_hash`
  - For each doc: `body_hash` identical across rebuilds
  - `indexed_at` differs (timestamp); manifest excludes it.

**F3 — Query returns source-backed snippets (A2 binding):**
- Setup: rebuild from F1.
- Run: `query('goal', {kinds:['capsule'], limit:5})`
- Expected:
  - `result.length >= 1`
  - Every row has: `kind === 'capsule'`, `source_path` matches `/PHASE-CAPSULE.json$/`, `source_hash` is 64-hex sha256, `snippet` contains `[hl]goal[/hl]` or similar highlighted match, `score` is finite number
  - `result[0].source_hash === sha256(fs.readFileSync(result[0].source_path))` (regression: hash is correct)
  - `result[0].registry_valid === true` (synthetic capsule milestone+phase added to legal-keys for F3 setup)

**F4 — Invalid reference filtered via Phase 44 validate (A4 partial binding):**
- Setup: rebuild from F1; the synthetic legal-keys deliberately excludes one of the 2 indexed capsules (e.g., capsule with milestone='v9.9', phase='99' — invented).
- Run: `query('goal', {kinds:['capsule'], filter_invalid: true})`
- Expected:
  - The v9.9/99 capsule does NOT appear in results
  - `query('goal', {kinds:['capsule'], filter_invalid: false})` DOES return the v9.9/99 row, with `registry_valid: false`
  - Phase 44 was actually called: spy/mock confirms `validateOne` invoked with `('v9.9/99', 'phases')`

**F5 — Source-path NULL violation rejected (A4 binding):**
- Setup: open DB directly (not via rebuild).
- Run: `db.prepare("INSERT INTO documents (kind, doc_id, body, source_hash) VALUES (?,?,?,?)").run('capsule','fake-no-path','body','fake-hash')`
- Expected:
  - SQLite throws `NOT NULL constraint failed: documents.source_path`
  - Test catches, asserts error message contains 'NOT NULL constraint'

**F5b — Source-path-not-a-real-file detection:**
- Setup: rebuild from F1.
- Run: `status({planningDir: tmpDir})`
- Expected:
  - `result.source_drift.detected === false` (all paths exist + hashes match)
  - Modify one indexed source: `fs.writeFileSync(somePath, oldContent + 'extra')`
  - Re-run `status()`
  - `result.source_drift.detected === true`; `drifted_paths` contains the modified path

**F6 — Better-sqlite3 missing → graceful sentinel (Lock 13 + Q10):**
- Setup: monkey-patch `require('better-sqlite3')` to throw at the top of rebuild.cjs (or use a child_process spawn with a shim).
- Run: `rebuild()`
- Expected:
  - `result.ok === false`
  - `result.error === 'better_sqlite3_missing'`
  - `result.install_hint === 'npm install better-sqlite3 --save'`
  - `result.doc_count === 0`
  - NO uncaught exception thrown
  - `context-complaints.jsonl` has appended row with `reason: 'better_sqlite3_missing'`

**F7 — Read-only invariant (LOCK 4 + §15 binding):**
- Setup: capture mtime+size+sha256 of all 13 canonical streams (§2.3) + 5 milestone-level docs (REQUIREMENTS, ROADMAP, SGSD-HANDOVER, EXISTING-SURFACE-AUDIT, VTP-RESEARCH-DELTA) + 12 phase context files = 30 paths.
- Run: full self-test sequence (F1-F8).
- Expected: post-test fingerprints match pre-test for all 30 paths. (Self-test runs in tmpdir, so canonical state cannot be touched.)

**F8 — All public API never throws upward (Lock 13 binding):**
- Run synthetic faults at every layer:
  - `rebuild({planningDir: '/non/existent/path'})` → returns `{ok:false, ...}`, no throw
  - `query(null)` → returns `[]`, no throw
  - `query('text', {kinds: ['invalid_kind']})` → returns `[]`, no throw (invalid kinds filtered)
  - `status({dbPath: '/non/existent/db'})` → returns `{ok:true, doc_count:0, ...}`, no throw
  - `emitManifest({dbPath: '/non/existent/db'})` → returns `{ok:false, manifest:null, ...}`, no throw

### 11.2 Secondary assertions (5; mirror Phase 41-45 patterns)

| # | Assertion | Why |
|---|-----------|-----|
| 9 | `KIND_VOCAB` is `Object.freeze`'d 4-entry array; mutation no-op | Frozen-const contract |
| 10 | `SCHEMA_VERSION === 1`; `pragma user_version === 1` after rebuild | §10 binding |
| 11 | `query('text', {limit: 1000})` clamps to max 100 (`Math.min(opts.limit, 100)`) | Defensive bound |
| 12 | Walker sort order is deterministic — back-to-back rebuilds with no changes produce byte-identical manifests | F2 expanded; sub-binding |
| 13 | `--self-test` exit code: all pass = 0; any fail = 1; bad-invocation = 2 | CLI contract |

### 11.3 Self-test invariants

Mirrors Phase 41-45 fingerprint guard:
- All fixtures run in `os.tmpdir() + '/sgsd-phase-46-...'` directories.
- F7 captures real-canonical fingerprints; tmpdir-only test surface guarantees no canonical writes.
- CLI exit code: all assertions pass → exit 0; 1+ fails → exit 1; bad invocation → exit 2.

---

## 12. Cross-Phase Contracts (Q12 LOCKED) — Phase 45/49/51/52 Consumption Shape

### 12.1 Phase 45 → Phase 46 (REVERSE direction; Phase 46 satisfies Phase 45's deferred contract)

Phase 45 build.cjs:702-703 left `_index_snippets: []` as a stub. Phase 46 ships `query()` matching the shape Phase 45 is ready to consume — **but Phase 46 does NOT modify Phase 45 code**. The wire-in happens in Phase 49 GOV-02 (per Phase 49 cross-phase delta).

**Why not wire in this phase**: Phase 45 is closed. Reopening would require RESEARCH-DELTA + new wave + re-running 45-VERIFICATION. Phase 49's scope already includes "memory write admission checks" which is the natural site for "switch step 6 from stub to live query". This delegation respects the v1.9 phase-closure contract.

### 12.2 Phase 46 → Phase 49 (Memory Governance Lifecycle)

Phase 49 GOV-02 ("memory write admission checks for capsules, summaries, and promoted rules") consumes Phase 46 in two ways:

1. **Read-time validation**: before admitting a new capsule/summary/rule, Phase 49 calls `query(text, {kinds:['capsule','decision'], limit:5})` to detect near-duplicates. If a high-score match exists, admission demotes to "duplicate of X" rather than creating new memory.
2. **Source-hash validation**: each promotion candidate's `source_refs` (per VTP-DELTA `validated_thought`) must resolve to a `source_hash` Phase 46 has indexed. If not indexed → not in canonical state → admission rejected.

Phase 49's call shape (forward contract):
```javascript
const phase46 = require('../context-cache/query.cjs');
const matches = phase46.query(candidateThought.thought, {
  kinds: ['capsule', 'decision', 'file_summary'],
  limit: 3,
  filter_invalid: true,
});
const isNearDup = matches.length > 0 && matches[0].score > NEAR_DUP_THRESHOLD;
if (isNearDup) admit('demote_to_reuse', matches[0].doc_id);
```

### 12.3 Phase 46 → Phase 51 (Context Stress Benchmark)

Phase 51 BENCH-05 explicitly: "Failure injection covers ... deleted SQLite DB...". Phase 46's `dropAndRebuild()` API is the test harness primitive. The fixture:

```javascript
// Phase 51 fixture
const phase46 = require('../context-cache/rebuild.cjs');
const beforeManifest = phase46.emitManifest().manifest;
const beforePackets = runResearcherWorkload();   // baseline packet token spend
fs.unlinkSync(phase46.DB_PATH);                  // delete DB mid-run
const afterPackets = runResearcherWorkload();    // packets should fall back to step 8 raw
phase46.rebuild();                               // force rebuild
const afterManifest = phase46.emitManifest().manifest;
assertDeepEqual(beforeManifest, afterManifest); // A3 in benchmark context
```

BENCH-04 (50% researcher token reduction) implicitly depends on Phase 46 being live — without Phase 46 step 6 stays empty, packets fall back to raw, reduction target unmet.

### 12.4 Phase 46 → Phase 52 (Redis Live Cache Adapter)

REDIS-06: "Redis may cache hot validated-thought projections only with source hashes, and must invalidate or rebuild them when canonical source hashes change." Phase 52's Redis adapter caches Phase 46 query results keyed by `(text + opts hash)`. Cache invalidation listens for `source_hash` changes — when `status().source_drift.detected === true`, Redis flushes affected keys.

Phase 52 NEVER replaces Phase 46. SQLite remains the durable rebuildable projection; Redis is ephemeral hot cache layered on top.

```javascript
// Phase 52 forward sketch
const phase46 = require('../context-cache/query.cjs');
function cachedQuery(text, opts) {
  const key = sha256(text + JSON.stringify(opts || {}));
  const cached = redis.get(key);
  if (cached) return JSON.parse(cached);
  const fresh = phase46.query(text, opts);
  redis.set(key, JSON.stringify(fresh), 'EX', 300);   // 5min TTL
  return fresh;
}
// On source_drift detection (status() periodic check), redis.flushPattern('cache:phase46:*').
```

---

## 13. Hard-Stop Conditions

Per REQUIREMENTS:303-313 + design lock 3:

| Condition | Trigger | Phase 46 response |
|-----------|---------|-------------------|
| SQLite becomes canonical | A row inserted with `source_path === NULL` (somehow) OR a query returns data not derivable from canonical sources | Hard stop. F5 fixture binds. CLI exit 1; orchestrator halts; operator must investigate. |
| Critical bypass summarized away | Phase 46 indexes a capsule's `bypass_refs[].summary_passthrough` and shortens it during indexing | NOT POSSIBLE: walker §4.3.1 copies `summary_passthrough` byte-verbatim into body field. F-bonus fixture asserts byte-equality on round-trip. |
| Invalid phase/gate IDs accepted | `query()` returns a row whose doc_id references an unknown legal-keys ID without filtering | F4 fixture binds. `filter_invalid: true` is the default. |
| Source file rewritten outside canonical workflow | `source_drift.detected === true` after rebuild | Status reports drift; rebuild produces new manifest; if Phase 51 BENCH-05 hash-manifest comparison fails, milestone close blocks. |

Phase 46 never silently overruns or hides errors (Lock 13).

---

## 14. Open Derivation Calls — LOCKED (empty)

All 15 research questions from CONTEXT.md are LOCKED in this document:

| Q | Topic | Status | Section |
|---|-------|--------|---------|
| Q1 | DB location + .gitignore | LOCKED | §4.1 |
| Q2 | Schema design (single FTS table + companion + per-kind?) | LOCKED — single FTS5 + single documents table with `kind` column | §4.2 |
| Q3 | Source ingestion walkers | LOCKED — 4 walkers; file_summary scope LOCKED to 20-file enumerated set | §4.3 |
| Q4 | Hash manifest | LOCKED — sha256 source + sha256 body, sorted+canonical | §5 |
| Q5 | Public API (rebuild + query entry points) | LOCKED | §6.1, §6.2 |
| Q6 | Legal-keys integration | LOCKED — query-time validateOne, default filter_invalid:true | §6.4 |
| Q7 | Phase 45 step-6 contract (result row shape) | LOCKED — `{kind, doc_id, milestone, phase, source_path, source_hash, snippet, score, registry_valid, ...}` | §6.2, §6.3 |
| Q8 | Idempotency mechanism | LOCKED — manifest deep-equal across delete+rebuild | §5.2, F2 fixture |
| Q9 | A4 enforcement (every-row-has-source-path) | LOCKED — DDL NOT NULL + walker invariant + F5 fixture | §8 |
| Q10 | better-sqlite3 install + graceful degradation | LOCKED — `npm install --save`; graceful sentinel; CLI exit 0 on missing | §7 |
| Q11 | Self-test (8 binding + 5 secondary = 13 assertions) | LOCKED | §11 |
| Q12 | Cross-phase contracts (45/49/51/52) | LOCKED | §12 |
| Q13 | FTS5 vs LIKE fallback | LOCKED — no LIKE fallback; FTS5 always-on; graceful sentinel on absence | §9 |
| Q14 | DB versioning (migrate vs rebuild) | LOCKED — rebuild-on-bump, no in-place migration | §10 |
| Q15 | Read-only invariant | LOCKED — 13 canonical streams + canonical phase-folder content NEVER written; tmpdir self-test; F7 fingerprint guard | §8.2, §15 |

**No open derivations.** Planner can begin Wave 0 without further research dispatch.

---

## 15. Read-Only Invariant (Q15 LOCKED — recap)

### 15.1 Phase 46 NEVER writes to canonical streams

The 13 read-only files listed in §2.3, plus all `*-CONTEXT.md`, `*-RESEARCH.md`, `*-PLAN.md`, `*-VERIFICATION.md`, `PHASE-CAPSULE.json`, `PHASE-INDEX.jsonl`, `gates.yaml`, `legal-keys.json`, `mass-discuss.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `SGSD-HANDOVER.md`, `EXISTING-SURFACE-AUDIT.md`, `VTP-RESEARCH-DELTA.md` are READ-ONLY inputs.

### 15.2 Phase 46 OWNED writes (the only writes)

- `.planning/cache/context-index.db` — gitignored
- `.planning/cache/context-index.db-wal`, `.db-shm` — gitignored, transient
- `.planning/cache/context-index.manifest.json` — git-tracked; A3 evidence
- `.planning/metrics/context-complaints.jsonl` — APPEND-ONLY `contextIndexComplaint` rows on rebuild error

### 15.3 Fingerprint guard

F7 fixture captures mtime+size+sha256 of 30 canonical paths BEFORE self-test; asserts unchanged AFTER self-test. Self-test runs in tmpdir; cannot touch canonical state.

### 15.4 Lock 13 binding — never throws upward

Every public API (`rebuild`, `dropAndRebuild`, `status`, `emitManifest`, `query`, `querySnippet`, `open`, `close`) wraps internals in try/catch. Falsey-sentinel return on error. CLI exit 0 even on graceful degradation; only bad-invocation exits 2; only assertion failure in self-test exits 1.

---

## 16. Single Plan Recommendation

### 16.1 File count

3 NEW + 1 EDIT (package.json `dependencies` add):
1. `super-gsd/tools/context-cache/rebuild.cjs` — ~600 LOC
2. `super-gsd/tools/context-cache/query.cjs` — ~250 LOC
3. `super-gsd/tools/context-cache/rebuild.test.cjs` — ~500 LOC (8 fixtures + 5 secondary)
4. `package.json` (EDIT) — add `"better-sqlite3": "^12.9.0"` to `dependencies`

### 16.2 Single plan recommended

**Plan 46-01**: implement the full Phase 46 in one plan with 5 waves:
- **Wave 0** — `npm install better-sqlite3 --save` + scaffold rebuild.cjs/query.cjs skeleton with module exports + CLI parser; commit.
- **Wave 1** — Schema DDL + 4 walkers (capsule, decision, gate, file_summary); sequential commits per walker.
- **Wave 2** — Manifest emitter + emitManifest() + atomic write (tmp+rename); commit.
- **Wave 3** — query.cjs implementation including bm25 + snippet() + Phase 44 filter; commit.
- **Wave 4** — F1-F8 fixtures + F7 fingerprint guard + secondary assertions; commit per fixture group.
- **Wave 5** — CLI verbs (`--rebuild`, `--drop-and-rebuild`, `--status`, `--query`, `--self-test`) + production caller smoke (run `--rebuild` from repo root and verify `.planning/cache/context-index.db` + manifest exist with expected counts); final commit.

### 16.3 Test command (Wave 4 + 5 acceptance)

```bash
npm install better-sqlite3 --save
node super-gsd/tools/context-cache/rebuild.cjs --self-test       # exit 0 = 13 pass
node super-gsd/tools/context-cache/rebuild.cjs --rebuild         # exit 0; .planning/cache/context-index.db created
node super-gsd/tools/context-cache/rebuild.cjs --status          # exit 0; doc_count >= 80
node super-gsd/tools/context-cache/query.cjs --query "phase capsule"  # returns ranked rows
# A3 binding test:
node super-gsd/tools/context-cache/rebuild.cjs --rebuild         # capture manifest_hash
rm .planning/cache/context-index.db
node super-gsd/tools/context-cache/rebuild.cjs --rebuild         # capture manifest_hash again
diff <(jq -S . .planning/cache/context-index.manifest.json | grep -v indexed_at) ...   # equivalent
```

### 16.4 Acceptance gate

All 4 ROADMAP §46 acceptance items (A1-A4) MUST be backed by a binding self-test fixture:
- A1 ↔ F1 (rebuild from empty produces N rows)
- A2 ↔ F3 (query returns source-backed snippets with hashes)
- A3 ↔ F2 (delete+rebuild manifest deep-equal)
- A4 ↔ F5 + F5b (every row has source_path; source_path resolves to real file)

Plus 5 INDEX-01..05 requirements bound to either a fixture or a §11 secondary assertion.

---

## Sources

### Primary (HIGH confidence)
- `.planning/milestones/v1.9/REQUIREMENTS.md` — INDEX-01..05 verbatim (lines 166-176); design locks 1-13 (lines 34-68); hard-stops (lines 303-313). [VERIFIED: file Read 2026-04-27]
- `.planning/milestones/v1.9/ROADMAP.md` — Phase 46 acceptance verbatim (lines 180-195). [VERIFIED]
- `.planning/milestones/v1.9/SGSD-HANDOVER.md` — implementation rules ("Never let Redis or SQLite own truth", "rebuild test", "delete/flush safety test", lines 91-110). [VERIFIED]
- `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md` — forward-only addendum: Stateless Decision Memory / DDIA evidence; Schema-Constrained Agent Memory; lifecycle phases. [VERIFIED]
- `.planning/milestones/v1.9/MILESTONE-READINESS.md` — Phase 46 readiness profile: better-sqlite3 missing soft-dep; sqlite3 binary present (lines 47-56, 106-107). [VERIFIED]
- `.planning/discussions/2026-04-26-mass-discuss.md` — row 46 lock "Rebuildable projection, never canonical" (line 241); decision rows for ingestion (lines 223-260). [VERIFIED]
- `super-gsd/tools/phase-capsule/write.cjs` — Phase 43 capsule writer; mirror template for SCHEMA_VERSION + walker pattern + Lock 13 try/catch + read-only invariant + atomic-write tmp+rename. [VERIFIED first 200 lines Read; subsequent structure inferred from Phase 44 mirror]
- `super-gsd/tools/context-registry/check.cjs` — Phase 44 validator; mirror template for `validateOne`, `loadRegistry`, `REASONS` enum, mtime-cached singleton, never-throws-upward. [VERIFIED Read]
- `super-gsd/tools/context-packet/build.cjs` — Phase 45 packet builder; line 702-703 = step-6 stub Phase 46 satisfies; line 118 = `index_snippet` in CONTEXT_SOURCE_MIX_KEYS; line 253 = `mix.index_snippet = packet_draft._index_snippets.length`. [VERIFIED Read]
- `super-gsd/tools/context-packet/PACKET.schema.json` — packet schema; `metadata.context_source_mix.index_snippet` field. [VERIFIED Read]
- `super-gsd/registry/gates.yaml` — 13 gate definitions; ingestion source for `kind='gate_definition'`. [VERIFIED: `grep -c '^  - name:'` = 13]
- `super-gsd/tools/context-registry/legal-keys.json` — generated registry; 44 active phases, 13 active gates. [VERIFIED: node JSON parse + key count]
- `.gitignore:3-5` — `*.db`, `*.db-wal`, `*.db-shm` already present. [VERIFIED: cat .gitignore]
- `node --version` → v22.22.2. [VERIFIED]
- `sqlite3 --version` → 3.50.4 with FTS5 compiled in. [VERIFIED: pragma_compile_options]

### Secondary (HIGH-MEDIUM confidence)
- [better-sqlite3 npm registry](https://www.npmjs.com/package/better-sqlite3) — latest version 12.9.0 published 2026-04-12. [VERIFIED: `npm view better-sqlite3 version` + `npm view better-sqlite3 time --json`]
- [SQLite FTS5 documentation](https://www.sqlite.org/fts5.html) — virtual table syntax, snippet() function, bm25 ranking, external-content recipe, contentless mode. [CITED]
- [SQLite FTS5 ENABLE_FTS5 default](https://www.sqlite.org/fts5.html) — FTS5 enabled in default SQLite builds since v3.9.0 (2015). [CITED]
- `.planning/milestones/v1.9/phases/45-context-packet-builder/45-RESEARCH.md` — section structure + self-test patterns mirrored. [VERIFIED Read]
- `.planning/milestones/v1.9/phases/44-legal-context-registry/44-RESEARCH.md` — validator design + 4-outcome reasons mirrored. [VERIFIED Read]
- `.planning/milestones/v1.9/phases/43-phase-capsule-contract/PHASE-CAPSULE.json` — capsule schema for ingestion shape. [VERIFIED Read; decisions[].id|source|text shape; source_hashes object shape]

### Tertiary (LOW confidence — none)
None. All claims verified against canonical sources or registry tools.

---

## Metadata

**Confidence breakdown:**
- INDEX-01..05 binding: HIGH — verbatim REQUIREMENTS.md + ROADMAP.md
- Schema design: HIGH — FTS5 is established 11-year-old SQLite feature; better-sqlite3 12.9.0 latest verified live
- Hash manifest (A3): HIGH — same pattern Phase 43 already ships in production (capsule rebuild equivalence is proven)
- Lock 13 / never-throws-upward: HIGH — mirrors Phase 41-45 pattern; 4 prior phases prove the pattern stable
- File summaries scope: HIGH — enumerated 20-file set; deterministic; F1 row-count assertion will pin
- Cross-phase contracts (45/49/51/52): HIGH — Phase 45 step-6 contract is concrete code (build.cjs:702-703); Phase 49/51/52 contracts derived from REQUIREMENTS.md lane bindings
- Self-test: HIGH — 8 fixtures bind A1-A4 directly; tmpdir + fingerprint guard mirrors Phase 41-45
- better-sqlite3 graceful degradation: HIGH — Lock 13 + Phase 44 mtime-cached pattern is proven

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; SQLite + FTS5 are stable; better-sqlite3 may publish minor versions but schema is stable)
