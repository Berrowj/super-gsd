---
plan_id: 43-01
phase: 43
title: Phase Capsule Contract
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [CAP-01, CAP-02, CAP-03, CAP-04, CAP-05]
locked_decisions: [5, 6, 13]
depends_on: [34, 36, 40, 41, 42]
created: 2026-04-27
tags: [phase-capsule, projection, idempotent-rebuild, lock-5, lock-6, lock-13, sgsd-research]
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/tools/phase-capsule/write.cjs
      - super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
    hypothesis: "A read-only writer with frozen const enums + 9 deterministic extractors + canonical-JSON content hash + envelope-style never-throws-upward contract produces a per-phase PHASE-CAPSULE.json that satisfies A1 (18 fields), A2 (verbatim bypass), A3 (idempotent rebuild) without mutating any canonical phase-folder file or canonical metric stream."
    falsifier: "Self-test F2 (rebuild equivalence) yields H1 != H2 OR self-test F4 (bypass) shows summary_passthrough deviates byte-for-byte from crit-backlog.jsonl source row OR writeCapsule throws upward on bad input. Any one disqualifies the lib."
    stop_rule: "self-test 13/13 PASS (F1 write/read, F2 rebuild equivalence BINDING A3, F3 missing-file graceful, F4 critical-bypass preserved BINDING A2 + 9 secondary); writeCapsule on malformed input returns {ok:false,reason:...} (NEVER throws); read-only invariant green (5 canonical streams + 3 sample real phase folders byte-identical pre/post); JSON Schema validates a fixture capsule."
    minimal_test: "node super-gsd/tools/phase-capsule/write.cjs --self-test -> exit 0 with literal 'phase-capsule self-test: 13 pass, 0 fail'."
  - id: T2
    type: backfill
    files_touched:
      - .planning/milestones/v1.6/phases/26-cockpit-question-contract/PHASE-CAPSULE.json
      - .planning/milestones/v1.6/phases/27-cockpit-data-tree/PHASE-CAPSULE.json
      - .planning/milestones/v1.6/phases/28-mission-control-layout/PHASE-CAPSULE.json
      - .planning/milestones/v1.6/phases/29-agent-codex-lanes/PHASE-CAPSULE.json
      - .planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/PHASE-CAPSULE.json
      - .planning/milestones/v1.7/phases/31-canonical-envelope/PHASE-CAPSULE.json
      - .planning/milestones/v1.7/phases/32-route-decision-ledger/PHASE-CAPSULE.json
      - .planning/milestones/v1.7/phases/33-repair-instruction/PHASE-CAPSULE.json
      - .planning/milestones/v1.7/phases/34-canonical-review-ledger/PHASE-CAPSULE.json
      - .planning/milestones/v1.7/phases/35-generated-system-map/PHASE-CAPSULE.json
      - .planning/milestones/v1.8/phases/36-gate-value-telemetry/PHASE-CAPSULE.json
      - .planning/milestones/v1.8/phases/37-muda-deletion-candidates/PHASE-CAPSULE.json
      - .planning/milestones/v1.8/phases/38-risk-tiered-gate-sampling/PHASE-CAPSULE.json
      - .planning/milestones/v1.8/phases/39-gate-keep-kill/PHASE-CAPSULE.json
      - .planning/milestones/v1.8/phases/40-phase-folder-audit/PHASE-CAPSULE.json
      - .planning/milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json
      - .planning/milestones/v1.9/phases/42-token-budget-admission/PHASE-CAPSULE.json
      - .planning/milestones/v1.6/PHASE-INDEX.jsonl
      - .planning/milestones/v1.7/PHASE-INDEX.jsonl
      - .planning/milestones/v1.8/PHASE-INDEX.jsonl
      - .planning/milestones/v1.9/PHASE-INDEX.jsonl
    hypothesis: "Running --backfill --all walks the 4 milestone folders, derives 17 capsules from canonical sources (CONTEXT.md / RESEARCH.md / PLAN.md / VERIFICATION.md / atc-review / crit-backlog / git log / agent-token-spend / gate-value-log / review-ledger / codex-log), validates each against PHASE-CAPSULE.schema.json, and lands them alongside 4 PHASE-INDEX.jsonl projections without mutating any canonical input."
    falsifier: "Any of 17 capsules fails JSON Schema validation OR any canonical phase-folder file (CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC-REVIEW/codex-review/commit-reviews/v1.9 reviews/) is byte-modified OR any canonical metric stream is appended to OR re-running --backfill produces a different content hash for any of the 17 capsules."
    stop_rule: "17 PHASE-CAPSULE.json files exist + 4 PHASE-INDEX.jsonl files exist; each capsule's _validateCapsule returns true; idempotent rebuild (delete + rebuild) yields identical content hash for every capsule (A3 binding at scale); read-only diff against canonical streams + every backfilled phase folder (excluding the new PHASE-CAPSULE.json) is empty."
    minimal_test: "node super-gsd/tools/phase-capsule/write.cjs --backfill --all && node super-gsd/tools/phase-capsule/write.cjs --backfill --all -> second run reports 17 skipped, 0 written, 0 errors."
  - id: T3
    type: integration
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/skills/sgsd-complete-milestone/SKILL.md
    hypothesis: "Inserting writeCapsule call as Step 6.6.i.X in sgsd-orchestrate (forward-flow, BEFORE phase-advance) AND writeAllCapsulesForMilestone as Step 4.7-bis in sgsd-complete-milestone (backfill safety net, AFTER Step 4.7 token-waste, BEFORE Step 5 cross-phase) gives lock-5 forward-coverage + safety-net catch-up without ever halting autonomy on capsule-write failure."
    falsifier: "Either wire-in throws upward on capsule failure OR phase advance is gated on capsule outcome OR the safety-net runs BEFORE the forward-flow on a fresh phase OR ordering breaks Step 4.5-4.6-4.7 alphabetic."
    stop_rule: "grep finds writeCapsule call between Step 6.6.h (TaskUpdate) and Step 6.6.i (mark phase complete); grep finds writeAllCapsulesForMilestone call after step_4_7_token_waste_check and before step_5_cross_phase_check; both wire-ins use process.cwd() boundary anchor; both wire-ins document the never-throws contract; ASCII-only across both SKILL.md files."
    minimal_test: "grep -q 'writeCapsule' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'writeAllCapsulesForMilestone' super-gsd/skills/sgsd-complete-milestone/SKILL.md."
must_haves:
  truths:
    - "SCHEMA_VERSION = 1 (integer, frozen, top-of-file const)"
    - "STATUS_VOCAB = Object.freeze 5-entry: PASS, PASS-WITH-DEFERRED-N, FAIL, UNKNOWN, IN_PROGRESS (closed enum)"
    - "BYPASS_KIND_VOCAB = Object.freeze 7-entry from crit-backlog.cjs: verifier_fail, edge_guard_miss, security_issue, privacy_issue, destructive_op, provider_outage, stack_trace"
    - "CAPSULE_FILE_KINDS = Object.freeze 5-entry: context, research, plan, verification, atc_review (source_hashes keys)"
    - "Public APIs (writeCapsule, writeAllCapsulesForMilestone, readCapsule, capsulePath, backfillFromCanonical) wrap internals in try/catch and NEVER throw upward (mirrors Phase 36 gate-value-log.cjs + Phase 41 report.cjs + Phase 42 check.cjs)"
    - "_normalize + _assertCapsuleSchema + _writeCapsuleInternal trio enforces JSON Schema + closed-enum status check on every write; closed-enum violations raise inside _writeCapsuleInternal but public API catches and returns {ok:false,reason}"
    - "Read-only against ALL 5 canonical metric streams (agent-token-spend.jsonl, crit-backlog.jsonl, gate-value-log.jsonl, review-ledger.jsonl, codex-log.jsonl) AND read-only against ALL canonical phase-folder content (CONTEXT.md, RESEARCH.md, PLAN.md, VERIFICATION.md, ATC-REVIEW.md, codex-review.md, commit-reviews.jsonl, reviews/{NN}-REVIEW.md); only owned writes are PHASE-CAPSULE.json + PHASE-INDEX.jsonl + 2 SKILL.md edits"
    - "__dirname-anchored 3-up walk to .planning for canonical-path defaults (Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 41 sec 7.1 lessons) and ALSO __dirname-anchored fingerprint guard over 5 streams + 3 sample real phase folders"
    - "_capsuleContentHash strips created_at + created_by, sorts top-level keys, recursively sorts nested object keys, and sorts arrays of {id} or {sha} or {path} ascending; result is sha256 hex64 of canonical JSON serialization"
    - "_gatherBypassRefs reads crit-backlog.jsonl, filters by milestone+phase, copies {id, kind, summary, evidence_path, tagged_for_milestone} VERBATIM into bypass_refs[N] with summary renamed to summary_passthrough; NEVER calls string.replace, .trim, .substring, .slice on summary"
    - "_gatherSourceCommits invokes 'git log --pretty=format:%H||%s||%cI --reverse -- <phaseDir>' via child_process.execSync with phaseDir absolute; parses on || separator; returns []  on git unavailable (NEVER throws); --reverse stabilizes ordering"
    - "Dual phase-folder shape detection: writer probes for v1.9 reviews/{NN}-REVIEW.md FIRST then falls back to v1.6/v1.7/v1.8 {NN}-ATC-REVIEW.md; gates.atc_review.path carries whichever exists; null when neither present"
    - "Lock 6 binding: F4 self-test asserts bypass_refs[i].summary_passthrough byte-equal to source crit-backlog row .summary for 3 seeded rows; bypass_refs sorted ascending by .id (timestamp-prefixed -> deterministic)"
    - "Lock 13 binding: writeCapsule on missing CONTEXT.md / corrupt git / unreadable crit-backlog returns {ok:false,reason} and logs to .planning/metrics/context-complaints.jsonl (Phase 49 surface); F3 self-test exercises the missing-file path"
    - "A3 binding: F2 self-test writes capsule -> H1 = _capsuleContentHash; deletes capsule; rewrites -> H2 = _capsuleContentHash; asserts H1 === H2 (modulo created_at + created_by which are stripped pre-hash)"
    - "Self-test 13 assertions: 4 named fixtures (F1 write/read, F2 rebuild BINDING A3, F3 missing-file graceful, F4 critical-bypass BINDING A2) + 9 secondary"
    - "PHASE-INDEX.jsonl uses append-or-replace-by-(milestone,phase) semantics via tmpfile-rename (atomic) to preserve idempotency; row shape is {milestone, phase, phase_name, status, capsule_path, content_hash, created_at}"
  artifacts:
    - super-gsd/tools/phase-capsule/write.cjs (NEW; ~700 LOC; mirrors Phase 41 report.cjs + Phase 42 check.cjs + Phase 40 audit.cjs)
    - super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json (NEW; ~150 LOC; 18 fields; additionalProperties:false)
    - .planning/milestones/v1.6/phases/{26..30}/PHASE-CAPSULE.json (NEW; 5 generated)
    - .planning/milestones/v1.7/phases/{31..35}/PHASE-CAPSULE.json (NEW; 5 generated)
    - .planning/milestones/v1.8/phases/{36..40}/PHASE-CAPSULE.json (NEW; 5 generated)
    - .planning/milestones/v1.9/phases/{41,42}/PHASE-CAPSULE.json (NEW; 2 generated)
    - .planning/milestones/{v1.6,v1.7,v1.8,v1.9}/PHASE-INDEX.jsonl (NEW; 4 generated)
    - super-gsd/skills/sgsd-orchestrate/SKILL.md (EDIT; +Step 6.6.i.X writeCapsule wire-in; ~25 LOC)
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md (EDIT; +Step 4.7-bis writeAllCapsulesForMilestone wire-in; ~25 LOC)
  key_links:
    - 43-CONTEXT.md (sparse stub goal; depends_on:[41]; unblocks:[45,46,49,51])
    - 43-RESEARCH.md (1062 lines; 11 LOCKED derivation calls; sec 4 schema; sec 5 hash + idempotency; sec 6 critical bypass linkage; sec 9 backfill + integration; sec 10 self-test design; sec 15 single-plan recommendation 12-task structure)
    - .planning/milestones/v1.9/REQUIREMENTS.md:40-50 (design locks 5 + 6 verbatim)
    - .planning/milestones/v1.9/REQUIREMENTS.md:113-119 (CAP-01..05 verbatim)
    - .planning/milestones/v1.9/ROADMAP.md:96-112 (Phase 43 deliverables + acceptance A1/A2/A3)
    - .planning/discussions/2026-04-26-mass-discuss.md:238 (mass-discuss row 43 LOCKED decision)
    - super-gsd/tools/token-attribution/report.cjs (Phase 41; UPSTREAM IMPORT for token_cost evidence; ~1017 LOC mirror surface)
    - super-gsd/tools/token-waste/check.cjs (Phase 42; ARCHITECTURAL MIRROR for never-throws-upward + envelope row writer)
    - super-gsd/tools/phase-folder-audit/audit.cjs (Phase 40; WALKER MIRROR; auditAllPhases discovery + RECOMMENDED_FILES list verbatim)
    - super-gsd/scripts/lib/gate-value-log.cjs (Phase 36; envelope-v1 writer mirror; _normalize + _assertEnvelopeV1 + RUN_ID_REGEX)
    - super-gsd/scripts/lib/crit-backlog.cjs (crit-backlog.jsonl row shape; READ-ONLY)
    - .planning/metrics/crit-backlog.jsonl (26 rows verified; bypass source for F4 fixture)
    - super-gsd/skills/sgsd-orchestrate/SKILL.md:1170-1209 (Step 6.6.i + 6.7 phase-close hook anchors)
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-258 (Step 4.5/4.6/4.7 wire-in templates)
    - super-gsd/templates/command-envelope-v1.json (envelope-v1 contract; capsule explicitly NOT envelope-v1; closed-shape phase-summary contract level)
---

<objective>
Phase 43 ships SGSD's 6th canonical contract level: the **phase-summary
contract** (PHASE-CAPSULE.json). The contract makes completed phases
consumable WITHOUT re-scanning folders. Phase 45 PACKET-03 will pull
capsules instead of raw phase folders for forward-context injection;
Phase 46 INDEX-02 will FTS-index them; Phase 51 BENCH-04 will measure
the >=50% researcher-token reduction the audit projected.

Controlling principle (mass-discuss row 43, REQUIREMENTS.md design lock 5,
sec 1 of RESEARCH):

> "Compress prior-phase context; canonical = .planning + git, capsule = projection."

The capsule is NEVER source of truth. Deleting all PHASE-CAPSULE.json
and rebuilding from `.planning + git` MUST yield byte-equivalent
content hashes. Acceptance A3 is the binding regression test.

Lock 6 (REQUIREMENTS.md:40-50) binds the bypass-linkage rule:

> "Critical outputs bypass compression: CRIT, stack trace, stderr,
> failed test, verifier fail, edge-guard miss, security/privacy issue,
> destructive-operation warning, behaviorally proven provider outage."

The capsule MUST link bypass entries RAW via verbatim passthrough into
crit-backlog.jsonl. NEVER paraphrase, abbreviate, summarize. F4
self-test asserts byte-for-byte equality of summary_passthrough against
the source crit-backlog row's .summary field.

Lock 13 (REQUIREMENTS.md:67-68 autonomy contract) binds the
never-throws-upward rule: writeCapsule on ANY failure (missing CONTEXT.md,
corrupt git, unreadable crit-backlog, schema invalidation) returns
{ok:false,reason} and logs to .planning/metrics/context-complaints.jsonl.
Phase advance NEVER halts on capsule write failure.

Purpose:
  - Land the canonical phase-capsule writer
    `super-gsd/tools/phase-capsule/write.cjs` (~700 LOC) that mirrors:
    * Phase 41 report.cjs envelope-v1 emitter pattern (frozen consts,
      module exports, never-throws-upward, __dirname-anchored guard)
    * Phase 42 check.cjs read-only check pattern (5 canonical
      streams + canonical phase-folder paths byte-identical pre/post)
    * Phase 40 audit.cjs walker pattern (auditAllPhases discovery,
      RECOMMENDED_FILES detection, dual phase-folder shape)
    * Phase 36 gate-value-log.cjs envelope writer trio
      (_normalize + _assertEnvelopeV1 + _appendRowInternal),
      adapted to capsule-document shape via _normalize +
      _assertCapsuleSchema + _writeCapsuleInternal.
  - Land the closed-shape JSON Schema
    `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` (~150 LOC;
    18 fields; additionalProperties:false). The schema is the formal
    contract for Phase 45/46/49/51 consumers.
  - Backfill 17 historical capsules covering v1.6 P26-30 (5) + v1.7
    P31-35 (5) + v1.8 P36-40 (5) + v1.9-shipped P41-P42 (2) PLUS
    Phase 43's own capsule at close = 18 capsules total. Chronological
    order. Idempotent rebuild.
  - Wire forward-flow into sgsd-orchestrate Step 6.6.i.X (BETWEEN
    TaskUpdate at 6.6.h AND mark-complete at 6.6.i; LOCK 5 forward
    coverage). FIRST per-phase hook into Step 6.6 -- careful but the
    never-throws contract bounds the blast radius.
  - Wire backfill safety-net into sgsd-complete-milestone Step 4.7-bis
    (immediately AFTER step_4_7_token_waste_check, BEFORE step_5
    _cross_phase_check). Idempotent: existing capsules with matching
    content hash are skipped (preserves mtime).
  - Self-test 13/13: F1 write/read, F2 rebuild equivalence (BINDING A3),
    F3 missing-file graceful, F4 critical-bypass preserved (BINDING A2 +
    Lock 6) + 9 secondary (frozen consts, dual phase-folder shape,
    fingerprint guard, schema closed-shape, decisions verbatim,
    source_commits sorted, source_hashes 5-key shape, never-throws,
    PHASE-INDEX.jsonl idempotent).

