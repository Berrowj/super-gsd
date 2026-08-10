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

const CODEX_HOOK_INSTALLER = path.resolve(__dirname, '..', 'codex-hooks', 'install-hooks.cjs');

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
const REQUIRED_LEGACY_AGENT_PATCHES = Object.freeze([
  {
    name: 'gsd-planner.md',
    marker: '<sgsd_vtp_enrichment_contract>',
    tools: Object.freeze([
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
    tools: Object.freeze([
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

function installGlobalSgsdAgents(ctx, actions) {
  const canonical = ctx.canonicalAgentsDir;
  const globalDir = ctx.globalAgentsDir;
  const repaired = [];
  for (const name of listMarkdownFiles(canonical)) {
    if (!name.startsWith('sgsd-')) continue;
    const src = path.join(canonical, name);
    const dst = path.join(globalDir, name);
    if (sha256(src) !== sha256(dst)) {
      copyFile(src, dst, actions);
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

function installGlobalLegacyAgentPatches(ctx, actions) {
  const repaired = [];
  for (const spec of REQUIRED_LEGACY_AGENT_PATCHES) {
    const p = path.join(ctx.globalAgentsDir, spec.name);
    let txt = readText(p);
    if (!txt) continue;
    let changed = false;

    if (Array.isArray(spec.tools) && spec.tools.length) {
      const lines = txt.split(/\r?\n/);
      const idx = lines.findIndex((line) => /^tools:\s*/.test(line));
      if (idx !== -1) {
        const missing = spec.tools.filter((tool) => lines[idx].indexOf(tool) === -1);
        if (missing.length) {
          lines[idx] = lines[idx].replace(/\s*$/, '') + ', ' + missing.join(', ');
          txt = lines.join('\n');
          fs.writeFileSync(p, txt, 'utf8');
          actions.push({ action: 'patch_legacy_agent_tools', to: p, tools: missing });
          changed = true;
        }
      }
    }

    if (txt.indexOf(spec.marker) === -1) {
      fs.appendFileSync(p, spec.append, 'utf8');
      actions.push({ action: 'append_legacy_agent_patch', to: p, marker: spec.marker });
      changed = true;
    }
    if (changed) repaired.push(spec.name);
  }
  return repaired;
}

function auditGlobalSgsdAgents(ctx) {
  const rows = [];
  for (const name of listMarkdownFiles(ctx.canonicalAgentsDir)) {
    if (!name.startsWith('sgsd-')) continue;
    const src = path.join(ctx.canonicalAgentsDir, name);
    const dst = path.join(ctx.globalAgentsDir, name);
    const srcHash = sha256(src);
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

function auditGlobalLegacyAgentPatches(ctx) {
  const rows = [];
  for (const spec of REQUIRED_LEGACY_AGENT_PATCHES) {
    const p = path.join(ctx.globalAgentsDir, spec.name);
    const txt = readText(p);
    const missingTools = txt && Array.isArray(spec.tools)
      ? spec.tools.filter((tool) => txt.indexOf(tool) === -1)
      : (Array.isArray(spec.tools) ? spec.tools.slice() : []);
    rows.push({
      name: spec.name,
      installed: Boolean(txt),
      marker: spec.marker,
      patched: Boolean(txt && txt.indexOf(spec.marker) !== -1),
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
  if (safeRepair) repairedGlobalAgents = installGlobalSgsdAgents(ctx, actions);
  if (safeRepair) repairedGlobalSkills = installGlobalSgsdSkills(ctx, actions);
  if (safeRepair) repairedLegacyAgents = installGlobalLegacyAgentPatches(ctx, actions);

  const globalAgents = auditGlobalSgsdAgents(ctx);
  const globalSkills = auditGlobalSgsdSkills(ctx);
  const globalLegacyAgents = auditGlobalLegacyAgentPatches(ctx);
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
  const missingLegacyPatches = globalLegacyAgents.filter((r) => !r.installed || !r.patched || (r.missing_tools || []).length);
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
    const snap = runAudit({ projectDir: sgsdRoot() });
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
    detectVtpConfigured,
    auditProjectClaudeMd,
    auditProjectAgentShadows,
    ensureConfigDefaults,
    auditSuperGsdTree,
    auditTelemetry,
    auditCodexHooks,
    profilePaths,
  },
};
