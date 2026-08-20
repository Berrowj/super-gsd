# P157 plan review — single round (overnight contract), ATC + MUDA

Read only. Plan: `.planning/milestones/v3.6-vtp-bridge/phases/157-vtp-readiness/157-01-PLAN-LOCKED.md`,
CONTEXT.md beside it, plus the wiring targets it names (Rule 0 in
sgsd-orchestrate SKILL, the manual readiness path, settings-overlay merge).

Checks, in order of importance:
1. SECRETS: any SAC, fixture, or verification that reads/echoes a real env VALUE is a
   CRITICAL. Env NAMES + existence/connect checks only; fixtures must use fake values
   in isolated process.env.
2. Review change 7: does the falsifier exercise BOTH the automatic Rule 0 path AND the
   manual readiness invocation, not just checker functions? Checker-only tests are the
   named-insufficient AC.
3. dist-vs-src probe verdict must be "reconnect MCP", never "rebuild" (P148 stale-child
   lesson); hooks get no network (T3 is a cheap count read only).
4. Scope: no VTP source changes, no new MCP tools, no resolver/registry semantics
   changes. Smuggling is CRITICAL.
5. MUDA: 3 tasks — right-sized or padded? Name any mergeable pair.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```
Overnight contract: NOGO gets ONE fix round; second NOGO closes BLOCKED-WITH-GAP-PLAN.
