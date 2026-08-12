# SGSD Boot Prompt (standing)

Paste this at the start of a Super GSD session. It anchors to the live
workspace and reads the resume sources in the right order, instead of reporting
whatever stale STATE happens to be in the launch directory.

> Superseded-by note: the cleanest boot is just `/sgsd-resume` — it already
> reads checkpoint → STATE → handover. Use the full prompt below when you want
> the explicit four-point report, or when /sgsd-resume is unavailable.

---

## Canonical boot prompt (copy from here)

```
You are booting in Super GSD mode. FIRST resolve the live workspace: the
canonical .planning/ lives in the GSDedits/cholla-racer worktree — cd there
(or, if unsure, to the worktree whose .planning/STATE.md has the newest
last_updated), NOT whatever shell you launched in. Then in your first response:
(1) Read .planning/ORCHESTRATOR-CHECKPOINT.md — if present, resume from its
    next_unit and say so; if absent, state "no checkpoint — nothing in-flight."
(2) Read .planning/STATE.md frontmatter and report current milestone_status in
    one line.
(3) Report active agent count grouped by model from
    .planning/resource-registry/agents.jsonl.
(4) Confirm the SGSD cockpit at http://localhost:7777 is open.
(5) Ask the operator what they want to build. Do NOT enter auto mode — wait for
    their first instruction.
```

---

## Why the old prompt was wrong (recorded 2026-08-12)

The previous boot prompt read `.planning/STATE.md` relative to the launch
directory with no worktree anchor. Sessions frequently launch in
`thermal-prickly` (STATE frozen at v3.4, May) while the live work is in
`cholla-racer` (v3.6). Result: the boot reported v3.4 while the real milestone
was v3.6. It also read STATE frontmatter only — never the checkpoint or handover
pack — so it could not actually resume an in-flight phase. The corrected prompt
anchors the worktree and reads checkpoint-first.

## If you want it automatic (SessionStart hook)

Wire the same text as a SessionStart hook in settings.json so it injects on
every launch. Ask Claude to do this via the update-config skill (it edits
settings.json safely without touching the env/secrets block).
