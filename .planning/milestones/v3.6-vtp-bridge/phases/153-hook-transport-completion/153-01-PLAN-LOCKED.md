---
schema_version: 2
phase: "153"
slug: "hook-transport-completion"
milestone: "v3.6-vtp-bridge"
status: "PLANNED"
revision: 3
supersedes: "rev 2 (NOGO at plan review round 2, 2026-08-18) and rev 1 (NOGO round 1)"
depends_on: ["149", "151", "152"]
intent: "Register the UserPromptSubmit hook that P149/P151/P152 governance already depends on, using a dedicated UserPromptSubmit-only overlay installed repo-locally, and prove it fires under genuine Claude Code dispatch by correlating a fresh nonce against Claude's own debug hook-dispatch record. Then make the existing secret-leak guard actually block. Rev 3 closes all five round-2 blockers."
execution_mode: "serial-codex"
expected_ATC_tier: "FULL"
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: "The repo-local .claude/settings.json after running: node super-gsd/scripts/merge-settings.js --repo-local-hooks super-gsd/config/claude-ups-overlay.json .claude/settings.json ."
    expected_outcome: "Exactly ONE new event is registered - UserPromptSubmit - because the dedicated overlay declares only that event. No SessionStart or PostToolUse entry is introduced by this merge. Every command in the hooks section resolves to a file that exists on disk. The assertion reads only the hooks section by key and never touches the env block."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-registration.cjs"
  - input: "A headless Claude session launched by the verifier with a fresh random nonce embedded in a planning-shaped prompt: claude -p '<nonce> how should we architect the retry layer' --debug hooks --debug-file <tmp>"
    expected_outcome: "Claude's own debug file records a UserPromptSubmit hook dispatch, AND a new route-decision row appears naming the matched route, AND the row's session_id matches the session Claude reports in the debug record, AND the nonce ties the two together. Correlation of Claude-generated dispatch evidence with the new ledger row is what proves genuine dispatch."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe planning"
  - input: "A headless Claude session with a fresh nonce in an execution-shaped prompt: claude -p '<nonce> fix the failing test in parser.cjs' --debug hooks --debug-file <tmp>"
    expected_outcome: "Claude's debug file records the dispatch AND a row is appended that EXPLICITLY records no match, correlated by nonce and session_id. An absent row fails, because absence is indistinguishable from the hook never running."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe no-match"
  - input: "The classifier spawned directly on stdin with a forged payload supplying hook_event_name UserPromptSubmit, a stale session_id, and a copied real transcript_path, with no Claude session involved."
    expected_outcome: "The assertion FAILS, because no Claude-generated debug hook-dispatch record exists for that nonce and session. This control proves the probe discriminates genuine dispatch from a forged direct spawn; if it passes, the falsifier is not falsifying and the task is incomplete."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --control forged-spawn-must-fail"
  - input: "A headless Claude session with a fresh nonce in a prompt that targets a P149 skill-routing registry route specifically, not the P146 compatibility planning-triage route."
    expected_outcome: "A route-decision row is appended whose matched route originates from the P149 skill-routing registry, correlated by nonce and session_id, proving the P149 concatenated registry is exercised live and not merely the compatibility route."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe p149-skill-routing"
  - input: "A headless Claude session with a fresh nonce in a KB-directed prompt that matches the P152 kb-lookup-triage shadow route."
    expected_outcome: "A text-free shadow row is appended to the P152 ledger under genuine dispatch, and NOTHING is injected into the prompt. The row contains no prompt text, excerpt or entity string. P152 remains enforcement kind shadow."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe p152-shadow"
  - input: "A prompt containing a credential pattern such as an API_KEY assignment, delivered to the registered Claude Code UserPromptSubmit surface."
    expected_outcome: "The hook process exits with code 2 and writes an operator-facing reason to stderr naming the matched trigger. The reason contains no secret material - not the captured value, not a substring of it. The assertion reads the real exit code of a spawned process, not a mocked return value."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case secret"
  - input: "A benign prompt with no credential pattern delivered to the same surface."
    expected_outcome: "The hook process exits 0, writes no block reason, and the prompt is not suppressed."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case benign"
  - input: "The block-secret-leak implementation as invoked from both the Codex hook surface and the Claude Code hook surface."
    expected_outcome: "Both surfaces execute the SAME implementation module - one file, two callers - and produce identical block decisions for identical payloads. A duplicated second copy of the detection logic fails the assertion."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case dual-surface-shared"
  - input: "The existing P152 kb-lookup-triage shadow route regression suite after this phase's changes."
    expected_outcome: "It remains enforcement kind shadow, injects nothing, and its text-free ledger contract is unchanged; the 28-day promote-or-kill metric is not pre-empted."
    verification_cmd: "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
