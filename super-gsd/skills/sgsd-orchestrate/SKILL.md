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

<!-- ANCHOR: BOOT-HASH-DRIFT — 11-04 inserts drift check here. Plan 11-05 adds sections AFTER this anchor. -->
3.5. BOOT-TIME SCHEMA DRIFT CHECK (D-12, D-14 — non-blocking)
     Immediately after loading config.json, verify plan-schema-v2.json has not drifted
     from the pinned hash. Uses Node built-in crypto — no new dependency (RQ-6).

     ```bash
     node -e "
     const crypto = require('crypto');
     const fs = require('fs');
     const path = require('path');
     const projectDir = process.cwd();

     const schemaPath = path.join(projectDir, 'super-gsd/templates/plan-schema-v2.json');
     const configPath = path.join(projectDir, '.planning/config.json');
     const logPath    = path.join(projectDir, '.planning/metrics/readiness-log.jsonl');

     const config   = JSON.parse(fs.readFileSync(configPath, 'utf8'));
     const expected = config.workflow && config.workflow.schema_v2_hash;

     if (!expected) {
       console.warn('[SGSD] workflow.schema_v2_hash not set in config.json — drift detection disabled');
     } else {
       const actual = crypto.createHash('sha256')
         .update(fs.readFileSync(schemaPath))
         .digest('hex');
       if (actual !== expected) {
         console.warn('[SGSD] schema_pin_drift detected — schema file differs from pinned hash');
         console.warn('  expected: ' + expected.slice(0,16) + '...');
         console.warn('  actual:   ' + actual.slice(0,16) + '...');
         fs.appendFileSync(logPath,
           JSON.stringify({
             ts:            new Date().toISOString(),
             type:          'schema_pin_drift',
             expected_hash: expected,
             actual_hash:   actual
           }) + '\n'
         );
         // D-14: NON-BLOCKING — loop continues after warning
       }
       // On match: no output; loop continues normally
     }
     "
     ```

     Outcome paths:
     - Match: silent, continue cold-start normally.
     - Mismatch: console warn (two lines) + readiness-log.jsonl append + continue (D-14).
     - Hash absent: console warn once + continue (graceful no-op on first run before 11-04).
     - readiness-log.jsonl write failure: console warn already emitted; T-11-11 accepted risk.

