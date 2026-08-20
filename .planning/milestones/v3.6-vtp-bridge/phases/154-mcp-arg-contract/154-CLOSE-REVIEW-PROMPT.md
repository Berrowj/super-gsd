# P154 combined close review — spec compliance + ATC in one pass (overnight contract)

Read only. Phase P154 is small: two commits (f8a4b72 T1, 35a1124 T2). Review both
against the plan `154-01-PLAN-LOCKED.md` (including AMENDMENT-1) in
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/`.

Evidence already verified by the orchestrator, do not re-run: RED run preserved in
the T1 report; emitted-args PASS; legacy staged-vtp-healthy PASS; real-evidence PASS
against 154-REAL-MCP-EVIDENCE.json whose call-1 response echoes the fixture context
proving verbatim transmission.

SPEC: any plan requirement unmet, any extra scope (diff both commits yourself), and
whether the evidence file's _elided markers are honest recording rather than evidence
laundering (the verifier checks error state and non-emptiness; deep bodies elided
with disclosure).
ATC: anti-slop over the diff — schema file quality (full constraints vs bad-keys-only
reduction), shaper placement (single emission boundary, not scattered), test
duplication vs the declared-schema file, dead code.

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required
FINDINGS_DETAIL: [severity] [dimension] <description>  (per finding, omit if none)
```
Overnight rules: one fix round exists; a second CRITICAL closes the phase
BLOCKED-WITH-GAP-PLAN. Weigh accordingly.
