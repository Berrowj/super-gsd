---
title: Upgrade Drift Checker (v1.5 -> v2.1 Migration Fingerprint)
phase: 62
milestone: v2.1
status: SHIPPED
shipped: 2026-04-29
tool: super-gsd/tools/upgrade-drift/check.cjs
verbatim_goal: "Drift checker (8 probes) reports v1.5->v2.1 markers without modifying files."
---

# Upgrade Drift Checker

This document is the operator-facing guide for the v1.5 -> v2.1 upgrade
drift checker shipped in Phase 62. The checker is the FINAL surface of the
30-phase v1.6 -> v2.1 roadmap; it answers a single deterministic question
read-only:

> Which milestones (v1.6 / v1.7 / v1.8 / v1.9 / v2.0 / v2.1) have actually
> landed in this checkout?

It is read-only by construction. selfTest assertion A8 mechanically
forbids `fs.writeFileSync`, `fs.appendFileSync`, `fs.unlinkSync`,
`fs.mkdirSync`, `fs.rmSync`, and `fs.rmdirSync` in the source code.
Running `git status --short` before and after `--run` MUST return
identical output; the milestone-close fifth-gate enforces this.

## Probe table

There are **11 probes** (>=8 per ROADMAP-AGENT.md line 770). Each probe
walks a list of canonical CANDIDATE paths in declaration order; the
FIRST present candidate wins. All probes return a closed-vocab sentinel
shape; nothing throws upward (Lock 13).

| #  | Probe                            | Source phase | Version tag | Default candidate path                                | Notes                                              |
| -- | -------------------------------- | ------------ | ----------- | ----------------------------------------------------- | -------------------------------------------------- |
| 1  | `schema_version_2_plans`         | 11           | v1.2        | `super-gsd/templates/plan-schema-v2.json`             | Falls back to `super-gsd/tools/plan-schema/`.      |
| 2  | `agent_token_spend_ledger`       | 41           | v1.9        | `.planning/metrics/agent-token-spend.jsonl`           | Phase 41 11,294-row baseline ledger.               |
| 3  | `context_packet_tree`            | 45           | v1.9        | `super-gsd/tools/context-packet/`                     | Phase 45 6-role context packet builder.            |
| 4  | `sqlite_context_index_tree`      | 46           | v1.9        | `super-gsd/tools/sqlite-context-index/`               | Falls back to `super-gsd/tools/context-cache/`.    |
| 5  | `dispatch_router_tree`           | 47           | v1.9        | `super-gsd/tools/dispatch-router/`                    | Phase 47 18-entry decision enum.                   |
| 6  | `memory_governance_tree`         | 49           | v1.9        | `super-gsd/tools/memory-governance/`                  | Phase 49 lifecycle.cjs + 4 streams.                |
| 7  | `redis_adapter_present`          | 52           | v1.9        | `super-gsd/tools/context-cache/redis-adapter.cjs`     | Phase 52 8-API redis adapter.                      |
| 8  | `failure_injection_tree`         | 53           | v2.0        | `super-gsd/tools/failure-injection/`                  | Phase 53 harness.cjs (10 scenarios).               |
| 9  | `release_readiness_present`      | 57           | v2.0        | `super-gsd/tools/release-readiness/score.cjs`         | Phase 57 8-bucket composite scorer.                |
| 10 | `installer_audit_tree`           | 58           | v2.1        | `super-gsd/tools/installer-audit/`                    | Phase 58 12-probe audit + clean-room.sh.           |
| 11 | `new_project_wizard_present`     | 59           | v2.1        | `super-gsd/scripts/sgsd-new-project-wizard.cjs`       | Phase 59 deep-merge non-clobber wizard.            |

## Probe shape (closed-vocab)

```
{
  name: <PROBE_NAMES entry>,
  ok: true|false,                // probe ran without throwing
  present: true|false,           // probe found the marker on disk
  source_phase: <integer>,       // phase number that landed this surface
  version_tag: 'v1.2'|'v1.9'|'v2.0'|'v2.1',
  evidence_path: <relative path checked>,
  reason: <REASON_NOTES entry>
}
```

Closed-vocab `REASON_NOTES`:

- `present_phase_tree_found`        directory candidate located
- `present_file_found`              file candidate located
- `present_artifact_found`          glob_anchor candidate located
- `missing_path_not_found`          no candidate path resolved
- `missing_path_not_directory`      candidate exists but is not a dir
- `missing_path_not_file`           candidate exists but is not a file
- `read_only_filesystem_probe`      probe deliberately read-only
- `probe_internal_error_degraded`   defensive Lock-13 sentinel

