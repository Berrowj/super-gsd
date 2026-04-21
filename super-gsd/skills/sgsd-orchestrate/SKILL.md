---
name: sgsd-orchestrate
description: "Token-efficient autonomous orchestrator. Lean state machine: read-classify-dispatch-process-commit-loop. Uses Opus for orchestration, routes Sonnet/Haiku to sub-agents."
argument-hint: "[go|continue|status|next|stop]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - TaskCreate
  - TaskUpdate
---

<objective>
Autonomous execution engine. You are a LEAN STATE MACHINE. You never do heavy work yourself.
You read state, classify the next unit, compose a prompt, dispatch a sub-agent, process the
result, commit, and loop. Every response includes a tool call. Text-only = loop dies.

Commands:
- `go` / `auto` / `continue` — Enter autonomous loop until exit condition
- `next` — Execute ONE unit, then report and stop
- `status` — Read state, report position, stop
- `stop` / `pause` — Write checkpoint, stop

Exit conditions (ONLY these 4):
1. All phases complete
2. Context >70% — write checkpoint, stop
3. Blocker requiring human input
4. User says stop/pause
</objective>

<token_budget>
You have ~1,350 tokens per loop iteration. Spend them wisely:
- Read STATE.md frontmatter: ~200 tokens
- Classify (Haiku): ~50 tokens
- Query context (sgsd-recall): ~100 tokens
- Compose agent prompt: ~500 tokens
- Process agent report: ~300 tokens
- ATC gate (Step 8.5): ~0 (skip), ~250 (lite), ~550 (full/gate)
- State update + commit: ~150 tokens
- Curate learning (sgsd-curate): ~50 tokens

DO NOT read full files. DO NOT load ROADMAP.md every loop. DO NOT re-read context
you already have. Frontmatter and sgsd-recall results are your context.
</token_budget>

<cold_start>
On first entry (no checkpoint):

1. Read `.planning/STATE.md` — extract frontmatter ONLY (offset 0, limit 30)
2. Read `.planning/ROADMAP.md` — find current milestone + next incomplete phase
3. Read `.planning/config.json` — get model routing config
4. Determine position: which phase, which plan, what state

When capturing gsd-tools output into a variable, always apply the @file: IPC guard:
```bash
# @file: IPC guard: gsd-tools outputs @file:/path when JSON >50KB — read the file
INIT=$(node "$GSD_TOOLS" init execute-phase "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi

RESULT=$(node "$GSD_TOOLS" state advance-plan)
if [[ "$RESULT" == @file:* ]]; then RESULT=$(cat "${RESULT#@file:}"); fi

DIGEST=$(node "$GSD_TOOLS" commit "${MSG}" --files "${FILES}")
if [[ "$DIGEST" == @file:* ]]; then DIGEST=$(cat "${DIGEST#@file:}"); fi
```

On resume (checkpoint exists):

1. Read `.planning/ORCHESTRATOR-CHECKPOINT.md`
2. Extract: active_phase, last_completed, next_unit, phase_state
3. Skip cold start — enter loop at next_unit
</cold_start>

<loop>
## The Auto Loop

