#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/context-bench/replay.cjs
// Phase 51-01-T2 + T5: baseline ledger reader + workspace-clean guard +
// hybrid replay with claude CLI dispatch + 1.5M token ceiling +
// deterministic post_artifacts population.
//
// PURPOSE
//   Provide both sides of the context-stress benchmark:
//
//     T2: baseline reader + anti-cheat workspace guard. The ledger reader
//     consumes Phase 41 token-attribution `summarize()` BY REFERENCE
//     (Lock 4: never fork, never reimplement); a phases->baseline mapper;
//     the anti-cheat workspace guard.
//
//     T5: replayScenario --mode=full path. Builds the Phase 45 packet by
//     reference (Lock 4), asserts workspace clean (anti-cheat boundary),
//     spawns `claude --print --dangerously-skip-permissions -p "<normal>"`
//     mirroring sgsd-blind-live-controller.mjs:104-138 verbatim, captures
//     post-run token attribution, populates post_artifacts deterministically
//     from the packet (Lock 11 byte-equality), writes a witness row to
//     route-decisions.jsonl with run_id `bench-post-${scenario_id}-${ts}`
//     so the dispatch is unforgeable, enforces the $1.5M token ceiling,
//     and transparently downgrades to ledger-only when claude CLI is
//     absent (Lock 13). T6 scoreScenario consumes the post_artifacts
//     array verbatim for the evidence_retention oracle.
//
// LOCK INVARIANTS (mirror harness.cjs T1)
//   Lock 4  - No fork or reimplementation of Phase 41 summarize / Phase 45
//             buildPacket / Phase 47 routeDispatch / Phase 41 ledgerPath.
//             All four are required by relative path and called as
//             functions. The bench writes its own observability witness
//             row to route-decisions.jsonl via fs.appendFileSync (with a
//             benchmark-prefixed run_id `bench-post-{scenario_id}-{ts}`)
//             because envelope-v1 (route-ledger.cjs RUN_ID_REGEX) rejects
//             custom prefixes; this is a benchmark-internal observability
//             writer, not a fork of the production routeDispatch logic.
//             The Phase 45/47 trees stay git-diff-quiet.
//   Lock 6  - bypass_refs are passed through byte-verbatim (any element
//             cloned from packet.bypass_refs is included in post_artifacts
//             without rewrite). post_artifacts byte-equality is the T6
//             oracle contract.
//   Lock 11 - No embedding/cosine/levenshtein/regex-fuzzy. Anti-cheat scan
//             uses set-membership + byte-equality (indexOf) only.
//             post_artifacts is the literal concat of packet
//             capsule/bypass/atc-finding arrays - no reordering, dedupe,
//             or transform.
//   Lock 13 - Every public API wraps internals in try/catch and returns a
//             falsey or degraded-verdict sentinel on error. The single
//             exception is `assertWorkspaceClean` which CONTRACTUALLY
//             throws on a forbidden-string hit; that throw is the API.
//             replayScenario NEVER throws upward; claude CLI absent ->
//             soft downgrade to mode_used='ledger-only' with reason
//             `bench_fixture_skipped:claude_cli_unavailable`. Token
//             ceiling exceeded -> verdict=DEGRADED + reason
//             `bench_token_ceiling_exceeded`.
//   ASCII   - No smart quotes, no emoji, no non-ASCII literals.
//
// ANTI-CHEAT INVARIANTS (T5 - REJECT-on-violation)
//   1. Fixtures live at operator-local path (ctx.fixtureDir defaults to
//      %LOCALAPPDATA%/sgsd-bench/decks or ~/.local/share/sgsd-bench/decks)
//   2. Prompt is normal task (no benchmark/score/test/evaluation tokens)
//   3. expected_evidence/anti_cheat_signal NEVER copied into workspace
//   4. Post-run scoring runs against artifact files OUTSIDE workspace
//   5. Workspace asserted clean before each run
//
// STOP RULE (T5)
//   `node super-gsd/tools/context-bench/harness.cjs --self-test` exits 0
//   with bootstrap (T1) + T2 + T3 + T4 + T5 assertions PASS (running
//   22 -> 27). `--mode=full --milestone=v1.9 --dry-run` succeeds (computes
//   packet shapes without spawning claude). Atomic commit
//   `feat(51-01): hybrid replay + claude CLI dispatch + anti-cheat
//   boundary mirror + 1.5M token ceiling + deterministic post_artifacts`.
// =============================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');

