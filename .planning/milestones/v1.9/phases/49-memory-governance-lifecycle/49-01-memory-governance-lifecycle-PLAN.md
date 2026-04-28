---
schema_version: 2
phase: 49
plan: 01
name: Memory Governance Lifecycle
milestone: v1.9
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/tools/memory-governance/lifecycle.cjs
  - super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
  - super-gsd/tools/phase-capsule/write.cjs
  - super-gsd/tools/context-packet/build.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/skills/sgsd-complete-milestone/SKILL.md
autonomous: true
requirements:
  - GOV-01
  - GOV-02
  - GOV-03
  - GOV-04
  - GOV-05
  - GOV-06
  - GOV-07
  - GOV-08
  - LOCK-2
  - LOCK-6
  - LOCK-11
  - LOCK-13
tags:
  - memory-governance
  - lifecycle
  - admission-gate
  - promotion
  - demotion
  - revocation
  - revalidation
  - complaint-repair
  - v1.9
  - phase-49
user_setup: []

must_haves:
  truths:
    - "every durable memory write (capsule promote, validated_thought write, reusable_rule promote, guardrail promote) routes through admitMemoryWrite() which mechanically rejects unproven, source-less, low-confidence, consumer-less, or revocation-path-less artifacts (A4, A5, GOV-02, GOV-08)"
    - "promotion path raw_evidence -> phase_capsule -> validated_thought -> reusable_rule -> guardrail is explicit, structural-only (no semantic similarity), with closed-enum thresholds: capsule->thought requires admit PASS + non-empty thought + non-empty used_for + bypass_refs[].length===0 + debt.critical_added===0; thought->rule requires admit PASS + cited by >=3 distinct phases + confidence in {medium,high}; rule->guardrail requires admit PASS + manual_promote_with_provenance reason (A1, GOV-04, GOV-07, LOCK-11)"
    - "demote(artifact_id, reason) and revoke(artifact_id, reason, replaced_by_id?) write tombstones onto the existing PHASE-CAPSULE.json (lifecycle field edits via Phase 43 writeCapsule -- canonical preserved, NEVER hard-deleted) and append envelope-v1 rows to memory-demotions.jsonl + memory-revocations.jsonl; replaced_by_id chain depth-cap=5 (A2, GOV-05, GOV-07, LOCK-2)"
    - "revalidate(artifact_id) re-hashes each source_refs[i] via sha256 against the live canonical file; mismatch OR existsSync===false sets revalidation_due=true on the artifact AND appends an envelope-v1 row to memory-revalidations.jsonl; NEVER auto-revokes (A6, LOCK-13)"
    - "processComplaints({since_ts, max_repairs}) reads context-complaints.jsonl filtered by ts>since_ts, classifies each row via reason_codes[], dispatches deterministic repair (capsule rebuild via repair-queue.jsonl, validated_thought demote/revoke, packet rebuild scheduling), advances since_ts cursor monotonically via .planning/metrics/memory-process-cursor.json, caps at max_repairs=50 per invocation (A3, A7, GOV-01)"
    - "loadIndexSnippets(query, opts) (Phase 45 step-6 wire-in) calls Phase 46 query() then filters out rows whose underlying capsule has revoked_at!=null AND annotates remaining rows with revalidation_due flag via _checkSourceHashDrift; NEVER throws (Lock 13 sentinel: returns [] on any internal error)"
    - "PHASE-CAPSULE.json schema extended with 10 OPTIONAL lifecycle fields (compression_level, promoted_at, demoted_at, revoked_at, revoked_reason, allowed_consumers, revalidation_due, supersedes_id, superseded_by_id, revocation_path); required[] array UNCHANGED; existing 44 capsules remain valid pre-backfill (GOV-03, additive schema extension)"
    - "lifecycle backfill (one-shot, idempotent) populates 44 existing PHASE-CAPSULE.json with safe defaults: compression_level='phase_capsule', promoted_at=cap.created_at, allowed_consumers=['*'], revocation_path='super-gsd/tools/memory-governance/lifecycle.cjs#revoke'; capsules whose compression_level!=null are SKIPPED (Pitfall 2 idempotency)"
    - "5 frozen Object.freeze closed enums: COMPRESSION_LEVELS imported BY REFERENCE from Phase 45, PROMOTION_REASONS (3-entry), DEMOTION_REASONS (4-entry), REVOKE_REASONS (5-entry), CONFIDENCE_VOCAB (3-entry), ADMISSION_REJECT_CODES (9-entry), REVALIDATION_KINDS (2-entry); NEVER redefined COMPRESSION_LEVELS or _assertValidatedThoughtProvenance"
    - "all 6 public APIs (admitMemoryWrite, promote, demote, revoke, revalidate, processComplaints) AND loadIndexSnippets AND backfillLifecycleFields wrap internals in try/catch with sentinel return {ok:false, reason:'<api>_internal_error'}; on internal error: stderr-warn + APPEND row to context-complaints.jsonl (envelope-v1); phase advance NEVER halts on Phase 49 failure (LOCK-13)"
    - "Phase 45 step-6 wire-in patches build.cjs:702-703 from 'const indexSnippets = []; // No-op fallback; explicit empty.' to a try/catch require('../memory-governance/lifecycle.cjs') with loadIndexSnippets() call; original empty-stub fallback preserved on require failure (Q8 LOCKED, additive edit)"
    - "Phase 43 schema edits: PHASE-CAPSULE.schema.json adds 10 oneOf optional fields (additive); _assertCapsuleSchema validates the new fields per closed enum (compression_level oneOf 5 vocab) + ISO timestamp pattern + boolean for revalidation_due; existing F1-F4 Phase 43 self-test fixtures pass UNCHANGED post-edit"
    - "Phase 49 OWNS 4 NEW canonical streams: memory-promotions.jsonl, memory-demotions.jsonl, memory-revocations.jsonl, memory-revalidations.jsonl (all envelope-v1, envelope_version=1); plus memory-process-cursor.json (NEW, processComplaints monotonic cursor); plus repair-queue.jsonl (NEW, orchestrator-pickup queue)"
    - "Phase 49 is READ-ONLY against 9 v1.9 canonical metric streams (token-attribution, codex-log, agent-token-spend, activity-log, token-log, token-waste-status, crit-backlog, route-decisions, vtp-bridge-failures); READ-ONLY against Phase 41-48 .cjs source files; READ-ONLY against canonical phase-folder content (CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC-REVIEW/reviews); F10 fixture fingerprint-asserts no drift on 30+ paths"
    - "self-test passes 14-22/14-22 assertions across 22 fixtures (F1-F14 plus sub-fixtures) in <10s with __dirname-anchored fingerprint guard; CLI: --admit / --promote / --demote / --revoke / --revalidate / --process-complaints / --backfill / --self-test verbs mirror Phase 47/48 precedent"
    - "SKILL wires: sgsd-orchestrate Step 6.6.i.Y (NEW, after capsule write at Step 6.6.i.X) calls processComplaints({since_ts: <cursor>, max_repairs: 50}) at phase close; sgsd-complete-milestone Step 4.7-quater (NEW, after Step 4.7-bis capsule backfill) calls revalidate batch over closing-milestone capsules; both wires Lock 13 wrapped (failure logs context-complaint, never halts close)"
  artifacts:
    - path: "super-gsd/tools/memory-governance/lifecycle.cjs"
      provides: "6 public APIs (admitMemoryWrite, promote, demote, revoke, revalidate, processComplaints) + loadIndexSnippets (public + Phase 45 step-6 wire) + backfillLifecycleFields (public, one-shot migration) + getMemoryGovernanceSnapshot (Phase 50 forward contract) + 7 frozen Object.freeze closed enums + _normalize helpers + _assertLifecycleFieldSchema + _editCapsuleLifecycleFields + _checkSourceHashDrift + _appendLedgerRow + _resolveCapsule + _capsuleArtifactId + _assertNoCanonicalDrift fingerprint guard + 14-22 in-module assertions in _runSelfTest + CLI verbs (--admit / --promote / --demote / --revoke / --revalidate / --process-complaints / --backfill / --self-test)"
      min_lines: 850
      contains: "Object.freeze"
      exports:
        - "admitMemoryWrite"
        - "promote"
        - "demote"
        - "revoke"
        - "revalidate"
        - "processComplaints"
        - "loadIndexSnippets"
        - "backfillLifecycleFields"
        - "getMemoryGovernanceSnapshot"
        - "COMPRESSION_LEVELS"
        - "PROMOTION_REASONS"
        - "DEMOTION_REASONS"
        - "REVOKE_REASONS"
        - "CONFIDENCE_VOCAB"
        - "ADMISSION_REJECT_CODES"
        - "REVALIDATION_KINDS"
        - "ENVELOPE_VERSION"
        - "MAX_REPAIRS_PER_INVOCATION"
        - "REPLACED_BY_CHAIN_DEPTH_CAP"
    - path: "super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json"
      provides: "10 OPTIONAL lifecycle fields added to top-level properties: compression_level (oneOf 5-vocab string + null), promoted_at + demoted_at + revoked_at (oneOf ISO-timestamp pattern + null), revoked_reason (oneOf string + null), allowed_consumers (oneOf string[] + null), revalidation_due (oneOf boolean + null), supersedes_id + superseded_by_id (oneOf string + null), revocation_path (oneOf string + null); required[] array UNCHANGED; additionalProperties:false PRESERVED (closed-shape via explicit enumeration)"
      min_lines: 220
      contains: "compression_level"
    - path: "super-gsd/tools/phase-capsule/write.cjs"
      provides: "_assertCapsuleSchema EXTENDED to validate the 10 new lifecycle fields per schema oneOf (closed-enum vocab assertion for compression_level + revoked_reason; ISO timestamp pattern assertion for *_at; boolean assertion for revalidation_due; string assertion for revocation_path/supersedes_id/superseded_by_id; array-of-string for allowed_consumers); LIFECYCLE_FIELDS frozen const exported for Phase 49 reference; Phase 43 self-test grows to cover one assertion that schema accepts a capsule with all 10 lifecycle fields populated AND rejects an invalid compression_level value"
      min_lines: 1840
      contains: "LIFECYCLE_FIELDS"
    - path: "super-gsd/tools/context-packet/build.cjs"
      provides: "Step 6 wire-in: line 702-703 'const indexSnippets = []; // No-op fallback; explicit empty.' replaced with try/catch require('../memory-governance/lifecycle.cjs') -> loadIndexSnippets(intent_map.intent || '', {planningDir:_planningDir(opts), milestone, phase, limit:5, strict_revalidation:false}); original empty-stub fallback preserved on require failure (Lock 13); Phase 45 self-test fixtures continue to pass UNCHANGED (the require fallback to [] retains current behavior in test envs without Phase 49)"
      min_lines: 1294
      contains: "loadIndexSnippets"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "NEW Step 6.6.i.Y (after Step 6.6.i.X PHASE CAPSULE WRITE; before Step 6.6.i mark complete): MEMORY GOVERNANCE COMPLAINT PROCESSING. Calls processComplaints({since_ts: <read from .planning/metrics/memory-process-cursor.json>, max_repairs: 50}). Lock 13 wrapped. Failure logs context-complaint, NEVER halts phase advance. Cites Phase 49 RESEARCH sec 6 + GOV-01 + Lock 13."
      min_lines: 2410
      contains: "processComplaints"
    - path: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      provides: "NEW Step 4.7-quater (after Step 4.7-bis Phase Capsule Backfill; before Step 4.7-ter Intent-Map close): MEMORY GOVERNANCE REVALIDATION SWEEP. Walks all PHASE-CAPSULE.json under closing milestone, calls revalidate(capsule_artifact_id) per capsule, aggregates drift count, never auto-revokes. Lock 13 wrapped. Cites Phase 49 RESEARCH sec Q6 + A6 + Lock 13."
      min_lines: 510
      contains: "revalidate"
  key_links:
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: "super-gsd/tools/phase-capsule/write.cjs"
      via: "require('../phase-capsule/write.cjs') -> { readCapsule, writeCapsule, STATUS_VOCAB, BYPASS_KIND_VOCAB, _capsuleContentHash } imported BY REFERENCE; lifecycle field edits routed through phase43.writeCapsule (atomic tmp+rename); NEVER bypasses Phase 43 writer"
      pattern: "require\\(.*phase-capsule/write\\.cjs.*\\)"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: "super-gsd/tools/context-registry/check.cjs"
      via: "require('../context-registry/check.cjs') -> { validateOne, REASONS } imported BY REFERENCE for legal-key admission on artifact source_refs[]; admitMemoryWrite calls validateOne(key,'phases') on each ref"
      pattern: "validateOne"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: "super-gsd/tools/context-packet/build.cjs"
      via: "require('../context-packet/build.cjs') -> { COMPRESSION_LEVELS, _assertValidatedThoughtProvenance } imported BY REFERENCE; Phase 49 NEVER redefines COMPRESSION_LEVELS; provenance gate is the existing Phase 45 function called by reference"
      pattern: "COMPRESSION_LEVELS"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: "super-gsd/tools/context-cache/query.cjs"
      via: "require('../context-cache/query.cjs') -> { query } imported BY REFERENCE for loadIndexSnippets index lookup; Phase 46 owns the SQLite + per-row Phase 44 validateOne filter"
      pattern: "phase46\\.query"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: ".planning/metrics/memory-promotions.jsonl"
      via: "fs.appendFileSync envelope-v1 row on every successful promote() call; NEW canonical stream owned by Phase 49"
      pattern: "memory-promotions\\.jsonl"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: ".planning/metrics/memory-demotions.jsonl"
      via: "fs.appendFileSync envelope-v1 row on every successful demote() call; NEW canonical stream"
      pattern: "memory-demotions\\.jsonl"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: ".planning/metrics/memory-revocations.jsonl"
      via: "fs.appendFileSync envelope-v1 row on every successful revoke() call; NEW canonical stream"
      pattern: "memory-revocations\\.jsonl"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: ".planning/metrics/memory-revalidations.jsonl"
      via: "fs.appendFileSync envelope-v1 row on every drift-detected revalidate() call; NEW canonical stream"
      pattern: "memory-revalidations\\.jsonl"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: ".planning/metrics/repair-queue.jsonl"
      via: "fs.appendFileSync envelope-v1 row on processComplaints repair-action scheduling; orchestrator-pickup queue (Phase 49 schedules, orchestrator dispatches Phase 45 packet rebuild via existing wire)"
      pattern: "repair-queue\\.jsonl"
    - from: "super-gsd/tools/memory-governance/lifecycle.cjs"
      to: ".planning/metrics/memory-process-cursor.json"
      via: "fs.writeFileSync (atomic tmp+rename) of {since_ts: <max ts processed>}; processComplaints reads on entry, writes on exit; monotonic advance prevents repair-loop (Pitfall 6)"
      pattern: "memory-process-cursor\\.json"
    - from: "super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json"
      to: "super-gsd/tools/phase-capsule/write.cjs"
      via: "_assertCapsuleSchema reads SCHEMA via _loadSchema (write.cjs:855-858); 10 new optional lifecycle properties added to schema.properties; allowed-key Set auto-includes them via Object.keys(schema.properties); _assertCapsuleSchema extended with explicit per-field validation calls"
      pattern: "compression_level"
    - from: "super-gsd/tools/context-packet/build.cjs"
      to: "super-gsd/tools/memory-governance/lifecycle.cjs"
      via: "build.cjs:702-703 step-6 wire-in: try/catch require('../memory-governance/lifecycle.cjs') -> phase49.loadIndexSnippets(intent_map.intent || '', {planningDir, milestone, phase, limit:5, strict_revalidation:false}); fallback to indexSnippets=[] on require failure (Lock 13)"
      pattern: "memory-governance/lifecycle\\.cjs"
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/tools/memory-governance/lifecycle.cjs"
      via: "Step 6.6.i.Y (NEW): require('../../tools/memory-governance/lifecycle.cjs').processComplaints({since_ts, max_repairs:50}); reads cursor from .planning/metrics/memory-process-cursor.json; Lock 13 wrapped; failure logs context-complaint, never halts phase advance"
      pattern: "processComplaints"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      to: "super-gsd/tools/memory-governance/lifecycle.cjs"
      via: "Step 4.7-quater (NEW): require('../../tools/memory-governance/lifecycle.cjs').revalidate(artifact_id) batched across PHASE-CAPSULE.json under closing milestone; aggregates drift count; never auto-revokes; Lock 13 wrapped"
      pattern: "revalidate"
