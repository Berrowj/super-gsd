---
schema_version: 2
phase: 147
plan: "147-01"
title: "Commit-Seam Gate"
model: codex
expected_ATC_tier: GATE
prior_errors_lookup: true
depends_on:
  - "146"
skip_gates: []
lessons_path: null
vtp_status: "success: 2 relevant hits"
lock_status: locked
locked_at: "2026-08-07T00:00:00+01:00"
locked_by: "codex-phase-planner"
risk_rating: high
rollback_plan: >
  Rollback does not pass through the commit gate. Uninstall by deleting the Git-resolved pre-commit hook file returned by
  `git -C <repo> rev-parse --git-path hooks/pre-commit`, but only when the file contains the SGSD-COMMIT-GATE marker.
  Leave unmarked hooks untouched. If block mode was explicitly activated, delete `.planning/config/commit-gate-mode.json`
  after removing the hook. Document this path in `super-gsd/docs/commit-gate.md` and in installer help; do not rely on a
  commit to perform rollback.
allowed_files:
  - ".planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md"
  - ".planning/metrics/commit-gate-shadow.jsonl"
  - ".planning/config/commit-gate-mode.json"
  - "super-gsd/hooks/sgsd-commit-gate.cjs"
  - "super-gsd/scripts/lib/commit-gate-shadow-log.cjs"
  - "super-gsd/scripts/lib/commit-gate-shadow-report.cjs"
  - "super-gsd/scripts/lib/sgsd-artifact-conventions.cjs"
  - "super-gsd/scripts/install-commit-gate.cjs"
  - "super-gsd/install.sh"
  - "super-gsd/docs/commit-gate.md"
  - "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
  - "<git-resolved-hooks-dir>/pre-commit when absent or SGSD-marked"
forbidden_files:
  - "super-gsd/registry/gates.yaml"
  - "super-gsd/hooks/gsd-atc-slice-gate.js"
  - ".git/config"
  - "~/.gitconfig"
  - "devcp/**"
invariants:
  - "Warn mode ships enabled by default; absence of `.planning/config/commit-gate-mode.json` means warn."
  - "Block mode activates only after explicit operator command and only when `--shadow-report` shows >=200 real payloads across GSDedits and devcp, both repos present, and false-block rate <5% per repo against each repo's discovered naming."
  - "Running `--shadow-report` never activates block mode by itself."
  - "`.sgsd-gate-off` skips block mode and logs the exact staged paths it waived."
  - "GSDedits plan evidence is `{NN}-*-PLAN-LOCKED.md` via `findPlanLockedFiles`; assurance evidence is `*-ATC-REVIEW*.md` in the active phase scope."
  - "Bare `PLAN.md` and `AUDIT.md` are false predicates and must not satisfy evidence."
  - "devcp artifact conventions are discovered at runtime from repo-local evidence/config; unknown convention warns/skips and can never block."
  - "The hook uses `git diff --cached --name-status -z --find-renames --find-copies --` for staged path evidence."
  - "Binary staged content is hashed, never embedded in shadow rows."
  - "Non-SGSD repos exit 0 and perform no arbitrary repo writes."
  - "Internal SGSD-repo errors fail open loudly and append degraded shadow rows with distinct reason_codes whenever a contained metrics path can be resolved."
  - "Every product writer obtains its destination via `resolveContainedPath` from `super-gsd/scripts/lib/sgsd-state.cjs`; the hook installer also contains the Git-returned hooks directory before writing `pre-commit`."
  - "Reuse `readState` frontmatter only, `findPlanLockedFiles` milestone scope, and envelope-v1 writer conventions; do not reimplement them."
  - "The commit gate is one governance layer only; `--no-verify` and some GUI clients can bypass it, and docs must not claim coverage it lacks."
anti_stub_policy:
  - "No verification command may pass by checking a `--self-test` flag or hardcoded output text."
  - "Acceptance fixtures create real temporary Git repos, stage real files, run the real installed or direct hook entrypoint, parse real `.planning/metrics/commit-gate-shadow.jsonl` rows, and assert fixture-specific field values including staged paths and hashes."
