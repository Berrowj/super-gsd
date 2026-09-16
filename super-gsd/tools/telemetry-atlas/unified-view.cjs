'use strict';

// Read-only composition of the local monitor snapshot and receipt-bound peer
// bundles. This is a view projector, not a receiver or a second collector.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { safePath } = require('./contract.cjs');

const HEX = /^[a-f0-9]{64}$/;
const HOST = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/;
const ROLES = new Set(['orchestrator', 'executor', 'pm-delivery', 'pm-automation', 'deploy']);
const STALE_MS = 15 * 60 * 1000;
const MAX_PAYLOAD = 2 * 1024 * 1024;
const MAX_EVENTS = 4096;
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const nullUsage = () => ({ input_tokens: null, output_tokens: null, total_provider_tokens: null,
  cache_read_tokens: null, reasoning_tokens: null });

function trustedOrigin(origin) {
  return plain(origin) && origin.transport === 'configured_ssh' && origin.trust === 'configured_transport_and_root'
    && HOST.test(origin.host || '') && typeof origin.remote_root === 'string'
    && /^\/[A-Za-z0-9_./-]+$/.test(origin.remote_root) && !origin.remote_root.split('/').includes('..');
}

function stateAt(observedAt, now) {
  if (!iso(observedAt)) return 'unknown';
  const age = now - Date.parse(observedAt);
  return age < -60000 || age > STALE_MS ? 'stale' : 'observed';
}

function payload(bundle, row) {
  if (!bundle || typeof bundle.directory !== 'string' || !row || !/^[a-f0-9]{64}\.(?:json|jsonl)$/.test(row.name)
      || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > MAX_PAYLOAD) throw new Error('peer_payload_unreadable');
  const file = path.join(bundle.directory, row.name); safePath(file);
  const data = fs.readFileSync(file);
  if (data.length !== row.bytes) throw new Error('peer_payload_unreadable');
  return data;
}

function dedupeNativeEvents(events = []) {
  const selected = new Map(), findings = [], duplicates = [], conflicts = [];
  for (const event of events) {
    const provider = event?.runtime?.model_provider || event?.runtime?.provider;
    const responseId = event?.identity?.response_id;
    if (typeof provider !== 'string' || !provider || typeof responseId !== 'string' || !responseId) {
      findings.push({ reason: 'native_identity_unknown' }); continue;
    }
    const key = `${provider}:${responseId}`, fingerprint = sha(event), prior = selected.get(key);
    if (!prior) { selected.set(key, { ...event, provider, response_id: responseId, fingerprint }); continue; }
    if (prior.fingerprint === fingerprint) duplicates.push({ provider, response_id: responseId });
    else conflicts.push({ provider, response_id: responseId, reason: 'native_identity_integrity_conflict' });
  }
  return { events: [...selected.values()], findings, duplicates, conflicts };
}

function usage(events) {
  const result = nullUsage();
  for (const event of events) for (const name of Object.keys(result)) {
    const value = event.usage?.[name];
    if (Number.isSafeInteger(value) && value >= 0) result[name] = (result[name] || 0) + value;
  }
  return result;
}

function addObservation(target, value, origin, observedAt, now, bundleId) {
  if (!plain(value)) return;
  const kind = value.scope === 'supervised_coordination' ? 'coordination'
    : value.run_id ? 'run' : value.project_id ? 'project' : null;
  if (!kind) return;
  const role = value.role || (kind === 'project' ? 'project' : null);
  if (kind !== 'project' && !ROLES.has(role)) return;
  target.push({ kind, source: 'peer', provenance: 'verified_peer_bundle', bundle_id: bundleId,
    origin: { host: origin.host, remote_root: origin.remote_root, transport: origin.transport },
    project_id: HEX.test(value.project_id || '') ? value.project_id : null,
    run_id: typeof value.run_id === 'string' ? value.run_id : null,
    coordination_id: HEX.test(value.coordination_id || '') ? value.coordination_id : null,
    role, observed_at: iso(observedAt) ? observedAt : null, state: stateAt(observedAt, now) });
}

function peerData(peerBundles, now, findings) {
  const observations = [], events = [], acceptedBundles = [];
  for (const bundle of Array.isArray(peerBundles) ? peerBundles : []) {
    if (!plain(bundle) || !trustedOrigin(bundle.origin) || bundle.verified?.verified !== true
        || !plain(bundle.manifest) || !Array.isArray(bundle.manifest.files)) {
      findings.push({ reason: 'peer_origin_untrusted' }); continue;
    }
    acceptedBundles.push({ bundle_id: bundle.bundle_id, origin: bundle.origin,
      capture_status: bundle.manifest.capture_status, audit_status: bundle.manifest.audit_status });
    for (const row of bundle.manifest.files) {
      if (!['coordination_registration', 'run_registration', 'project_registration', 'coordination_event_ledger'].includes(row.source_role)) continue;
      try {
        const text = payload(bundle, row).toString('utf8');
        if (row.source_role === 'coordination_event_ledger') {
          for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            if (events.length >= MAX_EVENTS) { findings.push({ reason: 'peer_event_limit' }); break; }
            try { events.push(JSON.parse(line)); } catch { findings.push({ reason: 'peer_event_malformed' }); }
          }
        } else addObservation(observations, JSON.parse(text), bundle.origin,
          JSON.parse(text).registered_at, now, bundle.bundle_id);
      } catch { findings.push({ reason: 'peer_payload_unreadable' }); }
    }
  }
  return { observations, events, acceptedBundles };
}

