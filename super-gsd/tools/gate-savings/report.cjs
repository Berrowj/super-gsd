#!/usr/bin/env node
// ============================================================================
// SGSD - Gate Savings Report
// ============================================================================
// Aggregates value/waste caught by SGSD gates from existing evidence streams.
//
// Important: "saved" is split into facts and estimates.
// - Facts: findings caught, warnings, criticals, reviews, MUDA fail/warn rows,
//   provider timeouts, token-waste degraded rows.
// - Estimates: waste_points and token estimates. These are transparent,
//   deterministic scoring units, not claimed real money or exact tokens saved.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const WEIGHTS = Object.freeze({
  atc_critical: 8,
  atc_warning: 2,
  muda_fail: 5,
  muda_warn: 1,
  token_degraded: 5,
  token_warn: 2,
  gate_block: 4,
  gate_warn: 1,
});

const MUDA_CLASS_KEYS = Object.freeze(['T', 'I', 'M', 'W', 'OP', 'EP', 'D']);

function repoRootFromCwd() {
  return process.cwd();
}

function planningDir(root) {
  return path.join(root, '.planning');
}

function readJsonl(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function parseLeadingPhase(value) {
  const s = String(value == null ? '' : value);
  const m = s.match(/^([0-9]+)/);
  return m ? m[1] : s;
}

function keyFor(milestone, phase) {
  return `${milestone || 'unknown'}::${phase || 'unknown'}`;
}

function emptyCounters() {
  return {
    atc: {
      reviews: 0,
      critical: 0,
      warning: 0,
      caught: 0,
      fixed_or_closed_reviews: 0,
      codex_reviews: 0,
      claude_reviews: 0,
      codex_timeouts: 0,
      codex_provider_unavailable: 0,
      claude_tokens_avoided_est: 0,
      codex_timeout_tokens_wasted_est: 0,
      waste_points: 0,
    },
    muda: {
      audits: 0,
      warn: 0,
      fail: 0,
      caught: 0,
      by_class: Object.fromEntries(MUDA_CLASS_KEYS.map((k) => [k, 0])),
      waste_points: 0,
    },
    token_waste: {
      checks: 0,
      ok: 0,
      warn: 0,
      degraded: 0,
      false_positive: 0,
      rules_tripped: {},
      route_hints: {},
      waste_points: 0,
    },
    gate_value: {
      rows: 0,
      pass: 0,
      warn: 0,
      block: 0,
      skip: 0,
      by_gate: {},
      waste_points: 0,
    },
    totals: {
      caught: 0,
      waste_points: 0,
      claude_tokens_avoided_est: 0,
      codex_timeout_tokens_wasted_est: 0,
    },
  };
}

function addTo(dst, src) {
  for (const group of ['atc', 'muda', 'token_waste', 'gate_value']) {
    for (const [k, v] of Object.entries(src[group])) {
      if (typeof v === 'number') dst[group][k] = (dst[group][k] || 0) + v;
      else if (v && typeof v === 'object') {
        dst[group][k] = dst[group][k] || {};
        for (const [kk, vv] of Object.entries(v)) dst[group][k][kk] = (dst[group][k][kk] || 0) + vv;
      }
    }
  }
  refreshTotals(dst);
}

function refreshTotals(row) {
  row.totals.caught =
    row.atc.caught + row.muda.caught + row.token_waste.warn + row.token_waste.degraded + row.gate_value.warn + row.gate_value.block;
  row.totals.waste_points =
    row.atc.waste_points + row.muda.waste_points + row.token_waste.waste_points + row.gate_value.waste_points;
  row.totals.claude_tokens_avoided_est = row.atc.claude_tokens_avoided_est;
  row.totals.codex_timeout_tokens_wasted_est = row.atc.codex_timeout_tokens_wasted_est;
}

function ensureBucket(map, milestone, phase) {
  const k = keyFor(milestone, phase);
  if (!map[k]) {
    map[k] = {
      milestone: milestone || 'unknown',
      phase: phase || 'unknown',
      ...emptyCounters(),
    };
  }
  return map[k];
}

function classifyProvider(provider) {
  const p = String(provider || '').toLowerCase();
  if (p.includes('codex') || p.includes('openai')) return 'codex';
  if (p.includes('claude') || p.includes('sonnet') || p.includes('haiku') || p.includes('opus')) return 'claude';
  return 'other';
}

function estimateTokensFromBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 4);
}

