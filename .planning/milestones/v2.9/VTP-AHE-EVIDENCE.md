# VTP Evidence - Agentic Harness Engineering For SGSD

Paper: Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses
arXiv: 2604.25850v1
VTP slug: `agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a`

Local source:

- `C:\Users\jack.berrow\Voice-Text-Plan\wiki\research\agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.md`
- `C:\Users\jack.berrow\Voice-Text-Plan\wiki\research\agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.enrichment.json`

## Paper Takeaway

A coding agent is not just a model plus a prompt. The harness around the model decides what the agent can see, what tools it can use, how it recovers, how it records experience, and how it verifies itself.

The paper's AHE loop improves a fixed-model coding agent by editing the harness around it. It does this through three observability pillars:

1. Component observability: every editable harness part is a named file-level component.
2. Experience observability: long trajectories are distilled into layered evidence an agent can actually read.
3. Decision observability: every edit records a prediction, then the next run verifies whether the prediction was right.

## VTP Principles Used

| Principle | SGSD interpretation |
|---|---|
| AHE-P-01 Make action surfaces explicit and reversible | Build a harness component registry instead of scattered implicit edit surfaces. |
| AHE-P-02 Distill experience before asking for change | Convert logs and long transcripts into evidence overviews, task reports, and drill-down traces. |
| AHE-P-03 Turn edits into falsifiable contracts | Require change manifests with predicted fixes and predicted regressions. |
| AHE-P-04 Optimize the harness, not just the prompt | Prioritize tools, hooks, MCP, skills, memory, routing, and gates over more prose rules. |
| AHE-P-05 Hold the model fixed to isolate system gains | Do not count a harness improvement if model, reasoning effort, or budget also changed. |
| AHE-P-07 Use transfer as the overfit test | Test candidate harness edits on held-out tasks/workspaces before clean ship. |
| AHE-P-08 Locate gains by swapping components independently | Add ablation tests for gates, hooks, skills, MCP tools, memory, and workflows. |
| AHE-P-09 Expect non-additive component interference | Detect duplicated checks and stacked controls that burn turns or tokens. |
| AHE-P-10 Treat regression prediction as first-class | Track regression precision/recall, not only fixes. |

## Current SGSD Fit

SGSD already has strong component pieces:

- Failure injection: `super-gsd/tools/failure-injection/harness.cjs`
- Deterministic benchmark: `super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs`
- Blind live controller: `super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs`
- State resolver: `super-gsd/tools/state-resolver/resolve.cjs`
- Live hooks: `super-gsd/scripts/lib/orchestrator-hooks.cjs`
- Double-agent executor: `super-gsd/tools/double-agent-executor/run.cjs`
- MCP status layer: `super-gsd/tools/warp-mcp/server.cjs`
- Cockpit state adapter: `super-gsd/tools/cockpit-state/adapter.cjs`

The gap is not "no tools". The gap is lack of an explicit AHE loop that binds:

```text
component -> evidence -> predicted edit -> measured next-run outcome -> keep/revert/pivot
```

## Local Sanity Checks Run Before Drafting

These checks were run on 2026-04-30 from `C:\Users\jack.berrow\GSDedits`:

```powershell
node super-gsd/tools/state-resolver/resolve.cjs --json
node super-gsd/tools/state-resolver/resolve.cjs --self-test
node super-gsd/tools/warp-mcp/run-self-test.cjs
node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --profile smoke --output-dir .planning/benchmarks/ahe-paper-smoke
```

Observed:

- State resolver reported active v2.7 / Phase 92 from fresh pulse evidence and flagged `STATE.md` as stale projection.
- State resolver self-test passed 14/14.
- Warp MCP self-test passed 47/47.
- Harness benchmark passed 49/49 and wrote report to `C:\Users\jack.berrow\GSDedits\.planning\benchmarks\ahe-paper-smoke\REPORT.md`.

## Design Decision

v2.9 should not build another broad gate. It should build the evidence loop that tells SGSD which gates, hooks, tools, memory entries, and cockpit surfaces deserve to exist.

The safest implementation style:

1. Start read-only with registry and evidence distillation.
2. Add manifests and prediction scoring.
3. Add attribution and revert recommendations.
4. Only then allow bounded harness edits through existing controlled-action and double-agent paths.
