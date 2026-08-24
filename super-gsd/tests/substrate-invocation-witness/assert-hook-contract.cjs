'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { PassThrough, Writable } = require('stream');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
const BROKER_PATH = path.join(REPO_ROOT, 'super-gsd', 'tools', 'substrate-capability-broker.cjs');
const STORE_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');
const COMPOSER_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'vtp-context-composer.cjs');
const TMP_PARENT = path.join(REPO_ROOT, '.planning', 'tmp');

const TARGET_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const SHORT_TOOL = 'vtp_search_substrate';
const PRE_HOOK_ID = 'pre-tool-use-substrate-invocation-witness';
const POST_HOOK_ID = 'post-tool-use-substrate-invocation-witness';
const HOOK_TIMEOUT_SECONDS = 5;
const TAIL_MARKER = 'Z';
const NESTED_TAIL_MARKER = 'Y';

let hook;
let brokerModule;
let store;
let composer;
let fixture;

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sourceDigest(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function linkDirectory(target, linkPath) {
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function installHookSource(projectRoot) {
  const installedPath = path.join(projectRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
  mkdir(path.dirname(installedPath));
  try { fs.unlinkSync(installedPath); } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  fs.linkSync(HOOK_PATH, installedPath);
  return installedPath;
}

function registration(event, hookId, projectRoot, digest) {
  return {
    sgsd_managed: true,
    sgsd_hook_id: hookId,
    sgsd_source_sha256: digest,
    matcher: TARGET_TOOL,
    hooks: [{
      type: 'command',
      command: 'node',
      args: [
        path.join(projectRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs'),
        '--event',
        event,
      ],
      timeout: HOOK_TIMEOUT_SECONDS,
    }],
  };
}

function writeSettings(projectRoot, options = {}) {
  const hookSource = path.join(projectRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
  const digest = options.digest || sourceDigest(hookSource);
  const pre = registration('PreToolUse', PRE_HOOK_ID, projectRoot, digest);
  const post = registration('PostToolUse', POST_HOOK_ID, projectRoot, digest);
  const settings = {
    permissions: { allow: ['Read'] },
    hooks: {
      SessionStart: [{ matcher: 'startup', hooks: [] }],
      PreToolUse: options.missingPre ? [] : [pre],
      PostToolUse: options.missingPost ? [] : [post],
    },
  };
  if (options.duplicatePre) settings.hooks.PreToolUse.push(JSON.parse(JSON.stringify(pre)));
  if (options.duplicatePost) settings.hooks.PostToolUse.push(JSON.parse(JSON.stringify(post)));
  if (options.legacyPre) {
    const legacy = JSON.parse(JSON.stringify(pre));
    legacy.sgsd_hook_id = 'legacy-unbound-substrate-hook';
    legacy.hooks[0].args = legacy.hooks[0].args.slice(0, 1);
    settings.hooks.PreToolUse.push(legacy);
  }
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  mkdir(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return settingsPath;
}

function createFixture() {
  mkdir(TMP_PARENT);
  const root = fs.mkdtempSync(path.join(TMP_PARENT, 'p167-t1-'));
  const project = path.join(root, 'project');
  const profile = path.join(root, 'profile');
  mkdir(path.join(project, '.planning', 'metrics'));
  mkdir(path.join(project, 'super-gsd'));
  mkdir(profile);

  for (const name of ['scripts', 'schemas', 'tools']) {
    linkDirectory(path.join(REPO_ROOT, 'super-gsd', name), path.join(project, 'super-gsd', name));
  }
  installHookSource(project);

  const env = {
    ...process.env,
    HOME: profile,
    USERPROFILE: profile,
    APPDATA: path.join(profile, 'AppData', 'Roaming'),
    XDG_CONFIG_HOME: path.join(profile, '.config'),
  };
  store.provisionWitnessKey(project, env);
  writeSettings(project);

  const readiness = store.inspectWitnessReadiness(project, env);
  assert.strictEqual(readiness.ready, true, readiness.reason);
  const manifestPath = store.resolveWitnessPaths(project, env).upstream_manifest_path;
  mkdir(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify({
    schema_version: 1,
    project_digest: readiness.project_digest,
    active_scope: 'project',
    servers: {
      project: {
        transport: 'stdio',
        definition: {
          command: process.execPath,
          args: ['fake-upstream.cjs'],
          env: { PRIVATE_FIXTURE_TOKEN: 'must-not-appear' },
        },
      },
    },
  }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(manifestPath, 0o600);

  return { root, project, env, manifestPath };
}

function restoreCurrentGuard() {
  installHookSource(fixture.project);
  writeSettings(fixture.project);
  const readiness = store.inspectWitnessReadiness(fixture.project, fixture.env);
  assert.strictEqual(readiness.ready, true, readiness.reason);
}

function hookPayload(event, id, overrides = {}) {
  const prepared = composer.prepareSubstrateCall('planning', {
    query: overrides.query || 'policy-complete substrate input',
  });
  return {
    hook_event_name: event,
    tool_name: TARGET_TOOL,
    session_id: overrides.session_id === undefined ? 'session-' + id : overrides.session_id,
    tool_use_id: overrides.tool_use_id === undefined ? 'tool-use-' + id : overrides.tool_use_id,
    cwd: overrides.cwd === undefined ? fixture.project : overrides.cwd,
    tool_input: overrides.tool_input === undefined ? prepared.payload : overrides.tool_input,
    ...(Object.prototype.hasOwnProperty.call(overrides, 'tool_response')
      ? { tool_response: overrides.tool_response }
      : {}),
  };
}

function mcpEnvelope(domain, extra = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify(domain) }],
    isError: false,
    ...extra,
  };
}

function replacementDomain(result) {
  assert(result && result.hookSpecificOutput, 'missing hookSpecificOutput');
  const envelope = result.hookSpecificOutput.updatedMCPToolOutput;
  const content = Array.isArray(envelope) ? envelope : envelope && envelope.content;
  assert(Array.isArray(content), 'missing MCP replacement content');
  const textBlock = content.find((block) => {
    if (!block || block.type !== 'text' || typeof block.text !== 'string') return false;
    try {
      const candidate = JSON.parse(block.text);
      return candidate && typeof candidate === 'object' && !Array.isArray(candidate);
    } catch (_) {
      return false;
    }
  });
  assert(textBlock, 'missing replacement text block');
  return { envelope, content, domain: JSON.parse(textBlock.text) };
}

function assertDenied(result, suffix) {
  assert.strictEqual(result.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.strictEqual(result.hookSpecificOutput.permissionDecision, 'deny');
  assert.strictEqual(
    result.hookSpecificOutput.permissionDecisionReason,
    'substrate_witness_denied:' + suffix,
  );
}

class FakeUpstream extends EventEmitter {
  constructor(mode = 'normal') {
    super();
    this.mode = mode;
    this.requests = [];
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.stdin = new Writable({
      write: (chunk, _encoding, callback) => {
        try {
          for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
            this.receive(JSON.parse(line));
          }
          callback();
        } catch (error) {
          callback(error);
        }
      },
    });
  }

  receive(request) {
    this.requests.push(JSON.parse(JSON.stringify(request)));
    if (typeof request.method !== 'string') return;
    queueMicrotask(() => {
      if (this.mode === 'exit') {
        this.emit('exit', 19, null);
        return;
      }
      if (this.mode === 'malformed') {
        this.stdout.write('{not-json}\n');
        return;
      }
      let result;
      if (request.method === 'initialize') {
        result = {
          protocolVersion: '2025-06-18',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'fake-vtp-kb', version: '1.0.0' },
        };
      } else if (request.method === 'tools/list') {
        result = {
          tools: [
            { name: SHORT_TOOL, description: 'raw substrate', inputSchema: { type: 'object' } },
            { name: 'vtp_health', description: 'health', inputSchema: { type: 'object' } },
          ],
        };
      } else if (request.method === 'tools/call') {
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              name: request.params && request.params.name,
              arguments: request.params && request.params.arguments,
            }),
          }],
          isError: false,
        };
      } else {
        result = {};
      }
      if (request.id !== undefined) {
        this.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
      }
    });
  }

  sendServerRequest(id) {
    this.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'sampling/createMessage',
      params: { messages: [] },
    }) + '\n');
  }

  kill() {
    this.emit('exit', 0, null);
  }
}

