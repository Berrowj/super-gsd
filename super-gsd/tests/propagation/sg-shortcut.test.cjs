'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const shortcut = path.join(root, 'super-gsd/scripts/sg');
const installer = path.join(root, 'super-gsd/install.sh');
const snapshot = path.join(root, 'super-gsd/scripts/sgsd-global-snapshot.sh');
const shellPath = (value) => value.replaceAll('\\', '/');
const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which',
  [process.platform === 'win32' ? 'bash.exe' : 'bash'], { encoding: 'utf8', windowsHide: true });
const bash = found.status === 0 ? found.stdout.split(/\r?\n/).map((v) => v.trim())
  .find((v) => v && !/[\\/](?:System32|WindowsApps)[\\/]/i.test(v)) : null;

function fixture(t) {
  assert.ok(fs.existsSync(shortcut), 'tracked sg shortcut must exist');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg shortcut test '));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const dirs = {
    temp,
    home: path.join(temp, 'home'),
    project: path.join(temp, 'business project'),
    scripts: path.join(temp, 'authoritative scripts'),
    agents: path.join(temp, 'authoritative agents'),
    source: path.join(temp, 'authoritative source'),
  };
  for (const directory of Object.values(dirs)) fs.mkdirSync(directory, { recursive: true });
  writeLauncher(dirs.scripts);
  return dirs;
}

// The wrapper delegates all launch side effects; this boundary records only
// arguments, process identity and cwd, without invoking a provider or telemetry.
function writeLauncher(directory) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'sgsd-remote-tmux.sh'),
    '#!/usr/bin/env bash\nprintf "%s\\0" "$$" "$PWD" "$@"\nexit "${SG_TEST_EXIT:-0}"\n');
}

function run(dirs, args = [], options = {}) {
  const env = { ...process.env };
  for (const name of ['SGSD_SCRIPTS_DIR', 'SGSD_AGENTS_DIR', 'SGSD_SOURCE_DIR', 'BASH_ENV', 'ENV']) delete env[name];
  Object.assign(env, {
    PATH: `${path.dirname(bash)}${path.delimiter}${process.env.PATH || ''}`,
    HOME: shellPath(dirs.home),
    SGSD_SCRIPTS_DIR: shellPath(dirs.scripts),
    SGSD_AGENTS_DIR: shellPath(dirs.agents),
    SGSD_SOURCE_DIR: shellPath(dirs.source),
    ...options.env,
  });
  const result = spawnSync(bash, ['-c', 'printf "%s\\0" "$$"; exec bash "$@"',
    'sg-shortcut-test', shellPath(options.shortcut || shortcut), ...args], {
    cwd: dirs.project, env, encoding: 'utf8', timeout: 30_000, windowsHide: true,
  });
  const fields = result.stdout.split('\0');
  if (fields.at(-1) === '') fields.pop();
  return { ...result, initialPid: fields[0], launcherPid: fields[1], cwd: fields[2], args: fields.slice(3) };
}

function value(result, flag) {
  const index = result.args.indexOf(flag);
  assert.notEqual(index, -1, `missing ${flag}: ${JSON.stringify(result.args)}`);
  return result.args[index + 1];
}

function assertLaunch(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.args[0], '--current-terminal');
  assert.equal(result.args.filter((arg) => arg === '--current-terminal').length, 1);
}

const shellTest = (name, fn) => test(name, { skip: !bash && 'Bash unavailable' }, fn);

test('tracked sg delegates through exec without a second telemetry or model implementation', () => {
  assert.ok(fs.existsSync(shortcut), 'tracked sg shortcut must exist');
  const source = fs.readFileSync(shortcut, 'utf8');
  assert.match(source, /exec bash "\$[A-Z_]+"/);
  assert.match(source, /--current-terminal/);
  assert.doesNotMatch(source, /\/opt\/|\btmux\s+(?:new|attach|send)|\bclaude\s+--|global\.cjs|OTEL_|resolveModel/);
});

shellTest('plain sg preserves cwd and directly replaces its shell with the common launcher', (t) => {
  const dirs = fixture(t);
  const result = run(dirs);
  assertLaunch(result);
  assert.equal(result.launcherPid, result.initialPid, 'exec must preserve the caller process identity');
  assert.ok(result.cwd.endsWith('/business project'), result.cwd);
  assert.equal(result.args.includes('--project'), false, 'the shared launcher owns cwd-based project resolution');
  for (const key of ['scripts', 'agents', 'source']) {
    assert.ok(value(result, `--${key}-dir`).endsWith(`/authoritative ${key}`));
  }
});

shellTest('legacy flags translate once and project paths with spaces remain single arguments', (t) => {
  const dirs = fixture(t);
  const project = shellPath(path.join(dirs.temp, 'other project'));
  const result = run(dirs, ['-Go', '-ProjectDir', project, '-NoCockpit', '-NoClaude']);
  assertLaunch(result);
  assert.equal(value(result, '--project'), project);
  for (const flag of ['--go', '--no-cockpit', '--shell']) assert.ok(result.args.includes(flag));
  for (const flag of ['-Go', '-ProjectDir', '-NoCockpit', '-NoClaude', '--full-preflight']) assert.equal(result.args.includes(flag), false);
});

