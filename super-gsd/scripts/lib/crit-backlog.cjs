// ============================================================================
// SGSD - CRIT-BACKLOG canonical writer/reader/renderer
// ============================================================================
// Source of truth: .planning/metrics/crit-backlog.jsonl  (machine-readable)
// Rendered view:   .planning/CRIT-BACKLOG.md             (human-readable)
//
// Append-only. Never mutate. Operator clears entries by appending new rows
// with kind: 'cleared' that reference the original id (resolved status comes
// from the most recent row per id).
//
// Schema per row (one JSON object per line):
//   {
//     id, kind, phase, plan, milestone, attempts_made, summary,
//     evidence_path, last_diff_sha, tagged_for_milestone, added_at,
//     resolved_at?, resolved_by?
//   }
//
// kind ∈ {per_dispatch_atc, phase_atc, verifier_fail, edge_guard_miss, cleared}
//
// release-readiness/score.cjs and tools/status-consistency/check.cjs both
// parse this JSONL deterministically. Do not put backlog content only in
// the .md file.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VALID_KINDS = ['per_dispatch_atc', 'phase_atc', 'verifier_fail', 'edge_guard_miss', 'cleared'];

function jsonlPath(planningDir) { return path.join(planningDir, 'metrics', 'crit-backlog.jsonl'); }
function mdPath(planningDir)    { return path.join(planningDir, 'CRIT-BACKLOG.md'); }

function generateId() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}

