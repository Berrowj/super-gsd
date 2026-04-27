#!/usr/bin/env node
// ============================================================================
// SGSD Backlog Schema Validator
// ============================================================================
// Architectural rule: missing-evidence backlog rows MUST separate
//   - missing_evidence       (what did NOT happen — evidence-gap fact)
//   - suspected_cause        (why it didn't happen — may be wrong)
//   - confidence             (low | medium | high)
//   - clearance_requires     (path to the artifact that, when produced,
//                             allows the row to be cleared)
//
// A fixed-cause does not clear the row unless missing_evidence is produced
// AND clearance_requires's referenced artifact exists.
//
// Backwards-compatibility: rows from before this schema (no missing_evidence)
// are valid as long as their `kind` is per the existing v1 set. They surface
// as `legacy_v0` rows in the validator output but do not fail.
//
// Usage:
//   node check.cjs --self-test
//   node check.cjs                      (validate live .planning/metrics/crit-backlog.jsonl)
//
// Exit:
//   0 = all rows valid (or only legacy_v0 + valid_v1 rows)
//   1 = at least one row violates v1 schema
//   2 = bad invocation
// ============================================================================

const fs = require('fs');
const path = require('path');

const VALID_KINDS = ['per_dispatch_atc', 'phase_atc', 'verifier_fail', 'edge_guard_miss', 'cleared'];
const VALID_CONFIDENCE = ['low', 'medium', 'high'];

function classifyRow(row) {
  // Required-always
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not_object' };
  if (!row.id) return { ok: false, reason: 'missing_id' };
  if (!VALID_KINDS.includes(row.kind)) return { ok: false, reason: `invalid_kind:${row.kind}` };

  // Cleared rows have a different shape — they reference an existing id.
  if (row.kind === 'cleared') {
    if (!row.id) return { ok: false, reason: 'cleared_missing_id' };
    return { ok: true, schema: 'cleared' };
  }

  // For non-cleared rows: missing_evidence is the v1 architectural marker.
  // If present, the full v1 contract applies. If absent, treat as legacy_v0.
  if ('missing_evidence' in row) {
    // v1 schema: must have all four governance fields.
    const missing = [];
    if (!row.missing_evidence) missing.push('missing_evidence');
    if (!row.suspected_cause) missing.push('suspected_cause');
    if (!VALID_CONFIDENCE.includes(row.confidence)) missing.push('confidence');
    if (!row.clearance_requires) missing.push('clearance_requires');
    if (missing.length > 0) return { ok: false, reason: `v1_missing_fields:${missing.join(',')}` };
    return { ok: true, schema: 'v1' };
  }

  // Legacy v0 — accepted but flagged.
  return { ok: true, schema: 'legacy_v0' };
}

