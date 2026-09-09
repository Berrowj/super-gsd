#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore, digest, safePath, validate } = require('./contract.cjs');
const { NATIVE_SOURCE, classifyAccounting } = require('./accounting.cjs');
const { normalizeLogs, normalizeMetrics, canonicalClaudeLogs, canonicalClaudeMetrics, modelFamily } = require('./otlp.cjs');
const { normalizeLogs: normalizeCodexLogs } = require('./codex-otlp.cjs');

function json(response, status, value) {
  if (response.destroyed || response.writableEnded) return;
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body), 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...(status >= 400 ? { connection: 'close' } : {}) });
  response.end(body);
}
function boundary(request, response) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
      || request.headers.origin !== undefined || request.headers['sec-fetch-site'] === 'cross-site') {
    json(response, 403, { status: 'rejected', reason: 'loopback_only' }); return false;
  }
  return true;
}
function bounded(value, fallback, min, max) { return Number.isInteger(value) && value >= min && value <= max ? value : fallback; }
const STORAGE_FAILURES = new Set(['disk_pressure', 'writer_locked', 'storage_unavailable',
  'canonical_size_limit', 'index_limit', 'concurrent_writer_or_modified_ledger',
  'malformed_tail', 'corrupt_ledger', 'corrupt_manifest', 'closed_partition_integrity',
  'concurrent_partition_writer', 'writer_lock_unverifiable']);
const retryable = result => result.status === 'rejected' && STORAGE_FAILURES.has(result.reason);
function readBody(request, maximum, timeout) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let finished = false;
    const chunks = [];
    const finish = (code, body) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      request.removeListener('data', data); request.removeListener('end', end);
      request.removeListener('aborted', aborted);
      if (code) { request.pause(); reject(Object.assign(new Error(code), { code })); }
      else resolve(body);
    };
    const timer = setTimeout(() => finish('request_timeout'), timeout);
    const data = (chunk) => { size += chunk.length; if (size > maximum) finish('body_too_large'); else chunks.push(chunk); };
    const end = () => finish(null, Buffer.concat(chunks).toString('utf8'));
    const aborted = () => finish('request_aborted');
    request.on('data', data); request.once('end', end); request.once('aborted', aborted);
    request.once('error', aborted);
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > maximum) finish('body_too_large');
  });
}
function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(server.address()); });
  });
}
function closeServer(server, graceMs = 1000) {
  return new Promise(resolve => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; clearTimeout(force); clearTimeout(bound); resolve(); } };
    const force = setTimeout(() => server.closeAllConnections(), graceMs);
    const bound = setTimeout(done, graceMs + 250);
    server.close(done); server.closeIdleConnections?.();
  });
}
function metricLine(name, labels, value) {
  // All label values originate in fixed vocabularies; identities never enter this map.
  const keys = Object.entries(labels).map(([key, item]) => `${key}="${item}"`).join(',');
  return `${name}${keys ? `{${keys}}` : ''} ${value}`;
}

