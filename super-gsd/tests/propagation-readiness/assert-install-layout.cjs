#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const installer = path.join(repoRoot, 'super-gsd', 'install.sh');
const cleanRoom = path.join(repoRoot, 'super-gsd', 'tools', 'installer-audit', 'clean-room.sh');
const bash = findBash();
const requestedCase = readArg('--case') || 'all';

if (requestedCase !== 'all') {
  console.error('assert-install-layout: --case must be all');
  process.exit(2);
}

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

function hashTree(root) {
  const hash = crypto.createHash('sha256');
  function walk(current, relative) {
    const stat = fs.lstatSync(current);
    hash.update(`${relative}\0${stat.isDirectory() ? 'd' : stat.isSymbolicLink() ? 'l' : 'f'}\0`);
    if (stat.isSymbolicLink()) {
      hash.update(fs.readlinkSync(current));
      return;
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort()) {
        walk(path.join(current, name), path.join(relative, name));
      }
      return;
    }
    hash.update(fs.readFileSync(current));
  }
  walk(root, '.');
  return hash.digest('hex');
}

function runInstall(projectDir, homeDir) {
  return spawnSync(bash, [bashPath(installer), '--init-project', '--skip-cockpit-deps'], {
    cwd: projectDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
    },
  });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-install-layout-'));
try {
  const freshHome = path.join(tmp, 'fresh-home');
  const freshProject = path.join(tmp, 'fresh-project');
  fs.mkdirSync(freshHome, { recursive: true });
  fs.mkdirSync(freshProject, { recursive: true });

  const freshRun = runInstall(freshProject, freshHome);
  assert('fresh installer exits 0', freshRun.status === 0,
    `exit=${freshRun.status} signal=${freshRun.signal || 'none'}`);
  assert('fresh installer does not create legacy phase root',
    !fs.existsSync(path.join(freshProject, '.planning', 'phases')));
  for (const retained of ['metrics', 'briefs', 'decisions', 'deliberations', 'overwatcher', 'memory']) {
    assert(`fresh installer retains .planning/${retained} setup`,
      fs.existsSync(path.join(freshProject, '.planning', retained)));
  }

  const cleanRun = spawnSync(bash, [bashPath(cleanRoom), '--repo-root', bashPath(repoRoot)], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: bashPath(tmp),
    },
  });
  const cleanOutput = `${cleanRun.stdout || ''}\n${cleanRun.stderr || ''}`;
  const legacyRootMatch = /^clean-room: legacy_phase_root=(absent|present)$/m.exec(cleanOutput);
  assert('clean-room fixture exits 0', cleanRun.status === 0,
    `exit=${cleanRun.status} signal=${cleanRun.signal || 'none'}`);
  assert('clean-room fixture reports legacy phase root state', Boolean(legacyRootMatch),
    'legacy phase root state not reported');
  assert('clean-room fixture does not create legacy phase root',
    legacyRootMatch && legacyRootMatch[1] === 'absent',
    legacyRootMatch ? `state=${legacyRootMatch[1]}` : 'state not reported');

  const existingHome = path.join(tmp, 'existing-home');
  const existingProject = path.join(tmp, 'existing-project');
  const legacyRoot = path.join(existingProject, '.planning', 'phases');
  const legacyPhase = path.join(legacyRoot, '08-existing-legacy');
  const milestoneRoot = path.join(existingProject, '.planning', 'milestones', 'v9.9', 'phases');
  const milestonePhase = path.join(milestoneRoot, 'v30-07-existing-milestone');
  fs.mkdirSync(existingHome, { recursive: true });
  fs.mkdirSync(path.join(legacyPhase, 'nested'), { recursive: true });
  fs.mkdirSync(milestonePhase, { recursive: true });
  fs.writeFileSync(path.join(legacyPhase, 'sentinel.bin'), Buffer.from([0, 1, 2, 3, 255]));
  fs.writeFileSync(path.join(legacyPhase, 'nested', 'evidence.txt'), 'legacy-tree-must-survive\n', 'utf8');
  fs.writeFileSync(path.join(milestonePhase, 'sentinel.bin'), Buffer.from([255, 3, 2, 1, 0]));
  const legacyBefore = hashTree(legacyRoot);
  const milestoneBefore = hashTree(milestoneRoot);

  const existingRun = runInstall(existingProject, existingHome);
  const legacyAfter = hashTree(legacyRoot);
  const milestoneAfter = hashTree(milestoneRoot);
  assert('reinstall with existing legacy root exits 0', existingRun.status === 0,
    `exit=${existingRun.status} signal=${existingRun.signal || 'none'}`);
  assert('existing legacy tree remains byte-identical', legacyBefore === legacyAfter,
    `before=${legacyBefore} after=${legacyAfter}`);
  assert('existing milestone tree remains byte-identical', milestoneBefore === milestoneAfter,
    `before=${milestoneBefore} after=${milestoneAfter}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`assert-install-layout: ${passed} pass, ${failures.length} fail`);
  process.exit(1);
}

console.log(`assert-install-layout: ${passed} pass, 0 fail`);
