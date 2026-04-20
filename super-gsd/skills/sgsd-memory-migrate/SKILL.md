---
name: sgsd-memory-migrate
description: "Consolidate Claude Code auto-memory + legacy .brv/context-tree/ into .planning/memory/ with the v1.2 8-folder semantic taxonomy. Creates a directory junction so auto-memory auto-load still works against the git-tracked location. One-time migration per project. Idempotent; -DryRun supported."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run the memory consolidation migration on the current project. Before: knowledge split across ~/.claude/projects/<encoded>/memory/ (not in git) and <project>/.brv/context-tree/ (git, but forked from auto-memory). After: everything at <project>/.planning/memory/, semantically organised, git-tracked, with a junction making auto-memory transparent to Claude Code.

Use once per project. Subsequent memory activity (sgsd-curate, auto-memory saves, distillation output) all write to the new canonical location.
</objective>

<script_location>
The migration script lives at:
- `super-gsd/scripts/sgsd-memory-migrate.ps1` (in-project)
- `~/.claude/super-gsd/scripts/sgsd-memory-migrate.ps1` (global fallback)

Invoke via PowerShell — it does file moves + Windows directory junction which bash can't portably handle.
</script_location>

<process>
## Step 1: Dry-run first

Always show the user what will move before touching disk:

```bash
powershell.exe -NoProfile -File <path>/sgsd-memory-migrate.ps1 -ProjectDir "<project>" -DryRun
```

Output lists every file that will move (source → target category), all 15 taxonomy folders that will be created, and whether the auto-memory junction will be established. Confirms the auto-memory path was correctly encoded.

If the dry-run shows nothing to migrate, the project is either already consolidated or empty — skip.

## Step 2: Review + confirm with operator

Show the dry-run output. The operator should eyeball:
- File classifications (do the prefix→category mappings look right?)
- Auto-memory path (is the encoded path what Claude Code actually uses?)
- No unexpected moves to `archive/`

If anything looks off, STOP and diagnose. Don't run the real migration on bad input.

## Step 3: Run for real

```bash
powershell.exe -NoProfile -File <path>/sgsd-memory-migrate.ps1 -ProjectDir "<project>"
```

Steps it executes:
1. Create the 15-folder taxonomy
2. Move every `.brv/context-tree/<subdir>/*.md` into the right `.planning/memory/<category>/`
3. Move every `~/.claude/projects/<encoded>/memory/<prefix>_*.md` similarly
4. Rebuild `MEMORY.md` as a single catalog (list items grouped by section)
5. Replace the auto-memory directory with a junction pointing at `.planning/memory/` (requires nothing moved remaining in auto-memory first)
6. Sweep empty legacy directories and delete `.brv/` entirely if nothing is left

## Step 4: Commit

```bash
git add .planning/memory/ .brv/ 2>/dev/null
git commit -m "refactor(memory): consolidate into .planning/memory/ with v1.2 taxonomy"
```

The `.brv/` entry will be a deletion commit if it was fully swept.

## Step 5: Verify auto-memory still loads

Open a new Claude Code session in the project. The existing auto-memory files (now living in `.planning/memory/workflow/`, `.planning/memory/project/` etc) should still be loaded — the junction makes this transparent. If MEMORY.md now has ~30 entries, the catalog is working.

## Step 6: Re-run boot preflight

```bash
sgsd -NoOpen
```

Should report:
- `.planning/ present` OK
- `.planning/memory/MEMORY.md present` OK
- Curate write-pipe smoke test OK
- Agents registry synced

If any of those fail, the migration left something in an intermediate state. Re-run -Backfill to top up missing pieces.
</process>

<flags>
- `-DryRun` — show moves without touching disk
- `-SkipJunction` — don't create the auto-memory junction (operator wants the two locations to stay distinct)
- `-Force` — replace an already-migrated `.planning/memory/` (destructive; only if you know what you're doing)
- `-ProjectDir <path>` — operate on a different project than cwd
</flags>

<taxonomy>
The 8 top-level folders and what goes where:

- `architecture/{patterns, anti-patterns, decisions, expertise}` — "how is the system designed"
- `code/<language>/` — language-specific expertise (e.g. `code/sql/`, `code/powershell/`)
- `domain/` — business logic, SAP fields, customer/product quirks
- `workflow/{user, feedback, preferences}` — how to collaborate with the user on this project
- `project/` — ongoing work context
- `reference/` — external URLs, tool paths, dashboards
- `errors/` — ERR-* catalogue and error-rule memories
- `trajectory/{hypothesis, candidate, lesson}` — DLB-04 distillation output

MEMORY.md at the root uses section headers matching these paths. sgsd-curate types map to sections:
- `pattern | anti-pattern | decision | expertise` → `architecture/*`
- `script` → `code`
- `user | feedback | preference` → `workflow/*`
- `project-note | reference | domain | error | hypothesis` → respective section
</taxonomy>

<safety>
- NEVER overwrites. Every move checks target existence first.
- Auto-memory junction is only created if the directory is empty (all files moved). If anything remained, the junction step warns and exits without changing anything.
- `-DryRun` shows everything without writing.
- Fully reversible via `git checkout -- .planning/` as long as the migration was committed.
- Rollback the junction with `cmd /c rmdir "<auto-memory path>"` (removes the junction, not the real data underneath).
</safety>
