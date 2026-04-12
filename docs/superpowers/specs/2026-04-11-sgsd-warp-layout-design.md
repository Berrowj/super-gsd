# SGSD Warp Terminal Layout & Agent Viewers — Design Spec

**Status:** Draft · Session 1 (Problem capture + decision questions)
**Date:** 2026-04-11
**Author:** Jack Berrow + Claude (pair design session)
**Scope:** The full Warp terminal workspace Jack runs when working with SGSD on any project. Panes, launch, agent visibility, gate-verdict surfacing, cross-pane coordination. Supersedes the narrower dashboard spec for layout questions; the dashboard spec stays as the sub-design for pane internals.

**Related docs:**
- `docs/superpowers/specs/2026-04-11-sgsd-dashboard-design.md` — sibling spec, narrower (just sgsd1/sgsd2 pane internals). This spec decides where those panes live and how they're spawned. The sibling decides what's inside them.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — orchestrator loop the workspace observes.
- `super-gsd/tools/phase-verifier/phase-verifier.mjs` — mechanical verifier the workspace must surface verdicts from.
- `C:/Users/jack.berrow/.warp/launch_configurations/gsdedits-workspace.yaml` — current (trial) launch config, to be replaced or evolved.
- `C:/Users/jack.berrow/.gsd/tmux/tmux-clarity.sh` — existing tmux-based layout for comparison.

---

## 1. Problem statement

Jack runs SGSD against two large codebases (`project-clarity-erp`, `GSDedits` itself, and occasional one-offs) and needs a Warp terminal workspace that:

1. **Lets him see every agent the orchestrator spawns, live, without ambiguity.** Current state: the main Claude pane shows a single stream of orchestrator output, sub-agents are embedded as tool-call blocks that scroll past, and the dashboard surfaces at most one recent agent. Jack cannot confidently answer "what is agent #3 doing right now?" at any given moment. This has been the #1 trust problem in the last five sessions.

2. **Runs the orchestrator, the dashboards, the dev server, the gate-verdict feed, and ad-hoc shells without Jack manually wiring panes every session.** The current state is: Jack launches panes by hand each time (or uses a partial launch config that opens a new Warp window instead of reusing the current one). Nothing is reusable across projects without copying YAML.

3. **Surfaces gate verdicts and deferral-ledger entries loudly.** When Step 6.5 (ATC) or Step 6.6 (browser verify) blocks, the main Claude pane prints it in line with thousands of other tool outputs. Jack has scrolled past blockers. The workspace must promote these to a persistent visible surface Jack cannot miss.

4. **Handles the Windows / WSL / Warp reality honestly.** `gsd-browser` only has Linux+macOS binaries. `warp.exe` on Windows is the cloud Oz CLI, not a local pane controller. Programmatic split-pane inside the current Warp window is not available on Windows. tmux inside WSL is the only mechanism that supports "script spawns a new pane with a command". Any design that pretends Warp on Windows can do CLI-triggered splits is a lie.

5. **Has one launch command per project.** Typing `sgsd-start clarity` (or equivalent) should open the complete workspace for that project — orchestrator pane, dashboard, narrative, liveness monitor, dev server, logs tail, and whatever else the design lands on — with correct project paths in every pane, in < 3 seconds.

6. **Survives a context reset.** When Jack /pauses and comes back, the same layout spins up again, reads the checkpoint, and resumes without ceremony.

**Goal of this series:** design the terminal workspace Jack actually wants. Output is (a) a pane inventory, (b) a launch mechanism that works on Windows+Warp+WSL, (c) an agent-visibility strategy that solves the #1 trust problem, (d) a gate-verdict surface that is impossible to miss, and (e) a per-project profile system so clarity and gsdedits don't collide. The output of this series is code (PowerShell / bash / launch configs / small tools) committed to this repo, not just documents.

---

## 2. Non-goals (this series)