function createBrokerFixture(mode = 'normal', notifications = [], options = {}) {
  const upstream = new FakeUpstream(mode);
  let upstreamDefinition = null;
  const broker = brokerModule.createBroker({
    projectRoot: fixture.project,
    env: fixture.env,
    upstreamManifestPath: fixture.manifestPath,
    spawnUpstream: (definition) => {
      upstreamDefinition = definition;
      return upstream;
    },
    watch: options.watch === true,
    onNotification: (notification) => notifications.push(notification),
  });
  return { broker, upstream, upstreamDefinition };
}

function waitFor(condition, timeoutMilliseconds = 2000) {
  const deadline = Date.now() + timeoutMilliseconds;
  return new Promise((resolve, reject) => {
    function check() {
      if (condition()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('timed out waiting for broker watcher'));
        return;
      }
      setTimeout(check, 20);
    }
    check();
  });
}

function settleWithin(promise, timeoutMilliseconds = 1000) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timed out waiting for stdio router')), timeoutMilliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function request(method, id, params) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    ...(params === undefined ? {} : { params }),
  };
}

function listedNames(response) {
  assert(response && response.result && Array.isArray(response.result.tools));
  return response.result.tools.map((tool) => tool.name);
}

function spoolFiles() {
  const spool = store.resolveWitnessPaths(fixture.project, fixture.env).spool_dir;
  try {
    return fs.readdirSync(spool).filter((name) => name.endsWith('.json')).map((name) => path.join(spool, name));
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function defineHookTests() {
  test('composer exposes the existing digest and compiled v2 validator', () => {
    const prepared = composer.prepareSubstrateCall('planning', { query: 'public helper contract' });
    assert.strictEqual(composer.validateSubstrateToolInput(prepared.payload), true);
    assert.strictEqual(composer.substratePayloadDigest(prepared.payload), prepared.gateway_evidence.payload_sha256);
    assert.strictEqual(
      composer.substratePayloadDigest(prepared.payload),
      composer._internal.substratePayloadDigest(prepared.payload),
    );
  });

  test('PreToolUse ignores non-substrate tools', () => {
    const result = hook.processHookPayload({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'anything' },
    }, { env: fixture.env, expectedEvent: 'PreToolUse' });
    assert.strictEqual(result, null);
  });

  test('PreToolUse allows valid v2 input only after creating a witness', () => {
    const before = spoolFiles().length;
    const result = hook.processHookPayload(hookPayload('PreToolUse', 'valid'), { env: fixture.env });
    assert.strictEqual(result.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.strictEqual(result.hookSpecificOutput.permissionDecision, 'allow');
    assert.strictEqual(spoolFiles().length, before + 1);
  });

  for (const invalidCase of [
    ['missing source_types', (payload) => { delete payload.source_types; }],
    ['missing limit', (payload) => { delete payload.limit; }],
    ['empty source_types', (payload) => { payload.source_types = []; }],
    ['limit 6', (payload) => { payload.limit = 6; }],
  ]) {
    test('PreToolUse denies ' + invalidCase[0], () => {
      const payload = hookPayload('PreToolUse', 'invalid-' + invalidCase[0].replace(/\s+/g, '-'));
      invalidCase[1](payload.tool_input);
      assertDenied(hook.processHookPayload(payload, { env: fixture.env }), 'invalid_v2_payload');
    });
  }

  test('malformed stdin returns a stable PreToolUse denial', () => {
    assertDenied(hook.processHookStdin('{not-json', {
      env: fixture.env,
      expectedEvent: 'PreToolUse',
    }), 'malformed_stdin');
  });

  test('malformed PostToolUse stdin replaces any unavailable raw result', () => {
    const result = hook.processHookStdin('{not-json RAW_POST_MARKER', {
      env: fixture.env,
      expectedEvent: 'PostToolUse',
    });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.domain.reason, 'substrate_witness_rewrite_failed:malformed_stdin');
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes('RAW_POST_MARKER'), false);
  });

  test('PostToolUse ignores an event with a missing tool name', () => {
    const result = hook.processHookPayload({
      hook_event_name: 'PostToolUse',
      session_id: 'session-post-missing-tool',
      tool_use_id: 'tool-use-post-missing-tool',
      cwd: fixture.project,
      tool_input: {},
      tool_response: mcpEnvelope({ hits: [{ text: 'RAW_WRONG_TOOL_MARKER' }] }),
    }, { env: fixture.env, expectedEvent: 'PostToolUse' });
    assert.strictEqual(result, null);
  });

  test('PreToolUse denies missing session id', () => {
    assertDenied(
      hook.processHookPayload(hookPayload('PreToolUse', 'missing-session', { session_id: '' }), { env: fixture.env }),
      'missing_session_id',
    );
  });

  test('PreToolUse denies missing tool-use id', () => {
    assertDenied(
      hook.processHookPayload(hookPayload('PreToolUse', 'missing-tool', { tool_use_id: '' }), { env: fixture.env }),
      'missing_tool_use_id',
    );
  });

  test('PreToolUse denies a missing signing key', () => {
    const paths = store.resolveWitnessPaths(fixture.project, fixture.env);
    fs.unlinkSync(paths.key_path);
    assertDenied(
      hook.processHookPayload(hookPayload('PreToolUse', 'missing-key'), { env: fixture.env }),
      'key_unavailable',
    );
    store.provisionWitnessKey(fixture.project, fixture.env);
    restoreCurrentGuard();
  });

  test('PreToolUse denies when either exact project hook registration is absent', () => {
    writeSettings(fixture.project, { missingPost: true });
    assertDenied(
      hook.processHookPayload(hookPayload('PreToolUse', 'missing-post-registration'), { env: fixture.env }),
      'guard_unavailable:posttooluse_missing',
    );
    restoreCurrentGuard();
  });

  test('duplicate PreToolUse cannot overwrite an existing row', () => {
    const payload = hookPayload('PreToolUse', 'duplicate-pre');
    const first = hook.processHookPayload(payload, { env: fixture.env });
    assert.strictEqual(first.hookSpecificOutput.permissionDecision, 'allow');
    const filesBefore = spoolFiles().map((file) => [file, fs.readFileSync(file, 'utf8')]);
    assertDenied(hook.processHookPayload(payload, { env: fixture.env }), 'duplicate_pre');
    assert.deepStrictEqual(
      spoolFiles().map((file) => [file, fs.readFileSync(file, 'utf8')]),
      filesBefore,
    );
  });

  test('PostToolUse replaces a missing-Pre result instead of passing it through', () => {
    const rawMarker = 'RAW_MISSING_PRE_MARKER';
    const result = hook.processHookPayload(hookPayload('PostToolUse', 'missing-pre', {
      tool_response: mcpEnvelope({ hits: [{ text: rawMarker }] }),
    }), { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.domain.reason, 'substrate_witness_rewrite_failed:missing_pre');
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes(rawMarker), false);
  });

  test('PostToolUse rejects an actual-input digest mismatch', () => {
    const pre = hookPayload('PreToolUse', 'input-mismatch');
    hook.processHookPayload(pre, { env: fixture.env });
    const different = composer.prepareSubstrateCall('planning', { query: 'different valid payload' });
    const rawMarker = 'RAW_INPUT_MISMATCH_MARKER';
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_input: different.payload,
      tool_response: mcpEnvelope({ hits: [{ text: rawMarker }] }),
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.domain.reason, 'substrate_witness_rewrite_failed:input_mismatch');
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes(rawMarker), false);
  });

  test('PostToolUse preserves exact 16000-character boundaries in both response shapes', () => {
    const pre = hookPayload('PreToolUse', 'exact-boundary');
    assert.strictEqual(
      hook.processHookPayload(pre, { env: fixture.env }).hookSpecificOutput.permissionDecision,
      'allow',
    );
    const exact = 'e'.repeat(16000);
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: mcpEnvelope({
        hits: [{ doc_id: 'top-exact', text: exact }],
        evidence: { hits: [{ doc_id: 'nested-exact', text: exact }] },
      }, { serverMeta: 'preserved' }),
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.envelope.serverMeta, 'preserved');
    assert.strictEqual(rewritten.domain.hits[0].text.length, 16000);
    assert.strictEqual(rewritten.domain.evidence.hits[0].text.length, 16000);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(rewritten.domain, 'degradation_notes'), false);
  });

  test('PostToolUse finds substrate JSON in a multi-block content envelope', () => {
    const pre = hookPayload('PreToolUse', 'multi-block-envelope');
    hook.processHookPayload(pre, { env: fixture.env });
    const oversized = 'm'.repeat(16001);
    const untouchedImage = { type: 'image', data: 'IMAGE_BLOCK', mimeType: 'image/png' };
    const untouchedText = { type: 'text', text: 'upstream status text' };
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: {
        content: [
          untouchedImage,
          untouchedText,
          { type: 'text', text: JSON.stringify({ hits: [{ text: oversized }] }) },
          { type: 'resource', uri: 'fixture://unchanged' },
        ],
        isError: false,
        serverMeta: 'preserved',
      },
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.envelope.content.length, 4);
    assert.deepStrictEqual(rewritten.envelope.content[0], untouchedImage);
    assert.deepStrictEqual(rewritten.envelope.content[1], untouchedText);
    assert.deepStrictEqual(rewritten.envelope.content[3], { type: 'resource', uri: 'fixture://unchanged' });
    assert.strictEqual(rewritten.envelope.serverMeta, 'preserved');
    assert.strictEqual(rewritten.domain.hits[0].text.length, 16000);
  });

  test('PostToolUse accepts the measured one-block bare content array and preserves its shape', () => {
    const pre = hookPayload('PreToolUse', 'bare-content-array');
    hook.processHookPayload(pre, { env: fixture.env });
    const oversized = 'a'.repeat(16001);
    const original = [
      { type: 'text', text: JSON.stringify({ hits: [{ text: oversized }] }) },
    ];
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: original,
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(Array.isArray(rewritten.envelope), true);
    assert.strictEqual(rewritten.content.length, 1);
    assert.strictEqual(rewritten.domain.hits[0].text.length, 16000);
    assert.strictEqual(JSON.parse(original[0].text).hits[0].text.length, 16001);
  });

  test('PostToolUse caps 16001-character top-level and nested hits and discards tail markers', () => {
    const pre = hookPayload('PreToolUse', 'oversized');
    assert.strictEqual(
      hook.processHookPayload(pre, { env: fixture.env }).hookSpecificOutput.permissionDecision,
      'allow',
    );
    const top = 't'.repeat(16000) + TAIL_MARKER;
    const nested = 'n'.repeat(16000) + NESTED_TAIL_MARKER;
    assert.strictEqual(top.length, 16001);
    assert.strictEqual(nested.length, 16001);
    const rawDomain = {
      hits: [{ doc_id: 'top-oversized', text: top }],
      evidence: { hits: [{ rel_path: 'wiki/nested.md', text: nested }] },
    };
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: mcpEnvelope(rawDomain, { structuredContent: rawDomain }),
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.domain.hits[0].text.length, 16000);
    assert.strictEqual(rewritten.domain.evidence.hits[0].text.length, 16000);
    assert.strictEqual(rewritten.envelope.structuredContent.hits[0].text.length, 16000);
    assert.strictEqual(rewritten.envelope.structuredContent.evidence.hits[0].text.length, 16000);
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes(TAIL_MARKER), false);
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes(NESTED_TAIL_MARKER), false);
    assert.deepStrictEqual(
      rewritten.domain.degradation_notes.map((note) => note.reason_code),
      ['vtp_substrate_hit_truncated', 'vtp_substrate_hit_truncated'],
    );
  });

  test('rewritten witness can be atomically consumed once without a tool-use identifier', () => {
    const pre = hookPayload('PreToolUse', 'consume-once');
    hook.processHookPayload(pre, { env: fixture.env });
    hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: mcpEnvelope({ hits: [{ text: 'bounded' }] }),
    }, { env: fixture.env });
    const payloadDigest = composer.substratePayloadDigest(pre.tool_input);
    const consumed = store.consumeRewrittenWitness({
      projectRoot: fixture.project,
      env: fixture.env,
      sessionId: pre.session_id,
      payloadDigest,
    });
    assert.deepStrictEqual(consumed, {
      ok: true,
      payload_digest: payloadDigest,
      witness_status: 'consumed',
    });
    assert.throws(() => store.consumeRewrittenWitness({
      projectRoot: fixture.project,
      env: fixture.env,
      sessionId: pre.session_id,
      payloadDigest,
    }), /substrate_witness_replayed/);
  });

  test('PostToolUse rejects an HMAC-edited Pre row and does not expose raw output', () => {
    const pre = hookPayload('PreToolUse', 'tampered-row');
    const before = new Set(spoolFiles());
    assert.strictEqual(
      hook.processHookPayload(pre, { env: fixture.env }).hookSpecificOutput.permissionDecision,
      'allow',
    );
    const created = spoolFiles().filter((file) => !before.has(file));
    assert.strictEqual(created.length, 1);
    const row = JSON.parse(fs.readFileSync(created[0], 'utf8'));
    row.payload_digest = '0'.repeat(64);
    fs.writeFileSync(created[0], JSON.stringify(row) + '\n', 'utf8');
    const rawMarker = 'RAW_TAMPER_MARKER';
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: mcpEnvelope({ hits: [{ text: rawMarker }] }),
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.domain.reason, 'substrate_witness_rewrite_failed:invalid_pre');
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes(rawMarker), false);
  });

  test('PostToolUse passes unparseable MCP output through untouched and signs the terminal state', () => {
    const beforeSpool = new Set(spoolFiles());
    const pre = hookPayload('PreToolUse', 'malformed-response');
    hook.processHookPayload(pre, { env: fixture.env });
    const rawMarker = 'RAW_MALFORMED_RESPONSE_MARKER';
    const original = [{ type: 'text', text: rawMarker }];
    const before = JSON.stringify(original);
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: original,
    }, { env: fixture.env });
    assert.strictEqual(result, null);
    assert.strictEqual(JSON.stringify(original), before);
    const conditionPath = path.join(
      fixture.project,
      '.planning',
      'metrics',
      'substrate-invocation-witness-posttool.jsonl',
    );
    assert.strictEqual(fs.existsSync(conditionPath), false);
    const created = spoolFiles().filter((file) => !beforeSpool.has(file));
    assert.strictEqual(created.length, 1);
    const row = JSON.parse(fs.readFileSync(created[0], 'utf8'));
    assert.strictEqual(row.state, 'post_passthrough');
    assert.strictEqual(typeof row.passthrough_at, 'number');
    assert.deepStrictEqual(row.passthrough, {
      reason: 'malformed_response',
      response_sha256: sha256(Buffer.from(JSON.stringify(original), 'utf8')),
    });
    assert.strictEqual(row.rewritten_at, null);
    assert.strictEqual(row.rewrite, null);
    assert.throws(() => store.consumeRewrittenWitness({
      projectRoot: fixture.project,
      env: fixture.env,
      sessionId: pre.session_id,
      payloadDigest: composer.substratePayloadDigest(pre.tool_input),
    }), /substrate_witness_not_rewritten/);
  });

  test('PostToolUse exposes no response-shape diagnostic surface', () => {
    const diagnosticPath = path.join(fixture.root, 'post-tool-response-shape.jsonl');
    hook.processHookPayload(hookPayload('PostToolUse', 'shape-diagnostic', {
      tool_response: [{ type: 'text', text: 'upstream status text' }],
    }), {
      env: {
        ...fixture.env,
        SGSD_P167_TOOL_RESPONSE_SHAPE_LOG: diagnosticPath,
      },
      expectedEvent: 'PostToolUse',
    });
    assert.strictEqual(hook.describeToolResponseShape, undefined);
    assert.strictEqual(fs.existsSync(diagnosticPath), false);
  });

  test('PostToolUse rejects mismatched structured content without exposing it', () => {
    const pre = hookPayload('PreToolUse', 'structured-mismatch');
    hook.processHookPayload(pre, { env: fixture.env });
    const rawMarker = 'RAW_STRUCTURED_MISMATCH_MARKER';
    const result = hook.processHookPayload({
      ...pre,
      hook_event_name: 'PostToolUse',
      tool_response: mcpEnvelope({ hits: [] }, {
        structuredContent: { hits: [{ text: rawMarker }] },
      }),
    }, { env: fixture.env });
    const rewritten = replacementDomain(result);
    assert.strictEqual(rewritten.domain.reason, 'substrate_witness_rewrite_failed:malformed_response');
    assert.strictEqual(JSON.stringify(rewritten.envelope).includes(rawMarker), false);
  });

  test('authoritative and mirrored rows contain no raw correlation or content', () => {
    const mirrorPath = path.join(fixture.project, '.planning', 'metrics', 'substrate-invocation-witness.jsonl');
    const observable = spoolFiles().map((file) => fs.readFileSync(file, 'utf8')).join('\n')
      + fs.readFileSync(mirrorPath, 'utf8');
    const paths = store.resolveWitnessPaths(fixture.project, fixture.env);
    const keyMaterial = fs.readFileSync(paths.key_path);
    for (const forbidden of [
      'session-oversized',
      'tool-use-oversized',
      'policy-complete substrate input',
      'RAW_MISSING_PRE_MARKER',
      'RAW_INPUT_MISMATCH_MARKER',
      'RAW_TAMPER_MARKER',
      't'.repeat(100),
      'n'.repeat(100),
      keyMaterial.toString('hex'),
      keyMaterial.toString('base64'),
    ]) {
      assert.strictEqual(observable.includes(forbidden), false, 'observable witness leaked ' + forbidden);
    }
    assert.strictEqual(paths.key_path.startsWith(fixture.project), false);
    if (process.platform !== 'win32') {
      assert.strictEqual(fs.statSync(paths.key_path).mode & 0o077, 0);
    }
  });

  test('witness authority rejects a config root inside the project', () => {
    const insideEnv = {
      ...fixture.env,
      XDG_CONFIG_HOME: path.join(fixture.project, '.inside-config'),
    };
    assert.throws(
      () => store.resolveWitnessPaths(fixture.project, insideEnv),
      /witness_authority_inside_project/,
    );
    const readiness = store.inspectWitnessReadiness(fixture.project, insideEnv);
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.reason, 'authority_inside_project');
  });
}

