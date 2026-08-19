---
schema_version: 2
phase: 155
slug: propagation-readiness
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 1
governing_decision: .planning/decisions/2026-08-19-canonical-work-identity-MEMO.md
governing_addendum: .planning/decisions/2026-08-19-canonical-work-identity-ADDENDUM.md
depends_on: ["153", "154"]
intent: >
  Make v3.6 safe to propagate: unify hook installation, stop creating the divergent
  phase root, dual-root blind consumers, correct the resolver before wiring decision
  paths, make STATE writes honest, record and probe VTP services, and reject automated
  task notifications at planning routes.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      The unified overlay followed by assert-registration.cjs, all six original
      assert-live-dispatch.cjs modes: planning, no-match, p149-skill-routing,
      p152-shadow, forged-and-confused-must-fail, and stale-nonce-must-fail;
      all three guard cases; and assert-shadow.cjs. The orchestrator runs the
      genuine Claude probes.
    expected_outcome: >
      Exactly one managed classifier and guard are installed; all commands resolve;
      controls reject false proof; guard decisions remain correct; P152 stays
      text-free shadow; all 11 P153 criteria pass.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-p153-regression.cjs --mode all'
  - input: >
      A disposable fresh project and an existing project with a legacy sentinel,
      each run through the real install.sh entry point.
    expected_outcome: >
      The fresh project has no .planning/phases; the existing legacy directory and
      sentinel remain byte-identical.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-install-layout.cjs --case all'
  - input: >
      The real conformance checker against a phase present only under the milestone
      tree, with no legacy root.
    expected_outcome: It resolves and checks the milestone-tree phase instead of exiting 3.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool conformance'
  - input: >
      The real agent dashboard in bounded one-shot mode against a phase present only
      under the active milestone tree.
    expected_outcome: Its snapshot names and reads the phase without requiring a legacy root.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool agent-dashboard'
  - input: >
      The real milestone distiller against phase artifacts present only under a
      milestone phases directory.
    expected_outcome: Its output contains the sentinel and it does not require or mutate a legacy root.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool distill-milestone'
  - input: >
      The real phase verifier against a requested phase present only below the
      milestone phases directory.
    expected_outcome: It consumes that phase input; missing legacy root is not phase-not-found.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool phase-verifier'
  - input: >
      A generated devcp-shape project with exactly 146 flat phase directories,
      exactly 31 v-named directories, v-named and decimal phases mixed with legacy
      integers, a ROADMAP ordering v30-07 as active, all three CONTEXT filename
      forms, and current_phase v30-07 followed by an inline comment.
    expected_outcome: >
      resolveEffectiveState returns opaque token v30-07 from roadmap order. It never
      selects the highest legacy integer, calculates next arithmetically, retains the
      comment, or recommends a backwards re-sync.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case devcp-mixed-flat'
  - input: >
      A project where STATE conflicts with stronger roadmap/folder evidence, passed
      through the exact decision-state command used by sgsd-orchestrate READ STATE.
    expected_outcome: >
      It reports derived milestone/phase plus projection_stale and every conflict;
      raw STATE is not presented as authoritative.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer orchestrator'
  - input: >
      The same stale project passed through the repo-owned gsd-session-state.sh that
      install.sh deploys to the Claude hooks directory.
    expected_outcome: >
      SessionStart injects the same derived state and loud warnings, not raw head
      output from STATE.md.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer session-hook'
  - input: >
      Plan-close and phase-close transitions against copies of a real schema-shaped
      STATE with an opaque phase. Phase close is tried with AUDIT only, then AUDIT
      plus SUMMARY.
    expected_outcome: >
      Plan close advances once. AUDIT-only close fails byte-identically; adding
      SUMMARY allows one atomic, idempotent phase advance.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-write.cjs --case all'
  - input: >
      The VTP registry consumed by the real readiness checker with controlled
      reachable Qdrant, present evidence store, stale dist/child timestamps, two
      concurrent ingest attempts, and a three-row pending ledger sent through the
      real SessionStart hook.
    expected_outcome: >
      Runtime standardizes on vtp-kb, uses only the six environment names, resolves
      data below ~/.vtp, enforces both pins, reports service health without values,
      warns reconnect MCP rather than rebuild/auto-invoke, admits one writer, and
      surfaces pending depth 3 only.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-vtp-services.cjs --case all'
  - input: >
      Two real UserPromptSubmit payloads: an automated task-notification containing
      planning words, and a genuine operator request to plan the next phase.
    expected_outcome: >
      The automated turn produces no P149/P146 planning match; the operator prompt
      still produces the established planning route.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-notification-routing.cjs --case all'
