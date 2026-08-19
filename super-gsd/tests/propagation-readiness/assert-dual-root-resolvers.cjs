#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const bash = findBash();
const audit = require(path.join(repoRoot, 'super-gsd', 'tools', 'phase-folder-audit', 'audit.cjs'));

const requestedTool = readArg('--tool') || 'all';
const requestedCase = readArg('--case') || 'full-matrix';
const tools = ['conformance', 'dashboard', 'distill', 'verifier', 'audit', 'state-resolver'];

if (requestedCase !== 'full-matrix' || (requestedTool !== 'all' && !tools.includes(requestedTool))) {
  console.error('Usage: assert-dual-root-resolvers.cjs --tool all|conformance|dashboard|distill|verifier|audit|state-resolver --case full-matrix');
  process.exit(2);
}

const selectedTools = requestedTool === 'all' ? tools : [requestedTool];
const schemes = [
  { scheme: 'integer', token: '40' },
  { scheme: 'decimal', token: '40.5' },
  { scheme: 'v', token: 'v30-07' },
];
const layouts = ['milestone-only', 'flat-only', 'both-roots', 'neither-root'];
const milestone = 'v9.9';
let passed = 0;
const failures = [];

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.GIT_BASH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'usr', 'bin', 'bash.exe'),
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'C:\\Program Files\\Git\\bin\\bash.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || 'bash';
}

function bashPath(value) {
  return process.platform === 'win32' ? value.split(path.sep).join('/') : value;
}

function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function occurrences(text, needle) {
  if (!needle) return 0;
  return String(text).split(needle).length - 1;
}

