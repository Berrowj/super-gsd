'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WITNESS_SCHEMA_VERSION = 1;
const UPSTREAM_MANIFEST_SCHEMA_VERSION = 1;
const WITNESS_TTL_MS = 15 * 60 * 1000;
const TARGET_TOOL = ['mcp__vtp-kb__vtp', 'search', 'substrate'].join('_');
const PRE_HOOK_ID = 'pre-tool-use-substrate-invocation-witness';
const POST_HOOK_ID = 'post-tool-use-substrate-invocation-witness';
const HOOK_TIMEOUT_SECONDS = 5;
const HOOK_RELATIVE_PATH = path.join('super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
const MIRROR_RELATIVE_PATH = path.join('.planning', 'metrics', 'substrate-invocation-witness.jsonl');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function canonicalRecordBytes(record) {
  return Buffer.from(JSON.stringify(canonicalize(record)), 'utf8');
}

function normalizedProjectPath(projectRoot) {
  const resolved = path.resolve(projectRoot);
  const normalized = resolved.replace(/\\/g, '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function projectDigest(projectRoot) {
  return sha256(Buffer.from(normalizedProjectPath(projectRoot), 'utf8'));
}

function userConfigRoot(env = process.env) {
  if (env.XDG_CONFIG_HOME) return path.resolve(env.XDG_CONFIG_HOME);
  if (process.platform === 'win32' && env.APPDATA) return path.resolve(env.APPDATA);
  const home = env.USERPROFILE || env.HOME || os.homedir();
  return path.join(path.resolve(home), '.config');
}

function realPathWithMissingTail(value) {
  let existing = path.resolve(value);
  const tail = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return path.resolve(value);
    tail.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync.native(existing), ...tail);
}

function assertPathOutsideProject(projectRoot, candidate, reason) {
  const project = realPathWithMissingTail(projectRoot);
  const target = realPathWithMissingTail(candidate);
  const relative = path.relative(project, target);
  if (relative === ''
    || (relative !== '..'
      && !relative.startsWith('..' + path.sep)
      && !path.isAbsolute(relative))) {
    throw new Error(reason);
  }
  return target;
}

function resolveWitnessPaths(projectRoot, env = process.env) {
  const digest = projectDigest(projectRoot);
  const authorityRoot = path.join(userConfigRoot(env), 'super-gsd', 'substrate-invocation-witness');
  assertPathOutsideProject(projectRoot, authorityRoot, 'witness_authority_inside_project');
  const projectAuthorityRoot = path.join(authorityRoot, 'projects', digest);
  return {
    authority_root: authorityRoot,
    project_authority_root: projectAuthorityRoot,
    key_path: path.join(authorityRoot, 'key.bin'),
    spool_dir: path.join(projectAuthorityRoot, 'spool'),
    upstream_manifest_path: path.join(projectAuthorityRoot, 'upstream-manifest.json'),
    mirror_path: path.join(path.resolve(projectRoot), MIRROR_RELATIVE_PATH),
    project_digest: digest,
  };
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(directory, 0o700);
}

function readKey(paths) {
  let key;
  try {
    key = fs.readFileSync(paths.key_path);
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error('witness_key_missing');
    throw new Error('witness_key_unreadable');
  }
  if (key.length !== 32) throw new Error('witness_key_invalid');
  if (process.platform !== 'win32' && (fs.statSync(paths.key_path).mode & 0o077) !== 0) {
    throw new Error('witness_key_permissions_invalid');
  }
  return key;
}

function provisionWitnessKey(projectRoot, env = process.env) {
  const paths = resolveWitnessPaths(projectRoot, env);
  ensurePrivateDirectory(paths.authority_root);
  ensurePrivateDirectory(path.dirname(paths.key_path));
  let created = false;
  try {
    const descriptor = fs.openSync(paths.key_path, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, crypto.randomBytes(32));
      fs.fsyncSync(descriptor);
      created = true;
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    if (!error || error.code !== 'EEXIST') throw error;
  }
  if (process.platform !== 'win32') fs.chmodSync(paths.key_path, 0o600);
  readKey(paths);
  return { key_status: 'ready', created, project_digest: paths.project_digest };
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function expectedRegistration(event, projectRoot, digest) {
  return {
    event,
    hook_id: event === 'PreToolUse' ? PRE_HOOK_ID : POST_HOOK_ID,
    matcher: TARGET_TOOL,
    command: 'node',
    script_path: path.join(path.resolve(projectRoot), HOOK_RELATIVE_PATH),
    args: ['--event', event],
    timeout: HOOK_TIMEOUT_SECONDS,
    source_digest: digest,
  };
}

function registrationStatus(settings, expected) {
  const entries = settings && settings.hooks && Array.isArray(settings.hooks[expected.event])
    ? settings.hooks[expected.event]
    : [];
  const sourceRegistrations = entries.filter((entry) => entry
    && entry.matcher === expected.matcher
    && Array.isArray(entry.hooks)
    && entry.hooks.some((command) => command
      && command.type === 'command'
      && command.command === expected.command
      && Array.isArray(command.args)
      && command.args.length > 0
      && typeof command.args[0] === 'string'
      && samePath(command.args[0], expected.script_path)));
  if (sourceRegistrations.length > 1) return expected.event.toLowerCase() + '_duplicate';
  const matches = entries.filter((entry) => entry && entry.sgsd_hook_id === expected.hook_id);
  if (matches.length === 0) return expected.event.toLowerCase() + '_missing';
  if (matches.length !== 1) return expected.event.toLowerCase() + '_duplicate';
  const entry = matches[0];
  const commands = Array.isArray(entry.hooks) ? entry.hooks : [];
  if (entry.sgsd_managed !== true
    || entry.matcher !== expected.matcher
    || entry.sgsd_source_sha256 !== expected.source_digest
    || commands.length !== 1) {
    return expected.event.toLowerCase() + '_stale';
  }
  const command = commands[0];
  if (!command
    || command.type !== 'command'
    || command.command !== expected.command
    || !Array.isArray(command.args)
    || command.args.length !== 3
    || !samePath(command.args[0], expected.script_path)
    || command.args[1] !== expected.args[0]
    || command.args[2] !== expected.args[1]
    || command.timeout !== expected.timeout) {
    return expected.event.toLowerCase() + '_stale';
  }
  return null;
}

function unavailableReadiness(projectRoot, reason, details = {}) {
  return {
    ready: false,
    reason,
    project_digest: projectDigest(projectRoot),
    trust_level: 'local_hmac',
    enforcement_scope: 'supported_sgsd_brokered_mcp_grant',
    residual: 'same_user_can_restore_direct_mcp_or_replace_broker',
    ...details,
  };
}

function inspectWitnessReadiness(projectRoot, env = process.env) {
  const resolvedRoot = path.resolve(projectRoot);
  let paths;
  try {
    paths = resolveWitnessPaths(resolvedRoot, env);
  } catch (error) {
    return unavailableReadiness(
      resolvedRoot,
      error && error.message === 'witness_authority_inside_project'
        ? 'authority_inside_project'
        : 'authority_unavailable',
    );
  }
  const sourcePath = path.join(resolvedRoot, HOOK_RELATIVE_PATH);
  const settingsPath = path.join(resolvedRoot, '.claude', 'settings.json');
  if (!fs.existsSync(path.join(resolvedRoot, '.planning'))) {
    return unavailableReadiness(resolvedRoot, 'project_unavailable');
  }
  if (!fs.existsSync(sourcePath)) {
    return unavailableReadiness(resolvedRoot, 'source_missing');
  }

  let digest;
  try {
    digest = sha256(fs.readFileSync(sourcePath));
  } catch (_) {
    return unavailableReadiness(resolvedRoot, 'source_unreadable');
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    return unavailableReadiness(
      resolvedRoot,
      error && error.code === 'ENOENT' ? 'settings_missing' : 'settings_invalid',
      { source_digest: digest },
    );
  }

  const preReason = registrationStatus(settings, expectedRegistration('PreToolUse', resolvedRoot, digest));
  if (preReason) return unavailableReadiness(resolvedRoot, preReason, { source_digest: digest });
  const postReason = registrationStatus(settings, expectedRegistration('PostToolUse', resolvedRoot, digest));
  if (postReason) return unavailableReadiness(resolvedRoot, postReason, { source_digest: digest });

  try {
    readKey(paths);
  } catch (_) {
    return unavailableReadiness(resolvedRoot, 'key_unavailable', { source_digest: digest });
  }

  return {
    ready: true,
    reason: 'ready',
    project_digest: paths.project_digest,
    source_digest: digest,
    pre_hook_id: PRE_HOOK_ID,
    post_hook_id: POST_HOOK_ID,
    matcher: TARGET_TOOL,
    trust_level: 'local_hmac',
    enforcement_scope: 'supported_sgsd_brokered_mcp_grant',
    residual: 'same_user_can_restore_direct_mcp_or_replace_broker',
  };
}

function recordIdentity(key, sessionId, toolUseId) {
  return hmac(key, Buffer.from(JSON.stringify([sessionId, toolUseId]), 'utf8'));
}

function signedRecord(unsignedRecord, key) {
  const signature = hmac(key, canonicalRecordBytes(unsignedRecord));
  return { ...unsignedRecord, hmac_sha256: signature };
}

function verifiedRecord(source, key) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (_) {
    throw new Error('witness_record_invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('witness_record_invalid');
  }
  const signature = parsed.hmac_sha256;
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new Error('witness_record_invalid');
  }
  const unsigned = { ...parsed };
  delete unsigned.hmac_sha256;
  const expected = hmac(key, canonicalRecordBytes(unsigned));
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('witness_record_invalid');
  }
  return parsed;
}

