---
name: sgsd-orchestrate
description: "Token-efficient autonomous orchestrator. Claude/Opus orchestrates only; research, planning, plan-check, verification, gates, and code execution are hard-routed to Codex GPT-5.5 xhigh."
argument-hint: "[go|auto|continue|status|next|stop]"
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
- `/sgsd-orchestrate auto` is the canonical hard-loop command. Treat operator
  variants such as `/SGSD-orchestrate auto` as the same intent; implementation
  lookup may still require lowercase slash command names.
- `next` — Execute ONE unit, then report and stop
- `status` — Read state, report position, stop
- `stop` / `pause` — Write checkpoint, stop

Exit conditions (ONLY these 3):
1. Entire active roadmap has no remaining phase/milestone work after milestone
   close/advance attempts
2. Board plus a separate Codex challenge cannot produce a safe local recovery
   path because the remaining blocker is credentials, destructive ambiguity,
   external access, or another operator-only boundary
3. User says stop/pause

Autopilot continuation rule:
- In `go` / `auto` / `continue`, phase-close summaries, milestone-midpoint
  summaries, cost summaries, and "operator review" summaries are informational
  only. They are never a reason to stop.
- Never ask "keep pushing?", "pause for operator review?", "continue?", or any
  equivalent choice question while auto mode is active.
- If a summary is useful, write it to STATE/narrative/checkpoint artifacts as
  evidence, then immediately perform the next loop tool call.
- "Operator review" is valid only after all phases complete, after the
  board-plus-Codex recovery path is exhausted, or when the user explicitly
  invoked `next`, `status`, `stop`, or `pause`.
- Missing phase CONTEXT.md / "not discussed" is not a hard stop in `go` /
  `auto` / `continue`. In auto mode, synthesize the phase CONTEXT.md and
  discussion decision record from ROADMAP/STATE/checkpoint/proposal/audit
  evidence, then immediately continue to research. Only interactive or `next`
  mode should suggest `/gsd-discuss-phase`.

Context percentage is NOT an exit condition. Never self-estimate context use.
Runtime compaction and external files (`STATE.md`, `ORCHESTRATOR-CHECKPOINT.md`,
metrics JSONL, and milestone artifacts) are the context-management mechanism.
</objective>

<blocker_recovery_hard_loop>
## Blocker Recovery Hard Loop

In auto mode, ordinary blockers do not stop the loop. If any later section says
to halt, checkpoint, or ask the operator because Codex failed, a report was
malformed, a plan is uncertain, context is missing, VTP is degraded, tests fail,
or an implementation path dead-ends, run this recovery path first:

Codex-on-Windows read failures are not operator-only blockers. If stderr/stdout
contains `CreateProcessAsUserW`, `error 216`, `os error 216`, or any equivalent
"Codex cannot read files" symptom, immediately route the same executor prompt
through `super-gsd/scripts/codex-patch-executor.sh` with a bounded allowlisted
read-pack. Claude may assemble the read-pack and apply Codex's unified diff;
Claude must not author the code delta. Only after direct Codex, patch-mode
Codex, and any configured Linux/SSH Codex route all fail may this enter board
recovery.

1. Write a compact blocker brief under the active phase directory:
   `{phaseDir}/{phaseNum}-BLOCKER-RECOVERY-BRIEF.md`.
   Include the failed command/report path, attempted plan, constraints, files
   touched, and the next desired outcome.
2. Invoke the SGSD board via `/sgsd-deliberate {brief}` or direct board agents
   using `super-gsd/registry/board-members.yaml`:
   - default minimal board from `board-registry.resolveRoster(brief)`
   - fresh-clone board dispatch is Sonnet-free; active default is
     `sgsd-board-architect`, `sgsd-board-contrarian`, and `sgsd-ceo`
   - Architect and Contrarian require Opus 4.7 with xhigh reasoning intent
   - `sgsd-ceo` synthesizes the decision
3. Write the board memo under `.planning/decisions/` or the phase directory.
4. Send the board decision to a separate Codex challenge using
   `super-gsd/scripts/codex-exec.sh` with `--step blocker-recovery-challenge`.
5. Choose the safest actionable recommendation from board plus Codex, log a
   closed-vocab recovery row to `.planning/metrics/route-decisions.jsonl`, and
   resume the loop at the next executable step.

Only after this path fails may auto mode stop for a blocker, and only when the
remaining issue is operator-only: missing credentials, destructive ambiguity,
external access, legal/safety boundary, or no local command/tool can progress.
Explicit user `stop` / `pause` still wins immediately.
</blocker_recovery_hard_loop>

<auto_mode_pipeline_contract>
## Auto Mode Pipeline Contract

When invoked as `/sgsd-orchestrate auto`, `go`, `auto`, or `continue`, SGSD owns the
whole delivery loop. Do not stop after research, planning, plan-check,
phase-close, milestone-close, cost summaries, or "operator review" summaries.
Those are intermediate states.

Current provider lock:

- Orchestration is Claude/Opus 4.7 with xhigh thinking.
- Codex GPT-5.5/xhigh owns research, planning, plan-check, verification,
  source-changing execution, spec-compliance review, per-dispatch ATC,
  phase-level ATC, MUDA, and other Codex-owned gates.
- Sonnet is not a fresh-clone default provider and is not a Codex fallback. If
  any later legacy branch says to dispatch Sonnet for those surfaces, override
  it and route through Codex.

Canonical path for each phase:

1. Run `node super-gsd/scripts/lib/decision-state.cjs --render orchestrator --project "$PWD"`, then read the active roadmap, checkpoint, and config.
2. Ensure phase CONTEXT exists. In auto mode, synthesize missing context from
   roadmap/state/checkpoint/audit evidence instead of pausing for discussion.
3. Research with Codex GPT-5.5/xhigh via `super-gsd/scripts/codex-exec.sh`.
   Claude composes the research prompt and processes the report; Claude does
   not perform phase research itself in auto mode.
   - Use configured MCP/context artifacts when available. VTP/private KB
     enrichment happens in Step 4, after the Codex research artifact exists.
   - If an MCP is configured but unavailable in the current tool scope, log a
     degraded reason and write it into the research artifact. Do not silently
     omit it.
4. Run VTP enrichment before planning whenever
   `.planning/config.json -> vtp_enrichment.enabled` is true.
5. Plan with Codex GPT-5.5/xhigh.
   - Planner prompt must consume RESEARCH + VTP enrichment and may call VTP MCP
     itself for prior-memory/book/project/architecture uncertainty when the MCP
     is present.
6. Run Codex plan-check.
7. Run Codex GPT-5.5/xhigh final plan review applying ATC + MUDA to the plan
   set. If it NOGOs, route back to Codex planning for a revised final draft.
8. Execute only through `codex-executor [gpt-5.5/xhigh]`. Claude never performs
   code edits as executor. Treat each Codex executor dispatch as a serial
   subagent-driven-development implementer run: fresh bounded prompt, one
   task/plan, no inherited Codex context, and no parallel Codex file writers in
   the same workspace. If Windows Codex cannot read files, use Codex read-pack
   patch mode before any blocker checkpoint.
9. Run Codex spec-compliance review over raw artifacts before ATC: PLAN,
   executor report, git diff, and verification output. The spec reviewer must
   not rely on the executor's own summary as proof.
10. Verify and run per-dispatch ATC, phase-level ATC, MUDA, browser gates when
   applicable through Codex/local SGSD gate scripts, commit, mark phase
   complete, and immediately choose the next phase.
11. When all phases in the active milestone are complete, run
    `sgsd-complete-milestone` automatically. If the roadmap has another
    milestone/phase, advance and continue the same auto loop.

Auto mode stop policy:
- Stop only for: explicit user pause/stop, no remaining roadmap/milestone work
  after close/advance checks, or a blocker that remains operator-only after the
  Blocker Recovery Hard Loop.
- Never ask "which option?", "continue?", "plan-check now?", "read yourself?",
  or "operator review?" in auto mode. Pick the safest forward path and keep
  issuing tool calls.
</auto_mode_pipeline_contract>

<token_budget>
You have ~1,350 tokens per loop iteration. Spend them wisely:
- Decision-state CLI output: ~200 tokens
- Classify (frontmatter/cache or Codex/local): ~50 tokens
- Query context (sgsd-recall): ~100 tokens
- Compose agent prompt: ~500 tokens
- Process agent report: ~300 tokens
- Spec-compliance review (Step 9.4): ~300 for every file-changing executor dispatch
- ATC gate (Step 9.5): ~550 for every file-changing executor dispatch
- State update + commit: ~150 tokens
- Curate learning (sgsd-curate): ~50 tokens

DO NOT read full files. DO NOT load ROADMAP.md every loop. DO NOT re-read context
you already have. Frontmatter and sgsd-recall results are your context.
</token_budget>

<cold_start>
On first entry (no checkpoint):

1. Run `node super-gsd/scripts/lib/decision-state.cjs --render orchestrator --project "$PWD"` and use its milestone, opaque phase token, phase name/status, confidence, and source. Treat any PROJECTION STALE / EVIDENCE CONFLICT warning as visible dispatch input; never silently prefer raw STATE.md frontmatter.
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

     // INSTR-01 (v1.5 Phase 25): edge-guard wiring — records every gate
     // transition to .planning/metrics/edge-guard-log.jsonl. Enables the
     // gate-drift-audit step at sgsd-complete-milestone close to surface
     // gates that skip-drifted >3 times during the milestone.
     const edgeGuard = require('super-gsd/scripts/lib/edge-guard.cjs');
     ```

     Non-blocking: if gates-registry.cjs is missing (pre-Phase-10 environment),
     log a single warn and continue. All `gates.shouldFire` calls below degrade
     gracefully to `true` (gate fires unconditionally) so existing behaviour is
     preserved while the registry is absent. Same graceful-degradation rule
     applies to edge-guard.cjs — if absent, recordTransition calls are no-ops.

     **Edge-guard call contract (INSTR-01)**: After EVERY major gate-firing
     decision in the loop below (every `gates.shouldFire(...)` branch that
     determines whether a step's expected emits landed), call
     `edgeGuard.recordTransition({fromStep, toStep, phase, plan, gateName,
     expectedEmits, actualEmits, ctx, gatesYamlPath: GATES_YAML_PATH,
     projectDir})`. The function appends one row per call and returns
     `{status: 'ok'|'logged'|'halt', missing_emits, row}`. The orchestrator
     halts only if `status === 'halt'` (per-gate opt-in via
     `escalation: halt` in gates.yaml).

3.65. PARSE OPERATOR OVERRIDES (Phase 38 SAMPLE-04 + SAMPLE-05)
     // Locked decision 38.5: --force-gates and --skip-gates both require
     // --override-reason="..."; logged to route-decisions.jsonl with
     // boundary='gate_override'. Reason-less override exits 1.

     // Cache the parsed overrides on the dispatch context so all 3 wire-in
     // sites read the same Set; symmetric-set check rejects gate-in-both.
     ```javascript
     const samplingDecider = require(path.join(process.cwd(),
       'super-gsd', 'scripts', 'lib', 'sampling-decider.cjs'));
     const cliOverrides = samplingDecider.parseGateOverrides(
       process.argv,
       (name) => { try { gates.getGate(name, GATES_YAML_PATH); return true; }
                   catch { return false; } }
     );

     // Log one route-decisions.jsonl row per override (locked Q6).
     // boundary='gate_override' was added to BOUNDARIES in Phase 38; the
     // route-ledger writer accepts the new entry.
     if (cliOverrides.force.size > 0 || cliOverrides.skip.size > 0) {
       try {
         const rl = require(path.join(process.cwd(),
           'super-gsd', 'scripts', 'lib', 'route-ledger.cjs'));
         for (const g of cliOverrides.force) {
           rl.logRouteDecision(path.join(process.cwd(), '.planning'), {
             boundary: 'gate_override', status: 'ok',
             phase: currentPhase, milestone: currentMilestone,
             reason_codes: ['gate_force_override_with_reason'],
             decision: { gate: g, action: 'force', reason: cliOverrides.reason },
           });
         }
         for (const g of cliOverrides.skip) {
           rl.logRouteDecision(path.join(process.cwd(), '.planning'), {
             boundary: 'gate_override', status: 'ok',
             phase: currentPhase, milestone: currentMilestone,
             reason_codes: ['gate_force_override_with_reason'],
             decision: { gate: g, action: 'skip', reason: cliOverrides.reason },
           });
         }
       } catch (e) {
         console.warn('[SGSD] route-ledger gate_override emit failed (continuing):', e && e.message);
       }
     }
     ```

3.7. VTP HEALTH PROBE (D-08 — one-time cold-start ping, cached for session)
     Immediately after step 3.6, if config.vtp_enrichment.enabled is true,
     ping VTP once to establish session health. Cache result as vtp_available.

     ```javascript
     // vtp_health cold-start probe (D-08)
     let vtp_available = false; // default: assume unavailable (safe degraded mode)
     if (config.vtp_enrichment && config.vtp_enrichment.enabled === true) {
       try {
         // Minimal health ping using vtp_search with a 1-result seed
         // Actual call happens in agent runtime scope via mcp__vtp-kb__vtp_search
         // In orchestrator scope: use gates.shouldFire to decide, then log result
         const healthResult = await callVtpHealthProbe(); // see note below
         if (healthResult && healthResult.ok !== false) {
           vtp_available = true;
         }
       } catch (_) {
         vtp_available = false;
       }
       const healthState = vtp_available ? 'healthy' : 'degraded';
       const vtp_health_cached = healthState;
       console.log(`[SGSD] vtp_health: ${healthState}`);

       // Append health row to .planning/metrics/vtp-health.jsonl
       const fs = require('fs');
       fs.appendFileSync('.planning/metrics/vtp-health.jsonl',
         JSON.stringify({
           ts: new Date().toISOString(),
           vtp_available,
           vtp_health_cached: healthState,
           source: 'cold_start_probe',
         }) + '\n'
       );

       if (!vtp_available) {
         console.warn('[SGSD] VTP health check failed -- enrichment gates will run continue-without-artifact mode (D-08 degraded)');
       }
     }
     // vtp_available is now cached for this session.
     // All Step 6.b.5 gate checks read this cached value before dispatching.
     ```

     Implementation note: callVtpHealthProbe() is a thin wrapper that calls
     mcp__vtp-kb__vtp_search with seed "health check" and max_results=1.
     If the tool is unreachable or returns ok=false, vtp_available stays false.
     Non-blocking: if vtp_enrichment.enabled is false (default), probe is skipped
     entirely and vtp_available=false (gate never fires anyway per D-07).

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

<executor_routing>
## Executor Routing - HARD LOCK: Claude orchestrates, Codex executes

This SGSD install is Codex-delivery locked. Claude/Opus is allowed to
orchestrate and summarize. Codex owns planning, research, classification,
verification, gates, and code-mutating executor work. Claude MUST NOT perform
those delivery roles and MUST NOT spawn Claude/Sonnet agents for them.

Hard rules:

1. Every code-mutating executor dispatch MUST run through:
   `super-gsd/scripts/codex-executor.sh`.
2. The executor model is always `gpt-5.5`.
3. The executor reasoning effort is always `xhigh`.
4. Ignore `.planning/config.json` if it says `executor_provider` is missing,
   `"claude"`, or any non-Codex value. Treat that config as stale and proceed
   with Codex anyway.
5. Parallel executor waves must serialize. Codex CLI sessions assume exclusive
   write access to the workspace.
6. The Claude Agent tool must not be used as the default planner, researcher,
   verifier, checker, readiness probe, classifier, reviewer, fallback reviewer,
   or executor. In auto mode, those delivery roles are Codex-first and
   Codex-only unless the operator explicitly changes the provider contract.

Forbidden executor path:

```text
Do not call Agent with subagent_type gsd-executor.
Do not call Agent with Sonnet for planner, researcher, verifier, checker,
readiness, classifier, reviewer, or fallback reviewer.
Do not describe a fallback to Claude executor.
Do not continue code work in Claude if Codex fails.
```

Required executor path for every pending plan/task:

```text
1. Derive phase_dir from the pending plan file path.
   Example:
     plan_file = .planning/phases/153-gate-engine-runtime/153-04-PLAN.md
     phase_dir = .planning/phases/153-gate-engine-runtime
     plan_id   = 153-04