Output:
  - `super-gsd/tools/phase-capsule/write.cjs` (NEW; ~700 LOC; ASCII-only).
  - `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` (NEW; ~150 LOC).
  - 17 backfilled `PHASE-CAPSULE.json` files (NEW; generated; ~250 LOC each).
  - 4 `PHASE-INDEX.jsonl` files (NEW; generated; ~5 rows each).
  - `super-gsd/skills/sgsd-orchestrate/SKILL.md` (EDIT; +Step 6.6.i.X).
  - `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (EDIT; +Step 4.7-bis).

This phase ships a CONTRACT. It does NOT ship Phase 45 packet builders,
Phase 46 SQLite indexes, Phase 49 governance lifecycle fields, or
Phase 51 benchmarks. The capsule shape IS the API; consumers come
later. This phase satisfies CAP-01..05 + ROADMAP sec 43 A1/A2/A3.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-CONTEXT.md
@.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-RESEARCH.md
@super-gsd/tools/token-attribution/report.cjs
@super-gsd/tools/token-waste/check.cjs
@super-gsd/tools/phase-folder-audit/audit.cjs
@super-gsd/scripts/lib/gate-value-log.cjs
@super-gsd/scripts/lib/crit-backlog.cjs
@super-gsd/skills/sgsd-orchestrate/SKILL.md
@super-gsd/skills/sgsd-complete-milestone/SKILL.md
@super-gsd/templates/command-envelope-v1.json
@.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-01-baseline-token-attribution-PLAN.md
@.planning/milestones/v1.9/phases/42-token-budget-admission/42-01-token-budget-admission-PLAN.md
@.planning/discussions/2026-04-26-mass-discuss.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from canonical files. -->
<!-- Use these directly. NO codebase exploration required. -->

From super-gsd/tools/token-attribution/report.cjs (Phase 41; OPTIONAL UPSTREAM IMPORT for token_cost):
```javascript
// OPTIONAL: Phase 43 writer may import to populate token_cost field.
// If import fails (path missing), token_cost = null and capsule still ships.
// NEVER make capsule writes hard-depend on Phase 41 import success.
const {
  ROLES,             // Object.freeze(['researcher','planner','executor','verifier','reviewer','orchestrator','classifier','other'])
  ledgerPath,        // (planningDir) -> path/to/agent-token-spend.jsonl
} = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
```

From super-gsd/scripts/lib/gate-value-log.cjs (Phase 36; envelope-v1 WRITER MIRROR):
```javascript
// Frozen const pattern Phase 43 mirrors verbatim (lines 64-110):
const STATUSES         = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
const COMMAND_NAME     = 'logGateValue';     // -> Phase 43 has NO command (capsule is document, not envelope)
const ENVELOPE_VERSION = 1;
const RUN_ID_REGEX     =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

// __dirname-anchored canonical guard (lines 127-129):
const realLedger = path.resolve(__dirname, '..', '..', '..',
  '.planning', 'metrics', 'gate-value-log.jsonl');

// _normalize + _assertEnvelopeV1 + _appendRowInternal trio Phase 43 ADAPTS to:
// _normalize + _assertCapsuleSchema + _writeCapsuleInternal
//
// Phase 43 differences:
//   - Capsule is a JSON DOCUMENT (overwrite-on-rebuild), not a JSONL ROW (append-only).
//     _writeCapsuleInternal uses fs.writeFileSync (overwrite), NOT fs.appendFileSync.
//   - Capsule schema validation uses PHASE-CAPSULE.schema.json (additionalProperties:false),
//     NOT envelope-v1 (additionalProperties:true).
//   - Capsule has NO run_id, NO command, NO duration_ms (it's a document, not an event).
//   - Capsule HAS created_at + created_by (operational metadata; STRIPPED for content hash).
```

From super-gsd/tools/phase-folder-audit/audit.cjs (Phase 40; WALKER MIRROR):
```javascript
// Discovery pattern Phase 43 mirrors verbatim (audit.cjs:351-395):
function auditAllPhases(planningDir, opts) {
  // Walks .planning/milestones/{ms}/phases/{NN-name}/ for milestone filter
  // Returns array of audit rows
}
// Phase 43 ANALOG: writeAllCapsulesForMilestone(planningDir, milestone)
//   walks the same shape; for each phase folder calls writeCapsule.

// REQUIRED + RECOMMENDED FILES list verbatim (audit.cjs:55-70):
//   REQUIRED: 4 kinds (CONTEXT.md, RESEARCH.md, *-PLAN.md, VERIFICATION.md)
//   RECOMMENDED: 4 kinds (ATC-REVIEW.md, commit-reviews.jsonl, codex-review.md, WASTE.md)
//   Phase 43 source_hashes covers 5 of these (REQUIRED 4 + ATC-REVIEW.md / reviews/{NN}-REVIEW.md fallback)
//   Phase 43 does NOT add capsule to RECOMMENDED_FILES (intentional decoupling per RESEARCH sec 12.2).

// __dirname-anchored fingerprint guard (audit.cjs:218-250 conceptual):
//   walk multiple paths; capture {exists, mtimeMs, size}; reassert post-test.
```

From super-gsd/tools/token-waste/check.cjs (Phase 42; READ-ONLY CHECK MIRROR):
```javascript
// Phase 43 mirrors the read-only invariant pattern verbatim:
//   - Public APIs wrap internals in try/catch
//   - On error: console.warn to stderr + return falsey sentinel; NEVER throw upward
//   - __dirname-anchored fingerprint guard over canonical streams
//   - ASCII-only enforcement
//   - LF line endings
//   - No new dependencies (Node built-ins only: fs, path, os, crypto, child_process)

// Failure sentinel shapes Phase 43 adopts:
//   writeCapsule failure:                { ok: false, reason: <string> }
//   writeAllCapsulesForMilestone failure: { written: 0, skipped: 0, errors: [<msg>...] }
//   readCapsule failure:                  null
//   capsulePath:                          always returns string (no failure path)
```

From super-gsd/scripts/lib/crit-backlog.cjs + crit-backlog.jsonl (FIRST 3 ROWS verified):
```jsonl
{"id":"2026-04-26T23-13-37-843Z-3584","kind":"verifier_fail","phase":"26","plan":"phase-level","milestone":"v1.6","attempts_made":1,"summary":"live Codex auth unavailable; fallback used (codex-exec.sh --self-test exit 11)","evidence_path":".planning/milestones/v1.6/MILESTONE-READINESS.md","last_diff_sha":null,"tagged_for_milestone":"next-debt-milestone","added_at":"2026-04-26T23:13:37.845Z","resolved_at":null,"resolved_by":null}
```

Per row schema:
  - id              : ISO-8601-prefixed timestamp + 4hex (sortable, deterministic)
  - kind            : closed enum from BYPASS_KIND_VOCAB
  - phase           : string (matches PHASE-CAPSULE.phase)
  - milestone       : string (matches PHASE-CAPSULE.milestone)
  - summary         : VERBATIM text (Phase 43 copies into summary_passthrough; LOCK 6)
  - evidence_path   : relative path string (Phase 43 copies into evidence_path)
  - tagged_for_milestone : optional string (Phase 43 copies into tagged_for_milestone)

From .planning/metrics/agent-token-spend.jsonl (Phase 41 ledger; OPTIONAL token_cost source):
```json
{
  "envelope_version":1, "ts":"...", "command":"logTokenSpend",
  "phase":"36", "milestone":"v1.8",
  "role":"researcher", "provider":"claude",
  "token_breakdown":{"input_tokens":1234, "total_tokens":173034, "source_event_id":"agent:abcd..."}
}
```

Phase 43 token_cost shape (when ledger present):
```json
{
  "researcher": {"role":"researcher", "total_tokens":122437, "evidence_event_id":"agent:..."},
  "planner": null,
  "executor": null,
  "reviewer": null
}
```

From PHASE-CAPSULE.schema.json (NEW; Phase 43 contract):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "phase-capsule-v1",
  "title": "PHASE-CAPSULE",
  "description": "Phase-summary projection. Canonical = .planning + git; capsule = projection. NEVER source of truth.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version", "milestone", "phase", "phase_name",
    "status", "goal", "outputs", "files",
    "decisions", "debt", "downstream_contract", "bypass_refs",
    "source_commits", "source_hashes", "gates",
    "created_at", "created_by"
  ],
  "properties": {
    "schema_version":      {"type":"integer", "const":1},
    "milestone":           {"type":"string", "minLength":1},
    "phase":               {"type":"string", "minLength":1},
    "phase_name":          {"type":"string"},
    "status":              {"type":"string", "enum":["PASS","PASS-WITH-DEFERRED-N","FAIL","UNKNOWN","IN_PROGRESS"]},
    "goal":                {"type":"string"},
    "outputs":             {"type":"array", "items": {"$ref":"#/definitions/PhaseOutput"}},
    "files":               {"type":"array", "items":{"type":"string"}, "uniqueItems":true},
    "decisions":           {"type":"array", "items": {"$ref":"#/definitions/Decision"}},
    "debt":                {"$ref":"#/definitions/DebtCounts"},
    "downstream_contract": {"$ref":"#/definitions/DownstreamContract"},
    "bypass_refs":         {"type":"array", "items": {"$ref":"#/definitions/BypassRef"}},
    "source_commits":      {"type":"array", "items": {"$ref":"#/definitions/GitCommit"}},
    "source_hashes":       {"$ref":"#/definitions/SourceHashes"},
    "gates":               {"$ref":"#/definitions/GateOutcomes"},
    "token_cost":          {"oneOf":[{"$ref":"#/definitions/TokenCostRefs"}, {"type":"null"}]},
    "created_at":          {"type":"string", "pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T"},
    "created_by":          {"type":"string"}
  },
  "definitions": {
    "PhaseOutput":   {"type":"object", "required":["kind","path"], "properties":{"kind":{"type":"string"}, "path":{"type":"string"}, "exports":{"type":"array","items":{"type":"string"}}, "contract":{"type":"string"}, "tests_run":{"type":"array","items":{"type":"string"}}}, "additionalProperties": false},
    "Decision":      {"type":"object", "required":["id","source","text"], "properties":{"id":{"type":"string"}, "source":{"type":"string"}, "text":{"type":"string"}}, "additionalProperties": false},
    "DebtCounts":    {"type":"object", "required":["critical_added","warnings_added","edge_guard_miss_added","deferred_added","carried_forward_total"], "properties":{"critical_added":{"type":["integer","null"]}, "warnings_added":{"type":["integer","null"]}, "edge_guard_miss_added":{"type":["integer","null"]}, "deferred_added":{"type":["integer","null"]}, "carried_forward_total":{"type":["integer","null"]}}, "additionalProperties": false},
    "DownstreamContract": {"type":"object", "required":["consumers","constraints","extension_points"], "properties":{"consumers":{"type":"array","items":{"type":"string"}}, "constraints":{"type":"array","items":{"type":"string"}}, "extension_points":{"type":"array","items":{"type":"string"}}}, "additionalProperties": false},
    "BypassRef":     {"type":"object", "required":["stream","id","kind","summary_passthrough","evidence_path"], "properties":{"stream":{"type":"string"}, "id":{"type":"string"}, "kind":{"type":"string"}, "summary_passthrough":{"type":"string"}, "evidence_path":{"type":["string","null"]}, "tagged_for_milestone":{"type":["string","null"]}}, "additionalProperties": false},
    "GitCommit":     {"type":"object", "required":["sha","subject","ts"], "properties":{"sha":{"type":"string", "pattern":"^[0-9a-f]{40}$"}, "subject":{"type":"string"}, "ts":{"type":"string"}}, "additionalProperties": false},
    "SourceHashes":  {"type":"object", "required":["context","research","plan","verification","atc_review"], "properties":{"context":{"oneOf":[{"$ref":"#/definitions/HashedFile"},{"type":"null"}]}, "research":{"oneOf":[{"$ref":"#/definitions/HashedFile"},{"type":"null"}]}, "plan":{"type":"array","items":{"$ref":"#/definitions/HashedFile"}}, "verification":{"oneOf":[{"$ref":"#/definitions/HashedFile"},{"type":"null"}]}, "atc_review":{"oneOf":[{"$ref":"#/definitions/HashedFile"},{"type":"null"}]}}, "additionalProperties": false},
    "HashedFile":    {"type":"object", "required":["path","sha256"], "properties":{"path":{"type":"string"}, "sha256":{"type":"string", "pattern":"^[0-9a-f]{64}$"}}, "additionalProperties": false},
    "GateOutcomes":  {"type":"object", "properties":{"verifier":{"oneOf":[{"type":"object"},{"type":"null"}]}, "atc_review":{"oneOf":[{"type":"object"},{"type":"null"}]}, "phase_level_atc_runs":{"type":"array"}, "codex_runs":{"type":"array"}, "review_verdict":{"oneOf":[{"type":"object"},{"type":"null"}]}}, "additionalProperties": true},
    "TokenCostRefs": {"type":"object", "additionalProperties":{"oneOf":[{"type":"object"},{"type":"null"}]}}
  }
}
```

From RESEARCH sec 4.4 (CANONICAL CAPSULE EXAMPLE; v1.8/P40):
See 43-RESEARCH.md lines 226-285 for the exact 18-field example.
Phase 43 implementation MUST produce capsules of this shape.

From RESEARCH sec 5.2 (CANONICAL CONTENT HASH FUNCTION):
```javascript
function _capsuleContentHash(capsuleObj) {
  const stripped = JSON.parse(JSON.stringify(capsuleObj));  // deep clone
  delete stripped.created_at;
  delete stripped.created_by;
  // recursively sort keys for deterministic serialization
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
      return out;
    }
    return v;
  }
  const canonical = JSON.stringify(sortKeys(stripped));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
```

From RESEARCH sec 5.3 (DETERMINISM RULES):
| Source of non-determinism | Mitigation |
|---------------------------|------------|
| fs.readdirSync order      | .sort() before iterating |
| Git commit order          | git log --reverse |
| JSON key order            | sortKeys recursive (above) |
| outputs[] order           | sort by .path ascending |
| files[] order             | sort + dedup |
| bypass_refs[] order       | sort by .id (timestamp-prefixed) |
| source_commits[] order    | git log --reverse stabilizes |

From RESEARCH sec 9.3 (FORWARD-FLOW WIRE-IN; sgsd-orchestrate Step 6.6.i.X):
```javascript
const path = require('path');
const { writeCapsule } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = writeCapsule(planningDir, {
  milestone: '{{version}}',
  phase: '{{phase}}',
  phaseDir: '{{phase_dir}}',
});
// result: { ok: true, path: ".../PHASE-CAPSULE.json", content_hash: "..." }
//      or { ok: false, reason: "..." } -- NEVER throws.
// Capsule failure does NOT block phase advance (lock 13 binds).
```

From RESEARCH sec 9.4 (SAFETY-NET WIRE-IN; sgsd-complete-milestone Step 4.7-bis):
```javascript
const { writeAllCapsulesForMilestone } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const result = writeAllCapsulesForMilestone(planningDir, '{{version}}');
// result: { written: N, skipped: M, errors: [] } -- NEVER throws.
```
</interfaces>

<known_dead_ends>
<!-- HARD FENCES. Do NOT cross. Tasks that violate these are auto-FAIL. -->

1. Do NOT summarize / abbreviate / paraphrase / truncate critical bypass
   `summary` text. Lock 6 binding. F4 self-test asserts byte-for-byte
   equality of bypass_refs[i].summary_passthrough against source
   crit-backlog.jsonl row .summary for 3 seeded rows. The Phase 43 writer
   MUST NOT call .replace, .trim, .substring, .slice, .toLowerCase,
   .toUpperCase, .normalize, .replace(/\s+/g,...) -- ANY string mutation
   on the summary field is auto-FAIL. The ONLY transformation allowed is
   field-rename (`summary` -> `summary_passthrough`) signaling "this text
   was NOT generated by the capsule writer".

2. Do NOT throw upward at the orchestrator boundary from public APIs.
   writeCapsule, writeAllCapsulesForMilestone, readCapsule, capsulePath,
   backfillFromCanonical MUST wrap internals in try/catch; on error
   stderr-warn + return falsey sentinel:
     writeCapsule:                  { ok:false, reason:<msg> }
     writeAllCapsulesForMilestone:  { written:0, skipped:0, errors:[<msg>...] }
     readCapsule:                   null
     capsulePath:                   always string (no failure path)
     backfillFromCanonical:         { written:0, skipped:0, errors:[] }
   Self-test assertion 12 binds. Lock 13 mechanical embodiment: capsule
   write failure NEVER blocks phase advance.

3. Do NOT write to ANY canonical phase-folder file. Phase 43 is READ-ONLY
   against the entire phase folder content tree:
     - {NN}-CONTEXT.md
     - {NN}-RESEARCH.md
     - {NN}-*-PLAN.md
     - {NN}-VERIFICATION.md
     - {NN}-ATC-REVIEW.md (v1.6/v1.7/v1.8 shape)
     - reviews/{NN}-REVIEW.md (v1.9 shape)
     - {NN}-codex-review.md (v1.7+ optional)
     - commit-reviews.jsonl (v1.6/v1.7/v1.8 optional)
     - WASTE.md (rare)
   The ONLY write Phase 43 performs in a phase folder is creating /
   overwriting `PHASE-CAPSULE.json` itself. Self-test assertion 11
   fingerprints 3 sample real phase folders before/after; reasserts
   byte-identical post-test (excluding the new PHASE-CAPSULE.json).

4. Do NOT write to ANY of the 5 canonical metric streams. Phase 43 is
   READ-ONLY against:
     - .planning/metrics/agent-token-spend.jsonl    (Phase 41 owner)
     - .planning/metrics/crit-backlog.jsonl         (lib/crit-backlog.cjs owner)
     - .planning/metrics/gate-value-log.jsonl       (Phase 36 owner)
     - .planning/metrics/review-ledger.jsonl        (Phase 34 owner)
     - .planning/metrics/codex-log.jsonl            (codex-exec.sh owner)
   The 6th stream `.planning/metrics/route-decisions.jsonl` (Phase 32) is
   NOT read either (out of scope per RESEARCH sec 12.1). Self-test
   assertion 11 fingerprints all 5 paths before/after; reasserts
   byte-identical post-test.

5. Do NOT include `created_at` or `created_by` in the content hash.
   These are operational metadata that vary across runs even when the
   underlying canonical sources are byte-identical. Including them would
   make A3 (idempotent rebuild yields equivalent content hashes)
   FALSE for every rebuild. The _capsuleContentHash function MUST
   `delete stripped.created_at` and `delete stripped.created_by` BEFORE
   serialization. F2 self-test (BINDING A3) asserts H1 === H2 for
   write -> delete -> rewrite cycle; if either field is included, F2
   FAILS deterministically.

6. Do NOT redefine ROLES, STATUSES, or PROVIDERS enums. Phase 43 OPTIONALLY
   imports `ROLES` and `ledgerPath` from Phase 41 report.cjs (only when
   token_cost extraction needs role iteration). Phase 43 does NOT import
   STATUSES or PROVIDERS (capsule's STATUS_VOCAB is a different vocabulary
   covering phase-completion outcomes, not envelope-v1 statuses). Adding
   `STATUSES = Object.freeze(['ok','warn','fail',...])` to write.cjs is
   auto-FAIL because (a) it duplicates Phase 41's frozen const, (b) it
   misleads downstream consumers about which vocabulary applies. The
   capsule's STATUS_VOCAB is its own 5-entry closed enum: PASS,
   PASS-WITH-DEFERRED-N, FAIL, UNKNOWN, IN_PROGRESS.

