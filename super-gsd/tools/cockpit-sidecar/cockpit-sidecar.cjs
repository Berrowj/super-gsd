#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { computeFogScore } = require('./fog-score.cjs');

const DEFAULTS = { cockpitState: '.planning/STATE.md', chronicleIndex: '.planning/chronicles/INDEX.jsonl',
  validatorLog: '.planning/metrics/chronicle-validation-log.jsonl',
  executorLog: '.planning/metrics/codex-executor-log.jsonl',
  tokenAttribution: '.planning/metrics/token-attribution.jsonl', format: 'json' };

const VALUE_OPTIONS = { '--cockpit-state': 'cockpitState', '--chronicle-index': 'chronicleIndex',
  '--validator-log': 'validatorLog', '--executor-log': 'executorLog',
  '--token-attribution': 'tokenAttribution', '--milestone': 'milestone', '--phase': 'phase' };

const FOG_SIGNALS = ['dispatch_count', 'token_spend', 'files_changed', 'review_loops',
  'disputed_claims_count', 'stale_findings_count', 'plan_revisions', 'unresolved_risks_count',
  'minutes_since_operator_decision', 'dependency_depth'];

function usage() {
  return [
    'Usage: node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs [options]',
    '  --cockpit-state <path> --chronicle-index <path> --validator-log <path>',
    '  --executor-log <path> --token-attribution <path>',
    '  --milestone <id> --phase <id> --json|--text'
  ].join('\n');
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json' || arg === '--text') {
      options.format = arg.slice(2);
    } else if (VALUE_OPTIONS[arg]) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      options[VALUE_OPTIONS[arg]] = value;
      index += 1;
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  return options;
}

const absolutePath = (filePath) => path.resolve(process.cwd(), filePath);
const id = (value) => (value === undefined || value === null ? '' : String(value).trim());
const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_error) {
    return false;
  }
}

function first(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== '') {
      return object[key];
    }
  }
  return undefined;
}

function parseFrontmatter(markdown) {
  const lines = markdown.split(/\r?\n/);
  const state = {};
  const startsWithFence = lines[0] === '---';
  for (let index = startsWithFence ? 1 : 0; index < lines.length; index += 1) {
    if (startsWithFence && lines[index] === '---') break;
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) state[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return state;
}

function readCockpitState(filePath, warnings) {
  const resolved = absolutePath(filePath);
  if (!isFile(resolved)) {
    warnings.push(`cockpit_state_unavailable: ${filePath} not found`);
    return { available: false, state: {} };
  }
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    return { available: true, state: content.trim().startsWith('{') ? JSON.parse(content) : parseFrontmatter(content) };
  } catch (error) {
    warnings.push(`cockpit_state_unavailable: ${error.message}`);
    return { available: false, state: {} };
  }
}

function readJsonl(filePath, warnings, sourceName) {
  const resolved = absolutePath(filePath);
  if (!isFile(resolved)) {
    warnings.push(`${sourceName}_unavailable: ${filePath} not found`);
    return { available: false, rows: [] };
  }
  try {
    const content = fs.readFileSync(resolved, 'utf8').trim();
    const rows = content
      ? content.split(/\r?\n/).map((line, index) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            warnings.push(`${sourceName}_parse_error: line ${index + 1}: ${error.message}`);
            return null;
          }
        }).filter(Boolean)
      : [];
    return { available: true, rows };
  } catch (error) {
    warnings.push(`${sourceName}_unavailable: ${error.message}`);
    return { available: false, rows: [] };
  }
}

function matchesScope(row, milestone, phase) {
  const rowMilestone = id(first(row, ['milestone', 'milestone_id', 'roadmap']));
  const rowPhase = id(first(row, ['phase', 'phase_id', 'phase_number']));
  if (milestone && rowMilestone && rowMilestone !== milestone) return false;
  if (phase && rowPhase && rowPhase !== phase) return false;
  if (!phase || rowPhase) return true;
  return id(first(row, ['location', 'path', 'chronicle_path', 'evidence_path'])).includes(phase);
}

