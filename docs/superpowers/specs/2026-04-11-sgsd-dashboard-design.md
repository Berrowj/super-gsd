# SGSD Dashboard & Observability — Design Spec

**Status:** Draft · Session 1 (Problem capture)
**Date:** 2026-04-11
**Author:** Jack Berrow + Claude (pair design session)
**Scope:** sgsd1 (Mission Control), sgsd2 (Narrative Feed), and any net-new panes needed to answer the questions Jack actually has about the orchestrator in real time.
**Related:**
- `super-gsd/scripts/sgsd-dashboard.ps1` — current Mission Control (being redesigned)
- `super-gsd/scripts/sgsd-narrative.ps1` — current Narrative Feed (being redesigned)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — orchestrator loop the dashboard observes
- `.planning/metrics/activity-log.jsonl` — the primary data source
- `.planning/metrics/token-log.jsonl` — cost signal
- `.planning/STATE.md` — authoritative state frontmatter

---

## 1. Problem statement

Jack cannot tell, at a glance, whether the SGSD orchestrator is actually working. The existing dashboards emit plausible output but fail the one test that matters: they do not produce confident answers to the questions Jack actually has while the orchestrator runs. Specifically:

1. **Liveness is ambiguous.** Dashboard shows counts and waves but not "is anything happening right now". Jack cannot distinguish between (a) orchestrator thinking, (b) orchestrator stuck, (c) orchestrator crashed, (d) orchestrator waiting on something external. He has asked multiple times how to tell, and the current answer is "read the commit time column and make a judgment call" — which is a puzzle, not an answer.