known_deadends:
  - Wiring decision consumers before T4b propagates confident wrongness.
  - No canonical work-identity registry, alias map, or physical renumbering.
  - No archiving or deleting existing .planning/phases trees.
  - No filename arithmetic or num-plus-one next-phase derivation.
  - No automatic MCP calls; P154 argument-shape work remains open.
  - No structural grep standing in for semantic behavior.
tasks:
  - id: P155-T1
    type: hook-overlay-unification
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/config/repo-settings-overlay.json
      - super-gsd/config/claude-ups-overlay.json
      - super-gsd/tests/hook-transport/assert-registration.cjs
      - super-gsd/tests/hook-transport/assert-block-guard.cjs
      - super-gsd/tests/propagation-readiness/assert-p153-regression.cjs
    input_contract: >
      Move the complete managed secret-guard entry into the only overlay install.sh
      merges, delete claude-ups-overlay.json, retarget P153 assertions, and re-run the
      repo-local merge with an absolute project root. Preserve all other overlay
      events. Treat ignored .claude/settings.json as a verification side effect, not
      a committed file, and never inspect or print its env block.
    output_contract: >
      One tracked overlay installs classifier and guard exactly once. The obsolete
      overlay is gone and the full 11-of-11 P153 suite passes. The orchestrator runs
      the four genuine Claude probes; Codex runs registration, controls, guard, and
      shadow checks.
    hypothesis: >
      Moving the proven guard registration onto the real merge path closes the
      propagation seam without changing either hook implementation.
    falsifier: >
      Devcp still lacks a hook, an entry duplicates, another event disappears, any
      six-mode/live or 11-of-11 assertion fails, env is read, or a second overlay remains.
    stop_rule: >
      Stop after the merge and all P153 evidence pass. Commit only these tracked files.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-p153-regression.cjs --mode all'
    expected_ATC_tier: FULL
  - id: P155-T2
    type: installer-layout-default
    agent: codex
    model: codex
    depends_on: [P155-T1]
    files_touched:
      - super-gsd/install.sh
      - super-gsd/tests/propagation-readiness/assert-install-layout.cjs
    input_contract: >
      Remove only fresh creation of .planning/phases from install.sh. Preserve
      milestone-root creation and all other behavior. Exercise the real installer
      for fresh and existing-legacy cases.
    output_contract: >
      Fresh installs omit the flat root; reinstall never mutates an existing tree.
    hypothesis: Removing one mkdir target stops divergence without migration.
    falsifier: >
      A fresh install creates the root, a sentinel changes, another directory is
      omitted, or the test does not invoke install.sh.
    stop_rule: Stop when both cases pass; keep this install.sh hunk separate from T4.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-install-layout.cjs --case all'
    expected_ATC_tier: FULL
  - id: P155-T3
    type: dual-root-phase-resolution
    agent: codex
    model: codex
    depends_on: [P155-T2]
    files_touched:
      - super-gsd/scripts/sgsd-conformance-check.sh
      - super-gsd/scripts/sgsd-agent-dashboard.sh
      - super-gsd/scripts/sgsd-distill-milestone.sh
      - super-gsd/tools/phase-verifier/phase-verifier.mjs
      - super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs
    input_contract: >
      Apply phase-folder-audit traversal to each real consumer: active milestone tree
      plus unarchived flat root, canonical-path deduplication, and absent root as empty.
      Add only minimal one-shot/resolve-only modes for continuous/UI consumers.
    output_contract: >
      All four tools read both layouts without migration or deletion.
    hypothesis: The existing dual-root pattern restores visibility without identity machinery.
    falsifier: >
      Any tool remains single-root, absent roots fail, paths process twice, or a test
      bypasses the real entry point.
    stop_rule: Stop when all four per-tool commands pass in one isolated commit.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool all'
    expected_ATC_tier: FULL
  - id: P155-T4b
    type: opaque-roadmap-ordered-phase-model
    agent: codex
    model: codex
    depends_on: [P155-T3]
    files_touched:
      - super-gsd/tools/state-resolver/resolve.cjs
      - super-gsd/tests/propagation-readiness/assert-state-resolver.cjs
    input_contract: >
      Correct resolve.cjs before wiring consumers. Phase IDs are opaque ordered tokens.
      Add bounded recognition plugins for NN, NN.N, and vNN-NN[.N], but derive order
      and next only from the active ROADMAP phase table. Scan milestone and flat roots;
      accept CONTEXT.md, {id}-CONTEXT.md, and NN-CONTEXT.md; strip inline comments from
      unquoted scalars. Preserve seven evidence tiers, projection_stale, conflicts,
      confidence, and graceful degradation. Add no registry, alias data, rename, or write.
    output_contract: >
      resolveEffectiveState handles all three schemes and both layouts. The generated
      fixture has exactly 146 flat dirs including exactly 31 v-named dirs plus decimal
      and legacy integer names, and proves v30-07 wins without backward repair advice.
    hypothesis: >
      Recognition, layout, scalar parsing, and arithmetic ordering caused devcp's wrong
      answer; correcting them inside the resolver restores trustworthy derived state.
    falsifier: >
      The fixture selects the highest legacy integer, drops v30-07, derives next
      arithmetically, emits backward re-sync, misses a CONTEXT form, retains the inline
      comment, or requires registry/aliases.
    stop_rule: >
      Stop when existing self-tests and devcp-mixed-flat pass. This commit MUST land
      before P155-T4; do not wire consumers first.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case devcp-mixed-flat'
    expected_ATC_tier: GATE
  - id: P155-T4
    type: decision-path-resolver-wiring
    agent: codex
    model: codex
    depends_on: [P155-T4b]
    files_touched:
      - super-gsd/scripts/lib/decision-state.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/hooks/gsd-session-state.sh
      - super-gsd/install.sh
      - super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs
    input_contract: >
      Consume T4b resolveEffectiveState through one repo-owned adapter rendering
      derived milestone/phase and loud projection_stale/conflicts. Replace orchestrator
      READ STATE with it. Add a repo-owned session hook using the same adapter and make
      install_global_assets deploy it. Keep T2's hunk untouched; never auto-repair.
    output_contract: >
      Both decision consumers present identical effective state and disagreement
      evidence; install/update replaces raw STATE head injection with the owned hook.
    hypothesis: >
      One resolver-backed rendering boundary prevents independent trust in stale state.
    falsifier: >
      Raw frontmatter drives a consumer, warnings hide, consumers disagree, install
      leaves the old hook, the adapter writes STATE, or T4 changes ordering.
    stop_rule: Stop when both consumers and hook deployment pass in an isolated commit.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer all'
    expected_ATC_tier: GATE
  - id: P155-T5
    type: vtp-services-contract-and-readiness
    agent: codex
    model: codex
    depends_on: [P155-T4c]
    files_touched:
      - super-gsd/registry/vtp-services.yaml
      - super-gsd/tools/vtp-readiness/check.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/skills/sgsd-readiness/SKILL.md
      - super-gsd/hooks/sgsd-session-start.js
      - super-gsd/tests/propagation-readiness/assert-vtp-services.cjs
    input_contract: >
      Create the durable contract with server registrations standardized on vtp-kb;
      env NAMES only: QDRANT_URL, VTP_EMBED_PYTHON, VTP_EVIDENCE_STORE_URL,
      CLARITY_MONGO_URI, CLARITY_MONGO_DB, CLARITY_ES_URL; canonical/mirror paths
      below ~/.vtp; Qdrant client 1.18.0; sentence-transformers never-upgrade;
      pending ledger ~/.vtp/pending-ledger.jsonl; and lock ~/.vtp/ingest.lock.
      Add a bounded checker used by automatic Rule 0 and manual readiness for
      dist-vs-src freshness, Qdrant reachability, and evidence-store presence.
      Stale child is WARN with reconnect-MCP guidance, never rebuild/reconnect action.
      SessionStart counts valid pending rows and emits depth only. Optional VTP absence
      degrades gracefully.
    output_contract: >
      YAML is the non-secret contract. Readiness returns structured freshness/service/
      pin/lock statuses and emits only variable names/reason codes. SessionStart surfaces
      pending depth without blocking. Neither path adds an MCP invocation.
    hypothesis: >
      A names-only contract plus bounded probes distinguishes configuration,
      availability, and stale-child failures without duplicating VTP data.
    falsifier: >
      A secret value persists/prints; names diverge from vtp-kb; paths escape ~/.vtp;
      pins vanish; two writers lock; stale recommends rebuild or auto-invokes MCP;
      optional absence blocks SGSD; or pending contents leak.
    stop_rule: >
      Stop when service, stale-child, single-writer, and pending-ledger behavior pass
      with existing SessionStart regressions. Keep Rule 0/SessionStart hunks isolated.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-vtp-services.cjs --case all'
    expected_ATC_tier: GATE
  - id: P155-T4c
    type: atomic-state-write-and-close-contract
    agent: codex
    model: codex
    depends_on: [P155-T4]
    files_touched:
      - super-gsd/scripts/lib/sgsd-state.cjs
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/tests/propagation-readiness/assert-state-write.cjs
    input_contract: >
      Add explicit state.write used at orchestrator plan close and phase close. Accept
      opaque phase tokens, preserve unrelated frontmatter/body, validate the transition,
      write a same-directory temporary plus atomic rename, and be idempotent. Resolve
      DLB-03 by ADDING SUMMARY.md to phase close beside passing AUDIT.md. Missing or
      non-passing evidence must leave STATE byte-identical and fail loudly.
    output_contract: >
      Plan close advances plan/progress once. Phase close advances only after both
      AUDIT.md and SUMMARY.md pass. Failed/repeated writes cannot partially alter STATE.
    hypothesis: >
      One validated atomic write boundary makes automatic-update promises true and
      removes the close/cascade contradiction.
    falsifier: >
      Updates remain advisory, partial writes occur, repeats double-advance, opaque IDs
      become numbers, AUDIT-only close succeeds, or missing evidence changes STATE.
    stop_rule: >
      Stop when plan-close, refusal, success, idempotence, and atomic-failure cases pass;
      keep close hunks separate from T4 READ STATE.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-write.cjs --case all'
    expected_ATC_tier: GATE
  - id: P155-T6
    type: operator-only-planning-route-predicate
    agent: codex
    model: codex
    depends_on: [P155-T5]
    files_touched:
      - super-gsd/registry/session-governance-hooks.yaml
      - super-gsd/hooks/sgsd-intent-classifier.cjs
      - super-gsd/tests/propagation-readiness/assert-notification-routing.cjs
    input_contract: >
      Add a table-owned operator-origin predicate to P146 planning-triage and adapted
      P149 routes. Detect the actual task-notification envelope before lexical matching;
      do not grow a phrase blacklist or suppress operator prompts. The existing route
      table is not a canonical work-identity registry.
    output_contract: >
      Notifications cannot produce planning directives/suggestions; genuine operator
      planning still routes; execution and KB-shadow behavior is unchanged.
    hypothesis: Origin gating removes the false positive without weakening operator vocabulary.
    falsifier: >
      A notification still matches, operator planning stops matching, phrases are
      enumerated, shadow behavior changes, or MCP is invoked.
    stop_rule: Stop when both directions and classifier/shadow self-tests pass.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-notification-routing.cjs --case all'
    expected_ATC_tier: FULL
---

# P155 — Propagation Readiness

Frontmatter above is Codex-authored (dispatch bunn0sa5b, gpt-5.6-sol/xhigh). The
dispatch hit its 1500s timeout after completing all 8 task entries and 12 semantic
acceptance criteria but before writing the closing delimiter and this body. The
orchestrator appended the terminator and this note, and quoted the depends_on
integers to strings to satisfy the schema. Those are the only orchestrator edits. See CONTEXT.md for the full evidence base and boundaries, and the governing
memo plus addendum for what is deliberately out of scope (registry, alias map,
renumbering, legacy-tree archiving, D7).

Task order encodes the devcp lesson: T4b (resolver phase model) lands before T4
(wiring consumers to the resolver), because wiring first would propagate confident
wrongness to every instance.
