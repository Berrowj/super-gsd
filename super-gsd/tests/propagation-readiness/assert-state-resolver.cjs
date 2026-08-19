#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const resolver = require(path.join(repoRoot, 'super-gsd', 'tools', 'state-resolver', 'resolve.cjs'));

const requestedCase = readArg('--case') || 'all';
const supportedCases = ['all', 'devcp-mixed-flat', 'evidence-tier-matrix', 'sediment'];
const failures = [];
let passed = 0;

if (!supportedCases.includes(requestedCase)) {
  console.error('Usage: assert-state-resolver.cjs --case all|devcp-mixed-flat|evidence-tier-matrix|sediment');
  process.exit(2);
}

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeState(planningDir, milestone, phase, inlineComment) {
  writeFile(path.join(planningDir, 'STATE.md'), [
    '---',
    `milestone: ${milestone}`,
    `current_phase: ${phase}${inlineComment ? '  # operator note' : ''}`,
    'current_phase_name: Legacy Projection',
    'current_phase_status: in-progress',
    '---',
    '',
  ].join('\n'));
}

function writeRoadmap(planningDir, milestone, phases) {
  const rows = phases.map((phase) =>
    `| ${phase.token} | ${phase.name || phase.slug || 'Fixture'} | ${phase.status || 'Planned'} |`);
  writeFile(path.join(planningDir, 'milestones', milestone, 'ROADMAP.md'), [
    `# Milestone ${milestone}`,
    '',
    '| Phase | Name | Status |',
    '|---:|---|---|',
    ...rows,
    '',
  ].join('\n'));
}

function contextFilename(token, form) {
  if (form === 'generic') return 'CONTEXT.md';
  if (form === 'padded') return `${String(token).padStart(2, '0')}-CONTEXT.md`;
  return `${token}-CONTEXT.md`;
}

function writePhase(planningDir, layout, milestone, phase, options = {}) {
  const root = layout === 'flat'
    ? path.join(planningDir, 'phases')
    : path.join(planningDir, 'milestones', milestone, 'phases');
  const phaseDir = path.join(root, `${phase.token}-${phase.slug || 'fixture'}`);
  fs.mkdirSync(phaseDir, { recursive: true });
  if (options.context !== false) {
    writeFile(path.join(phaseDir, contextFilename(phase.token, options.contextForm || 'id')),
      `# Context for ${phase.token}\n`);
  }
  if (options.verification) {
    writeFile(path.join(phaseDir, `${phase.token}-VERIFICATION.md`),
      `---\nstatus: ${options.verification}\n---\n`);
  }
  return phaseDir;
}

