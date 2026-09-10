'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const LIB = path.resolve(__dirname, '..', '..', 'scripts', 'lib');
const OBSERVATION = path.join(LIB, 'atlas-observation.cjs');
const RUN = 'sgsd-11111111-1111-4111-8111-111111111111';
const RUN_2 = 'sgsd-22222222-2222-4222-8222-222222222222';
const INVOCATION = '33333333-3333-4333-8333-333333333333';
const UUID_V7 = '01a08882-20f6-7b23-96d0-c995aaa419f9';
const RUN_V7 = `sgsd-${UUID_V7}`;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BASH = process.platform === 'win32' ? 'C:\\Windows\\system32\\bash.exe' : '/bin/bash';

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-producer-'));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'STATE.md'), '---\nmilestone: vTest\nphase: 170\n---\n');
  return root;
}

function rows(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function assertObservation(row, run = RUN, invocation = INVOCATION) {
  assert.deepEqual(Object.keys(row.atlas_observation).sort(),
    ['gate_invocation_id', 'observation_id', 'schema_version', 'sgsd_run_id']);
  assert.equal(row.atlas_observation.schema_version, 1);
  assert.match(row.atlas_observation.observation_id, UUID);
  assert.equal(row.atlas_observation.sgsd_run_id, run);
  assert.equal(row.atlas_observation.gate_invocation_id, invocation);
}

test('observation helper validates causal IDs and never promotes envelope run_id', () => {
  const helper = require(OBSERVATION);
  const original = process.env.SGSD_RUN_ID;
  process.env.SGSD_RUN_ID = RUN;
  try {
    const fromCaller = helper.withObservation(
      { run_id: '2026-09-09T22:00:00.000Z-abcd' },
      { sgsd_run_id: RUN_2, gate_invocation_id: INVOCATION },
    );
    assertObservation(fromCaller, RUN_2, INVOCATION);
    assert.equal(fromCaller.run_id, '2026-09-09T22:00:00.000Z-abcd');

    const fromEnv = helper.withObservation({}, {
      sgsd_run_id: 'not-a-run', gate_invocation_id: 'not-an-invocation',
    });
    assertObservation(fromEnv, RUN, null);

    delete process.env.SGSD_RUN_ID;
    const uncorrelated = helper.withObservation({ run_id: RUN }, {});
    assertObservation(uncorrelated, null, null);
  } finally {
    if (original === undefined) delete process.env.SGSD_RUN_ID;
    else process.env.SGSD_RUN_ID = original;
  }
});

test('observation and worker helpers retain RFC-variant UUIDv7 causal identifiers', () => {
  const helper = require(OBSERVATION);
  const root = project();
  try {
    const observed = helper.withObservation({}, {
      sgsd_run_id: RUN_V7,
      gate_invocation_id: UUID_V7,
    }, {});
    assertObservation(observed, RUN_V7, UUID_V7);

    assert.equal(helper.appendWorkerEvent(root, {
      worker_id: UUID_V7,
      thread_id: UUID_V7,
      turn_id: UUID_V7,
      atlas_run_id: RUN_V7,
      status: 'running',
    }, 'save', null, null), true);
    const [event] = rows(path.join(root, '.planning', 'metrics', 'worker-events.jsonl'));
    assert.equal(event.worker_id, UUID_V7);
    assert.equal(event.thread_id, UUID_V7);
    assert.equal(event.turn_id, UUID_V7);
    assertObservation(event, RUN_V7, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('all JavaScript producers add identity only to successfully appended rows', () => {
  const root = project();
  const planning = path.join(root, '.planning');
  const context = { sgsd_run_id: RUN, gate_invocation_id: INVOCATION };
  try {
    const gateValue = require(path.join(LIB, 'gate-value-log.cjs'));
    const review = require(path.join(LIB, 'review-ledger.cjs'));
    const gateEvidence = require(path.join(LIB, 'gate-evidence-log.cjs'));
    const route = require(path.join(LIB, 'route-ledger.cjs'));
    const edge = require(path.join(LIB, 'edge-guard.cjs'));
    const shadow = require(path.join(LIB, 'commit-gate-shadow-log.cjs'));
    const live = require(path.join(LIB, 'orchestrator-live-writer.cjs'));

    const outputs = [
      gateValue.logGateValue(planning, { gate: 'phase-level-ATC', outcome: 'pass', ...context }),
      review.appendReviewRow(planning, { verdict: 'pass', ...context }),
      gateEvidence.logGateEvidence(planning, { signal: 'atc', ...context }),
      route.appendRow(planning, { boundary: 'codex_route', status: 'ok', ...context }),
      edge.recordTransition({ fromStep: 1, toStep: 2, phase: '170', plan: '170-10',
        expectedEmits: [], actualEmits: [], projectDir: root, ...context }).row,
      shadow.appendShadowRow(root, { diff_sha256: 'a'.repeat(64), staged_paths: ['safe.txt'], ...context }),
    ];
    for (const output of outputs) assertObservation(output);
    assert.equal(live.appendEvent({ type: 'run_started', data: {}, projectDir: root, ...context }).ok, true);
    assertObservation(rows(path.join(planning, 'ORCHESTRATOR-LIVE.jsonl'))[0]);

    const before = fs.readFileSync(gateValue.ledgerPath(planning), 'utf8');
    assert.equal(gateValue.logGateValue(planning, { gate: '', outcome: 'pass', ...context }), false);
    assert.equal(fs.readFileSync(gateValue.ledgerPath(planning), 'utf8'), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('primary append failures and observational worker IO retain existing fail-open results', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-producer-failure-'));
  const planningFile = path.join(root, 'not-a-planning-directory');
  fs.writeFileSync(planningFile, 'occupied');
  const gateValue = require(path.join(LIB, 'gate-value-log.cjs'));
  assert.equal(gateValue.logGateValue(planningFile, { gate: 'phase-level-ATC', outcome: 'pass' }), false);

  const workerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-worker-observation-failure-'));
  fs.mkdirSync(path.join(workerRoot, '.planning'));
  fs.writeFileSync(path.join(workerRoot, '.planning', 'STATE.md'), '---\nmilestone: vTest\n---\n');
  fs.writeFileSync(path.join(workerRoot, '.planning', 'metrics'), 'occupied');
  const mailbox = require(path.resolve(__dirname, '..', 'codex-worker', 'mailbox.cjs'));
  try {
    const record = mailbox.create(workerRoot, { role: 'executor' });
    assert.match(record.worker_id, UUID);
    assert.equal(fs.existsSync(path.join(workerRoot, '.planning', 'worker-sessions', record.worker_id, 'state.json')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workerRoot, { recursive: true, force: true });
  }
});

test('review aggregation does not observe history and preserves genuine prior identity', () => {
  const root = project();
  const planning = path.join(root, '.planning');
  const review = require(path.join(LIB, 'review-ledger.cjs'));
  const original = process.env.SGSD_RUN_ID;
  process.env.SGSD_RUN_ID = RUN;
  try {
    const phaseDir = path.join(planning, 'milestones', 'vTest', 'phases', '170-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'commit-reviews.jsonl'), JSON.stringify({
      ts: '2026-09-09T20:00:00.000Z', plan: '170-01', verdict: 'pass', provider: 'fixture',
    }) + '\n');
    assert.equal(review.aggregateFromPhases(planning).ok, true);
    const historical = review.readReviewRows(planning);
    assert.equal(historical.length, 1);
    assert.equal(historical[0].atlas_observation, undefined);

    const live = review.appendReviewRow(planning, {
      ts: '2026-09-09T21:00:00.000Z', plan: '170-02', verdict: 'pass', provider: 'fixture',
      sgsd_run_id: RUN_2, gate_invocation_id: INVOCATION,
    });
    assertObservation(live, RUN_2, INVOCATION);
    const identity = live.atlas_observation;
    assert.equal(review.aggregateFromPhases(planning).ok, true);
    const retained = review.readReviewRows(planning).find(row => row.ts === live.ts);
    assert.deepEqual(retained.atlas_observation, identity);
  } finally {
    if (original === undefined) delete process.env.SGSD_RUN_ID;
    else process.env.SGSD_RUN_ID = original;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('MUDA evidence is numeric, content-free, denominator-aware, and explicit about synthetic/no-input coverage', () => {
  const { buildAtlasMuda } = require(OBSERVATION);
  const probe = {
    probes: {
      haiku_fails: { value: 3, verdict: 'WARN', threshold: 'warn>=3 fail>=8', evidence: 'narrative.md.lastfail = 3' },
      narrative_age_sec: { value: 12, verdict: 'PASS', threshold: 'warn>1800 fail>3600', evidence: 'narrative.md age 12s' },
      git_spawn_pct: { value: 25, verdict: 'WARN', threshold: 'warn>20% fail>40%', evidence: '25/100 Bash-git calls in last 100 activity entries' },
      extra_processing: { value: 2, verdict: 'PASS', threshold: 'warn>3 fail>8', evidence: '4 commit-review files, 12 rows, 9 with line counts, 2 tier/line mismatches' },
      inventory: { value: 1, verdict: 'PASS', threshold: 'warn>6 fail>15 calibrated_per_milestone', evidence: '/private/item' },
    },
  };
  const detail = buildAtlasMuda(probe, {
    mechanicalExit: 1, synthetic: false, inventoryNoInput: false,
    enabled: true, diffLines: 900, dryRun: false,
  });
  assert.equal(detail.schema_version, 1);
  assert.equal(detail.mechanical.coverage, 'measured');
  assert.equal(detail.mechanical.no_input, false);
  assert.equal(detail.mechanical.probes.git_spawn_pct.denominator, 100);
  assert.equal(detail.mechanical.probes.extra_processing.denominator, 9);
  assert.equal(detail.mechanical.probes.inventory.denominator, null);
  assert.deepEqual(
    [detail.mechanical.probes.inventory.warn_threshold, detail.mechanical.probes.inventory.fail_threshold],
    [6, 15],
  );
  assert.equal(detail.qualitative.closed_reason, 'mechanical_findings');
  assert.equal(detail.qualitative.attempted, false);
  const serialized = JSON.stringify(detail);
  assert.doesNotMatch(serialized, /secret|private|evidence|threshold":"|waste_class/i);

  const noInput = buildAtlasMuda({ probes: {
    haiku_fails: { value: 0, verdict: 'PASS', evidence: 'narrative.md.lastfail absent (good)' },
    narrative_age_sec: { value: -1, verdict: 'WARN', evidence: 'narrative.md absent' },
    git_spawn_pct: { value: 0, verdict: 'PASS', evidence: 'activity-log.jsonl absent' },
    extra_processing: { value: 0, verdict: 'PASS', evidence: 'no commit-reviews.jsonl found' },
    inventory: { value: 0, verdict: 'PASS', evidence: 'no planning dirs scanned' },
  } }, { mechanicalExit: 0, synthetic: false, enabled: false, diffLines: 0, dryRun: false });
  assert.equal(noInput.mechanical.coverage, 'no_input');
  assert.equal(noInput.mechanical.no_input, true);
  assert.equal(noInput.mechanical.probes.git_spawn_pct.verdict, 'PASS');

  const synthetic = buildAtlasMuda(probe, {
    mechanicalExit: 0, synthetic: true, enabled: true, diffLines: 500, dryRun: false,
  });
  assert.equal(synthetic.mechanical.executed, false);
  assert.equal(synthetic.mechanical.coverage, 'synthetic');
  assert.equal(synthetic.mechanical.no_input, true);
  for (const p of Object.values(synthetic.mechanical.probes)) assert.equal(p.no_input, true);
});

test('MUDA qualitative evidence distinguishes every closed path and parses counts only after a real completed attempt', () => {
  const { buildAtlasMuda } = require(OBSERVATION);
  const probe = { probes: {} };
  const build = state => buildAtlasMuda(probe, { mechanicalExit: 0, synthetic: false, enabled: true,
    diffLines: 200, dryRun: false, attempted: false, qualitativeExit: null, ...state }).qualitative;

  assert.equal(build({ enabled: false }).closed_reason, 'disabled');
  assert.equal(build({ mechanicalExit: 1 }).closed_reason, 'mechanical_findings');
  assert.equal(build({ diffLines: 199 }).closed_reason, 'insufficient_diff');
  assert.equal(build({ dryRun: true }).closed_reason, 'dry_run');
  const failed = build({ attempted: true, qualitativeExit: 9 });
  assert.equal(failed.closed_reason, 'attempt_failed');
  assert.equal(failed.exit_code, 9);
  assert.equal(failed.critical, null);
  assert.equal(failed.warnings, null);
  const absentReport = build({ attempted: true, qualitativeExit: 0 });
  assert.equal(absentReport.closed_reason, 'attempt_failed');
  assert.equal(absentReport.critical, null);
  const complete = build({ attempted: true, qualitativeExit: 0, reportParsed: true, critical: 0, warnings: 0 });
  assert.equal(complete.closed_reason, 'completed');
  assert.equal(complete.critical, 0);
  assert.equal(complete.warnings, 0);
});

test('MUDA audit appends structured evidence without calling a real provider and preserves dry-run no-write', {
  skip: !fs.existsSync(BASH),
}, () => {
  const root = project();
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-muda-fixture-'));
  const scripts = path.join(fixture, 'scripts');
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(path.join(scripts, 'lib'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(root, '.planning', 'phases', '01-test'), { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, '..', '..', 'scripts', 'sgsd-muda-audit.sh'), path.join(scripts, 'sgsd-muda-audit.sh'));
  fs.copyFileSync(OBSERVATION, path.join(scripts, 'lib', 'atlas-observation.cjs'));
  const executable = (file, body) => { fs.writeFileSync(file, body); fs.chmodSync(file, 0o755); };
  executable(path.join(scripts, 'sgsd-muda-probe.sh'), `#!/usr/bin/env bash
printf '%s\\n' '{"probes":{"haiku_fails":{"value":0,"verdict":"PASS","threshold":"warn>=3 fail>=8","evidence":"narrative.md.lastfail absent (good)"},"narrative_age_sec":{"value":1,"verdict":"PASS","threshold":"warn>1800 fail>3600","evidence":"narrative.md age 1s"},"git_spawn_pct":{"value":5,"verdict":"PASS","threshold":"warn>20% fail>40%","evidence":"5/100 Bash-git calls in last 100 activity entries"},"extra_processing":{"value":0,"verdict":"PASS","threshold":"warn>3 fail>8","evidence":"1 commit-review files, 1 rows, 1 with line counts, 0 tier/line mismatches"},"inventory":{"value":0,"verdict":"PASS","threshold":"warn>2 fail>5 calibrated_per_milestone","evidence":"0 stale scratch/draft/temp planning artifacts >3d"}}}'
exit "\${FAKE_PROBE_EXIT:-0}"
`);
  executable(path.join(scripts, 'codex-exec.sh'), `#!/usr/bin/env bash
report=''
while [[ $# -gt 0 ]]; do if [[ "$1" == '--report-out' ]]; then report="$2"; shift 2; else shift; fi; done
[[ "\${FAKE_QUAL_MODE:-complete}" == 'failed' ]] && exit 9
[[ "\${FAKE_QUAL_MODE:-complete}" == 'absent' ]] && exit 0
printf '%s\\n' 'FINDINGS: none' 'CRITICAL: 0' 'WARNINGS: 0' 'PASS_RATE: 100' 'ONE_LINER: fixture' > "$report"
`);
  executable(path.join(bin, 'git'), `#!/usr/bin/env bash
if [[ "$*" == *'diff --stat'* ]]; then printf '%s\\n' ' 1 file changed, 200 insertions(+)';
elif [[ "$*" == *'log --oneline'* ]]; then printf '%s\\n' 'fixture'; fi
`);
  if (process.platform === 'win32') executable(path.join(bin, 'node'), `#!/usr/bin/env bash
converted=()
for arg in "$@"; do
  if [[ "$arg" == /mnt/* ]]; then converted+=("$(wslpath -w "$arg")"); else converted+=("$arg"); fi
done
export WSLENV="\${WSLENV:+$WSLENV:}ATLAS_BASE_ROW:ATLAS_MECHANICAL_EXIT:ATLAS_SYNTHETIC:ATLAS_INVENTORY_NO_INPUT:ATLAS_QUAL_ENABLED:ATLAS_DIFF_LINES:ATLAS_DRY_RUN:ATLAS_QUAL_ATTEMPTED:ATLAS_QUAL_EXIT:ATLAS_REPORT_PARSED:ATLAS_QUAL_CRITICAL:ATLAS_QUAL_WARNINGS:SGSD_RUN_ID:SGSD_ATLAS_DEBUG"
exec '/mnt/c/Program Files/nodejs/node.exe' "\${converted[@]}"
`);
  const slash = value => process.platform === 'win32'
    ? value.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    : value;
  const audit = slash(path.join(scripts, 'sgsd-muda-audit.sh'));
  const projectArg = slash(root);
  const metrics = path.join(root, '.planning', 'metrics', 'muda-log.jsonl');
  const run = (extraEnv, extraArgs = []) => {
    const fixtureEnv = { SGSD_RUN_ID: RUN, CODEX_QUAL_ENABLED: 'true', COMMITS_IN_PHASE: '1',
      SGSD_ATLAS_DEBUG: 'true', ...extraEnv };
    const exports = Object.entries(fixtureEnv).map(([key, value]) => `${key}='${value}'`).join(' ');
    const command = `${exports} PATH='${slash(bin)}':"$PATH" bash '${audit}' 1 --project '${projectArg}' --no-curate ${extraArgs.join(' ')}`;
    return spawnSync(BASH, ['-lc', command], {
      encoding: 'utf8',
      env: process.env,
    });
  };
  try {
    const completed = run({});
    assert.equal(completed.status, 0, completed.stderr);
    let written = rows(metrics);
    assert.ok(written[0].atlas_observation, `${completed.stderr}\n${JSON.stringify(written[0])}`);
    assertObservation(written[0], RUN, null);
    assert.equal(written[0].atlas_muda.qualitative.closed_reason, 'completed');
    assert.equal(written[0].atlas_muda.qualitative.attempted, true);
    assert.equal(written[0].atlas_muda.qualitative.critical, 0);

    const disabled = run({ CODEX_QUAL_ENABLED: 'false' });
    assert.equal(disabled.status, 0, disabled.stderr);
    written = rows(metrics);
    assert.equal(written[1].atlas_muda.qualitative.closed_reason, 'disabled');

    const failed = run({ FAKE_QUAL_MODE: 'failed' });
    assert.equal(failed.status, 0, failed.stderr);
    written = rows(metrics);
    assert.equal(written[2].atlas_muda.qualitative.closed_reason, 'attempt_failed');
    assert.equal(written[2].atlas_muda.qualitative.exit_code, 9);
    assert.equal(written[2].atlas_muda.qualitative.critical, null);

    const beforeDryRun = fs.readFileSync(metrics, 'utf8');
    const dryRun = run({}, ['--dry-run']);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(fs.readFileSync(metrics, 'utf8'), beforeDryRun);

    const debug = run({}, ['--probe', 'codex']);
    assert.equal(debug.status, 0, debug.stderr);
    written = rows(metrics);
    assert.equal(written[3].atlas_muda.mechanical.synthetic, true);
    assert.equal(written[3].atlas_muda.mechanical.executed, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('worker publications emit bounded selected metadata once and prefer the worker run identity', () => {
  const root = project();
  const mailboxPath = path.resolve(__dirname, '..', 'codex-worker', 'mailbox.cjs');
  delete require.cache[mailboxPath];
  const mailbox = require(mailboxPath);
  const original = process.env.SGSD_RUN_ID;
  process.env.SGSD_RUN_ID = RUN;
  try {
    const threadCanary = 'thread-canary-must-not-escape';
    const turnCanary = 'turn-canary-must-not-escape';
    const roleCanary = 'role-canary-must-not-escape';
    const record = mailbox.create(root, {
      owner: 'must-not-escape', role: roleCanary, atlas_run_id: RUN_2,
      wrapper_attempt_id: INVOCATION, resumed_from: '44444444-4444-4444-8444-444444444444',
      arbitrary_metadata: 'must-not-escape',
    });
    record.status = 'running';
    record.turn_id = turnCanary;
    record.thread_id = threadCanary;
    record.pending = [{ id: INVOCATION, kind: 'user_input', question_ids: ['q'], text: 'must-not-escape' }];
    mailbox.save(record);
    mailbox.submit(root, record.worker_id, 'steer', { text: 'must-not-escape' });
    mailbox.result(record, { id: INVOCATION, action: 'reply' }, 'applied', 'must-not-escape');

    const events = rows(path.join(root, '.planning', 'metrics', 'worker-events.jsonl'));
    assert.equal(events.length, 4);
    assert.deepEqual(events.map(event => event.boundary), ['create', 'save', 'submit', 'result']);
    assert.deepEqual(events.map(event => event.action), [null, null, 'steer', 'reply']);
    assert.equal(events[3].result_status, 'applied');
    assert.equal(events[3].pending_count, 1);
    for (const event of events) {
      assertObservation(event, RUN_2, null);
      assert.equal(event.thread_id, event.boundary === 'create' ? null : crypto.createHash('sha256').update(threadCanary).digest('hex'));
      assert.equal(event.turn_id, event.boundary === 'create' ? null : crypto.createHash('sha256').update(turnCanary).digest('hex'));
      assert.equal(event.role, null);
      assert.deepEqual(Object.keys(event).sort(), [
        'action', 'atlas_observation', 'atlas_run_id', 'boundary', 'instance', 'pending_count', 'result_status',
        'resume_id', 'role', 'schema_version', 'status', 'thread_id', 'ts', 'turn_id', 'worker_id',
        'wrapper_attempt_id',
      ]);
      assert.doesNotMatch(JSON.stringify(event), /must-not-escape|canary|arbitrary_metadata|owner|project|question/i);
    }
  } finally {
    if (original === undefined) delete process.env.SGSD_RUN_ID;
    else process.env.SGSD_RUN_ID = original;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
