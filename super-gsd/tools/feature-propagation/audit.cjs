#!/usr/bin/env node
// ============================================================================
// SGSD feature propagation audit + repair
// ============================================================================
//
// Purpose:
//   Catch the exact failure class where one repo silently misses SGSD features
//   because it has stale project-local agents, missing global SGSD agents,
//   missing Codex/VTP config defaults, stale standalone super-gsd copies, or
//   stale shell helper installs.
//
// Modes:
//   --audit        read-only, default
//   --repair-safe install/refresh global SGSD agents + project config only
//   --repair      repair-safe plus backup project-local agent shadows
//   --self-test   deterministic assertions
//
// The tool never deletes project-local agent files. Full repair moves shadowing
// files into .claude/agents/.sgsd-shadow-backup/<timestamp>/ so the global or
// canonical agent becomes visible again.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { mergeSettingsFiles } = require('../../scripts/merge-settings.js');
const witnessStore = require('../../scripts/lib/substrate-invocation-witness-store.cjs');

const CODEX_HOOK_INSTALLER = path.resolve(__dirname, '..', 'codex-hooks', 'install-hooks.cjs');
const REPO_HOOK_OVERLAY = path.resolve(__dirname, '..', '..', 'config', 'repo-settings-overlay.json');
const BROKER_RELATIVE_PATH = path.join('super-gsd', 'tools', 'substrate-capability-broker.cjs');
const P167_MARKER = '<sgsd_vtp_substrate_witness_p167>';
const P167_END_MARKER = '</sgsd_vtp_substrate_witness_p167>';

const SCHEMA_VERSION = 1;
const CODEX_MODEL = 'gpt-5.6-sol';
const CODEX_EFFORT = 'xhigh';
const DISABLED_EXECUTOR_MARKER = 'Claude executor disabled';
const REQUIRED_CLAUDE_MD_MARKERS = Object.freeze([
  { code: 'karpathy_principles_missing', text: 'Karpathy principles' },
  { code: 'dlb03_cascade_read_missing', text: 'Cascade read (DLB-03)' },
  { code: 'session_start_sgsd_recall_missing', text: 'sgsd-recall "session start current state"' },
  { code: 'planning_intent_triage_missing', text: 'Planning-intent detection' },
  { code: 'sgsd_triage_command_missing', text: '/sgsd-triage' },
  { code: 'loop_force_missing', text: 'Text-only = loop dies' },
  { code: 'golden_rule_missing', text: 'ALWAYS chain the next action as a tool call' },
  { code: 'dlb01_memory_missing', text: 'Memory Retrieval (DLB-01' },
  { code: 'sgsd_curate_missing', text: 'sgsd-curate' },
  { code: 'auto_command_missing', text: '/sgsd-orchestrate auto' },
  { code: 'codex_research_missing', text: 'Research with Codex GPT-5.5/xhigh' },
  { code: 'vtp_after_research_missing', text: 'Run VTP enrichment after research' },
  { code: 'codex_planner_missing', text: 'Dispatch Codex planning' },
  { code: 'codex_plan_review_missing', text: 'Codex plan review' },
  { code: 'board_recovery_missing', text: 'Blocker recovery policy' },
  { code: 'separate_codex_challenge_missing', text: 'separate Codex' },
]);
const REQUIRED_VTP_AGENTS = Object.freeze([
  'sgsd-vtp-enrichment.md',
  'sgsd-board-researcher.md',
]);

function buildP166LegacyPromptPatch(opts) {
  const intent = opts.intent;
  const markerSuffix = opts.markerSuffix;
  const substrateTool = opts.substrateTool;
  const p166Marker = '<sgsd_vtp_substrate_policy_p166_' + markerSuffix + '>';
  const p166T2Marker = '<sgsd_vtp_substrate_policy_p166_t2_' + markerSuffix + '>';
  return {
    p166Marker,
    p166Append: [
      '',
      p166Marker,
      '## SGSD P166 Substrate Call Policy',
      '',
      'Use Bash to write a contained JSON query input under .planning/tmp, then run:',
      'node super-gsd/scripts/lib/vtp-context-composer.cjs --prepare-substrate-call --intent ' + intent + ' --input-file <relative-json-path>',
      'Save the returned envelope to a contained <prepared-call-json-path>.',
      'Pass the returned payload verbatim to ' + substrateTool + '.',
      'Write the exact substrate_call_record to a contained <record-json-path>, then run:',
      'node super-gsd/scripts/lib/vtp-context-composer.cjs --accept-substrate-call-record --intent ' + intent + ' --prepared-call-file <prepared-call-json-path> --record-file <record-json-path>',
      'The production acceptance command must exit zero before the prompt can succeed.',
      'If preparation or acceptance fails, do not accept the substrate-backed output.',
      '</sgsd_vtp_substrate_policy_p166_' + markerSuffix + '>',
      '',
    ].join('\n'),
    p166T2Marker,
    p166T2Append: [
      '',
      p166T2Marker,
      '## SGSD P166 T2 Degraded Retrieval Policy',
      '',
      'Immediately after raw substrate transport and before synthesis, inspect top-level hits and evidence.hits. For each string hit.text longer than 16000 JavaScript characters, record its original length, truncate it in memory to its first 16000 JavaScript characters, and append degradation_notes with reason_code vtp_substrate_hit_truncated, zero-based hit_index, identity, doc_id, rel_path, chunk_id, original_chars, and retained_chars set to 16000. Resolve identity from doc_id, rel_path, chunk_id, then hit-<one-based-index>.',
      'Carry degradation_notes into the normal output and visibly name doc_id and rel_path with original and retained character counts; use an empty array when no hit was truncated. Do not retry with unfiltered arguments; do not convert truncation to failure or paste or write discarded text.',
      '</sgsd_vtp_substrate_policy_p166_t2_' + markerSuffix + '>',
      '',
    ].join('\n'),
  };
}

const REQUIRED_LEGACY_AGENT_PATCHES = Object.freeze([
  {
    name: 'gsd-planner.md',
    marker: '<sgsd_vtp_enrichment_contract>',
    ...buildP166LegacyPromptPatch({
      intent: 'planning',
      markerSuffix: 'planning',
      substrateTool: 'mcp__vtp-kb__vtp_search_substrate',
    }),
    tools: Object.freeze([
      'Bash',
      'mcp__vtp-kb__vtp_route_and_retrieve',
      'mcp__vtp-kb__vtp_search',
      'mcp__vtp-kb__vtp_search_substrate',
      'mcp__vtp-kb__vtp_search_research',
      'mcp__vtp-kb__vtp_get_document',
    ]),
    append: `

<sgsd_vtp_enrichment_contract>
## SGSD VTP / Private-KB Planning Contract

When working inside an SGSD project, read .planning/config.json before drafting
plans. If vtp_enrichment.enabled is true:

1. Look in the current phase directory for {phaseNum}-VTP-ENRICHMENT.md.
2. If present, Read it before writing plans and include VTP as a source row in
   the multi-source coverage audit.
3. If absent, do not silently continue. Return BLOCKER:
   VTP_ENRICHMENT_MISSING_BEFORE_PLANNING and ask the orchestrator to dispatch
   sgsd-vtp-enrichment, unless the prompt explicitly provides VTP_STATUS:
   unavailable_or_bypassed with a reason.
4. If the planning question involves prior-memory lookup, book/research
   precedent, project precedent, or architecture challenge, use available
   mcp__vtp-kb__* tools when exposed to this agent. If MCP tools are unavailable,
   report that as a deviation rather than inventing VTP findings.

Never claim a plan used VTP/private-KB evidence unless you read the artifact or
called an mcp__vtp-kb__* tool in this dispatch.
</sgsd_vtp_enrichment_contract>
`,
  },
  {
    name: 'gsd-phase-researcher.md',
    marker: '<sgsd_vtp_research_contract>',
    ...buildP166LegacyPromptPatch({
      intent: 'phase_research',
      markerSuffix: 'phase_research',
      substrateTool: 'mcp__vtp-kb__vtp_search_substrate',
    }),
    tools: Object.freeze([
      'Bash',
      'mcp__vtp-kb__vtp_route_and_retrieve',
      'mcp__vtp-kb__vtp_search',
      'mcp__vtp-kb__vtp_search_substrate',
      'mcp__vtp-kb__vtp_search_research',
      'mcp__vtp-kb__vtp_get_document',
    ]),
    append: `

<sgsd_vtp_research_contract>
## SGSD VTP / Private-KB Research Contract

When working inside an SGSD project with .planning/config.json
vtp_enrichment.enabled=true, include a "## VTP / Private KB Findings" section in
RESEARCH.md. Use VTP for prior-project precedent, book/research principles,
meeting-derived business context, and architecture challenge framing.

Preferred tools when available:
- mcp__vtp-kb__vtp_route_and_retrieve
- mcp__vtp-kb__vtp_search
- mcp__vtp-kb__vtp_search_substrate
- mcp__vtp-kb__vtp_search_research

If VTP MCP tools are unavailable, write "VTP unavailable in this agent context"
with the observed reason. Do not treat absence of a VTP call as evidence that no
prior knowledge exists.
</sgsd_vtp_research_contract>
`,
  },
  {
    name: 'gsd-plan-checker.md',
    marker: '<sgsd_vtp_plan_check_contract>',
    tools: Object.freeze([]),
    append: `

<sgsd_vtp_plan_check_contract>
## SGSD VTP / Private-KB Plan-Check Contract

Before scoring plans in an SGSD project, read .planning/config.json. If
vtp_enrichment.enabled=true, verify the current phase has either:

1. {phaseNum}-VTP-ENRICHMENT.md in the phase directory; or
2. an explicit VTP_STATUS unavailable_or_bypassed reason in the prompt.

If neither exists, return NOGO with blocker:
vtp_enrichment_missing_before_planning.

If the VTP artifact exists but none of the plans mention it in required reading,
context inputs, source audit, or provenance, return NOGO. Planning without
threading configured VTP evidence is a source-fidelity failure.
</sgsd_vtp_plan_check_contract>
`,
  },
]);
const CORE_CONFIG_DEFAULTS = Object.freeze({
  review_providers: Object.freeze({
    executor_provider: 'codex',
    codex_executor_model: CODEX_MODEL,
    codex_executor_reasoning_effort: CODEX_EFFORT,
  }),
  workflow: Object.freeze({
    research: true,
    triage_vtp_enrichment: true,
    planner_model: 'codex',
    planner_reasoning_effort: 'xhigh',
    plan_final_codex_review: true,
    plan_final_muda_review: true,
    auto_continue_until_roadmap_complete: true,
    planning_pipeline_enforced: true,
  }),
  vtp_enrichment: Object.freeze({
    enabled: true,
    challenger_mode: false,
    empty_hit_policy: 'continue',
    granularity: 'tier-based',
    max_queries_per_gate: 5,
    query_seed_max_tokens: 800,
  }),
});

