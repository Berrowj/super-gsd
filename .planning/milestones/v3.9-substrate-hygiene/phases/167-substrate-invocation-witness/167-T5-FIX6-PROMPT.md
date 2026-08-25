# P167-T5 fix round 6 — the hook fires; your parser attributes it to nothing

The instrumentation you added answered it in one run. Thank you, it was decisive.

## The measurement

```
active_hook_lifecycle pre_summary  = {"started":0,"responses":0,"successful":0,"output_sha256":[]}
active_hook_lifecycle post_summary = {"started":0,"responses":0,"successful":0,"output_sha256":[]}
active_hook_lifecycle event_types  = ["system:hook_response","system:hook_started"]
active_hook_lifecycle target_tool_use_count = 2
```

Read those four lines together. Both tool uses happened. Hook lifecycle events
ARE present in the transcript, both `hook_started` and `hook_response`. Yet both
summaries count zero.

**So the hook fired and your filter matched none of the events.** This is the
harness, not the guard. That is the good outcome, and it is the reading the
evidence supports rather than the one that would have been alarming.

## The defect

`capture-live-runtime.cjs:832`:

```js
const relevant = events.filter((event) => event
  && event.type === 'system'
  && event.hook_name === hookName);
```

`event.type === 'system'` matches, since the observed types are namespaced
`system:hook_started` and `system:hook_response`. The zero count therefore comes
from `event.hook_name === hookName`: either the field is not called `hook_name`,
or it does not carry the literal string `'PreToolUse'`.

## Required

1. Dump one raw `system:hook_started` event and one `system:hook_response` event
   to fd 2 on failure, with any value that could carry a secret redacted, so the
   real field names and shape are visible.
2. Match on whatever the runtime actually emits. Do not guess a field name;
   read it from the dumped event.
3. Keep the assertion at two started and two responses for the active path. The
   expectation is correct: two attempts, two hook invocations. Only the
   attribution was broken.
4. Check `subtype` too. If the runtime encodes the phase in the type string, for
   example `system:hook_started`, then `event.subtype` may be absent and your
   `started` / `responses` split needs the same correction.

## The rule that has held all phase

Do not weaken the assertion to get a green run. The count is right; the filter
is wrong. Fix the filter.

Do not fabricate `167-REAL-MCP-HOOK-EVIDENCE.json`. Do not touch the hook,
composer, broker, or v2 schema. Production is not implicated by this finding.

## Scope

`capture-live-runtime.cjs`.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell; Git Bash loses this harness's stdio on this machine.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: the real event shape, and what the filter now matches on
```
