---
status: PASS
verdict: PASS
phase: "167"
slug: substrate-invocation-witness
milestone: v3.9-substrate-hygiene
goal_met: YES
verified: 2026-08-25
verifier: codex gpt-5.5/xhigh
head: 7b201fc
sac_1: MET
sac_2: MET
sac_3: MET
sac_4: MET
sac_5: MET
sac_6: MET
regressions: none
---

# P167 verification

GOAL_MET YES. All six semantic acceptance criteria MET with implementation citations.
VERDICT PASS. Full verifier output in `167-VERIFY-ROUND2.md`.

## Criteria

| # | Criterion | Verdict | Citation |
| --- | --- | --- | --- |
| 1 | Live denial and rewrite in a real runtime | MET | `sgsd-substrate-invocation-witness.cjs:152-177`, `:192-245` |
| 2 | Authenticated, correlated, single-use witness | MET | `substrate-invocation-witness-store.cjs:279-304`, `:486-510`, `:513-575`; `vtp-context-composer.cjs:516-584` |
| 3 | Installation and propagation | MET | `repo-settings-overlay.json:4-16,60-71`; `feature-propagation/audit.cjs:672-705`, `:1352-1431`, `:1479-1523` |
| 4 | Capability withdrawal | MET | `substrate-capability-broker.cjs:298-333`; evidence `:371-467`, `:468-566` |
| 5 | Same-user boundary characterised honestly | MET | evidence `:591-698`, `:699-846` |
| 6 | P166 and earlier behaviour preserved | MET | `vtp-context-composer.cjs:374-408`; hook `:141`, `:207`; frozen hashes `:56-64` |

## Real-runtime proof, not a staged response

Criterion 1 forbids direct hook invocation or a staged response as evidence. The
artifact records Claude Code 2.1.243 under bypass permissions with transport
`real_stdio_mcp` and installed hook digests (`167-REAL-MCP-HOOK-EVIDENCE.json:5-45`),
actual Claude hook-lifecycle and tool events (`:106-148`), exactly one fixture-owned
`tools/call` (`:226-290`), and a transcript-observed 16,000-character replacement with
the discarded-tail marker absent (`:292-303`). The capture derives those facts from
Claude stream output and the fixture log before emitting evidence
(`capture-live-runtime.cjs:1159-1222`).

## DLB-07 semantic check

No criterion is green on shape alone. Criteria 1, 4 and 5 rest on captured runtime,
transcript and fixture traffic; 2, 3 and 6 trace to operative production branches.

## Remaining bypass, stated not hidden

A same-user actor with Bash or Write can restore direct MCP access, invoke upstream over
stdio, or replace the broker, without producing a witness. This is the bounded scope the
operator ruled on at plan revision 3, and the capture proves it positively rather than
leaving it unmeasured: `same_user_bypass_invocations: 2`.

## Not independently re-run by the verifier

The read-only sandbox denies `mkdtemp`, so temp-writing suites could not be re-executed
inside the verifier. It audited the orchestrator's unsandboxed results instead: guard
12/12, T1 38/38, T2 13/13, T3 4/4, T4 pass, feature-propagation 15/15, P166 6/6,
P154 pass, live capture PASS with independent verify PASS.