function writeExclusive(filePath, bytes) {
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  if (process.platform !== 'win32') fs.chmodSync(filePath, 0o600);
}

function atomicReplace(filePath, bytes) {
  const temporary = filePath + '.tmp-' + crypto.randomBytes(8).toString('hex');
  try {
    writeExclusive(temporary, bytes);
    fs.renameSync(temporary, filePath);
  } finally {
    try { fs.unlinkSync(temporary); } catch (_) {}
  }
}

function observableRow(record, event) {
  return {
    schema_version: record.schema_version,
    event,
    project_digest: record.project_digest,
    payload_digest: record.payload_digest,
    session_sha256: record.session_sha256,
    tool_use_sha256: record.tool_use_sha256,
    source_digest: record.source_digest,
    state: record.state,
    created_at: record.created_at,
    expires_at: record.expires_at,
    rewritten_at: record.rewritten_at || null,
    consumed_at: record.consumed_at || null,
    rewrite: record.rewrite || null,
  };
}

function appendMirror(paths, record, event) {
  fs.mkdirSync(path.dirname(paths.mirror_path), { recursive: true });
  fs.appendFileSync(paths.mirror_path, JSON.stringify(observableRow(record, event)) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  if (process.platform !== 'win32') fs.chmodSync(paths.mirror_path, 0o600);
}

function requireDigest(value, reason) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(reason);
}

