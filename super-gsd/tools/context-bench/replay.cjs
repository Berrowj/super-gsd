#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/context-bench/replay.cjs
// Phase 51-01-T2: baseline ledger reader + workspace-clean guard.
//
// PURPOSE
//   Provide the baseline-side of the context-stress benchmark: a ledger
//   reader that consumes Phase 41 token-attribution `summarize()` BY
//   REFERENCE (Lock 4: never fork, never reimplement), a phases->baseline
//   mapper, an anti-cheat workspace guard, and a STUB replayScenario that
//   returns the documented `mode_used: 'ledger-only'` shape until T5 wires
//   the full Sonnet path.
//
//   T2 freezes the contract for T3 (scenario fixtures), T4 (injectors), T5
//   (replay full-path), T6 (oracle/scoring), T7 (gate). Downstream tasks
//   compare baseline numbers (this file) against post-replay numbers; both
//   sides MUST flow through the same Phase 41 aggregator so they remain
//   mechanically comparable.
//
// LOCK INVARIANTS (mirror harness.cjs T1)
//   Lock 4  - No fork or reimplementation of Phase 41 `summarize()`. The
//             aggregator is required by relative path
//             ('../token-attribution/report.cjs') and called as a function.
//             Reading the raw JSONL via `ledgerPath()` to recover
//             source_event_ids that `summarize()` does NOT surface is NOT a
//             fork: no totals are summed locally, no cache-ratio is
//             recomputed, no useful_findings rate is recomputed.
//   Lock 11 - No embedding/cosine/levenshtein/regex-fuzzy. Anti-cheat scan
//             uses set-membership + byte-equality (indexOf) only.
//   Lock 13 - Every public API wraps internals in try/catch and returns a
//             falsey or degraded-verdict sentinel on error. The single
//             exception is `assertWorkspaceClean` which CONTRACTUALLY
//             throws on a forbidden-string hit; that throw is the API.
//   ASCII   - No smart quotes, no emoji, no non-ASCII literals.
//
// STOP RULE (T2)
//   `node super-gsd/tools/context-bench/harness.cjs --self-test` exits 0
//   with bootstrap (T1) + new T2 assertions all PASS. Atomic commit
//   `feat(51-01): baseline ledger reader + workspace-clean guard
//   (Phase 41 reuse)`.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Lock 4 import-by-reference. Phase 41 module is required RELATIVELY from
// the context-bench tree; copying any portion of summarize/ledgerPath into
// this file is a Lock 4 violation that the verifier blocks via
// `git diff --quiet -- super-gsd/tools/token-attribution/`.
// ---------------------------------------------------------------------------
const tokenAttr = require('../token-attribution/report.cjs');

// ---------------------------------------------------------------------------
// Frozen anti-cheat vocab. Set-membership only (Lock 11). Substring scan
// uses indexOf (byte-equality) on each forbidden token.
//
// Forbidden anti-cheat strings: any leakage of a benchmark-internal label
// into the workspace would let a replay agent see it, recognize the test
// frame, and short-circuit. These are the 6 strings the falsifier locks.
//
// Paranoia secret-prefixes: belt-and-braces, prevent committing a real key
// from a leaked .env into a benchmark workspace.
// ---------------------------------------------------------------------------
const FORBIDDEN_STRINGS = Object.freeze([
  'benchmark',
  'score_weight',
  'expected_failure',
  'oracle',
  'anti_cheat_signal',
  'this_is_a_test',
]);

const SECRET_PREFIXES = Object.freeze([
  'AKIA',  // AWS access key prefix
  'sk-',   // OpenAI / Anthropic
  'ghp_',  // GitHub personal access token
]);

