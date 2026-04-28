#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/context-bench/scoring.cjs
// Phase 51-01-T6: Scoring oracle + median-gate aggregator + report renderer.
//
// PURPOSE
//   Pure deterministic oracle for the context stress benchmark. Consumes the
//   per-scenario replay output (post_artifacts[] array, baseline rows, post
//   rows) and emits the row shape from RESEARCH sec 4.3 plus the aggregate
//   gate verdict from RESEARCH sec 4.4. Renders the markdown report from
//   the BENCHMARK-REPORT.template.md template.
//
//   Three exports:
//     scoreScenario({scenario, postArtifacts, baselineRows, postRows}) ->
//       full row shape (RESEARCH sec 4.3) with verdict per-scenario.
//
//     aggregateGate(scenarios[]) ->
//       {median_pct_reduction, total_evidence_loss, verdict in
//        {PASS, FAIL, PASS-WITH-DEFERRED-N, 'ledger-only -- incomplete'}}.
//
//     renderReport({aggregate, scenarios, injections, antiCheat}) ->
//       reads BENCHMARK-REPORT.template.md + writes the result file
//       (path supplied by caller). Deterministic; per-scenario diff
//       table always rendered (Q8). Em-dash (U+2014) for null cells.
//
// LOCK INVARIANTS
//   Lock 4  - Reuses Phase 41 summarize() BY REFERENCE for cache_read_ratio
//             computation when callers do not pre-compute it. Never re-
//             aggregates locally; if a caller wants raw row aggregation it
//             should call summarize() itself and pass baselineRows/postRows
//             pre-grouped.
//   Lock 11 - Evidence retention oracle is byte-equality-only on the
//             (kind, ref) tuple. Set-membership intersection. NO regex,
//             NO levenshtein, NO embedding, NO cosine, NO fuzzy match
//             of any kind.
//   Lock 13 - All three public APIs wrap internals in try/catch and return
//             a falsey/degraded-verdict sentinel on error. No path throws
//             upward.
//   ASCII-only on this file. The em-dash character (U+2014) used in the
//   rendered Markdown is built from a JS unicode escape (\u2014) so this
//   source file contains zero non-ASCII bytes and stays ASCII-greppable.
//
// W2 / W3 BEHAVIORS LOCKED HERE
//   W2: tokens_after === null -> verdict='ledger-only -- incomplete';
//       pct_reduction === null. The aggregate gate refuses to PASS or
//       PASS-WITH-DEFERRED-N if any scenario is in this state.
//   W3: legacy ledger rows missing useful_findings -> imputed to 0 (least
//       favorable). When sum_before === 0, the per-token utility ratio is
//       null (rendered as em-dash), NEVER divide-by-zero or Infinity.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

// Em-dash literal. ASCII-clean source: the JS string is built from a
// unicode escape (\u2014) so this .cjs file contains zero non-ASCII
// bytes. The rendered Markdown template (which IS UTF-8) embeds the
// codepoint verbatim; here we only carry the escape sequence.
const EM_DASH = '\u2014';

// Verdict literals (frozen so callers cannot accidentally mutate the
// vocabulary by typo).
const VERDICTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  PASS_WITH_DEFERRED: 'PASS-WITH-DEFERRED',  // suffixed with -N at emit
  LEDGER_ONLY_INCOMPLETE: 'ledger-only \u2014 incomplete',
});

// ---------------------------------------------------------------------------
// Helpers (file-local). All Lock 13 wrapped at the public-API boundary.
// ---------------------------------------------------------------------------

// _toEvidenceKey: build a byte-equality key from a (kind, ref) tuple. Returns
// null on any malformed entry so the caller can drop it from the set.
function _toEvidenceKey(item) {
  if (!item || typeof item !== 'object') return null;
  const kind = typeof item.kind === 'string' ? item.kind : null;
  const ref = typeof item.ref === 'string' ? item.ref : null;
  if (!kind || !ref) return null;
  // Use a delimiter that cannot appear in either component (NUL byte) so the
  // tuple is unambiguously reversible. This is byte-equality concatenation,
  // not a hash -- Lock 11 byte-equality preserved.
  return kind + '\x00' + ref;
}

