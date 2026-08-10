---
created: 2026-08-10
source: P150 T150-06 live execution
priority: medium
target: post-v3.5
---

# Trust-probe reads project ledger; globally-installed hook writes global ledger

## Observed (T150-06)
The forbidden-write trust probe in PROPAGATION.md checks
`~/GSDedits/.planning/metrics/codex-tool-events.jsonl` for newly appended bytes
after a live codex dispatch. The guard fired correctly (codex reported
"Hook denied", forbidden file absent, hook self-test returns forbidden_path),
but the probe threw "no newly appended bytes" because the GLOBALLY-installed
block-forbidden-write.cjs resolves metricsPath via
`path.resolve(__dirname, "../../..")` = the global install root, so its block
row lands in the global ledger, not the project one.

## Fix
Probe must read the hook's ACTUAL metricsPath (derive from the installed hook's
__dirname, or have the hook echo its ledger path, or query the global ledger).
Same hook-resolves-global-vs-project seam class as P148 staged-MCP work — trace
the production write path, don't assume project-relative.

## Impact
T150-06 AC-150c is satisfied on substance (3 independent proofs). This is a
probe-fidelity fix, not a security gap.