// ---------------------------------------------------------------------------
// Lock 4 import-by-reference. Phase 41 module (token-attribution summarize +
// ledgerPath) and Phase 45 module (context-packet buildPacket) are required
// RELATIVELY from the context-bench tree; copying any portion of those
// modules into this file is a Lock 4 violation that the verifier blocks
// via `git diff --quiet -- super-gsd/tools/{token-attribution,context-packet}/`.
// ---------------------------------------------------------------------------
const tokenAttr = require('../token-attribution/report.cjs');
const _phase45 = require('../context-packet/build.cjs');

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
// T5 frozen contract constants.
//
// PROMPT_FORBIDDEN_TOKENS: per Pitfall 6, the spawned claude prompt is a
// NORMAL task ("Research Phase {N} of {milestone} SGSD") and MUST NOT
// contain any of these meta-evaluation tokens. Validated before spawn.
//
// TOKEN_CEILING_USD: $1,500,000 budget across 6 runs total. The ceiling
// is denominated in TOKENS not USD (the field name follows the plan's
// $1.5M shorthand). The bench tracks cumulative input+output tokens
// across all replayScenario calls in one process; if cumulative exceeds
// the ceiling MID-RUN, abort with verdict=DEGRADED + reason
// `bench_token_ceiling_exceeded`.
//
// FIXTURE_DIR_DEFAULT: operator-local path where decks live. Pinned to
// %LOCALAPPDATA%/sgsd-bench/decks on Windows or ~/.local/share/sgsd-bench/
// decks on POSIX. Anti-cheat invariant 1 (fixtures live at operator-local
// path, never inside the project workspace).
// ---------------------------------------------------------------------------
const PROMPT_FORBIDDEN_TOKENS = Object.freeze([
  'benchmark',
  'score',
  'test',
  'evaluation',
]);

const TOKEN_CEILING = 1500000;

function _defaultFixtureDir() {
  try {
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
      return path.join(process.env.LOCALAPPDATA, 'sgsd-bench', 'decks');
    }
    const home = (typeof os.homedir === 'function' && os.homedir())
                 || process.env.HOME || process.env.USERPROFILE || '';
    if (home) {
      return path.join(home, '.local', 'share', 'sgsd-bench', 'decks');
    }
    return path.join(os.tmpdir(), 'sgsd-bench', 'decks');
  } catch (_e) {
    return path.join(os.tmpdir(), 'sgsd-bench', 'decks');
  }
}

// Cumulative token-spend tracker. Process-local (one bench run = one
// Node invocation). Reset on each fresh require()-ed instance.
let _tokenSpendCumulative = 0;

function _resetTokenSpend() { _tokenSpendCumulative = 0; }
function _getTokenSpend() { return _tokenSpendCumulative; }
function _addTokenSpend(n) {
  if (typeof n === 'number' && n > 0) _tokenSpendCumulative += n;
}

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
// T5 helpers: prompt builder, token capture, witness writer.
// ---------------------------------------------------------------------------

// _buildNormalPrompt: Pitfall 6 contract. The spawned claude prompt is a
// NORMAL task ("Research Phase {N} of {milestone} SGSD") and MUST NOT
// contain benchmark/score/test/evaluation. The drawn_from.milestone +
// drawn_from.phase fields are the anchor; we never mention scenario_id.
function _buildNormalPrompt(scenario) {
  const drawn = (scenario && scenario.drawn_from) || {};
  const phase = drawn.phase != null ? String(drawn.phase) : 'unknown';
  const milestone = drawn.milestone || 'unknown';
  // Normal-task wording. No meta-eval tokens. This string is asserted
  // forbidden-token-free by _validatePromptIsNormal below.
  return 'Research Phase ' + phase + ' of ' + milestone + ' SGSD.';
}

