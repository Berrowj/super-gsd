---
schema_version: 2
phase: "153"
slug: "hook-transport-completion"
milestone: "v3.6-vtp-bridge"
status: "PLANNED"
revision: 2
supersedes: "153-01-PLAN-LOCKED.md rev 1 (NOGO at plan review, 2026-08-18)"
depends_on: ["149", "151", "152"]
intent: "Register the UserPromptSubmit hook that P149/P151/P152 governance already depends on, repo-locally, and prove it fires under genuine Claude Code dispatch rather than under a harness spawn. Then make the existing secret-leak guard actually block. Rev 2 after Codex plan review returned NOGO: target ambiguity fixed to repo-local, ACs re-anchored on dispatch provenance, T0 split out to P154, generic block kind dropped."
execution_mode: "serial-codex"
expected_ATC_tier: "FULL"
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: "The repo-local .claude/settings.json after merge-settings.js --repo-local-hooks has installed the overlay."
    expected_outcome: "A UserPromptSubmit event is registered whose command resolves to sgsd-intent-classifier.cjs, and EVERY command in the hooks section resolves to a file that exists on disk (no broken repo-relative args). The assertion reads only the hooks section by key and never touches the env block."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-registration.cjs"
  - input: "A planning-shaped prompt (how should we architect the retry layer) submitted in a genuine Claude Code session with the hook registered."
    expected_outcome: "A route-decision row is appended that names the matched route AND carries dispatch provenance from the hook payload: hook_event_name equal to UserPromptSubmit, a session_id, and a transcript_path that exists on disk under the Claude projects directory. A row lacking a resolvable transcript_path fails, because a harness spawn cannot supply one."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction positive --require-dispatch-provenance"
  - input: "An execution-shaped prompt (fix the failing test in parser.cjs) submitted in the same genuine session."
    expected_outcome: "A row is appended that explicitly records no match, carrying the same dispatch provenance. An absent row fails the assertion, because absence is indistinguishable from the hook never running."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction negative --require-dispatch-provenance"
  - input: "The same two prompts replayed by spawning sgsd-intent-classifier.cjs directly, with the hook deliberately unregistered."
    expected_outcome: "The provenance assertion FAILS. This control run proves the falsifier discriminates genuine Claude dispatch from a harness spawn; if it passes, the falsifier is not falsifying and the task is incomplete."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --control unregistered-must-fail"
  - input: "A prompt containing a credential pattern such as an API_KEY assignment, submitted through the registered Claude Code UserPromptSubmit surface."
    expected_outcome: "The hook process exits with code 2 and writes an operator-facing reason to stderr naming the matched trigger. The reason contains no secret material - not the captured value, not a substring of it. The assertion reads the real exit code of a spawned process, not a mocked return value."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case secret"
  - input: "A benign prompt with no credential pattern submitted to the same surface."
    expected_outcome: "The hook process exits 0, writes no block reason, and the prompt is not suppressed."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case benign"
  - input: "The block-secret-leak implementation as invoked from both the Codex hook surface and the Claude Code hook surface."
    expected_outcome: "Both surfaces execute the SAME implementation module - one file, two callers - and both produce identical block decisions for the identical payload. A duplicated second copy of the detection logic fails the assertion."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case dual-surface-shared"
  - input: "The existing P152 kb-lookup-triage shadow route after this phase changes."
    expected_outcome: "It remains enforcement kind shadow, injects nothing, and its text-free ledger contract is unchanged; the 28-day promote-or-kill metric is not pre-empted."
    verification_cmd: "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
known_deadends:
  - "Merging repo-settings-overlay.json into the GLOBAL settings file. Verified 2026-08-18: that overlay declares THREE events (SessionStart, UserPromptSubmit, PostToolUse) with bare relative node commands, so a global merge installs two unrelated hooks with repo-relative args into every project. This is the install-vs-project seam (instance #6 class). Use merge-settings.js --repo-local-hooks."
  - "Asserting the negative direction by checking that no telemetry row exists. Absence is indistinguishable from the hook never running. This made P150 trust probe report a false negative (seam instance #6)."
  - "Proving the hook works by spawning the classifier directly after checking registration. That proves nothing about whether Claude Code dispatched it, and was the NOGO finding against rev 1 of this plan (seam instance #9). The falsifier must assert on payload provenance a direct spawn cannot supply."
  - "Adding a generic fifth enforcement kind `block` to the classifier registry. Dropped at plan review as YAGNI: there is exactly one current consumer and it is a standalone guard, so the abstraction only anticipates a metric-locked P152 promotion. Revisit when a second real consumer exists."
  - "Porting disler/claude-code-hooks-mastery Python/uv hooks. hooks.yaml sets timeout_sec 2 and uv cold-start on Windows exceeds it on every tool call. That repo has NO LICENSE (all-rights-reserved); only the Claude Code event taxonomy and exit-code semantics are used, which are facts about the platform rather than his code."
