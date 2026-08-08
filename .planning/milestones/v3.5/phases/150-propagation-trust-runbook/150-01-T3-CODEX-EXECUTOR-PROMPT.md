# P150-T150-03 — Close Linux/runtime-provenance gaps

<intent milestone="v3.5">The whole substrate propagates to every SGSD install.</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task. SURGICAL CONSTRAINT applies.

## Task contract
  - id: "T150-03"
    type: automatable
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/sgsd"
      - "super-gsd/scripts/sgsd-boot.sh"
      - "super-gsd/scripts/sgsd-remote-tmux.sh"
      - "super-gsd/scripts/sgsd-registry-sync.sh"
      - "super-gsd/install.sh"
      - "super-gsd/tests/propagation/runtime-provenance.test.cjs"
    input_contract: |
      Extend the cited boot, remote-tmux, registry-sync, and installer paths. Retain existing defaults where safe, while making explicit scripts/source/agents overrides authoritative over a project's vendored super-gsd tree.
    output_contract: |
      Linux global installation exposes a literal sgsd launcher in ~/.local/bin. sgsd -NoOpen runs preflight without starting or reusing cockpit UI. Explicit runtime paths govern boot, cockpit, registry, and tmux panes consistently. Boot/doctor output prints canonical-source HEAD and the project pin and fails on mismatch.
    hypothesis: "A no-open launcher plus one authoritative runtime path removes false-green devcp checks caused by Clarity's stale vendored tree."
    falsifier: "sgsd -NoOpen starts a cockpit, any child resolves through project/super-gsd after a global override, registry rows come from vendored agents, or provenance succeeds when source HEAD and .super-gsd-version differ."
    stop_rule: "Do not launch cockpit, tmux, Claude, or registry mutation when an explicit runtime directory is missing, its source SHA cannot be resolved, or its SHA differs from the project pin."
    verification:
      commands:
        - "node --test super-gsd/tests/propagation/runtime-provenance.test.cjs"
        - "bash super-gsd/scripts/sgsd-boot.sh -NoOpen --project \"$PWD\" --scripts-dir \"$PWD/super-gsd/scripts\" --agents-dir \"$PWD/super-gsd/agents\" --source-dir \"$PWD\""
        - "bash super-gsd/scripts/sgsd-remote-tmux.sh --project \"$PWD\" --scripts-dir \"$PWD/super-gsd/scripts\" --agents-dir \"$PWD/super-gsd/agents\" --source-dir \"$PWD\" --doctor"
        - "rg -n -- \"-NoOpen|--no-open|--scripts-dir|--agents-dir|--source-dir|Framework HEAD\" super-gsd/scripts/sgsd super-gsd/scripts/sgsd-boot.sh super-gsd/scripts/sgsd-remote-tmux.sh"

  - id: "T150-04"

## Plan body for this task

## Verify before reporting; sandbox blocks -> say so.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
