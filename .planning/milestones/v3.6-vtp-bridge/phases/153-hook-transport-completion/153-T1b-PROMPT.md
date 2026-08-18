# P153-T1b — Live dispatch probe + explicit no-match row

You are the implementer for ONE task. T1a is already done and committed; do not redo it.
Do NOT start T2.

## Already landed (do not redo, do not modify)

Commit `ca3c857` delivered and VERIFIED:
- `super-gsd/config/claude-ups-overlay.json` — UserPromptSubmit only
- repo-local `.claude/settings.json` installed via `merge-settings.js --repo-local-hooks`
- `super-gsd/registry/hooks.yaml` row
- `super-gsd/tests/hook-transport/assert-registration.cjs` — passes, prints
  `events_added=1 commands=1 hooks_sha256=<hash>`

The hook IS live. Do not re-run the merge. Do not touch the global
`~/.claude/settings.json`.

## MEASURED facts — use these, do not rediscover them

A real `claude -p` run was executed and captured in
`.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-T1a-LIVE-EVIDENCE.md`.
What it established:

1. The stream-json hook lifecycle emits three events with
   `"type":"system"` and `subtype` of `hook_started`, `hook_progress`, `hook_response`.
   Fields observed: `hook_id`, `hook_name` (value `"UserPromptSubmit"`), `hook_event`,
   `session_id`, `uuid`, and on `hook_response`: `exit_code`, `outcome` (`"success"`),
   `stdout`, `stderr`, `output`.
2. **These events do NOT carry the hook command.** Do not attempt to assert on it.
3. Attribution is therefore STRUCTURAL. A `UserPromptSubmit` `hook_response` can only be
   this classifier when BOTH hold in the same run:
   - `assert-registration.cjs` proves exactly ONE UserPromptSubmit hook is registered
   - the probe runs with `--setting-sources project` so global hooks are not loaded
4. A UserPromptSubmit hook's stdout is INJECTED into the model's prompt context (the
   observed run injected `SGSD directive: /sgsd-triage`). **Never** add a nonce/correlation
   marker to the classifier's stdout — it would pollute every production prompt. Correlate
   on `session_id` instead.
5. `claude -p` costs roughly 31s for a trivial prompt. Budget accordingly; prefer fewer,
   well-chosen runs over broad retry loops.

## Deliverables

**1. `super-gsd/hooks/sgsd-intent-classifier.cjs`** — ensure it appends an EXPLICIT
no-match row when no route matches (if it does not today, add it), and that every
route-decision row carries the `session_id` from the hook payload so probes can correlate.
Keep the change surgical; do not restructure the classifier. Do NOT change the P152
`kb-lookup-triage` route's enforcement kind — it stays `shadow`, and its ledger stays
text-free.

**2. `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`** — a partial version exists
from a timed-out run; build on it, do not restart.

Required modes:
- `--probe planning` — planning-shaped prompt; expect a matched-route row
- `--probe no-match` — execution-shaped prompt (`fix the failing test in parser.cjs`);
  expect an EXPLICIT no-match row. An ABSENT row is a FAILURE.
- `--probe p149-skill-routing` — prompt targeting a P149 skill-routing registry route,
  NOT the P146 compatibility `planning-triage` route; assert the matched route originates
  from the P149 registry
- `--probe p152-shadow` — KB-directed prompt matching the P152 shadow route; assert a
  text-free shadow row is written and NOTHING is injected
- `--control forged-and-confused-must-fail` — (a) classifier spawned directly on stdin with
  a forged payload and a real session id, no Claude dispatch: must FAIL; (b) isolation
  precondition deliberately violated (more than one UserPromptSubmit hook registered, or
  `--setting-sources project` omitted): must FAIL
- `--control stale-nonce-must-fail` — reusing a nonce already present pre-snapshot must FAIL

Every probe run MUST:
- assert the isolation precondition FIRST (exactly one UserPromptSubmit hook registered)
- snapshot ledger byte offsets BEFORE launching
- generate a nonce with `crypto.randomUUID()` and FAIL if it already appears
- launch with `--setting-sources project --session-id <fresh-uuid> --output-format
  stream-json --verbose --include-hook-events`
- inspect ONLY post-snapshot rows
- require a `hook_response` for `UserPromptSubmit` with `exit_code` 0 and `outcome`
  `success`, AND a new row correlated by `session_id`

The two `--control` modes exit 0 when the forged/violating evidence is correctly REJECTED.

## Hard constraints

- **NEVER** read, print, echo, cat or log any settings `env` block — live API keys. Touch
  only the `hooks` section, by key. Absolute.
- Do NOT modify the global `~/.claude/settings.json`, the overlay, or
  `assert-registration.cjs`.
- Do NOT re-run the repo-local merge.
- Node `.cjs` only. No Python, no `uv`, no new dependencies.
- Surgical: every changed line traces to this task. Report unrelated issues under
  DEVIATIONS instead of fixing them.
- Do NOT create stray files in the repo root. A previous run left an empty file named
  `22.0.0`; do not redirect version output to a file.

## Stop rule

Stop when all four probes pass under genuine dispatch and both controls correctly reject.
Do not start T2.

## Progress contract

Print a one-line progress marker as each probe/control first passes, so the orchestrator
can see liveness across a long run.

## Report format — exactly this, max 300 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

If `claude` cannot be spawned from your environment, or a probe cannot be made to pass,
STOP and report the exact command and observed output under BLOCKERS. Do NOT weaken an
assertion to make it green, do NOT substitute a direct spawn for a genuine dispatch, and do
NOT mark a probe passing that you did not actually observe pass. This phase exists because
nine separate defects of exactly that shape were shipped; a faked green is worse than a
reported blocker.
