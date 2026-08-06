# P146 T146-02 — repo-local hook installation (.claude/settings.json)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer contract: fresh context, THIS TASK ONLY (T146-02 of 7), verify
before reporting, self-review, explicit DONE / DONE_WITH_CONCERNS / BLOCKED.
Do not implement the hook bodies (T146-03/04/05 own those). This task only
WIRES them.

## Files you may touch (nothing else)
- `.claude/settings.json`                        (repo-local; may not exist yet)
- `super-gsd/install.sh`
- `super-gsd/scripts/merge-settings.js`
- `super-gsd/config/settings-overlay.json`
- `super-gsd/config/repo-settings-overlay.json`  (may be new)

## 🚨 ABSOLUTE SECURITY CONSTRAINT — read twice
`~/.claude/settings.json` contains LIVE API KEYS in its `env` block.
- NEVER write, patch, or create `~/.claude/settings.json`.
- NEVER read, copy, echo, log, or print its `env` block or any value from it.
- NEVER print any environment variable value anywhere in this work.
- Your self-test must PROVE home settings are untouched, using a FIXTURE home
  file you create in a temp dir (with fake sentinel keys you invent, e.g.
  `FAKE_SENTINEL_KEY: "do-not-copy-me"`) — never the operator's real file.
A violation here is a phase-blocking defect, not a style issue.

## Output contract (from the locked plan)
Install SessionStart, UserPromptSubmit, and PostToolUse hook entries into
repo-local `.claude/settings.json` using `command: "node"` with install-time
ABSOLUTE target-repo script paths in `args`. T146-02 OWNS the repo-local hook
entries and hook overlay config. (Later cleanup may remove unrelated dead
config knobs but must not rewrite hook entries.)

## Input contract
Preserve `merge-settings.js` idempotency semantics (dedupe by command + matcher)
but target `<repo>/.claude/settings.json` ONLY. Per RESEARCH Q1 the schema is:
`"hooks": { <Event>: [ { matcher?, hooks: [ { type: "command", command, args?, timeout? } ] } ] }`
Per RESEARCH Q7 the current installer merges into HOME settings — you are
ADDING a repo-local path, not repurposing the home one. Do not break existing
home-install behavior for other consumers; just do not use it here.

## Hook entries to wire (bodies land in later tasks)
- SessionStart        → `super-gsd/hooks/sgsd-session-start.js`
- UserPromptSubmit    → `super-gsd/hooks/sgsd-intent-classifier.cjs`
- PostToolUse         → `super-gsd/hooks/sgsd-quality-gate.js`
  matcher for PostToolUse: `Edit`, `Write`, `NotebookEdit` ONLY.
  There is NO `MultiEdit` in this harness — do not add it.
The three hook scripts do not exist yet. That is expected: wire the entries
with correct absolute paths; do NOT create stub hook files.

## Hard constraints
- Windows-safe: use `command: "node"` + `args: [<abs path>, ...]` rather than a
  shell string, so paths with spaces do not require quoting gymnastics.
- Absolute paths resolved at INSTALL time from the TARGET repo root. No
  hardcoded machine paths in any committed source file. No reliance on the
  hook's runtime cwd.
- Idempotent: running the install twice must not duplicate entries.
- Must not clobber unrelated pre-existing keys in a target `.claude/settings.json`.
- Zero new runtime dependencies (Node built-ins only).

## Reuse, do not reimplement
Read `super-gsd/scripts/merge-settings.js` first (its existing idempotent
merge-by-command+matcher logic is the thing to extend) and
`super-gsd/config/settings-overlay.json` for the entry shape convention.

## Required self-test
Add `--self-test-repo-local-hooks` to `merge-settings.js` (the plan's
verification_cmd calls exactly this). It must, in a TEMP dir, prove:
1. installing into a temp target repo creates/updates only
   `<target>/.claude/settings.json`;
2. a FIXTURE home settings file (with your invented sentinel keys) is
   byte-identical before and after — untouched;
3. no sentinel value from that fixture appears anywhere in the target file;
4. all three events are present, with args paths resolving under the target
   repo (assert the resolved path starts with the target root);
5. PostToolUse matcher contains exactly Edit/Write/NotebookEdit and no MultiEdit;
6. running the install twice produces no duplicate entries (count is stable);
7. a pre-existing unrelated key in the target settings survives.
Clean up the temp dir. Exit 0 on pass, nonzero on any failure.

## Verify (run these; report exact exit codes)
1. `node --check super-gsd/scripts/merge-settings.js`
2. `node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks`
3. `bash -n super-gsd/install.sh`
If your sandbox blocks bash/node, say so in BLOCKERS and still report exactly
what changed — the orchestrator verifies host-side.

SURGICAL CONSTRAINT — every changed line must trace to T146-02. Orphan edits
(unrelated refactors, formatting passes, "while I'm here" fixes) are
DEVIATIONS: report them, do not commit silently. Match existing style. If you
notice pre-existing dead code, mention it in DEVIATIONS — do NOT delete it.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