// _postArtifactKeys: turn the postArtifacts[] array into a Set of byte-equal
// keys. Phase 45 emits capsule_decisions, bypass_refs, atc_findings as
// objects with various shapes; we extract the (kind, ref) tuple from each.
//   - capsule_decision: {kind:'capsule_decision', ref:'milestone/phase/...'}
//                       OR {milestone, phase, ref|path|content_hash}
//   - bypass_ref:        {kind:'bypass_ref', ref:string} OR {id, text}
//   - atc_finding:       {kind:'atc_finding', ref:string}
//   - verifier_verdict:  {kind:'verifier_verdict', ref:string}
//   - validated_thought: {kind:'validated_thought', ref:string}
//   - downstream_constraint: {kind, ref}
//
// For Phase 45's current emission (capsule objects with milestone+phase+ref),
// we synthesize the kind from the structural shape and build the ref from
// `milestone + '/' + phase` style canonical strings. Set-membership only.
function _postArtifactKeys(postArtifacts) {
  const set = Object.create(null);
  if (!Array.isArray(postArtifacts)) return set;
  for (let i = 0; i < postArtifacts.length; i++) {
    const item = postArtifacts[i];
    if (!item) continue;
    // Path A: explicit (kind, ref) tuple. This is the canonical shape.
    if (typeof item === 'object' && typeof item.kind === 'string'
        && typeof item.ref === 'string') {
      const k = _toEvidenceKey(item);
      if (k) set[k] = true;
      continue;
    }
    // Path B: Phase 45 capsule_ref shape -- {milestone, phase, ref|path}.
    // Synthesize a 'capsule_decision' key keyed on the canonical ref.
    if (typeof item === 'object' && (item.milestone || item.phase != null)) {
      const milestone = item.milestone || 'unknown';
      const phase = item.phase != null ? item.phase : 'unknown';
      // Prefer explicit ref/path/content_hash; fall back to milestone+phase.
      const ref = (typeof item.ref === 'string' && item.ref)
        || (typeof item.path === 'string' && item.path)
        || (typeof item.content_hash === 'string' && item.content_hash)
        || (milestone + '/' + phase);
      const k = _toEvidenceKey({ kind: 'capsule_decision', ref: ref });
      if (k) set[k] = true;
      continue;
    }
    // Path C: Phase 45 bypass_ref shape -- {id, text} or {ref}. Synthesize
    // a bypass_ref kind keyed on id|ref.
    if (typeof item === 'object'
        && (typeof item.id === 'string' || typeof item.ref === 'string')) {
      const ref = (typeof item.ref === 'string' && item.ref)
        || (typeof item.id === 'string' && item.id)
        || '';
      if (ref) {
        const k = _toEvidenceKey({ kind: 'bypass_ref', ref: ref });
        if (k) set[k] = true;
      }
      continue;
    }
    // Path D: opaque string. Treat as a generic evidence ref under 'opaque'
    // kind so it can match scenario evidence with kind='opaque' (none ship
    // this kind today; future-proof).
    if (typeof item === 'string' && item.length > 0) {
      const k = _toEvidenceKey({ kind: 'opaque', ref: item });
      if (k) set[k] = true;
    }
  }
  return set;
}

// _expectedEvidenceKeys: turn scenario.expected_evidence[] into a list of
// (key, original) pairs so we can both intersect AND enumerate misses.
function _expectedEvidenceKeys(scenario) {
  const out = [];
  if (!scenario || !Array.isArray(scenario.expected_evidence)) return out;
  for (let i = 0; i < scenario.expected_evidence.length; i++) {
    const ev = scenario.expected_evidence[i];
    const k = _toEvidenceKey(ev);
    if (k) out.push({ key: k, original: ev });
  }
  return out;
}

// _sumCacheReadRatio: take an array of summarize() rows (or token_breakdown
// rows) and compute the weighted cache_read / total ratio. Returns null on
// empty/zero-token input. Lock 4: this is the ONLY local aggregation, and
// only because callers may pass already-sliced row collections; the
// non-null callers are expected to pass summarize() output directly so this
// function just plucks the row.cache_read_ratio field weighted by row.total.
function _sumCacheReadRatio(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let totalCacheRead = 0;
  let totalTokens = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    // Two row shapes:
    //   summarize() output: { total: N, cache_read_ratio: X }
    //     -> cache_read = total * cache_read_ratio
    //   raw ledger row: { token_breakdown: { total_tokens, cache_read_tokens }}
    if (typeof r.total === 'number' && typeof r.cache_read_ratio === 'number') {
      totalTokens += r.total;
      totalCacheRead += r.total * r.cache_read_ratio;
      continue;
    }
    const tb = r.token_breakdown || r;
    const tot = Number(tb.total_tokens) || 0;
    const cr = Number(tb.cache_read_tokens) || 0;
    totalTokens += tot;
    totalCacheRead += cr;
  }
  if (totalTokens === 0) return null;
  return totalCacheRead / totalTokens;
}