function normalizeReviewRow(row) {
  const legacy = row && row._legacy ? row._legacy : row;
  const milestone = legacy.milestone || row.milestone || row._source_milestone || 'unknown';
  const phase = parseLeadingPhase(legacy.phase || row.phase || row._source_phase || 'unknown');
  return {
    milestone,
    phase,
    provider: legacy.provider || row.provider || '',
    tier: legacy.tier || row.tier || '',
    verdict: legacy.verdict || row.verdict || row.status || '',
    critical: Number(legacy.critical != null ? legacy.critical : row.critical) || 0,
    warning: Number(legacy.warning != null ? legacy.warning : row.warning) || 0,
    one_liner: legacy.one_liner || row.one_liner || '',
    findings: legacy.findings || row.findings || '',
  };
}

function applyAtcRow(bucket, r) {
  const providerKind = classifyProvider(r.provider);
  const critical = Math.max(0, Number(r.critical) || 0);
  const warning = Math.max(0, Number(r.warning) || 0);
  const text = `${r.verdict} ${r.one_liner} ${r.findings}`;

  bucket.atc.reviews++;
  bucket.atc.critical += critical;
  bucket.atc.warning += warning;
  bucket.atc.caught += critical + warning;
  bucket.atc.waste_points += critical * WEIGHTS.atc_critical + warning * WEIGHTS.atc_warning;
  if (providerKind === 'codex') bucket.atc.codex_reviews++;
  if (providerKind === 'claude') bucket.atc.claude_reviews++;
  if (/fixed|resolved|closed|cleanup|post-fix|addressed/i.test(text)) bucket.atc.fixed_or_closed_reviews++;
  if (/provider_unavailable|tier cap|timeout|timed out|exit=5/i.test(text)) {
    bucket.atc.codex_provider_unavailable++;
  }
  refreshTotals(bucket);
}

function parseProviderTableFromReview(file) {
  const out = [];
  let raw = '';
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return out; }
  const parts = file.split(/[\\/]+/);
  const milestoneIdx = parts.lastIndexOf('milestones') + 1;
  const phaseIdx = parts.lastIndexOf('phases') + 1;
  const milestone = milestoneIdx > 0 ? parts[milestoneIdx] : 'unknown';
  const phase = phaseIdx > 0 ? parseLeadingPhase(parts[phaseIdx]) : 'unknown';
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const provider = m[1].trim();
    if (/^-+$|^Provider$/i.test(provider)) continue;
    if (!/Claude|Codex|OpenAI|sgsd-code-reviewer|sgsd-codex-reviewer/i.test(provider)) continue;
    const status = m[2].trim();
    const verdict = m[3].trim();
    const findings = m[4].trim();
    let critical = 0;
    let warning = 0;
    for (const fm of findings.matchAll(/\b([0-9]+)\s*(CRITICAL|CRIT|HIGH|MEDIUM|MED|LOW|WARNING|WARN)\b/gi)) {
      const n = Number(fm[1]) || 0;
      const sev = fm[2].toLowerCase();
      if (sev.startsWith('crit') || sev === 'high') critical += n;
      else warning += n;
    }
    out.push({ milestone, phase, provider, verdict: `${status} ${verdict}`, critical, warning, one_liner: findings, findings });
  }
  return out;
}

function walkFiles(dir, predicate, out = []) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const item of items) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walkFiles(p, predicate, out);
    else if (predicate(p)) out.push(p);
  }
  return out;
}

