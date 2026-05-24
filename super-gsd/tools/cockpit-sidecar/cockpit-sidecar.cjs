#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { computeStagePipeline } = require('./stage-pipeline.cjs');
const { renderAnsi } = require('./sparkline.cjs');
const { computeRationale } = require('./rationale.cjs');

function attachStagePipeline(output, opts) {
  const phaseDir = (opts && opts.phase_dir) || null;
  const vtpEnabled = !opts || opts.vtp_enabled !== false;
  const blocker = (opts && opts.blocker) || null;
  output.stage_pipeline = computeStagePipeline({ phase_dir: phaseDir, vtp_enabled: vtpEnabled, blocker });
  return output;
}

function attachRationale(output, opts) {
  const milestoneId = (opts && opts.milestone) || output.milestone;
  const phaseId = (opts && opts.phase) || output.phase;
  if (!milestoneId || !phaseId) {
    output.rationale = computeRationale({});
    return output;
  }
  const phaseDir = (opts && opts.phase_dir) || null;
  const projectMd = '.planning/PROJECT.md';
  const intentMd = `.planning/milestones/${milestoneId}/INTENT.md`;
  const lastSummaryMd = (opts && opts.last_summary_md) || null;
  const contextMd = phaseDir ? `${phaseDir}/${phaseId}-CONTEXT.md` : null;
  output.rationale = computeRationale({ project_md: projectMd, intent_md: intentMd, last_summary_md: lastSummaryMd, context_md: contextMd });
  return output;
}
const { execFileSync } = require('child_process');
const { computeFogScore } = require('./fog-score.cjs');
const { computeNorthStar } = require('./north-star.cjs');
const { evaluateAlerts } = require('./alert-grammar.cjs');

const DEFAULTS = { cockpitState: '.planning/STATE.md', chronicleIndex: '.planning/chronicles/INDEX.jsonl',
  validatorLog: '.planning/metrics/chronicle-validation-log.jsonl',
  executorLog: '.planning/metrics/codex-executor-log.jsonl',
  tokenAttribution: '.planning/metrics/token-attribution.jsonl', format: 'json', bands: ['1', '2'] };

const VALUE_OPTIONS = { '--cockpit-state': 'cockpitState', '--chronicle-index': 'chronicleIndex',
  '--validator-log': 'validatorLog', '--executor-log': 'executorLog',
  '--token-attribution': 'tokenAttribution', '--milestone': 'milestone', '--phase': 'phase',
  '--bands': 'bands' };

const FOG_SIGNALS = ['dispatch_count', 'token_spend', 'files_changed', 'review_loops',
  'disputed_claims_count', 'stale_findings_count', 'plan_revisions', 'unresolved_risks_count',
  'minutes_since_operator_decision', 'dependency_depth'];

function usage() {
  return [
    'Usage: node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs [options]',
    '  --cockpit-state <path> --chronicle-index <path> --validator-log <path>',
    '  --executor-log <path> --token-attribution <path>',
    '  --milestone <id> --phase <id> --bands <1,2,3|all> --json|--text|--brief|--html'
  ].join('\n');
}

function parseBands(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '1,2');
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const expanded = parts.includes('all') ? ['1', '2', '3'] : parts;
  const invalid = expanded.find((part) => !['1', '2', '3'].includes(part));
  if (invalid) throw new Error(`invalid --bands value ${invalid}`);
  return Array.from(new Set(expanded));
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--bands=')) {
      options.bands = parseBands(arg.slice('--bands='.length));
    } else if (arg === '--json' || arg === '--text' || arg === '--brief' || arg === '--html') {
      options.format = arg.slice(2);
    } else if (VALUE_OPTIONS[arg]) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      options[VALUE_OPTIONS[arg]] = VALUE_OPTIONS[arg] === 'bands' ? parseBands(value) : value;
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

function recommendedAction(code) {
  switch (code) {
    case 'BLOCKED':
      return 'resolve the binding gate before close';
    case 'CHRONICLE_FAILED':
      return 'fix the chronicle citation, re-validate';
    case 'NEEDS_OPERATOR':
      return 'operator decision required — see blockers';
    case 'HEAVY_PHASE':
      return 'read the must-read chronicle sections';
    case 'ON_TRACK':
      return 'continue — advance to the next phase';
    default:
      return 'review cockpit state';
  }
}

