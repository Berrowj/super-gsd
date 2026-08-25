# P167-T4 fix round 3 — spec compliance FAILED, 1 CRITICAL and 2 warnings

Seven of eight checks pass. Same-project enforcement is genuinely fail-closed:
audit exits 2, mandatory installer repair failures return nonzero, the broker
filters the tool from `tools/list` and forced calls return `isError` before any
upstream forwarding. Grant ordering, four-agent withdrawal, managed-ID dedupe and
idempotence, the ordered basename check, the 31-occurrence P166 inventory, the
seven-file scope and the honesty bound all pass. Do not disturb any of it.

## CRITICAL 1 — the fail-open case came back across projects

> `audit.cjs` binds every broker definition, including user scope, to the
> installing project, while grant-bearing agents are global. In project B, a user
> broker bound to guarded project A checks A's hooks; B's absent hooks are never
> consulted, so `tools/list` exposes substrate and `tools/call` forwards. Prompt
> acceptance fails only afterward, which is the original defect.

Read that carefully, because it is the exact defect this phase exists to close,
displaced by one level.

The asymmetry is the bug: the grant is GLOBAL (user-scoped agents), the guard is
bound to ONE project (the installing one). So a second project inherits the
capability without inheriting the enforcement. Its own missing hooks are never
consulted. Everything downstream then behaves as it did before P167: the tool
lists, the call forwards, the response reaches context, and only afterwards does
acceptance object.

Required: **broker authority must be bound to the INVOCATION project, not the
installing project.** Whichever project the call is actually made from is the
project whose hooks, key and registrations must verify. If that project cannot
prove readiness, the tool must not list and a forced call must not forward.

Add the test the reviewer named: a user-only upstream, two projects, one guarded
and one not, and prove the unguarded project is denied. That test must fail
against the current code before you change it.

## WARNING 2 — broker identity is too loose

> `isBrokerDefinition` checks command and args but ignores extra `env`, `cwd`,
> `type`, URL, or header fields. Such broker drift audits as current.

A definition that keeps the right command but adds an `env` override, a
different `cwd`, a changed `type`, or a URL and headers, is not our broker, yet
audits as current. Require an exact or explicitly allowlisted shape, and add
mutation tests covering each of those fields.

## WARNING 3 — a delete-before-archive ordering that can lose data

> With mixed valid-stdio and unsupported direct scopes, `audit.cjs:638-642`
> deletes every direct definition before archiving any.

If archiving fails part-way, or an unsupported scope is present alongside a
supported one, supported originals can be destroyed. Preserve supported
originals privately first, or roll back on failure, while still ending
raw-free. Never leave the user's own upstream definition unrecoverable.

## Constraints

Same seven T4 files. If closing CRITICAL 1 genuinely needs a file outside them,
stop and say which and why rather than silently exceeding scope; T3 already set
that precedent.

Do not weaken T1 (34/34), T2 (13/13), T3 (4/4), the four registration-guard
cases, or any P166 regression. The P166 caller inventory must still account for
every occurrence exactly; do not loosen it.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Verification reality

You cannot run fixture suites, the guard cases, or bash (`EPERM`). You CAN run
`node -e "require(...)"` load checks and `node --check`. Do those; do not claim
anything else. The orchestrator runs the rest and reports exact failures back.

Apply edits early, emit `PROGRESS: <line>` per unit; wrappers have been killed
repeatedly near the twenty and fifty minute marks.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: how broker authority now binds to the invocation project
```
