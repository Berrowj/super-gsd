# P153-T1a — Overlay + repo-local merge + registration assertion

You are the implementer for ONE narrow task. Do NOT build the live dispatch probe —
that is T1b and is explicitly out of scope here.

## Why this is scoped narrowly

A previous dispatch attempted overlay + merge + registration + live probe in one unit and
hit a 25-minute timeout with the registration work unfinished. `claude -p` costs ~31s per
invocation, so the probe work is slow and belongs in its own unit. Finish the fast,
deterministic half here.

## Existing partial work — build on it, do not restart

`super-gsd/tests/hook-transport/assert-registration.cjs` already exists (untracked, from
the timed-out run). It is sound: it targets the repo-local settings path, surfaces only the
`hooks` section, never touches `env`, and computes a sha256 of the hooks section. Review it,
keep what works, fix what does not. Do not rewrite it from scratch.

`super-gsd/tests/hook-transport/assert-live-dispatch.cjs` also exists and is partial. LEAVE
IT ALONE — it is T1b's file. Do not modify or delete it.

## Read first

- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md` (rev 4)
- `super-gsd/scripts/merge-settings.js`
- `super-gsd/config/repo-settings-overlay.json` (shape reference ONLY — do NOT install it)
- `super-gsd/registry/hooks.yaml`
- `super-gsd/tests/hook-transport/assert-registration.cjs` (existing partial)

## Deliverables — exactly these

**1. `super-gsd/config/claude-ups-overlay.json`** — a NEW overlay declaring ONLY the
`UserPromptSubmit` event, mapped to `sgsd-intent-classifier.cjs`.

Do NOT reuse `repo-settings-overlay.json`: it declares three events (SessionStart,
UserPromptSubmit, PostToolUse) and `merge-settings.js` merges every event in an overlay,
which would violate this task's stop rule.

**2. Install it repo-locally.** From the repo root, with an ABSOLUTE repo-root argument:

```
node super-gsd/scripts/merge-settings.js --repo-local-hooks super-gsd/config/claude-ups-overlay.json .claude/settings.json "$(pwd)"
```

The repo-root argument MUST be absolute — `resolveRepoLocalTarget()` at
`merge-settings.js:234` throws on any non-absolute root and exits before merging.

**3. `super-gsd/registry/hooks.yaml`** — add the UserPromptSubmit row for this hook,
matching the shape of the existing rows.

**4. Finish `super-gsd/tests/hook-transport/assert-registration.cjs`** so it asserts:
- repo-local `.claude/settings.json` exists and its `hooks` section parses
- exactly ONE new event is present from this overlay: `UserPromptSubmit`, and NO
  SessionStart or PostToolUse entry was introduced by this merge
- the UserPromptSubmit command resolves to `sgsd-intent-classifier.cjs`
- EVERY command in the hooks section resolves to a file that EXISTS on disk
- it prints the sha256 of the hooks section (the freeze hash T1b will rely on)

It must exit non-zero when any of those fail.

## Hard constraints

- **NEVER** read, print, echo, cat or log any settings `env` block. It contains live API
  keys. Touch only the `hooks` section, by key. This is absolute and non-negotiable.
- **Do NOT modify the global `~/.claude/settings.json`.** Repo-local only. The global file
  is currently byte-identical to a backup and must stay that way.
- Do NOT bind any hook event other than UserPromptSubmit.
- Do NOT modify `sgsd-intent-classifier.cjs` in this task (the no-match row is T1b).
- Do NOT modify `assert-live-dispatch.cjs`.
- Node `.cjs`/JSON/YAML only. No Python, no `uv`, no new dependencies.
- Do NOT create files outside the deliverables above. A previous run left a stray file
  named `22.0.0` in the repo root — do not repeat that; if you need a version check, do not
  redirect its output to a file.
- Surgical: every changed line must trace to this task. No adjacent refactors or
  reformatting. Report anything unrelated under DEVIATIONS instead of changing it.

## Stop rule

Stop when the overlay exists, the repo-local merge has run successfully, hooks.yaml has the
row, and `node super-gsd/tests/hook-transport/assert-registration.cjs` exits 0. Do NOT
attempt any live `claude -p` probe.

## Verification to run before reporting

```
node super-gsd/tests/hook-transport/assert-registration.cjs
```

## Progress contract

Print a one-line progress marker to stdout as you finish each numbered deliverable, so the
orchestrator can see liveness.

## Report format — exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

If the merge cannot be made to work, STOP and report the exact command and error under
BLOCKERS. Do not hand-edit `.claude/settings.json` to fake a successful merge — the whole
point of this phase is that the install path itself must work.