// _sumUsefulFindingsPerToken: legacy-zero imputation per W3.
//   - Each row's useful_findings is treated as 0 if undefined/null/missing.
//   - Sum useful_findings, sum total_tokens.
//   - When sum_total === 0: return null (em-dash render; no div-by-zero).
//   - Otherwise: return useful_findings_sum / total_tokens_sum (raw ratio,
//     not per-100k -- that scaling lives in the report template).
function _sumUsefulFindingsPerToken(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let sumFindings = 0;
  let sumTokens = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    // summarize() output exposes useful_findings_per_100k directly. To
    // recover the raw ratio we'd need calls/total + sumFindings; since
    // summarize doesn't expose sumFindings we cannot back-compute.
    // Therefore: if the row is summarize()-shape we use its
    // useful_findings_per_100k field DIVIDED by 100000 as the ratio (Lock 4
    // forbids re-summing). For raw ledger rows we read the field directly,
    // imputing 0 on missing.
    if (typeof r.useful_findings_per_100k === 'number'
        && typeof r.total === 'number') {
      // back-derive the implied per-token rate (per_100k / 100000).
      // This is a pure scalar transform of summarize()'s already-aggregated
      // output, NOT a re-aggregation; row.total is the summarize() total.
      const implied = (r.useful_findings_per_100k / 100000);
      // We can't add this directly across multiple rows without weight; we
      // use the row.total as weight: sumFindings += implied * row.total.
      sumFindings += implied * r.total;
      sumTokens += r.total;
      continue;
    }
    // Raw ledger row branch.
    const tb = r.token_breakdown || r;
    const tot = Number(tb.total_tokens) || 0;
    // Legacy-zero imputation: useful_findings missing -> 0.
    const uf = (typeof tb.useful_findings === 'number') ? tb.useful_findings
                                                        : 0;
    sumFindings += uf;
    sumTokens += tot;
  }
  if (sumTokens === 0) return null;
  return sumFindings / sumTokens;
}

// _sumTokens: total tokens across the rows (sum). Returns 0 on empty.
function _sumTokens(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let t = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (typeof r.total === 'number') { t += r.total; continue; }
    const tb = r.token_breakdown || r;
    t += Number(tb.total_tokens) || 0;
  }
  return t;
}

// _countRawFileReread: count raw_evidence > 0 rows from context-packet-log
// shape. Each packet log row has metadata.context_source_mix.raw_evidence
// (Phase 45 field). Caller passes the slice that matches the scenario.
function _countRawFileReread(packetRows) {
  if (!Array.isArray(packetRows) || packetRows.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < packetRows.length; i++) {
    const r = packetRows[i];
    if (!r) continue;
    const md = r.metadata || {};
    const csm = md.context_source_mix || {};
    if ((Number(csm.raw_evidence) || 0) > 0) n++;
  }
  return n;
}

// _countComplaints: count rows in context-complaints.jsonl that match the
// scenario_run_id (or any scenario-keyed marker). Caller hands us the
// already-sliced array.
function _countComplaints(complaintRows) {
  if (!Array.isArray(complaintRows)) return 0;
  return complaintRows.length;
}

// _median: median of a numeric array; nulls excluded. Returns null if no
// non-null entries. RESEARCH Pitfall 2: median NOT mean.
function _median(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const nums = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && isFinite(v)) nums.push(v);
  }
  if (nums.length === 0) return null;
  nums.sort(function (a, b) { return a - b; });
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

// ---------------------------------------------------------------------------
// scoreScenario (PUBLIC API #1 -- Lock 13 wrapped). Returns the row shape
// from RESEARCH sec 4.3.
// ---------------------------------------------------------------------------
function scoreScenario(opts) {
  try {
    return _scoreScenarioImpl(opts || {});
  } catch (_e) {
    return _degradedRow('gate_internal_error');
  }
}

