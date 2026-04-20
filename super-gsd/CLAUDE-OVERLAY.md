# Super GSD Orchestrator

> Drop this into your project's CLAUDE.md (append or replace the GSD section).
> Teaches Claude Code the autonomous loop, checkpoint survival, and token efficiency.

## BEHAVIOURAL GUIDELINES — Karpathy principles

Four rules that override everything else. Derived from Andrej Karpathy's observations on LLM coding pitfalls. If the guidelines below conflict with anything later in this file, the guidelines win.

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, **ask** rather than guess silently.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Test: *Would a senior engineer say this is overcomplicated?* If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- If you notice unrelated dead code, mention it in DEVIATIONS — don't delete it.
- Remove imports/variables/functions that *your* changes made unused; don't remove pre-existing dead code.
- Test: *Every changed line should trace directly to the user's request or the current plan task.*

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.
- Transform vague tasks into verifiable goals before you code.
  - "Add validation" → "Write tests for invalid inputs, then make them pass."
  - "Fix the bug" → "Write a test that reproduces it, then make it pass."
- For multi-step tasks, state a brief plan with per-step verification.
- Strong success criteria let the orchestrator loop independently. Weak criteria ("make it work") force clarification after every step.

**Enforcement mechanism inside SGSD:** these four principles are mechanically enforced by the **ATC Gate (Step 6.5)** which runs the 10-point anti-slop checklist at phase completion, the **Nyquist validation** gate which enforces test-first success criteria, and the **Surgical constraint** injected into every `gsd-executor` prompt (Step 7). Violating any of them shows up in the agent's DEVIATIONS section and — for phase-level violations — can block phase closure.

**Further reading:** <https://github.com/forrestchang/andrej-karpathy-skills>

---

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
3. **Cascade read (DLB-03):** Before planning any phase, read `.planning/PROJECT.md` core-value + `.planning/milestones/{active_milestone}/INTENT.md` + last completed phase `SUMMARY.md`. For the first phase of a milestone, INTENT.md alone. This is mandatory — skipped cascade = phase drift.
4. **Check memory:** `sgsd-recall "session start current state"` — pull relevant context.
5. If user says "go" / "auto" / "continue" / "run" → enter auto mode immediately. No confirmation.

### What the User Says → What You Do

| User Says | You Do |
|-----------|--------|
| "go" / "auto" / "run" / "continue" | **Enter AUTO MODE** — start the loop, no questions |
| "next" | Execute ONE unit, then stop and report |
| "status" / "where are we?" | Read STATE.md frontmatter, report position |
| "stop" / "pause" | Write checkpoint, stop looping |
| "deliberate" | Run /sgsd-deliberate for strategic decision |
| "audit tokens" | Run /sgsd-token-audit --quick |
| **Planning intent detected** (see below) | **Run /sgsd-triage first** — let it route to deliberate/orchestrate/muda |

### Planning-intent detection (auto-invoke /sgsd-triage)

When the operator's message contains planning/figuring-out intent, **invoke `/sgsd-triage` BEFORE doing any other work**. Do not improvise your own planning; the triage skill runs superpowers:brainstorming + superpowers:writing-plans, classifies the result, and routes to the right continuation. Respects DELIBERATION-FLOOR.

**Auto-invoke triggers (high confidence):**

- Starts with *"I'm thinking about..."*, *"I want to figure out..."*, *"How should we..."*, *"What if we..."*, *"Let's plan..."*, *"Let's explore..."*, *"Design..."*, *"Architect..."*, *"Evaluate..."*, *"Should we..."*
- Describes a problem or ambition without asking for immediate execution (no *"build this now"*, *"ship it"*, *"fix the bug"*)
- Mentions tradeoffs, alternatives, or multiple valid approaches
- Asks a research-style question the operator clearly wants thought through, not answered off-the-cuff