function latestMatching(rows, milestone, phase) {
  return rows.slice().reverse().find((row) => matchesScope(row, milestone, phase)) || null;
}

function latestChronicle(row) {
  return row ? { location: first(row, ['location', 'path', 'chronicle_path']) || null,
    validator_verdict: first(row, ['validator_verdict', 'verdict', 'binding_gate_status']) || null,
    published_at: first(row, ['published_at', 'generated_at', 'timestamp', 'created_at']) || null } : null;
}

function gateStatus(validatorRow, chronicleRow) {
  const value = first(validatorRow, ['binding_gate_status', 'gate_status', 'status']) ||
    first(chronicleRow, ['binding_gate_status', 'gate_status', 'status']);
  const normalized = value ? String(value).toUpperCase() : null;
  return ['GREEN', 'YELLOW', 'RED'].includes(normalized) ? normalized : null;
}

function scopedRows(rows, milestone, phase) {
  return rows.filter((row) => matchesScope(row, milestone, phase));
}

function rowNumber(row, keys) {
  return toNumber(first(row, keys));
}

function dispatchCount(rows, milestone, phase) {
  const scoped = scopedRows(rows, milestone, phase);
  const explicit = scoped.reduce((total, row) => total + rowNumber(row, ['dispatch_count', 'dispatches']), 0);
  return explicit > 0 ? explicit : scoped.length;
}

function tokenSpend(rows, milestone, phase) {
  return scopedRows(rows, milestone, phase).reduce((total, row) => {
    const direct = rowNumber(row, ['token_spend', 'total_tokens', 'tokens', 'total']);
    const nested = row.usage ? rowNumber(row.usage, ['total_tokens', 'tokens', 'total']) : 0;
    return total + (direct || nested);
  }, 0);
}

function git(args, warningName, warnings, lines = false) {
  try {
    const output = execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
    return lines ? (output ? output.split(/\r?\n/).filter(Boolean) : []) : toNumber(output);
  } catch (error) {
    warnings.push(`${warningName}_unavailable: ${error.message.split(/\r?\n/)[0]}`);
    return lines ? [] : 0;
  }
}

function ageMinutes(timestamp) {
  const parsed = timestamp ? new Date(timestamp).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.round((Date.now() - parsed) / 60000));
}

function phaseStartRef(state, milestone, phase) {
  return first(state, ['phase_start_ref', 'start_ref', 'phaseStartRef']) ||
    (milestone && phase ? `sgsd/${milestone}/phase-${phase}-start` : null);
}

function buildSignals({ executorRows, tokenRows, validatorRow, state, milestone, phase, warnings }) {
  const ref = phaseStartRef(state, milestone, phase);
  if (!ref) warnings.push('phase_commit_count_unavailable: phase_start_ref unavailable');
  const filesValue = first(state, ['files_changed', 'changed_files']);
  const decisionAge = first(state, ['minutes_since_operator_decision']);
  const signals = {
    dispatch_count: dispatchCount(executorRows, milestone, phase),
    token_spend: tokenSpend(tokenRows, milestone, phase),
    files_changed: filesValue !== undefined ? toNumber(filesValue) : (ref ? git(['diff', '--name-only', `${ref}..HEAD`], 'phase_file_diff', warnings, true).length : 0),
    review_loops: rowNumber(validatorRow || {}, ['review_loops', 'review_loop_count']),
    disputed_claims_count: rowNumber(validatorRow || {}, ['disputed_claims_count', 'disputed_claims']),
    stale_findings_count: rowNumber(validatorRow || {}, ['stale_findings_count', 'stale_findings']),
    plan_revisions: rowNumber(state, ['plan_revisions', 'plan_revision_count']),
    unresolved_risks_count: rowNumber(validatorRow || state, ['unresolved_risks_count', 'unresolved_risks']),
    minutes_since_operator_decision: decisionAge !== undefined ? toNumber(decisionAge) : ageMinutes(first(state, ['last_operator_decision_at', 'last_decision_at', 'last_activity'])),
    dependency_depth: rowNumber(state, ['dependency_depth', 'phase_dependency_depth']),
    commits_in_phase: ref ? git(['rev-list', '--count', `${ref}..HEAD`], 'phase_commit_count', warnings) : 0
  };
  for (const key of FOG_SIGNALS) signals[key] = toNumber(signals[key]);
  return signals;
}