shellTest('GNU flags and later shared-launcher options retain their argument boundaries', (t) => {
  const dirs = fixture(t);
  const result = run(dirs, ['--go', '--project', shellPath(dirs.project), '--no-cockpit', '--no-claude', '--session', 'a spaced session']);
  assertLaunch(result);
  assert.equal(value(result, '--session'), 'a spaced session');
  assert.equal(value(result, '--project'), shellPath(dirs.project));
  assert.ok(result.args.includes('--shell'));
});

shellTest('explicit directories select the authoritative launcher ahead of environment values', (t) => {
  const dirs = fixture(t);
  const override = path.join(dirs.temp, 'explicit scripts');
  writeLauncher(override);
  const result = run(dirs, ['--scripts-dir', shellPath(override), '--agents-dir', shellPath(dirs.agents), '--source-dir', shellPath(dirs.source)],
    { env: { SGSD_SCRIPTS_DIR: shellPath(path.join(dirs.temp, 'not installed')) } });
  assertLaunch(result);
  assert.ok(value(result, '--scripts-dir').endsWith('/explicit scripts'));
  assert.equal(result.args.filter((arg) => arg === '--scripts-dir').length, 1);
});

shellTest('installed shortcut resolves global scripts without consulting the business worktree', (t) => {
  const dirs = fixture(t);
  const globalScripts = path.join(dirs.home, '.claude/super-gsd/scripts');
  writeLauncher(globalScripts);
  fs.mkdirSync(path.join(dirs.home, '.claude/agents'), { recursive: true });
  fs.mkdirSync(path.join(dirs.home, '.claude/super-gsd/source'), { recursive: true });
  const localShortcut = path.join(dirs.home, '.local/bin/sg');
  fs.mkdirSync(path.dirname(localShortcut), { recursive: true });
  fs.copyFileSync(shortcut, localShortcut);
  const result = run(dirs, [], { shortcut: localShortcut, env: { SGSD_SCRIPTS_DIR: '', SGSD_AGENTS_DIR: '', SGSD_SOURCE_DIR: '' } });
  assertLaunch(result);
  assert.ok(value(result, '--scripts-dir').endsWith('/.claude/super-gsd/scripts'));
});

shellTest('a colocated launcher is selected when sg runs from an authoritative scripts directory', (t) => {
  const dirs = fixture(t);
  const colocated = path.join(dirs.scripts, 'sg');
  fs.copyFileSync(shortcut, colocated);
  const result = run(dirs, [], { shortcut: colocated, env: { SGSD_SCRIPTS_DIR: '' } });
  assertLaunch(result);
  assert.ok(value(result, '--scripts-dir').endsWith('/authoritative scripts'));
});

shellTest('shared-launcher exit status propagates without launching a fallback shell', (t) => {
  const result = run(fixture(t), [], { env: { SG_TEST_EXIT: '37' } });
  assert.equal(result.status, 37, result.stderr);
  assert.ok(result.launcherPid);
});

shellTest('full preflight is explicitly unsupported rather than becoming a doctor-only success', (t) => {
  const dirs = fixture(t);
  for (const flag of ['--full-preflight', '-FullPreflight']) {
    const result = run(dirs, [flag]);
    assert.notEqual(result.status, 0);
    assert.equal(result.launcherPid, undefined, 'unsupported option must not start a session');
    assert.match(result.stderr, /full.preflight.*not supported|unsupported.*full.preflight/i);
    assert.match(result.stderr, /preflight|provenance|checks/i);
  }
});

shellTest('missing option values and missing shared launcher fail before launching', (t) => {
  const dirs = fixture(t);
  for (const flag of ['--project', '--scripts-dir', '--agents-dir', '--source-dir']) {
    const result = run(dirs, [flag]);
    assert.notEqual(result.status, 0);
    assert.equal(result.launcherPid, undefined);
    assert.match(result.stderr, /requires a path/i);
  }
  fs.unlinkSync(path.join(dirs.scripts, 'sgsd-remote-tmux.sh'));
  const missing = run(dirs);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /missing.*launcher/i);
});

test('global installer packages both executable sg targets and snapshot covers its previous contents', () => {
  const source = fs.readFileSync(installer, 'utf8');
  assert.match(source, /script_sources\+=\("\$SCRIPT_DIR\/scripts\/sg"\)/);
  assert.match(source, /global_executable_targets\+=\("\$GLOBAL_SCRIPTS_DIR\/sg" "\$LOCAL_BIN_DIR\/sg"\)/);
  assert.match(source, /copy_file "\$SCRIPT_DIR\/scripts\/sg" "\$LOCAL_BIN_DIR\/sg"/);
  const snapshotSource = fs.readFileSync(snapshot, 'utf8');
  assert.match(snapshotSource, /"\.local\/bin\/sg"/);
  assert.ok(snapshotSource.includes('\'"$LOCAL_BIN_DIR/sg"\''), 'snapshot contract must recognize the exact sg install target');
});
