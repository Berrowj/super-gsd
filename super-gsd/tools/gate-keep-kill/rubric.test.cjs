// ============================================================================
// Phase 39 local-fallback test for rubric.cjs.
// Provider-independent. Six fixtures cover R1-R6 + edge-guard halt override.
// Each fixture is fs.mkdtempSync-isolated; canonical files NEVER touched.
// Source: 39-RESEARCH.md sec 11 (Live-or-Local Fallback) + 39-01-PLAN.md
// task 3.
//
// Uses the production rubric.cjs lib via require() — binding-equivalent to
// the SKILL.md Step 4.5 production caller (no mocks, no shims).
//
// 7 binding assertions: 6 fixtures + 1 fingerprint guard.
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { runRubric, renderTable, classifyGate, REASONS, VERDICTS } =
  require('./rubric.cjs');

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-test-'));
}

// Write a minimal gates.yaml with `gates:` + N rows of `  - name: <gate>`.
// Returns the absolute path.
function writeYaml(tmp, gateNames) {
  const dir = path.join(tmp, 'registry');
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['gates:'];
  for (const g of gateNames) lines.push(`  - name: ${g}`);
  const p = path.join(dir, 'gates.yaml');
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  return p;
}

// Append rows to tmp/.planning/metrics/gate-value-log.jsonl using the Phase 36
// lib (binding-equivalent to production wire-ins). Imports lazily for clarity.
function writeGateLog(tmp, rows) {
  const planningDir = path.join(tmp, '.planning');
  fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });
  const gateValueLogPath = path.resolve(
    __dirname, '..', '..', 'scripts', 'lib', 'gate-value-log.cjs');
  const { logGateValue } = require(gateValueLogPath);
  for (const r of rows) logGateValue(planningDir, r);
}

// Append rows to tmp/.planning/metrics/edge-guard-log.jsonl directly.
// (No Phase 36 helper for edge-guard-log per RESEARCH sec 1.1; minimal shape.)
function writeEdgeLog(tmp, rows) {
  const planningDir = path.join(tmp, '.planning');
  fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });
  const p = path.join(planningDir, 'metrics', 'edge-guard-log.jsonl');
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}

const failures = [];
function assertFx(name, cond, detail) {
  if (cond) return true;
  failures.push({ name, detail: detail || '' });
  return false;
}

// ----------------------------------------------------------------------------
// Six fixtures (R1-R6 + halt override) + renderer round-trip bonus
// ----------------------------------------------------------------------------

// Fixture 1: R1 + RUBRIC-03 — empty everything.
function fx1_emptyEverything() {
  const tmp = mkTmp();
  try {
    const allGates = ['per-dispatch-ATC', 'phase-level-ATC', 'classifier-haiku',
      'context-selector-haiku', 'sgsd-recall-queries', 'intent-injection',
      'MUDA-waste-audit', 'qualitative-waste-audit', 'sgsd-curate-learnings',
      'token-log', 'vtp-enrichment', 'verifier-row-arithmetic',
      'verifier-detail-vs-summary'];
    const yamlPath = writeYaml(tmp, allGates);
    const planningDir = path.join(tmp, '.planning');
    fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });
    const rows = runRubric(planningDir, { gatesYamlPath: yamlPath });
    const allDefer = rows.length === 13 &&
      rows.every((r) => r.verdict === 'defer' && r.reason === 'no_fires_yet'
        && r.value_score === null);
    assertFx('fx1: empty everything -> 13 defer + no_fires_yet (RUBRIC-02 + RUBRIC-03)',
      allDefer,
      `got rows=${rows.length}, sample=${JSON.stringify(rows[0])}`);
    return rows; // returned for renderer round-trip bonus
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Fixture 2: R2 — value_score indeterminate.
// Plan-checker note: invoke classifyGate directly with synthetic
// {fires:5, value_score:null} per PLAN lines 690-694; both no_fires_yet
// and value_score_indeterminate outcomes are acceptable defer cases.
// We use classifyGate directly here because Phase 36 summarize() drops
// zero-fires gates from output.
function fx2_valueScoreIndeterminate() {
  const r = classifyGate('g_indet', { fires: 5, value_score: null }, [], []);
  // Accept either R2 (value_score_indeterminate) or R1 (no_fires_yet) — both
  // are valid defer outcomes; verdict must be defer in both cases.
  const validDeferReasons = new Set([
    REASONS.no_fires_yet,
    REASONS.value_score_indeterminate,
  ]);
  assertFx('fx2: synthetic value_score=null -> defer + (indeterminate|no_fires_yet)',
    r && r.verdict === 'defer' && validDeferReasons.has(r.reason),
    `got verdict=${r && r.verdict}, reason=${r && r.reason}`);
}

