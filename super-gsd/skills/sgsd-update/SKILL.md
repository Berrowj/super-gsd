---
name: sgsd-update
description: "Pull latest super-gsd from origin/master and re-run the installer. Thin wrapper from DLB-06 Wave A. Use to propagate new skills, agents, hooks, scripts across machines without the git-pull-then-install manual cycle."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run `sgsd-update.sh` (or `.ps1` on native Windows PowerShell) to pull the canonical super-gsd source from GitHub and re-run the installer. This propagates every skill, agent, hook, and script update to the operator's local install.

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
2. `git pull origin master`.
3. Re-run `super-gsd/install.sh` (adds `--init-project` flag if cwd has `.planning/`).
4. Write upstream SHA to current project's `.super-gsd-version` (if `.planning/` present).

## Mode B — check-only

```bash
bash ~/.claude/super-gsd/scripts/sgsd-update.sh --check
```

Compares local source HEAD vs upstream via `git ls-remote` (no fetch). Exit codes:
- `0` — up to date OR offline (fail-open for session-start hook use)
- `10` — drift detected; output line shows local + upstream SHAs + commits behind

## Mode C — pull-only (no install)

```bash
bash ~/.claude/super-gsd/scripts/sgsd-update.sh --no-install
```

Useful when you want to inspect what's coming before letting the installer run.
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

<related>

- `.planning/decisions/DLB-06-central-distribution.md` — the deliberation
- `.planning/decisions/DELIBERATION-FLOOR.md` — the meta-rule that would have prevented DLB-06's own deliberation; preserved because Q2 (cadence) + Q4 (cross-project memory) needed board resolution
- `super-gsd/install.sh` — the script being wrapped
- `super-gsd/hooks/gsd-session-start.js` — Step-2 drift check integration (pending)
</related>