function valueOr(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

function latestChroniclePath(output) {
  const latest = output.latest_chronicle;
  return latest && latest.location ? latest.location : 'none';
}

function northStarLine(output) {
  const northStar = output.north_star || {};
  const code = northStar.code || 'UNKNOWN';
  const message = northStar.message || 'review cockpit state';
  return `NORTH STAR [${code}]: ${message}`;
}

function alertLine(output) {
  const alerts = output.alerts || {};
  if (!alerts.top) return null;
  const more = alerts.others_count > 0 ? `  (+${alerts.others_count} more)` : '';
  return `⚠ ${alerts.top.signal}${more}`;
}

function withColor(line, color, enabled) {
  return enabled ? `${color}${line}\x1b[0m` : line;
}

function useColor(opts) {
  return Object.prototype.hasOwnProperty.call(opts || {}, 'color') ? Boolean(opts.color) : Boolean(process.stdout.isTTY);
}

function answerFirstLines(output, opts) {
  const color = useColor(opts);
  const lines = [
    withColor(northStarLine(output), '\x1b[1m\x1b[36m', color),
    `▸ DO NEXT: ${recommendedAction(output.north_star && output.north_star.code)}`
  ];
  const alert = alertLine(output);
  if (alert) lines.push(withColor(alert, '\x1b[1m\x1b[33m', color));
  return lines;
}

function supportingLines(output) {
  const fog = output.fog_score || {};
  const signals = output.signals || {};
  return [
    'SUPPORTING',
    `${output.milestone || 'null'}/${output.phase || 'null'}`,
    `gate ${output.binding_gate_status || 'null'}`,
    `fog ${valueOr(fog.tier, 'n/a')} / ${valueOr(fog.score, 'n/a')}`,
    `dispatches ${valueOr(signals.dispatch_count, 'n/a')}`,
    `latest chronicle ${latestChroniclePath(output)}`
  ];
}

const BOX_WIDTH = 69;
const INNER_WIDTH = BOX_WIDTH - 2;
const DEFAULT_STAGES = ['research', 'vtp-enrich', 'plan', 'execute', 'verify'];
const STATUS_MARKS = { done: '✓', active: '⏳', blocked: '🛑', pending: '' };
const ALERT_COLORS = {
  accent: '\x1b[36m',
  success: '\x1b[32m',
  attention: '\x1b[33m',
  severe: '\x1b[35m',
  danger: '\x1b[31m',
  done: '\x1b[32m',
};

function visibleLength(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/g, '').length;
}

function fitText(value, width) {
  const text = String(value === undefined || value === null ? '' : value);
  const visible = visibleLength(text);
  if (visible <= width) return text + ' '.repeat(width - visible);
  if (width <= 1) return '…'.slice(0, width);
  return text.slice(0, Math.max(0, width - 1)) + '…';
}

function boxLine(content) {
  return `│ ${fitText(content, INNER_WIDTH - 2)} │`;
}

function topRule(title) {
  const label = `─ ${title} `;
  return `┌${label}${'─'.repeat(Math.max(0, BOX_WIDTH - 2 - label.length))}┐`;
}

function midRule() {
  return `├${'─'.repeat(BOX_WIDTH - 2)}┤`;
}

function bottomRule() {
  return `└${'─'.repeat(BOX_WIDTH - 2)}┘`;
}

function alertColor(output) {
  const tier = output && output.alerts && output.alerts.top && output.alerts.top.palette_tier;
  return ALERT_COLORS[tier] || ALERT_COLORS.attention;
}

function stageCells(output) {
  const pipeline = output.stage_pipeline || {};
  const stages = Array.isArray(pipeline.stages) && pipeline.stages.length > 0
    ? pipeline.stages.slice(0, 5)
    : DEFAULT_STAGES.map((name) => ({ name, status: 'pending' }));

  return stages.map((stage) => {
    const mark = STATUS_MARKS[stage.status] || '';
    return mark ? `${stage.name} ${mark}` : stage.name;
  }).join('  ');
}

function activeStage(output) {
  const pipeline = output.stage_pipeline || {};
  const stages = Array.isArray(pipeline.stages) ? pipeline.stages : [];
  return stages.find((stage) => stage.status === 'active' || stage.status === 'blocked') ||
    stages[pipeline.active_index] ||
    null;
}

function trendChip(value, warnAt, dangerAt) {
  const numeric = toNumber(value);
  if (numeric >= dangerAt) return 'high';
  if (numeric >= warnAt) return 'med';
  return 'low';
}

function trendLine(label, value, chip) {
  const numeric = valueOr(value, 'n/a');
  const sparkValue = toNumber(value);
  const sparkline = renderAnsi([sparkValue], { width: 16 });
  return `${label.padEnd(10)} ${String(numeric).padStart(5)}  ${sparkline}  ${chip}`;
}

function renderRationaleSection(output) {
  const rationale = output.rationale || {};
  const rows = [
    ['WHY THIS PHASE', rationale.why_this_phase],
    ['CONTEXT', rationale.context],
    ['ELI5', rationale.eli5],
    ['WHAT IS', rationale.what_is],
    ['WHAT COULD BE', rationale.what_could_be],
    ['EVIDENCE TRAIL', rationale.evidence_trail],
  ];
  const lines = [topRule('BAND 3 RATIONALE')];
  rows.forEach(([label, value]) => lines.push(boxLine(label), boxLine(valueOr(value, 'n/a'))));
  lines.push(bottomRule());
  return lines;
}

