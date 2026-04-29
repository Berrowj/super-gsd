# Token Efficiency Benchmark: Pre Double-Agent Executor Adoption

Generated: 2026-04-29
Purpose: fixed before/after anchor for measuring whether the double-agent executor reduces Claude token spend, especially executor/planner/orchestrator context mass.

This benchmark was captured after the double-agent executor code landed, but before any real SGSD phase/milestone execution was routed through it. Smoke tests were run only with `--self-test`, `--route-only`, or `log:false`; there are no production `execution_route` rows yet.

## Source Ledgers

| Source | Path | Role |
|---|---|---|
| Frozen v1.9 baseline | `.planning/milestones/v1.9/baseline-token-spend.md` | historical baseline from 2026-04-27 |
| Canonical spend ledger | `.planning/metrics/agent-token-spend.jsonl` | role/provider attribution |
| Token attribution stream | `.planning/metrics/token-attribution.jsonl` | exact usage events |
| Legacy token stream | `.planning/metrics/token-log.jsonl` | legacy/stub source |
| Token waste verdicts | `.planning/metrics/token-waste-status.jsonl` | budget/reroute hints |

## Commands

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role
node super-gsd/tools/token-attribution/report.cjs --summary --group-by provider
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone v1.9
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone v2.0
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone v2.1
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role+phase --milestone v1.9
node super-gsd/tools/token-waste/check.cjs --check --json
node super-gsd/tools/double-agent-executor/scorecard.cjs --json
```

## Historical Frozen Baseline From v1.9

From `.planning/milestones/v1.9/baseline-token-spend.md`:

| Metric | Value |
|---|---:|
| Total tokens lifetime at baseline | 3,860,169,073 |
| Total tokens v1.8 | 98,697,639 |
| Total tokens v1.9 at baseline moment | 4,338,390 |
| Sub-agent tokens | 20,841,427 |
| Orchestrator tokens | 3,839,327,646 |
| Cache-read share | 96.4% |

Important: the v1.9 baseline was generated mid-run on 2026-04-27. It is useful as a bloat signature anchor, not as the final full-roadmap total.

## Current All-Time Spend By Role

Command:

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role
```

| Role | Calls | Total attributed tokens | Avg per call | Cache-read ratio | Useful findings per 100k |
|---|---:|---:|---:|---:|---:|
| orchestrator | 12,093 | 4,179,758,064 | 345,635 | 96.3% | 0 |
| planner | 2,304 | 568,056,556 | 246,552 | 96.7% | 8 |
| reviewer | 5,682 | 438,851,490 | 77,235 | 92.3% | 0 |
| researcher | 2,240 | 211,146,344 | 94,262 | 90.7% | 20 |
| executor | 3,567 | 203,212,589 | 56,970 | 90.7% | 23 |
| classifier | 611 | 40,395,927 | 66,114 | 87.3% | 0 |
| other | 322 | 8,773,451 | 27,247 | 74.7% | 1 |

## Current All-Time Spend By Provider

Command:

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by provider
```

| Provider | Calls | Total attributed tokens | Avg per call | Cache-read ratio | Status |
|---|---:|---:|---:|---:|---|
| Claude | 26,744 | 5,650,068,988 | 211,265 | 95.5% | 26,744 ok |
| Codex | 75 | 125,433 | 1,672 | 0.0% | 58 ok, 11 timeout, 6 warn |

Interpretation:

- Codex is almost unused in token terms.
- Claude still carries effectively all execution/orchestration spend.
- The double-agent executor has a clear measurement target: shift bounded executor tasks away from Claude without raising rework, timeout, or scope-violation rates.

## Current v1.9 Spend By Role

Command:

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone v1.9
```

| Role | Calls | Total attributed tokens | Avg per call | Cache-read ratio | Useful findings per 100k |
|---|---:|---:|---:|---:|---:|
| reviewer | 1,365 | 150,195,324 | 110,033 | 95.5% | 0 |
| researcher | 1,056 | 133,502,814 | 126,423 | 91.0% | 11 |
| orchestrator | 510 | 122,104,463 | 239,421 | 94.2% | 0 |
| planner | 285 | 31,790,747 | 111,546 | 86.0% | 46 |
| executor | 205 | 12,080,605 | 58,930 | 83.8% | 160 |
| other | 42 | 1,949,878 | 46,426 | 79.1% | 0 |

Interpretation:

- v1.9 improved execution density: executor had 160 useful findings per 100k.
- Reviewer/researcher/orchestrator remained heavy.
- Executor was not the largest v1.9 spender; but it is the easiest role to safely split between local/Codex/Claude.

## Current v2.0 And v2.1 Spend By Role

