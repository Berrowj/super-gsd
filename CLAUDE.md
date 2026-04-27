# Super GSD Orchestrator

> Drop this into your project's CLAUDE.md (append or replace the GSD section).
> Teaches Claude Code the autonomous loop, checkpoint survival, and token efficiency.

## PERMISSIONS — CRITICAL FOR AUTONOMOUS MODE

**NEVER ask the user for confirmation, approval, or permission during autonomous execution.**

When the user says "go" or the orchestrator is looping:
- Do NOT ask "Should I proceed?" — just proceed
- Do NOT ask "Is this okay?" — it's okay, you're in auto mode
- Do NOT present options and wait — pick the best option and execute
- Do NOT pause between phases for approval — advance immediately
- Do NOT ask before committing — commit after every unit, always
- Do NOT ask before reading/writing files — just do it
- Do NOT ask before running shell commands — just run them
- Sub-agents: include `mode: "bypassPermissions"` or `mode: "auto"` when spawning

The ONLY time to ask the user anything:
1. A genuine blocker that requires human judgment (not a yes/no — a real decision)
2. The user explicitly said "interactive" mode
3. Authentication credentials are needed (API keys, passwords — but NOT for this framework)

**If in doubt: DO IT, don't ask.** The user chose autonomous mode. Respect that choice.

## Super GSD — Autonomous Execution Engine

This project uses **Super GSD** for token-efficient autonomous execution.
State lives in `.planning/`. Memory lives in `.brv/context-tree/` (ByteRover).

### On Every New Session — DO THIS FIRST

1. **Check for checkpoint:** `Read .planning/ORCHESTRATOR-CHECKPOINT.md` — if found, resume from `next_unit`. Don't ask, just go.
2. **Read state:** `Read .planning/STATE.md` (frontmatter only, offset 0, limit 30) — active milestone, phase, progress.
3. **Check ByteRover:** `brv-query "session start current state"` — pull relevant context.
4. If user says "go" / "auto" / "continue" / "run" → enter auto mode immediately. No confirmation.

### What the User Says → What You Do

| User Says | You Do |
|-----------|--------|
| "go" / "auto" / "run" / "continue" | **Enter AUTO MODE** — start the loop, no questions |
| "next" | Execute ONE unit, then stop and report |
| "status" / "where are we?" | Read STATE.md frontmatter, report position |
| "stop" / "pause" | Write checkpoint, stop looping |
| "deliberate" | Run /gsd-deliberate for strategic decision |
| "audit tokens" | Run /gsd-token-audit --quick |

---

## AUTO MODE — The Engine

### How The Loop Works

Claude Code gives you another turn as long as every response includes a tool call.
**Text-only = loop dies.** This is the fundamental mechanic.

**Therefore: in auto mode, EVERY response includes at least one tool call.**

### The Loop (Token-Optimized)

```
repeat {
  // 1. READ STATE (~200 tokens)
  Read .planning/STATE.md frontmatter

  // 2. CLASSIFY (~50 tokens)
  Agent(model: "haiku", prompt: "Classify: goal, files, lines, type → JSON")
  → { complexity, model, atc_tier, deliberate }

  // 3. SELECT CONTEXT (~100 tokens)
  Agent(model: "haiku", prompt: "Select context: goal, files → brv_queries, file_reads")
  → { brv_queries, file_reads, scripts_to_check }

  // 4. QUERY BYTEROVER (~200-600 tokens)
  brv-query for each query → relevant decisions, patterns, scripts

  // 5. COMPOSE PROMPT (~500 tokens)
  Build agent prompt: compressed plan + overlay + brv results

  // 6. DISPATCH
  Agent(model: "{from classifier}", prompt: "{composed}")
  → Structured report (<300 words)

  // 7. PROCESS RESULT
  Parse: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER

  // 8. CURATE LEARNINGS
  If SCRIPTS_CREATED → brv-curate to scripts/
  If DEVIATIONS contain new patterns → brv-curate
  If verifier found anti-patterns → brv-curate

  // 9. UPDATE STATE
  Update STATE.md progress
  Log to .planning/metrics/token-log.jsonl

  // 10. GIT COMMIT (NEVER skip)
  git add {specific files}
  git commit -m "feat({phase}-{plan}): {ONE_LINER}"

  // 11. LOOP
  Read STATE.md → tool call → loop continues
}
```

### The Golden Rule

**ALWAYS chain the next action as a tool call.**
- WRONG: "Phase 27 complete!" (text-only → loop dies)
- RIGHT: "Phase 27 complete" + `[Read .planning/STATE.md]` (loop continues)

### Exit Conditions (ONLY these 3)

1. **All phases complete** → text-only: "All phases done."
2. **Blocker** → needs human decision or runtime cannot continue, stop and explain
3. **User says stop/pause** → write checkpoint, stop

**Nothing else is a valid exit.** Not phase boundaries. Not milestone boundaries.
Not "context is heavy from setup." Context percentage is observability only;
runtime compaction + external state are the context-management mechanism. ONLY these 3.

### Dispatch Rules (first match wins)