## v1.5 -> v2.1 migration deltas

This is the canonical enumeration consumed by `runDrift().migration_notes`.
Every entry is verifiable against the corresponding milestone SUMMARY and
the canonical phase artifacts.

### `v1.5_baseline` (pre-October-2025 floor)

- Pre-v1.6 baseline: orchestrator + 8 skills + ATC framework, no migration
  surface.
- Plans were `schema_version=1` (free-form markdown frontmatter; no JSON
  schema validation).
- No canonical token ledger (`agent-token-spend.jsonl` absent).
- No phase capsules, no context registry, no context packet builder.
- No failure-injection harness, no chaos-restart, no release-readiness
  composite score.
- No installer audit, no new-project wizard, no example fixture.

### `v1.6_cockpit` (phases 26-30; SHIPPED-WITH-DEBT-10)

- Cockpit dashboards + Codex single-pane consolidation.
- Introduced `super-gsd/scripts/lib/sgsd-cockpit-shell.cjs` Node bridge.
- Introduced `sgsd-{token,active-agent,source-mix,codex,intent,governance,budget}-panel.ps1`
  panel scripts.
- Shipped with debt-10 (5 phase-ATC cosmetic items deferred; tracked in
  CRIT-BACKLOG.md).

### `v1.7_command_contracts` (phases 31-35; SHIPPED clean)

- Command-contract enforcement + bypass-pattern catalog.
- Closed v1.5 empty-baseline gap at Phase 34.
- Combined anti-slop ~9.5/10 across 5 phases.

### `v1.8_gate_fitness` (phases 36-40; SHIPPED clean)

- Gate-keep-kill rubric + phase-folder audit + gate fitness review.
- Combined anti-slop ~9/10 across 5 phases.

### `v1.9_research` (phases 41-52; SHIPPED clean)

- Phase 41: introduced `agent-token-spend.jsonl` ledger + bloat
  thresholds (8->4 keys after MEDIUM Claude REVISE-fix).
- Phase 42: token-waste check + budgets.yaml + 5-entry VERDICTS enum.
- Phase 43: phase-capsule {schema, write, build}.cjs + 44 capsules
  backfilled v1.2-v1.9.
- Phase 44: legal context registry (8 ROADMAP categories + 2 derived
  from 13 canonical sources).
- Phase 45: context-packet builder + intent-map + 6-role packets +
  REASON_VOCAB 13-entry frozen + COMPRESSION_LEVELS 5-entry.
- Phase 46: SQLite context index (rebuild.cjs + 145 docs indexed +
  better-sqlite3 dependency).
- Phase 47: dispatch-router + 18-entry decision enum + KAIROS context-
  pressure bias + A4 VTP 3-entry whitelist.
- Phase 48: selective VTP bridge (4-entry frozen route whitelist + A4
  5000-token cap + provenance).
- Phase 49: memory-governance lifecycle + 4 canonical streams
  (memory-{promotions, demotions, revocations, revalidations}.jsonl) +
  6 governance APIs.
- Phase 50: cockpit research dashboard panels (sgsd-{token,
  active-agent, source-mix}-panel.ps1).
- Phase 51: context-stress benchmark + 16-fixture failure injection
  F1-F16 + 18 RESEARCH-locked semantic floor.
- Phase 52: redis-adapter live cache (8 public APIs + 26 self-test +
  7 REDIS-LOCKS) + F17 surgical activation in Phase 51.

### `v2_0_failure_injection` (phases 53-57; SHIPPED, score 97/100 GREEN)

- Phase 53: failure-injection harness (10 scenarios + 24 self-test).
  10/10 --run-all sub-5.4s; F1-F16 frozen; Lock 4/11/13 verified.
- Phase 54: chaos-restart harness (5 kill points + 18 self-test +
  manifest validator). 5/5 --run-all chaos_pass; spawnSync timeout 200ms
  SIGTERM observed.
- Phase 55: provider-circuit codex->claude fallback (6 APIs + 12
  self-test). N=3 threshold env-overridable; codex->claude byte-equality
  fallback.
- Phase 56: scenario-suite (10 scenarios + JSON-Schema draft-07).
  21/21 self-test PASS; 6 happy + 4 adversarial scenarios.
