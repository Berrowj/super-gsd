#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function requireDependency(name) {
  const candidates = [
    path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
    path.resolve(__dirname, 'node_modules', name),
    name,
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(`Unable to require ${name}. Tried:\n${failures.join('\n')}`);
}

const yaml = requireDependency('js-yaml');
const profileResolver = require('./profile-resolver.cjs');
const stoplight = require('./stoplight.cjs');
const nativeReviewRunner = require('./native-review-runner.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'codex-profiles.yaml');
const STOPLIGHT_LEDGER = path.resolve(REPO_ROOT, '.planning', 'metrics', 'pro-mode-stoplight.jsonl');
const CMB_LEDGER = path.resolve(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const CODEX_CONTROL_SCRIPT = path.resolve(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-codex-control.sh');
const CODEX_CONTROL_SKILL = path.resolve(REPO_ROOT, 'super-gsd', 'skills', 'sgsd-codex-control', 'SKILL.md');

const REQUIRED_PROFILE_FIELDS = [
  'model',
  'reasoning',
  'sandbox',
  'approval',
  'requires_worktree',
  'requires_locked_plan',
  'hooks_required',
  'native_review_required',
  'allowed_write_roots',
  'max_changed_files',
];

function countJsonlRows(filePath, predicate) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter((row) => row && (!predicate || predicate(row)))
    .length;
}

function loadProfiles() {
  const parsed = yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  if (!parsed || !parsed.profiles) {
    throw new Error('codex-profiles.yaml missing profiles root');
  }
  return parsed.profiles;
}

function result(status, stdout = '', stderr = '') {
  return { status, stdout, stderr };
}

function runProfileResolver(args) {
  try {
    if (args.includes('--help')) return result(0, 'Usage');
    if (args.includes('--list')) return result(0, `${Object.keys(profileResolver.loadRegistry()).join('\n')}\n`);
    if (args.includes('--self-test-plan')) {
      return result(profileResolver.resolveProfile({ phase_type: 'plan' }).profile === 'codex.plan' ? 0 : 1);
    }
    if (args.includes('--self-test-bounded')) {
      const resolved = profileResolver.resolveProfile({ phase_type: 'execute', risk: 'low', allowed_files: ['src/x.ts'] });
      return result(resolved.profile === 'codex.execute.bounded' && resolved.requires_worktree === true && resolved.native_review_required === true ? 0 : 1);
    }
    if (args.includes('--self-test-audit')) {
      return result(profileResolver.resolveProfile({ phase_type: 'audit' }).profile === 'codex.readonly.audit' ? 0 : 1);
    }
    if (args.includes('--self-test-cli-registry')) {
      const registry = profileResolver.loadFullRegistry(REGISTRY_PATH);
      const ok = Object.keys(registry.profiles).length === 10
        && registry.cli_profiles.executor.approval === 'full-auto'
        && registry.cli_profiles.review.ephemeral === true
        && registry.cli_profiles.triage.ephemeral === false
        && profileResolver.resolveCliProfile('codex.review.native', { registryPath: REGISTRY_PATH }).profile === 'review';
      return result(ok ? 0 : 1);
    }
    if (args.includes('--self-test-cli-parity')) {
      const builtins = profileResolver.BUILTIN_CLI_PROFILES;
      const executor = profileResolver.buildExecutorResolvedCommand({
        profile: builtins.executor,
        timeout: 1200,
        promptFile: 'prompt.md',
        model: 'gpt-5.5',
        reasoning: 'xhigh',
        codexCd: 'PROJECT',
        launcher: 'direct',
      });
      const review = profileResolver.buildReviewResolvedCommand({
        profile: builtins.review,
        timeout: 30,
        promptFile: 'prompt.md',
        project: 'PROJECT',
        launcher: 'direct',
        command: 'codex',
        model: 'gpt-5.5',
        reasoning: 'xhigh',
      });
      const triage = profileResolver.buildReviewResolvedCommand({
        profile: builtins.triage,
        timeout: 30,
        promptFile: 'prompt.md',
        project: 'PROJECT',
        launcher: 'direct',
        command: 'codex',
        model: 'gpt-5.5',
        reasoning: 'xhigh',
      });
      return result(executor.includes('--full-auto') && review.includes('--ephemeral') && !triage.includes('--ephemeral') ? 0 : 1);
    }
    if (args.includes('--self-test-cli-fail-open')) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-pro-runner-'));
      const logPath = path.join(dir, 'codex-profile-resolution-log.jsonl');
      const missing = profileResolver.resolveCliProfile('executor', { registryPath: path.join(dir, 'missing.yaml'), defaultProfile: 'executor', logPath });
      const corruptPath = path.join(dir, 'corrupt.yaml');
      fs.writeFileSync(corruptPath, 'profiles: [\n  nope: : :\n', 'utf8');
      const corrupt = profileResolver.resolveCliProfile('review', { registryPath: corruptPath, defaultProfile: 'review', logPath });
      const corruptRequestedReview = profileResolver.resolveCliProfile('review', { registryPath: corruptPath, defaultProfile: 'executor', logPath });
      return result(missing.status === 'fallback'
        && corrupt.status === 'fallback'
        && corruptRequestedReview.status === 'fallback'
        && corruptRequestedReview.profile === 'review'
        && corruptRequestedReview.profile_data.sandbox === 'read-only'
        && corruptRequestedReview.profile_data.approval === 'never'
        && countJsonlRows(logPath) >= 3 ? 0 : 1);
    }
    if (args.includes('--self-test-cli-guard')) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-pro-guard-'));
      const fixture = profileResolver.showCliProfiles({ registryPath: REGISTRY_PATH }).cli_profiles;
      const registryPath = path.join(dir, 'codex-profiles.yaml');
      const logPath = path.join(dir, 'codex-profile-resolution-log.jsonl');
      fs.writeFileSync(registryPath, yaml.dump({ profiles: loadProfiles(), cli_profiles: fixture }, { lineWidth: -1, noRefs: true, sortKeys: false }), 'utf8');
      const before = fs.readFileSync(registryPath, 'utf8');
      let refusalMessage = '';
      try {
        profileResolver.setCliProfileField('triage', 'sandbox', 'danger-full-access', { registryPath, logPath });
      } catch (error) {
        refusalMessage = error.message;
      }
      const after = fs.readFileSync(registryPath, 'utf8');
      const safe = profileResolver.setCliProfileField('triage', 'ephemeral', 'true', { registryPath, logPath });
      const updated = profileResolver.loadFullRegistry(registryPath);
      return result(refusalMessage.includes('CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access') && before === after && safe.status === 'set' && updated.cli_profiles.triage.ephemeral === true ? 0 : 1);
    }
    if (args.includes('--show-cli')) {
      return result(0, JSON.stringify(profileResolver.showCliProfiles({ registryPath: REGISTRY_PATH }), null, 2));
    }
  } catch (error) {
    return result(1, '', error.message);
  }
  return result(1, '', `unsupported profile-resolver args: ${args.join(' ')}`);
}