---

<objective>
Phase 49 ships THE MEMORY GOVERNANCE KERNEL: a single deterministic module
`super-gsd/tools/memory-governance/lifecycle.cjs` exporting six public APIs
(`admitMemoryWrite`, `promote`, `demote`, `revoke`, `revalidate`,
`processComplaints`) plus the Phase 45 step-6 wire (`loadIndexSnippets`),
the one-shot lifecycle migration (`backfillLifecycleFields`), and the
Phase 50 forward-contract helper (`getMemoryGovernanceSnapshot`). Every
durable memory write in SGSD routes through `admitMemoryWrite()` --
mechanically rejecting unproven, source-less, low-confidence, consumer-less,
or revocation-path-less artifacts. Promotion is structural-only (counted
evidence rows, counted reuse phases, closed-enum confidence -- never
embedding similarity per LOCK 11). Revocation is tombstone-only (never
hard-deletes per LOCK 2). Revalidation is read-pulled (sha256 source-hash
drift detection at consumption point per LOCK 13 -- no autonomous halt).
Complaint repair is bounded + cursor-driven (max 50 per invocation,
monotonic since_ts cursor; Pitfall 6 mitigation).

Purpose: stop SGSD from "remembering whatever the last agent wrote."
v1.9 has built every input Phase 49 consumes -- Phase 43 capsule schema +
writer, Phase 44 legal-key validateOne, Phase 45 _assertValidatedThoughtProvenance
+ COMPRESSION_LEVELS + complaint envelope, Phase 46 SQLite query(),
Phase 47 route_decisions, Phase 48 evidence_packet shape. Phase 49 IS the
gate + lifecycle ledger + repair loop, NOT new infrastructure. Memory
writes become privileged state transitions: provenance + confidence +
source_hashes + allowed_consumers + revocation_path. Read-time
reconsolidation (source files drifting under a stored thought) is treated
as a write risk and surfaces via revalidation_due flag (consumer's choice
to elide). Complaints (broad_raw_fallback, validated_thought_missing_provenance,
packet_capsule_unavailable_raw_fallback, etc.) trigger deterministic
repair: capsule rebuild scheduling, packet re-emit scheduling, thought
demote/revoke -- never auto-cascade revocation per LOCK 13.

Output: NEW module `super-gsd/tools/memory-governance/lifecycle.cjs`
(~850-1100 LOC; mirrors Phase 41-48 mid-range single-module precedent)
with 6 public APIs + 3 helpers + 7 frozen Object.freeze closed enums +
14-22 assertion `--self-test` CLI parity with Phase 41-48.
ADDITIVE EDITS to `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json`
(10 new OPTIONAL lifecycle fields; required[] unchanged; closed-shape preserved)
and `super-gsd/tools/phase-capsule/write.cjs::_assertCapsuleSchema`
(validate the 10 new fields per schema oneOf). ONE-SHOT LIFECYCLE BACKFILL
populates 44 existing PHASE-CAPSULE.json with safe defaults (idempotent;
re-run is no-op). PHASE 45 STEP-6 WIRE-IN replaces line 702-703 stub
`const indexSnippets = []; // No-op fallback; explicit empty.` with a
try/catch require of Phase 49 `loadIndexSnippets()` (preserves empty-stub
fallback on require failure; Phase 45 self-test continues to pass UNCHANGED).
SKILL WIRES: sgsd-orchestrate Step 6.6.i.Y (processComplaints at phase
close) and sgsd-complete-milestone Step 4.7-quater (revalidate batch at
milestone close). 4 NEW canonical streams owned (memory-{promotions,
demotions,revocations,revalidations}.jsonl); 2 NEW supporting files owned
(memory-process-cursor.json, repair-queue.jsonl). 9 v1.9 canonical metric
streams + Phase 41-48 source files + canonical phase-folder content remain
READ-ONLY (F10 fixture fingerprint-asserts no drift on 30+ paths).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md
@.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md
@.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-CONTEXT.md
@.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-RESEARCH.md
@super-gsd/tools/phase-capsule/write.cjs
@super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
@super-gsd/tools/context-registry/check.cjs
@super-gsd/tools/context-packet/build.cjs
@super-gsd/tools/context-cache/query.cjs
@super-gsd/tools/dispatch-router/route.cjs
@super-gsd/tools/vtp-bridge/classify.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/skills/sgsd-orchestrate/SKILL.md
@super-gsd/skills/sgsd-complete-milestone/SKILL.md

<interfaces>
<!-- Contracts the executor MUST consume by reference. Zero codebase exploration needed. -->

# Phase 43 phase-capsule/write.cjs (HEAD) -- IMPORT BY REFERENCE; NEVER REDEFINE

```javascript
// write.cjs:76 -- frozen status enum.
const STATUS_VOCAB = Object.freeze([
  'PASS', 'PASS-WITH-DEFERRED-N', 'FAIL', 'UNKNOWN', 'IN_PROGRESS',
]);

// write.cjs:89 -- frozen bypass-kind enum.
const BYPASS_KIND_VOCAB = Object.freeze([
  'CRIT', 'stack-trace', 'stderr', 'failed-test', 'verifier-fail',
  'edge-guard-miss', 'security-issue', 'destructive-warning', 'provider-outage',
]);

// write.cjs:1124 -- read existing capsule.
function readCapsule(planningDir, milestone, phase) -> capsuleObject | null

// write.cjs:1135 -- atomic write capsule (extracts from canonical sources;
// Phase 49 calls with edits parameter applied via _editCapsuleLifecycleFields wrapper).
function writeCapsule(planningDir, { milestone, phase, phaseDir }) -> { ok, path?, content_hash? } | { ok:false, reason }

// write.cjs:851-1010 -- _assertCapsuleSchema is closed-shape (additionalProperties:false).
// Phase 49 EDITS this function (Task 2) to validate 10 new optional lifecycle fields.
// The allowed-key Set auto-expands via Object.keys(schema.properties) once schema is updated.

// write.cjs:1389 -- batch backfill across milestone (read-only against canonical;
// Phase 49 calls this conceptually but ships its own backfillLifecycleFields()
// because Phase 49 wants to ALSO populate lifecycle fields on already-existing capsules
// without rewriting their content from canonical -- Phase 49 does a lifecycle-only edit).

// write.cjs:837 -- git rev-parse fallback to 'unknown'; mirror in Phase 49.
function _resolveSelfGitSha() -> string

// write.cjs:171 -- sha256 hex; mirror in Phase 49 _checkSourceHashDrift.
function _sha256OfBytes(buf) -> string

// write.cjs:757 -- canonical capsule content hash; Phase 49 may use for ledger
// row's artifact_id when artifact has no explicit id.
function _capsuleContentHash(capsule) -> string
```

# Phase 44 context-registry/check.cjs (HEAD) -- IMPORT BY REFERENCE

```javascript
// check.cjs:68 -- legal-key validator. Phase 49 admitMemoryWrite calls
// validateOne(key, 'phases') on each artifact.source_refs[i] to enforce
// "every memory write references a legal source key."
function validateOne(key, category) -> { valid:bool, reason?, registry_version? }

// check.cjs:37 -- frozen REASONS enum (8-entry).
const REASONS = Object.freeze([
  'legal_match','registry_unreadable','category_unknown',
  'key_not_in_registry','key_format_invalid',
  'registry_stale','registry_load_internal_error','validation_internal_error',
]);

// check.cjs:445 -- explicit Phase 49 cross-reference comment:
// "Phase 49 GOV-02 owns memory-write admission decision"
```

# Phase 45 context-packet/build.cjs (HEAD) -- IMPORT BY REFERENCE; NEVER REDEFINE

```javascript
// build.cjs:104 -- frozen 5-entry compression-level enum.
// PHASE 49 IMPORTS BY REFERENCE; NEVER REDEFINES. THIS IS THE ENUM.
const COMPRESSION_LEVELS = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
]);

// build.cjs:220-234 -- Phase 49 calls this BY REFERENCE on validated_thought
// admission. Single source of truth for provenance rules.
function _assertValidatedThoughtProvenance({source_refs, root_source_hashes}) -> throws|void

// build.cjs:208-215 -- _estimateTokens (word-count x 1.3); Phase 49 may mirror
// for ledger row size budgeting (envelope rows must be < 4000 bytes; Pitfall 4).
function _estimateTokens(s) -> number

// build.cjs:273-287 -- _emitContextPacketComplaint envelope-v1 row writer.
// Phase 49 mirrors shape (envelope_version:1, ts, command, status, reason_codes[], details{}).

// build.cjs:702-703 -- STEP 6 STUB Phase 49 PATCHES (Task 4):
//   // Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct).
//   const indexSnippets = []; // No-op fallback; explicit empty.
// Phase 49 patches to (additive; preserves fallback):
//   let indexSnippets = [];
//   try {
//     const phase49 = require('../memory-governance/lifecycle.cjs');
//     if (phase49 && typeof phase49.loadIndexSnippets === 'function') {
//       indexSnippets = phase49.loadIndexSnippets(intent_map.intent || '', {
//         planningDir: _planningDir(opts),
//         milestone: milestone, phase: phase, limit: 5,
//         strict_revalidation: false,
//       });
//     }
//   } catch (_e) { indexSnippets = []; }
```

# Phase 46 context-cache/query.cjs (HEAD) -- IMPORT BY REFERENCE

```javascript
// query.cjs:128 -- index query with per-row Phase 44 validateOne filter
// already applied. Phase 49 loadIndexSnippets calls this and adds the
// revocation/revalidation filter on top.
function query(text, opts) -> rows[]
// opts: { milestone?, phase?, limit?, kinds?, filter_invalid? }
// rows: [{ kind, key, snippet, score, milestone?, phase?, ... }]
```

# Phase 47 dispatch-router/route.cjs (HEAD) -- INFORMATIONAL ONLY

```javascript
// route.cjs:77 -- frozen 6-entry uncertainty_type enum (informational; Phase 49
// may classify memory-writes by uncertainty source for future routing).
const UNCERTAINTY_TYPES = Object.freeze([
  'deterministic_extraction','bounded_code_review','synthesis_judgment',
  'architecture_challenge','prior_memory_lookup','book_lookup',
]);
```

# Phase 48 vtp-bridge/classify.cjs (HEAD) -- INFORMATIONAL ONLY

```javascript
// classify.cjs:99 -- frozen VTP_TOOL_MAP (4 entries; 3 active + 1 reserved
// 'research_external_validation' at line 123 awaits Phase 49 governance gate).
// Phase 49 ships WITHOUT activating the reserved entry; activation deferred.
```

# Phase 32 scripts/lib/route-ledger.cjs (HEAD) -- PATTERN REFERENCE ONLY

```javascript
// route-ledger.cjs:211 -- envelope-v1 emission pattern. Phase 49 emits its OWN
// ledger rows (4 NEW streams); does NOT call logRouteDecision. Pattern reference only.
```

# Lifecycle Field Schema Extension (Task 2 -- additive to Phase 43 schema)

```json
// PHASE 49 ADDS to PHASE-CAPSULE.schema.json properties (additive only;
// required[] UNCHANGED; additionalProperties:false PRESERVED; existing 17
// fields verbatim):
{
  "compression_level": {
    "oneOf": [
      { "type": "string", "enum": ["raw_evidence","phase_capsule","validated_thought","reusable_rule","guardrail"] },
      { "type": "null" }
    ]
  },
  "promoted_at":      { "oneOf": [{ "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" }, { "type": "null" }] },
  "demoted_at":       { "oneOf": [{ "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" }, { "type": "null" }] },
  "revoked_at":       { "oneOf": [{ "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" }, { "type": "null" }] },
  "revoked_reason":   { "oneOf": [{ "type": "string" }, { "type": "null" }] },
  "allowed_consumers": { "oneOf": [{ "type": "array", "items": { "type": "string" } }, { "type": "null" }] },
  "revalidation_due": { "oneOf": [{ "type": "boolean" }, { "type": "null" }] },
  "supersedes_id":    { "oneOf": [{ "type": "string" }, { "type": "null" }] },
  "superseded_by_id": { "oneOf": [{ "type": "string" }, { "type": "null" }] },
  "revocation_path":  { "oneOf": [{ "type": "string" }, { "type": "null" }] }
}
```

# admitMemoryWrite Contract (Task 1 -- public API)

```javascript
// SIGNATURE: admitMemoryWrite(artifact) -> { ok:true } | { ok:false, reason:<ADMISSION_REJECT_CODES> }
// LOCK 13 wrapped: never throws upward; on internal error returns
// { ok:false, reason:'memory_admission_internal_error' } AND appends a
// row to .planning/metrics/context-complaints.jsonl (envelope-v1).
//
// MANDATORY artifact fields (any missing/invalid -> reject):
//   source_refs:        string[]     // non-empty
//   root_source_hashes: string[]     // non-empty; same length as source_refs
//   confidence:         'low'|'medium'|'high'
//   allowed_consumers:  string[]     // non-empty
//   revocation_path:    string       // non-empty
//   compression_level:  one of COMPRESSION_LEVELS
//
// CARVE-OUTS (LOCK 6 + Pitfall 5):
//   bypass_refs[].length > 0 AND compression_level > phase_capsule -> REJECT
//     (memory_admission_bypass_refs_block_promotion)
//   debt.critical_added > 0 AND compression_level > phase_capsule -> REJECT
//     (memory_admission_debt_blocks_promotion)
//
// Validated_thought additional gate: if compression_level === 'validated_thought',
// also call phase45._assertValidatedThoughtProvenance({source_refs, root_source_hashes})
// in a try/catch -- if it throws, REJECT with memory_admission_provenance_missing.
```

# CLOSED ENUMS Phase 49 OWNS (Task 1 -- frozen Object.freeze)

```javascript
// COMPRESSION_LEVELS imported BY REFERENCE -- DO NOT REDEFINE.
const phase45 = require('../context-packet/build.cjs');
const COMPRESSION_LEVELS = phase45.COMPRESSION_LEVELS;

// PROMOTION_REASONS (3-entry).
const PROMOTION_REASONS = Object.freeze([
  'evidence_threshold_met',
  'reuse_threshold_met',
  'manual_promote_with_provenance',
]);

// DEMOTION_REASONS (4-entry).
const DEMOTION_REASONS = Object.freeze([
  'abstraction_failed',
  'source_drifted',
  'complaint_threshold_exceeded',
  'superseded_by_new_evidence',
]);

// REVOKE_REASONS (5-entry).
const REVOKE_REASONS = Object.freeze([
  'stale',
  'poisoned',
  'contradicted',
  'source_lost',
  'superseded_by_revoked_chain',
]);

// CONFIDENCE_VOCAB (3-entry).
const CONFIDENCE_VOCAB = Object.freeze(['low', 'medium', 'high']);

// ADMISSION_REJECT_CODES (9-entry).
const ADMISSION_REJECT_CODES = Object.freeze([
  'memory_admission_artifact_missing',
  'memory_admission_provenance_missing',
  'memory_admission_confidence_invalid',
  'memory_admission_consumers_missing',
  'memory_admission_revocation_path_missing',
  'memory_admission_compression_level_invalid',
  'memory_admission_bypass_refs_block_promotion',
  'memory_admission_debt_blocks_promotion',
  'memory_admission_internal_error',
]);

// REVALIDATION_KINDS (2-entry).
const REVALIDATION_KINDS = Object.freeze([
  'source_hash_drift',
  'source_file_missing',
]);

// Constants.
const ENVELOPE_VERSION = 1;
const MAX_REPAIRS_PER_INVOCATION = 50;
const REPLACED_BY_CHAIN_DEPTH_CAP = 5;
const COMMAND_NAMES = Object.freeze({
  admit:       'memoryAdmit',
  promote:     'memoryPromote',
  demote:      'memoryDemote',
  revoke:      'memoryRevoke',
  revalidate:  'memoryRevalidate',
  process:     'memoryProcessComplaints',
  backfill:    'memoryBackfill',
});
```