- **Not rewriting the orchestrator.** The orchestrator and its gates stay as they are. The workspace observes.
- **Not rewriting the dashboard internals.** Covered by the sibling dashboard spec.
- **Not picking a shell.** PowerShell, bash, or Node — we choose per-component based on what fits, not for consistency.
- **Not supporting non-Warp terminals.** Jack uses Warp. If Warp has to defer a job to tmux-inside-WSL, fine. But Windows Terminal / alacritty / iTerm are out of scope.
- **Not designing for teams.** One user, one machine, two or three repos.
- **Not theming.** Colour choices are a dashboard-spec concern.

---

## 3. The seven decisions (Session 1 output)

This session produces **decisions**, not code. Every other session depends on these being locked. Jack edits this section inline (or on the phone call, or via ByteRover, whichever he prefers) until every row has a resolved value.

Each decision has: the question, the candidate answers, the tradeoff summary, and a placeholder for Jack's choice.

### Decision D1 — Primary workspace substrate

**Question:** Where does the multi-pane workspace actually live?

**Candidates:**

| ID | Option | Can do CLI-triggered splits? | Unified UX | Windows-native | WSL deps |
|---|---|---|---|---|---|
| D1-A | Warp on Windows with manual splits (Ctrl+D/Ctrl+Shift+D) | No | Yes | Yes | None |
| D1-B | Warp launch config → opens a *new* Warp window with fixed panes | Sort of (palette only, per-launch) | Yes | Yes | None |
| D1-C | Warp tab running `wsl → tmux` as the outer shell, tmux inside does all splits | Yes (tmux split-window) | Mostly — one Warp tab hosts a tmux session, tmux has its own borders/status | No (WSL) | Yes |
| D1-D | Hybrid: Warp for main Claude + dashboards; WSL tmux for dev servers + agent viewers | Partial | Split mental model | Mixed | Yes |

**Tradeoff summary:**
- D1-A is the simplest but you cannot script pane creation. Everything is manual. "Agent viewers auto-appear" is impossible.
- D1-B is the "correct" Warp-native answer but launches a new window each time. You lose in-place composition.
- D1-C is the technically superior answer: tmux can spawn panes, name them, send keys, script layout recipes. You pay the "my terminal is now running tmux inside WSL inside Warp" ergonomic tax.
- D1-D keeps some things in Warp's nice UX and moves the scripted panes into WSL. Increased complexity.

**Jack's decision:** _<fill in — this is the keystone decision, everything else in this spec hangs on it>_

### Decision D2 — Agent visibility strategy

**Question:** How does Jack see what each orchestrator sub-agent is doing in real time?

**Candidates:**

| ID | Option | Accuracy | Token cost | Infra cost |
|---|---|---|---|---|
| D2-A | Read the main Claude pane; accept that sub-agent output is inline | Low (scroll-past) | Zero | Zero |
| D2-B | Tag every `PreToolUse` hook entry with the active agent stack via Claude Code hook env vars, then per-pane `tail -f` filtered by agent | High — if env vars exist | Zero | ~30 min to wire |
| D2-C | Orchestrator writes `.planning/ORCHESTRATOR-LIVE.jsonl` on every TaskCreate/TaskUpdate/BLOCKER, dashboards replay it | High — authoritative | Zero | Orchestrator SKILL.md edit + dashboard rewrite |
| D2-D | Detach sub-agents into real subprocess `claude -p` sessions, one per pane | Max visibility | Large (each subprocess is a fresh model call) | Significant rewrite of orchestrator loop |

**Tradeoff summary:**
- D2-A is "do nothing" — the current state that has failed.
- D2-B depends on whether Claude Code actually exposes the active agent to hook scripts. I have not confirmed it does. If it doesn't, D2-B is impossible.
- D2-C is the cleanest: orchestrator writes authoritative events, dashboards are dumb replay viewers. No env var dependency, no subprocess detach, minimal rewrite. Recommended.
- D2-D is the "truest" option but rewrites the orchestrator's loop model fundamentally.

**Recommendation:** D2-C.
**Jack's decision:** _<fill in>_

### Decision D3 — Pane inventory

**Question:** What panes does the workspace need, at minimum?

**Proposed starter set** (subject to edit based on D1 and D2):