3.6. LOAD GATES REGISTRY (Phase 10 D-13b — one-time cold-start load)
     Immediately after step 3.5, load the gates registry ONCE and cache it in memory.
     Subsequent `gates.shouldFire` calls are O(1) lookups — no re-parsing per step.

     ```javascript
     const gates = require('super-gsd/scripts/lib/gates-registry.cjs');
     const GATES_YAML_PATH = 'super-gsd/registry/gates.yaml';
     gates.loadGates(GATES_YAML_PATH); // caches; subsequent calls are O(1)
     ```

     Non-blocking: if gates-registry.cjs is missing (pre-Phase-10 environment),
     log a single warn and continue. All `gates.shouldFire` calls below degrade
     gracefully to `true` (gate fires unconditionally) so existing behaviour is
     preserved while the registry is absent.

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

  2. CLASSIFY
     // Gate check (Phase 10 D-01): fires unless registry disables this gate
     if (gates.shouldFire('classifier-haiku', ctx, GATES_YAML_PATH)) {
     // SCHEMA-04: v2 plans skip Haiku classifier spawn — derive classifier result from frontmatter
     // Frontmatter is already parsed at this point (schema_version read for D-12 drift check at Step 3.5)

     IF plan frontmatter has schema_version == 2:
       // Synthesize classifier result from v2 frontmatter fields (no Agent spawn)
       model         ← frontmatter.model  // required SCHEMA-02 field; always present on v2 plans
       atc_tier      ← (frontmatter.expected_ATC_tier || 'LITE').toLowerCase()
       files_count   ← count of all files_touched values across all tasks in frontmatter.tasks
       complexity    ← files_count <= 3 ? 'light' : files_count <= 6 ? 'standard' : 'heavy'
       deliberate    ← (frontmatter.depends_on?.length > 2 || files_count > 5)
       classifier_result = {
         complexity,
         model,
         atc_tier,
         deliberate,
         reason: "v2 plan — classifier skip (SCHEMA-04)"
       }
       // USE classifier_result as if returned by sgsd-classifier — downstream Steps 3+ unchanged
       // Log skip event (traceability per T-11-14)
       Append to .planning/metrics/token-log.jsonl:
         {"ts":"{ISO}","phase":N,"plan":P,"event":"classifier_skip","reason":"schema_version==2","synthetic_result":{classifier_result}}

     ELSE (schema_version absent or schema_version == 1 — v1 path with MACH-01 cache):
       // MACH-01: attempt cache read before spawning Haiku classifier
       // classifierCache = require('super-gsd/scripts/lib/classifier-cache.cjs')
       const cached = classifierCache.readCache(planFilePath);
       if (cached) {
         // Cache hit — skip classifier dispatch entirely (D-03 + D-04)
         classifier_result = cached;
         // Log cache-hit event for D-04 accounting
         Append to .planning/metrics/token-log.jsonl:
           {"ts":"{ISO}","phase":N,"plan":P,"event":"classifier_skip","role":"classifier-skip","reason":"sidecar_hit","verdict":{cached}}
       } else {
         // Cache miss — spawn Haiku classifier as before, then write sidecar
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
         // Write verdict to sidecar so subsequent tasks in this plan hit cache
         classifierCache.writeCache(planFilePath, classifier_result);
       }
     } // end gates.shouldFire('classifier-haiku')

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
     // Gate check (Phase 10 D-02): context-selector-haiku gate fires unless disabled
     if (gates.shouldFire('context-selector-haiku', ctx, GATES_YAML_PATH)) {
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
     } // end gates.shouldFire('context-selector-haiku')

  5. QUERY BYTEROVER
     // Gate check (Phase 10 D-03): sgsd-recall-queries fires unless classifier.complexity == trivial
     if (gates.shouldFire('sgsd-recall-queries', ctx, GATES_YAML_PATH)) {
     For each brv_query: execute sgsd-recall → collect results (~200 tokens each)
     For each script_to_check: search for existing utility to reuse
     Total context injection target: <1000 tokens
     } // end gates.shouldFire('sgsd-recall-queries')

  5.5. INTENT INJECTION (DLB-03 — structural enforcement)
     // Gate check (Phase 10 D-04): intent-injection gate fires unless disabled
     if (gates.shouldFire('intent-injection', ctx, GATES_YAML_PATH)) {
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
     } // end gates.shouldFire('intent-injection')

  6. DETERMINE DISPATCH
     Apply first-match rules:
     a. Phase needs CONTEXT.md (not discussed) → suggest /gsd-discuss-phase
     b. Phase needs RESEARCH.md → dispatch gsd-phase-researcher (Sonnet)
     c. Phase needs PLAN.md → dispatch gsd-planner (Sonnet)
     d. Phase has plans, needs plan-check → dispatch gsd-plan-checker (Sonnet)
     e. Phase has checked plans, pending tasks → run PLAN LOAD-TIME VALIDATION (Step 6.2) then dispatch per MACH-02 wave plan:

        // Require dispatch-planner at orchestrator startup (zero runtime deps)
        const dispatchPlanner = require('super-gsd/scripts/lib/dispatch-planner.cjs');

        const waves = dispatchPlanner.buildDispatchPlan(plan);
        for (const w of waves) {
          if (w.serial || w.taskIds.length === 1) {
            // Serial wave: dispatch gsd-executor (Sonnet) for each task sequentially
            for (const taskId of w.taskIds) {
              // [existing single gsd-executor dispatch pattern — Step 8]
            }
          } else {
            // Parallel wave (MACH-02, D-06, PARALLEL_CONFIRMED per 12-02-00 spike):
            // fan out Agent() calls with run_in_background: true, then await all reports.
            const handles = w.taskIds.map(taskId =>
              Agent(subagent_type: "gsd-executor", model: "sonnet", mode: "auto",
                    run_in_background: true, prompt: {... taskId ...})
            );
            const reports = await Promise.all(handles);

            // D-08 (no cancellation): if any report has BLOCKER, halt AFTER all parallel
            // tasks in this wave have settled. Do NOT cancel in-flight agents — the Task()
            // harness provides no cancellation protocol. Process remaining reports for
            // commits/deviations, then exit loop with the BLOCKER.

            // §Risk 3 (sequential ATC post-wave): each parallel executor's report gets its
            // own per-dispatch ATC review (Step 9.5) run SEQUENTIALLY after the wave settles.
            // ATC is per-report, not per-batch — process reports one at a time after await.
            for (const report of reports) {
              // [Step 9 — process report, commit, run Step 9.5 ATC for this report]
            }
          }
        }

        NOTE — spike verdict: 12-02-00 observed PARALLEL_CONFIRMED. The parallel branch is a
        live execution path. Disjoint-files waves will genuinely fan out concurrently.
        If runtime evidence ever contradicts this, fall back: set w.serial = true for all waves
        in dispatch-planner.cjs and re-run — the DAG ordering remains advisory and prevents
        file-conflict bugs even under serial execution.
     f. All plans executed → dispatch gsd-verifier (Sonnet)
     g. Verification passed → PHASE ATC GATE (Step 6.5) → FRONTEND VERIFY GATE (Step 6.6) → mark complete
     h. Verification failed → dispatch gsd-planner --gaps (Sonnet)

  <!-- ANCHOR: RULE-8.5 — schema-fix dispatch branch -->
  6.2. PLAN LOAD-TIME VALIDATION (Rule 8.5 — schema-fix dispatch)
     Triggers at dispatch rule 6.e, BEFORE spawning gsd-executor. Re-validates each
     pending PLAN.md against plan-schema-v2.json at load time (D-07 load-time enforcement).

     FOR EACH pending {NN}-{PP}-PLAN.md to be dispatched this iteration:

     a. Run validate.cjs:
        ```bash
        node super-gsd/tools/plan-schema/validate.cjs \
          --plan-file {plan_file_path} \
          --project-dir {project_dir} \
          --mode load
        ```
        Exit 0 → VALID: proceed to gsd-executor dispatch normally.
        Exit 2 → BLOCKED (file not found, parse error): EMIT BLOCKER. HALT. Cannot repair a missing file.
        Exit 1 → INVALID (schema errors): enter SCHEMA-FIX RETRY LOOP below.

     b. SCHEMA-FIX RETRY LOOP (on exit 1 only):

        ```
        schema_fix_attempt = 0
        WHILE schema_fix_attempt < 3:
          schema_fix_attempt += 1

          // Extract locked fields from original plan BEFORE dispatching planner
          // (orchestrator extracts — not the planner — to prevent planner corruption per D-09)
          Read {plan_file_path} frontmatter tasks[] array
          locked_fields = {
            id:           tasks[*].id    (verbatim from original),
            hypothesis:   tasks[*].hypothesis  (verbatim from original),
            files_touched: tasks[*].files_touched (verbatim from original)
          }

          // Read most recent plan-errors.jsonl row for this plan
          // Filter by plan_file field matching basename of {plan_file_path}
          error_envelope = last matching row from .planning/metrics/plan-errors.jsonl

          // Dispatch fix-planner with all inputs inline (RQ-5 OQ3 — inline, not path)
          TaskCreate({ content: "Schema repair attempt {schema_fix_attempt}/3 for {plan_file_path}",
                       activeForm: "gsd-planner [sonnet] --fix-schema attempt {schema_fix_attempt}/3",
                       status: "in_progress" })
          Agent(
            subagent_type: "gsd-planner",
            model: "sonnet",
            mode: "auto",
            prompt: {
              flag: "--fix-schema",
              plan_file_path: {plan_file_path},
              error_envelope: {error_envelope},  // inline JSON, not a path
              schema_path: "super-gsd/templates/plan-schema-v2.json",
              locked_fields: {locked_fields},
              attempt_K: {schema_fix_attempt}
            }
          )
          // Planner writes: {plan_file_path}.fix-attempt-{schema_fix_attempt}.md
          TaskUpdate(taskId, status: "completed")

          sibling = "{plan_file_path}.fix-attempt-{schema_fix_attempt}.md"

          // Commit the attempt (D-10 audit trail)
          git add {sibling}
          git commit -m "fix({phase}-{plan}): repair schema violation attempt {schema_fix_attempt}/3"

          // Re-validate the sibling
          node super-gsd/tools/plan-schema/validate.cjs \
            --plan-file {sibling} \
            --project-dir {project_dir} \
            --mode load

          IF exit 0:  // sibling passes — promote to overwrite original
            cp {sibling} {plan_file_path}
            rm {sibling}
            git add {plan_file_path}
            git rm --cached {sibling} 2>/dev/null || true  // remove sibling from index if staged
            git commit -m "fix({phase}-{plan}): promote schema repair attempt {schema_fix_attempt}/3"
            BREAK  // proceed with executor dispatch on the repaired plan

          // else: loop continues; sibling retained for checkpoint body

        IF schema_fix_attempt == 3 AND last validate.cjs exit != 0:
          // D-10 cap hit — collect all 3 envelopes and attempt file contents
          Read all 3 plan-errors.jsonl rows for this plan (by plan_file field)
          Read .fix-attempt-1.md, .fix-attempt-2.md, .fix-attempt-3.md contents

          Write .planning/ORCHESTRATOR-CHECKPOINT.md:
            next_unit: "BLOCKED — manual schema repair required for {plan_file_path}"
            error_envelopes: [envelope_1, envelope_2, envelope_3]  // all 3 JSONL rows
            fix_attempts: [attempt_1_content, attempt_2_content, attempt_3_content]
            plan_path: {plan_file_path}
            operator_action: >
              Inspect plan-schema-v2.json for schema correctness OR
              inspect {plan_file_path} for semantic errors that prevent
              automatic repair. All 3 auto-repair attempts failed.
              Fix manually, delete .fix-attempt-*.md siblings, then re-run.

          git add .planning/ORCHESTRATOR-CHECKPOINT.md
          git commit -m "chore(checkpoint): schema repair cap hit for {phase}-{plan}"
          EXIT LOOP (Exit #3 Blocker)
        ```

  6.5. PHASE ATC GATE (runs ONCE per phase, after verification passes)
     Triggers when rule 6.g fires (verification passed).
     This is a PHASE-LEVEL quality review — reviews the ENTIRE phase's work
     as a coherent unit, NOT individual commits.

     // Gate check (Phase 10 D-06): R5 compose — BOTH kill-switches must agree
     // config.atc.enabled is preserved as an outer runtime knob (D-13a)
     IF config.atc.enabled AND gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH) AND verification.status == "passed":

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

       c. Run phase ATC review (Phase 15 CODEX-07: provider-dispatch indirection):
          // VTP: AGP-P-05 (protocol-level resource registration for discovery),
          //      HiveMind doc:5a50cc9b459e (single-retry, no thundering herd).
          TaskCreate({
            content: "Phase {N} ATC review",
            activeForm: "provider-dispatch [phase-level-ATC] P{N} — {tier}",
            status: "in_progress"
          })

          const provider = gates.resolveReviewerProvider('phase-level-ATC', gatesRegistry, { gatesYamlPath: GATES_YAML_PATH });
          const effective = (provider && provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
            ? gates.getProvider(provider.fallback_to)
            : provider;

          let report;
          if (!effective) {
            // No reviewer_provider declared on gate — skip dispatch, log info
            logInfo('GATE_NO_PROVIDER: phase-level-ATC has no reviewer_provider; skipping review dispatch');
          } else if (effective.invocation === 'agent') {
            report = await Agent({
              subagent_type: effective.agent_subagent_type,
              model: effective.agent_model || 'sonnet',
              mode: 'auto',
              prompt: composedPrompt   // composedPrompt contains phase/goal/tier/diff_summary/plans/checks/report_format
            });
          } else if (effective.invocation === 'shell') {
            // Shell dispatch: codex-exec.sh
            const promptFile = writeTempPrompt(composedPrompt);
            const reportOut = tempReportPath('phase-atc');
            const dispatchResult = shellDispatch(effective.shell_script, {
              promptFile,
              timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
              reportOut,
              phase: currentPhase,
              step: '6.5'
            });
            if (dispatchResult.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
              // Single-retry fallback to Claude per HiveMind centralized-retry pattern (doc:5a50cc9b459e)
              logDeviation(`GATE_PROVIDER_FALLBACK: ${effective.name} exit=${dispatchResult.exit} → ${effective.fallback_to}`);
              const fallbackProvider = gates.getProvider(effective.fallback_to);
              report = await Agent({
                subagent_type: fallbackProvider.agent_subagent_type,
                model: fallbackProvider.agent_model || 'sonnet',
                mode: 'auto',
                prompt: composedPrompt
              });
              // Tag the report row as claude-via-fallback for CODEX-10 metric accuracy
              report._provider = 'claude-via-fallback';
            } else if (dispatchResult.exit !== 0) {
              // Both providers failed — hard blocker per CONTEXT D-02c
              logDeviation('GATE_PROVIDER_DOUBLE_FAIL: both codex-cli-reviewer and fallback failed');
              writeCheckpoint({ reason: 'GATE_PROVIDER_DOUBLE_FAIL', step: '6.5' });
              throw new Error('GATE_PROVIDER_DOUBLE_FAIL: review gate failed on both providers');
            } else {
              report = { content: dispatchResult.report, _provider: 'openai-codex' };
            }
          }
          // Evidence emission: path-identical to prior Claude path per CONTEXT D-03
          // commit-reviews.jsonl gains provider: field; ATC-REVIEW.md gains provider: frontmatter key
          if (report) appendReviewEvidence(report, {
            gate: 'phase-level-ATC',
            provider: report._provider || effective.name,
            fallback_triggered: !!(report._provider === 'claude-via-fallback')
          });
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
     Triggers when Step 6.5 completes AND the conditional gate fires.
     The gate's trigger declares the equivalent policy — see super-gsd/registry/gates.yaml:
       (files_changed >= 4 OR diff_lines >= 100) AND phase_type NOT IN (refactor, docs, config)

     // Gate check (Phase 10 D-07): MUDA-waste-audit with compound OR trigger
     if (gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH)) {

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
     } // end gates.shouldFire('MUDA-waste-audit')

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

  6.7. MILESTONE COMPLETE AUTO-TRIGGER (GOV-13 / D-18a)

       After Step 6.6.i marks a phase complete:

         a. Read `.planning/ROADMAP.md` in full. Milestone close is rare.
         b. Extract the active milestone from `.planning/STATE.md`.
         c. Check: do all milestone phases show [x] in ROADMAP.md?
            NO  -> Continue loop.
            YES -> Auto-dispatch with no operator prompt:

              TaskCreate({
                content: "Close milestone {version}",
                activeForm: "sgsd-complete-milestone - auto-trigger",
                status: "in_progress"
              })

              Agent(
                subagent_type: "sgsd-complete-milestone",
                mode: "bypassPermissions",
                prompt: { milestone: "{version from STATE.md}", auto_trigger: true }
              )

              The skill is idempotent. If the milestone is already archived, it returns PASS.
              On BLOCKER, halt the loop. On success, continue with the closed-milestone state.

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

  9.2. BUILD DISPATCH CONTEXT (Phase 10 §Q2 — assemble ctx for gate lookups)
     Assembled AFTER processing the result report, BEFORE any gate check.
     The ctx object is ephemeral per-iteration — not persisted.

     ```javascript
     const ctx = {
       classifier: {
         complexity: classifier_result.complexity,   // 'trivial'|'light'|'standard'|'heavy'
         atc_tier:   classifier_result.atc_tier,     // 'skip'|'lite'|'full'|'gate'
         type:       classifier_result.type,         // 'feature'|'bugfix'|'refactor'|...
       },
       files_changed_count:      filesChanged.length,
       code_files_changed_count: filesChanged.filter(f => {
         if (f.startsWith('.planning/')) return false;
         if (/^super-gsd\/skills\/[^/]+\/SKILL\.md$/.test(f)) return true;
         if (f.endsWith('.md')) return false;
         return true;
       }).length,
       diff_lines:               parseDiffLines(),   // from git diff --stat HEAD~1..HEAD
       phase_type:               phaseType,          // read once from ROADMAP/phase metadata
       new_pattern_detected:     deviations.some(d => d.startsWith('new pattern:')),
       script_created:           scriptsCreated.length > 0,
       error_discovered:         deviations.some(d => /new error|error rule/i.test(d)),
       phase_has_verify_mjs:     fs.existsSync(`.planning/phases/${phaseDir}/verify.mjs`),
       mechanical_muda_verdict:  getMudaVerdictFromPhaseDir(currentPhaseDir),
       // Populated after MUDA-waste-audit probe completes at step 6.55.
       // The qualitative-waste-audit gate (also step 6.55) reads this field.
       // Per RESEARCH AD-02: step 6.55 is a two-phase gate — run MUDA-waste-audit,
       // capture result, update local_ctx.mechanical_muda_verdict, THEN evaluate qualitative gate.
       // getMudaVerdictFromPhaseDir reads the verdict column of the first non-header
       // row of WASTE.md; returns 'PASS' if WASTE.md does not exist yet (safe default).
     };
     // Unknown fields throw loud in predicate-eval (D-10c) — do not add fields without
     // updating predicate-eval.cjs's DISPATCH_CONTEXT_FIELDS registry.
     ```

  9.5. PER-DISPATCH ATC (closes the mid-phase ATC gap)
      Runs AFTER the executor report lands, BEFORE state update + commit.
      Fires when gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH) returns true,
      where ctx is the dispatch context assembled at Step 9.2. The gate's trigger declares
      the equivalent policy (classifier.atc_tier in [full, gate] AND
      code_files_changed_count > 0) — see super-gsd/registry/gates.yaml.

      // Gate check (Phase 10 D-05): R5 compose — BOTH kill-switches must agree
      // config.atc.enabled is preserved as an outer runtime knob (D-13a)
      if (config.atc.enabled && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH)) {

      Skip entirely if tier ∈ {skip, lite} — LITE is already covered by the
      anti-slop self-check every executor should apply to its own diff, and
      SKIP by definition warrants no review.

      If tier == full OR tier == gate:
        // Phase 15 CODEX-07: provider-dispatch indirection.
        // VTP: AGP-P-05 (protocol-level resource registration for discovery),
        //      HiveMind doc:5a50cc9b459e (single-retry, no thundering herd).
        const provider = gates.resolveReviewerProvider('per-dispatch-ATC', gatesRegistry, { gatesYamlPath: GATES_YAML_PATH });
        const effective = (provider && provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
          ? gates.getProvider(provider.fallback_to)
          : provider;

        let report;
        if (!effective) {
          // No reviewer_provider declared on gate — skip dispatch, log info
          logInfo('GATE_NO_PROVIDER: per-dispatch-ATC has no reviewer_provider; skipping review dispatch');
        } else if (effective.invocation === 'agent') {
          report = await Agent({
            subagent_type: effective.agent_subagent_type,
            model: effective.agent_model || 'sonnet',
            mode: 'auto',
            prompt: composedPrompt   // composedPrompt contains scope/phase/plan/files/tier/checks
          });
        } else if (effective.invocation === 'shell') {
          // Shell dispatch: codex-exec.sh
          const promptFile = writeTempPrompt(composedPrompt);
          const reportOut = tempReportPath('per-dispatch-atc');
          const dispatchResult = shellDispatch(effective.shell_script, {
            promptFile,
            timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
            reportOut,
            phase: currentPhase,
            step: '9.5'
          });
          if (dispatchResult.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
            // Single-retry fallback to Claude per HiveMind centralized-retry pattern (doc:5a50cc9b459e)
            logDeviation(`GATE_PROVIDER_FALLBACK: ${effective.name} exit=${dispatchResult.exit} → ${effective.fallback_to}`);
            const fallbackProvider = gates.getProvider(effective.fallback_to);
            report = await Agent({
              subagent_type: fallbackProvider.agent_subagent_type,
              model: fallbackProvider.agent_model || 'sonnet',
              mode: 'auto',
              prompt: composedPrompt
            });
            // Tag the report row as claude-via-fallback for CODEX-10 metric accuracy
            report._provider = 'claude-via-fallback';
          } else if (dispatchResult.exit !== 0) {
            // Both providers failed — hard blocker per CONTEXT D-02c
            logDeviation('GATE_PROVIDER_DOUBLE_FAIL: both codex-cli-reviewer and fallback failed');
            writeCheckpoint({ reason: 'GATE_PROVIDER_DOUBLE_FAIL', step: '9.5' });
            throw new Error('GATE_PROVIDER_DOUBLE_FAIL: review gate failed on both providers');
          } else {
            report = { content: dispatchResult.report, _provider: 'openai-codex' };
          }
        }
        → Returns: { findings, critical_count, warning_count, verdict }

        If tier == gate AND auto mode: log GATE_AUTO_BYPASS;
                          append "[GATE bypassed in auto mode]" to DEVIATIONS.
        If tier == gate AND interactive mode: STOP with blocker; user reviews + approves
                                             before the commit lands.

        // Evidence emission: path-identical to prior Claude path per CONTEXT D-03
        // commit-reviews.jsonl gains provider: field for CODEX-10 metric accuracy
        Write verdict as a one-line JSONL append to
          `.planning/phases/{NN}/commit-reviews.jsonl`:
          {"ts":"{ISO}","plan":"{NN-PP}","tier":"full|gate","verdict":"pass|warn|fail","critical":N,"warning":N,"one_liner":"...","provider":"{openai-codex|claude-sonnet|claude-via-fallback}"}

        appendPerDispatchReviewEvidence(report, {
          gate: 'per-dispatch-ATC',
          provider: report._provider || effective.name,
          fallback_triggered: !!(report._provider === 'claude-via-fallback')
        });

      If critical > 0 AND interactive: STOP with blocker quoting the findings.
      If critical > 0 AND auto: log GATE_AUTO_BYPASS, append to DEVIATIONS,
      continue — per Golden Rule 13, auto mode never blocks on quality gates,
      only logs and moves on. The phase-level ATC at Step 6.5 catches what
      auto-bypass let through.

      Token budget per dispatch: ~300 tokens (250 review + 50 JSONL append).
      On a 10-dispatch phase with 3 FULL-tier dispatches → +900 tokens total.
      SKIP/LITE dispatches pay zero.
      } // end config.atc.enabled && gates.shouldFire('per-dispatch-ATC')

  9.6. ADVERSARIAL VERIFIER CHALLENGER PASS (MACH-04, D-13..D-15)

       Fires only when ALL three conditions hold:
         - Step 6.f completed this iteration (i.e., gsd-verifier was dispatched)
         - Verifier report status in {passed, passed-with-deviations} — i.e., a PASS verdict
           (actual gsd-verifier vocab: `status: passed` or `status: human_needed` with no blockers)
         - Dual-gate: config.atc.enabled AND Math.random() < config.atc.verifier_adversarial_rate

       Rate default: 0.2 (D-14). Set to 0 to disable entirely. Set to 1 to force on every pass.
       Matches Step 9.5 kill-switch convention: config.atc.enabled must be true for either ATC
       gate to fire — consistent disable semantics (§Open Question 2 resolution).

       If all three conditions met:

         a. TaskCreate({content: "Phase {N} adversarial challenger", activeForm:
            "gsd-verifier [sonnet] P{N} — contrarian pass"})

         b. Compose challenger prompt by prepending the D-13a contrarian header VERBATIM:

            ```
            ADVERSARIAL CHALLENGER PASS — the primary verifier returned PASS. You are challenging that verdict. Assume the primary verifier missed something. List the top 3 ways this phase might silently fail despite the PASS. Focus on: cross-plan integration gaps the primary verifier didn't exercise, assumptions baked into plan contracts that weren't proven in execution, invariants that are mechanically true but semantically vacuous.
            ```

            Prompt composition (DLB-03 structural injection pattern, cf. SKILL.md:241-274):

            ```javascript
            const challengerPrompt =
              `ADVERSARIAL CHALLENGER PASS — the primary verifier returned PASS. You are ` +
              `challenging that verdict. Assume the primary verifier missed something. List ` +
              `the top 3 ways this phase might silently fail despite the PASS. Focus on: ` +
              `cross-plan integration gaps the primary verifier didn't exercise, assumptions ` +
              `baked into plan contracts that weren't proven in execution, invariants that are ` +
              `mechanically true but semantically vacuous.\n\n` +
              primaryVerifierPrompt;
            ```

         c. // Step 9.6 MACH-04: adversarial verifier challenger dispatch (CODEX-11)
            // Phase 15 CODEX-11: challenger is always the non-primary vendor (cross-vendor signal).
            // VTP: doc:70a3d5757b6a (Shift-Up) — dual-vendor workflow at gate granularity.
            // NOTE: This does NOT use gates.resolveReviewerProvider. Adversarial challenger
            // routing is orthogonal to the gate-reviewer routing — it has its own rule:
            // always dispatch to the non-primary vendor. This distinction is intentional.

            const primary = 'claude-sonnet-verifier';  // Phase 15: primary verifier is always Claude
            const challengerProviderName = (primary === 'claude-sonnet-verifier')
              ? 'codex-cli-reviewer'       // Claude primary → Codex challenger
              : 'claude-sonnet-reviewer';  // Future-proofing: Codex primary → Claude challenger

            let challengerReport;

            if (challengerProviderName === 'codex-cli-reviewer' &&
                (!config.review_providers.codex_enabled || codexAuthFailed)) {
              // Per CONTEXT D-17: if Codex unavailable, skip entirely.
              // Do NOT fall back to same-vendor challenger — that defeats the purpose
              // of cross-vendor signal (D-17a). Better to skip than produce false signal.
              logDeviation('VERIFIER_ADVERSARIAL_SKIP: codex unavailable');
            } else {
              const challengerProvider = gates.getProvider(challengerProviderName);

              if (challengerProvider.invocation === 'shell') {
                const promptFile = writeTempPrompt(challengerPrompt);
                const reportOut = tempReportPath('adversarial-verifier');
                const dispatchResult = shellDispatch(challengerProvider.shell_script, {
                  promptFile,
                  timeout: challengerProvider.timeout_seconds || config.review_providers.codex_timeout_seconds,
                  reportOut,
                  phase: currentPhase,
                  step: '9.6-adversarial'
                });
                if (dispatchResult.exit === 0) {
                  challengerReport = { content: dispatchResult.report, _provider: 'openai-codex' };
                } else {
                  // Per CONTEXT D-17: skip on unavailability, no fallback to same-vendor
                  logDeviation(`VERIFIER_ADVERSARIAL_SKIP: codex-exec.sh exit=${dispatchResult.exit}`);
                }
              } else {
                // Future: agent-type challenger (e.g., if primary ever flips to Codex)
                challengerReport = await Agent({
                  subagent_type: challengerProvider.agent_subagent_type,
                  model: challengerProvider.agent_model || 'sonnet',
                  mode: 'auto',
                  prompt: challengerPrompt
                });
                challengerReport._provider = 'claude';
              }

              if (challengerReport) {
                // Token log per CONTEXT D-18: role "adversarial_verifier", provider "openai-codex"
                // Feeds CODEX-10 offload calculation (claude_tokens_saved_by_codex tile)
                appendTokenLogRow({
                  role: 'adversarial_verifier',
                  provider: challengerReport._provider,
                  model: challengerProvider.invocation === 'shell' ? 'codex' : (challengerProvider.agent_model || 'sonnet')
                });
              }
            }

         d. Parse challenger report STATUS (actual gsd-verifier vocab mapping):
            (Applies only when challengerReport is set — i.e., adversarial challenger fired
            and Codex was available. Skipped when VERIFIER_ADVERSARIAL_SKIP was logged.)

            status: passed (challenger agrees — no new concerns found)
              → Log to .planning/metrics/token-log.jsonl:
                  {"ts":"{ISO}","phase":N,"event":"verifier_adversarial_agreement",
                   "verifier_adversarial_agreement":true}

            status: human_needed (challenger finds concerns but not hard failures)
              → This maps to D-13b PASS-WITH-GAPS semantics:
                  Promote phase verdict to PASS-WITH-GAPS.
                  Append challenger findings to {NN}-VERIFICATION.md as
                  `## Adversarial Challenge` section.
                  Do NOT block; log as soft signal.
                  Log to token-log.jsonl:
                  {"ts":"{ISO}","phase":N,"event":"verifier_adversarial_gap_found"}

            status: gaps_found (challenger flips verdict — hard failures found)
              → This maps to D-13b FAIL semantics:
                  Auto mode:
                    Log VERIFIER_ADVERSARIAL_FLIP as CRITICAL in DEVIATIONS.
                    Append full challenger report to {NN}-VERIFICATION.md.
                    Continue — never auto-block on a challenger second opinion (D-13b).
                  Interactive mode:
                    STOP with blocker for operator arbitration.

         e. TaskUpdate(same taskId, status: "completed")

       Token budget per challenger pass: ~600 tokens (same model, same prompt + ~70-token
       header). At rate=0.2 on a 5-phase milestone, expected ~1 invocation — amortised
       +120 tokens per phase (D-15).

       Note on Risk 5 (research §Risk 5): the challenger at 0.2 rate may NOT fire during
       Phase 12's own verifier dispatch. That is expected. verify.mjs invariant 8 checks
       config presence and SKILL.md marker only — not that a challenger has fired.
       "Fired at least once" is a milestone-close concern: audit via
       `grep -r "Adversarial Challenge" .planning/phases/*/`.

  10. CURATE LEARNINGS
      // Gate check (Phase 10 D-08): sgsd-curate-learnings fires when new pattern, script, or error
      if (gates.shouldFire('sgsd-curate-learnings', ctx, GATES_YAML_PATH)) {
      If DEVIATIONS contains new patterns → sgsd-curate to patterns/
      If SCRIPTS_CREATED non-empty → sgsd-curate to scripts/{category}
      If new error discovered → sgsd-curate to error-rules/
      } // end gates.shouldFire('sgsd-curate-learnings')

  11. UPDATE STATE
      // Gate check (Phase 10 D-09): token-log gate fires unless disabled (soft-warn, no trigger)
      // NOTE: Step 11 is exempt from edge-guard emit-check (D-11c) — it IS the logging step.
      if (gates.shouldFire('token-log', ctx, GATES_YAML_PATH)) {
      - Update STATE.md (advance plan counter, update progress)
      - Mark ROADMAP.md phase progress
      - Log token usage to .planning/metrics/token-log.jsonl
      } // end gates.shouldFire('token-log')

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

## Edge-Guard Layer

The edge-guard layer audits every loop-step transition, writing a JSONL row to
`.planning/metrics/edge-guard-log.jsonl`. It operates as a post-step wrapper:
the orchestrator captures file-mtime snapshots **before** and **after** each
step, diffs them to derive `actualEmits`, then calls `recordTransition` with
the gate's declared `expectedEmits`.

### BEFORE / step-runs / AFTER pattern (§Q4)

```
BEFORE step N runs:
  snapshot_before = snapshotMtimes(gate.evidence_emitted)

step N runs normally (existing orchestrator behaviour)

AFTER step N runs, BEFORE transition to step N+1:
  snapshot_after  = snapshotMtimes(gate.evidence_emitted)
  actualEmits     = paths whose mtime changed during the step

  const result = edgeGuard.recordTransition({
    fromStep: N, toStep: N+1,
    phase, plan,
    gateName:      owningGateName,          // from gates.yaml
    expectedEmits: gate.evidence_emitted,   // declared on gate row
    actualEmits,
    ctx,                                    // dispatch context (Step 9.2)
    gatesYamlPath: GATES_YAML_PATH,
    projectDir,
  });

  if (result.status === 'halt') {
    writeCheckpoint({
      next_unit:       `BLOCKED — edge-guard halt at ${result.row.gate}: missing ${result.missing_emits.join(', ')}`,
      operator_action: `Investigate why gate did not emit the listed paths. Resolve manually, add 'resolved_by: {ISO}' to this file, then re-run /sgsd-orchestrate go.`,
      edge_guard_row:  result.row,
    });
    EXIT;
  }
  // status 'logged' or 'ok' → continue to step N+1
```

### recordTransition call signature

```javascript
const { recordTransition } = require('super-gsd/scripts/lib/edge-guard.cjs');

recordTransition({
  fromStep,       // number — step that just completed
  toStep,         // number — step about to start
  phase,          // number|string — current phase
  plan,           // string — current plan (e.g. '10-02')
  gateName,       // string|undefined — gates.yaml row name for escalation lookup
  expectedEmits,  // string[] — gate.evidence_emitted from gates.yaml row
  actualEmits,    // string[] — paths observed as written during step
  ctx,            // Object — dispatch context (see Step 9.2)
  gatesYamlPath,  // string — absolute path to super-gsd/registry/gates.yaml
  projectDir,     // string — project root (log path resolved relative to this)
});
// Returns: { status: 'ok'|'logged'|'halt', missing_emits: string[], row?: Object }
```

### JSONL row schema (11 required fields)

Every row written to `.planning/metrics/edge-guard-log.jsonl` contains exactly:

```json
{
  "ts":             "2026-04-22T16:10:00.000Z",
  "phase":          10,
  "plan":           "10-02",
  "from_step":      6.5,
  "to_step":        6.55,
  "gate":           "phase-level-ATC",
  "expected_emits": [".planning/phases/10-gate-policy/10-ATC-REVIEW.md"],
  "actual_emits":   [".planning/phases/10-gate-policy/10-ATC-REVIEW.md"],
  "missing_emits":  [],
  "context":        { "classifier.atc_tier": "full", "files_changed_count": 7 },
  "resolution":     "pass"
}
```

### Resolution vocabulary

| Value | Meaning |
|-------|---------|
| `pass` | All expected emits were observed — no action needed |
| `log-only` | Some emits missing but gate does NOT have `escalation: halt` — row written, orchestrator continues |
| `halt` | Some emits missing AND `gate.escalation === 'halt'` in gates.yaml — orchestrator writes checkpoint and exits |
| `gate_eval_error` | Predicate threw (unknown context field etc.) — log row with this resolution, treat as failed-closed |

### D-11c token-log exemption

**Step 11 (token-log) is exempt from edge-guard.**
When `fromStep === 11`, `recordTransition` early-returns `{status:'ok', missing_emits:[]}`.
This prevents the logging step itself from being recursively audited (it IS the logging).
The token-log gate's `evidence_emitted: []` on the gates.yaml row carries the same intent.

### D-11b no-rollback guarantee

Edge-guard is **read-only with respect to git**. Its only side-effects are:
1. Appending a row to `edge-guard-log.jsonl`
2. Returning `{status:'halt'}` so the **orchestrator** invokes the checkpoint routine

No destructive repository operations are ever issued by edge-guard (10-CONTEXT.md D-11b:
rejected as too risky for minimal gain). Halt + manual recovery is the only escalation path.

### Halt-escalation flow (§Q5)

1. Edge-guard detects `missing_emits.length > 0` AND `gate.escalation === 'halt'`.
2. Edge-guard writes the failing row to `edge-guard-log.jsonl` first (durability).
3. Edge-guard returns `{status: 'halt', ...}` to the orchestrator.
4. Orchestrator calls the **existing** checkpoint routine (below) — edge-guard does NOT
   duplicate checkpoint logic.
5. Checkpoint `next_unit` references the failed gate:
   `"BLOCKED — edge-guard halt at '{gate}': missing emits {list}"`.
6. Checkpoint `operator_action` field signals re-entry guard: on next session resume, if
   `operator_action` is present and no `resolved_by:` line exists, orchestrator surfaces it
   as a blocker and exits rather than re-entering the loop (prevents halt loops on unattended runs).

### Standalone verification

`node super-gsd/scripts/lib/edge-guard.cjs --self-test`

The `--self-test` CLI is the GATE-04 verification surface. It:
- Writes two rows to a temp `projectDir` (via `os.mkdtempSync`) — one `pass` row, one `log-only` row
- Asserts all 11 required keys are present on each row
- Asserts `resolution === 'pass'` on the no-missing row and `resolution === 'log-only'` on the missing-emit row
- Deletes the temp dir on exit (no rows ever reach the real `.planning/metrics/edge-guard-log.jsonl`)
- Exits 0 on PASS; exits 1 with a message naming the first failing key on FAIL

This is the single command that satisfies GATE-04 without a separate test harness.

<checkpoint_protocol>
When context >=85% OR ((phase_boundary OR plan_boundary) AND context >=70%) OR user says stop:

**Self-assess at Step 1 (READ STATE):** After parsing STATE.md, estimate current context usage.
- If context >=85%: trigger the **Emergency halt path** immediately (mid-task if needed).
- If context >=70% AND you are at a phase boundary or plan boundary: trigger the normal checkpoint path below.
- If context <70%: continue normally.

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
model_breakdown:
  opus: {N}
  sonnet: {N}
  haiku: {N}
context_percent_at_write: {N}
emergency_halt: false
approaches_tried_and_abandoned: []
rules_learned_this_session: []
dispatches_summary:
  total: 0
  by_agent:
    executor: 0
    verifier: 0
    planner: 0
    researcher: 0
    classifier: 0
    code_reviewer: 0
  by_outcome:
    pass: 0
    fail: 0
    warn: 0
    blocker: 0
resume_instruction: "Enter loop at next_unit without re-briefing user"
---

## Completed This Session
- plan {NN-PP}: {ONE_LINER from report}
- plan {NN-PP}: {ONE_LINER from report}

## Next Action
{What the next agent should do}

## Remaining Work
- {remaining plans in current phase}
- {remaining phases in milestone}

## Learnings Curated
- {patterns/decisions curated to ByteRover this session}
```

Then commit the checkpoint and STOP.

### Emergency halt path (D-11)

When context >=85% — even mid-task, even mid-plan — execute these three steps immediately:

1. Write `.planning/ORCHESTRATOR-CHECKPOINT.md` with `emergency_halt: true` in the frontmatter (all other fields filled as best known at halt time).
2. Log a DEVIATIONS entry in the current agent report or session log:
   `CHECKPOINT_EMERGENCY: context {N}% at task {id} of plan {id}`
3. Exit loop with a text-only stop — do NOT dispatch another agent or attempt to finish the current task.

The emergency_halt field in the checkpoint frontmatter is the mechanical marker for post-milestone analysis. If >10% of checkpoints in a milestone have `emergency_halt: true`, file an sgsd-curate anti-pattern note and flag the plan-checker rule "plans >6 tasks should be split" for re-enforcement (D-11a).
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

```javascript
// token-log.jsonl row schema (Phase 15+). Backfill-on-read for pre-Phase-15 rows:
// row.provider defaults to 'claude', row.role defaults to 'unknown'.
// NEVER allow empty provider — derive from dispatch path before appending.
const tokenLogRow = {
  ts: new Date().toISOString(),
  phase: currentPhase,            // integer
  plan: currentPlan,              // integer
  model: dispatchedModel,         // 'sonnet' | 'haiku' | 'codex' | ...
  role: agentRole,                // 'code_reviewer' | 'adversarial_verifier' | 'executor' |
                                  // 'verifier' | 'classifier' | 'context_selector'
  provider: dispatchProvider,     // 'claude' | 'openai-codex' | 'claude-via-fallback'
  est_input: estimatedInputTokens,
  est_output: estimatedOutputTokens,
  total: estimatedInputTokens + estimatedOutputTokens,
  classifier_model: classifierModel,  // 'haiku' (the classify step model)
  context_tokens: contextWindowUsed
};
// provider value is derived from dispatch path:
//   Agent() dispatch          → 'claude'
//   shellDispatch exit 0      → 'openai-codex'
//   shellDispatch + fallback  → 'claude-via-fallback'
// NOTE: the wrapper (codex-exec.sh) refuses to run if OPENAI_API_KEY is set (exits 4);
//       per CONTEXT D-02a. It does NOT defensively unset the key.
```

Example serialized JSONL row (what actually lands in token-log.jsonl):
```json
{"ts":"2026-04-24T12:00:00Z","phase":15,"plan":3,"model":"codex","role":"code_reviewer","provider":"openai-codex","est_input":500,"est_output":200,"total":700,"classifier_model":"haiku","context_tokens":1200}
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