known_deadends:
  - "Merging super-gsd/config/repo-settings-overlay.json for this phase. Verified 2026-08-18: it declares THREE events (SessionStart, UserPromptSubmit, PostToolUse) and merge-settings.js merges every event in the overlay, so using it contradicts a UserPromptSubmit-only stop_rule and, if targeted globally, installs unrelated hooks with repo-relative args into every project. Rev 3 uses a dedicated single-event overlay instead."
  - "Proving dispatch via payload provenance fields (hook_event_name, session_id, transcript_path). Refuted at plan review round 2: a direct stdin spawn can supply all three, including a copied real transcript path. Provenance fields are forgeable and prove nothing on their own."
  - "Asserting the negative direction by checking that no telemetry row exists. Absence is indistinguishable from the hook never running. This made P150's trust probe report a false negative (seam instance #6)."
  - "Treating the P146 compatibility planning-triage route as coverage for P149. They are separate registries; a planning-shaped prompt matching planning-triage does not exercise the P149 skill-routing table."
  - "Adding a generic fifth enforcement kind `block` to the classifier registry. Dropped as YAGNI: one current consumer, a standalone guard. Revisit when a second real consumer exists."
  - "Porting disler/claude-code-hooks-mastery Python/uv hooks. hooks.yaml sets timeout_sec 2 and uv cold-start on Windows exceeds it on every tool call. That repo has NO LICENSE (all-rights-reserved); only the Claude Code event taxonomy and exit-code semantics are used, which are facts about the platform rather than his code."