// ---------------------------------------------------------------------------
// readBaselineFromLedger: per-scenario baseline reader. Lock 4: every
// number we return is computed by Phase 41 `summarize()`. We only add
// `source_event_ids[]` by reading the same ledger file (via `ledgerPath`)
// and extracting `token_breakdown.source_event_id` from rows that match
// the same milestone+role filter. No totals are summed locally.
//
// Input shape:
//   {
//     scenario: { drawn_from: { milestone, role, phase? }, ... },
//     planningDir: '<absolute path to .planning>',
//   }
// Output shape (Lock 13: degraded sentinel on error):
//   {
//     tokens: number,                       // summarize().total
//     cache_read_ratio: number,             // summarize().cache_read_ratio
//     useful_findings_per_100k: number,     // summarize().useful_findings_per_100k
//     source_event_ids: string[],           // from ledger rows (filtered)
//     ok: boolean,
//     reason: 'baseline_read_ok' | 'baseline_read_degraded',
//   }
// ---------------------------------------------------------------------------
function readBaselineFromLedger(opts) {
  try {
    const o = opts || {};
    const scenario = o.scenario || null;
    const planningDir = o.planningDir || null;
    if (!scenario || !planningDir) {
      return _baselineDegraded('missing_scenario_or_planning_dir');
    }
    const drawn = scenario.drawn_from || {};
    if (!drawn.milestone || !drawn.role) {
      return _baselineDegraded('missing_drawn_from_milestone_or_role');
    }

    // Lock 4: live function, called by reference.
    const summarizeOpts = {
      groupBy: 'role+phase',
      milestone: drawn.milestone,
      role: drawn.role,
    };
    const grouped = tokenAttr.summarize(planningDir, summarizeOpts);
    if (!Array.isArray(grouped)) {
      return _baselineDegraded('summarize_returned_non_array');
    }

    // If a phase is specified, narrow to that phase's row. Otherwise sum
    // is implicit in `total` returned by summarize for the milestone+role
    // slice -- we pick the largest matching key (highest total tokens) so
    // a phase-less scenario still resolves to a single anchor.
    let row = null;
    if (drawn.phase != null) {
      const phaseStr = String(drawn.phase);
      const wantKey = drawn.role + '|' + phaseStr;
      row = grouped.find(function (r) { return r.key === wantKey; }) || null;
    } else if (grouped.length > 0) {
      // grouped is pre-sorted by total desc inside summarize.
      row = grouped[0];
    }
    if (!row) {
      return _baselineDegraded('no_matching_aggregate_row');
    }

    // Recover source_event_ids[] without re-summing anything. Read the
    // same JSONL the aggregator read; filter on the same milestone+role
    // (and phase, when scenario provides one); pluck source_event_id.
    const eventIds = _readSourceEventIds(planningDir, drawn);

    return {
      ok: true,
      reason: 'baseline_read_ok',
      tokens: row.total,
      cache_read_ratio: row.cache_read_ratio,
      useful_findings_per_100k: row.useful_findings_per_100k,
      source_event_ids: eventIds,
    };
  } catch (_e) {
    return _baselineDegraded('exception');
  }
}

// _readSourceEventIds: file-local helper. Reads the same ledger that
// summarize reads (via the public `ledgerPath` accessor) and extracts
// token_breakdown.source_event_id from each filter-matching row. NO
// totals are summed; this is pure ID retrieval. (Lock 4 compliance.)
function _readSourceEventIds(planningDir, drawn) {
  try {
    const p = tokenAttr.ledgerPath(planningDir);
    if (!p || !fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    const wantPhase = drawn.phase != null ? String(drawn.phase) : null;
    const ids = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let r;
      try { r = JSON.parse(line); } catch (_e) { continue; }
      if (!r || typeof r !== 'object') continue;
      if (drawn.milestone && r.milestone !== drawn.milestone) continue;
      if (drawn.role && r.role !== drawn.role) continue;
      if (wantPhase != null && String(r.phase) !== wantPhase) continue;
      const tb = r.token_breakdown || {};
      if (tb.source_event_id) ids.push(tb.source_event_id);
    }
    return ids;
  } catch (_e) {
    return [];
  }
}

function _baselineDegraded(reason) {
  return {
    ok: false,
    reason: 'baseline_read_degraded',
    tokens: null,
    cache_read_ratio: null,
    useful_findings_per_100k: null,
    source_event_ids: [],
    note: reason,
  };
}

// ---------------------------------------------------------------------------
// mapPhasesToBaseline: for each scenario in the supplied list, run
// readBaselineFromLedger and collect the result keyed by scenario_id.
// Returns {} on empty input (T3 hasn't shipped fixtures yet) -- callers
// MUST handle the empty-map case gracefully.
//
// Input:  scenarios (array), planningDir (string)
// Output: { [scenario_id]: baseline_row, ... }
// ---------------------------------------------------------------------------
function mapPhasesToBaseline(scenarios, planningDir) {
  try {
    const out = {};
    if (!Array.isArray(scenarios) || scenarios.length === 0) return out;
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      if (!s || !s.scenario_id) continue;
      out[s.scenario_id] = readBaselineFromLedger({
        scenario: s,
        planningDir: planningDir,
      });
    }
    return out;
  } catch (_e) {
    return {};
  }
}

