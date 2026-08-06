#!/usr/bin/env node
/**
 * Super GSD SessionStart hook - governance contract + handoff pairing.
 *
 * Reads Claude hook JSON from stdin. All paths are derived from payload.cwd via
 * the shared SGSD resolver; non-SGSD directories exit 0 with no output.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findSgsdRoot, readState } = require('../scripts/lib/sgsd-state.cjs');
const { logGateEvidence } = require('../scripts/lib/gate-evidence-log.cjs');

function readPayload() {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }

  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function resolveContext(payload) {
  if (!payload || payload.hook_event_name !== 'SessionStart') return null;
  if (typeof payload.cwd !== 'string' || !payload.cwd.trim()) return null;

  const root = findSgsdRoot(payload.cwd);
  if (!root) return null;

  const planningDir = path.join(root, '.planning');
  const rootReal = safeRealpath(root);
  const planningReal = safeRealpath(planningDir);
  const stateReal = safeRealpath(path.join(planningDir, 'STATE.md'));
  if (!rootReal || !planningReal || !stateReal) return null;
  if (!isInside(rootReal, planningReal) || !isInside(planningReal, stateReal)) return null;

  return { root, planningDir, planningReal };
}

function derivedPlanningPath(ctx, relParts) {
  const p = path.join(ctx.planningDir, ...relParts);
  const abs = path.resolve(p);
  const planningAbs = path.resolve(ctx.planningDir);
  if (!isInside(planningAbs, abs)) return null;
  return abs;
}

function existingSafePath(ctx, relParts) {
  const p = derivedPlanningPath(ctx, relParts);
  if (!p || !fs.existsSync(p)) return null;
  const real = safeRealpath(p);
  return real && isInside(ctx.planningReal, real) ? p : null;
}

function buildGovernanceContract(state) {
  const milestone = state && state.milestone ? state.milestone : 'UNKNOWN';
  const phase = state && state.phase ? state.phase : 'MISSING';
  const phaseSource = state && state.phaseSource ? state.phaseSource : 'absent';

  return [
    'Governance Contract',
    '',
    'Active State',
    `- Milestone: ${milestone}`,
    `- Phase: ${phase}`,
    `- Phase source: ${phaseSource}`,
    '',
    'ATC Tier Table',
    '| Tier | Trigger | Required confirmation |',
    '| --- | --- | --- |',
    '| SKIP | Tiny non-code or no-risk change | No ATC review; normal verification still applies |',
    '| LITE | Small bounded change | Executor self-checks delete/simplify and anti-slop criteria |',
    '| FULL | Larger diff, multiple files, or meaningful code change | Per-dispatch ATC reviews the unit diff |',
    '| GATE | New system, dependency, architecture, or API boundary | Human confirmation in manual mode; automated mode records the gate path |',
    '',
    'Gate Table',
    '| Gate | Runs when | Evidence |',
    '| --- | --- | --- |',
    '| PLAN-LOCKED discipline | Before source mutation | Active phase PLAN-LOCKED artifact |',
    '| Per-dispatch ATC | FULL/GATE source-changing dispatch | commit-reviews.jsonl |',
    '| Verifier | Before phase close | VERIFICATION artifact or verifier output |',
    '| Phase-level ATC | Phase boundary | ATC-REVIEW artifact |',
    '| MUDA audit | Risk/size threshold or phase close policy | WASTE artifact or gate evidence |',
    '| Evidence audit | Release/phase readiness boundary | gate ledger and review ledger rows |',
    '',
    'Mode Confirmation',
    'The same gates apply in every mode. Mode changes WHO confirms a gate, not WHAT runs.',
    'Hooks are report-only here: exit 0 and no blocking response fields.',
  ].join('\n');
}

function appendCheckpointBriefing(ctx, parts) {
  const checkpointPath = existingSafePath(ctx, ['ORCHESTRATOR-CHECKPOINT.md']);
  if (!checkpointPath) return;

  const checkpoint = fs.readFileSync(checkpointPath, 'utf8');
  const fmMatch = checkpoint.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return;

  parts.push('');
  parts.push('Checkpoint Detected');
  parts.push('Previous session was interrupted.');
  parts.push('Resume point:');
  parts.push(fmMatch[1]);
  parts.push('Say "continue" or "go" to resume from checkpoint.');
}

function appendMemoryBriefing(ctx, parts) {
  const memoryPath = existingSafePath(ctx, ['memory']);
  if (!memoryPath) return;
  try {
    if (fs.statSync(memoryPath).isDirectory()) {
      parts.push('');
      parts.push('SGSD memory: .planning/memory active');
    }
  } catch {
    // Non-fatal: governance context is already available.
  }
}

function logStatePhaseMissing(ctx, state) {
  logGateEvidence(ctx.root, {
    signal: 'state_phase_missing',
    status: 'warn',
    reason_codes: ['state_phase_missing'],
    risk: 'medium',
    milestone: state && state.milestone ? state.milestone : null,
    phase: null,
    evidence: [{ kind: 'state', ref: '.planning/STATE.md' }],
    next_action: 'Add current_phase to .planning/STATE.md frontmatter.',
  });
}

function logSessionStartFailure(ctx, state, reasonCode) {
  logGateEvidence(ctx.root, {
    signal: reasonCode,
    status: 'fail',
    reason_codes: [reasonCode],
    risk: 'medium',
    milestone: state && state.milestone ? state.milestone : null,
    phase: state && state.phase ? state.phase : null,
    evidence: [{ kind: 'hook', ref: 'super-gsd/hooks/sgsd-session-start.js' }],
    next_action: 'Inspect SessionStart hook optional enrichment and handoff pairing paths.',
  });
}

function safeLogStatePhaseMissing(ctx, state) {
  try {
    logStatePhaseMissing(ctx, state);
  } catch {
    // SessionStart evidence failures must never block a session.
  }
}

function safeLogSessionStartFailure(ctx, state, reasonCode) {
  try {
    logSessionStartFailure(ctx, state, reasonCode);
  } catch {
    // SessionStart error handlers must be incapable of throwing.
  }
}

function shouldLogStatePhaseMissing(state) {
  return !state || !state.phase;
}

function emitOptionalBriefing(ctx, appendFn) {
  const parts = [];
  try {
    appendFn(ctx, parts);
  } catch {
    return;
  }
  if (parts.length > 0) console.log(parts.join('\n'));
}

function emitGovernanceContext(ctx, state) {
  console.log(buildGovernanceContract(state));

  if (shouldLogStatePhaseMissing(state)) {
    safeLogStatePhaseMissing(ctx, state);
  }

  emitOptionalBriefing(ctx, appendCheckpointBriefing);
  emitOptionalBriefing(ctx, appendMemoryBriefing);
}

function pairHandoffTarget(ctx) {
  const handoffLogPath = existingSafePath(ctx, ['metrics', 'handoff-log.jsonl']);
  if (!handoffLogPath) return;

  const rawLines = fs.readFileSync(handoffLogPath, 'utf8').split('\n').filter(Boolean);
  if (rawLines.length === 0) return;

  let lastRow;
  try {
    lastRow = JSON.parse(rawLines[rawLines.length - 1]);
  } catch {
    return;
  }

  if (!lastRow || lastRow.to_session_id !== null || lastRow.reason !== 'spawned') return;

  const rowTs = lastRow.ts ? new Date(lastRow.ts).getTime() : 0;
  const nowMs = Date.now();
  if (rowTs <= 0 || (nowMs - rowTs) > 60000) return;

  lastRow.to_session_id = 'pid-' + process.pid;
  rawLines[rawLines.length - 1] = JSON.stringify(lastRow);
  fs.writeFileSync(handoffLogPath, rawLines.join('\n') + '\n');
}

function main() {
  try {
    const payload = readPayload();
    const ctx = resolveContext(payload);
    if (!ctx) return;

    const state = readState(ctx.root);
    try {
      emitGovernanceContext(ctx, state);
    } catch {
      safeLogSessionStartFailure(ctx, state, 'session_start_governance_failed');
    }

    try {
      pairHandoffTarget(ctx);
    } catch {
      safeLogSessionStartFailure(ctx, state, 'session_start_handoff_pairing_failed');
    }
  } catch {
    // Fail open: SessionStart hooks must never emit stack traces or block startup.
  }
}

main();