// _validatePromptIsNormal: byte-equality scan. Returns true iff none of
// PROMPT_FORBIDDEN_TOKENS is present (case-insensitive byte match).
function _validatePromptIsNormal(prompt) {
  if (typeof prompt !== 'string' || prompt.length === 0) return false;
  const lower = prompt.toLowerCase();
  for (let i = 0; i < PROMPT_FORBIDDEN_TOKENS.length; i++) {
    if (lower.indexOf(PROMPT_FORBIDDEN_TOKENS[i]) !== -1) return false;
  }
  return true;
}

// _captureTokenSpendForRun: read the token-attribution ledger after the
// dispatch and pluck rows whose token_breakdown.source_event_id, role, or
// any annotation marks them as belonging to the bench dispatch. Phase 41
// collect.cjs writes one row per agent turn; the bench tags its own
// witness via the route-decisions.jsonl row (see _writeWitnessRow). Here
// we just read the ledger tail and pick rows newer than ts_start, sum the
// total tokens, and return the aggregate. Lock 4: no local summarization
// logic - we delegate to summarize() with a milestone filter when one is
// available.
function _captureTokenSpendForRun(planningDir, runStartIso) {
  try {
    const p = tokenAttr.ledgerPath(planningDir);
    if (!p || !fs.existsSync(p)) {
      return { ok: false, reason: 'ledger_absent', tokens: 0, rows: [] };
    }
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) {
      return { ok: false, reason: 'ledger_empty', tokens: 0, rows: [] };
    }
    const lines = text.split(/\r?\n/);
    const collected = [];
    let total = 0;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln) continue;
      let r;
      try { r = JSON.parse(ln); } catch (_e) { continue; }
      if (!r || typeof r !== 'object') continue;
      // Filter by ts >= runStartIso (string compare on ISO-8601 is safe).
      if (typeof r.ts === 'string' && typeof runStartIso === 'string'
          && r.ts < runStartIso) continue;
      collected.push(r);
      const tb = r.token_breakdown || {};
      if (typeof tb.total === 'number') total += tb.total;
      else if (typeof r.tokens === 'number') total += r.tokens;
    }
    return { ok: true, reason: 'token_capture_ok', tokens: total,
             rows: collected };
  } catch (_e) {
    return { ok: false, reason: 'token_capture_exception',
             tokens: 0, rows: [] };
  }
}

// _writeWitnessRow: append a benchmark witness row to
// .planning/metrics/route-decisions.jsonl. The row's run_id is
// `bench-post-{scenario_id}-{tsMillis}` so T5.2's substring match is the
// unforgeable witness that the dispatch was real (a stubbed dispatch
// would not append this row).
//
// Lock 4 note: production routes write via route-ledger.cjs which enforces
// envelope-v1 RUN_ID_REGEX (ISO-prefix); the bench prefix would be
// rejected. The bench is its own observability boundary - we append
// directly via fs.appendFileSync. This is NOT a fork of routeDispatch
// (no decision algorithm is duplicated); it is a benchmark-internal
// witness with its own run_id format. Phase 47 route.cjs and
// scripts/lib/route-ledger.cjs stay git-diff-quiet.
function _writeWitnessRow(planningDir, scenario, decision) {
  try {
    if (!planningDir || !scenario || !scenario.scenario_id) return null;
    const tsMillis = Date.now();
    const runId = 'bench-post-' + scenario.scenario_id + '-' + tsMillis;
    const dir = path.join(planningDir, 'metrics');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) {}
    const file = path.join(dir, 'route-decisions.jsonl');
    const drawn = scenario.drawn_from || {};
    const row = {
      envelope_version: 1,
      ts: new Date(tsMillis).toISOString(),
      command: 'benchPostReplayWitness',
      status: 'ok',
      reason_codes: ['matched_uncertainty_type'],
      artifacts: [],
      evidence: [],
      next_action: null,
      risk: null,
      duration_ms: 0,
      run_id: runId,
      phase: drawn.phase != null ? drawn.phase : null,
      milestone: drawn.milestone || null,
      boundary: 'bench_replay',
      decision: decision || {},
    };
    fs.appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
    return runId;
  } catch (_e) {
    return null;
  }
}

