---
name: blind-agent-root-cause-is-a-hypothesis
description: A sub-agent that cannot execute the failing test produces plausible root causes, not findings; measure before dispatching a fix built on one
metadata:
  type: anti-pattern
---

# A root cause from an agent that cannot run the test is a hypothesis

P167-T2, 2026-08-23. A fixture failed with `'deny' !== 'allow'`. Codex, whose
sandbox returns `spawnSync EPERM` and cannot run the suite, reported:

> The exact first unmet precondition is
> `guard_unavailable:pretooluse_missing`. The isolated path sits under the
> repository, so the hook climbs past the fixture to the repository root, whose
> settings do not contain the fixture's PreToolUse registration.

Specific, mechanistic, and confident. It even corrected an earlier hypothesis to
reach it, which made it read as investigation rather than inference. It was
wrong.

Four fix rounds were dispatched against it. Each failed. The orchestrator then
instrumented `processHookPayload` and ran the suite:

```
reason: substrate_witness_denied:project_runtime_unavailable
```

`loadProjectRuntime` was throwing because the fixture project could not resolve
Ajv from its own `super-gsd/tools/plan-schema/node_modules`. The deny happened
BEFORE readiness, registration, key or payload were checked, which is exactly
why the missing-registration story looked credible: every symptom it predicted
was also consistent with the real cause.

One dispatch carrying the measured reason fixed it.

**The rule:** when a sub-agent cannot execute the failing thing, treat its
"root cause" as a hypothesis and measure before building a fix on it. One
instrumented run costs minutes; four blind fix rounds cost an hour.

**How to measure cheaply:** monkey-patch the production entry point in-process,
log what it actually returns, then run the real suite. This is diagnosis, not
authoring a delta, so it stays inside the orchestrator's lane.

**Tell the agent, too.** Ask it to state what it would measure rather than why
it thinks something failed. That distinction is the whole finding.

Related: [[orchestrator-runs-spawn-bound-suites]],
[[orchestrator-verification-discipline]], [[self-reported-evidence-is-not-a-witness]].