function localData(snapshot, now) {
  const observations = [];
  for (const project of Array.isArray(snapshot?.projects) ? snapshot.projects : []) {
    const observedAt = project.native?.last_received_at || project.operational?.last_received_at || snapshot.generated_at;
    observations.push({ kind: 'project', source: 'local', provenance: 'local_monitor_snapshot',
      project_id: HEX.test(project.project_id || '') ? project.project_id : null, run_id: null,
      coordination_id: null, role: 'project', project_dir: project.project_dir || null,
      observed_at: iso(observedAt) ? observedAt : null, state: stateAt(observedAt, now),
      classification: project.classification || 'unknown' });
    for (const run of Array.isArray(project.runs) ? project.runs : []) {
      observations.push({ kind: 'run', source: 'local', provenance: 'local_monitor_snapshot',
        project_id: HEX.test(project.project_id || '') ? project.project_id : null,
        run_id: typeof run.run_id === 'string' ? run.run_id : null, coordination_id: null,
        role: ROLES.has(run.role) ? run.role : 'unknown', project_dir: project.project_dir || null,
        observed_at: iso(run.last_received_at) ? run.last_received_at : null,
        state: stateAt(run.last_received_at, now), classification: project.classification || 'unknown' });
    }
  }
  return observations;
}

function roleCoverage(observations, key, fallback = 'unknown') {
  const match = key === 'root' ? observations.find(row => row.source === 'local' && row.role === 'orchestrator')
    : key === 'pm_delivery' ? observations.find(row => row.source === 'peer' && row.role === 'pm-delivery')
    : observations.find(row => row.role === 'executor');
  return match ? { status: match.state, source: match.source, provenance: match.provenance,
    observed_at: match.observed_at, run_id: match.run_id, coordination_id: match.coordination_id }
    : { status: fallback, source: null, provenance: null, observed_at: null, run_id: null, coordination_id: null };
}

function buildUnifiedView({ localSnapshot = {}, peerBundles = [], peerFindings = [], now = Date.now() } = {}) {
  const findings = Array.isArray(peerFindings) ? peerFindings.slice(0, 64) : [];
  const local = localData(localSnapshot, now), peer = peerData(peerBundles, now, findings);
  const deduped = dedupeNativeEvents(peer.events);
  findings.push(...deduped.findings, ...deduped.conflicts.map(row => ({ ...row })));
  const all = [...local, ...peer.observations];
  const rootApi = { status: 'unknown', reason: 'root_api_identity_unobserved', ...nullUsage() };
  const peerApi = deduped.events.length ? { status: 'observed', reason: 'verified_peer_native_events',
    events: deduped.events.length, ...usage(deduped.events) } : { status: 'unknown', reason: 'peer_native_usage_unobserved', events: 0, ...nullUsage() };
  const peerOffline = !peer.acceptedBundles.length && findings.some(row => ['peer_copy_unverified', 'peer_origin_unconfigured'].includes(row.reason));
  return { schema_version: 1, generated_at: new Date(now).toISOString(), complete_coverage: false,
    status: findings.length || deduped.duplicates.length || deduped.conflicts.length ? 'WARN' : 'PASS',
    local_observations: local, peer_observations: peer.observations, peer_bundles: peer.acceptedBundles,
    source_status: { local: local.length ? 'observed' : 'unknown', peer: peer.acceptedBundles.length ? 'observed' : peerOffline ? 'offline' : 'unknown' },
    coverage: { root: roleCoverage(all, 'root'), pm_delivery: roleCoverage(all, 'pm_delivery', peerOffline ? 'offline' : 'unknown'),
      worker: roleCoverage(all, 'worker', peerOffline ? 'offline' : 'unknown') },
    api_usage: { root: rootApi, peer: peerApi },
    dedup: { accepted: deduped.events.length, duplicates: deduped.duplicates.length, conflicts: deduped.conflicts.length },
    findings: findings.length ? findings : [{ severity: 'WARN', reason: 'unified_view_partial' }] };
}

module.exports = Object.freeze({ buildUnifiedView, dedupeNativeEvents, trustedOrigin });