7. Do NOT couple to Phase 45 / Phase 46 / Phase 49 / Phase 51 prematurely.
   Phase 43 EMITS the contract (PHASE-CAPSULE.json shape + JSON Schema)
   that those phases will consume. Phase 43 does NOT import or invoke
   any module from those phases. No `require('../packet-builder/...')`,
   no `require('../sqlite-index/...')`, no `require('../governance/...')`,
   no `require('../benchmark/...')`. The capsule shape is documented in
   `<interfaces>` and frozen via SCHEMA_VERSION. Phase 45/46/49/51 will
   later read these capsules and act on them; Phase 43 SAYS but does not
   DO.

8. Do NOT proliferate docs. Phase 43 ships:
     - super-gsd/tools/phase-capsule/write.cjs (header docblock IS the doc)
     - super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
     - 17 generated PHASE-CAPSULE.json files
     - 4 generated PHASE-INDEX.jsonl files
     - 2 SKILL.md edits (Step 6.6.i.X + Step 4.7-bis)
   Phase 43 MUST NOT create:
     - super-gsd/tools/phase-capsule/README.md
     - super-gsd/tools/phase-capsule/USAGE.md
     - super-gsd/docs/phase-capsule.md
     - .planning/milestones/v1.9/phases/43-phase-capsule-contract/{anything beyond CONTEXT/RESEARCH/PLAN/VERIFICATION + own PHASE-CAPSULE.json + reviews/}
   The header docblock at the top of write.cjs (cite RESEARCH sections,
   REQUIREMENTS, mass-discuss row 43, Locks 5/6/13) is the ONLY new doc
   surface. Phase 41 EXISTING-SURFACE-AUDIT.md:124-144 forbids
   doc proliferation.

9. Do NOT introduce ANY new dependencies. Node built-ins ONLY: fs, path,
   os, crypto, child_process. NO ajv / json-schema-validator / fast-json-
   stringify / yaml / etc. JSON Schema validation is implemented manually
   inside _assertCapsuleSchema (mirror gate-value-log.cjs:_assertEnvelopeV1
   pattern). The lib MUST load in <100ms cold (mirror property preserved
   from Phase 41's <50ms target; capsule writer has heavier extractors
   so 100ms ceiling). package.json + top-level node_modules MUST be
   diff-empty after this phase.

10. Do NOT use `process.cwd()` for the canonical-path default INSIDE the
    lib. Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 41 sec 7.1
    lessons: ALWAYS anchor `realStreams` and `realPhaseDirs` to
    `__dirname` and walk up 3 directories to `.planning`. CLI invocations
    from non-root dirs silently corrupt the wrong tree when this lock is
    broken. The SKILL.md wire-ins (`process.cwd()` at orchestrator-skill
    boundary in Step 6.6.i.X and Step 4.7-bis) are the EXCEPTIONS at the
    boundary; INSIDE the lib, `__dirname` is the ONLY anchor.

11. ASCII ONLY. Phase 39 W4 + Phase 41 + Phase 42 lesson: every non-ASCII
    char in canonical tooling has caused at least one downstream encoding
    bug. Use `--` not em-dashes. Use `->` not arrow glyph. Use `>=` not
    unicode glyph. Straight quotes only. Generated PHASE-CAPSULE.json
    files MUST also be ASCII-only -- if a source canonical file contains
    non-ASCII (which the Phase 40 ASCII gate already prevents at HEAD),
    the capsule writer MUST coerce via JSON.stringify with no special
    handling (default escaping is ASCII-safe). Self-test assertion
    verifies JSON.parse(capsule) round-trips byte-identical.

12. Do NOT split the lib across multiple files. The 5 public APIs
    (writeCapsule, writeAllCapsulesForMilestone, readCapsule, capsulePath,
    backfillFromCanonical) + 4 frozen consts (SCHEMA_VERSION, STATUS_VOCAB,
    BYPASS_KIND_VOCAB, CAPSULE_FILE_KINDS) + 9 private extractors are ONE
    file by RESEARCH sec 15.2 lock. Future Phase 50 cockpit / Phase 45
    packet builder MAY later import selectively without breaking change.
    Phase 43 keeps EVERYTHING in `super-gsd/tools/phase-capsule/write.cjs`.
    The schema file PHASE-CAPSULE.schema.json is a sibling JSON file
    (data, not code).

13. Do NOT change the milestone-close skill ordering. Step 4.7-bis (capsule
    safety-net backfill) is placed AFTER Step 4.7 (token-waste, the
    most-recent soft-warn step) and BEFORE Step 5 (cross-phase check).
    Renumbering Step 4.5 / 4.6 / 4.7 breaks Phase 39 / 40 / 42 wire-ins.
    The Step 6 SUMMARY.md generator is NOT touched in Phase 43 (capsule
    is data not narrative; SUMMARY.md does not embed PHASE-INDEX.jsonl).
    NOTE: Step 4.7-bis is the documented step name; the SKILL.md anchor
    block is `<step_4_7b_phase_capsule_backfill>` (alphabetically follows
    `<step_4_7_token_waste_check>`). Plain numeric "4.7.1" was rejected
    because milestone-close already uses sub-numbering for pre-existing
    sub-steps; "-bis" is unambiguous.

14. Do NOT modify any of the 4 existing contracts:
    - code-reviewer-v1
    - review-providers-v1
    - handover-contract-v2
    - plan-schema-v2
    AND do NOT modify command-envelope-v1. Phase 43 ships a NEW contract
    level (phase-summary, schema_version 1) that is DISTINCT from
    envelope-v1. The PHASE-CAPSULE.schema.json file is the
    self-contained definition; envelope-v1 fields (command, run_id,
    duration_ms, reason_codes, ...) are NOT in PHASE-CAPSULE.schema.json
    by design (capsule is a document; envelope is an event). Phase 31
    reconciliation note `does_not_touch` enforces the 4-existing-
    contracts lock.

15. Do NOT add lifecycle fields (confidence, last_validated, supersedes,
    superseded_by, allowed_consumers, clearance_requires,
    deprecation_reason). These are Phase 49 GOV-03 surface; if Phase 43
    pre-emptively adds them, Phase 49 schema design is constrained to
    backward-compat trivia. Per RESEARCH sec 4.2: lifecycle fields are
    optional v1 extensions (additionalProperties:false at top-level
    BLOCKS them; Phase 49 will introduce schema_version=2 OR add fields
    to definitions/PhaseCapsule with additionalProperties:true escape).
    Phase 43's schema MUST NOT pre-allocate them.

16. Do NOT extract decisions / debt / downstream-contract via LLM
    judgment or fuzzy heuristics. Per RESEARCH sec 7.4: extraction is
    PURELY MECHANICAL string-copy from named locations:
      decisions:           CONTEXT.md frontmatter discuss_decisions[N]
                           -> mass-discuss.md row N text VERBATIM,
                           CONTEXT.md `## Locked decision` body VERBATIM,
                           RESEARCH.md `## Open Derivation Calls -- LOCKED`
                           table rows VERBATIM
      debt:                crit-backlog count for this phase + WARN count
                           parsed from VERIFICATION.md unresolved + ATC-REVIEW
                           WARN section
      downstream_contract: RESEARCH.md `## Cross-Phase Contract` prose +
                           CONTEXT.md unblocks: frontmatter
    Calling Anthropic / OpenAI / any LLM at extraction time is auto-FAIL.
    The capsule writer is purely deterministic local extraction.
</known_dead_ends>

<reason_codes>
<!-- Closed initial vocabulary. Failures append to context-complaints.jsonl -->
<!-- with one of these reason_codes; Phase 49 governance reads them. -->