function appendRow(planningDir, row) {
  if (!planningDir) throw new Error('crit-backlog: planningDir required');
  if (!row.kind || !VALID_KINDS.includes(row.kind)) {
    throw new Error(`crit-backlog: kind must be one of ${VALID_KINDS.join(', ')}`);
  }
  if (!row.summary && row.kind !== 'cleared') {
    throw new Error('crit-backlog: summary required for non-clearance rows');
  }
  const enriched = {
    id: row.id || generateId(),
    kind: row.kind,
    phase: row.phase ?? null,
    plan: row.plan ?? null,
    milestone: row.milestone ?? null,
    attempts_made: row.attempts_made ?? null,
    summary: row.summary ?? null,
    evidence_path: row.evidence_path ?? null,
    last_diff_sha: row.last_diff_sha ?? null,
    tagged_for_milestone: row.tagged_for_milestone ?? 'unassigned',
    added_at: row.added_at || new Date().toISOString(),
    resolved_at: row.resolved_at ?? null,
    resolved_by: row.resolved_by ?? null,
  };
  const p = jsonlPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

function readRows(planningDir) {
  const p = jsonlPath(planningDir);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  if (!text.trim()) return [];
  return text.split(/\r?\n/).filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// "Unresolved" = the latest row for a given id is not kind=cleared.
function unresolvedRows(planningDir) {
  const all = readRows(planningDir);
  const latestById = new Map();
  for (const r of all) {
    if (r.id) latestById.set(r.id, r);
  }
  return [...latestById.values()].filter((r) => r.kind !== 'cleared');
}

function rowsForPhase(planningDir, phase) {
  return unresolvedRows(planningDir).filter((r) => String(r.phase) === String(phase));
}

function rowsForMilestone(planningDir, milestone) {
  return unresolvedRows(planningDir).filter((r) => r.milestone === milestone);
}

function hasEdgeGuardMiss(planningDir, { phase = null, milestone = null } = {}) {
  return unresolvedRows(planningDir).some((r) =>
    r.kind === 'edge_guard_miss' &&
    (phase === null || String(r.phase) === String(phase)) &&
    (milestone === null || r.milestone === milestone)
  );
}

function renderMd(planningDir) {
  const rows = unresolvedRows(planningDir);
  const all = readRows(planningDir);
  const lines = [];
  lines.push('# CRIT-BACKLOG');
  lines.push('');
  lines.push('> **Canonical source**: `.planning/metrics/crit-backlog.jsonl`. This file is rendered.');
  lines.push('> Re-render with `node super-gsd/scripts/lib/crit-backlog.cjs --render`.');
  lines.push('');
  lines.push(`Last rendered: ${new Date().toISOString()}`);
  lines.push(`Total rows ever written: ${all.length}`);
  lines.push(`Unresolved entries: ${rows.length}`);
  lines.push('');
  if (rows.length === 0) {
    lines.push('_No unresolved entries._');
    lines.push('');
    return lines.join('\n');
  }
  // Group unresolved by milestone
  const byMs = {};
  for (const r of rows) {
    const k = r.milestone || 'unassigned';
    if (!byMs[k]) byMs[k] = [];
    byMs[k].push(r);
  }
  for (const [ms, list] of Object.entries(byMs).sort()) {
    lines.push(`## ${ms}`);
    lines.push('');
    lines.push('| id | kind | phase | summary | evidence | attempts | tagged_for |');
    lines.push('|----|------|------:|---------|----------|---------:|-----------|');
    for (const r of list) {
      const ev = r.evidence_path || '';
      const sum = (r.summary || '').replace(/\|/g, '\\|');
      lines.push(`| \`${r.id}\` | ${r.kind} | ${r.phase ?? '-'} | ${sum} | ${ev ? '`'+ev+'`' : '-'} | ${r.attempts_made ?? '-'} | ${r.tagged_for_milestone} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function writeRender(planningDir) {
  fs.writeFileSync(mdPath(planningDir), renderMd(planningDir), 'utf8');
}

// ── self-test ────────────────────────────────────────────────────────────────

function selfTest() {
  const tmp = path.join(__dirname, '..', '..', '..', 'tmp-crit-backlog-test');
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });
  try {
    // Empty state
    if (readRows(tmp).length !== 0) throw new Error('empty read failed');
    if (unresolvedRows(tmp).length !== 0) throw new Error('empty unresolved failed');
    if (hasEdgeGuardMiss(tmp)) throw new Error('empty edge_guard check failed');

    // Append one CRIT
    const r1 = appendRow(tmp, {
      kind: 'per_dispatch_atc', phase: 28, plan: '28-01', milestone: 'v1.6',
      attempts_made: 3, summary: 'unfixable lint warning in mission-strip',
      evidence_path: '.planning/milestones/v1.6/phases/28-*/28-ATC-REVIEW.md',
    });
    if (rowsForPhase(tmp, 28).length !== 1) throw new Error('rowsForPhase failed');
    if (rowsForMilestone(tmp, 'v1.6').length !== 1) throw new Error('rowsForMilestone failed');
    if (hasEdgeGuardMiss(tmp, { milestone: 'v1.6' })) throw new Error('false-positive edge_guard');

    // Append edge_guard_miss
    const r2 = appendRow(tmp, {
      kind: 'edge_guard_miss', phase: 28, milestone: 'v1.6', attempts_made: 3,
      summary: 'phase-level-ATC missing emit', evidence_path: '.planning/metrics/edge-guard-log.jsonl',
    });
    if (!hasEdgeGuardMiss(tmp, { milestone: 'v1.6' })) throw new Error('edge_guard detection failed');

    // Resolve r1 with cleared row
    appendRow(tmp, { id: r1.id, kind: 'cleared', resolved_at: new Date().toISOString(), summary: 'fixed in commit abc' });
    if (rowsForPhase(tmp, 28).length !== 1) throw new Error('clearance handling failed (should be only edge_guard left)');

    // Render markdown
    const md = renderMd(tmp);
    if (!md.includes('Unresolved entries: 1')) throw new Error('markdown render counts failed');
    if (!md.includes('edge_guard_miss')) throw new Error('markdown does not surface remaining row');

    console.log('crit-backlog self-test: PASS');
    return 0;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const cmd = process.argv[2];
  const planningDir = path.join(process.cwd(), '.planning');
  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === '--render')    { writeRender(planningDir); console.log('Rendered', mdPath(planningDir)); process.exit(0); }
  if (cmd === '--list')      { console.log(JSON.stringify(unresolvedRows(planningDir), null, 2)); process.exit(0); }
  console.log('Usage: node crit-backlog.cjs [--self-test | --render | --list]');
  console.log('  Or require() and call appendRow / readRows / rowsForPhase / rowsForMilestone / hasEdgeGuardMiss');
  process.exit(0);
}

module.exports = {
  VALID_KINDS,
  appendRow,
  readRows,
  unresolvedRows,
  rowsForPhase,
  rowsForMilestone,
  hasEdgeGuardMiss,
  renderMd,
  writeRender,
  jsonlPath,
  mdPath,
};
