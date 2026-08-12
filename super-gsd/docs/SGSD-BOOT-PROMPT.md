# SGSD Boot Prompt (standing)

Paste at the start of a Super GSD session. It anchors to the live workspace of
**the project you're actually working on** and reads the resume sources in the
right order, instead of reporting whatever stale STATE is in the launch dir OR a
hardcoded path from a different project.

> Cleanest boot is `/sgsd-resume` — it reads checkpoint → STATE → handover.
> Use the full prompt below for the explicit report or when /sgsd-resume is off.

---

## Canonical boot prompt (copy from here)

```
You are booting in Super GSD mode. FIRST resolve the live workspace for THIS
project — SGSD manages multiple independent projects (the super-gsd framework
AND consuming projects like Clarity ERP), each with its OWN .planning/. Do NOT
assume a fixed path. Resolve by: among the candidate worktrees for the project
in play, pick the one whose .planning/STATE.md has the NEWEST last_updated; every
other worktree of that project is likely frozen. Then in your first response:
(1) Read .planning/ORCHESTRATOR-CHECKPOINT.md — if present, VERIFY it is live
    before resuming: cross-check its next_unit against STATE.md's current phase.
    If STATE has advanced past it (or its blocker is recorded resolved), the
    checkpoint is STALE — say so, recommend deleting/rewriting it, and do NOT
    resume from it. If absent, state "no checkpoint — nothing in-flight."
(2) Read .planning/STATE.md frontmatter and report current milestone_status in
    one line — including any lane ruling (a project may keep one milestone open
    on one branch while another lane runs separately).
(3) Report active agent count grouped by model from
    .planning/resource-registry/agents.jsonl (if present).
(4) Report the cockpit/dashboard status by PROBING, not asserting: check what is
    actually listening (e.g. curl localhost:7777 for the SGSD cockpit) and name
    what you find; do not claim it is open without a probe.
(5) Ask the operator what they want to build. Do NOT enter auto mode — wait.
```

---

## Why the earlier prompts were wrong (recorded 2026-08-12)

- **v1 (no anchor):** read STATE.md from the launch dir; reported a frozen
  worktree's stale milestone.
- **v2 (hardcoded GSDedits/cholla-racer):** correct for super-gsd framework work,
  but WRONG for consuming projects. On a machine doing Clarity work, the live
  .planning/ is in the Clarity worktree (e.g. dhl-customs / rag-edits), NOT any
  GSDedits path — v2 would route the session to the wrong repo entirely.
- **Both:** asserted the cockpit was open without probing (often nothing is on
  7777), and trusted ORCHESTRATOR-CHECKPOINT.md without checking it against STATE
  (a checkpoint can be days-stale, superseded by shipped phases).

This v3 prompt: project-aware anchor (newest STATE.md wins), checkpoint
freshness cross-check, probed cockpit status.

## If you want it automatic (SessionStart hook)

Wire the same text via the update-config skill (edits settings.json without
touching the env/secrets block).
