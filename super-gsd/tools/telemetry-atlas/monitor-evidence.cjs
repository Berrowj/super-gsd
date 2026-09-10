#!/usr/bin/env node
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { digest, safePath } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');

const BUNDLE = /^atlas-\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const PAYLOAD = /^[a-f0-9]{64}\.(?:json|jsonl)$/;
const PROJECT = /^[a-f0-9]{64}$/;
const RUN = /^sgsd-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const STATUS = new Set(['PASS', 'WARN', 'FAIL']);
const REGISTRATION_ROLES = new Set(['orchestrator', 'executor', 'reviewer', 'planner', 'verifier',
  'narrator', 'board', 'recovery', 'observer']);
const ROLES = new Set(['project_registration', 'run_registration', 'native_event_ledger',
  'native_partition_manifest', 'native_gap_ledger', 'operational_event_ledger', 'operational_receipts',
  'operational_state', 'operational_partition_manifest', 'operational_gap_ledger', 'global_gap_ledger',
  'monitor_incidents', 'monitor_audit']);
const EXPORT_LIMIT = 10 * 1024 * 1024 * 1024;
const MAX_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_AUDIT_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 4096;
const MAX_ENTRIES = 4096;
const MAX_LINE_TAIL = 1024 * 1024;
const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;
const EXCLUSIONS = Object.freeze(['raw_spool', 'prompt', 'transcript', 'auth', 'config', 'source_archive']);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const manifestIdentity = value => sha(JSON.stringify(stable(value)));
const payloadName = (descriptor, extension) => `${sha(descriptor)}.${extension}`;
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const safeRelative = value => typeof value === 'string' && value.length > 0 && value.length <= 512
  && !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').includes('..')
  && /^[A-Za-z0-9._/-]+$/.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0;
const atom = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);