2. Write the exact executor prompt that would have gone to the executor agent to:
     {phase_dir}/{plan_id}-CODEX-EXECUTOR-PROMPT.md
   Include the SDD implementer contract: fresh context, one task/plan only,
   run verification, self-review, and report concerns/blockers explicitly.

3. Run Codex:
     bash super-gsd/scripts/codex-executor.sh \
       --prompt-file "{phase_dir}/{plan_id}-CODEX-EXECUTOR-PROMPT.md" \
       --report-out  "{phase_dir}/{plan_id}-CODEX-EXECUTOR-REPORT.md" \
       --workspace   "$(pwd)" \
       --phase       "{phase_number}" \
       --plan        "{plan_id}"

4. Read the report file:
     {phase_dir}/{plan_id}-CODEX-EXECUTOR-REPORT.md

5. Run Step 9.4 spec-compliance review and write:
     {phase_dir}/{plan_id}-SPEC-REVIEW.md
   The reviewer reads raw artifacts: PLAN, Codex executor report, git diff, and
   verification output. It must not accept the executor's own summary as proof.

6. Process the report through the existing Step 9, Step 9.4, and Step 9.5 path:
   commit discipline, spec compliance, per-dispatch ATC, gate logging, state
   advancement.
```

Failure behavior:

- If `codex-executor.sh` exits 3, 4, 5, or 1, run the Blocker Recovery Hard
  Loop and resume if it yields a safe local path. Do not fall back to Claude
  executor.
- If `codex-executor.sh` exits 8 or reports `CreateProcessAsUserW=216` /
  equivalent Windows file-read failure, do not checkpoint for operator
  infrastructure. Run `super-gsd/scripts/codex-patch-executor.sh` with the
  prewritten `{planId}-CODEX-FILES.txt` allowlist. This keeps Codex as the code
  author while SGSD supplies the read-pack and applies Codex's unified diff.
- If Codex returns a report but no files changed, process that as an executor
  report failure/blocker under the normal Step 9 path.
- The operator can watch live Codex output at
  `.planning/metrics/codex-executor-live.txt`.

Telemetry:

- Codex executor writes `.planning/metrics/codex-executor-log.jsonl`.
- Spec-compliance review writes `{planId}-SPEC-REVIEW.md` before ATC. This is
  the first SDD reviewer stage and answers "did Codex implement the plan?"
- Per-dispatch ATC still writes the existing review/gate logs after Codex
  produces the diff and spec compliance passes. This is the second SDD reviewer
  stage and answers "is the implementation safe and well built?"
- Any line in cockpit or task status describing code execution should say
  `codex-executor [gpt-5.5/xhigh]`, not the legacy Sonnet executor label.

SPEC COMPLIANCE IS MANDATORY BEFORE ATC:

- After every Codex executor run that changes files, run Step 9.4 before Step
  9.5. A failing spec review means the implementation is not done; dispatch a
  Codex fix/replan and do not advance state or run ATC as if the task passed.
- The spec reviewer checks only plan conformance: missing requirements,
  extra/unrequested scope, task completion, and whether verification evidence
  maps to acceptance criteria. It does not replace ATC/code-quality review.
- The spec reviewer must inspect raw artifacts: the PLAN file, the git diff,
  command output, and the executor report. Agent-written summaries are hints,
  not evidence.
- If a task changes zero files, log that Step 9.4 is not applicable and handle
  the executor report as a normal no-change failure/blocker if files were
  expected.

PER-DISPATCH ATC IS MANDATORY:

- After every Codex executor run that changes any source, test, config, schema,
  fixture, or planning-runtime file and has passed Step 9.4, run Step 9.5
  per-dispatch ATC.
- Passing tests, "tests-only repair", "small diff", "low risk", or independent
  orchestrator verification are not valid reasons to skip the reviewer/gate.
- If a prior Claude `gsd-executor` agent already produced a report, treat that
  report as a protocol violation. Do not commit it, update STATE from it, or
  advance the plan until the same task has been rerun through Codex executor
  and Step 9.5 has emitted review evidence.
- The only valid per-dispatch ATC skip is an explicit operator gate override
  parsed at cold start with a recorded override reason, or zero changed files.

</executor_routing>

<loop>
## The Auto Loop

```
REPEAT:
  1. RESOLVE DECISION STATE
     - PULSE FIRST (SGSD-v2 Phase D / brief R-Q1 silent-stall observability):
       BEFORE any other action, append a single row to
       `.planning/metrics/orchestrator-pulse.jsonl`:
         `{"ts":"{ISO}","phase":N,"plan":P,"iteration":I,"step":"loop_entry"}`
       This fires EVERY loop iteration, even during deliberative pauses when
       no tool-level heartbeat fires. Closes the 6h silent-stall gap observed
       in Phase 147 overnight run. Cost: <10 tokens per iteration. Downstream
       consumers: SGSD1 mission-control tile "last pulse Ns ago"; sgsd-boot
       preflight freshness check; R-Q4 edge-guard (once decided).
      - Run `node super-gsd/scripts/lib/decision-state.cjs --render orchestrator --project "$PWD"` and use its milestone, opaque phase token, phase name/status, confidence, and source. Treat any PROJECTION STALE / EVIDENCE CONFLICT warning as visible dispatch input; never silently prefer raw STATE.md frontmatter.
      - If all phases in the active milestone are [x], DO NOT EXIT yet:
        run Step 6.7 milestone-close/advance logic. Exit only if milestone
        close succeeds and no next milestone/phase exists in the active
        roadmap.
      - If checkpoint exists → resume from checkpoint; do not stop for context percentage

  1.5. RULE 0 MILESTONE READINESS
      Before classifier/context/dispatch work in auto mode, enforce the unattended-run
      readiness manifest for the active milestone.

      Before reading or classifying that manifest, run exactly:
        `node super-gsd/tools/vtp-readiness/run.cjs --trigger auto --project-dir "{project_dir}"`
      Consume its three results as VTP `PROBE LOG` rows; do not copy the probes.
      Exit 0 is ready. Exit 1 is a finding and follows the existing
      DEGRADED-PATH policy below. Exit 2 is an execution failure.

      Manifest path:
        `.planning/milestones/{milestone}/MILESTONE-READINESS.md`

      A manifest is stale when it is missing OR older than any directory under:
        `.planning/milestones/{milestone}/phases/`

      If missing or stale:
        FIRST: TaskCreate({
          content: "Run milestone readiness for {milestone}",
          activeForm: "codex-readiness [gpt-5.5/xhigh] probing unattended run path",
          status: "in_progress"
        })
        THEN: run Codex/local readiness tooling and write:
          `.planning/milestones/{milestone}/MILESTONE-READINESS.md`
          The probe must never read secret values. It writes GO / BLOCKED /
          WILL-BLOCK / DEGRADED-PATH with evidence.
        AFTER: TaskUpdate(same taskId, status: "completed")

      Behavior by manifest status:
        - GO: continue.
        - PARTIAL/BLOCKED with a runnable DEGRADED-PATH: continue on the runnable path,
          log the degraded status to `.planning/metrics/readiness-log.jsonl`, and let
          phase/milestone status tell the truth.
        - BLOCKED with no runnable next phase: write checkpoint and stop as a real
          blocker/runtime-cannot-continue condition. This is not a context halt.

  2. CLASSIFY
     // Gate check (legacy name: classifier-haiku) fires unless registry disables this gate.
     // Fresh-clone SGSD derives or runs Codex/local classification; it does not spawn Haiku.
     if (gates.shouldFire('classifier-haiku', ctx, GATES_YAML_PATH)) {
     // SCHEMA-04: v2 plans skip classifier spawn — derive classifier result from frontmatter
     // Frontmatter is already parsed at this point (schema_version read for D-12 drift check at Step 3.5)

     IF plan frontmatter has schema_version == 2:
       // Synthesize classifier result from v2 frontmatter fields (no Agent spawn)
       model         ← frontmatter.model  // required SCHEMA-02 field; always present on v2 plans
       atc_tier      ← (frontmatter.expected_ATC_tier || 'LITE').toLowerCase()
       files_count   ← count of all files_touched values across all tasks in frontmatter.tasks
       complexity    ← files_count <= 3 ? 'light' : files_count <= 6 ? 'standard' : 'heavy'
       deliberate    ← (frontmatter.depends_on?.length > 2 || files_count > 5)
       // Phase 38 ATC CRIT fix: synthesize work_risk on this skip path
       // (classifier-skip paths must still emit work_risk per SAMPLE-02
       // contract; without it the gate-fire intersection matrix degenerates
       // to default-tier-only behavior). Derive from same v2 frontmatter
       // fields used above; defaults are conservative (medium) on missing
       // signals so the matrix still discriminates rather than always-fire.
       const samplingDecider = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'sampling-decider.cjs'));
       const phaseType = (frontmatter.phase_type || frontmatter.tasks?.[0]?.type || 'feature').toString();
       const securityReview = !!(
         frontmatter.security_review === true ||
         frontmatter.tasks?.some(t => /security|auth|crypto|secret/i.test(t.type || '') || /security|auth|crypto|secret/i.test(t.hypothesis || ''))
       );
       const work_risk = samplingDecider.scoreWorkRisk({
         diff_lines: (frontmatter.estimated_diff_lines || 0),
         files_touched_count: files_count,
         phase_type: phaseType,
         phase_includes_security_review: securityReview,
         gate_fitness_history: null  // not available at v2-skip path; cold-start defer per Phase 36
       });
       classifier_result = {
         complexity,
         model,
         atc_tier,
         deliberate,
         work_risk,                 // Phase 38 SAMPLE-02 contract preserved on v2 skip path
         reason: "v2 plan — classifier skip (SCHEMA-04)"
       }
       // USE classifier_result as if returned by sgsd-classifier — downstream Steps 3+ unchanged
       // Log skip event (traceability per T-11-14)
       Append to .planning/metrics/token-log.jsonl:
         {"ts":"{ISO}","phase":N,"plan":P,"event":"classifier_skip","reason":"schema_version==2","synthetic_result":{classifier_result}}

      ELSE (schema_version absent or schema_version == 1 — v1 path with MACH-01 cache):
        // MACH-01: attempt cache read before running the Codex/local classifier
       // classifierCache = require('super-gsd/scripts/lib/classifier-cache.cjs')
       const cached = classifierCache.readCache(planFilePath);
       if (cached) {
         // Cache hit — skip classifier dispatch entirely (D-03 + D-04)
         classifier_result = cached;
         // Phase 38 ATC CRIT fix: cache-hit path must also carry work_risk.
         // Older sidecar files written before Phase 38 will lack work_risk;
         // synthesize it from the cached fields (or default 'medium' for
         // safety) so the gate-fire intersection matrix has a value to
         // intersect with on every dispatch, not just freshly-classified
         // ones. This also future-proofs against bumped sidecar formats.
         if (typeof classifier_result.work_risk !== 'string') {
           const samplingDecider = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'sampling-decider.cjs'));
           classifier_result.work_risk = samplingDecider.scoreWorkRisk({
             diff_lines: cached.diff_lines || 0,
             files_touched_count: cached.files_count || 0,
             phase_type: cached.phase_type || 'feature',
             phase_includes_security_review: !!cached.security_review,
             gate_fitness_history: null
           });
         }
         // Log cache-hit event for D-04 accounting
         Append to .planning/metrics/token-log.jsonl:
           {"ts":"{ISO}","phase":N,"plan":P,"event":"classifier_skip","role":"classifier-skip","reason":"sidecar_hit","verdict":{cached}}
        } else {
          // Cache miss — derive a conservative classifier result from plan evidence.
          // If evidence is insufficient, run Codex/local classification through
          // `super-gsd/scripts/codex-exec.sh --step classify`.
          FIRST: TaskCreate({
            content: "Classify phase {N} complexity",
            activeForm: "codex-classifier [gpt-5.5/xhigh] classifying P{N}",
            status: "in_progress"
          })
          THEN: classifier_result = {
            complexity: "standard|heavy",
            model: "codex",
            atc_tier: "light|full",
            deliberate: false,
            work_risk: "low|medium|high",
            reason: "frontmatter/cache miss — Codex/local classifier"
          }
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
       → Log "GATE_AUTO_REPLAN", run FULL checks, and require a fix/replan path

  4. SELECT CONTEXT (execution mechanics only)
     ROUTING POLICY (Phase 149): `super-gsd/registry/skill-routing.yaml` is
     the source of truth for memory-hygiene/recall trigger, moment, mode, and
     cooldown decisions. Runtime scheduled routes are resolved by:
       `node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult --phase N`
     This block retains only context-selection and gate execution mechanics.
     // Gate check (legacy name: context-selector-haiku) fires unless disabled.
     // Fresh-clone SGSD derives context locally; it does not spawn Haiku.
     if (gates.shouldFire('context-selector-haiku', ctx, GATES_YAML_PATH)) {
     FIRST: TaskCreate({
       content: "Select context for phase {N}",
       activeForm: "sgsd-context-selector [local] picking recall queries for P{N}",
       status: "in_progress"
     })
     THEN: derive from plan goal, task files, task type, and domain keywords.
     → Returns: { sgsd_recall_queries, file_reads, error_rules, scripts_to_check }
     AFTER: TaskUpdate(same taskId, status: "completed")
     } // end gates.shouldFire('context-selector-haiku')

  5. QUERY SGSD MEMORY
     // Gate check (Phase 10 D-03): sgsd-recall-queries fires unless classifier.complexity == trivial
     if (gates.shouldFire('sgsd-recall-queries', ctx, GATES_YAML_PATH)) {
     For each sgsd_recall_query: execute sgsd-recall → collect results (~200 tokens each)
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
     a. Phase needs CONTEXT.md (not discussed):
        - Auto mode (`go` / `auto` / `continue`) → DO NOT STOP. Synthesize the
          missing CONTEXT.md and a compact discussion/decision record from
          ROADMAP.md, STATE.md, ORCHESTRATOR-CHECKPOINT.md, the active milestone
          proposal, implementation audit, VTP/private-KB hits if available, and
          existing code evidence. Then continue directly to Step 6.b and
          dispatch Codex research.
        - Interactive / `next` mode → suggest /gsd-discuss-phase.
     b. Phase needs RESEARCH.md → dispatch Codex research (GPT-5.5 / xhigh)
        via `super-gsd/scripts/codex-exec.sh`.
        Write the prompt to `{phaseDir}/{phaseNum}-CODEX-RESEARCH-PROMPT.md`
        and the report to `{phaseDir}/{phaseNum}-RESEARCH.md`. Invoke:
        `--step phase-research --timeout-tier analysis --phase {N}
        --plan research --project {PROJECT_DIR}`. Claude may compose the
        bounded prompt and normalize the report, but must not do the research
        itself in auto mode.
     b.5 VTP ENRICHMENT GATE (Step 6.b.5) — Phase has RESEARCH.md AND config.vtp_enrichment.enabled is true →
         D-08 DEGRADED-MODE CHECK (read cached vtp_available from Step 3.7):
           if vtp_available === false:
             // VTP health check failed at cold-start — skip gate silently (D-08)
             log deviation: "VTP enrichment gate skipped (degraded mode: vtp_available=false)"
             append to .planning/metrics/vtp-health.jsonl:
               {"ts":"{ISO}","phase":N,"plan":P,"event":"gate_skipped","reason":"vtp_degraded"}
             continue directly to Step 6.c (no sub-agent dispatch, no artifact required)
           // else vtp_available === true: proceed normally below
          run optional VTP enrichment through configured MCP/Codex synthesis. Gate
         precondition: gates.shouldFire('vtp-enrichment', ctx).
         Sub-agent calls vtp-enrichment-gate.cjs composeSubAgentSpec() to
         build 800-token 3-source seed (CONTEXT domain + REQ-IDs AC +
         RESEARCH.md per D-02), runs 5-tool VTP cascade (D-01: tools 1+2
         always; tools 3+4+5 only if hits > 0), writes VTP-ENRICHMENT.md
         per D-04 shape to phaseDir (VTPE-05: always write, even on zero
         hits). Escalation:
           on status=api_error  → write VTP_STATUS degraded row, run Blocker
                                   Recovery Hard Loop if the phase cannot
                                   safely continue without VTP; otherwise
                                   continue to Step 6.c
           on status=empty_hit  → artifact written with empty_hit:true +
                                   rationale; continue to Step 6.c
           on status=success    → artifact written with hits; continue to
                                   Step 6.c
         If config.vtp_enrichment absent or enabled=false: skip silently,
         pass directly to Step 6.c (D-07 backward-compat; no artifact
         required on pre-Phase-21 projects).

         DEMAND BASELINE (v3.6 Phase 0, ADVISORY — measurement only, makes NO
         VTP call): for each eligible KB-directed query at this gate, the loop
         SHOULD record one row via `recordEligibleQuery()` from
         `super-gsd/scripts/lib/demand-baseline-ledger.cjs` — capturing whether
         the existing enrichment path was adequate (closed-vocab reason), plus
         latency/tokens/vtp_call_count and the running denominator. This is
         FIRE-AND-FORGET and OFF the critical path: a ledger write failure must
         never block dispatch or phase close. It is the instrument for the
         4-week/20-query demand test that gates the VTP-bridge Stages 2-3 (see
         super-gsd/docs/VTP-BRIDGE-PHASE0.md). It does not call vtp_triage and
         does not change routing — Stage 2 (triage shadow-mode) is blocked on a
         post-VTP-milestone session restart + tool probe; Stage 3 (route-
         following) on gold-set human approval.
     c. Phase needs PLAN.md → enforce planner preflight, then dispatch Codex planner (GPT-5.5 / xhigh)
        PLANNER MODEL LOCK:
        - Planning is a Codex-owned surface in fresh-clone/default SGSD.
          Dispatch through `super-gsd/scripts/codex-exec.sh` with model
          GPT-5.5 and reasoning effort xhigh.
        - If any classifier, router, old prompt, or checkpoint says
          `gsd-planner [sonnet]` or `gsd-planner [opus]`, treat it as stale
          for this surface and route through Codex.
        - This applies to fresh planning, re-planning, gap planning, and
          schema-fix planning.
        PLANNER PREFLIGHT (load-bearing; do not skip on fresh re-dispatch):
        - Read `.planning/config.json`.
        - If `vtp_enrichment.enabled === true`, the planner MUST NOT be
          dispatched until one of these is true:
            1. `{phaseDir}/{phaseNum}-VTP-ENRICHMENT.md` exists; or
            2. `.planning/metrics/vtp-health.jsonl` has a current-phase
               `gate_skipped` / `vtp_degraded` row; or
            3. the operator explicitly says to bypass VTP for this phase.
        - If (1) is false and (2)/(3) are false, dispatch
          `sgsd-vtp-enrichment` now before planner. This applies even when
          RESEARCH.md already existed before this SGSD session or the operator
          asked for a fresh planner after rejecting prior drafts.
        - Add a `<required_reading>` block to the planner prompt containing:
            * CONTEXT.md
            * RESEARCH.md
            * `{phaseNum}-VTP-ENRICHMENT.md` when present
            * REQUIREMENTS.md / CLAUDE.md as usual
        - If VTP was degraded or bypassed, include a literal planner prompt line:
          `VTP_STATUS: unavailable_or_bypassed; reason=<closed reason>; do not
          invent VTP findings.`
        - The planner's Source Audit must include VTP as a source row when a
          VTP artifact exists, or a VTP_STATUS row when it does not.
        - The planner itself must enrich the plan set with VTP/private-KB
          context: read the VTP artifact and, when MCP tools are exposed to
          the planner, call at least one `mcp__vtp-kb__*` tool for
          prior-memory/project/book/architecture uncertainty. If no call is
          possible, it must write a DEVIATION in its report and in the plan
          source audit; silent omission is not allowed.
     d. Phase has plans, needs plan-check → dispatch Codex plan-check
        PLAN-CHECK PREFLIGHT:
        - If `vtp_enrichment.enabled === true`, the checker must verify the
          current phase has either `{phaseNum}-VTP-ENRICHMENT.md` or a current
          degraded/bypass reason. If neither exists, return NOGO with blocker
          `vtp_enrichment_missing_before_planning`.
        - If the artifact exists, verify the plans reference it in their source
          audit or read-list. Missing VTP evidence in every plan is NOGO.
     d.1 PLAN FINALIZATION GATE (Codex ATC + MUDA before execution)
        Precondition: plan-check returned GO.
        Before committing plans or dispatching any executor wave, run a final
        Codex review over the plan set:
        - Build a prompt containing CONTEXT.md, RESEARCH.md, VTP artifact or
          VTP_STATUS, all PLAN.md files, and the plan-check result.
        - Ask Codex GPT-5.5/xhigh to apply:
            * ATC 7-step review to the plan set as the execution contract.
            * MUDA waste review: transport, inventory, motion, waiting,
              over-processing, overproduction, defects.
            * Final-draft check: whether the plans should be edited before any
              Codex executor touches source code.
        - Invoke `super-gsd/scripts/codex-exec.sh` with:
          `--step plan-final-review --timeout-tier analysis --phase {N}
           --plan plan-set --project {PROJECT_DIR}`
          and write `{phaseDir}/{phaseNum}-PLAN-CODEX-FINAL-REVIEW.md`.
        - PASS: commit the plans and proceed to Step 6.e.
        - WARN/FAIL/CRITICAL: dispatch Codex planner again, pass the Codex
          review inline, and require a revised final draft before execution.
          Max two revision loops, then checkpoint for operator attention.
     d.5 Before the FIRST executor dispatch of a phase, run phase readiness re-probe:
        FIRST: TaskCreate({
          content: "Re-probe phase readiness for phase {N}",
          activeForm: "codex-readiness [gpt-5.5/xhigh] checking drift before executor",
          status: "in_progress"
        })
        THEN: run Codex/local phase readiness re-probe for `{milestone}` phase `{N}`.
          Update `.planning/milestones/{milestone}/MILESTONE-READINESS.md`
          or append DRIFT evidence to `.planning/metrics/readiness-log.jsonl`.
        AFTER: TaskUpdate(same taskId, status: "completed")

        If MANIFEST_MISSING: re-run Rule 0 milestone readiness immediately.
        If DRIFT and there is a deterministic local/degraded path: log drift and continue.
        If DRIFT leaves no runnable executor path: checkpoint and stop as a real
        blocker/runtime-cannot-continue condition. This is not a context halt.

     d.6 CONSULT DISPATCH-ROUTER BEFORE AGENT INVOCATION (Phase 47, ROUTE-01..05)
        -- Phase 47 dispatch-router consultation. Why: route work to the cheapest competent
        executor. Bindings: A1 deterministic_extraction -> local-script; A2 bounded_code_review
        -> codex when healthy; A3 synthesis_judgment -> claude; A4 VTP only for the 3-entry
        whitelist {architecture_challenge, prior_memory_lookup, book_lookup}; A5 every fallback
        emits a closed-vocab reason via existing route-ledger; A6 structural predicates
        override semantic input (LOCK 11); A7 context_pressure biases away from claude
        under budget overrun (KAIROS).

        When to use: BEFORE every Agent() dispatch in steps 6.b through 6.h
        (research / planning / execution / verification / review). The router decides
        which executor handles the dispatch and the orchestrator emits a single envelope
        row to route-decisions.jsonl with boundary='dispatch_route'.

        Build the route input (closed-enum vocabulary; no semantic-similarity field):
        ```javascript
        const routeInput = {
          task_kind: <derived from dispatch class; one of TASK_KINDS>,         // extraction|inventory|review|critique|synthesis|planning|verification|lookup|general
          uncertainty_type: <derived from dispatch class; one of UNCERTAINTY_TYPES>,  // deterministic_extraction|bounded_code_review|synthesis_judgment|architecture_challenge|prior_memory_lookup|book_lookup
          file_count: <count of files the dispatch will touch (best-known estimate)>,
          line_count: <estimated diff/output lines>,
          role: <orchestrator-set role; one of ROLES (Phase 41)>,              // researcher|planner|executor|verifier|reviewer|orchestrator|classifier|other
          current_role_token_spend: <running spend for that role; from Phase 41 spend ledger or session accumulator>,
          gate_name: <when task_kind='review' AND a gate is implicated>
        };
        ```

        Consult the router:
        ```javascript
        const router = require('super-gsd/tools/dispatch-router/route.cjs');
        const decision = router.routeDispatch(routeInput);
        ```

        If decision.provider === null (fallback_chain_exhausted): orchestrator degrades to
        claude and proceeds (47-RESEARCH.md sec.7 LOCKED -- "Caller treats null as 'use
        default.'" we ARE claude). Otherwise the orchestrator uses decision.provider as the
        routing hint for Agent() dispatch (e.g., model selection, sub-agent identity, or
        local-script fallthrough).

        AFTER routeDispatch returns (provider===null OR not), orchestrator emits ONE envelope
        row via the EXISTING Phase 32 route-ledger (no new ledger; Phase 47 only added the
        'dispatch_route' value to the closed-enum BOUNDARIES set):
        ```javascript
        const rl = require('super-gsd/scripts/lib/route-ledger.cjs');
        const status = decision.provider === null ? 'fail'
                     : decision.fallback_used ? 'warn'
                     : decision.context_pressure?.over_warn ? 'warn'
                     : 'ok';
        const reasonCodes = [decision.reason];
        if (decision.fallback_reason && decision.fallback_reason !== decision.reason) {
          reasonCodes.push(decision.fallback_reason);
        }
        if (decision.context_pressure?.over_warn) {
          reasonCodes.push('context_pressure_high');
        }
        rl.logRouteDecision(planningDir, {
          boundary: 'dispatch_route',
          status,
          phase: <currentPhase>,
          milestone: <currentMilestone>,
          reason_codes: reasonCodes,
          artifacts: [],
          evidence: [],
          decision: {
            task_kind: routeInput.task_kind,
            uncertainty_type: routeInput.uncertainty_type,
            primary_provider: decision.primary_provider,
            chosen_provider: decision.provider,
            fallback_chain: decision.fallback_chain,
            fallback_used: decision.fallback_used,
            fallback_reason: decision.fallback_reason,
            structural_signals: decision.structural_signals,
            context_pressure: decision.context_pressure,
            health: decision.health,
            hints_consumed: decision.hints_consumed
          }
        });
        ```

        Lock 13 reminder: routeDispatch never throws upward. On internal error it returns
        the safe-default {provider:'claude', primary_provider:null, reason:'router_internal_error',
        fallback_used:true, ...}. The orchestrator MUST NOT block on routeDispatch -- continue
        with claude and emit the envelope row with status='warn' so the failure is visible
        in cockpit/BENCH.

        A4 reminder: VTP gating is encoded in ROUTING_TABLE structure. The router enforces
        VTP_WHITELIST = {architecture_challenge, prior_memory_lookup, book_lookup} mechanically.
        NEVER add a manual "but if VTP feels relevant, override the router" branch in this
        skill. The orchestrator trusts decision.provider verbatim (modulo null -> claude
        fallback).

     d.7 SELECTIVE VTP BRIDGE CALL (Phase 48, VTPR-01..06)
        -- Phase 48 selective bridge consumer composition. Why: when Phase 47 routeDispatch
        returns {provider:'vtp', uncertainty_type, ...}, the orchestrator calls the bridge
        BEFORE Agent dispatch to fetch a compact source-backed evidence_packet from one
        mcp__vtp-kb__* tool. The packet is then passed into the Phase 45 context-packet
        builder via the EXISTING reserved opts slot (build.cjs:707-708) -- Phase 45 source
        REMAINS UNTOUCHED; the wire is caller-side composition.

        Bindings: A1 local-implementation phases never call VTP (whitelist gate at Gate 2
        of selectiveVTPCall); A2 research/book/prior-project/architecture-challenge can
        call VTP via 4-entry frozen VTP_TOOL_MAP (3 active + 1 reserved); A3 MCP failures
        appended to .planning/metrics/vtp-bridge-failures.jsonl and NEVER injected into
        evidence_packet.results[]; A4 packets are source-backed (mandatory source_refs +
        root_source_hashes per PACKET-13 mirror) AND compact (5000-token cap with
        descending-relevance elision); A5/LOCK-11 routing gated ONLY by uncertainty_type
        (no embedding/similarity_score/fuzzy_match/cosine accepted).

        When to use: AFTER Step d.6 routeDispatch returns AND BEFORE the Agent() dispatch
        call in steps 6.b through 6.h, ONLY when decision.provider === 'vtp'. For all
        other providers (claude / codex / local-script) skip this step.

        Call the bridge:
        ```javascript
        const route  = require('super-gsd/tools/dispatch-router/route.cjs');
        const bridge = require('super-gsd/tools/vtp-bridge/classify.cjs');

        const decision = route.routeDispatch(routeInput);   // Step d.6

        let vtp_evidence_packet = null;
        if (decision.provider === 'vtp') {
          vtp_evidence_packet = bridge.selectiveVTPCall({
            uncertainty_type: routeInput.uncertainty_type,
            query: <canonical intent or dispatch query string>,
            planningDir: planningDir,
            phase: <currentPhase>,
            milestone: <currentMilestone>,
          });
          // Lock 13: bridge NEVER throws upward. Always returns a packet object.
          // The bridge ALREADY appended one row to route-decisions.jsonl
          // (boundary='vtp_bridge') and (on failure) one row to
          // .planning/metrics/vtp-bridge-failures.jsonl. No additional logging
          // required from the orchestrator at this step.
        }
        ```

        Pass the result into the Phase 45 context-packet builder via the EXISTING reserved
        opts slot (super-gsd/tools/context-packet/build.cjs:707-708; Phase 45 source remains
        UNTOUCHED -- this is caller-side composition):
        ```javascript
        const cp = require('super-gsd/tools/context-packet/build.cjs');
        const packet = cp.buildPacket(role, intent_ref, {
          planningDir: planningDir,
          route_hint: { use_vtp: !!(vtp_evidence_packet && vtp_evidence_packet.ok) },
          _vtp_packets: (vtp_evidence_packet && vtp_evidence_packet.ok) ? [vtp_evidence_packet] : [],
        });
        ```

        FAILURE PATH (A3 binding). When vtp_evidence_packet.ok === false the orchestrator
        MUST NOT inject the failure into the Agent prompt as if it were research evidence.
        Instead:
        - Pass `_vtp_packets: []` (empty array) into the context-packet builder.
        - Surface vtp_evidence_packet.error_logged_at in the dispatch summary line of the
          Agent prompt as a status note: `"VTP bridge attempted (uncertainty_type=X);
          failed; see {error_logged_at}"`. The Agent treats this as a bridge-status note,
          NOT a research conclusion.
        - The bridge has already written one row to vtp-bridge-failures.jsonl (with
          {tool, error_type in FAILURE_KINDS, error_message, retry_at}) and one row to
          route-decisions.jsonl (boundary='vtp_bridge', status='fail'|'timeout'). The
          orchestrator does NOT duplicate this logging.

        WHITELIST behavior. When decision.provider !== 'vtp' the orchestrator does NOT call
        the bridge. Phase 47 has already gated the route. Defense-in-depth: if the bridge
        is accidentally invoked with a non-whitelist uncertainty_type it returns
        {ok:false, reason_codes:['not_routed_to_vtp']} with NO MCP call and NO failure-log
        row (refused != failure). selectiveVTPCall imports route.VTP_WHITELIST BY REFERENCE
        (no copy; identity-checked in the bridge self-test assertion 11).

        COEXISTENCE with sgsd-vtp-enrichment (Step 6.b.5). The two are distinct and both
        ship in v1.9:
        - Step 6.b.5 (sgsd-vtp-enrichment): per-PHASE enrichment between researcher and
          planner. Runs the 5-tool VTP cascade for broad enrichment of RESEARCH.md.
        - Step d.7 (Phase 48 bridge -- selectiveVTPCall): per-DISPATCH selective single-shot
          call. Fires on routeDispatch decision, returns one evidence_packet for the
          context-packet builder.
        Both call into the same MCP tool family; both coexist; Phase 48 does NOT replace
        the enrichment agent.

        FORWARD CONTRACTS (shape only -- no require() of unwritten code):
        - Phase 49 governance (GOV-04..GOV-08) reads vtp-bridge-failures.jsonl + the
          route-decisions.jsonl rows where boundary='vtp_bridge', and may promote recurring
          successful packets to validated_thoughts and demote tools whose failure rate
          exceeds threshold. Phase 48 ships the data; Phase 49 owns the promotion logic.
        - Phase 50 cockpit (COCKPIT-04) reads the tail of both streams for the source-mix
          display.
        - Phase 51 BENCH (BENCH-05..BENCH-07) reuses the Phase 48 self-test fixtures
          (vtp_unavailable, mcp_timeout, bad_provenance, compactness) for the
          utility-per-token measurement.

     e. Phase has checked plans, pending tasks → run PLAN LOAD-TIME VALIDATION (Step 6.2) then dispatch per MACH-02 wave plan:

        // Require dispatch-planner at orchestrator startup (zero runtime deps)
        const dispatchPlanner = require('super-gsd/scripts/lib/dispatch-planner.cjs');

        const waves = dispatchPlanner.buildDispatchPlan(plan);

        // CODEX EXECUTOR HARD LOCK.
        // The operator's SGSD runtime is Codex-executor locked: Claude
        // orchestrates only. Flatten every executor wave and run it serially
        // through codex-executor.sh. Do not consult executor_provider for an
        // opt-out and do not use the Claude executor agent as fallback.
        For each task id in waves, in DAG order:

        1. Locate the exact pending plan file for that task id.
           Example task id `153-04` resolves to:
           `.planning/phases/153-gate-engine-runtime/153-04-PLAN.md`

        2. Derive paths mechanically:
           - phaseDir = directory containing the plan file
           - planId = plan filename without `-PLAN.md`
           - promptPath = `{phaseDir}/{planId}-CODEX-EXECUTOR-PROMPT.md`
           - reportPath = `{phaseDir}/{planId}-CODEX-EXECUTOR-REPORT.md`
           - filesPath = `{phaseDir}/{planId}-CODEX-FILES.txt`
           - specReviewPath = `{phaseDir}/{planId}-SPEC-REVIEW.md`

        3. TaskCreate:
           activeForm: `codex-executor [gpt-5.5/xhigh] P{phase}.{planId} - executing code plan`

        4. Write `promptPath` with the same compact executor prompt that would
           previously have gone to the executor agent: plan objective,
           files_touched, tasks, acceptance commands, constraints, relevant
           context-packet summary, and report contract. Add the SDD implementer
           contract: fresh Codex context, this task only, verify before report,
           self-review, and explicit DONE/DONE_WITH_CONCERNS/BLOCKED status.

        4.5. Write `filesPath` with one repository-relative path per line for
           every existing or intended file the task may touch. Derive it from
           plan frontmatter `files_touched`, task text, and the file-collision
           DAG. This is used only if direct Codex hits a Windows host read
           failure; it is not permission to touch unrelated files.

        5. Bash:
           ```bash
           bash super-gsd/scripts/codex-executor.sh \
             --prompt-file "{promptPath}" \
             --report-out  "{reportPath}" \
             --workspace   "$(pwd)" \
             --phase       "{phase_number}" \
             --plan        "{planId}" \
             --patch-fallback-files "{filesPath}"
           ```

        6. Read `reportPath`.

        7. Continue with the existing Step 9, Step 9.4, and Step 9.5 pipeline
           for this report: process executor output, enforce commit discipline,
           run spec-compliance review on raw PLAN/diff/report/verification
           artifacts, run per-dispatch ATC on Codex's diff after spec PASS, log
           gates, then advance state.
           If codex-executor exits 8 or logs a Windows read-block, run
           `codex-patch-executor.sh` with `filesPath` if the wrapper has not
           already done so. If any other non-zero exit remains, run the Blocker
           Recovery Hard Loop. Never fall back to a Claude executor.

        8. TaskUpdate completed after Step 9, Step 9.4, and Step 9.5 finish.

        NOTE — spike verdict: 12-02-00 observed PARALLEL_CONFIRMED. The parallel branch is a
        live execution path for Claude-agent execution only. In this SGSD install, executor
        waves are intentionally flattened because Codex CLI sessions need exclusive workspace
        write access. The DAG ordering remains advisory and prevents file-conflict bugs under
        serial execution.
     f. All plans executed → dispatch Codex verifier
     g. Verification passed → PHASE ATC GATE (Step 6.5) → FRONTEND VERIFY GATE (Step 6.6) → mark complete
     h. Verification failed → dispatch Codex planner --gaps (GPT-5.5 / xhigh)

  <!-- ANCHOR: RULE-8.5 — schema-fix dispatch branch -->
  6.2. PLAN LOAD-TIME VALIDATION (Rule 8.5 — schema-fix dispatch)
     Triggers at dispatch rule 6.e, BEFORE running Codex executor. Re-validates each
     pending PLAN.md against plan-schema-v2.json at load time (D-07 load-time enforcement).

     FOR EACH pending {NN}-{PP}-PLAN.md to be dispatched this iteration:

     a. Run validate.cjs:
        ```bash
        node super-gsd/tools/plan-schema/validate.cjs \
          --plan-file {plan_file_path} \
          --project-dir {project_dir} \
          --mode load
        ```
        Exit 0 → VALID: proceed to Codex executor dispatch normally.
        Exit 2 → BLOCKED (file not found, parse error): run the Blocker
        Recovery Hard Loop. If the board plus Codex cannot reconstruct a safe
        local plan path, then checkpoint as operator-only.
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
                       activeForm: "codex-plan [gpt-5.5/xhigh] --fix-schema attempt {schema_fix_attempt}/3",
                       status: "in_progress" })
          Run `super-gsd/scripts/codex-exec.sh` with step `schema-fix-plan`
          and prompt payload:
            {
              flag: "--fix-schema",
              plan_file_path: {plan_file_path},
              error_envelope: {error_envelope},  // inline JSON, not a path
              schema_path: "super-gsd/templates/plan-schema-v2.json",
              locked_fields: {locked_fields},
              attempt_K: {schema_fix_attempt}
            }
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
     // Phase 36 wire-in (locked 36=B per 36-RESEARCH.md sec 2): single-call
     // gates.shouldFire(...) hoisted to a `phaseAtcFired` const so both the
     // SKIP and FIRE arms reference the same evaluation; then write a
     // gate-value-log row on whichever arm runs (skip/pass/warn/block).
     // Phase 38 wire-in (SAMPLE-03 site 1 of 3): apply 3x3 sampling
     // matrix AFTER gates.shouldFire returns true; --force-gates /
     // --skip-gates take precedence (parsed at cold_start step 3.65).
     const phaseAtcSampled = samplingDecider.shouldSample({
       gate: 'phase-level-ATC',
       work_risk: classifier_result.work_risk,
       gates,
       gatesYamlPath: GATES_YAML_PATH,
       overrides: cliOverrides,
     });
     const phaseAtcFired = config.atc.enabled
       && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
       && verification.status == "passed"
       && phaseAtcSampled;

     if (!phaseAtcFired) {
       try {
         // Phase 38 LOCKED Q13: differentiate trigger-skip from sampled-skip
         // for Phase 39 rubric consumer. reason_codes is extensible per
         // gate-value-log.cjs Q14 lock.
         const triggerFired = config.atc.enabled
           && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
           && verification.status == "passed";
         const reasonCodes = (triggerFired && !phaseAtcSampled)
           ? ['gate_skip_with_reason', 'gate_sampled_skip']
           : ['gate_skip_with_reason'];
         require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
           .logGateValue(path.join(process.cwd(), '.planning'), {
             gate:        'phase-level-ATC',
             outcome:     'skip',
             phase:       currentPhase,
             milestone:   currentMilestone,
             reason_codes: reasonCodes,
             retroactive: gates.getGate('phase-level-ATC', GATES_YAML_PATH),
           });
       } catch (e) {
         console.warn('[SGSD] gate-value-log phase-level-ATC skip-arm failed (continuing):', e && e.message);
       }
     }

     if (phaseAtcFired) {

       a. Collect phase stats:
          - git diff --stat {first_commit_of_phase}..HEAD
          - Total files changed, lines added, lines removed
          - List of all plans completed (from phase directory)

       b. Classify phase tier via frontmatter/cache or Codex/local classifier:
          Inputs: phase={N}, plans={count}, total_files={N},
          total_lines={N}, goal='{phase goal}'. Return tier: lite|full|gate.
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

          // CXOPS-02: validateContract — secondary parse guard for Codex shell dispatch.
          // Defined once here (Step 6.5), reused at Step 9.5. Checks all 5 required
          // field prefixes on dedicated lines so malformed Codex output (exit 0 but
          // missing fields) triggers a single-retry fallback before propagating.
          // CXOPS-02 validateContract — D-05 #7: value regex guards added.
          // Malformed values treated same as missing fields (push to missing array).
          // FINDINGS_DETAIL lines (D-05 #4) are optional and additive — not in required[].
          function validateContract(content) {
            if (typeof content !== 'string') return { valid: false, missing: ['(content not a string)'] };
            const required = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:', 'PASS_RATE:', 'ONE_LINER:'];
            const lines = content.split('\n');
            const missing = required.filter(field => !lines.some(line => line.startsWith(field)));

            // D-05 #7: value regex guards — malformed values treated same as missing fields
            const getValue = (prefix) => {
              const line = lines.find(l => l.startsWith(prefix));
              return line ? line.slice(prefix.length).trim() : null;
            };
            const intFields = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:'];
            for (const f of intFields) {
              const v = getValue(f);
              if (v !== null && !/^\d+$/.test(v)) missing.push(f + '(non-integer value: ' + v + ')');
            }
            const passRate = getValue('PASS_RATE:');
            if (passRate !== null && !/^\d+\/\d+$/.test(passRate)) {
              missing.push('PASS_RATE:(invalid format: ' + passRate + ')');
            }

            return { valid: missing.length === 0, missing };
          }

          // CONTRACT-02 (v1.5 Phase 24): parseFindingsDetail — extracts FINDINGS_DETAIL lines from
          // reviewer output into a structured array. Pairs with validateContract above. Missing
          // FINDINGS_DETAIL is valid (optional contract). Malformed lines are logged + skipped,
          // not treated as a contract violation. Result attached as report._findings_detail.
          // Vocabulary:
          //   severity: CRITICAL | WARNING | INFO
          //   dimension: naming | logic | security | performance | style | architecture
          function parseFindingsDetail(content) {
            if (typeof content !== 'string') return [];
            const out = [];
            const re = /^FINDINGS_DETAIL:\s*\[(CRITICAL|WARNING|INFO)\]\s*\[(naming|logic|security|performance|style|architecture)\]\s*(.+)$/i;
            for (const line of content.split('\n')) {
              if (!line.startsWith('FINDINGS_DETAIL')) continue;
              const m = line.match(re);
              if (m) {
                out.push({
                  severity:    m[1].toUpperCase(),
                  dimension:   m[2].toLowerCase(),
                  description: m[3].trim()
                });
              } else {
                logInfo('CONTRACT_DETAIL_MALFORMED: skipping line: ' + line.slice(0, 120));
              }
            }
            return out;
          }

          // CONTRACT-01 (v1.5 Phase 24): FINDINGS_DETAIL optional footer — append to composedPrompt before dispatch.
          // Instructs the reviewer to emit per-finding detail tuples after the 5 required lines.
          // Strengthened wording per operator feedback ("specifics, not interpretations" — Phase 20 R3 context).
          composedPrompt += "\n\nAfter the 5 required contract lines, you SHOULD emit one FINDINGS_DETAIL line for every CRITICAL and WARNING finding — operator needs specifics, not interpretations:\n" +
            "  FINDINGS_DETAIL: [severity] [dimension] <description>\n" +
            "  severity: CRITICAL | WARNING | INFO\n" +
            "  dimension: naming | logic | security | performance | style | architecture\n" +
            "  description: 1-2 sentences, prefer file:line references when applicable\n" +
            "Example: FINDINGS_DETAIL: [WARNING] [logic] Missing null check before array access at sgsd-stop-handoff.sh:142\n" +
            "These lines are optional but strongly preferred. The orchestrator renders them in ATC-REVIEW.md if present.";

          const provider = gates.resolveReviewerProvider('phase-level-ATC', gatesRegistry, { gatesYamlPath: GATES_YAML_PATH });
          const effective = (provider && provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
            ? gates.getProvider(provider.fallback_to)
            : provider;

          let report;
          if (!effective) {
            // No reviewer_provider declared on gate — skip dispatch, log info
            logInfo('GATE_NO_PROVIDER: phase-level-ATC has no reviewer_provider; skipping review dispatch');
          } else if (effective.invocation === 'agent') {
            throw new Error('STALE_AGENT_PROVIDER_DISABLED: phase ATC must use Codex/local provider');
          } else if (effective.invocation === 'shell') {
            // Shell dispatch: codex-exec.sh
            const promptFile = writeTempPrompt(composedPrompt);
            const reportOut = tempReportPath('phase-atc');
            const dispatchResult = shellDispatch(effective.shell_script, {
              promptFile,
              timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
              reportOut,
              phase: currentPhase,
              step: '6.5',
              timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
              retryOnTimeoutEscalate: true,  // D-05 #5: auto-escalate once to analysis on timeout
            });
            if (dispatchResult.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
              // Fresh-clone SGSD does not fall back to Claude/Sonnet. Route
              // through the Blocker Recovery Hard Loop or an explicit operator
              // configured non-Claude provider.
              const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
                ? 'codex_timeout'
                : (dispatchResult.exit === 4 ? 'codex_auth_missing' : 'codex_provider_error');
              // Do not write "Codex unavailable" for timeout. Auth/availability and
              // tier-budget exhaustion are different facts; summaries must preserve
              // that distinction.
              logDeviation(`GATE_PROVIDER_NO_CLAUDE_FALLBACK: ${effective.name} ${providerFailureReason} exit=${dispatchResult.exit}`);
              runBlockerRecoveryHardLoop({ reason: providerFailureReason, step: '6.5' });
            } else if (dispatchResult.exit !== 0) {
              // Both providers failed — hard blocker per CONTEXT D-02c
              logDeviation('GATE_PROVIDER_DOUBLE_FAIL: both codex-cli-reviewer and fallback failed');
              writeCheckpoint({ reason: 'GATE_PROVIDER_DOUBLE_FAIL', step: '6.5' });
              throw new Error('GATE_PROVIDER_DOUBLE_FAIL: review gate failed on both providers');
            } else {
              // CXOPS-02: secondary contract check — codex exited 0 but report may be malformed.
              const validation = validateContract(dispatchResult.report);
              if (!validation.valid) {
                logDeviation(`GATE_PROVIDER_CONTRACT_INVALID: openai-codex exit=0 but contract invalid — missing: ${validation.missing.join(', ')}`);
                runBlockerRecoveryHardLoop({ reason: 'parse_failure', step: '6.5' });
              } else {
                report = {
                  content: dispatchResult.report,
                  _provider: 'openai-codex',
                  _model: dispatchResult.model || config.review_providers.codex_model || 'gpt-5.5',
                  _reasoning_effort: dispatchResult.reasoning_effort || config.review_providers.codex_reasoning_effort || 'xhigh'
                };
              }
            }
          }
          // Evidence emission: path-identical to prior Claude path per CONTEXT D-03
          // commit-reviews.jsonl gains provider: field; ATC-REVIEW.md gains provider: frontmatter key
          if (report) appendReviewEvidence(report, {
            gate: 'phase-level-ATC',
            provider: report._provider || effective.name,
            fallback_triggered: !!(report._provider === 'claude-via-fallback'),
            ...(report._model ? { model: report._model } : {}),
            ...(report._reasoning_effort ? { reasoning_effort: report._reasoning_effort } : {}),
            ...(report._fallback_reason ? { fallback_reason: report._fallback_reason } : {})
          });
          → Returns: { findings, critical_count, warning_count, verdict }

          // Phase 36 wire-in (locked 36=B per 36-RESEARCH.md sec 2):
          // gate-value-log FIRE arm. The verdict + critical_count are produced
          // by the dispatch immediately above; outcomeFromVerdict maps them
          // into the closed OUTCOMES enum (pass/warn/block/skip). Wrapped in
          // try/catch -- never throws upward.
          try {
            const gateValueLog = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'));
            const reportPath = (typeof phaseAtcReportPath === 'function') ? phaseAtcReportPath() : null;
            gateValueLog.logGateValue(path.join(process.cwd(), '.planning'), {
              gate:        'phase-level-ATC',
              outcome:     gateValueLog.outcomeFromVerdict(report && report.verdict, report && report.critical_count, report && report.warning_count),
              phase:       currentPhase,
              milestone:   currentMilestone,
              evidence:    reportPath ? [{ kind: 'review_report', ref: reportPath }] : [],
              retroactive: gates.getGate('phase-level-ATC', GATES_YAML_PATH),
            });
          } catch (e) {
            console.warn('[SGSD] gate-value-log phase-level-ATC fire-arm failed (continuing):', e && e.message);
          }

       d. Process ATC result:
          - Attach `report._findings_detail = parseFindingsDetail(report.content || '')`
            (CONTRACT-02 v1.5 Phase 24) so downstream consumers see structured tuples.
          - Write to .planning/phases/{NN}-*/{NN}-ATC-REVIEW.md
          - CONTRACT-03 (v1.5 Phase 24) render: if `report._findings_detail` is non-empty,
            include a dedicated section under heading `## Findings Detail` with one bullet
            per tuple in the form `- **[severity]** [dimension] — description`. Sort by
            severity (CRITICAL first, then WARNING, then INFO). If empty, omit the section
            entirely (no empty heading) so artifacts stay clean for clean reviews.
          - If critical_count > 0 AND NOT auto mode: STOP, emit blocker
          - If critical_count > 0 AND auto mode: log GATE_AUTO_HALT,
            write {NN}-ATC-GAP-PLAN.md, append an expiring DEVIATIONS entry,
            and do not mark phase complete until the gap-plan is resolved
          - If verdict == "pass": log, continue
          - If tier == "gate": suggest /sgsd-deliberate for next phase

       e. TaskUpdate(taskId, status: "completed")

       f. Proceed to Step 6.55 (MUDA waste audit) — do NOT mark phase complete yet.

     Token budget per phase ATC: ~600 tokens (50 classify + 550 review)
     Runs ONCE per phase, not per commit — keeps token cost bounded.
     } // end if (phaseAtcFired)

  6.55. MUDA WASTE AUDIT ROUTE ELIGIBILITY (no execution) - per DLB-02
     `super-gsd/registry/gates.yaml` remains the owner of
     `MUDA-waste-audit` eligibility. `super-gsd/registry/skill-routing.yaml`
     remains the owner of the phase-close route's moment, modes, cooldown,
     dispatch, and exit policy. The phase-close routing consult evaluates the
     named gate trigger itself from `--files-changed`, `--diff-lines`, and
     `--phase-type`; no separate gate-value producer is required. Do not copy
     the gate thresholds into this skill.

     Do NOT invoke the MUDA script in Step 6.55. The phase-close routing consult
     in Step 6.6.i is the SINGLE execution point. It consumes the named
     `gate_ref`, renders the registered dispatch, runs it once when fired, and
     appends the gate-value outcome plus scheduling and execution evidence rows.

     MUDA exits 1 and 2 are verdict findings, not process failures. The later
     consult records them as `executed_with_findings`, appends gate outcome
     `warn` (never `block`), and continues phase close. Only `execution_failed`
     requires repair before the phase can be marked complete.

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

       i.X. PHASE CAPSULE WRITE (Phase 43 -- CAP-01..05; Lock 5 forward-coverage)

            Write the phase capsule projection BEFORE marking phase complete.
            Per RESEARCH sec 9.3: Phase 45 PACKET-03 will read this capsule
            during the NEXT phase's dispatch; if write is deferred to
            milestone-close, the first phase of the next milestone has no
            capsule for the prior phase.

            Per design lock 13 (REQUIREMENTS.md:67-68): capsule write
            failure NEVER halts phase advance. writeCapsule wraps internals
            in try/catch and returns { ok:false, reason:<msg> } on failure;
            the orchestrator logs the result and continues to step 6.6.i
            unconditionally.

            ```javascript
            // Phase 43 wire-in: anchor planningDir to process.cwd() at the
            // orchestrator-skill boundary (mirrors Step 4.5/4.6/4.7 lessons:
            // Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 41 sec 7.1
            // -- NEVER bare relative '.planning').
            const path = require('path');
            const { writeCapsule } = require(
              path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
            );
            const planningDir = path.join(process.cwd(), '.planning');
            const result = writeCapsule(planningDir, {
              milestone: '{{version}}',
              phase: '{{phase}}',
              phaseDir: '{{phase_dir}}',
            });
            // result: { ok:true, path: '.../PHASE-CAPSULE.json', content_hash: '...' }
            //      or { ok:false, reason: '...' } -- NEVER throws.
            // On failure: writeCapsule already appended a row to
            // .planning/metrics/context-complaints.jsonl with reason_code
            // from the <reason_codes> vocabulary. Orchestrator continues
            // to 6.6.i unconditionally.
            ```

            HARD RULES for this gate -- no exceptions:

            R1. writeCapsule outcome NEVER blocks the Step 6.6.i consult.
                Lock 13 binds.
            R2. Capsule write failure surfaces in the next milestone-close's
                token-waste / phase-folder-audit narrative (Phase 49 reads
                context-complaints.jsonl); operator-discoverable but
                non-blocking.
            R3. Capsule shape is the API for Phase 45/46/49/51. Do NOT
                modify the capsule schema from this skill -- the writer
                lib owns it; this skill only INVOKES.
            R4. The wire-in MUST cite RESEARCH sec 9.3 and Lock 5 in the
                rendered markdown so future operators understand WHY this
                step is between 6.6.h and 6.6.i (not 6.7 milestone-close).

       i.Y. MEMORY GOVERNANCE COMPLAINT PROCESSING (Phase 49 -- GOV-01; LOCK 13;
            execution mechanics only)

            ROUTING POLICY (Phase 149): `super-gsd/registry/skill-routing.yaml`
            is the source of truth for memory-hygiene scheduling. Resolve the
            runtime phase-close decision with:
              `node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult --phase N`
            When that runtime decision fires the applicable route, invoke Phase
            49 processComplaints. It reads
            .planning/metrics/context-complaints.jsonl filtered by ts > cursor;
            classifies each row by reason_codes[]; dispatches deterministic
            repair (capsule rebuild scheduling, packet rebuild scheduling,
            thought demote/revoke). NEVER halts phase advance (Lock 13).

            Per design lock 13 (REQUIREMENTS.md:67-68): processComplaints
            wraps internals in try/catch and returns
            { repairs_attempted:N, repairs_succeeded:M, ledger_rows:[...] }
            on success or { ok:false, reason:'<...>_internal_error' } on
            internal error. Either way, the orchestrator continues to step
            6.6.i unconditionally. Per RESEARCH sec 7 (Phase 49 49-RESEARCH.md):
            cursor advances monotonically via .planning/metrics/memory-process-cursor.json,
            preventing repair-loops (Pitfall 6); max 50 repairs per invocation
            (defensive bound).

            ```javascript
            // Phase 49 wire-in: anchor planningDir to process.cwd() at the
            // orchestrator-skill boundary (mirrors Step 6.6.i.X capsule write
            // pattern at write.cjs require above).
            const path = require('path');
            const { processComplaints } = require(
              path.join(process.cwd(), 'super-gsd', 'tools', 'memory-governance', 'lifecycle.cjs')
            );
            const result = processComplaints({
              since_ts: undefined,    // undefined -> read from cursor file
              max_repairs: 50,        // defensive bound; matches Phase 49 default
            });
            // result: { repairs_attempted:N, repairs_succeeded:M, ledger_rows:[...] }
            //      or { ok:false, reason:'<...>_internal_error' } -- NEVER throws.
            // On failure: processComplaints already appended a row to
            // .planning/metrics/context-complaints.jsonl with
            // reason_code:'memory_process_complaints_internal_error'.
            // Orchestrator continues to 6.6.i unconditionally.
            ```

            HARD RULES for this gate -- no exceptions:

            G1. processComplaints outcome NEVER blocks the Step 6.6.i consult.
                Lock 13 binds.
            G2. Repair actions are SCHEDULED via .planning/metrics/repair-queue.jsonl
                envelope-v1 rows; the orchestrator picks up the queue on the
                NEXT phase loop iteration (or via explicit
                /gsd-process-repair-queue command). Phase 49 itself does NOT
                call Phase 45 buildPacket -- that's the orchestrator's job.
            G3. Cursor file (.planning/metrics/memory-process-cursor.json) is
                the single source of since_ts truth. Phase 49 reads on entry,
                writes on exit. Manual edits to the cursor are operator-discretion
                only; never touch it from the skill.
            G4. The wire-in MUST cite Phase 49 RESEARCH sec 7 + GOV-01 + Lock 13
                in the rendered markdown so future operators understand WHY
                this step is between 6.6.i.X and 6.6.i.

       i.0. ORCHESTRATOR-OWNED PHASE SUMMARY (P156 close contract)

            After verification, Phase ATC, frontend verification when applicable,
            and passing audit evidence are complete, the orchestrator authors
            `{phase-dir}/SUMMARY.md`. SUMMARY is a pre-close evidence artifact,
            never a retrospective artifact created after STATE advances.

            Its delimited YAML frontmatter has these seven required fields;
            additional fields are forward-compatible:

            ```yaml
            ---
            phase: "{{OPAQUE_PHASE_TOKEN}}"
            slug: {{PHASE_FOLDER_SLUG}}
            milestone: {{MILESTONE}}
            status: {{STATUS_BEGINNING_PASS_OR_ENDING_COMPLETE_COMPLETED_CLOSED}}
            closed: {{YYYY-MM-DD}}
            commits: [{{SEVEN_TO_FORTY_HEX_COMMIT}}, ...]
            gates: {verifier: "PASS", phase_atc: "PASS", audit: "PASS"}
            ---
            ```

            `commits` and `gates` must both be non-empty. Each gate verdict is a
            non-empty scalar. The phase, slug, and milestone must exactly identify
            the located phase folder. Do not enter the consult until AUDIT.md and
            this SUMMARY.md both exist.

       i. PHASE-CLOSE SKILL ROUTING CONSULT (Phase 149; single execution point)

            Before marking the phase complete or entering Step 6.7, run:

            ```bash
            node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult \
              --moment phase-close --mode auto --phase N \
              --files-changed FILES_CHANGED_COUNT --diff-lines DIFF_LINES \
              --phase-type PHASE_TYPE --work-risk WORK_RISK --execute
            ```

            Pass the loop's concrete file count, diff-line count, phase type,
            and classifier/scored `work_risk` whenever they are available. If
            any of the first three inputs are unavailable, omit that flag: the
            helper derives file/diff evidence from git using the phase directory's
            first commit (falling back to `HEAD~1`) and derives phase type from
            `PHASE-INDEX.jsonl` or plan frontmatter. If `--work-risk` is omitted,
            it is scored from the resolved context. Forward operator sampling
            overrides unchanged with `--force-gates` or `--skip-gates` plus the
            required `--override-reason`. Confirm the returned `gate_context`
            before continuing.

            Capture and inspect the stdout JSON before continuing. The helper
            consults `super-gsd/registry/skill-routing.yaml`, the routing source
            of truth. For EVERY `decision: fired` row, the loop MUST execute the
            full normalized dispatch exactly once. `--execute` performs those
            deterministic process dispatches mechanically and returns only after
            each attempt completes. The MUDA route retains
            `gate_ref: MUDA-waste-audit`; Step 6.55 never executes it directly.

            The helper appends the scheduling row (`fired|skipped`) and, for
            each fired row, a separate execution-outcome evidence row with
            `parent_decision: fired`, the concrete dispatch, integer `exit_code`,
            and explicit `exit_code_meaning`. Exit policy classification is:

            - `success_exits` -> `decision: executed`; continue.
            - `verdict_exits` -> `decision: executed_with_findings`; log the
              findings, append gate outcome `warn` when the dispatch is the
              registered gate producer, and continue. MUDA exits 1/2 and
              readiness exit 1 use this path; verdict exits never map to `block`.
            - Any other exit -> `decision: execution_failed`; surface stderr and
              the exit code, then complete the repair action before phase close.

            With `--moment phase-close --execute`, the production consult first
            validates AUDIT.md and SUMMARY.md through the P156 close contract.
            A returned `close_contract.ok: false` exits non-zero and schedules
            zero dispatches. Repair the named evidence reason before retrying;
            never proceed to state.write or a close commit after refusal.

            Confirm every fired JSON decision has both `dispatch` and `execution`,
            and that `execution_evidence_appended` equals `fired_count`. Missing
            outcome evidence is loud and must be surfaced, but phase-close
            blocking/repair-required classification is reserved for explicit
            `execution_failed`. Never treat the initial `fired` row as proof that
            the skill ran, and do not infer or schedule neglected skills from
            prose in this file.

       j. PHASE-CLOSE STATE PROJECTION (state.write owner)

          After the phase-close consult succeeds and before marking the phase
          complete or entering Step 6.7, invoke the exact event-envelope CLI:

          ```bash
          node super-gsd/tools/state-write/write.cjs --event-json '{"event":"phase-close","projectDir":".","milestone":"{{MILESTONE}}","evidence_phase":"{{PHASE}}","current_phase":"{{NEXT_PHASE_OR_COMPLETE}}","last_updated":"{{LAST_UPDATED}}","progress":{"total_phases":{{TOTAL_PHASES}},"completed_phases":{{COMPLETED_PHASES}},"completed_plans":{{COMPLETED_PLANS}},"status_row":{"phase":"{{PHASE}}","value":"{{PHASE_STATUS_ROW}}"}}}'
          ```

          Substitute JSON-escaped strings and concrete integer counts. Exit 1
          refuses phase close; exit 2 requires input/I/O repair. On exit 0, the
          STATE projection is advanced, but Step 6.7 remains blocked until the
          close commit in Step 6.6.k succeeds. `executed_with_findings` does not
          block completion; only `execution_failed` requires repair.

       k. PHASE-CLOSE COMMIT (SUMMARY + STATE atomic handover)

          Create the phase-close commit only after Step 6.6.j exits 0. The commit
          must include the orchestrator-authored phase `SUMMARY.md` and the
          `STATE.md` projection produced by state.write, together with any normal
          phase-close evidence intended for that commit. Confirm both files are
          in the commit. Only then mark the close sequence complete and enter
          Step 6.7. A failed or incomplete commit blocks Step 6.7.

  6.7. MILESTONE COMPLETE AUTO-TRIGGER (GOV-13 / D-18a)

       After Step 6.6.k commits SUMMARY.md plus STATE.md:

         a. Read `.planning/ROADMAP.md` in full. Milestone close is rare.
         b. Run `node super-gsd/scripts/lib/decision-state.cjs --render orchestrator --project "$PWD"` and extract the active milestone from its output.
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
              Then re-read ROADMAP.md and STATE.md. If a next milestone or next
              phase exists, advance and continue REPEAT with no operator prompt.
              Only emit "All phases done" when no remaining roadmap work exists
              after close/advance checks.

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
     - SGSD memory query results (relevant decisions, patterns, error rules)
     - Existing scripts to reuse (if found)
     - Efficiency rules header (80 tokens)
     - Surgical constraint header (see below, ~70 tokens) — MANDATORY for every executor dispatch
     - "Report format: FILES_CHANGED | VERIFICATION | DEVIATIONS | BLOCKERS | SCRIPTS_CREATED | ONE_LINER"
     DO NOT include: full ROADMAP, full STATE, full REQUIREMENTS

     SURGICAL CONSTRAINT (Karpathy principle) — inject verbatim into every
     codex-executor prompt:

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

  7.5. CONTEXT PACKET BUILD (Phase 45 -- Lock 4 + Lock 10 + Lock 13)
     // Step 7.5: CONTEXT PACKET BUILD -- intent-map -> context-packet -> dispatch
     // Replaces raw-context-inheritance with role-specific packet build.
     // Lock 10: operator command MUST flow through intent-map FIRST.
     // Lock 4:  packets are the only legal dispatch surface.
     // Lock 13: never throws; falsey sentinel triggers legacy fallback +
     //          DEVIATIONS log via context-complaints.jsonl.

     const path = require('path');
     const { compileIntentMap } = require(
       path.join(process.cwd(), 'super-gsd', 'tools', 'intent-map', 'build.cjs')
     );
     const { buildPacket } = require(
       path.join(process.cwd(), 'super-gsd', 'tools', 'context-packet', 'build.cjs')
     );
     const planningDir = path.join(process.cwd(), '.planning');

     try {
       const intent_map = compileIntentMap(rawTurnPrompt, {
         planningDir, milestone: ctx.milestone, phase: ctx.phase, mode: 'auto'
       });
       if (!intent_map || intent_map.ok === false) {
         // Legacy fallback: use Step 7 composed prompt as-is.
         // Falsey sentinel triggers DEVIATIONS row + context-complaints.jsonl.
         logDeviation('packet_build_fallback', 'intent_map compile returned falsey sentinel');
       } else {
         const packet = buildPacket(role, intent_map.intent_id, {
           planningDir, milestone: ctx.milestone, phase: ctx.phase,
           dependency_depth_cap: 2, mode: 'auto'
         });
         if (packet && packet.packet_body) {
           composedPrompt = packet.packet_body; // SUBSTITUTE for raw context.
         } else {
           logDeviation('packet_build_fallback', 'buildPacket returned falsey sentinel');
         }
       }
     } catch (e) {
       // Lock 13: never propagate. Fall back to Step 7 composed prompt.
       logDeviation('packet_build_exception', e.message);
     }

     ## Step 6.b.4 -- Build Context Packet via Bash hook (Phase 87-01 wire-in)

     Step 7.5 above is the in-orchestrator-turn require()-driven build path.
     For external automation (cron, smoke, hooks called from a non-Claude
     bash context), the same Phase 45 buildPacket() is exposed as a CLI:

     ```bash
     node super-gsd/scripts/lib/orchestrator-hooks.cjs --context-packet-build \
       --role "$AGENT_TYPE" \
       --phase "$PHASE" \
       --plan "$PLAN_ID" \
       --milestone "$MILESTONE" \
       --project-dir "$PROJECT_DIR"
     ```

     The hook spawns / require()s super-gsd/tools/context-packet/build.cjs per
     Phase 45 contract. On success, .planning/metrics/context-packet-log.jsonl
     mtime updates and the Phase 86 context_packet_builder_freshness probe
     (warp-doctor) returns PASS. On failure (Phase 45 absent, build sentinel),
     stdout returns {ok:false,error:...} and the orchestrator continues with
     the legacy raw-context path per Lock 13.

     Phase 87 ships this hook so the v2.6 close gate (sgsd-complete-milestone
     --milestone v2.6) can deterministically refresh the freshness probe via
     a single bash invocation when the orchestrator is not actively running.

  7.6. DOUBLE-AGENT EXECUTOR ROUTE (post-v2.1 token hardening)
     Purpose: before a normal Codex executor dispatch, decide whether the task
     should be handled by local-script, Codex, or Claude. This is the
     execution counterpart to Phase 47 routing. It uses task capsules and
     writes to the existing route-ledger boundary `execution_route`.

     When to use: BEFORE every Codex executor dispatch. Do not use it to replace
     planner/researcher/verifier judgment unless the task is explicitly a
     deterministic extraction, bounded code edit, schema/config edit, refactor,
     or test repair.

     Build a task capsule with:
     ```json
     {
       "schema_version": 1,
       "task_id": "vX-pNN-tMM",
       "milestone": "vX",
       "phase": NN,
       "plan": "NN-MM",
       "role": "executor",
       "task_kind": "code_edit|refactor|test_repair|schema_config|extraction|inventory|docs|general",
       "goal": "one sentence",
       "allowed_files": ["relative/path.ext"],
       "forbidden_files": [],
       "acceptance_commands": ["node path/to/self-test.cjs --self-test"],
       "risk": "low|medium|high",
       "ambiguity": "low|medium|high",
       "requires_private_knowledge": false,
       "estimated_line_count": 120,
       "max_input_tokens": 8000,
       "max_output_tokens": 2000
     }
     ```

     Route:
     ```bash
     node super-gsd/tools/double-agent-executor/run.cjs \
       --capsule .planning/tasks/{task_id}.json \
       --route-only --json
     ```

     Execution rule:
     - For code-mutating executor work, ignore any `chosen_provider` that is
       not Codex. This SGSD install is Codex-executor locked.
     - If the route suggests `local-script`, run it only when it is a fully
       deterministic non-LLM command path. Otherwise use Codex executor.
     - Run Codex through `super-gsd/scripts/codex-executor.sh` per the hard
       lock in Step 6.e. The pinned model is `gpt-5.5`; pinned effort is
       `xhigh`.
     - If Codex fails, times out, violates allowed files, or has no healthy
       provider, run the Blocker Recovery Hard Loop. Do not continue code
       execution with Claude.
     - If a route suggests Claude for the executor role, treat the route as
       stale and override to Codex.

     Hard rule: never give Codex or Claude executor full ROADMAP/STATE/
     milestone context by default. The capsule + context packet are the
     execution surface. Broad raw context is a DEVIATION and must be logged.

  8. DISPATCH SUB-AGENT (NON-EXECUTOR ROLES ONLY)
     Do not use this step for code-mutating executor work. Executor work is
     Step 6.e and runs by Bash through `codex-executor.sh`. If `agent_type`
     is `gsd-executor`, `sgsd-executor`, or any `sgsd-exec-*` code-writing
     role, stop and reroute to Step 6.e instead of calling Agent().

     FIRST: TaskCreate({
       content: "Phase {N}: {agent_type_short} — {one-line goal}",
       activeForm: "{agent_type} [{model}] P{N}.{plan} — {what it's doing}",
       status: "in_progress"
     })
     Example activeForm values:
       "codex-executor [gpt-5.5/xhigh] P87.1 — building auth middleware"
       "codex-plan [gpt-5.5/xhigh] P87 — creating task breakdown"
       "codex-verifier [gpt-5.5/xhigh] P87 — checking goal achievement"
       "codex-research [gpt-5.5/xhigh] P87 — investigating stack"

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
     - BLOCKERS → if any, run Blocker Recovery Hard Loop before any exit
     - SCRIPTS_CREATED → curate into SGSD script registry
     - ONE_LINER → use in commit message

     PROCESS RESULT — parse all 6 sections:
       FILES_CHANGED  → stage these exact paths for git (never git add -A)
       VERIFICATION   → if any item shows ✗: log warning, continue (don't EXIT)
       DEVIATIONS     → collect; "new pattern:" prefix triggers sgsd-curate
       BLOCKERS       → if non-empty and not "none": run Blocker Recovery Hard Loop
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

  9.4. SPEC COMPLIANCE REVIEW (SDD first reviewer stage)
      Runs AFTER the executor report lands and dispatch context is built,
      BEFORE per-dispatch ATC, state update, or commit. Fires after every Codex
      executor dispatch that changed files. This is the subagent-driven-
      development spec reviewer stage: it asks whether Codex implemented the
      PLAN exactly, not whether the implementation is elegant.

      Evidence artifact:

      ```text
      {phaseDir}/{planId}-SPEC-REVIEW.md
      ```

      Compose the spec review prompt for Codex GPT-5.5/xhigh with these raw
      inputs, in this order:

      1. The exact `{planId}-PLAN.md` text or compacted frontmatter/tasks.
      2. The executor prompt path and executor report path.
      3. `git diff -- {files_changed}` or the smallest raw diff that covers all
         changed files.
      4. Verification command output from the executor report and any local
         commands the orchestrator just ran.

      The reviewer must not treat the executor's own summary as proof. Summary
      lines can point to evidence, but PASS requires raw plan/diff/test
      alignment.

      Required report contract:

      ```text
      SPEC_VERDICT: pass|fix_required|blocked
      MISSING_REQUIREMENTS: none|<plan task ids / acceptance criteria not met>
      EXTRA_SCOPE: none|<unrequested changes or behavior>
      VERIFICATION_MAPPING: <which raw command/diff evidence proves each acceptance criterion>
      ONE_LINER: <short operator-readable summary>
      ```

      If `SPEC_VERDICT=pass`, continue to Step 9.5 ATC.

      If `SPEC_VERDICT=fix_required`, do not run ATC yet and do not commit.
      Dispatch a Codex fix pass using the original executor prompt plus the
      spec-review findings, then repeat Step 9.4 on the new diff/report.

      If `SPEC_VERDICT=blocked`, run the Blocker Recovery Hard Loop with
      reason `spec_compliance_blocked`.

      If no files changed but the plan expected changes, treat Step 9.4 as
      `fix_required` unless the PLAN was explicitly verification-only.

  9.5. PER-DISPATCH ATC (closes the mid-phase ATC gap)
      Runs AFTER Step 9.4 spec compliance passes, BEFORE state update + commit.
      Fires after every Codex executor dispatch that changed files. The gate is
      no longer classifier-tier gated: small/test-only repairs still need the
      reviewer because passing tests do not prove the execution contract or
      anti-slop checklist. The registry trigger is code_files_changed_count > 0
      and gate_sampling_tier is always.

      // Gate check (Phase 10 D-05): R5 compose — BOTH kill-switches must agree
      // config.atc.enabled is preserved as an outer runtime knob (D-13a)
      // Phase 36 wire-in (locked 36=B per 36-RESEARCH.md sec 2): single-call
      // gates.shouldFire(...) hoisted to a `perDispatchAtcFired` const so both
      // SKIP and FIRE arms reference the same evaluation; FIRE arm runs at the
      // post-convergence point AFTER LEDGER-02 (covers Codex + Claude paths).
      // Phase 38 wire-in (SAMPLE-03 site 3 of 3).
      const perDispatchAtcSampled = samplingDecider.shouldSample({
        gate: 'per-dispatch-ATC',
        work_risk: classifier_result.work_risk,
        gates,
        gatesYamlPath: GATES_YAML_PATH,
        overrides: cliOverrides,
      });
      const perDispatchAtcFired = config.atc.enabled
        && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH)
        && perDispatchAtcSampled;

      if (!perDispatchAtcFired) {
        try {
          // Phase 38 LOCKED Q13: differentiate trigger-skip from sampled-skip.
          const triggerFired = config.atc.enabled
            && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH);
          const reasonCodes = (triggerFired && !perDispatchAtcSampled)
            ? ['gate_skip_with_reason', 'gate_sampled_skip']
            : ['gate_skip_with_reason'];
          require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
            .logGateValue(path.join(process.cwd(), '.planning'), {
              gate:        'per-dispatch-ATC',
              outcome:     'skip',
              phase:       currentPhase,
              milestone:   currentMilestone,
              reason_codes: reasonCodes,
              retroactive: gates.getGate('per-dispatch-ATC', GATES_YAML_PATH),
            });
        } catch (e) {
          console.warn('[SGSD] gate-value-log per-dispatch-ATC skip-arm failed (continuing):', e && e.message);
        }
      }

      if (perDispatchAtcFired) {

      Do not skip for tier skip/lite when files changed. Treat tier skip/lite
      as full for executor dispatches so the reviewer/gate emits evidence.

      If tier == full OR tier == gate:
        // Phase 15 CODEX-07: provider-dispatch indirection.
        // VTP: AGP-P-05 (protocol-level resource registration for discovery),
        //      HiveMind doc:5a50cc9b459e (single-retry, no thundering herd).

        // CONTRACT-01 (v1.5 Phase 24): FINDINGS_DETAIL optional footer for per-dispatch-ATC.
        // Same contract as phase-level-ATC, applied at the smaller per-dispatch scope.
        composedPrompt += "\n\nAfter the 5 required contract lines, you SHOULD emit one FINDINGS_DETAIL line for every CRITICAL and WARNING finding — operator needs specifics, not interpretations:\n" +
          "  FINDINGS_DETAIL: [severity] [dimension] <description>\n" +
          "  severity: CRITICAL | WARNING | INFO\n" +
          "  dimension: naming | logic | security | performance | style | architecture\n" +
          "  description: 1-2 sentences, prefer file:line references when applicable\n" +
          "Example: FINDINGS_DETAIL: [WARNING] [logic] Missing null check before array access at sgsd-stop-handoff.sh:142\n" +
          "These lines are optional but strongly preferred. The orchestrator renders them in ATC-REVIEW.md if present.";

        const provider = gates.resolveReviewerProvider('per-dispatch-ATC', gatesRegistry, { gatesYamlPath: GATES_YAML_PATH });
        const effective = (provider && provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
          ? gates.getProvider(provider.fallback_to)
          : provider;

        let report;
        if (!effective) {
          // No reviewer_provider declared on gate — skip dispatch, log info
          logInfo('GATE_NO_PROVIDER: per-dispatch-ATC has no reviewer_provider; skipping review dispatch');
        } else if (effective.invocation === 'agent') {
          throw new Error('STALE_AGENT_PROVIDER_DISABLED: per-dispatch ATC must use Codex/local provider');
        } else if (effective.invocation === 'shell') {
          // Shell dispatch: codex-exec.sh
          const promptFile = writeTempPrompt(composedPrompt);
          const reportOut = tempReportPath('per-dispatch-atc');
          const dispatchResult = shellDispatch(effective.shell_script, {
            promptFile,
            timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
            reportOut,
            phase: currentPhase,
            step: '9.5',
            timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
          });
          if (dispatchResult.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
            // Fresh-clone SGSD does not fall back to Claude/Sonnet. Route
            // through the Blocker Recovery Hard Loop or an explicit operator
            // configured non-Claude provider.
            const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
              ? 'codex_timeout'
              : (dispatchResult.exit === 4 ? 'codex_auth_missing' : 'codex_provider_error');
            // Do not write "Codex unavailable" for timeout. Auth/availability and
            // tier-budget exhaustion are different facts; summaries must preserve
            // that distinction.
            logDeviation(`GATE_PROVIDER_NO_CLAUDE_FALLBACK: ${effective.name} ${providerFailureReason} exit=${dispatchResult.exit}`);
            runBlockerRecoveryHardLoop({ reason: providerFailureReason, step: '9.5' });
          } else if (dispatchResult.exit !== 0) {
            // Both providers failed — hard blocker per CONTEXT D-02c
            logDeviation('GATE_PROVIDER_DOUBLE_FAIL: both codex-cli-reviewer and fallback failed');
            writeCheckpoint({ reason: 'GATE_PROVIDER_DOUBLE_FAIL', step: '9.5' });
            throw new Error('GATE_PROVIDER_DOUBLE_FAIL: review gate failed on both providers');
          } else {
              // CXOPS-02: secondary contract check — codex exited 0 but report may be malformed.
              const validation = validateContract(dispatchResult.report);
              if (!validation.valid) {
                logDeviation(`GATE_PROVIDER_CONTRACT_INVALID: openai-codex exit=0 but contract invalid — missing: ${validation.missing.join(', ')}`);
                runBlockerRecoveryHardLoop({ reason: 'parse_failure', step: '9.5' });
              } else {
                report = {
                  content: dispatchResult.report,
                  _provider: 'openai-codex',
                  _model: dispatchResult.model || config.review_providers.codex_model || 'gpt-5.5',
                  _reasoning_effort: dispatchResult.reasoning_effort || config.review_providers.codex_reasoning_effort || 'xhigh'
                };
              }
          }

          // ROUTE-03 wire-in: log codex routing decision.
          // Placed INSIDE the shell branch where `dispatchResult` is in scope
          // (declared `const` at the start of this block). The wire-in is
          // semantically tied to the codex path; the agent-only branch above
          // has no codex_route decision to log. Helper wraps in try/catch and
          // returns false on error -- the orchestrator continues regardless.
          require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'route-ledger.cjs'))
            .logCodexRoute(path.join(process.cwd(), '.planning'), {
              phase: currentPhase,
              milestone: currentMilestone,
              plan: currentPlan,
              dispatchResult,                                             // exit, timeout_hit (in scope)
              effectiveProviderName: effective && effective.name,         // 'codex-cli-reviewer'
              fallbackProviderName: report && report._provider,           // 'openai-codex' | 'claude-via-fallback'
              fallbackTriggered: !!(report && report._provider === 'claude-via-fallback'),
              fallbackReason: (report && report._fallback_reason) || null,
              reportPath: typeof perDispatchReportPath === 'function' ? perDispatchReportPath() : null,
            });
        }
        → Returns: { findings, critical_count, warning_count, verdict }

        If tier == gate AND auto mode: log GATE_AUTO_REPLAN;
                          append "[GATE requires auto replan]" to DEVIATIONS.
        If tier == gate AND interactive mode: STOP with blocker; user reviews + approves
                                             before the commit lands.

        // Evidence emission: path-identical to prior Claude path per CONTEXT D-03
        // commit-reviews.jsonl gains provider: field for CODEX-10 metric accuracy
        Write verdict as a one-line JSONL append to
          `.planning/phases/{NN}/commit-reviews.jsonl`:
          {"ts":"{ISO}","plan":"{NN-PP}","tier":"full|gate","verdict":"pass|warn|fail","critical":N,"warning":N,"one_liner":"...","provider":"openai-codex","model":"gpt-5.5","reasoning_effort":"xhigh"}

        appendPerDispatchReviewEvidence(report, {
          gate: 'per-dispatch-ATC',
          provider: report._provider || effective.name,
          fallback_triggered: !!(report._provider === 'claude-via-fallback'),
          ...(report._model ? { model: report._model } : {}),
          ...(report._reasoning_effort ? { reasoning_effort: report._reasoning_effort } : {}),
          ...(report._fallback_reason ? { fallback_reason: report._fallback_reason } : {})
        });

        // LEDGER-02: tee the same per-dispatch ATC row into the canonical
        // review ledger. Phase 34 ATC fix (Codex CRIT 1+2): the orchestrator
        // has ALREADY extracted verdict/critical/warning/one_liner from the
        // report content above (this is what produced the JSONL append at
        // line 1227 and what appendPerDispatchReviewEvidence consumed). We
        // pass those same extracted values here, NOT raw `report.<field>`
        // which is undefined on the Codex path (where `report` is just
        // `{content, _provider, _model}`) and shape-uncertain on the Claude
        // agent path. `dispatchResult` is referenced ONLY when defined
        // (Codex shell path); agent path leaves duration_ms null. ONE wire
        // covers both providers because the orchestrator runs this AFTER
        // the per-path branches converge.
        try {
          const reviewLedger = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'review-ledger.cjs'));
          // Use the orchestrator-extracted contract fields (verdict / critical_count
          // / warning_count / one_liner) which were parsed out of report.content
          // immediately after the per-dispatch ATC dispatch above. Fall back to
          // `report.<field>` direct lookups only for backward compat on cached
          // Claude agent returns that already had structured fields.
          const extractedVerdict = (typeof verdict !== 'undefined') ? verdict : (report && report.verdict);
          const extractedCritical = (typeof critical_count !== 'undefined') ? critical_count : (report && report.critical_count);
          const extractedWarning = (typeof warning_count !== 'undefined') ? warning_count : (report && report.warning_count);
          const extractedOneLiner = (typeof one_liner !== 'undefined') ? one_liner : (report && report.one_liner);
          // dispatchResult is in scope only on the Codex shell path (line 1167);
          // typeof guard keeps the Claude agent path silent rather than crashing.
          const codexDuration = (typeof dispatchResult !== 'undefined' && dispatchResult && typeof dispatchResult.duration_ms === 'number')
                                  ? dispatchResult.duration_ms : null;
          reviewLedger.appendReviewRow(path.join(process.cwd(), '.planning'), {
            ts: new Date().toISOString(),
            plan: currentPlan,
            tier: 'per-dispatch',
            verdict: extractedVerdict,
            critical: extractedCritical,
            warning: extractedWarning,
            one_liner: extractedOneLiner,
            provider: (report && report._provider) || effective.name,
            model: report && report._model,
            reasoning_effort: report && report._reasoning_effort,
            fallback_reason: (report && report._fallback_reason) || null,
            fallback_triggered: !!(report && report._provider === 'claude-via-fallback'),
            duration_ms: codexDuration,
            milestone: currentMilestone,
            phase: currentPhase,
            _source_milestone: currentMilestone,
            _source_phase: currentPhaseDir || (`${currentPhase}-` + (currentPlan || '').split('-')[0]),
          });
        } catch (e) {
          console.warn('[SGSD] review-ledger wire-in failed (continuing):', e && e.message);
        }

        // Phase 36 wire-in (locked 36=B per 36-RESEARCH.md sec 2):
        // gate-value-log FIRE arm at the convergence point. Reuses the
        // extractedVerdict / extractedCritical computed by the LEDGER-02
        // wire above so Codex + Claude paths share the same outcome
        // derivation. ONE wire covers both providers (cf. 34-RESEARCH.md
        // sec 3.3 + sec 11.2). Wrapped in try/catch -- never throws upward.
        try {
          const gateValueLog = require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'));
          const reportPath = (typeof perDispatchReportPath === 'function') ? perDispatchReportPath() : null;
          // Reuse the same extracted contract fields as the LEDGER-02 wire above.
          const gvlVerdict  = (typeof verdict !== 'undefined')        ? verdict        : (report && report.verdict);
          const gvlCritical = (typeof critical_count !== 'undefined') ? critical_count : (report && report.critical_count);
          const gvlWarning  = (typeof warning_count !== 'undefined')  ? warning_count  : (report && report.warning_count);
          gateValueLog.logGateValue(path.join(process.cwd(), '.planning'), {
            gate:        'per-dispatch-ATC',
            outcome:     gateValueLog.outcomeFromVerdict(gvlVerdict, gvlCritical, gvlWarning),
            phase:       currentPhase,
            milestone:   currentMilestone,
            evidence:    reportPath ? [{ kind: 'review_report', ref: reportPath }] : [],
            retroactive: gates.getGate('per-dispatch-ATC', GATES_YAML_PATH),
          });
        } catch (e) {
          console.warn('[SGSD] gate-value-log per-dispatch-ATC fire-arm failed (continuing):', e && e.message);
        }

      If critical > 0 AND interactive: STOP with blocker quoting the findings.
      If critical > 0 AND auto: log GATE_AUTO_REPLAN, append an expiring
      DEVIATIONS entry, and dispatch a fix/replan before treating the work as
      clean. Auto mode must not ask the user, but critical ATC findings are
      load-bearing and cannot silently pass to phase completion.

      Token budget per dispatch: ~300 tokens (250 review + 50 JSONL append).
      On a 10-dispatch phase with 3 FULL-tier dispatches → +900 tokens total.
      SKIP/LITE dispatches pay zero.
      } // end if (perDispatchAtcFired)

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
             "codex-verifier [gpt-5.5/xhigh] P{N} — contrarian pass"})

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

            const primary = 'openai-codex-verifier';
            const challengerProviderName = 'codex-cli-reviewer';

            let challengerReport;

            if (challengerProviderName === 'codex-cli-reviewer' &&
                (!config.review_providers.codex_enabled || codexAuthFailed)) {
              // Per CONTEXT D-17: if Codex unavailable, skip entirely.
              // Do NOT fall back to same-vendor challenger — that defeats the purpose
              // of cross-vendor signal (D-17a). Better to skip than produce false signal.
              logDeviation('VERIFIER_ADVERSARIAL_SKIP: codex_auth_unavailable');
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
                  step: '9.6-adversarial',
                  timeoutTier: 'review'  // --timeout-tier review (D-03: adversarial → review tier = 120s)
                });
                if (dispatchResult.exit === 0) {
                  challengerReport = {
                    content: dispatchResult.report,
                    _provider: 'openai-codex',
                    _model: dispatchResult.model || config.review_providers.codex_model || 'gpt-5.5',
                    _reasoning_effort: dispatchResult.reasoning_effort || config.review_providers.codex_reasoning_effort || 'xhigh'
                  };
                } else {
                  const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
                    ? 'codex_timeout'
                    : (dispatchResult.exit === 4 ? 'codex_auth_missing' : 'codex_provider_error');
                  logDeviation(`VERIFIER_ADVERSARIAL_SKIP: codex-exec.sh ${providerFailureReason} exit=${dispatchResult.exit}`);
                }
              } else {
                logDeviation('VERIFIER_ADVERSARIAL_SKIP: stale non-Codex challenger provider disabled');
              }

              if (challengerReport) {
                // Token log per CONTEXT D-18: role "adversarial_verifier", provider "openai-codex"
                // Feeds CODEX-10 offload calculation (claude_tokens_saved_by_codex tile)
                appendTokenLogRow({
                  role: 'adversarial_verifier',
                  provider: challengerReport._provider,
                  model: challengerReport._model || 'codex',
                  ...(challengerReport._reasoning_effort ? { reasoning_effort: challengerReport._reasoning_effort } : {})
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

  10. CURATE LEARNINGS (gate execution mechanics only)
      ROUTING POLICY (Phase 149): `super-gsd/registry/skill-routing.yaml` is
      the source of truth for memory-hygiene/curation scheduling. Runtime
      phase-close routing is resolved by:
        `node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult --phase N`
      The block below retains only the existing gate and curation mechanics.
      // Gate check (Phase 10 D-08): sgsd-curate-learnings fires when new pattern, script, or error
      if (gates.shouldFire('sgsd-curate-learnings', ctx, GATES_YAML_PATH)) {
      If DEVIATIONS contains new patterns → sgsd-curate to patterns/
      If SCRIPTS_CREATED non-empty → sgsd-curate to scripts/{category}
      If new error discovered → sgsd-curate to error-rules/
      } // end gates.shouldFire('sgsd-curate-learnings')

  11. UPDATE STATE
      state.write is the sole owner of the plan-close STATE projection. Invoke
      this exact event-envelope CLI with JSON-escaped strings and concrete
      integer counts:

      ```bash
      node super-gsd/tools/state-write/write.cjs --event-json '{"event":"plan-close","projectDir":".","milestone":"{{MILESTONE}}","evidence_phase":"{{PHASE}}","current_phase":"{{PHASE}}","last_updated":"{{LAST_UPDATED}}","progress":{"total_phases":{{TOTAL_PHASES}},"completed_phases":{{COMPLETED_PHASES}},"completed_plans":{{COMPLETED_PLANS}},"status_row":{"phase":"{{PHASE}}","value":"{{PHASE_STATUS_ROW}}"}}}'
      ```

      Exit 1 refuses plan close; exit 2 requires input/I/O repair. Exit 0 with
      `changed=false` is an idempotent success.

      // Gate check (Phase 10 D-09): token-log gate fires unless disabled (soft-warn, no trigger)
      // NOTE: Step 11 is exempt from edge-guard emit-check (D-11c) — it IS the logging step.
      if (gates.shouldFire('token-log', ctx, GATES_YAML_PATH)) {
      - Mark ROADMAP.md phase progress
      - Log token usage to .planning/metrics/token-log.jsonl
      } // end gates.shouldFire('token-log')

  11.5. TOKEN-WASTE CHECK (Phase 42 execution mechanics via Phase 87-01 hook)
      // ROUTING POLICY (Phase 149): super-gsd/registry/skill-routing.yaml is
      // the source of truth for token-work routing. Resolve scheduled runtime
      // decisions with:
      //   node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult --phase N
      // When that decision selects token-waste work, use the existing hook below.
      // Lock 13: hook never throws; verdict drives event emission.

      ```bash
      node super-gsd/scripts/lib/orchestrator-hooks.cjs --token-waste-check \
        --milestone "$MILESTONE" \
        --project-dir "$PROJECT_DIR"
      ```

      The hook spawns super-gsd/tools/token-waste/check.cjs --check --json
      per Phase 42 contract. Verdict handling (Lock 13: NO 'blocked' verdict):
      - verdict 'ok' / 'false_positive': continue.
      - verdict 'warn': hook emits ORCHESTRATOR-LIVE 'token_threshold_crossed'
        event; orchestrator logs to DEVIATIONS for the phase; continue.
      - verdict 'degraded': hook emits 'token_threshold_crossed'; orchestrator
        considers route_hint substitution (researcher_local_script,
        codex_reviewer_fallback, etc.) on next dispatch; continue.
      - subprocess fail / parse fail: hook returns {ok:false,error:...};
        orchestrator logs DEVIATIONS and continues (Lock 13 floor).

      Hard-stop on token spend remains reserved for SGSD-HANDOVER.md:79-86
      autonomy-halt path; this hook is soft-warn-with-evidence per design
      lock 13 ("autonomy continues; evidence tells the truth").

  12. GIT COMMIT
      Atomic commit per unit:
      git add {files from report}
      git commit -m "feat({phase}-{plan}): {ONE_LINER}"
      NEVER batch. NEVER skip. NEVER amend.

  13. LOOP
      Run `node super-gsd/scripts/lib/decision-state.cjs --render orchestrator --project "$PWD"` again → this is a tool call → loop continues
      DO NOT send text-only response. Pair status update with next Read.
```
</loop>

## Live Event Wire-In Points (Phase 74-75)

The orchestrator emits structured events to `.planning/ORCHESTRATOR-LIVE.jsonl`
via `super-gsd/scripts/lib/orchestrator-live-writer.cjs --emit '<json>'`.
16 EVENT_TYPES per `super-gsd/docs/ORCHESTRATOR-LIVE-EVENTS.md`. Each fire
point below is approximate; the writer is Lock-13-wrapped so emit failures
do NOT crash the run (event-emit is fire-and-forget; legacy ledgers remain
canonical for correctness).

| Event type | Fires when | Required `data` fields |
|---|---|---|
| `run_started` | `/sgsd-orchestrate go` invoked at session start | `mode`, `user_command`, `session_id` |
| `phase_started` | Loop step 1 detects new active phase | `phase`, `phase_name`, `milestone` |
| `plan_selected` | Step 4 dispatches a plan to executor | `plan_id`, `title`, `expected_atc_tier` |
| `agent_dispatched` | Before Codex/local delivery dispatch | `agent`, `model`, `task_id`, `purpose` |
| `agent_progress` | Optional during long-running task | `task_id`, `current_action`, `files_touched` |
| `agent_completed` | After agent returns report | `task_id`, `agent`, `outcome`, `summary`, `files_changed` |
| `codex_started` | Step 6.5 / 9.5 / 9.6 codex dispatch | `step`, `scope`, `prompt_chars` |
| `codex_completed` | Codex returns | `verdict`, `critical_count`, `warning_count`, `duration_ms` |
| `gate_started` | Phase-level / per-dispatch gate fire | `gate`, `phase` |
| `gate_passed` / `gate_warned` / `gate_failed` | Gate outcome | `gate`, `phase`, `verdict`, `evidence_path` |
| `token_threshold_crossed` | Phase 42 budget check trips | `role`, `threshold_kind`, `actual_value`, `threshold_value` |
| `checkpoint_written` | Checkpoint protocol fires | `path`, `next_unit`, `reason` |
| `operator_attention_required` | Hard blocker / 7-reason vocab | `reason`, `context` |
| `run_completed` | Loop exits via one of 3 valid exits | `outcome`, `duration_seconds` |

The 7 attention reasons (per Phase 87 v2.6 finalization, draft now):
provider_unavailable / gate_failed_after_retries / credentials_needed /
destructive_op_blocked / privacy_judgment_needed / no_activity / roadmap_complete.

**Failure mode**: writer returns `{ok:false}` on any error (bad input,
write failure, etc.). Orchestrator MUST NOT halt on emit failure. The
event stream is observability; legacy ledgers are correctness.

**v2.4 transition**: legacy ledgers (`activity-log.jsonl`,
`agent-token-spend.jsonl`, `codex-log.jsonl`, `gate-value-log.jsonl`,
`orchestrator-pulse.jsonl`) remain canonical for their domains. Phase
75 wires PARALLEL emits to the live stream; readers (cockpit-state
adapter Phase 76, MCP `sgsd_cockpit_snapshot`) consume the unified
stream.

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
When user says stop/pause OR the Blocker Recovery Hard Loop has failed and the
remaining issue is operator-only:

**No self-estimated context halts.** The orchestrator must never estimate its
own context percentage and stop. If the runtime compacts context, resume from
external state. If a mechanical context gauge exists, it is observability only
unless the user explicitly asks to stop.

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
  codex: {N}
  legacy_disabled: {N}
context_percent_at_write: "not_self_estimated"
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
- {patterns/decisions curated to SGSD memory this session}
```

Then commit the checkpoint and STOP only for the explicit user pause/stop or
operator-only blocker that triggered this protocol after board plus Codex
recovery failed. Context pressure alone is never a valid trigger.
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

If git commit fails: check git status, resolve conflict, retry ONCE. If still
fails, run the Blocker Recovery Hard Loop before deciding it is operator-only.
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
  model: dispatchedModel,         // 'opus' | 'codex' | ...
  role: agentRole,                // 'code_reviewer' | 'adversarial_verifier' | 'executor' |
                                  // 'verifier' | 'classifier' | 'context_selector'
  provider: dispatchProvider,     // 'claude-opus' | 'openai-codex' | explicit external provider
  reasoning_effort: reasoningEffort, // Codex/OpenAI reasoning effort, e.g. 'xhigh'
  est_input: estimatedInputTokens,
  est_output: estimatedOutputTokens,
  total: estimatedInputTokens + estimatedOutputTokens,
  classifier_model: classifierModel,  // 'frontmatter' | 'cache' | 'codex-local'
  context_tokens: contextWindowUsed
};
// provider value is derived from dispatch path:
//   Opus orchestration        → 'claude-opus'
//   shellDispatch exit 0      → 'openai-codex'
//   shellDispatch + recovery  → 'openai-codex' plus route decision row
// NOTE: the wrapper (codex-exec.sh) refuses to run if OPENAI_API_KEY is set (exits 4);
//       per CONTEXT D-02a. It does NOT defensively unset the key.
```

Example serialized JSONL row (what actually lands in token-log.jsonl):
```json
{"ts":"2026-04-24T12:00:00Z","phase":15,"plan":3,"model":"codex","role":"code_reviewer","provider":"openai-codex","est_input":500,"est_output":200,"total":700,"classifier_model":"frontmatter","context_tokens":1200}
```

Estimation method:
- Input: count words in composed prompt * 1.3
- Output: count words in agent report * 1.3
- Context: sum of sgsd-recall result tokens + file read tokens
</token_logging>

<golden_rules>
1. ALWAYS chain tool calls. Text-only = loop dies.
   VALID text-only exits (ONLY these 3):
   a. No remaining roadmap/milestone work after close/advance checks:
      "All phases done."
   b. Operator-only blocker remains after Blocker Recovery Hard Loop: explain
      board + Codex attempts, then stop
   c. User says stop/pause: write checkpoint, stop
   NOTHING ELSE is a valid text-only response.
2. NEVER do heavy work yourself. Dispatch to sub-agents.
3. NEVER load full files. Frontmatter + sgsd-recall only.
4. COMMIT after every unit. Uncommitted work is lost work.
5. CURATE after every unit. Unrecorded learnings are wasted tokens.
6. LOG tokens after every unit. Untracked spend is invisible spend.
7. Use the RIGHT provider. Claude/Opus 4.7/xhigh orchestrates only. Codex
   GPT-5.5/xhigh handles classification/routing, phase research, planning,
   final plan ATC/MUDA review, verification, gates, and all code execution.
   Sonnet is not a fresh-clone default provider or Codex fallback.
   unless a gate says otherwise.
8. Sub-agent reports: 300 words MAX. If longer, the agent wasted tokens.
9. Script reuse: ALWAYS check `sgsd-recall "scripts {purpose}"` before
   creating new utilities.
10. EXIT only for the 3 valid conditions. Never stop prematurely. Context
    percentage is not one of them; do not self-estimate or halt for it.
11. NO OPTIONAL REVIEW PROMPTS IN AUTO MODE: If command is `go`, `auto`, or
    `continue`, never ask whether to keep going, pause, review, checkpoint, or
    proceed after a phase/milestone/cost summary. Pair the summary with the next
    Read/Agent/Bash call and continue. Choice questions are valid only for
    `next`, `status`, `stop`, `pause`, no-remaining-roadmap-work, or an
    operator-only stop after board plus Codex recovery failed.
12. CONTEXT ACCUMULATOR: After 5 reports in active context, compress older reports to ONE_LINERs.
    Never hold full report text for more than 2 completed iterations.
13. REPORT VALIDATION: Always check word count and section presence before parsing.
    Log REPORT_OVERLIMIT and MISSING_SECTION — do not exit on format violation.
14. PHASE ATC GATE: After verification passes, BEFORE marking phase complete —
    run full phase-level ATC review via Step 6.5. This reviews the ENTIRE phase's
    work (all plans, all commits) as a coherent unit, NOT individual commits.
    Classify from frontmatter/cache or Codex/local, review through Codex-first `codex-exec.sh` via
    `gates.resolveReviewerProvider('phase-level-ATC')`.
    Writes .planning/phases/{NN}-*/{NN}-ATC-REVIEW.md
    Critical findings + auto mode: log GATE_AUTO_HALT, write {NN}-ATC-GAP-PLAN.md,
    add an expiring DEVIATIONS entry, and do not mark the phase complete until
    resolved.
    Critical findings + interactive: STOP with blocker.
    Token budget: ~600 tokens per phase (NOT per commit).
    Complexity floor: 5+ plans OR 500+ lines → always FULL tier.
14.5. PLAN FINALIZATION GATE: After plan-check passes and before executor
    dispatch, run Codex GPT-5.5/xhigh ATC + MUDA review on the plan set. NOGO
    returns to Opus/xhigh planner revision. Never execute a plan set that has
    not passed this final plan review unless the operator explicitly bypasses it.
15. FRONTEND BROWSER VERIFY GATE: After Step 6.5 (ATC), BEFORE marking phase
    complete — IF the phase diff touched any frontend file matching
    config.browser_verify.frontend_globs, run Step 6.6 which dispatches
    browser verification tooling to verify every route in config.browser_verify.routes
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
          Enforced by: gsd-list-phase-assumptions + gsd-discuss-phase before
          planning in interactive mode. In auto mode, missing
          discussion/context is auto-authored from roadmap/checkpoint/audit
          evidence and recorded before research/planning continues.
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
