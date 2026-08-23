# P167-T1 fix round 1 — one WARNING from spec compliance

Spec compliance returned PASS-WITH-FINDINGS, 7/7, zero CRITICAL. All seven
controls hold: Pre denies before transport, Post emits a capped
`updatedMCPToolOutput`, correlation uses runtime session plus hook-computed
digest and accepts no agent-supplied tool-use id, the broker withdraws discovery
and rechecks forced calls, the cap and digest are reused rather than
reimplemented, P166 and the frozen artifacts are untouched, and the residual
same-user bypass is honestly under-claimed.

Fix the one warning. Nothing else.

## The finding

> At hook lines 218-220, the installed CLI supplies `expectedEvent`, causing
> unexpected non-substrate tools to be denied or rewritten rather than ignored.
> The test omits `expectedEvent`, so it passes for the wrong reason. The exact
> matcher prevents impact under correct registration, hence WARNING rather than
> CRITICAL.

Two defects in one:

1. **Production.** When `expectedEvent` is set, which is exactly what the
   installed CLI does, a non-substrate tool reaching this hook is denied or
   rewritten instead of ignored. Today the exact matcher means nothing else
   reaches it. That makes this a latent foot-gun rather than a live bug: the
   moment anyone registers this hook with a broader matcher, it starts denying
   unrelated tools, and the failure will look like the tool being broken rather
   than the hook overreaching.

2. **The test.** It omits `expectedEvent`, so it exercises a branch the
   installed CLI never takes. It passes for the wrong reason. That is the P166
   lesson restated: a test that does not run the production path proves nothing
   about production.

## Required

Make a non-substrate event return `null` even when `expectedEvent` is set, so
the hook ignores what is not its business regardless of how it was registered.

Then test the INSTALLED CLI PATH, with `expectedEvent` supplied exactly as the
CLI supplies it. The new assertion must fail against the current code. If it
passes before your change, it is testing the wrong thing.

While you are there, check whether any other case in `assert-hook-contract.cjs`
omits `expectedEvent` and therefore takes a non-production branch. If others do,
say how many and whether they still prove what their names claim. Do not rewrite
the whole suite; report what you find and fix only what is misleading.

## Constraints

Expected scope is `super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` and
`super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs`.
Anything else, say why.

Do not weaken the deny path, the cap, the witness correlation, or the broker.
All 34 existing assertions must still pass, and so must the twelve P166
regressions the orchestrator runs.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

Your sandbox returns `EPERM` at fixture `mkdtemp`, so you may be unable to run
the full suite. Do not claim it. Name it in BLOCKERS; the orchestrator runs it.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: the fix, and how many other cases took a non-production branch
```
