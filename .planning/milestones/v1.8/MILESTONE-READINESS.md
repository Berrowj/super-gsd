---
milestone: v1.8
milestone_name: Gate Fitness + MUDA Pruning
generated: 2026-04-27T11:30:00Z
probe_duration_sec: 38
phases_scanned: 5
status: GO
first_stall_eta_min: n/a
---

# Milestone Readiness — v1.8 (Gate Fitness + MUDA Pruning)

> Pre-flight dependency audit. Generated before auto-mode execution of Phases 36-40.
> Re-run `/gsd-readiness` if any phase folder under `.planning/milestones/v1.8/` is
> newer than this file's `generated` timestamp.

## GO — Safe to run unattended

All 5 phases cleared all probes. Full unattended run is authorized.

| Phase | Title | ETA | Notes |
|-------|-------|-----|-------|
| 36 | Gate Value Telemetry | ~90m | New lib + orchestrator SKILL.md wire. gate-value-log.cjs auto-creates its JSONL on first write. |
| 37 | MUDA Deletion Candidates | ~90m | Extends sgsd-muda-audit.sh (PRESENT). New lib only; no new registries. |
| 38 | Risk-Tiered Gate Sampling | ~120m | Edits gates.yaml (PRESENT, 13 entries), sgsd-classifier.md, sgsd-orchestrate/SKILL.md, new sampling-decider.cjs. |
| 39 | Gate Keep/Kill Review | ~90m | Reads review-ledger.jsonl (PRESENT, 10 rows), gate-value-log.jsonl (written by P36), edge-guard-log. Edits sgsd-complete-milestone/SKILL.md (PRESENT). |
| 40 | Phase Folder Perfection Contract | ~60m | Read-only auditor. No upstream phase output required beyond phase folders existing. |

**Dependency order (ROADMAP-AGENT.md):** 36 → {37 ∥ 38 ∥ 39} → 40.
Parallelism on 37/38/39 is safe once Phase 36 delivers `gate-value-log.cjs`
and its JSONL file (Phase 39 reads it for fitness history in the rubric).

**Note on Phase 39 upstream dependency:** Phase 39 reads `gate-value-log.jsonl`
(produced by Phase 36) for the rubric. If phases run sequentially this is
naturally satisfied. If 37/38/39 run in parallel, Phase 39 must wait for Phase
36 to produce at least one gate-value-log row before the rubric fires. The
rubric already specifies "defer-on-empty (gate-value-log empty) is explicit,
not kill by default" — so Phase 39 will not stall; it will emit `defer` rows
and continue. No hard block.

## BLOCKED AT START — Fix these before running

None. All probes passed.

## WILL BLOCK MID-RUN — Cascade blockers

None. No upstream phase is blocked.

## DEGRADED AUTO-RUN PATH

No degraded path needed — full path is GO. Codex behavioral probe confirmed
AVAILABLE (login + canary PASS). No Claude-only fallback required.

- **Path:** 36 → 37 → 38 → 39 → 40 (or 36 → {37 ∥ 38 ∥ 39} → 40)
- **Total ETA:** ~450 minutes sequential; ~270m with phases 37/38/39 parallel
- **Stops at:** none — all phases clear
- **Command:** `/sgsd-orchestrate go`

## PROBE LOG

