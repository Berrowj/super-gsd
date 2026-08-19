# P153-T1 — Register UserPromptSubmit + causal dispatch probe

You are the implementer for ONE task. Implement T1 only. Do not start T2.

## Read first

- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md` (rev 4 — authoritative)
- `super-gsd/hooks/sgsd-intent-classifier.cjs`
- `super-gsd/scripts/merge-settings.js`
- `super-gsd/config/repo-settings-overlay.json` (reference for shape ONLY — do NOT install it)
- `super-gsd/registry/hooks.yaml`

## The defect

`sgsd-intent-classifier.cjs` self-declares as a UserPromptSubmit hook, but no
UserPromptSubmit event is registered anywhere. The governance built in P149
(skill-routing), P151 (demand baseline) and P152 (KB-triage shadow) therefore never
executes in a live session. This is seam instance #7: mechanism built, production
caller absent.

## What to build

**1. A dedicated single-event overlay** at `super-gsd/config/claude-ups-overlay.json`
declaring ONLY `UserPromptSubmit`, mapped to `sgsd-intent-classifier.cjs`.

Do NOT reuse `repo-settings-overlay.json`. It declares three events (SessionStart,
UserPromptSubmit, PostToolUse) and `merge-settings.js` merges every event in an
overlay, which would violate this task's stop rule.

**2. Install it repo-locally.** From the repo root, with an ABSOLUTE repo-root argument:

```
node super-gsd/scripts/merge-settings.js --repo-local-hooks super-gsd/config/claude-ups-overlay.json .claude/settings.json "$(pwd)"
```

The repo-root argument MUST be absolute. `resolveRepoLocalTarget()` at
`merge-settings.js:234` throws on any non-absolute root and exits before merging.

After merging: validate the merged hooks section parses, confirm every command in it
resolves to a file that exists, and record a hash of that section — BEFORE running any
probe. Print mode can silently ignore invalid settings, so probing a half-written
config produces a confounded result.

**3. Add the UserPromptSubmit row** to `super-gsd/registry/hooks.yaml`.

**4. Classifier changes.** Ensure it appends an EXPLICIT no-match row when no route
matches (if it does not today, add it), and that every route-decision row carries the
session id and the prompt nonce so probes can correlate.

**5. `super-gsd/tests/hook-transport/assert-registration.cjs`** — confirms exactly one
new event (UserPromptSubmit) is registered and every hook command resolves to an
existing file.

**6. `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`** — the causal probe.
For each probe run it MUST:
- snapshot ledger byte offsets FIRST
- generate a nonce with `crypto.randomUUID()`, and FAIL if that nonce already appears
- launch a real headless Claude session with a caller-chosen fresh session id:
  `claude -p '<nonce> <prompt>' --setting-sources project --session-id <uuid> --output-format stream-json --verbose --include-hook-events`
- pass ONLY when the hook-lifecycle events name the EXACT command resolving to
  `sgsd-intent-classifier.cjs` AND exactly one new post-snapshot ledger row carries
  that session id and nonce
- inspect ONLY post-snapshot rows

Evidence that merely shows "a UserPromptSubmit event dispatched" is INSUFFICIENT.
Another hook's genuine dispatch combined with a forged row must NOT pass.

Required modes: `--probe planning`, `--probe no-match`, `--probe p149-skill-routing`,
`--probe p152-shadow`, `--control forged-and-confused-must-fail`,
`--control stale-nonce-must-fail`.

The two `--control` modes assert FAILURE of the underlying check — they exit 0 when the
forged/replayed evidence is correctly REJECTED.

## Hard constraints

- **NEVER** read, print, echo, cat or log the contents of any settings `env` block. It
  contains live API keys. Inspect only the `hooks` section, by key. This is absolute.
- **Do NOT modify the global `~/.claude/settings.json`.** Repo-local only.
- Node `.cjs` only. No Python, no `uv`, no new runtime dependencies.
- Do NOT copy source from `disler/claude-code-hooks-mastery` (no LICENSE = all rights
  reserved). Claude Code's event names and exit-code semantics are platform facts and
  are fine to rely on.
- Do NOT bind any hook event other than UserPromptSubmit.
- Do NOT change the P152 `kb-lookup-triage` route's enforcement kind. It stays `shadow`.
- Surgical: every changed line must trace to this task. Do not refactor adjacent code,
  reformat, or fix unrelated issues. If you notice something unrelated, report it under
  DEVIATIONS rather than changing it.

## Stop rule

Stop when the single-event merge is confirmed, all four probes pass under genuine
headless-Claude dispatch, and BOTH controls correctly reject. Do not start T2.

## Progress contract

Emit a one-line progress marker to stdout as you complete each numbered item above, so
the orchestrator can see liveness during a long run.

## Report format — exactly this, max 300 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
```

If a probe cannot be made to pass — for example if `claude -p` does not dispatch
repo-local hooks in this environment — STOP and report it under BLOCKERS with the exact
observed output. Do not fake a pass, do not weaken an assertion to make it green, and do
not substitute a direct spawn for a genuine dispatch.