function withFixture(label, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-state-${label}-`));
  try {
    const planning = path.join(root, '.planning');
    fs.mkdirSync(path.join(planning, 'metrics'), { recursive: true });
    return callback({ root, planning });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function resolve(root) {
  return resolver.resolveEffectiveState({ projectDir: root });
}

function assertResolution(label, result, expected) {
  assert(`${label} returns ok`, result && result.ok === true,
    result ? JSON.stringify(result) : 'no result');
  for (const [key, value] of Object.entries(expected)) {
    assert(`${label} preserves ${key}`, result && result[key] === value,
      result ? `${key}=${JSON.stringify(result[key])}` : 'no result');
  }
}

function roadmapPhase(token, slug, status) {
  return { token, slug, name: slug.split('-').map((part) =>
    part.charAt(0).toUpperCase() + part.slice(1)).join(' '), status };
}

function runDevcpMixedFlat() {
  withFixture('devcp', ({ root, planning }) => {
    const integers = [];
    for (let value = 1; value <= 109; value += 1) {
      integers.push(roadmapPhase(String(value), `legacy-${value}`));
    }
    integers.push(roadmapPhase('999', 'highest-legacy-integer'));

    const decimals = [];
    for (let value = 1; value <= 5; value += 1) {
      decimals.push(roadmapPhase(`20.${value}`, `decimal-${value}`));
    }

    const vPhases = [];
    for (let value = 1; value <= 30; value += 1) {
      const suffix = String(value).padStart(2, '0');
      vPhases.push(roadmapPhase(`v30-${suffix}`, `v-phase-${suffix}`));
    }
    vPhases.push(roadmapPhase('v30-06.8', 'decimal-v-phase', 'Complete'));

    const active = vPhases.find((phase) => phase.token === 'v30-07');
    const ordered = [
      ...integers,
      ...decimals,
      ...vPhases.filter((phase) => phase !== active),
      active,
    ];
    writeRoadmap(planning, 'v3.0', ordered);
    const staleMilestonePhase = roadmapPhase('156', 'stale-v2-projection');
    writeRoadmap(planning, 'v2.0', [staleMilestonePhase]);
    writePhase(planning, 'milestone', 'v2.0', staleMilestonePhase, {
      contextForm: 'id',
    });
    writeState(planning, 'v3.0', 'v30-07', true);

    for (let index = 0; index < ordered.length; index += 1) {
      const phase = ordered[index];
      let contextForm = 'id';
      if (phase.token === '9') contextForm = 'padded';
      if (phase.token === 'v30-07') contextForm = 'generic';
      writePhase(planning, 'flat', 'v3.0', phase, {
        contextForm,
        verification: phase.token === 'v30-06.8' ? 'PASS' : null,
      });
    }

    const phaseDirs = fs.readdirSync(path.join(planning, 'phases'));
    const vNamed = phaseDirs.filter((name) => name.startsWith('v'));
    assert('devcp fixture has exactly 146 flat phase directories', phaseDirs.length === 146,
      `count=${phaseDirs.length}`);
    assert('devcp fixture has exactly 31 v-named directories', vNamed.length === 31,
      `count=${vNamed.length}`);

    const result = resolve(root);
    assertResolution('devcp mixed-flat resolution', result, {
      source: 'phase_folders',
      milestone: 'v3.0',
      phase: 'v30-07',
    });
    assert('devcp highest legacy integer never wins', result.phase !== '999',
      `phase=${result.phase}`);
    assert('devcp stale v2.0 milestone never wins', result.milestone !== 'v2.0',
      `milestone=${result.milestone}`);
    assert('devcp inline frontmatter comment is stripped',
      result._state_md && result._state_md.phase === 'v30-07',
      result._state_md ? `phase=${result._state_md.phase}` : 'no projection');
    assert('devcp produces no backwards re-sync recommendation',
      result.projection_stale === false && result.recommended_repair === null,
      `stale=${result.projection_stale} repair=${result.recommended_repair}`);
  });

  for (const roadmapCase of [
    {
      label: 'partial-table',
      content: (older) => [
        '# Partial ROADMAP',
        '',
        '| Phase | Name | Status |',
        '|---:|---|---|',
        `| ${older.token} | Listed older phase | Complete |`,
        '',
      ].join('\n'),
    },
    {
      label: 'heading-only',
      content: (older) => `# Heading-only ROADMAP\n\n## Phase ${older.token} - Listed older phase\n`,
    },
    { label: 'empty', content: () => '' },
  ]) {
    withFixture(`roadmap-${roadmapCase.label}`, ({ root, planning }) => {
      const older = roadmapPhase('v30-06.8', 'listed-older');
      const newest = roadmapPhase('v30-07', 'unlisted-newest');
      writeFile(path.join(planning, 'milestones', 'v3.0', 'ROADMAP.md'),
        roadmapCase.content(older));
      writePhase(planning, 'milestone', 'v3.0', older, {
        contextForm: 'id', verification: 'PASS',
      });
      writePhase(planning, 'milestone', 'v3.0', newest, { contextForm: 'id' });
      const hasOlderGitTier = roadmapCase.label !== 'partial-table';
      if (hasOlderGitTier) {
        if (!initializeGitFixture(root,
          `feat(p${older.token}): older tier evidence`, `${roadmapCase.label} git tier`)) return;
      } else {
        writeState(planning, 'v3.0', newest.token, false);
      }

      const result = resolve(root);
      assert(`${roadmapCase.label} ROADMAP never selects an older discovered phase`,
        result.ok && result.phase === newest.token,
        JSON.stringify(result));
      assert(`${roadmapCase.label} ROADMAP never recommends a backwards re-sync`,
        result.projection_stale === false && result.recommended_repair === null,
        JSON.stringify(result));
      if (hasOlderGitTier) {
        assert(`${roadmapCase.label} discovered phase outranks older git without backwards repair`,
          result.source === 'phase_folders'
            && result.phase === newest.token
            && result.projection_stale === false
            && result.recommended_repair === null,
          JSON.stringify(result));
      }
    });
  }

  for (const contextCase of [
    { label: 'CONTEXT.md', form: 'generic' },
    { label: '{id}-CONTEXT.md', form: 'id' },
    { label: 'NN-CONTEXT.md', form: 'padded' },
  ]) {
    withFixture(`context-${contextCase.form}`, ({ root, planning }) => {
      const phases = [roadmapPhase('8', 'closed'), roadmapPhase('9', 'scoped-next')];
      writeRoadmap(planning, 'v3.0', phases);
      writePhase(planning, 'milestone', 'v3.0', phases[0], {
        contextForm: 'id', verification: 'PASS',
      });
      writePhase(planning, 'milestone', 'v3.0', phases[1], {
        contextForm: contextCase.form,
      });
      writeState(planning, 'v3.0', '9', false);
      const result = resolve(root);
      assert(`context probe accepts ${contextCase.label}`,
        result.ok && result.phase === '9' && result.source === 'phase_folders',
        JSON.stringify(result));
    });
  }

  withFixture('immediate-roadmap-successor', ({ root, planning }) => {
    const phases = [
      roadmapPhase('8', 'closed'),
      roadmapPhase('9', 'immediate-next'),
      roadmapPhase('10', 'later-scoped'),
    ];
    writeRoadmap(planning, 'v3.0', phases);
    writePhase(planning, 'milestone', 'v3.0', phases[0], {
      contextForm: 'id', verification: 'PASS',
    });
    writePhase(planning, 'milestone', 'v3.0', phases[1], { contextForm: 'id' });
    writePhase(planning, 'milestone', 'v3.0', phases[2], { contextForm: 'id' });
    writeState(planning, 'v3.0', '9', false);
    const result = resolve(root);
    assert('ROADMAP next selects only immediate successor',
      result.ok && result.phase === '9' && result.source === 'phase_folders',
      JSON.stringify(result));
  });

  withFixture('closed-final-roadmap-row', ({ root, planning }) => {
    const phases = [
      roadmapPhase('8', 'unverified-earlier'),
      roadmapPhase('9', 'closed-final'),
    ];
    writeRoadmap(planning, 'v3.0', phases);
    writePhase(planning, 'milestone', 'v3.0', phases[0], { contextForm: 'id' });
    writePhase(planning, 'milestone', 'v3.0', phases[1], {
      contextForm: 'id', verification: 'PASS',
    });
    writeState(planning, 'v3.0', '9', false);
    const result = resolve(root);
    assert('ROADMAP closed final row remains active evidence',
      result.ok && result.phase === '9' && result.source === 'phase_folders',
      JSON.stringify(result));
  });

  withFixture('missing-immediate-roadmap-row', ({ root, planning }) => {
    const phases = [
      roadmapPhase('8', 'closed'),
      roadmapPhase('9', 'missing-immediate'),
      roadmapPhase('10', 'later-scoped'),
    ];
    writeRoadmap(planning, 'v3.0', phases);
    writePhase(planning, 'milestone', 'v3.0', phases[0], {
      contextForm: 'id', verification: 'PASS',
    });
    writePhase(planning, 'milestone', 'v3.0', phases[2], { contextForm: 'id' });
    writeState(planning, 'v3.0', '8', false);
    const result = resolve(root);
    assert('ROADMAP next never skips a missing immediate row',
      result.ok && result.phase === '8' && result.source === 'phase_folders',
      JSON.stringify(result));
  });

  withFixture('legacy-closed-status-vocabulary', ({ root, planning }) => {
    const phases = [
      roadmapPhase('8', 'legacy-nonclosed-token'),
      roadmapPhase('9', 'would-be-successor'),
      roadmapPhase('10', 'last-scoped-nonclosed'),
    ];
    writeRoadmap(planning, 'v3.0', phases);
    writePhase(planning, 'milestone', 'v3.0', phases[0], {
      contextForm: 'id', verification: 'COMPLETE',
    });
    writePhase(planning, 'milestone', 'v3.0', phases[1], { contextForm: 'id' });
    writePhase(planning, 'milestone', 'v3.0', phases[2], { contextForm: 'id' });
    writeState(planning, 'v3.0', '8', false);
    const result = resolve(root);
    assert('closed status vocabulary remains PASS-prefixed only',
      result.ok && result.phase === '10' && result.source === 'phase_folders',
      JSON.stringify(result));
  });

  withFixture('legacy-state-precedence', ({ root, planning }) => {
    writeFile(path.join(planning, 'STATE.md'), [
      '---',
      'milestone: v9.9',
      'current_phase: v30-07',
      'current_phase_name: Top Level Projection',
      'current_phase_status: top-level',
      'roadmap_run:',
      '  current_milestone: v3.0',
      '  current_phase: 40',
      '  current_phase_name: Legacy Projection',
      '  current_phase_status: in-progress',
      '---',
      '',
    ].join('\n'));
    const result = resolve(root);
    assert('roadmap_run current fields retain legacy STATE precedence',
      result.ok
        && result.source === 'state_md_legacy'
        && result.milestone === 'v3.0'
        && result.phase === '40'
        && result.phase_name === 'Legacy Projection'
        && result.phase_status === 'in-progress',
      JSON.stringify(result));
  });
}

