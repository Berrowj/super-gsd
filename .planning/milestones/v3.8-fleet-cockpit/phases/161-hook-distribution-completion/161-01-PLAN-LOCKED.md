---
schema_version: 2
phase: 161
slug: hook-distribution-completion
milestone: v3.8-fleet-cockpit
status: PLANNED
revision: 1
governing_decision: .planning/milestones/v3.8-fleet-cockpit/phases/161-hook-distribution-completion/CONTEXT.md
depends_on: []
intent: >
  Distribute every shipped hook type, close the five-name registration audit
  gap with an explicit surface-aware manifest, and prove the real sgsd-update
  path recovers a Clarity-shaped project without weakening P160 or deleting
  operator-owned registrations.
execution_mode: serial-codex-with-orchestrator-spawn-checkpoints
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      The production installer and exact current sixteen-file
      super-gsd/hooks inventory, including both .cjs and both .sh files,
      deployed through a real install into isolated HOME/USERPROFILE and a
      separate project whose super-gsd/hooks initially contains only systemd/.
    expected_outcome: >
      The global hook directory contains all sixteen basenames byte for byte;
      the project-local runtime receives the same sixteen plus the five command
      entries declared by config/codex-hooks.json; systemd/ survives; and every
      registration-bound hook passes P160 syntax and installed-location smoke
      before either settings merge.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types'
  - input: >
      The checked-in hook manifest, the real sixteen Claude hook sources, the
      five executable Codex config commands, all production registration
      surfaces, and mutations removing one registration, reason, or manifest
      row at a time.
    expected_outcome: >
      All twenty-one shipped entry hooks have an explicit distribution and
      registration disposition; the three genuinely absent global Claude event
      hooks have their locked events and budgets; statusLine is accepted on its
      native surface, commit gate on Git pre-commit; and every silent
      manifest/overlay drift mutation fails with a stable hook_manifest_*
      diagnostic naming path and surface.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness'
  - input: >
      A network-isolated real-Git sgsd-update fixture with an allowed canonical
      origin routed to a temporary bare repository, isolated HOME, an old pin,
      three existing sgsd_managed entries, and target super-gsd/hooks containing
      only systemd/ before update.
    expected_outcome: >
      A broken-source control reproduces exit 5, all four documented
      hook_registration_missing lines, and an unchanged pin. With production
      T1/T2 source, the real updater exits 0, smoke-proves global coverage,
      realizes each repo registration once without deleting existing rows,
      emits the fetched SHA, and advances .super-gsd-version to that SHA.
    verification_cmd: 'node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case sgsd-update-clarity-shape'
  - input: >
      Every pre-existing case in the P160 installer-registration-guard runner
      after the P161 changes.
    expected_outcome: >
      All eight P160 cases stay green with no relaxed path checks, skipped
      smoke, partial write, temp artifact, raw child-output leak, or settings
      mutation on refusal.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case preflight-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case smoke-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case vendored-nine-hook &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case node-check-both-sites &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case deployed-hook-smoke
known_deadends:
  - Do not weaken, bypass, or move P160 preflight/smoke after either merge; distribution catches up to the guard, never the reverse.
  - Do not repair only *.js or add a second *.cjs glob; both copy sites enumerate regular files extension-agnostically.
  - Do not infer registration intent from a directory glob or filename prefix; the manifest owns surface, event, matcher, timeout, or a non-empty intentional reason.
  - Do not count README, package, installer, or self-test files in tools/codex-hooks; its five config/codex-hooks.json command targets are the entry set.
  - Do not duplicate native statusLine into hooks events merely to satisfy a count, or attach the Git commit gate to a false Claude event.
  - Do not point dependency-bearing global hooks at flat copies without deploying their scripts/lib, registry, and tools sibling runtime; do not change hook semantics to hide topology defects.
  - Do not mock sgsd-update with install.sh, contact github.com, invoke claude, write real HOME, or use the working repository as a fixture target.
  - Do not remove Clarity-shaped sgsd_managed rows in installer/updater code; removal remains an operator action after global coverage proof.