function renderText(output) {
  const latest = output.latest_chronicle;
  return [
    `Milestone: ${output.milestone || 'null'}`,
    `Phase: ${output.phase || 'null'}`,
    `Generated: ${output.generated_at}`,
    `Latest chronicle: ${latest ? latest.location : 'none'}`,
    `Validator verdict: ${latest ? latest.validator_verdict || 'null' : 'null'}`,
    `Binding gate: ${output.binding_gate_status || 'null'}`,
    `Fog score: ${output.fog_score.score} (${output.fog_score.tier})`,
    `Must read: ${output.fog_score.must_read_sections.join(', ') || 'none'}`,
    `Dispatches: ${output.signals.dispatch_count}`,
    `Token spend: ${output.signals.token_spend}`,
    `Files changed: ${output.signals.files_changed}`,
    `Commits in phase: ${output.signals.commits_in_phase}`,
    `Recent chronicles: ${output.recent_chronicles.length}`,
    `Warnings: ${output.warnings.length ? output.warnings.join('; ') : 'none'}`
  ].join('\n');
}

function run(rawArgs = process.argv.slice(2)) {
  const options = parseArgs(rawArgs);
  if (options.help) return { exitCode: 0, stdout: usage() };
  const warnings = [];
  const cockpit = readCockpitState(options.cockpitState, warnings);
  const milestone = id(options.milestone || first(cockpit.state, ['milestone', 'active_milestone', 'current_milestone'])) || null;
  const phase = id(options.phase || first(cockpit.state, ['phase', 'active_phase', 'current_phase'])) || null;
  const chronicle = readJsonl(options.chronicleIndex, warnings, 'chronicle_index');
  const validator = readJsonl(options.validatorLog, warnings, 'validator_log');
  const executor = readJsonl(options.executorLog, warnings, 'executor_log');
  const tokens = readJsonl(options.tokenAttribution, warnings, 'token_attribution');
  const sources = [cockpit, chronicle, validator, executor, tokens];

  if (sources.every((source) => !source.available)) {
    return { exitCode: 2, stdout: JSON.stringify({ error: 'all_sources_missing', warnings }, null, 2) };
  }

  const validatorRow = latestMatching(validator.rows, milestone, phase);
  const recent = chronicle.rows.slice(-5).reverse();
  const latestRow = latestMatching(chronicle.rows, milestone, phase) || recent[0] || null;
  const signals = buildSignals({ executorRows: executor.rows, tokenRows: tokens.rows, validatorRow,
    state: cockpit.state, milestone, phase, warnings });
  const fogInput = Object.fromEntries(FOG_SIGNALS.map((key) => [key, signals[key]]));
  const output = { milestone, phase, generated_at: new Date().toISOString(),
    latest_chronicle: latestChronicle(latestRow), binding_gate_status: gateStatus(validatorRow, latestRow),
    fog_score: computeFogScore(fogInput), recent_chronicles: recent, signals, warnings };
  return { exitCode: 0, stdout: options.format === 'text' ? renderText(output) : JSON.stringify(output, null, 2) };
}

if (require.main === module) {
  try {
    const { stdout, exitCode } = run();
    process.stdout.write(`${stdout}\n`);
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

module.exports = { run, parseArgs, readJsonl, readCockpitState };
