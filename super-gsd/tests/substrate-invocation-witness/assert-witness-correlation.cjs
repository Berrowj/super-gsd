#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const COMPOSER_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'vtp-context-composer.cjs');
const STORE_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');
const STATE_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'sgsd-state.cjs');
const V2_SCHEMA_PATH = path.join(REPO_ROOT, 'super-gsd', 'schemas', 'vtp-mcp-input-schemas.v2.json');
const PLAN_SCHEMA_NODE_MODULES_PATH = path.join(REPO_ROOT, 'super-gsd', 'tools', 'plan-schema', 'node_modules');
const HOOK_PATH = path.join(REPO_ROOT, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
const TMP_PARENT = path.join(REPO_ROOT, '.planning', 'tmp');
const TARGET_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const PRE_HOOK_ID = 'pre-tool-use-substrate-invocation-witness';
const POST_HOOK_ID = 'post-tool-use-substrate-invocation-witness';

const composer = require(COMPOSER_PATH);
const store = require(STORE_PATH);
const hook = require(HOOK_PATH);

const tests = [];
let fixture;

function test(name, fn) {
  tests.push({ name, fn });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function installHookSource(projectRoot) {
  const target = path.join(projectRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
  mkdir(path.dirname(target));
  fs.linkSync(HOOK_PATH, target);
  return target;
}

function installRuntimeSources(projectRoot) {
  const sources = [COMPOSER_PATH, STORE_PATH, STATE_PATH, V2_SCHEMA_PATH];
  for (const source of sources) {
    const relative = path.relative(path.join(REPO_ROOT, 'super-gsd'), source);
    const target = path.join(projectRoot, 'super-gsd', relative);
    mkdir(path.dirname(target));
    fs.linkSync(source, target);
  }

  const nodeModulesTarget = path.join(projectRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules');
  mkdir(path.dirname(nodeModulesTarget));
  fs.symlinkSync(PLAN_SCHEMA_NODE_MODULES_PATH, nodeModulesTarget, 'junction');
}

function hookRegistration(event, hookId, projectRoot, sourceDigest) {
  return {
    sgsd_managed: true,
    sgsd_hook_id: hookId,
    sgsd_source_sha256: sourceDigest,
    matcher: TARGET_TOOL,
    hooks: [{
      type: 'command',
      command: 'node',
      args: [
        path.join(projectRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs'),
        '--event',
        event,
      ],
      timeout: 5,
    }],
  };
}

function createProject(name, env) {
  const project = path.join(fixture.root, name);
  mkdir(path.join(project, '.planning', 'metrics'));
  fs.writeFileSync(path.join(project, '.planning', 'STATE.md'), '---\nmilestone: fixture\ncurrent_phase: 167\n---\n', 'utf8');
  mkdir(path.join(project, 'super-gsd'));
  installRuntimeSources(project);
  const installedHook = installHookSource(project);
  const sourceDigest = sha256(fs.readFileSync(installedHook));
  const settings = {
    hooks: {
      PreToolUse: [hookRegistration('PreToolUse', PRE_HOOK_ID, project, sourceDigest)],
      PostToolUse: [hookRegistration('PostToolUse', POST_HOOK_ID, project, sourceDigest)],
    },
  };
  mkdir(path.join(project, '.claude'));
  fs.writeFileSync(
    path.join(project, '.claude', 'settings.json'),
    JSON.stringify(settings, null, 2) + '\n',
    'utf8',
  );
  store.provisionWitnessKey(project, env);
  assert.strictEqual(store.inspectWitnessReadiness(project, env).ready, true);
  return project;
}

function createFixture() {
  mkdir(TMP_PARENT);
  const root = fs.mkdtempSync(path.join(TMP_PARENT, 'p167-t2-'));
  const profile = path.join(root, 'profile');
  mkdir(profile);
  const env = {
    ...process.env,
    HOME: profile,
    USERPROFILE: profile,
    APPDATA: path.join(profile, 'AppData', 'Roaming'),
    XDG_CONFIG_HOME: path.join(profile, '.config'),
  };
  fixture = { root, profile, env };
  fixture.project = createProject('project-a', env);
  fixture.otherProject = createProject('project-b', env);
  return fixture;
}

function prepared(query, intent = 'planning') {
  return composer.prepareSubstrateCall(intent, { query });
}

function recordFor(envelope) {
  return JSON.parse(JSON.stringify(envelope));
}

function hookPayload(event, projectRoot, envelope, sessionId, toolUseId) {
  return {
    hook_event_name: event,
    tool_name: TARGET_TOOL,
    session_id: sessionId,
    tool_use_id: toolUseId,
    cwd: projectRoot,
    tool_input: envelope.payload,
    ...(event === 'PostToolUse' ? {
      tool_response: {
        content: [{ type: 'text', text: JSON.stringify({ hits: [{ text: 'bounded' }] }) }],
        isError: false,
      },
    } : {}),
  };
}

function seedPre(envelope, options = {}) {
  const projectRoot = options.projectRoot || fixture.project;
  const sessionId = options.sessionId || 'session-' + options.id;
  const toolUseId = options.toolUseId || 'tool-use-' + options.id;
  const payload = hookPayload('PreToolUse', projectRoot, envelope, sessionId, toolUseId);
  const result = hook.processHookPayload(payload, {
    env: fixture.env,
    expectedEvent: 'PreToolUse',
  });
  assert.strictEqual(result.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.strictEqual(result.hookSpecificOutput.permissionDecision, 'allow');
  return payload;
}

function rewrite(prePayload) {
  const payload = {
    ...prePayload,
    hook_event_name: 'PostToolUse',
    tool_response: {
      content: [{ type: 'text', text: JSON.stringify({ hits: [{ text: 'bounded' }] }) }],
      isError: false,
    },
  };
  const result = hook.processHookPayload(payload, {
    env: fixture.env,
    expectedEvent: 'PostToolUse',
  });
  assert.strictEqual(result.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert(result.hookSpecificOutput.updatedMCPToolOutput);
  return result;
}

function seedRewritten(envelope, options = {}) {
  const prePayload = seedPre(envelope, options);
  rewrite(prePayload);
  return prePayload;
}

function withRuntimeAuthority(options, fn) {
  const projectRoot = options.projectRoot || fixture.project;
  const previousCwd = process.cwd();
  const keys = ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME', 'CLAUDE_CODE_SESSION_ID'];
  const previous = new Map(keys.map((key) => [
    key,
    { present: Object.prototype.hasOwnProperty.call(process.env, key), value: process.env[key] },
  ]));
  process.chdir(projectRoot);
  for (const key of keys.slice(0, 4)) process.env[key] = fixture.env[key];
  if (options.sessionId === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
  else process.env.CLAUDE_CODE_SESSION_ID = String(options.sessionId);
  try {
    return fn();
  } finally {
    process.chdir(previousCwd);
    for (const [key, state] of previous) {
      if (state.present) process.env[key] = state.value;
      else delete process.env[key];
    }
  }
}

function accept(envelope, options = {}) {
  return withRuntimeAuthority(options, () => composer.acceptPromptSubstrateCallRecord(
    options.intent || 'planning',
    options.preparedCall === undefined ? envelope : options.preparedCall,
    options.record === undefined ? recordFor(envelope) : options.record,
  ));
}

function spoolFiles(projectRoot = fixture.project) {
  const spool = store.resolveWitnessPaths(projectRoot, fixture.env).spool_dir;
  if (!fs.existsSync(spool)) return [];
  return fs.readdirSync(spool)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(spool, name));
}

function forgedPreparedCall(intent, payload) {
  return {
    tool: TARGET_TOOL,
    payload,
    gateway_evidence: {
      schema_version: 'vtp-mcp-input-schemas.v2',
      intent_family: intent,
      payload_sha256: composer.substratePayloadDigest(payload),
    },
  };
}

test('accepts a matching rewritten witness and returns no hook-only identifier', () => {
  const envelope = prepared('P167 valid rewritten witness');
  const sessionId = 'session-valid';
  seedRewritten(envelope, { id: 'valid', sessionId });
  assert.deepStrictEqual(accept(envelope, { sessionId }), {
    ok: true,
    intent_family: 'planning',
    payload_sha256: composer.substratePayloadDigest(envelope.payload),
    witness_status: 'consumed',
  });
});

test('rejects a clean record when no witness exists', () => {
  const envelope = prepared('P167 missing witness row');
  assert.throws(
    () => accept(envelope, { sessionId: 'session-missing' }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_missing/,
  );
});

test('rejects a pre-only witness', () => {
  const envelope = prepared('P167 pre only witness');
  const sessionId = 'session-pre-only';
  seedPre(envelope, { id: 'pre-only', sessionId });
  assert.throws(
    () => accept(envelope, { sessionId }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_not_rewritten/,
  );
});

test('rejects an expired rewritten witness', () => {
  const envelope = prepared('P167 expired witness');
  const sessionId = 'session-expired';
  const originalNow = Date.now;
  const expiredNow = originalNow() - store.WITNESS_TTL_MS - 1000;
  try {
    Date.now = () => expiredNow;
    seedRewritten(envelope, { id: 'expired', sessionId });
  } finally {
    Date.now = originalNow;
  }
  assert.throws(
    () => accept(envelope, { sessionId }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_expired/,
  );
});

test('rejects an HMAC-edited rewritten witness', () => {
  const envelope = prepared('P167 edited witness');
  const sessionId = 'session-edited';
  const before = new Set(spoolFiles());
  seedRewritten(envelope, { id: 'edited', sessionId });
  const created = spoolFiles().filter((file) => !before.has(file));
  assert.strictEqual(created.length, 1);
  const row = JSON.parse(fs.readFileSync(created[0], 'utf8'));
  row.rewrite.retained_chars += 1;
  fs.writeFileSync(created[0], JSON.stringify(row) + '\n', 'utf8');
  assert.throws(
    () => accept(envelope, { sessionId }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_invalid/,
  );
});

test('rejects a witness from a different runtime session', () => {
  const envelope = prepared('P167 wrong session witness');
  seedRewritten(envelope, { id: 'wrong-session', sessionId: 'session-producer' });
  assert.throws(
    () => accept(envelope, { sessionId: 'session-consumer' }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_session_mismatch/,
  );
});

test('rejects a witness from a different project', () => {
  const envelope = prepared('P167 wrong project witness');
  const sessionId = 'session-wrong-project';
  seedRewritten(envelope, { id: 'wrong-project', sessionId });
  assert.throws(
    () => accept(envelope, { projectRoot: fixture.otherProject, sessionId }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_missing/,
  );
});

test('rejects a witness for a different hook-computed payload digest', () => {
  const witnessed = prepared('P167 witnessed digest payload');
  const submitted = prepared('P167 different submitted payload');
  const sessionId = 'session-wrong-digest';
  seedRewritten(witnessed, { id: 'wrong-digest', sessionId });
  assert.throws(
    () => accept(submitted, { sessionId }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_digest_mismatch/,
  );
});

test('consumes two identical sequential calls once each', () => {
  const envelope = prepared('P167 identical sequential payload');
  const sessionId = 'session-identical';
  seedRewritten(envelope, { id: 'identical-one', sessionId });
  seedRewritten(envelope, { id: 'identical-two', sessionId });
  assert.strictEqual(accept(envelope, { sessionId }).witness_status, 'consumed');
  assert.strictEqual(accept(envelope, { sessionId }).witness_status, 'consumed');
  assert.throws(
    () => accept(envelope, { sessionId }),
    /vtp_prompt_substrate_contract_invalid:substrate_witness_replayed/,
  );
});

test('rejects agent-supplied correlation fields without consuming the witness', () => {
  const envelope = prepared('P167 invented correlation identifiers');
  const sessionId = 'session-invented-identifiers';
  seedRewritten(envelope, { id: 'invented-identifiers', sessionId });
  for (const field of [
    'tool_use_id',
    'tool_use_sha256',
    'witness_id',
    'witness_path',
    'signature',
    'nonce',
    'sequence',
    'session_id',
    'session_sha256',
    'payload_digest',
    'project_digest',
  ]) {
    assert.throws(
      () => accept(envelope, { sessionId, record: { ...recordFor(envelope), [field]: 'invented' } }),
      /vtp_prompt_substrate_contract_invalid:record_correlation_identifier_forbidden/,
      field,
    );
  }
  assert.throws(
    () => accept(envelope, {
      sessionId,
      record: { ...recordFor(envelope), correlation: { witnessId: 'invented' } },
    }),
    /vtp_prompt_substrate_contract_invalid:record_correlation_identifier_forbidden/,
  );
  assert.strictEqual(accept(envelope, { sessionId }).ok, true);
});

test('preserves P166 rejection order and does not consume on forged records', () => {
  const envelope = prepared('P167 P166 rejection preservation');
  const other = prepared('P167 mismatched prepared record');
  const sessionId = 'session-p166-preserved';
  seedRewritten(envelope, { id: 'p166-preserved', sessionId });

  assert.throws(
    () => accept(envelope, {
      sessionId,
      record: { tool: envelope.tool, payload: envelope.payload },
    }),
    /gateway_evidence_missing/,
  );

  const invalidPayload = {
    ...envelope.payload,
    source_types: [],
  };
  assert.throws(
    () => accept(envelope, {
      sessionId,
      record: forgedPreparedCall('planning', invalidPayload),
    }),
    /substrate_call_record_invalid/,
  );

  assert.throws(
    () => accept(envelope, { sessionId, record: recordFor(other) }),
    /record_prepared_call_mismatch/,
  );

  const limitSix = forgedPreparedCall('planning', {
    ...envelope.payload,
    limit: 6,
  });
  assert.throws(
    () => accept(limitSix, { sessionId }),
    /prepared_call_missing_or_invalid/,
  );

  assert.strictEqual(accept(envelope, { sessionId }).ok, true);
});

test('CLI inherits runtime session and emits accepted JSON only after consumption', () => {
  const envelope = prepared('P167 CLI runtime session witness');
  const sessionId = 'session-cli';
  const prePayload = seedPre(envelope, { id: 'cli', sessionId });
  const passthrough = hook.processHookPayload({
    ...prePayload,
    hook_event_name: 'PostToolUse',
    tool_response: [{ type: 'text', text: 'upstream status text' }],
  }, {
    env: fixture.env,
    expectedEvent: 'PostToolUse',
  });
  assert.strictEqual(passthrough, null);
  const inputDir = path.join(fixture.project, '.planning', 'tmp');
  mkdir(inputDir);
  const preparedPath = path.join(inputDir, 'prepared.json');
  const recordPath = path.join(inputDir, 'record.json');
  fs.writeFileSync(preparedPath, JSON.stringify(envelope) + '\n', 'utf8');
  fs.writeFileSync(recordPath, JSON.stringify(recordFor(envelope)) + '\n', 'utf8');
  const args = [
    COMPOSER_PATH,
    '--accept-substrate-call-record',
    '--intent',
    'planning',
    '--prepared-call-file',
    path.relative(fixture.project, preparedPath),
    '--record-file',
    path.relative(fixture.project, recordPath),
  ];
  const env = { ...fixture.env, CLAUDE_CODE_SESSION_ID: sessionId };
  const accepted = childProcess.spawnSync(process.execPath, args, {
    cwd: fixture.project,
    env,
    encoding: 'utf8',
  });
  assert.strictEqual(accepted.status, 0, accepted.stderr);
  assert.deepStrictEqual(JSON.parse(accepted.stdout), {
    ok: true,
    intent_family: 'planning',
    payload_sha256: composer.substratePayloadDigest(envelope.payload),
    witness_status: 'consumed',
  });

  const replayed = childProcess.spawnSync(process.execPath, args, {
    cwd: fixture.project,
    env,
    encoding: 'utf8',
  });
  assert.notStrictEqual(replayed.status, 0);
  assert.strictEqual(replayed.stdout, '');
  assert.match(replayed.stderr, /substrate_witness_replayed/);
});

function main() {
  fixture = createFixture();
  let passed = 0;
  try {
    for (const entry of tests) {
      try {
        entry.fn();
        passed += 1;
        process.stdout.write('PASS ' + entry.name + '\n');
      } catch (error) {
        process.stderr.write('FAIL ' + entry.name + ': ' + (error.stack || error.message) + '\n');
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
  process.stdout.write('PASS assert-witness-correlation ' + passed + '/' + tests.length + '\n');
}

main();
