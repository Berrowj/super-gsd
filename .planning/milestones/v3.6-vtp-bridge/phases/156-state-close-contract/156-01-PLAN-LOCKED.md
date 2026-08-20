---
schema_version: 2
phase: 156
slug: state-close-contract
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 2
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
depends_on: ["155"]
intent: >
  Make STATE.md an honest atomic projection and refuse the DLB-03 dead-end
  where a phase has AUDIT.md but no well-shaped SUMMARY.md.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      A generated devcp-shaped project with ROADMAP order v30-06.8, v30-07,
      v30-08; stronger resolver evidence at v30-07; and a STATE.md containing
      unrelated legacy frontmatter and body text. The test injects a failure at
      the rename seam, then performs and repeats one plan-close write.
    expected_outcome: >
      Rename failure preserves the original hash and leaves no temp file. The
      successful write changes only milestone/current_phase/last_updated and the
      v30-07 progress block; unrelated bytes survive, and replay is a
      byte-identical changed=false success.
    verification_cmd: 'node super-gsd/tests/state-close-contract/assert-state-write.cjs --case atomic-idempotent'
  - input: >
      A devcp-shaped fixture whose STATE.md projection already records v30-08
      while the stronger resolver evidence and the incoming close event are at
      v30-07, plus same-phase and immediate-ROADMAP-successor controls.
    expected_outcome: >
      The backwards event exits non-zero with projection_ahead, keyed on the
      resolver's projection_stale/stale_sources signals with ROADMAP order used
      only to classify write direction, and leaves STATE byte-identical; the
      controls pass without arithmetic, lexical, filename, or num-plus-one
      phase ordering.
    verification_cmd: 'node super-gsd/tests/state-close-contract/assert-state-write.cjs --case refuse-backwards'
  - input: >
      The real install.sh entry point under isolated HOME/USERPROFILE and the
      exact plan-close and phase-close state.write commands documented in the
      orchestrator skill.
    expected_outcome: >
      The repo-owned boundary hook reaches the isolated live hook path, its old
      line-25 question becomes an accurate state.write ownership message, both
      orchestrator command shapes execute, and decision-state remains render-only.
    verification_cmd: 'node super-gsd/tests/state-close-contract/assert-state-write.cjs --case orchestrator-hook-wire'
  - input: >
      A generated devcp closed phase v30-06.8 with passing AUDIT.md and first no
      SUMMARY.md, then malformed SUMMARY frontmatter, submitted through the
      production skillRoutingConsult entry with moment=phase-close and execute=true.
    expected_outcome: >
      Both actual close attempts exit non-zero and invoke zero scheduled
      dispatches or state advances. The result names stable missing/malformed
      evidence; direct check.cjs execution alone is insufficient proof.
    verification_cmd: 'node super-gsd/tests/state-close-contract/assert-phase-close-route.cjs --case devcp-audit-without-summary'
  - input: >
      The same production close route with the exact P154 SUMMARY frontmatter
      shape and then the exact P155 shape.
    expected_outcome: >
      Both shapes pass; scheduled close execution proceeds exactly once under
      the fixture executor; SUMMARY authoring precedes check, state.write, and
      close commit; existing orchestrator-hooks self-tests stay green.
    verification_cmd: >
      node super-gsd/tests/state-close-contract/assert-phase-close-route.cjs --case passing-shapes &&
      node super-gsd/scripts/lib/orchestrator-hooks.cjs --self-test
known_deadends:
  - Do not add writes to state-resolver/resolve.cjs or scripts/lib/decision-state.cjs.
  - Do not copy phase parsers, compare opaque IDs arithmetically/lexically, create identity registries, aliases, or renumber folders.
  - Do not reserialize all STATE frontmatter; preserve unrelated frontmatter and body bytes.
  - Do not substitute source grep, tmp-file presence, or write atomicity for an actual close-route falsifier.
  - Do not accept AUDIT alone, body-only SUMMARY, empty required values, or mismatched phase identity.
  - Do not edit gates.yaml, skill-routing.yaml, or phase-folder-audit semantics and do not add a duplicate route.
  - Do not create super-gsd/scripts/gsd-phase-boundary.sh; that prompt path is absent, while the observed live file is ~/.claude/hooks/gsd-phase-boundary.sh and the repo-owned source belongs in super-gsd/hooks/.
