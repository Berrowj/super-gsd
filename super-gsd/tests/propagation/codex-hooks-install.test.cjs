const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ROOT_HOOKS = path.join(REPO_ROOT, '.codex', 'hooks.json');
const TEMPLATE = path.join(REPO_ROOT, 'super-gsd', 'config', 'codex-hooks.json');
const INSTALLER = path.join(REPO_ROOT, 'super-gsd', 'tools', 'codex-hooks', 'install-hooks.cjs');
const SELF_TEST = path.join(REPO_ROOT, 'super-gsd', 'tools', 'codex-hooks', 'self-test.cjs');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixture() {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-hooks-install-'));
  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  return project;
}

function cleanup(project) {
  fs.rmSync(project, { recursive: true, force: true, maxRetries: 3 });
}

function invoke(project, options = {}) {
  const { installHooks } = require(INSTALLER);
  return installHooks({ projectDir: project, ...options });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonical() {
  return readJson(TEMPLATE);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('canonical install template is the root SGSD hook set', () => {
  assert.deepEqual(readJson(TEMPLATE), readJson(ROOT_HOOKS));
});

test('installer creates a missing project hook file with every managed registration', () => {
  const project = fixture();
  try {
    const result = invoke(project);
    assert.deepEqual(readJson(path.join(project, '.codex', 'hooks.json')), canonical());
    assert.deepEqual(result, {
      ok: true,
      changed: true,
      status: 'installed',
      target: path.join(project, '.codex', 'hooks.json'),
      managed_registrations: 5,
    });
  } finally {
    cleanup(project);
  }
});

test('safe merge preserves unknown fields and non-SGSD order while repairing and deduplicating managed hooks', () => {
  const project = fixture();
  const targetPath = path.join(project, '.codex', 'hooks.json');
  const customMatcher = {
    matcher: 'custom-tool',
    label: 'operator matcher',
    hooks: [{ type: 'command', command: 'node operator/custom-hook.cjs', timeout: 7 }],
  };
  const unknownEvent = [{ matcher: '*', hooks: [{ type: 'command', command: 'node operator/session.cjs' }] }];
  const target = {
    version: 9,
    operator: { theme: 'plum' },
    hooks: {
      UserPromptSubmit: [
        customMatcher,
        {
          matcher: '*',
          group_note: 'keep me',
          hooks: [
            { type: 'command', command: 'node operator/before.cjs', custom: true },
            {
              type: 'command',
              command: 'node ./super-gsd/tools/codex-hooks/block-secret-leak.cjs --old-flag',
              operator_note: 'keep this field',
            },
            { type: 'command', command: 'node super-gsd/tools/codex-hooks/block-secret-leak.cjs' },
            { type: 'command', command: 'node operator/after.cjs' },
          ],
        },
      ],
      CustomEvent: unknownEvent,
    },
  };
  writeJson(targetPath, target);

  try {
    const result = invoke(project);
    assert.equal(result.ok, true);
    const merged = readJson(targetPath);

    assert.equal(merged.version, 9);
    assert.deepEqual(merged.operator, { theme: 'plum' });
    assert.deepEqual(merged.hooks.CustomEvent, unknownEvent);
    assert.deepEqual(merged.hooks.UserPromptSubmit[0], customMatcher);

    const managedGroup = merged.hooks.UserPromptSubmit[1];
    assert.equal(managedGroup.group_note, 'keep me');
    assert.deepEqual(
      managedGroup.hooks.map((hook) => hook.command),
      [
        'node operator/before.cjs',
        'node super-gsd/tools/codex-hooks/block-secret-leak.cjs',
        'node operator/after.cjs',
      ],
    );
    assert.equal(managedGroup.hooks[1].operator_note, 'keep this field');
    assert.equal(merged.hooks.PreToolUse[0].hooks.length, 2);
    assert.equal(merged.hooks.PostToolUse[0].hooks.length, 1);
    assert.equal(merged.hooks.Stop[0].hooks.length, 1);
  } finally {
    cleanup(project);
  }
});

test('second identical invocation is a byte-preserving no-op', () => {
  const project = fixture();
  const targetPath = path.join(project, '.codex', 'hooks.json');
  try {
    assert.equal(invoke(project).ok, true);
    const before = fs.readFileSync(targetPath);
    const beforeStat = fs.statSync(targetPath, { bigint: true });

    const result = invoke(project);

    assert.equal(result.ok, true);
    assert.deepEqual(fs.readFileSync(targetPath), before);
    assert.equal(fs.statSync(targetPath, { bigint: true }).mtimeNs, beforeStat.mtimeNs);
    assert.equal(result.status, 'unchanged');
    assert.equal(result.changed, false);
  } finally {
    cleanup(project);
  }
});

test('malformed target is preserved byte-for-byte and copied to the reported error backup', () => {
  const project = fixture();
  const targetPath = path.join(project, '.codex', 'hooks.json');
  const malformed = Buffer.from('{hooks: [not-json]\r\n', 'utf8');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, malformed);

  try {
    let caught;
    assert.throws(() => invoke(project), (error) => {
      caught = error;
      return true;
    });
    assert.deepEqual(fs.readFileSync(targetPath), malformed);
    assert.match(caught.message, new RegExp(escapeRegExp(targetPath)));
    assert(caught.backupPath);
    assert.deepEqual(fs.readFileSync(caught.backupPath), malformed);
  } finally {
    cleanup(project);
  }
});

test('invalid canonical template never changes an existing target', () => {
  const project = fixture();
  const targetPath = path.join(project, '.codex', 'hooks.json');
  const invalidTemplate = path.join(project, 'invalid-template.json');
  writeJson(targetPath, { operator: true, hooks: {} });
  fs.writeFileSync(invalidTemplate, '{bad template', 'utf8');
  const before = fs.readFileSync(targetPath);

  try {
    assert.throws(
      () => invoke(project, { templatePath: invalidTemplate }),
      new RegExp(escapeRegExp(invalidTemplate)),
    );
    assert.deepEqual(fs.readFileSync(targetPath), before);
  } finally {
    cleanup(project);
  }
});

test('atomic rename failure preserves the target and emits a backup path', () => {
  const project = fixture();
  const targetPath = path.join(project, '.codex', 'hooks.json');
  writeJson(targetPath, { operator: true, hooks: {} });
  const before = fs.readFileSync(targetPath);

  try {
    const { installHooks } = require(INSTALLER);
    assert.throws(
      () => installHooks({
        projectDir: project,
        renameFile() {
          throw new Error('simulated atomic rename failure');
        },
      }),
      (error) => {
        assert.match(error.message, /atomic rename failure/);
        assert(error.backupPath);
        assert.deepEqual(fs.readFileSync(error.backupPath), before);
        return true;
      },
    );
    assert.deepEqual(fs.readFileSync(targetPath), before);
    const siblingNames = fs.readdirSync(path.dirname(targetPath));
    assert.equal(siblingNames.some((name) => name.includes('.tmp-')), false);
    assert.equal(siblingNames.filter((name) => name.includes('.sgsd-error-')).length, 1);
  } finally {
    cleanup(project);
  }
});

test('managed-registration inspection distinguishes missing, stale, duplicate, and current targets', () => {
  const project = fixture();
  const targetPath = path.join(project, '.codex', 'hooks.json');
  try {
    const { inspectProject } = require(INSTALLER);

    const missing = inspectProject({ projectDir: project });
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 'missing');
    assert.equal(missing.missing.length, 5);

    const staleTarget = canonical();
    staleTarget.hooks.Stop[0].hooks[0].command += ' --stale';
    staleTarget.hooks.PreToolUse[0].hooks.push({
      ...staleTarget.hooks.PreToolUse[0].hooks[0],
    });
    writeJson(targetPath, staleTarget);
    const stale = inspectProject({ projectDir: project });
    assert.equal(stale.ok, false);
    assert.equal(stale.status, 'stale');
    assert.equal(stale.stale.length, 1);
    assert.equal(stale.duplicates.length, 1);

    assert.equal(invoke(project).ok, true);
    const current = inspectProject({ projectDir: project });
    assert.equal(current.ok, true);
    assert.equal(current.status, 'current');
    assert.equal(current.managed_registrations, 5);
  } finally {
    cleanup(project);
  }
});

