#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { inspectProject } = require('./install-hooks.cjs');

const REQUIRED_SCRIPTS = Object.freeze([
  'block-forbidden-write.cjs',
  'block-secret-leak.cjs',
  'validate-stop-contract.cjs',
]);

function executeHook(scriptPath, payload) {
  const original = fs.readFileSync(scriptPath, 'utf8');
  const source = original.replace(/^#![^\r\n]*(?:\r?\n|$)/, '');
  const stdout = [];
  const stderr = [];
  const sandboxFs = Object.assign({}, fs, {
    readFileSync(target, ...args) {
      if (target === 0) return JSON.stringify(payload);
      return fs.readFileSync(target, ...args);
    },
  });
  const localRequire = createRequire(scriptPath);
  const sandboxProcess = {
    argv: [process.execPath, scriptPath],
    env: { ...process.env },
    pid: process.pid,
    exitCode: undefined,
  };
  const context = {
    Buffer,
    Date,
    JSON,
    Object,
    RegExp,
    String,
    console: {
      log(...args) { stdout.push(args.join(' ')); },
      error(...args) { stderr.push(args.join(' ')); },
    },
    exports: {},
    module: { exports: {} },
    __dirname: path.dirname(scriptPath),
    __filename: scriptPath,
    process: sandboxProcess,
    require(specifier) {
      if (specifier === 'fs' || specifier === 'node:fs') return sandboxFs;
      return localRequire(specifier);
    },
  };
  vm.runInNewContext(source, context, { filename: scriptPath, timeout: 10_000 });
  return {
    status: Number.isInteger(sandboxProcess.exitCode) ? sandboxProcess.exitCode : 0,
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}

function readEvidence(evidencePath) {
  if (!fs.existsSync(evidencePath)) return [];
  return fs.readFileSync(evidencePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function runSelfTest(options = {}) {
  const projectDir = path.resolve(options.projectDir || process.cwd());
  const configCheck = inspectProject({ projectDir });
  const sourceHooksDir = path.join(projectDir, 'super-gsd', 'tools', 'codex-hooks');
  const fixtureProject = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-hooks-self-test-'));
  const fixtureHooksDir = path.join(fixtureProject, 'super-gsd', 'tools', 'codex-hooks');
  const evidencePath = path.join(fixtureProject, '.planning', 'metrics', 'codex-tool-events.jsonl');
  const sourceEvidencePath = path.join(projectDir, '.planning', 'metrics', 'codex-tool-events.jsonl');
  const sourceEvidenceBefore = fs.existsSync(sourceEvidencePath) ? fs.readFileSync(sourceEvidencePath) : null;
  const checks = [];
  function check(name, ok, detail = '') {
    checks.push({ name, ok: Boolean(ok), detail });
  }

  try {
    fs.mkdirSync(fixtureHooksDir, { recursive: true });
    for (const name of REQUIRED_SCRIPTS) {
      const source = path.join(sourceHooksDir, name);
      const target = path.join(fixtureHooksDir, name);
      fs.copyFileSync(source, target);
      check(`real_script_${name}`, fs.readFileSync(source).equals(fs.readFileSync(target)), target);
    }

    const forbidden = executeHook(
      path.join(fixtureHooksDir, 'block-forbidden-write.cjs'),
      { tool: 'apply_patch', args: { path: 'secrets/self-test.env' } },
    );
    let rows = readEvidence(evidencePath);
    check('forbidden_path_blocks', forbidden.status === 1
      && rows.some((row) => row.hook === 'block-forbidden-write'
        && row.decision === 'block'
        && row.reason === 'forbidden_path'), forbidden.stderr);

    const allowed = executeHook(
      path.join(fixtureHooksDir, 'block-forbidden-write.cjs'),
      { tool: 'apply_patch', args: { path: 'tmp/self-test.txt' } },
    );
    rows = readEvidence(evidencePath);
    check('allowed_path_not_forbidden', allowed.status === 0
      && rows.some((row) => row.hook === 'block-forbidden-write'
        && row.decision === 'allow'
        && row.reason === 'path_not_forbidden'), allowed.stderr);

    const secret = executeHook(
      path.join(fixtureHooksDir, 'block-secret-leak.cjs'),
      { prompt: 'Summarize the safe fixture without credentials.' },
    );
    rows = readEvidence(evidencePath);
    check('secret_leak_callable', secret.status === 0
      && rows.some((row) => row.hook === 'block-secret-leak'
        && row.decision === 'allow'), secret.stderr);

    const reportPath = path.join(fixtureProject, 'safe-stop-report.md');
    fs.writeFileSync(reportPath, '# Safe fixture report\n', 'utf8');
    const stop = executeHook(
      path.join(fixtureHooksDir, 'validate-stop-contract.cjs'),
      {
        phase: 'fixture',
        plan: 'fixture',
        report_path: reportPath,
        checkpoint_updated: true,
        acceptance_commands_reported: true,
      },
    );
    rows = readEvidence(evidencePath);
    check('stop_contract_callable', stop.status === 0
      && rows.some((row) => row.hook === 'validate-stop-contract'
        && row.decision === 'allow'), stop.stderr);

    const sourceEvidenceAfter = fs.existsSync(sourceEvidencePath) ? fs.readFileSync(sourceEvidencePath) : null;
    check('evidence_isolated', rows.length >= 4
      && ((sourceEvidenceBefore === null && sourceEvidenceAfter === null)
        || (sourceEvidenceBefore !== null && sourceEvidenceAfter !== null
          && sourceEvidenceBefore.equals(sourceEvidenceAfter))), evidencePath);
    check('managed_registrations_current', configCheck.ok, configCheck.status);
  } catch (error) {
    check('self_test_error', false, error.message);
  } finally {
    fs.rmSync(fixtureProject, { recursive: true, force: true, maxRetries: 3 });
  }

  return {
    ok: checks.every((entry) => entry.ok),
    project: projectDir,
    checks,
  };
}

function argValue(args, name) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) return args[index + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function main(argv) {
  const args = argv.slice(2);
  const report = runSelfTest({ projectDir: argValue(args, '--project') || process.cwd() });
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const entry of report.checks) {
      process.stdout.write(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.detail ? ` ${entry.detail}` : ''}\n`);
    }
  }
  return report.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv);

module.exports = { runSelfTest, _internals: { executeHook, readEvidence } };