function runSediment() {
  withFixture('sediment', ({ root, planning }) => {
    const legacyLines = [];
    for (let value = 1; value <= 30; value += 1) {
      legacyLines.push(
        `  legacy_${String(value).padStart(2, '0')}:`,
        '    milestone: v2.2',
        '    current_milestone: v2.2',
        `    current_phase: ${value}`,
      );
    }
    const giantProse = `historical sediment ${'x'.repeat(16384)}`;
    const stateLines = [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v3.6-vtp-bridge',
      `current_phase: ${JSON.stringify('153')}`,
      'current_phase_name: Hook Transport Completion',
      'current_phase_status: in-progress',
      `legacy_activity: ${JSON.stringify(giantProse)}`,
      'progress:',
      ...legacyLines,
      'roadmap_run:',
      '  mode: operator-led',
      '  scope: legacy closed milestone',
      '  current_milestone: v2.2',
      '  current_phase: complete',
      '  current_phase_name: Legacy Closed Projection',
      '  current_phase_status: ALL-PHASES-CLOSED',
      '---',
      '',
      '---',
      'milestone: v9.9',
      'current_phase: v99-99',
      '---',
      '',
    ];
    writeFile(path.join(planning, 'STATE.md'), stateLines.join('\n'));

    const current = roadmapPhase('153', 'hook-transport-completion');
    const active = roadmapPhase('155', 'propagation-readiness');
    writeFile(path.join(planning, 'ROADMAP.md'), [
      '# Active v3.6 roadmap',
      '',
      '| Phase | Name | Status |',
      '|---:|---|---|',
      '| 153 | Hook Transport Completion | Complete |',
      '| 155 | Propagation Readiness | Active |',
      '',
    ].join('\n'));
    writePhase(planning, 'milestone', 'v3.6-vtp-bridge', current, {
      contextForm: 'id', verification: 'PASS',
    });
    writePhase(planning, 'milestone', 'v3.6-vtp-bridge', active, {
      contextForm: 'id',
    });

    const ghost = roadmapPhase('67', 'warp-doctor-probe-design');
    writeRoadmap(planning, 'v2.2', [ghost]);
    writePhase(planning, 'milestone', 'v2.2', ghost, { contextForm: 'id' });

    assert('SEDIMENT fixture carries more than 100 legacy lines',
      legacyLines.length > 100, `count=${legacyLines.length}`);
    assert('SEDIMENT fixture carries a giant single-line prose value',
      giantProse.length > 16000, `length=${giantProse.length}`);

    const result = resolve(root);
    assert('SEDIMENT reader returns top-level state values',
      result._state_md
        && result._state_md.milestone === 'v3.6-vtp-bridge'
        && result._state_md.phase === '153'
        && result._state_md.phase_name === 'Hook Transport Completion'
        && result._state_md.phase_status === 'in-progress',
      result._state_md ? JSON.stringify(result._state_md) : 'no projection');
    assertResolution('SEDIMENT v-scheme truth', result, {
      source: 'phase_folders',
      milestone: 'v3.6-vtp-bridge',
      phase: '155',
    });
    const stateConflict = result.conflicts && result.conflicts.find(
      (conflict) => conflict.source_b === 'state_md');
    assert('SEDIMENT conflict names true state values when present',
      stateConflict
        && stateConflict.milestone_b === 'v3.6-vtp-bridge'
        && stateConflict.phase_b === '153',
      stateConflict ? JSON.stringify(stateConflict) : 'no state conflict');
  });
}

