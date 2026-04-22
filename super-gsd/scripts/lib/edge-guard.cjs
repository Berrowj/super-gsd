'use strict';

/**
 * Edge-Guard step-transition audit wrapper.
 *
 * Exports: { recordTransition }
 *
 * recordTransition({fromStep, toStep, phase, plan, gateName,
 *                   expectedEmits, actualEmits, ctx,
 *                   gatesYamlPath, projectDir})
 *   → { status: 'ok' | 'logged' | 'halt', missing_emits: string[], row? }
 *
 * Design constraints (10-CONTEXT.md):
 *   D-11  — default log-only; append JSONL to .planning/metrics/edge-guard-log.jsonl
 *   D-11a — per-gate opt-in: gate.escalation === 'halt' triggers halt status
 *   D-11b — NO git mutations (no rollback, no reset, no checkout)
 *   D-11c — fromStep === 11 (token-log step) is exempt; early-return ok
 *
 * CLI:
 *   node edge-guard.cjs --self-test
 *   Writes two rows to a temp dir, asserts all 11 keys on each row,
 *   verifies resolution values, cleans up, exits 0 on PASS.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

// Loaded lazily to avoid hard-fail when running --self-test with a fixture yaml
let _getGate = null;
function getGate(name, gatesYamlPath) {
  if (!_getGate) {
    _getGate = require('./gates-registry.cjs').getGate;
  }
  return _getGate(name, gatesYamlPath);
}

const RELATIVE_LOG = '.planning/metrics/edge-guard-log.jsonl';

/**
 * Record a step transition and detect missing emits.
 *
 * @param {Object} params
 * @param {number|string} params.fromStep       - originating step number
 * @param {number|string} params.toStep         - destination step number
 * @param {number|string} params.phase          - current phase
 * @param {string}        params.plan           - current plan identifier
 * @param {string}        [params.gateName]     - gates.yaml row name for escalation lookup
 * @param {string[]}      params.expectedEmits  - paths declared in gate.evidence_emitted
 * @param {string[]}      params.actualEmits    - paths observed as written during step
 * @param {Object}        [params.ctx]          - dispatch context snapshot
 * @param {string}        [params.gatesYamlPath]- path to gates.yaml (required if gateName set)
 * @param {string}        params.projectDir     - project root for resolving JSONL path
 * @returns {{ status: 'ok'|'logged'|'halt', missing_emits: string[], row?: Object }}
 */
function recordTransition({
  fromStep,
  toStep,
  phase,
  plan,
  gateName,
  expectedEmits,
  actualEmits,
  ctx,
  gatesYamlPath,
  projectDir,
}) {
  // D-11c: token-log step (11) is exempt from emit-check
  if (fromStep === 11) {
    return { status: 'ok', missing_emits: [] };
  }

  const missing = (expectedEmits || []).filter(e => !(actualEmits || []).includes(e));

  // Resolve escalation: default log-only; per-gate opt-in to halt (D-11a)
  let escalation = 'log-only';
  if (gateName && gatesYamlPath) {
    try {
      const gate = getGate(gateName, gatesYamlPath);
      if (gate && gate.escalation === 'halt') {
        escalation = 'halt';
      }
    } catch (_) {
      // gate not found or registry error — fall back to log-only (defensive)
    }
  }

  const resolution =
    missing.length === 0  ? 'pass'     :
    escalation === 'halt' ? 'halt'     :
    /* default */           'log-only' ;

  const row = {
    ts:             new Date().toISOString(),
    phase:          phase,
    plan:           plan,
    from_step:      fromStep,
    to_step:        toStep,
    gate:           gateName || null,
    expected_emits: expectedEmits || [],
    actual_emits:   actualEmits   || [],
    missing_emits:  missing,
    context:        ctx || {},
    resolution:     resolution,
  };

  // Append JSONL row (D-11: always write the row)
  const logPath = path.resolve(projectDir, RELATIVE_LOG);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(row) + '\n');

  if (missing.length === 0) return { status: 'ok',     missing_emits: [],    row };
  if (escalation === 'halt') return { status: 'halt',   missing_emits: missing, row };
  return                            { status: 'logged', missing_emits: missing, row };
}

module.exports = { recordTransition };

// ---------------------------------------------------------------------------
// --self-test CLI (GATE-04 verification surface)
// Writes to a temp projectDir so the real .planning/metrics/ is untouched.
// Asserts all 11 JSONL row keys on both pass and missing-emit rows.
// Exits 0 on PASS; exits 1 on FAIL with a message naming the first failing key.
// ---------------------------------------------------------------------------