function combined(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function faultEnv(fixture, preload) {
  return {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require=${preload}`.trim(),
    SGSD_UNREADABLE_PHASE_ROOT: path.join(
      fixture.planning, 'milestones', milestone, 'phases'),
  };
}

function writeUnreadableRootPreload(base) {
  const preload = path.join(base, 'inject-unreadable-root.cjs');
  fs.writeFileSync(preload, `'use strict';
const fs = require('fs');
const path = require('path');
const original = fs.readdirSync;
fs.readdirSync = function (target, options) {
  const expected = process.env.SGSD_UNREADABLE_PHASE_ROOT;
  const left = path.resolve(String(target));
  const right = expected ? path.resolve(expected) : '';
  const same = process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
  if (same) {
    const error = new Error('EACCES: injected unreadable phase root: ' + left);
    error.code = 'EACCES';
    throw error;
  }
  return original.call(fs, target, options);
};
`, 'utf8');
  return preload;
}

function phaseFixtureHash(projectDir) {
  const hash = crypto.createHash('sha256');
  const planning = path.join(projectDir, '.planning');
  const roots = [
    path.join(planning, 'milestones', milestone, 'phases'),
    path.join(planning, 'phases'),
  ];
  const canonical = new Set();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root).sort()) {
      const dir = path.join(root, name);
      let real;
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
        real = fs.realpathSync(dir);
      } catch (_error) {
        continue;
      }
      const key = process.platform === 'win32' ? real.toLowerCase() : real;
      if (canonical.has(key)) continue;
      canonical.add(key);
      function walk(current, relative) {
        const stat = fs.statSync(current);
        hash.update(relative + '\0' + (stat.isDirectory() ? 'd' : 'f') + '\0');
        if (stat.isDirectory()) {
          for (const child of fs.readdirSync(current).sort()) {
            walk(path.join(current, child), path.join(relative, child));
          }
        } else {
          hash.update(fs.readFileSync(current));
        }
      }
      walk(real, name);
    }
  }
  return hash.digest('hex');
}

function writePhase(dir, token, slug) {
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    [`${token}-CONTEXT.md`]: '# Context\n',
    [`${token}-RESEARCH.md`]: '# Research\n',
    [`${token}-01-${slug}-PLAN.md`]: '- [x] one\n- [x] two\n- [x] three\n- [x] four\n- [x] five\n',
    [`${token}-SUMMARY.md`]: '# Summary\n',
    [`${token}-VERIFICATION.md`]: '---\nstatus: in-progress\n---\n',
    [`${token}-ATC-REVIEW.md`]: '# Review\n',
    [`${token}-codex-review.md`]: '# Codex review\n',
    'commit-reviews.jsonl': '',
    'WASTE.md': '# Waste\n',
  };
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8');
  }
  fs.writeFileSync(path.join(dir, 'mutation-sentinel.bin'), Buffer.from([9, 8, 7, 0, 255]));
}

function createFixture(base, layout, token, scheme) {
  const projectDir = path.join(base, `${layout}-${scheme}`);
  const planning = path.join(projectDir, '.planning');
  const slug = `fixture-${scheme}`;
  const dirName = `${token}-${slug}`;
  fs.mkdirSync(path.join(planning, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(planning, 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'STATE.md'),
    `---\nmilestone: ${milestone}\ncurrent_phase: ${token}\nstatus: active\n---\n`, 'utf8');
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'),
    `### Phase ${token}: Fixture\n\n**Success Criteria:**\n1. fixture\n`, 'utf8');
  fs.writeFileSync(path.join(planning, 'config.json'), JSON.stringify({
    browser_verify: {
      enabled: true,
      base_url: 'http://127.0.0.1:1',
      approved_fallbacks: [],
      routes: [],
    },
  }), 'utf8');

  let canonicalDir = null;
  if (layout === 'milestone-only' || layout === 'both-roots') {
    canonicalDir = path.join(planning, 'milestones', milestone, 'phases', dirName);
    writePhase(canonicalDir, token, slug);
  } else if (layout === 'flat-only') {
    canonicalDir = path.join(planning, 'phases', dirName);
    writePhase(canonicalDir, token, slug);
  }

  if (layout === 'both-roots') {
    const milestoneRoot = path.join(planning, 'milestones', milestone, 'phases');
    const flatRoot = path.join(planning, 'phases');
    fs.symlinkSync(milestoneRoot, flatRoot, process.platform === 'win32' ? 'junction' : 'dir');
  }

  return { projectDir, planning, token, scheme, dirName, canonicalDir };
}

function runConformance(fixture) {
  const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-conformance-check.sh');
  const result = spawnSync(bash, [bashPath(script), fixture.token, '--project', bashPath(fixture.projectDir), '--dry-run'], {
    encoding: 'utf8',
  });
  const output = combined(result);
  if (fixture.canonicalDir) {
    assert(`${fixture.label} conformance resolves phase`, result.status === 0 && output.includes(`"phase_num":"${fixture.token}"`),
      `exit=${result.status}`);
    assert(`${fixture.label} conformance processes canonical phase once`, occurrences(output, `"phase":"${fixture.dirName}"`) === 1);
  } else {
    assert(`${fixture.label} conformance treats absent roots as no match`, result.status === 4);
  }
}

function runDiscoveryFault(fixture, preload, tool) {
  let result;
  if (tool === 'conformance') {
    const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-conformance-check.sh');
    result = spawnSync(bash,
      [bashPath(script), fixture.token, '--project', bashPath(fixture.projectDir), '--dry-run'],
      { encoding: 'utf8', env: faultEnv(fixture, preload) });
  } else if (tool === 'dashboard') {
    const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-agent-dashboard.sh');
    result = spawnSync(bash, [bashPath(script), bashPath(fixture.projectDir), '0', '--once'], {
      encoding: 'utf8',
      env: { ...faultEnv(fixture, preload), TERM: 'xterm' },
    });
  } else if (tool === 'distill') {
    const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-distill-milestone.sh');
    result = spawnSync(bash, [bashPath(script), milestone, '--root', bashPath(fixture.projectDir)], {
      encoding: 'utf8',
      env: faultEnv(fixture, preload),
    });
  } else if (tool === 'verifier') {
    const script = path.join(repoRoot, 'super-gsd', 'tools', 'phase-verifier', 'phase-verifier.mjs');
    result = spawnSync(process.execPath,
      [script, '--project-dir', fixture.projectDir, '--phase', fixture.token], {
        encoding: 'utf8',
        env: faultEnv(fixture, preload),
      });
  } else {
    return;
  }
  const output = combined(result);
  assert(`${fixture.label} unreadable discovery root exits non-zero`,
    result.status !== 0, `exit=${result.status}`);
  assert(`${fixture.label} unreadable discovery root reports reason`,
    output.includes('EACCES') && output.includes('unreadable'), output.trim());
}

function runDashboard(fixture) {
  const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-agent-dashboard.sh');
  const result = spawnSync(bash, [bashPath(script), bashPath(fixture.projectDir), '0', '--once'], {
    encoding: 'utf8',
    env: { ...process.env, TERM: 'xterm' },
  });
  const output = combined(result);
  assert(`${fixture.label} dashboard exit reflects phase availability`,
    result.status === (fixture.canonicalDir ? 0 : 4), `exit=${result.status}`);
  assert(`${fixture.label} dashboard phase visibility`, fixture.canonicalDir
    ? occurrences(output, fixture.dirName) === 1
    : occurrences(output, 'CURRENT PHASE FILES') === 0);
}

function runDistill(fixture) {
  const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-distill-milestone.sh');
  const result = spawnSync(bash, [bashPath(script), milestone, '--root', bashPath(fixture.projectDir)], {
    encoding: 'utf8',
  });
  const output = combined(result);
  assert(`${fixture.label} distill prepare exit reflects corpus availability`,
    result.status === (fixture.canonicalDir ? 0 : 4), `exit=${result.status}`);
  const header = `===== PHASE ${fixture.token} (${fixture.dirName}) =====`;
  assert(`${fixture.label} distill phase visibility`, fixture.canonicalDir
    ? occurrences(output, header) === 1
    : occurrences(output, '===== PHASE ') === 0);
  const documentCount = (output.match(/^--- (?:.*SUMMARY\.md|.*VERIFICATION\.md|WASTE\.md) ---\r?$/gm) || []).length;
  assert(`${fixture.label} distill corpus document count`, fixture.canonicalDir
    ? documentCount > 0
    : documentCount === 0,
    `documents=${documentCount}`);
}

function runDistillMissingCorpus(fixture) {
  for (const name of [
    `${fixture.token}-SUMMARY.md`,
    `${fixture.token}-VERIFICATION.md`,
    'WASTE.md',
  ]) {
    fs.rmSync(path.join(fixture.canonicalDir, name));
  }
  const script = path.join(repoRoot, 'super-gsd', 'scripts', 'sgsd-distill-milestone.sh');
  const result = spawnSync(bash, [bashPath(script), milestone, '--root', bashPath(fixture.projectDir)], {
    encoding: 'utf8',
  });
  assert(`${fixture.label} distill rejects missing corpus`,
    result.status === 4 && combined(result).includes('no corpus data'),
    `exit=${result.status}`);
}

function runVerifier(fixture, emptyPath) {
  const script = path.join(repoRoot, 'super-gsd', 'tools', 'phase-verifier', 'phase-verifier.mjs');
  const result = spawnSync(process.execPath, [script, '--project-dir', fixture.projectDir, '--phase', fixture.token], {
    encoding: 'utf8',
    env: { ...process.env, PATH: emptyPath },
  });
  const output = combined(result);
  assert(`${fixture.label} verifier stops at a bounded precondition`, result.status === 2,
    `exit=${result.status}`);
  assert(`${fixture.label} verifier phase visibility`, fixture.canonicalDir
    ? occurrences(output, 'Phase dir:') === 1 && output.includes(fixture.dirName)
    : !fs.existsSync(path.join(fixture.planning, 'phases')) && output.includes('not found'));
}

function runAudit(fixture) {
  const rows = audit.auditAllPhases(fixture.planning, {
    milestone,
    includeUnarchived: true,
  });
  if (fixture.canonicalDir) {
    assert(`${fixture.label} audit resolves one canonical phase`, rows.length === 1,
      `rows=${rows.length}`);
    assert(`${fixture.label} audit preserves opaque token`, rows[0] && rows[0].phase_num === fixture.token,
      rows[0] ? `phase_num=${rows[0].phase_num}` : 'no row');
  } else {
    assert(`${fixture.label} audit treats absent roots as empty`, rows.length === 0,
      `rows=${rows.length}`);
  }
}

function readResolverEnvelope(fixture, label) {
  const script = path.join(repoRoot, 'super-gsd', 'tools', 'state-resolver', 'resolve.cjs');
  const result = spawnSync(process.execPath, [script, '--project', fixture.projectDir, '--json'], {
    encoding: 'utf8',
  });
  assert(`${fixture.label} state-resolver ${label} exits 0`, result.status === 0,
    `exit=${result.status}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    assert(`${fixture.label} state-resolver ${label} emits JSON`, false, error.message);
    return null;
  }
}

function writeActivity(fixture, target) {
  fs.writeFileSync(path.join(fixture.planning, 'metrics', 'activity-log.jsonl'), JSON.stringify({
    ts: new Date().toISOString(),
    target,
  }) + '\n', 'utf8');
}

function assertResolverEnvelope(fixture, label, envelope, expectedSource,
  expectedMilestone, expectedPhaseName) {
  assert(`${fixture.label} state-resolver ${label} returns ok JSON`, envelope && envelope.ok === true);
  assert(`${fixture.label} state-resolver ${label} preserves opaque token`,
    envelope && envelope.phase === fixture.token,
    envelope ? `phase=${envelope.phase}` : 'no envelope');
  assert(`${fixture.label} state-resolver ${label} resolves expected milestone`,
    envelope && envelope.milestone === expectedMilestone,
    envelope ? `milestone=${envelope.milestone}` : 'no envelope');
  assert(`${fixture.label} state-resolver ${label} resolves expected phase name`,
    envelope && envelope.phase_name === expectedPhaseName,
    envelope ? `phase_name=${envelope.phase_name}` : 'no envelope');
  assert(`${fixture.label} state-resolver ${label} selects expected evidence`,
    envelope && envelope.source === expectedSource,
    envelope ? `source=${envelope.source}` : 'no envelope');
}

function runStateResolver(fixture) {
  if (!fixture.canonicalDir) {
    assertResolverEnvelope(fixture, 'absent roots', readResolverEnvelope(fixture, 'absent roots'),
      'state_md_legacy', milestone, null);
    return;
  }

  const expectedPhaseName = `Fixture ${fixture.scheme.charAt(0).toUpperCase() + fixture.scheme.slice(1)}`;
  const evidencePath = path.join(fixture.planning, 'milestones', milestone, 'phases',
    fixture.dirName, `${fixture.token}-PLAN.md`);
  writeActivity(fixture, evidencePath);
  assertResolverEnvelope(fixture, 'activity path', readResolverEnvelope(fixture, 'activity path'),
    'activity_log', milestone, expectedPhaseName);

  writeActivity(fixture, `P${fixture.token}`);
  assertResolverEnvelope(fixture, 'activity marker', readResolverEnvelope(fixture, 'activity marker'),
    'activity_log', milestone, expectedPhaseName);
}

function runStateResolverGitEvidence(base) {
  for (const phaseCase of schemes) {
    const fixture = createFixture(base, 'neither-root', phaseCase.token, phaseCase.scheme);
    fixture.label = `state-resolver/git/${phaseCase.scheme}`;
    const commands = [
      ['init'],
      ['config', 'user.email', 'sgsd-test@example.invalid'],
      ['config', 'user.name', 'SGSD Test'],
      ['commit', '--allow-empty', '-m', `feat(p${phaseCase.token})`],
    ];
    let setupOk = true;
    for (const args of commands) {
      const result = spawnSync('git', args, { cwd: fixture.projectDir, encoding: 'utf8' });
      if (result.status !== 0) {
        setupOk = false;
        assert(`${fixture.label} git fixture setup`, false,
          `git ${args[0]} exit=${result.status}`);
        break;
      }
    }
    if (!setupOk) continue;
    assertResolverEnvelope(fixture, 'git marker', readResolverEnvelope(fixture, 'git marker'),
      'git', null, null);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-dual-root-'));
try {
  const emptyPath = path.join(tmp, 'empty-path');
  fs.mkdirSync(emptyPath, { recursive: true });
  const unreadableRootPreload = writeUnreadableRootPreload(tmp);

  for (const tool of selectedTools) {
    for (const layout of layouts) {
      const cases = layout === 'neither-root' ? [schemes[0]] : schemes;
      for (const phaseCase of cases) {
        const fixture = createFixture(path.join(tmp, tool), layout, phaseCase.token, phaseCase.scheme);
        fixture.label = `${tool}/${layout}/${phaseCase.scheme}`;
        const before = phaseFixtureHash(fixture.projectDir);

        if (tool === 'conformance') runConformance(fixture);
        else if (tool === 'dashboard') runDashboard(fixture);
        else if (tool === 'distill') runDistill(fixture);
        else if (tool === 'verifier') runVerifier(fixture, emptyPath);
        else if (tool === 'audit') runAudit(fixture);
        else if (tool === 'state-resolver') runStateResolver(fixture);

        const after = phaseFixtureHash(fixture.projectDir);
        assert(`${fixture.label} phase fixture remains byte-identical`, before === after,
          `before=${before} after=${after}`);
      }
    }
    if (['conformance', 'dashboard', 'distill', 'verifier'].includes(tool)) {
      const faultFixture = createFixture(path.join(tmp, tool), 'milestone-only', '41', 'integer');
      faultFixture.label = `${tool}/unreadable-root/integer`;
      runDiscoveryFault(faultFixture, unreadableRootPreload, tool);
    }
    if (tool === 'distill') {
      const missingCorpusFixture = createFixture(
        path.join(tmp, tool, 'missing-corpus'), 'milestone-only', '42', 'integer');
      missingCorpusFixture.label = 'distill/missing-corpus/integer';
      runDistillMissingCorpus(missingCorpusFixture);
    }
    if (tool === 'state-resolver') runStateResolverGitEvidence(path.join(tmp, tool, 'git-evidence'));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`assert-dual-root-resolvers: ${passed} pass, ${failures.length} fail`);
  process.exit(1);
}

console.log(`assert-dual-root-resolvers: ${passed} pass, 0 fail`);