tasks:
  - id: "P153-T1"
    type: "hook-registration"
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - "super-gsd/config/claude-ups-overlay.json"
      - "super-gsd/registry/hooks.yaml"
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/tests/hook-transport/assert-registration.cjs"
      - "super-gsd/tests/hook-transport/assert-live-dispatch.cjs"
    input_contract: >
      sgsd-intent-classifier.cjs self-declares as a UserPromptSubmit hook but no
      UserPromptSubmit event is registered, so P149 skill-routing, P151 demand baseline and
      P152 shadow never execute live. Create a NEW dedicated overlay
      super-gsd/config/claude-ups-overlay.json declaring ONLY the UserPromptSubmit event
      mapped to sgsd-intent-classifier.cjs. Do NOT reuse repo-settings-overlay.json - it
      declares three events and merge-settings.js merges all of them, which contradicts the
      single-event stop_rule. Install with exactly this command, run from the repo root:
      node super-gsd/scripts/merge-settings.js --repo-local-hooks super-gsd/config/claude-ups-overlay.json .claude/settings.json .
      Add the corresponding UserPromptSubmit row to hooks.yaml. Ensure the classifier appends
      an EXPLICIT no-match row when no route matches - if it does not today, adding it is part
      of this task - and that every row carries session_id so probes can correlate. Build
      assert-live-dispatch.cjs, which launches a real headless Claude session
      (claude -p '<nonce> ...' --debug hooks --debug-file <tmp>) and passes ONLY when Claude's
      own debug record shows a UserPromptSubmit dispatch AND a new ledger row correlates to it
      by nonce and session_id. CRITICAL: never read, print or echo the settings env block;
      inspect only the hooks section by key. Do not modify the global settings file.
    output_contract: >
      A dedicated single-event overlay exists and is installed repo-locally, adding exactly one
      event. hooks.yaml reflects it. assert-registration.cjs confirms registration and that every
      hook command resolves to an existing file. assert-live-dispatch.cjs proves five things under
      genuine dispatch: planning-match, explicit no-match, P149 skill-routing match, P152 shadow
      row with zero injection, and a forged-direct-spawn control that MUST FAIL.
    hypothesis: "The mechanism is complete and merely unregistered; installing a single-event overlay repo-locally makes P149/P151/P152 execute live, and correlating a fresh nonce against Claude's own debug hook-dispatch record proves genuine dispatch in a way forged payload fields cannot, because a direct spawn cannot cause Claude to emit a dispatch record."
    falsifier: >
      The forged-spawn control passes, proving the probe does not discriminate genuine dispatch;
      or the merge introduces any event other than UserPromptSubmit; or a hook command in the
      merged settings points at a path that does not exist; or the P149 probe matches only the
      P146 compatibility route rather than the P149 registry; or the P152 probe shows any prompt
      injection or any text in the shadow ledger; or any assertion reads the settings env block;
      or the global settings file is modified.
    stop_rule: >
      Stop when the single-event merge is confirmed, all four live probes pass under genuine
      headless-Claude dispatch, and the forged-spawn control fails as required. Do not bind any
      other hook event and do not touch the global settings file.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-registration.cjs"
        - "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe planning"
        - "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe no-match"
        - "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe p149-skill-routing"
        - "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe p152-shadow"
        - "node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --control forged-spawn-must-fail"
        - "node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test"
  - id: "P153-T2"
    type: "blocking-guard"
    agent: codex
    model: codex
    depends_on: ["P153-T1"]
    files_touched:
      - "super-gsd/tools/codex-hooks/block-secret-leak.cjs"
      - "super-gsd/config/claude-ups-overlay.json"
      - "super-gsd/tests/hook-transport/assert-block-guard.cjs"
    input_contract: >
      block-secret-leak.cjs already reads UserPromptSubmit JSON from stdin and detects
      credential-bearing prompts, but it is wired only to the Codex hook surface and does not
      block. Make it block by exiting 2 with an operator-facing stderr reason naming the matched
      trigger, and register that SAME implementation on the Claude Code UserPromptSubmit surface
      by adding it to the dedicated overlay from T1. One implementation, two callers - extend, do
      not duplicate the detection logic. Exit 2 is the documented Claude Code contract for
      blocking a UserPromptSubmit hook. Do NOT add a generic fifth enforcement kind to the
      classifier registry: dropped at plan review as YAGNI with one current consumer. HARD
      CONSTRAINT: the P152 kb-lookup-triage route stays kind shadow; do not flip it, its 28-day
      metric has not unlocked. The stderr reason names the trigger and MUST NOT contain the
      matched credential value or any substring of it.
    output_contract: >
      A credential-bearing prompt on the Claude Code surface exits 2 with a stderr reason naming
      the trigger and containing no secret material; a benign prompt exits 0; both the Codex and
      Claude Code surfaces invoke a single shared implementation and return identical decisions
      for identical payloads. P152 remains shadow and assert-shadow.cjs still passes.
    hypothesis: "Warning-only enforcement does not change agent behaviour - the AHE paper records correct middleware warnings appended to tool output being ignored on the very next model turn, while hard-block at the shell layer produced the run's largest score jump - so making the existing guard exit 2 on the Claude surface is the smallest change that converts an inert detector into an actual control."
    falsifier: >
      A credential-bearing prompt is not blocked, or is blocked without a stderr reason naming the
      trigger, or the reason leaks the matched secret or a substring of it; a benign prompt is
      blocked; the two surfaces run separate copies of the detection logic; a generic block kind is
      added to the classifier registry; or the P152 shadow route changes behaviour.
    stop_rule: >
      Stop when the guard blocks and passes correctly on real spawned processes from the Claude
      surface, both surfaces share one implementation, and assert-shadow.cjs still passes. Do not
      flip P152 and do not add further blocking routes.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case secret"
        - "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case benign"
        - "node super-gsd/tests/hook-transport/assert-block-guard.cjs --case dual-surface-shared"
        - "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