- Phase 57: release-readiness score (8-bucket composite + 15 self-test).
  Live score 97/100 GREEN; edge_guard_miss synthetic fixture override
  demonstrated mechanically.

### `v2_1_distribution` (phases 58-62; SHIPPED 2026-04-29)

- Phase 58: installer-audit (12 probes + clean-room.sh + run-self-test).
  All 12 self-test PASS; live --run reports 9 present + 3 optional;
  mandatory_floor_met=true.
- Phase 59: sgsd-new-project-wizard (deep-merge non-clobber + idempotent +
  5 public APIs Lock-13). 13/13 self-test; sha256 fe16729a... idempotent
  re-run match.
- Phase 60: examples/hello-world fixture + EXAMPLE-DEMO-WALKTHROUGH.md
  (11 documented steps tested end-to-end).
- Phase 61: public README refresh (preamble distinguishing operator-build
  vs end-user-install + VTP-optional sweep + sg quick-start command
  block tested live).
- Phase 62: upgrade-drift checker (this tool) + UPGRADE-DRIFT.md (this
  document).

## Migration recipe (operator upgrading from v1.5)

The deterministic upgrade path. Each step is read-only OR explicitly
labelled as a write step (none are required for the drift fingerprint).

1. **Get a clean checkout** of `Berrowj/super-gsd` at the v2.1 release
   tag (or main when v2.1 is on main). This is the operator-build target.
2. **Run the installer audit** to confirm Node/git/bash/PowerShell at
   the required floor:

   ```
   node super-gsd/tools/installer-audit/audit.cjs --run
   ```

   Exit 0 with `mandatory_floor_met=true` is required.
3. **Run the upgrade-drift checker** in your existing checkout to see
   which phases have already landed:

   ```
   node super-gsd/tools/upgrade-drift/check.cjs --run
   ```

   The output reports each probe `PRESENT` / `MISSING` plus a per-tag
   summary. `git status --short` before and after MUST be identical
   (read-only invariant).
4. **Compare against the probe table above.** Any `MISSING` row in the
   v1.9 / v2.0 / v2.1 buckets means the corresponding phase has not
   landed in your checkout. Pull the missing phase artifacts from the
   canonical phase directory under
   `.planning/milestones/<milestone>/phases/<phase-id>/`.
5. **Run the milestone-close gates in order** to verify nothing
   regressed:

   ```
   node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9
   node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
   node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1
   ```

   All three should exit 0. Any `milestone_close_blocked:` stderr line
   is a deterministic regression signal pointing at the failing gate.
6. **Optional: run the new-project wizard** if you want to seed a
   downstream project against the v2.1 surface:

   ```
   node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project <path>
   ```

   The wizard is non-clobber + idempotent; running it twice produces
   sha256 fe16729a... canonical match.

## CLI usage

```
node super-gsd/tools/upgrade-drift/check.cjs --run
node super-gsd/tools/upgrade-drift/check.cjs --self-test
node super-gsd/tools/upgrade-drift/run-self-test.cjs
```

`--run` (default) reports the 11 probes + summary + migration_notes.
`--self-test` runs the 12 in-tree assertions. Both exit 0 on success.

The runner is portable across PowerShell, cmd.exe, and bash.

## Lock invariants

- **Lock 4** (Phase 41-61 byte-untouched): verified. This file does not
  `require()` any Phase 41-61 module; every probe is a filesystem
  existence check.
- **Lock 11** (set-membership / byte-equality only - no embedding /
  cosine / fuzzy): every closed-vocab field uses array `indexOf`
  membership tests; no regex on probe names or version tags.
- **Lock 13** (every public API try/catch + degraded sentinel; never
  throws upward): verified by selfTest A3 + A4 (bad-name + non-string
  bad input both return degraded sentinels without throwing).
- **READ-ONLY**: verified by selfTest A8 (source code substring scan)
  and operationally by `git status` before/after `--run`.
- **ASCII-only**: verified by selfTest A7 (`first_nonascii_idx === -1`).

## Closing

This is the FINAL surface of the v1.6 -> v2.1 roadmap. After this tool
ships, the v2.1 quint-gate (12 self-test + 11-probe live --run +
read-only fingerprint) closes the milestone, and the roadmap_run reaches
`completed` state. The drift checker is the artifact future operators
use to answer the question that started Phase 62: which milestones have
actually landed in this checkout?
