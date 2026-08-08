# P150-T150-01 — Repair updater contract

<intent milestone="v3.5">The whole substrate propagates to every SGSD install (local + devcp).</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task. SURGICAL CONSTRAINT applies.

## Task contract (from locked plan)
  - id: "T150-01"
    type: automatable
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/sgsd-update.sh"
      - "super-gsd/scripts/sgsd-update.ps1"
      - "super-gsd/skills/sgsd-update/SKILL.md"
      - "super-gsd/tests/propagation/sgsd-update-contract.test.cjs"
    input_contract: |
      Use the existing canonical-source wrappers and install.sh contract. Preserve check-only and no-install modes. Treat origin/master as the only update target and preserve project .planning/config.json.
    output_contract: |
      Both wrappers reject dirty, locally-ahead, or diverged canonical sources; fetch origin/master; capture the fetched SHA; permit only a fast-forward to that SHA; assert HEAD equals it; and run install.sh with --update --install-global. The skill accurately documents guards, process/session restart boundaries, and exit behavior.
    hypothesis: "Replacing git pull with clean-state, fetched-SHA, and fast-forward-only enforcement prevents misleading or locally merged installations while propagating all global assets."
    falsifier: "A dirty or divergent source reaches install.sh, HEAD can differ from the captured fetched origin/master SHA after success, or the installer is invoked without both --update and --install-global."
    stop_rule: "On dirty state, local-only commits, non-fast-forward history, fetch failure, SHA mismatch, or installer failure, exit non-zero before writing .super-gsd-version and do not merge, reset, install, or continue."
    verification:
      commands:
        - "node --test super-gsd/tests/propagation/sgsd-update-contract.test.cjs"
        - "rg -n \"git pull\" super-gsd/scripts/sgsd-update.sh super-gsd/scripts/sgsd-update.ps1 && exit 1 || exit 0"
        - "rg -n -- \"--update|--install-global|merge --ff-only|origin/master\" super-gsd/scripts/sgsd-update.sh super-gsd/scripts/sgsd-update.ps1 super-gsd/skills/sgsd-update/SKILL.md"

  - id: "T150-02"

## Full plan body sections for this task

## Verify before reporting: run the task verification commands; if sandbox blocks, say so — orchestrator verifies host-side.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
