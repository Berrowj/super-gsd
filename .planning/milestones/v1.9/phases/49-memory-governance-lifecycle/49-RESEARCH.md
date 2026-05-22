# Phase 49: Memory Governance Lifecycle — Research

**Researched:** 2026-04-27
**Domain:** memory-write admission / compression-level lifecycle / context-complaint repair / revocation auditing
**Confidence:** HIGH (all 15 questions LOCKED; every input surface verified in source: Phase 43 capsule schema, Phase 44 validateOne, Phase 45 _assertValidatedThoughtProvenance + complaint schema, Phase 46 query, Phase 47 route_decisions, Phase 48 evidence_packet)

---

## Summary

Phase 49 ships the **memory governance kernel** that gates every durable memory-write in SGSD. v1.9 has built every input it consumes: Phase 43 owns the capsule schema and frozen `STATUS_VOCAB` + `BYPASS_KIND_VOCAB`; Phase 44 owns `validateOne(key,'phases')` for legal-key admission; Phase 45 owns `_assertValidatedThoughtProvenance({source_refs, root_source_hashes})` plus `.planning/metrics/context-complaints.jsonl` envelope-v1 (34 rows already emitted by Phases 43/45/46); Phase 46 owns the SQLite read-side `query()` with per-row registry filter; Phase 47 emits route-decisions with `boundary='dispatch_route'`; Phase 48 emits evidence packets with mandatory `source_refs[] + root_source_hashes[]` already shaped for promotion. Phase 49 is the **gate + lifecycle ledger + repair loop**, not new infrastructure.

The VTP delta (`.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md`) names the lock: **"every durable memory write is a privileged state transition with provenance, confidence, source_hashes, allowed_consumers, and revocation_path"**. Phase 49 implements that lock as `admitMemoryWrite()` — a single function that mechanically rejects unproven writes — plus four transition primitives (`promote / demote / revoke / revalidate`) plus one feedback loop (`processComplaints`). All 6 public APIs live in **one** module: `super-gsd/tools/memory-governance/lifecycle.cjs` (mirrors the Phase 41-48 single-module-with-multiple-exports precedent: `phase-capsule/write.cjs`, `context-registry/check.cjs`, `dispatch-router/route.cjs`, `vtp-bridge/classify.cjs`).

