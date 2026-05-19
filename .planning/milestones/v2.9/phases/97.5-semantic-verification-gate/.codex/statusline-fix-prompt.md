# SDD Implementer — sgsd-statusline.js three-fix patch

You are a fresh SDD implementer. No inherited context. Read only what this prompt names.

## Three independent fixes to one file

Target: `super-gsd/hooks/sgsd-statusline.js`

### Fix A — CRLF tolerance in readFrontmatter (root-cause bug)

`STATE.md` on this Windows machine uses CRLF line endings (`\r\n`). The frontmatter regex on line ~40 is `^---\n([\s\S]*?)\n---` which does NOT match `---\r\n...\r\n---`. As a result `readFrontmatter()` returns `{}` silently and `state.milestone` ends up `undefined`, so the bar shows `v?` even though `milestone: v2.9` is at line 3 of STATE.md.

Patch:

1. Change the frontmatter regex from `^---\n([\s\S]*?)\n---` to `^---\r?\n([\s\S]*?)\r?\n---`.
2. Change the inner line split from `match[1].split('\n')` to `match[1].split(/\r?\n/)`.

Both edits are inside `readFrontmatter(filePath, limit = 40)`. No other function touches frontmatter parsing.

### Fix B — Use milestone-specific ROADMAP for P/total

Currently the script reads `.planning/ROADMAP.md` (top-level project roadmap). For this repo that file has 28 `- [x]` items unrelated to the active milestone, so the bar shows misleading `P?/28 100%`.

Patch the block that opens around line 130-138 (`Read ROADMAP for progress count`):

1. Read the active milestone (already in `state.milestone` after Fix A lands).
2. Prefer `.planning/milestones/{state.milestone}/ROADMAP.md` if it exists.
3. Fall back to `.planning/ROADMAP.md` if the milestone-specific one is missing.
4. Keep the same `- [` total and `- [x]` completed counting; only change which file is read.

If neither file exists, `total = 0` and the existing fallback path renders `${milestone}` plain (line ~149). Do not change that fallback.

### Fix C — Remove the lastAgent block entirely

The agent role + model badge (e.g. `executor [sonnet]`) is sourced from a stale metrics log entry and lies about the current SGSD execution provider (SGSD is hardwired to Codex via codex-executor.sh). The honest move is to remove this entire block.

Patch:

1. Delete the block starting at `// Current agent activity (agent-level, not phase-level)` (around line 152) and ending just before `// Session total tokens` (around line 181).
2. Do NOT delete `getLastAgent` function definition itself (it lives elsewhere in the file); only remove the call-site + the `parts.push(agentStr)` + `parts.push(token cost)` + the else-branch fallback. The `else` branch falls back to showing `phaseState` and `pendingPlan` — also remove that else branch since it's part of the same agent block.
3. Net effect: after Fix C, the bar emits `model | milestone P/total bar pct | Σ-session-tokens | CHECKPOINT? | ctx bar pct`. Cleaner; no false executor info.

## Read these files

1. `super-gsd/hooks/sgsd-statusline.js` — current canonical source (295 lines)
2. `.planning/STATE.md` — the file with CRLF that's breaking Fix A
3. `.planning/milestones/v2.9/ROADMAP.md` — the file Fix B should prefer

## Verification declared in report

After patch, declare:
- Fix A: regex now includes `\r?\n` in both places (count of `\\r?` occurrences in patched function should be 2+).
- Fix B: the block that opens `// Read ROADMAP for progress count` now references `state.milestone` and `path.join(root, '.planning', 'milestones', state.milestone, 'ROADMAP.md')`.
- Fix C: the block that opens `// Current agent activity` is removed; the file is shorter by ~30 lines.

Do not run the script. Orchestrator will verify by running the script against the live repo.

## Files you may NOT touch

- `super-gsd/source/super-gsd/hooks/sgsd-statusline.js` (mirror; orchestrator will re-mirror after this patch lands)
- `super-gsd/scripts/sgsd-statusline.ps1` (PowerShell variant; out of scope today)
- Any installed copies under `~/.claude/`

## Report format

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/hooks/sgsd-statusline.js (modified)
VERIFICATION:
  Fix A: regex tolerates CRLF in both readFrontmatter regex + line split
  Fix B: ROADMAP read now prefers milestone-specific path
  Fix C: lastAgent block removed; agent role + model + cost lines gone
DEVIATIONS: <none or list>
BLOCKERS: <none or describe>
ONE_LINER: Three fixes: CRLF-tolerant frontmatter parser, milestone-scoped ROADMAP lookup, drop misleading executor[model] badge.
REPORT_END
```
