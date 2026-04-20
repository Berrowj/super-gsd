---
name: sgsd-backfill
description: "Bring an existing super-gsd project up to current DLB-04 scaffolding. Creates .planning/metrics + proposals + resource-registry + trajectory-hypothesis dirs and empty append-log files that newer scripts expect. Safe: only creates, never overwrites. Fixes the silent-curate-skip MUDA audit issue on older projects."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run an idempotent backfill pass on the current project. Scans every path and file that DLB-01 → DLB-04 scripts expect; creates anything missing; never overwrites. Reports what was created vs already present.

Use this on any project that:
- Was initialized before DLB-04 (no .planning/proposals/, no trajectory-hypothesis/, no sepl-log.jsonl)
- Has `.planning/` but no `.brv/context-tree/` — causes sgsd-curate to silently no-op
- Has `.brv/context-tree/` but is missing subdirs sgsd-curate writes to
- Was restored from an older tarball or partial `gsd-new-project` run
</objective>

<invocation>
The backfill lives in the boot script so it runs from anywhere:

```bash
# From the target project directory (cwd is auto-detected)
sgsd -Backfill

# Or explicit project path
powershell -File ~/.claude/super-gsd/scripts/sgsd-boot.ps1 -ProjectDir <PATH> -Backfill
```
</invocation>

<what_it_creates>
Directories:
- `.planning/metrics/`
- `.planning/proposals/` (DLB-04 SEPL queue)
- `.planning/resource-registry/` (DLB-04 Agents manifest home)
- `.planning/milestones/` (DLB-04 trajectory-distill artifacts)
- `.brv/context-tree/{patterns, anti-patterns, decisions, expertise, error-rules, scripts, domain}`
- `.brv/context-tree/trajectory-hypothesis/` (DLB-04 Wave C)
- `.brv/context-tree/trajectory-hypothesis/candidate/` (Gate 2 quarantine)

Files (empty append-logs unless already present):
- `.planning/metrics/token-log.jsonl`
- `.planning/metrics/activity-log.jsonl`
- `.planning/metrics/sepl-log.jsonl`       (DLB-04 Q2)
- `.planning/metrics/distillation-novelty.jsonl` (DLB-04 Q3 Gate 3)
- `.planning/metrics/muda-log.jsonl`       (DLB-02)
- `.planning/metrics/intent-log.jsonl`     (DLB-03)
- `.brv/context-tree/INDEX.md`             (5 section headers if missing)

Writes (if possible):
- `.planning/resource-registry/agents.jsonl` — via sgsd-registry-sync.sh. Skipped with a warning if the project has no local super-gsd/agents/ tree (that's fine — global agents at ~/.claude/agents/ still work).
</what_it_creates>

<safety>
Never overwrites. Every file check is a bare existence test. Jsonl logs are created empty if missing — existing ones are left alone. INDEX.md is only seeded if missing; if you have one with custom curated rows, it stays intact.

The only mutation to existing artifacts happens via the Agents registry sync, and that script itself uses atomic .tmp + rename. If it fails (no local agents dir), it exits non-zero and the backfill prints a warning but continues.
</safety>

<when_to_run>
- After `git clone`ing super-gsd + its tools into a project that never had them
- After pulling new DLB-level changes that add new expected paths
- When `sgsd` reports "INDEX.md missing" and you want the full scaffold (not just -Bootstrap's minimal)
- When MUDA audit reports "curate failed (non-blocking)" — usually means INDEX.md is missing
- At the start of each new milestone just in case — it's cheap and idempotent
</when_to_run>
