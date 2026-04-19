---
name: sgsd-distill
description: "Trajectory distillation — extract abstract reusable principles from a closed milestone's phases. DLB-04 Wave C. Three modes: prepare (emit Haiku prompt + corpus), ingest (triple-gate routing), rate (operator novelty 1-3)."
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Run the DLB-04 trajectory-distillation pipeline end-to-end on a closed milestone. Produce abstract reusable principles (trajectory-hypotheses) that survive a triple hallucination gate: Architect (typed hypothesis tier), Moonshot (two-phase citation), Contrarian (operator novelty rating).

Called after a milestone closes — NOT after a phase. First run produces hypotheses routed to `.brv/context-tree/trajectory-hypothesis/`. Cross-milestone confirmation at the NEXT milestone's close promotes them to `trajectory-lesson/` (classifier-readable).
</objective>

<script_location>
The underlying script lives at ONE of:
- `super-gsd/scripts/sgsd-distill-milestone.sh` — in-project (preferred)
- `~/.claude/super-gsd/scripts/sgsd-distill-milestone.sh` — global fallback

Find it via the walk-up pattern used in sgsd-boot.ps1.
</script_location>

<process>
## Step 1: Determine milestone + exclusion

Ask the user if not provided:
- Which milestone to distil? (default: most-recently-closed, read from STATE.md)
- Phase types to exclude? (default: `self-audit` — audit phases produce install-defect corpora that aren't representative of dispatch behaviour; see DLB-04 Contrarian stance)

## Step 2: PREPARE — emit Haiku prompt

```bash
bash <path>/sgsd-distill-milestone.sh <milestone> --exclude-phase-type self-audit > /tmp/distill-prompt-<milestone>.txt
```

The output is a Haiku extraction prompt + embedded corpus (1000-2000 lines). Also writes `.planning/milestones/<milestone>/DISTILL-REQUEST.md` as an audit record.

## Step 3: Dispatch Haiku extraction

```
Agent({
  description: "Distil <milestone> trajectories",
  subagent_type: "Explore",
  model: "haiku",
  prompt: "Read the file at <absolute path to prompt>. Follow the rules verbatim. Return ONLY a JSON array wrapped in ```json ... ``` — no prose."
})
```

Haiku returns 5-10 candidate principles in the strict schema `{slug, title, principle, cites, evidence}`.

## Step 4: INGEST — apply triple gate

Extract the JSON array from the agent's fenced code block, write it to `.planning/milestones/<milestone>/DISTILL-OUTPUT.json`, then:

```bash
cat .planning/milestones/<milestone>/DISTILL-OUTPUT.json | \
    bash <path>/sgsd-distill-milestone.sh <milestone> --ingest
```

Routing (automatic):
- ≥2 phase citations → `.brv/context-tree/trajectory-hypothesis/<milestone>-<slug>.md` (Gate 2 pass)
- 1 citation        → `.brv/context-tree/trajectory-hypothesis/candidate/<milestone>-<slug>.md` (Gate 2 quarantine)
- All files frontmatter-tagged `type: trajectory-hypothesis` (Gate 1 — never trajectory-lesson)

## Step 5: RATE — Gate 3 operator novelty

This step requires interactive input. On PowerShell, pipe ratings:

```bash
printf '3\n2\n3\n3\n3\n2\n3\n' | bash <path>/sgsd-distill-milestone.sh <milestone> --rate
```

Or run interactively in a bash shell. Ratings go to `.planning/metrics/distillation-novelty.jsonl`. Script prints the median verdict:
- median < 2.0 → **RETIRE** the script (Contrarian kill condition; delete it)
- median ≥ 2.0 → carry hypotheses to next milestone for cross-milestone promotion

## Step 6: Commit atomically

```bash
git add .planning/milestones/<milestone>/DISTILL-{PROMPT,OUTPUT,REQUEST}* .brv/context-tree/trajectory-hypothesis/
git commit -m "feat(distill): <milestone> trajectory distillation — N hypotheses + M candidates"
```

Include the mode (prepare only? full pipeline? rate done?) in the commit message.
</process>

<kill_condition>
Per DLB-04 Contrarian Gate 3: if the operator's novelty median falls below 2.0, this skill and the underlying script are retired. No iteration, no face-saving. Delete `sgsd-distill-milestone.sh` and this SKILL.md; the mechanism shipped negative value.
</kill_condition>
