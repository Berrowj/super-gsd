#!/usr/bin/env node
// ============================================================================
// SGSD - Status Consistency Checker
// ============================================================================
// Asserts that VERIFICATION.md `status:` and milestone STATE.md / SUMMARY.md
// `milestone_status:` cannot lie about CRIT-BACKLOG content.
//
// Required by ROADMAP-AGENT.md standard acceptance.
//
// Phase-level rules:
//   F1: status=PASS                       -> backlog must have ZERO rows for this phase
//   F2: status=PASS-WITH-DEFERRED-N       -> N must equal count of non-edge_guard_miss rows
//                                            for this phase; edge_guard_miss must be ZERO
//   F3: any edge_guard_miss for this phase -> status MUST be CANDIDATE-WITH-DEBT
//   F4: status=CANDIDATE-WITH-DEBT        -> at least one edge_guard_miss must exist
//
// Milestone-level rules:
//   M1: milestone_status starts with SHIPPED (and not SHIPPED-WITH-DEBT) ->
//       backlog must have ZERO rows for this milestone
//   M2: milestone_status starts with SHIPPED-WITH-DEBT-N -> N must equal count
//       of non-edge_guard_miss rows for this milestone; edge_guard_miss=0
//   M3: any edge_guard_miss for this milestone -> milestone_status MUST be CANDIDATE
//
// Usage:
//   node check.cjs --phase 28 --milestone v1.6
//   node check.cjs --milestone v1.6                  (milestone-only)
//   node check.cjs --phase 28                        (phase-only; auto-detects milestone)
//
// Exit 0 = consistent. Exit 1 = inconsistent (prints which rule failed).
// ============================================================================

const fs = require('fs');
const path = require('path');
const backlog = require('../../scripts/lib/crit-backlog.cjs');

function planningDir() { return path.join(process.cwd(), '.planning'); }

function parseArgs(argv) {
  const out = { phase: null, milestone: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--phase')     { out.phase = argv[++i]; }
    else if (argv[i] === '--milestone') { out.milestone = argv[++i]; }
    else if (argv[i] === '--help')      { out.help = true; }
  }
  return out;
}

function findPhaseDir(milestone, phase) {
  const phasesDir = path.join(planningDir(), 'milestones', milestone, 'phases');
  if (!fs.existsSync(phasesDir)) return null;
  const m = fs.readdirSync(phasesDir).find((d) => d.startsWith(`${phase}-`));
  return m ? path.join(phasesDir, m) : null;
}

function readVerificationStatus(milestone, phase) {
  const dir = findPhaseDir(milestone, phase);
  if (!dir) return { error: `phase folder not found for ${milestone} phase ${phase}` };
  const candidates = fs.readdirSync(dir).filter((f) => /-VERIFICATION\.md$/.test(f));
  if (candidates.length === 0) return { error: `no VERIFICATION.md in ${dir}` };
  const text = fs.readFileSync(path.join(dir, candidates[0]), 'utf8');
  const m = text.match(/^---[\s\S]*?^status:\s*(.+?)\s*$[\s\S]*?^---/m);
  if (!m) return { error: `no status: in frontmatter of ${candidates[0]}` };
  return { status: m[1].trim(), file: candidates[0] };
}

function autoDetectMilestone(phase) {
  const milestonesDir = path.join(planningDir(), 'milestones');
  if (!fs.existsSync(milestonesDir)) return null;
  for (const ms of fs.readdirSync(milestonesDir)) {
    if (!ms.startsWith('v')) continue;
    const phasesDir = path.join(milestonesDir, ms, 'phases');
    if (!fs.existsSync(phasesDir)) continue;
    if (fs.readdirSync(phasesDir).some((d) => d.startsWith(`${phase}-`))) {
      return ms;
    }
  }
  return null;
}

function readMilestoneStatus(milestone) {
  // Look for SUMMARY.md frontmatter `status:` first; fall back to STATE.md milestone_status
  const sumPath = path.join(planningDir(), 'milestones', milestone, 'SUMMARY.md');
  if (fs.existsSync(sumPath)) {
    const text = fs.readFileSync(sumPath, 'utf8');
    const m = text.match(/^---[\s\S]*?^status:\s*(.+?)\s*$[\s\S]*?^---/m);
    if (m) return { status: m[1].trim(), source: 'SUMMARY.md' };
  }
  // Fall back to STATE.md (current active milestone snapshot)
  const statePath = path.join(planningDir(), 'STATE.md');
  if (fs.existsSync(statePath)) {
    const text = fs.readFileSync(statePath, 'utf8');
    const ms = text.match(/^milestone:\s*(.+?)\s*$/m);
    const stat = text.match(/^milestone_status:\s*(.+?)\s*$/m);
    if (ms && ms[1].trim() === milestone && stat) {
      // milestone_status frontmatter contains a long sentence; extract leading verdict
      const verdict = stat[1].trim().split(/\s+/).slice(0, 4).join(' ');
      return { status: verdict, source: 'STATE.md (heuristic)' };
    }
  }
  return { status: null, source: null, note: 'no SUMMARY.md and no STATE.md milestone match' };
}

