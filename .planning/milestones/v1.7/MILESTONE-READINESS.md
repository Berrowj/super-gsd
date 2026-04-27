---
milestone: v1.7
generated: 2026-04-26T07:10:00Z
probe_duration_sec: 42
phases_scanned: 5
status: GO
first_stall_eta_min: n/a
---

# Milestone Readiness — v1.7 (Stable Command Contracts + Route Intelligence)

> Pre-flight dependency audit. Generated before auto-mode execution.
> If this file is older than the latest phase change in the milestone, re-run `/gsd-readiness`.

## GO — Safe to run unattended

All 5 phases cleared all probes. Full unattended run is authorized.

| Phase | Title | ETA | Notes |
|-------|-------|-----|-------|
| 31 | Canonical Command Envelope | ~60m | docs+schema only; no code deps beyond Node + git |
| 32 | Route Decision Ledger | ~90m | code phase; requires Node 20+, git — both green |
| 33 | Repair Instruction Contract | ~90m | code+config; gates.yaml present, Node green |
| 34 | Canonical Review Ledger | ~120m | code phase; per-phase commit-reviews.jsonl files are the input corpus |
| 35 | Generated System Map | ~90m | code phase; reads registries + SKILL.md frontmatter |

Dependency order per REQUIREMENTS.md: 31 → {32 ∥ 33 ∥ 34} → 35. All parallelism is safe.

## BLOCKED AT START — Fix these before running

None. All probes passed.

## WILL BLOCK MID-RUN — Cascade blockers

None. No upstream phase is blocked.

## DEGRADED AUTO-RUN PATH

No degraded path needed — full path is GO.

- **Path:** 31 → 32 → 33 → 34 → 35 (or 31 → {32 ∥ 33 ∥ 34} → 35)
- **Total ETA:** ~450 minutes (7.5h sequential; ~270m with phases 32/33/34 parallel)
- **Stops at:** none — all phases clear
- **Command:** `/sgsd-orchestrate go`

## PROBE LOG

| Time | Phase | Dep | Probe | Result |
|------|-------|-----|-------|--------|
| 2026-04-26T07:10:00Z | all | PowerShell 5.1+ | `powershell.exe -Command "(Get-Host).Version.ToString()"` → `5.1.26100.8115` | PASS |
| 2026-04-26T07:10:02Z | all | Node.js 20+ | `node --version` → `v22.22.2` | PASS |
| 2026-04-26T07:10:02Z | all | Git CLI | `git --version` → `git version 2.50.1.windows.1` | PASS |
| 2026-04-26T07:10:05Z | all | Codex behavioral | `node super-gsd/tools/provider-health/check.cjs --provider codex --behavioral` → `AVAILABLE; auth.json=true config.toml=true; codex-cli 0.125.0; login=PASS; canary=PASS` | PASS |
| 2026-04-26T07:10:06Z | 31-35 | review-providers.yaml | `test -f super-gsd/registry/review-providers.yaml` | PASS |
| 2026-04-26T07:10:06Z | 31-35 | handover-contract-v2.yaml | `test -f super-gsd/registry/handover-contract-v2.yaml` | PASS |
| 2026-04-26T07:10:06Z | 31-35 | plan-schema-v2.json | `test -f super-gsd/templates/plan-schema-v2.json` | PASS |
| 2026-04-26T07:10:06Z | 31-35 | code-reviewer-v1 ref | `grep report_contract super-gsd/registry/review-providers.yaml` → `code-reviewer-v1` x2; `test -f super-gsd/agents/sgsd-code-reviewer.md` | PASS |
| 2026-04-26T07:10:07Z | all | .planning/metrics/ writable | `test -w .planning/metrics/` | PASS |
| 2026-04-26T07:10:08Z | all | crit-backlog.jsonl present | `test -f .planning/metrics/crit-backlog.jsonl` | PASS |
| 2026-04-26T07:10:09Z | all | crit-backlog --self-test | `node super-gsd/scripts/lib/crit-backlog.cjs --self-test` → `PASS` | PASS |
| 2026-04-26T07:10:10Z | all | backlog-schema --self-test | `node super-gsd/tools/backlog-schema/check.cjs --self-test` → `11 pass, 0 fail` | PASS |
| 2026-04-26T07:10:11Z | all | provider-health --self-test | `node super-gsd/tools/provider-health/check.cjs --self-test` → `14 pass, 0 fail` | PASS |
| 2026-04-26T07:10:12Z | all | status-consistency v1.7 | `node super-gsd/tools/status-consistency/check.cjs --milestone v1.7` → `OK` | PASS |

## Notes for the human

- All 14 probes passed. Full unattended run is authorized for all 5 phases.
- Codex behavioral probe confirms the v1.6 false-negative is resolved (config.toml detected; login + canary both PASS).
- v1.6 carry-forward debt (10 rows in crit-backlog.jsonl, all `kind=phase_atc`) does not block v1.7 — none tagged to phases 31-35.
- Phase 34 LEDGER lane will run `aggregate.cjs` over per-phase commit-reviews.jsonl files from v1.2/v1.4/v1.5; those files must exist at execution time. Not probed here (upstream artifact, present from v1.6 run).
- Fixes above are safe to run from any shell with project credentials.
- Never paste API key values — use `secure_env_collect` for secrets.
- After running fixes, reply `continue` — the orchestrator re-probes and resumes.