Commands:

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone v2.0
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone v2.1
```

| Milestone | Role | Calls | Total attributed tokens | Avg per call | Cache-read ratio |
|---|---|---:|---:|---:|---:|
| v2.0 | orchestrator | 88 | 13,727,402 | 155,993 | 89.2% |
| v2.1 | orchestrator | 60 | 9,126,873 | 152,115 | 89.8% |

Interpretation:

- Later milestones show lower orchestrator average than the v1.9 baseline/offenders, but attribution for non-orchestrator roles is sparse in these filtered summaries.
- This reinforces the need for `execution_route` rows: post-double-agent runs should prove exactly which executor provider handled each task.

## v1.9 Top Phase/Role Hotspots

Command:

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role+phase --milestone v1.9
```

Top sampled rows:

| Role/Phase | Calls | Total attributed tokens | Avg per call | Cache-read ratio | Useful findings per 100k |
|---|---:|---:|---:|---:|---:|
| researcher/45 | 339 | 44,156,903 | 130,256 | 93.9% | 4 |
| reviewer/49 | 214 | 33,901,542 | 158,418 | 96.3% | 0 |
| reviewer/43 | 210 | 29,995,583 | 142,836 | 95.5% | 0 |
| orchestrator/15 | 38 | 28,271,041 | 743,975 | 99.6% | 0 |
| reviewer/50 | 283 | 26,165,649 | 92,458 | 96.0% | 0 |
| researcher/42 | 160 | 20,587,698 | 128,673 | 89.5% | 10 |
| researcher/41 | 127 | 15,632,878 | 123,094 | 88.4% | 13 |
| orchestrator/41 | 57 | 14,828,208 | 260,144 | 96.3% | 0 |

Interpretation:

- Phase 45 researcher is a major target for tighter local/VTP/capsule use.
- Reviewers are expensive and low-yield in the current useful-finding proxy, making Codex/local review substitution a useful target.
- The orchestrator phase tags still contain historical/noisy phase attribution (`orchestrator/15` inside a v1.9-filtered view), so before/after should primarily use role totals plus `execution_route` evidence, not one row alone.

## Token Waste Gate Snapshot

Command:

```powershell
node super-gsd/tools/token-waste/check.cjs --check --json
```

| Metric | Count |
|---|---:|
| rows evaluated | 26,819 |
| ok | 2,924 |
| warn | 6,600 |
| degraded | 17,295 |

Top route hints:

| Route hint | Count |
|---|---:|
| orchestrator_turn_trim_candidate | 10,365 |
| codex_reviewer_fallback_candidate | 5,403 |
| executor_context_packet_candidate | 2,741 |
| researcher_local_script_candidate | 1,664 |

Interpretation:

- The pre-double-agent system already detects a large amount of reroutable work.
- The key benchmark is whether future runs reduce these counts, especially `executor_context_packet_candidate` and `codex_reviewer_fallback_candidate`.

## Double-Agent Executor Baseline

Command:

```powershell
node super-gsd/tools/double-agent-executor/scorecard.cjs --json
```

Current production rows:

| Metric | Value |
|---|---:|
| execution_route rows | 0 |
| accepted tasks | 0 |
| Codex execution tasks | 0 |
| local-script execution tasks | 0 |
| Claude handoff tasks | 0 |
| fallbacks | 0 |
| timeouts | 0 |
| scope violations | 0 |

This is expected. The double-agent executor has been implemented and self-tested, but has not yet been used for production SGSD phase execution.

## Before/After Scorecard Targets

After a real phase/milestone run with the double-agent executor enabled, compare:

| Target | Baseline | Desired Direction |
|---|---:|---|
| executor total attributed tokens | 203,212,589 all-time / 12,080,605 in v1.9 | down for similar task count |
| executor avg tokens/call | 56,970 all-time / 58,930 in v1.9 | down |
| planner avg tokens/call | 246,552 all-time / 111,546 in v1.9 | down |
| orchestrator avg tokens/call | 345,635 all-time / 239,421 in v1.9 | down |
| Codex execution task count | 0 production rows | up, but only for bounded tasks |
| local-script execution task count | 0 production rows | up for deterministic work |
| scope violations | 0 | stay 0 |
| accepted first-pass tasks | 0 | up |
| rework/fallback rate | no production DAE baseline | low and visible |
| token-waste degraded rows | 17,295 all-time | down over comparable new runs |

## Recommended Comparison Protocol

Use one future milestone or 5-10 bounded tasks as the first measured run.

Before run:

```powershell
node super-gsd/tools/double-agent-executor/scorecard.cjs --json
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role
node super-gsd/tools/token-waste/check.cjs --check --json
```

After run:

```powershell
node super-gsd/tools/double-agent-executor/scorecard.cjs --json
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role --milestone <new-milestone>
node super-gsd/tools/token-waste/check.cjs --check --json
```

Primary pass/fail for the pilot:

1. `execution_route` rows > 0.
2. Codex/local-script handle at least one bounded task.
3. Scope violations = 0.
4. Accepted or safely-fallback rows only.
5. Executor average tokens for the pilot < v1.9 executor average of 58,930.
6. No increase in verifier/ATC rework caused by bad routing.