function createPreWitness(options) {
  const projectRoot = path.resolve(options.projectRoot);
  const paths = resolveWitnessPaths(projectRoot, options.env || process.env);
  const key = readKey(paths);
  if (typeof options.sessionId !== 'string' || !options.sessionId) throw new Error('witness_session_missing');
  if (typeof options.toolUseId !== 'string' || !options.toolUseId) throw new Error('witness_tool_use_missing');
  requireDigest(options.payloadDigest, 'witness_payload_digest_invalid');
  requireDigest(options.sourceDigest, 'witness_source_digest_invalid');
  ensurePrivateDirectory(paths.project_authority_root);
  ensurePrivateDirectory(paths.spool_dir);

  const now = Date.now();
  const record = signedRecord({
    schema_version: WITNESS_SCHEMA_VERSION,
    project_digest: paths.project_digest,
    payload_digest: options.payloadDigest,
    session_sha256: sha256(Buffer.from(options.sessionId, 'utf8')),
    tool_use_sha256: sha256(Buffer.from(options.toolUseId, 'utf8')),
    source_digest: options.sourceDigest,
    state: 'pre_allowed',
    created_at: now,
    expires_at: now + WITNESS_TTL_MS,
    rewritten_at: null,
    consumed_at: null,
    rewrite: null,
  }, key);
  const recordPath = path.join(paths.spool_dir, recordIdentity(key, options.sessionId, options.toolUseId) + '.json');
  try {
    writeExclusive(recordPath, Buffer.concat([canonicalRecordBytes(record), Buffer.from('\n')]));
  } catch (error) {
    if (error && error.code === 'EEXIST') throw new Error('witness_duplicate_pre');
    throw new Error('witness_pre_write_failed');
  }
  try {
    appendMirror(paths, record, 'pre_allowed');
  } catch (_) {
    try { fs.unlinkSync(recordPath); } catch (_) {}
    throw new Error('witness_mirror_write_failed');
  }
  return observableRow(record, 'pre_allowed');
}