---

# P153 — Hook Transport Completion (rev 3)

## Goal

`sgsd-intent-classifier.cjs` self-declares as a UserPromptSubmit hook. No UserPromptSubmit
event is registered, so governance built across P149, P151 and P152 never executes in a live
session. This phase registers it repo-locally via a dedicated single-event overlay, proves it
fires under genuine Claude Code dispatch, and makes the existing secret-leak guard actually block.

## Revision history

**Rev 1 → NOGO.** Target unnamed; a global merge of the three-event overlay would have installed
unrelated hooks with repo-relative args into every project. All 9 ACs were satisfiable by
spawning the classifier directly after a registration check — the harness-green/production-dead
pattern, instance #9, inside the plan meant to fix #7 and #8.

**Rev 2 → NOGO.** Pinned the target repo-local and re-anchored ACs on payload provenance
(`hook_event_name`, `session_id`, `transcript_path`). Review refuted the mechanism: a direct
stdin spawn can supply all three, including a copied real transcript path. Provenance fields are
forgeable. Review also caught a contradiction rev 2 introduced — the stop_rule said "bind no
other event" while prescribing an overlay declaring three, which `merge-settings.js` merges in
full, making the stop_rule unreachable on a clean target.

**Rev 3 closes all five round-2 blockers:**

1. **Forgeable provenance → causal correlation.** The probe launches a real headless Claude
   session with a fresh nonce (`claude -p ... --debug hooks --debug-file`) and passes only when
   Claude's *own* debug dispatch record correlates with the new ledger row. A direct spawn cannot
   cause Claude to emit a dispatch record, so the forged-spawn control fails by construction.
2. **Live P149 and P152 probes added** as their own ACs. The compatibility `planning-triage`
   route is not coverage for the P149 skill-routing registry — they are separate registries.
3. **Three-event overlay contradiction resolved** by a new dedicated
   `claude-ups-overlay.json` declaring only UserPromptSubmit.
4. **Full merge command stated verbatim** in T1's input contract.
5. **P154 acceptance tightened** to require successful post-fix real MCP calls, not just a
   pre-fix-failing test.

## Tasks

**T1** creates the single-event overlay, installs it repo-locally, adds the explicit no-match
row, and builds the causal dispatch probe with its forged-spawn control.

**T2** makes the existing guard exit 2 on the Claude surface from one shared implementation.

## Cost note

The live probes launch real headless Claude sessions and therefore consume quota on each
verification run. This is deliberate: it is the only mechanism that causally distinguishes
genuine dispatch from a forged spawn, which is precisely what rounds 1 and 2 died on.

## Orchestrator-owned (not a Codex task)

`STATE.md` frontmatter `current_phase` is stale at "150" while v3.6 has P151/P152 closed. State
files are orchestrator-owned per commit discipline; the orchestrator corrects it at phase close.

## Success Criteria

- Exactly one new event (UserPromptSubmit) registered repo-locally; every hook command resolves.
- Planning, no-match, P149 and P152 probes all pass under genuine headless-Claude dispatch,
  correlated by nonce and session_id against Claude's own debug record.
- The forged-direct-spawn control FAILS.
- P152 probe shows zero injection and a text-free shadow row.
- Credential-bearing prompt exits 2 with a trigger-naming reason carrying no secret material;
  benign prompt exits 0.
- Both hook surfaces share one implementation of the guard.
- `assert-shadow.cjs` passes; the global settings file is unmodified.