**DO NOT auto-invoke when:**
- Operator asks a direct factual question (*"what's the current phase?"*, *"where does X live?"*)
- Operator explicitly requests execution (*"go"*, *"run /sgsd-orchestrate"*, *"ship the fix"*)
- Operator is mid-build and asking for a specific code change
- The question is trivial (<5 min inline answer)

**Ambiguous?** Do NOT auto-invoke. Ask: *"sounds like a planning question — want me to run /sgsd-triage?"* The cost of wrong auto-invoke is operator friction; the cost of asking is ~10 tokens.

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
  sgsd-recall for each query → relevant decisions, patterns, scripts

  // 5. COMPOSE PROMPT (~500 tokens)
  Build agent prompt: compressed plan + overlay + brv results

  // 6. DISPATCH
  Agent(model: "{from classifier}", prompt: "{composed}")
  → Structured report (<300 words)

  // 7. PROCESS RESULT
  Parse: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER

  // 8. CURATE LEARNINGS
  If SCRIPTS_CREATED → sgsd-curate to scripts/
  If DEVIATIONS contain new patterns → sgsd-curate
  If verifier found anti-patterns → sgsd-curate

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

### Exit Conditions (ONLY these 4)

1. **All phases complete** → text-only: "All phases done."
2. **Context >70%** → write checkpoint FIRST, then text-only stop
3. **Blocker** → needs human decision, stop and explain
4. **User says stop** → write checkpoint, stop

**Nothing else is a valid exit.** Not phase boundaries. Not milestone boundaries.
Not "context is heavy from setup." ONLY these 4.

### Dispatch Rules (first match wins)

| # | Condition | Action | Agent | Model |
|---|-----------|--------|-------|-------|
| 1 | Phase not discussed | Suggest /gsd-discuss-phase | — | — |
| 2 | Phase needs RESEARCH.md | Dispatch researcher | gsd-phase-researcher | sonnet |
| 3 | Phase needs PLAN.md | Dispatch planner | gsd-planner | sonnet |
| 4 | Plans need checking | Dispatch checker | gsd-plan-checker | sonnet |
| 5 | Pending tasks exist | Dispatch executor | gsd-executor | sonnet |
| 6 | All plans executed | Dispatch verifier | gsd-verifier | sonnet |
| 7 | Verification passed | Mark complete, advance | orchestrator | — |
| 8 | Verification failed | Dispatch planner --gaps | gsd-planner | sonnet |
| 9 | All phases complete | Exit loop | — | — |

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

When context >70% OR user says pause/stop:

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
  "Checkpoint written. Next session: /sgsd-orchestrate go"

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

### Memory Retrieval (DLB-01 — replaces ByteRover)

Per DLB-01 (`.planning/decisions/DLB-01-memory-topology.md`), the SGSD-global
memory tier is a git-native filesystem store at `.brv/context-tree/` with an
`INDEX.md` catalogue. The shell wrappers below are the stable callable
interface; the dead `brv-query` / `brv-curate` no-ops (and the unconnected
`brv` MCP) have been removed.

- `sgsd-recall "{terms}"` — grep INDEX.md by query terms, emit top-N file
  contents with `<!-- sgsd-recall: type/slug -->` framing (~200 tokens per
  result). Supports `--type`, `--limit`, `--paths-only`. Lives at
  `super-gsd/scripts/sgsd-recall.sh`; auto-walks up from CWD to find
  `.brv/context-tree/`.
- `sgsd-curate --type T --slug S --summary "≤80 chars" [--tags "a,b"] < body.md`
  — atomic write of a new entry + INDEX.md update. Types:
  `pattern | anti-pattern | decision | expertise | script`.
- Query BEFORE dispatching (inject results into agent prompt).
- Curate AFTER processing (capture learnings from agent report).
- Scripts: always check `sgsd-recall "scripts {purpose}"` before creating
  new ones.

Revisit BM25 ranking infrastructure only at the 40-file tripwire (see
DLB-01). Until then, grep + INDEX.md curation discipline is sufficient.
