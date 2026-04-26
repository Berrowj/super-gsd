---
milestone: v1.6
generated_at: 2026-04-26T00:00:00Z
probe_duration_s: ~45
phases_scanned: 5
phases: [26, 27, 28, 29, 30]
readiness_status: DEGRADED
---

# Milestone v1.6 — Pre-Flight Readiness Manifest

Cockpit 2.0 + Startup Verification | Phases 26–30

---

## GO

All phases are safe to begin execution. Every infrastructure dependency
is present and functional.

| Phase | Title | Status | Notes |
|-------|-------|--------|-------|
| 26 | Operator Question Contract | GO | docs-only; no code deps |
| 27 | Data Source + Objective Tree Audit | GO | depends on 26-CONTEXT.md (produced by Phase 26) |
| 28 | Mission Control 2.0 Layout | GO | PowerShell + Node deps confirmed |
| 29 | Agent + Codex Visibility Lanes | GO | depends on 28-VERIFICATION.md (produced by Phase 28) |
| 30 | Startup Verification + Cockpit Acceptance | GO | depends on 28+29 VERIFICATION.md |

---

## BLOCKED AT START

None. All hard infrastructure probes passed.

---

## WILL BLOCK MID-RUN

None. All upstream inter-phase artifact deps (26→27, 28→29, {28,29}→30)
are produced by earlier phases in the same run — they do not exist yet
and that is expected. The dependency chain is linear:
26 → 27 → {28 ∥ 29} → 30.

---

## DEGRADED AUTO-RUN PATH

**OPENAI_API_KEY and CODEX_API_KEY are both UNSET in the current shell
environment.** Codex CLI binary is present (v0.125.0) but API auth is
unconfirmed from this shell context.

Per the ROADMAP-AGENT.md Live-or-Local Acceptance Rule (Patch 4):

> If the live action is unreachable (Codex auth missing, network down,
> MCP off): the phase records this as a `provider_unavailable` reason on
> the route-decision ledger row, runs the local fallback, and continues.

Degraded behavior on affected steps:

| Step | Affected phases | Degraded behavior |
|------|-----------------|-------------------|
| Phase-level ATC Codex review (Step 9) | 26, 27, 28, 29, 30 | Claude-only reviewer; `codex-cli-reviewer` row marked `provider_unavailable`; CRIT-BACKLOG row added with `kind=verifier_fail, summary="live Codex auth unavailable; fallback used"` |
| Per-dispatch ATC Codex review (Step 6, code phases 28 + 29) | 28, 29 | Same fallback; status degrades to `PASS-WITH-DEFERRED-N` if Codex can't review diffs |

**Degraded path covers all 5 phases with honest status.** Autonomy
continues per controlling principle. No phase is blocked.

**Full path**: 26 → 27 → 28 → 29 → 30

Estimated ETA: no phase-level time estimates in PLAN.md files (not yet
created). Docs phases (26, 27, 30) are lighter; code phases (28, 29) are
heavier. No ETA available at pre-flight.

**Explicit stop point**: none — all 5 phases are in degraded-GO state.

---

## PROBE LOG

| # | Probe | Command / Check | Result |
|---|-------|-----------------|--------|
| 1 | PowerShell version | `powershell.exe -NoProfile -Command 'Write-Output $PSVersionTable.PSVersion.Major'` | **5** — PASS (5.1+) |
| 2 | Node.js version | `node --version` | **v22.22.2** — PASS (20+ required) |
| 3 | Git CLI | `git --version` | **git version 2.50.1.windows.1** — PASS |
| 4a | codex-exec.sh exists | `test -f super-gsd/scripts/codex-exec.sh` | **PRESENT** — PASS |
| 4b | Codex CLI in PATH | `command -v codex` | **OK** (codex-cli 0.125.0) — PASS |
| 4c | Codex API auth (env) | `OPENAI_API_KEY` existence check | **UNSET** — DEGRADED |
| 4d | Codex API auth (env) | `CODEX_API_KEY` existence check | **UNSET** — DEGRADED |
| 5a | sgsd-mission-control.ps1 | file exists + PS AST parse | **PRESENT / parse:OK** — PASS |
| 5b | sgsd-narrative.ps1 | file exists + PS AST parse | **PRESENT / parse:OK** — PASS |
| 5c | sgsd-codex-monitor.ps1 | file exists + PS AST parse | **PRESENT / parse:OK** — PASS |
| 5d | sgsd-boot.ps1 | file exists + PS AST parse | **PRESENT / parse:OK** — PASS |
| 5e | sgsd-dashboard-host.ps1 | file exists + PS AST parse | **PRESENT / parse:OK** — PASS |
| 6 | .planning/metrics/ writable | `touch .planning/metrics/.preflight-probe-$$` | **WRITABLE** — PASS |
| 7a | crit-backlog.jsonl exists | `test -f .planning/metrics/crit-backlog.jsonl` | **PRESENT** — PASS |
| 7b | crit-backlog.cjs --self-test | `node super-gsd/scripts/lib/crit-backlog.cjs --self-test` | **crit-backlog self-test: PASS** — PASS (exit 0) |
| 7c | check.cjs --self-test | `node super-gsd/tools/status-consistency/check.cjs --self-test` | **status-consistency self-test: PASS** — PASS (exit 0) |

---

## SGSD-CURATE SUGGESTIONS

**New pattern found**: Codex CLI auth in WSL/bash shell context may not
inherit Windows-side environment variables even when the binary is in
PATH. The OPENAI_API_KEY / CODEX_API_KEY presence check should be added
to the cold-start runbook as a pre-flight item. Suggest curating to
`architecture/patterns/cold-start-runbook.md` with note: "Codex CLI
binary presence does not prove auth; check env var existence in the
execution shell before each milestone run."