Per-capsule failure reasons (added to context-complaints.jsonl row's reason_codes when writeCapsule returns ok:false):
- `phase_capsule_write_context_missing`     -- {NN}-CONTEXT.md absent
- `phase_capsule_write_research_missing`    -- {NN}-RESEARCH.md absent
- `phase_capsule_write_plan_missing`        -- no {NN}-*-PLAN.md found
- `phase_capsule_write_verification_missing`-- {NN}-VERIFICATION.md absent
- `phase_capsule_write_phase_dir_invalid`   -- folder name lacks ^\d+- prefix
- `phase_capsule_write_schema_invalid`      -- _assertCapsuleSchema raised
- `phase_capsule_write_git_unavailable`     -- git log execSync threw
- `phase_capsule_write_crit_backlog_unreadable` -- crit-backlog.jsonl exists but unparseable
- `phase_capsule_write_unexpected_error`    -- catch-all for unforeseen exception classes

Per-backfill-run reasons (added to context-complaints.jsonl row when writeAllCapsulesForMilestone errors are non-empty):
- `phase_capsule_backfill_milestone_missing`    -- milestones/{ms}/phases/ does not exist
- `phase_capsule_backfill_partial`              -- some phases written, some errored
- `phase_capsule_backfill_index_unreadable`     -- PHASE-INDEX.jsonl exists but unparseable

Self-test/error reasons:
- `phase_capsule_self_test_pass`            -- --self-test exit 0
- `phase_capsule_self_test_fail`            -- --self-test failed assertion
- `phase_capsule_bad_invocation`            -- CLI argv malformed (only path to non-zero exit)
</reason_codes>

<tasks>

<task type="auto" tdd="true">
  <name>Task T1: write.cjs lib + PHASE-CAPSULE.schema.json + 13-assertion self-test (RED-GREEN-REFACTOR)</name>
  <files>super-gsd/tools/phase-capsule/write.cjs, super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json</files>
  <behavior>
    The lib MUST satisfy these behaviors. The 13 self-test assertions
    describe these behaviors before implementation lands; implementation
    passes when --self-test exits 0 with literal stdout last line:
    `phase-capsule self-test: 13 pass, 0 fail`.

    BEHAVIOR 1: Frozen const enums + module structure (RESEARCH sec 4 + sec 15.2)
      - SCHEMA_VERSION = 1 (integer)
      - STATUS_VOCAB = Object.freeze(['PASS','PASS-WITH-DEFERRED-N','FAIL','UNKNOWN','IN_PROGRESS'])
      - BYPASS_KIND_VOCAB = Object.freeze([
          'verifier_fail',     // F4 fixture row uses this kind
          'edge_guard_miss',
          'security_issue',
          'privacy_issue',
          'destructive_op',
          'provider_outage',
          'stack_trace',
        ])
      - CAPSULE_FILE_KINDS = Object.freeze(['context','research','plan','verification','atc_review'])
      - All frozen; mutation attempts MUST fail silently in non-strict
        or throw in strict (assertion 5 confirms via
        `try{STATUS_VOCAB.push('FOO')}catch{}` then asserts length=5
        unchanged).
      - Phase 41 OPTIONAL imports (try/catch wrapped):
          try {
            const phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
            ROLES = phase41.ROLES;
            ledgerPath = phase41.ledgerPath;
          } catch (_e) {
            ROLES = Object.freeze(['researcher','planner','executor','verifier','reviewer','orchestrator','classifier','other']);
            ledgerPath = (planningDir) => path.join(planningDir, 'metrics', 'agent-token-spend.jsonl');
          }
        Phase 41 import failure does NOT block lib load.
      - Header docblock cites: 43-RESEARCH.md sections 4 (schema), 5 (hash + idempotency), 6 (critical bypass), 7 (decisions/debt/contract), 8 (source commits), 9 (backfill + integration), 10 (self-test), 12 (read-only invariant), 14 (cross-phase contract), 15 (single plan recommendation); REQUIREMENTS.md:40-50 (Locks 5+6 verbatim); REQUIREMENTS.md:113-119 (CAP-01..05); mass-discuss row 43 (controlling correctness rule). NO mention of `gate` / `keep` / `kill` / `token-waste` / `token-attribution` (Phase 41/42/39 leakage forbidden per RESEARCH sec 15.3 risk row 1).

    BEHAVIOR 2: PHASE-CAPSULE.schema.json (sibling file; ~150 LOC)
      - Path: super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
      - Content: closed-shape schema per <interfaces> block above
        (additionalProperties:false; 17 required + 1 optional = 18 fields;
        nested definitions for PhaseOutput, Decision, DebtCounts,
        DownstreamContract, BypassRef, GitCommit, SourceHashes, HashedFile,
        GateOutcomes, TokenCostRefs).
      - $id: "phase-capsule-v1"
      - $schema: draft-07
      - File MUST be ASCII-only, LF endings, valid JSON (parseable via JSON.parse).
      - schema_version constraint: {"type":"integer","const":1}
      - status enum: 5 values closed: PASS, PASS-WITH-DEFERRED-N, FAIL, UNKNOWN, IN_PROGRESS
      - GitCommit.sha pattern: ^[0-9a-f]{40}$ (40 hex; full SHA from git log)
      - HashedFile.sha256 pattern: ^[0-9a-f]{64}$ (sha256 hex64)

    BEHAVIOR 3: __dirname-anchored canonical guards + fingerprint paths
      - REAL_PLANNING_DIR  = path.resolve(__dirname, '..', '..', '..', '.planning')
      - REAL_STREAMS = [
          path.join(REAL_PLANNING_DIR, 'metrics', 'agent-token-spend.jsonl'),
          path.join(REAL_PLANNING_DIR, 'metrics', 'crit-backlog.jsonl'),
          path.join(REAL_PLANNING_DIR, 'metrics', 'gate-value-log.jsonl'),
          path.join(REAL_PLANNING_DIR, 'metrics', 'review-ledger.jsonl'),
          path.join(REAL_PLANNING_DIR, 'metrics', 'codex-log.jsonl'),
        ]
      - REAL_SAMPLE_PHASE_DIRS = [
          path.join(REAL_PLANNING_DIR, 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
          path.join(REAL_PLANNING_DIR, 'milestones', 'v1.8', 'phases', '40-phase-folder-audit'),
          path.join(REAL_PLANNING_DIR, 'milestones', 'v1.9', 'phases', '41-baseline-token-attribution'),
        ]
      - _fingerprint(paths) -> Map<path, {exists, mtimeMs, size}> for
        before/after read-only invariant verification
      - Self-test assertion 11 captures fingerprints BEFORE setup;
        reasserts byte-identical AFTER cleanup; per-phase-dir excludes
        the new PHASE-CAPSULE.json (which IS Phase 43's owned write).

    BEHAVIOR 4: Private extractors (RESEARCH sec 7 + 8; 9 functions)

      4.1 _readContextDecisions(contextPath, massDiscussPath) -> Decision[]
          - Reads {NN}-CONTEXT.md
          - Frontmatter parsed via simple regex (no yaml dep);
            extracts `discuss_decisions:` array of integers
          - For each integer N, opens mass-discuss.md (path provided),
            extracts row N text VERBATIM (including all CR/LF, whitespace,
            unicode -- NO normalization, NO .trim, NO .replace);
            returns Decision { id: `MD-${N}`, source: `${massDiscussPath}:row-${N}`, text: <verbatim> }
          - Also extracts `## Locked decision` section body verbatim
            -> Decision { id: `${phase}-locked`, source: `${contextPath}:locked-decision`, text: <verbatim> }
          - Missing CONTEXT.md -> returns []
          - mass-discuss.md absent -> emits Decision { id: 'MD-N', source: ..., text: '<mass-discuss unavailable>' } NO. Per dead-end #1 + RESEARCH sec 7.1 the verbatim rule means: missing source -> SKIP that decision (do not synthesize text); decision array smaller; debt counts unaffected.

      4.2 _readResearchOpenDerivations(researchPath) -> Decision[]
          - Reads {NN}-RESEARCH.md
          - Locates `## Open Derivation Calls -- LOCKED` section header
            (case-sensitive substring match)
          - Extracts table rows verbatim (line-by-line); each row's
            text becomes Decision.text VERBATIM (including pipes,
            backticks, etc. -- NO content modification; one Decision
            per non-header table row)
          - Missing section -> returns []

      4.3 _readVerificationDebt(verificationPath, atcReviewPath, planningDir, milestone, phase) -> DebtCounts
          - critical_added: count of crit-backlog.jsonl rows where
            row.milestone === milestone AND String(row.phase) === String(phase)
          - warnings_added: parse VERIFICATION.md `unresolved_count:` frontmatter
            field if present; else count `WARN` lines in ATC-REVIEW.md
            `## Findings` section; if both absent -> null
          - edge_guard_miss_added: count of edge-guard-log.jsonl rows
            (if file exists) for this milestone+phase; else 0
          - deferred_added: count of crit-backlog rows with
            tagged_for_milestone === 'next-debt-milestone'
          - carried_forward_total: count of crit-backlog rows where
            resolved_at === null (open globally; informational)
          - VERIFICATION.md missing -> warnings_added: null; rest as
            available (status fallback in _deriveStatus)

      4.4 _readDownstreamContract(researchPath, contextPath) -> DownstreamContract
          - consumers: from CONTEXT.md frontmatter `unblocks:` array
            + RESEARCH.md cross-phase references (regex
            `Phase \d+ [A-Z]+-\d{2}` in `## Cross-Phase Contract` section);
            sorted ascending; deduplicated
          - constraints: copy verbatim from RESEARCH.md `## Cross-Phase Contract`
            constraints subsection (line-by-line); empty if section missing
          - extension_points: copy verbatim from RESEARCH.md
            "may extend" / "may add" / "extension protocol" prose lines;
            empty if absent
          - Both files missing -> returns
            { consumers: [], constraints: [], extension_points: [] }

      4.5 _gatherBypassRefs(milestone, phase, planningDir) -> BypassRef[]  (LOCK 6 BINDING)
          - Reads .planning/metrics/crit-backlog.jsonl line by line
          - For each parseable line (try/catch JSON.parse, skip on failure):
            * if row.milestone === milestone AND String(row.phase) === String(phase):
                refs.push({
                  stream: 'crit-backlog.jsonl',
                  id: row.id,                       // VERBATIM
                  kind: row.kind,                   // VERBATIM
                  summary_passthrough: row.summary, // VERBATIM (LOCK 6)
                  evidence_path: row.evidence_path || null,
                  tagged_for_milestone: row.tagged_for_milestone || null,
                });
          - **CRITICAL**: NEVER mutate row.summary. NO .replace, .trim,
            .substring, .slice, .toLowerCase, .toUpperCase, .normalize.
            field-rename only.
          - Sort refs ascending by .id (timestamp-prefixed -> deterministic;
            tie-break by string compare)
          - File missing / unreadable -> returns [] (NEVER throws)

      4.6 _gatherSourceCommits(phaseDir, gitRoot) -> GitCommit[]
          - Invokes `git log --pretty=format:%H||%s||%cI --reverse -- <phaseDir>`
            via child_process.execSync (timeout: 5000ms; encoding: 'utf8';
            cwd: gitRoot ?? process.cwd())
          - Splits output on '\n', filters empty, parses on '||':
            { sha, subject, ts }
          - sha validated against /^[0-9a-f]{40}$/; non-matching rows skipped
          - git unavailable / phaseDir missing -> returns [] (caught
            by try/catch; reason 'phase_capsule_write_git_unavailable'
            returned in writeCapsule reason field)

      4.7 _gatherSourceHashes(phaseDir) -> SourceHashes
          - Probes 5 file kinds:
            * context: {phaseDir}/{NN}-CONTEXT.md
            * research: {phaseDir}/{NN}-RESEARCH.md
            * plan: glob {phaseDir}/{NN}-*-PLAN.md (multiple supported; array)
            * verification: {phaseDir}/{NN}-VERIFICATION.md
            * atc_review: probe order:
                1. {phaseDir}/reviews/{NN}-REVIEW.md (v1.9 shape)
                2. {phaseDir}/{NN}-ATC-REVIEW.md (v1.6/v1.7/v1.8 shape)
                first existing wins; null if neither
          - {NN} extracted from phaseDir basename via /^(\d+(?:\.\d+)?)-/ regex
          - For each existing path: sha256 of file bytes (no normalization,
            no encoding coercion); shape: { path: <relative-to-planningDir-parent>, sha256: <hex64> }
          - Missing file -> field is null
          - plan field is ALWAYS array (zero or more PLAN.md files);
            sorted ascending by path

      4.8 _gatherGates(milestone, phase, planningDir, atcReviewPath) -> GateOutcomes
          - verifier: parse {NN}-VERIFICATION.md status frontmatter
            (regex `verdict:\s*(PASS|FAIL|...)`); shape:
            { verdict: <string>, ref: <relative-path> }
            VERIFICATION.md missing -> null
          - atc_review: parse atcReviewPath (already resolved by
            _gatherSourceHashes dual-shape detection); count CRIT and WARN
            sections; shape:
            { path: <rel>, verdict: <string>, crit_count: N, warn_count: N }
            atc_review missing -> null
          - phase_level_atc_runs: read gate-value-log.jsonl;
            filter rows where row.phase === phase AND row.milestone === milestone;
            shape: [{ run_id, outcome }, ...]
          - codex_runs: read codex-log.jsonl;
            filter rows where row.phase === phase AND row.milestone === milestone;
            shape: [{ run_id, exit, fallback_triggered }, ...]
          - review_verdict (optional): read review-ledger.jsonl;
            filter; latest entry only; null if absent

      4.9 _gatherTokenCost(milestone, phase, planningDir) -> TokenCostRefs | null
          - Reads ledgerPath(planningDir) (Phase 41 import or fallback)
          - Filter rows by milestone+phase
          - For each ROLES enum value, find latest matching row;
            shape: { role, total_tokens, evidence_event_id }
          - Roles with no match: value is null
          - File missing / Phase 41 import failed -> returns null
            (top-level token_cost field is null; preserved for diff)

      4.10 _deriveStatus(verificationPath, debt) -> string (closed enum)
          - VERIFICATION.md missing -> 'IN_PROGRESS'
          - Frontmatter `verdict: PASS` AND debt.deferred_added === 0 -> 'PASS'
          - Frontmatter `verdict: PASS` AND debt.deferred_added > 0
            -> 'PASS-WITH-DEFERRED-' + debt.deferred_added (concrete N)
          - Frontmatter `verdict: FAIL` -> 'FAIL'
          - Frontmatter unparseable -> 'UNKNOWN'

    BEHAVIOR 5: _capsuleContentHash(capsuleObj) -> string  (A3 BINDING)
      - Deep-clone via JSON.parse(JSON.stringify(capsuleObj))
      - delete stripped.created_at
      - delete stripped.created_by
      - Recursive sortKeys (handles arrays + nested objects):
          if Array.isArray(v) -> v.map(sortKeys)
          if (v && typeof v==='object') -> {k: sortKeys(v[k]) for k in Object.keys(v).sort()}
          else -> v
      - canonical = JSON.stringify(sortKeys(stripped))
      - return crypto.createHash('sha256').update(canonical).digest('hex')
      - Self-test F2 BINDING A3: write -> H1; delete capsule; rewrite ->
        H2; assert H1 === H2.

    BEHAVIOR 6: _normalize + _assertCapsuleSchema + _writeCapsuleInternal trio
      - _normalize(partial) -> capsuleObj
        * Fills defaults: empty arrays for outputs/files/decisions/bypass_refs/source_commits,
          object shells for debt/downstream_contract/source_hashes/gates,
          null for token_cost
        * Sets created_at = new Date().toISOString()
        * Sets created_by = `super-gsd/tools/phase-capsule/write.cjs@${gitsha}` where
          gitsha = first 12 chars of process.env.npm_package_gitHead OR
                   first 12 chars of execSync('git rev-parse HEAD') OR
                   'unknown' on failure
        * Returns enriched object (NEVER throws)
      - _assertCapsuleSchema(obj) -> void (throws Error on violation)
        * Loads PHASE-CAPSULE.schema.json from sibling path
        * Manual validator (no ajv dep): checks 17 required fields present,
          types per schema, status in STATUS_VOCAB, source_commits[].sha
          matches /^[0-9a-f]{40}$/, source_hashes.*.sha256 matches
          /^[0-9a-f]{64}$/, additionalProperties:false enforcement on
          top-level (rejects unknown keys), schema_version === 1
        * On violation: throw Error('phase-capsule schema invalid: <field> <reason>')
      - _writeCapsuleInternal(planningDir, capsuleObj) -> {ok, path, content_hash} | throws
        * Validates via _assertCapsuleSchema (raises on violation)
        * Resolves capsulePath(planningDir, milestone, phase)
        * Ensures parent dir exists (mkdir -p)
        * Atomic write via tmpfile + rename:
            tmp = path + '.tmp.' + process.pid
            fs.writeFileSync(tmp, JSON.stringify(capsuleObj, null, 2) + '\n', 'utf8')
            fs.renameSync(tmp, path)
        * Computes content_hash via _capsuleContentHash
        * Returns { ok:true, path, content_hash }
      - All three are PRIVATE (not exported); public APIs wrap them in try/catch.

    BEHAVIOR 7: Public APIs (5 functions; NEVER throw upward)

      7.1 writeCapsule(planningDir, opts) -> { ok, path, content_hash } | { ok, reason }
          - opts: { milestone, phase, phaseDir }
          - phaseDir basename MUST match /^(\d+(?:\.\d+)?)-/; else returns
            { ok:false, reason:'phase_capsule_write_phase_dir_invalid' }
          - Calls 9 extractors (try/catch each; record per-extractor reason
            on failure but continue with null/empty defaults; lock 13)
          - Builds partial capsule:
              {
                schema_version: 1,
                milestone, phase,
                phase_name: <derived from phaseDir basename suffix or CONTEXT.md frontmatter>,
                status: _deriveStatus(...),
                goal: <extracted from CONTEXT.md `Goal:` line; '' if missing>,
                outputs: <derived from RESEARCH.md `## 14 Cross-Phase Contract` outputs subsection or _gatherSourceHashes-derived stub>,
                files: <derived from source_commits[*] file lists via git show --stat;
                        sorted ascending; deduplicated>,
                decisions: _readContextDecisions + _readResearchOpenDerivations concatenated,
                debt: _readVerificationDebt(...),
                downstream_contract: _readDownstreamContract(...),
                bypass_refs: _gatherBypassRefs(...),
                source_commits: _gatherSourceCommits(...),
                source_hashes: _gatherSourceHashes(...),
                gates: _gatherGates(...),
                token_cost: _gatherTokenCost(...),
              }
          - _normalize fills created_at + created_by + defaults
          - _writeCapsuleInternal validates + writes + hashes
          - On ANY error: catch + log to context-complaints.jsonl
            (envelope-v1 row with reason_code from <reason_codes>) + return
            { ok:false, reason: <error message> }
          - On success: ALSO appends/replaces row in PHASE-INDEX.jsonl
            (BEHAVIOR 8 below)

      7.2 writeAllCapsulesForMilestone(planningDir, milestone) -> { written, skipped, errors }
          - Walks .planning/milestones/{milestone}/phases/ (mirror Phase 40
            auditAllPhases discovery; readdirSync + filter by /^\d+-/)
          - For each phase folder: extract phase id from /^(\d+(?:\.\d+)?)-/;
            call writeCapsule({ milestone, phase, phaseDir })
          - On capsule already exists with matching content_hash: skip
            (preserves mtime); count++
          - On write success: count++
          - On error: errors.push(reason)
          - Returns { written, skipped, errors }; NEVER throws

      7.3 readCapsule(planningDir, milestone, phase) -> capsuleObj | null
          - Resolves capsulePath; returns JSON.parse of contents
          - File missing / parse fail -> returns null

      7.4 capsulePath(planningDir, milestone, phase) -> string
          - Returns path.join(planningDir, 'milestones', milestone, 'phases',
            `<NN-name>`, 'PHASE-CAPSULE.json') where NN-name resolved via
            phaseDir search
          - On unresolvable: returns synthetic path (still a string)

      7.5 backfillFromCanonical(planningDir, opts) -> { written, skipped, errors }
          - opts: { milestone?, all? }
          - opts.all: walk all milestones under .planning/milestones/
          - opts.milestone: scope to single milestone
          - Calls writeAllCapsulesForMilestone per milestone
          - Aggregates totals; NEVER throws

    BEHAVIOR 8: PHASE-INDEX.jsonl append-or-replace (atomic; idempotent)
      - Path: path.join(planningDir, 'milestones', <ms>, 'PHASE-INDEX.jsonl')
      - Row shape: { milestone, phase, phase_name, status, capsule_path,
        content_hash, created_at }
      - Write protocol: read existing file (if present), parse line by line,
        replace row where (milestone, phase) match, append if no match,
        write to tmpfile, rename to target (atomic)
      - On read failure: treat as empty file
      - Self-test assertion 13: write capsule for (X, Y) twice; PHASE-INDEX
        contains exactly ONE row for (X, Y); content_hash reflects latest
        write.

    BEHAVIOR 9: 13 self-test assertions (RESEARCH sec 10)
      Fixtures (4 named):
        F1 write/read:
          tmpdir/v1.test/phases/99-fixture-phase/{99-CONTEXT.md, 99-RESEARCH.md,
          99-01-PLAN.md, 99-VERIFICATION.md, 99-ATC-REVIEW.md}.
          Seed minimal valid content (frontmatter + sections).
          Call writeCapsule -> { ok:true, path, content_hash }.
          JSON.parse the written file; _assertCapsuleSchema passes;
          all 17 required fields present; schema_version === 1; status in
          STATUS_VOCAB; created_by matches 'super-gsd/tools/phase-capsule/write.cjs@'.
        F2 rebuild equivalence (BINDING A3):
          F1 setup + writeCapsule -> H1 = result.content_hash;
          fs.unlinkSync(result.path);
          writeCapsule again -> H2 = result.content_hash;
          assert H1 === H2.
          Edge cases verified:
            - source_commits order is identical (git log --reverse stabilizes)
            - source_hashes values identical (sha256 of unchanged source files)
            - bypass_refs identical (sorted ascending by .id)
            - decisions identical (verbatim copy from same source)
            - created_at + created_by stripped via _capsuleContentHash before hash.
        F3 missing-file graceful (lock 13):
          tmpdir/v1.test/phases/99-fixture-phase/ contains ONLY 99-CONTEXT.md.
          writeCapsule -> { ok:true, ... } (NEVER throws).
          status === 'IN_PROGRESS'; verification === null; atc_review === null;
          source_hashes.research === null; source_hashes.verification === null;
          source_hashes.atc_review === null; debt.warnings_added === null;
          bypass_refs === [] (no crit-backlog rows for fixture milestone);
          context-complaints.jsonl gains a row with
          reason 'phase_capsule_write_research_missing' or similar.
        F4 critical-bypass preserved (BINDING A2 + LOCK 6):
          Seed crit-backlog.jsonl in tmpdir with 3 rows for milestone='v1.test'
          phase='99'. Each row's .summary is a unique multiword string with
          punctuation (e.g., "Codex auth unavailable; per-dispatch ATC for
          commit abc123 used Claude only.").
          writeCapsule -> result.path written.
          Read written capsule; assert:
            * bypass_refs.length === 3
            * bypass_refs[i].summary_passthrough byte-equal source row .summary
              (Buffer.compare on Buffer.from(...,'utf8'))
            * bypass_refs sorted ascending by .id
            * NO call to .replace / .trim / .substring / .slice (verified
              by patching String.prototype temporarily before writeCapsule
              and asserting no calls; cleanup after).
      Secondary assertions (9):
        5. SCHEMA_VERSION === 1; STATUS_VOCAB frozen 5-entry, mutation
           silently fails / throws in strict; BYPASS_KIND_VOCAB frozen
           7-entry; CAPSULE_FILE_KINDS frozen 5-entry.
        6. PHASE-CAPSULE.schema.json parses as valid JSON; required array
           has 17 entries; schema_version constraint is integer const 1;
           status enum has 5 entries.
        7. Decisions extraction verbatim: seed CONTEXT.md with
           `discuss_decisions: [42]`; seed mass-discuss.md with row 42 text
           "Locked decision: example with **markdown** and `code`.";
           writeCapsule; assert decisions[i].text byte-equal source
           (Buffer.compare).
        8. source_commits ordering: seed git history with 3 commits
           touching the fixture phase folder; assert source_commits[]
           ordered by oldest-first (git log --reverse); each has sha
           (40 hex), subject (string), ts (ISO-8601).
        9. source_hashes 5-key shape: F1 setup; assert keys are exactly
           ['context','research','plan','verification','atc_review'];
           plan is array; each non-null value has {path, sha256}; sha256
           is 64 hex chars matching /^[0-9a-f]{64}$/; recompute manually
           and assert equality.
        10. Dual phase-folder shape detection:
            (a) Setup tmpdir/v1.test/phases/99-foo/ with reviews/99-REVIEW.md
                (no 99-ATC-REVIEW.md); writeCapsule; assert
                source_hashes.atc_review.path ends with 'reviews/99-REVIEW.md'.
            (b) Setup tmpdir/v1.test/phases/99-bar/ with 99-ATC-REVIEW.md
                (no reviews/); writeCapsule; assert
                source_hashes.atc_review.path ends with '99-ATC-REVIEW.md'.
            (c) Setup tmpdir/v1.test/phases/99-baz/ with NEITHER;
                writeCapsule; assert source_hashes.atc_review === null.
        11. Read-only invariant: capture _fingerprint over REAL_STREAMS +
            REAL_SAMPLE_PHASE_DIRS BEFORE --self-test; run --self-test;
            recapture; assert byte-identical (mtimeMs same, size same,
            exists same) for all 8 paths. EXCLUSION: PHASE-CAPSULE.json
            files in REAL_SAMPLE_PHASE_DIRS may exist after --backfill
            but --self-test alone does not write to them; explicit
            assertion is "no NEW PHASE-CAPSULE.json appeared in real
            phase folders during --self-test execution".
        12. Public API never throws upward: poison _writeCapsuleInternal
            by setting opts.phaseDir to a non-existent path;
            writeCapsule returns { ok:false, reason: <string> } (NO uncaught
            exception). Same for writeAllCapsulesForMilestone with
            non-existent milestone -> { written:0, skipped:0, errors:[<msg>] }.
            Same for readCapsule with non-existent file -> null.
            All wrapped in try/catch in self-test runner.
        13. PHASE-INDEX.jsonl idempotent: write capsule for (v1.test, 99)
            with content X; assert PHASE-INDEX.jsonl has 1 row;
            modify a source file; rewrite capsule (content Y);
            assert PHASE-INDEX.jsonl STILL has 1 row (replaced in place,
            not appended); content_hash field reflects Y, not X.

    BEHAVIOR 10: CLI argv (run as `node write.cjs ...`)
      - --self-test                 : run 13-assertion self-test;
                                      stdout last line "phase-capsule
                                      self-test: 13 pass, 0 fail"; exit 0/1
      - --backfill --all            : backfill all milestones; exit 0
      - --backfill --milestone <id> : scope filter; exit 0
      - --phase <id> --milestone <id> --phase-dir <path>
                                    : single-phase rebuild; exit 0
      - --dry-run                   : compute capsule but do NOT write
                                      to disk; print path + content_hash
                                      to stdout; exit 0
      - --json                      : print result as JSON to stdout
      - --help                      : print usage; exit 0
      - Unknown flag / missing required arg : exit 2 (bad_invocation)

    BEHAVIOR 11: ASCII enforcement
      - write.cjs source file: byte-scan via Node `charCodeAt > 127` ->
        reject; verify via verification block.
      - PHASE-CAPSULE.schema.json: byte-scan -> reject non-ASCII.
      - Generated PHASE-CAPSULE.json files: JSON.stringify default ASCII-
        escaping handles unicode in source text (e.g., decision text).
        No special handling needed; JSON.parse round-trip is bijective.
      - PHASE-INDEX.jsonl rows: same as PHASE-CAPSULE.json.

    BEHAVIOR 12: Module exports (sorted by key for deterministic destructure)
      - module.exports = {
          BYPASS_KIND_VOCAB,
          CAPSULE_FILE_KINDS,
          SCHEMA_VERSION,
          STATUS_VOCAB,
          backfillFromCanonical,
          capsulePath,
          readCapsule,
          writeAllCapsulesForMilestone,
          writeCapsule,
        }
      - 4 frozen consts + 5 public APIs = 9 exports.
      - Self-test assertion 5 checks Object.keys(module.exports).sort()
        equals the 9-key list.
  </behavior>
  <action>
File 1 of 2: `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` (NEW; ~150 LOC).
  - Exact content per <interfaces> block above. ASCII-only. LF.
  - Validates as JSON via `node -e "JSON.parse(require('fs').readFileSync('...','utf8'))"`.

File 2 of 2: `super-gsd/tools/phase-capsule/write.cjs` (NEW; ~700 LOC).

Open by mirroring `super-gsd/tools/phase-folder-audit/audit.cjs` (walker
discovery), `super-gsd/scripts/lib/gate-value-log.cjs` (envelope-style
trio + frozen consts), `super-gsd/tools/token-attribution/report.cjs`
(envelope-v1 emitter + module structure + self-test scaffold), and
`super-gsd/tools/token-waste/check.cjs` (read-only check + never-throws
+ fingerprint guard) line by line. Substitute:

  audit / phase-folder-audit -> write / phase-capsule
  auditFolder                -> writeCapsule (different return shape)
  auditAllPhases             -> writeAllCapsulesForMilestone
  renderTable                -> NOT NEEDED (capsule is JSON; no human render)
  RECOMMENDED_FILES list     -> CAPSULE_FILE_KINDS (5-entry)
  verdict (3-state)          -> status (5-state STATUS_VOCAB)
  envelope-v1 schema check   -> PHASE-CAPSULE.schema.json closed-shape check
  fs.appendFileSync row      -> fs.writeFileSync document (overwrite)
  run_id / duration_ms       -> NOT PRESENT (capsule is document, not event)
  command discriminator      -> NOT PRESENT
  reason_codes (envelope)    -> NOT IN CAPSULE; only in context-complaints rows

ADDED public API not present in mirror sources:
  writeCapsule           (writes one capsule for one phase)
  writeAllCapsulesForMilestone (walks one milestone)
  readCapsule            (JSON.parse of stored file)
  capsulePath            (resolves stored file location)
  backfillFromCanonical  (entry point for --backfill CLI mode)

REMOVED: classifyGate, _filterReviewRowsForGate, _computePassRate,
auditAllPhases (rename to writeAllCapsulesForMilestone), runRubric,
runCheck, _classifyRow, ROUTE_REASONS, BUDGETS, _loadBudgets,
_assertEnvelopeV1 (rename to _assertCapsuleSchema), appendCheckRun
(replaced by _writeCapsuleInternal + PHASE-INDEX appender), summarize,
backfillFromMetrics, RUN_ID_REGEX, COMMAND_NAME, ENVELOPE_VERSION
(envelope-specific; capsule has SCHEMA_VERSION instead).

Header docblock MUST be rewritten (do NOT leave `gate` / `keep` / `kill`
/ `token-waste` / `token-attribution` / `phase-folder-audit` references
in the prose; the header docblock cites mirror sources but is itself
about phase-capsule). Risk row 1 in RESEARCH sec 15.3 explicitly flags
mirror-name leakage. The header cites:
  - 43-RESEARCH.md sections 1 (goal + acceptance), 4 (schema), 5 (hash +
    idempotency), 6 (critical bypass), 7 (decisions/debt/contract), 8
    (source commits), 9 (backfill + integration), 10 (self-test), 12
    (read-only invariant), 14 (cross-phase contract), 15 (single plan
    recommendation)
  - REQUIREMENTS.md:40-50 (Locks 5 + 6 verbatim)
  - REQUIREMENTS.md:67-68 (Lock 13 verbatim)
  - REQUIREMENTS.md:113-119 (CAP-01..05 verbatim)
  - .planning/discussions/2026-04-26-mass-discuss.md:238 (mass-discuss
    row 43 "Compress prior-phase context; canonical = .planning + git,
    capsule = projection.")
  - super-gsd/tools/phase-folder-audit/audit.cjs (Phase 40 walker mirror)
  - super-gsd/scripts/lib/gate-value-log.cjs (Phase 36 writer trio mirror)
  - super-gsd/tools/token-attribution/report.cjs (Phase 41 envelope-v1
    emitter mirror)
  - super-gsd/tools/token-waste/check.cjs (Phase 42 never-throws +
    read-only invariant mirror)

Skeleton: mirror audit.cjs:1-100 + gate-value-log.cjs:1-280 verbatim with
the substitutions table above. The header docblock is the ONLY place
prior phase / mirror sources appear by name; do NOT leak them into
function bodies / error messages / runtime logs.

Public surface (line-anchor sketch):
  L1-L100   : header docblock + use strict + requires
              (fs/path/os/crypto/child_process)
  L101-L130 : Phase 41 OPTIONAL imports (try/catch wrapped)
  L131-L180 : 4 frozen consts (SCHEMA_VERSION, STATUS_VOCAB,
              BYPASS_KIND_VOCAB, CAPSULE_FILE_KINDS) + REAL_PLANNING_DIR +
              REAL_STREAMS + REAL_SAMPLE_PHASE_DIRS + SCHEMA_PATH
  L181-L260 : 9 private extractors (_readContextDecisions,
              _readResearchOpenDerivations, _readVerificationDebt,
              _readDownstreamContract, _gatherBypassRefs,
              _gatherSourceCommits, _gatherSourceHashes, _gatherGates,
              _gatherTokenCost) -- inline; ~10 LOC each
  L261-L300 : _deriveStatus + _capsuleContentHash + _fingerprint helpers
  L301-L380 : _normalize + _assertCapsuleSchema + _writeCapsuleInternal trio
  L381-L420 : _appendOrReplaceIndexRow (PHASE-INDEX.jsonl idempotent writer)
  L421-L460 : _logComplaint (context-complaints.jsonl envelope-v1 writer
              for failure cases; mirrors gate-value-log.cjs:_appendRowInternal
              VERBATIM with command='phaseCapsuleComplaint')
  L461-L520 : writeCapsule (BEHAVIOR 7.1; top-level try/catch around all I/O)
  L521-L560 : writeAllCapsulesForMilestone (BEHAVIOR 7.2)
  L561-L580 : readCapsule + capsulePath (BEHAVIOR 7.3 + 7.4)
  L581-L610 : backfillFromCanonical (BEHAVIOR 7.5)
  L611-L780 : _selfTest (BEHAVIOR 9; 13 assertions; F1-F4 fixtures
              + 9 secondary; tmpdir-only writes; fingerprint pre/post)
  L781-L820 : CLI argv parser (BEHAVIOR 10; bad invocation -> exit 2)
  L821-L840 : module.exports (BEHAVIOR 12; 9 keys sorted)

Reference assemblies for each block:
  - phase-folder-audit/audit.cjs (walker discovery + dual phase-folder
    shape detection; auditAllPhases verbatim; RECOMMENDED_FILES list shape)
  - gate-value-log.cjs (envelope writer trio + frozen consts + manual
    schema validator + __dirname guard + fingerprint pattern)
  - token-attribution/report.cjs (module structure + self-test scaffold +
    13-assertion runner; mirror the runner shape exactly; mirror
    `phase-capsule self-test: 13 pass, 0 fail` final-line literal)
  - token-waste/check.cjs (never-throws-upward contract; runCheck
    shape -> writeCapsule shape; CLI argv parser pattern; bad-invocation
    exit 2)

Run --self-test and verify ALL 13 PASS:

```bash
node super-gsd/tools/phase-capsule/write.cjs --self-test
# Expected stdout last line: "phase-capsule self-test: 13 pass, 0 fail"
# Exit code: 0
```

Acceptance gates (full battery in <verification> block at end of PLAN; the
subset that MUST pass for this task in particular):

1. --self-test exits 0 with literal stdout last line:
   "phase-capsule self-test: 13 pass, 0 fail".
2. require(write.cjs) exports exactly 9 keys (sorted):
   BYPASS_KIND_VOCAB, CAPSULE_FILE_KINDS, SCHEMA_VERSION, STATUS_VOCAB,
   backfillFromCanonical, capsulePath, readCapsule,
   writeAllCapsulesForMilestone, writeCapsule.
3. SCHEMA_VERSION === 1 (integer); STATUS_VOCAB.length === 5 AND
   includes 'PASS' AND 'PASS-WITH-DEFERRED-N' AND 'FAIL' AND 'UNKNOWN'
   AND 'IN_PROGRESS'; mutation try/catch length unchanged.
4. BYPASS_KIND_VOCAB.length === 7 AND includes 'verifier_fail' AND
   'edge_guard_miss' AND 'security_issue' AND 'privacy_issue' AND
   'destructive_op' AND 'provider_outage' AND 'stack_trace'.
5. CAPSULE_FILE_KINDS.length === 5 AND includes 'context' AND 'research'
   AND 'plan' AND 'verification' AND 'atc_review'.
6. PHASE-CAPSULE.schema.json parses via JSON.parse (no syntax errors);
   required array has 17 entries; schema_version constraint is
   {"type":"integer","const":1}; status enum has 5 entries matching
   STATUS_VOCAB.
7. F2 spot-check (full Node script in <verification>): synthetic phase
   folder F1 setup yields content_hash H1; delete + rewrite yields
   content_hash H2; assert H1 === H2 (A3 BINDING).
8. F4 spot-check: seed crit-backlog.jsonl with 3 rows for fixture
   milestone+phase; writeCapsule; assert bypass_refs.length === 3 AND
   each summary_passthrough byte-equal source row .summary (Buffer.compare).
9. ASCII-only on both write.cjs and PHASE-CAPSULE.schema.json (Phase 39 W4 lock).
10. No package.json / top-level node_modules diff (no new deps).
11. Read-only invariant: 5 canonical streams + 3 sample real phase folders
    byte-identical to HEAD after --self-test runs (git diff --quiet succeeds
    over them; PHASE-CAPSULE.json was NOT yet backfilled in T1 so it must
    not appear in any real phase folder yet).
12. lib loads in <100ms cold (time `node -e "require('./write.cjs')"`).

Commit: `feat(43-01): phase-capsule schema + write.cjs lib + 13-assertion self-test`
Stage: `super-gsd/tools/phase-capsule/write.cjs super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json`
  </action>
  <verify>
<automated>
node super-gsd/tools/phase-capsule/write.cjs --self-test
node -e "const m=require('./super-gsd/tools/phase-capsule/write.cjs'); const k=Object.keys(m).sort(); const exp=['BYPASS_KIND_VOCAB','CAPSULE_FILE_KINDS','SCHEMA_VERSION','STATUS_VOCAB','backfillFromCanonical','capsulePath','readCapsule','writeAllCapsulesForMilestone','writeCapsule']; if(JSON.stringify(k)!==JSON.stringify(exp)){console.error('FAIL exports',k);process.exit(1)} console.log('PASS exports')"
node -e "const m=require('./super-gsd/tools/phase-capsule/write.cjs'); if(m.SCHEMA_VERSION!==1){console.error('FAIL SCHEMA_VERSION');process.exit(1)} if(m.STATUS_VOCAB.length!==5){console.error('FAIL STATUS_VOCAB',m.STATUS_VOCAB);process.exit(1)} if(m.BYPASS_KIND_VOCAB.length!==7){console.error('FAIL BYPASS_KIND_VOCAB');process.exit(1)} if(m.CAPSULE_FILE_KINDS.length!==5){console.error('FAIL CAPSULE_FILE_KINDS');process.exit(1)} console.log('PASS frozen consts')"
node -e "try{const m=require('./super-gsd/tools/phase-capsule/write.cjs'); m.STATUS_VOCAB.push('FOO');}catch(_){} const m=require('./super-gsd/tools/phase-capsule/write.cjs'); if(m.STATUS_VOCAB.length!==5){console.error('FAIL frozen mutation');process.exit(1)} console.log('PASS frozen mutation')"
node -e "const s=JSON.parse(require('fs').readFileSync('./super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json','utf8')); if(s.required.length!==17){console.error('FAIL required count',s.required.length);process.exit(1)} if(s.properties.schema_version.const!==1){console.error('FAIL schema_version const');process.exit(1)} if(s.properties.status.enum.length!==5){console.error('FAIL status enum');process.exit(1)} console.log('PASS schema shape')"
node -e "const s=require('fs').readFileSync('./super-gsd/tools/phase-capsule/write.cjs','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII at',i);process.exit(1)} console.log('PASS write.cjs ASCII')"
node -e "const s=require('fs').readFileSync('./super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII at',i);process.exit(1)} console.log('PASS schema ASCII')"
git diff --quiet HEAD -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/crit-backlog.jsonl .planning/metrics/gate-value-log.jsonl .planning/metrics/review-ledger.jsonl .planning/metrics/codex-log.jsonl && echo "PASS read-only canonical streams" || (echo "FAIL canonical mod"; exit 1)
node -e "const t0=Date.now();require('./super-gsd/tools/phase-capsule/write.cjs');const dt=Date.now()-t0;if(dt>=100){console.error('FAIL load time',dt+'ms');process.exit(1)} console.log('PASS load time',dt+'ms')"
node -e "const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');const {writeCapsule}=require('./super-gsd/tools/phase-capsule/write.cjs');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pc-f2-'));const phaseDir=path.join(tmp,'milestones','v1.test','phases','99-fixture');fs.mkdirSync(phaseDir,{recursive:true});fs.writeFileSync(path.join(phaseDir,'99-CONTEXT.md'),'---\nphase: 99\n---\nGoal: F2 binding test.\n');fs.writeFileSync(path.join(phaseDir,'99-RESEARCH.md'),'## Open Derivation Calls -- LOCKED\n');fs.writeFileSync(path.join(phaseDir,'99-01-PLAN.md'),'plan');fs.writeFileSync(path.join(phaseDir,'99-VERIFICATION.md'),'verdict: PASS');const r1=writeCapsule(tmp,{milestone:'v1.test',phase:'99',phaseDir});if(!r1.ok){console.error('FAIL r1',r1);process.exit(1)} const H1=r1.content_hash;fs.unlinkSync(r1.path);const r2=writeCapsule(tmp,{milestone:'v1.test',phase:'99',phaseDir});if(!r2.ok){console.error('FAIL r2',r2);process.exit(1)} const H2=r2.content_hash;if(H1!==H2){console.error('FAIL F2 BINDING A3 H1!==H2',H1,H2);process.exit(1)} console.log('PASS F2 BINDING A3 H1===H2='+H1)"
node -e "const fs=require('fs'),path=require('path'),os=require('os');const {writeCapsule}=require('./super-gsd/tools/phase-capsule/write.cjs');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pc-f4-'));const phaseDir=path.join(tmp,'milestones','v1.test','phases','99-fixture');fs.mkdirSync(phaseDir,{recursive:true});fs.mkdirSync(path.join(tmp,'metrics'),{recursive:true});fs.writeFileSync(path.join(phaseDir,'99-CONTEXT.md'),'---\nphase: 99\n---\nGoal: F4 binding test.\n');fs.writeFileSync(path.join(phaseDir,'99-RESEARCH.md'),'res');fs.writeFileSync(path.join(phaseDir,'99-01-PLAN.md'),'plan');fs.writeFileSync(path.join(phaseDir,'99-VERIFICATION.md'),'verdict: PASS');const summaries=['Codex auth unavailable; per-dispatch ATC for commit 34eb8c2 used Claude only.','Edge-guard miss: provider==null detected; behaviorally proven outage 2026-04-27.','Stack trace: SyntaxError at line 42; details preserved verbatim with punctuation.'];const rows=summaries.map((s,i)=>JSON.stringify({id:'2026-04-27T0'+i+'-00-00-000Z-aaa'+i,kind:'verifier_fail',phase:'99',plan:'phase-level',milestone:'v1.test',attempts_made:1,summary:s,evidence_path:'.planning/x',last_diff_sha:null,tagged_for_milestone:'next-debt-milestone',added_at:'2026-04-27T0'+i+':00:00.000Z',resolved_at:null,resolved_by:null}));fs.writeFileSync(path.join(tmp,'metrics','crit-backlog.jsonl'),rows.join('\n')+'\n');const r=writeCapsule(tmp,{milestone:'v1.test',phase:'99',phaseDir});if(!r.ok){console.error('FAIL writeCapsule',r);process.exit(1)} const cap=JSON.parse(fs.readFileSync(r.path,'utf8'));if(cap.bypass_refs.length!==3){console.error('FAIL bypass_refs.length',cap.bypass_refs.length);process.exit(1)} for(let i=0;i<3;i++){if(cap.bypass_refs[i].summary_passthrough!==summaries[i]){console.error('FAIL summary mutated',i,'\nsrc=',JSON.stringify(summaries[i]),'\ngot=',JSON.stringify(cap.bypass_refs[i].summary_passthrough));process.exit(1)}} console.log('PASS F4 BINDING A2/LOCK 6 verbatim 3/3')"
</automated>
  </verify>
  <done>
- super-gsd/tools/phase-capsule/write.cjs exists, ~700 LOC, ASCII-only,
  exports 4 frozen consts + 5 public APIs (9 keys sorted).
- super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json exists,
  ~150 LOC, ASCII-only, parses as valid JSON, 17 required + 1 optional
  fields, additionalProperties:false, schema_version const 1, status
  enum 5-entry.
- SCHEMA_VERSION === 1; STATUS_VOCAB frozen 5-entry; BYPASS_KIND_VOCAB
  frozen 7-entry; CAPSULE_FILE_KINDS frozen 5-entry; mutation attempts
  preserve length.
- node super-gsd/tools/phase-capsule/write.cjs --self-test exits 0 with
  "phase-capsule self-test: 13 pass, 0 fail".
- F2 BINDING A3 verified: write -> H1; delete; rewrite -> H2; H1 === H2.
- F4 BINDING A2 + LOCK 6 verified: 3 seeded crit-backlog rows produce
  3 bypass_refs with byte-equal summary_passthrough.
- 5 canonical streams byte-identical (read-only invariant green).
- No new dependencies; package.json + top-level node_modules diff-empty.
- lib loads in <100ms cold.
- Commit landed: `feat(43-01): phase-capsule schema + write.cjs lib + 13-assertion self-test`.
  </done>
</task>

<task type="auto">
  <name>Task T2: Backfill 17 historical capsules + 4 PHASE-INDEX.jsonl files (chronological)</name>
  <files>.planning/milestones/v1.6/phases/26-cockpit-question-contract/PHASE-CAPSULE.json, .planning/milestones/v1.6/phases/27-cockpit-data-tree/PHASE-CAPSULE.json, .planning/milestones/v1.6/phases/28-mission-control-layout/PHASE-CAPSULE.json, .planning/milestones/v1.6/phases/29-agent-codex-lanes/PHASE-CAPSULE.json, .planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/PHASE-CAPSULE.json, .planning/milestones/v1.7/phases/31-canonical-envelope/PHASE-CAPSULE.json, .planning/milestones/v1.7/phases/32-route-decision-ledger/PHASE-CAPSULE.json, .planning/milestones/v1.7/phases/33-repair-instruction/PHASE-CAPSULE.json, .planning/milestones/v1.7/phases/34-canonical-review-ledger/PHASE-CAPSULE.json, .planning/milestones/v1.7/phases/35-generated-system-map/PHASE-CAPSULE.json, .planning/milestones/v1.8/phases/36-gate-value-telemetry/PHASE-CAPSULE.json, .planning/milestones/v1.8/phases/37-muda-deletion-candidates/PHASE-CAPSULE.json, .planning/milestones/v1.8/phases/38-risk-tiered-gate-sampling/PHASE-CAPSULE.json, .planning/milestones/v1.8/phases/39-gate-keep-kill/PHASE-CAPSULE.json, .planning/milestones/v1.8/phases/40-phase-folder-audit/PHASE-CAPSULE.json, .planning/milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json, .planning/milestones/v1.9/phases/42-token-budget-admission/PHASE-CAPSULE.json, .planning/milestones/v1.6/PHASE-INDEX.jsonl, .planning/milestones/v1.7/PHASE-INDEX.jsonl, .planning/milestones/v1.8/PHASE-INDEX.jsonl, .planning/milestones/v1.9/PHASE-INDEX.jsonl</files>
  <action>
PRECONDITION: Task T1 produced write.cjs + PHASE-CAPSULE.schema.json;
--self-test 13/13 PASS; F2 + F4 spot-checks green.

Run the chronological backfill against the live repository (RESEARCH
sec 9.2 LOCKED order: v1.6 -> v1.7 -> v1.8 -> v1.9 to match git history;
forward refs avoided):

```bash
# Single-shot backfill (preferred):
node super-gsd/tools/phase-capsule/write.cjs --backfill --all
```

OR for incremental staging:

```bash
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.6
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.7
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.8
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.9
```

Expected stdout: `phase-capsule backfill complete (written=N, skipped=M, errors=K)`.
Expected exit: 0 in all cases (errors logged to context-complaints.jsonl).

This call:
  1. Walks .planning/milestones/v1.6/phases/, v1.7/phases/,
     v1.8/phases/, v1.9/phases/ in chronological order.
  2. For each phase folder matching /^\d+(?:\.\d+)?-/ basename:
     reads CONTEXT.md / RESEARCH.md / PLAN.md / VERIFICATION.md /
     ATC-REVIEW.md (or v1.9 reviews/{NN}-REVIEW.md);
     queries crit-backlog.jsonl + agent-token-spend.jsonl +
     gate-value-log.jsonl + review-ledger.jsonl + codex-log.jsonl
     (READ-ONLY); calls git log --reverse -- <phaseDir>;
     builds capsule per BEHAVIOR 7.1; validates via _assertCapsuleSchema;
     atomically writes PHASE-CAPSULE.json.
  3. Per milestone: appends/replaces row in
     .planning/milestones/{ms}/PHASE-INDEX.jsonl.
  4. Phase 43's own folder (.../43-phase-capsule-contract/) is INCLUDED
     in v1.9 backfill but its capsule will be IN_PROGRESS status (no
     VERIFICATION.md yet at this point); that's expected. The next
     phase-close cycle (after Phase 43 closes) will rewrite it via
     forward-flow Step 6.6.i.X to PASS status.
  5. Phase 43 itself does NOT modify any of the 5 canonical metric
     streams or any canonical phase-folder file (CONTEXT/RESEARCH/PLAN/
     VERIFICATION/ATC-REVIEW/codex-review/commit-reviews/reviews).

Acceptance gates (CAP-04 + ROADMAP A3; full battery in <verification>):

1. 17 PHASE-CAPSULE.json files exist at the listed paths in
   files_touched. Each parses via JSON.parse. Each contains
   schema_version === 1 + all 17 required fields.
2. Each capsule's _assertCapsuleSchema(JSON.parse(capsule)) passes
   without throwing.
3. 4 PHASE-INDEX.jsonl files exist at .planning/milestones/{v1.6,v1.7,
   v1.8,v1.9}/PHASE-INDEX.jsonl. Each contains 5/5/5/2 rows respectively
   (Phase 43's own row at v1.9 added in T3 forward-flow on next phase
   close, not now -- v1.9 PHASE-INDEX has 2 rows for P41+P42 plus 1
   IN_PROGRESS row for P43 = 3 rows).
4. A3 BINDING at scale: re-run `--backfill --all`; report 17 skipped
   (or 18 if P43's own capsule was rewritten with same hash), 0 written,
   0 errors. Each capsule's content_hash unchanged across rebuilds
   (idempotent).
5. Read-only invariant: 5 canonical metric streams (agent-token-spend,
   crit-backlog, gate-value-log, review-ledger, codex-log) byte-identical
   to HEAD. ALL canonical phase-folder content (CONTEXT.md, RESEARCH.md,
   PLAN.md, VERIFICATION.md, ATC-REVIEW.md, codex-review.md,
   commit-reviews.jsonl, reviews/{NN}-REVIEW.md) byte-identical to HEAD
   for all 17 backfilled phases.
6. Bypass linkage (LOCK 6): for any backfilled capsule whose milestone+
   phase appears in crit-backlog.jsonl, bypass_refs[N].summary_passthrough
   byte-equals the source row .summary. v1.6/P26 has 1 row; v1.6/P27
   has 1 row; v1.6/P28 has 1 row; etc. -- spot-check at least 3 capsules.
7. Dual phase-folder shape detection: v1.6/P26 capsule's
   source_hashes.atc_review.path ends with '26-ATC-REVIEW.md' (v1.6
   shape); v1.9/P41 capsule's source_hashes.atc_review.path ends with
   'reviews/41-REVIEW.md' (v1.9 shape).
8. ASCII-only: every PHASE-CAPSULE.json + every PHASE-INDEX.jsonl is
   ASCII-only (charCodeAt > 127 scan).
9. CLI exit-0-on-error contract: errors during backfill log to
   context-complaints.jsonl but the CLI still exits 0 (lock 13).

Commit: `feat(43-01): backfill 17 historical capsules (v1.6-v1.8 + v1.9-shipped)`
Stage: ALL 17 PHASE-CAPSULE.json paths + 4 PHASE-INDEX.jsonl paths
       listed in files_touched (specific by name; NEVER `git add -A`).
  </action>
  <verify>
<automated>
node super-gsd/tools/phase-capsule/write.cjs --backfill --all
ec=$?
[ "$ec" -eq 0 ] && echo "PASS --backfill --all exit 0" || (echo "FAIL exit $ec"; exit 1)
node -e "const fs=require('fs'),path=require('path');const expected=['v1.6/phases/26-cockpit-question-contract','v1.6/phases/27-cockpit-data-tree','v1.6/phases/28-mission-control-layout','v1.6/phases/29-agent-codex-lanes','v1.6/phases/30-startup-cockpit-acceptance','v1.7/phases/31-canonical-envelope','v1.7/phases/32-route-decision-ledger','v1.7/phases/33-repair-instruction','v1.7/phases/34-canonical-review-ledger','v1.7/phases/35-generated-system-map','v1.8/phases/36-gate-value-telemetry','v1.8/phases/37-muda-deletion-candidates','v1.8/phases/38-risk-tiered-gate-sampling','v1.8/phases/39-gate-keep-kill','v1.8/phases/40-phase-folder-audit','v1.9/phases/41-baseline-token-attribution','v1.9/phases/42-token-budget-admission'];let missing=0;for(const r of expected){const p=path.join('.planning','milestones',r,'PHASE-CAPSULE.json');if(!fs.existsSync(p)){console.error('FAIL missing',p);missing++}} if(missing>0){process.exit(1)} console.log('PASS 17 capsules exist')"
node -e "const fs=require('fs'),path=require('path');const m=require('./super-gsd/tools/phase-capsule/write.cjs');let bad=0;const expected=['v1.6/phases/26-cockpit-question-contract','v1.6/phases/27-cockpit-data-tree','v1.6/phases/28-mission-control-layout','v1.6/phases/29-agent-codex-lanes','v1.6/phases/30-startup-cockpit-acceptance','v1.7/phases/31-canonical-envelope','v1.7/phases/32-route-decision-ledger','v1.7/phases/33-repair-instruction','v1.7/phases/34-canonical-review-ledger','v1.7/phases/35-generated-system-map','v1.8/phases/36-gate-value-telemetry','v1.8/phases/37-muda-deletion-candidates','v1.8/phases/38-risk-tiered-gate-sampling','v1.8/phases/39-gate-keep-kill','v1.8/phases/40-phase-folder-audit','v1.9/phases/41-baseline-token-attribution','v1.9/phases/42-token-budget-admission'];for(const r of expected){const p=path.join('.planning','milestones',r,'PHASE-CAPSULE.json');try{const c=JSON.parse(fs.readFileSync(p,'utf8'));if(c.schema_version!==1){bad++;console.error('FAIL schema_version',p)} const req=['schema_version','milestone','phase','phase_name','status','goal','outputs','files','decisions','debt','downstream_contract','bypass_refs','source_commits','source_hashes','gates','created_at','created_by'];for(const k of req)if(!(k in c)){bad++;console.error('FAIL missing field',p,k);break}}catch(e){bad++;console.error('FAIL parse',p,e.message)}} if(bad>0){process.exit(1)} console.log('PASS 17 capsules schema-valid (17 required fields)')"
node -e "const fs=require('fs'),path=require('path');for(const ms of ['v1.6','v1.7','v1.8','v1.9']){const p=path.join('.planning','milestones',ms,'PHASE-INDEX.jsonl');if(!fs.existsSync(p)){console.error('FAIL no PHASE-INDEX',p);process.exit(1)} const lines=fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean);for(const ln of lines){try{const r=JSON.parse(ln);if(!r.milestone||!r.phase||!r.capsule_path||!r.content_hash){console.error('FAIL row',ms,r);process.exit(1)}}catch(e){console.error('FAIL parse',ms,e.message);process.exit(1)}}} console.log('PASS 4 PHASE-INDEX.jsonl shape')"
node super-gsd/tools/phase-capsule/write.cjs --backfill --all 2>&1 | tee /tmp/sgsd-pc-rerun.log
node -e "const log=require('fs').readFileSync('/tmp/sgsd-pc-rerun.log','utf8');if(!/written=0/.test(log)){console.error('FAIL non-idempotent rebuild',log);process.exit(1)} console.log('PASS A3 idempotent rebuild (written=0)')"
git diff --quiet HEAD -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/crit-backlog.jsonl .planning/metrics/gate-value-log.jsonl .planning/metrics/review-ledger.jsonl .planning/metrics/codex-log.jsonl && echo "PASS read-only canonical streams" || (echo "FAIL canonical mod"; exit 1)
node -e "const cp=require('child_process');const out=cp.execSync('git diff --name-only HEAD -- .planning/milestones/v1.6 .planning/milestones/v1.7 .planning/milestones/v1.8 .planning/milestones/v1.9',{encoding:'utf8'});const lines=out.split(/\r?\n/).filter(Boolean);for(const f of lines){if(!/PHASE-CAPSULE\.json$|PHASE-INDEX\.jsonl$/.test(f)){console.error('FAIL canonical phase-folder modified',f);process.exit(1)}} console.log('PASS read-only canonical phase-folder content')"
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('.planning/milestones/v1.6/phases/28-mission-control-layout/PHASE-CAPSULE.json','utf8'));const src=fs.readFileSync('.planning/metrics/crit-backlog.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.milestone==='v1.6'&&String(r.phase)==='28');if(src.length===0){console.log('SKIP F4-spot v1.6/28 (no rows)')}else{const matched=c.bypass_refs.find(b=>b.id===src[0].id);if(!matched){console.error('FAIL v1.6/28 bypass id missing');process.exit(1)} if(matched.summary_passthrough!==src[0].summary){console.error('FAIL summary mutated\nsrc=',JSON.stringify(src[0].summary),'\ngot=',JSON.stringify(matched.summary_passthrough));process.exit(1)} console.log('PASS LOCK 6 verbatim spot-check v1.6/28')}"
node -e "const fs=require('fs');const c16=JSON.parse(fs.readFileSync('.planning/milestones/v1.6/phases/26-cockpit-question-contract/PHASE-CAPSULE.json','utf8'));const c19=JSON.parse(fs.readFileSync('.planning/milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json','utf8'));if(c16.source_hashes.atc_review===null){console.log('SKIP atc_review null v1.6/26')}else{if(!/26-ATC-REVIEW\.md$/.test(c16.source_hashes.atc_review.path)){console.error('FAIL v1.6 shape',c16.source_hashes.atc_review.path);process.exit(1)} console.log('PASS v1.6 shape detection')} if(c19.source_hashes.atc_review===null){console.log('SKIP atc_review null v1.9/41')}else{if(!/reviews\/41-REVIEW\.md$/.test(c19.source_hashes.atc_review.path)){console.error('FAIL v1.9 shape',c19.source_hashes.atc_review.path);process.exit(1)} console.log('PASS v1.9 shape detection')}"
node -e "const fs=require('fs'),path=require('path');const expected=['v1.6/phases/26-cockpit-question-contract','v1.6/phases/27-cockpit-data-tree','v1.6/phases/28-mission-control-layout','v1.6/phases/29-agent-codex-lanes','v1.6/phases/30-startup-cockpit-acceptance','v1.7/phases/31-canonical-envelope','v1.7/phases/32-route-decision-ledger','v1.7/phases/33-repair-instruction','v1.7/phases/34-canonical-review-ledger','v1.7/phases/35-generated-system-map','v1.8/phases/36-gate-value-telemetry','v1.8/phases/37-muda-deletion-candidates','v1.8/phases/38-risk-tiered-gate-sampling','v1.8/phases/39-gate-keep-kill','v1.8/phases/40-phase-folder-audit','v1.9/phases/41-baseline-token-attribution','v1.9/phases/42-token-budget-admission'];for(const r of expected){const s=fs.readFileSync(path.join('.planning','milestones',r,'PHASE-CAPSULE.json'),'utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII at',r,'pos',i);process.exit(1)}} console.log('PASS 17 capsules ASCII')"
</automated>
  </verify>
  <done>
- 17 PHASE-CAPSULE.json files exist at the listed paths covering
  v1.6/P26-30 (5) + v1.7/P31-35 (5) + v1.8/P36-40 (5) + v1.9/P41-42 (2).
- Each capsule parses as valid JSON with all 17 required fields.
- Each passes _assertCapsuleSchema validation.
- 4 PHASE-INDEX.jsonl files exist at .planning/milestones/{v1.6,v1.7,
  v1.8,v1.9}/PHASE-INDEX.jsonl with deterministic row shape.
- A3 BINDING at scale: re-running --backfill --all reports written=0
  (every capsule content_hash unchanged across rebuild).
- Read-only invariant: 5 canonical metric streams + canonical
  phase-folder content (CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC-REVIEW/
  codex-review/commit-reviews/reviews) byte-identical to HEAD across
  all 17 backfilled phases (only PHASE-CAPSULE.json + PHASE-INDEX.jsonl
  appear in git diff --name-only).
- LOCK 6 verified at scale: spot-checked v1.6/P28 bypass_refs
  summary_passthrough byte-equal source crit-backlog row.
- Dual phase-folder shape detection: v1.6 capsules cite ATC-REVIEW.md;
  v1.9 capsules cite reviews/{NN}-REVIEW.md.
- All 17 capsules ASCII-only.
- CLI exit 0 (lock 13 honored).
- Commit landed: `feat(43-01): backfill 17 historical capsules (v1.6-v1.8 + v1.9-shipped)`.
- CAP-04 + ROADMAP A3 GREEN.
  </done>
</task>

<task type="auto">
  <name>Task T3: Wire forward-flow Step 6.6.i.X (sgsd-orchestrate) + safety-net Step 4.7-bis (sgsd-complete-milestone)</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md, super-gsd/skills/sgsd-complete-milestone/SKILL.md</files>
  <action>
PRECONDITION: Tasks T1 + T2 landed. write.cjs --self-test passes 13/13.
17 historical capsules backfilled. 4 PHASE-INDEX.jsonl files exist.
Read-only invariant green across canonical streams + phase-folder content.

This task ships TWO wire-ins (CAP-03 forward-flow + safety-net):

WIRE-IN 1: super-gsd/skills/sgsd-orchestrate/SKILL.md (forward-flow)

Insert a new sub-step `6.6.i.X` BETWEEN the existing `6.6.h. TaskUpdate(...)`
(at line ~1177) and `6.6.i. Mark phase complete, advance to next phase`
(at line ~1179).

The new sub-step writes the phase capsule BEFORE phase-advance. Per Lock 5:
"Phase close writes a phase capsule before downstream phases consume it."
The first phase of the next milestone needs the prior phase's capsule
available; if we wait for milestone-close, that ordering breaks.

NEW BLOCK (insert AFTER line "6.6.h. TaskUpdate(taskId, status: \"completed\")"
and BEFORE line "6.6.i. Mark phase complete, advance to next phase"):

```markdown
       i.X. PHASE CAPSULE WRITE (Phase 43 -- CAP-01..05; Lock 5 forward-coverage)

            Write the phase capsule projection BEFORE marking phase complete.
            Per RESEARCH sec 9.3: Phase 45 PACKET-03 will read this capsule
            during the NEXT phase's dispatch; if write is deferred to
            milestone-close, the first phase of the next milestone has no
            capsule for the prior phase.

            Per design lock 13 (REQUIREMENTS.md:67-68): capsule write
            failure NEVER halts phase advance. writeCapsule wraps internals
            in try/catch and returns { ok:false, reason:<msg> } on failure;
            the orchestrator logs the result and continues to step 6.6.i
            unconditionally.

            ```javascript
            // Phase 43 wire-in: anchor planningDir to process.cwd() at the
            // orchestrator-skill boundary (mirrors Step 4.5/4.6/4.7 lessons:
            // Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 41 sec 7.1
            // -- NEVER bare relative '.planning').
            const path = require('path');
            const { writeCapsule } = require(
              path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
            );
            const planningDir = path.join(process.cwd(), '.planning');
            const result = writeCapsule(planningDir, {
              milestone: '{{version}}',
              phase: '{{phase}}',
              phaseDir: '{{phase_dir}}',
            });
            // result: { ok:true, path: '.../PHASE-CAPSULE.json', content_hash: '...' }
            //      or { ok:false, reason: '...' } -- NEVER throws.
            // On failure: writeCapsule already appended a row to
            // .planning/metrics/context-complaints.jsonl with reason_code
            // from the <reason_codes> vocabulary. Orchestrator continues
            // to 6.6.i unconditionally.
            ```

            HARD RULES for this gate -- no exceptions:

            R1. writeCapsule outcome NEVER blocks step 6.6.i (mark complete /
                advance). Lock 13 binds.
            R2. Capsule write failure surfaces in the next milestone-close's
                token-waste / phase-folder-audit narrative (Phase 49 reads
                context-complaints.jsonl); operator-discoverable but
                non-blocking.
            R3. Capsule shape is the API for Phase 45/46/49/51. Do NOT
                modify the capsule schema from this skill -- the writer
                lib owns it; this skill only INVOKES.
            R4. The wire-in MUST cite RESEARCH sec 9.3 and Lock 5 in the
                rendered markdown so future operators understand WHY this
                step is between 6.6.h and 6.6.i (not 6.7 milestone-close).
```

WIRE-IN 2: super-gsd/skills/sgsd-complete-milestone/SKILL.md (safety-net)

Insert a new block `<step_4_7b_phase_capsule_backfill>` IMMEDIATELY AFTER
the existing `<step_4_7_token_waste_check>` block (currently ends at
line ~229) and BEFORE `<step_5_cross_phase_check>` (currently starts at
line ~231).

This safety-net catches phases that closed BEFORE Phase 43 shipped (the
5+5+5+2=17 historical capsules backfilled in T2) AND any future phase
where the forward-flow Step 6.6.i.X failed to land a capsule (e.g.,
git unavailable at phase-close time -> capsule rebuilt at milestone-close
when git is back). Idempotent: matching content_hash skips write.

NEW BLOCK:

```markdown
<step_4_7b_phase_capsule_backfill>
## Step 4.7-bis: Phase Capsule Backfill Safety-Net (Phase 43 -- CAP-04)

Run the read-only phase-capsule backfill across all phases of the closing
milestone. Forward-flow Step 6.6.i.X writes capsules per-phase as they
close; this step is the safety-net for phases that:

  (a) closed BEFORE Phase 43 shipped (the 17 historical capsules),
  (b) had Step 6.6.i.X fail at phase-close time (git unavailable,
      crit-backlog unreadable, etc. -- writeCapsule returns ok:false but
      orchestrator continues per Lock 13).

Per design lock 13 (REQUIREMENTS.md:67-68): backfill failures NEVER halt
milestone close. writeAllCapsulesForMilestone wraps internals in
try/catch and returns { written:N, skipped:M, errors:[...] }; errors
log to .planning/metrics/context-complaints.jsonl; Step 5 continues.

Idempotent: capsules with matching content_hash are skipped (mtime
preserved); A3 acceptance binds.

```javascript
// Phase 43 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.5 Phase 39 ATC W3 +
// Step 4.6 Phase 40 W3 + Step 4.7 Phase 42 BUDGET fixes).
// NEVER bare relative '.planning'.
const path = require('path');
const { writeAllCapsulesForMilestone } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = writeAllCapsulesForMilestone(planningDir, '{{version}}');
// result: { written:N, skipped:M, errors:[...] }
// NEVER throws. On non-empty errors: rows appended to
// .planning/metrics/context-complaints.jsonl already (writeCapsule does
// this internally). Step 5 cross-phase check runs regardless.
```

Per lock 5: phase capsule is a PROJECTION of canonical .planning + git;
canonical state is not touched. Per lock 13: backfill failures continue
autonomy. Per lock 6: bypass entries copied verbatim, never summarized.

Defer-on-empty: if `.planning/milestones/{{version}}/phases/` is absent
(empty milestone), `writeAllCapsulesForMilestone` returns
`{written:0, skipped:0, errors:[...]}` with reason
`phase_capsule_backfill_milestone_missing` and Step 5 continues.

PHASE-INDEX.jsonl: writeAllCapsulesForMilestone updates
`.planning/milestones/{{version}}/PHASE-INDEX.jsonl` per call. Cockpit
(Phase 50) reads this index for fast scan; the per-phase
PHASE-CAPSULE.json holds detail. Capsule = projection. Canonical =
.planning + git.
</step_4_7b_phase_capsule_backfill>
```

ORDERING CONSTRAINTS (dead-end #13):

  - sgsd-orchestrate Step 6.6.i.X is BETWEEN 6.6.h and 6.6.i (NOT after
    6.6.i; phase advance must SEE the capsule write outcome but proceed
    regardless).
  - sgsd-complete-milestone Step 4.7-bis is AFTER step_4_7_token_waste_check
    and BEFORE step_5_cross_phase_check (NOT renaming any existing step).
  - NO renumbering of Step 4.5 / 4.6 / 4.7 / 5 / 6 / 7 in
    sgsd-complete-milestone.
  - NO renumbering of Step 6.6.a..h / 6.6.i / 6.7 in sgsd-orchestrate.
  - The sgsd-orchestrate Step 6 SUMMARY.md generator is NOT touched in
    Phase 43 (capsule is data, not narrative; SUMMARY.md does not embed
    PHASE-INDEX.jsonl). Phase 50 cockpit will surface PHASE-INDEX in
    its own narrative.

Acceptance gates (CAP-03 + dead-end #13; full battery in <verification>):

1. sgsd-orchestrate SKILL.md contains the new "i.X. PHASE CAPSULE WRITE"
   block; the block references writeCapsule, anchors planningDir to
   process.cwd(), cites design lock 13 + Lock 5 + RESEARCH sec 9.3.
2. sgsd-orchestrate Step 6.6 ordering: indexOf("6.6.h. TaskUpdate") <
   indexOf("i.X. PHASE CAPSULE WRITE") < indexOf("Mark phase complete,
   advance to next phase"). All three anchors present.
3. sgsd-complete-milestone SKILL.md contains the new
   `<step_4_7b_phase_capsule_backfill>` block; references
   writeAllCapsulesForMilestone; anchors planningDir to process.cwd();
   cites design lock 13 + Lock 5.
4. sgsd-complete-milestone ordering:
   indexOf(step_4_5_gate_keep_kill_rubric) <
   indexOf(step_4_6_phase_folder_audit) <
   indexOf(step_4_7_token_waste_check) <
   indexOf(step_4_7b_phase_capsule_backfill) <
   indexOf(step_5_cross_phase_check). All five blocks present.
5. ASCII-only across both SKILL.md files (charCodeAt > 127 rejected).
6. No other modifications to either SKILL.md beyond the two inserts
   (git diff inspection: ONLY new content; nothing removed; nothing
   reordered).

Commit: `feat(43-01): forward-flow phase-close hook + backfill safety-net wire-in (Step 6.6.i.X + Step 4.7-bis)`
Stage: `super-gsd/skills/sgsd-orchestrate/SKILL.md super-gsd/skills/sgsd-complete-milestone/SKILL.md`

(NOTE: This is a single combined commit for the two SKILL.md edits,
NOT two separate commits. Per RESEARCH sec 15.5 + Phase 42 commit
discipline: each SKILL.md edit is a single ~25 LOC insert; combining
keeps the integration delta atomic. If a hook fails, the next commit
fixes both -- never amend (CLAUDE.md).)
  </action>
  <verify>
<automated>
grep -q "i.X. PHASE CAPSULE WRITE" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo "PASS Step 6.6.i.X anchor" || (echo "FAIL Step 6.6.i.X missing"; exit 1)
grep -q "writeCapsule" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo "PASS writeCapsule reference"
grep -q "design lock 13" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo "PASS Lock 13 citation in orchestrate"
node -e "const t=require('fs').readFileSync('super-gsd/skills/sgsd-orchestrate/SKILL.md','utf8');const ih=t.indexOf('6.6.h. TaskUpdate');const ix=t.indexOf('i.X. PHASE CAPSULE WRITE');const ii=t.indexOf('Mark phase complete, advance to next phase');if(!(ih>=0&&ix>=0&&ii>=0)){console.error('FAIL anchors missing',{ih,ix,ii});process.exit(1)} if(!(ih<ix&&ix<ii)){console.error('FAIL Step 6.6 ordering',{ih,ix,ii});process.exit(1)} console.log('PASS Step 6.6 ordering 6.6.h < i.X < 6.6.i')"
grep -q "step_4_7b_phase_capsule_backfill" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS Step 4.7-bis anchor" || (echo "FAIL Step 4.7-bis missing"; exit 1)
grep -q "writeAllCapsulesForMilestone" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS writeAllCapsulesForMilestone reference"
grep -q "design lock 13" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS Lock 13 citation in complete-milestone"
node -e "const t=require('fs').readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8');const i45=t.indexOf('step_4_5_gate_keep_kill_rubric');const i46=t.indexOf('step_4_6_phase_folder_audit');const i47=t.indexOf('step_4_7_token_waste_check');const i47b=t.indexOf('step_4_7b_phase_capsule_backfill');const i5=t.indexOf('step_5_cross_phase_check');if(!(i45>=0&&i46>=0&&i47>=0&&i47b>=0&&i5>=0)){console.error('FAIL anchors',{i45,i46,i47,i47b,i5});process.exit(1)} if(!(i45<i46&&i46<i47&&i47<i47b&&i47b<i5)){console.error('FAIL ordering',{i45,i46,i47,i47b,i5});process.exit(1)} console.log('PASS Step ordering 4.5<4.6<4.7<4.7-bis<5')"
node -e "const s=require('fs').readFileSync('super-gsd/skills/sgsd-orchestrate/SKILL.md','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII orchestrate at',i);process.exit(1)} console.log('PASS sgsd-orchestrate SKILL.md ASCII')"
node -e "const s=require('fs').readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){console.error('non-ASCII complete-milestone at',i);process.exit(1)} console.log('PASS sgsd-complete-milestone SKILL.md ASCII')"
node -e "const cp=require('child_process');const out=cp.execSync('git diff --stat HEAD -- super-gsd/skills/sgsd-orchestrate/SKILL.md super-gsd/skills/sgsd-complete-milestone/SKILL.md',{encoding:'utf8'});if(!/2 files changed|orchestrate.*\\+|complete-milestone.*\\+/.test(out)){console.error('FAIL diff shape',out);process.exit(1)} console.log('PASS SKILL.md diff additive')"
</automated>
  </verify>
  <done>
- super-gsd/skills/sgsd-orchestrate/SKILL.md contains the new
  "i.X. PHASE CAPSULE WRITE" block between 6.6.h. TaskUpdate and
  6.6.i. Mark phase complete.
- The orchestrate wire-in references writeCapsule + anchors planningDir
  to process.cwd() + cites design lock 13 + Lock 5 + RESEARCH sec 9.3.
- super-gsd/skills/sgsd-complete-milestone/SKILL.md contains the new
  `<step_4_7b_phase_capsule_backfill>` block between
  `<step_4_7_token_waste_check>` and `<step_5_cross_phase_check>`.
- The complete-milestone wire-in references writeAllCapsulesForMilestone
  + anchors planningDir to process.cwd() + cites design lock 13.
- Step ordering preserved (no renumbering of existing 4.5/4.6/4.7/5/6
  in complete-milestone or 6.6.a..h/6.6.i/6.7 in orchestrate).
- Both SKILL.md files ASCII-only.
- Diff is purely additive (nothing removed; nothing reordered; ~25
  LOC inserted in each file).
- Commit landed: `feat(43-01): forward-flow phase-close hook + backfill safety-net wire-in (Step 6.6.i.X + Step 4.7-bis)`.
- CAP-03 GREEN.
  </done>
</task>

</tasks>

<live_or_local_fallback>
RESEARCH sec 9.5 + sec 10. Phase 43 ships TWO modes both required:

| Mode | Source | Use case |
|------|--------|----------|
| LOCAL | `--self-test` seeds tmpdir with 4 named fixtures (F1-F4) + synthetic crit-backlog rows; canonical streams + 3 sample real phase folders fingerprinted before/after | CI-safe; never touches canonical content |
| LIVE  | `--backfill --all` walks production .planning/milestones/v1.6..v1.9/phases/ and writes 17 historical capsules + 4 PHASE-INDEX.jsonl projections | Real backfill; runs in T2 |

LIVE is hard requirement (CAP-04 + ROADMAP A3 acceptance: rebuild yields
equivalent content hashes; that requires real capsules to exist on
disk; T2 produces them). LOCAL is required by EXISTING-SURFACE-AUDIT
("CLI entrypoint, --self-test, deterministic fixtures, production
caller path, JSON output where practical"). Both wired by Task T1
(LOCAL: 13 assertions) and Task T2 (LIVE: --backfill --all against
production .planning).
</live_or_local_fallback>

<schema_without_consumer_rule>
RESEARCH sec 4.1. Phase 43 ships 5 in-phase consumers exercising the
PHASE-CAPSULE.schema.json contract:

1. `_assertCapsuleSchema` (validator) -- consumes the schema at every
   write. Self-test assertions 6 + F1 exercise it. T2 exercises it for
   17 backfilled capsules.
2. `writeCapsule` (writer) -- produces capsule objects; schema-validates
   before write. Self-test fixtures F1-F4 (assertions 1-4) + 9 secondary
   exercise it. T2 runs it 17 times against the live tree.
3. `writeAllCapsulesForMilestone` (walker) -- walks milestone folder,
   delegates to writeCapsule. T2 exercises it 4 times (one per
   milestone).
4. `readCapsule` (reader) -- consumes the schema at read. Self-test F1
   exercises it. T2 spot-checks parse-back of 17 capsules.
5. `_capsuleContentHash` (canonicalizer) -- consumes the schema at hash
   time. Self-test F2 exercises it (BINDING A3). T2 exercises it for
   17 capsule rebuilds.

All 5 exported (or used internally) from one file. All 5 exercised by
self-test + LIVE --backfill. SKILL.md Step 6.6.i.X + Step 4.7-bis are
FUTURE consumers (run at phase-close + milestone-close); the schema
satisfies the rule on the merits of its 5 in-phase consumers.

Phase 45 PACKET-03 + Phase 46 INDEX-02 + Phase 49 GOV-04 + Phase 51
BENCH-04/BENCH-05 are FUTURE consumers (Phase 45 reads capsule into
packet, Phase 46 SQLite-indexes, Phase 49 governance lifecycle, Phase 51
benchmark token reduction); this phase satisfies the rule without
depending on future work.
</schema_without_consumer_rule>

<constraints>
- ASCII only (Phase 39 W4 + Phase 41 + Phase 42 lessons). Use `--` not
  em-dashes; `->` not arrow glyph; `>=` not unicode glyph; straight
  quotes only.
- LF line endings (no CRLF; lib loads on WSL CI which is strict).
- No new dependencies. Node built-ins only: fs, path, os, crypto,
  child_process. NO ajv / json-schema-validator / fast-json-stringify
  / yaml / etc. JSON Schema validation is implemented manually inside
  _assertCapsuleSchema (mirror gate-value-log.cjs:_assertEnvelopeV1).
  No new package.json mod, no new top-level node_modules.
- Mirror Phase 40 audit.cjs (walker discovery + dual phase-folder
  shape), Phase 36 gate-value-log.cjs (envelope writer trio + frozen
  consts + manual schema validator + __dirname guard), Phase 41
  report.cjs (envelope-v1 emitter + module structure + self-test
  scaffold), Phase 42 check.cjs (read-only check + never-throws +
  fingerprint guard) architecturally with Phase 43 substitutions.
- Phase 41 imports OPTIONAL (try/catch wrapped): ROLES, ledgerPath.
  Lib loads even if Phase 41 import fails; token_cost is null in that
  case; capsule still ships. Do NOT redefine STATUSES or PROVIDERS
  (Phase 41 owns those; Phase 43's STATUS_VOCAB is a different
  vocabulary).
- LOCK 5 (REQUIREMENTS:40-50): "Phase close writes a phase capsule
  before downstream phases consume it." Forward-flow Step 6.6.i.X
  binds. Capsule is a PROJECTION; canonical = .planning + git.
- LOCK 6 (REQUIREMENTS:40-50): bypass_refs[].summary_passthrough
  byte-equal source crit-backlog row .summary. NEVER mutate via
  .replace, .trim, .substring, .slice, .toLowerCase, .toUpperCase,
  .normalize. F4 self-test binds.
- LOCK 13 (REQUIREMENTS:67-68): autonomy continues. writeCapsule on
  any failure returns { ok:false, reason } and logs to
  context-complaints.jsonl; phase advance proceeds. F3 self-test binds
  (missing-file graceful path).
- LOCK 4 / dead-end #4: read-only against 5 canonical metric streams
  (agent-token-spend, crit-backlog, gate-value-log, review-ledger,
  codex-log) + ALL canonical phase-folder content (CONTEXT, RESEARCH,
  PLAN, VERIFICATION, ATC-REVIEW, codex-review, commit-reviews,
  reviews/). Owned writes: PHASE-CAPSULE.json (overwrite-on-rebuild) +
  PHASE-INDEX.jsonl (append-or-replace) + 2 SKILL.md edits.
- LOCK 8 / dead-end #10: never use process.cwd() for canonical-path
  default INSIDE the lib; always anchor to __dirname with 3-up walk to
  .planning. EXCEPTION: at the SKILL.md orchestrator-skill boundary,
  process.cwd() is required (mirrors Step 4.5 + 4.6 + 4.7 + Phase 41
  sec 7.1 lessons).
- _capsuleContentHash MUST strip created_at + created_by before
  serialization (dead-end #5 + RESEARCH sec 5.2). Including either
  field breaks A3 deterministically.
- File must load in <100ms (mirror Phase 41/42 <50ms with capsule
  writer's heavier extractors; 100ms ceiling).
- Public API failure contract: NEVER throw upward at boundary.
  Closed-shape violations raise inside _assertCapsuleSchema and
  _writeCapsuleInternal; the public API wraps every call in try/catch;
  on error console.warn to stderr + log to context-complaints.jsonl
  + return falsey sentinel.
- Header docblock MUST be rewritten on write.cjs (no `audit` / `walker`
  / `keep` / `kill` / `gate` / `token-waste` / `token-attribution`
  leakage; mirror sources cited only in the docblock prose, not in
  function bodies / error messages / runtime logs).
- Capsule size guard: ~250 LOC JSON target per RESEARCH sec 3.3;
  v1.7/P32-class heavy phases may produce ~400 LOC capsules; that's
  acceptable. Pointers (bypass_refs, source_commits, source_hashes,
  token_cost.evidence_event_id) not copies; raw bypass row body
  remains in crit-backlog.jsonl (Phase 45 packet builder dereferences
  via id).
- README pointer ONLY (no super-gsd/tools/phase-capsule/README.md;
  dead-end #8). Header docblock at top of write.cjs is the
  documentation surface.
- Phase 43's own folder gets a PHASE-CAPSULE.json from the v1.9
  backfill in T2 (status='IN_PROGRESS'). The next phase-close cycle
  (after Phase 43 ATC + verifier complete) will rewrite it via
  forward-flow Step 6.6.i.X to status='PASS' or
  'PASS-WITH-DEFERRED-N'. Acceptable: this is the safety-net that
  T3's wire-in proves out.
</constraints>

<commit_plan>
Three atomic commits, in order (RESEARCH sec 15.5 4-commit option
collapsed to 3 -- the two SKILL.md edits in T3 are atomic; ~25 LOC each
with no inter-skill dependencies; combining keeps the integration delta
atomic and avoids partial-wire commit windows where forward-flow exists
without safety-net or vice-versa):

1. `feat(43-01): phase-capsule schema + write.cjs lib + 13-assertion self-test`
   Files:
     - super-gsd/tools/phase-capsule/write.cjs
     - super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json

2. `feat(43-01): backfill 17 historical capsules (v1.6-v1.8 + v1.9-shipped)`
   Files:
     - .planning/milestones/v1.6/phases/{26..30}/PHASE-CAPSULE.json (5)
     - .planning/milestones/v1.7/phases/{31..35}/PHASE-CAPSULE.json (5)
     - .planning/milestones/v1.8/phases/{36..40}/PHASE-CAPSULE.json (5)
     - .planning/milestones/v1.9/phases/{41,42}/PHASE-CAPSULE.json (2)
     - .planning/milestones/v1.6/PHASE-INDEX.jsonl
     - .planning/milestones/v1.7/PHASE-INDEX.jsonl
     - .planning/milestones/v1.8/PHASE-INDEX.jsonl
     - .planning/milestones/v1.9/PHASE-INDEX.jsonl
     (NOTE: P43's own PHASE-CAPSULE.json may also appear at v1.9 if
      the backfill walks 43-phase-capsule-contract folder during T2.
      That's expected; status will be IN_PROGRESS until phase close.)

3. `feat(43-01): forward-flow phase-close hook + backfill safety-net wire-in (Step 6.6.i.X + Step 4.7-bis)`
   Files:
     - super-gsd/skills/sgsd-orchestrate/SKILL.md
     - super-gsd/skills/sgsd-complete-milestone/SKILL.md

Commit discipline (CLAUDE.md):
- Stage specific files by name. Never `git add -A` or `git add .`.
- Commit after EACH atomic deliverable. Do not batch.
- Commit message format: `feat({phase}-{plan}): {one-liner}`.
- If self-test or backfill fails after a commit, the NEXT commit fixes
  it -- never amend. (CLAUDE.md: NEVER amend.)
</commit_plan>

<verification>
Runnable phase-acceptance script. Executor MUST run end-to-end after T3:

```bash
# === CAP-01 + JSON Schema conformance ===
node super-gsd/tools/phase-capsule/write.cjs --self-test
# Expected: phase-capsule self-test: 13 pass, 0 fail
# Expected exit: 0

# === CAP-01 schema shape (17 required + 1 optional + frozen consts) ===
node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('./super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json','utf8'));
if (s.required.length !== 17) { console.error('FAIL required count', s.required.length); process.exit(1) }
if (s.properties.schema_version.const !== 1) { console.error('FAIL schema_version const'); process.exit(1) }
if (s.properties.status.enum.length !== 5) { console.error('FAIL status enum length'); process.exit(1) }
if (s.additionalProperties !== false) { console.error('FAIL additionalProperties not false'); process.exit(1) }
console.log('PASS CAP-01 schema shape (17 required + closed enum + closed shape)');
"

# === CAP-02 lib exports ===
node -e "
const m = require('./super-gsd/tools/phase-capsule/write.cjs');
const k = Object.keys(m).sort();
const exp = ['BYPASS_KIND_VOCAB','CAPSULE_FILE_KINDS','SCHEMA_VERSION','STATUS_VOCAB','backfillFromCanonical','capsulePath','readCapsule','writeAllCapsulesForMilestone','writeCapsule'];
if (JSON.stringify(k) !== JSON.stringify(exp)) { console.error('FAIL exports', k); process.exit(1) }
console.log('PASS CAP-02 lib exports (4 frozen consts + 5 public APIs)');
"

# === CAP-03 forward-flow + safety-net wire-ins ===
grep -q "i.X. PHASE CAPSULE WRITE" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo "PASS CAP-03 sgsd-orchestrate Step 6.6.i.X" || (echo "FAIL"; exit 1)
grep -q "writeCapsule" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo "PASS writeCapsule reference"
grep -q "step_4_7b_phase_capsule_backfill" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS CAP-03 sgsd-complete-milestone Step 4.7-bis" || (echo "FAIL"; exit 1)
grep -q "writeAllCapsulesForMilestone" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS writeAllCapsulesForMilestone reference"

# === CAP-04 + ROADMAP A3 17-capsule backfill ===
node -e "
const fs = require('fs'), path = require('path');
const expected = [
  'v1.6/phases/26-cockpit-question-contract','v1.6/phases/27-cockpit-data-tree',
  'v1.6/phases/28-mission-control-layout','v1.6/phases/29-agent-codex-lanes',
  'v1.6/phases/30-startup-cockpit-acceptance',
  'v1.7/phases/31-canonical-envelope','v1.7/phases/32-route-decision-ledger',
  'v1.7/phases/33-repair-instruction','v1.7/phases/34-canonical-review-ledger',
  'v1.7/phases/35-generated-system-map',
  'v1.8/phases/36-gate-value-telemetry','v1.8/phases/37-muda-deletion-candidates',
  'v1.8/phases/38-risk-tiered-gate-sampling','v1.8/phases/39-gate-keep-kill',
  'v1.8/phases/40-phase-folder-audit',
  'v1.9/phases/41-baseline-token-attribution',
  'v1.9/phases/42-token-budget-admission'
];
let bad = 0;
for (const r of expected) {
  const p = path.join('.planning','milestones',r,'PHASE-CAPSULE.json');
  if (!fs.existsSync(p)) { console.error('FAIL missing', p); bad++; continue }
  const c = JSON.parse(fs.readFileSync(p,'utf8'));
  if (c.schema_version !== 1) { console.error('FAIL schema_version', p); bad++ }
  if (!c.bypass_refs) { console.error('FAIL no bypass_refs', p); bad++ }
}
if (bad > 0) process.exit(1);
console.log('PASS CAP-04 17 capsules exist + schema-valid');
"

# === ROADMAP A3 idempotent rebuild (BINDING) ===
node super-gsd/tools/phase-capsule/write.cjs --backfill --all > /tmp/sgsd-pc-a3.log 2>&1
node -e "
const log = require('fs').readFileSync('/tmp/sgsd-pc-a3.log','utf8');
if (!/written=0/.test(log)) { console.error('FAIL non-idempotent rebuild', log); process.exit(1) }
console.log('PASS ROADMAP A3 idempotent rebuild (written=0 on second run)');
"

# === ROADMAP A2 + LOCK 6 critical bypass verbatim (spot check) ===
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.planning/milestones/v1.6/phases/28-mission-control-layout/PHASE-CAPSULE.json','utf8'));
const src = fs.readFileSync('.planning/metrics/crit-backlog.jsonl','utf8')
  .split(/\\r?\\n/).filter(Boolean).map(l => JSON.parse(l))
  .filter(r => r.milestone === 'v1.6' && String(r.phase) === '28');
if (src.length === 0) { console.log('SKIP A2 spot v1.6/28 (no rows)'); process.exit(0) }
const matched = c.bypass_refs.find(b => b.id === src[0].id);
if (!matched) { console.error('FAIL v1.6/28 bypass id missing'); process.exit(1) }
if (matched.summary_passthrough !== src[0].summary) {
  console.error('FAIL summary mutated\\nsrc=', JSON.stringify(src[0].summary),'\\ngot=',JSON.stringify(matched.summary_passthrough));
  process.exit(1)
}
console.log('PASS ROADMAP A2 + LOCK 6 verbatim spot-check (v1.6/28)');
"

# === LOCK 13 mechanical embodiment: writeCapsule never throws ===
node -e "
const m = require('./super-gsd/tools/phase-capsule/write.cjs');
let threw = false;
try {
  const r = m.writeCapsule('/nonexistent/planning', { milestone:'fake', phase:'999', phaseDir:'/fake/path' });
  if (!r || r.ok !== false) { console.error('FAIL no ok:false sentinel', r); process.exit(1) }
  if (typeof r.reason !== 'string') { console.error('FAIL no reason string', r); process.exit(1) }
} catch (e) { threw = true; console.error('FAIL writeCapsule threw upward:', e.message); process.exit(1) }
if (threw) process.exit(1);
console.log('PASS LOCK 13 writeCapsule never throws upward (returns ok:false sentinel)');
"

# === LOCK 4 / dead-end #4: read-only invariant against 5 canonical streams ===
git diff --quiet HEAD -- \\
  .planning/metrics/agent-token-spend.jsonl \\
  .planning/metrics/crit-backlog.jsonl \\
  .planning/metrics/gate-value-log.jsonl \\
  .planning/metrics/review-ledger.jsonl \\
  .planning/metrics/codex-log.jsonl \\
  && echo "PASS LOCK 4 read-only canonical streams" \\
  || (echo "FAIL canonical stream modified"; exit 1)

# === LOCK 4 / dead-end #3: read-only invariant against canonical phase-folder content ===
node -e "
const cp = require('child_process');
const out = cp.execSync('git diff --name-only HEAD -- .planning/milestones/v1.6 .planning/milestones/v1.7 .planning/milestones/v1.8 .planning/milestones/v1.9', { encoding:'utf8' });
const lines = out.split(/\\r?\\n/).filter(Boolean);
for (const f of lines) {
  if (!/PHASE-CAPSULE\\.json$|PHASE-INDEX\\.jsonl$/.test(f)) {
    console.error('FAIL canonical phase-folder content modified:', f);
    process.exit(1);
  }
}
console.log('PASS LOCK 4 read-only canonical phase-folder content (only owned writes appear in diff)');
"

# === Dual phase-folder shape (v1.6 ATC-REVIEW.md vs v1.9 reviews/) ===
node -e "
const fs = require('fs');
const c16 = JSON.parse(fs.readFileSync('.planning/milestones/v1.6/phases/26-cockpit-question-contract/PHASE-CAPSULE.json','utf8'));
const c19 = JSON.parse(fs.readFileSync('.planning/milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json','utf8'));
const a16 = c16.source_hashes.atc_review;
const a19 = c19.source_hashes.atc_review;
if (a16 && !/26-ATC-REVIEW\\.md$/.test(a16.path)) { console.error('FAIL v1.6 shape', a16.path); process.exit(1) }
if (a19 && !/reviews\\/41-REVIEW\\.md$/.test(a19.path)) { console.error('FAIL v1.9 shape', a19.path); process.exit(1) }
console.log('PASS dual phase-folder shape detection (v1.6 ATC-REVIEW.md + v1.9 reviews/)');
"

# === ASCII gate (write.cjs + schema + 17 capsules + 4 indexes + 2 SKILL.md) ===
node -e "
const fs = require('fs'), path = require('path');
const targets = [
  'super-gsd/tools/phase-capsule/write.cjs',
  'super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json',
  'super-gsd/skills/sgsd-orchestrate/SKILL.md',
  'super-gsd/skills/sgsd-complete-milestone/SKILL.md',
];
const milestones = ['v1.6','v1.7','v1.8','v1.9'];
const phaseRoots = {
  'v1.6':['26-cockpit-question-contract','27-cockpit-data-tree','28-mission-control-layout','29-agent-codex-lanes','30-startup-cockpit-acceptance'],
  'v1.7':['31-canonical-envelope','32-route-decision-ledger','33-repair-instruction','34-canonical-review-ledger','35-generated-system-map'],
  'v1.8':['36-gate-value-telemetry','37-muda-deletion-candidates','38-risk-tiered-gate-sampling','39-gate-keep-kill','40-phase-folder-audit'],
  'v1.9':['41-baseline-token-attribution','42-token-budget-admission'],
};
for (const ms of milestones) {
  for (const ph of phaseRoots[ms]) targets.push(path.join('.planning','milestones',ms,'phases',ph,'PHASE-CAPSULE.json'));
  targets.push(path.join('.planning','milestones',ms,'PHASE-INDEX.jsonl'));
}
let bad = 0;
for (const t of targets) {
  if (!fs.existsSync(t)) { console.log('SKIP missing', t); continue }
  const s = fs.readFileSync(t,'utf8');
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) { console.error('non-ASCII', t, 'pos', i); bad++; break }
}
if (bad > 0) process.exit(1);
console.log('PASS ASCII gate across', targets.length, 'targets');
"

# === No new dependencies ===
node -e "
const cp = require('child_process');
const out = cp.execSync('git diff --name-only HEAD -- package.json', { encoding:'utf8' });
if (out.trim().length > 0) { console.error('FAIL package.json modified'); process.exit(1) }
console.log('PASS no new dependencies (package.json diff-empty)');
"

# === A1 (capsule includes goal/status/evidence/files/decisions/debt/downstream/source/hashes/bypass) ===
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.planning/milestones/v1.8/phases/40-phase-folder-audit/PHASE-CAPSULE.json','utf8'));
const required = ['goal','status','outputs','files','decisions','debt','downstream_contract','source_commits','source_hashes','bypass_refs'];
for (const k of required) {
  if (!(k in c)) { console.error('FAIL A1 missing field', k); process.exit(1) }
}
console.log('PASS ROADMAP A1 capsule includes 10 required-coverage fields');
"

echo
echo '=== ALL ACCEPTANCE GATES PASSED ==='
echo 'CAP-01: schema (17 required + 1 optional + closed shape) - GREEN'
echo 'CAP-02: write.cjs lib (4 frozen consts + 5 public APIs) - GREEN'
echo 'CAP-03: forward-flow Step 6.6.i.X + safety-net Step 4.7-bis - GREEN'
echo 'CAP-04: 17-capsule backfill (v1.6 5 + v1.7 5 + v1.8 5 + v1.9 2) - GREEN'
echo 'CAP-05: provenance (source files + commits + hashes + status + evidence + debt + downstream + critical bypass refs) - GREEN'
echo 'A1: capsules include goal, status, evidence, files, decisions, debt, downstream contract, source commits, source hashes - GREEN'
echo 'A2: critical bypass entries linked raw, NOT summarized away (LOCK 6) - GREEN'
echo 'A3: deleting + rebuilding yields equivalent content hashes (idempotent) - GREEN'
echo 'LOCK 13: writeCapsule never throws upward; phase advance NEVER blocks on capsule failure - GREEN'
echo 'LOCK 4 / read-only: 5 canonical streams + canonical phase-folder content byte-identical - GREEN'
```

If ANY assertion fails, the executor MUST stop and report. NO partial
ship; NO --amend; NO skipping a failing self-test "for next time".
The verification block runs end-to-end on every dispatch.
</verification>

<success_criteria>
- All 13 self-test assertions PASS (--self-test exit 0; literal stdout
  last line "phase-capsule self-test: 13 pass, 0 fail").
- All 5 public APIs (writeCapsule, writeAllCapsulesForMilestone,
  readCapsule, capsulePath, backfillFromCanonical) exported; all
  wrapped in try/catch; NEVER throw upward.
- All 4 frozen consts (SCHEMA_VERSION, STATUS_VOCAB, BYPASS_KIND_VOCAB,
  CAPSULE_FILE_KINDS) exported; mutation attempts preserve length.
- PHASE-CAPSULE.schema.json valid JSON with 17 required + 1 optional
  fields, additionalProperties:false, schema_version const 1, status
  enum 5-entry.
- 17 historical capsules backfilled (v1.6 P26-30 + v1.7 P31-35 +
  v1.8 P36-40 + v1.9 P41-42); each schema-valid; each ASCII-only;
  each covers 17 required fields.
- 4 PHASE-INDEX.jsonl files exist at .planning/milestones/{v1.6,v1.7,
  v1.8,v1.9}/ with deterministic row shape.
- A3 idempotent rebuild PROVEN at scale: re-running --backfill --all
  reports written=0 (every capsule content_hash unchanged).
- A2 + LOCK 6 verbatim PROVEN: spot-checked bypass_refs[].summary_passthrough
  byte-equal source crit-backlog.jsonl row .summary for at least 3
  capsules.
- LOCK 13 PROVEN: writeCapsule on nonexistent input returns
  { ok:false, reason:<string> } with NO uncaught exception.
- LOCK 4 PROVEN: 5 canonical metric streams + ALL canonical phase-folder
  content byte-identical to HEAD; only PHASE-CAPSULE.json + PHASE-INDEX.jsonl
  + 2 SKILL.md edits appear in diff.
- Dual phase-folder shape PROVEN: v1.6 capsule's source_hashes.atc_review
  cites '{NN}-ATC-REVIEW.md'; v1.9 capsule's source_hashes.atc_review
  cites 'reviews/{NN}-REVIEW.md'.
- ASCII-only across all 23 written/edited targets (write.cjs + schema +
  17 capsules + 4 indexes + 2 SKILL.md).
- No new dependencies (package.json + top-level node_modules diff-empty).
- lib loads in <100ms cold.
- 3 atomic commits landed in order:
  1. `feat(43-01): phase-capsule schema + write.cjs lib + 13-assertion self-test`
  2. `feat(43-01): backfill 17 historical capsules (v1.6-v1.8 + v1.9-shipped)`
  3. `feat(43-01): forward-flow phase-close hook + backfill safety-net wire-in (Step 6.6.i.X + Step 4.7-bis)`
- CAP-01..05 + ROADMAP sec 43 A1/A2/A3 ALL GREEN.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-01-SUMMARY.md` per @$HOME/.claude/get-shit-done/templates/summary.md.

The SUMMARY MUST cite:
  - 13/13 self-test PASS
  - 17 historical capsules backfilled (5+5+5+2 chronological)
  - A3 idempotent rebuild proven (written=0 on second --backfill --all)
  - A2 + LOCK 6 verbatim proven (3+ spot-checks byte-equal)
  - LOCK 13 never-throws proven (ok:false sentinel returned on bad input)
  - LOCK 4 read-only invariant proven (5 streams + canonical phase-folder
    content byte-identical to HEAD)
  - 2 SKILL.md wire-ins landed (Step 6.6.i.X + Step 4.7-bis)
  - 3 atomic commits in order

Phase 43 will then be marked complete via Step 6.6.i; the v1.9 milestone
gets one closer to close. Phase 43's OWN PHASE-CAPSULE.json is initially
written by T2 with status=IN_PROGRESS; the next phase-close cycle (after
Phase 43 verification + ATC) overwrites via Step 6.6.i.X to status=PASS.
</output>