function checkPhase(milestone, phase) {
  const failures = [];
  const v = readVerificationStatus(milestone, phase);
  if (v.error) {
    failures.push(`PHASE-LOOKUP: ${v.error}`);
    return failures;
  }
  const status = v.status;
  const phaseRows = backlog.rowsForPhase(planningDir(), phase);
  const edgeRows = phaseRows.filter((r) => r.kind === 'edge_guard_miss');
  const nonEdge = phaseRows.filter((r) => r.kind !== 'edge_guard_miss');

  // F1
  if (status === 'PASS' && phaseRows.length > 0) {
    failures.push(`F1: status=PASS but backlog has ${phaseRows.length} row(s) for phase ${phase}`);
  }
  // F2
  const m2 = status.match(/^PASS-WITH-DEFERRED-(\d+)$/);
  if (m2) {
    const claimed = parseInt(m2[1]);
    if (claimed !== nonEdge.length) {
      failures.push(`F2: status=PASS-WITH-DEFERRED-${claimed} but actual non-edge_guard backlog count=${nonEdge.length}`);
    }
    if (edgeRows.length > 0) {
      failures.push(`F2: status=PASS-WITH-DEFERRED-${claimed} but ${edgeRows.length} edge_guard_miss row(s) exist (must be CANDIDATE-WITH-DEBT)`);
    }
  }
  // F3
  if (edgeRows.length > 0 && status !== 'CANDIDATE-WITH-DEBT') {
    failures.push(`F3: ${edgeRows.length} edge_guard_miss row(s) for phase ${phase} but status=${status} (must be CANDIDATE-WITH-DEBT)`);
  }
  // F4
  if (status === 'CANDIDATE-WITH-DEBT' && edgeRows.length === 0) {
    failures.push(`F4: status=CANDIDATE-WITH-DEBT but no edge_guard_miss row(s) for phase ${phase}`);
  }
  return failures;
}

function checkMilestone(milestone) {
  const failures = [];
  const v = readMilestoneStatus(milestone);
  if (!v.status) {
    failures.push(`MILESTONE-LOOKUP: ${v.note || 'no status found'}`);
    return failures;
  }
  const status = v.status;
  const msRows = backlog.rowsForMilestone(planningDir(), milestone);
  const edgeRows = msRows.filter((r) => r.kind === 'edge_guard_miss');
  const nonEdge = msRows.filter((r) => r.kind !== 'edge_guard_miss');

  const isShippedClean = /^SHIPPED\b/.test(status) && !/SHIPPED-WITH-DEBT/.test(status);
  const isShippedDebt = /^SHIPPED-WITH-DEBT-(\d+)/.test(status);
  const isCandidate   = /^CANDIDATE\b/.test(status);

  // M1
  if (isShippedClean && msRows.length > 0) {
    failures.push(`M1: milestone_status=${status} but backlog has ${msRows.length} row(s) for ${milestone}`);
  }
  // M2
  if (isShippedDebt) {
    const claimed = parseInt(status.match(/SHIPPED-WITH-DEBT-(\d+)/)[1]);
    if (claimed !== nonEdge.length) {
      failures.push(`M2: milestone_status claims SHIPPED-WITH-DEBT-${claimed} but non-edge_guard backlog count=${nonEdge.length}`);
    }
    if (edgeRows.length > 0) {
      failures.push(`M2: SHIPPED-WITH-DEBT but ${edgeRows.length} edge_guard_miss row(s) (must be CANDIDATE)`);
    }
  }
  // M3
  if (edgeRows.length > 0 && !isCandidate) {
    failures.push(`M3: ${edgeRows.length} edge_guard_miss row(s) for ${milestone} but status=${status} (must be CANDIDATE)`);
  }
  return failures;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.phase && !args.milestone)) {
    console.log('Usage: node check.cjs --phase NN [--milestone vX.Y]');
    console.log('       node check.cjs --milestone vX.Y');
    process.exit(2);
  }
  let allFailures = [];
  let milestone = args.milestone;

  if (args.phase) {
    if (!milestone) milestone = autoDetectMilestone(args.phase);
    if (!milestone) {
      console.error(`status-consistency: cannot auto-detect milestone for phase ${args.phase}`);
      process.exit(1);
    }
    const phaseFailures = checkPhase(milestone, args.phase);
    if (phaseFailures.length === 0) {
      console.log(`status-consistency phase ${args.phase} (${milestone}): OK`);
    } else {
      console.error(`status-consistency phase ${args.phase} (${milestone}): FAIL`);
      for (const f of phaseFailures) console.error('  ' + f);
      allFailures = allFailures.concat(phaseFailures);
    }
  }
  if (milestone) {
    const msFailures = checkMilestone(milestone);
    if (msFailures.length === 0) {
      console.log(`status-consistency milestone ${milestone}: OK`);
    } else {
      console.error(`status-consistency milestone ${milestone}: FAIL`);
      for (const f of msFailures) console.error('  ' + f);
      allFailures = allFailures.concat(msFailures);
    }
  }
  process.exit(allFailures.length === 0 ? 0 : 1);
}

