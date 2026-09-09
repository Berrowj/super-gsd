---
name: sgsd-update
description: "Guardedly fast-forward canonical super-gsd to origin/master and refresh project plus global assets. Use to propagate skills, agents, hooks, scripts, and registrations across machines without accepting dirty or local-only source history."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run `sgsd-update.sh` (or `.ps1` on native Windows PowerShell) to fast-forward the canonical super-gsd source to a captured `origin/master` SHA and run `install.sh --update --install-global`. This refreshes both the current project integration and the operator's global SGSD assets while preserving `.planning/config.json`.

Optional second mode: `--check` reports upstream drift without modifying anything. Useful when the session-start hook has already prompted but operator wants to inspect before accepting. On Linux, a full update also performs a same-port transition only for an already-running, owned Atlas receiver before publishing the project pin.
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
5. Assert HEAD again. On Linux, prove any running Atlas receiver's exact identity, loaded fingerprint, root, instance, health, and three port owners; transition that receiver on the same ports. Only after that succeeds, atomically write the captured SHA to `.super-gsd-version` when the current project has `.planning/`.

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

`--check` and `--no-install` never perform an Atlas receiver transition.
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
- **Installer is called from canonical source**, not current repo. The Bash updater parses its complete main invocation before mutations, so replacement of the installed updater cannot execute a new tail mid-run.
- **.super-gsd-version is opt-in**: file is only written if project has `.planning/`. Per DLB-06 Q3, SHA pinning is deferred — `.super-gsd-version` records what was installed for auditability but doesn't gate future updates. Revisit pinning at next DLB after more deployment data.
</constraints>

<operator_only_dead_entry_removal>

## Operator-only dead-entry removal order

The 2026-08-13 report is explicit: remove the dead per-project entries only once global registration is confirmed live, otherwise the project is left with no coverage at all.

sgsd-update never performs deletion. During an update, a missing project-local `sgsd_managed` path emits the named `WARN project_hook_registration_missing_global_covered` line only when a live global registration covers the same event and script. Without that live global coverage, the preflight still refuses.

After a successful update, the operator may remove obsolete rows in this order:

1. Back up `.claude/settings.json`.
2. From the successful updater output, prove `source_sha` and `project_pin` are the same fetched SHA. For every row under review, prove live global file plus registration coverage for the same hook.
3. Remove only reviewed obsolete `sgsd_managed` rows. Do not remove unrelated or operator-owned entries.
4. Validate the edited settings as JSON.
5. Start a fresh client so it loads the edited registrations.
6. Verify hook evidence for the replacement global registrations.

</operator_only_dead_entry_removal>

<exit_and_restart_boundaries>

The updater exits non-zero on dirty, locally-ahead, or diverged source history; fetch failure; fetched-SHA or final-HEAD mismatch; installer failure; receiver-transition failure; or project-pin write failure. These failures never write `.super-gsd-version`; installer or receiver-transition failure preserves an existing project pin.

A successful Linux full update has one narrow process exception: an already-running, exactly owned Atlas receiver is gracefully replaced on the same three ports after install verification and before pin publication. A legacy receiver's old loaded revision is recorded as unknown; success requires the new receiver's loaded fingerprint to match the installed target. For explicit retry, failure preserves the private transition journal; it never deletes run registrations, spools, or ledgers. A disabled or absent receiver is a no-op. The Windows receiver transition remains open and is not implemented.

All other running processes and sessions remain unchanged; their restart boundaries are manual:

- Reload the PowerShell profile (`. $PROFILE`) or start a new shell before relying on updated profile functions.
- Exit and start a new client session before relying on newly installed skills, agents, or hooks.
- Restart MCP and cockpit processes so their command lines resolve through the refreshed global installation.
- On a remote SGSD host, reset the relevant tmux session so its panes start new MCP and cockpit processes.

Use the phase propagation runbook for process-identity evidence and exact manual restart commands. The receiver exception does not restart clients, MCP, cockpit, tmux panes, Fable/Codex workers, or change configuration and other project pins.
</exit_and_restart_boundaries>

<related>

- `.planning/decisions/DLB-06-central-distribution.md` — the deliberation
- `.planning/decisions/DELIBERATION-FLOOR.md` — the meta-rule that would have prevented DLB-06's own deliberation; preserved because Q2 (cadence) + Q4 (cross-project memory) needed board resolution
- `super-gsd/install.sh` — the script being wrapped
- `super-gsd/hooks/gsd-session-start.js` — Step-2 drift check integration (pending)
</related>