function collectAtc(root, phaseBuckets) {
  const planning = planningDir(root);
  const ledger = readJsonl(path.join(planning, 'metrics', 'review-ledger.jsonl'));
  const seenPhaseProvider = new Set();

  for (const row of ledger) {
    const r = normalizeReviewRow(row);
    const bucket = ensureBucket(phaseBuckets, r.milestone, r.phase);
    applyAtcRow(bucket, r);
    seenPhaseProvider.add(`${r.milestone}::${r.phase}::${classifyProvider(r.provider)}`);
  }

  const reviewFiles = walkFiles(path.join(planning, 'milestones'), (p) =>
    /(?:reviews[\\/][0-9]+-REVIEW\.md|[0-9]+-ATC-REVIEW\.md)$/i.test(p)
  );
  for (const file of reviewFiles) {
    for (const r of parseProviderTableFromReview(file)) {
      const dedupeKey = `${r.milestone}::${r.phase}::${classifyProvider(r.provider)}`;
      if (seenPhaseProvider.has(dedupeKey)) continue;
      const bucket = ensureBucket(phaseBuckets, r.milestone, r.phase);
      applyAtcRow(bucket, r);
      seenPhaseProvider.add(dedupeKey);
    }
  }

  const codexRows = readJsonl(path.join(planning, 'metrics', 'codex-log.jsonl'));
  for (const row of codexRows) {
    const step = String(row.step || '');
    if (!/ATC/i.test(step)) continue;
    const milestone = row.milestone || inferMilestoneForPhase(planning, row.phase);
    const phase = parseLeadingPhase(row.phase || 'unknown');
    const bucket = ensureBucket(phaseBuckets, milestone, phase);
    const est = estimateTokensFromBytes(Number(row.prompt_bytes || 0) + Number(row.report_bytes || 0));
    if (Number(row.exit) === 0) bucket.atc.claude_tokens_avoided_est += est;
    if (Number(row.exit) === 5 || row.timeout_hit) {
      bucket.atc.codex_timeouts++;
      bucket.atc.codex_timeout_tokens_wasted_est += est;
    }
    refreshTotals(bucket);
  }
}