2. **Agent visibility is fake.** The "Agents" row currently shows 1 row because the activity log only captures Agent spawn events (not the sub-agent's internal tool calls). A phase may have 5 sub-agents running in sequence and the dashboard shows "1 agent, IDLE, 2m ago" — which is literally true but conveys none of the live picture. The user asked "what is every agent doing right now" and we have no data source that answers it.

3. **Wave and phase position is inferred, not authoritative.** The dashboard parses PLAN.md bodies for `<name>Wave N · ...</name>` blocks and uses git log heuristics to guess which wave is active. This works accidentally for Phase 89 Plan 01 because the plan happens to encode waves as XML tasks. It will break for any plan that encodes waves differently. The position should be a single write from the orchestrator, not a guess by the viewer.

4. **Trust is broken.** Jack has seen repeated cases in `project-clarity-erp` where agents report PASS without evidence (silent curl fallback counted as a browser audit, spinner screenshots counted as "page renders", empty API responses counted as "working"). The dashboard currently shows none of this. A phase can close with `verdict: passed` on the dashboard while the actual frontend is broken. The dashboard must surface gate evidence, not just gate verdicts.

5. **Format bugs keep returning.** sgsd1 truncates agent rows into a tangled middle column. sgsd2 scrambles every poll even after the ANSI clear fix. Both scripts assume pane widths they don't have. This is not a width bug, it's a structural bug: the scripts write rows of unpredictable width and rely on overwriting cleanly, which is fragile.

6. **Polling cadence is wrong.** sgsd2 calls Haiku every 60s by default, which is too often for a 5-sentence narrative and burns tokens. sgsd1 polls every 10s which is fine but the file-watcher hook claims "live update" and isn't wired. Cadence should be tied to the signal, not a fixed timer.

**The goal of this series:** design a new observability layer that answers Jack's actual questions with evidence from authoritative sources, not cleverness. When it's done, Jack must be able to look at one screen and answer five questions in under three seconds:

- Is the orchestrator alive?
- What is the current unit of work?
- What is every agent doing right now?
- Has every gate that was supposed to fire, fired — with evidence I can stat?
- If something is wrong, what specifically is wrong?

---

## 2. Non-goals (this series)

- **Not rewriting the orchestrator.** The orchestrator's loop stays as it is. This spec only changes how we observe it.
- **Not designing Warp/tmux workflows.** Pane layout choice is out of scope here. This spec outputs data and rendering contracts; where the rendered output lives is a separate decision.
- **Not replacing ATC or browser verify gates.** Those were just hardened in Step 6.6. This spec surfaces their output, not their logic.
- **Not a general-purpose monitoring tool.** This is a single-user, single-session dashboard for one autonomous framework. We do not need Prometheus, Grafana, OpenTelemetry, or time-series storage.
- **Not a cloud product.** All state lives on the local filesystem. No auth, no network, no persistence beyond files we already write.

---

## 3. The five questions (working draft — Jack to validate)

Every piece of the new dashboard must serve one of these. If it doesn't, it doesn't ship.

### Q1. Is the orchestrator alive?
Signals:
- `claude.exe` pid exists and is using CPU
- Activity-log.jsonl has a new line in the last 30s
- STATE.md was touched in the last 5min
- git HEAD moved in the last 5min
Verdict levels: **ALIVE** (≤30s) | **THINKING** (≤5min) | **STUCK** (5-15min) | **DEAD** (>15min)

### Q2. What is the current unit of work?
- Milestone: from STATE.md frontmatter
- Phase: from STATE.md frontmatter
- Plan: from STATE.md frontmatter or most recent TaskCreate
- Wave: from most recent TaskCreate target, parsed
- Task within wave: from most recent TaskCreate target, parsed
- **Authoritative source must be written by the orchestrator**, not inferred.

### Q3. What is every agent doing right now?
This is the hard one because sub-agent tool calls aren't tagged. Three possible approaches (open question — see §6):
- **Approach A**: Modify the activity-logger hook to include a rolling "current agent stack" from the Claude Code hook env vars. Requires knowing what env vars are exposed.
- **Approach B**: Orchestrator writes `.planning/ORCHESTRATOR-LIVE.jsonl` appending one line per `TaskCreate` with agent, start_ts, and one line per `TaskUpdate` with end_ts. Dashboard reads this directly — simple and authoritative.
- **Approach C**: Parse the orchestrator's own tool-use stream (not available to us at dashboard level).
**Recommendation: Approach B.** It's zero-infrastructure, orchestrator already has the info, and the file is a simple append-only log. Details in §4.

### Q4. Has every gate fired with evidence?
For the active phase, show:
- Verifier status: pending | passed | failed (from `{NN}-VERIFICATION.md` existence + content)
- ATC gate: pending | passed | failed (from `{NN}-ATC-REVIEW.md` existence + parsed verdict)
- Browser verify: pending | skipped | proven | unproven (from `{NN}-BROWSER-REVIEW.md` existence + parsed verdict)
- Evidence file count per audited route (from `evidence/` + `screenshots/` directories)
- Deferral-ledger entries for the active phase (from `.planning/DEFERRAL-LEDGER.md`)
**If a gate should have fired and didn't, the dashboard turns red.** This is the anti-hallucination anchor.

### Q5. If something is wrong, what specifically is wrong?
- Top blocker (from STATE.md Blockers section + most recent BLOCKER log line)
- Last error in activity log (exit code ≠ 0)
- Oldest deferral ledger entry still open
- Most recent WARN or BLOCK in phase summary

---

## 4. Data contract (working draft)

The dashboard must only read from authoritative sources. Every signal maps to exactly one file:

| Signal | Source file | Writer |
|---|---|---|
| Position (milestone / phase / plan / wave / task) | `.planning/STATE.md` frontmatter + `.planning/ORCHESTRATOR-LIVE.jsonl` latest line | Orchestrator (new write) |
| Liveness pulse | `.planning/metrics/activity-log.jsonl` last line ts | Existing hook |
| Agent roster | `.planning/ORCHESTRATOR-LIVE.jsonl` (new file) | Orchestrator (new write) |
| Gate status | `.planning/phases/{NN}-*/` — existence of `{NN}-VERIFICATION.md`, `{NN}-ATC-REVIEW.md`, `{NN}-BROWSER-REVIEW.md` | Respective gate steps |
| Evidence count | `.planning/phases/{NN}-*/evidence/*.json` + `screenshots/*.png` | sgsd-browser agent |
| Deferrals | `.planning/DEFERRAL-LEDGER.md` | Orchestrator on bypass |
| Blockers | `.planning/STATE.md` + BLOCKER log lines | Orchestrator + agents |
| Cost | `.planning/metrics/token-log.jsonl` | Existing logger |

**New file to introduce:** `.planning/ORCHESTRATOR-LIVE.jsonl`
- One line per `TaskCreate`: `{ts, event:"start", task_id, agent, model, phase, plan, wave, task, description}`
- One line per `TaskUpdate`: `{ts, event:"end", task_id, verdict, duration_ms}`
- One line per BLOCKER: `{ts, event:"blocker", task_id, reason}`

The dashboard replays this file in memory each poll, keeping a live view of which agents are started-but-not-ended. That is the agent roster — authoritative, correct, zero guessing.

---

## 5. Rendering approach (placeholder — Session 2)

Not designed yet. Session 2 output:
- One ASCII wireframe that fits in a terminal pane 40-100 cols wide and 20-40 rows tall
- Explicit layout: which block goes where, how wide, what truncation rule
- Colour assignments (which colour means ALIVE, STUCK, etc.)
- A clearly-stated "if this overflows, this is the fallback" rule for every block

Design constraints for Session 2:
- Every row has a fixed maximum width declared upfront. No dynamic column widths that depend on data.
- Every row is padded with ANSI `\e[K` (clear-to-end-of-line) after content so re-draws cannot leave leftover characters.
- Every numeric value has a static format (e.g. `2m 34s` not `154s` — always 6 chars) so columns don't jiggle.
- Five questions map to five visually distinct zones. A reader should be able to find any of the five without scanning.
- The word "ALIVE" / "STUCK" / "DEAD" appears literally, once, in large text — no need to compute mental thresholds.

---

## 6. Open questions (for Jack)

**Q-A. Signal source for "is claude.exe actually running".** On Windows, `tasklist /fi "imagename eq claude.exe"` or `Get-Process claude`. On WSL, `pgrep claude`. Do we want the dashboard on Windows PowerShell (current), or should we move rendering to WSL where signal sourcing is easier? **Jack decides.**

**Q-B. Single pane or two panes?** Current design has Mission Control + Narrative. The five questions might fit in one pane if dense, or two if airy. Which do you prefer? **Jack decides.**

**Q-C. Do we keep the Haiku narrative at all?** It was a nice-to-have but burns tokens. If the agent roster from ORCHESTRATOR-LIVE.jsonl is good enough, we might drop the Haiku call entirely. **Jack decides after Session 2 wireframe.**

**Q-D. Liveness refresh cadence.** Current sgsd1 polls every 10s. For a true liveness indicator we want the "seconds since last activity" counter to tick every second, which means the pane either (a) uses a FileSystemWatcher and only re-renders the counter block, (b) does a 1s loop but writes only the counter line, or (c) accepts 10s granularity and writes "10-20s" bucket ranges. **Recommendation: (a) or (b). Jack confirms.**

**Q-E. Gate status — do we want a count, a verdict, or both?**
- Count: "ATC: 3 critical, 2 warn" (numerical)
- Verdict: "ATC: FAIL" (categorical)
- Both: "ATC: FAIL (3C 2W)"
**Jack picks.**

**Q-F. The one thing you wish it told you.** The single answer to this question, written in plain English, becomes the headline of the new dashboard. Everything else is supporting detail. **Jack writes this.**

---

## 7. Session plan

- **Session 1 (this doc):** Problem, non-goals, five questions, data contract, open questions. **Output: this file.** Jack reviews, edits, answers Q-A through Q-F inline.
- **Session 2:** Wireframe. Based on Session 1 answers, I produce a single ASCII mockup of the target layout. Jack marks it up. We iterate until it's right.
- **Session 3:** Data model. Every block in the wireframe maps to a data source from §4. Any gaps trigger a sub-task to extend the orchestrator to write the missing signal.
- **Session 4:** Implementation. I replace sgsd1/2 with a new script (or two) that implements the wireframe against the data contract. Jack tests live in project-clarity-erp.
- **Session 5 (if needed):** Polish. Any format bugs, edge cases, cadence tuning.

---

## 8. What this spec must NOT become

- A PowerShell exercise. If the right renderer is bash + tmux, we switch. The language follows the design, not the other way round.
- A general-purpose tool. The dashboard serves Jack's workflow on Jack's two projects. It does not need to be portable, themable, or "productized".
- A patch pile on sgsd1/sgsd2. We are designing a replacement, even if we partially reuse the current scripts.
- A discussion about observability in general. Scope is locked to the five questions in §3.
