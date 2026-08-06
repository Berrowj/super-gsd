#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD PostToolUse report-only quality gate
// ============================================================================
// Observes confirmed file-mutation tools and appends missing-plan evidence.
// Never blocks PostToolUse; never writes outside the root derived from payload.cwd.
// ============================================================================

const fs = require('fs');

const {
  findSgsdRoot,
  findPlanLockedFiles,
  readState,
} = require('../scripts/lib/sgsd-state.cjs');
const { logGateEvidence } = require('../scripts/lib/gate-evidence-log.cjs');

const CONFIRMED_MUTATION_TOOLS = Object.freeze(['Edit', 'Write', 'NotebookEdit']);
const MUTATION_TOOL_SET = new Set(CONFIRMED_MUTATION_TOOLS);
const MISSING_PLAN_SIGNAL = 'missing_plan';

function safeWarn(reason) {
  try {
    process.stderr.write(`[SGSD] sgsd-quality-gate ${String(reason || 'degraded')}\n`);
  } catch {
    // Error reporting must not become the error path.
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  try {
    if (!raw || !String(raw).trim()) return {};
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function rootFromPayload(payload) {
  try {
    if (!payload || typeof payload.cwd !== 'string' || !payload.cwd.trim()) return null;
    return findSgsdRoot(payload.cwd);
  } catch {
    safeWarn('root_resolution_failed');
    return null;
  }
}

function toolName(payload) {
  return payload && typeof payload.tool_name === 'string' ? payload.tool_name : '';
}

function editedFilePath(payload) {
  try {
    const input = payload && payload.tool_input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    if (typeof input.file_path === 'string' && input.file_path) return input.file_path;
    if (typeof input.notebook_path === 'string' && input.notebook_path) return input.notebook_path;
    return null;
  } catch {
    safeWarn('file_path_extract_failed');
    return null;
  }
}

function payloadDuration(payload) {
  const raw = payload ? payload.duration_ms : null;
  if (!Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return rounded >= 0 ? rounded : null;
}

function appendMissingPlan(root, payload, state, name) {
  try {
    const row = logGateEvidence(root, {
      signal: MISSING_PLAN_SIGNAL,
      status: 'warn',
      reason_codes: [MISSING_PLAN_SIGNAL],
      artifacts: [],
      evidence: [{ kind: 'state', ref: '.planning/STATE.md' }],
      next_action: 'Create a matching active-phase PLAN-LOCKED file before source edits.',
      risk: 'medium',
      duration_ms: payloadDuration(payload),
      phase: state.phase,
      milestone: state.milestone,
      phase_source: state.phaseSource || null,
      file_path: editedFilePath(payload),
      tool_name: name,
      hook_event_name: payload.hook_event_name || null,
      session_id: payload.session_id || null,
    });
    if (!row) safeWarn('evidence_append_failed');
  } catch {
    safeWarn('missing_plan_emit_failed');
  }
}

function observePostToolUse(payload) {
  if (!payload || payload.hook_event_name !== 'PostToolUse') return;

  const name = toolName(payload);
  if (!MUTATION_TOOL_SET.has(name)) return;

  const root = rootFromPayload(payload);
  if (!root) return;

  const state = readState(root);
  if (!state || !state.phase) return;

  const plans = findPlanLockedFiles(root, state.phase);
  if (plans.length > 0) return;

  appendMissingPlan(root, payload, state, name);
}

function main() {
  try {
    observePostToolUse(parsePayload(readStdin()));
  } catch {
    safeWarn('unexpected_degraded');
  }
}

if (require.main === module) main();

module.exports = {
  CONFIRMED_MUTATION_TOOLS,
  MISSING_PLAN_SIGNAL,
  parsePayload,
  observePostToolUse,
};