function isoNow() {
  return new Date().toISOString();
}

function timestampSlug() {
  return isoNow().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

function homeDir() {
  return process.env.USERPROFILE || os.homedir();
}

function sgsdRoot() {
  return path.resolve(__dirname, '..', '..');
}

function norm(p) {
  return path.resolve(String(p || '')).replace(/[\\/]+$/, '').toLowerCase();
}

function exists(p) {
  try { return fs.existsSync(p); } catch (_e) { return false; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; }
}

function readJson(p) {
  try {
    const s = readText(p);
    if (!s) return null;
    return JSON.parse(s);
  } catch (_e) {
    return null;
  }
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function sha256(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  } catch (_e) {
    return null;
  }
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function definitionDigest(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(stableValue(value)), 'utf8'));
}

function atomicPrivateJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (exists(filePath) && fs.readFileSync(filePath, 'utf8') === serialized) return;
  const temporary = filePath + '.tmp';
  fs.writeFileSync(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, filePath);
  if (process.platform !== 'win32') fs.chmodSync(filePath, 0o600);
}

function atomicJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (exists(filePath) && fs.readFileSync(filePath, 'utf8') === serialized) return;
  const temporary = filePath + '.tmp';
  fs.writeFileSync(temporary, serialized, 'utf8');
  fs.renameSync(temporary, filePath);
}

function readMcpDocument(filePath) {
  if (!exists(filePath)) return { doc: {}, malformed: false };
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { doc: {}, malformed: true };
    return { doc: value, malformed: false };
  } catch (_) {
    return { doc: {}, malformed: true };
  }
}

function samePath(left, right) {
  return norm(left) === norm(right);
}

function brokerDefinition(ctx) {
  const brokerPath = path.join(ctx.projectDir, BROKER_RELATIVE_PATH);
  const manifestPath = witnessStore.resolveWitnessPaths(ctx.projectDir, process.env).upstream_manifest_path;
  return {
    command: 'node',
    args: [brokerPath, '--project-root', ctx.projectDir, '--upstream-manifest', manifestPath],
  };
}

function isBrokerDefinition(value, expected) {
  return Boolean(value && value.command === expected.command
    && Array.isArray(value.args)
    && value.args.length === expected.args.length
    && value.args.every((arg, index) => index === 0 || index === 2 || index === 4
      ? samePath(arg, expected.args[index])
      : arg === expected.args[index]));
}

function isAnyBrokerDefinition(value) {
  return Boolean(value && value.command === 'node' && Array.isArray(value.args)
    && typeof value.args[0] === 'string'
    && path.basename(value.args[0]).toLowerCase() === 'substrate-capability-broker.cjs');
}

function mcpScopeDocuments(ctx) {
  const projectPath = path.join(ctx.projectDir, '.mcp.json');
  const localPath = path.join(ctx.projectDir, '.claude', 'settings.local.json');
  const profilePath = path.join(homeDir(), '.claude.json');
  const projectRead = readMcpDocument(projectPath);
  const localRead = readMcpDocument(localPath);
  const profileRead = readMcpDocument(profilePath);
  const projectDoc = projectRead.doc;
  const localDoc = localRead.doc;
  const profileDoc = profileRead.doc;
  const projects = profileDoc.projects && typeof profileDoc.projects === 'object' && !Array.isArray(profileDoc.projects)
    ? profileDoc.projects : null;
  const projectKey = projects && Object.keys(projects).find((key) => samePath(key, ctx.projectDir));
  const scopes = [
    { id: 'local-settings', path: localPath, doc: localDoc, owner: localDoc, rank: 1, malformed: localRead.malformed },
    { id: 'project', path: projectPath, doc: projectDoc, owner: projectDoc, rank: 2, malformed: projectRead.malformed },
    { id: 'user', path: profilePath, doc: profileDoc, owner: profileDoc, rank: 3, malformed: profileRead.malformed },
  ];
  if (projectKey && projects[projectKey] && typeof projects[projectKey] === 'object') {
    scopes.unshift({ id: 'local', path: profilePath, doc: profileDoc, owner: projects[projectKey], rank: 0, malformed: profileRead.malformed });
  }
  return scopes;
}

function scopeDefinition(scope) {
  const servers = scope.owner && scope.owner.mcpServers;
  return servers && typeof servers === 'object' && !Array.isArray(servers) ? servers['vtp-kb'] : undefined;
}

function setScopeDefinition(scope, value) {
  const before = scopeDefinition(scope);
  if (value === undefined && before === undefined) return;
  if (value !== undefined && before !== undefined
      && JSON.stringify(stableValue(before)) === JSON.stringify(stableValue(value))) return;
  if (!scope.owner.mcpServers || typeof scope.owner.mcpServers !== 'object' || Array.isArray(scope.owner.mcpServers)) {
    scope.owner.mcpServers = {};
  }
  if (value === undefined) delete scope.owner.mcpServers['vtp-kb'];
  else scope.owner.mcpServers['vtp-kb'] = value;
  scope.dirty = true;
}

function saveChangedScopeDocuments(scopes, beforeByPath) {
  const written = new Set();
  for (const scope of scopes) {
    if (written.has(scope.path) || !scopes.some((candidate) => candidate.path === scope.path && candidate.dirty)) continue;
    written.add(scope.path);
    const after = JSON.stringify(scope.doc, null, 2) + '\n';
    if (after !== beforeByPath.get(scope.path)) atomicJson(scope.path, scope.doc);
  }
}