function defineBrokerTests() {
  test('broker tools/list advertises substrate only with current guard readiness', async () => {
    restoreCurrentGuard();
    const { broker, upstream, upstreamDefinition } = createBrokerFixture();
    try {
      assert.deepStrictEqual(upstreamDefinition, {
        command: process.execPath,
        args: ['fake-upstream.cjs'],
        env: { PRIVATE_FIXTURE_TOKEN: 'must-not-appear' },
      });
      const current = await broker.handleRequest(request('tools/list', 1));
      assert.deepStrictEqual(listedNames(current), [SHORT_TOOL, 'vtp_health']);
      writeSettings(fixture.project, { missingPre: true });
      const missing = await broker.handleRequest(request('tools/list', 2));
      assert.deepStrictEqual(listedNames(missing), ['vtp_health']);
      restoreCurrentGuard();
      writeSettings(fixture.project, { duplicatePre: true });
      const duplicated = await broker.handleRequest(request('tools/list', 3));
      assert.deepStrictEqual(listedNames(duplicated), ['vtp_health']);
      restoreCurrentGuard();
      writeSettings(fixture.project, { missingPost: true });
      const missingPost = await broker.handleRequest(request('tools/list', 5));
      assert.deepStrictEqual(listedNames(missingPost), ['vtp_health']);
      restoreCurrentGuard();
      writeSettings(fixture.project, { duplicatePost: true });
      const duplicatedPost = await broker.handleRequest(request('tools/list', 6));
      assert.deepStrictEqual(listedNames(duplicatedPost), ['vtp_health']);
      restoreCurrentGuard();
      writeSettings(fixture.project, { legacyPre: true });
      const legacyDuplicate = await broker.handleRequest(request('tools/list', 8));
      assert.deepStrictEqual(listedNames(legacyDuplicate), ['vtp_health']);
      restoreCurrentGuard();
      const witnessPaths = store.resolveWitnessPaths(fixture.project, fixture.env);
      fs.unlinkSync(witnessPaths.key_path);
      const keyless = await broker.handleRequest(request('tools/list', 7));
      assert.deepStrictEqual(listedNames(keyless), ['vtp_health']);
      store.provisionWitnessKey(fixture.project, fixture.env);
      restoreCurrentGuard();
      const installed = path.join(fixture.project, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
      fs.unlinkSync(installed);
      fs.writeFileSync(installed, Buffer.from([39, 117, 115, 101, 32, 115, 116, 114, 105, 99, 116, 39, 59, 10]));
      const drifted = await broker.handleRequest(request('tools/list', 4));
      assert.deepStrictEqual(listedNames(drifted), ['vtp_health']);
      assert.strictEqual(upstream.requests.filter((row) => row.method === 'tools/list').length, 8);
    } finally {
      broker.close();
      restoreCurrentGuard();
    }
  });

  test('broker watcher publishes list_changed on readiness loss and restoration', async () => {
    restoreCurrentGuard();
    const notifications = [];
    const { broker } = createBrokerFixture('normal', notifications, { watch: true });
    try {
      writeSettings(fixture.project, { missingPost: true });
      await waitFor(() => notifications.length >= 1);
      assert.strictEqual(notifications[0].method, 'notifications/tools/list_changed');
      restoreCurrentGuard();
      await waitFor(() => notifications.length >= 2);
      assert.strictEqual(notifications[1].method, 'notifications/tools/list_changed');
    } finally {
      broker.close();
      restoreCurrentGuard();
    }
  });

  test('deleting both registrations and hook source withdraws discovery and stale calls', async () => {
    restoreCurrentGuard();
    const notifications = [];
    const { broker, upstream } = createBrokerFixture('normal', notifications);
    try {
      const initial = await broker.handleRequest(request('tools/list', 10));
      assert(listedNames(initial).includes(SHORT_TOOL));
      writeSettings(fixture.project, { missingPre: true, missingPost: true });
      fs.unlinkSync(path.join(fixture.project, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs'));
      broker.refreshReadiness();
      assert.deepStrictEqual(notifications, [{
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed',
        params: {},
      }]);
      const withdrawn = await broker.handleRequest(request('tools/list', 11));
      assert.deepStrictEqual(listedNames(withdrawn), ['vtp_health']);
      const callsBefore = upstream.requests.filter((row) => row.method === 'tools/call').length;
      const stale = await broker.handleRequest(request('tools/call', 12, {
        name: SHORT_TOOL,
        arguments: { query: 'stale forced call' },
      }));
      assert.strictEqual(stale.result.isError, true);
      assert.match(stale.result.content[0].text, /^substrate_witness_unavailable:/);
      assert(stale.result.content[0].text.length < 256);
      assert.strictEqual(upstream.requests.filter((row) => row.method === 'tools/call').length, callsBefore);
    } finally {
      broker.close();
      restoreCurrentGuard();
    }
  });

  test('broker forwards non-substrate tools unchanged while the guard is unavailable', async () => {
    writeSettings(fixture.project, { missingPost: true });
    const { broker, upstream } = createBrokerFixture();
    try {
      const params = { name: 'vtp_health', arguments: { include: ['status'] } };
      const response = await broker.handleRequest(request('tools/call', 20, params));
      const forwarded = upstream.requests.find((row) => row.method === 'tools/call');
      assert.deepStrictEqual(forwarded.params, params);
      assert.strictEqual(response.result.isError, false);
    } finally {
      broker.close();
      restoreCurrentGuard();
    }
  });

  test('broker transparently relays server-initiated requests and client responses', async () => {
    const notifications = [];
    const { broker, upstream } = createBrokerFixture('normal', notifications);
    try {
      upstream.sendServerRequest('upstream-request-1');
      assert.strictEqual(notifications.length, 1);
      assert.strictEqual(notifications[0].method, 'sampling/createMessage');
      assert.notStrictEqual(notifications[0].id, 'upstream-request-1');
      const response = {
        jsonrpc: '2.0',
        id: notifications[0].id,
        result: { model: 'fixture-model' },
      };
      assert.strictEqual(await broker.handleRequest(response), null);
      assert.deepStrictEqual(upstream.requests[upstream.requests.length - 1], {
        ...response,
        id: 'upstream-request-1',
      });
    } finally {
      broker.close();
    }
  });

  test('stdio router handles a client response while an earlier request is pending', async () => {
    let releaseRequest;
    const writes = [];
    const received = [];
    const pendingResponse = new Promise((resolve) => { releaseRequest = resolve; });
    const broker = {
      handleRequest(message) {
        received.push(message);
        if (message.method === 'tools/list') return pendingResponse;
        releaseRequest({ jsonrpc: '2.0', id: 40, result: { tools: [] } });
        return Promise.resolve(null);
      },
    };
    const router = brokerModule.createStdioRouter(broker, (message) => writes.push(message));
    router.routeLine(JSON.stringify(request('tools/list', 40)));
    await Promise.resolve();
    router.routeLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 'sgsd-upstream-request-1',
      result: { model: 'fixture-model' },
    }));
    await settleWithin(router.finish());
    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[1].id, 'sgsd-upstream-request-1');
    assert.deepStrictEqual(writes, [{ jsonrpc: '2.0', id: 40, result: { tools: [] } }]);
  });

  test('broker contains upstream exit without leaking manifest data', async () => {
    const { broker } = createBrokerFixture('exit');
    try {
      const response = await broker.handleRequest(request('tools/list', 30));
      assert(response.error);
      assert.match(response.error.message, /^substrate_broker_upstream_failed:/);
      assert(response.error.message.length < 256);
      assert.strictEqual(JSON.stringify(response).includes('must-not-appear'), false);
    } finally {
      broker.close();
    }
  });

  test('broker contains malformed upstream JSON', async () => {
    const { broker } = createBrokerFixture('malformed');
    try {
      const response = await broker.handleRequest(request('tools/list', 31));
      assert(response.error);
      assert.strictEqual(response.error.message, 'substrate_broker_upstream_failed:malformed_json');
      assert(JSON.stringify(response).length < 512);
    } finally {
      broker.close();
    }
  });

  test('broker rejects a project-contained upstream manifest override', () => {
    const insideManifest = path.join(fixture.project, '.planning', 'inside-upstream-manifest.json');
    fs.copyFileSync(fixture.manifestPath, insideManifest);
    try {
      assert.throws(() => brokerModule.createBroker({
        projectRoot: fixture.project,
        env: fixture.env,
        upstreamManifestPath: insideManifest,
        spawnUpstream: () => new FakeUpstream(),
        watch: false,
      }), /upstream_manifest_inside_project/);
    } finally {
      fs.unlinkSync(insideManifest);
    }
  });

}

async function main() {
  const productionFiles = [HOOK_PATH, BROKER_PATH, STORE_PATH, COMPOSER_PATH];
  const missing = productionFiles.filter((file) => !fs.existsSync(file));
  if (missing.length > 0) {
    console.error('FAIL: required P167-T1 production file missing: '
      + missing.map((file) => path.relative(REPO_ROOT, file)).join(', '));
    process.exitCode = 1;
    return;
  }

  hook = require(HOOK_PATH);
  brokerModule = require(BROKER_PATH);
  store = require(STORE_PATH);
  composer = require(COMPOSER_PATH);

  fixture = createFixture();
  defineHookTests();
  defineBrokerTests();

  let passed = 0;
  try {
    for (const entry of tests) {
      try {
        await entry.fn();
        passed += 1;
        console.log('PASS ' + entry.name);
      } catch (error) {
        console.error('FAIL ' + entry.name + ': ' + (error && error.stack ? error.stack : error));
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    fs.rmSync(fixture.root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 50,
    });
  }
  console.log('PASS assert-hook-contract ' + passed + '/' + tests.length);
}

main().catch((error) => {
  console.error('FAIL assert-hook-contract: ' + (error && error.stack ? error.stack : error));
  process.exitCode = 1;
});