```
REPEAT:
  1. READ STATE
     - PULSE FIRST (SGSD-v2 Phase D / brief R-Q1 silent-stall observability):
       BEFORE any other action, append a single row to
       `.planning/metrics/orchestrator-pulse.jsonl`:
         `{"ts":"{ISO}","phase":N,"plan":P,"iteration":I,"step":"loop_entry"}`
       This fires EVERY loop iteration, even during deliberative pauses when
       no tool-level heartbeat fires. Closes the 6h silent-stall gap observed
       in Phase 147 overnight run. Cost: <10 tokens per iteration. Downstream
       consumers: SGSD1 mission-control tile "last pulse Ns ago"; sgsd-boot
       preflight freshness check; R-Q4 edge-guard (once decided).
     - Parse STATE.md frontmatter (milestone, phase, plan, status)
     - If all phases [x] → EXIT: "All phases complete"
     - If checkpoint exists and context >70% → EXIT: write checkpoint

  2. CLASSIFY (spawn Haiku classifier)
     FIRST: TaskCreate({
       content: "Classify phase {N} complexity",
       activeForm: "gsd-classifier [haiku] classifying P{N}",
       status: "in_progress"
     })
     THEN: Agent(subagent_type: "sgsd-classifier", model: "haiku", mode: "auto", prompt: {
       goal: "{phase goal from ROADMAP}",
       files: "{estimated files}",
       lines: "{estimated lines}",
       type: "{feature|bugfix|refactor}"
     })
     → Returns: { complexity, model, atc_tier, deliberate, reason }
     AFTER: TaskUpdate(same taskId, status: "completed")

  3. CHECK DELIBERATION GATE
     If classifier.deliberate == true AND NOT auto mode:
       → Suggest: "/gsd-deliberate" before planning
     If classifier.deliberate == true AND auto mode:
       → Skip deliberation, log warning, continue
     If classifier.atc_tier == "gate" AND NOT auto mode:
       → Flag for human review before proceeding
     If classifier.atc_tier == "gate" AND auto mode:
       → Log "GATE_AUTO_BYPASS", run FULL checks, continue

  4. SELECT CONTEXT (spawn Haiku context-selector)
     FIRST: TaskCreate({
       content: "Select context for phase {N}",
       activeForm: "sgsd-context-selector [haiku] picking queries for P{N}",
       status: "in_progress"
     })
     THEN: Agent(subagent_type: "sgsd-context-selector", model: "haiku", mode: "auto", prompt: {
       goal: "{task goal}",
       files: "{task files}",
       type: "{create|modify|test}",
       keywords: "{domain keywords}"
     })
     → Returns: { brv_queries, file_reads, error_rules, scripts_to_check }
     AFTER: TaskUpdate(same taskId, status: "completed")

  5. QUERY BYTEROVER
     For each brv_query: execute sgsd-recall → collect results (~200 tokens each)
     For each script_to_check: search for existing utility to reuse
     Total context injection target: <1000 tokens

  5.5. INTENT INJECTION (DLB-03 — structural enforcement)
     Read `.planning/milestones/{active_milestone}/INTENT.md` frontmatter only
     (offset 0, limit 30). Extract `outcome_delivered:` (≤120 chars) and
     `milestone:`.

     If the file is missing or `outcome_delivered` is absent:
       * Auto mode → log "INTENT_MISSING" in DEVIATIONS, continue without
         injection. Do NOT block — first phase of a milestone may legitimately
         precede the INTENT.md author step.
       * Interactive mode → pause with blocker: "Open milestone must have an
         INTENT.md. Use super-gsd/templates/milestone-intent.md as the template."

     On every subsequent executor/researcher/planner/verifier dispatch in this
     iteration, prepend the following block to the sub-agent prompt header:

         <intent milestone="{milestone}">
         {outcome_delivered}
         </intent>

     This is the Architect-R2 "structural injection" pattern. The LLM context
     window is the enforcement — no regex presence check, no NL scoring gate.
     Shallow outcome strings are caught by sgsd-intent-check.sh at milestone
     close (counts whether injected text is referenced in executor deviations
     / verifier reports; <50% coverage = author-discipline intervention).

     Log each injection to `.planning/metrics/intent-log.jsonl`:
       {"ts":"{ISO}","phase":N,"milestone":"v1.X","outcome":"...","agent":"gsd-executor"}

     This log seeds the kill-condition check. Token cost per injection:
     `outcome_delivered` ≤120 chars → ~30 tokens. For a 10-dispatch phase
     that's ~300 tokens total — cheap.

  6. DETERMINE DISPATCH
     Apply first-match rules:
     a. Phase needs CONTEXT.md (not discussed) → suggest /gsd-discuss-phase
     b. Phase needs RESEARCH.md → dispatch gsd-phase-researcher (Sonnet)
     c. Phase needs PLAN.md → dispatch gsd-planner (Sonnet)
     d. Phase has plans, needs plan-check → dispatch gsd-plan-checker (Sonnet)
     e. Phase has checked plans, pending tasks → dispatch gsd-executor (Sonnet)
     f. All plans executed → dispatch gsd-verifier (Sonnet)
     g. Verification passed → PHASE ATC GATE (Step 6.5) → FRONTEND VERIFY GATE (Step 6.6) → mark complete
     h. Verification failed → dispatch gsd-planner --gaps (Sonnet)

  6.5. PHASE ATC GATE (runs ONCE per phase, after verification passes)
     Triggers when rule 6.g fires (verification passed).
     This is a PHASE-LEVEL quality review — reviews the ENTIRE phase's work
     as a coherent unit, NOT individual commits.

     IF config.atc.enabled AND verification.status == "passed":

       a. Collect phase stats:
          - git diff --stat {first_commit_of_phase}..HEAD
          - Total files changed, lines added, lines removed
          - List of all plans completed (from phase directory)

       b. Classify phase tier via Haiku (sgsd-classifier):
          Agent(
            subagent_type: "sgsd-classifier",
            model: "haiku",
            mode: "auto",
            prompt: "Phase-level ATC classify: phase={N}, plans={count},
                     total_files={N}, total_lines={N}, goal='{phase goal}'.
                     Return tier: lite|full|gate"
          )
          Note: phase-level is always at least LITE — no skip tier.
          Complexity floor: phases with 5+ plans or 500+ lines → always FULL

       c. Run phase ATC review (spawn Sonnet reviewer):
          TaskCreate({
            content: "Phase {N} ATC review",
            activeForm: "gsd-code-reviewer [sonnet] P{N} — phase-level ATC {tier}",
            status: "in_progress"
          })

          Agent(
            subagent_type: "gsd-code-reviewer",
            model: "sonnet",
            mode: "auto",
            prompt: {
              phase: N,
              goal: "{phase goal from ROADMAP}",
              tier: "{lite|full|gate}",
              diff_summary: "{git diff --stat output}",
              plans_completed: [list],
              checks: "Run ATC 7-step + 10-point anti-slop checklist.
                       Focus on: cross-plan consistency, architectural
                       coherence, unused code across plans, duplication
                       between plans, test coverage, CLAUDE.md rule
                       violations. Max 300 word report.",
              report_format: "FINDINGS | CRITICAL | WARNINGS | PASS_RATE | ONE_LINER"
            }
          )
          → Returns: { findings, critical_count, warning_count, verdict }

       d. Process ATC result:
          - Write to .planning/phases/{NN}-*/{NN}-ATC-REVIEW.md
          - If critical_count > 0 AND NOT auto mode: STOP, emit blocker
          - If critical_count > 0 AND auto mode: log GATE_AUTO_BYPASS,
            append to DEVIATIONS, continue
          - If verdict == "pass": log, continue
          - If tier == "gate": suggest /sgsd-deliberate for next phase

       e. TaskUpdate(taskId, status: "completed")

       f. Proceed to Step 6.55 (MUDA waste audit) — do NOT mark phase complete yet.

     Token budget per phase ATC: ~600 tokens (50 classify + 550 review)
     Runs ONCE per phase, not per commit — keeps token cost bounded.

  6.55. MUDA WASTE AUDIT (runs ONCE per phase, after ATC passes) — per DLB-02
     Triggers when Step 6.5 completes AND the conditional gate fires:
       (files_changed >= 4 OR diff_lines >= 100)
       AND phase_type NOT IN (refactor, docs, config)

     If the gate doesn't fire (small phase, or refactor/docs/config), SKIP
     this step silently. DLB-02's Architect-held position: pay audit cost
     only when change magnitude justifies it.

     If the gate fires:

       a. Shell out to the probe + audit scripts (no sub-agent; cheap):

          bash super-gsd/scripts/sgsd-muda-audit.sh {PHASE} --project {PROJECT_DIR}

          This writes:
            * {PHASE_DIR}/WASTE.md — human-readable per-probe verdict table
            * .brv/context-tree/anti-patterns/waste-{class}-p{N}-{slug}.md for
              each WARN/FAIL finding (via sgsd-curate, INDEX.md updates
              atomically)
            * .planning/metrics/muda-log.jsonl — one line per audit run

       b. Parse the script's exit code:
            0 — all probes PASS, continue to Step 6.6 (browser verify)
            1 — WARN findings curated, continue (log MUDA_WARN in DEVIATIONS)
            2 — FAIL findings curated, continue but log MUDA_FAIL in DEVIATIONS.
                PHASE IS NOT BLOCKED by MUDA — per DLB-02 the audit is a
                detect-and-record mechanism, not a gate. Fail signal goes to
                sgsd-muda-recurrence at milestone close.

       c. NEVER block on MUDA failures. The point is data accumulation
          across milestones so sgsd-muda-recurrence can trigger the
          kill-condition (retire skill if 2 consecutive milestones show
          zero recurrence). Blocking on a single probe fail would create
          false-positive friction and erode trust.

       d. TaskUpdate the MUDA audit task (wrap the shell-out in a
          TaskCreate/TaskUpdate pair like any other unit).

     Token budget per MUDA audit: ~100 tokens total (orchestrator overhead;
     the actual probes run in shell at <1s and don't consume context).

  6.6. FRONTEND BROWSER VERIFICATION GATE (runs ONCE per phase, after ATC passes)
     Triggers when Step 6.5 completes AND the phase's diff touched any frontend
     files. This is functional UI verification via a real browser driving a
     live dev server — not code review, not type-checking, not curl-on-an-API.

     GROUND TRUTH IMPLEMENTATION: this gate does NOT rely on a sub-agent's
     prose report. It shells out to the mechanical verifier tool at
     `super-gsd/tools/phase-verifier/phase-verifier.mjs`. The tool performs
     Gate 1 (tool precondition), Gate 4 (backend liveness), per-route browser
     navigation with data-loaded attribute waiting, evidence capture (HAR,
     console, screenshot, api.json), and Gate 2 (independent evidence file
     verification). The orchestrator only processes the tool's exit code and
     report file. This is the anti-hallucination anchor for frontend work.

     Sub-agent (sgsd-browser skill) is still available for INTERACTIVE debug
     of a specific UI failure after this gate has blocked — but is NEVER used
     as the gate's verdict source. The gate trusts the tool, not prose.

     This gate exists because the following failure modes have been observed
     and the orchestrator must mechanically prevent them:
       F1. Silent tool fallback: gsd-browser unavailable → agent uses curl on
           the backend JSON and reports "audit passed". NEVER allowed.
       F2. Graceful 404 counted as pass: empty response body → empty-state DOM
           → reported "works". Banned. Empty states require an explicit
           data-empty-reason contract, else the route FAILS.
       F3. Spinner-frozen screenshots: agent takes screenshot before data
           loads, reports "page renders cleanly". Banned. Evidence must wait
           on a data-loaded attribute from the page itself.
       F4. Prose-only reports: "tsc clean, audit green" without files on disk.
           Banned. Every verdict must cite committed artifacts the orchestrator
           can independently stat.

     IF config.browser_verify.enabled AND phase touched frontend files:

       a. Detect frontend changes:
          Run: git diff --name-only {first_commit_of_phase}..HEAD
          Match each path against config.browser_verify.frontend_globs.
          If ZERO matches → SKIP this gate (log "BROWSER_VERIFY_SKIP: no frontend
          files touched"), proceed to mark phase complete.
          If ANY match → continue.

       b. GATE 1 — Tool precondition (HARD BLOCKER on failure).
          Run: gsd-browser --help >/dev/null 2>&1 && echo OK || echo MISSING
          If MISSING:
            - Check for .planning/phases/{NN}-*/TOOL-FALLBACK.md declaring an
              approved substitute (e.g. puppeteer). If present: read the
              declared substitute name, verify it is listed in
              config.browser_verify.approved_fallbacks, and use that instead.
            - If no declaration file OR declared tool not in approved list:
              EMIT BLOCKER: "Frontend verify tool missing — gsd-browser not
              available and no TOOL-FALLBACK.md declared. Phase HALTED."
              DO NOT fall back to curl. DO NOT fall back to manual inspection.
              DO NOT skip. HALT.

       c. GATE 4 — Backend liveness precheck (HARD BLOCKER on failure).
          Determine the backend endpoints that each audited route depends on.
          Sources (in priority order):
            1. config.browser_verify.required_endpoints (static list)
            2. .planning/phases/{NN}-*/BACKEND-ENDPOINTS.md if present
            3. Auto-detect by grepping touched files for fetch()/axios/useXxx
               query call sites.
          For each endpoint, run: curl -sf -o /dev/null -w '%{http_code}'
          --max-time 5 {base_url}{endpoint}
          If ANY endpoint returns 4xx or 5xx or connection-refused:
            Write .planning/phases/{NN}-*/BACKEND-NOT-READY.md listing each
            failing endpoint + status code + timestamp.
            EMIT BLOCKER: "Backend not ready — {N} endpoints failing. See
            BACKEND-NOT-READY.md." HALT.
          Also check dev server base_url itself returns 200. If not → BLOCKER.

       d. Shell out to phase-verifier tool (ground truth — NOT a sub-agent).
          TaskCreate({
            content: "Phase {N} browser verify",
            activeForm: "phase-verifier P{N} — verifying {len(routes)} routes",
            status: "in_progress"
          })

          Run: node {GSDEDITS}/super-gsd/tools/phase-verifier/phase-verifier.mjs \
                    --project-dir {PROJECT_DIR} \
                    --phase {NN}

          The tool performs inside its own process (out of your token budget):
            - Re-runs Gate 1 (tool precondition)
            - Re-runs Gate 4 (backend liveness + base_url)
            - Parses ROADMAP.md to trace each route to its phase success criterion
            - Navigates every route with gsd-browser --session sgsd-verify
            - Polls for [data-loaded="true"] OR [data-empty-reason="..."] with
              load_timeout_ms from config
            - Counts [data-row] elements then falls back to tbody tr
            - Captures screenshot, HAR, console errors, and backing api.json
            - Runs Gate 2 independently: stats each artifact, validates sizes,
              parses JSON, counts rows. No bypass.
            - Writes .planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md with the
              per-route table, evidence manifest, and ROADMAP criteria trace
            - On UNPROVEN in auto mode with block_on_failure_auto_mode=false,
              appends an entry to .planning/DEFERRAL-LEDGER.md

          Exit code interpretation:
            0 = PROVEN   — every route passed every check. Continue to h.
            1 = UNPROVEN — at least one route failed. Read BROWSER-REVIEW.md
                           for specifics. If interactive mode OR
                           block_on_failure_auto_mode == true → STOP with
                           blocker. Otherwise continue (deferral was logged
                           by the tool).
            2 = BLOCKED  — tool missing, backend unreachable, or config
                           invalid. ALWAYS STOP with blocker, even in auto
                           mode. Read BACKEND-NOT-READY.md (if present) or
                           stderr for the reason. Fix root cause before
                           rerunning. Never bypass a Gate 1 or Gate 4 failure.

       e. Process exit code + report:
          Read .planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md (just the header
          line, not the whole table — save tokens).
          - Exit 0 → log "BROWSER_VERIFY_PROVEN", continue.
          - Exit 1 → log "BROWSER_VERIFY_UNPROVEN", check mode:
              * Interactive OR block_on_failure_auto_mode → EMIT BLOCKER
                with path to BROWSER-REVIEW.md. HALT.
              * Auto mode AND not blocking → continue. Deferral already
                logged by the tool. Phase summary must flag it.
          - Exit 2 → EMIT BLOCKER. HALT. No bypass in any mode.

       h. TaskUpdate(taskId, status: "completed")

       i. Mark phase complete, advance to next phase.

     Token budget per phase browser verify: ~600 tokens (prompt + structured
     report per route). Runs ONCE per phase, not per plan.
     Non-frontend phases: zero cost (skipped at step 6.6.a).

     HARD RULES for this gate — no exceptions, no "just this once":
     R1. No curl-only audit may be reported as a browser verify pass.
     R2. No screenshot taken before data-loaded or data-empty-reason may be
         reported as proof.
     R3. No route may be marked PROVEN without a committed screenshot AND
         committed api.json AND committed har.
     R4. No empty-array response may be counted as real data. Either min_rows
         is met OR data-empty-reason is set, or the route FAILS.
     R5. Every PROVEN verdict cites a specific ROADMAP phase success criterion
         that the evidence satisfies. No citation = UNPROVEN.

  7. COMPOSE PROMPT
     Build sub-agent prompt from:
     - Task plan (compressed XML format)
     - ByteRover query results (relevant decisions, patterns, error rules)
     - Existing scripts to reuse (if found)
     - Efficiency rules header (80 tokens)
     - Surgical constraint header (see below, ~70 tokens) — MANDATORY for every executor dispatch
     - "Report format: FILES_CHANGED | VERIFICATION | DEVIATIONS | BLOCKERS | SCRIPTS_CREATED | ONE_LINER"
     DO NOT include: full ROADMAP, full STATE, full REQUIREMENTS

     SURGICAL CONSTRAINT (Karpathy principle) — inject verbatim into every
     gsd-executor prompt:

       ```
       SURGICAL CONSTRAINT — every changed line must trace to a specific task
       in this wave's plan. Orphan edits (unrelated refactors, comment tweaks,
       formatting passes, "while I'm here" fixes) are DEVIATIONS. Report them
       in the DEVIATIONS section; do NOT commit them silently. Match the
       existing code style even if you'd write it differently. If you notice
       pre-existing dead code, mention it in DEVIATIONS — do NOT delete it.
       Remove ONLY imports/variables/functions that YOUR changes made unused.
       ```

     Token cost: ~70 tokens per dispatch. Catches drift at the earliest
     possible point (per-task commit) instead of accumulating until the
     phase-end ATC review catches it as rework.

  8. DISPATCH SUB-AGENT
     FIRST: TaskCreate({
       content: "Phase {N}: {agent_type_short} — {one-line goal}",
       activeForm: "{agent_type} [{model}] P{N}.{plan} — {what it's doing}",
       status: "in_progress"
     })
     Example activeForm values:
       "gsd-executor [sonnet] P87.1 — building auth middleware"
       "gsd-planner [sonnet] P87 — creating task breakdown"
       "gsd-verifier [sonnet] P87 — checking goal achievement"
       "gsd-phase-researcher [sonnet] P87 — investigating stack"

     THEN: Agent(
       subagent_type: "{agent_type}",
       model: "{from classifier or routing table}",
       mode: "auto",
       prompt: "{composed prompt}"
     )
     → Wait for structured report (<300 words)
     CRITICAL: Always pass mode: "auto" — sub-agents must NEVER ask
     the user for permission. They execute autonomously and report back.

     AFTER: TaskUpdate(same taskId, status: "completed")
     If blocker: TaskUpdate(status: "completed", content: "BLOCKED: {reason}")

     RULE: Every Agent() call MUST be preceded by TaskCreate and followed
     by TaskUpdate. This makes the task list at the top of Claude Code
     show agent-level activity in real time — user sees exactly which
     agent is running, on what model, for what task.

  9. PROCESS RESULT
     Parse report sections:
     - FILES_CHANGED → log for commit
     - VERIFICATION → check all passed
     - DEVIATIONS → log for phase summary
     - BLOCKERS → if any, EXIT with blocker
     - SCRIPTS_CREATED → curate into ByteRover script registry
     - ONE_LINER → use in commit message

     PROCESS RESULT — parse all 6 sections:
       FILES_CHANGED  → stage these exact paths for git (never git add -A)
       VERIFICATION   → if any item shows ✗: log warning, continue (don't EXIT)
       DEVIATIONS     → collect; "new pattern:" prefix triggers sgsd-curate
       BLOCKERS       → if non-empty and not "none": EXIT with blocker text
       SCRIPTS_CREATED→ each "path | purpose | interface" line → sgsd-curate scripts/
       ONE_LINER      → use verbatim in git commit message

     If report is missing any section: log "MISSING: {section}", treat as empty.
     If report exceeds 300 words: log "REPORT_OVERLIMIT", process anyway.

  9.5. PER-DISPATCH ATC (closes the mid-phase ATC gap)
      Runs AFTER the executor report lands, BEFORE state update + commit.
      Fires only when ALL of these are true:
        * classifier.atc_tier (from Step 2) is in {full, gate}
        * FILES_CHANGED is non-empty
        * At least one file in FILES_CHANGED is CODE (not *.md, not .planning/,
          not docs/). Docs-only dispatches skip ATC.
        * config.atc.enabled == true

      If tier == full:
        Agent(subagent_type: "gsd-code-reviewer", model: "sonnet", mode: "auto",
          prompt: {
            scope: "single-dispatch",
            phase: N, plan: P,
            files: {files_from_report},
            tier: "full",
            checks: "Run ATC 7-step + 10-point anti-slop on the diff of this
                     single dispatch's FILES_CHANGED. Focus: orphan functions,
                     dead imports, unused args, YAGNI violations, ΔComplexity,
                     'just in case' additions. Skip cross-plan architectural
                     review — that's the phase-level ATC gate at Step 6.5.
                     Max 250 word report."
          })
        → Returns: { findings, critical_count, warning_count, verdict }

      If tier == gate:
        In auto mode: run the FULL review above AND log GATE_AUTO_BYPASS;
                      append "[GATE bypassed in auto mode]" to DEVIATIONS.
        In interactive mode: STOP with blocker; user reviews + approves
                             before the commit lands.

      Skip entirely if tier ∈ {skip, lite} — LITE is already covered by the
      anti-slop self-check every executor should apply to its own diff, and
      SKIP by definition warrants no review.

      Write verdict as a one-line JSONL append to
        `.planning/phases/{NN}/commit-reviews.jsonl`:
        {"ts":"{ISO}","plan":"{NN-PP}","tier":"full|gate","verdict":"pass|warn|fail","critical":N,"warning":N,"one_liner":"..."}

      If critical > 0 AND interactive: STOP with blocker quoting the findings.
      If critical > 0 AND auto: log GATE_AUTO_BYPASS, append to DEVIATIONS,
      continue — per Golden Rule 13, auto mode never blocks on quality gates,
      only logs and moves on. The phase-level ATC at Step 6.5 catches what
      auto-bypass let through.

      Token budget per dispatch: ~300 tokens (250 review + 50 JSONL append).
      On a 10-dispatch phase with 3 FULL-tier dispatches → +900 tokens total.
      SKIP/LITE dispatches pay zero.

  10. CURATE LEARNINGS
      If DEVIATIONS contains new patterns → sgsd-curate to patterns/
      If SCRIPTS_CREATED non-empty → sgsd-curate to scripts/{category}
      If new error discovered → sgsd-curate to error-rules/

  11. UPDATE STATE
      - Update STATE.md (advance plan counter, update progress)
      - Mark ROADMAP.md phase progress
      - Log token usage to .planning/metrics/token-log.jsonl

  12. GIT COMMIT
      Atomic commit per unit:
      git add {files from report}
      git commit -m "feat({phase}-{plan}): {ONE_LINER}"
      NEVER batch. NEVER skip. NEVER amend.

  13. LOOP
      Read STATE.md again → this is a tool call → loop continues
      DO NOT send text-only response. Pair status update with next Read.
```
</loop>