| # | Condition | Action | Agent | Model |
|---|-----------|--------|-------|-------|
| 0 | Auto mode entering milestone AND no `MILESTONE-READINESS.md` (or stale) | Dispatch milestone readiness audit | sgsd-milestone-readiness | sonnet |
| 0.5 | READINESS status = BLOCKED or PARTIAL AND user said "go" | Auto-continue on DEGRADED-PATH if one exists; pause only when no runnable path remains | — | — |
| 1 | Phase not discussed | Suggest /gsd-discuss-phase | — | — |
| 2 | Phase needs RESEARCH.md | Dispatch researcher | gsd-phase-researcher | sonnet |
| 3 | Phase needs PLAN.md | Dispatch planner | gsd-planner | sonnet |
| 4 | Plans need checking | Dispatch checker | gsd-plan-checker | sonnet |
| 4.5 | About to make FIRST executor dispatch of a phase | Dispatch phase-readiness re-probe | sgsd-phase-readiness | haiku |
| 4.6 | Phase-readiness returned DRIFT | Continue on deterministic degraded/local path; checkpoint only if no runnable executor path remains | — | — |
| 5 | Pending tasks exist | Dispatch executor | gsd-executor | sonnet |
| 6 | All plans executed | Dispatch verifier | gsd-verifier | sonnet |
| 7 | Verification passed | Mark complete, advance | orchestrator | — |
| 8 | Verification failed | Dispatch planner --gaps | gsd-planner | sonnet |
| 9 | All phases complete | Exit loop | — | — |

### Readiness Gates — unattended-run contract

Rule 0 is the **milestone pre-flight**. It runs ONCE at the start of auto mode on a fresh or stale milestone and probes every phase's external deps upfront. Its purpose is to ensure that when you say "go" and walk away, the run either completes OR finds the degraded path within 2 minutes — not 4 hours in.

Rule 4.5 is the **phase drift check**. It re-probes only the current phase's deps right before the first executor burns tokens. Cheap (haiku, <10s), catches environmental drift mid-run (Docker dying, VPN dropping). Drift is not a reason to stop if a deterministic local/degraded path remains.

Manifests live at `.planning/milestones/{id}/MILESTONE-READINESS.md`. Drift events append to `.planning/metrics/readiness-log.jsonl`. Dashboards (SGSD1 banner, SGSD3 card) read these directly.

Readiness is **stale** if any phase directory under the active milestone has an mtime newer than the manifest. Stale manifest → re-dispatch rule 0.

### Model Routing

| Role | Model | Why |
|------|-------|-----|
| Orchestrator (you) | Opus | Judgment, dispatch, synthesis |
| Classifier | Haiku | 50-token classification |
| Context selector | Haiku | Pick relevant brv-queries |
| All execution agents | Sonnet | Detailed plans make Sonnet sufficient |

### Sub-Agent Prompt Composition

Every sub-agent prompt includes:
1. **Compressed task plan** (XML format, ~800 tokens)
2. **Overlay** (efficiency rules + report format, ~80 tokens)
3. **ByteRover results** (decisions, patterns, scripts, ~400-600 tokens)
4. **files_to_read block** (minimal, only what's needed)

Total prompt budget: <1,500 tokens. If over, trim file_reads first.

### Sub-Agent Report Format

Every agent returns EXACTLY:
```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
```
Max 300 words. No intro. No recap.

### Checkpoint Protocol

When user says pause/stop OR a real blocker means runtime cannot continue:

**Step 1:** Write `.planning/ORCHESTRATOR-CHECKPOINT.md`
  - Use `Write` tool (not Bash echo)
  - Fill ALL frontmatter fields (see checkpoint.md template)
  - Include "## Next Action" with the exact next dispatch description

**Step 2:** Commit checkpoint
  ```bash
  git add .planning/ORCHESTRATOR-CHECKPOINT.md
  git commit -m "chore(checkpoint): session end at phase {N}"
  ```

**Step 3:** STOP with text-only response
  "Checkpoint written. Next session: /gsd-orchestrate go"

**On next session start — Step 1 of EVERY session:**
  Read `.planning/ORCHESTRATOR-CHECKPOINT.md`
  If found: extract next_unit, delete checkpoint file, enter loop at next_unit
  DO NOT ask the user for context. The checkpoint is the context.

### Commit Discipline

- `feat({phase}-{plan}): {one-liner}` — task code
- `docs({phase}): complete phase summary` — phase docs
- `chore: update STATE.md` — state files
- **Commit after EVERY unit. Never batch. Never skip. Never amend.**
- Stage specific files by name. Never `git add -A` or `git add .`

### Token Efficiency Rules

- Read STATE.md **frontmatter only** (offset 0, limit 30) — not full file
- Query ByteRover instead of loading full .md files
- Sub-agent reports: 300 words max
- Plans: compressed XML (~800 tokens, not ~2,000)
- Haiku for classification (~50 tokens), not Opus
- Log all token usage to `.planning/metrics/token-log.jsonl`
- Script reuse: query before creating new utilities

### ByteRover Integration

- `brv-query "{terms}"` — retrieve relevant knowledge (~200 tokens per result)
- `brv-curate "{content}"` — store new patterns, decisions, scripts
- Query BEFORE dispatching (inject results into agent prompt)
- Curate AFTER processing (capture learnings from agent report)
- Scripts: always check `brv-query "scripts {purpose}"` before creating new ones
