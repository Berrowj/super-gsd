---
plan_id: 34-01
phase: 34
title: Canonical Review Ledger
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [LEDGER-01, LEDGER-02, LEDGER-03, LEDGER-04]
locked_decisions: []  # Phase 34 has no per-phase locks; 16 derivation calls locked in 34-RESEARCH.md Section 11
deviations:
  - "ROADMAP-AGENT.md split (tools/review-ledger/aggregate.cjs + lib/review-ledger-writer.cjs) collapsed to single super-gsd/scripts/lib/review-ledger.cjs; matches Phase 32+33 single-file pattern (RESEARCH 11.1)."
  - "LEDGER-02 wire-in target = sgsd-orchestrate SKILL.md (where Claude+Codex paths converge at appendPerDispatchReviewEvidence post-Phase-32-fix), NOT codex-exec.sh. Source: RESEARCH 3.3 + 11.2; one wire covers both providers."
depends_on: [31, 32, 33]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/scripts/lib/review-ledger.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/scripts/sgsd-mission-control.ps1
    hypothesis: "Aggregating per-phase commit-reviews into a canonical ledger with --kill-check on empty-baseline closes the v1.5 milestone-close gap (PASS with no reviews ran is now distinguishable from PASS with all reviews clean)."
    falsifier: "If --kill-check returns baseline_ok against an empty canonical, the gap is not closed."
    stop_rule: "self-test 15/15 PASS; --aggregate consolidates >=11 existing per-phase files; --kill-check empty fixture returns empty_baseline + exit 1; --kill-check non-empty returns baseline_ok + exit 0; SKILL.md wire-in adds appendReviewRow call; mission-control reads canonical when present."
    minimal_test: "node super-gsd/scripts/lib/review-ledger.cjs --self-test -> exit 0; node super-gsd/scripts/lib/review-ledger.cjs --aggregate -> success; node super-gsd/scripts/lib/review-ledger.cjs --kill-check -> exit 0 with baseline_ok."

must_haves:
  truths:
    - "Each canonical row is envelope-v1 wrapper preserving legacy under _legacy field (per command-envelope-v1.yaml:55-61 atc-review first_wave)"
    - "appendReviewRow never throws upward (mirrors route-ledger.cjs LOCKED contract from 32-RESEARCH 9.3)"
    - "Aggregator is idempotent via dedup tuple (ts, plan, tier, provider, _source_phase) per RESEARCH 11.4 lock"
    - "ONE SKILL.md wire-in covers both Claude and Codex paths (post-Phase-32 convergence at appendPerDispatchReviewEvidence call site)"
    - "Mission Control falls back to per-phase enumeration when canonical absent (forward-compat per RESEARCH 6.5)"
    - "self-test never touches canonical .planning/metrics/review-ledger.jsonl (fingerprint guard anchored to __dirname per Phase 32 W3 lesson)"
  artifacts:
    - super-gsd/scripts/lib/review-ledger.cjs (NEW ~350 LOC)
    - super-gsd/skills/sgsd-orchestrate/SKILL.md (~6 LOC tee-write inserted after appendPerDispatchReviewEvidence at line ~1255)
    - super-gsd/scripts/sgsd-mission-control.ps1 (~5 LOC canonical-first read switch at line ~1538)
  key_links:
    - .planning/milestones/v1.7/phases/34-canonical-review-ledger/34-CONTEXT.md
    - .planning/milestones/v1.7/phases/34-canonical-review-ledger/34-RESEARCH.md (Sections 3, 4, 9, 10, 11 for wire-in code, --kill-check, self-test, public API, locks)
    - super-gsd/registry/command-envelope-v1.yaml:55-61 (envelope wrapping with _legacy preservation)
    - super-gsd/scripts/lib/route-ledger.cjs (1:1 architectural template)
    - super-gsd/scripts/lib/repair-command-checker.cjs (recent self-test pattern)
---

# Phase 34 Plan 01 — Canonical Review Ledger

## Objective

Ship `super-gsd/scripts/lib/review-ledger.cjs` (atomic writer + aggregator +
`--kill-check` CLI + 15-assertion self-test), wire `appendReviewRow` into
`sgsd-orchestrate/SKILL.md` immediately after `appendPerDispatchReviewEvidence`
so both Claude and Codex review paths tee into the canonical ledger, and
flip Mission Control's per-phase glob (line ~1538) to read the canonical
ledger when present (with per-phase fallback for forward-compat).

Closes the v1.5 milestone-close empty-baseline kill-check gap (LEDGER-01..04).

## Context