function _degradedRow(reason) {
  return {
    ok: false,
    reason: reason || 'score_inconclusive',
    scenario_id: null,
    tokens_before: null,
    tokens_after: null,
    pct_reduction: null,
    evidence_retention: null,
    evidence_loss_items: [],
    cache_read_ratio_before: null,
    cache_read_ratio_after: null,
    raw_file_reread_count: 0,
    context_complaint_count: 0,
    useful_findings_per_token_before: null,
    useful_findings_per_token_after: null,
    utility_per_token: null,
    utility_per_1k_tokens: null,
    verdict: 'FAIL',
  };
}

function _scoreScenarioImpl(opts) {
  const scenario = opts.scenario || null;
  const postArtifacts = Array.isArray(opts.postArtifacts) ? opts.postArtifacts
                                                          : [];
  const baselineRows = Array.isArray(opts.baselineRows) ? opts.baselineRows
                                                        : [];
  const postRows = Array.isArray(opts.postRows) ? opts.postRows : [];
  const packetRows = Array.isArray(opts.packetRows) ? opts.packetRows : [];
  const complaintRows = Array.isArray(opts.complaintRows) ? opts.complaintRows
                                                          : [];
  const tokensAfterOverride = (opts.tokensAfter === null
    || typeof opts.tokensAfter === 'number') ? opts.tokensAfter : undefined;
  // mode_used disambiguates "no token spend captured" from "ledger-only mode".
  // When the caller passes mode_used, we use it to decide the implicit
  // tokensAfter default (W1 fix per ATC). 'ledger-only' -> null (incomplete);
  // any other mode (full / full-stub / undefined) -> 0 (real dispatch with
  // no recorded post-spend, which is a real FAIL not an absence-of-evidence).
  const modeUsed = typeof opts.modeUsed === 'string' ? opts.modeUsed : null;

  if (!scenario) return _degradedRow('scenario_missing');

  // tokens_before: prefer scenario.baseline_signature.actual_tokens_total
  // (the Phase 41 ledger anchor); fall back to summing baselineRows.
  let tokensBefore = null;
  if (scenario.baseline_signature
      && typeof scenario.baseline_signature.actual_tokens_total === 'number') {
    tokensBefore = scenario.baseline_signature.actual_tokens_total;
  } else if (baselineRows.length > 0) {
    tokensBefore = _sumTokens(baselineRows);
  }

  // tokens_after: caller may explicitly pass null (W2 ledger-only case).
  // When undefined, derive from postRows (sum). When postRows empty AND the
  // override is undefined, branch on mode_used (W1 ATC fix):
  //   mode_used === 'ledger-only' -> null (real ledger-only branch:
  //                                  absence-of-evidence, not a FAIL)
  //   mode_used in {full, full-stub, ...} -> 0 (real dispatch with no
  //                                              recorded token spend; this
  //                                              is a real FAIL per plan
  //                                              T6.1 contract)
  //   mode_used absent (legacy callers) -> null (preserve prior behavior;
  //                                              callers that care must
  //                                              opt in by passing modeUsed)
  let tokensAfter;
  if (tokensAfterOverride !== undefined) {
    tokensAfter = tokensAfterOverride;
  } else if (postRows.length > 0) {
    tokensAfter = _sumTokens(postRows);
  } else if (modeUsed && modeUsed !== 'ledger-only') {
    tokensAfter = 0;
  } else {
    tokensAfter = null;
  }

  // pct_reduction: null if tokens_after === null OR tokens_before === 0.
  let pctReduction = null;
  if (tokensAfter === null) {
    pctReduction = null;
  } else if (typeof tokensBefore !== 'number' || tokensBefore <= 0) {
    pctReduction = null;
  } else {
    pctReduction = (tokensBefore - tokensAfter) / tokensBefore;
  }

  // evidence_retention: Lock 11 byte-equality set-membership intersection.
  // Returns 1.0 only when EVERY required evidence item is present in
  // postArtifacts (byte-equality on (kind, ref) tuple).
  const expectedKeys = _expectedEvidenceKeys(scenario);
  const haveSet = _postArtifactKeys(postArtifacts);
  let presentCount = 0;
  const missing = [];
  for (let i = 0; i < expectedKeys.length; i++) {
    if (haveSet[expectedKeys[i].key] === true) {
      presentCount++;
    } else {
      missing.push(expectedKeys[i].original);
    }
  }
  const evidenceRetention = expectedKeys.length === 0
    ? 1.0
    : (presentCount / expectedKeys.length);

  // cache_read_ratio_before/_after: weighted ratio across the row sets.
  const cacheReadBefore = _sumCacheReadRatio(baselineRows);
  const cacheReadAfter = postRows.length > 0
    ? _sumCacheReadRatio(postRows)
    : null;

  // raw_file_reread_count: count of context-packet-log rows where
  // metadata.context_source_mix.raw_evidence > 0 (post-replay packets).
  const rawReread = _countRawFileReread(packetRows);

  // context_complaint_count: complaintRows length (caller filters by run_id).
  const complaintCount = _countComplaints(complaintRows);

  // useful_findings_per_token: legacy-zero imputation (W3). When sum_before
  // is 0 (all-legacy baseline), the ratio is null -> em-dash render.
  const ufpBefore = _sumUsefulFindingsPerToken(baselineRows);
  const ufpAfter = postRows.length > 0
    ? _sumUsefulFindingsPerToken(postRows)
    : null;

  // utility_per_token = retention / tokens_after (null when tokens_after===null).
  let utilityPerToken = null;
  let utilityPer1k = null;
  if (typeof tokensAfter === 'number' && tokensAfter > 0) {
    utilityPerToken = evidenceRetention / tokensAfter;
    utilityPer1k = (evidenceRetention * 1000) / tokensAfter;
  }

  // verdict per-scenario:
  //   - 'ledger-only -- incomplete' if tokens_after === null
  //   - PASS if pct_reduction >= 0.5 AND retention === 1.0
  //   - FAIL otherwise (with tokens_after present)
  let verdict;
  if (tokensAfter === null) {
    verdict = VERDICTS.LEDGER_ONLY_INCOMPLETE;
  } else if (typeof pctReduction === 'number'
             && pctReduction >= 0.5
             && evidenceRetention === 1.0) {
    verdict = VERDICTS.PASS;
  } else {
    verdict = VERDICTS.FAIL;
  }

  return {
    ok: true,
    reason: 'scenario_scored',
    scenario_id: scenario.scenario_id || null,
    tokens_before: typeof tokensBefore === 'number' ? tokensBefore : null,
    tokens_after: tokensAfter === null ? null : tokensAfter,
    pct_reduction: pctReduction,
    evidence_retention: evidenceRetention,
    evidence_loss_items: missing,
    cache_read_ratio_before: cacheReadBefore,
    cache_read_ratio_after: cacheReadAfter,
    raw_file_reread_count: rawReread,
    context_complaint_count: complaintCount,
    useful_findings_per_token_before: ufpBefore,
    useful_findings_per_token_after: ufpAfter,
    utility_per_token: utilityPerToken,
    utility_per_1k_tokens: utilityPer1k,
    verdict: verdict,
  };
}