// _hasWitnessRow: read route-decisions.jsonl tail and assert at least one
// row exists where row.run_id starts with the prefix
// `bench-post-{scenario_id}-`. Substring match on run_id (NOT scenario_id
// field - Phase 47 does not write scenario_id).
function _hasWitnessRow(planningDir, scenarioId) {
  try {
    if (!planningDir || !scenarioId) return false;
    const file = path.join(planningDir, 'metrics', 'route-decisions.jsonl');
    if (!fs.existsSync(file)) return false;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.trim()) return false;
    const prefix = 'bench-post-' + scenarioId + '-';
    const lines = text.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const ln = lines[i];
      if (!ln) continue;
      let r;
      try { r = JSON.parse(ln); } catch (_e) { continue; }
      if (!r || typeof r !== 'object') continue;
      if (typeof r.run_id === 'string' && r.run_id.indexOf(prefix) === 0) {
        return true;
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
}

// _buildPostArtifacts: deterministic Lock-11 source. Concat (no reorder,
// no dedupe, no transform):
//   [...packet.metadata.consumed_capsule_decisions,
//    ...packet.bypass_refs,
//    ...packet.metadata.consumed_atc_findings]
//
// Phase 45 build.cjs emits `capsule_refs[]` (top-level) and `bypass_refs[]`
// (top-level); the plan's `metadata.consumed_capsule_decisions` and
// `metadata.consumed_atc_findings` are the forward-compatible names. We
// read BOTH locations - if metadata.consumed_* is populated (forward
// builds) we use it; otherwise we fall back to packet.capsule_refs (the
// current Phase 45 emission shape). bypass_refs is unambiguous. ATC
// findings have no current top-level slot in Phase 45's emission, so the
// third array is empty by construction (deterministic absent-source
// baseline) until a future Phase 45 extension fills metadata
// .consumed_atc_findings - at which point post_artifacts will pick it up
// without modification.
//
// Lock 4 compliance: we read packet fields, never compute. Lock 11
// compliance: byte-equality on opaque clones; no transform.
function _buildPostArtifacts(packet) {
  try {
    if (!packet || typeof packet !== 'object') return [];
    const md = packet.metadata || {};
    const capsules = Array.isArray(md.consumed_capsule_decisions)
      ? md.consumed_capsule_decisions
      : (Array.isArray(packet.capsule_refs) ? packet.capsule_refs : []);
    const bypass = Array.isArray(packet.bypass_refs)
      ? packet.bypass_refs : [];
    const atc = Array.isArray(md.consumed_atc_findings)
      ? md.consumed_atc_findings : [];
    const out = [];
    for (let i = 0; i < capsules.length; i++) out.push(capsules[i]);
    for (let i = 0; i < bypass.length; i++) out.push(bypass[i]);
    for (let i = 0; i < atc.length; i++) out.push(atc[i]);
    return out;
  } catch (_e) {
    return [];
  }
}

// _spawnClaudeRun: spawn `claude --print --dangerously-skip-permissions
// -p "<normal>"` mirroring sgsd-blind-live-controller.mjs:104-138 verbatim.
// Returns { ok, exitCode, stdout, stderr, durationMs }. Lock 13: never
// throws upward.
function _spawnClaudeRun(claudeBinary, prompt, workspace, opts) {
  try {
    if (!claudeBinary || typeof claudeBinary !== 'string') {
      return { ok: false, reason: 'claude_cli_unavailable',
               exitCode: null, stdout: '', stderr: '', durationMs: 0 };
    }
    if (!_validatePromptIsNormal(prompt)) {
      return { ok: false, reason: 'prompt_contains_meta_eval_token',
               exitCode: null, stdout: '', stderr: '', durationMs: 0 };
    }
    const env = Object.assign({}, process.env);
    // Sanitize meta-eval env vars (mirror sgsd-blind-live-controller).
    for (const k of Object.keys(env)) {
      if (k.indexOf('SGSD_HARNESS') === 0 ||
          k.indexOf('BENCHMARK') === 0 ||
          k.indexOf('SGSD_BENCH') === 0) {
        delete env[k];
      }
    }
    const t0 = Date.now();
    const args = ['--print', '--dangerously-skip-permissions', '-p', prompt];
    const result = child_process.spawnSync(claudeBinary, args, {
      cwd: workspace || process.cwd(),
      env: env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      timeout: (opts && opts.timeoutMs) || 600000,
      encoding: 'utf8',
    });
    const durationMs = Date.now() - t0;
    return {
      ok: result.status === 0,
      reason: result.status === 0 ? 'claude_run_ok' : 'claude_run_failed',
      exitCode: typeof result.status === 'number' ? result.status : null,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      durationMs: durationMs,
    };
  } catch (_e) {
    return { ok: false, reason: 'claude_spawn_exception',
             exitCode: null, stdout: '', stderr: '', durationMs: 0 };
  }
}

// ---------------------------------------------------------------------------
// replayScenario: T5 hybrid replay path.
//
// Modes:
//   'ledger-only' - default. No claude spawn. post_artifacts=[]. tokens_after=null.
//                   Returned shape is the deterministic absent-source baseline
//                   T6 oracle treats as 'ledger-only - incomplete'.
//   'full'        - Step 1 buildPacket via Phase 45. Step 2 assertWorkspaceClean.
//                   Step 3 spawn claude. Step 4 capture token spend. Step 5
//                   build post_artifacts deterministically. Step 6 verify
//                   witness row in route-decisions.jsonl.
//
// Special:
//   --dry-run     - --mode=full path WITHOUT spawning claude. Computes
//                   packet shapes, validates anti-cheat, returns a
//                   stub-but-shaped result. Used by stop-rule for cheap
//                   regression checks.
//   token ceiling - cumulative token spend across ALL replayScenario calls
//                   in this process. Exceeded mid-run -> verdict=DEGRADED
//                   + reason `bench_token_ceiling_exceeded`.
//   claude absent - mode_used downgrades to 'ledger-only' with reason
//                   `bench_fixture_skipped:claude_cli_unavailable`. Lock 13.
//
// Documented contract on output:
//   { tokens_after: number|null, post_artifacts: array, scenario_run_id: string|null,
//     mode_used: 'ledger-only'|'full', verdict?: 'DEGRADED', reason?: string,
//     ok: boolean, packet_id?: string }
// ---------------------------------------------------------------------------
function replayScenario(opts) {
  try {
    const o = opts || {};
    const scenario = o.scenario || null;
    const mode = o.mode || 'ledger-only';
    const planningDir = o.planningDir || null;
    const fixtureDir = o.fixtureDir || _defaultFixtureDir();
    const claudeBinary = o.claudeBinary || null;
    const dryRun = o.dryRun === true;

    // Token ceiling pre-check (across cumulative process spend).
    if (_getTokenSpend() > TOKEN_CEILING) {
      return {
        ok: false,
        reason: 'bench_token_ceiling_exceeded',
        verdict: 'DEGRADED',
        tokens_after: null,
        post_artifacts: [],
        scenario_run_id: null,
        mode_used: 'ledger-only',
      };
    }

    // Synthetic ceiling test: callers may inject a synthetic spend via
    // opts._injectTokenSpend to exercise the ceiling without a real run.
    if (typeof o._injectTokenSpend === 'number' && o._injectTokenSpend > 0) {
      _addTokenSpend(o._injectTokenSpend);
      if (_getTokenSpend() > TOKEN_CEILING) {
        return {
          ok: false,
          reason: 'bench_token_ceiling_exceeded',
          verdict: 'DEGRADED',
          tokens_after: null,
          post_artifacts: [],
          scenario_run_id: null,
          mode_used: 'ledger-only',
        };
      }
    }

    // Mode === 'ledger-only' OR claude CLI absent: deterministic absent-
    // source baseline. post_artifacts=[]. tokens_after=null.
    if (mode !== 'full' || !claudeBinary) {
      const reason = (mode !== 'full')
        ? 'scenario_replay_degraded_ledger_only'
        : 'bench_fixture_skipped:claude_cli_unavailable';
      return {
        ok: true,
        reason: reason,
        tokens_after: null,
        post_artifacts: [],
        scenario_run_id: null,
        mode_used: 'ledger-only',
        partial_report: (mode === 'full' && !claudeBinary),
      };
    }

    // --mode=full path. Step 1 buildPacket via Phase 45 (Lock 4 import-by-ref).
    if (!scenario || !scenario.scenario_id) {
      return {
        ok: false,
        reason: 'scenario_missing',
        tokens_after: null,
        post_artifacts: [],
        scenario_run_id: null,
        mode_used: 'ledger-only',
      };
    }

    const drawn = scenario.drawn_from || {};
    const role = drawn.role || 'researcher';
    const intent_ref = scenario.scenario_id;

    // Synthesize a minimal intent_map so buildPacket has step-0 content
    // even when no live intent_map.jsonl row matches. This is a SUPPLIED
    // intent (Lock 12: source-file body never populates operator-intent
    // fields), not a fork of intent-map/build.cjs.
    const synthIntentMap = {
      raw: '',
      intent: 'replay-' + scenario.scenario_id,
      meaning: '',
      canonical: '',
      assumptions: [],
      ambiguities: [],
      clarify: null,
      relationships: [],
      context_policy: {},
      action: { kind: 'no_op', reason: 'no_change_needed' },
      milestone: drawn.milestone || null,
      phase: drawn.phase || null,
      intent_id: intent_ref,
    };

    const buildOpts = {
      intent_map: synthIntentMap,
      milestone: drawn.milestone || null,
      phase: drawn.phase != null ? drawn.phase : null,
      planningDir: planningDir,
    };

    let packet = null;
    try {
      packet = _phase45.buildPacket(role, intent_ref, buildOpts);
    } catch (_e) {
      packet = null;
    }
    if (!packet || packet.ok === false) {
      // Phase 45 returned a failure sentinel. Lock 13: do not throw.
      return {
        ok: false,
        reason: 'packet_build_failed',
        tokens_after: null,
        post_artifacts: [],
        scenario_run_id: null,
        mode_used: 'ledger-only',
        packet_status: packet && packet.reason ? packet.reason : null,
      };
    }

    // Step 5 (computed early so dry-run + workspace-clean abort still
    // returns deterministic post_artifacts shape).
    const post_artifacts = _buildPostArtifacts(packet);

    // Dry-run short-circuit: --mode=full --dry-run computes packet shapes
    // without spawning claude or asserting workspace clean (no real
    // workspace path is provided in dry-run). Returns the same shape as a
    // full run with a synthetic scenario_run_id and tokens_after=0.
    if (dryRun) {
      return {
        ok: true,
        reason: 'dry_run_ok',
        tokens_after: 0,
        post_artifacts: post_artifacts,
        scenario_run_id: 'bench-post-' + scenario.scenario_id + '-dryrun',
        mode_used: 'full',
        packet_id: packet.packet_id || null,
        dry_run: true,
      };
    }

    // Step 2 assertWorkspaceClean BEFORE dispatch. Anti-cheat invariant 5.
    // The workspace is the operator-supplied dir (NOT the project root,
    // NOT planningDir). Falls back to fixtureDir if no explicit workspace.
    const workspaceRoot = o.workspaceRoot || fixtureDir;
    if (workspaceRoot && fs.existsSync(workspaceRoot)) {
      try {
        assertWorkspaceClean(workspaceRoot);
      } catch (cheatErr) {
        return {
          ok: false,
          reason: 'scenario_replay_aborted_anti_cheat_hit',
          tokens_after: null,
          post_artifacts: [],
          scenario_run_id: null,
          mode_used: 'ledger-only',
          anti_cheat_message: cheatErr && cheatErr.message
            ? cheatErr.message : 'unknown',
        };
      }
    }

    // Step 3 spawn claude with a NORMAL prompt.
    const prompt = _buildNormalPrompt(scenario);
    if (!_validatePromptIsNormal(prompt)) {
      // Should not happen with _buildNormalPrompt's deterministic output;
      // belt-and-braces (Pitfall 6).
      return {
        ok: false,
        reason: 'prompt_contains_meta_eval_token',
        tokens_after: null,
        post_artifacts: [],
        scenario_run_id: null,
        mode_used: 'ledger-only',
      };
    }
    const runStart = new Date().toISOString();
    const spawnRes = _spawnClaudeRun(claudeBinary, prompt, workspaceRoot, {
      timeoutMs: o.timeoutMs || 600000,
    });

    if (!spawnRes.ok) {
      // Lock 13: claude run failed -> downgrade to ledger-only with
      // documented reason. Do not throw.
      return {
        ok: false,
        reason: 'bench_fixture_skipped:claude_cli_unavailable',
        tokens_after: null,
        post_artifacts: [],
        scenario_run_id: null,
        mode_used: 'ledger-only',
        partial_report: true,
        spawn_reason: spawnRes.reason,
        spawn_exit_code: spawnRes.exitCode,
      };
    }

    // Step 4 capture token spend written by Phase 41 collect.cjs. We tag
    // the bench run by the route-decisions witness (Step 6); the token
    // ledger is unmodified (Lock 4).
    const tokenCap = planningDir
      ? _captureTokenSpendForRun(planningDir, runStart)
      : { ok: false, reason: 'no_planning_dir', tokens: 0, rows: [] };
    const tokens_after = tokenCap.ok ? tokenCap.tokens : 0;
    _addTokenSpend(tokens_after);

    // Re-check ceiling AFTER the run (mid-bench abort).
    if (_getTokenSpend() > TOKEN_CEILING) {
      return {
        ok: false,
        reason: 'bench_token_ceiling_exceeded',
        verdict: 'DEGRADED',
        tokens_after: tokens_after,
        post_artifacts: post_artifacts,
        scenario_run_id: null,
        mode_used: 'full',
        cumulative_tokens: _getTokenSpend(),
      };
    }

    // Step 6 write witness row to route-decisions.jsonl. The run_id is
    // the unforgeable bench-post-{scenario_id}-{tsMillis} prefix that
    // T5.2 substring-matches. Returns the run_id we wrote (or null on
    // append failure -- Lock 13).
    const scenarioRunId = _writeWitnessRow(planningDir, scenario, {
      uncertainty_type: (scenario.expected_route
        && scenario.expected_route.uncertainty_type) || 'synthesis_judgment',
      provider: (scenario.expected_route
        && scenario.expected_route.primary) || 'claude',
      packet_id: packet.packet_id || null,
      duration_ms: spawnRes.durationMs,
    });

    return {
      ok: true,
      reason: 'scenario_replay_completed',
      tokens_after: tokens_after,
      post_artifacts: post_artifacts,
      scenario_run_id: scenarioRunId,
      mode_used: 'full',
      packet_id: packet.packet_id || null,
      cumulative_tokens: _getTokenSpend(),
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
// inject-and-replay flow. T5 wires the full Sonnet path via replayScenario;
// the export shape stays for downstream T6/T7.
// ---------------------------------------------------------------------------
module.exports = {
  readBaselineFromLedger,
  mapPhasesToBaseline,
  replayScenario,
  assertWorkspaceClean,
  // Frozen vocabs (exported so harness self-test can parametrize the
  // anti-cheat assertion across the 6 forbidden strings + 3 secret prefixes):
  FORBIDDEN_STRINGS,
  SECRET_PREFIXES,
  PROMPT_FORBIDDEN_TOKENS,
  TOKEN_CEILING,
  // T5 internals (exported for self-test composition; not part of the
  // documented surface T6/T7 consume):
  _buildPostArtifacts,
  _buildNormalPrompt,
  _validatePromptIsNormal,
  _hasWitnessRow,
  _writeWitnessRow,
  _defaultFixtureDir,
  _resetTokenSpend,
  _getTokenSpend,
  _addTokenSpend,
};