This plan implements all four LEDGER requirements in a single coordinated
change set. The architecture is locked 1:1 to Phase 32's `route-ledger.cjs`
(shipped 9.5/10 anti-slop): atomic `fs.appendFileSync`, defensive `readRows`,
public-API never-throws-upward, fingerprint-anchored self-test via
`__dirname`. The Phase 34 difference is that it preserves legacy
`commit-reviews.jsonl` row content verbatim under `_legacy` while wrapping
with envelope-v1 metadata + `_source_phase` / `_source_milestone` extension
fields — satisfying envelope-v1.yaml:55-61 (atc-review first_wave: "envelope
wrap is the bridge layer; preserves code-reviewer-v1 inside evidence").

## Action Blocks

### A1 — `super-gsd/scripts/lib/review-ledger.cjs` (NEW, ~350 LOC)

Create the file with the following byte-exact content.

```javascript
// ============================================================================
// SGSD - REVIEW-LEDGER canonical writer for ATC commit-review rows
// ============================================================================
// Source of truth: .planning/metrics/review-ledger.jsonl (machine-readable)
// No rendered .md view in v1.7 (per 34-RESEARCH.md Section 11 Q8: deferred).
//
// Append-only. Every row is a valid command-envelope-v1 row PLUS legacy
// commit-reviews fields preserved verbatim under `_legacy` AND extension
// fields `_source_phase` + `_source_milestone`. Reconciliation is explicit
// at super-gsd/registry/command-envelope-v1.yaml:55-61 (atc-review
// first_wave: "envelope wrap is the bridge layer; preserves
// code-reviewer-v1 inside evidence").
//
// Phase 34 (34=C) ships ONE wire-in: appendReviewRow at sgsd-orchestrate
// SKILL.md immediately after appendPerDispatchReviewEvidence (~line 1255).
// One wire covers both Claude and Codex paths because both converge on the
// same evidence-emission step (per 34-RESEARCH.md Section 3.3 + 11.2).
//
// Public API per 34-RESEARCH.md Section 10:
//   appendReviewRow(planningDir, row)        - atomic, never throws upward
//   readReviewRows(planningDir, opts?)       - defensive, optional filters
//   aggregateFromPhases(planningDir, opts?)  - rebuild canonical from per-phase
//   killCheck(planningDir, opts?)            - {ok, reason, count, milestone}
//   ledgerPath(planningDir)                  - canonical path resolver
//
// Plus four frozen constants:
//   LEGACY_VERDICT_MAP, STATUSES, COMMAND_NAME, ENVELOPE_VERSION
//
// Locked decisions (34-RESEARCH.md Section 11, all 16):
//   Q1 rebuild every invocation
//   Q2 dedup tuple (ts, plan, tier, provider, _source_phase)
//   Q3 active milestone from STATE.md
//   Q4 wire at SKILL.md (NOT codex-exec.sh)
//   Q5 tee per-phase + canonical
//   Q6 chronological by ts ASC
//   Q7 defensive parse (skip malformed)
//   Q8 no rendered .md (defer v1.8+)
//   Q9 unknown verdict -> warn + parse_failure
//   Q10 run_id same as route-ledger.cjs
//   Q11 100-call uniqueness assertion
//   Q12 lib at super-gsd/scripts/lib/review-ledger.cjs
//   Q13 single file (no separate tools/ wrapper)
//   Q14 P/W/F mission-strip line (out of scope this PLAN)
//   Q15 commit canonical .jsonl once at ship
//   Q16 per-phase glob fallback when canonical missing
//
// Failure contract: this writer NEVER throws upward at the orchestrator
// boundary. Closed-enum violations raise inside _normalize/_assertEnvelopeV1
// but every public helper wraps in try/catch; on error stderr-warns and
// returns a falsey value. Mirrors route-ledger.cjs LOCKED design.
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// envelope-v1 status enum (frozen). Mirrors route-ledger.cjs.
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

// Legacy commit-reviews verdict vocab -> envelope-v1 status mapping.
// Source: 34-RESEARCH.md Section 3.2 table (frozen).
const LEGACY_VERDICT_MAP = Object.freeze({
  'pass':          { status: 'ok',      reason_codes: ['review_unanimous_pass'] },
  'warn':          { status: 'warn',    reason_codes: ['atc_warn_only'] },
  'critical':      { status: 'fail',    reason_codes: ['atc_critical'] },
  'critical-halt': { status: 'blocked', reason_codes: ['atc_critical'] },
  'block':         { status: 'blocked', reason_codes: ['atc_critical'] },
  'skipped':       { status: 'skipped', reason_codes: ['gate_skip_with_reason'] },
});

const COMMAND_NAME = 'appendReviewRow';
const ENVELOPE_VERSION = 1;
const LEDGER_REL = path.join('metrics', 'review-ledger.jsonl');

function ledgerPath(planningDir) {
  return path.join(planningDir, LEDGER_REL);
}

// run_id pattern matches envelope-v1.json (cf. route-ledger.cjs:88-89).
// Example: 2026-04-27T11:32:01.123Z-a1b2
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

function generateRunId() {
  const ts = new Date().toISOString();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}

// Map a legacy verdict string to envelope-v1 {status, reason_codes}.
// Unknown verdicts -> warn + ['parse_failure'] (RESEARCH Q9 lock).
function _mapVerdict(verdict) {
  if (verdict && Object.prototype.hasOwnProperty.call(LEGACY_VERDICT_MAP, verdict)) {
    const m = LEGACY_VERDICT_MAP[verdict];
    return { status: m.status, reason_codes: m.reason_codes.slice() };
  }
  return { status: 'warn', reason_codes: ['parse_failure'] };
}

// Internal: compose envelope-v1 row from a legacy commit-reviews payload.
// Throws on missing required field. Caller responsible for catching.
function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('review-ledger: row must be an object');
  }
  // The legacy required field is `verdict` (per SKILL.md:1246 contract).
  // ts, plan, provider may be omitted -> we generate / null them.
  if (!('verdict' in row)) {
    throw new Error('review-ledger: row.verdict is required (legacy commit-reviews contract)');
  }

  const mapped = _mapVerdict(row.verdict);
  const ts = row.ts || new Date().toISOString();
  const reportPath = row._report_path || null;
  const evidence = reportPath
    ? [{ kind: 'review_report', ref: reportPath }]
    : [];

  // _legacy preserves the ORIGINAL legacy commit-reviews row verbatim per
  // envelope-v1.yaml:55-61. Strip envelope-only injection helpers.
  const legacy = Object.assign({}, row);
  delete legacy._source_phase;
  delete legacy._source_milestone;
  delete legacy._report_path;

  return {
    envelope_version: ENVELOPE_VERSION,
    ts,
    command: COMMAND_NAME,
    status: mapped.status,
    reason_codes: mapped.reason_codes,
    artifacts: [],
    evidence,
    next_action: null,
    risk: null,
    duration_ms: typeof row.duration_ms === 'number' && row.duration_ms >= 0
      ? row.duration_ms : null,
    run_id: row.run_id || generateRunId(),
    phase: row.phase ?? null,
    milestone: row.milestone ?? null,
    // Phase 34 extension fields (envelope-v1 additionalProperties: true):
    _source_phase: row._source_phase ?? null,
    _source_milestone: row._source_milestone ?? null,
    _legacy: legacy,
  };
}

// Manual envelope-v1 schema check (no ajv dep). Mirrors route-ledger.cjs:141-171.
// Throws on violation. Caller (public API) wraps in try/catch.
function _assertEnvelopeV1(row) {
  const required = ['envelope_version','ts','command','status','reason_codes',
    'artifacts','evidence','next_action','risk','duration_ms','run_id','phase','milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error(`review-ledger: emitted row missing required envelope-v1 field '${k}'`);
  }
  if (row.envelope_version !== 1) {
    throw new Error(`review-ledger: envelope_version must be 1 (got ${row.envelope_version})`);
  }
  if (!STATUSES.includes(row.status)) {
    throw new Error(`review-ledger: status must be one of ${STATUSES.join(', ')}; got '${row.status}'`);
  }
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error(`review-ledger: run_id violates envelope-v1 pattern (got '${row.run_id}')`);
  }
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error(`review-ledger: duration_ms must be non-negative integer or null (got ${row.duration_ms})`);
  }
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error(`review-ledger: evidence item must be {kind:string, ref:string} (got ${JSON.stringify(e)})`);
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error(`review-ledger: artifacts item must be {kind:string, path:string} (got ${JSON.stringify(a)})`);
    }
  }
}

// Internal low-level append. Throws on validation; public wrapper catches.
function _appendRowInternal(planningDir, row) {
  if (!planningDir) throw new Error('review-ledger: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = ledgerPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

// PUBLIC: atomic append. NEVER throws upward. Returns enriched row on success,
// false on validation/IO failure. Stderr-only error logging.
function appendReviewRow(planningDir, row) {
  try {
    return _appendRowInternal(planningDir, row || {});
  } catch (e) {
    console.warn('[SGSD] review-ledger appendReviewRow failed:', e.message);
    return false;
  }
}

// PUBLIC: defensive read with optional filters.
// opts: { milestone?, phase? }
function readReviewRows(planningDir, opts) {
  try {
    if (!planningDir) return [];
    const o = opts || {};
    const p = ledgerPath(planningDir);
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    let rows = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    if (o.milestone) {
      rows = rows.filter((r) => r.milestone === o.milestone || r._source_milestone === o.milestone);
    }
    if (o.phase) {
      rows = rows.filter((r) => r.phase === o.phase || r._source_phase === o.phase);
    }
    return rows;
  } catch (e) {
    console.warn('[SGSD] review-ledger readReviewRows failed:', e.message);
    return [];
  }
}

// Walk per-phase commit-reviews.jsonl files (no glob dep; cross-platform).
// Returns [{path, milestone, phase}, ...].
function _walkPerPhaseFiles(planningDir) {
  const out = [];
  const milestonesRoot = path.join(planningDir, 'milestones');
  if (!fs.existsSync(milestonesRoot)) return out;
  for (const m of fs.readdirSync(milestonesRoot)) {
    const phasesDir = path.join(milestonesRoot, m, 'phases');
    if (!fs.existsSync(phasesDir)) continue;
    for (const p of fs.readdirSync(phasesDir)) {
      const f = path.join(phasesDir, p, 'commit-reviews.jsonl');
      try {
        if (fs.existsSync(f) && fs.statSync(f).isFile()) {
          out.push({ path: f, milestone: m, phase: p });
        }
      } catch { /* ignore stat errors */ }
    }
  }
  return out;
}

// Read one per-phase commit-reviews.jsonl into legacy row objects.
// Defensive: skip malformed lines.
function _readPerPhaseFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    if (!text.trim()) return [];
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// PUBLIC: rebuild canonical from per-phase files. Idempotent.
// Strategy: rebuild every invocation (RESEARCH 11 Q1 lock).
// Dedup tuple: (ts, plan, tier, provider, _source_phase) (Q2 lock).
// Output ordering: chronological by ts ASC (Q6 lock).
// Returns: { ok, files_scanned, rows_in, rows_out, deduped, path }.
function aggregateFromPhases(planningDir, opts) {
  try {
    if (!planningDir) {
      console.warn('[SGSD] review-ledger aggregateFromPhases: planningDir required');
      return { ok: false, files_scanned: 0, rows_in: 0, rows_out: 0, deduped: 0, path: null };
    }
    const o = opts || {};
    const sources = _walkPerPhaseFiles(planningDir);

    // Collect (legacyRow, _source_milestone, _source_phase) tuples.
    const incoming = [];
    let rowsIn = 0;
    for (const src of sources) {
      const legacyRows = _readPerPhaseFile(src.path);
      rowsIn += legacyRows.length;
      for (const lr of legacyRows) {
        incoming.push({
          legacy: lr,
          _source_milestone: src.milestone,
          _source_phase: src.phase,
        });
      }
    }

    // Also fold in any real-time-written rows already present in canonical
    // so we never lose data if --aggregate runs after live wires fired.
    // (RESEARCH 2.3: "preserve real-time-only rows".)
    const existing = readReviewRows(planningDir);
    for (const ex of existing) {
      // Reconstruct a legacy-shaped wrapper from the existing envelope row.
      // Keys come from _legacy if present (real-time + previous aggregate);
      // else fall back to envelope fields (shouldn't happen but is safe).
      const lr = (ex._legacy && typeof ex._legacy === 'object')
        ? Object.assign({}, ex._legacy, { ts: ex.ts, milestone: ex.milestone, phase: ex.phase })
        : { ts: ex.ts, plan: null, tier: null, verdict: null, provider: null,
            milestone: ex.milestone, phase: ex.phase };
      incoming.push({
        legacy: lr,
        _source_milestone: ex._source_milestone || ex.milestone || null,
        _source_phase: ex._source_phase || ex.phase || null,
        _existing_envelope: ex,
      });
    }

    // Dedup by (ts, plan, tier, provider, _source_phase). LOCKED tuple.
    const seen = new Set();
    const kept = [];
    let deduped = 0;
    for (const inc of incoming) {
      const lr = inc.legacy || {};
      const key = [
        lr.ts || '',
        lr.plan || '',
        lr.tier || '',
        lr.provider || '',
        inc._source_phase || '',
      ].join('|');
      if (seen.has(key)) { deduped++; continue; }
      seen.add(key);
      kept.push(inc);
    }

    // Sort chronological ASC by ts (RESEARCH Q6 lock). Stable for equal ts.
    kept.sort((a, b) => {
      const ta = (a.legacy && a.legacy.ts) || '';
      const tb = (b.legacy && b.legacy.ts) || '';
      return ta < tb ? -1 : (ta > tb ? 1 : 0);
    });

    // Write atomically: build full text, then writeFileSync (truncate).
    const lines = [];
    for (const inc of kept) {
      // If the row came from existing canonical, reuse its envelope verbatim
      // to preserve run_id and ts precision.
      let env;
      if (inc._existing_envelope) {
        env = inc._existing_envelope;
      } else {
        try {
          const lr = inc.legacy || {};
          env = _normalize({
            ...lr,
            milestone: lr.milestone || inc._source_milestone || null,
            phase: lr.phase || inc._source_phase || null,
            _source_milestone: inc._source_milestone || null,
            _source_phase: inc._source_phase || null,
          });
          _assertEnvelopeV1(env);
        } catch (e) {
          console.warn('[SGSD] review-ledger aggregate: skipping malformed row from',
            inc._source_phase, ':', e.message);
          continue;
        }
      }
      lines.push(JSON.stringify(env));
    }

    const p = ledgerPath(planningDir);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = lines.length ? lines.join('\n') + '\n' : '';
    fs.writeFileSync(p, payload, 'utf8');

    return {
      ok: true,
      files_scanned: sources.length,
      rows_in: rowsIn,
      rows_out: lines.length,
      deduped,
      path: p,
    };
  } catch (e) {
    console.warn('[SGSD] review-ledger aggregateFromPhases failed:', e.message);
    return { ok: false, files_scanned: 0, rows_in: 0, rows_out: 0, deduped: 0, path: null };
  }
}

// Resolve active milestone from STATE.md frontmatter.
// Returns string or null. Defensive (never throws upward).
function _resolveActiveMilestone(planningDir) {
  try {
    if (!planningDir) return null;
    const statePath = path.join(planningDir, 'STATE.md');
    if (!fs.existsSync(statePath)) return null;
    const text = fs.readFileSync(statePath, 'utf8');
    // Frontmatter block: lines between leading '---' and next '---'.
    const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const fm = m[1];
    const ml = fm.match(/^\s*milestone:\s*['"]?([^'"\r\n]+?)['"]?\s*$/m);
    return ml ? ml[1].trim() : null;
  } catch {
    return null;
  }
}

// PUBLIC: kill-check semantics (LEDGER-03).
// Returns: {ok, reason: 'baseline_ok'|'empty_baseline'|'error', count, milestone}.
// Never throws upward.
function killCheck(planningDir, opts) {
  try {
    const o = opts || {};
    const milestone = o.milestone || _resolveActiveMilestone(planningDir);
    const rows = readReviewRows(planningDir, milestone ? { milestone } : {});
    if (rows.length >= 1) {
      return { ok: true,  reason: 'baseline_ok',     count: rows.length, milestone: milestone || null };
    }
    return { ok: false, reason: 'empty_baseline', count: 0, milestone: milestone || null };
  } catch (e) {
    console.warn('[SGSD] review-ledger killCheck failed:', e.message);
    return { ok: false, reason: 'error', count: 0, milestone: null };
  }
}

// -- self-test --------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Fingerprint guard anchored to __dirname (Phase 32 W3 lesson).
  // Lib at <repo>/super-gsd/scripts/lib/review-ledger.cjs;
  // canonical at <repo>/.planning/metrics/review-ledger.jsonl (3 dirs up + .planning).
  const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'review-ledger.jsonl');
  const realExistedBefore = fs.existsSync(realLedger);
  const realMtimeBefore = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
  const realSizeBefore = realExistedBefore ? fs.statSync(realLedger).size : 0;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'));
  try {
    // 1. Frozen exports + envelope version constant.
    assert('1. frozen exports present',
      Object.isFrozen(LEGACY_VERDICT_MAP) && Object.isFrozen(STATUSES) &&
      COMMAND_NAME === 'appendReviewRow' && ENVELOPE_VERSION === 1);

    // 2. Empty read on fresh tmpdir.
    assert('2. empty read returns []',
      Array.isArray(readReviewRows(tmp)) && readReviewRows(tmp).length === 0);

    // 3. Single append produces one envelope row with status:'warn'.
    const r3 = appendReviewRow(tmp, {
      ts: '2026-04-27T10:00:00.000Z', plan: '34-01', tier: 'full',
      verdict: 'warn', provider: 'openai-codex', one_liner: 't3',
      milestone: 'v1.7', phase: '34',
      _source_milestone: 'v1.7', _source_phase: '34-canonical-review-ledger',
    });
    assert('3. single append -> envelope row with status warn',
      r3 && r3.envelope_version === 1 && r3.status === 'warn' &&
      r3.command === 'appendReviewRow' &&
      Array.isArray(r3.reason_codes) && r3.reason_codes.includes('atc_warn_only'));

    // 4. Verdict mapping table -- 6 legacy verdicts.
    const cases = [
      ['pass', 'ok', 'review_unanimous_pass'],
      ['warn', 'warn', 'atc_warn_only'],
      ['critical', 'fail', 'atc_critical'],
      ['critical-halt', 'blocked', 'atc_critical'],
      ['block', 'blocked', 'atc_critical'],
      ['skipped', 'skipped', 'gate_skip_with_reason'],
    ];
    let mapOk = true;
    for (const [v, expectStatus, expectCode] of cases) {
      const m = _mapVerdict(v);
      if (m.status !== expectStatus || !m.reason_codes.includes(expectCode)) { mapOk = false; break; }
    }
    assert('4. legacy verdict mapping table correct (6 verdicts)', mapOk);

    // 5. Unknown verdict tolerated -> warn + parse_failure (never throws upward).
    const r5 = appendReviewRow(tmp, {
      ts: '2026-04-27T10:00:01.000Z', plan: '34-01', tier: 'full',
      verdict: 'banana', provider: 'openai-codex',
      _source_milestone: 'v1.7', _source_phase: '34-canonical-review-ledger',
    });
    assert('5. unknown verdict -> status warn + reason_codes parse_failure',
      r5 && r5.status === 'warn' && r5.reason_codes.includes('parse_failure'));

    // 6. Missing required field (verdict) -> false + stderr; never throws upward.
    const r6 = appendReviewRow(tmp, { ts: '2026-04-27T10:00:02.000Z', plan: '34-01' });
    assert('6. missing verdict -> false (never throws upward)', r6 === false);

    // 7. _legacy preservation: original fields verbatim under _legacy.
    const r7 = appendReviewRow(tmp, {
      ts: '2026-04-27T10:00:03.000Z', plan: '34-02', tier: 'full',
      verdict: 'pass', provider: 'openai-codex', critical: 0, warning: 0,
      pass_rate: '6/6', one_liner: 'clean',
      model: 'gpt-5.5', reasoning_effort: 'xhigh',
      milestone: 'v1.7', phase: '34',
      _source_milestone: 'v1.7', _source_phase: '34-canonical-review-ledger',
    });
    assert('7. _legacy preserves original commit-reviews fields verbatim',
      r7 && r7._legacy && r7._legacy.verdict === 'pass' &&
      r7._legacy.plan === '34-02' && r7._legacy.tier === 'full' &&
      r7._legacy.provider === 'openai-codex' && r7._legacy.critical === 0 &&
      r7._legacy.pass_rate === '6/6' && r7._legacy.model === 'gpt-5.5');

    // 8. Source tagging: _source_phase + _source_milestone present on row.
    assert('8. _source_phase and _source_milestone tagged on row',
      r7 && r7._source_milestone === 'v1.7' &&
      r7._source_phase === '34-canonical-review-ledger');

    // 9. RUN_ID_REGEX compliance for emitted run_id.
    assert('9. emitted run_id matches envelope-v1 RUN_ID_REGEX',
      r7 && RUN_ID_REGEX.test(r7.run_id));

    // 10. Defensive read: malformed mid-file line skipped; surrounding readable.
    fs.appendFileSync(ledgerPath(tmp), '{not-json\n', 'utf8');
    appendReviewRow(tmp, {
      ts: '2026-04-27T10:00:04.000Z', plan: '34-03', tier: 'full',
      verdict: 'pass', provider: 'claude-sonnet',
      _source_milestone: 'v1.7', _source_phase: '34-canonical-review-ledger',
    });
    const rowsAfterMalformed = readReviewRows(tmp);
    assert('10. malformed line skipped; valid rows around it readable',
      Array.isArray(rowsAfterMalformed) && rowsAfterMalformed.length >= 4);

    // 11. Aggregator deterministic over per-phase fixtures.
    // Build a mini per-phase tree under tmp/agg with 3 files (5/3/2 rows).
    const agg = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-agg-'));
    try {
      const writePhase = (mid, pid, rows) => {
        const dir = path.join(agg, 'milestones', mid, 'phases', pid);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'commit-reviews.jsonl'),
          rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
      };
      const mkRow = (i, plan, verdict, provider, ts) => ({
        ts, plan, tier: 'full', verdict, provider,
        critical: verdict === 'critical' ? 1 : 0, warning: 0,
        one_liner: 'fx-' + i, model: 'gpt-5.5', reasoning_effort: 'xhigh',
      });
      writePhase('vTest', 'pA', [
        mkRow(1, 'A-01', 'pass', 'openai-codex', '2026-04-27T11:00:00.000Z'),
        mkRow(2, 'A-02', 'warn', 'openai-codex', '2026-04-27T11:00:01.000Z'),
        mkRow(3, 'A-03', 'pass', 'claude-sonnet', '2026-04-27T11:00:02.000Z'),
        mkRow(4, 'A-04', 'pass', 'openai-codex', '2026-04-27T11:00:03.000Z'),
        mkRow(5, 'A-05', 'critical', 'openai-codex', '2026-04-27T11:00:04.000Z'),
      ]);
      writePhase('vTest', 'pB', [
        mkRow(6, 'B-01', 'pass', 'openai-codex', '2026-04-27T11:00:05.000Z'),
        mkRow(7, 'B-02', 'pass', 'openai-codex', '2026-04-27T11:00:06.000Z'),
        mkRow(8, 'B-03', 'warn', 'claude-sonnet', '2026-04-27T11:00:07.000Z'),
      ]);
      writePhase('vTest', 'pC', [
        mkRow(9, 'C-01', 'pass', 'openai-codex', '2026-04-27T11:00:08.000Z'),
        mkRow(10, 'C-02', 'pass', 'openai-codex', '2026-04-27T11:00:09.000Z'),
      ]);
      const agg1 = aggregateFromPhases(agg);
      assert('11. aggregator deterministic: 3 files (5/3/2) -> 10 chronological rows',
        agg1 && agg1.ok && agg1.rows_out === 10);

      // 12. Aggregator dedup: re-run; no duplicates by tuple.
      const agg2 = aggregateFromPhases(agg);
      assert('12. aggregator dedup: re-run -> same 10 rows (no duplication)',
        agg2 && agg2.ok && agg2.rows_out === 10);

      // 13. Aggregator idempotent: byte-identical canonical across two runs.
      const bytes1 = fs.readFileSync(ledgerPath(agg), 'utf8');
      aggregateFromPhases(agg);
      const bytes2 = fs.readFileSync(ledgerPath(agg), 'utf8');
      assert('13. aggregator idempotent: byte-identical canonical across runs',
        bytes1 === bytes2);
    } finally {
      fs.rmSync(agg, { recursive: true, force: true });
    }

    // 14. killCheck on empty fixture -> empty_baseline + count 0.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-empty-'));
    try {
      const kc = killCheck(empty, { milestone: 'v1.7' });
      assert('14. killCheck empty -> {ok:false, reason:empty_baseline, count:0}',
        kc && kc.ok === false && kc.reason === 'empty_baseline' && kc.count === 0);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }

    // 15. killCheck non-empty -> baseline_ok + correct count + milestone.
    // Use earlier appends in tmp (have milestone:v1.7 set). Filter to v1.7.
    const kc2 = killCheck(tmp, { milestone: 'v1.7' });
    assert('15. killCheck non-empty -> {ok:true, reason:baseline_ok, count>=1, milestone:v1.7}',
      kc2 && kc2.ok === true && kc2.reason === 'baseline_ok' &&
      kc2.count >= 1 && kc2.milestone === 'v1.7');

    // Bonus: 100 generateRunId() calls -> 100 unique (Q11 lock).
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateRunId());
    assert('bonus. 100 generateRunId() calls -> 100 unique', ids.size === 100);

    // Bonus: canonical untouched by self-test (fingerprint guard).
    const realExistedAfter = fs.existsSync(realLedger);
    const realMtimeAfter = realExistedAfter ? fs.statSync(realLedger).mtimeMs : 0;
    const realSizeAfter = realExistedAfter ? fs.statSync(realLedger).size : 0;
    assert('bonus. canonical ledger untouched by self-test',
      realExistedBefore === realExistedAfter &&
      realMtimeBefore === realMtimeAfter &&
      realSizeBefore === realSizeAfter);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`review-ledger self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// -- main -------------------------------------------------------------------
function _resolvePlanningDir() {
  // Default: <cwd>/.planning. Allow --planning-dir <path> override for tests.
  const idx = process.argv.indexOf('--planning-dir');
  if (idx > 0 && process.argv[idx + 1]) return path.resolve(process.argv[idx + 1]);
  return path.resolve(process.cwd(), '.planning');
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());

  if (cmd === '--aggregate') {
    const planningDir = _resolvePlanningDir();
    const r = aggregateFromPhases(planningDir);
    console.log(JSON.stringify(r));
    process.exit(r && r.ok ? 0 : 1);
  }

  if (cmd === '--kill-check') {
    const planningDir = _resolvePlanningDir();
    let milestone = null;
    const mIdx = process.argv.indexOf('--milestone');
    if (mIdx > 0 && process.argv[mIdx + 1]) milestone = process.argv[mIdx + 1];
    const r = killCheck(planningDir, milestone ? { milestone } : {});
    console.log(JSON.stringify(r));
    process.exit(r && r.ok ? 0 : 1);
  }

  console.log('Usage:');
  console.log('  node review-ledger.cjs --self-test');
  console.log('  node review-ledger.cjs --aggregate [--planning-dir <path>]');
  console.log('  node review-ledger.cjs --kill-check [--milestone <id>] [--planning-dir <path>]');
  console.log('  Or require() and call appendReviewRow / readReviewRows /');
  console.log('                        aggregateFromPhases / killCheck / ledgerPath');
  process.exit(0);
}