// ---------------------------------------------------------------------------
// aggregateGate (PUBLIC API #2 -- Lock 13 wrapped). RESEARCH sec 4.4.
// ---------------------------------------------------------------------------
function aggregateGate(scenarios, injections) {
  try {
    return _aggregateGateImpl(scenarios, injections);
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      median_pct_reduction: null,
      total_evidence_loss: 0,
      verdict: VERDICTS.FAIL,
    };
  }
}

function _aggregateGateImpl(scenarios, injections) {
  const list = Array.isArray(scenarios) ? scenarios : [];
  const injList = Array.isArray(injections) ? injections : [];

  // Detect ledger-only state: any scenario in 'ledger-only -- incomplete'.
  let anyLedgerOnly = false;
  // Detect retention < 1.0 anywhere.
  let anyRetentionLT1 = false;
  // Total evidence loss (sum of missing items across scenarios).
  let totalEvidenceLoss = 0;
  // Pct reductions (median input). Nulls excluded by _median.
  const pcts = [];

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s) continue;
    if (s.verdict === VERDICTS.LEDGER_ONLY_INCOMPLETE) anyLedgerOnly = true;
    if (typeof s.evidence_retention === 'number' && s.evidence_retention < 1.0) {
      anyRetentionLT1 = true;
    }
    const lossLen = Array.isArray(s.evidence_loss_items)
      ? s.evidence_loss_items.length : 0;
    totalEvidenceLoss += lossLen;
    if (typeof s.pct_reduction === 'number' && isFinite(s.pct_reduction)) {
      pcts.push(s.pct_reduction);
    }
  }

  // Detect any injection gate that did NOT fire.
  let anyInjectionFailed = false;
  for (let i = 0; i < injList.length; i++) {
    const f = injList[i];
    if (!f) continue;
    // gate_fired === false (explicit) OR === undefined when expected to
    // fire. Soft-skipped fixtures (skipped: true) are excluded.
    if (f.skipped === true) continue;
    if (f.gate_fired === false) anyInjectionFailed = true;
  }

  const medianPct = _median(pcts);

  let verdict;
  if (anyLedgerOnly) {
    verdict = VERDICTS.LEDGER_ONLY_INCOMPLETE;
  } else if (anyRetentionLT1) {
    verdict = VERDICTS.FAIL;
  } else if (medianPct === null) {
    // No nulls survived the ledger-only check, so an empty pcts array means
    // there were no scenarios at all -- FAIL by construction.
    verdict = VERDICTS.FAIL;
  } else if (medianPct < 0.40) {
    verdict = VERDICTS.FAIL;
  } else if (medianPct >= 0.50 && !anyInjectionFailed) {
    verdict = VERDICTS.PASS;
  } else if (medianPct >= 0.40 && medianPct < 0.50 && !anyInjectionFailed) {
    // CANDIDATE-WITH-DEBT range. Suffix the verdict with the count of
    // scenarios in the [0.40,0.50) band (caller-readable telemetry).
    // W2 ATC fix: PASS-WITH-DEFERRED-N requires every injection gate to have
    // fired. If any injection failed, drop to FAIL (plan T6 falsifier:
    // "any injection gate did not fire" -> FAIL).
    let band = 0;
    for (let i = 0; i < pcts.length; i++) {
      if (pcts[i] >= 0.40 && pcts[i] < 0.50) band++;
    }
    verdict = VERDICTS.PASS_WITH_DEFERRED + '-' + band;
  } else if (anyInjectionFailed) {
    verdict = VERDICTS.FAIL;
  } else {
    verdict = VERDICTS.FAIL;
  }

  return {
    ok: true,
    reason: 'aggregate_gate_computed',
    median_pct_reduction: medianPct,
    total_evidence_loss: totalEvidenceLoss,
    verdict: verdict,
    scenario_count: list.length,
    injection_count: injList.length,
    any_ledger_only: anyLedgerOnly,
    any_retention_lt1: anyRetentionLT1,
    any_injection_failed: anyInjectionFailed,
  };
}