function auditClaudeSubstrateWitness(ctx) {
  const readiness = witnessStore.inspectWitnessReadiness(ctx.projectDir, process.env);
  let ready = readiness.ready;
  let reason = readiness.reason;
  const settings = readJson(path.join(ctx.projectDir, '.claude', 'settings.json'));
  const globalSettingsPath = path.join(homeDir(), '.claude', 'settings.json');
  const globalSettings = readJson(globalSettingsPath);
  const allManaged = [];
  for (const [event, entries] of Object.entries((settings && settings.hooks) || {})) {
    for (const entry of entries || []) allManaged.push({ event, entry });
  }
  const preIds = allManaged.filter(({ entry }) => entry && entry.sgsd_hook_id === witnessStore.PRE_HOOK_ID);
  const postIds = allManaged.filter(({ entry }) => entry && entry.sgsd_hook_id === witnessStore.POST_HOOK_ID);
  if (preIds.length > 1) { reason = 'pretooluse_duplicate'; ready = false; }
  else if (postIds.length > 1) { reason = 'posttooluse_duplicate'; ready = false; }
  else if (preIds.length === 1 && preIds[0].event !== 'PreToolUse') { reason = 'pretooluse_stale'; ready = false; }
  else if (postIds.length === 1 && postIds[0].event !== 'PostToolUse') { reason = 'posttooluse_stale'; ready = false; }
  if (exists(globalSettingsPath) && !globalSettings) { reason = 'global_settings_malformed'; ready = false; }
  for (const entries of Object.values((globalSettings && globalSettings.hooks) || {})) {
    if ((entries || []).some((entry) => entry && (
      entry.sgsd_hook_id === witnessStore.PRE_HOOK_ID || entry.sgsd_hook_id === witnessStore.POST_HOOK_ID
    ))) {
      reason = 'global_registration_present';
      ready = false;
      break;
    }
  }
  const installedSource = path.join(ctx.projectDir, witnessStore.HOOK_RELATIVE_PATH);
  const canonicalSource = path.join(ctx.sgsdRoot, witnessStore.HOOK_RELATIVE_PATH.replace(/^super-gsd[\\/]/, ''));
  if (!samePath(installedSource, canonicalSource)
      && (!exists(canonicalSource) || sha256(installedSource) !== sha256(canonicalSource))) {
    reason = 'source_drift';
    ready = false;
  }
  if (!readiness.ready && /stale$/.test(reason || '')) {
    const sourceDigest = sha256(installedSource);
    const managed = [];
    for (const event of ['PreToolUse', 'PostToolUse']) {
      for (const entry of ((settings && settings.hooks && settings.hooks[event]) || [])) {
        if (entry && (entry.sgsd_hook_id === witnessStore.PRE_HOOK_ID || entry.sgsd_hook_id === witnessStore.POST_HOOK_ID)) managed.push(entry);
      }
    }
    if (sourceDigest && managed.some((entry) => entry.sgsd_source_sha256 !== sourceDigest)) reason = 'source_drift';
  }
  if (reason === 'key_unavailable') {
    const keyPath = witnessStore.resolveWitnessPaths(ctx.projectDir, process.env).key_path;
    if (!exists(keyPath)) reason = 'key_missing';
    else reason = 'key_invalid';
  }
  return {
    status: ready ? 'current' : 'missing_or_stale',
    ready,
    reasons: ready ? [] : [reason],
    source_digest: readiness.source_digest || null,
    trust_level: 'local_hmac',
    enforcement_scope: 'supported_sgsd_brokered_mcp_grant',
    residual: 'same_user_can_restore_direct_mcp_or_replace_broker',
    managed_policy: 'available_on_windows_but_not_deployed_or_writable_by_current_non_admin_operator',
  };
}

function readUpstreamManifest(ctx) {
  const paths = witnessStore.resolveWitnessPaths(ctx.projectDir, process.env);
  const manifest = readJson(paths.upstream_manifest_path);
  return { paths, manifest };
}

function validateUpstreamManifest(ctx, manifest) {
  const brokerPath = path.join(ctx.projectDir, BROKER_RELATIVE_PATH);
  const hookPath = path.join(ctx.projectDir, witnessStore.HOOK_RELATIVE_PATH);
  const manifestPath = witnessStore.resolveWitnessPaths(ctx.projectDir, process.env).upstream_manifest_path;
  if (!manifest || manifest.schema_version !== witnessStore.UPSTREAM_MANIFEST_SCHEMA_VERSION
      || manifest.project_digest !== witnessStore.resolveWitnessPaths(ctx.projectDir, process.env).project_digest
      || manifest.broker_sha256 !== sha256(brokerPath)
      || manifest.witness_source_sha256 !== sha256(hookPath)
      || typeof manifest.active_scope !== 'string' || !manifest.servers || typeof manifest.servers !== 'object') {
    return 'upstream_drift';
  }
  if (process.platform !== 'win32' && exists(manifestPath) && (fs.statSync(manifestPath).mode & 0o077) !== 0) {
    return 'upstream_drift';
  }
  const active = manifest.servers[manifest.active_scope];
  if (!active) return 'upstream_missing';
  for (const entry of Object.values(manifest.servers)) {
    if (!entry || entry.transport !== 'stdio' || !entry.definition
        || definitionDigest(entry.definition) !== entry.definition_sha256) return 'upstream_drift';
  }
  return null;
}

function auditClaudeSubstrateCapability(ctx, witnessAudit) {
  const scopes = mcpScopeDocuments(ctx);
  const expected = brokerDefinition(ctx);
  const discovered = scopes.filter((scope) => scopeDefinition(scope) !== undefined);
  const reasons = [];
  if (scopes.some((scope) => scope.malformed)) reasons.push('upstream_drift');
  if (discovered.some((scope) => !isAnyBrokerDefinition(scopeDefinition(scope)))) reasons.push('direct_grant');
  if (!discovered.length) reasons.push('broker_missing');
  if (discovered.some((scope) => isAnyBrokerDefinition(scopeDefinition(scope))
      && !isBrokerDefinition(scopeDefinition(scope), expected))) reasons.push('broker_drift');
  if (discovered.some((scope) => {
    const value = scopeDefinition(scope);
    return !isAnyBrokerDefinition(value) && (!value || (value.type && value.type !== 'stdio')
      || typeof value.command !== 'string' || !Array.isArray(value.args));
  })) reasons.push('unsupported_upstream_transport');
  const targetBroker = expected.args[0];
  const sourceBroker = path.join(ctx.sgsdRoot, BROKER_RELATIVE_PATH.replace(/^super-gsd[\\/]/, ''));
  if (!exists(targetBroker)) reasons.push('broker_missing');
  else if (exists(sourceBroker) && sha256(targetBroker) !== sha256(sourceBroker)) reasons.push('broker_drift');
  const { manifest } = readUpstreamManifest(ctx);
  const manifestReason = manifest ? validateUpstreamManifest(ctx, manifest) : 'upstream_missing';
  if (manifestReason) reasons.push(manifestReason);
  if (discovered.some((scope) => isBrokerDefinition(scopeDefinition(scope), expected)) && !witnessAudit.ready) {
    reasons.push('grant_with_witness_unready');
  }
  const unique = [...new Set(reasons)];
  return {
    status: unique.length === 0 ? 'current' : 'missing_or_stale',
    ready: unique.length === 0,
    reasons: unique,
    scopes: discovered.map((scope) => scope.id),
    trust_level: 'local_hmac',
    enforcement_scope: 'supported_sgsd_brokered_mcp_grant',
    residual: 'same_user_can_restore_direct_mcp_or_replace_broker',
  };
}

function installSubstrateRuntime(ctx, actions) {
  const relatives = new Set([
    path.join('hooks', 'sgsd-substrate-invocation-witness.cjs'),
    path.join('tools', 'substrate-capability-broker.cjs'),
    path.join('scripts', 'lib', 'substrate-invocation-witness-store.cjs'),
  ]);
  const overlay = readJson(REPO_HOOK_OVERLAY) || {};
  for (const entries of Object.values(overlay.hooks || {})) {
    for (const entry of entries || []) {
      for (const hook of entry.hooks || []) {
        const script = Array.isArray(hook.args) ? hook.args[0] : null;
        if (typeof script === 'string' && /^super-gsd[\\/]/.test(script)) {
          relatives.add(script.replace(/^super-gsd[\\/]/, ''));
        }
      }
    }
  }
  for (const relative of relatives) {
    const source = path.join(ctx.sgsdRoot, relative);
    const target = path.join(ctx.projectDir, 'super-gsd', relative);
    if (!exists(source) || samePath(source, target) || sha256(source) === sha256(target)) continue;
    copyFile(source, target, actions);
  }
}

function inProcessNodeCheck(scriptPath) {
  try {
    const source = fs.readFileSync(scriptPath, 'utf8').replace(/^#![^\n]*(?:\n|$)/, '');
    Function(source);
    return { status: 0 };
  } catch (_) {
    return { status: 1 };
  }
}

function removeGlobalWitnessRegistrations(actions) {
  const settingsPath = path.join(homeDir(), '.claude', 'settings.json');
  const settings = readJson(settingsPath);
  if (exists(settingsPath) && !settings) throw new Error('global Claude settings are malformed');
  if (!settings || !settings.hooks || typeof settings.hooks !== 'object') return;
  let removed = 0;
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    settings.hooks[event] = entries.filter((entry) => {
      const witness = entry && (
        entry.sgsd_hook_id === witnessStore.PRE_HOOK_ID || entry.sgsd_hook_id === witnessStore.POST_HOOK_ID
      );
      if (witness) removed += 1;
      return !witness;
    });
  }
  if (!removed) return;
  atomicJson(settingsPath, settings);
  actions.push({ action: 'remove_global_substrate_witness_registrations', removed });
}

function repairClaudeSubstrateWitness(ctx, actions) {
  try {
    installSubstrateRuntime(ctx, actions);
    const key = witnessStore.provisionWitnessKey(ctx.projectDir, process.env);
    if (key.created) actions.push({ action: 'provision_substrate_witness_key', status: 'created' });
    removeGlobalWitnessRegistrations(actions);
    mergeSettingsFiles(
      REPO_HOOK_OVERLAY,
      path.join(ctx.projectDir, '.claude', 'settings.json'),
      ctx.projectDir,
      {
        preflightAdapters: {
          isFile: (scriptPath) => exists(scriptPath) && fs.statSync(scriptPath).isFile(),
          nodeCheck: inProcessNodeCheck,
          shellCheck: () => ({ status: 1 }),
        },
      },
    );
    actions.push({ action: 'merge_substrate_witness_hooks', target: path.join(ctx.projectDir, '.claude', 'settings.json') });
    return { ok: true, reasons: [] };
  } catch (error) {
    return { ok: false, reasons: ['witness_repair_failed'], detail: error && error.message ? error.message : 'unknown' };
  }
}