source_audit:
  - source: CONTEXT
    path: ".planning/milestones/v3.5/phases/147-commit-seam-gate/CONTEXT.md"
    status: success
    relevant_hits: 2
    citations:
      - "Warn mode is enabled first; block mode is earned only after >=200 real payloads and <5% false-block rate."
      - "Sentinel bypass is logged; rollback is hook-file removal; non-SGSD/error paths fail open."
  - source: RESEARCH
    path: ".planning/milestones/v3.5/phases/147-commit-seam-gate/147-RESEARCH.md"
    status: success
    relevant_hits: 2
    citations:
      - "Linked worktree resolves pre-commit to the common Git dir; installer must ask Git for path, honor `core.hooksPath`, and never silently set it."
      - "Use staged diff with NUL parsing; GSDedits predicates are `*-PLAN-LOCKED.md` and `*-ATC-REVIEW*.md`, not bare PLAN/AUDIT."
  - source: VTP-ENRICHMENT
    path: ".planning/milestones/v3.5/phases/147-commit-seam-gate/147-VTP-ENRICHMENT.md"
    status: success
    relevant_hits: 2
    vtp_available: true
    citations:
      - "Hit 1 validates flag-before-block and requires per-path evidence plus explicit logged override."
      - "Hit 4 validates the Swiss-cheese layer model; commit hook coverage must not be described as complete."
  - source: plan-schema-v2
    path: "super-gsd/templates/plan-schema-v2.json"
    status: success
    relevant_hits: 2
    citations:
      - "Requires `schema_version`, `semantic_acceptance_criteria`, and `tasks`."
      - "Each task must include id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, and stop_rule."
  - source: P146 plan
    path: ".planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md"
    status: success
    relevant_hits: 2
    citations:
      - "Use schema-v2 locked-plan shape with top-level rollback, allowed files, invariants, semantic acceptance criteria, and serial task contracts."
      - "Carry forward the two defect classes: contained writer destinations and observable degradation rows."
design_decisions:
  - decision: "source_touching_predicate"
    value: >
      Source-touching means staged A/C/M/R/D/T paths in `super-gsd/**`, `.agents/**`, `.codex/**`,
      `.warp/workflows/**`, `custom-gsd-extract/**`, `package*.json`, and code/config extensions outside `.planning/**`.
      Exclude `.planning/**`, `.planning/metrics/**`, `docs/**`, root `README.md`, and report-only Markdown outside runtime dirs.
    false_positive_risks: >
      Markdown under `super-gsd/**` may warn because it travels with runtime code; governance config commits warn intentionally;
      executable payloads hidden under `.planning/**` are outside this seam and remain a separate control problem.
  - decision: "existing_hook_policy"
    value: >
      Create the hook if absent, refresh an SGSD-marked hook block if present, and refuse unmarked hooks without backup or chaining.
      The installer prints the Git-resolved path and manual rollback instructions.
  - decision: "linked_worktree_policy"
    value: >
      Ask Git for `hooks/pre-commit` and `core.hooksPath`; honor an existing hooksPath and never set it silently. In linked worktrees,
      print that the resolved common hook path is shared across worktrees before installation.
  - decision: "block_activation_storage"
    value: >
      Store explicit activation in `.planning/config/commit-gate-mode.json`, written only by `--activate-block` after a passing shadow report.
  - decision: "DEFERRED-F"
    value: >
      Mostly closed for staged commits because the gate reads the Git index, regardless of Bash redirect mutation path. Not closed for unstaged
      or uncommitted files; carried forward.
  - decision: "DEFERRED-G"
    value: >
      SessionStart contract trim remains separate and low-risk; do not include it in P147.
shared_file_ownership:
  - file: "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
    owner: "T147-01"
    later_touch_policy: "Later tasks may add scenario functions only; T147-01 owns temp-repo helpers and assertion utilities."
  - file: ".planning/metrics/commit-gate-shadow.jsonl"
    owner: "T147-02"
    later_touch_policy: "Append-only through commit-gate-shadow-log writer or SGSD-marked POSIX bootstrap degradation row."
  - file: "super-gsd/hooks/sgsd-commit-gate.cjs"
    owner: "T147-03"
    later_touch_policy: "T147-04 may add report/activation CLI wiring; T147-05 may not change hook semantics."
  - file: ".planning/config/commit-gate-mode.json"
    owner: "T147-04"
    later_touch_policy: "Created only by explicit activation command after falsifier passes."
