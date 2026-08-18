# P153-T2 Make the existing secret-leak guard block on the Claude Code surface

You are the implementer for ONE task. T1 is complete and committed. Do not redo it.

## Environment constraint

You CANNOT spawn `claude` from your sandbox. Two dispatches confirmed `spawn EPERM`, even
for `claude.exe --version`. Do not attempt it and do not report it as a blocker. The
orchestrator runs anything needing a live Claude session.

Everything in this task can be verified WITHOUT spawning Claude, because the guard is a
plain stdin/stdout process. Verify by spawning the guard itself with `child_process` and
reading its real exit code.

## Already landed, do not modify

- `super-gsd/config/claude-ups-overlay.json`, repo-local `.claude/settings.json`,
  `super-gsd/registry/hooks.yaml`, `super-gsd/tests/hook-transport/assert-registration.cjs`
- `super-gsd/hooks/sgsd-intent-classifier.cjs` now writes decision matched or no_match
- `super-gsd/tests/hook-transport/assert-live-dispatch.cjs` and its six modes are green

## Current state of the guard

`super-gsd/tools/codex-hooks/block-secret-leak.cjs` already reads UserPromptSubmit JSON
from stdin, detects credential patterns, and appends a decision row to
`.planning/metrics/codex-tool-events.jsonl`. It is wired only to the Codex hook surface via
`.codex/hooks.json`. Read it before changing it.

It does not currently block. Exit code 2 is the documented Claude Code contract for a
UserPromptSubmit hook to block a prompt.

## Deliverables

**1. `super-gsd/tools/codex-hooks/block-secret-leak.cjs`**

- On a credential match, write an operator-facing reason to stderr naming the matched
  trigger, then exit 2.
- The reason names the trigger only. It MUST NOT contain the matched credential value or
  any substring of it. Do not log the value to the ledger either.
- On no match, exit 0 and write no block reason.
- Keep the existing Codex-surface behaviour and the existing ledger row shape working.
  One implementation serving both surfaces. Do not fork the detection logic into a second
  copy, and do not create a Claude-specific variant file.

**2. `super-gsd/config/claude-ups-overlay.json`**

Add the guard as a second UserPromptSubmit hook entry alongside the classifier, using the
same shape the existing entry uses (`"command": "node"` with an `args` array holding the
repo-relative script path, which `merge-settings.js` resolves to absolute at install time).

Do NOT run the merge yourself. The orchestrator installs and verifies it.

Note for your own understanding: `assert-live-dispatch.cjs` asserts exactly ONE managed
classifier entry, not one UserPromptSubmit entry in total, so adding the guard does not
break it. Confirm that by reading the assertion before you rely on it. If it turns out the
assertion counts all UserPromptSubmit entries, report that under BLOCKERS rather than
weakening the assertion.

**3. `super-gsd/tests/hook-transport/assert-block-guard.cjs`** (new)

Three modes, each spawning the guard as a real process and asserting on its real exit code:

- `--case secret` A prompt containing a credential pattern. Assert exit code 2, assert
  stderr names the trigger, and assert stderr contains no substring of the credential value.
- `--case benign` A prompt with no credential pattern. Assert exit code 0 and no block reason.
- `--case dual-surface-shared` Assert both surfaces resolve to the SAME implementation file
  and produce identical decisions for an identical payload. A duplicated copy of the
  detection logic fails this case.

## Hard constraints

- NEVER read, print, echo or log any settings `env` block. Live API keys.
- Do not modify the global `~/.claude/settings.json` or the repo-local `.claude/settings.json`.
- Do not add a generic fifth enforcement kind to the classifier registry. That was dropped
  at plan review as YAGNI with one consumer.
- Do not change the P152 `kb-lookup-triage` route. It stays enforcement kind `shadow`.
- Node `.cjs` only. No Python, no `uv`, no new dependencies.
- Do not copy source from `disler/claude-code-hooks-mastery`. That repo has no LICENSE file
  and is all rights reserved. Claude Code exit-code semantics are platform facts and are
  fine to rely on.
- Surgical. Every changed line traces to this task. Report unrelated issues under DEVIATIONS.
- Do not create stray files in the repo root.

## Verification to run before reporting

    node super-gsd/tests/hook-transport/assert-block-guard.cjs --case secret
    node super-gsd/tests/hook-transport/assert-block-guard.cjs --case benign
    node super-gsd/tests/hook-transport/assert-block-guard.cjs --case dual-surface-shared
    node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs

## Stop rule

Stop when all four commands exit 0. Do not install the overlay and do not run live probes.

## Report format, exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

Report only what you actually ran. Do not weaken an assertion to make it green. A reported
blocker is a better outcome than a false pass, and this phase exists because nine defects of
exactly that shape shipped.