<checkpoint_protocol>
When context usage >70% OR user says stop:

Write `.planning/ORCHESTRATOR-CHECKPOINT.md`:

```yaml
---
created_at: "{ISO timestamp}"
active_milestone: "{version}"
active_phase: {NN}
last_completed: "plan {NN-PP}"
next_unit: "plan {NN-PP+1}"
phase_state: "{researching|planning|executing|verifying}"
units_this_session: {N}
estimated_tokens_used: {N}
---

## Completed This Session
- plan {NN-PP}: {ONE_LINER from report}
- plan {NN-PP}: {ONE_LINER from report}

## Next Action
{What the next agent should do}

## Remaining Work
- {remaining plans in current phase}
- {remaining phases in milestone}
```

Then commit the checkpoint and STOP.
</checkpoint_protocol>

<commit_discipline>
ATOMIC: one commit per unit, per report, per plan.
  git add {specific files from FILES_CHANGED — never git add -A or git add .}
  git add .planning/STATE.md .planning/ROADMAP.md
  git commit -m "feat({phase}-{plan}): {ONE_LINER}"

NEVER:
  - Batch two units into one commit
  - Skip a commit because "nothing changed" (if agent ran, something changed)
  - Amend a prior commit
  - Use git add . or git add -A

If git commit fails: check git status, resolve conflict, retry ONCE. If still fails: EXIT with blocker.
</commit_discipline>

