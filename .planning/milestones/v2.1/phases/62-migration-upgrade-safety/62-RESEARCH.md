---
phase: 62
name: Migration + Upgrade Safety
milestone: v2.1
type: research
researched_at: 2026-04-29
researcher: gsd-executor (compressed-phase dispatch)
---

# Phase 62 Research - Migration + Upgrade Safety Drift Checker

## Verbatim goal (ROADMAP-AGENT.md line 770)

> Drift checker (8 probes) reports v1.5 -> v2.1 markers without modifying files.

## Locked decision (62=A)

Read-only drift checker. Single source file (`check.cjs`) with 4 public APIs
(runDrift / getProbe / selfTest / _internals); 11 probes (>=8 floor) covering
the four version_tag buckets v1.2 / v1.9 / v2.0 / v2.1; closed-vocab
PROBE_NAMES + VERSION_TAGS + REASON_NOTES all frozen.

## Why a checker (and why now)

Phase 62 is the FINAL phase of the v1.6 -> v2.1 roadmap. Before declaring the
roadmap complete, an operator needs a deterministic read-only fingerprint
that answers: "Did the milestones I think shipped, actually land in this
checkout?" Asking the milestone-close script directly is not enough --
sgsd-complete-milestone.cjs verifies dynamic behavior (selfTest exit 0,
score >=70), but it does not enumerate the static landing surface for each
phase. The drift checker fills that gap.

## Design constraints (locked)

- READ-ONLY by construction. No fs.writeFileSync / appendFileSync /
  unlinkSync / mkdirSync / rmSync / rmdirSync anywhere in the source.
  Verified mechanically by selfTest A8 (source substring scan with
  comments stripped) AND operationally by `git status --short` before
  and after `--run`.
- Probe count >= 8 (ROADMAP-AGENT.md line 770). We ship 11 probes; the
  extras give a richer migration fingerprint and let UPGRADE-DRIFT.md
  enumerate per-milestone deltas.
- Closed-vocab PROBE_NAMES, VERSION_TAGS (4 entries), REASON_NOTES (8
  entries). All Object.freeze'd. selfTest A1 / A9 / A10 verify.
- Each probe walks an array of CANDIDATE rel_paths in declaration
  order; FIRST present candidate wins. This is necessary for Phase 46
  where the canonical landing path is `super-gsd/tools/sqlite-context-
  index/` per the v1.9 SUMMARY but in this checkout it lives at
  `super-gsd/tools/context-cache/`. Probe accepts either.
- Lock 4: zero `require()` of any Phase 41-61 module. Probes are
  filesystem existence checks only.
- Lock 13: every public API try/catch wrapped; every probe wraps
  internals; bad-name input -> degraded sentinel; non-string input ->
  degraded sentinel.
- ASCII-only across all source files (selfTest A7 enforces).

## Probe inventory (11 probes >= 8 floor)

| Probe                          | Source phase | Version tag | Kind        |
| ------------------------------ | ------------ | ----------- | ----------- |
| schema_version_2_plans         | 11           | v1.2        | glob_anchor |
| agent_token_spend_ledger       | 41           | v1.9        | file        |
| context_packet_tree            | 45           | v1.9        | dir         |
| sqlite_context_index_tree      | 46           | v1.9        | dir         |
| dispatch_router_tree           | 47           | v1.9        | dir         |
| memory_governance_tree         | 49           | v1.9        | dir         |
| redis_adapter_present          | 52           | v1.9        | file        |
| failure_injection_tree         | 53           | v2.0        | dir         |
| release_readiness_present      | 57           | v2.0        | file        |
| installer_audit_tree           | 58           | v2.1        | dir         |
| new_project_wizard_present     | 59           | v2.1        | file        |

11 probes >= 8 floor. By version tag: v1.2:1 + v1.9:6 + v2.0:2 + v2.1:2 = 11.

## Migration deltas (per-milestone, frozen)

`MIGRATION_NOTES` is a frozen 7-key map (v1.5_baseline / v1.6_cockpit /
v1.7_command_contracts / v1.8_gate_fitness / v1.9_research /
v2_0_failure_injection / v2_1_distribution). Each value is a frozen array
of 2-10 deterministic delta strings keyed off the corresponding milestone
SUMMARY. selfTest A11 verifies all 7 keys present + non-empty arrays.

## Gate wire-in plan

The v2.1 fifth-gate is added to `sgsd-complete-milestone.cjs --milestone v2.1`
between the existing fourth-gate (docs-refresh) green stdout and the
process.exit(0). Lock 4: prior four v2.1 gates (Phase 58 first / Phase 59
second / Phase 60 third / Phase 61 fourth) preserved byte-equality up to
the insertion point. The fifth-gate runs:

1. require the upgrade-drift module (Lock 13: emits
   milestone_close_blocked:upgrade_drift_unavailable on require failure).
2. Call selfTest() (Lock 13: emits ...:upgrade_drift_self_test_threw on
   throw; emits ...:upgrade_drift_self_test_failed on ok!==true).
3. Verify the read_only_invariant assertion is in selfTest results AND
   ok===true (closed-vocab indexOf membership on assertion name).
4. Call runDrift() (Lock 13: emits ...:upgrade_drift_self_test_threw on
   throw).
5. Verify probes.length >= 8 (emits ...:upgrade_drift_probe_count_below_floor
   on shortfall).
6. Emit fifth-gate green stdout + quint-gate green stdout + exit 0.

All five conditions must hold for v2.1 milestone close to proceed.

## Falsifiable proof

- 12-assertion in-tree selfTest exits 0 -> drift checker is internally
  consistent.
- runDrift().probes contains >=8 closed-vocab probe shapes -> Lock 11.
- `git status --short` before/after --run is identical -> READ-ONLY.
- selfTest A8 (source substring scan) PASS -> READ-ONLY mechanically.
- v1.9 dual-gate + v2.0 sept-gate + v2.1 quint-gate all exit 0 -> no
  regression.

## Out of scope

- Live network probes (a probe sending an HTTP request is NOT read-only
  in any meaningful sense).
- Auto-repair of missing markers (the checker is a fingerprint, not an
  installer).
- Probes for v1.6 / v1.7 / v1.8 -- those milestones do not ship
  canonical static landing surfaces under super-gsd/tools/ that can be
  cheaply existence-checked. Their migration deltas are captured in
  MIGRATION_NOTES instead.
