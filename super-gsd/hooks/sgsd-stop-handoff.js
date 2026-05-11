#!/usr/bin/env node
/*
 * Super GSD Stop handoff launcher.
 *
 * Claude Code runs hook commands through the host shell. On Windows, plain
 * `bash` can resolve to WSL before Git Bash, and WSL cannot execute C:/...
 * paths. This launcher pins Git Bash on Windows, falls back to bash elsewhere,
 * and keeps Stop hooks non-blocking when the local install is incomplete.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const scriptArgs = args.filter(arg => arg !== '--self-test');

function homePath(...parts) {
  return path.join(os.homedir(), ...parts);
}

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function executableCandidates() {
  const candidates = [];
  if (process.env.SGSD_BASH) candidates.push(process.env.SGSD_BASH);

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(localAppData, 'Programs', 'Git', 'usr', 'bin', 'bash.exe'),
      path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'),
      path.join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
      path.join(programFiles, 'Git', 'bin', 'bash.exe'),
      path.join(programFilesX86, 'Git', 'usr', 'bin', 'bash.exe'),
      path.join(programFilesX86, 'Git', 'bin', 'bash.exe')
    );
  }

  if (process.platform !== 'win32') {
    candidates.push('bash');
  }
  return candidates;
}

function findBash() {
  for (const candidate of executableCandidates()) {
    if (candidate === 'bash' || exists(candidate)) return candidate;
  }
  return null;
}

function findScript() {
  const candidates = [];
  if (process.env.SGSD_ROOT) {
    candidates.push(path.join(process.env.SGSD_ROOT, 'scripts', 'sgsd-stop-handoff.sh'));
  }

  candidates.push(
    homePath('.claude', 'super-gsd', 'scripts', 'sgsd-stop-handoff.sh'),
    path.join(process.cwd(), 'super-gsd', 'scripts', 'sgsd-stop-handoff.sh')
  );

  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

function warn(message) {
  process.stderr.write(`[sgsd-stop-handoff] ${message}\n`);
}

const bash = findBash();
const script = findScript();

if (selfTest) {
  if (!bash) {
    warn('self-test failed: bash not found');
    process.exit(1);
  }
  if (!script) {
    warn('self-test failed: sgsd-stop-handoff.sh not found');
    process.exit(1);
  }
  process.stdout.write(`sgsd-stop-handoff launcher self-test: bash=${bash} script=${script}\n`);
  process.exit(0);
}

if (!bash || !script) {
  if (!bash) warn('bash not found; handoff skipped');
  if (!script) warn('sgsd-stop-handoff.sh not found; handoff skipped');
  process.exit(0);
}

const result = spawnSync(bash, [script, ...scriptArgs], {
  cwd: process.cwd(),
  env: process.env,
  encoding: 'utf8',
  timeout: 55000
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  warn(`handoff launcher skipped after ${result.error.message}`);
}

// Stop hooks are recovery plumbing. Never let a launcher/runtime failure make
// Claude Code surface a blocking hook error to the operator.
process.exit(0);
