---
schema_version: 2
phase: 160
slug: installer-registration-guard
milestone: v3.7-upstream-hardening
status: PLANNED
revision: 1
governing_decision: .planning/milestones/v3.7-upstream-hardening/phases/160-installer-registration-guard/CONTEXT.md
depends_on: []
intent: >
  Make every installer-owned hook registration fail closed before settings are
  written, keep the shipped Claude overlay aligned with the provider lock, and
  prove the installed hook topology can load from its deployed locations.
execution_mode: serial-codex-with-orchestrator-spawn-checkpoints
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      The exact Clarity-shaped vendored super-gsd fixture with nine files under
      hooks/: sgsd-session-start.js is present, while
      sgsd-intent-classifier.cjs, sgsd-quality-gate.js, and
      tools/codex-hooks/block-secret-leak.cjs are absent. The real install.sh
      repo-local path runs against an isolated target whose settings file has a
      byte-hashed unrelated sentinel registration.
    expected_outcome: >
      Installation exits non-zero before merge, stderr names the first missing
      absolute hook path with hook_registration_missing, the settings hash is
      unchanged, no settings.json.tmp remains, and none of the four SGSD
      repo-local registrations is partially written.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case vendored-nine-hook'
  - input: >
      The production global and repo-local overlays plus generated copies with
      first a missing script and then an existing syntactically-invalid Node
      script, exercised through each real install.sh merge site under isolated
      HOME/USERPROFILE and target directories with pre-hashed settings.
    expected_outcome: >
      All four site/failure combinations exit non-zero; missing paths carry
      hook_registration_missing and invalid scripts carry
      hook_registration_node_check_failed, always with the offending realized
      path. Neither settings target changes or leaves a temp artifact.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case node-check-both-sites'
  - input: >
      A temporary vendored copy of the real canonical source tree with exactly
      the current sixteen super-gsd/hooks files, the production overlays, and
      real install.sh --install-global --init-project under isolated roots.
    expected_outcome: >
      Installation exits 0; both settings files preserve unrelated entries,
      contain every expected SGSD registration exactly once, and every realized
      script path is an existing regular file that passes its interpreter syntax
      check. Repeating the install is byte-idempotent for both settings files.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook'
  - input: >
      The production CLAUDE-OVERLAY.md and generated copies that inject, one at
      a time, the locked stale memory and provider-dispatch markers; then a real
      fresh --init-project installation from the unmodified bundled overlay.
    expected_outcome: >
      The installer self-test rejects every mutated copy with
      bundled_overlay_stale plus the marker id. The production overlay passes,
      the fresh target CLAUDE.md is byte-equal to it, names only
      .planning/memory for live memory routing, contains no Haiku dispatch, and
      confines Sonnet wording to the CURRENT PROVIDER LOCK prohibition.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current'
  - input: >
      Real global and repo-local installs from the canonical sixteen-hook source
      layout, followed by a dependency-broken copy where an entry file remains
      present and node --check-clean but one of its top-level sibling libraries
      is absent.
    expected_outcome: >
      The canonical install spawns each installer-deployed hook exactly once
      with its event-shaped benign payload before either registration merge and
      exits 0. The broken copy exits non-zero with hook_smoke_failed naming the
      entry hook, writes no registration bytes, and proves node --check alone
      cannot substitute for installed-location dependency resolution.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case deployed-hook-smoke'
