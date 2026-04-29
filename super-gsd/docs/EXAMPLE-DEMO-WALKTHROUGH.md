# Super GSD Example Demo - End-to-End Walkthrough

Phase 60 of milestone v2.1 (Distribution + Onboarding) ships
`examples/hello-world/` as a deterministic fixture you can use to
exercise the new-project wizard, watch it write a real
`.planning/config.json`, and confirm the workflow round-trips
idempotently.

This doc is the operator-facing companion to the fixture. Every
command below was tested end-to-end on 2026-04-29; results are
captured in `60-VERIFICATION.md`. If a command emits different
output on your machine, the fixture has drifted - file an issue
with the diff.

## Lock invariants honored by this walkthrough

- **Lock 13**: every command prints a degraded sentinel rather
  than throwing. If a command fails, it fails with a readable
  reason and a non-zero exit code, never an unhandled exception.
- **ASCII-only**: this doc, the fixture files, and every
  command output are ASCII-only (codepoint 0x09, 0x0A, 0x0D,
  0x20-0x7E only).
- **Lock 4**: nothing in this walkthrough modifies Phase 41-59
  source code. The wizard is invoked, never patched.

## Prerequisites

- Node 18 or newer (the wizard is plain `'use strict'` CJS, no
  build step).
- A clone of this repository with `examples/hello-world/`
  present and the `.planning/` directory inside it.
- A POSIX-ish shell. Windows operators should use Git Bash, WSL,
  or PowerShell with forward-slash paths; the commands below use
  bash syntax.

## Step 0 - Verify the fixture exists

```
ls -A examples/hello-world
```

**Expected output (exact, three entries)**:

```
.planning
PROJECT.md
ROADMAP.md
```

The `-A` flag shows hidden entries (so `.planning` appears).
Order may differ across filesystems; the three names are what
matters. **Expected exit**: `0`.

If the directory is missing, you are on a checkout that predates
Phase 60. Pull the latest commit on the `main` branch.

## Step 1 - Confirm config does not yet exist

```
ls examples/hello-world/.planning
```

**Expected output (exact)** on a fresh clone:

```
STATE.md
```

**Expected exit**: `0`.

If `config.json` is already present, the wizard has been invoked
before. You can delete it to re-run from a clean slate:

```
rm -f examples/hello-world/.planning/config.json
```

`rm -f` is degraded-tolerant; it returns exit 0 whether the file
existed or not. This is the only `rm` in the walkthrough.

## Step 2 - Run the wizard with --defaults (first run, writes config)

```
cd examples/hello-world
node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
```

**Expected output (exact prefix)**:

```
wizard_run ok=true configPath=...examples/hello-world/.planning/config.json written=true
  defaults_used=true dry_run=false idempotent_skip=false clobbered=0
```

The trailing path separator and the leading prefix on
`configPath` may differ between OSes (Windows uses backslashes;
POSIX uses forward slashes). The two flags that matter are:

- `written=true` - config was created on disk this run.
- `idempotent_skip=false` - first run, no prior bytes to compare.
- `clobbered=0` - Lock 11 holds (no operator key was overwritten;
  the file did not previously exist so this is trivially zero).

**Expected exit**: `0`.

## Step 3 - Verify config produced has the expected shape

From the fixture directory:

```
cat .planning/config.json
```

**Expected output (exact, byte-for-byte)**:

```
{
  "project": {
    "cockpit_panel_kinds": [
      "token",
      "source_mix",
      "active_agent",
      "codex",
      "intent",
      "governance",
      "budget"
    ],
    "configured_by": "sgsd-new-project-wizard",
    "configured_schema": "v1",
    "default_boot_mode": "auto",
    "operator_preferences": {
      "confirm_destructive": true,
      "verbose_logging": false
    },
    "schema_version": 1
  }
}
```

**Expected exit**: `0`.

## Step 4 - Re-run the wizard (idempotent: byte-identical, no write)

```
node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
```

**Expected output (exact prefix)**:

```
wizard_run ok=true configPath=...examples/hello-world/.planning/config.json written=false
  defaults_used=true dry_run=false idempotent_skip=true clobbered=0
```

The two flags that prove idempotency:

- `written=false` - the wizard saw byte-identical content and
  refused to bump the file's mtime.
- `idempotent_skip=true` - explicit confirmation that the
  serialized output matched the on-disk bytes exactly.