| Time (UTC) | Phase scope | Dependency | Probe command / check | Result |
|------------|-------------|------------|-----------------------|--------|
| 2026-04-27T11:30:00Z | all | Node.js 20+ | `node --version` → `v22.22.2` | PASS |
| 2026-04-27T11:30:01Z | all | Git CLI | `git --version` → `git version 2.50.1.windows.1` | PASS |
| 2026-04-27T11:30:02Z | all | PowerShell 5.1+ | `powershell.exe -Command "(Get-Host).Version.ToString()"` → `5.1.26100.8115` | PASS |
| 2026-04-27T11:30:04Z | all | Codex behavioral | `node super-gsd/tools/provider-health/check.cjs --provider codex --behavioral` → `AVAILABLE; codex-cli 0.125.0; login=PASS; canary=PASS` | PASS |
| 2026-04-27T11:30:06Z | all | status-consistency v1.7 | `node super-gsd/tools/status-consistency/check.cjs --milestone v1.7` → `OK` | PASS |
| 2026-04-27T11:30:07Z | all | status-consistency v1.8 baseline | `node super-gsd/tools/status-consistency/check.cjs --milestone v1.8` → `OK` | PASS |
| 2026-04-27T11:30:08Z | all | crit-backlog --self-test | `node super-gsd/scripts/lib/crit-backlog.cjs --self-test` → `PASS` | PASS |
| 2026-04-27T11:30:09Z | all | backlog-schema --self-test | `node super-gsd/tools/backlog-schema/check.cjs --self-test` → `11 pass, 0 fail` | PASS |
| 2026-04-27T11:30:10Z | 32/36/38 | route-ledger --self-test | `node super-gsd/scripts/lib/route-ledger.cjs --self-test` → `12 pass, 0 fail` | PASS |
| 2026-04-27T11:30:11Z | 33/38 | repair-command-checker --validate | `node super-gsd/scripts/lib/repair-command-checker.cjs --validate` → `2 commands checked, 0 violations` | PASS |
| 2026-04-27T11:30:12Z | 39 | review-ledger --kill-check (v1.7) | `node super-gsd/scripts/lib/review-ledger.cjs --kill-check --milestone v1.7` → `{"ok":true,"reason":"baseline_ok","count":10}` | PASS |
| 2026-04-27T11:30:13Z | 35→39 | system-map generate | `node super-gsd/tools/system-map/generate.cjs` → wrote SYSTEM-MAP.json + SYSTEM-MAP.md | PASS |
| 2026-04-27T11:30:14Z | 33/36/38/39 | gates.yaml present + complete | `test -f super-gsd/registry/gates.yaml` + `grep -c "repair_instruction:"` → `13` | PASS |
| 2026-04-27T11:30:15Z | 37 | sgsd-muda-audit.sh present | `test -f super-gsd/scripts/sgsd-muda-audit.sh` → exists | PASS |
| 2026-04-27T11:30:15Z | 36/37/38 | gates-registry.cjs present | `test -f super-gsd/scripts/lib/gates-registry.cjs` → exists | PASS |
| 2026-04-27T11:30:16Z | all | .planning/metrics/ writable | `test -w .planning/metrics/` → writable | PASS |
| 2026-04-27T11:30:16Z | all | crit-backlog.jsonl present | `test -f .planning/metrics/crit-backlog.jsonl` → exists | PASS |
| 2026-04-27T11:30:17Z | 39 | review-ledger.jsonl present | `test -f .planning/metrics/review-ledger.jsonl` → exists | PASS |
| 2026-04-27T11:30:17Z | 36/38/39 | route-decisions.jsonl missing (non-blocking) | `test -f .planning/metrics/route-decisions.jsonl` → not found; route-ledger.cjs auto-creates via mkdirSync+appendFileSync at first write (verified in source) | INFO |
| 2026-04-27T11:30:18Z | 36/38 | sgsd-orchestrate/SKILL.md present | `test -f super-gsd/skills/sgsd-orchestrate/SKILL.md` → exists | PASS |
| 2026-04-27T11:30:18Z | 39/40 | sgsd-complete-milestone/SKILL.md present | `test -f super-gsd/skills/sgsd-complete-milestone/SKILL.md` → exists | PASS |
| 2026-04-27T11:30:19Z | all | v1.8 not partially executed | `grep -c "gate_sampling_tier:" gates.yaml` → 0; `grep -c "gate-value-log" sgsd-orchestrate/SKILL.md` → 0 | PASS (clean start) |

**Total probes:** 21 (20 PASS + 1 INFO). 0 FAIL. 0 UNKNOWN.

## v1.8-Specific Dependency Graph

```
gates.yaml (v1.7 P33 artifact) ──────────────────────────────────┐
route-ledger.cjs (v1.7 P32 artifact) ────────────────────────────┤
repair-command-checker.cjs (v1.7 P33 artifact) ──────────────────┤
review-ledger.cjs (v1.7 P34 artifact) ───────────────────────────┤──→ Phase 36 → gate-value-log.cjs (NEW)
system-map/generate.cjs (v1.7 P35 artifact) ─────────────────────┤         │
sgsd-muda-audit.sh (pre-v1.7, PRESENT) ──────────────────────────┘         │
                                                                            ↓
                                               gate-value-log.jsonl (created by P36)
                                                       │
                      ┌────────────────────────────────┼──────────────────────────────┐
                      ↓                                ↓                              ↓
               Phase 37 (MUDA cands)           Phase 38 (sampling-decider)    Phase 39 (rubric)
               muda-deletion-                  gates.yaml+tier, sampling-     gate-keep-kill/
               candidates.cjs                 decider.cjs, gates.yaml edits   rubric.cjs
                      │                                │                              │
                      └────────────────────────────────┴──────────────────────────────┘
                                                       ↓
                                               Phase 40 (phase-folder audit)
                                               phase-folder-audit/audit.cjs
```

## Notes for the human

- All 21 probes passed. Full unattended run is authorized for all 5 phases.
- Codex behavioral probe confirms AVAILABLE status carries from v1.7 — login + canary PASS.
- v1.6 carry-forward debt (10 rows in crit-backlog.jsonl, all `kind=phase_atc`) does not block v1.8 — none tagged to phases 36-40.
- `route-decisions.jsonl` is missing but is not a blocker: `route-ledger.cjs` line 180 calls `mkdirSync({recursive:true})` + `appendFileSync` on first write. Phase 38 (sampling-decider) will auto-create it when it logs the first gate_override boundary.
- Phase 39 rubric reads `gate-value-log.jsonl` (produced by Phase 36). The rubric spec states "defer-on-empty is explicit, not kill by default" — even if Phase 39 runs before Phase 36 produces rows, it will emit `defer` per gate rather than stalling.
- Phase 40 is read-only (auditor does not modify phase folders). No artifact dep beyond phase folders existing.
- Never paste API key values — use `secure_env_collect` for secrets.
- After running fixes (if any arise mid-run), reply `continue` — orchestrator re-probes and resumes.

## sgsd-curate Suggestions

No new dependency patterns discovered that are absent from `.planning/memory/`. The
`gate-value-log.cjs` auto-create pattern mirrors the established `route-ledger.cjs`
pattern already in scope. No new curate entry required.
