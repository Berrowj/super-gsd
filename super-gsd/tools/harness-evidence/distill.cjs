// SGSD Trajectory Evidence Distiller -- Phase 99 (v2.9 AHE).
// Reads JSONL log surfaces + benchmark RUN.json/REPORT.md and writes a
// layered evidence corpus under .planning/harness-evolution/runs/<run_id>/
// (OVERVIEW.md, INDEX.json, tasks/*.md).
//
// Lock-13: never throws. Malformed JSONL lines become error rows; valid
// lines continue parsing. Public API returns {ok, run_id, overview_path,
// index_path, task_paths[], errors[]}.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_CAUSES = Object.freeze([
  'state_projection_drift',
  'missing_context_packet',
  'provider_unavailable',
  'gate_false_negative',
  'gate_false_positive',
  'token_budget_breach',
  'duplicate_verification',
  'incomplete_artifact',
  'hidden_fault_uncaught',
  'successful_recovery_pattern',
  'unknown'
]);

const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');

const JSONL_SOURCES = Object.freeze([
  'activity-log.jsonl',
  'orchestrator-pulse.jsonl',
  'context-packet-log.jsonl',
  'route-decisions.jsonl',
  'token-attribution.jsonl',
  'failure-injection-log.jsonl',
  'controlled-actions-log.jsonl'
]);

function readJsonlSafe(absPath, errors) {
  if (!fs.existsSync(absPath)) return [];
  const out = [];
  let src;
  try { src = fs.readFileSync(absPath, 'utf8'); }
  catch (e) {
    errors.push({ source: absPath, msg: 'read_failed: ' + (e && e.message || e) });
    return [];
  }
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln || /^\s*$/.test(ln)) continue;
    try { out.push(JSON.parse(ln)); }
    catch (e) {
      errors.push({
        source: absPath,
        line: i + 1,
        msg: 'json_parse_failed'
      });
    }
  }
  return out;
}

function readBenchmark(benchmarkDir, errors) {
  if (!benchmarkDir) return null;
  const runJson = path.join(benchmarkDir, 'RUN.json');
  const reportMd = path.join(benchmarkDir, 'REPORT.md');
  const out = { run_json: null, report_md_size: 0, report_md_path: null };
  if (fs.existsSync(runJson)) {
    try { out.run_json = JSON.parse(fs.readFileSync(runJson, 'utf8')); }
    catch (e) {
      errors.push({ source: runJson, msg: 'json_parse_failed' });
    }
  }
  if (fs.existsSync(reportMd)) {
    try {
      const stat = fs.statSync(reportMd);
      out.report_md_size = stat.size;
      out.report_md_path = reportMd;
    } catch (e) { /* ignore */ }
  }
  return out;
}

// Rule-based deterministic classifier.
function classifyEvent(ev) {
  if (!ev || typeof ev !== 'object') return 'unknown';
  const labels = [];
  const status = ev.status || (ev.decision && ev.decision.chosen_provider) || '';
  const codes = (ev.reason_codes && Array.isArray(ev.reason_codes))
    ? ev.reason_codes.join(',')
    : '';
  const text = JSON.stringify(ev).toLowerCase();

  if (text.indexOf('state_md_drift') !== -1 || text.indexOf('projection_stale') !== -1) {
    labels.push('state_projection_drift');
  }
  if (text.indexOf('context_packet') !== -1 && text.indexOf('absent') !== -1) {
    labels.push('missing_context_packet');
  }
  if (text.indexOf('provider_unhealthy') !== -1 || text.indexOf('provider_unavailable') !== -1) {
    labels.push('provider_unavailable');
  }
  if (codes.indexOf('false_negative') !== -1) labels.push('gate_false_negative');
  if (codes.indexOf('false_positive') !== -1) labels.push('gate_false_positive');
  if (text.indexOf('token_budget') !== -1 && text.indexOf('breach') !== -1) {
    labels.push('token_budget_breach');
  }
  if (text.indexOf('duplicate_verification') !== -1) {
    labels.push('duplicate_verification');
  }
  if (text.indexOf('incomplete_artifact') !== -1 || text.indexOf('artifact_missing') !== -1) {
    labels.push('incomplete_artifact');
  }
  if (text.indexOf('hidden_fault') !== -1) labels.push('hidden_fault_uncaught');
  if (text.indexOf('recovered') !== -1 || text.indexOf('successful_recovery') !== -1) {
    labels.push('successful_recovery_pattern');
  }
  if (labels.length === 0) labels.push('unknown');
  return labels;
}