// ---------------------------------------------------------------------------
// renderReport (PUBLIC API #3 -- Lock 13 wrapped). Reads
// BENCHMARK-REPORT.template.md and emits the rendered Markdown to the path
// supplied (or returns the string when no path is supplied).
//
// Em-dash (U+2014) replaces null cells. Per-scenario diff table is ALWAYS
// rendered (Q8). Deferred-debt section appears only on PASS-WITH-DEFERRED-N.
// 'ledger-only -- incomplete' section appears only when any scenario is in
// that state.
// ---------------------------------------------------------------------------
function renderReport(opts) {
  try {
    return _renderReportImpl(opts || {});
  } catch (_e) {
    return { ok: false, reason: 'report_render_failed', markdown: '' };
  }
}

function _renderReportImpl(opts) {
  const aggregate = opts.aggregate || {};
  const scenarios = Array.isArray(opts.scenarios) ? opts.scenarios : [];
  const injections = Array.isArray(opts.injections) ? opts.injections : [];
  const antiCheat = opts.antiCheat || {};
  const milestone = opts.milestone || 'v1.9';
  const outputPath = opts.outputPath || null;
  const templatePath = opts.templatePath
    || path.join(__dirname, 'BENCHMARK-REPORT.template.md');

  let template;
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (_e) {
    return { ok: false, reason: 'template_missing', markdown: '' };
  }

  // Render per-scenario table.
  const tableRows = [];
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i] || {};
    const drawn = _scenarioDrawnFromLabel(s);
    tableRows.push('| ' + (s.scenario_id || EM_DASH)
      + ' | ' + drawn
      + ' | ' + _renderInt(s.tokens_before)
      + ' | ' + _renderInt(s.tokens_after)
      + ' | ' + _renderPct(s.pct_reduction)
      + ' | ' + _renderRet(s.evidence_retention)
      + ' | ' + (s.verdict || EM_DASH)
      + ' |');
  }
  const scenariosTable = tableRows.length > 0
    ? tableRows.join('\n')
    : '| ' + EM_DASH + ' | (no scenarios scored) | ' + EM_DASH + ' | '
        + EM_DASH + ' | ' + EM_DASH + ' | ' + EM_DASH + ' | '
        + EM_DASH + ' |';

  // Render injection table.
  const injRows = [];
  for (let i = 0; i < injections.length; i++) {
    const f = injections[i] || {};
    const fired = (f.skipped === true)
      ? 'soft-skip'
      : (f.gate_fired === true ? 'YES'
          : (f.gate_fired === false ? 'NO' : EM_DASH));
    injRows.push('| ' + (f.id || EM_DASH)
      + ' | ' + (f.label || EM_DASH)
      + ' | ' + fired
      + ' | ' + (f.reason || EM_DASH)
      + ' |');
  }
  const injectionTable = injRows.length > 0
    ? injRows.join('\n')
    : '| ' + EM_DASH + ' | (no injections recorded) | ' + EM_DASH + ' | '
        + EM_DASH + ' |';

  // Deferred-debt section (only on PASS-WITH-DEFERRED-N).
  const verdict = aggregate.verdict || EM_DASH;
  const isDeferred = typeof verdict === 'string'
    && verdict.indexOf(VERDICTS.PASS_WITH_DEFERRED) === 0;
  const deferredSection = isDeferred
    ? '## Deferred Debt\n\n' +
      'Aggregate verdict is ' + verdict + '. Median pct_reduction is in ' +
      'the [0.40, 0.50) band, below the hard 0.50 PASS threshold. Per ' +
      'VTP-DELTA CANDIDATE-WITH-DEBT clause, milestone may advance with ' +
      'this debt logged. Re-run --mode=full when scenario coverage ' +
      'expands to confirm the debt has been retired.\n'
    : '';

  // ledger-only -- incomplete section.
  const isLedgerOnly = aggregate.any_ledger_only === true
    || verdict === VERDICTS.LEDGER_ONLY_INCOMPLETE;
  const ledgerOnlySection = isLedgerOnly
    ? '## ledger-only ' + EM_DASH + ' incomplete\n\n' +
      'One or more scenarios returned tokens_after=null because the ' +
      'claude CLI was absent or the post-mode dispatch could not run. ' +
      'This is documented absence-of-evidence, NOT a PASS. Re-run with ' +
      '`--mode=full --milestone=' + milestone + '` once the claude CLI ' +
      'is available to upgrade the report to a real PASS/FAIL verdict.\n'
    : '';

  // Anti-cheat attestation.
  const antiCheatBlock = '- workspace_clean_assertion: '
    + (antiCheat.workspace_clean === true ? 'PASS'
        : (antiCheat.workspace_clean === false ? 'FAIL' : EM_DASH)) + '\n'
    + '- forbidden_strings_checked: '
    + (typeof antiCheat.forbidden_strings_count === 'number'
        ? antiCheat.forbidden_strings_count : 6) + '\n'
    + '- secret_prefixes_checked: '
    + (typeof antiCheat.secret_prefixes_count === 'number'
        ? antiCheat.secret_prefixes_count : 3) + '\n'
    + '- post_dispatch_witness: '
    + (antiCheat.post_dispatch_witness_present === true ? 'PRESENT'
        : (antiCheat.post_dispatch_witness_present === false ? 'ABSENT'
            : EM_DASH)) + '\n';

  // Compute the median for header. Render as % when present, em-dash when not.
  const medianPct = aggregate.median_pct_reduction;
  const evidenceLoss = typeof aggregate.total_evidence_loss === 'number'
    ? aggregate.total_evidence_loss : 0;

  let markdown = template;
  markdown = markdown.split('{{milestone}}').join(milestone);
  markdown = markdown.split('{{aggregate_verdict}}').join(verdict);
  markdown = markdown.split('{{median_pct_reduction}}').join(_renderPct(medianPct));
  markdown = markdown.split('{{evidence_loss_total}}').join(String(evidenceLoss));
  markdown = markdown.split('{{scenarios_table}}').join(scenariosTable);
  markdown = markdown.split('{{injection_table}}').join(injectionTable);
  markdown = markdown.split('{{deferred_debt_section}}').join(deferredSection);
  markdown = markdown.split('{{ledger_only_section}}').join(ledgerOnlySection);
  markdown = markdown.split('{{anti_cheat_attestation}}').join(antiCheatBlock);
  markdown = markdown.split('{{generated_at}}').join(new Date().toISOString());
  markdown = markdown.split('{{scenario_count}}').join(String(scenarios.length));
  markdown = markdown.split('{{injection_count}}').join(String(injections.length));

  // Write if outputPath supplied.
  if (outputPath) {
    try {
      const dir = path.dirname(outputPath);
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) {}
      fs.writeFileSync(outputPath, markdown, 'utf8');
    } catch (e) {
      return { ok: false, reason: 'report_write_failed',
               markdown: markdown, write_error: e && e.message };
    }
  }

  return {
    ok: true,
    reason: 'report_rendered',
    markdown: markdown,
    output_path: outputPath || null,
  };
}