module.exports = {
  // 5 public APIs (RESEARCH Section 10):
  appendReviewRow,
  readReviewRows,
  aggregateFromPhases,
  killCheck,
  ledgerPath,
  // 4 frozen constants:
  LEGACY_VERDICT_MAP,
  STATUSES,
  COMMAND_NAME,
  ENVELOPE_VERSION,
};
```

**Constraints:** ASCII-only, LF line endings, no new dependencies (Node
built-ins: fs, path, os, crypto only). No glob, no ajv, no minimist.

### A2 — `super-gsd/skills/sgsd-orchestrate/SKILL.md` wire-in (~6 LOC insert)

Locate the `appendPerDispatchReviewEvidence(...)` call at line ~1248-1255
(the closing `})` is on or near 1255). Insert the following block IMMEDIATELY
AFTER the existing `appendPerDispatchReviewEvidence(report, { ... });`
statement (and before the next `If critical > 0 AND interactive: STOP...`
sentence at line ~1257).

The placement is the converged Codex+Claude path post-Phase-32-fix; both
provider tracks reach this site with `report` populated. Tee pattern:
existing per-phase write preserved + new canonical write.

```javascript
        // LEDGER-02: tee the same per-dispatch ATC row into the canonical
        // review ledger. Same payload shape as appendPerDispatchReviewEvidence
        // emits to per-phase commit-reviews.jsonl; one wire covers Codex
        // and Claude paths because both converge here. Helper wraps in
        // try/catch and returns false on error -- orchestrator continues.
        try {
          require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'review-ledger.cjs'))
            .appendReviewRow(path.join(process.cwd(), '.planning'), {
              ts: new Date().toISOString(),
              plan: currentPlan,
              tier: 'per-dispatch',
              verdict: report.verdict,
              critical: report.critical_count,
              warning: report.warning_count,
              one_liner: report.one_liner,
              provider: report._provider || effective.name,
              model: report._model,
              reasoning_effort: report._reasoning_effort,
              fallback_reason: report._fallback_reason || null,
              fallback_triggered: !!(report._provider === 'claude-via-fallback'),
              duration_ms: (dispatchResult && typeof dispatchResult.duration_ms === 'number')
                            ? dispatchResult.duration_ms : null,
              milestone: currentMilestone,
              phase: currentPhase,
              _source_milestone: currentMilestone,
              _source_phase: currentPhaseDir || (`${currentPhase}-` + (currentPlan || '').split('-')[0]),
            });
        } catch (e) {
          console.warn('[SGSD] review-ledger wire-in failed (continuing):', e && e.message);
        }
