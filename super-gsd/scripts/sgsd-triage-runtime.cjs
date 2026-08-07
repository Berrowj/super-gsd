#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD triage runtime
// ============================================================================
// T148-01: owned scaffold for VTP route/fallback and contained evidence writes.
// Skills call this helper instead of calling VTP tools directly.
// ============================================================================

const fs = require('fs');
const path = require('path');

const { compose, project, callVtp } = require('./lib/vtp-context-composer.cjs');
const {
  findSgsdRoot,
  resolveContainedPath,
  readState,
  findPlanLockedFiles,
} = require('./lib/sgsd-state.cjs');
const { logGateEvidence } = require('./lib/gate-evidence-log.cjs');

const ROUTE_TOOL = 'mcp__vtp-kb__vtp_route_and_retrieve';
const SEARCH_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const DEFAULT_SKILL_OR_AGENT = 'sgsd-triage-runtime';
const TRIAGE_DEGRADED_SIGNAL = 'triage_vtp_degraded';

function usage() {
  return [
    'Usage:',
    '  node super-gsd/scripts/sgsd-triage-runtime.cjs --query <text> [--cwd <dir>]',
    '  node super-gsd/scripts/sgsd-triage-runtime.cjs --query-file <relpath> [--cwd <dir>]',
    '',
    'Options:',
    '  --query <text>        Operator triage query.',
    '  --query-file <path>   Repo-contained file containing the query.',
    '  --cwd <dir>           Start directory for SGSD root discovery.',
    '  --active-file <path>  Optional active file hint for VTP context.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { help: false, cwd: process.cwd(), rawQuery: null, queryFile: null, activeFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--cwd') {
      out.cwd = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--query') {
      out.rawQuery = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--query-file') {
      out.queryFile = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--active-file') {
      out.activeFile = argv[index + 1] || '';
      index += 1;
    } else {
      throw new Error(`triage_runtime_arg_unknown:${arg}`);
    }
  }
  return out;
}

function safeSegment(value) {
  const s = String(value || '').trim();
  if (!s || s.includes('/') || s.includes('\\')) return null;
  return /^[A-Za-z0-9_.-]+$/.test(s) ? s : null;
}

function normalizePhase(value) {
  const s = String(value || '').trim();
  return /^[0-9]+$/.test(s) ? s : null;
}

function readQueryFile(root, relPath) {
  const rel = String(relPath || '').trim();
  if (!rel || path.isAbsolute(rel)) return '';
  const target = resolveContainedPath(root, rel);
  if (!target || !fs.existsSync(target)) return '';
  return fs.readFileSync(target, 'utf8');
}

function inferPlanId(root, state) {
  const plans = findPlanLockedFiles(root, state.phase, state.milestone);
  if (plans.length === 0) return null;
  const base = path.basename(plans[0]);
  const match = base.match(/^[0-9]+-(.+)-PLAN-LOCKED\.md$/);
  return match ? match[1] : base.replace(/-PLAN-LOCKED\.md$/, '');
}

function findPhaseDirName(root, state) {
  const milestone = safeSegment(state && state.milestone);
  const phase = normalizePhase(state && state.phase);
  if (!milestone || !phase) return null;

  const phasesRootRel = path.join('.planning', 'milestones', milestone, 'phases');
  const phasesRoot = resolveContainedPath(root, phasesRootRel);
  const candidates = [phase];
  if (phase.length < 2) candidates.push(phase.padStart(2, '0'));

  try {
    const entries = phasesRoot ? fs.readdirSync(phasesRoot, { withFileTypes: true }) : [];
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const prefix of candidates) {
      const found = dirs.find((name) => name === prefix || name.startsWith(`${prefix}-`));
      if (found) return found;
    }
  } catch {
    // Fall through to the deterministic contained default below.
  }

  return `${phase}-triage-runtime`;
}