function groupByPhasePlan(events) {
  const groups = {};
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const phase = ev.phase || (ev.decision && ev.decision.phase) || 'no-phase';
    const plan = ev.plan || (ev.decision && ev.decision.plan) || 'no-plan';
    const key = String(phase) + ':' + String(plan);
    if (!groups[key]) groups[key] = { phase: phase, plan: plan, events: [], labels: new Set() };
    groups[key].events.push(ev);
    const labels = classifyEvent(ev);
    for (const lab of labels) groups[key].labels.add(lab);
  }
  return groups;
}

function buildOverview(opts) {
  const lines = [];
  lines.push('# SGSD Run Evidence Overview');
  lines.push('');
  lines.push('run_id: ' + opts.run_id);
  lines.push('window_since: ' + (opts.since || 'auto'));
  lines.push('window_until: ' + (opts.until || 'auto'));
  lines.push('events_total: ' + opts.events_total);
  lines.push('errors_total: ' + opts.errors_total);
  lines.push('');
  lines.push('## Source totals');
  for (const k of Object.keys(opts.source_totals)) {
    lines.push('- ' + k + ': ' + opts.source_totals[k]);
  }
  lines.push('');
  lines.push('## Phase/plan groups');
  const keys = Object.keys(opts.groups).slice(0, 20);
  for (const k of keys) {
    const g = opts.groups[k];
    lines.push('- ' + k + ' (events=' + g.events.length + ', labels=' +
      Array.from(g.labels).join(',') + ') -> tasks/' +
      String(k).replace(/[:\\/]/g, '_') + '.md');
  }
  if (Object.keys(opts.groups).length > 20) {
    lines.push('- ... (' + (Object.keys(opts.groups).length - 20) + ' more, see INDEX.json)');
  }
  lines.push('');
  if (opts.benchmark) {
    lines.push('## Benchmark');
    if (opts.benchmark.run_json && opts.benchmark.run_json.profile) {
      lines.push('- profile: ' + opts.benchmark.run_json.profile);
    }
    if (opts.benchmark.report_md_path) {
      lines.push('- report -> ' + opts.benchmark.report_md_path);
    }
    lines.push('');
  }
  lines.push('## Errors');
  if (opts.errors_total === 0) lines.push('- none');
  else lines.push('- ' + opts.errors_total + ' rows in INDEX.json[\\"errors\\"]');
  lines.push('');
  lines.push('## How to drill down');
  lines.push('- Open tasks/<phase>_<plan>.md for per-group narrative.');
  lines.push('- Source JSONL paths are in INDEX.json["sources"].');
  lines.push('- Raw events are NOT copied here. Grep the source files for ts/run_id.');
  return lines.join('\n');
}

function buildTaskReport(key, group, opts) {
  const lines = [];
  lines.push('# Task report: ' + key);
  lines.push('');
  lines.push('phase: ' + group.phase);
  lines.push('plan: ' + group.plan);
  lines.push('events: ' + group.events.length);
  lines.push('labels: ' + Array.from(group.labels).join(', '));
  lines.push('');
  lines.push('## Sample events (first 5)');
  const samples = group.events.slice(0, 5);
  for (const ev of samples) {
    const ts = ev.ts || ev.timestamp || '';
    const summary = (ev.tool || ev.command || ev.boundary || ev.kind || ev.event || 'event');
    lines.push('- ' + ts + ' [' + summary + ']');
  }
  if (group.events.length > 5) {
    lines.push('- ... (' + (group.events.length - 5) + ' more events; see source JSONL)');
  }
  lines.push('');
  lines.push('## Drill-down');
  lines.push('Source JSONL paths (grep by phase=' + group.phase + ', plan=' + group.plan + '):');
  for (const s of opts.source_paths) lines.push('- ' + s);
  return lines.join('\n');
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch (e) { return false; }
}