tasks:
  - id: "P153-T1"
    type: "hook-registration"
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - "super-gsd/config/repo-settings-overlay.json"
      - "super-gsd/registry/hooks.yaml"
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/tests/hook-transport/assert-registration.cjs"
      - "super-gsd/tests/hook-transport/assert-live-route-decision.cjs"
    input_contract: >
      sgsd-intent-classifier.cjs self-declares as a UserPromptSubmit hook but no
      UserPromptSubmit event is registered, so P149 skill-routing, P151 demand baseline and
      P152 shadow never execute live. Register it REPO-LOCALLY using the existing
      merge-settings.js --repo-local-hooks mode, which resolves script paths against the repo
      root. Do NOT merge into the global settings file: the overlay declares three events with
      bare relative node commands and a global merge would install unrelated hooks with
      repo-relative args into every project. Add the corresponding UserPromptSubmit row to
      hooks.yaml. Ensure the classifier captures dispatch provenance from the hook payload
      (hook_event_name, session_id, transcript_path, cwd) into its route-decision row, and
      ensure it appends an EXPLICIT no-match row when no route matches - if it does not do so
      today, adding that row is part of this task. CRITICAL: never read, print or echo the
      settings env block; inspect only the hooks section by key.
    output_contract: >
      UserPromptSubmit mapped to sgsd-intent-classifier.cjs is registered repo-locally and
      reflected in hooks.yaml. assert-registration.cjs confirms registration and that every
      hook command resolves to an existing file. assert-live-route-decision.cjs proves three
      things: a planning-shaped prompt appends a row naming the matched route with valid
      dispatch provenance; an execution-shaped prompt appends an explicit no-match row with
      the same provenance; and a deliberate-unregistration direct-spawn control run FAILS the
      provenance assertion.
    hypothesis: "The mechanism is complete and merely unregistered; installing it repo-locally through the existing merge path makes P149/P151/P152 execute live, and asserting on payload provenance that only genuine Claude dispatch supplies makes the proof unfakeable by a harness spawn."
    falsifier: >
      The control run passes when the hook is unregistered and the classifier is spawned
      directly, proving the assertion does not discriminate genuine dispatch; or registration
      succeeds but no route-decision row appears for a planning-shaped prompt; or a hook
      command in the merged settings points at a path that does not exist; or any assertion
      reads the settings env block; or the global settings file is modified.
    stop_rule: >
      Stop when repo-local registration is confirmed, both directions write rows carrying
      valid dispatch provenance, and the unregistered control run fails as required. Do not
      bind any other hook event and do not touch the global settings file.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-registration.cjs"
        - "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction positive --require-dispatch-provenance"
        - "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction negative --require-dispatch-provenance"
        - "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --control unregistered-must-fail"
        - "node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test"
  - id: "P153-T2"
    type: "blocking-guard"
    agent: codex
    model: codex
    depends_on: ["P153-T1"]
    files_touched:
      - "super-gsd/tools/codex-hooks/block-secret-leak.cjs"
      - "super-gsd/config/repo-settings-overlay.json"
      - "super-gsd/tests/hook-transport/assert-block-guard.cjs"
    input_contract: >
      block-secret-leak.cjs already reads UserPromptSubmit JSON from stdin and detects
      credential-bearing prompts, but it is wired only to the Codex hook surface and does not
      block. Make it block by exiting 2 with an operator-facing stderr reason naming the
      matched trigger, and register that SAME implementation on the Claude Code
      UserPromptSubmit surface via the repo-local overlay. One implementation, two callers -
      extend, do not duplicate the detection logic. Exit 2 is the documented Claude Code
      contract for blocking a UserPromptSubmit hook. Do NOT add a generic fifth enforcement
      kind to the classifier registry: that was dropped at plan review as YAGNI with only one
      current consumer. HARD CONSTRAINT: the P152 kb-lookup-triage route stays kind shadow;
      do not flip it, its 28-day metric has not unlocked. The stderr reason names the trigger
      and MUST NOT contain the matched credential value or any substring of it.
    output_contract: >
      A credential-bearing prompt on the Claude Code surface exits 2 with a stderr reason
      naming the trigger and containing no secret material; a benign prompt exits 0; both the
      Codex and Claude Code surfaces invoke a single shared implementation and return
      identical decisions for identical payloads. P152 remains shadow and assert-shadow.cjs
      still passes.
    hypothesis: "Warning-only enforcement does not change agent behaviour - the AHE paper records correct middleware warnings appended to tool output being ignored on the very next model turn, while hard-block at the shell layer produced the run's largest score jump - so making the existing guard exit 2 on the Claude surface is the smallest change that converts an inert detector into an actual control."
    falsifier: >
      A credential-bearing prompt is not blocked, or is blocked without a stderr reason naming
      the trigger, or the reason leaks the matched secret or a substring of it; a benign prompt
      is blocked; the two surfaces run separate copies of the detection logic; a generic block
      kind is added to the classifier registry; or the P152 shadow route changes behaviour.
    stop_rule: >
      Stop when the guard blocks and passes correctly on real spawned processes from the Claude
      surface, both surfaces share one implementation, and assert-shadow.cjs still passes. Do
      not flip P152 and do not add further blocking routes.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case secret"
        - "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case benign"
        - "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case dual-surface-shared"
        - "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