function evidenceRelPath(root, state) {
  const milestone = safeSegment(state && state.milestone);
  const phaseDir = findPhaseDirName(root, state);
  if (!milestone || !phaseDir) return null;
  return path.join('.planning', 'milestones', milestone, 'phases', phaseDir, 'VTP-EVIDENCE.md');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function evidenceHitCount(response) {
  const evidence = response && response.evidence ? response.evidence : {};
  return Array.isArray(evidence.hits) ? evidence.hits.length : 0;
}

function extractDocuments(response) {
  const r = response || {};
  const evidence = r.evidence || {};
  const source = Array.isArray(evidence.documents)
    ? evidence.documents
    : Array.isArray(r.documents)
      ? r.documents
      : Array.isArray(evidence.hits)
        ? evidence.hits
        : Array.isArray(r.hits)
          ? r.hits
          : [];

  return source.map((item, index) => {
    const doc = item && typeof item === 'object' ? item : {};
    return {
      doc_id: String(doc.doc_id || doc.id || doc.ref || doc.path || `hit-${index + 1}`),
      title: doc.title ? String(doc.title) : null,
    };
  });
}

function extractRouteFields(response) {
  const r = response || {};
  const plan = r.retrieval_plan || {};
  const reflection = Object.prototype.hasOwnProperty.call(r, 'reflection') ? r.reflection : undefined;
  return {
    selected_query: plan.selected_query || null,
    retrieval_mode: plan.retrieval_mode || null,
    reflection,
    reflection_verdict: reflection && reflection.verdict ? reflection.verdict : null,
    evidence_hit_count: evidenceHitCount(response),
    documents: extractDocuments(response),
  };
}

function fallbackPredicate(response) {
  const fields = extractRouteFields(response);
  if (fields.reflection === null) {
    return {
      predicate: 'reflection_null',
      reasonCode: 'vtp_fallback_reflection_null',
      evidenceHitCount: fields.evidence_hit_count,
    };
  }
  if (fields.evidence_hit_count < 2) {
    return {
      predicate: 'low_hits',
      reasonCode: 'vtp_fallback_low_hits',
      evidenceHitCount: fields.evidence_hit_count,
    };
  }
  return null;
}

function reasonFromError(error, fallbackReason) {
  if (error && error.message) return String(error.message);
  const text = String(error || '').trim();
  return text || fallbackReason;
}

function breadcrumb(options, reasonCode) {
  if (options && options.silent) return;
  process.stderr.write(`[SGSD] triage_vtp_degraded:${reasonCode}\n`);
}

function logDegradation(root, state, params) {
  const p = params || {};
  const evidenceRel = p.evidenceRel || evidenceRelPath(root, state);
  const nextActionPayload = p.nextActionPayload || {};
  const row = logGateEvidence(root, {
    signal: TRIAGE_DEGRADED_SIGNAL,
    status: 'warn',
    reason_codes: [p.reasonCode],
    artifacts: evidenceRel ? [{ kind: 'vtp_evidence', path: evidenceRel.replace(/\\/g, '/') }] : [],
    evidence: [],
    next_action: JSON.stringify(nextActionPayload),
    risk: 'medium',
    phase: state && state.phase ? String(state.phase) : null,
    milestone: state && state.milestone ? String(state.milestone) : null,
    raw_query: p.rawQuery || '',
    route_ok: p.routeOk === true,
    fallback_predicate: p.fallbackPredicate || null,
    evidence_hit_count: Number.isInteger(p.evidenceHitCount) ? p.evidenceHitCount : null,
    route_failure_reason: p.routeFailureReason || null,
    fallback_failure_reason: p.fallbackFailureReason || null,
    skill_or_agent: p.skillOrAgent || DEFAULT_SKILL_OR_AGENT,
  });
  breadcrumb(p, p.reasonCode);
  return row || null;
}

function callArgs(root, rawQuery, payload, options) {
  return {
    projectDir: root,
    logRoot: root,
    skillOrAgent: options.skillOrAgent || DEFAULT_SKILL_OR_AGENT,
    tier: 'triage',
    rawQuery,
    payload,
    mcpInvoke: options.mcpInvoke,
  };
}

async function safeCallVtp(tool, root, rawQuery, payload, options, exceptionReason) {
  try {
    return await callVtp(tool, callArgs(root, rawQuery, payload, options));
  } catch (error) {
    return {
      ok: false,
      reason: reasonFromError(error, exceptionReason),
      elapsed_ms: null,
    };
  }
}

function writeVtpEvidence(root, state, params) {
  const p = params || {};
  const rel = p.evidenceRel || evidenceRelPath(root, state);
  if (!rel) return null;
  const target = resolveContainedPath(root, rel);
  if (!target) return null;

  const selected = p.selectedResponse || null;
  const fields = extractRouteFields(selected);
  const docs = fields.documents;
  const lines = [
    '# VTP Evidence',
    '',
    'Runtime: sgsd-triage-runtime.cjs',
    `Mode: ${p.mode || 'route'}`,
    `Milestone: ${state && state.milestone ? state.milestone : ''}`,
    `Phase: ${state && state.phase ? state.phase : ''}`,
    `Raw query: ${p.rawQuery || ''}`,
    `Selected query: ${fields.selected_query || ''}`,
    `Retrieval mode: ${fields.retrieval_mode || ''}`,
    `Reflection verdict: ${fields.reflection_verdict || ''}`,
    `Evidence hit count: ${fields.evidence_hit_count}`,
    `Route payload: ${JSON.stringify(p.routePayload || null)}`,
    `Fallback payload: ${JSON.stringify(p.fallbackPayload || null)}`,
    '',
    '## Documents',
  ];

  if (docs.length === 0) {
    lines.push('No VTP documents available');
  } else {
    for (const doc of docs) {
      lines.push(`- ${doc.doc_id}${doc.title ? ` - ${doc.title}` : ''}`);
    }
  }

  lines.push(
    '',
    '## Call Results',
    '```json',
    JSON.stringify({
      route: p.routeResult ? {
        ok: p.routeResult.ok === true,
        reason: p.routeResult.reason || null,
        elapsed_ms: p.routeResult.elapsed_ms ?? null,
      } : null,
      fallback: p.fallbackResult ? {
        ok: p.fallbackResult.ok === true,
        reason: p.fallbackResult.reason || null,
        elapsed_ms: p.fallbackResult.elapsed_ms ?? null,
      } : null,
      fallback_predicate: p.fallbackPredicate || null,
    }, null, 2),
    '```',
    ''
  );

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, lines.join('\n'), 'utf8');
  return target;
}

