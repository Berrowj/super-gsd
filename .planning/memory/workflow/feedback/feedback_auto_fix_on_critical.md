---
name: In autonomous mode, ALWAYS fix-now on CRITICAL — never ask, never defer
description: When phase-level or per-dispatch ATC surfaces a CRITICAL finding in auto mode, the default action is to investigate + fix + re-verify inline. Do NOT present 3-option menus asking operator to choose fix-now vs defer vs pause.
type: feedback
originSessionId: e05ed485-05ef-4965-87f3-f385ab55c621
---
**Rule:** In auto mode, CRITICAL findings from any gate (per-dispatch-ATC / phase-level-ATC / MUDA / verifier) trigger IMMEDIATE investigate-and-fix behavior, NOT operator-menu. The only reason we stop and ask is if I've attempted fix + re-verify and it STILL has CRITs (actual stall, not style nit).

**Why:** Operator directive 2026-04-24 (verbatim): *"why wouldn't we fix now if we're in auto mode. Just do it, commit to memory, and don't ask again!"*

The halt-on-CRIT escalation (gates.yaml 01556d1) is a safety NET — it prevents bad code from silently merging. But the orchestrator's response to a halt SHOULD be "fix it and continue," not "pause and present options." The previous operator-menu pattern was a REGRESSION of the auto-advance directive (feedback_auto_advance_phase_stages).

**How to apply — SOP on CRIT:**

1. Read the ATC evidence (one-liner + any detail available)
2. Read the relevant source files to find the bug
3. Apply surgical fix(es) via Edit tool
4. Re-run the gate (re-dispatch Codex ATC)
5. Commit atomically: `fix(NN-PP/crit-fix-N): <specific correction>`
6. If CRIT=0 post-fix → continue the loop (next plan / verifier / MUDA / phase close / next phase)
7. If CRIT>0 after 3 fix attempts → NOW pause and surface for operator (genuine stall, Exit Condition #3)

**Operator's stated appreciation 2026-04-24:** *"Well done for catching it tho, this is exactly what we built these gates for, just need to fine tune the autonomy of everything."*

The catch itself was good (gate worked). The follow-up behavior (asking operator what to do) was the bug. Fix-now is the autonomy default.

**Pattern references to mimic:**
- v1.4 Phase 20 Codex 5-round fix-review cycle (operator explicitly said "fix now" and I did it 5 rounds until clean)
- v1.4 Phase 17-01 WASTE.md duplication fix (operator said "fix now" immediately)
- v1.4 Phase 17-03 config-backed tier resolution fix (same pattern)

Those all succeeded without menu-presenting between rounds. Same pattern from now on — default, no friction.

**When to genuinely pause:**
- 3 fix-retry attempts hit cap (SKILL.md plan-fix-retry-cap default)
- Context >70% (checkpoint protocol)
- Operator explicitly types stop/pause/hold mid-stream
- Fundamental design decision needed (e.g., "should this feature exist at all") — NOT bug fixes

**What I should NEVER do when a gate raises CRIT:**
- Write "3 exit paths — your call"
- Write "Options: fix now / defer / pause"
- Present the halt as a decision point when the decision is obvious (fix)
- Rationalize session fatigue as reason to ask instead of fix
