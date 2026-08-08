# P150-T150-02 — Make Codex hooks installable (safe merge)

<intent milestone="v3.5">The whole substrate propagates to every SGSD install.</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task. SURGICAL CONSTRAINT applies.

## Task contract
  - id: "T150-02"
    type: automatable
    agent: codex
    model: codex
    files_touched:
      - ".codex/hooks.json"
      - "super-gsd/config/codex-hooks.json"
      - "super-gsd/tools/codex-hooks/install-hooks.cjs"
      - "super-gsd/tools/codex-hooks/self-test.cjs"
      - "super-gsd/install.sh"
      - "super-gsd/scripts/sgsd-onboard.ps1"
      - "super-gsd/scripts/lib/sgsd-readiness.ps1"
      - "super-gsd/tools/feature-propagation/audit.cjs"
      - "super-gsd/tests/propagation/codex-hooks-install.test.cjs"
    input_contract: |
      Use the current root .codex/hooks.json registrations as the canonical SGSD hook set. Preserve every non-SGSD hook and unknown JSON field in a target project. Do not read or mutate Codex's trust database.
    output_contract: |
      A canonical template and idempotent atomic merge installer create or update project .codex/hooks.json without replacing user hooks. install.sh update/init paths and onboarding invoke it. Readiness and feature-propagation audits report missing or stale managed registrations. A self-test executes the real hook scripts against safe fixtures.
    hypothesis: "Project-level safe merging makes every installation trust-ready while preserving operator-owned Codex configuration."
    falsifier: "A custom hook is removed or reordered unnecessarily, a managed hook is duplicated, malformed JSON is overwritten, installation reports success without all managed registrations, or any code attempts to grant trust non-interactively."
    stop_rule: "If the existing target JSON cannot be parsed, the template is invalid, or atomic replacement cannot complete, preserve the original byte-for-byte, emit a backup/error path, and fail the installer step."
    verification:
      commands:
        - "node --test super-gsd/tests/propagation/codex-hooks-install.test.cjs"
        - "node super-gsd/tools/codex-hooks/self-test.cjs --project . --json"
        - "node super-gsd/tools/feature-propagation/audit.cjs --project-dir . --json"
        - "rg -n \"state_5\\.sqlite|dangerously-bypass-hook-trust\" super-gsd/install.sh super-gsd/scripts/sgsd-onboard.ps1 super-gsd/tools/codex-hooks && exit 1 || exit 0"

  - id: "T150-03"

## Plan body for this task

## Verify before reporting: run the task verification commands; sandbox blocks -> say so.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