Critical to A6 (read-time reconsolidation): when `loadIndexSnippets()` (Phase 49's thin wrapper around Phase 46 `query()`) returns a row whose stored `source_hash` no longer matches the canonical artifact's current hash, Phase 49 marks `revalidation_due=true` AND emits a `memory-revalidations.jsonl` row. This is the "source drifted under us" detector. The entry remains usable (Lock 13: no halt) but downstream consumers (Phase 45 step 6) see the flag and can elide.

Critical to the no-canonical-replacement rule: Phase 49 owns **4 NEW canonical streams** (`memory-promotions.jsonl`, `memory-demotions.jsonl`, `memory-revocations.jsonl`, `memory-revalidations.jsonl`) plus **lifecycle field edits on existing PHASE-CAPSULE.json files** (additive — schema extended, no existing field renamed). Phase 49 is **READ-ONLY** against the 9 v1.9 canonical metric streams (token-attribution, codex-log, agent-token-spend, activity-log, token-log, token-waste-status, crit-backlog, route-decisions, vtp-bridge-failures), Phases 41-48 source files, and canonical phase-folder content.

**Primary recommendation:** Ship `super-gsd/tools/memory-governance/lifecycle.cjs` exporting **6 public APIs** + 1 private wrapper:

1. `admitMemoryWrite(artifact)` → `{ok:bool, reason}` — admission gate (A4, A5)
2. `promote({artifact_id, from_level, to_level, evidence})` → `{ok, new_id, ledger_row}` (A1)
3. `demote(artifact_id, reason)` → `{ok, ledger_row}` (A2)
4. `revoke(artifact_id, reason, replaced_by?)` → `{ok, ledger_row}` (A2)
5. `revalidate(artifact_id)` → `{ok, drift_detected, ledger_row}` (A6)
6. `processComplaints({since_ts})` → `{repairs_attempted, repairs_succeeded, ledger_rows}` (A3, A7)
7. `loadIndexSnippets(query, opts)` (private + exposed) — Phase 45 step-6 wire-in: calls Phase 46 `query()` then filters rows where `revoked_at != null` OR `revalidation_due === true` AND `opts.strict_revalidation === true`.

Lifecycle backfill: extend Phase 43 capsule schema (additive) with 7 lifecycle fields, run a one-shot migration that populates the 44 existing capsules with safe defaults (`compression_level: 'phase_capsule'`, `promoted_at: <existing capsule.created_at>`, `allowed_consumers: ['*']`, `revocation_path: 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke'`).

Self-test: 10 fixtures (8 happy + 2 read-only + drift). Min 14 in-module assertions. Mirror Phase 48's `--self-test` CLI exit contract (exit 0 on PASS).

---

<user_constraints>

## User Constraints (from 49-CONTEXT.md + ROADMAP §49 + REQUIREMENTS.md + VTP-RESEARCH-DELTA.md)

### Locked Decisions

From `.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-CONTEXT.md` (verbatim):

> "Goal: govern what becomes future SGSD memory.
>
> Implement context complaints, memory write admission, promotion/demotion, revocation/deletion protocol, and lifecycle fields for capsules and reusable rules. Memory writes are privileged state transitions, not casual summaries."

From ROADMAP.md §49 (verbatim acceptance):

- A1: raw evidence -> capsule -> validated thought -> reusable rule/guardrail promotion is explicit
- A2: demotion/revocation is explicit when abstraction fails or becomes stale; stale or bad memory can be revoked
- A3: context complaints can trigger capsule/packet repair
- A4: memory write gate rejects unproven or source-less promoted rules
- A5: recurring intent maps can be promoted only with provenance, confidence, last validation, allowed consumers, and revocation path

From REQUIREMENTS.md GOV-01..GOV-08 (verbatim):

- GOV-01: Implement context complaint log: `.planning/metrics/context-complaints.jsonl` (Phase 45 already created — Phase 49 owns lifecycle)
- GOV-02: Implement memory write admission checks for capsules, summaries, and promoted rules
- GOV-03: Add lifecycle fields: confidence, last_validated, supersedes, superseded_by, allowed_consumers, clearance_requires, deprecation_reason
- GOV-04: Add promotion/demotion rules for raw fact -> capsule -> rule
- GOV-05: Add revocation/deletion protocol for stale or bad memory
- GOV-06: Recurring intent maps can be promoted into reusable memory only with provenance, confidence, last validation, and revocation path
- GOV-07: Implement bidirectional compression lifecycle: raw_evidence -> phase_capsule -> validated_thought -> reusable_rule or guardrail, with demotion/revocation when abstraction fails
- GOV-08: Treat every durable memory write as a privileged state transition with provenance, source hashes, allowed consumers, and revalidation path

From VTP-RESEARCH-DELTA.md §"Phase 49 Delta" (verbatim):

```text
raw_evidence -> phase_capsule -> validated_thought -> reusable_rule / guardrail
                                          |
                                          v
                         demote/revoke when abstraction fails
```

> "Memory write admission treats every durable memory write as a privileged state transition.
> Promotion requires provenance, confidence, source hashes, and allowed consumers.
> Demotion/revocation is supported and auditable.
> Read-time reconsolidation is treated as a write risk if it changes future packet inputs.
> Context complaints can repair packet rules, capsule rules, or thought promotion thresholds."

From REQUIREMENTS.md design locks (verbatim binding):

- LOCK 1: "Redis is not canonical memory."
- LOCK 2: "`.planning` JSONL, phase artifacts, and git commits remain source of truth."
- LOCK 3: "SQLite/Redis projections must be rebuildable from canonical state."
- LOCK 4: "Agents consume role-specific context packets, not raw milestone history."
- LOCK 5: "Phase close writes a phase capsule before downstream phases consume it."
- LOCK 6: "Critical outputs bypass compression: CRIT, stack trace, stderr, failed test, verifier fail, edge-guard miss, security/privacy issue, destructive-operation warning, behaviorally proven provider outage."
- LOCK 11: "Intent relationships require explainable source reasons. Embedding or semantic similarity alone may suggest candidates, but it cannot justify broad context inclusion without structural evidence."
- LOCK 13: "Autonomy continues; evidence tells the truth. Budget breaches degrade or reroute by policy. They do not become silent overrun."

From Phase 44 `check.cjs:445` (verbatim cross-reference established by closed Phase 44):

> "Phase 49 GOV-02 owns memory-write admission decision"

Phase 49 is mechanically the consumer of `validateOne()` result. Phase 44 already encoded the contract.

### Claude's Discretion

- Module shape: SINGLE module with multiple exports (`super-gsd/tools/memory-governance/lifecycle.cjs`) vs separate per-API files. **RECOMMENDED**: SINGLE — mirrors Phase 41-48 precedent (`phase-capsule/write.cjs`, `context-registry/check.cjs`, `context-packet/build.cjs`, `context-cache/rebuild.cjs` + `query.cjs`, `dispatch-router/route.cjs`, `vtp-bridge/classify.cjs`). The split-file alternative would diverge from the established v1.9 pattern with no offsetting benefit.
- Self-test fixture order and exact fixture text.
- Whether to expose a CLI `--admit / --promote / --demote / --revoke / --revalidate / --process-complaints` set. **RECOMMENDED**: yes — every Phase 41-48 tool exposes parallel CLI verbs; mirror the precedent.
- Promotion thresholds (≥3 evidence rows for raw→capsule, ≥3 reuse-phases for thought→rule). **RECOMMENDED** values match what Phase 51 BENCH-07 will measure (`utility_per_token`); first-pass thresholds are tunable via `routes.yaml` or a lifecycle-config block.
- Whether revalidation is read-pulled (on every `loadIndexSnippets()` call) or write-pushed (background sweep). **RECOMMENDED**: read-pulled. No background process; revalidation happens lazily when an artifact is requested. Aligns with Lock 13 (no autonomous halt) and avoids a new daemon.
- Whether `loadIndexSnippets()` is in `lifecycle.cjs` or a separate file. **RECOMMENDED**: in `lifecycle.cjs` exported as a public API; Phase 45 step 6 calls it directly. Minimal surface.

### Deferred Ideas (OUT OF SCOPE)

- Promoting validated_thoughts back to phase_capsules (downward promotion is meaningless; only demote/revoke moves down).
- Creating a UI for revoke approval (Lock 13: autonomous; revocation is mechanical based on declarative rules).
- Cross-milestone promotion auditing (a separate phase if needed; Phase 49 covers within-milestone + cross-phase only via existing references).
- Cockpit display of memory governance state (Phase 50 OWNS — Phase 49 ships the field shape Phase 50 reads).
- Benchmark scoring of governance utility (Phase 51 BENCH-07/08 OWNS — Phase 49 ships the streams Phase 51 reads).
- Redis hot-cache of lifecycle artifacts (Phase 52 OWNS — Phase 49 ships canonical state; Phase 52 may project for live cockpit only).
- Adding new whitelist entries to Phase 47 VTP_WHITELIST or Phase 48 VTP_TOOL_MAP. Phase 49 is the GATE that the existing entry `research_external_validation` (reserved by Phase 48 for Phase 49) MAY in future activate, but Phase 49 ships without activating it. Activation is its own decision deferred to a later phase.
- Mutating Phase 41-48 source files. Phase 49 only ADDITIVELY extends Phase 43's capsule schema (new optional fields) and READS Phases 41/44/45/46/47/48.
- Inventing a new envelope version. All 4 new canonical streams use envelope-v1 (matches Phase 41/43/44/45/46/47/48).
- Promoting capsules whose `bypass_refs[]` contain entries — Lock 6 says critical bypass is never compressed/promoted. Phase 49 explicitly skips promotion candidates that have non-empty `bypass_refs[]`.

</user_constraints>

---

<phase_requirements>

## Phase Requirements (REQUIREMENTS.md → Research Support)

| ID | Description | Research Support |
|----|-------------|------------------|
| GOV-01 | Context complaint log lifecycle (Phase 45 created the file; Phase 49 owns repair) | §6 (`processComplaints` API), §7 (canonical stream contract; A3+A7) |
| GOV-02 | Memory write admission checks | §3 (`admitMemoryWrite` API), §4 (admission rule table; A4+A5) |
| GOV-03 | Lifecycle fields on capsules + rules | §5 (capsule schema extension; 7 fields; A5) |
| GOV-04 | Promotion/demotion rules | §4.2 (promote thresholds), §4.3 (demote), §4.4 (revoke); A1+A2 |
| GOV-05 | Revocation/deletion protocol | §4.4 (revoke contract + replaced_by chain), §7 (memory-revocations.jsonl) |
| GOV-06 | Intent map promotion gate | §3 (admission requires provenance + confidence + last_validation + revocation_path), §4.5 (intent-map → reusable_rule path) |
| GOV-07 | Bidirectional compression lifecycle | §4 (full lifecycle flow + lock 6 carve-out), §10 self-test fixtures F3..F7 |
| GOV-08 | Privileged state transition contract | §3 (mandatory provenance gate), §11 (read-only invariant), §12 (Lock 13 wrap) |
| LOCK-1..6 | Canonical truth; bypass never compressed | §11 (read-only invariant), §4.4 (bypass-carve-out at promotion gate) |
| LOCK-11 | No semantic-only promotion | §3 (admission rejects when source_refs/root_source_hashes empty regardless of similarity hint) |
| LOCK-13 | Never-throws | §12 (try/catch wrap on all 6 public APIs; sentinel return; warn-not-throw) |

Acceptance bindings (ROADMAP §49, VTP-DELTA §"Phase 49 Delta"):

- A1 (lifecycle promotion path explicit) → §4.2
- A2 (revocation supported + auditable) → §4.4 + §7
- A3 (complaints trigger repair) → §6 + §10 F9
- A4 (admission rejects unproven writes) → §3 + §10 F2
- A5 (memory write = privileged state transition) → §3 + §5 lifecycle fields
- A6 (read-time reconsolidation = write risk) → §4.5 + §10 F8
- A7 (complaint → repair across capsule/packet/thought) → §6

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Memory write admission gate | NEW Phase 49 module (`memory-governance/lifecycle.cjs`) | — | A4/A5 lock — single function `admitMemoryWrite()` is the choke point; mirror Phase 44 `validateOne` precedent |
| Lifecycle field schema | EXTENDS Phase 43 (`phase-capsule/write.cjs::_assertCapsuleSchema`) | NEW Phase 49 (additive + backfill migration) | Phase 43 owns the schema validator; Phase 49 adds 7 optional fields + populates defaults |
| Promotion rules | NEW Phase 49 | — | New decision logic — no prior surface owns this |
| Demotion / revocation | NEW Phase 49 | — | New decision logic + canonical streams (memory-revocations.jsonl etc.) |
| Revalidation (source-hash drift) | NEW Phase 49 | Phase 46 read-side (`query()` returns rows; Phase 49 cross-checks hash) | Read-time check at `loadIndexSnippets()` boundary |
| Complaint repair loop | NEW Phase 49 (`processComplaints`) | Phase 45 (writes complaints), Phase 43 (capsule rebuild target), Phase 45 (packet rebuild trigger) | Phase 49 reads complaints + dispatches repair to capsule/packet/thought owners |
| Phase 45 step 6 wire-in | NEW Phase 49 (`loadIndexSnippets`) | Phase 46 (`query()`) | Step 6 was deferred in Phase 45; Phase 49's wrapper adds revocation/revalidation filter on top of Phase 46 query |
| Lifecycle backfill | NEW Phase 49 (one-shot migration) | Phase 43 (capsule writer + reader) | Reads all 44 existing PHASE-CAPSULE.json + writes lifecycle defaults via Phase 43 atomic write |
| Cockpit display | DEFERRED Phase 50 | reads Phase 49 output | Phase 49 ships field shape; Phase 50 owns rendering |
| Benchmark scoring | DEFERRED Phase 51 | reads Phase 49 streams | BENCH-07/08 read memory-revocations + revalidations as failure-mode signals |
| Hot-cache projection | DEFERRED Phase 52 | reads Phase 49 canonical | Redis adapter only — canonical remains in Phase 49-owned files |

**Tier-correctness check:** Phase 49 sits at the **memory governance kernel** tier. It does NOT span tiers. It does NOT invoke MCP tools (Phase 48's job). It does NOT route dispatches (Phase 47's job). It does NOT score utility (Phase 51's job). The single tier responsibility is "decide what writes get to persist as future SGSD memory."

---

## Standard Stack

### Core (verified in source)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fs` (node built-in) | node 22.x | Atomic writes, complaint reads, capsule reads | Phase 41-48 use only built-ins; no new deps |
| `path` (node built-in) | node 22.x | __dirname-anchored canonical paths | Mirror Phase 43 `REAL_PLANNING_DIR` pattern at `write.cjs:131` |
| `crypto` (node built-in) | node 22.x | sha256 source-hash drift detection (revalidate); content-hash for promotion ledger rows | Mirror Phase 43 `_capsuleContentHash` at `write.cjs:757` |
| `child_process` (node built-in) | node 22.x | git rev-parse for `created_by` token | Mirror Phase 43 `_resolveSelfGitSha` at `write.cjs:837` |

[VERIFIED: source — Phase 43-48 zero external deps; node built-ins only.]

### Supporting (imported BY REFERENCE — defense-in-depth, never redefine)

| Module | Purpose | Verified at |
|--------|---------|-------------|
| `super-gsd/tools/phase-capsule/write.cjs` | `readCapsule()`, `writeCapsule()`, `STATUS_VOCAB`, `BYPASS_KIND_VOCAB`, `_capsuleContentHash` | `write.cjs:1124, 1135, 76, 89, 757` |
| `super-gsd/tools/context-registry/check.cjs` | `validateOne(key, category)`, `loadRegistry()`, `REASONS` | `check.cjs:68, 25, 37` |
| `super-gsd/tools/context-packet/build.cjs` | `_assertValidatedThoughtProvenance()` (mirrored), `COMPRESSION_LEVELS` (re-exported) | `build.cjs:220, 104` |
| `super-gsd/tools/context-cache/query.cjs` | `query(text, opts)` for index snippet retrieval | `query.cjs:128` |
| `super-gsd/tools/dispatch-router/route.cjs` | `UNCERTAINTY_TYPES` (informational; for memory-write classification by uncertainty source) | `route.cjs:77` |
| `super-gsd/tools/vtp-bridge/classify.cjs` | `VTP_TOOL_MAP` (informational; future hook — `research_external_validation` reserved entry waits on Phase 49 governance per `classify.cjs:123`) | `classify.cjs:99-127` |
| `super-gsd/scripts/lib/route-ledger.cjs` | `logRouteDecision()` — pattern reference for envelope-v1 emission (Phase 49 emits its own ledger rows; route-ledger is reference only) | `lib/route-ledger.cjs:211` |

[VERIFIED: file paths + line numbers via grep on actual sources.]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single `lifecycle.cjs` module | 6 files: `admit.cjs`, `promote.cjs`, `demote.cjs`, `revoke.cjs`, `revalidate.cjs`, `complain.cjs` | Six-file split would diverge from Phase 41-48 precedent (`phase-capsule/write.cjs`, `context-registry/check.cjs`, `dispatch-router/route.cjs`, `vtp-bridge/classify.cjs` are all single modules). Cross-imports between sub-files would also re-introduce circular-dep risk that single-module avoids. **REJECTED.** |
| Lifecycle fields stored in NEW JSON (e.g. `lifecycle.jsonl` keyed by capsule_id) | Lifecycle fields on existing PHASE-CAPSULE.json | Separate file would split a single artifact's state across two files — drift risk. Keeping fields on the capsule itself preserves "1 phase = 1 capsule = 1 state record" simplicity. **REJECTED.** |
| Background daemon for revalidation | Lazy on-read revalidation in `loadIndexSnippets()` | Daemon adds an autonomous process — Lock 13 forbids "silent" failure modes. Lazy revalidation surfaces drift exactly when it matters (at consumption). **REJECTED.** |
| Ajv JSON schema validation | Manual `_assertSchema` mirroring Phase 43 `_assertCapsuleSchema` | Adding ajv dep diverges from "node built-ins only" rule established by Phase 41-48. Manual validation is < 80 LOC. **REJECTED.** |
| Promotion uses semantic similarity score | Promotion uses ≥N evidence rows (structural predicate) | LOCK 11 forbids semantic-only routing. Counting evidence rows is structural — auditable + deterministic. **CHOSEN.** |
| Revocation hard-deletes the capsule | Revocation marks `revoked_at + revoked_reason` and lifecycle field is read by all consumers | Hard-delete violates LOCK 2 (canonical truth). Tombstone preserves audit trail and lets Phase 51 BENCH-08 detect "should-have-been-demoted" failures. **CHOSEN.** |

**Installation:** none. Node built-ins only. No new package.json entries.

**Version verification:** N/A. No external packages added.

---

## Architecture Patterns

### System Architecture Diagram (data flow)

```
                                     ╔═══════════════════════════════════╗
                                     ║   PHASE 49 MEMORY GOVERNANCE      ║
                                     ║   lifecycle.cjs (single module)   ║
                                     ╚═══════════════════════════════════╝
                                                     │
        ┌────────────────────┬──────────────────────┼──────────────────┬─────────────────────┐
        │                    │                      │                  │                     │
   admitMemoryWrite      promote                 demote/revoke      revalidate          processComplaints
  (privileged gate)   (raw_evidence →           (downward         (read-time          (complaints → repair)
        │              phase_capsule →           lifecycle)       hash drift                │
        │              validated_thought →           │            detection)                │
        │              reusable_rule)                │                  │                   │
        ▼                    ▼                       ▼                  ▼                   ▼
  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
  │ INPUT shape: │   │ Reads:           │   │ Reads:           │ │ Reads:           │ │ Reads:           │
  │ artifact +   │   │   Phase 43       │   │   Phase 43       │ │   Phase 46       │ │   Phase 45       │
  │ source_refs+ │   │   readCapsule    │   │   readCapsule    │ │   query() rows   │ │   complaints     │
  │ root_hashes+ │   │ Writes:          │   │ Writes:          │ │ Re-hashes        │ │ Dispatches:      │
  │ confidence+  │   │   memory-        │   │   memory-        │ │ source files +   │ │ - Phase 43 capsule│
  │ allowed_     │   │   promotions     │   │   demotions /    │ │ marks revalidn   │ │   rebuild        │
  │ consumers+   │   │   .jsonl         │   │   revocations    │ │ Writes:          │ │ - Phase 45 packet │
  │ revocation_  │   │   PHASE-CAPSULE  │   │   .jsonl         │ │   memory-        │ │   re-emit        │
  │ path         │   │   .json (edit    │   │   PHASE-CAPSULE  │ │   revalidations  │ │ - Phase 49 thought│
  │              │   │   compression_   │   │   .json (edit    │ │   .jsonl         │ │   demote          │
  │              │   │   level + ts)    │   │   revoked_at)    │ │                  │ │                  │
  └──────┬───────┘   └────────┬─────────┘   └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                       │                    │                    │
         │ {ok|reject}        │ {new_id, ledger}      │ {ledger_row}       │ {drift?, ledger}   │ {repaired_n}
         ▼                    ▼                       ▼                    ▼                    ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
  │                          loadIndexSnippets(query, opts)  [Phase 45 step-6 wire-in]            │
  │                                                                                                │
  │   query → Phase 46 query()  →  filter rows where revoked_at != null  →  flag revalidation_due │
  │   →  Phase 45 step 6 consumes filtered+flagged rows  →  packet body                            │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     ▲
                                                     │ (called from Phase 45 build.cjs:703 line)
                                                     │
                       ┌──────────────────────────┐  │
                       │ Phase 45 step 6 (today    │  │
                       │ "indexSnippets = []" stub │  │  PHASE 49 OWNS THE WIRE-IN
                       │ at build.cjs:703 — Phase  │──┘  (Phase 49 lifecycle.cjs Task ~3)
                       │ 49 replaces with await    │
                       │ loadIndexSnippets()       │
                       └──────────────────────────┘

CANONICAL STREAMS PHASE 49 OWNS (4 NEW envelope-v1):
  .planning/metrics/memory-promotions.jsonl
  .planning/metrics/memory-demotions.jsonl
  .planning/metrics/memory-revocations.jsonl
  .planning/metrics/memory-revalidations.jsonl

CANONICAL FILES PHASE 49 EDITS (additive lifecycle fields):
  .planning/milestones/v1.6/phases/{26..30}/PHASE-CAPSULE.json   (5 capsules)
  .planning/milestones/v1.7/phases/{31..35}/PHASE-CAPSULE.json   (5 capsules)
  .planning/milestones/v1.8/phases/{36..40}/PHASE-CAPSULE.json   (5 capsules)
  .planning/milestones/v1.9/phases/{41..52}/PHASE-CAPSULE.json   (12 — currently 12 exist)
  + earlier milestones (v1.1..v1.5) — total 44 capsules verified via find.

CANONICAL STREAMS PHASE 49 IS READ-ONLY ON (9 streams + Phase 41-48 sources + canonical phase-folder content):
  agent-token-spend.jsonl  token-attribution.jsonl  codex-log.jsonl
  activity-log.jsonl       token-log.jsonl          token-waste-status.jsonl
  crit-backlog.jsonl       route-decisions.jsonl    vtp-bridge-failures.jsonl
  + Phase 41-48 *.cjs source files
  + CONTEXT.md / RESEARCH.md / *PLAN.md / VERIFICATION.md / ATC-REVIEW.md / reviews/*-REVIEW.md
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| `admitMemoryWrite` | `lifecycle.cjs` | Single admission gate. Rejects when source_refs/root_source_hashes empty, confidence missing, allowed_consumers missing, revocation_path missing, OR artifact has bypass_refs[] non-empty (Lock 6 carve-out: critical bypass NEVER admitted to compression-up path). |
| `promote` | `lifecycle.cjs` | Move artifact up one compression level. Threshold table: raw→capsule needs ≥3 evidence rows (Phase 43 will already have built the capsule; promote here is for capsule→thought and beyond). capsule→thought needs `_assertValidatedThoughtProvenance` PASS + non-empty `used_for`. thought→rule needs ≥3 distinct phases citing the thought. |
| `demote` | `lifecycle.cjs` | Move artifact down one compression level. Reasons enum: `abstraction_failed`, `source_drifted`, `complaint_threshold_exceeded`, `superseded_by_new_evidence`. |
| `revoke` | `lifecycle.cjs` | Tombstone an artifact. Sets `revoked_at` + `revoked_reason` + optional `replaced_by_id`. Reasons enum: `stale`, `poisoned`, `contradicted`, `source_lost`, `superseded_by_revoked_chain`. |
| `revalidate` | `lifecycle.cjs` | Re-hash declared `root_source_hashes[]` against current canonical files. If drift, mark `revalidation_due=true` + emit row. Never auto-revokes (Lock 13). |
| `processComplaints` | `lifecycle.cjs` | Reads `context-complaints.jsonl` since `since_ts`. Per row: classify reason (broad_raw_fallback, validated_thought_missing_provenance, packet_built_with_omitted_material, packet_invalid_references_filtered, etc.) → dispatch repair (capsule rebuild via Phase 43, packet re-emit via Phase 45, thought demote via Phase 49 demote). |
| `loadIndexSnippets` | `lifecycle.cjs` | Phase 45 step-6 wire-in. Calls Phase 46 `query(text, opts)` → filters out rows where capsule has `revoked_at != null` → annotates rows with `revalidation_due` flag → returns array. Phase 45 build.cjs reads this array at step 6 (replacing today's empty-stub `indexSnippets = []`). |
| Lifecycle backfill (one-shot) | `lifecycle.cjs::backfillLifecycleFields()` | Reads all 44 existing PHASE-CAPSULE.json. Adds default lifecycle fields (compression_level=phase_capsule, promoted_at=existing created_at, allowed_consumers=['*'], revocation_path='super-gsd/tools/memory-governance/lifecycle.cjs#revoke'). Idempotent: skips files already containing lifecycle fields. |

### Pattern 1: Privileged-State-Transition Gate

**What:** Every memory-write call routes through a single function `admitMemoryWrite()` that mechanically validates 6 mandatory fields before allowing the write.

**When to use:** ALL durable writes that produce artifacts intended for future SGSD memory consumption (capsules, validated_thoughts, reusable_rules, guardrails). Does NOT gate raw-evidence writes (those are append-only logs and the source of all promotions).

**Example:**

```javascript
// Source: pattern mirrors super-gsd/tools/context-packet/build.cjs:220-234
function admitMemoryWrite(artifact) {
  try {
    if (!artifact || typeof artifact !== 'object') {
      return { ok: false, reason: 'memory_admission_artifact_missing' };
    }
    // Mandatory provenance (mirrors Phase 45 _assertValidatedThoughtProvenance).
    const hasSourceRefs = Array.isArray(artifact.source_refs) && artifact.source_refs.length > 0;
    const hasRootHashes = Array.isArray(artifact.root_source_hashes) && artifact.root_source_hashes.length > 0;
    if (!hasSourceRefs || !hasRootHashes) {
      return { ok: false, reason: 'memory_admission_provenance_missing' };
    }
    // Mandatory confidence vocab.
    if (CONFIDENCE_VOCAB.indexOf(artifact.confidence) === -1) {
      return { ok: false, reason: 'memory_admission_confidence_invalid' };
    }
    // Mandatory consumer scope.
    if (!Array.isArray(artifact.allowed_consumers) || artifact.allowed_consumers.length === 0) {
      return { ok: false, reason: 'memory_admission_consumers_missing' };
    }
    // Mandatory revocation path.
    if (typeof artifact.revocation_path !== 'string' || !artifact.revocation_path) {
      return { ok: false, reason: 'memory_admission_revocation_path_missing' };
    }
    // Mandatory compression level (closed enum).
    if (COMPRESSION_LEVELS.indexOf(artifact.compression_level) === -1) {
      return { ok: false, reason: 'memory_admission_compression_level_invalid' };
    }
    // Lock 6 carve-out: bypass refs are NEVER admitted to up-promotion path.
    if (Array.isArray(artifact.bypass_refs) && artifact.bypass_refs.length > 0
        && artifact.compression_level !== 'phase_capsule') {
      return { ok: false, reason: 'memory_admission_bypass_refs_block_promotion' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'memory_admission_internal_error' };
  }
}
```

### Pattern 2: Tombstone Revocation

**What:** Revoking an artifact NEVER deletes it. It writes `revoked_at` (ISO timestamp), `revoked_reason` (closed enum), and optional `replaced_by_id` (target artifact's content_hash).

**When to use:** When an artifact is stale, poisoned, contradicted, or its source files have been deleted.

**Example:**

```javascript
function revoke(artifact_id, reason, replaced_by_id) {
  try {
    if (!artifact_id || REVOKE_REASONS.indexOf(reason) === -1) {
      return { ok: false, reason: 'revoke_input_invalid' };
    }
    // Resolve artifact: capsule lookup via Phase 43 readCapsule using id parsing.
    const cap = _resolveCapsule(artifact_id);
    if (!cap) return { ok: false, reason: 'revoke_artifact_not_found' };
    // Edit lifecycle fields on the existing PHASE-CAPSULE.json (Lock 2: canonical preserved).
    cap.revoked_at = new Date().toISOString();
    cap.revoked_reason = reason;
    if (replaced_by_id) cap.superseded_by_id = replaced_by_id;
    // Atomic re-write via Phase 43 writeCapsule (which uses tmp+rename).
    const wr = phase43.writeCapsule(planningDir, { ... });
    // Append revocation ledger row.
    _appendRow(MEMORY_REVOCATIONS_PATH, {
      envelope_version: 1,
      ts: cap.revoked_at,
      command: 'memoryRevoke',
      status: 'ok',
      artifact_id: artifact_id,
      reason_codes: [reason],
      replaced_by_id: replaced_by_id || null,
      details: { compression_level: cap.compression_level },
    });
    return { ok: true, ledger_row: ... };
  } catch (e) { return { ok: false, reason: 'revoke_internal_error' }; }
}
```

### Pattern 3: Read-Time Reconsolidation Detection

**What:** Every consumer that reads a memory artifact via `loadIndexSnippets()` triggers a hash-drift check. If `root_source_hashes[]` no longer matches the current canonical file's sha256, the artifact is flagged `revalidation_due=true`.

**When to use:** Any read path that pulls from Phase 46 SQLite or directly from PHASE-CAPSULE.json.

**Example:**

```javascript
function _checkSourceHashDrift(artifact, planningDir) {
  try {
    if (!artifact.root_source_hashes || !artifact.source_refs) return false;
    let drift = false;
    for (let i = 0; i < artifact.source_refs.length; i++) {
      const srcPath = path.join(planningDir, '..', artifact.source_refs[i]);
      if (!fs.existsSync(srcPath)) { drift = true; break; }
      const buf = fs.readFileSync(srcPath);
      const currentHash = crypto.createHash('sha256').update(buf).digest('hex');
      if (artifact.root_source_hashes[i] !== currentHash) { drift = true; break; }
    }
    if (drift) {
      _appendRow(MEMORY_REVALIDATIONS_PATH, {
        envelope_version: 1,
        ts: new Date().toISOString(),
        command: 'memoryRevalidate',
        status: 'warn',
        artifact_id: artifact.id || artifact.content_hash || null,
        reason_codes: ['source_hash_drift'],
        details: { source_refs: artifact.source_refs.slice(0, 5) },
      });
    }
    return drift;
  } catch (_e) { return false; }
}
```

### Pattern 4: Complaint-Driven Repair Loop

**What:** `processComplaints({since_ts})` reads `context-complaints.jsonl`, classifies each row by `reason_codes[]`, and dispatches a deterministic repair action. NEVER prompts a user. NEVER halts. Always returns `{repairs_attempted, repairs_succeeded, ledger_rows}`.

**When to use:** Triggered at phase close by orchestrator OR explicitly via CLI `--process-complaints --since=<ts>`.

**Example mapping:**

| Complaint reason_code | Repair action |
|------------------------|---------------|
| `broad_raw_fallback` | Trigger Phase 45 packet rebuild for the named intent_id |
| `validated_thought_missing_provenance` | Demote the named thought to `phase_capsule` (or revoke if no fallback exists) |
| `packet_capsule_unavailable_raw_fallback` | Trigger Phase 43 capsule write for the named (milestone, phase) |
| `packet_invalid_references_filtered` | Append note to memory-demotions.jsonl; log "registry stale" if Phase 44 stale_warning is set |
| `phase_capsule_backfill_milestone_missing` | Skip — informational only (existing Phase 43 complaint reason) |
| `phase_capsule_backfill_index_unreadable` | Skip — informational; Phase 43 already self-recovered |

### Anti-Patterns to Avoid

- **Hard-deleting a revoked artifact:** Violates Lock 2 (canonical truth). Always tombstone via `revoked_at`. Past revocations are evidence Phase 51 BENCH-08 reads.
- **Promoting based on similarity score:** Violates Lock 11. Promotion thresholds are STRUCTURAL (≥N evidence rows, ≥N reuse phases) — not embedding cosine.
- **Skipping the admission gate for "trusted" callers:** Defeats the purpose of A4. Every memory-write goes through `admitMemoryWrite()`. No exceptions. No "internal" bypass.
- **Compressing a bypass_refs[] artifact:** Violates Lock 6. Critical bypass records (CRIT, stack trace, verifier_fail, etc.) are NEVER promoted up. Phase 49 admission gate explicitly blocks this.
- **Auto-revoking on revalidation drift:** Violates Lock 13 ("autonomy continues"). Revalidation only FLAGS drift; revocation requires a separate explicit `revoke()` call (which `processComplaints` may dispatch).
- **Reading `context-complaints.jsonl` for repairs in real-time during agent dispatch:** Hot-path read of the complaint log creates lock contention. Run `processComplaints` at phase close OR explicit CLI invocation, not during every `buildPacket()` call.
- **Writing lifecycle fields outside Phase 43 capsule writer:** Drift risk between Phase 43 and Phase 49 schema. Phase 49 ALWAYS routes lifecycle field writes through Phase 43 `writeCapsule()` — additive fields land in the same atomic write.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation for new ledger rows | Ajv or any external validator | Manual `_assertSchema` mirroring Phase 43 `_assertCapsuleSchema` at `write.cjs:851` | Phase 41-48 zero external deps; consistency >> abstract correctness |
| Atomic JSONL append | Custom file lock, `flock()`, write-ahead log | `fs.appendFileSync(p, JSON.stringify(row)+'\n', 'utf8')` mirroring Phase 45 `_appendRow` at `build.cjs:181` | POSIX append is atomic for < PIPE_BUF (4096 bytes); envelope rows are << 4096 |
| Atomic JSON file rewrite (capsule lifecycle field edit) | Direct `fs.writeFileSync` | `fs.writeFileSync(tmp, ...) + fs.renameSync(tmp, target)` mirroring Phase 43 `_writeCapsuleInternal` at `write.cjs:1010` | tmp+rename is atomic on POSIX + Windows NTFS; survives crash mid-write |
| Source-hash drift check | Walking AST or computing structural diff | sha256 of entire file mirroring Phase 43 `_sha256OfBytes` at `write.cjs:171` | Source files are small (< 50 KiB typical); whole-file hash is < 1 ms |
| Capsule reader/writer | Direct JSON.parse/stringify | Phase 43 `readCapsule()` + `writeCapsule()` imported BY REFERENCE | Schema validation + atomic write + content_hash already encapsulated in Phase 43; reuse is mandatory |
| Legal-key validator for promotion source_refs | Re-implementing pattern matching | Phase 44 `validateOne(key, 'phases')` imported BY REFERENCE | Phase 44 owns the legal-keys.json; reuse avoids drift |
| Validated-thought provenance gate | New copy in Phase 49 | Phase 45 `_assertValidatedThoughtProvenance` IS THE EXISTING gate; Phase 49 calls it via require | Single source of truth for provenance rules |
| Index query | Re-implementing FTS read | Phase 46 `query()` imported BY REFERENCE | Phase 46 owns the SQLite + per-row registry filter |
| Envelope-v1 row shape | Custom shape | Mirror existing complaint envelope at `build.cjs:273-287` | All v1.9 streams use envelope-v1; consistency for Phase 50 cockpit reader |
| ISO timestamp | Custom formatting | `new Date().toISOString()` mirroring Phase 43 + 45 + 47 + 48 | Already canonical across v1.9 |

**Key insight:** Phase 49 is < 1000 LOC because every primitive it needs already exists in Phases 41-48. The only NEW logic is the 6-API decision flow + 4 NEW canonical streams + lifecycle backfill. Everything else is reuse.

---

## Runtime State Inventory

(rename/refactor not relevant for Phase 49 — code-only addition. Section omitted per research protocol.)

---

## Common Pitfalls

### Pitfall 1: Phase 43 Schema Drift on Additive Lifecycle Fields

**What goes wrong:** Phase 49 adds 7 lifecycle fields to PHASE-CAPSULE.json, but Phase 43 `_assertCapsuleSchema` rejects unknown top-level keys (`additionalProperties: false` in `PHASE-CAPSULE.schema.json:7`).

**Why it happens:** Phase 43 schema is closed-shape. Any field Phase 49 adds without updating Phase 43's `allowed = new Set(Object.keys(schema.properties))` at `write.cjs:861` will be rejected at write time.

**How to avoid:** Phase 49 plan must include a Task that ALSO edits `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` to add lifecycle fields as `oneOf [{type: ...}, {type: 'null'}]` (matches existing optional-field pattern for `token_cost`). And updates `_assertCapsuleSchema` to validate the new fields. This is a Phase 43 source EDIT — but additive only (no existing field semantics changed). The capsule writer change is pre-condition for the lifecycle backfill task.

**Warning signs:** Backfill task fails with `phase-capsule schema invalid: unknown top-level field "compression_level"`.

### Pitfall 2: Idempotency on Lifecycle Backfill

**What goes wrong:** Re-running the lifecycle backfill overwrites `promoted_at` (an immutable timestamp) with a new now-timestamp, drifting from "this was already promoted at T0".

**Why it happens:** Naive backfill writes default values unconditionally.

**How to avoid:** Backfill checks `if (cap.promoted_at != null) skip` per field. Only fields whose current value is `null` get defaults. Phase 49 `backfillLifecycleFields()` is idempotent: 1st run sets defaults, 2nd run is a no-op. Self-test fixture F10 binds this regression.

**Warning signs:** Diffing PHASE-CAPSULE.json across two backfill runs shows `promoted_at` changed — backfill is non-idempotent.

### Pitfall 3: Stale Source-Hash on Capsule Rebuild

**What goes wrong:** Phase 43 rebuilds a capsule (e.g. on phase re-verify), recomputing `source_hashes.context.sha256`. Phase 49's `root_source_hashes[]` (stored on a downstream validated_thought that referenced this capsule) is now stale → `revalidate()` flags drift on the next read → packet builder sees `revalidation_due=true` and may elide.

**Why it happens:** validated_thoughts persist across capsule rebuilds. They reference the OLD source_hash.

**How to avoid:** This is **expected behavior**, not a bug. The drift flag is the audit signal. Phase 49 NEVER auto-revokes — it surfaces the drift. The orchestrator (or `processComplaints`) decides whether to demote, revoke, or simply re-promote with the new hash. The audit trail (memory-revalidations.jsonl) records every drift event for Phase 51 BENCH-08.

**Warning signs:** revalidation rate spikes after a Phase 43 backfill — expected; cross-check that the spike correlates with the rebuild commit.

### Pitfall 4: Concurrent JSONL Append from Two Phase 49 CLI Invocations

**What goes wrong:** Two `lifecycle.cjs --revoke <id>` processes append simultaneously to memory-revocations.jsonl; one row gets clobbered or partially written.

**Why it happens:** `fs.appendFileSync` is atomic only for < PIPE_BUF (4096 bytes) AND only on POSIX. Windows NTFS has different atomicity guarantees.

**How to avoid:** All envelope-v1 rows are <<4096 bytes (typical row is ~400 bytes including timestamps + reason codes + a few details). Real risk is an enormous `details:` payload. Mitigation: `JSON.stringify(row)` MUST be < 4000 bytes; truncate `details` if larger. Phase 45 already follows this implicit rule (no row exceeds ~600 bytes in observed corpus). Phase 49 does the same.

**Warning signs:** Manual inspection of memory-revocations.jsonl shows malformed JSON lines — indicates concurrent writes truncated each other.

### Pitfall 5: Promoting a Capsule That Has Open Critical Debt

**What goes wrong:** Phase capsule has `debt.critical_added > 0` but `revoked_at == null`. Phase 49 `promote(capsule → validated_thought)` succeeds because the bypass_refs[] check only blocks IF refs exist. But promoting an "unfinished" capsule poisons downstream consumers.

**Why it happens:** The current admission gate checks `bypass_refs[]` (Lock 6) but not `debt.critical_added`. Critical debt isn't always logged as a bypass_ref.

**How to avoid:** Admission gate adds an extra rule: `if (artifact.debt && artifact.debt.critical_added > 0 && artifact.compression_level === 'phase_capsule' && to_level === 'validated_thought') reject`. Self-test fixture F2b binds this.

**Warning signs:** A validated_thought references a capsule whose `debt.carried_forward_total > 0` — promote should have rejected.

### Pitfall 6: Complaint Processing Loops on Self-Generated Repairs

**What goes wrong:** `processComplaints` triggers a Phase 45 packet rebuild → Phase 45 emits a fresh `broad_raw_fallback` complaint → next `processComplaints` run picks up that complaint → triggers another rebuild → infinite loop.

**Why it happens:** Repair actions can themselves emit complaints.

**How to avoid:** `processComplaints({since_ts})` ONLY processes complaints whose `ts > since_ts`. The CLI invocation passes `since_ts` from the prior invocation's max-ts (stored in `.planning/metrics/memory-process-cursor.json`). After a repair runs, its emitted complaints have `ts > since_ts` and are picked up only on the NEXT scheduled invocation. Plus: max repairs per invocation is capped at 50 (defensive bound). Self-test fixture F9 binds this with a synthesized loop scenario.

**Warning signs:** `processComplaints` returns `repairs_attempted >> 50` — bound was breached or cursor wasn't advancing.

### Pitfall 7: Read-Only Invariant Drift During Self-Test

**What goes wrong:** Self-test runs lifecycle ops in tmpdir but accidentally writes to the real `.planning/metrics/`.

**Why it happens:** Default planningDir resolves to `process.cwd()/.planning`; if cwd is the repo root, real streams get touched.

**How to avoid:** Mirror Phase 43 + 45 pattern: capture canonical fingerprints BEFORE self-test (mtime+size of all 9 read-only streams + Phase 41-48 source files), run all fixtures in tmpdir via `os.tmpdir()`, capture fingerprints AFTER, assert no drift. Phase 49 self-test asserts the read-only invariant on 30+ files. F10 fixture binds this.

**Warning signs:** Self-test exit 0 but `git diff .planning/metrics/` shows changes after test run.

---

## Code Examples

Verified patterns from official sources:

### Closed-Enum Compression Levels (re-export Phase 45 frozen const)

```javascript
// Source: super-gsd/tools/context-packet/build.cjs:104-110
const COMPRESSION_LEVELS = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
]);
// Phase 49 imports BY REFERENCE — never redefines.
const phase45 = require('../context-packet/build.cjs');
const COMPRESSION_LEVELS = phase45.COMPRESSION_LEVELS;
```

### Closed-Enum Lifecycle Reasons

```javascript
// New in Phase 49 — mirror Phase 47 ROUTE_DECISION_REASONS pattern
// (route.cjs:103-129 Object.freeze 18-entry closed enum)
const PROMOTION_REASONS = Object.freeze([
  'evidence_threshold_met',
  'reuse_threshold_met',
  'manual_promote_with_provenance',
]);
const DEMOTION_REASONS = Object.freeze([
  'abstraction_failed',
  'source_drifted',
  'complaint_threshold_exceeded',
  'superseded_by_new_evidence',
]);
const REVOKE_REASONS = Object.freeze([
  'stale',
  'poisoned',
  'contradicted',
  'source_lost',
  'superseded_by_revoked_chain',
]);
const CONFIDENCE_VOCAB = Object.freeze(['low', 'medium', 'high']);
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
```

### Atomic Capsule Lifecycle Field Edit

```javascript
// Source pattern: super-gsd/tools/phase-capsule/write.cjs:1010 _writeCapsuleInternal
// Phase 49 edits via Phase 43 writeCapsule; never bypasses.
function _editCapsuleLifecycleFields(milestone, phase, edits, planningDir) {
  try {
    const cap = phase43.readCapsule(planningDir, milestone, phase);
    if (!cap) return { ok: false, reason: 'capsule_not_found' };
    // Apply lifecycle field edits.
    for (const k of Object.keys(edits)) {
      cap[k] = edits[k];
    }
    // Phase 43 writeCapsule re-validates schema (with extended properties)
    // and atomically rewrites via tmp+rename.
    const phaseDir = path.dirname(phase43.capsulePath(planningDir, milestone, phase));
    const wr = phase43.writeCapsule(planningDir, {
      milestone: milestone,
      phase: phase,
      phaseDir: phaseDir,
      // Existing capsule data is re-extracted from canonical sources by writeCapsule;
      // lifecycle fields persist because they're stored on the capsule between writes.
    });
    return wr;
  } catch (_e) {
    return { ok: false, reason: 'capsule_edit_internal_error' };
  }
}
```

### Phase 45 Step-6 Wire-In

```javascript
// PHASE 45 BEFORE (current source: super-gsd/tools/context-packet/build.cjs:702-703):
//   // Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct).
//   const indexSnippets = []; // No-op fallback; explicit empty.

// PHASE 45 AFTER (Phase 49 wire-in — additive edit):
//   // Step 6: local index snippets via Phase 49 governance-filtered Phase 46 query.
//   let indexSnippets = [];
//   try {
//     const phase49 = require('../memory-governance/lifecycle.cjs');
//     if (phase49 && typeof phase49.loadIndexSnippets === 'function') {
//       indexSnippets = phase49.loadIndexSnippets(intent_map.intent || '', {
//         planningDir: _planningDir(opts),
//         milestone: milestone,
//         phase: phase,
//         limit: 5,
//         strict_revalidation: false, // surface drift but don't elide
//       });
//     }
//   } catch (_e) { indexSnippets = []; } // Lock 13: never throw on missing wire.

// Phase 49 loadIndexSnippets implementation:
function loadIndexSnippets(query, opts) {
  try {
    if (!phase46 || typeof phase46.query !== 'function') return [];
    const rows = phase46.query(query, {
      milestone: opts.milestone,
      phase: opts.phase,
      limit: opts.limit || 5,
      kinds: ['capsule', 'decision', 'gate_definition', 'file_summary'],
      filter_invalid: true, // already filters Phase 44 invalid
    });
    const out = [];
    for (const r of rows) {
      // Filter revoked artifacts.
      if (r.kind === 'capsule') {
        const cap = phase43.readCapsule(opts.planningDir, r.milestone, r.phase);
        if (cap && cap.revoked_at != null) continue;
        // Annotate with revalidation_due if drift detected.
        if (cap) {
          const drift = _checkSourceHashDrift(cap, opts.planningDir);
          r.revalidation_due = drift;
        }
      }
      if (opts.strict_revalidation && r.revalidation_due) continue;
      out.push(r);
    }
    return out;
  } catch (_e) { return []; }
}
```

### Phase 43 Schema Extension (additive)

```javascript
// Source: super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
// Phase 49 ADDS (additive — no existing field changed):
{
  "properties": {
    // ... existing 17 fields preserved verbatim ...
    "compression_level": {
      "oneOf": [
        { "type": "string", "enum": ["raw_evidence", "phase_capsule", "validated_thought", "reusable_rule", "guardrail"] },
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
}
// `required` array is UNCHANGED — lifecycle fields are optional. Existing 44
// capsules remain valid until backfill populates them.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Memory" stored as raw chat transcripts in ByteRover-style stores | Compression-level lifecycle (raw → capsule → thought → rule → guardrail) with mandatory provenance | VTP delta 2026-04-27 | Phase 49 implements; raw-text memory becomes append-only evidence; promoted artifacts MUST carry provenance |
| Background sweep for stale memory | Read-time reconsolidation (revalidate-on-read) | This phase | Lock 13 compliant; no autonomous halt; drift surfaces at consumption point |
| Hard-delete on revocation | Tombstone (`revoked_at` + `revoked_reason`) | This phase | Audit trail preserved for Phase 51 BENCH-08 |
| Promotion based on heuristic similarity | Promotion based on structural threshold (≥N evidence rows; ≥N reuse phases) | This phase, anchored in Lock 11 | Deterministic; auditable; no embedding/cosine in admission |
| Single global memory pool | Per-artifact `allowed_consumers[]` (RBAC-style consumer scope) | This phase, GOV-03 | Future: cockpit may project only `allowed_consumers: ['cockpit', '*']` artifacts; planner sees `['planner', '*']`; etc. v1.9 ships with default `['*']` to retain current behavior |

**Deprecated/outdated:**

- "Just summarize the prior phase into context" — replaced by Phase 43 capsule + Phase 49 governance.
- "Trust whatever the agent emitted as a summary" — replaced by `admitMemoryWrite()` provenance gate.
- ByteRover ambient memory (referenced in CLAUDE.md but operationally retired in v1.9). Phase 49 is the SGSD-native replacement.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 44 existing capsules need backfill | §"Lifecycle Backfill" | Backfill scope mis-sized — `find /c/Users/user/GSDedits/.planning/milestones -name PHASE-CAPSULE.json | wc -l` returned 44, but new captures since research time may shift this number ±1-2. **MITIGATION:** Backfill task uses dynamic discovery (`fs.readdirSync` walk); doesn't hardcode count. [VERIFIED: bash count=44 at research time] |
| A2 | Promotion threshold "≥3 evidence rows" for raw→capsule | §4.2 | Phase 51 BENCH-07 may reveal this threshold either too loose (poisoned thoughts pass) or too tight (legitimate reuse blocked). **MITIGATION:** Threshold is config-driven via lifecycle-config block; tunable without code change. [ASSUMED] |
| A3 | Promotion threshold "≥3 distinct phases of reuse" for thought→rule | §4.2 | Same as A2. **MITIGATION:** Same. [ASSUMED] |
| A4 | Repair-loop max 50 per invocation prevents infinite loops | §6 + Pitfall 6 | A pathological complaint stream could still saturate. **MITIGATION:** `since_ts` cursor advances monotonically; even at 50 per call, eventual progress is guaranteed. [ASSUMED] |
| A5 | Phase 43 schema extension via additive optional fields will not break existing F1-F4 self-test fixtures | §"Phase 43 Schema Extension" | Plan includes a sub-task that re-runs Phase 43 self-test after schema edit to verify no regression. [VERIFIED: Phase 43 schema uses `additionalProperties: false` so unknown fields rejected; adding optional fields requires explicit schema entry — explicitly addressed in §11 + §10 F1] |

**Empty assumptions on declared LOCKED facts:** Phase 41-48 source signatures (function names, exports, file paths, line numbers) are all VERIFIED via direct file read at research time, not assumed. Capsule schema fields, COMPRESSION_LEVELS const, _assertValidatedThoughtProvenance signature — all read from source.

---

## Open Questions

1. **Should `admitMemoryWrite` reject artifacts whose `source_refs[]` reference revoked artifacts?**
   - What we know: a thought built atop a revoked capsule is structurally unsound.
   - What's unclear: whether to reject at admission OR allow + flag (mirrors revalidation_due).
   - Recommendation: REJECT at admission — `memory_admission_source_revoked`. New thoughts shouldn't be created from revoked sources. Existing thoughts predate the revocation and revalidate-on-read flags them. Self-test fixture F2c.

2. **What happens when `processComplaints` encounters a `validated_thought_missing_provenance` complaint but the named thought doesn't exist (already revoked)?**
   - What we know: this is a race — Phase 45 logged the complaint, Phase 49 revoked between log and process.
   - What's unclear: whether to log a "noop_already_revoked" status row.
   - Recommendation: log a single noop row to memory-demotions.jsonl with reason `noop_already_revoked`, status `ok`. Avoids silent skip; minimal log noise. Self-test fixture F9b.

3. **Should lifecycle-field backfill also touch capsules in `.planning/archive/superseded/`?**
   - What we know: the v1.9 capsule writer's `backfillFromCanonical(--all)` may walk `archive/`. Phase 43's `writeAllCapsulesForMilestone` is keyed off `milestones/` directory, not `archive/`.
   - What's unclear: whether superseded capsules count toward governance.
   - Recommendation: NO — superseded capsules are tombstoned at the directory level. Lifecycle backfill skips `archive/`. The 44-capsule count excludes archive. [VERIFIED: bash find skipped `archive/` because the walker is `.planning/milestones/v*/phases/`]

4. **Should `revoke()` cascade to dependent thoughts?**
   - What we know: a thought references a revoked capsule via `source_refs[]`. Cascading auto-revoke is one option.
   - What's unclear: whether cascade is auto OR via `processComplaints` repair.
   - Recommendation: NOT auto-cascade. Revocation is mechanical-but-explicit. The dependent thought enters revalidation_due state on next read; `processComplaints` may classify and demote/revoke as separate decisions. Aligns with Lock 13 + Tombstone Pattern.

5. **Where do `reusable_rule` and `guardrail` artifacts physically live?**
   - What we know: capsules live in `PHASE-CAPSULE.json` per phase. Validated thoughts live in `.planning/cache/validated-thoughts/*.json` (Phase 45 build.cjs:520).
   - What's unclear: do reusable_rules and guardrails get their own directory?
   - Recommendation: YES — `.planning/cache/reusable-rules/*.json` and `.planning/cache/guardrails/*.json`. Mirror the Phase 45 pattern. Phase 49 creates the directories on first promote. Note: `.planning/cache/` is gitignored per Phase 46 INDEX-04. **For canonical persistence, also append a row to memory-promotions.jsonl that records the artifact id + content_hash + creation_ts; that ledger is git-tracked.** This way the canonical record (the ledger row) survives a `cache/` flush and the file in `cache/` is rebuildable from the row. Mirror of Phase 46 SQLite "rebuild from canonical" pattern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node 22.x built-ins (fs, path, crypto, child_process) | All Phase 49 code | ✓ | 22.x | — |
| `super-gsd/tools/phase-capsule/write.cjs` | Capsule read/write | ✓ | Phase 43 closed | — |
| `super-gsd/tools/context-registry/check.cjs` | Legal-key validation | ✓ | Phase 44 closed | — |
| `super-gsd/tools/context-packet/build.cjs` | `_assertValidatedThoughtProvenance` + `COMPRESSION_LEVELS` | ✓ | Phase 45 closed | — |
| `super-gsd/tools/context-cache/query.cjs` | Index snippet retrieval | ✓ | Phase 46 closed | If `better-sqlite3` missing, query returns []; loadIndexSnippets returns [] (Lock 13) |
| `super-gsd/scripts/lib/route-ledger.cjs` | Envelope-v1 pattern reference (informational only — Phase 49 emits its own ledger) | ✓ | Phase 32 closed | — |
| `git` CLI | `created_by` token in capsule writes | ✓ | system | Falls back to `'unknown'` (Phase 43 pattern at `write.cjs:837`) |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** `better-sqlite3` (Phase 46 native module). If absent, Phase 46 `query()` returns []; Phase 49 `loadIndexSnippets()` therefore returns []; Phase 45 step 6 sees an empty array (current behavior — degrade-not-halt).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Phase 49 in-module `--self-test` (mirrors Phase 41-48 pattern) |
| Config file | none — pure node, no harness |
| Quick run command | `node super-gsd/tools/memory-governance/lifecycle.cjs --self-test` |
| Full suite command | `node super-gsd/tools/memory-governance/lifecycle.cjs --self-test && node super-gsd/tools/phase-capsule/write.cjs --self-test && node super-gsd/tools/context-packet/build.cjs --self-test` (cross-module regression) |
| Phase gate | self-test exit 0 + no canonical fingerprint drift |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| GOV-01 | `processComplaints` reads context-complaints.jsonl + dispatches repair | unit | F9 fixture | ❌ Wave 0 |
| GOV-02 | `admitMemoryWrite` rejects unproven writes | unit | F1+F2 fixtures | ❌ Wave 0 |
| GOV-03 | Lifecycle fields land on PHASE-CAPSULE.json | unit | F11 fixture (backfill verifies all 7 fields populated) | ❌ Wave 0 |
| GOV-04 | promote raw→capsule→thought→rule | unit | F3+F4+F5 fixtures | ❌ Wave 0 |
| GOV-05 | revoke writes tombstone + replaced_by chain | unit | F7 fixture | ❌ Wave 0 |
| GOV-06 | intent-map promote requires provenance | unit | reuses F2 (provenance gate is shared) | ❌ Wave 0 |
| GOV-07 | bidirectional lifecycle: demote works | unit | F6 fixture | ❌ Wave 0 |
| GOV-08 | every memory-write logs to ledger | unit | F12 fixture (assert each op writes its envelope-v1 row) | ❌ Wave 0 |
| LOCK-2 | Read-only invariant on canonical streams + Phase 41-48 sources | integration | F10 fixture (30+ path fingerprint capture) | ❌ Wave 0 |
| LOCK-13 | Never-throws on bad input | unit | F13 fixture (call every public API with null/undefined/garbage) | ❌ Wave 0 |
| Phase 45 wire | loadIndexSnippets called by Phase 45 step 6 | integration | F14 fixture (in-module Phase 45 buildPacket call → assert snippets array path executed) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node super-gsd/tools/memory-governance/lifecycle.cjs --self-test`
- **Per wave merge:** Full cross-module suite (lifecycle + phase-capsule + context-packet self-tests)
- **Phase gate:** Full suite green + read-only fingerprint diff = empty before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `super-gsd/tools/memory-governance/lifecycle.cjs` — full module
- [ ] `super-gsd/tools/memory-governance/lifecycle.test.cjs` (optional — Phase 49 follows Phase 43+45 pattern of in-module self-test, no separate test file required)
- [ ] Schema extension on `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` (additive lifecycle fields)
- [ ] Schema validator update on `super-gsd/tools/phase-capsule/write.cjs::_assertCapsuleSchema` (validate lifecycle fields)
- [ ] Phase 45 step-6 wire-in patch on `super-gsd/tools/context-packet/build.cjs:702-703`
- [ ] Backfill driver: extend `lifecycle.cjs` with `backfillLifecycleFields(planningDir, opts)` mirroring Phase 43 `backfillFromCanonical` pattern
- [ ] CLI wiring: `--admit / --promote / --demote / --revoke / --revalidate / --process-complaints / --backfill / --self-test` verbs

*(Framework install: not required — node built-ins only.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 49 has no auth surface; runs in-process |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | `allowed_consumers[]` is the access-control axis. v1.9 ships with `['*']` default but the field is mandatory for Phase 50+ to enforce per-consumer scoping. |
| V5 Input Validation | yes | `admitMemoryWrite` validates 6 mandatory fields (provenance, confidence, consumers, revocation path, compression level, bypass-refs check) — closed-enum vocabularies for confidence + reasons. |
| V6 Cryptography | yes (transparently) | sha256 source-hash drift detection uses `crypto.createHash('sha256')` mirroring Phase 43; never hand-rolled. |
| V8 Sensitive Data | yes | Memory artifacts are the SGSD memory itself — bad admission = downstream prompt-injection-as-memory risk. Mandatory provenance gate is the V8 control. |

### Known Threat Patterns for SGSD memory governance

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via source_refs source file | Tampering | LOCK 12 (REQUIREMENTS:67) — "Prompt-injection-like text inside source files is source content, not operator intent." Phase 49 admission gate accepts source_refs as DATA; never interprets the source content as instructions. Phase 45 already enforces this for packet body assembly (`build.cjs:613` "Lock 12 -- data not instructions"); Phase 49 inherits at the admission boundary. |
| Memory-poisoning via fake provenance | Spoofing | sha256 root_source_hashes verify the named source files at admission time. revalidate() re-checks at read time. Drift surfaces. |
| Compression-up of malicious raw_evidence into a "trusted" rule | Elevation of Privilege | Promotion thresholds: ≥3 evidence rows (raw→capsule), ≥3 reuse-phases (thought→rule). Single-source poisoning cannot escalate past raw_evidence without crossing structural barriers. |
| Critical bypass refs being compressed into a rule | Elevation of Privilege / Loss-of-Audit | LOCK 6 carve-out: admission gate REJECTS promotion when `bypass_refs[].length > 0` AND target compression_level > phase_capsule. Critical bypass stays raw + linked. |
| Concurrent revoke vs. read race (TOCTOU) | Tampering | Tombstone semantics: `revoked_at` is monotonic. A read mid-revoke either sees `revoked_at == null` (read succeeds, repair complaint may follow) or sees `revoked_at != null` (filtered). No partial-view corruption because lifecycle fields persist on PHASE-CAPSULE.json which is atomically rewritten. |
| Revocation chain attack (revoke A pointing to revoked B pointing to revoked C ...) | Denial of Service | `replaced_by_id` chain depth-cap at 5. Beyond 5, return `revoked_chain_too_deep`. Self-test F7b binds. |
| Validated_thought referencing a deleted source file | Repudiation / Loss-of-Audit | revalidate() detects via `fs.existsSync(srcPath)` returning false. Marks `revalidation_due` + emits revalidations.jsonl row. processComplaints classifies as `source_lost` and may revoke. |

---

## Architectural Lifecycle Detail (Q1-Q15 LOCKED Answers)

This section answers each of the 15 research questions explicitly so the planner has zero ambiguity.

### Q1: Module shape — single or six files?

**LOCKED: SINGLE module.** `super-gsd/tools/memory-governance/lifecycle.cjs` exports 6 public APIs + 1 wrapper.

**Rationale:** Mirror Phase 41-48 single-module precedent. Six-file split would diverge with no offsetting benefit. Cross-imports between sub-files would re-introduce circular-dep risk. Verified pattern at:

- `phase-capsule/write.cjs` (Phase 43) — 1840 LOC, 5 public APIs
- `context-registry/check.cjs` (Phase 44) — 522 LOC, 6 public APIs
- `context-packet/build.cjs` (Phase 45) — 1294 LOC, 5 public APIs
- `context-cache/rebuild.cjs` + `query.cjs` (Phase 46) — split because rebuild + query are write/read; Phase 49 has no equivalent split (all 6 APIs are write-or-edit)
- `dispatch-router/route.cjs` (Phase 47) — 1102 LOC, 3 public APIs
- `vtp-bridge/classify.cjs` (Phase 48) — 1026 LOC, 2 public APIs

**Estimated Phase 49 LOC:** ~900-1100 (mirrors mid-range of above).

### Q2: Lifecycle field schema additions

**LOCKED:** 7 lifecycle fields added to PHASE-CAPSULE.json (additive — schema-extension; no existing field renamed; `required` array unchanged):

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `compression_level` | string enum (5 vocab) or null | `'phase_capsule'` (after backfill) | Anchors artifact in lifecycle |
| `promoted_at` | ISO timestamp or null | `cap.created_at` (after backfill) | When this artifact reached current compression level |
| `demoted_at` | ISO timestamp or null | null | Set on demote() |
| `revoked_at` | ISO timestamp or null | null | Set on revoke() — tombstone |
| `revoked_reason` | string enum (5 vocab) or null | null | Set on revoke() |
| `allowed_consumers` | string[] or null | `['*']` (after backfill — current default) | Future: per-role/per-cockpit scoping |
| `revalidation_due` | bool or null | null | Set true on read-time hash drift |
| `supersedes_id` | string or null | null | Forward link |
| `superseded_by_id` | string or null | null | Backward link (revoke replacement chain) |
| `revocation_path` | string or null | `'super-gsd/tools/memory-governance/lifecycle.cjs#revoke'` (after backfill) | How a downstream consumer revokes this artifact |

(Count: 10 fields. Original prompt suggested 7 but supersedes_id + superseded_by_id + revocation_path round to 10. Naming follows GOV-03 verbatim where possible.)

**Risk:** F1 self-test on Phase 43 capsule writer must continue to pass with extended schema. Phase 49 plan includes a Wave 0 task that runs `node super-gsd/tools/phase-capsule/write.cjs --self-test` AFTER schema extension, before any other Phase 49 work proceeds.

### Q3: Memory write admission gate signature

**LOCKED:** `admitMemoryWrite(artifact)` → `{ok:bool, reason:string}` where `reason` is from `ADMISSION_REJECT_CODES` (closed 9-entry enum). Public function. Lock 13 wrapped.

**Mandatory artifact fields:**

```text
artifact = {
  source_refs:        string[],      // non-empty, file paths under repo root
  root_source_hashes: string[],      // non-empty, sha256 hex strings, same length as source_refs
  confidence:         'low'|'medium'|'high',
  allowed_consumers:  string[],      // non-empty, role names or '*'
  revocation_path:    string,        // 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke' or equivalent
  compression_level:  one of COMPRESSION_LEVELS,
  bypass_refs?:       array,         // optional; if present + length > 0 + compression_level > phase_capsule -> REJECT
  debt?:              {critical_added: int, ...}, // optional; critical_added > 0 + compression_level > phase_capsule -> REJECT
  id:                 string,        // artifact identifier
  thought?:           string,        // if compression_level === 'validated_thought'
  used_for?:          string,        // if compression_level === 'validated_thought'
}
```

**Rejection reasons** (all 9 in `ADMISSION_REJECT_CODES`):

1. `memory_admission_artifact_missing`
2. `memory_admission_provenance_missing`
3. `memory_admission_confidence_invalid`
4. `memory_admission_consumers_missing`
5. `memory_admission_revocation_path_missing`
6. `memory_admission_compression_level_invalid`
7. `memory_admission_bypass_refs_block_promotion`
8. `memory_admission_debt_blocks_promotion`
9. `memory_admission_internal_error`

### Q4: Promotion path

**LOCKED:** Three structural thresholds (no semantic similarity):

```text
raw_evidence -> phase_capsule:
  - Already handled by Phase 43 writeCapsule. Phase 49 doesn't promote here;
    Phase 43 IS the promotion. Phase 49 admits the resulting capsule.

phase_capsule -> validated_thought:
  - admitMemoryWrite() PASS
  - non-empty `used_for` field
  - non-empty `thought` field
  - capsule.bypass_refs[].length === 0  (Lock 6)
  - capsule.debt.critical_added === 0  (Pitfall 5)

validated_thought -> reusable_rule:
  - admitMemoryWrite() PASS
  - cited by ≥3 distinct phases (count via grep across packet-log.jsonl
    or thought references in subsequent capsules' source_refs)
  - confidence in {medium, high}  (low-confidence thoughts cannot become rules)

reusable_rule -> guardrail:
  - admitMemoryWrite() PASS
  - rule's stated effect is a NEGATIVE constraint (e.g., "never X", "MUST not Y")
  - manual_promote_with_provenance reason (operator action; gov-rule)
```

**Public API:** `promote({artifact_id, from_level, to_level, evidence})` → `{ok, new_id, ledger_row}`. Lock 13 wrapped.

**Ledger row written to** `.planning/metrics/memory-promotions.jsonl`:

```json
{"envelope_version":1,"ts":"2026-04-27T22:00:00.000Z","command":"memoryPromote",
 "status":"ok","reason_codes":["evidence_threshold_met"],
 "details":{"artifact_id":"v1.6/26#hash","from_level":"phase_capsule",
            "to_level":"validated_thought","new_id":"vt-v1.6-26-...",
            "evidence":[{phase:"v1.6/27",...}]}}
```

### Q5: Demote / revoke

**LOCKED:** Two distinct APIs.

`demote(artifact_id, reason)`:
- reason from `DEMOTION_REASONS` enum (4)
- Edits artifact lifecycle fields: `demoted_at = now`, `compression_level = level - 1`
- Writes envelope-v1 row to `.planning/metrics/memory-demotions.jsonl`
- Returns `{ok, ledger_row}`

`revoke(artifact_id, reason, replaced_by_id?)`:
- reason from `REVOKE_REASONS` enum (5)
- Edits artifact: `revoked_at = now`, `revoked_reason = reason`, `superseded_by_id = replaced_by_id || null`
- replaced_by_id chain depth-cap = 5 (security: depth-too-deep returns `revoked_chain_too_deep`)
- Writes envelope-v1 row to `.planning/metrics/memory-revocations.jsonl`
- Returns `{ok, ledger_row}`

Both Lock 13 wrapped.

### Q6: Revalidation (read-time)

**LOCKED:** `revalidate(artifact_id)` → `{ok, drift_detected:bool, ledger_row}`.

**Implementation:** Re-hash each `source_refs[i]` against current canonical file. If mismatch OR file-deleted → drift. Sets `revalidation_due = true` on the artifact AND appends row to `.planning/metrics/memory-revalidations.jsonl`. Does NOT auto-revoke.

**Read-pulled trigger:** `loadIndexSnippets()` calls `revalidate()` per row before returning. `processComplaints` also triggers revalidation when it sees a `source_drifted` complaint hint.

### Q7: Complaint lifecycle

**LOCKED:** `processComplaints({since_ts, max_repairs})` reads `.planning/metrics/context-complaints.jsonl` filtered by `ts > since_ts`. Per-row classifier maps `reason_codes[]` → repair action:

| Complaint reason_code | Repair action |
|------------------------|---------------|
| `broad_raw_fallback` | Schedule Phase 45 packet rebuild for the named intent_id (emit a row to a Phase 49-owned `repair-queue.jsonl` for orchestrator pickup; Phase 49 itself does NOT call Phase 45 buildPacket — that's the orchestrator's call). |
| `validated_thought_missing_provenance` | demote the named thought; if no fallback, revoke. |
| `packet_capsule_unavailable_raw_fallback` | Schedule Phase 43 capsule write for (milestone, phase). |
| `packet_invalid_references_filtered` | Append note; if Phase 44 stale_warning is true, log a "registry stale" demotion candidate. |
| `phase_capsule_backfill_milestone_missing` | Skip — informational. |
| `phase_capsule_backfill_index_unreadable` | Skip — Phase 43 already self-recovered. |
| `validated_thought_missing_provenance` | demote candidate. |
| `packet_built_with_omitted_material` | Note only — consider raising role budget if recurrent. |
| (default) | Log to memory-demotions.jsonl with reason `unknown_complaint_reason_code`. |

**Cursor:** `since_ts` advances monotonically. Max 50 repairs per invocation (Pitfall 6 mitigation). Returns `{repairs_attempted, repairs_succeeded, ledger_rows}`.

### Q8: Phase 45 step-6 wire-in (depends on Phase 46)

**LOCKED:** Phase 49 owns the wire. Phase 45's `build.cjs:702-703` currently reads:

```javascript
// Step 6: local index snippets (Phase 46 deferred -- fs.readFileSync direct).
const indexSnippets = []; // No-op fallback; explicit empty.
```

**Phase 49 patches** this to:

```javascript
let indexSnippets = [];
try {
  const phase49 = require('../memory-governance/lifecycle.cjs');
  if (phase49 && typeof phase49.loadIndexSnippets === 'function') {
    indexSnippets = phase49.loadIndexSnippets(intent_map.intent || '', {
      planningDir: _planningDir(opts),
      milestone: milestone, phase: phase, limit: 5,
      strict_revalidation: false,
    });
  }
} catch (_e) { indexSnippets = []; }
```

`loadIndexSnippets()` internally:
1. Calls Phase 46 `query()` (which already filters via Phase 44 `validateOne` per row)
2. Filters out rows whose underlying capsule has `revoked_at != null` (Phase 49 governance filter)
3. Annotates rows with `revalidation_due` flag (calling `_checkSourceHashDrift` per capsule)
4. Returns array

**This is a Phase 45 source EDIT** — additive, the empty-stub line is replaced. Phase 49 plan includes this as a Task. Phase 45 self-test must continue to pass after the edit (the `indexSnippets = []` fallback case is preserved on require failure).

### Q9: No-canonical-preservation

**LOCKED:** Phase 49 ships **4 NEW canonical streams** (envelope-v1, envelope_version=1):

| Stream | Purpose |
|--------|---------|
| `.planning/metrics/memory-promotions.jsonl` | Every successful promote() call appends one row |
| `.planning/metrics/memory-demotions.jsonl` | Every successful demote() call appends one row |
| `.planning/metrics/memory-revocations.jsonl` | Every successful revoke() call appends one row |
| `.planning/metrics/memory-revalidations.jsonl` | Every drift-detected revalidate() call appends one row |

Plus EDITS lifecycle fields on existing 44 PHASE-CAPSULE.json files (additive — atomic write via Phase 43 writeCapsule).

**Phase 49 NEVER replaces canonical .planning + git.** Cache directories (`.planning/cache/validated-thoughts/`, `.planning/cache/reusable-rules/`, `.planning/cache/guardrails/`) are gitignored projections — every artifact in cache MUST have a corresponding row in memory-promotions.jsonl that allows rebuild.

### Q10: Lock 13 (never-throws)

**LOCKED:** All 6 public APIs (admitMemoryWrite, promote, demote, revoke, revalidate, processComplaints) AND loadIndexSnippets wrap internals in try/catch. On internal error: stderr-warn + APPEND row to `.planning/metrics/context-complaints.jsonl` (envelope-v1) + return `{ok:false, reason:'<api>_internal_error'}`. Phase advance NEVER halts on Phase 49 failure.

Self-test fixture F13 binds: call every public API with `null`, `undefined`, `{}`, `{garbage:1}` — no throw escapes.

### Q11: Read-only invariant scope

**LOCKED:** Phase 49 is READ-ONLY against:

- 9 canonical metric streams: agent-token-spend.jsonl, token-attribution.jsonl, codex-log.jsonl, activity-log.jsonl, token-log.jsonl, token-waste-status.jsonl, crit-backlog.jsonl, route-decisions.jsonl, vtp-bridge-failures.jsonl
- All Phase 41-48 .cjs source files (token-attribution/, token-waste/, phase-capsule/, context-registry/, context-packet/, intent-map/, context-cache/, dispatch-router/, vtp-bridge/)
- All canonical phase-folder content: CONTEXT.md, RESEARCH.md, *PLAN.md, VERIFICATION.md, ATC-REVIEW.md, reviews/*-REVIEW.md

Phase 49 OWNS (writes to):

- 4 NEW canonical streams (memory-{promotions,demotions,revocations,revalidations}.jsonl)
- Lifecycle field edits on existing PHASE-CAPSULE.json files (additive; via Phase 43 writeCapsule)
- `.planning/cache/validated-thoughts/*.json` (Phase 45 already writes here; Phase 49 adds + revokes)
- `.planning/cache/reusable-rules/*.json` (NEW directory)
- `.planning/cache/guardrails/*.json` (NEW directory)
- `.planning/metrics/repair-queue.jsonl` (NEW; for processComplaints scheduling)

Phase 49 ALSO EDITS (existing source files — additive only):

- `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` (add 10 optional lifecycle fields to `properties`)
- `super-gsd/tools/phase-capsule/write.cjs::_assertCapsuleSchema` (validate the 10 new fields; validation matches schema oneOf)
- `super-gsd/tools/context-packet/build.cjs:702-703` (replace `indexSnippets = []` stub with `loadIndexSnippets()` call; preserve fallback)

Self-test F10 fixture captures fingerprints of 30+ paths BEFORE/AFTER and asserts no drift on read-only files. The 3 ALSO EDITS files above are explicitly excluded from the read-only fingerprint set (they're owned-edits in this phase).

### Q12: Self-test design

**LOCKED:** 14 in-module assertions across 13 fixtures (mirrors Phase 47's 15 + Phase 48's 11 density):

| # | Fixture | Binding |
|---|---------|---------|
| F1 | admit happy path (all 6 mandatory fields present) | A4/GOV-02 |
| F2 | admit reject — missing source_refs | A4 |
| F2b | admit reject — missing root_source_hashes | A4 |
| F2c | admit reject — confidence not in vocab | A4 |
| F2d | admit reject — bypass_refs[].length>0 + compression_level>phase_capsule | LOCK 6 |
| F2e | admit reject — debt.critical_added>0 + compression_level>phase_capsule | Pitfall 5 |
| F3 | promote raw→capsule (delegates to Phase 43; admission gate verifies capsule fields) | A1 |
| F4 | promote capsule→thought (admit + writes thought file + appends promotion row) | A1 |
| F5 | promote thought→rule (≥3 distinct phases citing) | A1 |
| F6 | demote (lifecycle field updated + ledger row appended) | A2/GOV-07 |
| F7 | revoke (tombstone + ledger row + replaced_by_id chain depth-cap=5) | A2/GOV-05 |
| F7b | revoke chain depth-too-deep (returns `revoked_chain_too_deep`) | Security threat #6 |
| F8 | revalidate — source-hash drift detected (file edited; revalidation row emitted; revalidation_due flag set) | A6 |
| F8b | revalidate — source-file deleted (drift detected via existsSync false) | Threat #7 |
| F9 | processComplaints — broad_raw_fallback complaint dispatched to Phase 45 packet rebuild via repair-queue.jsonl | A3+A7 |
| F9b | processComplaints — already-revoked artifact (race) logged as noop | Open Q2 |
| F10 | read-only invariant — fingerprint diff on 30+ canonical paths is empty after full run | LOCK 2 |
| F11 | lifecycle backfill — 44 capsules updated; idempotent on re-run | Pitfall 2 |
| F12 | every memory-write op writes its envelope-v1 row (assert all 4 new streams have rows after F1-F9 sequence) | GOV-08 |
| F13 | Lock 13 — every public API survives null/undefined/garbage input | LOCK 13 |
| F14 | Phase 45 wire — buildPacket() with phase49 wire actually calls loadIndexSnippets and returns rows | Q8 |

(Total: 22 fixtures across 14 assertions — fixtures share scaffolding; assertions group multiple fixtures.)

### Q13: Lifecycle backfill

**LOCKED:** One-shot migration `backfillLifecycleFields(planningDir, opts)`:

1. Walk `.planning/milestones/v*/phases/*/PHASE-CAPSULE.json` (skips `archive/`).
2. For each capsule: if `compression_level == null`, populate defaults via `_editCapsuleLifecycleFields()` which calls Phase 43 `writeCapsule` (atomic).
3. Defaults:
   - `compression_level: 'phase_capsule'`
   - `promoted_at: cap.created_at` (preserves the original capsule timestamp)
   - `allowed_consumers: ['*']`
   - `revocation_path: 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke'`
   - All other lifecycle fields stay null.
4. Idempotent: capsules whose `compression_level != null` are skipped (Pitfall 2 mitigation).
5. Returns `{updated, skipped, errors[]}`.

Run via CLI: `node super-gsd/tools/memory-governance/lifecycle.cjs --backfill`.

**Verification:** After backfill, `find .planning/milestones -name PHASE-CAPSULE.json | xargs jq -r '.compression_level'` must report `phase_capsule` for all 44 entries (none null).

### Q14: Phase 50 cockpit forward contract

**LOCKED:** Phase 50 will display memory governance state. The shape Phase 50 reads:

```yaml
memoryGovernanceState:
  total_artifacts: number       # count of all PHASE-CAPSULE.json with compression_level set
  by_compression_level:
    raw_evidence: number
    phase_capsule: number
    validated_thought: number
    reusable_rule: number
    guardrail: number
  recently_revoked:             # last N rows from memory-revocations.jsonl
    - artifact_id: string
      ts: ISO timestamp
      reason: string
  recently_revalidated:         # last N rows from memory-revalidations.jsonl
    - artifact_id: string
      ts: ISO timestamp
      drift_detected: bool
  complaints_pending: number    # rows in context-complaints.jsonl since last processComplaints cursor
  last_process_complaints_ts: ISO timestamp
```

**Phase 49 ships a helper** `getMemoryGovernanceSnapshot()` (NOT one of the 6 core APIs but exported publicly) that returns this shape. Phase 50 reads it directly. This avoids Phase 50 re-implementing the aggregation.

### Q15: Phase 51 BENCH forward

**LOCKED:** Phase 51 reads two of Phase 49's canonical streams as failure-mode signals:

- `memory-revocations.jsonl` — high revocation rate during a phase = governance is catching bad memory; benchmark scoring should reward this. Conversely, ZERO revocations during a phase that produced a known-bad artifact = governance failed to catch it.
- `memory-revalidations.jsonl` — drift rate during a phase = source files changed under live thoughts. Phase 51's `evidence_retention` metric uses this: a thought with `revalidation_due=true` whose required-evidence is now stale counts AGAINST evidence_retention.

Phase 49 provides no special API for Phase 51; Phase 51 reads the JSONL streams directly (envelope-v1 makes this trivial).

---

## Project Constraints (from CLAUDE.md)

The project's CLAUDE.md (global + Super GSD) imposes constraints relevant to Phase 49:

| Directive | How Phase 49 Complies |
|-----------|------------------------|
| "Lock 13: Autonomy continues" | All 6 APIs Lock 13 wrapped; phase advance never halts on Phase 49 failure |
| "Lock 2: .planning JSONL + git remain source of truth" | 4 NEW canonical streams + lifecycle edits on existing capsules; no replacement of canonical state |
| "Lock 3: SQLite/Redis projections must be rebuildable" | Phase 49 cache files (validated-thoughts, reusable-rules, guardrails) are rebuildable from memory-promotions.jsonl |
| "Never use git commands with -i flag" | Phase 49 self-test uses execFileSync with explicit args; no -i |
| "All sub-agents run in bypass-permissions mode" | Phase 49 is in-process module; no sub-agent dispatch |
| "Commit after every unit; never batch" | Phase 49 plan structures tasks per Wave; each Task ends in a single commit |
| "Stage specific files by name; never `git add -A`" | Phase 49 plan tasks list explicit file paths per commit |
| "ATC anti-slop checklist (10 points)" | Phase 49 module is well within FULL tier; plan-checker will run all 10 points |

---

## Sources

### Primary (HIGH confidence — direct file read at research time)

- `super-gsd/tools/phase-capsule/write.cjs` (1840 LOC) — Phase 43 capsule writer; STATUS_VOCAB at line 76; BYPASS_KIND_VOCAB at line 89; SCHEMA_VERSION at line 73; CAPSULE_FILE_KINDS at line 100; _assertCapsuleSchema at line 851; _writeCapsuleInternal at line 1010; _capsuleContentHash at line 757; readCapsule at line 1124; writeCapsule at line 1135; backfillFromCanonical at line 1389
- `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` — full schema with `additionalProperties: false`
- `super-gsd/tools/context-registry/check.cjs` (522 LOC) — validateOne at line 68; loadRegistry imported from build; REASONS at line 37; DEFAULT_CATEGORIES at line 47; explicit Phase 49 cross-ref at line 445 ("Phase 49 GOV-02 owns memory-write admission decision")
- `super-gsd/tools/context-packet/build.cjs` (1294 LOC) — _assertValidatedThoughtProvenance at line 220; COMPRESSION_LEVELS at line 104; CONTEXT_SOURCE_MIX_KEYS at line 112; PACKET_REASON_CODES at line 92; _emitContextPacketComplaint at line 273; ROLE_MODES at line 56; build sequence at line 634-867; step-6 stub at line 702-703
- `super-gsd/tools/context-cache/query.cjs` (262 LOC) — query at line 128; per-row Phase 44 validateOne filter at line 109; KIND_VOCAB imported from rebuild; QUERY_LIMIT_DEFAULT/MAX at line 39-40
- `super-gsd/tools/context-cache/rebuild.cjs` (sec 1-120 read) — DB_PATH/MANIFEST_PATH at line 106-107; KIND_VOCAB at line 97; FTS_TOKENIZER at line 104
- `super-gsd/tools/dispatch-router/route.cjs` (1102 LOC) — UNCERTAINTY_TYPES at line 77; ROUTE_DECISION_REASONS at line 103; VTP_WHITELIST at line 175; ROUTING_TABLE at line 143; routeDispatch at line 636
- `super-gsd/tools/vtp-bridge/classify.cjs` (1026 LOC) — VTP_TOOL_MAP at line 99; reserved entry `research_external_validation` at line 123 explicitly notes "Phase 49 governance gate may activate"; VTP_BRIDGE_REASONS at line 132; selectiveVTPCall at line 639
- `.planning/milestones/v1.9/REQUIREMENTS.md` — GOV-01..08 at lines 204-222; design locks 1-13 at lines 35-69
- `.planning/milestones/v1.9/ROADMAP.md` — Phase 49 §234-254
- `.planning/milestones/v1.9/SGSD-HANDOVER.md` — operator intent §32-48
- `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md` — full document; §"Phase 49 Delta" at line 200-235
- `.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-CONTEXT.md` — phase goal verbatim
- `.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/PHASE-CAPSULE.json` — depends_on=[43,44,45,46,47,48], unblocks via downstream_contract.consumers=['Phase 50','Phase 51']
- `.planning/metrics/context-complaints.jsonl` — 34 rows verified via wc; envelope-v1 schema confirmed via row inspection
- `.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-VERIFICATION.md` — Phase 48 closed; A1-A4 verified

### Secondary (MEDIUM confidence — pattern verified across multiple sources)

- Single-module export pattern: verified across Phase 41, 43, 44, 45, 47, 48 source files
- Lock 13 try/catch wrap: explicit in every Phase 41-48 module banner
- Envelope-v1 ledger row shape: verified in route-decisions.jsonl (25511 rows), context-complaints.jsonl (34 rows), agent-token-spend.jsonl (sample)
- 44 capsule count: verified via `find .planning/milestones -name PHASE-CAPSULE.json | wc -l` = 44

### Tertiary (LOW confidence — assumed; flagged in Assumptions Log)

- Promotion thresholds (≥3 evidence rows; ≥3 reuse phases) — first-pass values; tunable via routes.yaml
- 50-repair cap per processComplaints invocation — defensive bound; tunable
- ASSUMED claims tagged in Assumptions Log §A2, A3, A4

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every imported module verified at exact line numbers in source
- Architecture (6-API single-module shape): HIGH — mirrors Phase 41-48 precedent exactly
- Lifecycle field schema: HIGH — additive extension to Phase 43 schema; mechanically safe
- Promotion path: MEDIUM — thresholds are configurable assumptions; structural predicates are HIGH
- Demote / revoke contract: HIGH — tombstone semantics + closed enums verified across precedent
- Revalidation: HIGH — sha256 drift check is mechanical
- Complaint repair loop: MEDIUM — repair-action map is well-defined but Phase 45 rebuild dispatch is "schedule-via-queue" (not direct call); orchestrator picks up
- Phase 45 wire-in: HIGH — exact line cited (build.cjs:702-703); patch is additive
- Read-only invariant: HIGH — Phase 41-48 all enforce; mirror pattern
- Self-test: HIGH — fixture pattern matches Phase 47/48 precedent
- Lifecycle backfill: HIGH — 44-capsule count verified; idempotency rule clear
- Pitfalls: HIGH — drawn from Phase 41-48 ATC-REVIEW patterns + research-observed risks
- Open questions: HIGH — all 5 documented with explicit recommendations

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days — stable v1.9 phase architecture; recompute if Phase 41-48 source files change)