test('install, onboarding, readiness, and propagation audit expose the Codex hook path', () => {
  const installSource = fs.readFileSync(path.join(REPO_ROOT, 'super-gsd', 'install.sh'), 'utf8');
  const onboardSource = fs.readFileSync(path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-onboard.ps1'), 'utf8');
  const readinessSource = fs.readFileSync(path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'sgsd-readiness.ps1'), 'utf8');
  const audit = require(path.join(REPO_ROOT, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs'));

  assert.match(installSource, /install-hooks\.cjs/);
  assert.match(installSource, /init_local_project[\s\S]*register_codex_hooks/);
  assert.match(installSource, /update_existing[\s\S]*register_codex_hooks/);
  assert.match(onboardSource, /[']codex-hooks[']/);
  assert.match(onboardSource, /install-hooks\.cjs/);
  assert.match(readinessSource, /[']codex-hooks[']/);

  const project = fixture();
  try {
    const missing = audit.runAudit({ projectDir: project });
    assert.equal(missing.codex_hooks.ok, false);
    assert(missing.issues.includes('project_codex_hooks_missing_or_stale'));
    assert.equal(invoke(project).ok, true);
    const current = audit.runAudit({ projectDir: project });
    assert.equal(current.codex_hooks.ok, true);
    assert.equal(current.summary.codex_hook_issues, 0);
  } finally {
    cleanup(project);
  }
});

test('real-hook self-test is JSON-reporting and leaves source-project evidence unchanged', () => {
  const sourceEvidence = path.join(REPO_ROOT, '.planning', 'metrics', 'codex-tool-events.jsonl');
  const before = fs.existsSync(sourceEvidence) ? fs.readFileSync(sourceEvidence) : null;
  const { runSelfTest } = require(SELF_TEST);
  const report = runSelfTest({ projectDir: REPO_ROOT });
  assert.equal(report.ok, true);
  for (const name of [
    'forbidden_path_blocks',
    'allowed_path_not_forbidden',
    'secret_leak_callable',
    'stop_contract_callable',
    'evidence_isolated',
  ]) {
    assert.equal(report.checks.find((check) => check.name === name).ok, true, name);
  }
  const after = fs.existsSync(sourceEvidence) ? fs.readFileSync(sourceEvidence) : null;
  assert.deepEqual(after, before);
});