function _scenarioDrawnFromLabel(s) {
  const drawn = (s && s.drawn_from) || {};
  // The score row carries scenario_id but not drawn_from. Caller must merge
  // the original scenario fixture into the row before passing here for the
  // table; if drawn_from is absent we render an em-dash.
  if (!drawn.milestone && !drawn.phase) return EM_DASH;
  return (drawn.milestone || EM_DASH) + '/P'
    + (drawn.phase != null ? drawn.phase : EM_DASH)
    + '/' + (drawn.role || EM_DASH);
}

function _renderInt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return EM_DASH;
  return String(Math.round(n));
}

function _renderPct(n) {
  if (typeof n !== 'number' || !isFinite(n)) return EM_DASH;
  return (n * 100).toFixed(1) + '%';
}

function _renderRet(n) {
  if (typeof n !== 'number' || !isFinite(n)) return EM_DASH;
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// JSONL row writer for .planning/metrics/context-bench-runs.jsonl.
// envelope-v1 envelope: envelope_version=1, command='logBenchScenarioResult',
// additionalProperties:true so extension fields don't bump schema.
//
// This is a benchmark-internal observability stream; route-ledger.cjs's
// envelope-v1 schema is the source of the field names but the run_id
// regex differs (bench-prefixed). Lock 4: not a fork of route-ledger
// (no decision algorithm duplicated).
// ---------------------------------------------------------------------------
function appendBenchRunRow(planningDir, row) {
  try {
    if (!planningDir || !row) return false;
    const dir = path.join(planningDir, 'metrics');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) {}
    const file = path.join(dir, 'context-bench-runs.jsonl');
    const enriched = Object.assign({
      envelope_version: 1,
      ts: new Date().toISOString(),
      command: 'logBenchScenarioResult',
      status: row.ok === false ? 'fail'
        : (row.verdict === VERDICTS.PASS ? 'ok' : 'warn'),
      reason_codes: row.reason_codes || (row.reason ? [row.reason] : []),
      artifacts: row.artifacts || [],
      evidence: row.evidence || [],
      next_action: row.next_action || null,
      risk: row.risk || null,
      duration_ms: row.duration_ms != null ? row.duration_ms : null,
    }, row);
    // Strip transient fields that don't belong on disk.
    delete enriched.ok;
    fs.appendFileSync(file, JSON.stringify(enriched) + '\n', 'utf8');
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Module exports.
// ---------------------------------------------------------------------------
module.exports = {
  // Public API (Lock 13 wrapped):
  scoreScenario,
  aggregateGate,
  renderReport,
  // Auxiliary:
  appendBenchRunRow,
  VERDICTS,
  EM_DASH,
  // Test hooks (file-local helpers exposed for harness self-test composition):
  _toEvidenceKey,
  _postArtifactKeys,
  _expectedEvidenceKeys,
  _median,
  _sumUsefulFindingsPerToken,
};