carried_forward:
  - id: "DEFERRED-F"
    status: "carried-forward"
    note: "Staged Bash-redirect mutations are mostly covered here; unstaged mutations remain out of scope."
  - id: "DEFERRED-G"
    status: "carried-forward"
    note: "SessionStart contract trim belongs in a separate low-risk phase."
  - id: "DEVIATION-W"
    status: "carried-forward"
    note: "Do not solve in P147."
acceptance_commands:
  - "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --plan-file .planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md"
  - >
    powershell -NoProfile -Command "foreach ($f in @('super-gsd/scripts/lib/sgsd-artifact-conventions.cjs','super-gsd/scripts/lib/commit-gate-shadow-log.cjs','super-gsd/scripts/lib/commit-gate-shadow-report.cjs','super-gsd/hooks/sgsd-commit-gate.cjs','super-gsd/scripts/install-commit-gate.cjs','super-gsd/tests/commit-gate/assert-real-commit-gate.cjs')) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"
  - "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario artifact-conventions-source-predicate"
  - "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario shadow-ledger-contained-writer"
  - "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario hook-warn-sentinel-failopen"
  - "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario shadow-report-activation"
  - "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario installer-linked-worktree"
operator_checkpoints:
  - "After T147-05, operator reviews the Git-resolved hook path because this checkout uses a common linked-worktree hook directory."
  - "Before any real block-mode use, operator runs `--shadow-report` against GSDedits and devcp, reviews per-repo false-block rates, then runs the explicit activation command only if the falsifier passed."