<token_logging>
After each unit, append to `.planning/metrics/token-log.jsonl`:

```json
{"ts":"{ISO}","phase":{N},"plan":{N},"model":"{model}","role":"{agent_type}","est_input":{N},"est_output":{N},"total":{N},"classifier_model":"haiku","context_tokens":{N}}
```

Estimation method:
- Input: count words in composed prompt * 1.3
- Output: count words in agent report * 1.3
- Context: sum of sgsd-recall result tokens + file read tokens
</token_logging>

<golden_rules>
1. ALWAYS chain tool calls. Text-only = loop dies.
   VALID text-only exits (ONLY these 4):
   a. All phases complete: "All phases done."
   b. Context >70%: write checkpoint FIRST, then stop
   c. Blocker requiring human: explain blocker, stop
   d. User says stop/pause: write checkpoint, stop
   NOTHING ELSE is a valid text-only response.
2. NEVER do heavy work yourself. Dispatch to sub-agents.
3. NEVER load full files. Frontmatter + sgsd-recall only.
4. COMMIT after every unit. Uncommitted work is lost work.
5. CURATE after every unit. Unrecorded learnings are wasted tokens.
6. LOG tokens after every unit. Untracked spend is invisible spend.
7. Use the RIGHT model. Haiku for classification, Sonnet for execution, Opus for you.
8. Sub-agent reports: 300 words MAX. If longer, the agent wasted tokens.
9. Script reuse: ALWAYS check ByteRover before creating new utilities.
10. EXIT only for the 4 valid conditions. Never stop prematurely.
11. CONTEXT ACCUMULATOR: After 5 reports in active context, compress older reports to ONE_LINERs.
    Never hold full report text for more than 2 completed iterations.
