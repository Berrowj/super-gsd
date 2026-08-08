---
name: sgsd-update
description: "Guardedly fast-forward canonical super-gsd to origin/master and refresh project plus global assets. Use to propagate skills, agents, hooks, scripts, and registrations across machines without accepting dirty or local-only source history."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run `sgsd-update.sh` (or `.ps1` on native Windows PowerShell) to fast-forward the canonical super-gsd source to a captured `origin/master` SHA and run `install.sh --update --install-global`. This refreshes both the current project integration and the operator's global SGSD assets while preserving `.planning/config.json`.

Optional second mode: `--check` reports upstream drift without modifying anything. Useful when the session-start hook has already prompted but operator wants to inspect before accepting.
</objective>

<script_location>
- `super-gsd/scripts/sgsd-update.sh` (in-project)
- `~/.claude/super-gsd/scripts/sgsd-update.sh` (global fallback, the common case)
- `sgsd-update.ps1` — PowerShell mirror for Windows operators
</script_location>

<modes>

## Mode A — full update (default)

```bash
bash ~/.claude/super-gsd/scripts/sgsd-update.sh
```

Steps executed:
1. Locate canonical source at `~/.claude/super-gsd/source/`. Clone from `git@github.com:Berrowj/super-gsd.git` if missing (falls back to HTTPS).
2. Refuse tracked or untracked dirt, fetch only `refs/heads/master` into `refs/remotes/origin/master`, capture `FETCH_HEAD`, and require both fetched refs to name the same commit.
3. Refuse a locally-ahead or diverged HEAD. Recheck cleanliness immediately before `git merge --ff-only <captured-sha>`.
4. Assert HEAD equals the captured SHA, recheck cleanliness, and run `super-gsd/install.sh --update --install-global`.
5. Assert HEAD again. Only after installer success, atomically write the captured SHA to `.super-gsd-version` when the current project has `.planning/`.

Success prints stable `source_sha=<captured-sha>` and `project_pin=<captured-sha>` evidence lines. Outside an SGSD project, `project_pin=not-written` is reported.

## Mode B — check-only

```bash
bash ~/.claude/super-gsd/scripts/sgsd-update.sh --check
```

Compares local `refs/heads/master` with remote `refs/heads/master` via `git ls-remote` (no fetch and no worktree/ref mutation). Exit codes:
- `0` — up to date OR offline (fail-open for session-start hook use)
- `10` — drift detected; output line shows local + upstream SHAs + commits behind

## Mode C — fast-forward only (no install)

```bash
bash ~/.claude/super-gsd/scripts/sgsd-update.sh --no-install
```

Runs the same guards, fetch, captured-SHA ancestry check, fast-forward, and final HEAD assertion, but skips the installer and project pin write. It reports `project_pin=unchanged`.
</modes>

<when_to_use>

- **Operator sees session-start drift prompt** — `sgsd-update` accepts the prompt
- **New machine setup** — first run clones the source + installs
- **Periodic sync** — weekly or after known upstream changes
- **Troubleshooting stale skills** — verify the local install matches upstream
- **Multi-machine workflow** — bring laptop B to parity with laptop A after work committed on A
</when_to_use>

<constraints>

- **Offline-safe**: `--check` uses 3s `ls-remote` timeout + fail-open. Session start never blocks on network.
- **No mid-session mutation**: the session-start hook only PROMPTS; this skill executes when operator accepts.
- **Installer is called from canonical source**, not current repo. Avoids self-modification-while-running class of issues.
- **.super-gsd-version is opt-in**: file is only written if project has `.planning/`. Per DLB-06 Q3, SHA pinning is deferred — `.super-gsd-version` records what was installed for auditability but doesn't gate future updates. Revisit pinning at next DLB after more deployment data.
</constraints>

<exit_and_restart_boundaries>

The updater exits non-zero on dirty, locally-ahead, or diverged source history; fetch failure; fetched-SHA or final-HEAD mismatch; installer failure; or project-pin write failure. These failures never write `.super-gsd-version`, and installer failure preserves an existing project pin.

A successful install updates files on disk; it does not hot-reload already-running processes or a client session:

- Reload the PowerShell profile (`. $PROFILE`) or start a new shell before relying on updated profile functions.
- Exit and start a new client session before relying on newly installed skills, agents, or hooks.
- Restart MCP and cockpit processes so their command lines resolve through the refreshed global installation.
- On a remote SGSD host, reset the relevant tmux session so its panes start new MCP and cockpit processes.

Use the phase propagation runbook for process-identity evidence and exact restart commands; `sgsd-update` itself deliberately performs no process or session restart.
</exit_and_restart_boundaries>

<related>

- `.planning/decisions/DLB-06-central-distribution.md` — the deliberation
- `.planning/decisions/DELIBERATION-FLOOR.md` — the meta-rule that would have prevented DLB-06's own deliberation; preserved because Q2 (cadence) + Q4 (cross-project memory) needed board resolution
- `super-gsd/install.sh` — the script being wrapped
- `super-gsd/hooks/gsd-session-start.js` — Step-2 drift check integration (pending)
</related>
