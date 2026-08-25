# One finding left. Spec round 2 closed CRITICAL and MEDIUM. HIGH is fail-open on truncation.

## Confirmed CLOSED by the reviewer — do not touch

- CRITICAL ordering: checks run in the top-level dispatcher before publication
  (install.sh:1232-1246), `set -e` active, guard asserts the order and forbids rejecting
  helpers inside post-publication dispatch (guard:1548-1560, 1624-1663).
- MEDIUM laundering: both branches preserve the real sanitized message
  (preflight:56-94), bounded to 2048 bytes with V8 frames and require-stack rows removed.
- The recovery exemption: no abuse path. Candidate rows are copied from computed canonical
  sources, digest-validated, consumed from the sealed descriptor, and revalidated before
  first write. A hook missing from both project and delivery set still refuses.

## HIGH — still open, verbatim

> The classifier correctly rejects short multiline output and remains shared
> (`hook-registration-preflight.cjs:97-101, 706-740`; `hook-install-contract.cjs:651-664`).
> However, smoke output is truncated to 8192 bytes without recording truncation
> (`hook-registration-preflight.cjs:643-667`). A policy-shaped first line followed by
> enough same-line output can push a later load error beyond that boundary; the clipped
> output then satisfies `isCleanPolicyDecision` and is accepted at lines 738-740. The new
> test covers only a short trailing stack (`assert-installer-registration-guard.cjs:1770-1794`),
> not truncation. Therefore the policy decision is not necessarily the whole process output.

## Fix

Truncation must fail closed. Record when smoke output was clipped, and treat clipped
output as NOT a clean policy decision: if we could not see the whole output, we cannot
claim the whole output was a clean decision.

Keep the classifier shared and keep the existing bounded-disclosure behaviour. Do not
raise the 8192 limit as the fix; a bigger buffer moves the boundary without closing the
hole.

## Test

Add a case where a hook emits a policy-shaped decision followed by enough output to exceed
the smoke capture limit, with a load error beyond the cut. Assert the install REFUSES.
Drive the size from the actual limit constant rather than hardcoding a byte count, so the
test cannot silently stop exercising the boundary if the limit changes.

Keep the existing short-trailing-stack case; this is an additional boundary case.

## Constraints

- Only the two allowlisted files.
- Never weaken or delete an assertion.
- No new CLI modes, no installer staging.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify

- installer-registration-guard `--all` 13/13 (plus your new case)
- install-contract 3/3
- Real install from a different cwd into an empty project: exit 0, 17 hooks, 9 modules
- `node --check` on both files

Sandbox denials: mark DENIED, never as passing. The orchestrator re-runs unsandboxed.
Do not ask for approval.

Standard block format, max 200 words.