if (require.main === module && process.argv.includes('--self-test')) {
  runSelfTest();
}

function runSelfTest() {
  // Required 11 keys as declared in the plan contract
  const REQUIRED_KEYS = [
    'ts', 'phase', 'plan', 'from_step', 'to_step', 'gate',
    'expected_emits', 'actual_emits', 'missing_emits', 'context', 'resolution',
  ];

  // Use a dedicated temp dir so no row touches the real .planning/metrics/
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-edge-guard-'));

  // Build a minimal fixture gates.yaml with one gate that has escalation: log-only
  const fixtureGatesYaml = path.join(tmpDir, 'fixture-gates.yaml');
  fs.writeFileSync(fixtureGatesYaml, [
    'gates:',
    '  - name: self-test',
    '    enforcement_mode: soft-warn',
    '    escalation: log-only',
    '    evidence_emitted: []',
    '',
  ].join('\n'));

  // Reset the gates-registry cache so our fixture is loaded fresh
  try {
    require('./gates-registry.cjs').resetCache();
  } catch (_) { /* ok if not available in test context */ }

  let passed = true;
  let failReason = '';

  function fail(reason) {
    passed = false;
    failReason = reason;
  }

  try {
    // --- Call 1: pass row (no missing emits) ---
    const r1 = recordTransition({
      fromStep:      1,
      toStep:        2,
      phase:         0,
      plan:          'self-test',
      gateName:      'self-test',
      expectedEmits: ['some-file.txt'],
      actualEmits:   ['some-file.txt'],
      ctx:           { test: true },
      gatesYamlPath: fixtureGatesYaml,
      projectDir:    tmpDir,
    });

    if (r1.status !== 'ok') {
      fail(`Call-1 expected status 'ok', got '${r1.status}'`);
    }

    // --- Call 2: missing-emit row with log-only escalation ---
    const r2 = recordTransition({
      fromStep:      2,
      toStep:        3,
      phase:         0,
      plan:          'self-test',
      gateName:      'self-test',
      expectedEmits: ['missing-file.txt'],
      actualEmits:   [],
      ctx:           { test: true },
      gatesYamlPath: fixtureGatesYaml,
      projectDir:    tmpDir,
    });

    if (r2.status !== 'logged') {
      fail(`Call-2 expected status 'logged', got '${r2.status}'`);
    }

    // --- Read back the JSONL file and assert both rows ---
    const logPath = path.join(tmpDir, RELATIVE_LOG);
    if (!fs.existsSync(logPath)) {
      fail('JSONL log file was not created');
    } else {
      const lines = fs.readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(l => l.trim().length > 0);

      if (lines.length !== 2) {
        fail(`Expected 2 JSONL rows, got ${lines.length}`);
      } else {
        // Assert row 1: pass
        const row1 = JSON.parse(lines[0]);
        for (const key of REQUIRED_KEYS) {
          if (!(key in row1)) {
            fail(`Row-1 missing required key: '${key}'`);
            break;
          }
        }
        if (passed && row1.resolution !== 'pass') {
          fail(`Row-1 expected resolution='pass', got '${row1.resolution}'`);
        }

        // Assert row 2: log-only + non-empty missing_emits
        if (passed) {
          const row2 = JSON.parse(lines[1]);
          for (const key of REQUIRED_KEYS) {
            if (!(key in row2)) {
              fail(`Row-2 missing required key: '${key}'`);
              break;
            }
          }
          if (passed && row2.resolution !== 'log-only') {
            fail(`Row-2 expected resolution='log-only', got '${row2.resolution}'`);
          }
          if (passed && (!Array.isArray(row2.missing_emits) || row2.missing_emits.length === 0)) {
            fail(`Row-2 missing_emits should be a non-empty array`);
          }
        }
      }
    }
  } catch (err) {
    fail(`Unexpected error: ${err.message}`);
  } finally {
    // Cleanup: delete entire temp dir (no rows leak to real .planning/metrics/)
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) { /* best-effort */ }
    // Reset registry cache so production use is unaffected
    try {
      require('./gates-registry.cjs').resetCache();
    } catch (_) { /* ok */ }
  }

  if (passed) {
    console.log('edge-guard --self-test: PASS (2 rows written, all 11 keys asserted, cleanup done)');
    process.exit(0);
  } else {
    console.error(`edge-guard --self-test: FAIL — ${failReason}`);
    process.exit(1);
  }
}