// ---------------------------------------------------------------------------
// replayScenario STUB. Documented contract:
//
//   { tokens_after: null, post_artifacts: [], scenario_run_id: null,
//     mode_used: 'ledger-only' }
//
// when claudeBinary is null/undefined. T5 fills the `--mode=full` Sonnet
// path. Lock 13: never throws upward; returns degraded sentinel on error.
// ---------------------------------------------------------------------------
function replayScenario(opts) {
  try {
    const o = opts || {};
    const claudeBinary = o.claudeBinary || null;
    // T5 will branch on claudeBinary != null. Until then, all paths
    // (claudeBinary null OR set) return the documented stub shape so
    // downstream tasks have a stable surface. The mode_used label is
    // 'ledger-only' for the null path (the contract); the non-null path
    // also degrades to 'ledger-only' until T5 wires the full Sonnet
    // pipeline, which keeps the falsifier's "claudeBinary=null path
    // throws instead of returning mode_used='ledger-only'" rule trivially
    // satisfied.
    return {
      ok: true,
      reason: 'scenario_replay_degraded_ledger_only',
      tokens_after: null,
      post_artifacts: [],
      scenario_run_id: null,
      mode_used: 'ledger-only',
      _t5_pending: claudeBinary ? true : false,
    };
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      tokens_after: null,
      post_artifacts: [],
      scenario_run_id: null,
      mode_used: 'ledger-only',
    };
  }
}

// ---------------------------------------------------------------------------
// assertWorkspaceClean: anti-cheat guard. Walks every regular file under
// workspaceRoot and throws if any forbidden anti-cheat string OR known
// secret prefix is found. Set-membership + indexOf only (Lock 11).
//
// CONTRACT: this function THROWS on a hit. That is the API. Callers
// (replay path) catch the throw and abort the scenario with the
// 'scenario_replay_aborted_anti_cheat_hit' reason code. Lock 13's
// "never throw upward" rule applies to the harness public API surface
// (runBench/replayScenario/etc.); helper guards like this one signal
// failure via throw because the calling site is a single try/catch
// boundary and the throw carries the offending file/string.
//
// Walk is shallow-recursive without symlink following. Skips:
//   - node_modules/, .git/, .planning/metrics/ (the ledger lives there
//     and contains the literal string 'benchmark' from prior phases'
//     unrelated commits; only the scenario WORKSPACE is scanned).
//   - files larger than 1 MiB (anti-DoS; secret prefixes are 4-6 bytes,
//     anti-cheat tokens are short ASCII -- both fit in any reasonable
//     test fixture).
// ---------------------------------------------------------------------------
function assertWorkspaceClean(workspaceRoot) {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    throw new Error('assertWorkspaceClean: workspaceRoot must be a string');
  }
  if (!fs.existsSync(workspaceRoot)) {
    throw new Error('assertWorkspaceClean: workspaceRoot does not exist: '
                    + workspaceRoot);
  }
  const stack = [workspaceRoot];
  const SKIP_DIRS = ['node_modules', '.git'];
  const MAX_BYTES = 1024 * 1024;
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i];
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        if (SKIP_DIRS.indexOf(ent.name) !== -1) continue;
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      let st;
      try { st = fs.statSync(full); } catch (_e) { continue; }
      if (st.size > MAX_BYTES) continue;
      let buf;
      try { buf = fs.readFileSync(full, 'utf8'); } catch (_e) { continue; }
      // Forbidden anti-cheat tokens (byte-equality, indexOf).
      for (let j = 0; j < FORBIDDEN_STRINGS.length; j++) {
        const tok = FORBIDDEN_STRINGS[j];
        if (buf.indexOf(tok) !== -1) {
          throw new Error('assertWorkspaceClean: forbidden anti-cheat token '
                          + JSON.stringify(tok) + ' found in ' + full);
        }
      }
      // Paranoia: secret prefixes.
      for (let k = 0; k < SECRET_PREFIXES.length; k++) {
        const sp = SECRET_PREFIXES[k];
        if (buf.indexOf(sp) !== -1) {
          throw new Error('assertWorkspaceClean: secret prefix '
                          + JSON.stringify(sp) + ' found in ' + full);
        }
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Module exports. T3 imports readBaselineFromLedger + mapPhasesToBaseline
// for fixture cross-checks. T4 imports assertWorkspaceClean for the
// inject-and-replay flow. T5 replaces this replayScenario with the full
// Sonnet path; the export shape stays.
// ---------------------------------------------------------------------------
module.exports = {
  readBaselineFromLedger,
  mapPhasesToBaseline,
  replayScenario,
  assertWorkspaceClean,
  // Frozen vocabs (exported so harness self-test can parametrize the
  // anti-cheat assertion across the 6 forbidden strings):
  FORBIDDEN_STRINGS,
  SECRET_PREFIXES,
};