function writeTierBase(planning) {
  const phases = [
    roadmapPhase('40', 'legacy-fallback'),
    roadmapPhase('v30-07', 'opaque-active'),
  ];
  writeRoadmap(planning, 'v3.0', phases);
  writeState(planning, 'v3.0', '40', false);
  const phaseDir = writePhase(planning, 'flat', 'v3.0', phases[1], { contextForm: 'id' });
  return { phaseDir };
}

function assertAbstains(label, result) {
  assertResolution(label, result, {
    source: 'state_md_legacy',
    milestone: 'v3.0',
    phase: '40',
    confidence: 0.40,
  });
}

function runCheckpointCases() {
  withFixture('checkpoint-valid', ({ root, planning }) => {
    writeTierBase(planning);
    writeFile(path.join(planning, 'ORCHESTRATOR-CHECKPOINT.md'), [
      '---',
      'milestone: v3.0',
      'current_phase: v30-07',
      'current_phase_name: Opaque Active',
      '---',
      '',
    ].join('\n'));
    assertResolution('checkpoint valid v-scheme', resolve(root), {
      source: 'checkpoint', milestone: 'v3.0', phase: 'v30-07', confidence: 0.95,
    });
  });

  withFixture('checkpoint-ambiguous', ({ root, planning }) => {
    writeState(planning, 'v3.0', '40', false);
    writeFile(path.join(planning, 'ORCHESTRATOR-CHECKPOINT.md'), [
      '---',
      'milestone: v3.0',
      'current_phase: v30-07',
      'phase: 40',
      '---',
      '',
    ].join('\n'));
    assertAbstains('checkpoint ambiguous marker abstains', resolve(root));
  });
}

