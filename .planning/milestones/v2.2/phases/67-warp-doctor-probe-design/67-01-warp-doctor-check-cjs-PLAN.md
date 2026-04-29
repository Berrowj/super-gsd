---
plan_id: 67-01
phase: 67
title: Warp Doctor check.cjs + run-self-test.cjs
type: code (FULL tier ATC; READ-ONLY invariant enforced)
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: full
model: sonnet
files_touched:
  - super-gsd/tools/warp-doctor/check.cjs
  - super-gsd/tools/warp-doctor/run-self-test.cjs
---

# Plan 67-01 — Warp Doctor check.cjs + run-self-test.cjs

## Goal

Implement the read-only Warp + SGSD setup diagnostic at
`super-gsd/tools/warp-doctor/check.cjs` mirroring the v2.1 `upgrade-drift`
shape, plus the thin `run-self-test.cjs` spawnSync shell.

## Probe Set (>= 12)

Seeded from Phase 63 audit findings:

| # | Probe name | What it checks | Source phase | Phase 63 §  |
|--:|---|---|---|---|
| 1 | `warp_env_present` | `process.env.TERM_PROGRAM === 'WarpTerminal'` | Phase 67 | B.1 |
| 2 | `sg_command_defined_in_profile` | grep `function sg {` in `$PROFILE` | Phase 67 | A.1, A.2 |
| 3 | `sgsd_command_defined_in_profile` | grep `function sgsd {` in `$PROFILE` | Phase 67 | A.1 |
| 4 | `sgsd_setup_command_defined_in_profile` | grep `function sgsd-setup {` in `$PROFILE` | Phase 67 | A.1 |
| 5 | `warp_workflows_dir_present` | `.warp/workflows/` exists in project | Phase 67 | D.1 |
| 6 | `warp_workflows_yaml_shape` | each `.warp/workflows/*.yaml` parses + has name/command/tags | Phase 67 | D.2 |
| 7 | `warp_md_present` | `WARP.md` exists at repo root | Phase 67 | A.1 |
| 8 | `agents_md_present` | `AGENTS.md` exists at repo root (Phase 65 deliverable) | Phase 65 | — |
| 9 | `claude_md_present` | `CLAUDE.md` exists at repo root | — | — |
| 10 | `launch_config_dir_present` | `~/.warp/launch_configurations/` exists | Phase 67 | C.1 |
| 11 | `warpindexingignore_present` | `.warpindexingignore` at repo root | Phase 67 | E.1 |
| 12 | `warp_install_present` | Warp.exe at standard Windows install path | Phase 67 | B.3 |
| 13 | `claude_cli_resolvable` | `claude` CLI on PATH (probed via `which`/`where`) | Phase 67 | A.3 |
| 14 | `codex_cli_resolvable` | `codex` CLI on PATH | Phase 67 | A.3 |
| 15 | `mcp_config_present` | placeholder; returns NOT-APPLICABLE until v2.3 | — | — |
| 16 | `codebase_context_state` | always returns MANUAL-CHECK-REQUIRED (UI-bound) | Phase 63 Q10 | E.2 |

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author `super-gsd/tools/warp-doctor/check.cjs` | 4 public APIs Lock-13-wrapped; frozen PROBE_NAMES (16 entries); frozen REASON_NOTES; frozen STATUS_VALUES; READ-ONLY |
| 2 | Author `super-gsd/tools/warp-doctor/run-self-test.cjs` | Thin spawnSync shell mirroring upgrade-drift |
| 3 | Implement 16 probes per table above | Each probe Lock-13-wrapped; degraded sentinel on unknown name/error |
| 4 | Implement `--project <path>` / `--self-test` / `--json` / `--help` CLI flags | All flag combinations parse cleanly; --help exits 0 |
| 5 | Implement table renderer (default stdout output) | Compact 2-3 column table; status colour-coded if TTY (optional) |
| 6 | Implement JSON renderer (`--json` flag) | Stable schema: `{ok, schema_version, ts, probes:[...], summary:{...}}` |
| 7 | Implement selfTest with 12-15 assertions | A1=PROBE_NAMES frozen+length; A2=REASON_NOTES frozen; A3-A4=bad input degraded; A5=READ-ONLY scan; A6=ASCII-only; A7-A14=per-probe shape |
| 8 | Run `node run-self-test.cjs` and capture output | Exit 0; all assertions PASS |
| 9 | Run `node check.cjs --project C:\Users\jack.berrow\GSDedits` and capture output | Exit 0 or 1 with actionable; no fs writes |
| 10 | Verify READ-ONLY invariant via git diff before/after live --run | `git status` byte-identical |

## Surgical Constraint (Karpathy)

Every line in `check.cjs` must serve one of: probe definition, frozen
vocabulary, public API wrapper, CLI handler, table/JSON renderer, selfTest
assertion. No filler comments beyond the canonical header block (matching
upgrade-drift convention). No "while I'm here" probes — if it's not in the
16-probe table, don't add it. New probes are a follow-up Plan, not an
in-loop addition.

## Self-Test Floor

```bash
node super-gsd/tools/warp-doctor/run-self-test.cjs
# Expected:
#   12-15 selfTest assertions PASS
#   exit 0
#   no .planning/metrics/* files modified
#   no .warp/* files modified
#   no super-gsd/* files modified (other than the 2 new tool files)

node super-gsd/tools/warp-doctor/check.cjs --project C:\Users\jack.berrow\GSDedits
# Expected:
#   table emitted with 16 probes
#   summary line showing N PASS / N MISSING / N MANUAL-CHECK / N N-A
#   exit 0 (clean) or 1 (with at-least-one MISSING)
#   git status before/after byte-identical
```

## Acceptance (Plan-Level)

- All 10 tasks complete.
- Self-test green.
- Live --run on this checkout produces actionable output.
- READ-ONLY invariant mechanically verified.
- `git diff --stat` after this plan shows additions only under
  `super-gsd/tools/warp-doctor/` + `.planning/milestones/v2.2/phases/67-…/`.

## Out Of Scope

- PowerShell `warp-doctor` alias wrapper (defer to follow-up).
- Hooks for v2.3 MCP config (placeholder probe; follow-up at MCP ship).
- Documentation in WARP-DOCTOR-README.md (defer; the file's header block is the docs).
