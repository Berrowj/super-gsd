---
name: sgsd-backfill
description: "Backfill an existing project with the current SGSD planning and memory scaffold. Uses .planning/memory; does not create BRV/ByteRover assets."
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
---

<objective>
Bring an existing checkout up to the current SGSD scaffold without touching
global Claude permissions. This is local-project setup only.
</objective>

<when_to_use>
Use when a project has SGSD source files but is missing some of:

- `.planning/`
- `.planning/config.json`
- `.planning/metrics/token-log.jsonl`
- `.planning/memory/MEMORY.md`
- `.planning/memory/` taxonomy folders
- `CLAUDE.md` SGSD overlay
</when_to_use>

<process>
## Step 1: Inspect

```bash
test -d .planning && echo planning=present || echo planning=missing
test -f .planning/config.json && echo config=present || echo config=missing
test -f .planning/memory/MEMORY.md && echo memory=present || echo memory=missing
test -f CLAUDE.md && echo claude=present || echo claude=missing
```

## Step 2: Run Safe Local Init

```bash
bash super-gsd/install.sh --init-project
```

This creates/updates only project-local SGSD files. It does not install global
agents, commands, hooks, or permission settings.

## Step 3: Validate

```bash
node -e "JSON.parse(require('fs').readFileSync('.planning/config.json','utf8')); console.log('config ok')"
test -f .planning/memory/MEMORY.md
bash super-gsd/install.sh --doctor
```

## Step 4: Optional Legacy Migration

If the project still has `.brv/context-tree/`, run `/sgsd-memory-migrate` once.
That migration consolidates legacy memory into `.planning/memory/` and keeps the
legacy source read-only until the migration evidence is committed.
</process>