tasks:
  - id: P156-T1
    type: atomic-state-projection-writer
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/state-write/write.cjs
      - super-gsd/tests/state-close-contract/assert-state-write.cjs
      - super-gsd/hooks/gsd-phase-boundary.sh
      - super-gsd/install.sh
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: >
      Work test-first: create the devcp assertion runner and record a genuinely
      failing red run before write.cjs exists. Export writeState(options) plus a
      CLI accepting one explicit event envelope: event plan-close|phase-close,
      projectDir, milestone, evidence_phase, requested current_phase,
      last_updated, and progress totals/completed counts/status row. Validate
      ranges and derive percent. Call resolveEffectiveState({projectDir});
      consume scripts/lib/phase-name.cjs and ROADMAP order only to classify
      same, immediate-forward, and backwards writes. Plan close stays on the
      resolved phase. Phase close requires evidence_phase equal to the resolved
      phase and requested current_phase equal to its immediate ROADMAP successor
      or complete at roadmap end. An exact already-applied projection returns
      changed=false. Resolver failure, ambiguous/absent ROADMAP identity,
      invalid progress, and evidence ahead of the event fail closed. Surgically
      patch top-level milestone/current_phase/last_updated and
      progress.<milestone-version-key> totals/percent/phase row only. Write a
      unique same-directory temp, fsync/close, rename over STATE, and clean temp
      on every failure. Return structured envelopes; CLI 0=success, 1=contract
      refusal, 2=input/I/O failure. Replace Step 11's manual mutation with the
      exact plan-close call and place the phase-close call at Step 6.6.j before
      Step 6.7. Add the observed global hook as a tracked
      super-gsd/hooks/gsd-phase-boundary.sh source, replace its line-25 question
      with state.write ownership wording, and extend install.sh's current hook
      copy loop to deploy it. Test only under isolated HOME/USERPROFILE.
    output_contract: >
      A separate atomic state.write primitive owns both close projections,
      consumes but never changes the P155 resolver, refuses backwards re-sync,
      preserves unrelated STATE bytes, and is byte-idempotent. The orchestrator
      calls it at both close points and the installed advisory states the same
      ownership without treating arbitrary PostToolUse writes as evidence.
    hypothesis: >
      A bounded event writer guarded by effective evidence and ROADMAP order can
      make STATE deterministic without contaminating the read side.
    falsifier: >
      The red run starts green; rename failure alters STATE or leaves debris;
      replay changes bytes; unrelated content changes; v30-08 rewinds to
      v30-07; a private parser/order guess appears; either close point hand-edits
      STATE; the old advisory survives isolated install; or any resolver,
      decision renderer, or registry file changes.
    stop_rule: >
      Stop after red evidence is recorded, assert-state-write --case all and
      resolver --self-test pass, the read-side/registry diff is empty, and T1 is
      one independently revertable commit.
    verification_cmd: >
      node super-gsd/tests/state-close-contract/assert-state-write.cjs --case all &&
      node super-gsd/tools/state-resolver/resolve.cjs --self-test
    expected_ATC_tier: GATE
  - id: P156-T2
    type: summary-phase-close-contract
    agent: codex
    model: codex
    depends_on: ["P156-T1"]
    files_touched:
      - super-gsd/tools/phase-close/check.cjs
      - super-gsd/tests/state-close-contract/assert-phase-close-route.cjs
      - super-gsd/scripts/lib/orchestrator-hooks.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: >
      Implement review change 6 verbatim: "Define who creates phase SUMMARY.md, its passing shape and pre-close ordering, then test the actual close route, not just write atomicity." Work red-first
      on the actual route: before implementing the gate, record a genuinely
      failing run of the production skillRoutingConsult/CLI route against the
      devcp AUDIT-without-SUMMARY fixture (today it wrongly proceeds) and
      preserve that red evidence in the report. Add read-only checkPhaseClose API/CLI.
      Locate the phase through phase-name.cjs and require existing AUDIT.md plus
      SUMMARY.md with delimited YAML frontmatter: phase equals the requested
      opaque token; slug equals folder slug; milestone equals the request;
      status begins PASS or ends COMPLETE/COMPLETED/CLOSED; closed is a real
      YYYY-MM-DD calendar date; commits is a non-empty array of 7-40 hex strings;
      gates is a non-empty mapping of non-empty scalar verdicts. Parse through the
      repository's existing js-yaml dependency with JSON_SCHEMA so closed remains
      a string, and reject duplicate keys. Unknown fields remain forward-compatible.
      Malformed YAML, identity mismatch, empty values, missing AUDIT, and
      missing/body-only SUMMARY refuse with stable reason codes. API never writes;
      CLI 0=pass, 1=refusal, 2=input/internal failure. Invoke this preflight inside the existing
      skillRoutingConsult path only for moment=phase-close plus execute=true,
      before scheduled dispatch. Refusal returns ok=false with close_contract,
      runs zero dispatches, and makes the CLI non-zero; do not change a registry.
      Encode this order in sgsd-orchestrate: after verification/ATC/audit
      evidence, the orchestrator authors SUMMARY; the actual consult validates
      AUDIT+SUMMARY; T1 state.write advances STATE; the close commit includes
      SUMMARY+STATE; only then Step 6.7 runs. The falsifier must call exported
      skillRoutingConsult using the production registry loader and a fixture
      dispatch executor, then spawn the production CLI wrapper against a generated
      benign registry to prove refusal/pass exit codes. Exercise devcp v30-06.8
      with AUDIT/no SUMMARY, malformed SUMMARY, exact P154 shape, and exact P155 shape.
    output_contract: >
      SUMMARY is orchestrator-owned before close and its seven-field passing
      shape is mechanical. The executable close route refuses AUDIT-only and
      malformed phases before dispatch/state advance and accepts both established
      passing shapes before atomic state.write and the close commit.
    hypothesis: >
      A focused preflight inside the already-called consult closes the DLB-03
      handover dead-end without duplicating audit or registry machinery.
    falsifier: >
      AUDIT without valid SUMMARY reaches a dispatch, state.write, close commit,
      or Step 6.7; the pre-fix actual-route red run is missing or starts green;
      malformed identity passes; P154/P155 fail; direct checker
      tests replace actual-route evidence; CLI refusal exits 0; registry/read
      side changes; or T2 cannot be reverted independently after T1.
    stop_rule: >
      Stop when all actual-route cases and orchestrator-hooks --self-test pass,
      ordering is explicit, the registry/read-side diff is empty, and T2 is one
      commit independently revertable after T1.
    verification_cmd: >
      node super-gsd/tests/state-close-contract/assert-phase-close-route.cjs --case all &&
      node super-gsd/scripts/lib/orchestrator-hooks.cjs --self-test
    expected_ATC_tier: GATE
---

# P156 - State-Close Contract

Two serial, independently revertable commits close the contract. T1 adds the
write side and truthful advisory. T2 makes SUMMARY an orchestrator-owned
pre-close artifact and proves both refusal and passage through the executable
close route. Resolver/parser semantics and all registries stay unchanged.

## AMENDMENT-1 (2026-08-20, orchestrator-recorded, plan-review round 1)

Review verdict GO-WITH-CHANGES (156-PLANREVIEW-REPORT.md, 0 CRITICAL). Both
required changes applied above as revision 2:

1. SAC-2 direction corrected: the refusal case is the STATE projection ahead
   (v30-08) of stronger resolver evidence and the incoming event (v30-07);
   state.write must consume the resolver's projection_stale/stale_sources
   signals, use ROADMAP order only to classify write direction, and prove
   byte-identical refusal.
2. T2 is red-first on the actual route: a genuinely failing pre-fix run of the
   production skillRoutingConsult/CLI route for AUDIT-without-SUMMARY is
   contractual evidence before the gate is implemented.