function readExactRecord(paths, key, sessionId, toolUseId) {
  const recordPath = path.join(paths.spool_dir, recordIdentity(key, sessionId, toolUseId) + '.json');
  let source;
  try {
    source = fs.readFileSync(recordPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error('witness_missing_pre');
    throw new Error('witness_record_unreadable');
  }
  return { recordPath, source, record: verifiedRecord(source, key) };
}

function prepareWitnessTransition(options) {
  const projectRoot = path.resolve(options.projectRoot);
  const paths = resolveWitnessPaths(projectRoot, options.env || process.env);
  const key = readKey(paths);
  requireDigest(options.payloadDigest, 'witness_payload_digest_invalid');
  requireDigest(options.responseDigest, 'witness_response_digest_invalid');
  const exact = readExactRecord(paths, key, options.sessionId, options.toolUseId);
  const expectedSession = sha256(Buffer.from(options.sessionId, 'utf8'));
  const expectedToolUse = sha256(Buffer.from(options.toolUseId, 'utf8'));
  if (exact.record.project_digest !== paths.project_digest
    || exact.record.session_sha256 !== expectedSession
    || exact.record.tool_use_sha256 !== expectedToolUse
    || exact.record.payload_digest !== options.payloadDigest
    || exact.record.state !== 'pre_allowed') {
    throw new Error('witness_pre_mismatch');
  }
  if (exact.record.expires_at <= Date.now()) throw new Error('witness_pre_expired');
  return { exact, key, paths };
}

function transitionWitnessToRewritten(options) {
  const { exact, key, paths } = prepareWitnessTransition(options);
  const rewrite = {
    response_sha256: options.responseDigest,
    degradation_count: Number(options.degradationCount) || 0,
    original_chars: Number(options.originalChars) || 0,
    retained_chars: Number(options.retainedChars) || 0,
    top_level_hit_count: Number(options.topLevelHitCount) || 0,
    evidence_hit_count: Number(options.evidenceHitCount) || 0,
  };
  const unsigned = { ...exact.record };
  delete unsigned.hmac_sha256;
  const finalRecord = signedRecord({
    ...unsigned,
    state: 'rewritten',
    rewritten_at: Date.now(),
    rewrite,
  }, key);
  atomicReplace(exact.recordPath, Buffer.concat([canonicalRecordBytes(finalRecord), Buffer.from('\n')]));
  try {
    appendMirror(paths, finalRecord, 'rewritten');
  } catch (_) {
    atomicReplace(exact.recordPath, Buffer.from(exact.source, 'utf8'));
    throw new Error('witness_mirror_write_failed');
  }
  return observableRow(finalRecord, 'rewritten');
}


function readSpoolRows(paths, key) {
  let names;
  try {
    names = fs.readdirSync(paths.spool_dir).filter((name) => name.endsWith('.json'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return { rows: [], invalidRows: [] };
    throw error;
  }
  const rows = [];
  const invalidRows = [];
  for (const name of names) {
    const filePath = path.join(paths.spool_dir, name);
    const source = fs.readFileSync(filePath, 'utf8');
    try {
      rows.push({ filePath, record: verifiedRecord(source, key) });
    } catch (_) {
      try {
        invalidRows.push(JSON.parse(source));
      } catch (_) {}
    }
  }
  return { rows, invalidRows };
}

function selectRewrittenWitness(rows, paths, sessionDigest, payloadDigest, now) {
  const projectRows = rows.filter((item) => item.record.project_digest === paths.project_digest);
  const sessionRows = projectRows.filter((item) => item.record.session_sha256 === sessionDigest);
  const payloadRows = sessionRows.filter((item) => item.record.payload_digest === payloadDigest);
  const fresh = payloadRows.filter((item) => item.record.expires_at > now);
  const rewritten = fresh.filter((item) => item.record.state === 'rewritten');

  if (rewritten.length === 0) {
    if (payloadRows.some((item) => item.record.state === 'consumed')) throw new Error('substrate_witness_replayed');
    if (payloadRows.some((item) => item.record.expires_at <= now)) throw new Error('substrate_witness_expired');
    if (fresh.length > 0) throw new Error('substrate_witness_not_rewritten');
    if (projectRows.some((item) => item.record.payload_digest === payloadDigest)) {
      throw new Error('substrate_witness_session_mismatch');
    }
    if (sessionRows.length > 0) throw new Error('substrate_witness_digest_mismatch');
    throw new Error('substrate_witness_missing');
  }
  rewritten.sort((left, right) => left.record.created_at - right.record.created_at
    || left.record.tool_use_sha256.localeCompare(right.record.tool_use_sha256));
  if (rewritten.length > 1
    && rewritten[0].record.created_at === rewritten[1].record.created_at
    && rewritten[0].record.tool_use_sha256 === rewritten[1].record.tool_use_sha256) {
    throw new Error('substrate_witness_ambiguous');
  }
  return rewritten[0];
}

function consumeRewrittenWitness(options) {
  const projectRoot = path.resolve(options.projectRoot);
  const paths = resolveWitnessPaths(projectRoot, options.env || process.env);
  const key = readKey(paths);
  if (typeof options.sessionId !== 'string' || !options.sessionId) {
    throw new Error('substrate_witness_session_missing');
  }
  requireDigest(options.payloadDigest, 'substrate_witness_digest_invalid');
  const sessionDigest = sha256(Buffer.from(options.sessionId, 'utf8'));
  const available = readSpoolRows(paths, key);
  if (available.invalidRows.some((record) => record
    && record.project_digest === paths.project_digest
    && record.session_sha256 === sessionDigest
    && record.payload_digest === options.payloadDigest)) {
    throw new Error('substrate_witness_invalid');
  }
  const selected = selectRewrittenWitness(
    available.rows,
    paths,
    sessionDigest,
    options.payloadDigest,
    Date.now(),
  );
  const claimPath = selected.filePath + '.claim-' + crypto.randomBytes(8).toString('hex');
  try {
    fs.renameSync(selected.filePath, claimPath);
  } catch (_) {
    throw new Error('substrate_witness_ambiguous');
  }
  try {
    const claimed = verifiedRecord(fs.readFileSync(claimPath, 'utf8'), key);
    if (claimed.state !== 'rewritten'
      || claimed.project_digest !== paths.project_digest
      || claimed.session_sha256 !== sessionDigest
      || claimed.payload_digest !== options.payloadDigest) {
      throw new Error('substrate_witness_invalid');
    }
    const unsigned = { ...claimed };
    delete unsigned.hmac_sha256;
    const consumed = signedRecord({ ...unsigned, state: 'consumed', consumed_at: Date.now() }, key);
    writeExclusive(
      selected.filePath,
      Buffer.concat([canonicalRecordBytes(consumed), Buffer.from('\n')]),
    );
    try {
      appendMirror(paths, consumed, 'consumed');
    } catch (_) {
      fs.unlinkSync(selected.filePath);
      fs.renameSync(claimPath, selected.filePath);
      throw new Error('substrate_witness_mirror_write_failed');
    }
    try { fs.unlinkSync(claimPath); } catch (_) {}
    return {
      ok: true,
      payload_digest: consumed.payload_digest,
      witness_status: 'consumed',
    };
  } catch (error) {
    if (!fs.existsSync(selected.filePath) && fs.existsSync(claimPath)) {
      try { fs.renameSync(claimPath, selected.filePath); } catch (_) {}
    }
    throw error;
  }
}

function cliValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] || null;
}

function runCli(argv, env = process.env) {
  const projectRoot = cliValue(argv, '--project-dir');
  if (!projectRoot) {
    process.stderr.write('substrate_witness_cli_invalid:missing_project_dir\n');
    return 2;
  }
  if (argv.includes('--provision-key')) {
    try {
      process.stdout.write(JSON.stringify(provisionWitnessKey(projectRoot, env)) + '\n');
      return 0;
    } catch (_) {
      process.stderr.write('substrate_witness_key_provision_failed\n');
      return 2;
    }
  }
  if (argv.includes('--readiness')) {
    const readiness = inspectWitnessReadiness(projectRoot, env);
    process.stdout.write(JSON.stringify(readiness) + '\n');
    return readiness.ready ? 0 : 2;
  }
  process.stderr.write('substrate_witness_cli_invalid:missing_mode\n');
  return 2;
}

module.exports = {
  WITNESS_SCHEMA_VERSION,
  UPSTREAM_MANIFEST_SCHEMA_VERSION,
  WITNESS_TTL_MS,
  TARGET_TOOL,
  PRE_HOOK_ID,
  POST_HOOK_ID,
  HOOK_TIMEOUT_SECONDS,
  HOOK_RELATIVE_PATH,
  assertPathOutsideProject,
  resolveWitnessPaths,
  provisionWitnessKey,
  inspectWitnessReadiness,
  createPreWitness,
  transitionWitnessToRewritten,
  consumeRewrittenWitness,
  runCli,
};

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}
