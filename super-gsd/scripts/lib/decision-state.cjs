#!/usr/bin/env node
'use strict';

const path = require('path');
const { resolveEffectiveState } = require('../../tools/state-resolver/resolve.cjs');

const RENDER_MODES = Object.freeze(['session', 'orchestrator']);
const WARNING_RULE = '!'.repeat(72);

function scalar(value) {
  if (value === null || typeof value === 'undefined' || value === '') return '(unknown)';
  return String(value).replace(/[\r\n\t]+/g, ' ').trim() || '(unknown)';
}

function formatConflict(conflict, index) {
  const item = conflict && typeof conflict === 'object' ? conflict : {};
  const sourceA = scalar(item.source_a);
  const sourceB = scalar(item.source_b);
  return [
    `conflict[${index + 1}]:`,
    `  ${sourceA}: milestone=${scalar(item.milestone_a)} phase=${scalar(item.phase_a)}`,
    `  ${sourceB}: milestone=${scalar(item.milestone_b)} phase=${scalar(item.phase_b)}`,
  ];
}

function formatDecisionState(state) {
  if (!state || state.ok !== true) {
    const code = state && state.error_code ? scalar(state.error_code) : 'invalid_result';
    const message = state && state.error_message
      ? scalar(state.error_message) : 'effective-state resolver returned no usable result';
    throw new Error(`${code}: ${message}`);
  }

  const lines = [
    'SGSD EFFECTIVE DECISION STATE',
    `milestone: ${scalar(state.milestone)}`,
    `phase: ${scalar(state.phase)}`,
    `phase_name: ${scalar(state.phase_name)}`,
    `phase_status: ${scalar(state.phase_status)}`,
    `confidence: ${scalar(state.confidence)}`,
    `source: ${scalar(state.source)}`,
  ];
  const conflicts = Array.isArray(state.conflicts) ? state.conflicts : [];

  if (state.projection_stale === true || conflicts.length > 0) {
    lines.push(
      '',
      WARNING_RULE,
      'WARNING: PROJECTION STALE / EVIDENCE CONFLICT',
      WARNING_RULE,
      'dispatch_instruction: TREAT BOTH VALUES AS VISIBLE INPUT; NEVER SILENTLY PICK STATE.md',
      `projection_stale: ${state.projection_stale === true ? 'true' : 'false'}`,
      `stale_sources: ${Array.isArray(state.stale_sources)
        ? state.stale_sources.map(scalar).join(', ') || '(none)'
        : '(none)'}`,
    );

    if (conflicts.length > 0) {
      for (let index = 0; index < conflicts.length; index += 1) {
        lines.push(...formatConflict(conflicts[index], index));
      }
    } else {
      const projection = state._state_md && typeof state._state_md === 'object'
        ? state._state_md : {};
      lines.push(
        `effective: milestone=${scalar(state.milestone)} phase=${scalar(state.phase)}`,
        `state_md: milestone=${scalar(projection.milestone)} phase=${scalar(projection.phase)}`,
      );
    }
    lines.push(WARNING_RULE);
  }

  return lines.join('\n') + '\n';
}

function renderDecisionState(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const render = opts.render || 'orchestrator';
  if (!RENDER_MODES.includes(render)) {
    throw new Error(`invalid render mode: ${scalar(render)}`);
  }
  const projectDir = path.resolve(opts.projectDir || process.cwd());
  return formatDecisionState(resolveEffectiveState({ projectDir }));
}

function usage() {
  return [
    'Usage: node decision-state.cjs --render session|orchestrator --project <dir>',
    '',
  ].join('\n');
}

function runCli(argv) {
  const args = argv.slice(2);
  let render = null;
  let projectDir = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage());
      return 0;
    }
    if (arg === '--render' && index + 1 < args.length) {
      render = args[++index];
      continue;
    }
    if (arg === '--project' && index + 1 < args.length) {
      projectDir = args[++index];
      continue;
    }
    process.stderr.write(`decision-state: unknown or incomplete argument: ${arg}\n`);
    return 2;
  }
  if (!RENDER_MODES.includes(render) || !projectDir) {
    process.stderr.write(usage());
    return 2;
  }
  try {
    process.stdout.write(renderDecisionState({ projectDir, render }));
    return 0;
  } catch (error) {
    process.stderr.write(`decision-state: ${error && error.message || 'unknown failure'}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(runCli(process.argv));
}

module.exports = {
  formatDecisionState,
  renderDecisionState,
  RENDER_MODES,
};