# Envelope-v1 Ledger Row Shape (Task 1 -- 4 NEW streams use identical shape)

```javascript
// Mirrors Phase 45 _emitContextPacketComplaint at build.cjs:273-287.
// Each ledger row is < 4000 bytes (Pitfall 4 mitigation; truncate details if larger).
{
  envelope_version: 1,
  ts: '2026-04-27T22:00:00.000Z',  // new Date().toISOString()
  command: 'memoryPromote',         // one of COMMAND_NAMES values
  status: 'ok' | 'warn' | 'fail',
  reason_codes: ['evidence_threshold_met'],  // closed enum strings only
  artifact_id: 'v1.6/26#a1b2c3d4',  // milestone/phase#capsule_content_hash[0:8]
  details: {                         // small payload; truncate to <2000 bytes
    from_level: 'phase_capsule',
    to_level: 'validated_thought',
    new_id: 'vt-...',
    evidence_count: 3,
  },
}
```

# Repair-Queue Row Shape (Task 1 -- processComplaints scheduling)

```javascript
// .planning/metrics/repair-queue.jsonl envelope-v1 row.
// Orchestrator picks up; Phase 49 does NOT call Phase 45 buildPacket directly.
{
  envelope_version: 1,
  ts: '2026-04-27T22:00:00.000Z',
  command: 'memoryProcessComplaints',
  status: 'ok',
  reason_codes: ['repair_scheduled'],
  details: {
    repair_kind: 'packet_rebuild' | 'capsule_rebuild' | 'thought_demote' | 'thought_revoke',
    target: { milestone, phase, intent_id?, artifact_id? },
    triggered_by_complaint_ts: '...',
    triggered_by_reason_code: 'broad_raw_fallback' | etc.,
  },
}
```

# Process Cursor File Shape (Task 1 -- monotonic since_ts)

```javascript
// .planning/metrics/memory-process-cursor.json
// Read-modify-write atomic via tmp+rename.
{
  schema_version: 1,
  since_ts: '2026-04-27T22:00:00.000Z',  // max ts processed in last invocation
  last_invocation_ts: '2026-04-27T22:00:00.000Z',
  last_repairs_attempted: 12,
  last_repairs_succeeded: 11,
}
```
</interfaces>

<source_audit>

## Multi-Source Coverage Audit

| Source Item | Source | Plan Coverage | Tasks |
|-------------|--------|---------------|-------|
| GOAL: "govern what becomes future SGSD memory" | 49-CONTEXT.md L11 | 6 public APIs + admission gate + lifecycle ledger + repair loop in lifecycle.cjs | T1, T2, T3 |
| GOAL: "memory writes are privileged state transitions, not casual summaries" | 49-CONTEXT.md L15 | admitMemoryWrite mandatory 6-field gate; ADMISSION_REJECT_CODES 9-entry frozen | T1 |
| GOAL: "context complaints, memory write admission, promotion/demotion, revocation/deletion protocol, lifecycle fields" | 49-CONTEXT.md L13-15 | All 6 APIs + 4 NEW canonical streams + 10 lifecycle fields on capsule schema | T1, T2, T3 |
| REQ GOV-01: context complaint log lifecycle | REQUIREMENTS.md L205-206 | processComplaints API reads context-complaints.jsonl + dispatches repair via repair-queue.jsonl | T1 |
| REQ GOV-02: memory write admission checks | REQUIREMENTS.md L207-208 | admitMemoryWrite + 9-entry ADMISSION_REJECT_CODES + Phase 44 validateOne integration | T1 |
| REQ GOV-03: lifecycle fields on capsules + rules | REQUIREMENTS.md L209-211 | 10 OPTIONAL fields on PHASE-CAPSULE.schema.json + _assertCapsuleSchema extension | T2 |
| REQ GOV-04: promotion/demotion rules raw->capsule->rule | REQUIREMENTS.md L212 | promote API with 3 structural threshold tiers + demote API + 4-entry DEMOTION_REASONS | T1 |
| REQ GOV-05: revocation/deletion protocol | REQUIREMENTS.md L213 | revoke API tombstone semantics + replaced_by_id chain depth-cap=5 + 5-entry REVOKE_REASONS | T1 |
| REQ GOV-06: intent-map promotion gate | REQUIREMENTS.md L214-215 | admitMemoryWrite enforces same provenance gate for intent-map promotion candidates | T1 |
| REQ GOV-07: bidirectional compression lifecycle raw_evidence->phase_capsule->validated_thought->reusable_rule/guardrail | REQUIREMENTS.md L216-218 | promote (up) + demote (down) + revoke (tombstone) covers all 5 levels via COMPRESSION_LEVELS | T1 |
| REQ GOV-08: privileged state transition with provenance + source hashes + allowed consumers + revalidation path | REQUIREMENTS.md L219-222 | admitMemoryWrite enforces all 6 mandatory fields + memory-revalidations.jsonl ledger | T1 |
| LOCK-2: .planning JSONL + git remain canonical truth | REQUIREMENTS.md L36-37 | revoke writes tombstone (revoked_at) NOT delete; backfill is additive; F10 fingerprint diff | T1, T3 |
| LOCK-6: critical bypass NEVER compressed | REQUIREMENTS.md L41-42 | admitMemoryWrite rejects bypass_refs[].length>0 + compression_level>phase_capsule (memory_admission_bypass_refs_block_promotion); F2d | T1 |
| LOCK-11: no semantic-only routing | REQUIREMENTS.md L52-54 | promotion thresholds are STRUCTURAL (>=3 evidence rows / >=3 reuse phases); _validateInput rejects similarity_score / cosine / fuzzy_match fields | T1 |
| LOCK-13: never-throws | REQUIREMENTS.md L67-68 | All 6 public APIs + loadIndexSnippets + backfillLifecycleFields wrapped try/catch with sentinel return + context-complaint emission on internal error; F13 | T1 |
| RESEARCH sec 3: admitMemoryWrite signature + 9 reject codes | 49-RESEARCH.md L922-955 | T1 implements verbatim with all 9 ADMISSION_REJECT_CODES | T1 |
| RESEARCH sec 4: promotion path 3 structural thresholds | 49-RESEARCH.md L956-995 | T1 implements promote() with 3-tier threshold table | T1 |
| RESEARCH sec 5: demote + revoke contract | 49-RESEARCH.md L996-1013 | T1 implements with closed-enum reasons + replaced_by_id chain depth-cap=5 | T1 |
| RESEARCH sec 6: revalidation read-pulled | 49-RESEARCH.md L1014-1023 | T1 implements revalidate() + _checkSourceHashDrift; called from loadIndexSnippets | T1 |
| RESEARCH sec 7: complaint repair-action map | 49-RESEARCH.md L1024-1040 | T1 implements processComplaints with 8-entry repair classifier + repair-queue.jsonl + cursor | T1 |
| RESEARCH sec 8: Phase 45 step-6 wire-in | 49-RESEARCH.md L1041-1073 | T4 patches build.cjs:702-703 with try/catch require('../memory-governance/lifecycle.cjs') | T4 |
| RESEARCH sec 9: 4 NEW canonical streams | 49-RESEARCH.md L1074-1088 | T1 emits to memory-{promotions,demotions,revocations,revalidations}.jsonl envelope-v1 | T1 |
| RESEARCH sec 10: Lock 13 try/catch wrap | 49-RESEARCH.md L1089-1093 | T1 every public API wrapped; F13 fixture binds | T1 |
| RESEARCH sec 11: read-only invariant | 49-RESEARCH.md L1094-1118 | T1 self-test F10 fingerprint-asserts 30+ canonical paths unchanged | T1 |
| RESEARCH sec 12: 14-22 self-test fixtures F1-F14 | 49-RESEARCH.md L1119-1148 | T1 implements all fixtures in _runSelfTest | T1 |
| RESEARCH sec 13: lifecycle backfill (one-shot, idempotent, 44 capsules) | 49-RESEARCH.md L1150-1167 | T3 calls backfillLifecycleFields via CLI; T1 implements the function; F11 idempotency fixture | T1, T3 |
| RESEARCH sec Q14: Phase 50 forward contract getMemoryGovernanceSnapshot | 49-RESEARCH.md L1169-1194 | T1 implements helper for Phase 50 cockpit (forward shape only; no Phase 50 coupling) | T1 |
| RESEARCH sec Q15: Phase 51 BENCH forward (memory-revocations + memory-revalidations consumed) | 49-RESEARCH.md L1196-1203 | T1 emits both streams; no Phase 51 coupling beyond shape | T1 |
| RESEARCH sec Q1: SINGLE module shape lifecycle.cjs | 49-RESEARCH.md L886-899 | T1 single-module with 6 APIs + helpers + CLI | T1 |
| RESEARCH sec Q2: 10 lifecycle fields (originally 7; 10 final) | 49-RESEARCH.md L902-920 | T2 schema extension; T1 _assertLifecycleFieldSchema | T1, T2 |
| RESEARCH Pitfall 1: Phase 43 schema closed-shape -> additive properties + _assertCapsuleSchema extension | 49-RESEARCH.md L485-493 | T2 edits both PHASE-CAPSULE.schema.json AND write.cjs::_assertCapsuleSchema | T2 |
| RESEARCH Pitfall 2: idempotency on backfill | 49-RESEARCH.md L495-503 | T1 backfillLifecycleFields skips capsules with compression_level!=null; F11 fixture binds | T1, T3 |
| RESEARCH Pitfall 3: stale source-hash on capsule rebuild (expected, surfaces drift) | 49-RESEARCH.md L505-513 | T1 documents expected behavior; revalidate emits row, never auto-revokes | T1 |
| RESEARCH Pitfall 4: concurrent JSONL append < 4000 bytes | 49-RESEARCH.md L515-523 | T1 truncates details payload to keep row < 4000 bytes; mirror Phase 45 implicit rule | T1 |
| RESEARCH Pitfall 5: critical_debt blocks promotion | 49-RESEARCH.md L525-533 | T1 admitMemoryWrite rejects debt.critical_added>0 + compression_level>phase_capsule; F2e | T1 |
| RESEARCH Pitfall 6: complaint repair-loop bound | 49-RESEARCH.md L535-543 | T1 max_repairs=50 cap + monotonic since_ts cursor + memory-process-cursor.json; F9 fixture | T1 |
| RESEARCH Pitfall 7: read-only invariant during self-test | 49-RESEARCH.md L545-553 | T1 self-test runs in tmpdir with __dirname-anchored fingerprint guard; F10 fixture | T1 |
| Mirror-constraint: frozen consts Object.freeze | plan brief | T1 every const Object.freeze; COMPRESSION_LEVELS imported by reference (NEVER redefined) | T1 |
| Mirror-constraint: Phase 43-48 imports BY REFERENCE | plan brief | T1 require() phase43.{readCapsule,writeCapsule,STATUS_VOCAB,BYPASS_KIND_VOCAB,_capsuleContentHash} + phase44.{validateOne,REASONS} + phase45.{COMPRESSION_LEVELS,_assertValidatedThoughtProvenance} + phase46.{query} | T1 |
| Mirror-constraint: never-throws-upward Lock 13 | plan brief | T1 every public API + loadIndexSnippets + backfillLifecycleFields try/catch wrapped; sentinel return; F13 fixture | T1 |
| Mirror-constraint: _normalize + _assertLifecycleFieldSchema trio | plan brief | T1 implements _normalize (input coercion) + _assertLifecycleFieldSchema (output validation) per Phase 36/41-48 pattern | T1 |
| Mirror-constraint: read-only invariant on canonical streams + Phase 41-48 sources | plan brief | T1 F10 fixture captures fingerprints of 30+ paths BEFORE/AFTER and asserts no drift | T1 |
| Mirror-constraint: __dirname-anchored fingerprint guard | plan brief | T1 path.join(__dirname, '..', '..', '..') for repo root; mirror Phase 36/47/48 pattern | T1 |
| Mirror-constraint: ASCII-only on all written files | plan brief | T1-T5 all files ASCII-only; no smart quotes, no em-dashes, no Unicode arrows | T1, T2, T3, T4, T5 |
| Trap 1: do NOT replace canonical .planning + git with Redis/SQLite | plan brief | T1 never references Redis/SQLite as canonical; cache projections rebuildable from memory-promotions.jsonl | T1 |
| Trap 2: do NOT add semantic-similarity to promotion thresholds | plan brief | T1 promote() uses STRUCTURAL thresholds only (counted evidence rows, counted reuse phases); _validateInput rejects banned fields | T1 |
| Trap 3: do NOT throw upward | plan brief | T1 every API try/catch wrapped; F13 binds | T1 |
| Trap 4: do NOT couple to Phase 50/51/52 | plan brief | T1 emits canonical streams; getMemoryGovernanceSnapshot is forward-shape helper; NO require of unwritten code | T1 |
| Trap 5: do NOT redefine COMPRESSION_LEVELS / validated_thought provenance / etc. | plan brief | T1 imports BY REFERENCE from Phase 45 | T1 |
| Trap 6: do NOT mutate existing PHASE-CAPSULE.json files outside the lifecycle-field-extension edit | plan brief | T3 calls backfillLifecycleFields ONCE; per-file edits route through Phase 43 writeCapsule (atomic); idempotent re-run no-op | T3 |
| Trap 7: do NOT auto-revoke without operator escalation | plan brief | T1 revalidate() NEVER auto-revokes; only sets revalidation_due flag + emits row; revoke is explicit caller invocation (or via processComplaints repair classification, but always via repair-queue.jsonl orchestrator-pickup) | T1 |
| Trap 8: do NOT bypass admit gate | plan brief | T1 every promote/demote/revoke routes through admitMemoryWrite first; defense-in-depth re-check on artifact assembled by promote() | T1 |
| Forward contract: Phase 50 cockpit reads memory-{promotions,demotions,revocations,revalidations}.jsonl + getMemoryGovernanceSnapshot | RESEARCH sec Q14 | T1 produces both streams + helper; no Phase 50 coupling beyond shape | T1 |
| Forward contract: Phase 51 BENCH-07/08 reads memory-revocations + memory-revalidations as failure-mode signals | RESEARCH sec Q15 | T1 produces canonical streams; Phase 51 reads JSONL directly via envelope-v1 | T1 |
| Forward contract: Phase 52 Redis hot-cache reads memory-promotions canonical | RESEARCH sec 107 (deferred) | T1 produces canonical state; Phase 52 may project for live cockpit only; NOT planned in Phase 49 | -- |
| Out-of-scope: cache UI for revoke approval | 49-RESEARCH.md L110 | NOT planned (Lock 13 autonomous) | -- |
| Out-of-scope: cross-milestone promotion auditing | 49-RESEARCH.md L111 | NOT planned (separate phase if needed) | -- |
| Out-of-scope: cockpit display of memory governance state | 49-RESEARCH.md L112 | NOT planned (Phase 50 owns) | -- |
| Out-of-scope: benchmark scoring of governance utility | 49-RESEARCH.md L113 | NOT planned (Phase 51 BENCH-07/08 owns) | -- |
| Out-of-scope: Redis hot-cache of lifecycle artifacts | 49-RESEARCH.md L114 | NOT planned (Phase 52 owns) | -- |
| Out-of-scope: activating Phase 48 reserved 'research_external_validation' VTP_TOOL_MAP entry | 49-RESEARCH.md L115 | NOT planned (separate decision deferred) | -- |
| Out-of-scope: mutating Phase 41-48 source files (beyond Phase 43 schema additive + Phase 45 step-6 wire) | 49-RESEARCH.md L116 | NOT planned; only ADDITIVE edits to Phase 43 schema/validator (Task 2) and Phase 45 step-6 stub (Task 4) | -- |
| Out-of-scope: inventing new envelope version | 49-RESEARCH.md L117 | NOT planned; all 4 new streams use envelope-v1 (matches Phase 41/43/44/45/46/47/48) | -- |
| Out-of-scope: promoting capsules with bypass_refs[] non-empty | 49-RESEARCH.md L118 | NOT planned; Lock 6 carve-out enforced at admission gate; F2d fixture binds | -- |
| Open Q1: admitMemoryWrite reject when source_refs reference revoked artifacts | 49-RESEARCH.md L763-766 | T1 implements memory_admission_source_revoked check; F2c fixture binds | T1 |
| Open Q2: processComplaints encounters already-revoked artifact | 49-RESEARCH.md L768-771 | T1 logs noop_already_revoked row to memory-demotions.jsonl; F9b fixture binds | T1 |
| Open Q3: backfill skips archive/superseded | 49-RESEARCH.md L773-776 | T1 backfillLifecycleFields walker is .planning/milestones/v*/phases/ only; skips archive/ | T1 |
| Open Q4: revoke does NOT cascade | 49-RESEARCH.md L778-781 | T1 revoke() never auto-cascades; dependent thoughts enter revalidation_due on next read | T1 |
| Open Q5: reusable_rule + guardrail physical home + canonical record | 49-RESEARCH.md L783-786 | T1 promote() writes to .planning/cache/reusable-rules/ + .planning/cache/guardrails/ AND appends canonical row to memory-promotions.jsonl (cache rebuildable) | T1 |
| SKILL wire: sgsd-orchestrate Step 6.6.i.Y processComplaints at phase close | plan brief | T5 adds new step to SKILL.md after Step 6.6.i.X capsule write; Lock 13 wrapped | T5 |
| SKILL wire: sgsd-complete-milestone Step 4.7-quater revalidate batch at milestone close | plan brief | T5 adds new step to SKILL.md after Step 4.7-bis capsule backfill; Lock 13 wrapped | T5 |