// PUBLIC API -- Lock-13: never throws.
function distillRun(opts) {
  opts = opts || {};
  try {
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const run_id = opts.run_id || ('run-' + new Date().toISOString().replace(/[:.]/g, '-'));
    const outDir = opts.outDir || path.join(
      projectDir, '.planning', 'harness-evolution', 'runs', run_id
    );
    const errors = [];

    // Read sources
    const events = [];
    const sourceTotals = {};
    const sourcePaths = [];
    for (const src of JSONL_SOURCES) {
      const abs = path.join(projectDir, '.planning', 'metrics', src);
      sourcePaths.push(abs);
      const rows = readJsonlSafe(abs, errors);
      sourceTotals[src] = rows.length;
      for (const ev of rows) events.push(ev);
    }

    // Optional time-window filter
    let filtered = events;
    if (opts.since || opts.until) {
      const sinceMs = opts.since ? Date.parse(opts.since) : -Infinity;
      const untilMs = opts.until ? Date.parse(opts.until) : Infinity;
      filtered = events.filter(function (ev) {
        const tsRaw = ev.ts || ev.timestamp;
        if (!tsRaw) return true;
        const t = Date.parse(tsRaw);
        if (isNaN(t)) return true;
        return t >= sinceMs && t <= untilMs;
      });
    }

    // Optional benchmark
    let benchmark = null;
    if (opts.benchmarkDir) {
      benchmark = readBenchmark(opts.benchmarkDir, errors);
    }

    // Group + classify
    const groups = groupByPhasePlan(filtered);

    // Write outputs
    if (!ensureDir(outDir) || !ensureDir(path.join(outDir, 'tasks'))) {
      return { ok: false, run_id: run_id, overview_path: null, index_path: null,
        task_paths: [], errors: errors.concat([{ msg: 'mkdir_failed: ' + outDir }]) };
    }

    const taskPaths = [];
    for (const k of Object.keys(groups)) {
      const safeName = String(k).replace(/[:\\/]/g, '_') + '.md';
      const fp = path.join(outDir, 'tasks', safeName);
      const md = buildTaskReport(k, groups[k], { source_paths: sourcePaths });
      try {
        fs.writeFileSync(fp, md, 'utf8');
        taskPaths.push(fp);
      } catch (e) {
        errors.push({ source: fp, msg: 'task_write_failed' });
      }
    }

    const overview = buildOverview({
      run_id: run_id,
      since: opts.since,
      until: opts.until,
      events_total: filtered.length,
      errors_total: errors.length,
      source_totals: sourceTotals,
      groups: groups,
      benchmark: benchmark
    });
    const overviewPath = path.join(outDir, 'OVERVIEW.md');
    try { fs.writeFileSync(overviewPath, overview, 'utf8'); }
    catch (e) {
      errors.push({ source: overviewPath, msg: 'overview_write_failed' });
    }

    const indexPath = path.join(outDir, 'INDEX.json');
    const index = {
      schema_version: 1,
      run_id: run_id,
      generated: new Date().toISOString(),
      events_total: filtered.length,
      sources: sourcePaths,
      source_totals: sourceTotals,
      group_keys: Object.keys(groups),
      task_paths: taskPaths,
      benchmark: benchmark,
      errors: errors,
      root_cause_vocab: ROOT_CAUSES.slice()
    };
    try { fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8'); }
    catch (e) {
      errors.push({ source: indexPath, msg: 'index_write_failed' });
    }

    // Overview must stay under 4KB by default.
    const overviewSize = Buffer.byteLength(overview, 'utf8');

    return {
      ok: filtered.length > 0 || !!(benchmark && benchmark.run_json),
      run_id: run_id,
      overview_path: overviewPath,
      overview_size_bytes: overviewSize,
      index_path: indexPath,
      task_paths: taskPaths,
      errors: errors
    };
  } catch (e) {
    return { ok: false, run_id: null, overview_path: null, index_path: null,
      task_paths: [], errors: [{ msg: 'distill_failed: ' + (e && e.message || e) }] };
  }
}

module.exports = {
  distillRun: distillRun,
  classifyEvent: classifyEvent,
  groupByPhasePlan: groupByPhasePlan,
  ROOT_CAUSES: ROOT_CAUSES,
  JSONL_SOURCES: JSONL_SOURCES,
  DEFAULT_PROJECT: DEFAULT_PROJECT
};

// CLI entry
if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run-id') { opts.run_id = argv[++i]; }
    else if (a === '--since') { opts.since = argv[++i]; }
    else if (a === '--until') { opts.until = argv[++i]; }
    else if (a === '--benchmark') { opts.benchmarkDir = argv[++i]; }
    else if (a === '--out') { opts.outDir = argv[++i]; }
    else if (a === '--project') { opts.projectDir = argv[++i]; }
    else if (a === '--json') { opts._json = true; }
  }
  const r = distillRun(opts);
  if (opts._json) console.log(JSON.stringify(r, null, 2));
  else {
    console.log('run_id: ' + r.run_id);
    console.log('ok: ' + r.ok);
    console.log('overview: ' + r.overview_path + ' (' + (r.overview_size_bytes || 0) + ' bytes)');
    console.log('index: ' + r.index_path);
    console.log('tasks: ' + r.task_paths.length);
    console.log('errors: ' + r.errors.length);
  }
  process.exit(r.ok ? 0 : 1);
}
