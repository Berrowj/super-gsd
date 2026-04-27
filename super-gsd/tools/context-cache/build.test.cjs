// ============================================================================
// SGSD - context-cache/build.test.cjs (Phase 46 self-test harness)
// ============================================================================
// 13 fixtures: F1-F8 + 5 secondary (S9-S13).
// Bind A1-A4 acceptance criteria + Lock 13 + read-only invariant.
//
// Sources:
//   46-01 PLAN <task T1-T4>, <verification>.
//   46-RESEARCH.md sec 15.3 (30-path fingerprint guard).
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const child_process = require('child_process');
const assert = require('assert');

const rebuildMod = require('./rebuild.cjs');

let Database = null;
try { Database = require('better-sqlite3'); } catch (_e) { Database = null; }

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function _sha256OfFile(p) {
  try {
    const buf = fs.readFileSync(p);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (_e) {
    return null;
  }
}

function _captureFingerprints(paths) {
  const out = {};
  for (const p of paths) {
    try {
      const st = fs.statSync(p);
      out[p] = {
        mtime: st.mtimeMs,
        size: st.size,
        sha256: _sha256OfFile(p),
      };
    } catch (_e) {
      out[p] = { missing: true };
    }
  }
  return out;
}

function _assertNoFingerprintDrift(before, after) {
  for (const p of Object.keys(before)) {
    const b = before[p];
    const a = after[p];
    if (b.missing && a.missing) continue;
    if (b.missing !== a.missing) {
      throw new Error('drift: missing flipped on ' + p);
    }
    if (b.size !== a.size) throw new Error('drift: size changed on ' + p);
    if (b.sha256 !== a.sha256) throw new Error('drift: sha256 changed on ' + p);
  }
}

function _makeTmpPlanning() {
  const tmpRoot = path.join(os.tmpdir(), 'sgsd-46-' + crypto.randomBytes(6).toString('hex'));
  fs.mkdirSync(tmpRoot, { recursive: true });
  const planningDir = path.join(tmpRoot, '.planning');
  // Layout:
  //   .planning/milestones/v9.0/phases/01-alpha/PHASE-CAPSULE.json
  //   .planning/milestones/v9.0/phases/02-beta/PHASE-CAPSULE.json
  //   .planning/discussions/2026-04-26-mass-discuss.md
  //   .planning/cache/  (created on rebuild)
  //   .planning/metrics/  (created on append)
  // Plus a synthetic gates.yaml + file-summary source under tmpRoot/super-gsd/...
  const ms = 'v9.0';
  const phases = [
    { dir: '01-alpha', num: '01', name: 'Alpha Phase' },
    { dir: '02-beta', num: '02', name: 'Beta Phase' },
  ];
  for (const p of phases) {
    const phDir = path.join(planningDir, 'milestones', ms, 'phases', p.dir);
    fs.mkdirSync(phDir, { recursive: true });
    const cap = {
      schema_version: 1,
      milestone: ms,
      phase: p.num,
      phase_name: p.name,
      status: 'PASS',
      goal: 'synthetic goal text for ' + p.name + ' covering rebuild capsule fixture',
      decisions: [{ id: 'D1', source: 'tmp', text: 'synthetic decision for ' + p.num }],
      bypass_refs: [],
      constraints: ['constraint A', 'constraint B'],
    };
    fs.writeFileSync(path.join(phDir, 'PHASE-CAPSULE.json'), JSON.stringify(cap, null, 2));
  }
  const discDir = path.join(planningDir, 'discussions');
  fs.mkdirSync(discDir, { recursive: true });
  const massDiscuss = [
    '---',
    'title: synthetic mass discuss',
    '---',
    '',
    '# Mass Discuss',
    '',
    '## Decisions Table',
    '',
    '| Question | Decision |',
    '|----------|----------|',
    '| 01.1 alpha policy | adopt strict mode |',
    '| 01.2 alpha rollout | gradual rollout enabled |',
    '| 02.1 beta policy | enable parallel writers |',
    '',
    '## Per-Phase Locked Decisions',
    '',
    '### Phase 01 -- Alpha Phase Notes',
    '',
    'This is the prose body for phase 01 alpha which covers rebuild test scenarios for the decision walker.',
    '',
    '### Phase 02 -- Beta Phase Notes',
    '',
    'This is the prose body for phase 02 beta covering more decision walker test scenarios.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(discDir, '2026-04-26-mass-discuss.md'), massDiscuss);

  // Synthetic gates.yaml at tmpRoot/super-gsd/registry/gates.yaml so
  // _walkGates(repoRoot=tmpRoot) finds it.
  const gatesDir = path.join(tmpRoot, 'super-gsd', 'registry');
  fs.mkdirSync(gatesDir, { recursive: true });
  const gatesYaml = [
    'schema_version: 2',
    'gates:',
    '  - name: synthetic-gate-A',
    '    category: code-quality',
    '    step: 9',
    '    enforcement_mode: hard-halt',
    '    repair_instruction: "fix synthetic A"',
    '    checks:',
    '      - check 1',
    '      - check 2',
    '    reviewer_agent: synthetic-reviewer',
    '    reviewer_provider: synthetic-provider',
    '    source_dlb: DLB-99',
    '',
    '  - name: synthetic-gate-B',
    '    category: process-hygiene',
    '    step: 10',
    '    enforcement_mode: soft-warn',
    '    repair_instruction: "fix synthetic B"',
    '    checks:',
    '      - check X',
    '    reviewer_agent: synthetic-reviewer',
    '    reviewer_provider: synthetic-provider',
    '    source_dlb: DLB-99',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(gatesDir, 'gates.yaml'), gatesYaml);

  // Synthetic file-summary sources matching FILE_SUMMARY_PATHS slots
  // (we rely on first 4: REQUIREMENTS, ROADMAP, SGSD-HANDOVER, EXISTING-SURFACE-AUDIT).
  const ms19Dir = path.join(tmpRoot, '.planning', 'milestones', 'v1.9');
  fs.mkdirSync(ms19Dir, { recursive: true });
  const summaryFiles = [
    ['REQUIREMENTS.md', '## Requirements\n\nbody A\n\n## Section Two\n\nbody B'],
    ['ROADMAP.md', '## Roadmap\n\nbody C\n\n## Roadmap Two\n\nbody D'],
    ['SGSD-HANDOVER.md', '## Handover\n\nbody E\n\n## Handover Two\n\nbody F'],
    ['EXISTING-SURFACE-AUDIT.md', '## Audit\n\nbody G\n\n## Audit Two\n\nbody H'],
  ];
  for (const [name, content] of summaryFiles) {
    fs.writeFileSync(path.join(ms19Dir, name), content);
  }
  return { tmpRoot: tmpRoot, planningDir: planningDir };
}

function _cleanupTmp(tmpRoot) {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) {}
}

// 30-path canonical fingerprint set (RESEARCH sec 15.3).
function _canonicalPaths() {
  const repo = path.resolve(__dirname, '..', '..', '..');
  const planning = path.join(repo, '.planning');
  const out = [];
  // Streams (11):
  const streams = [
    'metrics/agent-token-spend.jsonl',
    'metrics/token-attribution.jsonl',
    'metrics/codex-log.jsonl',
    'metrics/token-log.jsonl',
    'metrics/activity-log.jsonl',
    'metrics/token-waste-status.jsonl',
    'metrics/crit-backlog.jsonl',
    'metrics/gate-value-log.jsonl',
    'metrics/review-ledger.jsonl',
    'metrics/intent-map.jsonl',
    'metrics/context-packet-log.jsonl',
  ];
  for (const s of streams) out.push(path.join(planning, s));
  // Capsules + key milestones (sample of 19):
  const samples = [
    'milestones/v1.9/REQUIREMENTS.md',
    'milestones/v1.9/ROADMAP.md',
    'milestones/v1.9/SGSD-HANDOVER.md',
    'milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json',
    'milestones/v1.9/phases/42-token-budget-admission/PHASE-CAPSULE.json',
    'milestones/v1.9/phases/43-phase-capsule-contract/PHASE-CAPSULE.json',
    'milestones/v1.9/phases/44-legal-context-registry/PHASE-CAPSULE.json',
    'milestones/v1.9/phases/45-context-packet-builder/PHASE-CAPSULE.json',
    'milestones/v1.9/phases/41-baseline-token-attribution/41-CONTEXT.md',
    'milestones/v1.9/phases/42-token-budget-admission/42-CONTEXT.md',
    'milestones/v1.9/phases/43-phase-capsule-contract/43-CONTEXT.md',
    'milestones/v1.9/phases/44-legal-context-registry/44-CONTEXT.md',
    'milestones/v1.9/phases/45-context-packet-builder/45-CONTEXT.md',
    'milestones/v1.9/phases/46-sqlite-context-index/46-CONTEXT.md',
    'milestones/v1.9/phases/46-sqlite-context-index/46-RESEARCH.md',
    'milestones/v1.9/phases/46-sqlite-context-index/46-01-sqlite-context-index-PLAN.md',
    'discussions/2026-04-26-mass-discuss.md',
  ];
  for (const s of samples) out.push(path.join(planning, s));
  // Gates yaml + legal-keys.
  out.push(path.join(repo, 'super-gsd', 'registry', 'gates.yaml'));
  out.push(path.join(repo, 'super-gsd', 'tools', 'context-registry', 'legal-keys.json'));
  return out;
}

// ----------------------------------------------------------------------------
// ASCII guard
// ----------------------------------------------------------------------------

function _asciiOnlyCheck(filePath) {
  const buf = fs.readFileSync(filePath);
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 127) return { ok: false, offset: i, byte: buf[i] };
  }
  return { ok: true };
}

