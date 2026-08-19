---
schema_version: 2
phase: 155
slug: propagation-readiness
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 2
governing_decision: .planning/decisions/2026-08-19-canonical-work-identity-MEMO.md
governing_addendum: .planning/decisions/2026-08-19-canonical-work-identity-ADDENDUM.md
depends_on: ["153", "154"]
intent: >
  Make the v3.6 propagation core safe: unify hook installation, atomically stop
  creating the divergent phase root while making every named reader dual-root and
  scheme-safe through one normaliser, correct every resolver evidence tier, and only
  then wire the two decision paths to the resolver.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      The unified overlay exercised through all six original live transport modes:
      planning, no-match, p149-skill-routing, p152-shadow,
      forged-and-confused-must-fail, and stale-nonce-must-fail. These modes execute
      genuine Claude transport through assert-live-dispatch.cjs; a config grep is not
      evidence. The orchestrator runs them because the executor sandbox cannot spawn
      claude.
    expected_outcome: >
      Every live probe reaches the installed classifier and guard exactly once,
      expected routes and no-match behavior are observed, false proof is rejected,
      and P152 remains text-free shadow.
    verification_cmd: >
      node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe planning &&
      node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe no-match &&
      node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe p149-skill-routing &&
      node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --probe p152-shadow &&
      node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --control forged-and-confused-must-fail &&
      node super-gsd/tests/hook-transport/assert-live-dispatch.cjs --control stale-nonce-must-fail
  - input: >
      The unified overlay passed through registration, all three secret-guard cases,
      classifier controls, and the repo-owned shadow assertions without spawning
      Claude.
    expected_outcome: >
      Exactly one managed classifier and one managed guard are registered, every
      command resolves, guard decisions remain correct, and the executor-safe results
      combine with the live-mode evidence for all 11 P153 criteria.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-p153-regression.cjs --mode executor'
  - input: >
      Two isolated project fixtures run through the real install.sh entry point: a
      fresh project with no legacy root and an existing project with both roots. For
      each of the four production consumers, the fixtures also cover milestone-only,
      flat-only, both-root, and neither-root layouts; integer, decimal, and v-scheme
      names; a realpath-equivalent duplicate; and byte-hashed mutation sentinels.
    expected_outcome: >
      The fresh install does not create .planning/phases; reinstall preserves the
      existing tree and sentinels byte-for-byte. audit.cjs and all four consumers use
      the one shared normaliser, resolve each accepted scheme from either layout,
      process a canonical directory once, treat absent roots as empty, and never
      create, delete, or mutate fixture content.
    verification_cmd: >
      node super-gsd/tests/propagation-readiness/assert-install-layout.cjs --case all &&
      node super-gsd/tools/phase-folder-audit/audit.cjs --self-test &&
      node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool all --case full-matrix
  - input: >
      A generated devcp-shape project with exactly 146 flat phase directories,
      exactly 31 v-named directories, decimal and integer names, a ROADMAP ordering
      v30-07 as active, all three CONTEXT filename forms, and current_phase v30-07
      followed by an inline comment.
    expected_outcome: >
      resolveEffectiveState returns opaque token v30-07 from ROADMAP order. It never
      selects the highest integer, calculates next arithmetically, retains the inline
      comment, or recommends a backwards re-sync.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case devcp-mixed-flat'
  - input: >
      Isolated resolver fixtures forcing checkpoint, pulse, activity, and git tiers
      one at a time. Each carries v30-07 in its native shape, including a structured
      pulse row and a real temporary git repository with a feat(pv30-07) commit;
      invalid and ambiguous lookalikes are included as abstention controls.
    expected_outcome: >
      Each valid tier preserves and resolves v30-07 with its declared source and
      confidence, including pulse and git. An unsupported or ambiguous marker is
      ignored so the tier falls through; no tier truncates, coerces, or confidently
      misparses the token as an integer.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case evidence-tier-matrix'
  - input: >
      A project where STATE conflicts with stronger resolver evidence, passed through
      the exact decision-state command invoked by sgsd-orchestrate READ STATE.
    expected_outcome: >
      The command reports the derived milestone and opaque phase plus
      projection_stale and every conflict; raw STATE frontmatter is not presented as
      authoritative and no state is written.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer orchestrator'
  - input: >
      An isolated HOME and project containing a pre-existing stale
      ~/.claude/hooks/gsd-session-state.sh are run through the real install.sh with
      local and global installation enabled. The test then executes the hook from the
      isolated HOME with a real SessionStart payload against conflicting STATE and
      stronger resolver evidence.
    expected_outcome: >
      Installation replaces the stale live hook with the repo-owned hook, and executing
      that installed file emits the same derived state, projection_stale, and conflicts
      as the orchestrator command. The stale sentinel and raw STATE head output do not
      appear, and neither path writes STATE.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer installed-session-hook'