function renderText(output, opts = {}) {
  const color = useColor(opts);
  const bands = parseBands(opts.bands || ['1', '2']);
  const northStar = output.north_star || {};
  const message = northStar.message || northStarLine(output);
  const alert = alertLine(output);
  const signals = output.signals || {};
  const fog = output.fog_score || {};
  const pipeline = output.stage_pipeline || {};
  const stage = activeStage(output) || {};
  const eta = valueOr(stage.sla_minutes, '—');
  const unlock = valueOr(pipeline.unlock || pipeline.unlocks || pipeline.next_unlock, '—');
  const blocker = valueOr(pipeline.blocker, 'nothing');

  const lines = [
    topRule('NORTH STAR'),
    boxLine(withColor(message, '\x1b[1m\x1b[36m', color)),
    midRule(),
    boxLine(`▸ DO NEXT: ${recommendedAction(northStar.code)}`),
  ];

  if (alert) lines.push(boxLine(withColor(alert, alertColor(output), color)));

  lines.push(
    midRule(),
    boxLine(`STAGE  ${stageCells(output)}`),
    boxLine(`WHY    ${valueOr(stage.owner, '—')} · cause: — · ETA: ~${eta}m`),
    boxLine(`UNLOCK ${unlock}`),
    boxLine(`BLOCK  ${blocker}`),
    boxLine(''),
    boxLine(trendLine('fog', valueOr(fog.score, 0), valueOr(fog.tier, trendChip(fog.score, 30, 60)))),
    boxLine(trendLine('dispatch', valueOr(signals.dispatch_count, 0), trendChip(signals.dispatch_count, 8, 12))),
    boxLine(trendLine('tokens', valueOr(signals.token_spend, 0), trendChip(signals.token_spend, 100000, 500000))),
    bottomRule()
  );

  if (bands.includes('3')) {
    lines.push('', ...renderRationaleSection(output));
  }

  return lines.join('\n');
}

function renderBrief(output) {
  return answerFirstLines(output, { color: Boolean(process.stdout.isTTY) }).join('\n');
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(output) {
  let designSystemCss = '';
  try {
    designSystemCss = fs.readFileSync(path.join(__dirname, '..', 'shared', 'sgsd-design-system.css'), 'utf8');
  } catch (_error) {
    designSystemCss = '';
  }

  const alert = alertLine(output);
  const alertHtml = alert ? `    <div class="callout" role="alert">${escapeHtml(alert)}</div>\n` : '';
  const fog = output.fog_score || {};
  const signals = output.signals || {};

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>SGSD Cockpit</title>',
    '  <style>',
    designSystemCss,
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="sgsd-cockpit">',
    '    <section role="operator-decision" class="operator-decision">',
    `      <p class="eyebrow">${escapeHtml(northStarLine(output))}</p>`,
    `      <p class="do-next recommended-action">▸ DO NEXT: ${escapeHtml(recommendedAction(output.north_star && output.north_star.code))}</p>`,
    '    </section>',
    alertHtml.trimEnd(),
    '    <details class="supporting-block">',
    '      <summary>Supporting state</summary>',
    '      <dl>',
    `        <dt>Scope</dt><dd>${escapeHtml(output.milestone || 'null')}/${escapeHtml(output.phase || 'null')}</dd>`,
    `        <dt>Gate</dt><dd>${escapeHtml(output.binding_gate_status || 'null')}</dd>`,
    `        <dt>Fog</dt><dd>${escapeHtml(valueOr(fog.tier, 'n/a'))} / ${escapeHtml(valueOr(fog.score, 'n/a'))}</dd>`,
    `        <dt>Dispatches</dt><dd>${escapeHtml(valueOr(signals.dispatch_count, 'n/a'))}</dd>`,
    `        <dt>Latest chronicle</dt><dd>${escapeHtml(latestChroniclePath(output))}</dd>`,
    '      </dl>',
    '    </details>',
    '  </main>',
    '</body>',
    '</html>'
  ].filter((line) => line !== '').join('\n');
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
  output.north_star = computeNorthStar(output);
  output.alerts = evaluateAlerts(output);
  const phaseSlugVal = id(first(cockpit.state, ['phase_slug', 'active_phase_slug']));
  const phaseDirGuess = milestone && phase
    ? `.planning/milestones/${milestone}/phases/${phase}${phaseSlugVal ? '-' + phaseSlugVal : ''}`
    : null;
  let vtpEnabled = true;
  try {
    const cfg = JSON.parse(fs.readFileSync(absolutePath('.planning/config.json'), 'utf8'));
    if (cfg && cfg.workflow && cfg.workflow.triage_vtp_enrichment === false) vtpEnabled = false;
  } catch (_e) { /* default true */ }
  attachStagePipeline(output, { phase_dir: phaseDirGuess, vtp_enabled: vtpEnabled });
  attachRationale(output, { phase_dir: phaseDirGuess });

  if (options.format === 'text') return { exitCode: 0, stdout: renderText(output, options) };
  if (options.format === 'brief') return { exitCode: 0, stdout: renderBrief(output) };
  if (options.format === 'html') return { exitCode: 0, stdout: renderHtml(output) };
  return { exitCode: 0, stdout: JSON.stringify(output, null, 2) };
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

module.exports = { run, parseArgs, readJsonl, readCockpitState, renderText, renderBrief, renderHtml, recommendedAction };
module.exports.attachStagePipeline = attachStagePipeline;
module.exports.attachRationale = attachRationale;
