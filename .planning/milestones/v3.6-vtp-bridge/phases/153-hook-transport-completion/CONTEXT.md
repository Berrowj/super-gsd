---
phase: "153"
slug: hook-transport-completion
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: ["149", "151", "152"]
governing_decision: null
scope_locked_by: operator
scope_locked_at: 2026-08-18
---

# P153 Context — Hook Transport Completion

## Goal
Bind SGSD governance policy to the Claude Code event surface it was written for.
Three phases of governance mechanism (P149 skill-routing, P151 demand baseline,
P152 KB-triage shadow) are driven by a classifier that is not registered to any
hook event and therefore never executes in a live session. This phase makes the
transport real, proves it with live negative evidence, and adds the one
enforcement kind the stack lacks: a block.

## Verified evidence (this session — measured, not assumed)

1. `super-gsd/hooks/sgsd-intent-classifier.cjs:5` self-declares as a
   **UserPromptSubmit** hook. It parses `payload.prompt`, evaluates
   `session-governance-hooks.yaml`, and drives planning-triage,
   kb-lookup-triage, and the P149 24-route skill-routing table.
2. Live `~/.claude/settings.json` registers exactly four events —
   SessionStart, PreToolUse, PostToolUse, Stop (14 scripts). **No
   UserPromptSubmit.**
3. No project-level `.claude/settings.json` exists in this worktree.
4. `super-gsd/config/repo-settings-overlay.json` DOES declare
   `UserPromptSubmit -> node`, and `merge-settings.js` exists to install it.
   It was never merged here.
   => Instance **#7** of `harness-production-seam-four-layers`: mechanism
   built and tested, production caller absent.
5. Found while running the triage that produced this phase:
   `sgsd-triage-runtime.cjs` emits MCP args that violate the MCP tool
   schemas. `context.recent_turns` is emitted as an array of strings where
   `vtp_route_and_retrieve` requires objects with a `text` field (hard
   `-32602` rejection), and `raw_query`/`context`/`fallback_reason` are
   emitted to `vtp_search_substrate`, which accepts only `query`. The staged
   "runtime decides, Claude transports" protocol built in P148 therefore
   cannot be executed verbatim as its own skill specifies.
   => Instance **#8**, inside the seam-fixing mechanism itself.
6. Enforcement kinds today are four — `directive`, `suggestion`,
   `report_only`, `shadow`. None can block. The classifier has no exit-2 path
   (`process.exit` appears only for `selfTest()` and `exit(1)`).
7. `super-gsd/tools/codex-hooks/block-secret-leak.cjs` already reads
   UserPromptSubmit JSON from stdin and blocks credential-bearing prompts —
   but is wired to the **Codex** hook surface (`.codex/hooks.json`) only.
   Blocking exists on one side of the house and not the other.

## VTP enrichment (vtpMode=fallback, routeOk=true, 8 hits)
Top hit — AHE paper, `wiki/research/agentic-harness-engineering-*`: iteration-6
middleware "emitted the right warnings ... but the warnings were appended only
to the tool output, and on the very next model turn the agent ignored them and
published." What fixed it was a hard block at the shell layer naming the
protected resource; iteration 8 reached 76.97, the run's high-water mark and
its single biggest jump. This is direct empirical support that warning-only
enforcement does not change agent behaviour and a real blocking primitive does.

Evidence artifact written by runtime to
`.planning/milestones/v3.5/phases/150-propagation-trust-runbook/VTP-EVIDENCE.md`
(mis-targeted — runtime derives path from `STATE.current_phase`, which is stale
at 150; see Known defects).

## Scope — operator-locked 2026-08-18: T0 + T1 + T2

### T0 — Runtime→MCP arg contract
Per-tool arg-shaper so emitted MCP calls validate against the real tool
schemas, plus a schema-conformance test. Without it the staged protocol is
unexecutable as specified and every future triage silently degrades.

### T1 — Registration + live falsifier
Merge `repo-settings-overlay.json` through the existing `merge-settings.js` so
`UserPromptSubmit -> sgsd-intent-classifier.cjs` is registered. Falsifier must
assert BOTH directions against a real session id:
- planning-shaped prompt appends a route-decision row naming the matched route
- execution-shaped prompt appends a row **explicitly recording no match**

Negative evidence MUST be a written row, never an absent one. An absent row is
indistinguishable from "the hook never ran" — the exact defect that made P150's
trust probe (instance #6) report a false negative.

### T2 — `block` enforcement kind
Fifth kind beside the existing four. Contract: matched blocking route ->
operator-facing reason on stderr naming the trigger -> `exit(2)`. Registry
validation MUST reject `kind: block` carrying an empty reason, so a block can
never fire mute. First consumer: `block-secret-leak.cjs` promoted to
dual-surface — one implementation, two callers (Codex + Claude Code) — not a
copy.

## Boundary (explicitly OUT)
- P152 stays `shadow`. Its 28-day promote-or-kill metric has not unlocked;
  this phase builds transport only and flips nothing.
- No binding of PostToolUseFailure, SubagentStart/Stop, PermissionRequest,
  Notification, SessionEnd, or Setup. Five of those have no policy consumer
  today; wiring them now is completeness theatre. Deferred to a follow-up
  phase gated on a real consumer existing.
- No deterministic PostToolUse validator pre-filter (deferred with the above).
- Zero source copied from `disler/claude-code-hooks-mastery`. That repo has NO
  LICENSE file and is therefore all-rights-reserved. Event taxonomy and
  exit-code semantics are facts about Claude Code, not his code; take those
  only.
- Do NOT port Python/uv hooks. `hooks.yaml` sets `timeout_sec: 2` and uv
  cold-start on Windows exceeds that on every tool call. Node `.cjs` only.

## Known defects to fix or forward
- `STATE.md` frontmatter `current_phase` is stale at "150" while v3.6 has
  P151/P152 closed. This mis-targets runtime-derived evidence paths (observed
  above). Correct as part of this phase's state update.

## Execution constraints
- Claude orchestrates; Codex GPT-5.6-sol performs all source-changing work.
- Every unit independently `git revert`-able.
- T0 and T2 are independent. T1 gates T2's consumer firing live.