function inferMilestoneForPhase(planning, phase) {
  const wanted = parseLeadingPhase(phase);
  const root = path.join(planning, 'milestones');
  let milestones = [];
  try { milestones = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return 'unknown'; }
  for (const ms of milestones) {
    const phaseRoot = path.join(root, ms, 'phases');
    let dirs = [];
    try { dirs = fs.readdirSync(phaseRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { continue; }
    if (dirs.some((d) => parseLeadingPhase(d) === wanted)) return ms;
  }
  return 'unknown';
}

function mudaKeyFromClass(cls) {
  const s = String(cls || '').toLowerCase();
  if (s === 'transport') return 'T';
  if (s === 'inventory') return 'I';
  if (s === 'motion') return 'M';
  if (s === 'waiting') return 'W';
  if (s === 'overproduction') return 'OP';
  if (s === 'extra-processing' || s === 'overprocessing') return 'EP';
  if (s === 'defect' || s === 'defects') return 'D';
  return 'D';
}

function addMudaFinding(bucket, wasteClass, verdict) {
  const v = String(verdict || '').toUpperCase();
  if (v !== 'WARN' && v !== 'FAIL') return;
  const k = mudaKeyFromClass(wasteClass);
  bucket.muda.caught++;
  bucket.muda.by_class[k] = (bucket.muda.by_class[k] || 0) + 1;
  if (v === 'WARN') {
    bucket.muda.warn++;
    bucket.muda.waste_points += WEIGHTS.muda_warn;
  } else {
    bucket.muda.fail++;
    bucket.muda.waste_points += WEIGHTS.muda_fail;
  }
  refreshTotals(bucket);
}

function collectMuda(root, phaseBuckets) {
  const planning = planningDir(root);
  const seen = new Set();
  const wasteFiles = walkFiles(path.join(planning, 'milestones'), (p) => /WASTE.*\.md$/i.test(p));
  for (const file of wasteFiles) {
    const parts = file.split(/[\\/]+/);
    const milestoneIdx = parts.lastIndexOf('milestones') + 1;
    const phaseIdx = parts.lastIndexOf('phases') + 1;
    const milestone = milestoneIdx > 0 ? parts[milestoneIdx] : 'unknown';
    const phase = phaseIdx > 0 ? parseLeadingPhase(parts[phaseIdx]) : 'unknown';
    const bucket = ensureBucket(phaseBuckets, milestone, phase);
    bucket.muda.audits++;
    seen.add(keyFor(milestone, phase));
    let raw = '';
    try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of raw.matchAll(/^\|\s*([^|]+?)\s*\|\s*(PASS|WARN|FAIL)\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|/gmi)) {
      const probe = m[1].trim();
      if (/^-+$|^Probe$/i.test(probe)) continue;
      addMudaFinding(bucket, m[3].trim(), m[2].trim());
    }
  }

  for (const row of readJsonl(path.join(planning, 'metrics', 'muda-log.jsonl'))) {
    const phase = parseLeadingPhase(row.phase || 'unknown');
    const milestone = inferMilestoneForPhase(planning, phase);
    const k = keyFor(milestone, phase);
    if (seen.has(k)) continue;
    const bucket = ensureBucket(phaseBuckets, milestone, phase);
    bucket.muda.audits++;
    let usedStructuredProbes = false;
    if (row.probes && typeof row.probes === 'object') {
      for (const probe of Object.values(row.probes)) {
        if (probe && typeof probe === 'object') {
          usedStructuredProbes = true;
          addMudaFinding(bucket, probe.waste_class, probe.verdict);
        }
      }
    }
    if (!usedStructuredProbes) {
      const fail = Number(row.fail || 0);
      const warn = Number(row.warn || 0);
      for (let i = 0; i < fail; i++) addMudaFinding(bucket, 'defects', 'FAIL');
      for (let i = 0; i < warn; i++) addMudaFinding(bucket, 'defects', 'WARN');
    }
  }
}

function latestByScope(rows) {
  const map = new Map();
  for (const row of rows) {
    const s = row.scope || {};
    const k = `${s.milestone || row.milestone || 'unknown'}::${s.phase || row.phase || 'all'}::${s.role || 'all'}`;
    const prev = map.get(k);
    if (!prev || String(row.ts || '') > String(prev.ts || '')) map.set(k, row);
  }
  return [...map.values()];
}

function collectTokenWaste(root, phaseBuckets) {
  const planning = planningDir(root);
  for (const row of latestByScope(readJsonl(path.join(planning, 'metrics', 'token-waste-status.jsonl')))) {
    const scope = row.scope || {};
    const milestone = scope.milestone || row.milestone || 'unknown';
    const phase = parseLeadingPhase(scope.phase || row.phase || 'milestone');
    const bucket = ensureBucket(phaseBuckets, milestone, phase);
    const totals = row.totals || {};
    bucket.token_waste.checks++;
    bucket.token_waste.ok += Number(totals.ok || 0);
    bucket.token_waste.warn += Number(totals.warn || 0);
    bucket.token_waste.degraded += Number(totals.degraded || 0);
    bucket.token_waste.false_positive += Number(totals.false_positive || 0);
    bucket.token_waste.waste_points +=
      Number(totals.degraded || 0) * WEIGHTS.token_degraded +
      Number(totals.warn || 0) * WEIGHTS.token_warn;
    for (const [reason, count] of Object.entries(row.rules_tripped || {})) {
      bucket.token_waste.rules_tripped[reason] = (bucket.token_waste.rules_tripped[reason] || 0) + Number(count || 0);
    }
    for (const hint of row.route_hints || []) {
      const reason = hint.reason || 'unknown';
      bucket.token_waste.route_hints[reason] = (bucket.token_waste.route_hints[reason] || 0) + Number(hint.count || 0);
    }
    refreshTotals(bucket);
  }
}

function collectGateValue(root, phaseBuckets) {
  const planning = planningDir(root);
  const files = [
    path.join(planning, 'metrics', 'gate-value-log.jsonl'),
    path.join(planning, 'metrics', 'gate-value.jsonl'),
  ].filter((p) => fs.existsSync(p));
  for (const file of files) {
    for (const row of readJsonl(file)) {
      const milestone = row.milestone || 'unknown';
      const phase = parseLeadingPhase(row.phase || 'unknown');
      const gate = row.gate || row.command || 'unknown';
      const outcome = String(row.outcome || row.status || '').toLowerCase();
      const bucket = ensureBucket(phaseBuckets, milestone, phase);
      bucket.gate_value.rows++;
      bucket.gate_value.by_gate[gate] = bucket.gate_value.by_gate[gate] || { pass: 0, warn: 0, block: 0, skip: 0 };
      if (/block|halt|fail|critical/.test(outcome)) {
        bucket.gate_value.block++;
        bucket.gate_value.by_gate[gate].block++;
        bucket.gate_value.waste_points += WEIGHTS.gate_block;
      } else if (/warn|degraded/.test(outcome)) {
        bucket.gate_value.warn++;
        bucket.gate_value.by_gate[gate].warn++;
        bucket.gate_value.waste_points += WEIGHTS.gate_warn;
      } else if (/skip/.test(outcome)) {
        bucket.gate_value.skip++;
        bucket.gate_value.by_gate[gate].skip++;
      } else {
        bucket.gate_value.pass++;
        bucket.gate_value.by_gate[gate].pass++;
      }
      refreshTotals(bucket);
    }
  }
}

function collectGateSavings(root) {
  const phaseBuckets = {};
  collectAtc(root, phaseBuckets);
  collectMuda(root, phaseBuckets);
  collectTokenWaste(root, phaseBuckets);
  collectGateValue(root, phaseBuckets);

  const milestones = {};
  const project = { ...emptyCounters() };
  for (const phase of Object.values(phaseBuckets)) {
    const ms = phase.milestone || 'unknown';
    if (!milestones[ms]) milestones[ms] = { milestone: ms, ...emptyCounters() };
    addTo(milestones[ms], phase);
    addTo(project, phase);
  }

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    scoring: {
      note: 'waste_points are deterministic estimates for comparing gates; they are not exact dollars or exact tokens.',
      weights: WEIGHTS,
    },
    sources: {
      atc: ['.planning/metrics/review-ledger.jsonl', '.planning/milestones/*/phases/*/{reviews/*-REVIEW.md,*-ATC-REVIEW.md}', '.planning/metrics/codex-log.jsonl'],
      muda: ['.planning/metrics/muda-log.jsonl', '.planning/milestones/*/phases/**/*WASTE*.md'],
      token_waste: ['.planning/metrics/token-waste-status.jsonl'],
      gate_value: ['.planning/metrics/gate-value-log.jsonl if present'],
    },
    project,
    milestones,
    phases: phaseBuckets,
  };
}