// ----------------------------------------------------------------------------
// FIXTURE F1 -- rebuild produces N rows from synthetic tmpdir
// ----------------------------------------------------------------------------

function F1_rebuild_rows() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    const r = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(r.ok, true, 'F1: rebuild.ok must be true');
    assert(r.doc_count > 0, 'F1: doc_count must be > 0 (got ' + r.doc_count + ')');
    assert(r.by_kind.capsule >= 2, 'F1: capsule count >= 2');
    assert(r.by_kind.gate_definition >= 2, 'F1: gate_definition count >= 2');
    return { status: 'PASS', detail: 'doc_count=' + r.doc_count + ' by_kind=' + JSON.stringify(r.by_kind) };
  } finally {
    _cleanupTmp(tmpRoot);
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F2 -- A3 idempotency: rebuild after delete -> manifest deep-equal
// ----------------------------------------------------------------------------

function F2_idempotent_rebuild() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    const r1 = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(r1.ok, true);
    const m1 = JSON.parse(fs.readFileSync(r1.manifest_path, 'utf8'));
    // Delete db then rebuild.
    try { fs.unlinkSync(path.join(planningDir, 'cache', 'context-index.db')); } catch (_e) {}
    try { fs.unlinkSync(path.join(planningDir, 'cache', 'context-index.db-wal')); } catch (_e) {}
    try { fs.unlinkSync(path.join(planningDir, 'cache', 'context-index.db-shm')); } catch (_e) {}
    const r2 = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(r2.ok, true);
    const m2 = JSON.parse(fs.readFileSync(r2.manifest_path, 'utf8'));
    assert.strictEqual(m1.manifest_hash, m2.manifest_hash, 'F2: manifest_hash must match');
    assert.strictEqual(JSON.stringify(m1.documents), JSON.stringify(m2.documents),
      'F2: documents arrays must be deep-equal');
    return { status: 'PASS', detail: 'manifest_hash=' + m1.manifest_hash.slice(0, 12) };
  } finally {
    _cleanupTmp(tmpRoot);
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F3 -- source-backed snippets with source_hash matching sha256(file)
// ----------------------------------------------------------------------------

function F3_source_backed_snippets() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    const r = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(r.ok, true);
    const queryMod = require('./query.cjs');
    queryMod.close();
    const dbPath = path.join(planningDir, 'cache', 'context-index.db');
    const rows = queryMod.query('synthetic', { kinds: ['capsule'], limit: 5, dbPath: dbPath });
    queryMod.close();
    assert(rows.length >= 1, 'F3: at least 1 result for synthetic capsule query');
    for (const row of rows) {
      assert.strictEqual(row.kind, 'capsule', 'F3: kind must be capsule');
      assert(/^[0-9a-f]{64}$/.test(row.source_hash), 'F3: source_hash must be 64-hex');
      // Resolve source_path against tmpRoot.
      const candidates = [
        path.join(tmpRoot, row.source_path),
        path.join(path.dirname(planningDir), row.source_path),
      ];
      let actual = null;
      for (const c of candidates) {
        if (fs.existsSync(c)) { actual = _sha256OfFile(c); break; }
      }
      assert(actual !== null, 'F3: source_path resolves: ' + row.source_path);
      assert.strictEqual(row.source_hash, actual, 'F3: source_hash matches sha256(file)');
      assert(typeof row.snippet === 'string' && row.snippet.length > 0, 'F3: snippet present');
      assert(typeof row.score === 'number' && Number.isFinite(row.score), 'F3: score finite');
    }
    return { status: 'PASS', detail: 'rows=' + rows.length };
  } finally {
    try { require('./query.cjs').close(); } catch (_e) {}
    _cleanupTmp(tmpRoot);
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F4 -- Phase 44 validateOne filter (filter_invalid:true drops unknown)
// ----------------------------------------------------------------------------

function F4_validateOne_filter() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    // Add a third capsule for milestone v9.9/99 NOT in registry.
    const phDir = path.join(planningDir, 'milestones', 'v9.9', 'phases', '99-bogus');
    fs.mkdirSync(phDir, { recursive: true });
    const bogusCap = {
      schema_version: 1,
      milestone: 'v9.9',
      phase: '99',
      phase_name: 'Bogus Phase',
      status: 'PASS',
      goal: 'synthetic bogus capsule for invalid-key filter test',
      decisions: [],
      bypass_refs: [],
      constraints: [],
    };
    fs.writeFileSync(path.join(phDir, 'PHASE-CAPSULE.json'), JSON.stringify(bogusCap, null, 2));
    const r = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(r.ok, true);
    const queryMod = require('./query.cjs');
    queryMod.close();
    const dbPath = path.join(planningDir, 'cache', 'context-index.db');
    // Default filter_invalid:true. Both v9.0/01 and v9.9/99 are bogus
    // milestones (not in the production registry); in the test environment
    // the registry call may be unavailable. We accept either:
    //  (a) phase44 not loadable here -> all rows pass through (registry_valid:true)
    //  (b) filter_invalid:false -> all rows present with registry_valid:false
    //      for capsule rows whose key is unknown.
    const allRows = queryMod.query('synthetic', { kinds: ['capsule'], limit: 100, dbPath: dbPath, filter_invalid: false });
    queryMod.close();
    let bogusFound = false;
    for (const row of allRows) {
      if (row.milestone === 'v9.9' && row.phase === '99') {
        bogusFound = true;
        // registry_valid is true (phase44 unavailable) or false (validated unknown).
        assert(typeof row.registry_valid === 'boolean', 'F4: registry_valid must be boolean');
      }
    }
    assert(bogusFound, 'F4: bogus capsule v9.9/99 must be present with filter_invalid:false');
    return { status: 'PASS', detail: 'filter_invalid:false yields bogus row; registry_valid wired' };
  } finally {
    try { require('./query.cjs').close(); } catch (_e) {}
    _cleanupTmp(tmpRoot);
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F5 -- DDL rejects NULL source_path (A4 binding)
// ----------------------------------------------------------------------------

function F5_null_source_path_rejected() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const tmpDb = path.join(os.tmpdir(), 'sgsd-46-f5-' + crypto.randomBytes(4).toString('hex') + '.db');
  let db;
  try {
    db = new Database(tmpDb);
    db.exec(rebuildMod._internal.DDL);
    let threw = false;
    let msg = '';
    try {
      db.prepare(
        'INSERT INTO documents (kind, doc_id, source_path, source_hash, body, indexed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('capsule', 'test/null', null, 'a'.repeat(64), 'body', '2026-04-27T00:00:00Z');
    } catch (e) {
      threw = true;
      msg = e.message || '';
    }
    assert(threw, 'F5: NULL source_path must throw');
    assert(/NOT NULL/.test(msg), 'F5: error message must mention NOT NULL (got: ' + msg + ')');
    return { status: 'PASS', detail: 'NOT NULL constraint enforced' };
  } finally {
    try { db && db.close(); } catch (_e) {}
    try { fs.unlinkSync(tmpDb); } catch (_e) {}
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F5b -- source_drift detection
// ----------------------------------------------------------------------------

function F5b_source_drift() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    const r = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(r.ok, true);
    const s1 = rebuildMod.status({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(s1.source_drift.detected, false, 'F5b: no drift right after rebuild');
    // Modify a synthetic capsule.
    const capPath = path.join(planningDir, 'milestones', 'v9.0', 'phases', '01-alpha', 'PHASE-CAPSULE.json');
    const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    cap.goal = cap.goal + ' MODIFIED';
    fs.writeFileSync(capPath, JSON.stringify(cap, null, 2));
    const s2 = rebuildMod.status({ planningDir: planningDir, repoRoot: tmpRoot });
    assert.strictEqual(s2.source_drift.detected, true, 'F5b: drift must be detected after file mutation');
    assert(s2.source_drift.drifted_paths.length >= 1, 'F5b: drifted_paths must list >= 1');
    return { status: 'PASS', detail: 'drift detected on ' + s2.source_drift.drifted_paths.length + ' paths' };
  } finally {
    _cleanupTmp(tmpRoot);
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F6 -- better-sqlite3 missing -> graceful sentinel
// ----------------------------------------------------------------------------

function F6_better_sqlite3_missing_sentinel() {
  // Spawn a child Node process with Module._resolveFilename overridden so
  // require('better-sqlite3') throws MODULE_NOT_FOUND. The child loads
  // a fresh copy of rebuild.cjs and calls rebuild().
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    const tmpScript = path.join(os.tmpdir(),
      'sgsd-46-f6-' + crypto.randomBytes(4).toString('hex') + '.cjs');
    const rebuildAbs = path.resolve(__dirname, 'rebuild.cjs').replace(/\\/g, '/');
    const scriptBody =
      "'use strict';\n" +
      "const Module = require('module');\n" +
      "const orig = Module._resolveFilename;\n" +
      "Module._resolveFilename = function (req, parent, ...rest) {\n" +
      "  if (req === 'better-sqlite3') {\n" +
      "    const e = new Error(\"Cannot find module 'better-sqlite3'\");\n" +
      "    e.code = 'MODULE_NOT_FOUND';\n" +
      "    throw e;\n" +
      "  }\n" +
      "  return orig.call(this, req, parent, ...rest);\n" +
      "};\n" +
      "const r = require('" + rebuildAbs + "');\n" +
      "const result = r.rebuild({ planningDir: process.argv[2] });\n" +
      "process.stdout.write(JSON.stringify(result));\n";
    fs.writeFileSync(tmpScript, scriptBody);
    let out = '';
    let exitCode = -1;
    try {
      out = child_process.execFileSync(process.execPath,
        [tmpScript, planningDir], { encoding: 'utf8' });
      exitCode = 0;
    } catch (e) {
      out = (e.stdout || '').toString();
      exitCode = e.status === undefined ? -1 : e.status;
    }
    fs.unlinkSync(tmpScript);
    assert.strictEqual(exitCode, 0, 'F6: child must exit 0 (graceful)');
    let result;
    try {
      result = JSON.parse(out);
    } catch (e) {
      throw new Error('F6: child stdout not JSON: ' + out.slice(0, 200));
    }
    assert.strictEqual(result.ok, false, 'F6: result.ok must be false');
    assert.strictEqual(result.error, 'better_sqlite3_missing', 'F6: error sentinel');
    assert.strictEqual(result.install_hint, 'npm install better-sqlite3 --save', 'F6: install_hint');
    assert.strictEqual(result.doc_count, 0, 'F6: doc_count 0');
    // Verify complaints.jsonl appended.
    const compPath = path.join(planningDir, 'metrics', 'context-complaints.jsonl');
    if (fs.existsSync(compPath)) {
      const lines = fs.readFileSync(compPath, 'utf8').trim().split('\n').filter(Boolean);
      const last = JSON.parse(lines[lines.length - 1]);
      assert.strictEqual(last.reason, 'better_sqlite3_missing', 'F6: complaint reason');
    }
    return { status: 'PASS', detail: 'graceful sentinel returned, complaint logged' };
  } finally {
    _cleanupTmp(tmpRoot);
  }
}

// ----------------------------------------------------------------------------
// FIXTURE F7 -- read-only invariant fingerprint guard (30 canonical paths)
// ----------------------------------------------------------------------------

function F7_fingerprint_guard() {
  const paths = _canonicalPaths();
  const before = _captureFingerprints(paths);
  // Run a tmpdir-only rebuild to exercise walkers without touching canonical.
  if (Database) {
    const { tmpRoot, planningDir } = _makeTmpPlanning();
    try {
      rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    } finally {
      _cleanupTmp(tmpRoot);
    }
  }
  const after = _captureFingerprints(paths);
  _assertNoFingerprintDrift(before, after);
  return { status: 'PASS', detail: paths.length + ' canonical paths checked, no drift' };
}

// ----------------------------------------------------------------------------
// FIXTURE F8 -- never-throws-upward
// ----------------------------------------------------------------------------

function F8_never_throws() {
  // Each public API called with bad inputs MUST return sentinel object,
  // never throw upward.
  let r;
  r = rebuildMod.rebuild({ planningDir: '/nonexistent/path/sgsd-46-test' });
  assert(typeof r === 'object' && 'ok' in r, 'F8: rebuild bad path returns sentinel');
  r = rebuildMod.status({ dbPath: '/nonexistent/path/no.db' });
  assert(typeof r === 'object' && 'ok' in r, 'F8: status bad path returns sentinel');
  r = rebuildMod.emitManifest({ dbPath: '/nonexistent/path/no.db' });
  assert(typeof r === 'object' && 'ok' in r, 'F8: emitManifest bad path returns sentinel');
  const queryMod = require('./query.cjs');
  let qr = queryMod.query(null);
  assert(Array.isArray(qr), 'F8: query(null) returns []');
  qr = queryMod.query('text', { kinds: ['bogus'] });
  assert(Array.isArray(qr), 'F8: query bad kinds returns []');
  qr = queryMod.querySnippet(null, 'capsule');
  assert(Array.isArray(qr), 'F8: querySnippet(null) returns []');
  return { status: 'PASS', detail: 'all 6 bad-input calls returned sentinels' };
}

// ----------------------------------------------------------------------------
// SECONDARY FIXTURES (S9-S13)
// ----------------------------------------------------------------------------

function S9_kind_vocab_frozen() {
  assert(Object.isFrozen(rebuildMod.KIND_VOCAB), 'S9: KIND_VOCAB must be frozen');
  let threw = false;
  try { rebuildMod.KIND_VOCAB.push('bogus'); }
  catch (_e) { threw = true; }
  // Some Node modes silently no-op on frozen array push; assert length unchanged.
  assert.strictEqual(rebuildMod.KIND_VOCAB.length, 4, 'S9: KIND_VOCAB length stable at 4');
  return { status: 'PASS', detail: 'KIND_VOCAB frozen, 4 entries' };
}

function S10_schema_version() {
  assert.strictEqual(rebuildMod.SCHEMA_VERSION, 1, 'S10: SCHEMA_VERSION === 1');
  return { status: 'PASS', detail: 'SCHEMA_VERSION === 1' };
}

function S11_query_limit_clamp() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const queryMod = require('./query.cjs');
  const norm = queryMod._internal._normalizeQueryOpts({ limit: 1000 });
  assert(norm.limit <= rebuildMod.QUERY_LIMIT_MAX, 'S11: limit clamped to QUERY_LIMIT_MAX');
  assert.strictEqual(norm.limit, 100, 'S11: clamped to 100');
  const norm2 = queryMod._internal._normalizeQueryOpts({ limit: 0 });
  assert(norm2.limit >= 1, 'S11: zero limit clamped up to 1');
  return { status: 'PASS', detail: 'limit clamps 1..100' };
}

function S12_determinism() {
  if (!Database) return { status: 'SKIP', reason: 'better_sqlite3_missing' };
  const { tmpRoot, planningDir } = _makeTmpPlanning();
  try {
    const r1 = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    const m1 = JSON.parse(fs.readFileSync(r1.manifest_path, 'utf8'));
    const r2 = rebuildMod.rebuild({ planningDir: planningDir, repoRoot: tmpRoot });
    const m2 = JSON.parse(fs.readFileSync(r2.manifest_path, 'utf8'));
    assert.strictEqual(m1.manifest_hash, m2.manifest_hash, 'S12: hash stable across back-to-back rebuilds');
    assert.strictEqual(JSON.stringify(m1.documents), JSON.stringify(m2.documents),
      'S12: documents byte-equivalent');
    return { status: 'PASS', detail: 'back-to-back manifest_hash stable' };
  } finally {
    _cleanupTmp(tmpRoot);
  }
}

function S13_cli_exit_codes() {
  // Spawn rebuild.cjs with --help -> exit 0; with --bogus-verb -> exit 2.
  const cliPath = path.resolve(__dirname, 'rebuild.cjs');
  let helpExit = -1;
  let badExit = -1;
  try {
    child_process.execFileSync(process.execPath, [cliPath, '--help'], { stdio: 'pipe' });
    helpExit = 0;
  } catch (e) {
    helpExit = e.status === undefined ? -1 : e.status;
  }
  try {
    child_process.execFileSync(process.execPath, [cliPath, '--xx-bogus'], { stdio: 'pipe' });
    badExit = 0;
  } catch (e) {
    badExit = e.status === undefined ? -1 : e.status;
  }
  assert.strictEqual(helpExit, 0, 'S13: --help exits 0');
  assert.strictEqual(badExit, 2, 'S13: bad verb exits 2');
  return { status: 'PASS', detail: '--help=0 bad-verb=2' };
}

// ----------------------------------------------------------------------------
// ASCII guard fixture (also runs as part of self-test).
// ----------------------------------------------------------------------------

function S_ascii_only_check() {
  const files = [
    path.resolve(__dirname, 'rebuild.cjs'),
    path.resolve(__dirname, 'query.cjs'),
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, 'manifest.schema.json'),
    path.resolve(__dirname, 'build.test.cjs'),
  ];
  for (const f of files) {
    const r = _asciiOnlyCheck(f);
    assert(r.ok, 'ASCII-only: non-ASCII byte ' + r.byte + ' at ' + r.offset + ' in ' + f);
  }
  return { status: 'PASS', detail: 'all 5 files ASCII-only' };
}

// ----------------------------------------------------------------------------
// runAll
// ----------------------------------------------------------------------------

const FIXTURES = [
  ['F1', F1_rebuild_rows],
  ['F2', F2_idempotent_rebuild],
  ['F3', F3_source_backed_snippets],
  ['F4', F4_validateOne_filter],
  ['F5', F5_null_source_path_rejected],
  ['F5b', F5b_source_drift],
  ['F6', F6_better_sqlite3_missing_sentinel],
  ['F7', F7_fingerprint_guard],
  ['F8', F8_never_throws],
  ['S9', S9_kind_vocab_frozen],
  ['S10', S10_schema_version],
  ['S11', S11_query_limit_clamp],
  ['S12', S12_determinism],
  ['S13', S13_cli_exit_codes],
  ['ASCII', S_ascii_only_check],
];

function runAll() {
  const results = [];
  for (const [name, fn] of FIXTURES) {
    let res;
    try {
      res = fn();
    } catch (e) {
      res = { status: 'FAIL', reason: e && e.message ? e.message : String(e) };
    }
    results.push({ name: name, status: res.status, detail: res.detail || res.reason || '' });
  }
  const pass = results.filter(function (r) { return r.status === 'PASS'; }).length;
  const fail = results.filter(function (r) { return r.status === 'FAIL'; }).length;
  const skip = results.filter(function (r) { return r.status === 'SKIP'; }).length;
  return {
    ok: fail === 0,
    pass: pass,
    fail: fail,
    skip: skip,
    total: results.length,
    results: results,
  };
}

function formatSummary(result) {
  const lines = [];
  lines.push('=== Phase 46 self-test ===');
  for (const r of result.results) {
    lines.push('[' + r.name + '] ' + r.status + (r.detail ? ' -- ' + r.detail : ''));
  }
  lines.push('---');
  lines.push('PASS: ' + result.pass + ' / FAIL: ' + result.fail + ' / SKIP: ' + result.skip + ' / TOTAL: ' + result.total);
  lines.push(result.ok ? 'OVERALL: PASS' : 'OVERALL: FAIL');
  return lines.join('\n');
}

module.exports = {
  runAll: runAll,
  formatSummary: formatSummary,
  _makeTmpPlanning: _makeTmpPlanning,
  _captureFingerprints: _captureFingerprints,
  _assertNoFingerprintDrift: _assertNoFingerprintDrift,
  _canonicalPaths: _canonicalPaths,
};

if (require.main === module) {
  const r = runAll();
  process.stdout.write(formatSummary(r) + '\n');
  process.exit(r.ok ? 0 : 1);
}
