#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHRONICLE_DIR = __dirname;
const REPO_ROOT = path.resolve(CHRONICLE_DIR, '..', '..', '..');
const DEFAULTS = {
  planningRoot: '.planning',
  chronicleIndex: path.join('.planning', 'chronicles', 'INDEX.jsonl'),
  validatorLog: path.join('.planning', 'metrics', 'chronicle-validation-log.jsonl'),
  executorLog: path.join('.planning', 'metrics', 'codex-executor-log.jsonl'),
  tokenAttribution: path.join('.planning', 'metrics', 'token-attribution.jsonl')
};
const VERDICT_KEYS = [
  'REPORT_GROUNDED',
  'REPORT_UNGROUNDED',
  'REPORT_BROKEN',
  'REPORT_CONTAMINATED',
  'missing'
];

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tools/chronicle/mine-roadmap.cjs [--planning-root .planning]',
    '    [--chronicle-index .planning/chronicles/INDEX.jsonl]',
    '    [--validator-log .planning/metrics/chronicle-validation-log.jsonl]',
    '    [--executor-log .planning/metrics/codex-executor-log.jsonl]',
    '    [--token-attribution .planning/metrics/token-attribution.jsonl]',
    '    --out <path>'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--planning-root') {
      args.planningRoot = argv[++i];
    } else if (token === '--chronicle-index') {
      args.chronicleIndex = argv[++i];
    } else if (token === '--validator-log') {
      args.validatorLog = argv[++i];
    } else if (token === '--executor-log') {
      args.executorLog = argv[++i];
    } else if (token === '--token-attribution') {
      args.tokenAttribution = argv[++i];
    } else if (token === '--out') {
      args.out = argv[++i];
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      args.unknown = token;
    }
  }
  return args;
}

function readTextIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function readJsonl(file) {
  const text = readTextIfExists(file);
  if (!text.trim()) {
    return [];
  }
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    try {
      rows.push(JSON.parse(line));
    } catch (_) {
      rows.push({ _parse_error: true, _line: index + 1, raw: line });
    }
  }
  return rows;
}