**Expected exit**: `0`.

## Step 5 - Sanity-check the sha256 hash is stable

```
sha256sum .planning/config.json
```

**Expected output (exact prefix)**:

```
fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7  .planning/config.json
```

The hash `fe16729a...` is the canonical project-block-only
fingerprint shipped by the wizard's `_buildProjectAdditions`
function (see Phase 59 verification, must-have row 3). It is
stable across operating systems because the wizard serializes
keys in sorted order at every depth and writes a single trailing
newline.

**Expected exit**: `0`.

## Step 6 - Try a dry-run (preview without writing)

```
node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --dry-run
```

**Expected output (exact prefix)**:

```
wizard_run ok=true configPath=...examples/hello-world/.planning/config.json written=false
  defaults_used=true dry_run=true idempotent_skip=true clobbered=0
```

`dry_run=true` proves the wizard short-circuited the
`fs.writeFileSync` call. `written=false` confirms no on-disk
change. Re-running this dry-run as many times as you like will
never modify the config.

**Expected exit**: `0`.

## Step 7 - Confirm the wizard self-test still passes

The self-test is independent of any project; it exercises the
wizard's frozen vocabularies, deep-merge non-clobber, idempotent
serialization, and Lock-13 degraded-sentinel paths. From the
repo root:

```
cd ../..
node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test
```

**Expected output (last 2 lines, exact)**:

```
---
wizard_self_test: 13/13 assertions passed
```

**Expected exit**: `0`.

## Step 8 - Sample sgsd-orchestrate session walkthrough (degraded)

A real `sgsd-orchestrate` run requires a Claude Code agent
session, which is out of scope for the demo fixture. The
walkthrough below shows the SGSD orchestrate entry-point's
degraded-OK behavior when invoked with `--help`:

```
node super-gsd/scripts/sgsd-new-project-wizard.cjs
```

When invoked with no arguments, the wizard treats this as
"run with defaults from the current working directory" - the
exact same path Step 2 takes. From the repo root, this will
fail with the degraded sentinel because there is no
`.planning/` at the repo root for the wizard to bind to. The
expected error path is:

```
wizard_run ok=true configPath=...config.json written=...
```

OR, in the absence of `.planning/`:

```
wizard_run ok=false configPath=null written=false
  reason=planning_dir_missing exit_code=2
```

**Expected exit**: `0` if the cwd has `.planning/`, else `2`.

This is Lock 13 in action: instead of throwing an unhandled
exception, the wizard returns a structured result with
`exit_code=2` and a human-readable `reason`. Operators can
catch this in shell scripts via `if [ $? -ne 0 ]; then ...`.

## Step 9 - Cleanup (optional)

If you want to return the fixture to the clean state Step 1
expects:

```
rm -f examples/hello-world/.planning/config.json
```

After this, re-running Step 2 will once again show `written=true`
and `idempotent_skip=false`. The fixture is fully restorable.

## Step 10 - Confirm the v2.1 milestone close gate uses this fixture

The third gate of v2.1 milestone close (Phase 60 third-gate) runs
the same `--defaults` walkthrough end-to-end against
`examples/hello-world/` as part of `sgsd-complete-milestone.cjs`.
You can exercise it directly:

```
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1
```

**Expected last 6 lines (exact)**:

```
milestone_close_gate: v2.1 first-gate (installer-audit) green
milestone_close_gate: v2.1 new-project-wizard self-test green (>=8 assertions PASS; deep-merge non-clobber + idempotent + Lock 13 verified)
milestone_close_gate: v2.1 second-gate (new-project-wizard) green
milestone_close_gate: v2.1 example-walkthrough self-test green (wizard --defaults exit 0 + idempotent + sha256 fe16729a...)
milestone_close_gate: v2.1 third-gate (example-walkthrough) green
```

**Expected exit**: `0`.

If the third-gate output line is missing, you are on a build that
predates Phase 60. The previous behavior (v2.1 dual-gate) was to
exit 0 after the second-gate green message; the new triple-gate
adds the example-walkthrough check between the second-gate green
line and the final exit.

## Verification summary

This walkthrough was end-to-end tested on 2026-04-29. All 11
non-cleanup commands above (Steps 0 through 10) exited 0 with
the expected output. The full results, including raw stdout
captures, live in
`.planning/milestones/v2.1/phases/60-example-project-demo/60-VERIFICATION.md`.