| # | Pane name | Purpose | Interactive? | Source file / command |
|---|---|---|---|---|
| P1 | Main Orchestrator | `claude --dangerously-skip-permissions` — the autonomous loop runs here | Yes | - |
| P2 | Liveness Monitor | Single-glance "is it alive, thinking, stuck, or dead" | No | new: `sgsd3` |
| P3 | Mission Control | Phase / wave / pulse / agent roster | No | `sgsd1` (rewritten) |
| P4 | Narrative Feed | Haiku summary of recent activity, slower cadence | No | `sgsd2` (rewritten) |
| P5 | Gate Verdict Board | ATC + Browser Verify + Deferral Ledger surface | No | new: `sgsd4` |
| P6 | Dev Server | `npm run dev` for the active project | Yes | per-project |
| P7 | Shell | Ad-hoc git / curl / whatever | Yes | - |

**Jack's decisions:**
- D3.1 — Keep, cut, merge, or reorder which panes? _<fill>_
- D3.2 — Any missing pane? (e.g. dedicated logs tail, separate test runner, ByteRover explorer?) _<fill>_
- D3.3 — Min number of panes you're willing to have on screen at once? _<fill — e.g. 3 / 5 / 7>_

### Decision D4 — Launch mechanism

**Question:** How does the workspace actually start?

**Candidates:**

| ID | Option | Cross-project | Windows-native | One-command launch |
|---|---|---|---|---|
| D4-A | Per-project Warp launch config YAML, invoked from palette | Yes (one file per project) | Yes | No (palette, 2 clicks) |
| D4-B | `sgsd-start <project>` .cmd wrapper that spawns Warp with a launch config arg | Yes | Yes | Yes |
| D4-C | `sgsd-start <project>` that drops into WSL + tmux session template per project | Yes | Mostly | Yes |
| D4-D | A hybrid: palette-triggered Warp launch config + tmux inside one tab | Yes | Yes | No |

**Depends on:** D1.
**Jack's decision:** _<fill — probably locked once D1 is answered>_

### Decision D5 — Gate verdict surfacing

**Question:** How does the workspace make gate failures impossible to miss?

**Candidates:**

- D5-A: Dedicated `sgsd4` pane that tails `.planning/phases/*/**BROWSER-REVIEW.md**` + `*ATC-REVIEW.md` + `DEFERRAL-LEDGER.md`. Shows most recent verdict per phase, colour-coded.
- D5-B: Windows toast notification (via `BurntToast` PowerShell module) on every new BLOCKER or UNPROVEN.
- D5-C: Pane border colour changes (if using tmux — it supports border colours per pane).
- D5-D: Loud ASCII banner printed in the main Claude pane at every cycle start — but loud enough that it can't be scrolled past unnoticed.
- D5-E: All of the above.

**Recommendation:** D5-A + D5-B (authoritative pane + system notification).
**Jack's decision:** _<fill>_

### Decision D6 — Per-project profiles

**Question:** How does the workspace know which project it's running against, and where config lives?

**Candidates:**

- D6-A: Hardcoded wrappers — `sgsd-start-clarity.cmd`, `sgsd-start-gsdedits.cmd`, one per project.
- D6-B: Single `sgsd-start <project-name>` wrapper that reads `%USERPROFILE%\.sgsd\projects.json` mapping project name → path + launch recipe.
- D6-C: Auto-detect from `cwd` when invoked — wrapper walks up looking for `.planning/`, uses whatever it finds.
- D6-D: An environment variable `SGSD_PROJECT_DIR` set per Warp tab.

**Recommendation:** D6-B (explicit registry) + D6-C (cwd fallback).
**Jack's decision:** _<fill>_

### Decision D7 — Session resume behaviour

**Question:** When Jack types `sgsd-start clarity` after a context reset, what should happen?

**Candidates:**
- D7-A: Fresh workspace every time. Orchestrator reads checkpoint on startup.
- D7-B: Workspace detects an existing workspace for the project and attaches to it if present, creates fresh if not.
- D7-C: Checkpoint determines whether to auto-`/sgsd-orchestrate go` on startup.

**Recommendation:** D7-B (detect existing) + D7-C (auto-resume from checkpoint).
**Jack's decision:** _<fill>_

---

## 4. Decision dependency graph