12. REPORT VALIDATION: Always check word count and section presence before parsing.
    Log REPORT_OVERLIMIT and MISSING_SECTION — do not exit on format violation.
13. PHASE ATC GATE: After verification passes, BEFORE marking phase complete —
    run full phase-level ATC review via Step 6.5. This reviews the ENTIRE phase's
    work (all plans, all commits) as a coherent unit, NOT individual commits.
    Classify with Haiku, review with Sonnet (gsd-code-reviewer).
    Writes .planning/phases/{NN}-*/{NN}-ATC-REVIEW.md
    Critical findings + auto mode: log GATE_AUTO_BYPASS, add to DEVIATIONS, continue.
    Critical findings + interactive: STOP with blocker.
    Token budget: ~600 tokens per phase (NOT per commit).
    Complexity floor: 5+ plans OR 500+ lines → always FULL tier.
15. FRONTEND BROWSER VERIFY GATE: After Step 6.5 (ATC), BEFORE marking phase
    complete — IF the phase diff touched any frontend file matching
    config.browser_verify.frontend_globs, run Step 6.6 which dispatches
    sgsd-browser (Sonnet) to verify every route in config.browser_verify.routes
    against the live dev server. Catches broken pages, console errors, network
    failures, and a11y regressions that unit tests and ATC miss.
    Writes .planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md with screenshots.
    Skips automatically for non-frontend phases (zero token cost).
    Dev server unreachable: WARN in interactive, BLOCKER in auto (unless
    block_on_failure_auto_mode is false).
    Token budget: ~400 tokens per phase (only when frontend files changed).
    Code can compile and tests can pass while the UI is completely broken.
    This gate is the only protection against that.