function runStoplight(args) {
  try {
    if (args.includes('--help')) return result(0, 'Usage');
    if (args.includes('--self-test-green')) {
      const verdict = stoplight.classifyAndRecord({ locked_plan: true, allowed_files_count: 2, acceptance_command: 'npm test', risk: 'low', production_writes: false, secrets_required: false });
      return result(verdict.verdict === 'GREEN' ? 0 : 1);
    }
    if (args.includes('--self-test-amber')) {
      const verdict = stoplight.classifyAndRecord({ locked_plan: true, allowed_files_count: 18, acceptance_command: 'npm test', risk: 'medium', production_writes: false, secrets_required: false, phase_type: 'goal' });
      return result(verdict.verdict === 'AMBER' ? 0 : 1);
    }
    if (args.includes('--self-test-red')) {
      const verdict = stoplight.classifyAndRecord({ locked_plan: true, allowed_files_count: 1, acceptance_command: 'node smoke.js', risk: 'medium', production_writes: true, secrets_required: false });
      return result(verdict.verdict === 'RED' ? 0 : 1);
    }
  } catch (error) {
    return result(1, '', error.message);
  }
  return result(1, '', `unsupported stoplight args: ${args.join(' ')}`);
}

function runNativeReviewRunner(args) {
  try {
    if (args.includes('--help')) return result(0, 'Usage');
    if (args.includes('--self-test')) {
      nativeReviewRunner.runSelfTest({ phase: 110, executorReceipt: 'cmb-fixture-execution-receipt' });
      return result(0);
    }
  } catch (error) {
    return result(1, '', error.message);
  }
  return result(1, '', `unsupported native-review-runner args: ${args.join(' ')}`);
}