known_deadends:
  - Do not add isolated test -f checks beside only one install.sh merge call; the pre-write merge boundary must protect global, repo-local, update, and direct callers uniformly.
  - Do not silently skip, filter, or partially merge missing or invalid SGSD hook entries. One failed path refuses the complete overlay batch for that settings target.
  - Do not treat source grep, overlay parsing alone, node --check alone, or a mocked child process as end-to-end proof that an installed hook loads.
  - Do not repoint repo-local registrations to another canonical checkout; P153 repo-local paths remain rooted in the target repository.
  - Do not preserve flat global copies of repo-local-only entry files whose sibling dependency topology is absent, and do not change hook semantics to hide packaging defects.
  - Do not reject the CURRENT PROVIDER LOCK sentence that prohibits Sonnet; the drift rule distinguishes that prohibition from stale Sonnet dispatch instructions.
  - Do not spawn claude from any fixture or verification command. Spawn-bound cases use Node, Git Bash where required, and the installed hook interpreters only.
  - Do not duplicate an SGSD gate, edit gates.yaml, alter either settings overlay's registration semantics, or write outside isolated fixture roots during tests.
tasks:
  - id: P160-T1
    type: atomic-hook-registration-preflight
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/scripts/lib/hook-registration-preflight.cjs
      - super-gsd/scripts/merge-settings.js
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
    input_contract: >
      Work red-first from the exact Clarity failure, not the canonical checkout.
      First create the phase assertion runner and its vendored-nine-hook case:
      copy the production installer/config/merge support into a temporary
      vendored super-gsd, retain exactly nine hook files including
      sgsd-session-start.js, remove sgsd-intent-classifier.cjs,
      sgsd-quality-gate.js, and tools/codex-hooks/block-secret-leak.cjs, seed an
      unrelated repo settings sentinel, and have the orchestrator record the
      genuine pre-fix non-zero expectation failure because registrations are
      currently written. Add a global missing-source control, then a second red
      direction that replaces one existing Node entry with invalid JavaScript;
      run the missing and invalid directions through both global and repo-local
      install paths. Implement a focused CommonJS helper that enumerates every
      command-typed script in the already-realized overlay, including top-level
      statusLine and every hooks.<event>[].hooks[] command; rejects malformed or
      unsupported launch shapes; and returns stable path plus event/hook-id
      descriptors. In mergeSettingsFiles, realize the complete overlay first,
      then invoke this helper before reading/mutating the target, deduping hooks,
      creating its directory, or writing settings.json.tmp. Require every
      script descriptor to resolve to an existing regular file. For every Node
      descriptor synchronously execute process.execPath --check <absolute-path>
      with shell=false and a bounded timeout; for the one current Bash script,
      require the file and run bash -n rather than sending shell syntax to Node.
      Any missing file, checker spawn error, signal, timeout, or non-zero status
      throws a stable hook_registration_missing or
      hook_registration_node_check_failed/hook_registration_shell_check_failed
      error naming the realized script path; never copy raw child output into
      the error. Keep merge-settings' atomic rename, repo-root/symlink boundary,
      idempotence, user-entry preservation, and existing self-test behavior.
      Update its repo-local self-test fixture to materialize syntax-valid stub
      files for all four overlay paths before invoking the production merge.
      Placement is locked here rather than duplicated in install.sh: all writes
      flow through merge-settings, so direct merge callers and both installer
      sites receive the same all-or-nothing guard. The helper accepts injected
      existence/check functions solely for spawn-free executor tests; production
      defaults always perform real filesystem and interpreter checks.
    output_contract: >
      One reusable preflight owns overlay command enumeration and syntax/path
      validation. Both merge sites refuse a complete registration batch before
      any settings write, report the exact dead path, and retain all existing
      merge safety and idempotence behavior. The exact nine-hook failure and
      both-site syntax failure are executable integration fixtures, while the
      canonical sixteen-hook layout remains a real-install control.
    hypothesis: >
      Validating the fully realized overlay at the single atomic merge boundary
      prevents an absent or unparseable entry file from ever becoming a live
      registration, regardless of which installer route called the merger.
    falsifier: >
      The Clarity fixture starts red for the wrong reason; either merge site
      writes, truncates, dedupes, or leaves a temp file before all descriptors
      pass; any missing/invalid error omits its realized path; a Node entry is
      accepted without a real node --check in production; the canonical sixteen
      layout fails or duplicates; existing user settings change on refusal; the
      guard exists only in install.sh; merge self-tests regress; or T1 cannot be
      reverted as one commit.
    stop_rule: >
      Stop after the executor's injected spawn-free contract case passes, the
      orchestrator has recorded red then green for vendored-nine-hook and
      node-check-both-sites, canonical-sixteen-hook and
      merge-settings --self-test-repo-local-hooks exit 0, the diff is limited to
      the three listed files, and T1 is one independently revertable commit.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case preflight-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case vendored-nine-hook &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case node-check-both-sites &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook &&
      node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks
    expected_ATC_tier: GATE
  - id: P160-T2
    type: bundled-overlay-provider-lock-refresh
    agent: codex
    model: codex
    depends_on: ['P160-T1']
    files_touched:
      - super-gsd/CLAUDE-OVERLAY.md
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
    input_contract: >
      Refresh only the bundled operator overlay installed as a fresh project's
      CLAUDE.md. Preserve the CURRENT PROVIDER LOCK and its explicit Sonnet
      prohibition, but remove the remaining historical provider/memory wording:
      describe classifier/context work as local with no model-agent spawn; make
      the live memory section name only .planning/memory plus MEMORY.md and the
      sgsd-recall/sgsd-curate interface; remove ByteRover/BRV routing and fallback
      prose; and carry no Haiku dispatch wording below the provider lock. In the
      phase assertion runner, define a closed stale-marker table with stable ids
      for query_byterover, byterover_results, brv_queries,
      brv_context_tree_route, haiku_agent_dispatch, sonnet_agent_dispatch, and
      legacy_sonnet_role_row. The scanner must allow the Sonnet prohibition only
      inside the CURRENT PROVIDER LOCK block and reject positive dispatch/model
      rows elsewhere. Test the real production overlay, then generate one
      temporary mutation per marker and require bundled_overlay_stale plus the
      marker id without echoing the injected line. Add a fresh-install direction
      that runs production install.sh --init-project --skip-cockpit-deps into an
      empty isolated project and asserts its created CLAUDE.md is byte-equal to
      the passing bundled overlay. The static scanner/mutation matrix contains no
      child process and is executor-runnable; the real install direction is
      orchestrator-run because it spawns Bash/Node.
    output_contract: >
      Fresh clones receive current Codex/local and .planning/memory guidance,
      the provider lock remains authoritative, and a mechanical installer
      self-test catches reintroduced ByteRover/BRV or Haiku/Sonnet dispatch text
      before it can ship.
    hypothesis: >
      A closed marker contract plus byte-equality against a real fresh install
      prevents stale overlay instructions from surviving behind a newer
      top-of-file provider disclaimer.
    falsifier: >
      Any generated stale marker passes; the provider lock's Sonnet prohibition
      is falsely rejected or removed; the production overlay still routes live
      memory through ByteRover/BRV or dispatches Haiku/Sonnet; a fresh install
      differs from the checked bundle; settings registration semantics change;
      the proof is grep-only without mutation controls; or T2 cannot be reverted
      independently after T1.
    stop_rule: >
      Stop when the spawn-free marker mutation matrix and orchestrator-run fresh
      install both pass, T1's full verification remains green, the diff is
      exactly the two listed files, and T2 is one independently revertable
      commit after T1.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case vendored-nine-hook
    expected_ATC_tier: GATE
  - id: P160-T3
    type: installed-hook-dependency-smoke
    agent: codex
    model: codex
    depends_on: ['P160-T2']
    files_touched:
      - super-gsd/install.sh
      - super-gsd/scripts/lib/hook-registration-preflight.cjs
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
    input_contract: >
      Extend T1's helper with a smoke API/CLI, but keep smoke at install time
      rather than making direct settings merges execute hooks. Use one explicit
      global deployment manifest in install.sh containing the eleven command
      scripts derived from settings-overlay.json plus the tracked auxiliary
      gsd-phase-boundary.sh; the test must compare this manifest with the overlay
      paths so registration and copy drift fails. Do not flatten repo-local-only
      sgsd-session-start.js or sgsd-quality-gate.js into ~/.claude/hooks without
      their repo topology, and do not change either hook's loader semantics.
      Keep their sources in the canonical sixteen-hook tree for repo-local use.
      Reorder the existing global settings merge until after the scripts/lib,
      stop-handoff script, and state-resolver dependency copy completes. Before
      that merge, invoke the smoke helper on every file in the global deployment
      manifest exactly once. In register_repo_local_hooks, smoke each of the four
      fully realized repo overlay commands exactly once before invoking
      merge-settings. The helper uses shell=false spawnSync, the declared
      interpreter, a timeout no larger than the registered timeout, isolated
      non-SGSD cwd/HOME fixture roots in tests, and one JSON payload containing
      hook_event_name, cwd, session_id, prompt, tool_name, tool_input, and
      tool_response. Select the real event for registered hooks; use PostToolUse
      for the auxiliary phase-boundary script; keep prompt/tool values fixed and
      non-secret. Close stdin on every child. A spawn error, signal, timeout, or
      non-zero exit aborts installation with hook_smoke_failed and the entry hook
      path before settings merge; do not treat a caught MODULE_NOT_FOUND as
      optional and do not surface raw payload or child output. The static case
      injects a fake spawner and asserts one call per descriptor, payload/event
      selection, timeout, failure naming, and zero merge callback on failure.
      The orchestrator-only integration case runs the real canonical install,
      then copies it and removes scripts/lib/sgsd-state.cjs while leaving its
      entry hooks present and node --check-clean; it asserts real
      MODULE_NOT_FOUND becomes the stable named refusal and both settings hashes
      remain unchanged. No test or installer path may invoke claude.
    output_contract: >
      The installer deploys only globally runnable flat hooks, waits until their
      support files exist, executes every global and repo-local deployed entry
      once with a benign event-shaped payload, and refuses dependency-broken
      layouts before writing registrations. Repo-local hook semantics and source
      topology remain unchanged.
    hypothesis: >
      A real installed-location invocation after dependency deployment catches
      loader and sibling-module failures that file existence and node --check
      cannot observe, while a tested deployment manifest prevents copy/overlay
      drift.
    falsifier: >
      A deployed entry is skipped or spawned twice; smoke runs before global
      dependencies exist; a dependency-broken entry exits installation 0 or
      writes registrations; an error omits the entry hook path; a raw payload or
      child output leaks; repo-local-only dependent hooks are flattened into the
      global directory; hook source semantics change; a fixture invokes claude;
      canonical install/idempotence or T1/T2 regress; or T3 is not independently
      revertable.
    stop_rule: >
      Stop when the executor-run smoke-static case passes without spawning, the
      orchestrator-run deployed-hook-smoke and canonical-sixteen-hook cases exit
      0, all T1/T2 regression commands pass, the diff is limited to the three
      listed files, and T3 is one independently revertable commit after T2.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case smoke-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case deployed-hook-smoke &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current &&
      node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks
    expected_ATC_tier: GATE
---

# P160 - Installer Registration Guard

Three serial, independently revertable commits close the observed installer
seams. T1 owns an atomic pre-write registration boundary and the Clarity
nine-hook falsifier. T2 refreshes only the bundled Claude overlay and gives it a
mutation-proven drift tripwire. T3 separates syntax validation from real
installed-location execution, fixes deployment order/topology, and makes every
spawn-bound acceptance case an explicit unsandboxed orchestrator checkpoint.

Executor-safe cases use injected filesystem/check/spawn adapters and never
launch a child. The orchestrator must run and record every command whose case
name is vendored-nine-hook, node-check-both-sites, canonical-sixteen-hook,
bundled-overlay-current, or deployed-hook-smoke outside the executor sandbox.
No verification path invokes claude.