**Audit verdict:** ALL in-scope items COVERED across 5 atomic commits (T1, T2, T3, T4, T5). All out-of-scope items DEFERRED to correct downstream owners per RESEARCH sec Deferred Ideas. All 5 Open Questions resolved per RESEARCH recommendations. Zero unplanned items. No phase split required (single plan; ~850-1100 LOC implementation budget within single agent context).

</source_audit>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship memory-governance/lifecycle.cjs + 6 public APIs + 14-22 assertion self-test</name>
  <files>
    super-gsd/tools/memory-governance/lifecycle.cjs
  </files>
  <behavior>
    The 14-22 in-module assertions in `_runSelfTest()` (mirror Phase 47 self-test
    pattern at route.cjs:768+ and Phase 48 at classify.cjs `_runSelfTest`).
    Every assertion uses Node `assert` and a fixture-scoped tmpdir for any
    canonical-stream writes. Fixture order MUST be:

    F1   admitMemoryWrite happy path: artifact with all 6 mandatory fields populated
         (source_refs+root_source_hashes non-empty same length; confidence='high';
         allowed_consumers=['*']; revocation_path='super-gsd/.../#revoke';
         compression_level='validated_thought') -> {ok:true} [GOV-02, A4]

    F2   admitMemoryWrite reject: missing source_refs (empty array) ->
         {ok:false, reason:'memory_admission_provenance_missing'} [A4]

    F2b  admitMemoryWrite reject: missing root_source_hashes ->
         {ok:false, reason:'memory_admission_provenance_missing'} [A4]

    F2c  admitMemoryWrite reject: confidence='maybe' (not in CONFIDENCE_VOCAB) ->
         {ok:false, reason:'memory_admission_confidence_invalid'} [A4]

    F2d  admitMemoryWrite reject: bypass_refs=[{stream:'crit-backlog',id:'x',kind:'CRIT',
         summary_passthrough:'...',evidence_path:null}] AND compression_level='validated_thought'
         -> {ok:false, reason:'memory_admission_bypass_refs_block_promotion'} [LOCK-6]

    F2e  admitMemoryWrite reject: debt.critical_added=2 AND compression_level='validated_thought'
         -> {ok:false, reason:'memory_admission_debt_blocks_promotion'} [Pitfall 5]

    F2f  admitMemoryWrite reject: missing allowed_consumers ->
         {ok:false, reason:'memory_admission_consumers_missing'} [GOV-08]

    F2g  admitMemoryWrite reject: missing revocation_path ->
         {ok:false, reason:'memory_admission_revocation_path_missing'} [GOV-08]

    F2h  admitMemoryWrite reject: compression_level='trusted' (not in COMPRESSION_LEVELS)
         -> {ok:false, reason:'memory_admission_compression_level_invalid'} [LOCK-11]

    F3   promote raw_evidence -> phase_capsule (delegated to Phase 43; Phase 49
         admits the resulting capsule fields and emits a memory-promotions.jsonl
         row with reason_codes:['evidence_threshold_met']) [A1, GOV-04]

    F4   promote phase_capsule -> validated_thought:
           input artifact has admit PASS + non-empty thought + non-empty used_for
           + bypass_refs[].length===0 + debt.critical_added===0;
           expected: writes .planning/cache/validated-thoughts/<id>.json
           AND appends row to memory-promotions.jsonl envelope-v1
           AND mutated cap.compression_level set to 'validated_thought' on the
           in-memory thought artifact [A1, GOV-04]

    F5   promote validated_thought -> reusable_rule:
           input artifact has admit PASS + cited_phases=['v1.6/26','v1.6/27','v1.7/31']
           (>=3 distinct phases) + confidence='high'; expected: writes
           .planning/cache/reusable-rules/<id>.json AND appends row [A1, GOV-04]

    F5b  promote validated_thought -> reusable_rule REJECT: cited_phases has
           only 2 entries -> {ok:false, reason:'reuse_threshold_not_met'} [A1]

    F5c  promote validated_thought -> reusable_rule REJECT: confidence='low'
           -> {ok:false, reason:'low_confidence_blocks_rule_promotion'} [A1]

    F6   demote validated_thought -> phase_capsule:
           input artifact_id refers to existing in-memory capsule;
           expected: cap.demoted_at set to ISO timestamp; cap.compression_level
           shifted DOWN one level; row appended to memory-demotions.jsonl
           with reason_codes:['abstraction_failed'] [A2, GOV-07]

    F7   revoke validated_thought:
           input (artifact_id, reason='stale', replaced_by_id='vt-replacement-...');
           expected: cap.revoked_at set; cap.revoked_reason='stale';
           cap.superseded_by_id set; row appended to memory-revocations.jsonl;
           replaced_by chain depth assertion via _resolveSupersededChain returns 1 [A2, GOV-05]

    F7b  revoke chain depth-too-deep: artifact A->B->C->D->E->F (depth 6) ->
           {ok:false, reason:'revoked_chain_too_deep'} [Security threat #6]

    F8   revalidate -- source-hash drift detected:
           write a tmpdir source file at hash H1; build artifact with
           source_refs=[srcRel] and root_source_hashes=[H1]; modify the source
           file (now hash H2); call revalidate(artifact_id);
           expected: drift_detected:true; cap.revalidation_due set true;
           row appended to memory-revalidations.jsonl with
           reason_codes:['source_hash_drift']; NEVER auto-revokes (cap.revoked_at
           remains null) [A6, LOCK-13]

    F8b  revalidate -- source file deleted:
           build artifact referencing a tmpdir source file; delete the file;
           call revalidate(artifact_id);
           expected: drift_detected:true; row reason_codes:['source_file_missing'] [Threat #7]

    F9   processComplaints -- broad_raw_fallback dispatched:
           write a synthetic context-complaints.jsonl envelope-v1 row with
           reason_codes=['broad_raw_fallback'] and details.intent_id='X' at
           ts=T0; cursor file absent (since_ts=epoch);
           call processComplaints({since_ts:0, max_repairs:50});
           expected: row appended to repair-queue.jsonl with details.repair_kind
           === 'packet_rebuild'; cursor file written with since_ts=T0;
           returned {repairs_attempted:1, repairs_succeeded:1} [A3, A7, GOV-01]

    F9b  processComplaints -- already-revoked artifact race:
           complaint references artifact_id 'X' which is already revoked
           (revoked_at!=null); expected: row appended to memory-demotions.jsonl
           with reason_codes:['noop_already_revoked'], status:'ok'; cursor advances [Open Q2]

    F9c  processComplaints -- max_repairs cap respected:
           seed 100 complaint rows in tmpdir context-complaints.jsonl; call
           processComplaints({since_ts:0, max_repairs:50}); expected:
           repairs_attempted <= 50; cursor advances to ts of 50th processed
           row (NOT to ts of 100th row) [Pitfall 6]

    F10  read-only invariant fingerprint diff:
           BEFORE running F1-F9: capture {mtime, size} of 30+ canonical paths
           (9 v1.9 metric streams + Phase 41-48 .cjs sources + canonical
           phase-folder content sample); AFTER F1-F9: re-capture; assert
           every captured path's fingerprint UNCHANGED. Excluded paths
           (Phase 49 owns/edits in-tree): the 4 NEW canonical streams,
           Phase 49 module file, Phase 43 schema, Phase 43 write.cjs,
           Phase 45 build.cjs (Tasks 2 + 4 edit these). [LOCK-2]

    F11  lifecycle backfill idempotency:
           seed tmpdir with 3 mock PHASE-CAPSULE.json files (compression_level=null);
           call backfillLifecycleFields(planningDir);
           expected: returned {updated:3, skipped:0, errors:[]};
           re-call backfillLifecycleFields(planningDir);
           expected: returned {updated:0, skipped:3, errors:[]};
           assert promoted_at on each capsule UNCHANGED between runs [Pitfall 2]

    F12  envelope-v1 row coverage:
           after F1-F9: read each of memory-{promotions,demotions,revocations,
           revalidations}.jsonl AND repair-queue.jsonl; assert each file
           contains >=1 well-formed envelope-v1 row (envelope_version===1,
           ts ISO-pattern, command in COMMAND_NAMES, status string,
           reason_codes Array of strings) [GOV-08]

    F13  Lock 13 -- every public API survives null/undefined/garbage:
           for each of admitMemoryWrite, promote, demote, revoke, revalidate,
           processComplaints, loadIndexSnippets, backfillLifecycleFields:
             call with null -> assert no throw escapes; assert returned
               sentinel has ok:false AND reason ends in '_internal_error'
               OR reason in known reject vocab;
             call with undefined -> assert no throw;
             call with {} -> assert no throw;
             call with {garbage:1} -> assert no throw;
           Pitfall 4 sub-assertion: every emitted ledger row JSON.stringify
           length < 4000 bytes [LOCK-13]

    F14  Phase 45 wire -- loadIndexSnippets called by Phase 45 build:
           seed tmpdir with phase 46 query() shim returning a single row
           {kind:'capsule', milestone:'v1.6', phase:'26', snippet:'...'} via
           phase49._injectPhase46QueryShim(fakeQuery); seed a real capsule
           file at .planning/milestones/v1.6/phases/26/PHASE-CAPSULE.json
           (revoked_at:null); call phase49.loadIndexSnippets('test query',
           {planningDir:tmpdir, milestone:'v1.6', phase:'26', limit:5,
           strict_revalidation:false});
           expected: array length 1; row.revalidation_due in {true,false,undefined};
           when strict_revalidation:true AND revalidation_due===true -> elided.
           Sub-assertion: when capsule has revoked_at!=null -> always elided. [Q8 wire]

    Total: 14 logical assertions across 22 fixtures (F1-F14 plus 8 sub-fixtures).

    All fixtures: read-only against 9 v1.9 canonical metric streams
    (token-attribution, codex-log, agent-token-spend, activity-log, token-log,
    token-waste-status, crit-backlog, route-decisions, vtp-bridge-failures);
    read-only against Phase 41-48 source .cjs files; read-only against
    canonical phase-folder content (CONTEXT/RESEARCH/PLAN/VERIFICATION/
    ATC-REVIEW/reviews). All test-mutated paths are tmpdir-scoped via
    `os.tmpdir()`. __dirname-anchored fingerprint guard: paths resolved
    via path.join(__dirname, '..', '..', '..') for repo root (mirror
    Phase 47 route.cjs:130 pattern).

    ASCII-only enforced via _assertAsciiOnly(buffer) helper called at module
    load time on the file's own bytes (mirror Phase 48 self-bytes assertion
    at classify.cjs).
  </behavior>
  <action>
Implement `super-gsd/tools/memory-governance/lifecycle.cjs` (~850-1100 LOC)
mirroring the Phase 41-48 single-module precedent (`phase-capsule/write.cjs`,
`context-registry/check.cjs`, `dispatch-router/route.cjs`,
`vtp-bridge/classify.cjs`).

MODULE STRUCTURE (top-to-bottom):

1. Banner comment: ASCII-only; Phase 49 GOV-01..08 + LOCK-2/6/11/13 binding;
   Lock 13 try/catch wrap noted.

2. Requires (built-ins ONLY):
     fs, path, os, crypto, child_process

3. Phase imports BY REFERENCE (lazy require inside functions where needed
   to avoid circular-dep risk; mirror Phase 48 lazy require pattern):
     phase43 = require('../phase-capsule/write.cjs')
     phase44 = require('../context-registry/check.cjs')
     phase45 = require('../context-packet/build.cjs')
     phase46 = require('../context-cache/query.cjs')
   For COMPRESSION_LEVELS specifically: re-export phase45.COMPRESSION_LEVELS;
   NEVER redefine.

4. Frozen Object.freeze closed enums (per <interfaces> CLOSED ENUMS section):
     COMPRESSION_LEVELS = phase45.COMPRESSION_LEVELS  (5 entries; by-reference)
     PROMOTION_REASONS  (3 entries: evidence_threshold_met, reuse_threshold_met,
                         manual_promote_with_provenance)
     DEMOTION_REASONS   (4 entries: abstraction_failed, source_drifted,
                         complaint_threshold_exceeded, superseded_by_new_evidence)
     REVOKE_REASONS     (5 entries: stale, poisoned, contradicted, source_lost,
                         superseded_by_revoked_chain)
     CONFIDENCE_VOCAB   (3 entries: low, medium, high)
     ADMISSION_REJECT_CODES (9 entries -- see <interfaces>)
     REVALIDATION_KINDS (2 entries: source_hash_drift, source_file_missing)
     COMMAND_NAMES      (Object.freeze map: admit/promote/demote/revoke/
                         revalidate/process/backfill -> camelCase command strings)
     ENVELOPE_VERSION = 1
     MAX_REPAIRS_PER_INVOCATION = 50
     REPLACED_BY_CHAIN_DEPTH_CAP = 5

5. Path constants (lazy resolved via _planningDir helper that mirrors
   Phase 45 _planningDir at build.cjs):
     MEMORY_PROMOTIONS_PATH      = '.planning/metrics/memory-promotions.jsonl'
     MEMORY_DEMOTIONS_PATH       = '.planning/metrics/memory-demotions.jsonl'
     MEMORY_REVOCATIONS_PATH     = '.planning/metrics/memory-revocations.jsonl'
     MEMORY_REVALIDATIONS_PATH   = '.planning/metrics/memory-revalidations.jsonl'
     MEMORY_PROCESS_CURSOR_PATH  = '.planning/metrics/memory-process-cursor.json'
     REPAIR_QUEUE_PATH           = '.planning/metrics/repair-queue.jsonl'
     CONTEXT_COMPLAINTS_PATH     = '.planning/metrics/context-complaints.jsonl'
     CACHE_VALIDATED_THOUGHTS_DIR= '.planning/cache/validated-thoughts'
     CACHE_REUSABLE_RULES_DIR    = '.planning/cache/reusable-rules'
     CACHE_GUARDRAILS_DIR        = '.planning/cache/guardrails'

6. Helpers (private):

   _planningDir(opts)
     Mirror Phase 45 _planningDir; opts.planningDir overrides; default
     resolves via path.resolve(process.cwd(), '.planning').

   _normalize(input)
     Phase 36/41-48 pattern. Coerce input.confidence to lowercase; trim
     strings; default arrays to []; default booleans to null when undefined.

   _assertLifecycleFieldSchema(artifact)
     Mirror Phase 43 _assertCapsuleSchema for the Phase 49 in-memory
     artifact shape. Throws Error on violation. Does NOT validate
     PHASE-CAPSULE.json (Phase 43 owns that). Validates the runtime
     artifact passed to admitMemoryWrite.

   _assertAsciiOnly(buf)
     Reject any byte > 0x7E or < 0x20 (excluding 0x09 tab, 0x0A LF, 0x0D CR).
     Called at module load on __filename bytes (mirror Phase 48 self-bytes guard).

   _appendLedgerRow(filePath, row)
     POSIX append with envelope-v1 shape assertion. Truncate row.details
     to keep JSON.stringify(row).length < 4000 bytes (Pitfall 4).
     fs.appendFileSync(filePath, JSON.stringify(row)+'\n', 'utf8').

   _writeAtomicJSON(filePath, obj)
     tmp+rename atomic write (mirror phase43 _writeCapsuleInternal).

   _readJsonlSince(filePath, sinceTs, maxRows)
     Stream-read JSONL filtered by row.ts > sinceTs; cap at maxRows;
     return [{...row}, ...] in chronological order.

   _resolveCapsule(artifact_id, planningDir)
     Parse artifact_id 'milestone/phase#hash[0:8]' -> read PHASE-CAPSULE.json
     via phase43.readCapsule(planningDir, milestone, phase). Returns
     capsule object | null.

   _capsuleArtifactId(capsule)
     Build 'milestone/phase#contentHash[0:8]' from capsule fields. Mirror
     phase43._capsuleContentHash usage.

   _checkSourceHashDrift(artifact, planningDir)
     For each artifact.source_refs[i]: resolve to full path under repo root;
     fs.existsSync false -> drift; else read file, sha256, compare to
     artifact.root_source_hashes[i]. On drift: append row to
     memory-revalidations.jsonl AND set artifact.revalidation_due=true.
     Returns boolean drift.

   _editCapsuleLifecycleFields(milestone, phase, edits, planningDir)
     Read capsule via phase43.readCapsule; apply edits to in-memory copy;
     re-write via phase43.writeCapsule. Lock 13 wrapped (returns
     {ok:false, reason} sentinel on internal error).

   _readProcessCursor(planningDir)
     Read MEMORY_PROCESS_CURSOR_PATH; on missing file return
     {since_ts: '1970-01-01T00:00:00.000Z', last_invocation_ts: null,
     last_repairs_attempted: 0, last_repairs_succeeded: 0}.

   _writeProcessCursor(planningDir, cursor)
     _writeAtomicJSON.

   _resolveSupersededChain(artifact_id, planningDir, depth=0)
     Walk superseded_by_id chain. If depth > REPLACED_BY_CHAIN_DEPTH_CAP
     return {ok:false, reason:'revoked_chain_too_deep'}. Else recurse.

   _emitInternalErrorComplaint(api_name, error, planningDir)
     Append a row to context-complaints.jsonl envelope-v1 with
     reason_codes:[<api_name>+'_internal_error']. Lock 13 sentinel emission.

7. Public APIs (each Lock 13 try/catch wrapped; each calls inner _<api>Internal
   that may throw; outer wrapper returns sentinel on catch):

   admitMemoryWrite(artifact)
     Mirror RESEARCH sec 3 Pattern 1 verbatim with these checks in order:
       1. artifact != null && typeof === 'object'
       2. source_refs Array && length > 0
       3. root_source_hashes Array && length === source_refs.length
       4. confidence in CONFIDENCE_VOCAB
       5. allowed_consumers Array && length > 0
       6. revocation_path string && length > 0
       7. compression_level in COMPRESSION_LEVELS
       8. bypass_refs[].length > 0 + compression_level > 'phase_capsule' -> reject (LOCK 6)
       9. debt.critical_added > 0 + compression_level > 'phase_capsule' -> reject (Pitfall 5)
      10. Optional Open Q1: each source_refs[i] -- if it can be resolved
          to a capsule whose revoked_at != null -> reject with
          memory_admission_source_revoked. (NOTE: add memory_admission_source_revoked
          to ADMISSION_REJECT_CODES as 10th entry per Open Q1 recommendation.)
      11. If compression_level === 'validated_thought': call
          phase45._assertValidatedThoughtProvenance({source_refs, root_source_hashes})
          in try/catch; on throw -> reject memory_admission_provenance_missing.
     Returns {ok:true} or {ok:false, reason:<code>}. Emits NOTHING to ledger
     (admission decisions are not ledger events; they're pre-flight gates).

   promote({artifact_id, from_level, to_level, evidence})
     1. _normalize input.
     2. Validate from_level + to_level adjacent in COMPRESSION_LEVELS (no skips).
     3. Threshold check per pair:
        - phase_capsule -> validated_thought: admit PASS + non-empty thought
          + non-empty used_for + bypass_refs[].length===0 + debt.critical_added===0
        - validated_thought -> reusable_rule: admit PASS + cited_phases.length>=3
          (counted distinct phase strings) + confidence in {medium, high}
        - reusable_rule -> guardrail: admit PASS + manual_promote_with_provenance
          reason_code in evidence.reason_codes (caller-supplied) +
          rule.effect.startsWith('never ') OR effect.startsWith('MUST not ')
     4. On PASS: write artifact to cache/<level>s/<id>.json
        (.planning/cache/validated-thoughts/, reusable-rules/, guardrails/);
        ensure dir exists via fs.mkdirSync recursive.
     5. Append envelope-v1 row to MEMORY_PROMOTIONS_PATH:
        {envelope_version:1, ts:isoNow, command:'memoryPromote', status:'ok',
         reason_codes:['evidence_threshold_met'|'reuse_threshold_met'|
                       'manual_promote_with_provenance'],
         artifact_id, details:{from_level, to_level, new_id,
                               evidence_count:evidence.length}}
     6. Returns {ok, new_id, ledger_row}. Lock 13 wrapped.

   demote(artifact_id, reason)
     1. reason in DEMOTION_REASONS.
     2. _resolveCapsule(artifact_id, planningDir).
     3. Compute new compression_level = previous - 1 in COMPRESSION_LEVELS.
        If new < 'raw_evidence' -> reject (cannot demote below raw).
     4. _editCapsuleLifecycleFields with {demoted_at: isoNow,
        compression_level: new_level}.
     5. Append envelope-v1 row to MEMORY_DEMOTIONS_PATH.
     6. Returns {ok, ledger_row}. Lock 13 wrapped.

   revoke(artifact_id, reason, replaced_by_id)
     1. reason in REVOKE_REASONS.
     2. _resolveSupersededChain(replaced_by_id, planningDir) check depth-cap.
        If chain too deep -> {ok:false, reason:'revoked_chain_too_deep'}.
     3. _resolveCapsule.
     4. _editCapsuleLifecycleFields with {revoked_at:isoNow,
        revoked_reason:reason, superseded_by_id:replaced_by_id||null}.
     5. Append envelope-v1 row to MEMORY_REVOCATIONS_PATH.
     6. Returns {ok, ledger_row}. Lock 13 wrapped.

   revalidate(artifact_id)
     1. _resolveCapsule.
     2. _checkSourceHashDrift(capsule, planningDir).
     3. If drift: row already appended by helper; also _editCapsuleLifecycleFields
        with {revalidation_due:true} (Lock 13 wrapped -- failure logs but
        doesn't throw).
     4. NEVER auto-revokes (Lock 13).
     5. Returns {ok, drift_detected:bool, ledger_row?}. Lock 13 wrapped.

   processComplaints({since_ts, max_repairs})
     1. cursor = _readProcessCursor(planningDir).
     2. effective_since_ts = since_ts || cursor.since_ts.
     3. effective_max = Math.min(max_repairs || MAX_REPAIRS_PER_INVOCATION,
                                  MAX_REPAIRS_PER_INVOCATION).
     4. rows = _readJsonlSince(CONTEXT_COMPLAINTS_PATH, effective_since_ts,
                                effective_max).
     5. For each row, classify via reason_codes[0]:
          'broad_raw_fallback' -> repair_kind:'packet_rebuild' ->
            append to REPAIR_QUEUE_PATH (orchestrator picks up).
          'validated_thought_missing_provenance' -> repair_kind:'thought_demote' ->
            call demote(row.details.artifact_id, 'abstraction_failed');
            if demote fails (artifact already revoked) -> log noop_already_revoked
            row to MEMORY_DEMOTIONS_PATH (Open Q2).
          'packet_capsule_unavailable_raw_fallback' -> repair_kind:'capsule_rebuild' ->
            append to REPAIR_QUEUE_PATH.
          'packet_invalid_references_filtered' -> repair_kind:'note' ->
            append note row.
          'phase_capsule_backfill_milestone_missing' OR
          'phase_capsule_backfill_index_unreadable' -> skip (informational).
          'packet_built_with_omitted_material' -> repair_kind:'note'.
          (default) -> append row to MEMORY_DEMOTIONS_PATH with
            reason_codes:['unknown_complaint_reason_code'], status:'warn'.
     6. Track repairs_attempted + repairs_succeeded + max_ts_processed.
     7. _writeProcessCursor(planningDir, {since_ts: max_ts_processed,
        last_invocation_ts: isoNow, last_repairs_attempted, last_repairs_succeeded}).
     8. Returns {repairs_attempted, repairs_succeeded, ledger_rows}.
        Lock 13 wrapped.

   loadIndexSnippets(query, opts)
     Phase 45 step-6 wire.
     1. If !phase46 || typeof phase46.query !== 'function' return [].
     2. rows = phase46.query(query, {milestone, phase, limit, kinds:
        ['capsule','decision','gate_definition','file_summary'],
        filter_invalid:true}).
     3. For each row: if row.kind==='capsule', read underlying capsule;
        if cap.revoked_at != null -> elide.
     4. Annotate with revalidation_due via _checkSourceHashDrift.
     5. If opts.strict_revalidation && row.revalidation_due -> elide.
     6. Returns array. Lock 13 wrapped (returns [] on internal error).

   backfillLifecycleFields(planningDir, opts)
     1. Walk .planning/milestones/v*/phases/*/PHASE-CAPSULE.json
        (skip archive/) via fs.readdirSync recursion.
     2. For each capsule JSON:
        - Read via phase43.readCapsule.
        - If cap.compression_level != null -> skip (idempotency; Pitfall 2).
        - Else apply defaults: compression_level='phase_capsule',
          promoted_at=cap.created_at, allowed_consumers=['*'],
          revocation_path='super-gsd/tools/memory-governance/lifecycle.cjs#revoke',
          all other lifecycle fields stay null.
        - _editCapsuleLifecycleFields atomic write.
     3. Returns {updated:N, skipped:M, errors:[]}.
     4. Lock 13 wrapped per-file (one bad capsule does NOT halt walk).

   getMemoryGovernanceSnapshot(planningDir)
     Phase 50 forward contract helper. Aggregates:
       total_artifacts (count of capsules with compression_level set),
       by_compression_level (counts per level),
       recently_revoked (last 10 from memory-revocations.jsonl),
       recently_revalidated (last 10 from memory-revalidations.jsonl),
       complaints_pending (count from context-complaints.jsonl since cursor),
       last_process_complaints_ts (from cursor file).
     Returns object. Lock 13 wrapped (returns {...empty...} sentinel on error).

8. CLI entry point (mirror Phase 47 route.cjs CLI dispatch + Phase 48
   classify.cjs CLI):
     if (require.main === module) {
       const args = process.argv.slice(2);
       const verb = args[0];
       switch (verb) {
         case '--admit':              ... read artifact JSON from stdin or --artifact-file
         case '--promote':            ... --from --to --artifact-id --evidence-file
         case '--demote':             ... --artifact-id --reason
         case '--revoke':             ... --artifact-id --reason --replaced-by-id
         case '--revalidate':         ... --artifact-id
         case '--process-complaints': ... --since --max-repairs
         case '--backfill':           ... no args (uses cwd .planning)
         case '--snapshot':           ... print getMemoryGovernanceSnapshot JSON
         case '--self-test':          ... run _runSelfTest; exit 0 on PASS
         default:                     ... print usage; exit 2
       }
     }

9. _runSelfTest():
   Runs F1-F14 + sub-fixtures (22 total fixtures, 14 logical assertions)
   per <behavior>. Captures fingerprints BEFORE F1 + AFTER F14; asserts
   no drift on 30+ canonical paths. Uses os.tmpdir() for all
   test-mutated state. Prints "PASS N/N" on success; "FAIL M/N: <reason>"
   on first failure. process.exit(0) on PASS, exit(1) on FAIL.

10. module.exports (per artifacts.exports list in frontmatter):
      admitMemoryWrite, promote, demote, revoke, revalidate, processComplaints,
      loadIndexSnippets, backfillLifecycleFields, getMemoryGovernanceSnapshot,
      COMPRESSION_LEVELS, PROMOTION_REASONS, DEMOTION_REASONS, REVOKE_REASONS,
      CONFIDENCE_VOCAB, ADMISSION_REJECT_CODES, REVALIDATION_KINDS,
      ENVELOPE_VERSION, MAX_REPAIRS_PER_INVOCATION,
      REPLACED_BY_CHAIN_DEPTH_CAP, COMMAND_NAMES.

CRITICAL TRAPS (re-read before commit):
  1. NEVER redefine COMPRESSION_LEVELS -- import phase45.COMPRESSION_LEVELS by reference.
  2. NEVER call phase45.buildPacket from processComplaints -- only schedule
     via repair-queue.jsonl. Orchestrator is the dispatcher.
  3. NEVER auto-revoke from revalidate() -- only flag revalidation_due.
  4. NEVER hard-delete on revoke() -- always tombstone with revoked_at.
  5. NEVER bypass admit gate -- every promote/demote/revoke calls
     admitMemoryWrite first as defense-in-depth.
  6. NEVER write to the 9 read-only canonical streams (token-attribution.jsonl,
     codex-log.jsonl, agent-token-spend.jsonl, activity-log.jsonl, token-log.jsonl,
     token-waste-status.jsonl, crit-backlog.jsonl, route-decisions.jsonl,
     vtp-bridge-failures.jsonl).
  7. NEVER mutate Phase 41-48 source .cjs files except the additive Phase 43
     schema/validator edits in Task 2 and Phase 45 step-6 stub in Task 4.
  8. NEVER throw upward from any public API (Lock 13).
  9. ASCII-only on this file (no smart quotes, em-dashes, Unicode arrows).
 10. Truncate ledger row JSON.stringify length < 4000 bytes (Pitfall 4).
 11. backfillLifecycleFields MUST be idempotent (skip non-null compression_level).
 12. _resolveSupersededChain MUST cap depth at REPLACED_BY_CHAIN_DEPTH_CAP=5.
 13. processComplaints MUST cap repairs at MAX_REPAIRS_PER_INVOCATION=50 AND
     advance since_ts cursor monotonically.

VERIFICATION (commit gate):
  node super-gsd/tools/memory-governance/lifecycle.cjs --self-test
  Exit code 0 + "PASS 22/22" stdout + git diff --quiet on the 9 read-only
  canonical streams.

Stage and commit:
  git add super-gsd/tools/memory-governance/lifecycle.cjs
  git commit -m "feat(49-01): memory-governance/lifecycle.cjs + 6 public APIs + 14-22 assertion self-test"
  </action>
  <verify>
    <automated>node super-gsd/tools/memory-governance/lifecycle.cjs --self-test</automated>
  </verify>
  <done>
    lifecycle.cjs exists with all 6 public APIs exported + frozen Object.freeze enums
    + 14-22 in-module self-test fixtures + CLI verb parity with Phase 47/48.
    `--self-test` exits 0 with PASS 22/22 (or whatever final count fixtures resolve to,
    minimum 14). All 4 NEW canonical streams created on first emit. F10 fingerprint
    diff empty against 30+ read-only paths. ASCII-only enforced on self-bytes.
    Lock 13: every public API survives null/undefined/garbage without throw.
    Single atomic commit per RESEARCH contract: feat(49-01).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend PHASE-CAPSULE.schema.json + write.cjs::_assertCapsuleSchema with 10 additive lifecycle fields</name>
  <files>
    super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json,
    super-gsd/tools/phase-capsule/write.cjs
  </files>
  <behavior>
    After this task:
    - PHASE-CAPSULE.schema.json contains 10 NEW OPTIONAL properties under top-level
      `properties`: compression_level, promoted_at, demoted_at, revoked_at,
      revoked_reason, allowed_consumers, revalidation_due, supersedes_id,
      superseded_by_id, revocation_path. Each is `oneOf` of its type plus null.
      The `required` array is UNCHANGED (16 fields). `additionalProperties:false`
      remains TRUE (closed-shape preserved via explicit enumeration).
    - write.cjs::_assertCapsuleSchema validates the 10 new fields per schema oneOf:
        compression_level: if not null, must be in COMPRESSION_LEVELS_VOCAB
          (5-vocab const declared in write.cjs by reference -- Phase 49 imports
           by reference; write.cjs declares locally to avoid circular dep).
        *_at fields: if not null, string matching ^[0-9]{4}-[0-9]{2}-[0-9]{2}T pattern.
        revoked_reason: if not null, string (no closed-enum here at schema layer;
          Phase 49's REVOKE_REASONS gates at write time).
        allowed_consumers: if not null, array of strings.
        revalidation_due: if not null, boolean.
        supersedes_id, superseded_by_id, revocation_path: if not null, string.
    - LIFECYCLE_FIELDS frozen const exported from write.cjs (used by Phase 49
      backfill walker to know the 10 field names without re-deriving from schema).
    - Phase 43 self-test (`node super-gsd/tools/phase-capsule/write.cjs --self-test`)
      grows to cover:
        Assertion N+1: schema-load with all 10 lifecycle fields populated -> PASS.
        Assertion N+2: schema-load with compression_level='trusted' (invalid)
                       -> throws with message matching /compression_level.*invalid/.
        Assertion N+3: schema-load with promoted_at='2026-04-27' (missing 'T')
                       -> throws with message matching /promoted_at.*pattern/.
    - Existing F1-F4 Phase 43 self-test fixtures pass UNCHANGED (no lifecycle
      fields populated -> still valid because all 10 are OPTIONAL).
    - The schema's `additionalProperties:false` still rejects unknown keys
      (e.g. capsule with `frobnicate:true` -> throws unknown_top_level_field).
  </behavior>
  <action>
EDIT 1: super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json

Read the file. After the `created_by` property entry (currently last in
properties; line 72) and BEFORE the closing `}` of properties (line 73),
INSERT the 10 new lifecycle properties verbatim from <interfaces> Lifecycle
Field Schema Extension block:

```json
    "compression_level": {
      "oneOf": [
        { "type": "string", "enum": ["raw_evidence","phase_capsule","validated_thought","reusable_rule","guardrail"] },
        { "type": "null" }
      ]
    },
    "promoted_at": {
      "oneOf": [
        { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" },
        { "type": "null" }
      ]
    },
    "demoted_at": {
      "oneOf": [
        { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" },
        { "type": "null" }
      ]
    },
    "revoked_at": {
      "oneOf": [
        { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" },
        { "type": "null" }
      ]
    },
    "revoked_reason": {
      "oneOf": [
        { "type": "string" },
        { "type": "null" }
      ]
    },
    "allowed_consumers": {
      "oneOf": [
        { "type": "array", "items": { "type": "string" } },
        { "type": "null" }
      ]
    },
    "revalidation_due": {
      "oneOf": [
        { "type": "boolean" },
        { "type": "null" }
      ]
    },
    "supersedes_id": {
      "oneOf": [
        { "type": "string" },
        { "type": "null" }
      ]
    },
    "superseded_by_id": {
      "oneOf": [
        { "type": "string" },
        { "type": "null" }
      ]
    },
    "revocation_path": {
      "oneOf": [
        { "type": "string" },
        { "type": "null" }
      ]
    }
```

Add a leading comma after the existing `created_by` entry. The `required` array
(lines 8-26) is UNCHANGED. The `additionalProperties:false` at line 7 is
UNCHANGED. The `definitions` block (lines 74+) is UNCHANGED.

EDIT 2: super-gsd/tools/phase-capsule/write.cjs

(a) Near the top of the file (after STATUS_VOCAB at line 76 and BYPASS_KIND_VOCAB
    at line 89), ADD a new frozen const:

```javascript
// Phase 49 GOV-03: lifecycle fields (additive; optional). Phase 49 backfill
// walker reads this list to know which keys to populate without re-deriving
// from the schema file.
const LIFECYCLE_FIELDS = Object.freeze([
  'compression_level',
  'promoted_at',
  'demoted_at',
  'revoked_at',
  'revoked_reason',
  'allowed_consumers',
  'revalidation_due',
  'supersedes_id',
  'superseded_by_id',
  'revocation_path',
]);

// Phase 49 GOV-03: closed-vocab for compression_level. Mirrors Phase 45
// build.cjs:104 COMPRESSION_LEVELS. Re-declared here (NOT imported) to avoid
// circular-dep: phase-capsule -> phase49 -> phase45 -> phase-capsule.
// MUST stay in sync with build.cjs:104 -- if Phase 45 ever adds a level,
// this list MUST be updated. Phase 49 self-test F1 verifies parity by
// importing both consts and asserting array equality.
const COMPRESSION_LEVELS_VOCAB = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
]);
```

(b) In `_assertCapsuleSchema` (write.cjs:851+), AFTER the existing per-field
    assertions complete and BEFORE the function returns, INSERT a new block
    that validates the 10 lifecycle fields:

```javascript
// Phase 49 GOV-03: lifecycle field validation (additive, optional).
// Each field, if present and non-null, must satisfy schema oneOf.
const ISO_TS_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/;

if (obj.compression_level !== undefined && obj.compression_level !== null) {
  if (typeof obj.compression_level !== 'string' ||
      COMPRESSION_LEVELS_VOCAB.indexOf(obj.compression_level) < 0) {
    throw new Error('phase-capsule schema invalid: compression_level must be in '
      + JSON.stringify(COMPRESSION_LEVELS_VOCAB) + ' (got "' + obj.compression_level + '")');
  }
}

const tsFields = ['promoted_at', 'demoted_at', 'revoked_at'];
for (const f of tsFields) {
  if (obj[f] !== undefined && obj[f] !== null) {
    if (typeof obj[f] !== 'string' || !ISO_TS_PATTERN.test(obj[f])) {
      throw new Error('phase-capsule schema invalid: ' + f
        + ' must match ISO timestamp pattern (got "' + obj[f] + '")');
    }
  }
}

if (obj.revoked_reason !== undefined && obj.revoked_reason !== null) {
  if (typeof obj.revoked_reason !== 'string') {
    throw new Error('phase-capsule schema invalid: revoked_reason must be string or null');
  }
}

if (obj.allowed_consumers !== undefined && obj.allowed_consumers !== null) {
  if (!Array.isArray(obj.allowed_consumers)) {
    throw new Error('phase-capsule schema invalid: allowed_consumers must be array or null');
  }
  for (const c of obj.allowed_consumers) {
    if (typeof c !== 'string') {
      throw new Error('phase-capsule schema invalid: allowed_consumers[] entries must be strings');
    }
  }
}

if (obj.revalidation_due !== undefined && obj.revalidation_due !== null) {
  if (typeof obj.revalidation_due !== 'boolean') {
    throw new Error('phase-capsule schema invalid: revalidation_due must be boolean or null');
  }
}

const stringFields = ['supersedes_id', 'superseded_by_id', 'revocation_path'];
for (const f of stringFields) {
  if (obj[f] !== undefined && obj[f] !== null) {
    if (typeof obj[f] !== 'string') {
      throw new Error('phase-capsule schema invalid: ' + f + ' must be string or null');
    }
  }
}
```

The `additionalProperties:false` enforcement at the top of `_assertCapsuleSchema`
(`allowed = new Set(Object.keys(schema.properties))`) automatically expands
to include the 10 new fields once the schema file is updated -- no code change
needed for the allowed-Set.

(c) Add to `module.exports` at the bottom of write.cjs:
    `LIFECYCLE_FIELDS, COMPRESSION_LEVELS_VOCAB,`
    (alphabetical order in the existing exports list).

(d) GROW Phase 43 self-test (in write.cjs `_runSelfTest` or equivalent):
    Add 3 new assertions per <behavior>. Mirror existing assertion shape.

VERIFICATION:
  node super-gsd/tools/phase-capsule/write.cjs --self-test
  Exit 0 + asserts grow by 3.

Stage and commit:
  git add super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
  git add super-gsd/tools/phase-capsule/write.cjs
  git commit -m "feat(49-01): extend PHASE-CAPSULE.schema.json + write.cjs with 10 additive lifecycle fields"

CRITICAL TRAPS:
  1. The `required` array MUST be unchanged (lifecycle fields are optional).
  2. `additionalProperties:false` MUST stay TRUE (closed-shape preserved
     via explicit enumeration of the 10 new fields).
  3. The 10 fields MUST be in `properties` (not `definitions`); putting
     them in definitions would not unlock them at top level.
  4. Existing F1-F4 Phase 43 fixtures MUST pass UNCHANGED (verify by
     running `--self-test` BEFORE and AFTER the edits and diffing pass count).
  5. ASCII-only on both files.
  6. COMPRESSION_LEVELS_VOCAB in write.cjs MUST stay in sync with
     phase45.COMPRESSION_LEVELS at build.cjs:104. If Phase 45 ever changes
     the enum, this const must be updated. Phase 49 self-test F1 binds
     parity (it imports both and asserts array equality).
  </action>
  <verify>
    <automated>node super-gsd/tools/phase-capsule/write.cjs --self-test</automated>
  </verify>
  <done>
    PHASE-CAPSULE.schema.json has 10 new optional lifecycle properties; required
    array unchanged; additionalProperties:false preserved.
    write.cjs has LIFECYCLE_FIELDS + COMPRESSION_LEVELS_VOCAB frozen exports;
    _assertCapsuleSchema validates each lifecycle field per schema oneOf;
    self-test grows by 3 assertions and exits 0 (existing F1-F4 unchanged).
    Single atomic commit per RESEARCH contract: feat(49-01).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Backfill lifecycle fields on 44 existing PHASE-CAPSULE.json files (idempotent)</name>
  <files>
    .planning/milestones/v1.1/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.2/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.3/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.4/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.5/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.6/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.7/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.8/phases/*/PHASE-CAPSULE.json,
    .planning/milestones/v1.9/phases/*/PHASE-CAPSULE.json
  </files>
  <behavior>
    After this task:
    - All 44 PHASE-CAPSULE.json files (verified via `find .planning/milestones
      -name PHASE-CAPSULE.json | wc -l`) contain populated lifecycle fields.
    - Per file:
        compression_level === 'phase_capsule'
        promoted_at === <existing cap.created_at> (preserved verbatim; NOT now())
        allowed_consumers === ['*']
        revocation_path === 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke'
        demoted_at === null
        revoked_at === null
        revoked_reason === null
        revalidation_due === null
        supersedes_id === null
        superseded_by_id === null
    - Re-running the backfill is a NO-OP (idempotent). The CLI prints
      `{updated:0, skipped:44, errors:[]}` on second run.
    - Each backfilled file passes `_assertCapsuleSchema` (Phase 43 schema,
      now extended with 10 lifecycle fields).
    - The phase49 capsule (this phase, IN_PROGRESS) is also backfilled.
    - No PHASE-CAPSULE.json under `.planning/archive/superseded/` is touched
      (Open Q3: backfill walker is `.planning/milestones/v*/phases/` only).
    - Phase 41-48 .cjs source files are UNCHANGED.
    - 9 v1.9 canonical metric streams are UNCHANGED.
  </behavior>
  <action>
1. Verify count BEFORE backfill:
   `find .planning/milestones -name PHASE-CAPSULE.json | grep -v archive | wc -l`
   Expect 44 (or current count). Record.

2. Run the backfill via CLI:
   `node super-gsd/tools/memory-governance/lifecycle.cjs --backfill`

3. The backfill function (Task 1's `backfillLifecycleFields`) MUST:
   a. Walk `.planning/milestones/v*/phases/*/PHASE-CAPSULE.json` (skipping
      `.planning/archive/`). Use fs.readdirSync recursive walk.
   b. For each capsule JSON path:
      - Read via phase43.readCapsule(planningDir, milestone, phase).
      - If cap.compression_level != null -> skip (idempotency; Pitfall 2).
      - Else compute defaults:
          compression_level = 'phase_capsule'
          promoted_at       = cap.created_at  (preserve original timestamp)
          allowed_consumers = ['*']
          revocation_path   = 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke'
          demoted_at        = null  (explicit null, not undefined)
          revoked_at        = null
          revoked_reason    = null
          revalidation_due  = null
          supersedes_id     = null
          superseded_by_id  = null
      - Apply via _editCapsuleLifecycleFields which calls phase43.writeCapsule
        atomically (tmp+rename).
   c. Track updated/skipped/errors counts.
   d. Returns {updated, skipped, errors}. Logs to stdout.

4. Verify count AFTER backfill via shell one-liner:
   `find .planning/milestones -name PHASE-CAPSULE.json | grep -v archive
    | xargs -I{} node -e "const c=require('{}');console.log(c.compression_level);"
    | sort | uniq -c`
   Expect: `44 phase_capsule` (single line; all entries phase_capsule).

5. Idempotency check: re-run the CLI. Expect stdout `{updated:0, skipped:44, errors:[]}`.

6. Re-validate schema on each touched capsule:
   `find .planning/milestones -name PHASE-CAPSULE.json | grep -v archive
    | xargs -I{} node -e "const w=require('./super-gsd/tools/phase-capsule/write.cjs');
                          const c=require('{}');
                          try{w._assertCapsuleSchema(c);console.log('ok');}
                          catch(e){console.log('FAIL:'+e.message);}" 2>/dev/null
    | sort | uniq -c`
   Expect: `44 ok` (all pass schema validation).

7. Confirm Phase 41-48 source .cjs UNCHANGED:
   `git diff --quiet super-gsd/tools/{token-attribution,token-waste,phase-capsule,
    context-registry,context-packet,intent-map,context-cache,dispatch-router,
    vtp-bridge}/*.cjs` -> exit 0 (no diff).
   EXCEPTION: Task 2's edits to phase-capsule/write.cjs + .schema.json are
   already committed BEFORE this task; for this task, we expect git diff
   on those files to be EMPTY (Task 2 already committed them).

8. Confirm 9 read-only canonical streams UNCHANGED:
   `git diff --quiet .planning/metrics/{token-attribution,codex-log,
    agent-token-spend,activity-log,token-log,token-waste-status,
    crit-backlog,route-decisions,vtp-bridge-failures}.jsonl` -> exit 0.

9. Confirm canonical phase-folder content UNCHANGED:
   `git diff --quiet .planning/milestones/v*/phases/*/{*-CONTEXT.md,*-RESEARCH.md,
    *-PLAN.md,*-VERIFICATION.md,*-ATC-REVIEW.md,reviews/*-REVIEW.md}` -> exit 0.

Stage all 44 modified PHASE-CAPSULE.json files (use explicit globs; do NOT
`git add -A`):
  git add .planning/milestones/v*/phases/*/PHASE-CAPSULE.json

Commit:
  git commit -m "feat(49-01): backfill lifecycle fields on 44 existing capsules (idempotent)"

CRITICAL TRAPS:
  1. promoted_at MUST be preserved as cap.created_at -- NOT new Date().toISOString().
     Pitfall 2 binds: re-running must be a no-op; if promoted_at is set to now()
     unconditionally, idempotency breaks.
  2. archive/superseded/ MUST be skipped. Per Open Q3: lifecycle backfill
     scope is .planning/milestones/v*/phases/ only.
  3. Existing capsule fields (schema_version, milestone, phase, status, goal,
     outputs, files, decisions, debt, downstream_contract, bypass_refs,
     source_commits, source_hashes, gates, token_cost, created_at, created_by)
     MUST be preserved verbatim. Lifecycle fields are ADDITIVE; nothing else changes.
  4. After backfill, every capsule must still pass `_assertCapsuleSchema`.
     Verify via the one-liner in step 6.
  5. Each PHASE-CAPSULE.json edit goes through phase43.writeCapsule (atomic
     tmp+rename) -- NEVER direct fs.writeFileSync from this task.
  6. ASCII-only on the JSON output (Phase 43 writeCapsule emits ASCII).
  7. Stage explicit globs; do NOT `git add -A` (avoids accidentally staging
     untracked .planning/metrics/memory-* test artifacts).
  </action>
  <verify>
    <automated>node super-gsd/tools/memory-governance/lifecycle.cjs --backfill && find .planning/milestones -name PHASE-CAPSULE.json | grep -v archive | xargs -I{} node -e "const c=require('{}');if(c.compression_level!=='phase_capsule')process.exit(1);" && git diff --quiet super-gsd/tools/token-attribution super-gsd/tools/token-waste super-gsd/tools/context-registry super-gsd/tools/context-packet super-gsd/tools/intent-map super-gsd/tools/context-cache super-gsd/tools/dispatch-router super-gsd/tools/vtp-bridge</automated>
  </verify>
  <done>
    All 44 PHASE-CAPSULE.json files have lifecycle fields populated with safe
    defaults; promoted_at preserves cap.created_at; archive/ skipped; idempotent
    re-run is no-op; every backfilled capsule passes _assertCapsuleSchema;
    Phase 41-48 source files (excluding Task 2 edits) and 9 read-only canonical
    streams UNCHANGED.
    Single atomic commit per RESEARCH contract: feat(49-01).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Wire Phase 45 step 6 -- context-packet calls Phase 49 loadIndexSnippets</name>
  <files>
    super-gsd/tools/context-packet/build.cjs
  </files>
  <behavior>
    After this task:
    - super-gsd/tools/context-packet/build.cjs:702-703 (the empty-stub
      `const indexSnippets = []; // No-op fallback; explicit empty.`) is
      replaced with a try/catch require of Phase 49 lifecycle.cjs that calls
      loadIndexSnippets() and falls back to [] on require failure.
    - The existing Phase 45 self-test (`node super-gsd/tools/context-packet/build.cjs
      --self-test`) passes UNCHANGED (the require fallback to [] retains current
      behavior in test envs where Phase 49 module load fails or returns sentinel).
    - When Phase 49 is loaded successfully, loadIndexSnippets returns rows
      filtered by revocation + annotated with revalidation_due flag.
    - The Phase 45 self-test grows by 1 assertion verifying the wire is
      present (a regex check on the function body for `loadIndexSnippets`
      string presence). NO actual Phase 49 invocation in Phase 45 self-test
      (cross-module integration is covered by Phase 49 F14 fixture).
    - Phase 49 F14 fixture (in lifecycle.cjs --self-test) covers the wire
      end-to-end: builds a packet via phase45.buildPacket and asserts
      indexSnippets array path executes (non-empty when Phase 49 mock query
      returns rows).
  </behavior>
  <action>
EDIT: super-gsd/tools/context-packet/build.cjs

Read the file. Find lines 702-703 verbatim:
```javascript
  // Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct).
  const indexSnippets = []; // No-op fallback; explicit empty.
```

Replace with:
```javascript
  // Step 6: local index snippets via Phase 49 governance-filtered Phase 46 query.
  // Phase 49 GOV-01..08 wire-in (RESEARCH sec Q8). Lock 13: require failure
  // falls back to empty array (preserves Phase 45 self-test invariant).
  // Phase 49 loadIndexSnippets internally:
  //   1. Calls Phase 46 query() (per-row Phase 44 validateOne already filtered)
  //   2. Filters out rows whose underlying capsule has revoked_at != null
  //   3. Annotates remaining rows with revalidation_due flag (sha256 drift)
  //   4. When opts.strict_revalidation: elides rows where revalidation_due===true
  let indexSnippets = [];
  try {
    const phase49 = require('../memory-governance/lifecycle.cjs');
    if (phase49 && typeof phase49.loadIndexSnippets === 'function') {
      indexSnippets = phase49.loadIndexSnippets(intent_map.intent || '', {
        planningDir: _planningDir(opts),
        milestone: milestone,
        phase: phase,
        limit: 5,
        strict_revalidation: false, // surface drift via revalidation_due flag; do not elide
      });
      if (!Array.isArray(indexSnippets)) indexSnippets = [];
    }
  } catch (_e) {
    indexSnippets = []; // Lock 13: never throw on missing/broken Phase 49 wire.
  }
```

CONTEXT NOTES (verify before commit):
  - The local variables `intent_map`, `milestone`, `phase`, `opts`, and
    `_planningDir` are all in scope at line 702 (verified via Phase 45
    build.cjs:634-867 build sequence).
  - The fallback path (catch -> indexSnippets=[]) preserves the EXACT
    behavior of the original empty-stub when the require fails. Phase 45
    self-test running without Phase 49 module installed (e.g. during the
    historical commit window or in a malformed checkout) MUST continue to pass.
  - The new try/catch is the ONLY edit to build.cjs. The downstream code
    (steps 7-15 of the build sequence) is UNCHANGED and consumes
    `indexSnippets` exactly as before (it's an array of zero-or-more snippet
    rows; the consumers tolerate empty).

Phase 45 self-test grow (in build.cjs `_runSelfTest`):
  Add ONE new assertion AFTER the existing fixtures, BEFORE the final
  fingerprint diff:

```javascript
// Phase 49 wire-in presence assertion (additive; no actual Phase 49 invocation
// here -- Phase 49 F14 fixture covers integration end-to-end).
const buildSrc = fs.readFileSync(__filename, 'utf8');
assert(buildSrc.indexOf('loadIndexSnippets') >= 0,
  'Phase 49 wire-in missing: build.cjs step 6 must reference phase49.loadIndexSnippets');
assert(buildSrc.indexOf("require('../memory-governance/lifecycle.cjs')") >= 0,
  'Phase 49 wire-in missing: build.cjs step 6 must require memory-governance/lifecycle.cjs');
```

VERIFICATION:
  node super-gsd/tools/context-packet/build.cjs --self-test
  Exit 0 + assertion count grows by 1 (or 2 logically grouped).

Stage and commit:
  git add super-gsd/tools/context-packet/build.cjs
  git commit -m "feat(49-01): wire Phase 45 step 6 -- context-packet calls Phase 49 loadIndexSnippets"

CRITICAL TRAPS:
  1. ONLY edit lines 702-703 + add the self-test assertion. Steps 1-5 and
     7-15 of the buildPacket sequence are UNCHANGED.
  2. The require path is `'../memory-governance/lifecycle.cjs'` (relative
     from super-gsd/tools/context-packet/ to super-gsd/tools/memory-governance/).
  3. The catch handler MUST set `indexSnippets = []` to preserve the
     historical empty-stub fallback (Lock 13).
  4. Phase 45's existing F1-F? self-test fixtures MUST continue to pass
     UNCHANGED. Verify by running --self-test BEFORE and AFTER and diffing
     pass count (expect: original_count + 1 or +2).
  5. ASCII-only on the edit (no smart quotes, no Unicode arrows).
  6. NEVER add a hard import at module top -- the require MUST be lazy
     (inside the try/catch) to avoid circular-dep risk:
       phase45 imports phase49 -> phase49 imports phase45 -> circular.
     Lazy require sidesteps this: phase49 is only required when buildPacket
     reaches step 6, by which time phase49's module-level side effects
     (Object.freeze enums, etc.) have completed if phase49 was previously
     loaded. If phase49 is being loaded for the first time and recursively
     requires phase45 (which is currently loading), Node returns partial
     module.exports -- still safe because phase45 has already exported
     COMPRESSION_LEVELS by the time _assertValidatedThoughtProvenance is
     called inside phase49's _validateInput.
  </action>
  <verify>
    <automated>node super-gsd/tools/context-packet/build.cjs --self-test && node super-gsd/tools/memory-governance/lifecycle.cjs --self-test</automated>
  </verify>
  <done>
    build.cjs:702-703 stub replaced with try/catch require of Phase 49
    loadIndexSnippets; fallback preserved for Lock 13. Phase 45 self-test
    passes UNCHANGED + grows by ~1-2 assertions. Phase 49 F14 fixture passes
    end-to-end. No hard import at module top; require is lazy inside step 6.
    Single atomic commit per RESEARCH contract: feat(49-01).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: SKILL.md wire -- sgsd-orchestrate close emits processComplaints; sgsd-complete-milestone emits revalidate batch</name>
  <files>
    super-gsd/skills/sgsd-orchestrate/SKILL.md,
    super-gsd/skills/sgsd-complete-milestone/SKILL.md
  </files>
  <behavior>
    After this task:
    - sgsd-orchestrate SKILL.md gains a NEW step labeled
      `Step 6.6.i.Y: MEMORY GOVERNANCE COMPLAINT PROCESSING (Phase 49 -- GOV-01)`
      placed AFTER `Step 6.6.i.X: PHASE CAPSULE WRITE` (currently at line 1386)
      and BEFORE `Step 6.6.i: Mark phase complete, advance to next phase`
      (currently at line 1438). The step instructs the orchestrator to call
      Phase 49 processComplaints at phase close. Lock 13 wrapped: failure
      logs context-complaint, NEVER halts phase advance.
    - sgsd-complete-milestone SKILL.md gains a NEW step labeled
      `Step 4.7-quater: MEMORY GOVERNANCE REVALIDATION SWEEP (Phase 49 -- GOV-08, A6)`
      placed AFTER `Step 4.7-bis: Phase Capsule Backfill Safety-Net`
      (currently at line 231-282) and BEFORE
      `Step 4.7-ter: Intent-Map + Packet-Log Close` (currently at line 284).
      The step walks all PHASE-CAPSULE.json under the closing milestone and
      calls Phase 49 revalidate per capsule, aggregating drift count.
      Lock 13 wrapped.
    - Both edits cite RESEARCH section + Lock binding inline (mirror Step
      6.6.i.X "RESEARCH sec 9.3" + "Lock 5" citation pattern at lines 1389,
      1434).
    - The orchestrate SKILL grows from 2404 -> ~2410+ lines.
    - The complete-milestone SKILL grows from 498 -> ~510+ lines.
    - No other content in either SKILL is mutated.
  </behavior>
  <action>
EDIT 1: super-gsd/skills/sgsd-orchestrate/SKILL.md

Read the file. Find the existing closing of Step 6.6.i.X (around line 1437,
the line `       i. Mark phase complete, advance to next phase.`).

INSERT a new step BEFORE that line, AFTER the existing R4 hard-rule line
(around line 1436):

```markdown
       i.Y. MEMORY GOVERNANCE COMPLAINT PROCESSING (Phase 49 -- GOV-01; LOCK 13)

            Run Phase 49 processComplaints at phase close. Reads
            .planning/metrics/context-complaints.jsonl filtered by ts > cursor;
            classifies each row by reason_codes[]; dispatches deterministic
            repair (capsule rebuild scheduling, packet rebuild scheduling,
            thought demote/revoke). NEVER halts phase advance (Lock 13).

            Per design lock 13 (REQUIREMENTS.md:67-68): processComplaints
            wraps internals in try/catch and returns
            { repairs_attempted:N, repairs_succeeded:M, ledger_rows:[...] }
            on success or { ok:false, reason:'<...>_internal_error' } on
            internal error. Either way, the orchestrator continues to step
            6.6.i unconditionally. Per RESEARCH sec 7 (Phase 49 49-RESEARCH.md):
            cursor advances monotonically via .planning/metrics/memory-process-cursor.json,
            preventing repair-loops (Pitfall 6); max 50 repairs per invocation
            (defensive bound).

            ```javascript
            // Phase 49 wire-in: anchor planningDir to process.cwd() at the
            // orchestrator-skill boundary (mirrors Step 6.6.i.X capsule write
            // pattern at write.cjs require above).
            const path = require('path');
            const { processComplaints } = require(
              path.join(process.cwd(), 'super-gsd', 'tools', 'memory-governance', 'lifecycle.cjs')
            );
            const result = processComplaints({
              since_ts: undefined,    // undefined -> read from cursor file
              max_repairs: 50,        // defensive bound; matches Phase 49 default
            });
            // result: { repairs_attempted:N, repairs_succeeded:M, ledger_rows:[...] }
            //      or { ok:false, reason:'<...>_internal_error' } -- NEVER throws.
            // On failure: processComplaints already appended a row to
            // .planning/metrics/context-complaints.jsonl with
            // reason_code:'memory_process_complaints_internal_error'.
            // Orchestrator continues to 6.6.i unconditionally.
            ```

            HARD RULES for this gate -- no exceptions:

            G1. processComplaints outcome NEVER blocks step 6.6.i (mark complete /
                advance). Lock 13 binds.
            G2. Repair actions are SCHEDULED via .planning/metrics/repair-queue.jsonl
                envelope-v1 rows; the orchestrator picks up the queue on the
                NEXT phase loop iteration (or via explicit
                /gsd-process-repair-queue command). Phase 49 itself does NOT
                call Phase 45 buildPacket -- that's the orchestrator's job.
            G3. Cursor file (.planning/metrics/memory-process-cursor.json) is
                the single source of since_ts truth. Phase 49 reads on entry,
                writes on exit. Manual edits to the cursor are operator-discretion
                only; never touch it from the skill.
            G4. The wire-in MUST cite Phase 49 RESEARCH sec 7 + GOV-01 + Lock 13
                in the rendered markdown so future operators understand WHY
                this step is between 6.6.i.X and 6.6.i.

```

Preserve all existing Step 6.6.i.X content + R1-R4 hard rules verbatim.

EDIT 2: super-gsd/skills/sgsd-complete-milestone/SKILL.md

Read the file. Find the closing of `</step_4_7b_phase_capsule_backfill>`
(around line 282) and the opening of `<step_4_7c_intent_packet_close>`
(around line 284).

INSERT a new step BETWEEN them:

```markdown
<step_4_7c_memory_governance_revalidate>
## Step 4.7-quater: Memory Governance Revalidation Sweep (Phase 49 -- GOV-08, A6)

After Step 4.7-bis Phase Capsule Backfill completes, sweep all
PHASE-CAPSULE.json under the closing milestone and call Phase 49 revalidate
per capsule. revalidate() re-hashes each capsule's source_refs[] against
current canonical files; mismatches OR existsSync===false set
revalidation_due=true on the capsule AND append a row to
.planning/metrics/memory-revalidations.jsonl (envelope-v1).

Per design lock 13 (REQUIREMENTS.md:67-68): revalidate NEVER auto-revokes.
Drift surfaces as a flag for downstream consumers (Phase 49 loadIndexSnippets,
Phase 50 cockpit). Revocation is mechanical-but-explicit -- triggered by
operator decision or by Phase 49 processComplaints classification, never
by revalidate() itself.

Per RESEARCH sec Q6 (Phase 49 49-RESEARCH.md L1014-1023): read-pulled
revalidation; lazy on access. The milestone-close sweep is a one-shot
batch for audit; ongoing drift detection happens at consumption time
inside loadIndexSnippets.

```javascript
// Phase 49 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.7-bis writeAllCapsulesForMilestone
// pattern at line 256).
const path = require('path');
const fs = require('fs');
const { revalidate, _capsuleArtifactId } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'memory-governance', 'lifecycle.cjs')
);
const { readCapsule } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const milestoneDir = path.join(planningDir, 'milestones', '{{version}}', 'phases');

let totalChecked = 0;
let driftDetected = 0;
let errors = 0;

try {
  if (fs.existsSync(milestoneDir)) {
    const phases = fs.readdirSync(milestoneDir);
    for (const ph of phases) {
      try {
        const capPath = path.join(milestoneDir, ph, 'PHASE-CAPSULE.json');
        if (!fs.existsSync(capPath)) continue;
        const cap = readCapsule(planningDir, '{{version}}', ph.split('-')[0]);
        if (!cap) continue;
        const artifactId = _capsuleArtifactId(cap);
        const result = revalidate(artifactId);
        totalChecked++;
        if (result && result.drift_detected) driftDetected++;
      } catch (_e) {
        errors++;
      }
    }
  }
} catch (_e) {
  // Lock 13: milestone close NEVER halts on Phase 49 failure.
}
// result aggregated: log to context-complaints.jsonl if errors > 0.
// Step 4.7-ter (intent-map close) continues regardless.
```

Per lock 5: phase capsule is a PROJECTION; revalidate edits ONLY lifecycle
fields on the existing PHASE-CAPSULE.json (additive; routed through Phase 43
writeCapsule atomic write). Per lock 13: revalidate failures continue
milestone close. Per lock 6: bypass entries are not revalidated (Lock 6
carve-out -- bypass refs were never promoted past phase_capsule, so their
source_refs[] are not stored on the capsule for revalidation).

Defer-on-empty: if .planning/milestones/{{version}}/phases/ is absent
(empty milestone), the walk is a no-op and Step 4.7-ter continues.

memory-revalidations.jsonl: revalidate appends one envelope-v1 row per
drift-detected capsule. Cockpit (Phase 50) reads this stream for "recently
revalidated" panel; Phase 51 BENCH-08 reads for evidence_retention metric.

</step_4_7c_memory_governance_revalidate>

```

Preserve all existing Step 4.7, 4.7-bis, 4.7-ter content verbatim. The only
addition is the new <step_4_7c_memory_governance_revalidate> block between
4.7-bis and 4.7-ter. Note: the existing <step_4_7c_intent_packet_close>
tag should be RENAMED to <step_4_7d_intent_packet_close> to maintain
sequential ordering, OR keep its existing tag and add a comment noting
the new 4.7-quater step is between 4.7-bis and 4.7-ter. RECOMMEND: keep
the existing 4.7c tag for intent-packet-close (preserves git blame +
external references) and use 4.7-quater (Latin "fourth") as the human-readable
step number while the XML tag is `<step_4_7c_memory_governance_revalidate>`
followed by `<step_4_7c_intent_packet_close>` -- but XML tags must be unique
per file. Resolve by USING `<step_4_7c2_memory_governance_revalidate>` as
the XML tag (numeric suffix to disambiguate) while the human-readable header
reads "Step 4.7-quater". Update other references if the XML tag is grepped
elsewhere (verify with `grep -rn "step_4_7c" super-gsd/`).

VERIFICATION:
  - sgsd-orchestrate SKILL.md grows by ~50-60 lines.
  - sgsd-complete-milestone SKILL.md grows by ~70-80 lines.
  - Both files are ASCII-only.
  - No existing step content is mutated; only additions between existing steps.
  - Run `grep -n "processComplaints\|revalidate" super-gsd/skills/sgsd-{orchestrate,complete-milestone}/SKILL.md`
    -> at least 2 matches per file.

Stage and commit:
  git add super-gsd/skills/sgsd-orchestrate/SKILL.md
  git add super-gsd/skills/sgsd-complete-milestone/SKILL.md
  git commit -m "feat(49-01): SKILL.md wire -- sgsd-orchestrate close emits processComplaints; sgsd-complete-milestone emits revalidate batch"

CRITICAL TRAPS:
  1. NEVER mutate existing Step 6.6.i.X capsule write content -- only ADD
     Step 6.6.i.Y after it. Existing R1-R4 hard rules and code block must
     remain verbatim.
  2. NEVER mutate existing Step 4.7-bis capsule backfill content -- only
     ADD Step 4.7-quater after it.
  3. The processComplaints call signature must match Phase 49 Task 1
     (since_ts: undefined, max_repairs: 50).
  4. The revalidate batch wraps the entire walk in try/catch (Lock 13);
     a single bad capsule does NOT halt the sweep.
  5. ASCII-only on both files.
  6. Cite RESEARCH section + Lock binding inline (matches Step 6.6.i.X
     citation style at line 1389+1434).
  7. XML tag uniqueness: if both 4.7c blocks coexist, use `<step_4_7c2_...>`
     for the new memory-governance-revalidate block to keep tags unique.
     Verify no other code/scripts grep on the exact tag string.
  </action>
  <verify>
    <automated>grep -c "processComplaints" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -c "revalidate" super-gsd/skills/sgsd-complete-milestone/SKILL.md && node -e "const s1=require('fs').readFileSync('super-gsd/skills/sgsd-orchestrate/SKILL.md','utf8');const s2=require('fs').readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8');for(const ch of s1+s2){if(ch.charCodeAt(0)>126||(ch.charCodeAt(0)<32&&ch!=='\n'&&ch!=='\r'&&ch!=='\t'))process.exit(1);}"</automated>
  </verify>
  <done>
    sgsd-orchestrate SKILL.md has new Step 6.6.i.Y MEMORY GOVERNANCE COMPLAINT
    PROCESSING after Step 6.6.i.X capsule write, with G1-G4 hard rules and
    Lock 13 wrap citation.
    sgsd-complete-milestone SKILL.md has new Step 4.7-quater MEMORY GOVERNANCE
    REVALIDATION SWEEP after Step 4.7-bis capsule backfill, with batch
    revalidate walk and Lock 13 wrap citation.
    Both files ASCII-only; no mutation of existing step content.
    Single atomic commit per RESEARCH contract: feat(49-01).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| caller -> admitMemoryWrite | Untrusted artifact crosses here; mandatory 6-field gate enforced |
| caller -> promote/demote/revoke | Admit gate re-checked defense-in-depth before lifecycle write |
| canonical phase-folder content -> revalidate source-hash check | Source files may change between thought write and read; sha256 drift surfaces this |
| context-complaints.jsonl row -> processComplaints repair classifier | Untrusted reason_codes drive deterministic repair; closed-enum classifier; default branch = warn-not-act |
| MCP-injected source files (LOCK 12) -> admitMemoryWrite | source_refs treated as DATA; never interpreted as instructions |
| concurrent CLI invocations -> JSONL append | < 4000 byte rows preserve POSIX append atomicity (Pitfall 4) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-49-01 | Spoofing | admitMemoryWrite | mitigate | Mandatory source_refs + root_source_hashes; sha256 verification at admission AND at revalidation read-time |
| T-49-02 | Tampering | source files referenced by stored thoughts | mitigate | revalidate() re-hashes source files; drift sets revalidation_due flag; memory-revalidations.jsonl ledger row emitted |
| T-49-03 | Repudiation | revoke operation | mitigate | Tombstone semantics (revoked_at + revoked_reason on capsule); memory-revocations.jsonl ledger row appended; never hard-deletes |
| T-49-04 | Information Disclosure | allowed_consumers field | accept | v1.9 ships with default ['*'] (no per-role enforcement yet); Phase 50+ enforces per-cockpit/planner scoping; mandatory field shape ships now to lock the future contract |
| T-49-05 | Denial of Service | revoke chain depth attack | mitigate | _resolveSupersededChain depth-cap REPLACED_BY_CHAIN_DEPTH_CAP=5; F7b fixture binds |
| T-49-06 | Denial of Service | processComplaints repair-loop saturation | mitigate | max_repairs=50 cap per invocation; monotonic since_ts cursor in memory-process-cursor.json; F9c fixture binds |
| T-49-07 | Elevation of Privilege | promote bypass_refs[] critical content into "trusted" rule | mitigate | LOCK 6 carve-out: admitMemoryWrite rejects bypass_refs[].length>0 + compression_level>phase_capsule (memory_admission_bypass_refs_block_promotion); F2d binds |
| T-49-08 | Elevation of Privilege | promote artifact with open critical debt | mitigate | admitMemoryWrite rejects debt.critical_added>0 + compression_level>phase_capsule (memory_admission_debt_blocks_promotion); F2e binds (Pitfall 5) |
| T-49-09 | Elevation of Privilege | semantic-similarity-based promotion attack | mitigate | LOCK 11: promotion thresholds are STRUCTURAL (counted evidence rows, counted reuse phases); _validateInput rejects banned fields (similarity_score, fuzzy_match, cosine, embedding) |
| T-49-10 | Tampering | concurrent JSONL append clobbering | mitigate | Row JSON.stringify length capped < 4000 bytes (truncate details); POSIX append atomicity preserved within PIPE_BUF |
| T-49-11 | Tampering | TOCTOU revoke vs. read race | mitigate | revoked_at is monotonic; PHASE-CAPSULE.json atomic rewrite via tmp+rename; reader sees either pre-revoke or post-revoke state, never partial |
| T-49-12 | Spoofing | prompt-injection text inside source files | accept | LOCK 12 (REQUIREMENTS.md:67) -- source content is DATA never instructions; admit gate accepts source_refs as paths; Phase 45 build.cjs:613 already enforces this for body assembly; Phase 49 inherits at admission boundary |
| T-49-13 | Repudiation | source file deleted without revocation | mitigate | revalidate() existsSync check; appends row with reason_codes:['source_file_missing']; processComplaints may classify and trigger revoke via repair-queue.jsonl |
| T-49-14 | Information Disclosure | self-test writes to real .planning/metrics/ | mitigate | F10 fixture captures fingerprints BEFORE/AFTER on 30+ paths; all test-mutated state in os.tmpdir(); __dirname-anchored path resolution (Pitfall 7) |
| T-49-15 | Denial of Service | Phase 49 internal error halts orchestrator | mitigate | Lock 13: every public API + loadIndexSnippets + backfillLifecycleFields try/catch wrapped; sentinel return + context-complaint emission; orchestrator never halts on Phase 49 failure; F13 binds |
</threat_model>

<verification>
Per-task automated checks:
- T1: `node super-gsd/tools/memory-governance/lifecycle.cjs --self-test` -> exit 0, PASS 14-22/14-22
- T2: `node super-gsd/tools/phase-capsule/write.cjs --self-test` -> exit 0, asserts grow by 3
- T3: 44/44 PHASE-CAPSULE.json have compression_level=='phase_capsule'; idempotent re-run is no-op; Phase 41-48 sources + 9 read-only canonical streams unchanged
- T4: `node super-gsd/tools/context-packet/build.cjs --self-test` -> exit 0; `node super-gsd/tools/memory-governance/lifecycle.cjs --self-test` F14 fixture passes
- T5: `grep -c processComplaints` orchestrate >= 2; `grep -c revalidate` complete-milestone >= 2; ASCII-only on both files

End-of-phase aggregate verification (run before /gsd-verify-work):
- Full self-test suite: lifecycle.cjs + phase-capsule/write.cjs + context-packet/build.cjs all PASS
- F1 admit happy path passes
- F2-F2h admit reject (8 sub-fixtures) all pass
- F3-F5c promotion path (5 fixtures + 2 reject sub-fixtures) all pass
- F6 demote passes
- F7-F7b revoke + chain depth-cap pass
- F8-F8b revalidate drift detection (2 fixtures) pass
- F9-F9c processComplaints repair loop (3 fixtures) all pass
- F10 read-only invariant fingerprint diff empty across 30+ paths
- F11 backfill idempotency passes
- F12 envelope-v1 row coverage on all 4 NEW canonical streams + repair-queue.jsonl
- F13 Lock 13 every public API survives null/undefined/garbage
- F14 Phase 45 wire-in end-to-end integration passes
- After T3 commit: all 44 PHASE-CAPSULE.json have compression_level='phase_capsule'
- After T4 commit: Phase 45 step-6 snippets from Phase 49 wrapper (Phase 46 query() reachable via Phase 49)
- Read-only invariant: `git diff --quiet` on Phase 41-48 sources (excluding Task 2 edits to write.cjs + .schema.json and Task 4 edit to build.cjs:702-703) + 9 canonical metric streams
- ASCII-only on all 6 written files (lifecycle.cjs, PHASE-CAPSULE.schema.json, write.cjs, build.cjs, sgsd-orchestrate SKILL.md, sgsd-complete-milestone SKILL.md)
</verification>

<success_criteria>
1. lifecycle.cjs ships ~850-1100 LOC, single module, 6 public APIs + 3 helpers + CLI parity (Task 1)
2. PHASE-CAPSULE.schema.json + write.cjs::_assertCapsuleSchema extended with 10 additive lifecycle fields; required[] unchanged; Phase 43 self-test grows by 3 assertions and exits 0 (Task 2)
3. All 44 existing PHASE-CAPSULE.json files have lifecycle fields populated with safe defaults; promoted_at preserves cap.created_at; archive/ skipped; idempotent re-run is no-op (Task 3)
4. Phase 45 build.cjs:702-703 stub replaced with try/catch require of Phase 49 loadIndexSnippets; fallback preserved; Phase 45 self-test passes UNCHANGED (Task 4)
5. sgsd-orchestrate SKILL.md has new Step 6.6.i.Y processComplaints; sgsd-complete-milestone SKILL.md has new Step 4.7-quater revalidate batch; both Lock 13 wrapped (Task 5)
6. 4 NEW canonical streams (memory-{promotions,demotions,revocations,revalidations}.jsonl) created on first emit; envelope-v1 shape verified
7. 5 commits total per RESEARCH contract: feat(49-01) for each Task 1-5
8. Read-only invariant: 9 v1.9 canonical metric streams + Phase 41-48 source files (excluding Task 2 + Task 4 additive edits) + canonical phase-folder content UNCHANGED (F10 fingerprint diff empty)
9. Lock 13: every public API survives null/undefined/garbage without throw (F13 binds)
10. ASCII-only on all 6 written files
11. Self-test PASS 14-22/14-22 in <10s
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-01-SUMMARY.md`
documenting:
- Final lifecycle.cjs LOC count + exported API surface
- Self-test pass count (14-22 fixtures)
- Backfill: 44/44 capsules updated; idempotent re-run no-op count
- Phase 45 step-6 wire-in: build.cjs line numbers patched
- SKILL.md edits: line counts before/after + step labels
- 4 NEW canonical streams created + first-emit timestamps
- F10 fingerprint diff: 30+ paths verified unchanged
- Read-only invariant: git diff --quiet on Phase 41-48 sources (excluding Task 2 + Task 4 edits) + 9 canonical metric streams
- Lock 13 sentinel: F13 fixture pass count
- ASCII-only verification across all 6 written files
- Forward contracts: getMemoryGovernanceSnapshot shape ready for Phase 50; memory-revocations + memory-revalidations streams ready for Phase 51 BENCH-07/08
</output>
