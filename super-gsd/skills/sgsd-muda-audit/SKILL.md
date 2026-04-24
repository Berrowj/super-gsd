---
name: sgsd-muda-audit
description: "Run the MUDA (8-waste) watchdog probes on a phase. DLB-02. Captures haiku-fails, narrative staleness, git-spawn rate, extra-processing, and inventory. Writes WASTE.md + curates findings. Fires at phase close when files_changed>=4 OR diff_lines>=100."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run the DLB-02 MUDA audit against a specific phase. Produces a WASTE.md report with five watchdog probes (defects/waiting/motion/extra-processing/inventory waste classes) and curates each WARN/FAIL finding to `.brv/context-tree/anti-patterns/` for future classifier consultation.

This is the write-path-only form. Read path (classifier consulting findings pre-dispatch) is deferred per DLB-02 until 2 milestones of recurrence data exist.
</objective>

<script_location>
- `super-gsd/scripts/sgsd-muda-audit.sh` — in-project
- `~/.claude/super-gsd/scripts/sgsd-muda-audit.sh` — global fallback
</script_location>

<process>
## Step 1: Determine phase

Accept: phase number (e.g. `8`, `08`, `8.1`), or slug (`08-sgsd-self-audit`). Resolve to the phase directory under `.planning/phases/`.

## Step 2: Check the conditional gate

Only fire if (from DLB-02):
- `files_changed >= 4` OR `diff_lines >= 100` for this phase
- AND phase type is NOT in (refactor, docs, config) — check PLAN.md frontmatter `type:` field

If skipping, tell the user why and exit.

## Step 3: Run the audit

```bash
bash <path>/sgsd-muda-audit.sh <phase> [--dry-run] [--no-curate]
```

Produces:
- `.planning/phases/<phase-dir>/WASTE.md` — main report with all five probe verdicts
- `.brv/context-tree/anti-patterns/waste-<class>-p<phase>-<probe>.md` — one file per WARN/FAIL (via sgsd-curate)
- Append to `.planning/metrics/muda-log.jsonl` — one line per audit run

## Step 4: Report

Read the resulting WASTE.md and show the user:
- Summary verdict (all PASS / N WARN / N FAIL)
- Per-probe details with evidence
- Files curated (count + class breakdown)

## Step 5: Check recurrence kill condition (optional)

At milestone-close: run recurrence check to determine if MUDA skill earns its keep.

```bash
bash <path>/sgsd-muda-recurrence.sh --kill-check
```

If 2 consecutive milestones with zero recurrence → retire the skill (DLB-02 Contrarian kill).
</process>

<probes>
Five watchdogs currently wired:

| Probe | Waste class | Threshold |
|-------|-------------|-----------|
| haiku_fails        | defects   | warn>=3, fail>=8 |
| narrative_age_sec  | waiting   | warn>1800s, fail>3600s |
| git_spawn_pct      | motion    | warn>20%, fail>40% |
| extra_processing   | extra-processing | warn>3, fail>8 |
| inventory          | inventory | warn>0, fail>5 calibrated stale scratch/draft/temp artifacts |

The full 8-waste taxonomy still includes Overproduction, Non-utilised talent, and Transportation. Overproduction can also be covered by the optional qualitative Codex probe; the remaining two depend on operator judgement until a concrete signal exists.
</probes>