function asTime(value) {
  const millis = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value;
  if (!Number.isFinite(millis)) throw new Error('invalid_export_time');
  return millis;
}
function bundleId(now) {
  return `atlas-${new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}-${crypto.randomBytes(4).toString('hex')}`;
}
function expectedPayloadName(row) {
  const extension = row.source_relative_path.endsWith('.jsonl') ? 'jsonl' : 'json';
  let descriptor;
  if (row.source_role === 'project_registration') descriptor = `${row.source_role}:${row.project_id}`;
  else if (row.source_role === 'run_registration') descriptor = `${row.source_role}:${row.source_relative_path.split('/')[1]}`;
  else if (row.project_id !== null) descriptor = `${row.source_role}:${row.project_id}:${path.posix.basename(row.source_relative_path)}`;
  else descriptor = row.source_role;
  return payloadName(descriptor, extension);
}
function entries(directory, maximum = MAX_ENTRIES) {
  safePath(path.join(directory, '.atlas-entry-check'));
  if (!fs.existsSync(directory)) return [];
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_directory');
  const result = [], handle = fs.opendirSync(directory);
  try {
    let entry;
    while ((entry = handle.readSync())) {
      if (result.length >= maximum) throw new Error('entry_limit');
      result.push(entry);
    }
  } finally { handle.closeSync(); }
  return result;
}
function ownedOpen(file) {
  safePath(file);
  const before = fs.lstatSync(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
      || (process.getuid && before.uid !== BigInt(process.getuid()))) throw new Error('unsafe_file');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const opened = fs.fstatSync(fd, { bigint: true });
  if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1n) {
    fs.closeSync(fd); throw new Error('source_replaced');
  }
  return { fd, before: opened };
}
function sameIdentity(left, right) {
  return left && right && left.dev === right.dev && left.ino === right.ino && right.nlink === 1n
    && (!process.getuid || right.uid === BigInt(process.getuid()));
}
function readSmall(file, maximum) {
  const opened = ownedOpen(file);
  try {
    if (opened.before.size > BigInt(maximum)) throw new Error('metadata_limit');
    const size = Number(opened.before.size), buffer = Buffer.alloc(size);
    if (size && fs.readSync(opened.fd, buffer, 0, size, 0) !== size) throw new Error('short_read');
    const after = fs.fstatSync(opened.fd, { bigint: true });
    let current; try { current = fs.lstatSync(file, { bigint: true }); } catch { current = null; }
    if (!sameIdentity(opened.before, after) || !sameIdentity(opened.before, current)
        || after.size !== opened.before.size || after.mtimeNs !== opened.before.mtimeNs) throw new Error('source_race');
    return { buffer, stat: opened.before };
  } finally { fs.closeSync(opened.fd); }
}
function jsonWithStat(file, maximum = 65536) {
  const read = readSmall(file, maximum);
  return { ...read, value: JSON.parse(read.buffer.toString('utf8')) };
}
function atomicJson(file, value) {
  privateDirectory(path.dirname(file)); safePath(file);
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
    for (let attempt = 0;; attempt++) {
      try { fs.renameSync(temporary, file); break; }
      catch (error) {
        if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code) || attempt >= 9) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * (attempt + 1));
      }
    }
  } finally { try { fs.unlinkSync(temporary); } catch {} }
}
function commonGitDirectory(projectDir) {
  if (!path.isAbsolute(projectDir)) throw new Error('project_not_absolute');
  const project = fs.realpathSync(path.resolve(projectDir));
  if (project !== path.resolve(projectDir)) throw new Error('project_not_canonical');
  const dotgit = path.join(project, '.git');
  safePath(`${dotgit}.atlas-parent-check`);
  const gitStat = fs.lstatSync(dotgit); let gitDir;
  if (gitStat.isDirectory() && !gitStat.isSymbolicLink()) {
    safePath(path.join(dotgit, '.atlas-git-check')); gitDir = dotgit;
  }
  else if (gitStat.isFile() && !gitStat.isSymbolicLink() && gitStat.nlink === 1) {
    const text = readSmall(dotgit, 4096).buffer.toString('utf8').trim();
    const match = /^gitdir: ([^\r\n]+)$/.exec(text); if (!match) throw new Error('invalid_git_file');
    gitDir = path.resolve(project, match[1]);
  } else throw new Error('unsafe_git_metadata');
  safePath(path.join(gitDir, '.atlas-git-check'));
  const directory = fs.lstatSync(gitDir);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('unsafe_git_metadata');
  const commonFile = path.join(gitDir, 'commondir'); let common = gitDir;
  if (fs.existsSync(commonFile)) {
    const relative = readSmall(commonFile, 4096).buffer.toString('utf8').trim();
    if (!relative || relative.includes('\0')) throw new Error('invalid_git_common_dir');
    common = path.resolve(gitDir, relative);
  }
  safePath(path.join(common, '.atlas-common-check'));
  const stat = fs.lstatSync(common);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_git_common_dir');
  return { project, common: fs.realpathSync(common) };
}
function configuredProjects(root, supplied) {
  let values = supplied;
  if (values === undefined) {
    const config = jsonWithStat(path.join(root, 'monitor', 'config.json'), 65536).value;
    if (config.schema_version !== 1 || !Array.isArray(config.project_dirs)
        || config.project_dirs.length > 64 || Object.keys(config).some(key => !['schema_version', 'project_dirs'].includes(key)))
      throw new Error('invalid_monitor_config');
    values = config.project_dirs;
  }
  if (!Array.isArray(values) || values.length > 64) throw new Error('invalid_project_dirs');
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('invalid_project_dir');
    const resolved = commonGitDirectory(value);
    if (!result.some(row => row.project === resolved.project)) result.push(resolved);
  }
  return result;
}
function selectProjects(root, configured, findings) {
  const included = [], excluded = [], roots = new Map(configured.map(row => [row.common, row.project]));
  let listed;
  try { listed = entries(path.join(root, 'projects'), 1024); }
  catch { findings.push({ reason: 'project_inventory_unavailable' }); return { included, excluded }; }
  for (const entry of listed) {
    if (!entry.isDirectory() || !PROJECT.test(entry.name)) {
      findings.push({ reason: 'unsafe_project_entry' }); continue;
    }
    const registrationFile = path.join(root, 'projects', entry.name, 'project.json');
    try {
      const source = jsonWithStat(registrationFile), registration = source.value;
      if (registration.schema_version !== 1 || registration.project_id !== entry.name
          || typeof registration.project_dir !== 'string' || !path.isAbsolute(registration.project_dir)
          || digest(registration.project_dir) !== entry.name) throw new Error('invalid_registration');
      const git = commonGitDirectory(registration.project_dir), selectedRoot = roots.get(git.common);
      if (!selectedRoot) { excluded.push({ project_id: entry.name, reason: 'different_git_common_dir' }); continue; }
      included.push({ project_id: entry.name, project_dir: git.project,
        classification: git.project === selectedRoot ? 'configured_root' : 'git_worktree',
        state_dir: path.join(root, 'projects', entry.name), registration: { source, file: registrationFile } });
    } catch { excluded.push({ project_id: entry.name, reason: 'invalid_or_unprovable_registration' }); }
  }
  for (const configuredProject of configured)
    if (!included.some(row => row.project_dir === configuredProject.project))
      findings.push({ reason: 'configured_project_unregistered' });
  return { included, excluded };
}
function exportUsage(exports) {
  let total = 0;
  for (const bundle of entries(exports, MAX_ENTRIES)) {
    const directory = path.join(exports, bundle.name);
    if (!bundle.isDirectory()) throw new Error('export_capacity_scan_unsafe');
    for (const entry of entries(directory, MAX_FILES + 4)) {
      const stat = fs.lstatSync(path.join(directory, entry.name));
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('export_capacity_scan_unsafe');
      total += stat.size;
      if (!Number.isSafeInteger(total) || total >= EXPORT_LIMIT) throw new Error('export_capacity');
    }
  }
  return total;
}
function completePrefix(fd, size) {
  if (size === 0) return 0;
  let remaining = Math.min(size, MAX_LINE_TAIL), end = size;
  while (remaining > 0) {
    const length = Math.min(65536, remaining), start = end - length, buffer = Buffer.alloc(length);
    if (fs.readSync(fd, buffer, 0, length, start) !== length) throw new Error('short_read');
    const index = buffer.lastIndexOf(10);
    if (index >= 0) return start + index + 1;
    remaining -= length; end = start;
  }
  return 0;
}
function hashPrefix(fd, length, deadline) {
  const hash = crypto.createHash('sha256'), buffer = Buffer.alloc(65536); let offset = 0;
  while (offset < length) {
    if (Date.now() > deadline) throw new Error('export_timeout');
    const wanted = Math.min(buffer.length, length - offset), count = fs.readSync(fd, buffer, 0, wanted, offset);
    if (count !== wanted) throw new Error('short_read');
    hash.update(buffer.subarray(0, count)); offset += count;
  }
  return hash.digest('hex');
}
function writeSynthetic(context, descriptor, role, relative, projectId, source, value) {
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  return writeBytes(context, descriptor, role, relative, projectId, source.stat, bytes, 'complete', 'sanitized_projection');
}
function writeBytes(context, descriptor, role, relative, projectId, sourceStat, bytes, captureStatus, content) {
  if (context.files.length >= MAX_FILES) throw new Error('file_limit');
  if (context.used + context.bytes + bytes.length >= EXPORT_LIMIT) throw new Error('export_capacity');
  const extension = relative.endsWith('.jsonl') ? 'jsonl' : 'json', name = payloadName(descriptor, extension);
  if (context.names.has(name)) throw new Error('payload_name_collision');
  fs.writeFileSync(path.join(context.stage, name), bytes, { flag: 'wx', mode: 0o600 });
  context.names.add(name); context.bytes += bytes.length;
  const row = { name, source_role: role, source_relative_path: relative, project_id: projectId,
    bytes: bytes.length, source_length: Number(sourceStat?.size ?? BigInt(bytes.length)),
    source_mtime_ms: sourceStat ? Number(sourceStat.mtimeMs) : null, sha256: sha(bytes),
    capture_status: captureStatus, content };
  context.files.push(row);
  if (captureStatus !== 'complete') context.incomplete = true;
  return row;
}
function copySource(context, source) {
  let opened, destination;
  try {
    opened = ownedOpen(source.file);
    const size = Number(opened.before.size);
    if (!Number.isSafeInteger(size) || size > MAX_SOURCE_BYTES) throw new Error('source_size_limit');
    if (context.used + context.bytes + size >= EXPORT_LIMIT) throw new Error('export_capacity');
    const length = source.jsonl ? completePrefix(opened.fd, size) : size;
    const name = payloadName(source.descriptor, source.jsonl ? 'jsonl' : 'json');
    if (context.names.has(name)) throw new Error('payload_name_collision');
    destination = path.join(context.stage, name);
    const out = fs.openSync(destination, 'wx', 0o600), hash = crypto.createHash('sha256'), buffer = Buffer.alloc(65536);
    let offset = 0;
    try {
      while (offset < length) {
        if (Date.now() > context.deadline) throw new Error('export_timeout');
        const wanted = Math.min(buffer.length, length - offset), count = fs.readSync(opened.fd, buffer, 0, wanted, offset);
        if (count !== wanted || fs.writeSync(out, buffer, 0, count) !== count) throw new Error('short_copy');
        hash.update(buffer.subarray(0, count)); offset += count;
      }
      fs.fsyncSync(out);
    } finally { fs.closeSync(out); }
    const copiedHash = hash.digest('hex'), after = fs.fstatSync(opened.fd, { bigint: true });
    let current; try { current = fs.lstatSync(source.file, { bigint: true }); } catch { current = null; }
    const appendOnlyShape = source.jsonl && (after.size > opened.before.size
      || (after.size === opened.before.size && after.mtimeNs === opened.before.mtimeNs));
    const metadataOkay = sameIdentity(opened.before, after) && sameIdentity(opened.before, current)
      && (appendOnlyShape || (after.size === opened.before.size && after.mtimeNs === opened.before.mtimeNs));
    if (!metadataOkay || hashPrefix(opened.fd, length, context.deadline) !== copiedHash) throw new Error('source_race');
    const captureStatus = length === size ? 'complete' : 'incomplete_tail';
    context.names.add(name); context.bytes += length;
    context.files.push({ name, source_role: source.role, source_relative_path: source.relative,
      project_id: source.projectId, bytes: length, source_length: size,
      source_mtime_ms: Number(opened.before.mtimeMs), sha256: copiedHash,
      capture_status: captureStatus, content: 'exact_prefix' });
    if (captureStatus !== 'complete') context.incomplete = true;
  } catch (error) {
    if (destination) try { fs.unlinkSync(destination); } catch {}
    if (error.message === 'export_capacity' || error.message === 'export_timeout') throw error;
    context.incomplete = true;
    context.findings.push({ reason: error.message === 'source_race' ? 'source_race' : 'unsafe_source_entry',
      source_role: source.role });
  } finally { if (opened) fs.closeSync(opened.fd); }
}
function discover(context, directory, projectId, area) {
  if (!fs.existsSync(directory)) return;
  let listed;
  try { listed = entries(directory, 1024); }
  catch { context.incomplete = true; context.findings.push({ reason: 'source_inventory_unavailable' }); return; }
  const exact = area === 'native' ? {
    'sgsd-atlas-manifest.jsonl': 'native_partition_manifest', 'sgsd-atlas-gaps.jsonl': 'native_gap_ledger'
  } : { 'sgsd-ledger-receipts.jsonl': 'operational_receipts', 'sgsd-ledger-state.json': 'operational_state',
    'sgsd-atlas-manifest.jsonl': 'operational_partition_manifest', 'sgsd-atlas-gaps.jsonl': 'operational_gap_ledger' };
  for (const entry of listed) {
    const event = /^sgsd-atlas-events-[A-Za-z0-9._-]{1,96}\.jsonl$/.test(entry.name);
    const role = event ? `${area}_event_ledger` : exact[entry.name];
    if (!role || !entry.isFile()) {
      context.incomplete = true; context.findings.push({ reason: 'unsafe_source_entry' }); continue;
    }
    const relative = `projects/${projectId}/${area}/${entry.name}`;
    copySource(context, { file: path.join(directory, entry.name), descriptor: `${role}:${projectId}:${entry.name}`,
      role, relative, projectId, jsonl: entry.name.endsWith('.jsonl') });
  }
}
function addRunRegistrations(context, root, selected) {
  const selectedById = new Map(selected.map(row => [row.project_id, row])); let listed;
  try { listed = entries(path.join(root, 'runs'), MAX_ENTRIES); }
  catch { context.incomplete = true; context.findings.push({ reason: 'run_inventory_unavailable' }); return; }
  for (const entry of listed) {
    if (!entry.isDirectory() || !RUN.test(entry.name)) {
      context.incomplete = true; context.findings.push({ reason: 'unsafe_run_entry' }); continue;
    }
    const file = path.join(root, 'runs', entry.name, 'registration.json');
    try {
      const source = jsonWithStat(file), row = source.value;
      const project = selectedById.get(row.project_id);
      if (!project) continue;
      if (row.schema_version !== 1 || row.run_id !== entry.name || row.project_dir !== project.project_dir
          || digest(row.project_dir) !== row.project_id || !['anthropic', 'openai'].includes(row.provider)
          || !REGISTRATION_ROLES.has(row.role) || !iso(row.registered_at)
          || (row.accountingSource !== undefined
            && (row.accountingSource !== 'codex_rollout' || row.provider !== 'openai'))) throw new Error('invalid_run_registration');
      const sanitized = { schema_version: 1, project_id: row.project_id, project_dir: row.project_dir,
        run_id: row.run_id, provider: row.provider, role: row.role, registered_at: row.registered_at,
        ...(row.accountingSource === undefined ? {} : { accountingSource: row.accountingSource }) };
      writeSynthetic(context, `run_registration:${entry.name}`, 'run_registration',
        `runs/${entry.name}/registration.json`, row.project_id, source, sanitized);
    } catch { context.incomplete = true; context.findings.push({ reason: 'unsafe_run_registration' }); }
  }
}
function runAudit(root, now) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'audit.cjs'), '--root', root, '--json'],
    { encoding: 'utf8', timeout: EXPORT_TIMEOUT_MS, maxBuffer: MAX_AUDIT_BYTES });
  try {
    if (result.error || !result.stdout) throw new Error();
    const report = JSON.parse(result.stdout);
    if (report.schema_version !== 1 || !STATUS.has(report.status)) throw new Error();
    return report;
  } catch {
    return { schema_version: 1, generated_at: new Date(now).toISOString(), status: 'FAIL', complete_coverage: false,
      projects: [], findings: [{ severity: 'FAIL', reason: result.error?.code === 'ETIMEDOUT' ? 'audit_timeout' : 'audit_unavailable' }] };
  }
}
function validAudit(report) {
  return report && report.schema_version === 1 && STATUS.has(report.status) && iso(report.generated_at);
}
function auditProjection(report) {
  const sourceProjects = Array.isArray(report.projects) ? report.projects : [];
  const operations = report.operations && typeof report.operations === 'object' ? report.operations : {};
  const projection = { schema_version: 1, generated_at: report.generated_at, status: report.status,
    complete_coverage: false, projection: 'compact',
    truncated: sourceProjects.length > 256 || (Array.isArray(operations.projects) && operations.projects.length > 256),
    finding_count: Array.isArray(report.findings) ? report.findings.length : 0,
    project_count: sourceProjects.length, projects: [], operations: {
      status: STATUS.has(operations.status) ? operations.status : 'FAIL', projects: [] } };
  for (const row of sourceProjects.slice(0, 256)) {
    if (!PROJECT.test(row?.project_id || '')) { projection.truncated = true; continue; }
    projection.projects.push({ project_id: row.project_id, status: STATUS.has(row.status) ? row.status : 'unknown',
      native_rows: uint(row.rows) ? row.rows : null,
      operations_status: STATUS.has(row.operations_status) ? row.operations_status : 'unknown' });
  }
  for (const row of (Array.isArray(operations.projects) ? operations.projects : []).slice(0, 256)) {
    if (!PROJECT.test(row?.project_id || '') || !Array.isArray(row.families)) {
      projection.truncated = true; continue;
    }
    const project = { project_id: row.project_id, families: [] };
    if (row.families.length > 32) projection.truncated = true;
    for (const family of row.families.slice(0, 32)) {
      if (!atom(family?.family)) { projection.truncated = true; continue; }
      const state = ['observed', 'degraded', 'idle', 'excluded', 'unavailable'].includes(family.state)
        ? family.state : 'unavailable';
      project.families.push({ family: family.family, state,
        observations: uint(family.observations) ? family.observations : 0,
        last_observed_at: iso(family.time?.latest_observed_at) ? family.time.latest_observed_at : null,
        latest_outcome: atom(family.latest_outcome) ? family.latest_outcome : null });
      if (Buffer.byteLength(JSON.stringify(projection)) + Buffer.byteLength(JSON.stringify(project)) > 250 * 1024) {
        project.families.pop(); projection.truncated = true; break;
      }
    }
    if (!project.families.length && row.families.length) { projection.truncated = true; break; }
    projection.operations.projects.push(project);
    if (Buffer.byteLength(JSON.stringify(projection)) + 1 > 256 * 1024) {
      projection.operations.projects.pop(); projection.truncated = true; break;
    }
  }
  while (Buffer.byteLength(JSON.stringify(projection)) + 1 > 256 * 1024 && projection.projects.length) {
    projection.projects.pop();
    projection.truncated = true;
  }
  if (Buffer.byteLength(JSON.stringify(projection)) + 1 > 256 * 1024) throw new Error('audit_projection_limit');
  return projection;
}

