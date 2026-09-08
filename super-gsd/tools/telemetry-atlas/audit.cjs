#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { canonicalize, digest, scan, validate, validConflict, safePath, fileDigest } = require('./contract.cjs');
const { readJson, readRun, RUN } = require('./global-store.cjs');
const { rootPath, status } = require('./global.cjs');
const { NATIVE_SOURCE, classifyAccounting } = require('./accounting.cjs');
function names(directory, max = 10000) {
  safePath(path.join(directory, '.atlas-read-check'));
  if (!fs.existsSync(directory)) return [];
  const entries = []; const stream = fs.opendirSync(directory);
  try { let entry; while ((entry = stream.readSync())) { if (entries.length >= max) throw new Error('audit_limit'); entries.push(entry); } }
  finally { stream.closeSync(); }
  return entries;
}
async function audit({ root = rootPath(), now = Date.now() } = {}) {
  root = path.resolve(root);
  const result = { schema_version: 1, generated_at: new Date(now).toISOString(), root,
    status: 'WARN', service: null, projects: [], findings: [], complete_coverage: false };
  const finding = (severity, reason, evidence) => result.findings.push({ severity, reason, evidence });
  const severity = () => result.findings.some(row => row.severity === 'FAIL') ? 'FAIL'
    : result.findings.some(row => row.severity === 'WARN') ? 'WARN' : 'PASS';
  result.service = await status(root);
  if (!result.service) finding('WARN', 'service_unavailable', path.join(root, 'service.json'));
  if (fs.existsSync(path.join(root, 'disabled'))) finding('WARN', 'collection_disabled', path.join(root, 'disabled'));
  const runs = new Map();
  try {
    for (const entry of names(path.join(root, 'runs'))) {
      if (!entry.isDirectory() || !RUN.test(entry.name)) { finding('WARN', 'unexpected_run_entry', path.join(root, 'runs', entry.name)); continue; }
      const run = readRun(root, entry.name);
      if (!run) { finding('FAIL', 'invalid_run_registration', path.join(root, 'runs', entry.name)); continue; }
      let pending = 0, oldest = null;
      for (const file of names(path.join(run.state_dir, 'quota-spool'), 512)) {
        const target = path.join(run.state_dir, 'quota-spool', file.name);
        if (!file.isFile() || !/^[a-f0-9]{64}\.json$/.test(file.name)) { finding('FAIL', 'unsafe_spool_entry', target); continue; }
        safePath(target); const stat = fs.statSync(target); pending++;
        oldest = Math.max(oldest || 0, (now - stat.mtimeMs) / 1000);
      }
      runs.set(run.run_id, { ...run, pending, oldest, requests: 0, responses: 0, native_events: 0,
        missing_identity: 0, closed: false, last_event: null, last_request: null, quota_windows: new Set() });
    }
  } catch (error) { finding('WARN', error.message === 'audit_limit' ? 'audit_limit' : 'registration_scan_unavailable', path.join(root, 'runs')); }
  let totalBytes = 0; let totalRows = 0;
  const nativeResponses = new Map();
  try {
    for (const entry of names(path.join(root, 'projects'), 1024)) {
      const directory = path.join(root, 'projects', entry.name);
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) { finding('FAIL', 'invalid_project_entry', directory); continue; }
      let project;
      try { project = readJson(path.join(directory, 'project.json')); if (project.project_id !== entry.name || digest(project.project_dir) !== entry.name) throw new Error(); }
      catch { finding('FAIL', 'invalid_project_registration', directory); continue; }
      const summary = { project_id: entry.name, project: project.project_dir, evidence: path.join(directory, 'metrics'),
        rows: 0, duplicates: 0, conflicts: 0, invalid: 0, runs: [] };
      const manifestPath = path.join(summary.evidence, 'sgsd-atlas-manifest.jsonl');
      if (fs.existsSync(manifestPath)) {
        safePath(manifestPath);
        if (fs.statSync(manifestPath).size > 1024 * 1024) throw new Error('audit_limit');
        const manifest = scan(manifestPath, row => {
          if (row.schema_version !== 1 || !/^[A-Za-z0-9._-]{1,96}$/.test(row.partition_id || '')
              || !['open','closed'].includes(row.action)) { finding('FAIL', 'invalid_partition_manifest', manifestPath); return; }
          if (row.action !== 'closed') return;
          const ledger = path.join(summary.evidence, `sgsd-atlas-events-${row.partition_id}.jsonl`);
          safePath(ledger);
          if (!fs.existsSync(ledger)) {
            // Quota-first rotation can close the still-empty initial partition.
            if (row.bytes !== 0 || row.sha256 !== fileDigest(ledger)) finding('FAIL', 'closed_partition_integrity', ledger);
            return;
          }
          const info = fs.statSync(ledger);
          if (info.size > 128 * 1024 * 1024) throw Object.assign(new Error('audit_limit'), { code: 'INDEX_LIMIT' });
          if (!Number.isSafeInteger(row.bytes) || row.bytes !== info.size
              || !/^[a-f0-9]{64}$/.test(row.sha256 || '') || fileDigest(ledger) !== row.sha256)
            finding('FAIL', 'closed_partition_integrity', ledger);
        });
        if (manifest.corrupt || manifest.malformed_tail) finding('FAIL', 'invalid_partition_manifest', manifestPath);
      }
      const seen = new Map(); const conflictRows = [];
      for (const file of names(summary.evidence, 512).filter(file => /^sgsd-atlas-events-.*\.jsonl$/.test(file.name))) {
        const target = path.join(summary.evidence, file.name);
        if (!file.isFile()) { finding('FAIL', 'unsafe_ledger_entry', target); continue; }
        safePath(target); const before = fs.statSync(target);
        totalBytes += before.size;
        if (totalBytes > 512 * 1024 * 1024) throw new Error('audit_limit');
        const parsed = scan(target, row => {
          if (++totalRows > 250000) throw Object.assign(new Error('audit_limit'), { code: 'INDEX_LIMIT' });
          summary.rows++;
          if (row.event_type === 'integrity_conflict') {
            summary.conflicts++; if (!validConflict(row)) summary.invalid++; else conflictRows.push(row); return;
          }
          const { event_id, payload_sha256, ingested_at, ...event } = row;
          if (validate(event) || !Number.isFinite(Date.parse(ingested_at))) { summary.invalid++; return; }
          const canonical = canonicalize(event, ingested_at);
          if (canonical.event_id !== event_id || canonical.payload_sha256 !== payload_sha256) {
            summary.invalid++;
            if (seen.has(event_id)) summary.duplicates++;
            return;
          }
          if (seen.has(event_id)) summary.duplicates++;
          seen.set(event_id, payload_sha256);
          const run = runs.get(event.identity?.sgsd_run_id);
          if (!run || run.project_id !== project.project_id || event.scope?.launcher_repo_id !== project.project_id) { summary.invalid++; return; }
          const accounting = classifyAccounting(event, run);
          if (accounting.reason) { summary.invalid++; return; }
          if (accounting.eligible && event.source.kind === NATIVE_SOURCE) {
            const previous = nativeResponses.get(event_id);
            if (previous && previous.project_id !== summary.project_id) {
              previous.invalid++; summary.invalid++;
              finding('FAIL', 'cross_project_native_response_reuse', summary.evidence);
            } else nativeResponses.set(event_id, summary);
          }
          const timestamp = Date.parse(event.occurred_at);
          run.last_event = Math.max(run.last_event || 0, timestamp);
          if (accounting.nativeEvent) run.native_events++;
          if (accounting.nativeObserved) {
            if (accounting.granularity === 'response_completion') { run.responses++; run.missing_identity++; }
            else run.requests++;
            run.last_request = Math.max(run.last_request || 0, timestamp);
          }
          if (event.source?.completeness_reason === 'missing_stable_request_identity') run.missing_identity++;
          if (event.source?.completeness_reason === 'launcher_session_exit') run.closed = true;
          if (event.event_type === 'quota') run.quota_windows.add(event.quota?.window);
        });
        if (parsed.corrupt) finding('FAIL', 'malformed_ledger_rows', target);
        if (parsed.malformed_tail) finding('WARN', 'incomplete_ledger_tail', target);
        if (fs.statSync(target).size !== before.size) finding('WARN', 'ledger_changed_during_audit', target);
      }
      for (const row of conflictRows) if (seen.get(row.conflicting_event_id) !== row.first_payload_sha256) summary.invalid++;
      if (summary.invalid) finding('FAIL', 'schema_checksum_or_attribution_error', summary.evidence);
      if (summary.duplicates) finding('FAIL', 'duplicate_canonical_events', summary.evidence);
      if (summary.conflicts) finding('WARN', 'integrity_conflicts', summary.evidence);
      for (const run of runs.values()) if (run.project_id === entry.name) {
        const coverage = run.requests || run.responses ? 'observed' : run.native_events ? 'partial' : 'unavailable';
        summary.runs.push({ run_id: run.run_id, provider: run.provider, role: run.role, registered_at: run.registered_at,
          state: run.closed ? 'closed' : 'open_or_exit_unobserved', coverage, native_events: run.native_events,
          requests: run.requests, responses: run.responses, accounting_source: run.accountingSource || 'legacy',
          last_event: run.last_event ? new Date(run.last_event).toISOString() : null,
          quota_windows: [...run.quota_windows], pending_spool: run.pending });
        if (!run.requests && !run.responses) finding('WARN', 'native_request_coverage_unavailable', run.state_dir);
        if (run.missing_identity) finding('WARN', 'provider_request_identity_unavailable', run.state_dir);
        if (!run.closed && run.last_request && now - run.last_request > 900000) finding('WARN', 'requests_stale_or_session_idle', run.state_dir);
        if (run.provider === 'anthropic' && run.quota_windows.size < 2) finding('WARN', 'quota_window_coverage_partial', run.state_dir);
        if (run.pending && run.oldest > 120) finding('WARN', 'spool_backlog_stale', run.state_dir);
      }
      result.projects.push(summary);
      const gaps = path.join(summary.evidence, 'sgsd-atlas-gaps.jsonl');
      if (fs.existsSync(gaps)) finding('WARN', 'project_capture_gaps_recorded', gaps);
    }
  } catch (error) { finding('WARN', error.message === 'audit_limit' ? 'audit_limit' : 'ledger_scan_unavailable', root); }
  if (!result.projects.length) finding('WARN', 'no_registered_projects', root);
  const globalGaps = path.join(root, 'sgsd-atlas-gaps.jsonl');
  if (fs.existsSync(globalGaps)) finding('WARN', 'global_capture_gaps_recorded', globalGaps);
  result.status = severity();
  result.note = 'Observed request or response-completion events prove partial capture, not exhaustive provider reconciliation. Response IDs are not HTTP request IDs. Cross-project response reuse is unsafe to sum. Account quotas are not summed across projects. Legacy project-stack ledgers are separate.';
  // Expose health metadata, not process arguments or provider content.
  if (result.service) result.service = { healthy: true, pid: result.service.pid, urls: result.service.urls, coverage: result.service.health.coverage };
  return result;
}
if (require.main === module) {
  const index = process.argv.indexOf('--root');
  audit({ root: index < 0 ? rootPath() : process.argv[index + 1] }).then(result => {
    process.stdout.write(JSON.stringify(result, null, process.argv.includes('--json') ? 0 : 2) + '\n');
    process.exitCode = result.status === 'FAIL' ? 1 : result.status === 'WARN' ? 10 : 0;
  }).catch(() => { process.stdout.write('{"status":"FAIL","reason":"audit_unavailable"}\n'); process.exitCode = 1; });
}
module.exports = { audit };