function runPulseCases() {
  withFixture('pulse-valid', ({ root, planning }) => {
    writeTierBase(planning);
    writeFile(path.join(planning, 'metrics', 'orchestrator-pulse.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), milestone: 'v3.0', phase: 'v30-07' })}\n`);
    assertResolution('pulse valid v-scheme', resolve(root), {
      source: 'pulse', milestone: 'v3.0', phase: 'v30-07', confidence: 0.90,
    });
  });

  withFixture('pulse-invalid', ({ root, planning }) => {
    writeState(planning, 'v3.0', '40', false);
    writeFile(path.join(planning, 'metrics', 'orchestrator-pulse.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), phase: 'v30-07-lookalike' })}\n`);
    assertAbstains('pulse unsupported marker abstains', resolve(root));
  });
}

function runActivityCases() {
  withFixture('activity-valid', ({ root, planning }) => {
    const { phaseDir } = writeTierBase(planning);
    writeFile(path.join(planning, 'metrics', 'activity-log.jsonl'),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        target: path.join(phaseDir, 'v30-07-PLAN.md'),
      })}\n`);
    assertResolution('activity flat path valid v-scheme', resolve(root), {
      source: 'activity_log', milestone: 'v3.0', phase: 'v30-07', confidence: 0.80,
    });
  });

  withFixture('activity-marker-valid', ({ root, planning }) => {
    writeTierBase(planning);
    writeFile(path.join(planning, 'metrics', 'activity-log.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), target: 'dispatch Pv30-07' })}\n`);
    assertResolution('activity marker valid v-scheme', resolve(root), {
      source: 'activity_log', milestone: 'v3.0', phase: 'v30-07', confidence: 0.80,
    });
  });

  withFixture('activity-ambiguous', ({ root, planning }) => {
    writeState(planning, 'v3.0', '40', false);
    writeFile(path.join(planning, 'metrics', 'activity-log.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), target: 'dispatch Pv30-07 and P40' })}\n`);
    assertAbstains('activity ambiguous markers abstain', resolve(root));
  });

  withFixture('activity-milestone-ambiguous', ({ root, planning }) => {
    writeState(planning, 'v3.0', '40', false);
    const left = path.join(
      planning, 'milestones', 'v3.0', 'phases', 'v30-07-left', 'PLAN.md');
    const right = path.join(
      planning, 'milestones', 'v2.0', 'phases', 'v30-07-right', 'PLAN.md');
    writeFile(path.join(planning, 'metrics', 'activity-log.jsonl'),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        target: left,
        command_preview: right,
      })}\n`);
    assertAbstains('activity conflicting milestones abstain', resolve(root));
  });
}

function runGit(root, args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

function initializeGitFixture(root, subject, label) {
  const commands = [
    ['init'],
    ['config', 'user.email', 'sgsd-test@example.invalid'],
    ['config', 'user.name', 'SGSD Test'],
    ['commit', '--allow-empty', '-m', subject],
  ];
  for (const args of commands) {
    const result = runGit(root, args);
    if (result.status !== 0) {
      assert(`${label} real git setup`, false,
        `git ${args[0]} exit=${result.status} error=${result.error ? result.error.code : 'none'}`);
      return false;
    }
  }
  return true;
}

function runGitCases() {
  withFixture('git-valid', ({ root }) => {
    if (!initializeGitFixture(root, 'feat(pv30-07): opaque evidence', 'git valid')) return;
    assertResolution('git valid v-scheme', resolve(root), {
      source: 'git', phase: 'v30-07', confidence: 0.60,
    });
  });

  withFixture('git-invalid', ({ root, planning }) => {
    writeState(planning, 'v3.0', '40', false);
    if (!initializeGitFixture(
      root, 'feat(pv30-07-lookalike): invalid evidence', 'git invalid')) return;
    assertAbstains('git unsupported marker abstains', resolve(root));
  });
}

function runEvidenceTierMatrix() {
  runCheckpointCases();
  runPulseCases();
  runActivityCases();
  runGitCases();
}

if (requestedCase === 'all' || requestedCase === 'devcp-mixed-flat') runDevcpMixedFlat();
if (requestedCase === 'all' || requestedCase === 'evidence-tier-matrix') {
  runEvidenceTierMatrix();
}
if (requestedCase === 'all' || requestedCase === 'sediment') runSediment();

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`assert-state-resolver: ${passed} pass, ${failures.length} fail`);
  process.exit(1);
}

console.log(`assert-state-resolver: ${passed} pass, 0 fail`);