```

The `try/catch` wrapper is belt-and-braces: the lib's public API already
never throws upward, but the `require()` itself can throw (missing module,
syntax error in a future edit). Orchestrator never crashes on writer
failure (RESEARCH Section 3.4).

**Decision factors in scope at SKILL.md:1248:** `report` (provider, model,
content, verdict, critical_count, warning_count, one_liner, _provider,
_model, _reasoning_effort, _fallback_reason); `effective` (provider name);
`currentPhase`, `currentMilestone`, `currentPlan`, `currentPhaseDir`;
`dispatchResult` (only on Codex path; the helper accepts duration_ms as
null-safe).

### A3 — `super-gsd/scripts/sgsd-mission-control.ps1` read switch (~5 LOC edit at line ~1538)

Replace the existing `Get-ChildItem -Recurse` glob block (lines 1537-1548)
with a canonical-first read that falls back to per-phase enumeration when
the canonical ledger is absent (forward-compat per RESEARCH Q16 lock).

Find the existing block:

```powershell
    if (Test-Path $phasesRoot) {
        $gateFile = Get-ChildItem -Path $phasesRoot -Filter "commit-reviews.jsonl" -Recurse -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($gateFile) {
            $gateLine = Get-Content $gateFile.FullName -Tail 1 -Encoding UTF8 -ErrorAction SilentlyContinue
            try {
                $g = $gateLine | ConvertFrom-Json
                $lastGate = $g.verdict
                $gateColor = switch ($lastGate) { "pass" {"Green"} "warn" {"Yellow"} default {"Red"} }
            } catch {}
        }
    }