tasks:
  - id: P161-T1
    type: extension-complete-hook-distribution
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/install.sh
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
    input_contract: >
      Work red-first in the P160 runner. Add hook-distribution-all-types with a
      source checkout outside both targets, isolated HOME/USERPROFILE, and a
      separate target whose hooks directory has only a preserved systemd/
      sentinel. Lock these sixteen source basenames: gsd-checkpoint-writer.js,
      gsd-context-monitor.js, gsd-phase-boundary.sh, gsd-session-start.js,
      gsd-session-state.sh, gsd-stuck-detector.js, gsd-token-logger.js,
      sgsd-activity-logger.js, sgsd-commit-gate.cjs, sgsd-heartbeat.js,
      sgsd-intent-classifier.cjs, sgsd-quality-gate.js,
      sgsd-session-start.js, sgsd-statusline.js, sgsd-stop-handoff.js, and
      sgsd-vtp-pending.js. Derive the five Codex entry basenames only from real
      config/codex-hooks.json commands. Record the pre-fix red: global install
      omits both .cjs sources and project integration refuses the four live
      missing paths. In install.sh, separate copy inventory from P160's smoke
      manifest. Use regular-file-only, extension-agnostic loops for global
      $HOOKS_DIR and target super-gsd/hooks. Before register_repo_local_hooks
      and register_codex_hooks in both --init-project and --update, copy the
      five Codex entry files into the target topology. Preserve directories and
      unrelated target files, chmod only shipped shell files, retain copy_file's
      source-equals-target no-op, and never delete stale files. The Codex entry
      set must resolve exactly to block-secret-leak.cjs,
      block-forbidden-write.cjs, enforce-allowed-files.cjs,
      log-tool-event.cjs, and validate-stop-contract.cjs. Before global
      smoke, deploy the unmodified sibling runtime required by newly live hooks:
      scripts/lib, registry, and tools/vtp-readiness at the paths resolved by
      the flat ~/.claude/hooks copies. Extend static order assertions so both
      distributions and dependencies precede P160 smoke and merge. Codex edits
      first without spawning; the orchestrator records real Bash/Node red and
      green outside the sandbox. No case invokes claude.
    output_contract: >
      Global install copies all sixteen hooks regardless of extension and their
      required sibling runtime. Init/update copy the sixteen hooks and five
      Codex commands into a separate project before fail-closed registration,
      without deleting systemd/ or operator files. P160's manifest remains a
      smoke contract, not an accidental copy allowlist.
    hypothesis: >
      Extension-complete distribution at both sites, with dependencies present
      before smoke, eliminates the missing .cjs and stale project-runtime
      failures without relaxing registration validation.
    falsifier: >
      Any hook is absent/byte-different globally; any hook or Codex entry is
      absent locally; systemd/ is removed; a directory is flattened; same-file
      copy fails; a dependent entry smokes before siblings exist; merge precedes
      distribution/smoke; P160 regresses; or T1 is not independently revertable.
    stop_rule: >
      Stop when hook-distribution-all-types is recorded red then green,
      smoke-static and canonical-sixteen-hook stay green, repeated distribution
      is byte-idempotent, the diff is the two listed files, and T1 is one commit.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case smoke-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook
    expected_ATC_tier: GATE
  - id: P161-T2
    type: surface-aware-hook-registration-manifest
    agent: codex
    model: codex
    depends_on: ['P161-T1']
    files_touched:
      - super-gsd/config/hook-manifest.json
      - super-gsd/config/settings-overlay.json
      - super-gsd/install.sh
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
    input_contract: >
      First add spawn-free hook-manifest-completeness and its mutation matrix.
      Create config/hook-manifest.json as the explicit inventory of the sixteen
      super-gsd/hooks entries plus the five executable targets measured from
      config/codex-hooks.json. Each row declares source_path, interpreter,
      distribution targets, and one or more dispositions. A registered
      disposition names authoritative config/installer, surface, event,
      matcher and timeout where applicable, and command path. An
      intentionally_unregistered disposition has a non-empty specific reason.
      Supported surfaces are claude-global hooks, claude-global statusLine,
      claude-project, codex-project, git-pre-commit, and auxiliary-only. Compare
      source inventory to manifest only to detect undeclared shipping drift;
      derive registration expectations from manifest, not globs, and compare
      them to settings-overlay.json, repo-settings-overlay.json,
      codex-hooks.json, install.sh's commit-gate lifecycle, and P160 smoke.
      Mutations remove a required registration, blank a reason, add an
      unexpected overlay command, and add an unmanifested source; require
      hook_manifest_registration_missing, hook_manifest_reason_missing,
      hook_manifest_registration_unexpected, and hook_manifest_entry_missing,
      naming path/surface without leaking config. Close the five-name audit:
      retain sgsd-statusline.js once on native top-level statusLine and state why
      it is not duplicated into hooks; add sgsd-session-start.js as SessionStart
      timeout 5, sgsd-intent-classifier.cjs as UserPromptSubmit matcher * timeout
      5, and sgsd-quality-gate.js as PostToolUse matcher
      Edit|Write|NotebookEdit timeout 10; represent sgsd-commit-gate.cjs on its
      actual explicit Git pre-commit lifecycle, with Claude-global default-off
      reason instead of a false event. Extend P160 smoke for every newly global
      Claude command so each is syntax-checked and benign-payload invoked once
      before merge. Verify commit gate through its existing lifecycle suite.
      Codex runs only the spawn-free mutation checks; the orchestrator runs real
      installs, smoke, and Git lifecycle cases after edits.
    output_contract: >
      A reviewable twenty-one-entry manifest distinguishes distribution,
      registration, native surfaces, and reasoned absences. Session governance,
      intent, and quality have correct global Claude entries; statusLine stays
      native/unique; commit gate stays on Git; and future source/manifest/overlay
      silence fails mechanically.
    hypothesis: >
      A checked-in surface-aware manifest makes intent comparable to every
      registration source, closing current omissions and preventing future
      hooks from being silently shipped or registered nowhere.
    falsifier: >
      Any entry lacks a disposition; a mutation passes; intent is glob-inferred;
      a blank reason passes; statusline is duplicated; commit gate gets a false
      event; event/matcher/timeout/path drifts; a new global command is not
      smoked; P160 is relaxed; or T2 is not independently revertable after T1.
    stop_rule: >
      Stop when hook-manifest-completeness is red then green, production reports
      exactly sixteen Claude and five Codex entries, every mutation refuses,
      all T1/P160 cases stay green, the diff is four listed files, and T2 is one
      commit after T1.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case smoke-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook &&
      node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario installer-lifecycle
    expected_ATC_tier: GATE
  - id: P161-T3
    type: real-sgsd-update-clarity-recovery-proof
    agent: codex
    model: codex
    depends_on: ['P161-T2']
    files_touched:
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
      - super-gsd/skills/sgsd-update/SKILL.md
    input_contract: >
      Add spawn-bound sgsd-update-clarity-shape; do not replace the updater with
      install.sh or modify production pin semantics for testing. Build a temp
      bare upstream with two commits from real post-T2 source and a canonical
      source clone at the older commit whose stored origin is exactly
      git@github.com:Berrowj/super-gsd.git. Route only fixture git-upload-pack to
      the bare repository through executable GIT_SSH_COMMAND and use real git
      for fetch, FETCH_HEAD capture, ancestry, ff-only, and HEAD checks without
      network. Use separate HOME/USERPROFILE and target cwd. Seed .planning, an
      old .super-gsd-version, an unrelated settings sentinel, hooks/systemd/ as
      the only hook entry, and exactly the three historical sgsd_managed rows
      for session-start-governance, user-prompt-intent-classifier, and
      post-tool-use-quality-gate; omit the fourth secret-leak row. A broken
      upstream control missing those three scripts plus block-secret-leak.cjs
      must yield updater exit 5, all four named missing descriptors, unchanged
      pin/settings bytes, and no temp. The production direction must yield exit
      0; source_sha and project_pin equal fetched SHA; the pin advances; all
      global manifest registrations smoke clean; all four repo rows exist once;
      unrelated settings and systemd/ survive; and none of the original managed
      rows is deleted. Update the sgsd-update skill with operator-only order:
      back up settings; prove source_sha/project_pin and live global file plus
      registration coverage; remove only reviewed obsolete sgsd_managed rows;
      validate JSON; start a fresh client; verify hook evidence. State that
      sgsd-update never performs deletion. Codex edits first; the orchestrator
      runs Git/Bash/Node and the full matrix unsandboxed. No fixture launches
      claude or touches a real remote, HOME, clone, or project.
    output_contract: >
      One deterministic real-updater fixture reproduces exit-5 pin holdback and
      proves repaired exit-0 pin advancement on the same Clarity shape. The
      operator runbook preserves coverage-first cleanup and all deletion stays
      manual.
    hypothesis: >
      Exercising the guarded fast-forward and installer against a local
      canonical-origin transport proves T1/T2 repair the production boundary,
      not a helper or direct-installer shortcut.
    falsifier: >
      The control misses exit 5/four paths or mutates pin/settings; fixed update
      fails, omits SHA evidence, leaves a hook missing/duplicated/unloadable,
      deletes a managed row, or fails to advance pin; the fixture uses network,
      mocks away fetch/install, invokes claude, touches operator paths, or leaks
      temp roots; docs order deletion before coverage; P160/T1/T2 regress; or T3
      is not independently revertable.
    stop_rule: >
      Stop when the orchestrator records broken exit-5 holdback and fixed exit-0
      recovery, every P160/T1/T2 case is green, ordered operator-only cleanup
      assertions pass, the diff is two listed files, and T3 is one commit.
    verification_cmd: >
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case sgsd-update-clarity-shape &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case preflight-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case smoke-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-static &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case vendored-nine-hook &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case node-check-both-sites &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case canonical-sixteen-hook &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case deployed-hook-smoke
    expected_ATC_tier: GATE
---

# P161 - Hook Distribution Completion

Three serial, independently revertable commits close distribution before
registration and then prove the real updater. T1 makes both copy sites
extension-complete while preserving P160's fail-closed boundary. T2 establishes
a surface-aware twenty-one-entry manifest and closes the five-name audit without
mis-registering statusline or commit gate. T3 reproduces exit-5 pin holdback and
demonstrates exit 0 plus pin advancement on the same Clarity-shaped project.

Codex makes all source and fixture edits before child-bound commands. Static
manifest mutation checks are executor-safe; real Bash, Git, installed-hook,
commit-gate, and updater cases are orchestrator checkpoints. No verification
invokes claude, and no task automates removal of operator-owned settings rows.