function runTool(script, args) {
  if (script === 'profile-resolver') return runProfileResolver(args);
  if (script === 'stoplight') return runStoplight(args);
  if (script === 'native-review-runner') return runNativeReviewRunner(args);
  return result(1, '', `unknown script ${script}`);
}

function main() {
  const assertions = [];
  const pass = (name, fn) => assertions.push({ name, fn });

  pass('profile-resolver --help exit 0', () => runTool('profile-resolver', ['--help']).status === 0);
  pass('stoplight --help exit 0', () => runTool('stoplight', ['--help']).status === 0);
  pass('native-review-runner --help exit 0', () => runTool('native-review-runner', ['--help']).status === 0);
  pass('profile-resolver --self-test-plan exit 0', () => runTool('profile-resolver', ['--self-test-plan']).status === 0);
  pass('profile-resolver --self-test-bounded exit 0', () => runTool('profile-resolver', ['--self-test-bounded']).status === 0);
  pass('profile-resolver --self-test-audit exit 0', () => runTool('profile-resolver', ['--self-test-audit']).status === 0);
  pass('profile-resolver --self-test-cli-registry exit 0', () => runTool('profile-resolver', ['--self-test-cli-registry']).status === 0);
  pass('profile-resolver --self-test-cli-parity exit 0', () => runTool('profile-resolver', ['--self-test-cli-parity']).status === 0);
  pass('profile-resolver --self-test-cli-fail-open exit 0', () => runTool('profile-resolver', ['--self-test-cli-fail-open']).status === 0);
  pass('profile-resolver --self-test-cli-guard exit 0', () => runTool('profile-resolver', ['--self-test-cli-guard']).status === 0);
  pass('profile-resolver --show-cli exposes executor/review/triage', () => {
    const res = runTool('profile-resolver', ['--show-cli']);
    return res.status === 0 && ['executor', 'review', 'triage'].every((name) => res.stdout.includes(`"${name}"`));
  });
  pass('sgsd-codex-control script and skill exist with confirmation phrase', () => (
    fs.existsSync(CODEX_CONTROL_SCRIPT)
    && fs.existsSync(CODEX_CONTROL_SKILL)
    && fs.readFileSync(CODEX_CONTROL_SCRIPT, 'utf8').includes('CONFIRM SGSD CODEX PROFILE')
    && fs.readFileSync(CODEX_CONTROL_SKILL, 'utf8').includes('--profile triage')
  ));
  pass('profile-resolver --list outputs at least 10 profile names', () => runTool('profile-resolver', ['--list']).stdout.split(/\r?\n/).filter((line) => line.trim()).length >= 10);
  pass('codex-profiles.yaml parses and contains exactly 10 profiles', () => Object.keys(loadProfiles()).length === 10);
  pass('every profile has required fields', () => {
    const profiles = loadProfiles();
    return Object.values(profiles).every((profile) => REQUIRED_PROFILE_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(profile, field)));
  });
  pass('stoplight --self-test-green exit 0', () => runTool('stoplight', ['--self-test-green']).status === 0);
  pass('stoplight --self-test-red exit 0', () => runTool('stoplight', ['--self-test-red']).status === 0);
  pass('stoplight --self-test-amber exit 0', () => runTool('stoplight', ['--self-test-amber']).status === 0);
  pass('stoplight JSONL ledger exists with at least 3 rows', () => fs.existsSync(STOPLIGHT_LEDGER) && countJsonlRows(STOPLIGHT_LEDGER) >= 3);
  pass('native-review-runner --self-test exit 0', () => runTool('native-review-runner', ['--self-test', '--phase', '110', '--executor-receipt', 'cmb-fixture-execution-receipt']).status === 0);
  pass('mesh-memory ledger has at least 2 Codex native review findings', () => countJsonlRows(CMB_LEDGER, (row) => (
    row.type === 'review_finding'
    && row.role === 'reviewer'
    && typeof row.created_by === 'string'
    && row.created_by.includes('codex-review-native')
  )) >= 2);

  let passed = 0;
  const failures = [];

  for (const assertion of assertions) {
    try {
      if (assertion.fn()) {
        passed += 1;
      } else {
        failures.push(assertion.name);
      }
    } catch (error) {
      failures.push(`${assertion.name}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`[codex-pro self-test] ${passed}/${assertions.length} passed\n`);
    for (const failure of failures) {
      process.stderr.write(`FAIL: ${failure}\n`);
    }
    return 1;
  }

  process.stdout.write(`[codex-pro self-test] ${passed}/${assertions.length} passed\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}