---

# P153 — Hook Transport Completion (rev 2)

## Goal

`sgsd-intent-classifier.cjs` self-declares as a UserPromptSubmit hook. No UserPromptSubmit
event is registered, so the governance built across P149 (skill-routing), P151 (demand
baseline) and P152 (KB-triage shadow) never executes in a live session. This phase
registers the hook repo-locally, proves it fires under genuine Claude Code dispatch, and
makes the existing secret-leak guard actually block.

## Revision history

Rev 1 (commit `6aff797`) was returned **NOGO** by Codex plan review on 2026-08-18. Three
findings were accepted and one refined:

- **CRIT, accepted.** Rev 1 said "merge the overlay" without naming the target. The overlay
  declares three events with bare relative `node` commands, so a global merge would install
  SessionStart and PostToolUse hooks with repo-relative args into every project. Rev 2 pins
  the target to `merge-settings.js --repo-local-hooks`.
- **All ACs fakeable, accepted.** Rev 1's "live falsifier" checked registration and then
  spawned the classifier directly — which proves nothing about whether Claude Code dispatched
  it. That is the harness-green/production-dead pattern, instance #9, inside the plan meant
  to fix instances #7 and #8. Rev 2 anchors the ACs on payload provenance and adds an
  unregistered-control run that must fail.
- **MUDA overproduction, accepted.** T0 (MCP arg contract) is a separate defect, not hook
  transport. Split to P154.
- **Refined.** The review demanded "actual Claude-dispatched probes" without a mechanism. A
  test cannot drive a real session, but it can require `transcript_path` to resolve on disk —
  something a harness spawn cannot fabricate. That makes the requirement implementable.

The generic fifth `block` enforcement kind was dropped: one current consumer, and it is a
standalone guard. Revisit when a second real consumer exists.

## Tasks

**T1** registers the hook repo-locally, captures dispatch provenance, and adds the explicit
no-match row. Its control run must fail, or the falsifier is not falsifying.

**T2** makes the existing guard exit 2 on the Claude surface from a single shared
implementation. No new abstraction.

## Orchestrator-owned (not a Codex task)

`STATE.md` frontmatter `current_phase` is stale at "150" while v3.6 has P151/P152 closed.
This mis-targeted a runtime-derived evidence path during this phase's own triage. State
files are orchestrator-owned per commit discipline, so the orchestrator corrects it at
phase close.

## Verification

Eight `semantic_acceptance_criteria`, all against real data: the real repo-local settings
file, real spawned processes and their real exit codes, and route-decision rows carrying
provenance that resolves on disk. No structural greps stand in for behaviour.

## Success Criteria

- UserPromptSubmit registered repo-locally; every merged hook command resolves to an existing file.
- Planning-shaped prompt writes a row naming the matched route with valid dispatch provenance.
- Execution-shaped prompt writes an explicit no-match row with the same provenance.
- The unregistered direct-spawn control run FAILS the provenance assertion.
- Credential-bearing prompt exits 2 with a trigger-naming reason carrying no secret material.
- Benign prompt exits 0.
- Both hook surfaces share one implementation of the guard.
- P152 remains shadow; `assert-shadow.cjs` passes.
- The global settings file is unmodified.