function repairClaudeSubstrateCapability(ctx, actions) {
  const scopes = mcpScopeDocuments(ctx);
  if (scopes.some((scope) => scope.malformed)) return { ok: false, reasons: ['broker_repair_failed'] };
  const beforeByPath = new Map();
  for (const scope of scopes) {
    if (!beforeByPath.has(scope.path)) beforeByPath.set(scope.path, exists(scope.path) ? readText(scope.path) : null);
  }
  const expected = brokerDefinition(ctx);
  const discovered = scopes.filter((scope) => scopeDefinition(scope) !== undefined);
  const direct = discovered.filter((scope) => !isAnyBrokerDefinition(scopeDefinition(scope)));
  const unsupported = direct.filter((scope) => {
    const definition = scopeDefinition(scope);
    return !definition || (definition.type && definition.type !== 'stdio')
      || typeof definition.command !== 'string' || !definition.command
      || !Array.isArray(definition.args) || definition.args.some((arg) => typeof arg !== 'string');
  });
  if (unsupported.length) {
    for (const scope of direct) setScopeDefinition(scope, undefined);
    saveChangedScopeDocuments(scopes, beforeByPath);
    actions.push({ action: 'withdraw_unsupported_substrate_grant', scopes: direct.map((scope) => scope.id) });
    return { ok: false, reasons: ['unsupported_upstream_transport'] };
  }

  const { paths, manifest: prior } = readUpstreamManifest(ctx);
  const manifest = prior && prior.schema_version === witnessStore.UPSTREAM_MANIFEST_SCHEMA_VERSION
    && prior.project_digest === paths.project_digest && prior.servers && typeof prior.servers === 'object'
    ? prior
    : {
      schema_version: witnessStore.UPSTREAM_MANIFEST_SCHEMA_VERSION,
      project_digest: paths.project_digest,
      broker_sha256: null,
      witness_source_sha256: null,
      active_scope: '',
      servers: {},
    };
  manifest.broker_sha256 = sha256(expected.args[0]);
  manifest.witness_source_sha256 = sha256(path.join(ctx.projectDir, witnessStore.HOOK_RELATIVE_PATH));
  if (process.platform !== 'win32' && exists(paths.upstream_manifest_path)) {
    fs.chmodSync(paths.upstream_manifest_path, 0o600);
  }
  for (const scope of direct) {
    const definition = scopeDefinition(scope);
    manifest.servers[scope.id] = {
      transport: 'stdio',
      definition,
      definition_sha256: definitionDigest(definition),
    };
  }
  if (direct.length) manifest.active_scope = [...direct].sort((a, b) => a.rank - b.rank)[0].id;
  if (!manifest.active_scope || !manifest.servers[manifest.active_scope]) {
    for (const scope of discovered) setScopeDefinition(scope, undefined);
    saveChangedScopeDocuments(scopes, beforeByPath);
    return { ok: false, reasons: ['upstream_missing'] };
  }
  const manifestReason = validateUpstreamManifest(ctx, manifest);
  if (manifestReason) {
    for (const scope of discovered) setScopeDefinition(scope, undefined);
    saveChangedScopeDocuments(scopes, beforeByPath);
    return { ok: false, reasons: [manifestReason] };
  }

  try {
    atomicPrivateJson(paths.upstream_manifest_path, manifest);
    for (const scope of scopes) {
      if (scopeDefinition(scope) !== undefined) setScopeDefinition(scope, expected);
    }
    if (!scopes.some((scope) => scopeDefinition(scope) !== undefined)) {
      const projectScope = scopes.find((scope) => scope.id === 'project');
      setScopeDefinition(projectScope, expected);
    }
    saveChangedScopeDocuments(scopes, beforeByPath);
  } catch (error) {
    for (const [filePath, bytes] of beforeByPath) {
      try {
        if (bytes === null) {
          if (exists(filePath)) fs.unlinkSync(filePath);
        } else {
          ensureDir(path.dirname(filePath));
          fs.writeFileSync(filePath, bytes, 'utf8');
        }
      } catch (_) {}
    }
    return { ok: false, reasons: ['broker_repair_failed'] };
  }
  actions.push({ action: 'broker_substrate_capability', scopes: scopes.filter((scope) => scopeDefinition(scope) !== undefined).map((scope) => scope.id) });
  return { ok: true, reasons: [] };
}

function setFrontmatterTool(source, tool, granted) {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => /^tools:\s*/.test(line));
  if (index < 0) return source;
  const tools = lines[index].replace(/^tools:\s*/, '').split(',').map((value) => value.trim()).filter(Boolean);
  const filtered = tools.filter((value) => value !== tool);
  if (granted) filtered.push(tool);
  lines[index] = 'tools: ' + filtered.join(', ');
  return lines.join('\n');
}

function canonicalAgentText(ctx, name, granted) {
  const source = readText(path.join(ctx.canonicalAgentsDir, name)) || '';
  return REQUIRED_VTP_AGENTS.includes(name)
    ? setFrontmatterTool(source, witnessStore.TARGET_TOOL, granted)
    : source;
}

function p167Contract(ctx) {
  const source = readText(path.join(ctx.canonicalAgentsDir, 'sgsd-vtp-enrichment.md')) || '';
  const start = source.indexOf(P167_MARKER);
  const end = source.indexOf(P167_END_MARKER, start);
  return start >= 0 && end >= start ? source.slice(start, end + P167_END_MARKER.length) : '';
}

function replaceMarkerBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) return source + '\n' + replacement + '\n';
  const end = source.indexOf(endMarker, start);
  if (end < 0) return source;
  return source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

function copyFile(src, dst, actions) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  actions.push({ action: 'copy', from: src, to: dst });
}

function copyDir(srcDir, dstDir, actions) {
  ensureDir(dstDir);
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(dstDir, ent.name);
    if (ent.isDirectory()) {
      copyDir(src, dst, actions);
    } else if (ent.isFile()) {
      copyFile(src, dst, actions);
    }
  }
}

function moveFile(src, dst, actions) {
  ensureDir(path.dirname(dst));
  fs.renameSync(src, dst);
  actions.push({ action: 'move', from: src, to: dst });
}

function listMarkdownFiles(dir) {
  try {
    if (!exists(dir)) return [];
    return fs.readdirSync(dir)
      .filter((n) => n.toLowerCase().endsWith('.md'))
      .sort();
  } catch (_e) {
    return [];
  }
}