14. TASK VISIBILITY: Every Agent() spawn MUST be wrapped in TaskCreate/TaskUpdate.
    Before spawn: TaskCreate({ content, activeForm: "{agent} [{model}] P{N} — {action}", status: "in_progress" })
    After return: TaskUpdate(taskId, status: "completed")
    On blocker: TaskUpdate(status: "completed", content: "BLOCKED: {reason}")
    This makes the task list at the top of Claude Code show real-time agent-level
    activity. User sees which agent, what model, what action, at a glance.
    NEVER dispatch an Agent without a paired TaskCreate. This is non-negotiable.
15. KARPATHY PRINCIPLES: Four behavioural rules that override everything else
    when they conflict. Enforced mechanically by existing SGSD gates:
      (1) Think Before Coding — surface assumptions, ask when uncertain.
          Enforced by: gsd-list-phase-assumptions + gsd-discuss-phase before planning.
      (2) Simplicity First — minimum code that solves the problem.
          Enforced by: ATC 10-point anti-slop checklist at Step 6.5.
      (3) Surgical Changes — touch only what you must; every line traces to the plan.
          Enforced by: Surgical Constraint header injected into every executor prompt
          at Step 7 (see above).
      (4) Goal-Driven Execution — tests-first, verifiable success criteria.
          Enforced by: Nyquist validation gate (config.workflow.nyquist_validation).
    These are not additive rules — they are the philosophical spec that the
    existing gates implement. If a gate ever fires a FAIL on a Karpathy
    principle, DO NOT bypass it in auto mode — the principle is what the
    whole framework exists to enforce.
</golden_rules>