// ── self-test (writes to a tmp planning dir; restores cwd-relative paths) ────
function selfTest() {
  const tmpRoot = path.join(__dirname, '..', '..', '..', 'tmp-status-consistency-test');
  if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
  const tmpPlanning = path.join(tmpRoot, '.planning');
  const phaseDir = path.join(tmpPlanning, 'milestones', 'v9.9', 'phases', '99-test');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.mkdirSync(path.join(tmpPlanning, 'metrics'), { recursive: true });

  const writeStatus = (status) => {
    fs.writeFileSync(path.join(phaseDir, '99-VERIFICATION.md'),
      `---\nphase: 99\nstatus: ${status}\n---\nbody\n`, 'utf8');
  };
  const writeMs = (status) => {
    fs.writeFileSync(path.join(tmpPlanning, 'milestones', 'v9.9', 'SUMMARY.md'),
      `---\nmilestone: v9.9\nstatus: ${status}\n---\nbody\n`, 'utf8');
  };

  // Run check using temp planning dir
  const origCwd = process.cwd();
  try {
    process.chdir(tmpRoot);

    // Case A: PASS with empty backlog -> OK
    writeStatus('PASS');
    writeMs('SHIPPED');
    let f = checkPhase('v9.9', 99);
    if (f.length !== 0) throw new Error('A.phase failed: ' + JSON.stringify(f));
    f = checkMilestone('v9.9');
    if (f.length !== 0) throw new Error('A.ms failed: ' + JSON.stringify(f));

    // Case B: PASS but backlog has a row -> F1, M1
    backlog.appendRow(tmpPlanning, { kind: 'per_dispatch_atc', phase: 99, milestone: 'v9.9', summary: 'x', attempts_made: 3 });
    f = checkPhase('v9.9', 99);
    if (!f.some((x) => x.startsWith('F1'))) throw new Error('B.phase missing F1: ' + JSON.stringify(f));
    f = checkMilestone('v9.9');
    if (!f.some((x) => x.startsWith('M1'))) throw new Error('B.ms missing M1: ' + JSON.stringify(f));

    // Case C: PASS-WITH-DEFERRED-1 with 1 row -> OK
    writeStatus('PASS-WITH-DEFERRED-1');
    writeMs('SHIPPED-WITH-DEBT-1');
    f = checkPhase('v9.9', 99);
    if (f.length !== 0) throw new Error('C.phase failed: ' + JSON.stringify(f));
    f = checkMilestone('v9.9');
    if (f.length !== 0) throw new Error('C.ms failed: ' + JSON.stringify(f));

    // Case D: PASS-WITH-DEFERRED-1 but actual count is 2 -> F2
    backlog.appendRow(tmpPlanning, { kind: 'verifier_fail', phase: 99, milestone: 'v9.9', summary: 'y', attempts_made: 3 });
    f = checkPhase('v9.9', 99);
    if (!f.some((x) => x.startsWith('F2'))) throw new Error('D.phase missing F2: ' + JSON.stringify(f));

    // Case E: edge_guard_miss exists but status is PASS-WITH-DEFERRED-N -> F2/F3
    backlog.appendRow(tmpPlanning, { kind: 'edge_guard_miss', phase: 99, milestone: 'v9.9', summary: 'eg', attempts_made: 3 });
    f = checkPhase('v9.9', 99);
    if (!f.some((x) => x.startsWith('F3'))) throw new Error('E.phase missing F3: ' + JSON.stringify(f));

    // Case F: status updated to CANDIDATE-WITH-DEBT, milestone CANDIDATE -> OK
    writeStatus('CANDIDATE-WITH-DEBT');
    writeMs('CANDIDATE');
    f = checkPhase('v9.9', 99);
    if (f.length !== 0) throw new Error('F.phase failed: ' + JSON.stringify(f));
    f = checkMilestone('v9.9');
    if (f.length !== 0) throw new Error('F.ms failed: ' + JSON.stringify(f));

    console.log('status-consistency self-test: PASS');
    return 0;
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) process.exit(selfTest());
  main();
}

module.exports = { checkPhase, checkMilestone, autoDetectMilestone };