function findPlanningRoot(start) {
  let cur = path.resolve(start || process.cwd());
  for (let i = 0; i < 10; i++) {
    if (exists(path.join(cur, '.planning'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(start || process.cwd());
}

function detectVtpConfigured(projectDir) {
  const candidates = [
    path.join(projectDir, '.mcp.json'),
    path.join(homeDir(), '.mcp.json'),
  ];
  for (const p of candidates) {
    const j = readJson(p);
    if (!j || !j.mcpServers) continue;
    if (Object.prototype.hasOwnProperty.call(j.mcpServers, 'vtp-kb')) {
      return { configured: true, source: p };
    }
  }
  return { configured: false, source: null };
}

function profilePaths() {
  const docs = path.join(homeDir(), 'OneDrive - John Cullen Lighting', 'Documents', 'WindowsPowerShell');
  const localDocs = path.join(homeDir(), 'Documents', 'WindowsPowerShell');
  return Array.from(new Set([
    path.join(docs, 'profile.ps1'),
    path.join(docs, 'Microsoft.PowerShell_profile.ps1'),
    path.join(localDocs, 'profile.ps1'),
    path.join(localDocs, 'Microsoft.PowerShell_profile.ps1'),
  ]));
}

function installGlobalSgsdAgents(ctx, actions, substrateGranted) {
  const canonical = ctx.canonicalAgentsDir;
  const globalDir = ctx.globalAgentsDir;
  const repaired = [];
  for (const name of listMarkdownFiles(canonical)) {
    if (!name.startsWith('sgsd-')) continue;
    const src = path.join(canonical, name);
    const dst = path.join(globalDir, name);
    const expected = canonicalAgentText(ctx, name, substrateGranted);
    if (expected && readText(dst) !== expected) {
      ensureDir(path.dirname(dst));
      fs.writeFileSync(dst, expected, 'utf8');
      actions.push({ action: 'install_agent', from: src, to: dst, substrate_granted: REQUIRED_VTP_AGENTS.includes(name) ? substrateGranted : null });
      repaired.push(name);
    }
  }
  const disabledExecutor = path.join(canonical, 'sgsd-executor.md');
  const legacyExecutor = path.join(globalDir, 'gsd-executor.md');
  if (exists(disabledExecutor) && sha256(disabledExecutor) !== sha256(legacyExecutor)) {
    copyFile(disabledExecutor, legacyExecutor, actions);
    repaired.push('gsd-executor.md');
  }
  return repaired;
}

function installGlobalSgsdSkills(ctx, actions) {
  const repaired = [];
  if (!exists(ctx.canonicalSkillsDir)) return repaired;
  for (const name of fs.readdirSync(ctx.canonicalSkillsDir).sort()) {
    if (!name.startsWith('sgsd-')) continue;
    const srcDir = path.join(ctx.canonicalSkillsDir, name);
    const srcSkill = path.join(srcDir, 'SKILL.md');
    if (!exists(srcSkill)) continue;
    const dstDir = path.join(ctx.globalCommandsDir, name);
    const dstSkill = path.join(dstDir, 'SKILL.md');
    if (sha256(srcSkill) !== sha256(dstSkill)) {
      copyDir(srcDir, dstDir, actions);
      repaired.push(name);
    }
  }
  return repaired;
}

function installGlobalLegacyAgentPatches(ctx, actions, substrateGranted) {
  const repaired = [];
  for (const spec of REQUIRED_LEGACY_AGENT_PATCHES) {
    const p = path.join(ctx.globalAgentsDir, spec.name);
    let txt = readText(p);
    if (!txt) continue;
    const original = txt;
    const desiredTools = (spec.tools || []).filter((tool) => tool !== witnessStore.TARGET_TOOL || substrateGranted);
    for (const tool of spec.tools || []) txt = setFrontmatterTool(txt, tool, desiredTools.includes(tool));

    if (txt.indexOf(spec.marker) === -1) {
      txt += spec.append;
    }
    if (spec.p166Marker && txt.indexOf(spec.p166Marker) === -1) {
      txt += spec.p166Append;
    }
    if (spec.p166T2Marker && txt.indexOf(spec.p166T2Marker) === -1) {
      txt += spec.p166T2Append;
    }
    if (spec.p166T2Marker) {
      const suffix = spec.p166T2Marker.slice(1, -1);
      const replacement = spec.p166T2Marker + '\nP167 supersedes the prompt-owned response cap. Preserve only hook-authored degradation_notes after successful production acceptance; do not manually truncate or retry raw substrate output.\n</' + suffix + '>';
      txt = replaceMarkerBlock(txt, spec.p166T2Marker, '</' + suffix + '>', replacement);
      const contract = p167Contract(ctx);
      if (contract) txt = replaceMarkerBlock(txt, P167_MARKER, P167_END_MARKER, contract);
    }
    if (txt !== original) {
      fs.writeFileSync(p, txt, 'utf8');
      actions.push({ action: 'patch_legacy_agent', to: p, substrate_granted: substrateGranted });
      repaired.push(spec.name);
    }
  }
  return repaired;
}

function auditGlobalSgsdAgents(ctx, substrateGranted) {
  const rows = [];
  for (const name of listMarkdownFiles(ctx.canonicalAgentsDir)) {
    if (!name.startsWith('sgsd-')) continue;
    const src = path.join(ctx.canonicalAgentsDir, name);
    const dst = path.join(ctx.globalAgentsDir, name);
    const expected = canonicalAgentText(ctx, name, substrateGranted);
    const srcHash = expected ? sha256Bytes(Buffer.from(expected, 'utf8')) : null;
    const dstHash = sha256(dst);
    rows.push({
      name,
      installed: Boolean(dstHash),
      drifted: Boolean(srcHash && dstHash && srcHash !== dstHash),
      required_vtp_agent: REQUIRED_VTP_AGENTS.indexOf(name) !== -1,
    });
  }
  const disabledExecutor = path.join(ctx.canonicalAgentsDir, 'sgsd-executor.md');
  const legacyExecutor = path.join(ctx.globalAgentsDir, 'gsd-executor.md');
  const legacyText = readText(legacyExecutor) || '';
  rows.push({
    name: 'gsd-executor.md',
    installed: Boolean(legacyText),
    drifted: Boolean(exists(disabledExecutor) && sha256(disabledExecutor) !== sha256(legacyExecutor)),
    required_vtp_agent: false,
    disabled_legacy_executor: legacyText.indexOf(DISABLED_EXECUTOR_MARKER) !== -1,
  });
  return rows;
}

function auditOrchestratorProtocol(ctx) {
  const skillPath = path.join(ctx.canonicalSkillsDir, 'sgsd-orchestrate', 'SKILL.md');
  const txt = readText(skillPath) || '';
  const gatesPath = path.join(ctx.sgsdRoot, 'registry', 'gates.yaml');
  const gatesTxt = readText(gatesPath) || '';
  const perDispatchBlock = (gatesTxt.match(/- name: per-dispatch-ATC[\s\S]*?(?=\n  - name:|\n#|$)/) || [''])[0];
  const phaseAtcBlock = (gatesTxt.match(/- name: phase-level-ATC[\s\S]*?(?=\n  - name:|\n#|$)/) || [''])[0];
  const missing = [];
  if (txt.indexOf('CODEX EXECUTOR HARD LOCK') === -1) missing.push('codex_executor_hard_lock_marker');
  if (txt.indexOf('Do not call Agent with subagent_type gsd-executor') === -1) missing.push('forbid_gsd_executor_agent_marker');
  if (txt.indexOf('PER-DISPATCH ATC IS MANDATORY') === -1) missing.push('mandatory_per_dispatch_atc_marker');
  if (txt.indexOf('Research with Codex GPT-5.5/xhigh') === -1) missing.push('codex_first_research_marker');
  if (txt.indexOf('Blocker Recovery Hard Loop') === -1) missing.push('blocker_recovery_hard_loop_marker');
  if (txt.indexOf('blocker-recovery-challenge') === -1) missing.push('separate_codex_blocker_challenge_marker');
  if (perDispatchBlock.indexOf('gate_sampling_tier: always') === -1) missing.push('per_dispatch_atc_sampling_always');
  if (perDispatchBlock.indexOf('classifier.atc_tier') !== -1) missing.push('per_dispatch_atc_still_tier_gated');
  if (phaseAtcBlock.indexOf('gate_sampling_tier: always') === -1) missing.push('phase_level_atc_sampling_always');
  return {
    ok: missing.length === 0,
    missing,
  };
}

function auditProjectClaudeMd(ctx) {
  const p = path.join(ctx.projectDir, 'CLAUDE.md');
  const txt = readText(p);
  const missing = [];
  if (!txt) {
    missing.push('claude_md_missing');
  } else {
    for (const spec of REQUIRED_CLAUDE_MD_MARKERS) {
      if (txt.indexOf(spec.text) === -1) missing.push(spec.code);
    }
    if (/brv-query\s+"/.test(txt) || /brv-curate\s+"/.test(txt)
        || /brv-query for each query/.test(txt)
        || /Check ByteRover/.test(txt)
        || /ByteRover Integration/.test(txt)) {
      missing.push('legacy_brv_live_commands_present');
    }
  }
  return {
    path: p,
    present: Boolean(txt),
    ok: missing.length === 0,
    missing,
  };
}

function auditGlobalLegacyAgentPatches(ctx, substrateGranted) {
  const rows = [];
  for (const spec of REQUIRED_LEGACY_AGENT_PATCHES) {
    const p = path.join(ctx.globalAgentsDir, spec.name);
    const txt = readText(p);
    const desiredTools = (spec.tools || []).filter((tool) => tool !== witnessStore.TARGET_TOOL || substrateGranted);
    const toolsLine = txt ? ((txt.match(/^tools:\s*(.*)$/m) || [])[1] || '') : '';
    const installedTools = toolsLine.split(',').map((tool) => tool.trim()).filter(Boolean);
    const missingTools = desiredTools.filter((tool) => !installedTools.includes(tool));
    rows.push({
      name: spec.name,
      installed: Boolean(txt),
      marker: spec.marker,
      patched: Boolean(txt && txt.indexOf(spec.marker) !== -1),
      p166_marker: spec.p166Marker || null,
      p166_patched: spec.p166Marker ? Boolean(txt && txt.indexOf(spec.p166Marker) !== -1) : true,
      p166_t2_marker: spec.p166T2Marker || null,
      p166_t2_patched: spec.p166T2Marker ? Boolean(txt && txt.indexOf(spec.p166T2Marker) !== -1) : true,
      p167_patched: spec.p166Marker ? Boolean(txt && txt.indexOf(P167_MARKER) !== -1) : true,
      substrate_grant_current: spec.p166Marker
        ? installedTools.includes(witnessStore.TARGET_TOOL) === substrateGranted
        : true,
      missing_tools: missingTools,
    });
  }
  return rows;
}

function auditGlobalSgsdSkills(ctx) {
  const rows = [];
  if (!exists(ctx.canonicalSkillsDir)) return rows;
  for (const name of fs.readdirSync(ctx.canonicalSkillsDir).sort()) {
    if (!name.startsWith('sgsd-')) continue;
    const srcSkill = path.join(ctx.canonicalSkillsDir, name, 'SKILL.md');
    if (!exists(srcSkill)) continue;
    const dstSkill = path.join(ctx.globalCommandsDir, name, 'SKILL.md');
    const srcHash = sha256(srcSkill);
    const dstHash = sha256(dstSkill);
    rows.push({
      name,
      installed: Boolean(dstHash),
      drifted: Boolean(srcHash && dstHash && srcHash !== dstHash),
    });
  }
  return rows;
}

function auditProjectAgentShadows(ctx) {
  const localDir = path.join(ctx.projectDir, '.claude', 'agents');
  const rows = [];
  for (const name of listMarkdownFiles(localDir)) {
    const localPath = path.join(localDir, name);
    const canonicalPath = path.join(ctx.canonicalAgentsDir, name);
    const globalPath = path.join(ctx.globalAgentsDir, name);
    const sourcePath = exists(canonicalPath) ? canonicalPath : (exists(globalPath) ? globalPath : null);
    if (!sourcePath) {
      rows.push({
        name,
        shadow_type: 'project_only',
        drifted: false,
        source: null,
      });
      continue;
    }
    rows.push({
      name,
      shadow_type: exists(canonicalPath) ? 'canonical' : 'global',
      drifted: sha256(localPath) !== sha256(sourcePath),
      source: sourcePath,
    });
  }
  return rows;
}

function backupProjectAgentShadows(ctx, shadows, actions) {
  const backupRoot = path.join(ctx.projectDir, '.claude', 'agents', '.sgsd-shadow-backup', timestampSlug());
  const moved = [];
  for (const row of shadows) {
    if (row.shadow_type === 'project_only') continue;
    const src = path.join(ctx.projectDir, '.claude', 'agents', row.name);
    if (!exists(src)) continue;
    const dst = path.join(backupRoot, row.name);
    moveFile(src, dst, actions);
    moved.push(row.name);
  }
  return moved;
}

function ensureConfigDefaults(ctx, actions, safeRepair) {
  const configPath = path.join(ctx.projectDir, '.planning', 'config.json');
  const cfg = readJson(configPath);
  if (!cfg) {
    return { present: false, changed: false, missing: ['config_json_missing_or_malformed'] };
  }

  const missing = [];
  function ensureObj(key) {
    if (!cfg[key] || typeof cfg[key] !== 'object' || Array.isArray(cfg[key])) {
      cfg[key] = {};
      missing.push(key);
    }
  }
  function setIfDifferent(obj, key, value, label) {
    if (obj[key] !== value) {
      missing.push(label || key);
      obj[key] = value;
    }
  }

  ensureObj('review_providers');
  setIfDifferent(cfg.review_providers, 'executor_provider', 'codex', 'review_providers.executor_provider');
  setIfDifferent(cfg.review_providers, 'codex_executor_model', CODEX_MODEL, 'review_providers.codex_executor_model');
  setIfDifferent(cfg.review_providers, 'codex_executor_reasoning_effort', CODEX_EFFORT, 'review_providers.codex_executor_reasoning_effort');

  ensureObj('workflow');
  setIfDifferent(cfg.workflow, 'research', true, 'workflow.research');
  setIfDifferent(cfg.workflow, 'triage_vtp_enrichment', true, 'workflow.triage_vtp_enrichment');
  setIfDifferent(cfg.workflow, 'planner_model', 'codex', 'workflow.planner_model');
  setIfDifferent(cfg.workflow, 'planner_reasoning_effort', 'xhigh', 'workflow.planner_reasoning_effort');
  setIfDifferent(cfg.workflow, 'plan_final_codex_review', true, 'workflow.plan_final_codex_review');
  setIfDifferent(cfg.workflow, 'plan_final_muda_review', true, 'workflow.plan_final_muda_review');
  setIfDifferent(cfg.workflow, 'auto_continue_until_roadmap_complete', true, 'workflow.auto_continue_until_roadmap_complete');
  setIfDifferent(cfg.workflow, 'planning_pipeline_enforced', true, 'workflow.planning_pipeline_enforced');

  const vtp = detectVtpConfigured(ctx.projectDir);
  if (vtp.configured) {
    ensureObj('vtp_enrichment');
    setIfDifferent(cfg.vtp_enrichment, 'enabled', true, 'vtp_enrichment.enabled');
    setIfDifferent(cfg.vtp_enrichment, 'challenger_mode', false, 'vtp_enrichment.challenger_mode');
    setIfDifferent(cfg.vtp_enrichment, 'empty_hit_policy', 'continue', 'vtp_enrichment.empty_hit_policy');
    setIfDifferent(cfg.vtp_enrichment, 'granularity', 'tier-based', 'vtp_enrichment.granularity');
    setIfDifferent(cfg.vtp_enrichment, 'max_queries_per_gate', 5, 'vtp_enrichment.max_queries_per_gate');
    setIfDifferent(cfg.vtp_enrichment, 'query_seed_max_tokens', 800, 'vtp_enrichment.query_seed_max_tokens');
    if (!cfg.vtp_enrichment.audit_tier_batching) {
      cfg.vtp_enrichment.audit_tier_batching = { critical: 'per-finding', pass: 'skip', warn: 'batched' };
      missing.push('vtp_enrichment.audit_tier_batching');
    }
  }

  if (missing.length > 0 && safeRepair) {
    const changedFields = missing.slice();
    writeJson(configPath, cfg);
    actions.push({ action: 'write_config_defaults', path: configPath, fields: changedFields });
    return { present: true, changed: true, missing: [], changed_fields: changedFields, vtp_configured: vtp.configured, vtp_source: vtp.source };
  }
  return { present: true, changed: false, missing, changed_fields: [], vtp_configured: vtp.configured, vtp_source: vtp.source };
}

function auditSuperGsdTree(ctx) {
  const projectSgsd = path.join(ctx.projectDir, 'super-gsd');
  if (!exists(projectSgsd)) return { present: false, stale_copy: false, target: null };
  if (norm(projectSgsd) === norm(ctx.sgsdRoot)) {
    return { present: true, stale_copy: false, target: ctx.sgsdRoot };
  }
  let projectReal = null;
  let sourceReal = null;
  try { projectReal = fs.realpathSync(projectSgsd); } catch (_e) {}
  try { sourceReal = fs.realpathSync(ctx.sgsdRoot); } catch (_e) {}
  const stale = Boolean(projectReal && sourceReal && norm(projectReal) !== norm(sourceReal));
  return { present: true, stale_copy: stale, target: projectReal || projectSgsd, canonical: sourceReal || ctx.sgsdRoot };
}

function auditTelemetry(ctx) {
  const metrics = path.join(ctx.projectDir, '.planning', 'metrics');
  const names = [
    'vtp-health.jsonl',
    'vtp-routing-log.jsonl',
    'vtp-bridge-failures.jsonl',
    'route-decisions.jsonl',
    'context-packet-log.jsonl',
    'intent-map.jsonl',
    'codex-executor-log.jsonl',
  ];
  const rows = {};
  for (const n of names) {
    const p = path.join(metrics, n);
    rows[n] = exists(p) ? { present: true, bytes: fs.statSync(p).size } : { present: false, bytes: 0 };
  }
  return rows;
}

function auditProfiles() {
  const rows = [];
  for (const p of profilePaths()) {
    const txt = readText(p) || '';
    rows.push({
      path: p,
      present: exists(p),
      has_sgsd: txt.indexOf('function sgsd') !== -1,
      has_sg: txt.indexOf('function sg') !== -1,
      has_watch_codex: txt.indexOf('function sgsd-watch-codex') !== -1,
    });
  }
  return rows;
}

function auditCodexHooks(ctx) {
  try {
    const { inspectProject } = require(CODEX_HOOK_INSTALLER);
    return inspectProject({ projectDir: ctx.projectDir });
  } catch (error) {
    return {
      ok: false,
      status: 'audit-error',
      target: path.join(ctx.projectDir, '.codex', 'hooks.json'),
      target_exists: exists(path.join(ctx.projectDir, '.codex', 'hooks.json')),
      managed_registrations: 0,
      missing: [],
      stale: [],
      duplicates: [],
      error: error.message,
      error_path: CODEX_HOOK_INSTALLER,
    };
  }
}

function mkContext(projectDir) {
  const root = sgsdRoot();
  return {
    projectDir: findPlanningRoot(projectDir || process.cwd()),
    sgsdRoot: root,
    canonicalAgentsDir: path.join(root, 'agents'),
    canonicalSkillsDir: path.join(root, 'skills'),
    globalAgentsDir: path.join(homeDir(), '.claude', 'agents'),
    globalCommandsDir: path.join(homeDir(), '.claude', 'commands'),
  };
}

function runAudit(opts) {
  const actions = [];
  const ctx = mkContext(opts && opts.projectDir);
  const repairMode = opts && opts.repair === true;
  const safeRepair = repairMode || (opts && opts.repairSafe === true);

  let repairedGlobalAgents = [];
  let repairedGlobalSkills = [];
  let repairedLegacyAgents = [];
  if (safeRepair) {
    repairedGlobalAgents = installGlobalSgsdAgents(ctx, actions, false);
    repairedLegacyAgents = installGlobalLegacyAgentPatches(ctx, actions, false);
  }
  let witnessRepair = { ok: true, reasons: [] };
  let capabilityRepair = { ok: true, reasons: [] };
  let claudeSubstrateWitness = auditClaudeSubstrateWitness(ctx);
  if (safeRepair) witnessRepair = repairClaudeSubstrateWitness(ctx, actions);
  claudeSubstrateWitness = auditClaudeSubstrateWitness(ctx);
  if (safeRepair && claudeSubstrateWitness.ready) capabilityRepair = repairClaudeSubstrateCapability(ctx, actions);
  let claudeSubstrateCapability = auditClaudeSubstrateCapability(ctx, claudeSubstrateWitness);
  if (!witnessRepair.ok || !capabilityRepair.ok) {
    claudeSubstrateCapability = {
      ...claudeSubstrateCapability,
      status: 'missing_or_stale',
      ready: false,
      reasons: [...new Set([
        ...claudeSubstrateCapability.reasons,
        ...witnessRepair.reasons,
        ...capabilityRepair.reasons,
      ])],
    };
  }
  const substrateGranted = claudeSubstrateWitness.ready && claudeSubstrateCapability.ready;
  if (safeRepair) {
    repairedGlobalAgents = [...new Set([
      ...repairedGlobalAgents,
      ...installGlobalSgsdAgents(ctx, actions, substrateGranted),
    ])];
  }
  if (safeRepair) repairedGlobalSkills = installGlobalSgsdSkills(ctx, actions);
  if (safeRepair) {
    repairedLegacyAgents = [...new Set([
      ...repairedLegacyAgents,
      ...installGlobalLegacyAgentPatches(ctx, actions, substrateGranted),
    ])];
  }

  const globalAgents = auditGlobalSgsdAgents(ctx, substrateGranted);
  const globalSkills = auditGlobalSgsdSkills(ctx);
  const globalLegacyAgents = auditGlobalLegacyAgentPatches(ctx, substrateGranted);
  let localShadows = auditProjectAgentShadows(ctx);
  let backedUpLocalShadows = [];
  if (repairMode) {
    backedUpLocalShadows = backupProjectAgentShadows(ctx, localShadows, actions);
    localShadows = auditProjectAgentShadows(ctx);
  }

  const config = ensureConfigDefaults(ctx, actions, safeRepair);
  const superGsdTree = auditSuperGsdTree(ctx);
  const telemetry = auditTelemetry(ctx);
  const profiles = auditProfiles();
  const codexHooks = auditCodexHooks(ctx);
  const orchestratorProtocol = auditOrchestratorProtocol(ctx);
  const projectClaudeMd = auditProjectClaudeMd(ctx);

  const missingGlobal = globalAgents.filter((r) => !r.installed || r.drifted);
  const staleLegacyExecutor = globalAgents.filter((r) => r.name === 'gsd-executor.md' && (!r.installed || r.drifted || !r.disabled_legacy_executor));
  const missingGlobalSkills = globalSkills.filter((r) => !r.installed || r.drifted);
  const missingLegacyPatches = globalLegacyAgents.filter((r) => (
    !r.installed || !r.patched || !r.p166_patched || !r.p166_t2_patched
      || !r.p167_patched || !r.substrate_grant_current || (r.missing_tools || []).length
  ));
  const missingVtpAgents = globalAgents.filter((r) => r.required_vtp_agent && !r.installed);
  const driftedLocal = localShadows.filter((r) => r.drifted);
  const activeLocalShadows = localShadows.filter((r) => r.shadow_type !== 'project_only');
  const missingConfig = config.missing || [];
  const missingProfileWatch = profiles.filter((r) => r.present && r.has_sgsd && !r.has_watch_codex);

  const issues = [];
  if (missingGlobal.length) issues.push('global_sgsd_agents_missing_or_drifted');
  if (staleLegacyExecutor.length) issues.push('legacy_gsd_executor_not_disabled');
  if (missingGlobalSkills.length) issues.push('global_sgsd_skills_missing_or_drifted');
  if (missingLegacyPatches.length) issues.push('global_legacy_gsd_agents_missing_sgsd_vtp_contracts');
  if (missingVtpAgents.length) issues.push('vtp_agents_not_installed');
  if (driftedLocal.length) issues.push('project_local_agent_shadow_drift');
  if (activeLocalShadows.length) issues.push('project_local_agent_shadows_present');
  if (missingConfig.length) issues.push('project_config_missing_feature_defaults');
  if (superGsdTree.stale_copy) issues.push('stale_standalone_super_gsd_tree');
  if (missingProfileWatch.length) issues.push('powershell_profile_missing_sgsd_watch_codex');
  if (!orchestratorProtocol.ok) issues.push('orchestrator_protocol_markers_missing_or_stale');
  if (!projectClaudeMd.ok) issues.push('project_claude_md_missing_or_stale');
  if (!codexHooks.ok) issues.push('project_codex_hooks_missing_or_stale');
  if (!claudeSubstrateWitness.ready || !claudeSubstrateCapability.ready) {
    issues.push('project_claude_substrate_witness_missing_or_stale');
  }

  return {
    ok: issues.length === 0,
    schema_version: SCHEMA_VERSION,
    ts: isoNow(),
    mode: repairMode ? 'repair' : (safeRepair ? 'repair-safe' : 'audit'),
    project_dir: ctx.projectDir,
    sgsd_root: ctx.sgsdRoot,
    issues,
    summary: {
      global_sgsd_agent_issues: missingGlobal.length,
      legacy_gsd_executor_issues: staleLegacyExecutor.length,
      global_sgsd_skill_issues: missingGlobalSkills.length,
      global_legacy_agent_patch_issues: missingLegacyPatches.length,
      local_agent_shadows: activeLocalShadows.length,
      drifted_local_agent_shadows: driftedLocal.length,
      config_missing_fields: missingConfig.length,
      stale_super_gsd_tree: Boolean(superGsdTree.stale_copy),
      profile_missing_watch_codex: missingProfileWatch.length,
      project_claude_md_missing: projectClaudeMd.missing.length,
      codex_hook_issues: (codexHooks.missing || []).length
        + (codexHooks.stale || []).length
        + (codexHooks.duplicates || []).length
        + (codexHooks.status === 'malformed' || codexHooks.status === 'audit-error'
          || codexHooks.status === 'template-error' ? 1 : 0),
      claude_substrate_witness_issues: claudeSubstrateWitness.reasons.length,
      claude_substrate_capability_issues: claudeSubstrateCapability.reasons.length,
    },
    global_agents: globalAgents,
    global_skills: globalSkills,
    global_legacy_agents: globalLegacyAgents,
    local_agent_shadows: localShadows,
    config,
    vtp_mcp: detectVtpConfigured(ctx.projectDir),
    super_gsd_tree: superGsdTree,
    telemetry,
    profiles,
    orchestrator_protocol: orchestratorProtocol,
    project_claude_md: projectClaudeMd,
    codex_hooks: codexHooks,
    claude_substrate_witness: claudeSubstrateWitness,
    claude_substrate_capability: claudeSubstrateCapability,
    repaired: {
      global_agents: repairedGlobalAgents,
      global_skills: repairedGlobalSkills,
      global_legacy_agents: repairedLegacyAgents,
      backed_up_local_shadows: backedUpLocalShadows,
      actions,
    },
  };
}

function selfTest() {
  const results = [];
  function add(name, ok, detail) {
    results.push({ name, ok: Boolean(ok), detail: detail || '' });
  }
  try {
    add('schema_version_locked', SCHEMA_VERSION === 1, String(SCHEMA_VERSION));
    add('codex_defaults_locked', CODEX_MODEL === 'gpt-5.6-sol' && CODEX_EFFORT === 'xhigh', CODEX_MODEL + '/' + CODEX_EFFORT);
    add('planner_defaults_locked', CORE_CONFIG_DEFAULTS.workflow.planner_model === 'codex' && CORE_CONFIG_DEFAULTS.workflow.planner_reasoning_effort === 'xhigh', CORE_CONFIG_DEFAULTS.workflow.planner_model + '/' + CORE_CONFIG_DEFAULTS.workflow.planner_reasoning_effort);
    add('auto_mode_defaults_locked', CORE_CONFIG_DEFAULTS.workflow.auto_continue_until_roadmap_complete === true && CORE_CONFIG_DEFAULTS.workflow.planning_pipeline_enforced === true, String(CORE_CONFIG_DEFAULTS.workflow.auto_continue_until_roadmap_complete));
    add('claude_md_marker_set_declared', REQUIRED_CLAUDE_MD_MARKERS.length >= 10 && REQUIRED_CLAUDE_MD_MARKERS.some((r) => r.code === 'codex_research_missing'), String(REQUIRED_CLAUDE_MD_MARKERS.length));
    add('required_vtp_agents_declared', REQUIRED_VTP_AGENTS.length === 2 && REQUIRED_VTP_AGENTS.indexOf('sgsd-vtp-enrichment.md') !== -1, REQUIRED_VTP_AGENTS.join(','));
    add('disabled_executor_marker_declared', DISABLED_EXECUTOR_MARKER === 'Claude executor disabled', DISABLED_EXECUTOR_MARKER);
    add('legacy_agent_patches_declared', REQUIRED_LEGACY_AGENT_PATCHES.length === 3 && REQUIRED_LEGACY_AGENT_PATCHES.some((r) => r.name === 'gsd-planner.md'), REQUIRED_LEGACY_AGENT_PATCHES.map((r) => r.name).join(','));
    add('sgsd_root_has_agents', exists(path.join(sgsdRoot(), 'agents')), sgsdRoot());
    const savedProfileEnv = Object.fromEntries(
      ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'].map((name) => [name, process.env[name]]),
    );
    const isolatedHome = path.join(os.tmpdir(), 'sgsd-feature-propagation-self-test-' + process.pid);
    process.env.HOME = isolatedHome;
    process.env.USERPROFILE = isolatedHome;
    process.env.APPDATA = path.join(isolatedHome, 'AppData', 'Roaming');
    process.env.XDG_CONFIG_HOME = path.join(isolatedHome, '.config');
    let snap;
    try {
      snap = runAudit({ projectDir: sgsdRoot() });
    } finally {
      for (const [name, value] of Object.entries(savedProfileEnv)) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
    }
    add('run_audit_shape', snap && snap.schema_version === 1 && Array.isArray(snap.issues), 'issues=' + (snap.issues || []).length);
    add('legacy_agent_audit_shape', snap && Array.isArray(snap.global_legacy_agents) && snap.global_legacy_agents.length === 3, 'count=' + ((snap && snap.global_legacy_agents) || []).length);
    add('project_claude_md_audit_shape', snap && snap.project_claude_md && Array.isArray(snap.project_claude_md.missing), 'missing=' + ((snap && snap.project_claude_md && snap.project_claude_md.missing) || []).length);
    add('codex_hooks_audit_shape', snap && snap.codex_hooks && typeof snap.codex_hooks.ok === 'boolean' && Array.isArray(snap.codex_hooks.missing), 'status=' + ((snap && snap.codex_hooks && snap.codex_hooks.status) || 'none'));
    add('repair_actions_array', snap && snap.repaired && Array.isArray(snap.repaired.actions), '');
    const src = readText(__filename) || '';
    let firstNonAscii = -1;
    for (let i = 0; i < src.length; i++) {
      const c = src.charCodeAt(i);
      if (c > 0x7e || (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d)) {
        firstNonAscii = i;
        break;
      }
    }
    add('ascii_only_source', firstNonAscii === -1, 'first_nonascii_idx=' + firstNonAscii);
  } catch (e) {
    add('self_test_outer_error', false, e && e.message ? e.message : 'unknown');
  }
  return { ok: results.every((r) => r.ok), results };
}

function argValue(args, key) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === key && i + 1 < args.length) return args[i + 1];
    if (args[i] && args[i].indexOf(key + '=') === 0) return args[i].slice(key.length + 1);
  }
  return null;
}

function printHuman(snap) {
  process.stdout.write('SGSD feature propagation ' + snap.mode + ' ' + snap.project_dir + '\n');
  process.stdout.write('ok=' + snap.ok + ' issues=' + (snap.issues.length ? snap.issues.join(',') : 'none') + '\n');
  process.stdout.write('global_sgsd_agent_issues=' + snap.summary.global_sgsd_agent_issues + '\n');
  process.stdout.write('legacy_gsd_executor_issues=' + snap.summary.legacy_gsd_executor_issues + '\n');
  process.stdout.write('global_sgsd_skill_issues=' + snap.summary.global_sgsd_skill_issues + '\n');
  process.stdout.write('global_legacy_agent_patch_issues=' + snap.summary.global_legacy_agent_patch_issues + '\n');
  process.stdout.write('local_agent_shadows=' + snap.summary.local_agent_shadows
    + ' drifted=' + snap.summary.drifted_local_agent_shadows + '\n');
  process.stdout.write('config_missing_fields=' + snap.summary.config_missing_fields + '\n');
  process.stdout.write('stale_super_gsd_tree=' + snap.summary.stale_super_gsd_tree + '\n');
  process.stdout.write('profile_missing_watch_codex=' + snap.summary.profile_missing_watch_codex + '\n');
  process.stdout.write('project_claude_md_missing=' + snap.summary.project_claude_md_missing + '\n');
  process.stdout.write('codex_hook_issues=' + snap.summary.codex_hook_issues + '\n');
  process.stdout.write('claude_substrate_witness_status=' + snap.claude_substrate_witness.status + '\n');
  process.stdout.write('claude_substrate_capability_status=' + snap.claude_substrate_capability.status + '\n');
  if (snap.local_agent_shadows.length) {
    process.stdout.write('local_agent_shadow_names=' + snap.local_agent_shadows.map((r) => r.name).join(',') + '\n');
  }
  if (snap.config && snap.config.missing && snap.config.missing.length) {
    process.stdout.write('config_missing=' + snap.config.missing.join(',') + '\n');
  }
  if (snap.orchestrator_protocol && snap.orchestrator_protocol.missing && snap.orchestrator_protocol.missing.length) {
    process.stdout.write('orchestrator_protocol_missing=' + snap.orchestrator_protocol.missing.join(',') + '\n');
  }
  if (snap.project_claude_md && snap.project_claude_md.missing && snap.project_claude_md.missing.length) {
    process.stdout.write('project_claude_md_missing_markers=' + snap.project_claude_md.missing.join(',') + '\n');
  }
  if (snap.codex_hooks && !snap.codex_hooks.ok) {
    process.stdout.write('codex_hooks_status=' + snap.codex_hooks.status + '\n');
  }
  if (snap.repaired.actions.length) {
    process.stdout.write('actions=' + snap.repaired.actions.length + '\n');
  }
}

function main(argv) {
  const args = argv.slice(2);
  if (args.indexOf('--self-test') !== -1) {
    const out = selfTest();
    for (const r of out.results) {
      process.stdout.write((r.ok ? 'PASS ' : 'FAIL ') + r.name + ' ' + r.detail + '\n');
    }
    process.exit(out.ok ? 0 : 1);
    return;
  }
  const projectDir = argValue(args, '--project-dir') || process.cwd();
  if (args.indexOf('--repair-substrate-capability') !== -1) {
    const snap = runAudit({ projectDir, repairSafe: true });
    const hardReasons = new Set([
      'witness_repair_failed',
      'broker_repair_failed',
      'direct_grant',
      'broker_drift',
      'upstream_drift',
      'grant_with_witness_unready',
    ]);
    const refused = !snap.claude_substrate_witness.ready
      || snap.claude_substrate_capability.reasons.some((reason) => hardReasons.has(reason));
    process.stdout.write(JSON.stringify({
      ok: !refused,
      witness_status: snap.claude_substrate_witness.status,
      capability_status: snap.claude_substrate_capability.status,
      reasons: snap.claude_substrate_capability.reasons,
      substrate_granted: snap.claude_substrate_witness.ready && snap.claude_substrate_capability.ready,
    }) + '\n');
    process.exit(refused ? 2 : 0);
    return;
  }
  const snap = runAudit({
    projectDir,
    repair: args.indexOf('--repair') !== -1,
    repairSafe: args.indexOf('--repair-safe') !== -1,
  });
  if (args.indexOf('--json') !== -1) {
    process.stdout.write(JSON.stringify(snap, null, 2) + '\n');
  } else {
    printHuman(snap);
  }
  process.exit(snap.ok ? 0 : 2);
}

if (require.main === module) main(process.argv);

module.exports = {
  runAudit,
  selfTest,
  _internals: {
    buildP166LegacyPromptPatch,
    detectVtpConfigured,
    auditProjectClaudeMd,
    auditProjectAgentShadows,
    ensureConfigDefaults,
    auditSuperGsdTree,
    auditTelemetry,
    auditCodexHooks,
    auditClaudeSubstrateWitness,
    auditClaudeSubstrateCapability,
    repairClaudeSubstrateWitness,
    repairClaudeSubstrateCapability,
    setFrontmatterTool,
    canonicalAgentText,
    mcpScopeDocuments,
    profilePaths,
  },
};