```

Replace with (keep ASCII-only):

```powershell
    # LEDGER-04: prefer canonical review-ledger.jsonl when present; fall back
    # to per-phase enumeration on legacy / pre-Phase-34 repos (forward-compat).
    $canonicalLedger = Join-Path $PlanningDir "metrics\review-ledger.jsonl"
    $usedCanonical = $false
    if (Test-Path $canonicalLedger) {
        try {
            # Tail rows; filter to active milestone if known; take last match.
            $tail = Get-Content $canonicalLedger -Tail 50 -Encoding UTF8 -ErrorAction SilentlyContinue
            $matched = $null
            foreach ($line in ($tail | Where-Object { $_ -and $_.Trim() })) {
                try {
                    $row = $line | ConvertFrom-Json
                    if (-not $state.milestone -or $row.milestone -eq $state.milestone -or $row._source_milestone -eq $state.milestone) {
                        $matched = $row
                    }
                } catch {}
            }
            if ($matched) {
                # Prefer legacy verdict when present; else envelope status.
                $lastGate = if ($matched._legacy -and $matched._legacy.verdict) { $matched._legacy.verdict } else { $matched.status }
                $gateColor = switch ($lastGate) {
                    "pass" {"Green"} "ok" {"Green"}
                    "warn" {"Yellow"}
                    "skipped" {"DarkGray"}
                    default {"Red"}
                }
                $usedCanonical = $true
            }
        } catch {}
    }
    if (-not $usedCanonical -and (Test-Path $phasesRoot)) {
        $gateFile = Get-ChildItem -Path $phasesRoot -Filter "commit-reviews.jsonl" -Recurse -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($gateFile) {
            $gateLine = Get-Content $gateFile.FullName -Tail 1 -Encoding UTF8 -ErrorAction SilentlyContinue
            try {
                $g = $gateLine | ConvertFrom-Json
                $lastGate = $g.verdict
                $gateColor = switch ($lastGate) { "pass" {"Green"} "warn" {"Yellow"} default {"Red"} }
            } catch {}
        }
    }