function listDirectories(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function listMilestones(planningRoot) {
  const root = path.join(planningRoot, 'milestones');
  return listDirectories(root)
    .filter((name) => fs.existsSync(path.join(root, name, 'SUMMARY.md')))
    .map((name) => ({
      milestone_id: name,
      root: path.join(root, name),
      summary_path: path.join(root, name, 'SUMMARY.md')
    }));
}

function phaseIdFromName(name) {
  const match = String(name).match(/P?(\d+)/i);
  return match ? `P${match[1]}` : name;
}

function phaseDirs(milestoneRoot) {
  const root = path.join(milestoneRoot, 'phases');
  return listDirectories(root).map((name) => ({
    name,
    phase_id: phaseIdFromName(name),
    root: path.join(root, name)
  }));
}

function verificationPasses(phaseRoot) {
  const text = readTextIfExists(path.join(phaseRoot, 'VERIFICATION.md'));
  return /\bPASS\b/i.test(text);
}

function getField(record, names) {
  for (const name of names) {
    if (record && Object.prototype.hasOwnProperty.call(record, name)) {
      return record[name];
    }
  }
  return undefined;
}

function nestedMilestone(record) {
  return getField(record, ['milestone', 'milestone_id', 'milestoneId'])
    || (record && record.source && getField(record.source, ['milestone', 'milestone_id', 'milestoneId']))
    || (record && record.context && getField(record.context, ['milestone', 'milestone_id', 'milestoneId']));
}

function nestedPhase(record) {
  return getField(record, ['phase', 'phase_id', 'phaseId'])
    || (record && record.source && getField(record.source, ['phase', 'phase_id', 'phase_id', 'phaseId']))
    || (record && record.context && getField(record.context, ['phase', 'phase_id', 'phaseId']));
}

function belongsToMilestone(record, milestoneId) {
  const value = nestedMilestone(record);
  if (value) {
    return String(value) === milestoneId;
  }
  const text = JSON.stringify(record);
  return text.includes(`"milestone_id":"${milestoneId}"`)
    || text.includes(`"milestone":"${milestoneId}"`)
    || text.includes(`/${milestoneId}/`)
    || text.includes(`\\${milestoneId}\\`);
}

function normalizeVerdict(value) {
  const text = String(value || '').toUpperCase();
  if (text === 'REPORT_GROUNDED' || text === 'GROUNDED' || text === 'PASS') {
    return 'REPORT_GROUNDED';
  }
  if (text.includes('CONTAMINATED')) {
    return 'REPORT_CONTAMINATED';
  }
  if (text.includes('BROKEN') || text.includes('FAIL')) {
    return 'REPORT_BROKEN';
  }
  if (text.includes('UNGROUNDED')) {
    return 'REPORT_UNGROUNDED';
  }
  return null;
}

function chronicleVerdicts({ milestoneId, phases, chronicleRows, validatorRows }) {
  const byPhase = new Map();
  for (const record of [...chronicleRows, ...validatorRows]) {
    if (!belongsToMilestone(record, milestoneId)) {
      continue;
    }
    const phase = phaseIdFromName(nestedPhase(record) || getField(record, ['phase_dir', 'phaseDirectory']) || '');
    const verdict = normalizeVerdict(getField(record, [
      'verdict',
      'report_verdict',
      'status',
      'validation_verdict',
      'grounding_verdict'
    ]));
    if (phase && verdict) {
      byPhase.set(phase, verdict);
    }
  }

  const counts = VERDICT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  for (const phase of phases) {
    const verdict = byPhase.get(phase.phase_id);
    counts[verdict || 'missing'] += 1;
  }
  return counts;
}

function numericValue(record, names) {
  for (const name of names) {
    const value = getField(record, [name]);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function dispatchCount(records, milestoneId) {
  return records
    .filter((record) => belongsToMilestone(record, milestoneId))
    .reduce((sum, record) => {
      const explicit = numericValue(record, [
        'dispatch_count',
        'dispatches',
        'agents_dispatched',
        'subagent_count'
      ]);
      return sum + (explicit === null ? 1 : explicit);
    }, 0);
}

function tokenSpend(records, milestoneId) {
  return records
    .filter((record) => belongsToMilestone(record, milestoneId))
    .reduce((sum, record) => {
      const value = numericValue(record, [
        'total_tokens',
        'tokens_total',
        'token_spend',
        'tokens'
      ]);
      if (value !== null) {
        return sum + value;
      }
      const input = numericValue(record, ['input_tokens', 'prompt_tokens', 'input']);
      const output = numericValue(record, ['output_tokens', 'completion_tokens', 'output']);
      return sum + (input || 0) + (output || 0);
    }, 0);
}

function patchRoundDistribution({ records, milestoneId, phases }) {
  const byPhase = new Map(phases.map((phase) => [phase.phase_id, 0]));
  for (const record of records.filter((row) => belongsToMilestone(row, milestoneId))) {
    const phase = phaseIdFromName(nestedPhase(record) || '');
    if (!byPhase.has(phase)) {
      continue;
    }
    const explicit = numericValue(record, [
      'patch_rounds',
      'patch_round',
      'round',
      'patches'
    ]);
    const text = JSON.stringify(record).toLowerCase();
    if (explicit === null) {
      byPhase.set(phase, (byPhase.get(phase) || 0) + (text.includes('patch') ? 1 : 0));
    } else {
      byPhase.set(phase, Math.max(byPhase.get(phase) || 0, explicit));
    }
  }

  const distribution = { zero: 0, one: 0, two_plus: 0 };
  for (const rounds of byPhase.values()) {
    if (rounds <= 0) {
      distribution.zero += 1;
    } else if (rounds === 1) {
      distribution.one += 1;
    } else {
      distribution.two_plus += 1;
    }
  }
  return { distribution, byPhase };
}

function findFogScoreTool() {
  const candidates = [
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'cockpit-sidecar', 'fog-score.cjs'),
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'cockpit', 'fog-score.cjs'),
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'fog-score.cjs')
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function parseFogScore(stdout) {
  const text = String(stdout || '').trim();
  if (!text) {
    return null;
  }
  try {
    const json = JSON.parse(text);
    const value = numericValue(json, ['fog_score', 'fogScore', 'score']);
    if (value !== null) {
      return value;
    }
  } catch (_) {
    // Fall through to numeric text extraction.
  }
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function fogScoreAverage(phases, warnings) {
  const tool = findFogScoreTool();
  if (!tool) {
    warnings.push('fog-score.cjs unavailable; fog_score_avg set to null');
    return null;
  }

  const scores = [];
  for (const phase of phases) {
    const run = spawnSync(process.execPath, [tool, '--phase-root', phase.root, '--json'], {
      encoding: 'utf8',
      windowsHide: true
    });
    if (run.status !== 0) {
      continue;
    }
    const score = parseFogScore(run.stdout);
    if (typeof score === 'number' && Number.isFinite(score)) {
      scores.push(score);
    }
  }

  if (!scores.length) {
    warnings.push('fog-score.cjs produced no parseable scores; fog_score_avg set to null');
    return null;
  }
  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(4));
}

function recurringDriftClasses({ records, phases, patchRoundsByPhase }) {
  const classes = new Map();
  function add(name, phaseId) {
    if (!classes.has(name)) {
      classes.set(name, new Set());
    }
    classes.get(name).add(phaseId || 'milestone');
  }

  for (const record of records) {
    const text = JSON.stringify(record).toLowerCase();
    const phase = phaseIdFromName(nestedPhase(record) || '');
    if (text.includes('schema')) {
      add('schema-fix-required', phase);
    }
    if (text.includes('fixture') || text.includes('golden')) {
      add('fixture-regeneration-required', phase);
    }
  }

  for (const phase of phases) {
    if ((patchRoundsByPhase.get(phase.phase_id) || 0) >= 2) {
      add('two-plus-patch-rounds', phase.phase_id);
    }
  }

  return [...classes.entries()]
    .map(([name, phaseSet]) => ({
      class: name,
      count: phaseSet.size,
      phases: [...phaseSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }))
    .sort((a, b) => a.class.localeCompare(b.class));
}

function crossMilestonePatterns(milestones) {
  const occurrences = new Map();
  for (const milestone of milestones) {
    for (const drift of milestone.recurring_drift_classes || []) {
      if (!occurrences.has(drift.class)) {
        occurrences.set(drift.class, new Set());
      }
      occurrences.get(drift.class).add(milestone.milestone_id);
    }
  }
  return [...occurrences.entries()]
    .filter(([, milestoneSet]) => milestoneSet.size >= 2)
    .map(([name, milestoneSet]) => ({
      class: name,
      occurrences: milestoneSet.size,
      milestones: [...milestoneSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }))
    .sort((a, b) => a.class.localeCompare(b.class));
}

function writeAtomic(file, payload) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, file);
}

function buildRoadmapMine(args) {
  const planningRoot = path.resolve(args.planningRoot);
  const chronicleRows = readJsonl(path.resolve(args.chronicleIndex));
  const validatorRows = readJsonl(path.resolve(args.validatorLog));
  const executorRows = readJsonl(path.resolve(args.executorLog));
  const tokenRows = readJsonl(path.resolve(args.tokenAttribution));
  const warnings = [];
  const milestones = listMilestones(planningRoot).map((milestone) => {
    const phases = phaseDirs(milestone.root);
    const milestoneWarnings = [];
    const patch = patchRoundDistribution({
      records: executorRows,
      milestoneId: milestone.milestone_id,
      phases
    });
    const driftRecords = executorRows
      .concat(validatorRows)
      .filter((record) => belongsToMilestone(record, milestone.milestone_id));

    return {
      milestone_id: milestone.milestone_id,
      summary_path: path.relative(process.cwd(), milestone.summary_path),
      phases_total: phases.length,
      phases_passed: phases.filter((phase) => verificationPasses(phase.root)).length,
      chronicle_verdicts: chronicleVerdicts({
        milestoneId: milestone.milestone_id,
        phases,
        chronicleRows,
        validatorRows
      }),
      dispatch_count_total: dispatchCount(executorRows, milestone.milestone_id),
      token_spend_total: tokenSpend(tokenRows, milestone.milestone_id),
      patch_round_distribution: patch.distribution,
      fog_score_avg: fogScoreAverage(phases, milestoneWarnings),
      recurring_drift_classes: recurringDriftClasses({
        records: driftRecords,
        phases,
        patchRoundsByPhase: patch.byPhase
      }),
      warnings: milestoneWarnings
    };
  });

  return {
    schema_version: '1.0',
    generated_at: '1970-01-01T00:00:00.000Z',
    source: {
      planning_root: args.planningRoot,
      chronicle_index: args.chronicleIndex,
      validator_log: args.validatorLog,
      executor_log: args.executorLog,
      token_attribution: args.tokenAttribution
    },
    milestones,
    cross_milestone_patterns: crossMilestonePatterns(milestones),
    warnings
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.unknown || !args.out) {
    console.error(usage());
    return 3;
  }

  const output = buildRoadmapMine(args);
  if (!output.milestones.length) {
    console.error('No closed milestones found');
    return 1;
  }

  try {
    writeAtomic(path.resolve(args.out), `${JSON.stringify(output, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildRoadmapMine,
  chronicleVerdicts,
  crossMilestonePatterns,
  main,
  patchRoundDistribution,
  recurringDriftClasses
};
