---
name: sgsd-overlay-refresh
description: "Sync a project's CLAUDE.md with canonical super-gsd/CLAUDE-OVERLAY.md. Uses HTML-comment markers for idempotent replace. First run requires --force (or -Force); subsequent runs auto-replace content between markers. Creates .bak backup. Offers --dry-run preview."
allowed-tools:
  - Read
  - Bash
---

<objective>
Bring a project's `CLAUDE.md` overlay up to date with the canonical `super-gsd/CLAUDE-OVERLAY.md`. Handles three cases: fresh file, marker-wrapped block (idempotent replace), legacy unmarked overlay (first-run append with duplication warning).
</objective>

<script_location>
- PowerShell: `~/.claude/super-gsd/scripts/sgsd-overlay-refresh.ps1` (preferred on Windows)
- Bash: `~/.claude/super-gsd/scripts/sgsd-overlay-refresh.sh` (Git Bash / WSL / macOS / Linux)
</script_location>

<modes>

## Dry-run first (always)

```powershell
powershell -File ~/.claude/super-gsd/scripts/sgsd-overlay-refresh.ps1 -DryRun
# or
bash ~/.claude/super-gsd/scripts/sgsd-overlay-refresh.sh --dry-run
```

Shows what would happen without writing. Use before every real run.

## Normal run (project with markers already)

```powershell
powershell -File ~/.claude/super-gsd/scripts/sgsd-overlay-refresh.ps1
```

Detects start/end markers, replaces content between them with current canonical overlay. Creates `.bak` backup. Idempotent — running twice on an already-current file is a no-op.

## First-run force (project with legacy unmarked overlay OR no overlay at all)

```powershell
powershell -File ~/.claude/super-gsd/scripts/sgsd-overlay-refresh.ps1 -Force
```

Appends marker-wrapped overlay. **WARNING**: if the project has a previously-appended overlay (via Add-Content without markers), this creates duplication — the skill surfaces a yellow-coloured warning. Operator must manually delete the older unmarked copy.

Alternative for clean transition from legacy: manually add `<!-- SUPER-GSD-OVERLAY-START -->` and `<!-- SUPER-GSD-OVERLAY-END -->` around the existing overlay block, then run without `-Force` — normal replace path takes over.

## Override source (advanced)

```powershell
-Source PATH     # PowerShell
--source PATH    # bash
```

Useful when the canonical clone at `~/.claude/super-gsd/source/` isn't present yet (fall back to in-repo checkout).
</modes>

<behaviour>

| CLAUDE.md state | --force | Action |
|---|---|---|
| File does not exist | any | CREATE with header + marker-wrapped overlay |
| Has both markers | any | REPLACE content between markers (no-op if hash matches) |
| Has only one marker | any | ERROR — operator must fix orphan marker |
| No markers | false | PROMPT — explains two clean paths |
| No markers | true | APPEND + warn about potential duplication |

Backup file (`CLAUDE.md.bak`) written on every modification. Overlay hash tracked as an HTML comment inside the block so idempotent runs can short-circuit.
</behaviour>

<related>

- `super-gsd/CLAUDE-OVERLAY.md` — the canonical source
- `super-gsd/scripts/sgsd-update.sh/.ps1` — pulls new canonical version (DLB-06)
- `.planning/decisions/DLB-06-central-distribution.md` — the deliberation that motivated distribution tooling
- `super-gsd/scripts/Install-SgsdShortcut.ps1` — installs `sgsd` profile shortcut (works alongside this)
</related>

<typical_flow>

1. `sgsd-update` — pulls new super-gsd master + re-runs installer (propagates skills/agents/scripts globally)
2. `sgsd-overlay-refresh --dry-run` — preview CLAUDE.md changes
3. `sgsd-overlay-refresh` (or `-Force` on first run) — apply
4. Commit the updated CLAUDE.md in the project repo
</typical_flow>