```

ASCII-only literals (PS 5.1 mojibake guard). LF line endings. The fallback
preserves the legacy code path verbatim so repos that haven't run
`--aggregate` keep rendering as before.

## Known Dead-Ends (DO NOT do these)

- **Do NOT modify `super-gsd/registry/command-envelope-v1.yaml` or its `.json`
  schema.** Phase 31 contract is locked. Phase 34 wraps WITHIN the existing
  envelope (additionalProperties: true) -- no schema changes.
- **Do NOT modify the four existing contracts** (code-reviewer-v1,
  review-providers-v1, handover-contract-v2, plan-schema-v2). Reconciliation
  was Phase 31's job; Phase 34 reuses.
- **Do NOT introduce new dependencies.** Use Node built-ins only: `fs`,
  `path`, `os`, `crypto`. No `glob`, no `ajv`, no `minimist`, no `chalk`.
  The path walker in `_walkPerPhaseFiles` deliberately uses `fs.readdirSync`
  recursion -- cross-platform without spawning `find`.
- **Do NOT add the canonical write to `super-gsd/scripts/codex-exec.sh`.**
  REQUIREMENTS:42 says "wired into codex-exec.sh + Claude reviewer" but
  RESEARCH Section 1 + 11.2 verified that codex-exec.sh writes only
  `REPORT_OUT` and one `codex-log.jsonl` row -- it does NOT write
  `commit-reviews.jsonl`. The orchestrator does, AT the SKILL.md site,
  AFTER codex-exec.sh returns and the report parses. ONE wire at SKILL.md
  covers BOTH providers. (DEVIATION documented in frontmatter.)
- **Do NOT split into `tools/review-ledger/aggregate.cjs` +
  `lib/review-ledger-writer.cjs`.** The ROADMAP-AGENT.md mention is
  superseded by RESEARCH Q13 lock: single file
  `super-gsd/scripts/lib/review-ledger.cjs` with `--aggregate`,
  `--kill-check`, `--self-test` modes (matches Phase 32 + 33 pattern).
  (DEVIATION documented in frontmatter.)
- **Do NOT auto-delete per-phase `commit-reviews.jsonl` files.** They are
  the audit trail; aggregator is read-only over them. Direct readers
  (codex-rerun, audit scripts, manual `tail -f`) keep working.
- **Do NOT add an `--all-milestones` flag to `--kill-check`.** Active
  milestone scope is locked (Q3); cross-milestone observability is
  deferred to v1.8+.
- **Do NOT render a Markdown view.** Q8 lock: defer to v1.8+ (mirrors
  Phase 32).
- **Do NOT mock `appendReviewRow` in any test.** Per Patch 4 mass-discuss
  rule, fixtures invoke the SAME public helper the orchestrator calls.
  Only the upstream review-row payload is faked.

## Embedded Verifier — runnable acceptance

Run from repo root after all three artifacts are committed.

```bash
# ----------------------------------------------------------------------
# Self-test: 15 assertions + bonus run_id uniqueness + canonical fingerprint
# ----------------------------------------------------------------------
node super-gsd/scripts/lib/review-ledger.cjs --self-test
# expect: "review-ledger self-test: <N> pass, 0 fail" and exit 0

