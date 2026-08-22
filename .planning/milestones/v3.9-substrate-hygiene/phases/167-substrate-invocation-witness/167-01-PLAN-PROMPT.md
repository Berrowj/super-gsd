# P167 planning task — author 167-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. Node works. Never spawn claude (EPERM).

## Read first, in this order

1. `.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/CONTEXT.md`
   Authoritative scope and the five questions this phase must settle.
2. `.../167-substrate-invocation-witness/RESEARCH.md`
   All five are answered. Treat its file-and-line citations as established fact
   and do not re-derive them.
3. `../166-substrate-call-filters/SUMMARY.md`, especially DEFERRED-1, plus
   `AUDIT.md` for what P166 could and could not gate.
4. `super-gsd/hooks/sgsd-activity-logger.js` (full `tool_input` at :117, preview
   truncation at :160 and :172), `super-gsd/hooks/sgsd-commit-gate.cjs` (:416
   says it is not tamper-proof), `super-gsd/tools/codex-hooks/block-secret-leak.cjs`
   (:90 exit-2 denial precedent), `super-gsd/tools/feature-propagation/audit.cjs`
   (:356-430 agent copy, :706 Codex-hooks-only inspection).
5. `super-gsd/scripts/lib/vtp-context-composer.cjs`, especially
   `substratePayloadDigest` at :375 and `acceptPromptSubstrateCallRecord`.
6. `super-gsd/templates/plan-schema-v2.json`. Use P166's
   `166-01-PLAN-LOCKED.md` as house style.

## What research established

- `PreToolUse` can DENY before execution via
  `hookSpecificOutput.permissionDecision: "deny"` or exit 2, and denial survives
  bypass-permissions mode.
- Hooks receive the FULL `tool_input`. The logger's truncation is only in what it
  persists.
- `PostToolUse` CAN replace a result before the model sees it, via
  `updatedToolOutput` / `updatedMCPToolOutput`. Installed Claude Code is 2.1.240.
- Correlation needs no agent-reported identifier: `session_id` plus a payload
  SHA-256 the hook computes itself with `substratePayloadDigest`. `tool_use_id`
  is hook-only and should key an internally consumed witness row. Asking the
  agent for it would recreate the self-report.
- P147's tamper-evidence does NOT transfer. It protects record shape with an
  unkeyed hash, says it is not tamper-proof, and does not protect hook presence.
- Feature propagation does NOT register Claude hooks, and missing hooks are
  non-blocking, so a fresh machine FAILS OPEN.

## Scope, operator-approved

The operator approved the full scope on the researcher's recommendation. The
plan must cover all four, because a witness present only on the authoring
machine is decorative:

1. The witness and denial mechanism itself: `PreToolUse` validating the real
   `tool_input` against the P166 v2 substrate schema and denying invalid calls;
   `PostToolUse` applying the existing `capSubstrateResponse` before the result
   reaches the model.
2. Propagation: hook registration must travel with the installed agents that
   `audit.cjs` writes, and be auditable.
3. Fail-closed absence detection: when the hook is not registered, something must
   refuse or loudly degrade rather than silently allow. Decide where that check
   lives and what it blocks. If a managed-policy authority is the better answer,
   say so and plan that instead.
4. Witness-ledger protection: the ledger a hook writes must not be trivially
   forgeable by the thing being witnessed. Given P147 does not transfer, state
   plainly what your mechanism does and does not guarantee. Do not overclaim.

## Mandatory completion evidence

Research is explicit: a real MCP denial-and-rewrite run is required. A test that
simulates the hook proves nothing about production. This is P166's central
lesson, stated in its own `known_deadends`: do not treat validation in a test as
enforcement. At least one SAC must rest on the hook actually firing in a live
runtime and must say how that run is captured.

## Constraints inherited from P166

- Do not weaken the gateway, the eight-site caller inventory, the 16,000
  character per-hit cap, or `acceptPromptSubstrateCallRecord`. This phase ADDS a
  witness; the evidence binding stays.
- `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` and
  `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`
  stay byte-unchanged. Reuse the v2 schema; do not fork it.
- Do not touch any VTP-host file. `wiki/LINT-REPORT.md` is not ours.
- Do not raise or bypass `VTP_RESPONSE_MAX_BYTES`.
- Reuse `capSubstrateResponse` and `substratePayloadDigest` rather than
  reimplementing either.

## Plan shape guidance

Task count is yours, but P166 shipped 2 tasks over 11 files and needed 6 fix
rounds; smaller, independently revertible tasks would have cost less. Prefer
more, smaller tasks over two large ones. Every task states its own revert range.

Write real-data `semantic_acceptance_criteria` per SCHEMA-09/-10, each with a
runnable `verification_cmd`. At least one must be the live-runtime proof above.
State in `known_deadends` anything you considered and rejected, especially any
design where the agent supplies its own identifier.

Note for the executor, which the plan should carry: the Codex sandbox returns
`spawnSync EPERM` for nested Node processes and cannot run spawn-bound suites.
Name any such suite as orchestrator-owned so the executor reports honestly
instead of claiming a pass.

## Validate before finishing

```
node super-gsd/tools/plan-schema/validate.cjs \
  --plan-file .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md \
  --project-dir . --mode write
```

Exit 0 required. No emoji, no em dashes.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max
150 words.