semantic_acceptance_criteria:
  - input: >
      Two constructed temporary SGSD-shaped Git repos named GSDedits and devcp. Each repo stages one real source file with no active phase evidence
      and one docs-only negative-control commit. The installed pre-commit trampoline invokes the real `super-gsd/hooks/sgsd-commit-gate.cjs`.
    expected_outcome: >
      Source commits exit 0 in warn mode and append real shadow rows with `signal=commit_gate_shadow`, `mode=warn`, `source_touching=true`,
      `would_warn=true`, `would_block=false`, `repo_id` equal to the fixture repo, `phase=147`, `staged_paths[0].path` equal to the staged source path,
      and a non-empty `diff_sha256`. Docs-only negative controls exit 0 with `source_touching=false`, `would_warn=false`, and no missing-evidence reason.
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario ac-warn-rows"
  - input: >
      A constructed temporary GSDedits Git repo whose active phase contains real files named `147-fixture-PLAN-LOCKED.md` and
      `147-ATC-REVIEW.md`, plus a negative-control repo containing only bare `PLAN.md` and `AUDIT.md`.
    expected_outcome: >
      The positive repo's shadow row records discovered plan and assurance paths using the real filenames and marks each source path
      `artifact_status=backed`. The negative repo does not accept bare PLAN/AUDIT names, records `artifact_status=missing_evidence`,
      and includes `reason_codes` containing `phase_evidence_missing`.
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario ac-artifact-predicates"
  - input: >
      Constructed temporary GSDedits and devcp Git repos producing at least 200 real hook payload rows across both repos, with discovered
      repo-local artifact conventions and a false-block rate below 5% per repo, plus negative controls for 199 rows, exactly 5% false-blocks,
      and unknown devcp convention.
    expected_outcome: >
      `--shadow-report` mechanically reports `falsifier_passed=true` only for the >=200 and <5% case. It reports false with distinct reason codes
      for insufficient payloads, false-block rate >=5%, missing repo, or unknown convention. `--shadow-report` alone never writes
      `.planning/config/commit-gate-mode.json`; `--activate-block` writes it only after the passing report and records explicit operator activation.
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario ac-shadow-report-activation"
  - input: >
      A constructed temporary SGSD-shaped Git repo with earned block mode activated, a staged source file lacking phase evidence, and a
      `.sgsd-gate-off` sentinel positive control paired with a no-sentinel negative control.
    expected_outcome: >
      With sentinel present, the commit exits 0, the shadow row has `status=skipped`, `reason_codes` containing `sentinel_waived_block`,
      and `waived_paths` exactly matching the staged source path. Without sentinel, the commit is refused by the hook, files remain intact in
      the worktree and index, and the row records `would_block=true` for the same path.
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario ac-sentinel-block"
  - input: >
      A constructed non-SGSD Git repo and a constructed SGSD-shaped repo with injected Git/internal errors while staging real files.
    expected_outcome: >
      The non-SGSD repo exits 0, writes no arbitrary metrics file, and prints a loud non-SGSD warning. The SGSD error fixture exits 0,
      appends a degraded shadow row under `.planning/metrics/commit-gate-shadow.jsonl` with a distinct reason code such as `git_diff_failed`
      or `internal_error`, and never reports clean because it did nothing.
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario ac-fail-open-degradation"
tasks:
  - id: "T147-01"
    type: "artifact-conventions-and-source-predicate"
    agent: "gsd-executor"
    model: "codex"
    depends_on: []
    files_touched:
      - "super-gsd/scripts/lib/sgsd-artifact-conventions.cjs"
      - "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
    traces_to:
      - "AC-147a"
      - "AC-147c"
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario artifact-conventions-source-predicate"
    input_contract: >
      Use RESEARCH Q3-Q5. Reuse `readState` and `findPlanLockedFiles`; do not parse STATE prose and do not hardcode devcp naming.
    output_contract: >
      Create artifact convention discovery/evaluation and the real temp Git fixture runner. GSDedits uses `findPlanLockedFiles` plus
      active-phase `*-ATC-REVIEW*.md`; devcp is runtime-discovered and returns `convention_unknown` when not provable. Implement the source-touching
      predicate and per-path evaluation records.
    hypothesis: >
      A single convention evaluator can distinguish backed source paths from missing-evidence paths without accepting the known false PLAN/AUDIT predicate.
    falsifier: >
      Bare `PLAN.md` or `AUDIT.md` satisfies evidence, devcp naming is hardcoded, source docs-only commits warn, or source paths under runtime/config
      fail to warn.
    stop_rule: >
      Fixture repos prove positive GSDedits naming, negative PLAN/AUDIT naming, source predicate positives, docs-only negatives, and devcp unknown
      warn/skip behavior.
    expected_ATC_tier: GATE

  - id: "T147-02"
    type: "shadow-ledger"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T147-01"
    files_touched:
      - "super-gsd/scripts/lib/commit-gate-shadow-log.cjs"
      - ".planning/metrics/commit-gate-shadow.jsonl"
      - "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
    traces_to:
      - "AC-147a"
      - "AC-147b"
      - "AC-147d"
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario shadow-ledger-contained-writer"
    input_contract: >
      Use P146 envelope-v1 conventions and `resolveContainedPath`. Include VTP directive for per-path evidence in every shadow row.
    output_contract: >
      Create a never-throw append/read helper for `.planning/metrics/commit-gate-shadow.jsonl`. Rows include envelope-v1 fields plus
      `signal`, `repo_id`, `commit_candidate`, `diff_sha256`, `artifact_predicate_version`, `artifact_convention_status`, `staged_paths`,
      `would_warn`, `would_block`, `false_block_basis`, `waived_paths`, and distinct `reason_codes`.
    hypothesis: >
      Contained append-only shadow rows make degradation and false-block accounting observable without trusting stderr or a per-commit-only verdict.
    falsifier: >
      A writer accepts caller-supplied absolute destinations, writes outside the SGSD root, omits per-path evidence, embeds binary content, or treats a
      degraded path as clean.
    stop_rule: >
      The fixture proves contained writes, rejects path escape attempts, appends valid JSONL, records per-path source/evidence fields, and records a
      degraded row with a distinct reason code.
    expected_ATC_tier: GATE

  - id: "T147-03"
    type: "commit-hook-warn-sentinel-failopen"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T147-02"
    files_touched:
      - "super-gsd/hooks/sgsd-commit-gate.cjs"
      - "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
    traces_to:
      - "AC-147a"
      - "AC-147d"
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario hook-warn-sentinel-failopen"
    input_contract: >
      Use RESEARCH Q1-Q3 and Q7-Q9. Hook invocation is one layer and must fail open on non-SGSD repos and internal errors.
    output_contract: >
      Implement the real hook entrypoint for warn mode, staged diff parsing with NUL-safe rename/copy handling, binary hashing, source predicate
      evaluation, sentinel detection, and fail-open degradation rows. The direct hook returns code 10 only for deliberate earned block decisions;
      warn, skip, non-SGSD, and internal-error paths return 0.
    hypothesis: >
      Reading the staged index at pre-commit time catches source-touching commits without touching source files and without blocking before block mode is earned.
    falsifier: >
      The hook reads unstaged files as evidence, blocks in warn mode, fails closed on Git/internal errors, omits sentinel waived paths, or cannot assert
      the staged path and hash values from real shadow rows.
    stop_rule: >
      Real temp commits in warn mode append expected shadow rows, docs-only commits do not warn, sentinel skip rows include exact waived paths, and
      injected failures exit 0 with degraded rows.
    expected_ATC_tier: GATE

  - id: "T147-04"
    type: "shadow-report-and-activation"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T147-03"
    files_touched:
      - "super-gsd/scripts/lib/commit-gate-shadow-report.cjs"
      - "super-gsd/hooks/sgsd-commit-gate.cjs"
      - ".planning/config/commit-gate-mode.json"
      - "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
    traces_to:
      - "AC-147b"
      - "AC-147c"
      - "AC-147d"
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario shadow-report-activation"
    input_contract: >
      Use RESEARCH Q6 and VTP directives 1-2. Promotion is mechanical and explicit; unknown repo convention prevents block activation.
    output_contract: >
      Implement `--shadow-report` and explicit `--activate-block`. Report totals include real payloads, per-repo payload counts, source-touching counts,
      would-warn/would-block counts, false-block counts/rates per repo, malformed/skipped rows, sentinel skips, internal-error rows, and final falsifier
      verdict. Activation writes `.planning/config/commit-gate-mode.json` only after a passing report and never as a side effect of reporting.
    hypothesis: >
      Mechanical report-plus-explicit-activation prevents silent block promotion while still making earned block mode available after measured trust.
    falsifier: >
      Block activates with fewer than 200 real payloads, with only one repo present, with false-block rate >=5% in either repo, with unknown devcp convention,
      or merely by running `--shadow-report`.
    stop_rule: >
      Positive fixtures with >=200 real rows and <5% false-block per repo pass, negative fixtures fail with distinct reason codes, and activation storage
      changes only under the explicit activation command.
    expected_ATC_tier: GATE

  - id: "T147-05"
    type: "installer-trampoline-rollback-docs"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T147-04"
    files_touched:
      - "super-gsd/scripts/install-commit-gate.cjs"
      - "super-gsd/install.sh"
      - "super-gsd/docs/commit-gate.md"
      - "super-gsd/tests/commit-gate/assert-real-commit-gate.cjs"
      - "<git-resolved-hooks-dir>/pre-commit when absent or SGSD-marked"
    traces_to:
      - "AC-147a"
      - "AC-147c"
      - "AC-147d"
    verification_cmd: "node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario installer-linked-worktree"
    input_contract: >
      Use RESEARCH Q1 and Q7. This checkout is a linked worktree; `git rev-parse --git-path hooks/pre-commit` resolves to the common Git dir.
    output_contract: >
      Add an idempotent installer/uninstaller that asks Git for the hook path, honors existing `core.hooksPath`, never sets it silently, warns when the
      resolved path is shared by linked worktrees, installs a POSIX `#!/bin/sh` trampoline on Windows, refreshes only SGSD-marked hooks, and refuses
      unmarked hooks without backup. The trampoline invokes Node when available, maps direct hook exit code 10 to Git block exit 1, maps unexpected
      nonzero bootstrap failures to exit 0 with loud degradation, and writes a bootstrap degraded row to the installer-contained metrics path when possible.
      Document uninstall as removing the SGSD-marked hook file outside the gate path.
    hypothesis: >
      Git-derived, SGSD-marked installation gives commit-seam coverage without hijacking existing hooks, changing Git config, or creating a self-locking rollback.
    falsifier: >
      The installer writes an unmarked hook, silently sets `core.hooksPath`, executes `.cjs` directly on Windows, misses the linked-worktree shared-path warning,
      blocks because Node is missing, or documents rollback as a gated commit.
    stop_rule: >
      Temp linked-worktree fixtures prove absent-hook create, SGSD-marked refresh, unmarked-hook refusal with no modification, core.hooksPath honoring,
      POSIX trampoline content, Node-missing fail-open behavior, and documented remove-hook rollback.
    expected_ATC_tier: GATE