known_deadends:
  - Wiring either decision consumer before P155-T4b propagates confident wrongness.
  - No canonical work-identity registry, alias map, or physical renumbering.
  - No archiving or deleting an existing .planning/phases tree.
  - No filename arithmetic or num-plus-one next-phase derivation.
  - No copied phase-name regexes and no structural grep standing in for behavior.
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
      - super-gsd/tests/hook-transport/assert-shadow.cjs
      - super-gsd/tests/propagation-readiness/assert-p153-regression.cjs
    input_contract: >
      Move the complete managed secret-guard entry into the only overlay install.sh
      merges, delete claude-ups-overlay.json, retarget P153 assertions, and re-run the
      repo-local merge with an absolute project root. Preserve every other overlay
      event. Treat ignored .claude/settings.json as a verification side effect, not a
      committed file, and never inspect or print its env block. The regression runner
      exposes an executor-safe mode; the orchestrator separately invokes all six
      existing assert-live-dispatch.cjs probe/control modes for genuine Claude
      transport.
    output_contract: >
      One tracked overlay installs classifier and guard exactly once, the obsolete
      overlay is gone, executor-safe checks pass, and direct live-mode evidence closes
      all 11 P153 criteria without replacing transport with configuration inspection.
    hypothesis: >
      Moving the proven guard registration onto the real merge path closes the
      propagation seam without changing either hook implementation.
    falsifier: >
      A hook is absent or duplicated, another event disappears, any live mode or
      executor-safe assertion fails, a config grep substitutes for live transport,
      env is read, or a second overlay remains.
    stop_rule: >
      Stop only after the executor-safe command passes and the orchestrator records
      passing evidence for all six direct live modes. Commit only these tracked files.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-p153-regression.cjs --mode executor'
    expected_ATC_tier: FULL
  - id: P155-T2-T3
    type: atomic-installer-and-dual-root-compatibility-transition
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/install.sh
      - super-gsd/scripts/lib/phase-name.cjs
      - super-gsd/scripts/sgsd-conformance-check.sh
      - super-gsd/scripts/sgsd-agent-dashboard.sh
      - super-gsd/scripts/sgsd-distill-milestone.sh
      - super-gsd/tools/phase-verifier/phase-verifier.mjs
      - super-gsd/tools/phase-folder-audit/audit.cjs
      - super-gsd/tools/phase-folder-audit/audit.test.cjs
      - super-gsd/tools/state-resolver/resolve.cjs
      - super-gsd/tests/propagation-readiness/assert-install-layout.cjs
      - super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs
    input_contract: >
      Deliver one atomic compatibility commit. Create phase-name.cjs as the sole parser
      and discovery boundary for integer NN, decimal NN.N, and vNN-NN[.N] opaque phase
      tokens and their <token>-<slug> folder names. Export module functions for Node
      callers plus a JSON CLI for the shell consumers. Discovery scans the active
      milestone phases directory and optional flat .planning/phases directory, treats
      either missing root as empty, and deduplicates with fs.realpath-derived canonical
      keys before returning deterministic results. Route audit.cjs, all four production
      consumers, and every phase-name lookup in resolve.cjs through this helper; no
      consumer retains a private phase-name regex. Remove only install.sh's fresh
      creation of .planning/phases, preserving milestone setup and every existing tree.
      Add bounded one-shot/resolve-only modes only where a continuous consumer needs a
      testable production entry point.
    output_contract: >
      Consumer compatibility and the installer default change land in the same commit:
      no released state can omit the legacy root before all named readers are safe.
      Both layouts and all three schemes resolve through one normaliser, canonical
      duplicates are processed once, absent roots are non-errors, and every fixture
      remains byte-identical.
    hypothesis: >
      One shared scheme-aware parser plus realpath-deduplicated dual-root discovery
      removes both the shipped split and the verified integer-only audit defect without
      introducing identity machinery or migration.
    falsifier: >
      The installer change can land separately, any named reader retains a copied
      regex or single-root assumption, v/decimal/integer names diverge, an absent root
      fails, a canonical path is processed twice, a sentinel changes, or tests bypass
      a real production entry point.
    stop_rule: >
      Stop only when the real installer cases, expanded audit self-test, and every
      consumer across the full layout/name/dedup/absence/mutation matrix pass from one
      atomic commit.
    verification_cmd: >
      node super-gsd/tests/propagation-readiness/assert-install-layout.cjs --case all &&
      node super-gsd/tools/phase-folder-audit/audit.cjs --self-test &&
      node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool all --case full-matrix
    expected_ATC_tier: GATE
  - id: P155-T4b
    type: opaque-roadmap-ordered-phase-model
    agent: codex
    model: codex
    depends_on: [P155-T2-T3]
    files_touched:
      - super-gsd/scripts/lib/phase-name.cjs
      - super-gsd/tools/state-resolver/resolve.cjs
      - super-gsd/tests/propagation-readiness/assert-state-resolver.cjs
    input_contract: >
      Correct resolve.cjs before wiring consumers, using only the shared phase-name
      helper established by P155-T2-T3. Treat phase IDs as opaque ordered tokens.
      Derive active and next phase from the active ROADMAP table, never arithmetic;
      scan both layouts through shared discovery; accept CONTEXT.md,
      {id}-CONTEXT.md, and NN-CONTEXT.md; and strip inline comments from unquoted
      frontmatter scalars. Preserve all seven evidence tiers, projection_stale,
      conflicts, confidence, and graceful degradation. Route checkpoint, pulse,
      activity, folder, and git candidate parsing through the shared helper. Valid
      v-scheme checkpoint, pulse, activity-path, and feat(pv30-07) git inputs resolve
      without coercion; unsupported or ambiguous markers explicitly abstain and fall
      through. Add no registry, alias data, rename, or write.
    output_contract: >
      resolveEffectiveState handles all three schemes and both layouts while preserving
      evidence priority. The devcp-shaped fixture proves ROADMAP-ordered v30-07 wins;
      tier-isolated fixtures prove checkpoint, pulse, activity, and real git-log
      v-scheme evidence either resolves exactly as specified or safely abstains.
    hypothesis: >
      Shared recognition, ROADMAP ordering, dual-root discovery, and safe tier parsing
      remove every integer-shaped assumption that caused the confident wrong answer.
    falsifier: >
      Any tier truncates or coerces v30-07, pulse or git misresolves, an invalid marker
      becomes evidence, the fixture selects the highest integer, next is arithmetic,
      a CONTEXT form or inline comment fails, backward re-sync is advised, or private
      parser logic reappears.
    stop_rule: >
      Stop when existing resolver self-tests, devcp-mixed-flat, and the tier-isolated
      checkpoint/pulse/activity/git matrix pass. This commit MUST land before P155-T4.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case all'
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
      Consume P155-T4b resolveEffectiveState through one repo-owned adapter that
      renders derived milestone and opaque phase plus loud projection_stale/conflicts.
      Replace sgsd-orchestrate READ STATE with that command. Add the repo-owned
      gsd-session-state.sh using the same adapter and make install_global_assets deploy
      it to the exact live hook path. The installer test creates isolated HOME,
      USERPROFILE, and project fixtures, pre-seeds a distinguishable stale hook, runs
      the real install.sh with --init-project, --install-global, and
      --skip-cockpit-deps, then executes the installed hook with a real SessionStart
      payload. Do not infer deployment from repo bytes or configuration text. Keep the
      earlier installer-layout hunk unchanged and never auto-repair STATE.
    output_contract: >
      Both decision consumers render identical effective state and disagreement
      evidence. A real isolated install replaces and executes the live SessionStart
      surface; neither the stale hook nor raw STATE head survives, and no adapter or
      hook writes STATE.
    hypothesis: >
      One resolver-backed rendering boundary plus execution of the installed hook
      prevents both decision paths from independently trusting stale STATE.
    falsifier: >
      Raw frontmatter drives a consumer, warnings hide, consumers disagree, the real
      installer leaves the stale hook, only repo/config inspection is tested, installed
      execution differs, the adapter writes STATE, or ordering changes.
    stop_rule: >
      Stop only when the orchestrator command passes and the isolated real installer
      replaces and successfully executes the installed SessionStart hook.
    verification_cmd: 'node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer all'
    expected_ATC_tier: GATE
---

# P155 - Propagation Readiness

Revision 1 provenance remains explicit: its frontmatter was Codex-authored (dispatch
bunn0sa5b, gpt-5.6-sol/xhigh). That dispatch timed out after completing all 8 task
entries and 12 semantic acceptance criteria but before writing the closing delimiter
and body. The orchestrator appended the terminator and body and quoted the top-level
depends_on integers as strings for schema compliance; those were its only edits.

Revision 2 is Codex-authored under the operator's 2026-08-19 split. It contains four
propagation-core tasks and seven semantic acceptance criteria. T1 and the atomic
T2/T3 transition are independent. T4b consumes the shared phase normaliser and must
land before T4, because wiring first would propagate confident wrongness to both
decision paths.