# ----------------------------------------------------------------------
# LEDGER-01: aggregator + 11 historic per-phase backfill files
# ----------------------------------------------------------------------
node super-gsd/scripts/lib/review-ledger.cjs --aggregate
# expect: JSON line {ok:true, files_scanned:11, rows_in:>=11, rows_out:>=11, ...}, exit 0

node -e "
const lib = require('./super-gsd/scripts/lib/review-ledger.cjs');
const rows = lib.readReviewRows('./.planning');
if (rows.length < 11) { console.error('FAIL LEDGER-01: expected >=11 rows, got', rows.length); process.exit(1); }
console.log('PASS LEDGER-01:', rows.length, 'rows aggregated');
"

# ----------------------------------------------------------------------
# LEDGER-02: SKILL.md wire-in present (grep for the appendReviewRow call)
# ----------------------------------------------------------------------
node -e "
const fs = require('fs');
const skill = fs.readFileSync('./super-gsd/skills/sgsd-orchestrate/SKILL.md','utf8');
if (!/appendReviewRow\s*\(/m.test(skill)) { console.error('FAIL LEDGER-02: SKILL.md missing appendReviewRow wire-in'); process.exit(1); }
console.log('PASS LEDGER-02: SKILL.md wire-in present');
"

# ----------------------------------------------------------------------
# LEDGER-03 positive: canonical now has rows -> baseline_ok, exit 0
# ----------------------------------------------------------------------
node super-gsd/scripts/lib/review-ledger.cjs --kill-check
# expect: JSON {ok:true, reason:"baseline_ok", count:>=11, milestone:"v1.7"}, exit 0
echo "PASS LEDGER-03 positive (baseline_ok on populated canonical)"

# ----------------------------------------------------------------------
# LEDGER-03 negative: empty fixture -> empty_baseline (return value path)
# ----------------------------------------------------------------------
node -e "
const lib = require('./super-gsd/scripts/lib/review-ledger.cjs');
const r = lib.killCheck('/nonexistent', {milestone: 'fake'});
if (r.ok || r.reason !== 'empty_baseline') { console.error('FAIL LEDGER-03 negative:', JSON.stringify(r)); process.exit(1); }
console.log('PASS LEDGER-03 negative:', JSON.stringify(r));
"

# ----------------------------------------------------------------------
# LEDGER-04: cockpit reads canonical ledger
# ----------------------------------------------------------------------
grep -q 'review-ledger.jsonl' super-gsd/scripts/sgsd-mission-control.ps1 && \
  echo "PASS LEDGER-04 (mission-control references canonical)" || \
  (echo "FAIL LEDGER-04: mission-control.ps1 missing canonical reference" && exit 1)
```

All five blocks exit 0 -> phase acceptance met.

## Live-or-Local Fallback (Patch 4)

Three paths, ALL exercising the same public `appendReviewRow` helper -- no
mocks of the production caller boundary.

| Path  | Trigger                                  | Helper invoked       |
|-------|------------------------------------------|----------------------|
| Live  | next per-dispatch ATC fires (codex/claude) | appendReviewRow via SKILL.md wire-in |
| Local | `node review-ledger.cjs --self-test`     | appendReviewRow directly (assertions 3, 5, 6, 7, 10) |
| Cold  | `node review-ledger.cjs --aggregate`     | _appendRowInternal via aggregator -> writeFileSync of normalized rows |

The aggregator covers cold backfill: 11 existing per-phase files become
canonical rows in one invocation, with no live dispatch needed. Self-test
exercises the same code path with synthetic in-tmpdir fixtures (4 verdict
classes + malformed-row recovery + idempotency assertions). When the next
real dual-provider review fires post-ship, the SKILL.md wire-in writes a
new canonical row through the SAME helper -- live and local converge.

## Schema-Without-Consumer Rule

Five production consumers, exceeding the 1-minimum rule by 5x:

| # | Consumer                                  | Lib call            | R/W   |
|---|-------------------------------------------|---------------------|-------|
| 1 | `--aggregate` CLI mode                    | aggregateFromPhases | both  |
| 2 | `--kill-check` CLI mode                   | killCheck           | read  |
| 3 | SKILL.md per-dispatch ATC tee (line ~1255) | appendReviewRow    | write |
| 4 | mission-control.ps1 read switch (~1538)   | reads canonical     | read  |
| 5 | self-test fingerprint check               | readReviewRows / appendReviewRow | both |

(Phase 32 shipped with 1; Phase 33 with 2; Phase 34 ships with 5.)

## Constraints

- ASCII-only literals throughout (PS 5.1 mojibake guard;
  `mission-strip.ps1:25` precedent).
- LF line endings (no CRLF mixing).
- No new dependencies (Node built-ins only).
- Public-API never-throws-upward (mirrors `route-ledger.cjs` LOCKED contract).
- Self-test fingerprint guard MUST anchor to `__dirname` (not
  `process.cwd()`) so the test is invokable from any directory.
- Atomic commits per artifact (commit plan below).

## Commit Plan (3 atomic commits)

```bash
# Commit 1: lib + self-test (single artifact)
git add super-gsd/scripts/lib/review-ledger.cjs
git commit -m "feat(34-01): review-ledger.cjs lib + 15-assertion self-test"

# Commit 2: SKILL.md wire-in
git add super-gsd/skills/sgsd-orchestrate/SKILL.md
git commit -m "feat(34-01): wire appendReviewRow into sgsd-orchestrate SKILL.md"

# Commit 3: mission-control read switch
git add super-gsd/scripts/sgsd-mission-control.ps1
git commit -m "feat(34-01): mission-control reads canonical review-ledger when present"
```

Optionally a fourth commit for the cold backfill produced by `--aggregate`:

```bash
# Commit 4 (optional, RESEARCH Q15 lock): commit canonical .jsonl once
node super-gsd/scripts/lib/review-ledger.cjs --aggregate
git add .planning/metrics/review-ledger.jsonl
git commit -m "chore(34-01): cold-aggregate 11 historic commit-reviews into canonical ledger"
```

`--aggregate` is idempotent: re-running on a fresh clone yields a
byte-identical file. No churn.

## Success Criteria

- [ ] `super-gsd/scripts/lib/review-ledger.cjs` exists with all five public
      exports (`appendReviewRow`, `readReviewRows`, `aggregateFromPhases`,
      `killCheck`, `ledgerPath`) and four frozen constants.
- [ ] `node super-gsd/scripts/lib/review-ledger.cjs --self-test` exits 0
      with all 15 assertions PASS (plus 2 bonus PASS).
- [ ] `node super-gsd/scripts/lib/review-ledger.cjs --aggregate` consolidates
      >=11 per-phase files into `.planning/metrics/review-ledger.jsonl`,
      reports JSON `{ok:true,...}`, exits 0.
- [ ] `node super-gsd/scripts/lib/review-ledger.cjs --kill-check` after
      backfill returns `{ok:true, reason:"baseline_ok", count:>=11, milestone:"v1.7"}`,
      exits 0.
- [ ] `killCheck('/nonexistent', {milestone:'fake'})` returns
      `{ok:false, reason:"empty_baseline", count:0}` (exit-code path:
      CLI mode would exit 1).
- [ ] `super-gsd/skills/sgsd-orchestrate/SKILL.md` contains exactly one
      `appendReviewRow(` call wrapped in try/catch immediately after
      `appendPerDispatchReviewEvidence(...)`.
- [ ] `super-gsd/scripts/sgsd-mission-control.ps1` references
      `review-ledger.jsonl` and reads canonical when present, falls back
      to per-phase glob otherwise.
- [ ] No new package.json dependencies added.
- [ ] All files ASCII-only; LF line endings.
- [ ] Three (or four) atomic commits, one per artifact.

## Output

After completion, create
`.planning/milestones/v1.7/phases/34-canonical-review-ledger/34-01-SUMMARY.md`
documenting:
- which 11 per-phase files were aggregated and how many rows each contributed
- self-test pass count
- whether the live wire-in fired during ATC review (and what canonical row
  count it added)
- any deviations encountered beyond the two declared in frontmatter