function buildContext(root, state, rawQuery, options) {
  const sgsdState = {
    milestone: state.milestone,
    phase: state.phase,
    plan: options.plan || inferPlanId(root, state),
    repo: path.basename(root),
    active_file: options.activeFile || null,
    blockers: asArray(options.blockers),
    explicit_constraints: asArray(options.explicitConstraints),
    recent_turns: rawQuery ? [rawQuery] : [],
    recent_errors: asArray(options.recentErrors),
    session_id: options.sessionId || null,
  };
  const ctx = compose(sgsdState);
  return { ctx, triageSlice: project(ctx, 'triage') };
}

async function runTriageRuntime(options = {}) {
  const cwd = path.resolve(String(options.cwd || process.cwd()));
  const root = findSgsdRoot(cwd);
  if (!root) return { exitCode: 0, skipped: true, reason: 'non_sgsd_cwd' };

  const state = readState(root);
  if (!state || !state.milestone || !state.phase) {
    return { exitCode: 0, skipped: true, reason: 'state_frontmatter_absent' };
  }

  let rawQuery = options.rawQuery != null ? String(options.rawQuery) : '';
  if (!rawQuery && options.queryFile) rawQuery = readQueryFile(root, options.queryFile);
  rawQuery = String(rawQuery || '').trim();

  const evidenceRel = evidenceRelPath(root, state);
  const { triageSlice } = buildContext(root, state, rawQuery, options);
  const routePayload = { raw_query: rawQuery, context: triageSlice };
  const routeResult = await safeCallVtp(
    ROUTE_TOOL,
    root,
    rawQuery,
    routePayload,
    options,
    'vtp_route_exception'
  );

  let selectedResponse = null;
  let fallbackPayload = null;
  let fallbackResult = null;
  let fallbackAttempted = false;
  let fallbackReason = null;
  let fallbackPredicateValue = null;
  let mode = 'route';
  const degradationRows = [];

  if (routeResult.ok) {
    const predicate = fallbackPredicate(routeResult.response);
    if (predicate) {
      fallbackAttempted = true;
      fallbackReason = predicate.predicate;
      fallbackPredicateValue = predicate.predicate;
      degradationRows.push(logDegradation(root, state, {
        reasonCode: predicate.reasonCode,
        rawQuery,
        routeOk: true,
        fallbackPredicate: predicate.predicate,
        evidenceHitCount: predicate.evidenceHitCount,
        evidenceRel,
        skillOrAgent: options.skillOrAgent,
        silent: options.silent,
        nextActionPayload: {
          direct_search_attempted: true,
          fallback_predicate: predicate.predicate,
        },
      }));
    } else {
      selectedResponse = routeResult.response;
    }
  } else {
    fallbackAttempted = true;
    fallbackReason = 'route_failed';
    degradationRows.push(logDegradation(root, state, {
      reasonCode: 'vtp_route_failed',
      rawQuery,
      routeOk: false,
      fallbackPredicate: null,
      evidenceRel,
      routeFailureReason: routeResult.reason || 'vtp_route_failed',
      skillOrAgent: options.skillOrAgent,
      silent: options.silent,
      nextActionPayload: {
        direct_search_attempted: true,
        route_failure_reason: routeResult.reason || 'vtp_route_failed',
      },
    }));
  }

  if (fallbackAttempted) {
    fallbackPayload = {
      raw_query: rawQuery,
      query: rawQuery,
      context: triageSlice,
      fallback_reason: fallbackReason,
    };
    fallbackResult = await safeCallVtp(
      SEARCH_TOOL,
      root,
      rawQuery,
      fallbackPayload,
      options,
      'vtp_fallback_exception'
    );
    if (fallbackResult.ok) {
      selectedResponse = fallbackResult.response;
      mode = 'fallback';
    } else {
      selectedResponse = null;
      mode = 'evidence_less';
      degradationRows.push(logDegradation(root, state, {
        reasonCode: 'vtp_fallback_failed',
        rawQuery,
        routeOk: routeResult.ok === true,
        fallbackPredicate: fallbackPredicateValue,
        evidenceRel,
        fallbackFailureReason: fallbackResult.reason || 'vtp_fallback_failed',
        skillOrAgent: options.skillOrAgent,
        silent: options.silent,
        nextActionPayload: {
          continue_evidence_less: true,
          fallback_failure_reason: fallbackResult.reason || 'vtp_fallback_failed',
        },
      }));
    }
  }

  const evidencePath = writeVtpEvidence(root, state, {
    evidenceRel,
    rawQuery,
    mode,
    selectedResponse,
    routePayload,
    fallbackPayload,
    routeResult,
    fallbackResult,
    fallbackPredicate: fallbackPredicateValue,
  });

  return {
    exitCode: 0,
    skipped: false,
    root,
    state,
    routeOk: routeResult.ok === true,
    fallbackAttempted,
    fallbackPredicate: fallbackPredicateValue,
    mode,
    evidencePath,
    evidenceRel,
    degradationRows: degradationRows.filter(Boolean),
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const result = await runTriageRuntime(args);
  return result.exitCode;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`[SGSD] triage_runtime_failed:${reasonFromError(error, 'unknown')}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ROUTE_TOOL,
  SEARCH_TOOL,
  TRIAGE_DEGRADED_SIGNAL,
  evidenceHitCount,
  fallbackPredicate,
  parseArgs,
  runTriageRuntime,
};
