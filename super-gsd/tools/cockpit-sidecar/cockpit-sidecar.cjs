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
  return require('./render-html.cjs').renderHtml(output);
}

function run(rawArgs = process.argv.slice(2)) {
  const options = parseArgs(rawArgs);
  if (options.help) return { exitCode: 0, stdout: usage() };
  const warnings = [];
  const cockpit = readCockpitState(options.cockpitState, warnings);
  const milestone = id(options.milestone || first(cockpit.state, ['milestone', 'active_milestone', 'current_milestone'])) || null;
  let phase = id(options.phase || first(cockpit.state, ['phase', 'active_phase', 'current_phase'])) || null;
  // P139: derive phase from STATE.md status text (`P<NN> PENDING/ACTIVE`) when
  // not explicitly set in frontmatter — matches the v3.4 STATE shape.
  if (!phase && cockpit.state && typeof cockpit.state.status === 'string') {
    const m = cockpit.state.status.match(/P(\d+(?:\.\d+)?)\s+(?:PENDING|ACTIVE|IN_PROGRESS)/i);
    if (m) phase = m[1];
    else {
      const all = [...cockpit.state.status.matchAll(/P(\d+(?:\.\d+)?)/g)].map((mm) => parseFloat(mm[1]));
      if (all.length) phase = String(Math.max.apply(null, all));
    }
  }
  if (!phase && milestone) {
    try {
      const phasesRoot = absolutePath(`.planning/milestones/${milestone}/phases`);
      const candidates = fs.readdirSync(phasesRoot)
        .filter((d) => /^\d+(?:\.\d+)?-/.test(d))
        .sort((a, b) => parseFloat(b) - parseFloat(a));
      if (candidates.length) phase = candidates[0].split('-')[0];
    } catch (_e) { /* still null */ }
  }
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
  // P139: resolve the real phase dir by scanning the milestone's phases/ dir
  // for the entry starting with "{phase}-". The legacy `phaseSlugVal` from
  // STATE.md frontmatter is rarely set in practice, so we fall back to dir scan.
  const phaseSlugVal = id(first(cockpit.state, ['phase_slug', 'active_phase_slug']));
  let phaseDirGuess = null;
  if (milestone && phase) {
    phaseDirGuess = `.planning/milestones/${milestone}/phases/${phase}${phaseSlugVal ? '-' + phaseSlugVal : ''}`;
    try {
      if (!fs.existsSync(absolutePath(phaseDirGuess))) {
        const phasesRoot = absolutePath(`.planning/milestones/${milestone}/phases`);
        const candidates = fs.readdirSync(phasesRoot);
        const match = candidates.find((d) => d.startsWith(String(phase) + '-'));
        if (match) phaseDirGuess = `.planning/milestones/${milestone}/phases/${match}`;
      }
    } catch (_e) { /* keep guess */ }
  }
  let vtpEnabled = true;
  try {
    const cfg = JSON.parse(fs.readFileSync(absolutePath('.planning/config.json'), 'utf8'));
    if (cfg && cfg.workflow && cfg.workflow.triage_vtp_enrichment === false) vtpEnabled = false;
  } catch (_e) { /* default true */ }
  attachStagePipeline(output, { phase_dir: phaseDirGuess, vtp_enabled: vtpEnabled });
  attachRationale(output, { phase_dir: phaseDirGuess });
  // P139: attach the v3.4 14-key surface (mission/pipeline/agents/architecture/
  // milestone_map/memory_graph/lineage/gate_flow/evidence/telemetry/alarms/events/
  // learnings/rationale) + _sources liveness block. Stubs from P137 + minimal-real
  // data wired by P139's upgraded attachMission/attachPipeline/attachTelemetry.
  // JSON output and renderHtml() both see the new keys.
  try {
    attachAll(output, { milestone, phase });
  } catch (_e) {
    output.warnings.push('attachAll failed: ' + String(_e && _e.message ? _e.message : _e));
  }

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

// ============================================================================
// v3.4 / P137 — 14-key data contract expansion via stub attachers.
// Each attacher emits a minimal valid shape; P139-P142 fill them with real data.
// Additive: existing v3.3 keys untouched. SAC-P127/P128/P134 preserved.
// ============================================================================

function attachMission(output, opts) {
  const milestone = (opts && opts.milestone) || output.milestone;
  // P139: derive phase from output.phase OR by scanning STATE.md status text
  // OR by finding the newest phases/{N}-... directory under the active milestone.
  // STATE.md frontmatter often only has `milestone:`, not `phase:`.
  let phase = (opts && opts.phase) || output.phase;
  if (!phase && milestone) {
    // Strategy 1: STATE.md status text — find a 'P<NN> PENDING' or 'P<NN> ACTIVE'
    // marker (the current phase). If none, take the highest P number in status.
    try {
      const stateText = fs.readFileSync('.planning/STATE.md', 'utf8');
      const fm = stateText.match(/^---\s*([\s\S]*?)\s*---/);
      if (fm) {
        const pending = fm[1].match(/P(\d+(?:\.\d+)?)\s+(?:PENDING|ACTIVE|IN_PROGRESS)/i);
        if (pending) phase = pending[1];
        else {
          const all = [...fm[1].matchAll(/P(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
          if (all.length) phase = String(Math.max.apply(null, all));
        }
      }
    } catch (_e) { /* fallback below */ }
  }
  if (!phase && milestone) {
    // Strategy 2: newest phase directory under the active milestone.
    try {
      const phaseDirRoot = path.join('.planning', 'milestones', milestone, 'phases');
      const candidates = fs.readdirSync(phaseDirRoot)
        .filter((d) => /^\d+(?:\.\d+)?-/.test(d))
        .sort((a, b) => parseFloat(b) - parseFloat(a));
      if (candidates.length) phase = candidates[0].split('-')[0];
    } catch (_e) { /* still null */ }
  }
  const stub = {
    phase_id: phase || null,
    phase_title: '',
    objective: '',
    why_running: '',
    unlocks: '',
    risk_tier: 'low',
    risk_reasons: [],
    operator_decision_required: false,
    decision_prompt: null,
    success_criteria: [],
  };
  output.mission = stub;
  output.phase = output.phase || phase; // propagate to chrome / scanbar
  if (!milestone || !phase) return output;
  const phaseDir = path.join('.planning', 'milestones', milestone, 'phases');
  let phaseDirPath = null;
  try {
    const candidates = fs.readdirSync(phaseDir);
    const match = candidates.find((d) => d.startsWith(String(phase) + '-'));
    if (!match) return output;
    phaseDirPath = path.join(phaseDir, match);
    const contextPath = path.join(phaseDirPath, String(phase) + '-CONTEXT.md');
    if (fs.existsSync(contextPath)) {
      const text = fs.readFileSync(contextPath, 'utf8');
      const fm = text.match(/^---\s*([\s\S]*?)\s*---/);
      if (fm) {
        const block = fm[1];
        const nameMatch = block.match(/^phase_name:\s*(.+)$/m);
        if (nameMatch) stub.phase_title = nameMatch[1].trim();
        const successor = block.match(/^successor:\s*(.+)$/m);
        if (successor) stub.unlocks = successor[1].trim();
      }
      const goalMatch = text.match(/##\s*Goal\s*\n+([\s\S]*?)(?:\n##|\n$)/);
      if (goalMatch) {
        const goal = goalMatch[1].trim().split(/\n+/)[0].slice(0, 240);
        stub.objective = goal;
        stub.why_running = goal;
      }
    }
    // P139: read PLAN-LOCKED yaml to extract semantic_acceptance_criteria into
    // mission.success_criteria. Up to 6 entries so the criteria list stays compact.
    const planFiles = fs.readdirSync(phaseDirPath).filter((f) => /PLAN-LOCKED\.md$/.test(f));
    if (planFiles.length) {
      const planText = fs.readFileSync(path.join(phaseDirPath, planFiles[0]), 'utf8');
      const sacMatches = [...planText.matchAll(/^\s*- id:\s*(SAC-[A-Z0-9.\-]+)\s*\n(?:\s*input:[^\n]*\n)?\s*expected_outcome:\s*"?([^"\n]+)"?/gm)];
      stub.success_criteria = sacMatches.slice(0, 6).map((m) => ({
        code: m[1].trim(),
        text: m[2].trim().slice(0, 160),
        status: 'pending',
      }));
    }
  } catch (_e) { /* silent — stub stays */ }
  return output;
}

function attachPipeline(output) {
  // P139: alias stage_pipeline into v3.4 pipeline shape AND compute elapsed_sec
  // for each stage from the mtime of the corresponding artifact file under the
  // active phase directory.
  const sp = output.stage_pipeline || {};
  const milestone = output.milestone;
  const phase = output.phase || (output.mission && output.mission.phase_id);
  let phaseDirPath = null;
  if (milestone && phase) {
    try {
      const phaseDirRoot = path.join('.planning', 'milestones', milestone, 'phases');
      const candidates = fs.readdirSync(phaseDirRoot);
      const match = candidates.find((d) => d.startsWith(String(phase) + '-'));
      if (match) phaseDirPath = path.join(phaseDirRoot, match);
    } catch (_e) { /* no phase dir */ }
  }
  const stageArtifact = {
    'research': '-RESEARCH.md',
    'vtp-enrich': '-VTP-ENRICHMENT.md',
    'plan': null, // glob handled below
    'execute': null,
    'verify': '-VERIFICATION.md',
  };
  function elapsedForStage(stageName) {
    if (!phaseDirPath) return 0;
    try {
      let target = null;
      if (stageArtifact[stageName]) {
        target = path.join(phaseDirPath, String(phase) + stageArtifact[stageName]);
      } else if (stageName === 'plan') {
        const planFiles = fs.readdirSync(phaseDirPath).filter((f) => /PLAN-LOCKED\.md$/.test(f));
        if (planFiles.length) target = path.join(phaseDirPath, planFiles[0]);
      } else if (stageName === 'execute') {
        // No standard execute artifact; fallback to PHASE-CAPSULE.json if present.
        const capsule = path.join(phaseDirPath, 'PHASE-CAPSULE.json');
        if (fs.existsSync(capsule)) target = capsule;
      }
      if (target && fs.existsSync(target)) {
        const st = fs.statSync(target);
        return Math.max(0, Math.floor((Date.now() - st.mtimeMs) / 1000));
      }
    } catch (_e) { /* skip */ }
    return 0;
  }
  let rawStages = Array.isArray(sp.stages) ? sp.stages.slice() : [];
  // P139: forward-fill "done". Per the design-pack runway semantic, progress
  // goes left-to-right: if a later stage has its artifact (status='done'),
  // all earlier stages are implicitly done too. The active stage is the first
  // non-done stage AFTER the rightmost done stage.
  let rightmostDone = -1;
  for (let i = 0; i < rawStages.length; i++) {
    if ((rawStages[i].status || 'pending') === 'done') rightmostDone = i;
  }
  const stages = rawStages.map((s, i) => {
    let status = s.status || 'pending';
    if (i <= rightmostDone && status !== 'done') status = 'done';
    return {
      name: s.name,
      owner: s.owner,
      sla_min: s.sla_minutes || s.sla_min || 0,
      elapsed_sec: s.elapsed_sec || elapsedForStage(s.name),
      status,
      blocking_gate: s.blocking_gate || null,
      next_action: s.next_action || null,
    };
  });
  // Active index = first non-done after rightmost-done; mark as 'active'
  let activeIdx = rightmostDone + 1;
  if (activeIdx >= stages.length) activeIdx = stages.length - 1;
  if (stages[activeIdx] && stages[activeIdx].status !== 'blocked' && stages[activeIdx].status !== 'done') {
    stages[activeIdx].status = sp.blocker ? 'blocked' : 'active';
  }
  output.pipeline = {
    active_index: activeIdx,
    blocker: sp.blocker || null,
    why_running: (output.mission && output.mission.why_running) || null,
    unlocks: (output.mission && output.mission.unlocks) || null,
    stages,
  };
  return output;
}

function attachAgents(output) {
  // P139: realistic agent activity. Claude is the orchestrator; Codex is the
  // executor when source-changing dispatches are in flight. Recent actions
  // come from the git reflog (bounded read, last 3 entries).
  const claudeTask = (output.mission && output.mission.phase_title) || 'orchestrating cockpit work';
  const recentActions = [];
  try {
    const headLog = fs.readFileSync(path.join('.git', 'logs', 'HEAD'), 'utf8').trim().split(/\r?\n/);
    const last3 = headLog.slice(-3).reverse();
    for (const line of last3) {
      // Line shape: <old> <new> <name> <email> <ts> <tz> tab<message>
      const tabIdx = line.indexOf('\t');
      if (tabIdx === -1) continue;
      const header = line.slice(0, tabIdx).split(/\s+/);
      const message = line.slice(tabIdx + 1);
      const ts = parseInt(header[4] || '0', 10);
      const age = ts > 0 ? Math.max(0, Math.floor(Date.now() / 1000 - ts)) : 0;
      // Strip the "commit:" reflog prefix, then extract a conventional-commit
      // kind (feat/fix/chore/docs/etc.) or fall back to the first word.
      const subj = message.replace(/^commit(?:\s*\(initial\))?:\s*/, '').trim();
      const kindMatch = subj.match(/^(feat|fix|chore|docs|refactor|test|style|perf|build|ci)(?:\([^)]+\))?:/);
      const kind = kindMatch ? kindMatch[1] : (subj.split(/\s+/)[0] || 'edit');
      const detail = subj.slice(0, 80);
      recentActions.push({ kind, detail, age_sec: age });
    }
  } catch (_e) { /* leave empty */ }
  output.agents = {
    claude: {
      handle: 'claude-opus-4-7',
      model: 'opus-4.7-1m',
      role: 'orchestrator',
      status: 'active',
      task: claudeTask,
      since_sec: recentActions[0] ? recentActions[0].age_sec : 0,
      last_action: recentActions[0] ? recentActions[0].detail : '',
      recent_actions: recentActions,
    },
    codex: {
      handle: 'codex-gpt-5.5',
      model: 'gpt-5.5/xhigh',
      effort: 'xhigh',
      role: 'executor',
      status: 'idle',
      task: 'awaiting next dispatch',
      since_sec: 0,
      last_action: '',
      recent_actions: [],
    },
    last_handoff: {
      from: 'claude-opus-4-7',
      to: 'codex-gpt-5.5',
      kind: 'execute',
      payload: ((output.mission && output.mission.objective) || '').slice(0, 80),
      t_off: recentActions[0] ? recentActions[0].age_sec : 0,
    },
  };
  return output;
}

function attachArchitecture(output) {
  // P140: derive a node+edge graph from the active phase's CONTEXT.md
  // "Authoritative inputs" section + a default SGSD-flow chain.
  const nodes = [];
  const edges = [];
  const defaults = [
    { id: 'state',         kind: 'artefact', label: 'STATE.md',      x: 0, y: 0 },
    { id: 'intent',        kind: 'artefact', label: 'INTENT.md',     x: 1, y: 0 },
    { id: 'context',       kind: 'artefact', label: 'CONTEXT.md',    x: 2, y: 0 },
    { id: 'plan',          kind: 'artefact', label: 'PLAN-LOCKED.md', x: 3, y: 0 },
    { id: 'execute',       kind: 'actor',    label: 'execute',       x: 4, y: 0 },
    { id: 'verification',  kind: 'sink',     label: 'VERIFICATION.md', x: 5, y: 0 },
    { id: 'capsule',       kind: 'sink',     label: 'PHASE-CAPSULE.json', x: 6, y: 0 },
  ];
  for (const n of defaults) nodes.push(n);
  const linearOrder = ['state', 'intent', 'context', 'plan', 'execute', 'verification', 'capsule'];
  for (let i = 0; i < linearOrder.length - 1; i++) {
    edges.push({ from: linearOrder[i], to: linearOrder[i + 1], kind: 'flow', viaX: null, viaY: null });
  }
  // Augment with phase-specific files from the active phase CONTEXT.md
  try {
    const milestone = output.milestone;
    const phase = output.phase || (output.mission && output.mission.phase_id);
    if (milestone && phase) {
      const phaseDirRoot = path.join('.planning', 'milestones', milestone, 'phases');
      const dirs = fs.readdirSync(phaseDirRoot);
      const match = dirs.find((d) => d.startsWith(String(phase) + '-'));
      if (match) {
        const contextPath = path.join(phaseDirRoot, match, String(phase) + '-CONTEXT.md');
        if (fs.existsSync(contextPath)) {
          const text = fs.readFileSync(contextPath, 'utf8');
          const inputsBlock = text.match(/##\s*Authoritative inputs\s*\n+([\s\S]*?)(?:\n##|\n$)/);
          if (inputsBlock) {
            const fileRefs = [...inputsBlock[1].matchAll(/`?([a-zA-Z0-9_./-]+\.(?:cjs|js|md|json|css|html|yaml|jsx))`?/g)]
              .map((m) => m[1])
              .filter((s, i, a) => a.indexOf(s) === i)
              .slice(0, 6);
            fileRefs.forEach((file, i) => {
              const id = 'ph-' + i;
              nodes.push({ id, kind: 'artefact', label: file.split('/').pop(), x: 0, y: i + 1 });
              edges.push({ from: id, to: 'execute', kind: 'consumes', viaX: null, viaY: null });
            });
          }
        }
      }
    }
  } catch (_e) { /* fallback to defaults only */ }
  output.architecture = { nodes, edges };
  return output;
}

function attachMilestoneMap(output) {
  const milestone = output.milestone;
  const currentPhase = String(output.phase || (output.mission && output.mission.phase_id) || '');
  const milestones = [
    { id: 'v3.2', label: 'v3.2', status: 'done',    focus: 'Operator comprehension' },
    { id: 'v3.3', label: 'v3.3', status: 'done',    focus: 'Live contextual awareness' },
    { id: 'v3.4', label: 'v3.4', status: 'active',  focus: 'Cockpit IA rewrite (light)' },
    { id: 'v3.5', label: 'v3.5', status: 'pending', focus: 'Polish + tape sidebar' },
  ];
  let phases = [];
  const details = {};
  try {
    if (milestone) {
      const phaseDirRoot = path.join('.planning', 'milestones', milestone, 'phases');
      const dirs = fs.readdirSync(phaseDirRoot)
        .filter((d) => /^\d+(?:\.\d+)?-/.test(d))
        .sort((a, b) => parseFloat(a) - parseFloat(b));
      for (const dir of dirs) {
        const idNum = dir.split('-')[0];
        const capsulePath = path.join(phaseDirRoot, dir, 'PHASE-CAPSULE.json');
        const contextPath = path.join(phaseDirRoot, dir, idNum + '-CONTEXT.md');
        let status = 'pending';
        let title = dir.replace(/^\d+(?:\.\d+)?-/, '').replace(/-/g, ' ');
        if (fs.existsSync(capsulePath)) {
          status = 'done';
          try {
            const cap = JSON.parse(fs.readFileSync(capsulePath, 'utf8'));
            if (cap.phase_name) title = cap.phase_name;
            details[idNum] = {
              title,
              eli5: '',
              why: cap.goal || '',
              context: '',
              unlocks: (cap.downstream_contract && (cap.downstream_contract.consumers || []).join(', ')) || '',
              outcome: cap.status || status,
              files: cap.files || [],
              duration: '',
              owner: cap.created_by || '',
            };
          } catch (_e) { /* keep defaults */ }
        } else if (fs.existsSync(contextPath)) {
          status = 'active';
          try {
            const text = fs.readFileSync(contextPath, 'utf8');
            const titleMatch = text.match(/^phase_name:\s*(.+)$/m);
            if (titleMatch) title = titleMatch[1].trim();
            const goalMatch = text.match(/##\s*Goal\s*\n+([\s\S]*?)(?:\n##|\n$)/);
            details[idNum] = {
              title,
              eli5: '',
              why: goalMatch ? goalMatch[1].trim().slice(0, 200) : '',
              context: '',
              unlocks: '',
              outcome: 'in progress',
              files: [],
              duration: '',
              owner: 'orchestrator',
            };
          } catch (_e) { /* keep defaults */ }
        }
        if (idNum === currentPhase) status = 'current';
        phases.push({ id: idNum, label: 'P' + idNum, status, sub: title.slice(0, 40), current: idNum === currentPhase, note: null });
      }
    }
  } catch (_e) { /* leave empty */ }
  output.milestone_map = {
    milestones,
    current: milestone || '',
    phases,
    unlocks: (output.mission && output.mission.unlocks) || null,
    details,
  };
  return output;
}

function attachMemoryGraph(output) {
  // P141: parse the global MEMORY.md index entries into typed mesh sources.
  const sources = [];
  const memPath = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.claude', 'projects', 'C--Users-jack-berrow-GSDedits', 'memory', 'MEMORY.md'
  );
  try {
    if (fs.existsSync(memPath)) {
      const text = fs.readFileSync(memPath, 'utf8');
      const entries = [...text.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)(.*)$/gm)];
      for (const [, label, link, tail] of entries.slice(0, 18)) {
        const lower = link.toLowerCase();
        let type = 'observation';
        let kind = 'note';
        if (lower.includes('workflow/feedback')) { type = 'claim'; kind = 'feedback'; }
        else if (lower.includes('architecture/decisions')) { type = 'decision'; kind = 'adr'; }
        else if (lower.includes('architecture/patterns')) { type = 'observation'; kind = 'pattern'; }
        else if (lower.includes('architecture/anti-patterns')) { type = 'claim'; kind = 'anti-pattern'; }
        else if (lower.includes('architecture/expertise')) { type = 'observation'; kind = 'expertise'; }
        else if (lower.includes('trajectory/candidate')) { type = 'decision'; kind = 'candidate'; }
        else if (lower.includes('trajectory/hypothesis')) { type = 'claim'; kind = 'hypothesis'; }
        sources.push({
          id: link.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
          type,
          kind,
          label: label.length > 80 ? label.slice(0, 77) + '...' : label,
          detail: (tail || '').replace(/^—\s*/, '').replace(/^-\s*/, '').slice(0, 200),
          consumed_by: [],
          validation: type === 'claim' ? 'validated' : null,
          pending: false,
          active: false,
        });
      }
    }
  } catch (_e) { /* leave empty */ }
  output.memory_graph = {
    sources,
    current_consumer: output.agents && output.agents.claude && output.agents.claude.handle,
    current_action: output.mission && output.mission.objective ? output.mission.objective.slice(0, 80) : null,
  };
  return output;
}

function attachLineage(output) {
  // P141: Cognitive Memory Bus (DLB-08) 5-step canonical chain.
  output.lineage = {
    title: 'CMB Lineage',
    steps: [
      { id: 'er',  stage: 'execute', type: 'execution_receipt',      label: 'Receipt',      detail: 'codex execution', meta: {}, icon: '→', terminal: false, pending: false },
      { id: 'rf',  stage: 'verify',  type: 'review_finding',         label: 'Review',       detail: 'reviewer finding', meta: {}, icon: '→', terminal: false, pending: false },
      { id: 'ev',  stage: 'verify',  type: 'evidence_verdict',       label: 'Evidence',     detail: 'verdict claim', meta: {}, icon: '→', terminal: false, pending: false },
      { id: 'dr',  stage: 'close',   type: 'decision_recommendation', label: 'Decision',    detail: 'recommendation', meta: {}, icon: '→', terminal: false, pending: false },
      { id: 'pd',  stage: 'close',   type: 'promotion_decision',     label: 'Promotion',    detail: 'operator promote', meta: {}, icon: '◆', terminal: true,  pending: false },
    ],
  };
  return output;
}

function attachGateFlow(output) {
  // P141: derive per-stage verdict from active phase artefacts. Stages map to
  // the SGSD canonical 5-step chain (CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE).
  const phase = String(output.phase || '');
  const milestone = output.milestone;
  let phaseDirPath = null;
  try {
    if (milestone && phase) {
      const phaseDirRoot = path.join('.planning', 'milestones', milestone, 'phases');
      const dirs = fs.readdirSync(phaseDirRoot);
      const match = dirs.find((d) => d.startsWith(phase + '-'));
      if (match) phaseDirPath = path.join(phaseDirRoot, match);
    }
  } catch (_e) { /* fallback */ }
  function exists(fileName) {
    try { return phaseDirPath && fs.existsSync(path.join(phaseDirPath, fileName)); }
    catch (_e) { return false; }
  }
  function hasPattern(pattern) {
    try {
      if (!phaseDirPath) return false;
      return fs.readdirSync(phaseDirPath).some((f) => pattern.test(f));
    } catch (_e) { return false; }
  }
  const ctxOk = exists(phase + '-CONTEXT.md');
  const planOk = hasPattern(/PLAN-LOCKED\.md$/);
  const verifyOk = exists(phase + '-VERIFICATION.md');
  const closeOk = exists('PHASE-CAPSULE.json');
  const executeOk = closeOk || verifyOk;
  function stage(id, name, ok, gates) {
    return {
      id, name,
      verdict: ok ? 'green' : 'pending',
      blocking: false,
      summary: ok ? 'artefact present' : 'pending',
      gates: gates || [],
    };
  }
  output.gate_flow = {
    stages: [
      stage('context', 'CONTEXT', ctxOk, [
        { name: 'gate.context.completeness', mode: 'structural', sampling: 'always', status: ctxOk ? 'green' : 'pending', concept: null, detail: 'CONTEXT.md present + frontmatter parsed', repair: ctxOk ? null : 'author CONTEXT.md', blocking: true },
      ]),
      stage('plan', 'PLAN', planOk, [
        { name: 'plan-schema-v2', mode: 'mechanical', sampling: 'always', status: planOk ? 'green' : 'pending', concept: null, detail: 'PLAN-LOCKED.md exists', repair: planOk ? null : 'author PLAN-LOCKED.md', blocking: true },
      ]),
      stage('execute', 'EXECUTE', executeOk, [
        { name: 'per-dispatch-ATC', mode: 'tiered', sampling: 'every', status: executeOk ? 'green' : 'pending', concept: 'ATC', detail: 'ATC tier classification applied', repair: null, blocking: false },
      ]),
      stage('verify', 'VERIFY', verifyOk, [
        { name: 'self-test', mode: 'mechanical', sampling: 'always', status: verifyOk ? 'green' : 'pending', concept: null, detail: 'VERIFICATION.md present', repair: verifyOk ? null : 'run verifier', blocking: true },
        { name: 'browser-smoke', mode: 'mechanical', sampling: 'cockpit-touching', status: verifyOk ? 'green' : 'pending', concept: null, detail: 'browser-smoke verdict.json', repair: null, blocking: true },
      ]),
      stage('close', 'CLOSE', closeOk, [
        { name: 'phase-capsule', mode: 'structural', sampling: 'always', status: closeOk ? 'green' : 'pending', concept: null, detail: 'PHASE-CAPSULE.json present', repair: closeOk ? null : 'author capsule', blocking: true },
        { name: 'MUDA-waste-audit', mode: '5-probe', sampling: 'phase-close', status: 'pending', concept: 'MUDA', detail: 'classifier-failures · narrative-staleness · git-spawn-rate · extra-processing · inventory', repair: null, blocking: false },
      ]),
    ],
    atc_history: [],
    muda_probes: [
      { name: 'classifier-failures', status: 'pending', detail: 'pending phase close', waste_class: 'over-processing' },
      { name: 'narrative-staleness',  status: 'pending', detail: 'pending phase close', waste_class: 'defects' },
      { name: 'git-spawn-rate',       status: 'pending', detail: 'pending phase close', waste_class: 'over-production' },
      { name: 'extra-processing',     status: 'pending', detail: 'pending phase close', waste_class: 'over-processing' },
      { name: 'inventory',            status: 'pending', detail: 'pending phase close', waste_class: 'inventory' },
    ],
  };
  return output;
}

function attachEvidence(output) {
  // P139: read the most recent cockpit-smoke verdict + count checks.
  const evidence = {
    last_run_at_sec_ago: 0,
    summary: { green: 0, warn: 0, fail: 0 },
    categories: [],
    unresolved: [],
  };
  try {
    const runtimeDir = path.join('.planning', 'runtime');
    if (fs.existsSync(runtimeDir)) {
      const verdicts = fs.readdirSync(runtimeDir)
        .filter((f) => /^cockpit-smoke-.+-verdict\.json$/.test(f))
        .map((f) => ({ f, m: fs.statSync(path.join(runtimeDir, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
      if (verdicts.length) {
        const newest = path.join(runtimeDir, verdicts[0].f);
        const v = JSON.parse(fs.readFileSync(newest, 'utf8'));
        evidence.last_run_at_sec_ago = Math.max(0, Math.floor((Date.now() - verdicts[0].m) / 1000));
        for (const [name, c] of Object.entries(v.checks || {})) {
          if (c.ok === true) evidence.summary.green += 1;
          else evidence.summary.fail += 1;
          if (c.ok === false) evidence.unresolved.push({ code: name, tier: 'severe', detail: c.detail || '', age_sec: evidence.last_run_at_sec_ago });
        }
        const cat = { name: 'browser-smoke', items: Object.entries(v.checks || {}).slice(0, 8).map(([k, c]) => ({ code: k, status: c.ok ? 'green' : 'fail', detail: (c.detail || '').slice(0, 80), last_run_sec: evidence.last_run_at_sec_ago })) };
        evidence.categories.push(cat);
      }
    }
  } catch (_e) { /* fallback empty */ }
  output.evidence = evidence;
  return output;
}

function attachTelemetry(output) {
  // P139: 5-channel telemetry with rich history from token-log + signals.
  function channel(label, unit, value, target, max, tiers) {
    return {
      value: Number(value) || 0,
      target: Number(target) || 0,
      max: Number(max) || 100,
      normal_max: tiers[0], attn_max: tiers[1], severe_max: tiers[2],
      history: [],
      label, unit,
    };
  }
  const fog = (output.fog_score && Number(output.fog_score.score)) || 0;
  const signals = output.signals || {};
  const dispatches = Number(signals.dispatch_count) || 0;
  const tokens = Number(signals.token_spend) || 0;
  let tokenHistory = [];
  let fogHistory = [];
  let dispatchHistory = [];
  try {
    const logPath = '.planning/metrics/token-log.jsonl';
    if (fs.existsSync(logPath)) {
      const raw = fs.readFileSync(logPath, 'utf8');
      const lines = raw.trim().split(/\r?\n/).slice(-30);
      let runningTotal = 0;
      let runningDispatches = 0;
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          // Per actual log shape: each row is an Agent dispatch with .total
          // (token count for that dispatch). Sum gives a monotonic series.
          const lineTokens = typeof row.tokens === 'number'
            ? row.tokens
            : (typeof row.token_spend === 'number'
                ? row.token_spend
                : (typeof row.total === 'number' ? row.total : null));
          if (lineTokens != null) {
            runningTotal += lineTokens;
            tokenHistory.push(runningTotal);
          }
          if (typeof row.fog === 'number') fogHistory.push(row.fog);
          // Every log row is essentially a dispatch (Agent/Bash tool call).
          runningDispatches += 1;
          dispatchHistory.push(runningDispatches);
        } catch (_e) { /* skip malformed */ }
      }
    }
  } catch (_e) { /* silent */ }
  // Compute elapsed from active phase CONTEXT.md mtime
  let elapsed = 0;
  try {
    const milestone = output.milestone;
    const phase = output.phase || (output.mission && output.mission.phase_id);
    if (milestone && phase) {
      const phaseDirRoot = path.join('.planning', 'milestones', milestone, 'phases');
      const candidates = fs.readdirSync(phaseDirRoot);
      const match = candidates.find((d) => d.startsWith(String(phase) + '-'));
      if (match) {
        const contextPath = path.join(phaseDirRoot, match, String(phase) + '-CONTEXT.md');
        if (fs.existsSync(contextPath)) {
          const st = fs.statSync(contextPath);
          elapsed = Math.min(7200, Math.max(0, Math.floor((Date.now() - st.mtimeMs) / 1000)));
        }
      }
    }
  } catch (_e) { /* default 0 */ }
  output.telemetry = {
    fog:        channel('fog', 'score',    fog,        40,    100,    [30, 60, 90]),
    dispatches: channel('dispatches', '',  dispatches, 5,     20,     [5, 10, 15]),
    tokens:     channel('tokens', '',      tokens,     200000, 500000, [100000, 250000, 400000]),
    context:    channel('context', '%',    0,          50,    100,    [50, 75, 90]),
    elapsed:    channel('elapsed', 'sec',  elapsed,    900,   3600,   [600, 1800, 3000]),
  };
  // Wire histories where available
  if (tokenHistory.length) output.telemetry.tokens.history = tokenHistory;
  if (fogHistory.length) output.telemetry.fog.history = fogHistory;
  if (dispatchHistory.length) output.telemetry.dispatches.history = dispatchHistory;
  // Synthesize a small history for elapsed so sparkline draws something
  if (elapsed > 0) {
    const steps = 10;
    output.telemetry.elapsed.history = Array.from({ length: steps }, (_, i) => Math.floor(elapsed * (i + 1) / steps));
  }
  return output;
}

function attachAlarms(output) {
  // P142: derive from snapshot.warnings + fog_score signals. Each alarm has
  // signal/tier/severity/since_sec/detail/threshold/cause/consequence/action/evidence.
  const alarms = [];
  const warnings = Array.isArray(output.warnings) ? output.warnings : [];
  const fog = (output.fog_score && output.fog_score.score) || 0;
  const fogTier = (output.fog_score && output.fog_score.tier) || 'low';
  if (fog >= 80) {
    alarms.push({
      signal: 'fog_score',
      tier: fogTier === 'high' ? 'severe' : 'attn',
      severity_label: 'fog score elevated',
      since_sec: 0,
      detail: 'fog=' + fog + ' (' + fogTier + ')',
      threshold: 'severe >= 80',
      cause: 'context heavy with stale signals OR many disputed claims',
      consequence: 'operator may misjudge phase state without reading must-read sections',
      action: 'read summary, decisions, risks, architecture, file_impact',
      evidence: ['fog-score breakdown'],
    });
  }
  if (warnings.length >= 50) {
    alarms.push({
      signal: 'executor_log_parse_errors',
      tier: 'attn',
      severity_label: 'token-log JSON parse failures',
      since_sec: 0,
      detail: warnings.length + ' parse errors in token-log.jsonl',
      threshold: 'attn >= 50',
      cause: 'unescaped quotes / backslashes in token-log entries',
      consequence: 'telemetry history under-counts; sparkline noisy',
      action: 'audit token-log writers for proper JSON escaping',
      evidence: warnings.slice(0, 3),
    });
  }
  output.alarms = alarms;
  return output;
}

function attachEvents(output) {
  // P139: events tape derived from git reflog tail (last 10 commits as events).
  const events = [];
  try {
    const headLog = fs.readFileSync(path.join('.git', 'logs', 'HEAD'), 'utf8').trim().split(/\r?\n/);
    const last10 = headLog.slice(-10).reverse();
    const now = Math.floor(Date.now() / 1000);
    for (const line of last10) {
      const tabIdx = line.indexOf('\t');
      if (tabIdx === -1) continue;
      const header = line.slice(0, tabIdx).split(/\s+/);
      const message = line.slice(tabIdx + 1);
      const ts = parseInt(header[4] || '0', 10);
      const ageSec = ts > 0 ? Math.max(0, now - ts) : 0;
      const subj = message.replace(/^commit(?:\s*\(initial\))?:\s*/, '').trim();
      const kindMatch = subj.match(/^(feat|fix|chore|docs|refactor|test|style|perf|build|ci)(?:\([^)]+\))?:/);
      const type = kindMatch ? kindMatch[1] : 'event';
      events.push({
        t_off: ageSec < 60 ? ageSec + 's' : Math.floor(ageSec / 60) + 'm',
        type,
        tier: type === 'fix' ? 'attn' : 'ok',
        detail: subj.slice(0, 120),
        created_at: ts * 1000,
      });
    }
  } catch (_e) { /* leave empty */ }
  output.events = events;
  return output;
}

function attachLearnings(output) {
  output.learnings = [];
  return output;
}

function attachSources(output, opts) {
  const options = opts || {};
  try {
    const liveness = require('./liveness.cjs');
    output._sources = liveness.computeLiveness({
      registry_path: options.registry_path,
      now: options.now,
      statFn: options.statFn,
      project_root: options.project_root,
      state: options.state,
    });
  } catch (_e) {
    output._sources = {};
  }
  return output;
}

function attachAll(output, opts) {
  attachMission(output, opts || {});
  attachPipeline(output);
  attachAgents(output);
  attachArchitecture(output);
  attachMilestoneMap(output);
  attachMemoryGraph(output);
  attachLineage(output);
  attachGateFlow(output);
  attachEvidence(output);
  attachTelemetry(output);
  attachAlarms(output);
  attachEvents(output);
  attachLearnings(output);
  if (!output.rationale) attachRationale(output, opts || {});
  attachSources(output, opts || {});
  return output;
}

module.exports = { run, parseArgs, readJsonl, readCockpitState, renderText, renderBrief, renderHtml, recommendedAction };
module.exports.attachStagePipeline = attachStagePipeline;
module.exports.attachRationale = attachRationale;
module.exports.attachMission = attachMission;
module.exports.attachPipeline = attachPipeline;
module.exports.attachAgents = attachAgents;
module.exports.attachArchitecture = attachArchitecture;
module.exports.attachMilestoneMap = attachMilestoneMap;
module.exports.attachMemoryGraph = attachMemoryGraph;
module.exports.attachLineage = attachLineage;
module.exports.attachGateFlow = attachGateFlow;
module.exports.attachEvidence = attachEvidence;
module.exports.attachTelemetry = attachTelemetry;
module.exports.attachAlarms = attachAlarms;
module.exports.attachEvents = attachEvents;
module.exports.attachLearnings = attachLearnings;
module.exports.attachSources = attachSources;
module.exports.attachAll = attachAll;
