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
const {
  REGISTRY_SOURCE_PATH,
  parseRegistryYaml,
} = require('./sgsd-intent-classifier.cjs');

const CONFIRMED_MUTATION_TOOLS = Object.freeze(['Edit', 'Write', 'NotebookEdit']);
const MISSING_PLAN_SIGNAL = 'missing_plan';
const DEGRADED_SIGNAL = 'quality_gate_degraded';
const QUALITY_ROUTE_ID = 'quality-gate-missing-plan';

function safeWarn(reason) {
  try {
    process.stderr.write(`[SGSD] sgsd-quality-gate ${String(reason || 'degraded')}\n`);
  } catch {
    // Error reporting must not become the error path.
  }
}

function appendFailureRow(root, reason, payload, extra) {
  safeWarn(reason);
  try {
    if (!root) return false;
    const state = readState(root) || {};
    return Boolean(logGateEvidence(root, {
      signal: DEGRADED_SIGNAL,
      status: 'fail',
      reason_codes: [String(reason || 'degraded')],
      artifacts: [{ kind: 'registry', path: REGISTRY_SOURCE_PATH }],
      evidence: [],
      next_action: 'Inspect the SGSD quality gate hook degraded path.',
      risk: 'medium',
      duration_ms: payloadDuration(payload),
      phase: state.phase || null,
      milestone: state.milestone || null,
      hook_event_name: payload && payload.hook_event_name || null,
      session_id: payload && payload.session_id || null,
      tool_name: toolName(payload) || null,
      file_path: editedFilePath(payload),
      ...(extra && typeof extra === 'object' ? extra : {}),
    }));
  } catch {
    return false;
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

function list(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v) : [];
}

function registryMutationToolSet(root, payload) {
  try {
    const registry = parseRegistryYaml(fs.readFileSync(REGISTRY_SOURCE_PATH, 'utf8'));
    const routes = registry && Array.isArray(registry.routes) ? registry.routes : [];
    const route = routes.find((item) => item && item.id === QUALITY_ROUTE_ID);
    const names = list(route && route.trigger && route.trigger.tool_names);
    if (names.length === 0) throw new Error('quality gate registry route has no tool_names');
    return new Set(names);
  } catch {
    appendFailureRow(root, 'registry_unavailable', payload);
    return new Set(CONFIRMED_MUTATION_TOOLS);
  }
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
    if (!row) {
      appendFailureRow(root, 'evidence_append_failed', payload, {
        failed_signal: MISSING_PLAN_SIGNAL,
      });
    }
  } catch {
    appendFailureRow(root, 'evidence_append_failed', payload, {
      failed_signal: MISSING_PLAN_SIGNAL,
    });
  }
}

function observePostToolUse(payload, root) {
  if (!payload || payload.hook_event_name !== 'PostToolUse') return;

  const resolvedRoot = root === undefined ? rootFromPayload(payload) : root;
  if (!resolvedRoot) return;

  const name = toolName(payload);
  if (!registryMutationToolSet(resolvedRoot, payload).has(name)) return;

  const state = readState(resolvedRoot);
  if (!state || !state.phase) return;

  const plans = findPlanLockedFiles(resolvedRoot, state.phase);
  if (plans.length > 0) return;

  appendMissingPlan(resolvedRoot, payload, state, name);
}

function main() {
  let payload = {};
  let root = null;
  try {
    payload = parsePayload(readStdin());
    root = rootFromPayload(payload);
    observePostToolUse(payload, root);
  } catch {
    appendFailureRow(root, 'quality_gate_unexpected_error', payload);
  }
}

if (require.main === module) main();

module.exports = {
  CONFIRMED_MUTATION_TOOLS,
  DEGRADED_SIGNAL,
  MISSING_PLAN_SIGNAL,
  parsePayload,
  observePostToolUse,
};