```
D1 (substrate) ──┬──► D3 (pane inventory)
                 ├──► D4 (launch mechanism)
                 └──► D5 (gate verdict surfacing)

D2 (agent visibility) ──► D3 (pane inventory)

D6 (per-project profiles) ──► D4 (launch mechanism)

D7 (session resume) ──► D4 (launch mechanism)
```

**Locked order:** D1 first, then D2 in parallel, then D3 + D6, then D4 + D5, then D7 last. Every session goal depends on D1.

---

## 5. Open questions (for Session 1 interactive)

Jack should answer these before I produce Session 2 (wireframe + launch script skeleton):

1. **Q1 — D1 resolution.** Which substrate? Warp-only, Warp+tmux hybrid, or full tmux-inside-WSL? My recommendation: **D1-C (tmux inside WSL)** because D2-C (agent log replay) works best when panes can be scripted, and D1-A/B cannot script pane creation on Windows Warp. But it trades ergonomic familiarity. Your call.

2. **Q2 — Claude Code location.** Does `claude.exe` run in Warp on Windows directly, or inside the WSL tmux session? This matters for Bash heredoc quoting, file paths, and whether activity-log.jsonl is written from the Windows or Linux side. Current state: Windows-native claude.exe.

3. **Q3 — Pane count floor.** What's the minimum number of panes you'll tolerate for a working session? 3, 5, or 7? This constrains the pane inventory in D3.

4. **Q4 — Gate notification style.** If gate verdict goes loud (D5-B toast), does that annoy you? If yes, what's an acceptable alternative that still can't be missed?

5. **Q5 — Project registry.** How many active projects do you want the workspace to support? 2 (clarity + gsdedits), 5, or arbitrary? Affects D6 effort.

6. **Q6 — What the main Claude pane should feel like.** Full focus mode (no dashboards visible while you type to claude)? Or side-by-side with everything else permanently visible? This is a big UX question.

7. **Q7 — What's broken about the current tmux setup?** You already have `tmux-clarity.sh` doing a 6-pane layout. What stopped you using it? Was it ergonomics, a bug, or just that you never finished wiring it? Understanding the regression here informs whether D1-C is actually the right call.

---

## 6. Session plan

- **Session 1 (this doc):** Problem, seven decisions, open questions. **Output:** this file with Jack's answers filled into D1–D7 and Q1–Q7.
- **Session 2:** Pane wireframe + launch script skeleton. Based on the substrate choice in D1, I produce (a) an ASCII mockup of the screen layout at three terminal sizes (1920×1080, 2560×1440, laptop), (b) a skeleton `sgsd-start` script that creates the workspace, (c) stubs for each new pane (liveness monitor, gate verdict board).
- **Session 3:** Agent visibility wire-up. Implement D2-C (the orchestrator-writes-live-log option) end-to-end: edit `sgsd-orchestrate` SKILL.md to append on every TaskCreate/TaskUpdate/BLOCKER; build the consumer pane(s) that replay the file.
- **Session 4:** Gate verdict surface. Implement D5. New `sgsd4` pane reading BROWSER-REVIEW.md + ATC-REVIEW.md + DEFERRAL-LEDGER.md. Notifications if D5-B wins.
- **Session 5:** Per-project profiles + session resume. Implement D6 and D7. `%USERPROFILE%\.sgsd\projects.json` schema; `sgsd-start <project>` entrypoint.
- **Session 6 (polish):** Widths, colours, edge cases, fallback when WSL isn't running, etc.

Each session ends with code committed to this repo (in `super-gsd/` and/or `bin/` wrappers in `%APPDATA%\npm\`), not just edits to this doc.

---

## 7. What this session is not

- Not rearguing the gate-check problem. That's solved in `phase-verifier.mjs`.
- Not a PowerShell exercise. If the right substrate is bash + tmux, we switch and most of the existing PowerShell scripts get ported.
- Not a promise to keep sgsd1/sgsd2 as they are. They may be rewritten, merged, or split.
- Not a week-long design festival. Every session produces shipped code or a locked decision — not discussion for its own sake.

---

## 8. Decision log (append-only)

| Date | Decision | Resolution | Rationale |
|---|---|---|---|
| 2026-04-11 | Spec created | Draft | Session 1 opened |
| | | | |