function fmt(n) {
  return String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push('# SGSD Gate Savings Report');
  lines.push('');
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push('');
  lines.push('> Waste points are deterministic estimates for comparing gates. Facts and estimates stay separate.');
  lines.push('');
  lines.push('## Project Total');
  lines.push('');
  lines.push('| Scope | Caught | Waste points | ATC crit | ATC warn | MUDA caught | Token degraded | Codex timeouts | Claude tokens avoided est | Timeout tokens wasted est |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const p = summary.project;
  lines.push(`| project | ${fmt(p.totals.caught)} | ${fmt(p.totals.waste_points)} | ${fmt(p.atc.critical)} | ${fmt(p.atc.warning)} | ${fmt(p.muda.caught)} | ${fmt(p.token_waste.degraded)} | ${fmt(p.atc.codex_timeouts)} | ${fmt(p.totals.claude_tokens_avoided_est)} | ${fmt(p.totals.codex_timeout_tokens_wasted_est)} |`);
  lines.push('');
  lines.push('## By Gate Type');
  lines.push('');
  lines.push('| Gate | Caught | Waste points | Evidence | Key stats |');
  lines.push('|---|---:|---:|---|---|');
  lines.push(`| ATC | ${fmt(p.atc.caught)} | ${fmt(p.atc.waste_points)} | reviews ${fmt(p.atc.reviews)} | crit ${fmt(p.atc.critical)}, warn ${fmt(p.atc.warning)}, Codex timeouts ${fmt(p.atc.codex_timeouts)} |`);
  lines.push(`| MUDA | ${fmt(p.muda.caught)} | ${fmt(p.muda.waste_points)} | audits ${fmt(p.muda.audits)} | warn ${fmt(p.muda.warn)}, fail ${fmt(p.muda.fail)}, by class ${Object.entries(p.muda.by_class).map(([k, v]) => `${k}:${fmt(v)}`).join(' ')} |`);
  lines.push(`| Token waste | ${fmt(p.token_waste.warn + p.token_waste.degraded)} | ${fmt(p.token_waste.waste_points)} | checks ${fmt(p.token_waste.checks)} | warn ${fmt(p.token_waste.warn)}, degraded ${fmt(p.token_waste.degraded)} |`);
  lines.push(`| Gate value log | ${fmt(p.gate_value.warn + p.gate_value.block)} | ${fmt(p.gate_value.waste_points)} | rows ${fmt(p.gate_value.rows)} | pass ${fmt(p.gate_value.pass)}, warn ${fmt(p.gate_value.warn)}, block ${fmt(p.gate_value.block)}, skip ${fmt(p.gate_value.skip)} |`);
  lines.push('');
  lines.push('## By Milestone');
  lines.push('');
  lines.push('| Milestone | Caught | Waste points | ATC caught | MUDA caught | Token degraded | Reviews | Codex timeouts |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const ms of Object.values(summary.milestones).sort((a, b) => String(a.milestone).localeCompare(String(b.milestone)))) {
    lines.push(`| ${ms.milestone} | ${fmt(ms.totals.caught)} | ${fmt(ms.totals.waste_points)} | ${fmt(ms.atc.caught)} | ${fmt(ms.muda.caught)} | ${fmt(ms.token_waste.degraded)} | ${fmt(ms.atc.reviews)} | ${fmt(ms.atc.codex_timeouts)} |`);
  }
  lines.push('');
  lines.push('## By Phase');
  lines.push('');
  lines.push('| Milestone | Phase | Caught | Waste points | ATC C/W | MUDA W/F | Token W/D | Codex timeout |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  const phases = Object.values(summary.phases).sort((a, b) =>
    String(a.milestone).localeCompare(String(b.milestone)) || Number(parseLeadingPhase(a.phase)) - Number(parseLeadingPhase(b.phase))
  );
  for (const ph of phases) {
    lines.push(`| ${ph.milestone} | ${ph.phase} | ${fmt(ph.totals.caught)} | ${fmt(ph.totals.waste_points)} | ${fmt(ph.atc.critical)}/${fmt(ph.atc.warning)} | ${fmt(ph.muda.warn)}/${fmt(ph.muda.fail)} | ${fmt(ph.token_waste.warn)}/${fmt(ph.token_waste.degraded)} | ${fmt(ph.atc.codex_timeouts)} |`);
  }
  lines.push('');
  lines.push('## Scoring Weights');
  lines.push('');
  for (const [k, v] of Object.entries(summary.scoring.weights)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  return lines.join('\n');
}

function writeSnapshot(root, summary) {
  const metrics = path.join(planningDir(root), 'metrics');
  fs.mkdirSync(metrics, { recursive: true });
  fs.writeFileSync(path.join(metrics, 'gate-savings.json'), JSON.stringify(summary, null, 2) + '\n');
  fs.writeFileSync(path.join(metrics, 'gate-savings.md'), renderMarkdown(summary));
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-gate-savings-'));
  try {
    const root = tmp;
    const metrics = path.join(root, '.planning', 'metrics');
    fs.mkdirSync(metrics, { recursive: true });
    fs.mkdirSync(path.join(root, '.planning', 'milestones', 'vX', 'phases', '1-demo'), { recursive: true });
    writeJsonl(path.join(metrics, 'review-ledger.jsonl'), [
      {_legacy: {milestone: 'vX', phase: '1-demo', provider: 'openai-codex', critical: 1, warning: 2, verdict: 'warn', one_liner: 'fixed in-loop'}},
    ]);
    writeJsonl(path.join(metrics, 'muda-log.jsonl'), [
      {phase: '1', warn: 1, fail: 1},
    ]);
    writeJsonl(path.join(metrics, 'token-waste-status.jsonl'), [
      {ts: '2026-01-01T00:00:00Z', scope: {milestone: 'vX', phase: '1'}, totals: {ok: 0, warn: 1, degraded: 2, false_positive: 0}, rules_tripped: {r: 2}, route_hints: [{reason: 'route', count: 2}]},
    ]);
    const summary = collectGateSavings(root);
    const ph = summary.phases['vX::1'];
    if (!ph) throw new Error('missing phase bucket');
    if (ph.atc.critical !== 1 || ph.atc.warning !== 2) throw new Error('ATC counts failed');
    if (ph.muda.warn !== 1 || ph.muda.fail !== 1) throw new Error('MUDA counts failed');
    if (ph.token_waste.degraded !== 2 || ph.token_waste.warn !== 1) throw new Error('token waste counts failed');
    if (ph.totals.waste_points !== 1 * 8 + 2 * 2 + 1 * 1 + 1 * 5 + 2 * 5 + 1 * 2) throw new Error('waste score failed');
    console.log('gate-savings self-test: PASS');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const rootIdx = argv.indexOf('--project-dir');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : repoRootFromCwd();
  const summary = collectGateSavings(root);
  if (argv.includes('--write')) writeSnapshot(root, summary);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(renderMarkdown(summary));
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  collectGateSavings,
  renderMarkdown,
  writeSnapshot,
  WEIGHTS,
};