async function createBundle(options = {}) {
  if (!options || typeof options !== 'object' || typeof options.root !== 'string') throw new Error('invalid_export_options');
  const root = path.resolve(options.root), now = asTime(options.now ?? Date.now());
  const configured = configuredProjects(root, options.projectDirs);
  const audit = validAudit(options.auditReport) ? options.auditReport : options.auditReport === undefined
    ? runAudit(root, now) : { schema_version: 1, generated_at: new Date(now).toISOString(), status: 'FAIL',
      complete_coverage: false, projects: [], findings: [{ severity: 'FAIL', reason: 'invalid_audit_report' }] };
  let auditBytes;
  try { auditBytes = Buffer.from(JSON.stringify(audit) + '\n'); }
  catch { throw new Error('invalid_audit_report'); }
  if (auditBytes.length > MAX_AUDIT_BYTES) throw new Error('audit_report_limit');
  atomicJson(path.join(root, 'monitor', 'audit.json'), auditProjection(audit));
  const exports = path.join(root, 'monitor', 'exports'); privateDirectory(exports);
  const used = exportUsage(exports);
  const id = bundleId(now), stage = path.join(exports, `.${id}.tmp`), directory = path.join(exports, id);
  if (fs.existsSync(stage) || fs.existsSync(directory)) throw new Error('bundle_already_exists');
  fs.mkdirSync(stage, { mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(stage, 0o700);
  const context = { stage, used, bytes: 0, files: [], names: new Set(), findings: [], incomplete: false,
    deadline: Date.now() + EXPORT_TIMEOUT_MS };
  try {
    const selected = selectProjects(root, configured, context.findings);
    if (context.findings.length) context.incomplete = true;
    for (const project of selected.included) {
      const source = project.registration.source;
      writeSynthetic(context, `project_registration:${project.project_id}`, 'project_registration',
        `projects/${project.project_id}/project.json`, project.project_id, source,
        { schema_version: 1, project_id: project.project_id, project_dir: project.project_dir });
      discover(context, path.join(project.state_dir, 'metrics'), project.project_id, 'native');
      discover(context, path.join(project.state_dir, 'operational'), project.project_id, 'operational');
    }
    addRunRegistrations(context, root, selected.included);
    for (const optional of [
      { file: path.join(root, 'sgsd-atlas-gaps.jsonl'), role: 'global_gap_ledger', relative: 'sgsd-atlas-gaps.jsonl' },
      { file: path.join(root, 'monitor', 'incidents.jsonl'), role: 'monitor_incidents', relative: 'monitor/incidents.jsonl' }])
      if (fs.existsSync(optional.file)) copySource(context, { ...optional, descriptor: optional.role,
        projectId: null, jsonl: true });
    writeBytes(context, 'monitor_audit', 'monitor_audit', 'monitor/audit.json', null, null,
      auditBytes, 'complete', 'generated_report');
    const body = { schema_version: 1, bundle_id: id, created_at: new Date(now).toISOString(), sealed: true,
      capture_status: context.incomplete ? 'incomplete' : 'complete', audit_status: audit.status,
      scope: { configured_project_dirs: configured.map(row => row.project),
        included_projects: selected.included.map(({ project_id, project_dir, classification }) =>
          ({ project_id, project_dir, classification })), excluded_projects: selected.excluded, exclusions: EXCLUSIONS },
      limits: { export_bytes: EXPORT_LIMIT, source_bytes: MAX_SOURCE_BYTES, files: MAX_FILES,
        deadline_ms: EXPORT_TIMEOUT_MS }, findings: context.findings, files: context.files };
    const manifest = { ...body, manifest_identity: manifestIdentity(body) };
    const manifestBytes = Buffer.from(JSON.stringify(manifest) + '\n');
    if (manifestBytes.length > MAX_MANIFEST_BYTES || used + context.bytes + manifestBytes.length >= EXPORT_LIMIT)
      throw new Error('export_capacity');
    fs.writeFileSync(path.join(stage, 'manifest.json'), manifestBytes, { flag: 'wx', mode: 0o600 });
    fs.renameSync(stage, directory);
    const verified = verifyBundle({ directory });
    return { bundle_id: id, directory, verified: verified.verified, audit_status: audit.status,
      capture_status: manifest.capture_status, manifest };
  } catch (error) {
    try { fs.writeFileSync(path.join(stage, 'incomplete.json'), JSON.stringify({ schema_version: 1,
      capture_status: 'incomplete', reason: String(error.message).slice(0, 96) }) + '\n', { flag: 'wx', mode: 0o600 }); } catch {}
    throw error;
  }
}
function validatedManifest(directory) {
  const manifestFile = path.join(directory, 'manifest.json'), read = readSmall(manifestFile, MAX_MANIFEST_BYTES);
  let manifest; try { manifest = JSON.parse(read.buffer.toString('utf8')); } catch { throw new Error('invalid_manifest'); }
  const { manifest_identity: claimed, ...body } = manifest || {};
  if (!manifest || manifest.schema_version !== 1 || !BUNDLE.test(manifest.bundle_id)
      || manifest.sealed !== true || claimed !== manifestIdentity(body)
      || !STATUS.has(manifest.audit_status) || !['complete', 'incomplete'].includes(manifest.capture_status)
      || !iso(manifest.created_at) || !Array.isArray(manifest.files) || manifest.files.length > MAX_FILES
      || !manifest.scope || !Array.isArray(manifest.scope.configured_project_dirs)
      || !Array.isArray(manifest.scope.included_projects) || !Array.isArray(manifest.scope.excluded_projects)
      || !Array.isArray(manifest.scope.exclusions) || !Array.isArray(manifest.findings)) throw new Error('invalid_manifest');
  const names = new Set(); let total = 0;
  for (const row of manifest.files) {
    if (!row || !PAYLOAD.test(row.name) || path.basename(row.name) !== row.name || names.has(row.name)
        || !ROLES.has(row.source_role) || !safeRelative(row.source_relative_path)
        || (row.project_id !== null && !PROJECT.test(row.project_id || ''))
        || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > MAX_SOURCE_BYTES
        || !Number.isSafeInteger(row.source_length) || row.source_length < 0 || row.source_length > MAX_SOURCE_BYTES
        || !['exact_prefix', 'sanitized_projection', 'generated_report'].includes(row.content)
        || (row.content === 'exact_prefix' && row.source_length < row.bytes)
        || (row.content === 'generated_report' && row.source_length !== row.bytes)
        || (row.source_mtime_ms !== null && (!Number.isFinite(row.source_mtime_ms) || row.source_mtime_ms < 0))
        || !/^[a-f0-9]{64}$/.test(row.sha256 || '')
        || !['complete', 'incomplete_tail'].includes(row.capture_status)
        || row.name !== expectedPayloadName(row)) throw new Error('invalid_manifest_file');
    names.add(row.name); total += row.bytes;
    if (!Number.isSafeInteger(total) || total >= EXPORT_LIMIT) throw new Error('invalid_manifest_bounds');
  }
  return { manifest, manifestRead: read, names, total };
}
function inspectDirectory(directory, parsed, hashPayloads) {
  const expected = new Set(['manifest.json', ...parsed.names]);
  const listed = entries(directory, MAX_FILES + 2);
  for (const entry of listed) {
    if (!expected.has(entry.name)) throw new Error('bundle_extra_entry');
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('bundle_unsafe_entry');
  }
  if (listed.length !== expected.size) throw new Error('bundle_missing_file');
  let bytes = 0;
  for (const row of parsed.manifest.files) {
    const file = path.join(directory, row.name), opened = ownedOpen(file);
    try {
      if (opened.before.size !== BigInt(row.bytes)) throw new Error('bundle_integrity_mismatch');
      if (hashPayloads && hashPrefix(opened.fd, row.bytes, Date.now() + EXPORT_TIMEOUT_MS) !== row.sha256)
        throw new Error('bundle_integrity_mismatch');
      const after = fs.fstatSync(opened.fd, { bigint: true });
      let current; try { current = fs.lstatSync(file, { bigint: true }); } catch { current = null; }
      if (!sameIdentity(opened.before, after) || !sameIdentity(opened.before, current)
          || after.size !== opened.before.size || after.mtimeNs !== opened.before.mtimeNs)
        throw new Error('bundle_integrity_race');
      bytes += row.bytes;
    } finally { fs.closeSync(opened.fd); }
  }
  return bytes;
}
function verifyBundle({ directory } = {}) {
  if (typeof directory !== 'string') throw new Error('invalid_bundle_directory');
  directory = path.resolve(directory);
  safePath(path.join(directory, '.atlas-verify-check'));
  const parsed = validatedManifest(directory), bytes = inspectDirectory(directory, parsed, true);
  const audits = parsed.manifest.files.filter(row => row.source_role === 'monitor_audit');
  if (audits.length !== 1) throw new Error('audit_status_mismatch');
  let audit;
  try { audit = JSON.parse(readSmall(path.join(directory, audits[0].name), MAX_AUDIT_BYTES).buffer.toString('utf8')); }
  catch { throw new Error('audit_status_mismatch'); }
  if (!validAudit(audit) || audit.status !== parsed.manifest.audit_status) throw new Error('audit_status_mismatch');
  return { verified: true, bundle_id: parsed.manifest.bundle_id, audit_status: parsed.manifest.audit_status,
    capture_status: parsed.manifest.capture_status, bytes,
    files: parsed.manifest.files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })) };
}
function catalogue({ root } = {}) {
  if (typeof root !== 'string') throw new Error('invalid_catalogue_root');
  root = path.resolve(root); const exports = path.join(root, 'monitor', 'exports'), bundles = [], findings = [];
  const candidates = entries(exports, MAX_ENTRIES).filter(entry => BUNDLE.test(entry.name) && entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name)).slice(-128);
  for (const entry of candidates) {
    const directory = path.join(exports, entry.name);
    try {
      const parsed = validatedManifest(directory), payloadBytes = inspectDirectory(directory, parsed, false);
      if (parsed.manifest.bundle_id !== entry.name) throw new Error('bundle_directory_mismatch');
      bundles.push({ bundle_id: entry.name, remote_directory: `${root}/monitor/exports/${entry.name}`,
        bytes: parsed.manifestRead.buffer.length + payloadBytes, audit_status: parsed.manifest.audit_status,
        capture_status: parsed.manifest.capture_status,
        manifest: { name: 'manifest.json', bytes: parsed.manifestRead.buffer.length, sha256: sha(parsed.manifestRead.buffer) },
        files: parsed.manifest.files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })) });
    } catch { findings.push({ bundle_id: entry.name, reason: 'invalid_bundle' }); }
  }
  bundles.sort((left, right) => left.bundle_id.localeCompare(right.bundle_id));
  return { schema_version: 1, generated_at: new Date().toISOString(), root, bundles, findings };
}
function argumentsFor(argv) {
  const command = argv.shift(), options = {}, projectDirs = [];
  while (argv.length) {
    const arg = argv.shift();
    if (arg === '--root' && argv.length) options.root = argv.shift();
    else if (arg === '--directory' && argv.length) options.directory = argv.shift();
    else if (arg === '--project-dir' && argv.length) projectDirs.push(argv.shift());
    else if (arg === '--now' && argv.length) options.now = argv.shift();
    else throw new Error('invalid_evidence_arguments');
  }
  if (projectDirs.length) options.projectDirs = projectDirs;
  return { command, options };
}
async function cli(argv = process.argv.slice(2)) {
  const parsed = argumentsFor([...argv]); let result;
  if (parsed.command === 'export') result = await createBundle(parsed.options);
  else if (parsed.command === 'catalogue') result = catalogue(parsed.options);
  else if (parsed.command === 'verify') result = verifyBundle(parsed.options);
  else throw new Error('invalid_evidence_command');
  process.stdout.write(JSON.stringify(result) + '\n');
  return parsed.command === 'export' ? result.audit_status === 'FAIL' ? 1 : result.audit_status === 'WARN' ? 10 : 0 : 0;
}
if (require.main === module) cli().then(code => { process.exitCode = code; }).catch(error => {
  process.stdout.write(JSON.stringify({ status: 'FAIL', reason: String(error.message).slice(0, 96) }) + '\n');
  process.exitCode = 1;
});
module.exports = Object.freeze({ createBundle, verifyBundle, catalogue, cli,
  BUNDLE_ID_PATTERN: BUNDLE, PAYLOAD_NAME_PATTERN: PAYLOAD });
