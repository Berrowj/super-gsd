---
name: sgsd-muda-audit
description: "Run the MUDA (8-waste) watchdog probes on a phase. DLB-02. Captures classifier failures, narrative staleness, git-spawn rate, extra-processing, and inventory. Writes WASTE.md + curates findings. Fires at phase close when files_changed>=4 OR diff_lines>=100."
allowed-tools:
  - Read
  - Bash
---

<objective>
Run the DLB-02 MUDA audit against a specific phase. Produces a WASTE.md report with five watchdog probes (defects/waiting/motion/extra-processing/inventory waste classes) and curates each WARN/FAIL finding to `.planning/memory/architecture/anti-patterns/` for future classifier consultation.

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
- `.planning/memory/architecture/anti-patterns/waste-<class>-p<phase>-<probe>.md` — one file per WARN/FAIL (via sgsd-curate)
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

## Step 6: Library Cross-Reference (vtpCrossReference, VTPE-02)

Only runs when `config.vtp_enrichment.enabled === true` (D-07 backward-compat guard).

After writing WASTE.md, for each finding in the probe results:

1. Determine tier from probe verdict:
   - Probe verdict `FAIL` → tier `CRITICAL`
   - Probe verdict `WARN` → tier `WARN`
   - Probe verdict `PASS` → tier `PASS` (skip)

2. Call `vtpCrossReference(findingText, tier, {fileContext})` from
   `super-gsd/scripts/lib/vtp-enrichment-gate.cjs`:
   - `CRITICAL` (FAIL) findings: dispatch the returned `query_spec` as a per-finding sub-agent
     call; collect citations into the result `citations` array.
   - `WARN` findings: accumulate all WARN finding texts, dispatch a single batched sub-agent call
     using the concatenated seed from the last `WARN` query_spec; collect into `batched_citations`.
   - `PASS` findings: skip (no VTP call, `{skipped:true}` returned).

3. If any non-empty citations were returned, append a `## Library Cross-Reference` section
   to the WASTE.md with the following table:

```
## Library Cross-Reference

| Source | Title | Section | Relevance | Citation | Notes |
|---|---|---|---|---|---|
| <source> | <title> | <section> | <relevance> | <citation> | confidence:<0-1> |
```

   For batched WARN citations, use "(batched)" in the Notes column.

4. If all findings are PASS tier (no cross-reference calls made), append:
   `## Library Cross-Reference\n\n(all probes PASS — cross-reference skipped)`.
</process>

<probes>
Five watchdogs currently wired:

| Probe | Waste class | Threshold |
|-------|-------------|-----------|
| classifier_fails   | defects   | warn>=3, fail>=8 |
| narrative_age_sec  | waiting   | warn>1800s, fail>3600s |
| git_spawn_pct      | motion    | warn>20%, fail>40% |
| extra_processing   | extra-processing | warn>3, fail>8 |
| inventory          | inventory | warn>0, fail>5 calibrated stale scratch/draft/temp artifacts |

The full 8-waste taxonomy still includes Overproduction, Non-utilised talent, and Transportation. Overproduction can also be covered by the optional qualitative Codex probe; the remaining two depend on operator judgement until a concrete signal exists.
</probes>
