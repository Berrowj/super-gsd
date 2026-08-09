# P150-T150-04 — PROPAGATION.md runbook + devcp reconciliation decision

<intent milestone="v3.5">The whole substrate propagates to every SGSD install.</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task, docs-only. SURGICAL CONSTRAINT applies.

## Task contract
  - id: "T150-04"
    type: automatable
    agent: codex
    model: codex
    files_touched:
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md"
      - "super-gsd/scripts/sgsd-global-snapshot.sh"
      - "super-gsd/scripts/sgsd-local-restart-evidence.ps1"
      - "super-gsd/scripts/sgsd-devcp-restart-evidence.sh"
      - "super-gsd/tests/propagation/runbook-contract.test.cjs"
      - "super-gsd/tests/propagation/global-snapshot-contract.test.cjs"
      - "super-gsd/tests/propagation/restart-evidence-contract.test.cjs"
    input_contract: |
      Use only the cited runtime behavior, updater contract, interactive trust ceremony, devcp reconciliation facts, install.sh's complete global mutation surface, and VTP shadow-deployment posture. Commands must identify their shell. PowerShell must never embed Bash through backslash escaping: every SSH operation must pipe a single-quoted here-string to bash -s with explicit arguments or invoke a named remote script file with explicit arguments.
    output_contract: |
      PROPAGATION.md contains the live/session/process/reboot matrix, safe Windows-to-SSH invocation forms, complete installed-layer backup and rollback, cockpit/MCP/tmux identity evidence, worktree/junction behavior, trust probes with ledger offsets, and evidence capture. DEVCP-RECONCILIATION.md makes the fork and installed-layer decisions explicit. Tested helpers snapshot and restore every global path install.sh mutates and emit machine-readable before/after restart evidence.
    hypothesis: "A shell-specific runbook plus tested snapshot and restart-evidence helpers turns propagation, rollback, trust, and reboot behavior into repeatable operations rather than institutional prose."
    falsifier: "A runbook SSH command uses Bash escaping inside a PowerShell string, a global installer target is absent from snapshot coverage, an extra pre-install path can disappear unnoticed, restart evidence can reuse a prior process/session identity, or a rollback fixture cannot restore the exact pre-install manifest."
    stop_rule: "Do not approve the documents or helpers while a command has an unresolved path, lacks a clean-state/PID guard, can touch Clarity's vendored tree implicitly, omits an install.sh global mutation target, or conflicts with the non-destructive reconciliation decision."
    verification:
      commands:
        - "node --test super-gsd/tests/propagation/runbook-contract.test.cjs"
        - "node --test super-gsd/tests/propagation/global-snapshot-contract.test.cjs"
        - "node --test super-gsd/tests/propagation/restart-evidence-contract.test.cjs"
        - "rg -n \"Live|next session|new process|reboot|required|\\. \\$PROFILE|sgsd-refresh -SkipPreflight|sgsd-remote-tmux\\.sh|block-forbidden-write|ledger offset|git worktree|junction|883|43|shadow|rollback\" .planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md .planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md"
        - "rg -n \"dangerously-bypass-hook-trust|git push.*GSDedits|reset --hard\" .planning/milestones/v3.5/phases/150-propagation-trust-runbook && exit 1 || exit 0"

  - id: "T150-05"

## Plan body for this task

## Verify before reporting: every command you write into PROPAGATION.md must reference real files/flags in this repo (cite them); operator-executed verification of the runbook is T150-05..07, not yours.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