// Fixture 3: R4 — keep candidate (high fires + high value_score).
function fx3_keepCandidate() {
  const tmp = mkTmp();
  try {
    const yamlPath = writeYaml(tmp, ['gate_K']);
    // 12 pass + 2 warn + 1 block -> fires=15, value_score = (12 + 1 - 1)/15 = 0.80
    const rows = [];
    for (let i = 0; i < 12; i++) rows.push({ gate: 'gate_K', outcome: 'pass', milestone: 'v1.test' });
    rows.push({ gate: 'gate_K', outcome: 'warn', milestone: 'v1.test' });
    rows.push({ gate: 'gate_K', outcome: 'warn', milestone: 'v1.test' });
    rows.push({ gate: 'gate_K', outcome: 'block', milestone: 'v1.test' });
    writeGateLog(tmp, rows);
    const out = runRubric(path.join(tmp, '.planning'),
      { gatesYamlPath: yamlPath, milestone: 'v1.test' });
    const k = out.find((r) => r.gate === 'gate_K');
    assertFx('fx3: R4 high-fires high-value -> keep + value_score_above_threshold',
      k && k.verdict === 'keep' &&
      k.reason === REASONS.value_score_above_threshold &&
      k.fires === 15 && Math.abs(k.value_score - 0.80) < 0.01,
      `got ${JSON.stringify(k)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Fixture 4: R5 — kill candidate (high fires + very low value_score).
function fx4_killCandidate() {
  const tmp = mkTmp();
  try {
    const yamlPath = writeYaml(tmp, ['gate_X']);
    // fires=12, pass=1, warn=0, block=11 -> value_score = max(0, (1 - 11)/12) = 0
    const rows = [];
    rows.push({ gate: 'gate_X', outcome: 'pass', milestone: 'v1.test' });
    for (let i = 0; i < 11; i++) rows.push({ gate: 'gate_X', outcome: 'block', milestone: 'v1.test' });
    writeGateLog(tmp, rows);
    const out = runRubric(path.join(tmp, '.planning'),
      { gatesYamlPath: yamlPath, milestone: 'v1.test' });
    const k = out.find((r) => r.gate === 'gate_X');
    assertFx('fx4: R5 high-fires very-low-value -> kill + value_score_below_threshold_with_evidence',
      k && k.verdict === 'kill' &&
      k.reason === REASONS.value_score_below_threshold_with_evidence &&
      k.fires === 12,
      `got ${JSON.stringify(k)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Fixture 5: R3 + R6 — defer cluster.
function fx5_deferCluster() {
  const tmp = mkTmp();
  try {
    const yamlPath = writeYaml(tmp, ['gate_A', 'gate_B']);
    // gate_A: fires=4, pass=3, warn=0, block=1 -> value_score = (3 - 1)/4 = 0.50
    //   fires < 5 keep bar AND fires < 10 kill bar AND value_score >= 0.2 -> R6 fallthrough
    // gate_B: fires=7, pass=1, warn=0, block=6 -> value_score = max(0, (1 - 6)/7) = 0
    //   fires < 10 kill bar AND value_score < 0.2 -> R3 insufficient_evidence_for_kill
    const rows = [];
    for (let i = 0; i < 3; i++) rows.push({ gate: 'gate_A', outcome: 'pass', milestone: 'v1.test' });
    rows.push({ gate: 'gate_A', outcome: 'block', milestone: 'v1.test' });
    rows.push({ gate: 'gate_B', outcome: 'pass', milestone: 'v1.test' });
    for (let i = 0; i < 6; i++) rows.push({ gate: 'gate_B', outcome: 'block', milestone: 'v1.test' });
    writeGateLog(tmp, rows);
    const out = runRubric(path.join(tmp, '.planning'),
      { gatesYamlPath: yamlPath, milestone: 'v1.test' });
    const a = out.find((r) => r.gate === 'gate_A');
    const b = out.find((r) => r.gate === 'gate_B');
    assertFx('fx5: gate_A R6 mid-value low-fires -> defer + mid_value_score_or_low_fires',
      a && a.verdict === 'defer' && a.reason === REASONS.mid_value_score_or_low_fires,
      `got A=${JSON.stringify(a)}`);
    assertFx('fx5: gate_B R3 mid-fires low-value -> defer + insufficient_evidence_for_kill',
      b && b.verdict === 'defer' && b.reason === REASONS.insufficient_evidence_for_kill,
      `got B=${JSON.stringify(b)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Fixture 6: PRE-RULE — edge-guard halt override beats R5 kill.
function fx6_haltOverride() {
  const tmp = mkTmp();
  try {
    const yamlPath = writeYaml(tmp, ['gate_H']);
    // fires=12, block=11 -> would be R5 kill; halt row forces keep.
    const rows = [];
    rows.push({ gate: 'gate_H', outcome: 'pass', milestone: 'v1.test' });
    for (let i = 0; i < 11; i++) rows.push({ gate: 'gate_H', outcome: 'block', milestone: 'v1.test' });
    writeGateLog(tmp, rows);
    writeEdgeLog(tmp, [
      { ts: '2026-04-27T00:00:00.000Z', gate: 'gate_H', resolution: 'halt' },
    ]);
    const out = runRubric(path.join(tmp, '.planning'),
      { gatesYamlPath: yamlPath, milestone: 'v1.test' });
    const h = out.find((r) => r.gate === 'gate_H');
    assertFx('fx6: halt override beats R5 kill -> keep + structural_emit_required',
      h && h.verdict === 'keep' && h.reason === REASONS.structural_emit_required,
      `got ${JSON.stringify(h)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Renderer round-trip bonus (RESEARCH sec 11 fixture 5):
// Re-render fixture 1's 13-row output; parse markdown line-by-line; assert
// row count and verdict column values recoverable. Confirms RESEARCH sec 3.3
// column order is honored.
function fxBonus_rendererRoundTrip(rows) {
  const md = renderTable(rows);
  const lines = md.split('\n').filter(Boolean);
  // header + separator + 13 rows = 15 non-empty lines
  const headerOk = lines[0] === '| gate | verdict | fires | value_score | pass_rate | reason | notes |';
  const dataLines = lines.slice(2);
  const dataCountOk = dataLines.length === 13;
  // verdict column should be *defer* (italic) for every row in fixture 1
  const allDeferRendered = dataLines.every((l) => /\|\s*\*defer\*\s*\|/.test(l));
  assertFx('bonus: renderer round-trip preserves RESEARCH 3.3 column order',
    headerOk && dataCountOk && allDeferRendered,
    `headerOk=${headerOk} dataCountOk=${dataCountOk} (${dataLines.length}) allDeferRendered=${allDeferRendered}`);
}

// ----------------------------------------------------------------------------
// Fingerprint guard (binding 7th assertion)
// ----------------------------------------------------------------------------

// Test file at <repo>/super-gsd/tools/gate-keep-kill/rubric.test.cjs;
// canonicals at <repo>/.planning/metrics/* + <repo>/super-gsd/registry/gates.yaml.
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const canonicals = [
  path.join(repoRoot, '.planning', 'metrics', 'gate-value-log.jsonl'),
  path.join(repoRoot, '.planning', 'metrics', 'review-ledger.jsonl'),
  path.join(repoRoot, '.planning', 'metrics', 'edge-guard-log.jsonl'),
  path.join(repoRoot, 'super-gsd', 'registry', 'gates.yaml'),
];

function snapshot() {
  return canonicals.map((p) => fs.existsSync(p)
    ? { exists: true, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }
    : { exists: false, mtime: 0, size: 0 });
}

const before = snapshot();

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

const fx1Rows = fx1_emptyEverything();
fx2_valueScoreIndeterminate();
fx3_keepCandidate();
fx4_killCandidate();
fx5_deferCluster();
fx6_haltOverride();
fxBonus_rendererRoundTrip(fx1Rows);

// Fingerprint guard: canonical 4 files untouched after all fixtures.
const after = snapshot();
let fingerprintOk = true;
let fingerprintDetail = '';
for (let i = 0; i < canonicals.length; i++) {
  if (before[i].exists !== after[i].exists ||
      before[i].mtime !== after[i].mtime ||
      before[i].size !== after[i].size) {
    fingerprintOk = false;
    fingerprintDetail = `canonical[${i}]=${canonicals[i]} changed`;
    break;
  }
}
assertFx('fingerprint: canonical 4 files untouched by test', fingerprintOk, fingerprintDetail);

const totalAssertions = 7 + 1; // 6 fixtures (fx5 has 2 asserts) + bonus + fingerprint = 9 actual asserts
const failed = failures.length;
const passed = 9 - failed; // total asserts in this file

if (failed === 0) {
  console.log('rubric local-fallback test: 6 pass, 0 fail (9 assertions: 6 fixtures + renderer + fingerprint)');
  process.exit(0);
} else {
  console.log(`rubric local-fallback test: ${passed} pass, ${failed} fail`);
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
