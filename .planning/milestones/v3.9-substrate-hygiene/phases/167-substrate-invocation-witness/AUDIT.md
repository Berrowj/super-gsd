---
phase: "167"
slug: substrate-invocation-witness
milestone: v3.9-substrate-hygiene
audit_date: 2026-08-25
atc_verdict: PASS
atc_score: 9/10
muda_verdict: WARN
critical_findings: 0
major_findings: 0
minor_findings: 1
production_defect_escapes: 2
---

# P167 audit

## Verdicts

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Phase verifier | PASS, GOAL_MET YES, 6/6 criteria MET | `167-VERIFY-ROUND2.md` |
| Phase ATC round 3 | PASS 9/10, 0 CRITICAL, 0 MAJOR, 1 MINOR | `167-PHASEATC-ROUND3.md` |
| MUDA | WARN on all eight wastes | `167-WASTE.md` |
| Installer registration guard | 12/12 unsandboxed | orchestrator run |
| T1 hook contract | 38/38 | orchestrator run |
| T2 witness correlation | 13/13 | orchestrator run |
| T3 prompt contracts | 4/4 | orchestrator run |
| T4 propagation | PASS | orchestrator run, PowerShell |
| T5 live capture | PASS, independent verify PASS | `167-REAL-MCP-HOOK-EVIDENCE.json` |
| feature-propagation self-test | 15/15 | orchestrator run |
| P166 policy regression | 6/6 | orchestrator run |
| P154 frozen evidence | PASS | orchestrator run |

Live capture: `active_invocations 1`, `absent_invocations 0`,
`same_user_bypass_invocations 2`, Claude Code 2.1.243, `real_stdio_mcp`.

## What two ATC rounds rejected

Round 1 raised a CRITICAL: a fix instruction of mine said to fail safe by passing the
original result through, contradicting locked plan lines 187 and 264-267. Bounded
failure was restored and `post_passthrough` removed. Round 3 independently greps 0
passthrough occurrences across the hook and the store.

Round 2 raised a CRITICAL on the installer. `install_global_assets` ran
`repair_substrate_capability` before missing Codex entry sources were known, so a
combined `--install-global --init-project` or `--update` could provision a witness key,
copy substrate runtime files, merge `.claude/settings.json` and write broker grants,
and only then refuse. `precheck_installation_refusals` now runs the shared Codex-entry
detector and the substrate pre-check ahead of every writer on every entry point. Round 3
confirms flags are fully parsed before dispatch, so no argument ordering bypasses it.

## The regression this phase introduced and shipped red until close

Five installer-registration-guard cases pass at 44e7861 (P161) and failed from P167
until 2c237ef: `smoke-static`, `vendored-nine-hook`, `node-check-both-sites`,
`sgsd-update-clarity-shape`, `sgsd-update-clarity-recovery`. Nothing ran the suite
between P161 and phase close, so the phase carried a broken install contract for its
whole length. This is the same install machinery the operator reported as failing in
other repositories.

MUDA's process answer, adopted: make the complete twelve-case guard suite a required
unsandboxed, path-triggered commit check whenever installer, hook manifest or overlay,
merge, audit, or guard files change, so the first offending commit is rejected rather
than the phase close.

## Production defect escapes, 2

1. `parseMcpDomain` rejected the bare-array `tool_response` shape the live runtime
   actually sends. Every valid substrate search would have had its result replaced with
   an error. Found only by the live capture, fixed in 99a8790.
2. The deferred installer refusal above, found by phase ATC, fixed in 2c237ef.

Both reached committed production code. Neither was caught by any offline test.

## Outstanding

One MINOR, accepted: `install.sh:729,938,1038` repeat detection after the entry-point
pre-check. Defence in depth, not removed.

`capture-live-runtime.cjs` exports `parseArgs` with no repository consumer (MUDA item 5).
Left in place; it is a test harness, not production.
