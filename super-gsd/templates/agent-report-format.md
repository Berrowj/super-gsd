# Sub-Agent Report Format (Max 300 Words)

Every sub-agent returns EXACTLY this structure. No preamble. No recap.

```
FILES_CHANGED:
- path/to/created.ts (created)
- path/to/modified.ts (modified: added X)

VERIFICATION:
- `npx tsc --noEmit` → exit 0 ✓
- `grep -q 'exportName' path/to/file.ts` → exit 0 ✓
- `npm test -- --grep "auth"` → exit 0, 4 passing ✓

DEVIATIONS:
- [Rule 1 - Bug] Fixed null check in auth.ts:23 — was missing guard on token.sub
- none

BLOCKERS:
- none

SCRIPTS_CREATED:
- path/to/new-utility.ts | purpose: retry with backoff | interface: retryWithBackoff<T>(fn, opts?) → Promise<T>

ONE_LINER: JWT auth middleware with refresh rotation using jose library
```

## Rules

1. FILES_CHANGED: Only files YOU touched. Path + (created|modified|deleted) + brief what.
2. VERIFICATION: Every verify command from the plan + result. Include exit code.
3. DEVIATIONS: Deviation rule number + type + one-liner. "none" if clean execution.
4. BLOCKERS: Anything preventing completion. "none" if all tasks done.
5. SCRIPTS_CREATED: Any new utility/helper/hook created. Path + purpose + interface signature. Orchestrator curates these into ByteRover script registry.
6. ONE_LINER: Substantive summary. Not "implemented feature" — what specifically was built.

## Token Budget

- Target: 150-250 words
- Hard max: 300 words
- If you hit 300, cut DEVIATIONS detail first, then VERIFICATION output
- NEVER cut FILES_CHANGED or ONE_LINER

## What NOT To Include

- No "I have completed the task" preamble
- No "Here is my report" intro
- No explanation of what you were asked to do
- No suggestions for next steps
- No questions for the user