async function startServer(options = {}) {
  const host = options.host || '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1') throw new Error('telemetry_atlas_requires_loopback');
  const projectDir = path.resolve(options.projectDir || process.cwd());
  const instanceId = options.instanceId || crypto.randomUUID();
  if (typeof instanceId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(instanceId)) throw new Error('invalid_instance_id');
  const projectId = digest(projectDir);
  const store = options.store || createStore(options.partitionId ? {
    ledgerPath: path.join(projectDir, '.planning', 'metrics', `sgsd-atlas-events-${String(options.partitionId).replace(/[^a-zA-Z0-9._-]/g, '_')}.jsonl`),
    gapPath: path.join(projectDir, '.planning', 'metrics', 'sgsd-atlas-gaps.jsonl'), ...options.storeOptions,
  } : { projectDir, ...options.storeOptions });
  const maxBody = bounded(options.maxBodyBytes, 1024 * 1024, 128, 4 * 1024 * 1024);
  const timeout = bounded(options.requestTimeoutMs, 2000, 50, 10000);
  const concurrency = bounded(options.maxConcurrentRequests, 8, 1, 32);
  const counters = { accepted: 0, duplicate: 0, conflict: 0, rejected: 0 };
  const coverage = { native_requests: 'unavailable', native_metrics: 'unavailable',
    native_responses: 'unavailable', rejected_native_responses: 0,
    missing_stable_identity: 0, rejected_native_records: 0, quota_spool_rejected: 0 };
  const native = new Map();
  const requestTokens = new Map();
  let active = 0;
  let ready = false;
  let closed = false;
  let requestSeen = false;
  let responseSeen = false;
  const startedAt = new Date().toISOString();
  function updateCoverage() {
    coverage.native_requests = coverage.rejected_native_records ? 'partial' : requestSeen ? 'observed' : 'unavailable';
    coverage.native_responses = coverage.rejected_native_responses ? 'partial' : responseSeen ? 'observed' : 'unavailable';
  }
  function ingest(event, intake) {
    const result = store.ingest(event, intake);
    // Global intake may suppress a non-authoritative source. Use its post-authority
    // decision, never the original HTTP/spool input, for both health and totals.
    const accounting = result.accounting || classifyAccounting(event);
    if (Object.hasOwn(counters, result.status)) counters[result.status]++;
    if (['accepted', 'duplicate'].includes(result.status) && accounting.nativeObserved) {
      if (accounting.granularity === 'response_completion') responseSeen = true;
      else requestSeen = true;
    }
    if (event.source?.kind === NATIVE_SOURCE && ['rejected', 'conflict'].includes(result.status)) coverage.rejected_native_responses++;
    updateCoverage();
    if (result.status === 'accepted' && accounting.eligible) {
      for (const token of ['input', 'output', 'cache_read', 'cache_creation', 'reasoning']) {
        const amount = accounting.usage?.[`${token}_tokens`];
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) continue;
        const labels = { provider: ['anthropic','openai'].includes(accounting.provider) ? accounting.provider : 'unknown', model_family: modelFamily(accounting.model), token_type: token };
        const key = JSON.stringify(labels);
        const value = (requestTokens.get(key)?.amount || 0) + amount;
        if (Number.isFinite(value)) requestTokens.set(key, { labels, amount: value });
      }
    }
    return result;
  }
  const ingestServer = http.createServer(async (request, response) => {
    if (!boundary(request, response)) return;
    const route = options.resolveRoute ? options.resolveRoute(request.url) : null;
    if (options.resolveRoute && !route) { json(response, 403, { reason: 'unregistered_run' }); return; }
    const pathname = route?.pathname || request.url;
    const scoped = event => options.scopeEvent ? options.scopeEvent(event, route) : event;
    if (request.method !== 'POST' || !['/v1/events', '/v1/logs', '/v1/metrics'].includes(pathname)) {
      json(response, 404, { reason: 'not_found' }); return;
    }
    if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] || '') || request.headers['content-encoding']) {
      json(response, 415, { reason: 'json_required' }); return;
    }
    if (active >= concurrency) { json(response, 429, { reason: 'receiver_busy' }); return; }
    active++;
    try {
      const raw = await readBody(request, maxBody, timeout);
      let value;
      try { value = JSON.parse(raw); } catch { json(response, 400, { status: 'rejected', reason: 'invalid_json' }); counters.rejected++; return; }
      if (pathname === '/v1/logs') {
        let normalized;
        try { normalized = route?.provider === 'openai' ? normalizeCodexLogs(value) : normalizeLogs(value); } catch { counters.rejected++; json(response, 400, { reason: 'invalid_otlp' }); return; }
        let rejected = normalized.rejected;
        let retry = false;
        counters.rejected += rejected;
        coverage.missing_stable_identity += normalized.missing_stable_identity;
        for (const event of normalized.events) {
          const result = ingest(scoped(event));
          if (retryable(result)) retry = true;
          if (result.status === 'rejected') rejected++;
        }
        coverage.rejected_native_records += rejected;
        updateCoverage();
        if (rejected && typeof store.gap === 'function') store.gap(normalized.missing_stable_identity ? 'missing_stable_identity' : 'native_record_rejected');
        // A failed append must retain the Collector's bounded queued batch. Rows
        // already appended are no-ops when that batch is retried.
        if (retry) { json(response, 503, { reason: 'storage_unavailable' }); return; }
        json(response, 200, { partialSuccess: { rejectedLogRecords: rejected } }); return;
      }
      if (pathname === '/v1/metrics') {
        let normalized;
        try { normalized = normalizeMetrics(value); } catch { counters.rejected++; json(response, 400, { reason: 'invalid_otlp' }); return; }
        for (const observation of normalized.observations) native.set(JSON.stringify([observation.kind, observation.labels]), observation);
        counters.rejected += normalized.rejected;
        coverage.native_metrics = normalized.rejected ? 'partial' : native.size ? 'observed' : 'unavailable';
        json(response, 200, { partialSuccess: { rejectedDataPoints: normalized.rejected } }); return;
      }
      if (value?.source?.kind === NATIVE_SOURCE) {
        counters.rejected++; json(response, 400, { status: 'rejected', reason: 'native_private_spool_required' }); return;
      }
      const result = ingest(scoped(value));
      json(response, retryable(result) ? 503 : result.status === 'rejected' ? 400 : 202, result);
    } catch (error) {
      counters.rejected++;
      const code = ['body_too_large', 'request_timeout', 'request_aborted'].includes(error.code) ? error.code : 'receiver_unavailable';
      json(response, code === 'body_too_large' ? 413 : code === 'request_timeout' ? 408 : 503, { status: 'rejected', reason: code });
    } finally { active--; }
  });
  const healthServer = http.createServer((request, response) => {
    if (!boundary(request, response)) return;
    if (request.method !== 'GET' || request.url !== '/health') { json(response, 404, { reason: 'not_found' }); return; }
    const state = store.status();
    json(response, ready && state.healthy ? 200 : 503, { status: ready ? state.healthy ? 'healthy' : 'degraded' : 'starting',
      schema_version: 1, pid: process.pid, instance_id: instanceId, project_id: projectId,
      root_id: projectId, runtime_fingerprint: options.runtimeFingerprint || null,
      started_at: startedAt, coverage: { ...coverage, storage: state.coverage },
      storage: { healthy: state.healthy, reason: state.reason, partition_id: state.partition_id } });
  });
  const metricsServer = http.createServer((request, response) => {
    if (!boundary(request, response)) return;
    if (request.method !== 'GET' || request.url !== '/metrics') { json(response, 404, { reason: 'not_found' }); return; }
    const lines = [];
    for (const [key, amount] of Object.entries(counters)) lines.push(`# TYPE sgsd_atlas_events_${key}_total counter`, `sgsd_atlas_events_${key}_total ${amount}`);
    lines.push('# HELP sgsd_atlas_request_tokens_total Accepted native request or response-completion tokens since receiver start; not HTTP identity or exhaustive reconciliation; unavailable dimensions are omitted.',
      '# TYPE sgsd_atlas_request_tokens_total counter');
    for (const point of requestTokens.values()) lines.push(metricLine('sgsd_atlas_request_tokens_total', point.labels, point.amount));
    for (const kind of ['token', 'cost', 'session', 'active_time']) {
      lines.push(`# HELP sgsd_atlas_native_${kind}_observation Latest bounded native point observation; not request totals or a sum across sessions.`,
        `# TYPE sgsd_atlas_native_${kind}_observation gauge`);
      for (const point of native.values()) if (point.kind === kind) lines.push(metricLine(`sgsd_atlas_native_${kind}_observation`, point.labels, point.amount));
    }
    const body = lines.join('\n') + '\n';
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4', 'content-length': Buffer.byteLength(body) }); response.end(body);
  });
  const servers = [ingestServer, healthServer, metricsServer];
  for (const server of servers) {
    server.maxConnections = 64; server.maxHeadersCount = 32;
    server.headersTimeout = 2000; server.requestTimeout = timeout + 1000; server.timeout = timeout + 1000;
    server.keepAliveTimeout = 1000;
    server.on('clientError', (_error, socket) => { if (!socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  }
  const addresses = {};
  try {
    addresses.ingest = await listen(ingestServer, options.ingestPort ?? 4319, host);
    addresses.health = await listen(healthServer, options.healthPort ?? 13134, host);
    addresses.metrics = await listen(metricsServer, options.metricsPort ?? 9465, host);
    ready = true;
  } catch (error) { await Promise.all(servers.map(server => closeServer(server, options.closeGraceMs))); throw error; }

  const ignoredSpool = new Set();
  const spoolDir = options.stateDir ? path.join(path.resolve(options.stateDir), 'quota-spool') : null;
  function drainSpool(spoolDir, route, intake) {
    if (!spoolDir || closed) return;
    let directory;
    try {
      safePath(path.join(spoolDir, '.atlas-spool-read-check'));
      const spoolStat = fs.lstatSync(spoolDir);
      if (!spoolStat.isDirectory() || spoolStat.isSymbolicLink()
          || (process.getuid && spoolStat.uid !== process.getuid())) return;
      directory = fs.opendirSync(spoolDir);
      let entry; let scanned = 0; let consumed = 0;
      while (scanned++ < 256 && consumed < 32 && (entry = directory.readSync())) {
        if (!entry.isFile() || !/^[a-f0-9]{64}(?:-[0-9]+-[a-zA-Z0-9-]+)?\.json$/.test(entry.name) || ignoredSpool.has(path.join(spoolDir, entry.name))) continue;
        consumed++;
        const file = path.join(spoolDir, entry.name);
        let nativeSource = false;
        try {
          safePath(file);
          const stat = fs.lstatSync(file);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('invalid_spool');
          const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
          let event;
          try {
            const opened = fs.fstatSync(fd);
            if (!opened.isFile() || opened.size > 4096 || opened.nlink !== 1
                || opened.dev !== stat.dev || opened.ino !== stat.ino
                || (process.getuid && opened.uid !== process.getuid())) throw new Error('invalid_spool');
            const buffer = Buffer.alloc(4097); const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
            if (length > 4096) throw new Error('invalid_spool');
            event = JSON.parse(buffer.subarray(0, length).toString('utf8'));
            const after = fs.fstatSync(fd);
            if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.nlink !== 1) throw new Error('invalid_spool');
          } finally { fs.closeSync(fd); }
          const unchanged = () => {
            safePath(file); const current = fs.lstatSync(file);
            if (current.dev !== stat.dev || current.ino !== stat.ino || current.size !== stat.size || current.mtimeMs !== stat.mtimeMs) throw new Error('invalid_spool');
          };
          unchanged();
          const statusline = event.source?.kind === 'claude_statusline' && ['quota', 'coverage'].includes(event.event_type);
          const lifecycle = event.source?.kind === 'atlas_lifecycle' && event.event_type === 'coverage';
          nativeSource = event.source?.kind === NATIVE_SOURCE;
          if (nativeSource && (!intake || !route || (process.platform !== 'win32' && (spoolStat.mode & 0o777) !== 0o700) || validate(event))) throw new Error('invalid_spool');
          if (!statusline && !lifecycle && !nativeSource) throw new Error('invalid_spool');
          let scoped;
          try { scoped = options.scopeEvent ? options.scopeEvent(event, route) : event; }
          catch { throw new Error('invalid_spool'); } // Pure scope/schema rejection is permanent, not transient I/O.
          const result = ingest(scoped, intake);
          if (['accepted', 'duplicate', 'conflict'].includes(result.status)) { unchanged(); fs.unlinkSync(file); }
          else if (retryable(result)) {
            coverage.quota_spool_rejected++;
            if (typeof store.gap === 'function') store.gap('quota_spool_storage_unavailable');
          }
          else throw new Error('invalid_spool');
        } catch (error) {
          // Invalid content is terminal; filesystem pressure and transient I/O
          // leave the private file eligible for a later bounded drain.
          if ((error.message === 'invalid_spool' || error instanceof SyntaxError) && ignoredSpool.size < 256) ignoredSpool.add(path.join(spoolDir, entry.name));
          coverage.quota_spool_rejected++;
          if (nativeSource) { coverage.rejected_native_responses++; updateCoverage(); }
          if (typeof store.gap === 'function') store.gap('quota_spool_rejected');
        }
      }
    } catch { /* Missing/private spool or temporary filesystem failure is fail-open. */ }
    finally { if (directory) directory.closeSync(); }
  }
  const sampler = spoolDir || options.spoolSources ? setInterval(() => {
    const sources = options.spoolSources ? options.spoolSources() : [{ directory: spoolDir }];
    for (const source of sources) drainSpool(source.directory, source.route, source.intake);
  }, bounded(options.spoolPollMs, 1000, 20, 1000)) : null;
  sampler?.unref();
  const url = (address) => `http://${address.address.includes(':') ? `[${address.address}]` : address.address}:${address.port}`;
  let closePromise;
  return Object.freeze({ addresses, store, instanceId, projectId,
    urls: { ingest: url(addresses.ingest), health: url(addresses.health), metrics: url(addresses.metrics) },
    close: () => {
      if (closePromise) return closePromise;
      closed = true; ready = false; if (sampler) clearInterval(sampler);
      closePromise = Promise.all(servers.map(server => closeServer(server, options.closeGraceMs)));
      return closePromise;
    },
  });
}

if (require.main === module) {
  const value = (flag, fallback) => { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : fallback; };
  startServer({ projectDir: value('--project-dir', process.cwd()), stateDir: value('--state-dir'),
    instanceId: value('--instance-id'), partitionId: value('--partition-id'),
    ingestPort: Number(value('--ingest-port', 4319)), healthPort: Number(value('--health-port', 13134)),
    metricsPort: Number(value('--metrics-port', 9465)),
  }).then((instance) => {
    process.stdout.write(JSON.stringify({ status: 'ready', pid: process.pid, instance_id: instance.instanceId, project_id: instance.projectId, urls: instance.urls }) + '\n');
    const close = async () => { await instance.close(); process.exit(0); };
    process.on('SIGINT', close); process.on('SIGTERM', close);
  }).catch(() => { process.stderr.write('telemetry_atlas_start_failed\n'); process.exit(1); });
}
module.exports = Object.freeze({ canonicalClaudeLogs, canonicalClaudeMetrics, startServer });