function validateAll(jsonlPath) {
  if (!fs.existsSync(jsonlPath)) {
    return { ok: true, total: 0, by_schema: {}, failures: [] };
  }
  const lines = fs.readFileSync(jsonlPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const summary = { ok: true, total: lines.length, by_schema: {}, failures: [] };
  for (let i = 0; i < lines.length; i++) {
    let row;
    try { row = JSON.parse(lines[i]); }
    catch (e) {
      summary.ok = false;
      summary.failures.push({ line: i + 1, reason: 'json_parse_error', detail: e.message });
      continue;
    }
    const cls = classifyRow(row);
    if (!cls.ok) {
      summary.ok = false;
      summary.failures.push({ line: i + 1, id: row.id, reason: cls.reason });
    } else {
      summary.by_schema[cls.schema] = (summary.by_schema[cls.schema] || 0) + 1;
    }
  }
  return summary;
}

// ── self-test ────────────────────────────────────────────────────────────────

function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  function assert(name, cond, detail) {
    if (cond) pass++;
    else { fail++; failures.push({ name, detail }); }
  }

  // T1 — legacy v0 row (no missing_evidence) — accepted as legacy
  const t1 = classifyRow({ id: 'r1', kind: 'verifier_fail', summary: 'old row', phase: '26' });
  assert('T1 legacy v0 accepted', t1.ok && t1.schema === 'legacy_v0');

  // T2 — v1 row (all fields) — accepted as v1
  const t2 = classifyRow({
    id: 'r2', kind: 'verifier_fail', summary: 's',
    missing_evidence: 'codex_review_missing',
    suspected_cause: 'self_test_auth_false_negative',
    confidence: 'medium',
    clearance_requires: '.planning/.../commit-reviews.jsonl',
  });
  assert('T2 v1 row accepted', t2.ok && t2.schema === 'v1', JSON.stringify(t2));

  // T3 — partial v1 (has missing_evidence but no clearance_requires) — rejected
  const t3 = classifyRow({
    id: 'r3', kind: 'verifier_fail', summary: 's',
    missing_evidence: 'codex_review_missing', confidence: 'high',
  });
  assert('T3 partial v1 rejected', !t3.ok && /v1_missing_fields/.test(t3.reason), JSON.stringify(t3));

  // T4 — cleared row — accepted regardless of v1 fields
  const t4 = classifyRow({ id: 'r4', kind: 'cleared', resolved_at: '2026-04-27T00:00:00Z' });
  assert('T4 cleared accepted', t4.ok && t4.schema === 'cleared');

  // T5 — invalid kind — rejected
  const t5 = classifyRow({ id: 'r5', kind: 'mystery_kind' });
  assert('T5 invalid kind rejected', !t5.ok && /invalid_kind/.test(t5.reason));

  // T6 — bad confidence — rejected
  const t6 = classifyRow({
    id: 'r6', kind: 'verifier_fail',
    missing_evidence: 'x', suspected_cause: 'y', confidence: 'huge', clearance_requires: 'z',
  });
  assert('T6 bad confidence rejected', !t6.ok && /v1_missing_fields/.test(t6.reason), JSON.stringify(t6));

  // T7 — validateAll on a tmp jsonl with mixed schemas
  const os = require('os');
  const tmp = path.join(os.tmpdir(), 'backlog-schema-test-' + Date.now() + '.jsonl');
  fs.writeFileSync(tmp,
    JSON.stringify({ id: 'a', kind: 'verifier_fail', summary: 'legacy' }) + '\n' +
    JSON.stringify({ id: 'b', kind: 'verifier_fail', summary: 'v1', missing_evidence: 'me', suspected_cause: 'sc', confidence: 'low', clearance_requires: 'cr' }) + '\n' +
    JSON.stringify({ id: 'c', kind: 'cleared' }) + '\n');
  const r = validateAll(tmp);
  assert('T7 validateAll mixed: ok=true', r.ok === true, JSON.stringify(r));
  assert('T7 validateAll mixed: 3 rows', r.total === 3);
  assert('T7 validateAll mixed: 1 legacy_v0', r.by_schema.legacy_v0 === 1);
  assert('T7 validateAll mixed: 1 v1', r.by_schema.v1 === 1);
  assert('T7 validateAll mixed: 1 cleared', r.by_schema.cleared === 1);
  fs.rmSync(tmp, { force: true });

  console.log(`backlog-schema self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// ── main ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { selfTest: false, jsonl: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--self-test') out.selfTest = true;
    else if (argv[i] === '--jsonl') out.jsonl = argv[++i];
    else if (argv[i] === '--help') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node check.cjs [--self-test | [--jsonl PATH]]');
    process.exit(2);
  }
  if (args.selfTest) process.exit(selfTest());
  const jsonlPath = args.jsonl || path.join(process.cwd(), '.planning', 'metrics', 'crit-backlog.jsonl');
  const result = validateAll(jsonlPath);
  console.log(`backlog-schema: ${result.total} rows`);
  for (const [k, v] of Object.entries(result.by_schema)) console.log(`  ${k}: ${v}`);
  if (result.failures.length > 0) {
    console.error(`failures (${result.failures.length}):`);
    for (const f of result.failures) console.error(`  line ${f.line}${f.id ? ' id=' + f.id : ''} — ${f.reason}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { classifyRow, validateAll, selfTest, VALID_KINDS, VALID_CONFIDENCE };
