# P150 PLAN REVISION 1 — fix NOGO findings, emit revised full plan

You are the Codex planner revising your own draft after final review returned NOGO (4 CRIT + 4 WARN, verbatim below). Emit the COMPLETE revised plan (schema_version: 2, same task-shape contract as before) to stdout. Fix every finding:
- C1: replace all Bash-in-PowerShell escaping; use single-quoted here-strings or remote script files with explicit args for every SSH command.
- C2: AC-150d requires EVERY evidence marker independently, absolute paths, and before/after process/tmux identity comparison incl. post-restart MCP provenance.
- C3: AC-150c probes must establish a pre-dispatch ledger offset/correlation ID and require a NEWLY appended event on both machines; add $LASTEXITCODE checks.
- C4: T150-07 backup/rollback must cover EVERY global target install.sh mutates (scripts, commands, hooks, templates, workflows, config) or specify+test a non-deleting update mode.
- W1: reorder — local install/audit BEFORE push, or define post-publication failure handling honestly.
- W2: assert every pre-install extra path survives (compare the manifests you write).
- W3: validate origin URL on devcp before any fetch/merge.
- W4: cite 150-VTP-ENRICHMENT.md:13-18 + doc:daadab474432 in Source Audit.

## Review (verbatim)
FINDINGS: 8
CRITICAL: 4
WARNINGS: 4
PASS_RATE: 1/4 ACs covered
ONE_LINER: Task typing and 883-commit PII quarantine are sound, but AC-150a/c/d have broken or false-green verification and devcp lacks a complete non-destructive rollback boundary.
FINDINGS_DETAIL: [CRITICAL C1] AC-150a and AC-150d use Bash-style escaping inside PowerShell strings. At `150-01-PLAN-LOCKED.md:30`, `\"` splits the SSH command and expands local `$HOME`; at line 103, `\$(...)` executes locally and `\$p` loses the remote PID variable. Use single-quoted here-strings or a remote script with explicit arguments.
FINDINGS_DETAIL: [CRITICAL C2] AC-150d can false-green: the alternation at line 95 succeeds when any one of six evidence markers exists; the local PID path at line 98 is relative rather than anchored to `$env:USERPROFILE\GSDedits`; `tmux has-session` and lines 821-825 prove existence but not a newly created session/PID; and T150-06 never verifies post-restart MCP provenance. Require every marker independently and compare before/after process and tmux identities.
FINDINGS_DETAIL: [CRITICAL C3] AC-150c searches the complete historical ledger without establishing a pre-dispatch offset, count, timestamp, or correlation ID (`lines 55-65`, `529-544`, `753-769`). The local command also omits a `$LASTEXITCODE` check. A failed or skipped current dispatch can therefore pass using an old matching event. Require a newly appended event from the current probe on both machines.
FINDINGS_DETAIL: [CRITICAL C4] T150-07 calls `install.sh --install-global` but archives only `~/.claude/super-gsd/scripts` and omits commands, hooks, templates, workflows, and config from `files_touched` and rollback coverage (`lines 257-266`, `634-664`). The current installer overwrites those targets and invokes targeted `rm -rf` cleanup (`super-gsd/install.sh:173-201,323-440`). The claimed non-destructive shadow deployment therefore is not guaranteed. Back up every mutated global target or add and test a genuinely non-deleting update mode.
FINDINGS_DETAIL: [WARNING W1] T150-05’s stop rule says installer failure means “do not push” (`line 222`), but the push occurs at line 475 and installation begins at line 489. Move the local install/audit before publication or explicitly define post-publication failure handling without pretending the push can be prevented.
FINDINGS_DETAIL: [WARNING W2] The devcp preservation proof checks only four named fork-only files. The before/after manifests and `diff -qr` outputs are written but never compared (`lines 637-655`, `710-725`), so deletion of another member of the 43-file drift set would go undetected. Assert that every pre-install extra path remains after installation.
FINDINGS_DETAIL: [WARNING W3] T150-07 fast-forwards the devcp canonical source without first validating its `origin` URL (`lines 658-661`). Add the same expected-remote guard used by T150-05 before any fetch or merge.
FINDINGS_DETAIL: [WARNING W4] The Source Audit attributes the posture to VTP but does not provide an auditable citation (`line 862`). Cite `.planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VTP-ENRICHMENT.md:13-18` and its `doc:daadab474432` source identifier.

## Current plan (revise this)
---
schema_version: 2
plan_id: "150-01"
phase: "150"
slug: propagation-trust-runbook
milestone: "v3.5"
title: "Propagation, Trust Grant, and Reboot Runbook"
status: planned
depends_on: ["145", "146", "147", "148", "149"]
objective: "Make SGSD governance propagate as a verified runtime mechanism across local and devcp installations, with guarded updates, installable Codex hooks, explicit runtime provenance, interactive trust grants, and executed reboot procedures."
execution_order:
  - ["T150-01"]
  - ["T150-02"]
  - ["T150-03"]
  - ["T150-04"]
  - ["T150-05"]
  - ["T150-06"]
  - ["T150-07"]
semantic_acceptance_criteria:
  - id: "AC-150a"
    input: "The published origin/master SHA, devcp canonical-source HEAD, and devcp project .super-gsd-version after the guarded update."
    expected_outcome: "All three values are the same full commit SHA, and the devcp smoke reports the global canonical runtime rather than Clarity's vendored super-gsd tree."
    verification_cmd: |
      $p150OriginSha = ((git ls-remote origin refs/heads/master) -split "\s+")[0]
      $p150DevcpValues = @(ssh devcp "git -C ~/.claude/super-gsd/source rev-parse HEAD; cat /opt/clarity/project-clarity-erp/.super-gsd-version")
      if ($LASTEXITCODE -ne 0 -or $p150DevcpValues.Count -ne 2) { throw "Could not read devcp propagation SHAs" }
      if ($p150DevcpValues[0].Trim() -ne $p150OriginSha -or $p150DevcpValues[1].Trim() -ne $p150OriginSha) {
        throw "origin/master, devcp source, and project pin differ"
      }
      ssh devcp "cd /opt/clarity/project-clarity-erp && sgsd -NoOpen | tee /tmp/p150-no-open.out && grep -F '$p150OriginSha' /tmp/p150-no-open.out && grep -F \"$HOME/.claude/super-gsd/scripts\" /tmp/p150-no-open.out"
      if ($LASTEXITCODE -ne 0) { throw "devcp runtime provenance is stale or ambiguous" }

  - id: "AC-150b"
    input: "Real local and devcp installations after updater and installer execution."
    expected_outcome: "Both machines complete the literal sgsd -NoOpen preflight and the installed Codex-hook self-test with zero exit status."
    verification_cmd: |
      Push-Location '$env:USERPROFILE\GSDedits'
      try {
        sgsd -NoOpen
        if ($LASTEXITCODE -ne 0) { throw "Local no-open smoke failed" }
        node .\super-gsd\tools\codex-hooks\self-test.cjs --project . --json
        if ($LASTEXITCODE -ne 0) { throw "Local hook self-test failed" }
      } finally {
        Pop-Location
      }
      ssh devcp "cd /opt/clarity/project-clarity-erp && sgsd -NoOpen && node ~/.claude/super-gsd/source/super-gsd/tools/codex-hooks/self-test.cjs --project . --json"
      if ($LASTEXITCODE -ne 0) { throw "devcp post-update smoke failed" }

  - id: "AC-150c-local"
    input: "A real Codex workspace-write dispatch in $env:USERPROFILE\\GSDedits attempting exactly one apply_patch write to secrets/p150-trust-probe.env."
    expected_outcome: "The trusted block-forbidden-write hook denies the write, the file remains absent, and the real JSONL ledger records forbidden_path for the exact path."
    verification_cmd: |
      $p150LocalRepo = '$env:USERPROFILE\GSDedits'
      $p150ForbiddenFile = Join-Path $p150LocalRepo 'secrets\p150-trust-probe.env'
      codex exec -C $p150LocalRepo --sandbox workspace-write --ask-for-approval never --json "Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST. Do not use a shell command; report the hook denial."
      if (Test-Path -LiteralPath $p150ForbiddenFile) { throw "Forbidden local file was created" }
      $p150LocalEvents = Get-Content -LiteralPath (Join-Path $p150LocalRepo '.planning\metrics\codex-tool-events.jsonl') |
        ForEach-Object { $_ | ConvertFrom-Json } |
        Where-Object {
          $_.hook -eq 'block-forbidden-write' -and
          $_.decision -eq 'block' -and
          $_.reason -eq 'forbidden_path' -and
          $_.path -eq 'secrets/p150-trust-probe.env'
        }
      if (-not $p150LocalEvents) { throw "Local forbidden-write event was not recorded" }

  - id: "AC-150c-devcp"
    input: "A real Codex workspace-write dispatch in /opt/clarity/project-clarity-erp attempting exactly one apply_patch write to secrets/p150-trust-probe.env."
    expected_outcome: "The independently trusted devcp hook denies the write, the file remains absent, and the project JSONL ledger contains the exact block event."
    verification_cmd: |
      ssh devcp @'
      set -euo pipefail
      cd /opt/clarity/project-clarity-erp
      codex exec -C /opt/clarity/project-clarity-erp --sandbox workspace-write --ask-for-approval never --json \
        "Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST. Do not use a shell command; report the hook denial."
      test ! -e secrets/p150-trust-probe.env
      node - .planning/metrics/codex-tool-events.jsonl <<'NODE'
      const fs = require('fs');
      const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const found = rows.some((row) =>
        row.hook === 'block-forbidden-write' &&
        row.decision === 'block' &&
        row.reason === 'forbidden_path' &&
        row.path === 'secrets/p150-trust-probe.env');
      if (!found) process.exit(1);
      NODE
      '@
      if ($LASTEXITCODE -ne 0) { throw "devcp forbidden-write trust probe failed" }

  - id: "AC-150d"
    input: "The Windows profile/MCP/cockpit restart procedure and the devcp MCP/cockpit/tmux restart procedure executed from PROPAGATION.md."
    expected_outcome: "The verification record contains zero-exit execution evidence, the local profile exposes SGSD functions, both cockpit PID files resolve to live verified cockpit processes, and clarity-sgsd is a newly started tmux session."
    verification_cmd: |
      $p150Verification = '.planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-VERIFICATION.md'
      rg -n "PROFILE_RELOAD exit=0|LOCAL_MCP_RESTART exit=0|LOCAL_COCKPIT_RESTART exit=0|DEVCP_MCP_RESTART exit=0|DEVCP_COCKPIT_RESTART exit=0|DEVCP_TMUX_RESET exit=0" $p150Verification
      if ($LASTEXITCODE -ne 0) { throw "Executed reboot evidence is incomplete" }
      Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null
      $p150CockpitPid = [int](Get-Content '.planning\runtime\cockpit-server.pid')
      $p150CockpitProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$p150CockpitPid"
      if (-not $p150CockpitProcess -or $p150CockpitProcess.CommandLine -notmatch '(?i)cockpit') {
        throw "Local cockpit PID is not a verified cockpit process"
      }
      ssh devcp "tmux has-session -t clarity-sgsd && p=\$(cat /opt/clarity/project-clarity-erp/.planning/runtime/cockpit-server.pid) && test -r /proc/\$p/cmdline && tr '\0' ' ' </proc/\$p/cmdline | grep -qi cockpit"
      if ($LASTEXITCODE -ne 0) { throw "devcp reboot post-check failed" }

tasks:
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
      Both wrappers reject dirty, locally-ahead, or diverged canonical sources; fetch origin/master; capture the fetched SHA; permit only a fast-forward to that SHA; assert HEAD equals it; and run install.sh with --update --install-global. The skill accurately documents guards, restart boundaries, and exit behavior.
    hypothesis: "Replacing git pull with clean-state, fetched-SHA, and fast-forward-only enforcement prevents misleading or locally merged installations while propagating all global assets."
    falsifier: "A dirty or divergent source reaches install.sh, HEAD can differ from the fetched origin/master SHA after success, or the installer is invoked without both --update and --install-global."
    stop_rule: "On dirty state, local-only commits, non-fast-forward history, fetch failure, SHA mismatch, or installer failure, exit non-zero before writing .super-gsd-version and do not merge, reset, install, or continue."
    verification:
      commands:
        - "node --test super-gsd/tests/propagation/sgsd-update-contract.test.cjs"
        - "rg -n \"git pull\" super-gsd/scripts/sgsd-update.sh super-gsd/scripts/sgsd-update.ps1 && exit 1 || exit 0"
        - "rg -n -- \"--update|--install-global|merge --ff-only|origin/master\" super-gsd/scripts/sgsd-update.sh super-gsd/scripts/sgsd-update.ps1 super-gsd/skills/sgsd-update/SKILL.md"

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
        - "bash super-gsd/scripts/sgsd-boot.sh -NoOpen --project \"$PWD\" --scripts-dir \"$PWD/super-gsd/scripts\" --agents-dir \"$PWD/super-gsd/agents\""
        - "bash super-gsd/scripts/sgsd-remote-tmux.sh --project \"$PWD\" --scripts-dir \"$PWD/super-gsd/scripts\" --agents-dir \"$PWD/super-gsd/agents\" --doctor"
        - "rg -n -- \"-NoOpen|--no-open|--scripts-dir|--agents-dir|Framework HEAD\" super-gsd/scripts/sgsd super-gsd/scripts/sgsd-boot.sh super-gsd/scripts/sgsd-remote-tmux.sh"

  - id: "T150-04"
    type: automatable
    agent: codex
    model: codex
    files_touched:
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md"
      - "super-gsd/tests/propagation/runbook-contract.test.cjs"
    input_contract: |
      Use only the cited runtime behavior, updater contract, trust ceremony, devcp reconciliation facts, and VTP shadow-deployment posture. Commands must be executable and must identify their required shell.
    output_contract: |
      PROPAGATION.md contains the live/session/process/reboot matrix, Windows and devcp commands, cockpit and MCP PID validation, worktree/junction behavior, rollback, trust probes, and evidence capture. DEVCP-RECONCILIATION.md makes the fork and installed-layer decisions explicit.
    hypothesis: "An exact, shell-specific runbook turns propagation and restart behavior into repeatable operations rather than institutional prose."
    falsifier: "The runbook contains an unqualified destructive command, treats registries as universally live, implies worktrees move with master, uses hook-trust bypass, pushes the devcp fork, or lacks a command exercised by T150-05 through T150-07."
    stop_rule: "Do not approve the documents while any command has an unresolved path, lacks a clean-state/PID guard, can touch Clarity's vendored tree implicitly, or conflicts with the non-destructive reconciliation decision."
    verification:
      commands:
        - "node --test super-gsd/tests/propagation/runbook-contract.test.cjs"
        - "rg -n \"Live|next session|new process|reboot|required|\\. \\$PROFILE|sgsd-refresh -SkipPreflight|sgsd-remote-tmux\\.sh|block-forbidden-write|git worktree|junction|883|43|shadow\" .planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md .planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md"
        - "rg -n \"dangerously-bypass-hook-trust|git push.*GSDedits|reset --hard|rm -rf\" .planning/milestones/v3.5/phases/150-propagation-trust-runbook && exit 1 || exit 0"

  - id: "T150-05"
    type: operator-present
    agent: codex
    model: codex
    files_touched:
      - "git:refs/remotes/origin/master"
      - "~/.claude/agents/"
      - "~/.claude/commands/"
      - "~/.claude/hooks/"
      - "~/.claude/super-gsd/scripts/"
      - "PowerShell:$PROFILE"
      - "$HOME/GSDedits/.codex/hooks.json"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VERIFICATION.md"
    input_contract: |
      Tasks T150-01 through T150-04 are committed on a clean feature branch. The operator is present for the identity gate, fast-forward publication to origin/master, and local installer/profile mutation.
    output_contract: |
      Every outgoing commit has the generic operator author and committer identity, origin/master advances only by fast-forward to the verified feature SHA, the local global installation is refreshed, PowerShell functions are reinstalled, and the local target receives merged Codex hook registrations.
    hypothesis: "A strict outgoing-history identity gate and detached staging merge can publish the substrate without leaking operator PII or mutating unrelated worktrees."
    falsifier: "An outgoing author/committer differs from the generic identity, publication is non-fast-forward, origin/master differs from the verified feature SHA, or the local installed assets fail their audit."
    stop_rule: "On a dirty worktree, wrong remote, identity mismatch, failed test, failed fast-forward, concurrent remote advance, or installer failure: do not push and do not rewrite history automatically."
    verification:
      commands:
        - "git fetch origin master && git rev-parse HEAD && git rev-parse origin/master"
        - "git log origin/master..HEAD --format=\"%H %an <%ae> %cn <%ce>\""
        - "node super-gsd/tools/feature-propagation/audit.cjs --project-dir $HOME/GSDedits --json"
        - "powershell.exe -NoProfile -Command \"Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop | Select-Object Name,CommandType\""

  - id: "T150-06"
    type: operator-present
    agent: codex
    model: codex
    files_touched:
      - "~/.codex/state_5.sqlite"
      - "$HOME/GSDedits/.planning/metrics/codex-tool-events.jsonl"
      - "$HOME/GSDedits/.planning/runtime/cockpit-server.pid"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VERIFICATION.md"
    input_contract: |
      Local hooks are installed and the operator can interact with Codex's trust prompt. No trust-bypass flag is permitted. The operator can exit and reopen the owning Warp/Claude session.
    output_contract: |
      Local trust is granted interactively, the real forbidden-write dispatch is blocked and logged, sgsd -NoOpen passes, the profile is reloaded, verified stale MCP children are restarted, cockpit receives a new verified PID, and Claude is relaunched through sg in its terminal.
    hypothesis: "Interactive approval plus a real forbidden-path dispatch proves trust and enforcement, while explicit process restarts remove stale runtime state."
    falsifier: "No approval prompt appears despite untrusted hooks, the forbidden file is created, the event is absent, an unverified PID is killed, or a post-restart process still uses stale paths."
    stop_rule: "Do not claim trust from state-database presence alone. Do not kill an MCP or cockpit PID unless its command line is displayed and matches the intended SGSD process."
    verification:
      commands:
        - "sgsd -NoOpen"
        - "node $HOME/GSDedits/super-gsd/tools/codex-hooks/self-test.cjs --project $HOME/GSDedits --json"
        - "Test-Path $HOME/GSDedits/secrets/p150-trust-probe.env | Where-Object { $_ } | ForEach-Object { throw 'Forbidden file exists' }"
        - "Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop"

  - id: "T150-07"
    type: operator-present
    agent: codex
    model: codex
    files_touched:
      - "devcp:~/.claude/super-gsd/source/"
      - "devcp:~/.claude/super-gsd/scripts/"
      - "devcp:~/.claude/agents/"
      - "devcp:~/.claude/super-gsd/reconciliation/"
      - "devcp:/opt/clarity/project-clarity-erp/.codex/hooks.json"
      - "devcp:/opt/clarity/project-clarity-erp/.super-gsd-version"
      - "devcp:/opt/clarity/project-clarity-erp/.planning/metrics/codex-tool-events.jsonl"
      - "devcp:~/.codex/state_5.sqlite"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VERIFICATION.md"
    input_contract: |
      origin/master contains the published P150 SHA. The operator is present to inspect devcp sessions and dirty state, approve project-local hook merging, run /sgsd-update, grant Codex trust, and switch runtime processes only after verification.
    output_contract: |
      The 883-commit fork remains quarantined and unpushed. A new installed-layer archive and before/after manifests exist. Canonical source fast-forwards, /sgsd-update runs, canonical files match the non-deleting installed layer, fork-only files remain available, the model pin remains gpt-5.6-sol, trust and forbidden-write probes pass, and verified MCP/cockpit/tmux processes restart against the canonical runtime.
    hypothesis: "Shadow deployment—backup, fast-forward, install without deletion, verify, then reset the live session—propagates P150 without destroying fork-only capabilities or interrupting uncoordinated work."
    falsifier: "Relevant work is interrupted, canonical source is dirty/diverged, ~/GSDedits is pulled/pushed/rewritten, an installed extra is deleted, the model pin changes, runtime resolves through Clarity's vendored tree, or trust/reboot probes fail."
    stop_rule: "Coordinate or defer when relevant sessions are active. Stop before pull/install on dirty or divergent canonical source. Never push or rewrite the 883 commits, never delete the 43-file drift set, and never use hook-trust bypass."
    verification:
      commands:
        - "ssh devcp \"git -C ~/.claude/super-gsd/source status --porcelain=v1 --branch && git -C ~/.claude/super-gsd/source log -1 --format='%H %s'\""
        - "ssh devcp \"cd /opt/clarity/project-clarity-erp && sgsd -NoOpen\""
        - "ssh devcp \"test -f ~/.claude/super-gsd/scripts/board-runner.cjs && test -f ~/.claude/super-gsd/scripts/execution-authority.sh && test -f ~/.claude/super-gsd/scripts/concurrency-policy.cjs && test -f ~/.claude/super-gsd/scripts/decision-registry.cjs\""
        - "ssh devcp \"grep -F 'gpt-5.6-sol' /opt/clarity/project-clarity-erp/.planning/config.json && tmux has-session -t clarity-sgsd\""
---

# P150 Propagation, Trust Grant, and Reboot Runbook Implementation Plan

> **For agentic workers:** Execute tasks sequentially and preserve their stop rules. T150-05 through T150-07 require the operator to be present; they must not be converted into unattended automation.

**Goal:** Propagate the v3.5 SGSD substrate to local and devcp installations and prove that the installed runtime, trusted hooks, and restarted processes enforce it.

**Architecture:** The canonical updater performs a guarded fast-forward and a full non-destructive install. Project Codex hooks are merged from a canonical template without altering trust state. Boot and remote launchers accept one authoritative runtime provenance, while operator-present tasks publish, trust, reconcile, and restart each machine.

**Tech stack:** Bash, PowerShell, Node.js, Git, Codex hooks, SSH, tmux, JSONL evidence.

## Global invariants

- Do not modify `super-gsd/registry/gates.yaml` or reproduce an existing gate predicate.
- Do not use `git reset --hard`, unguarded `git pull`, force-push, blanket installed-tree deletion, or `--dangerously-bypass-hook-trust`.
- All implementation commits use `operator <operator@users.noreply.github.com>` for both author and committer.
- Clarity's vendored `super-gsd` remains governed by the Clarity repository. P150 may safely merge project hook configuration but must not treat the vendored framework tree as propagation evidence.
- Existing worktrees move only through an operator-coordinated merge or rebase. Junction-backed repositories see source changes when their junction target advances.

## T150-01 — Repair the updater contract

Build the tests first around temporary real Git repositories and a bare `origin`:

1. Prove a clean, behind source fast-forwards to the fetched `refs/remotes/origin/master` SHA and invokes the fake installer once with `--update --install-global`.
2. Prove dirty tracked and untracked files fail before merge or install.
3. Prove local-ahead and diverged sources fail without changing HEAD.
4. Prove an origin advance between fetch and completion cannot be reported as the installed SHA.
5. Prove installer failure prevents `.super-gsd-version` from changing.
6. Exercise both Bash and PowerShell wrappers where their runtime is available.

Implementation requirements:

- Replace `git pull origin master` with `fetch`, explicit ancestry validation, `merge --ff-only`, and an equality assertion between final HEAD and the captured fetched SHA.
- Check source cleanliness before fetch and immediately before merge.
- Keep `--check` read-only and compare `refs/heads/master`, not remote `HEAD`.
- Run `install.sh --update --install-global`; let `--update` preserve project configuration.
- Write `.super-gsd-version` atomically only after install success.
- Print stable `source_sha=...` and `project_pin=...` evidence lines.
- Document that profile functions, client sessions, MCP children, and cockpit processes have separate restart requirements.

Commit only after verification:

```bash
git add super-gsd/scripts/sgsd-update.sh super-gsd/scripts/sgsd-update.ps1 super-gsd/skills/sgsd-update/SKILL.md super-gsd/tests/propagation/sgsd-update-contract.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "fix: make SGSD updates guarded and complete"
```

## T150-02 — Install Codex hooks through a safe merge

Use `.codex/hooks.json` as the initial canonical content for `super-gsd/config/codex-hooks.json`. Implement `install-hooks.cjs` with these semantics:

- Parse and validate both source and target before writing.
- Preserve unknown root fields, unknown events, non-SGSD matcher groups, and non-SGSD commands.
- Upsert SGSD registrations by event, matcher, hook type, and managed command path.
- Remove duplicate copies only of the same managed registration.
- Write through a sibling temporary file and atomic rename.
- On malformed target JSON, leave it unchanged and fail with the exact path.
- Make a second identical invocation a semantic no-op.
- Never open or modify `~/.codex/state_5.sqlite`.

Wire the merger into existing-project update, new-project initialization, and onboarding. Extend readiness and feature-propagation auditing to compare the target's managed registrations with the canonical template.

The self-test must invoke the actual hook scripts with safe temporary events and prove:

- a forbidden-path request returns a blocking decision;
- an allowed temporary path is not falsely reported as forbidden;
- the secret-leak and stop-contract hooks remain callable;
- evidence is written only to the supplied temporary project.

Commit only after verification:

```bash
git add .codex/hooks.json super-gsd/config/codex-hooks.json super-gsd/tools/codex-hooks/install-hooks.cjs super-gsd/tools/codex-hooks/self-test.cjs super-gsd/install.sh super-gsd/scripts/sgsd-onboard.ps1 super-gsd/scripts/lib/sgsd-readiness.ps1 super-gsd/tools/feature-propagation/audit.cjs super-gsd/tests/propagation/codex-hooks-install.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "feat: propagate Codex hooks safely"
```

## T150-03 — Close Linux no-open and runtime-provenance gaps

Add an extensionless `sgsd` launcher and have `install.sh --install-global` install it at `~/.local/bin/sgsd` with executable permission. It delegates to the global `sgsd-boot.sh` and preserves arguments.

Required behavior:

- Accept literal `-NoOpen` and portable `--no-open`.
- In no-open mode, complete preflight and provenance checks, then exit without calling the cockpit starter or printing launch instructions.
- Add authoritative `--scripts-dir`, `--agents-dir`, and `--source-dir` inputs.
- When supplied, use those paths for boot checks, cockpit, registry sync, tmux panes, and provenance. Do not fall back to `PROJECT/super-gsd`.
- Extend `sgsd-registry-sync.sh` with `--agents-dir`, retaining the existing logical registry paths.
- Print resolved source, scripts, agents, source HEAD, and project pin.
- Fail before launching when the canonical source HEAD differs from `.super-gsd-version`.
- Make the remote launcher's cockpit starter come exclusively from the selected scripts directory.
- Test with a fake project whose vendored scripts deliberately fail if executed and a canonical override whose scripts leave observable evidence.

Commit only after verification:

```bash
git add super-gsd/scripts/sgsd super-gsd/scripts/sgsd-boot.sh super-gsd/scripts/sgsd-remote-tmux.sh super-gsd/scripts/sgsd-registry-sync.sh super-gsd/install.sh super-gsd/tests/propagation/runtime-provenance.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "feat: add provenance-safe Linux smoke"
```

## T150-04 — Write the propagation and reconciliation runbooks

`PROPAGATION.md` must contain:

- A matrix distinguishing:
  - hook script bodies: next hook event;
  - skills, agents, settings registrations: next client session;
  - registries and singleton caches: cache reset or new process;
  - PowerShell functions: `. $PROFILE` or new terminal;
  - Claude settings/hooks: restart the owning Claude session;
  - MCP modules: verified child termination and owning-session restart;
  - cockpit: verified PID termination followed by relaunch.
- Exact Windows and devcp commands used in T150-05 through T150-07.
- A local per-project hook-install command for repositories that only have a `super-gsd` junction.
- A worktree/junction section stating that pushing master does not move checked-out worktree branches.
- Evidence requirements: command, timestamp, machine, exit status, before/after PID or SHA, and redacted output.
- Rollback commands that restore the newly created installed-layer archive without deleting the archive or devcp fork.

`DEVCP-RECONCILIATION.md` must record these decisions:

- Do not rewrite or push the 883-commit `~/GSDedits` fork.
- Preserve `devcp-fork-backup-2026-08-05`.
- If a fork-only capability is valuable, extract reviewed patches onto a clean origin/master-based branch and commit them with the generic operator identity; never publish the original history.
- Take a fresh archive and before/after hash manifest for the installed scripts.
- Run the canonical installer non-destructively so canonical paths update while extra files remain.
- Inspect dependencies of `board-runner.cjs`, `execution-authority.sh`, `concurrency-policy.cjs`, and `decision-registry.cjs`.
- Use the VTP shadow-deployment posture: backup, fast-forward, install, verify SHA/smoke/hooks/model pin, then switch tmux/cockpit/MCP processes.
- Keep `/opt/clarity/project-clarity-erp/super-gsd` outside framework propagation.

Commit only after verification:

```bash
git add .planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md .planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md super-gsd/tests/propagation/runbook-contract.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "docs: add SGSD propagation and recovery runbook"
```

## T150-05 — OPERATOR-PRESENT: publish and propagate locally

Run from the clean P150 feature worktree:

```powershell
$ErrorActionPreference = 'Stop'

$p150Repo = (git rev-parse --show-toplevel).Trim()
Set-Location -LiteralPath $p150Repo
$p150FeatureBranch = (git branch --show-current).Trim()
$p150FeatureSha = (git rev-parse HEAD).Trim()
$p150RemoteUrl = (git remote get-url origin).Trim()

if (-not $p150FeatureBranch -or $p150FeatureBranch -eq 'master') {
  throw 'Run this publication ceremony from the completed P150 feature branch'
}
if ($p150RemoteUrl -notmatch 'Berrowj/super-gsd(?:\.git)?$') {
  throw "Unexpected origin: $p150RemoteUrl"
}
if (@(git status --porcelain=v1).Count -ne 0) {
  throw 'P150 feature worktree is dirty'
}

git fetch origin master
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed' }

git merge-base --is-ancestor origin/master $p150FeatureSha
if ($LASTEXITCODE -ne 0) {
  throw 'P150 feature branch is not a fast-forward descendant of origin/master'
}

$p150IdentityRows = @(git log --format='%H|%an|%ae|%cn|%ce' "origin/master..$p150FeatureSha")
if ($p150IdentityRows.Count -eq 0) { throw 'No outgoing P150 commits found' }

$p150AllowedIdentity = '^[0-9a-f]+\|operator\|operator@users\.noreply\.github\.com\|operator\|operator@users\.noreply\.github\.com$'
$p150BadIdentityRows = @($p150IdentityRows | Where-Object { $_ -notmatch $p150AllowedIdentity })
if ($p150BadIdentityRows.Count -ne 0) {
  $p150BadIdentityRows | Write-Host
  throw 'Outgoing history contains non-generic author or committer metadata'
}

git diff --check origin/master...$p150FeatureSha
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }

node --test `
  super-gsd/tests/propagation/sgsd-update-contract.test.cjs `
  super-gsd/tests/propagation/codex-hooks-install.test.cjs `
  super-gsd/tests/propagation/runtime-provenance.test.cjs `
  super-gsd/tests/propagation/runbook-contract.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'P150 verification tests failed' }

$p150PublishStage = Join-Path ([IO.Path]::GetTempPath()) ('sgsd-p150-publish-' + [guid]::NewGuid().ToString('N'))
git worktree add --detach $p150PublishStage origin/master
if ($LASTEXITCODE -ne 0) { throw 'Could not create detached publication worktree' }

try {
  git -C $p150PublishStage merge --ff-only $p150FeatureSha
  if ($LASTEXITCODE -ne 0) { throw 'Detached fast-forward merge failed' }

  git -C $p150PublishStage push origin HEAD:master
  if ($LASTEXITCODE -ne 0) { throw 'Push to origin/master failed' }
} finally {
  if (Test-Path -LiteralPath $p150PublishStage) {
    git worktree remove $p150PublishStage
  }
}

git fetch origin master
$p150PublishedSha = (git rev-parse origin/master).Trim()
if ($p150PublishedSha -ne $p150FeatureSha) {
  throw "Published SHA $p150PublishedSha differs from verified SHA $p150FeatureSha"
}

bash .\super-gsd\install.sh --update --install-global
if ($LASTEXITCODE -ne 0) { throw 'Local SGSD installer failed' }

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
if ($LASTEXITCODE -ne 0) { throw 'PowerShell shortcut installation failed' }

. $PROFILE
Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null

node .\super-gsd\tools\codex-hooks\install-hooks.cjs --project '$env:USERPROFILE\GSDedits'
if ($LASTEXITCODE -ne 0) { throw 'Local target hook merge failed' }

node .\super-gsd\tools\feature-propagation\audit.cjs --project-dir '$env:USERPROFILE\GSDedits' --json
if ($LASTEXITCODE -ne 0) { throw 'Local propagation audit failed' }
```

The orchestrator records the publication SHA, identity-gate count, installer exit codes, and profile command resolution in `150-VERIFICATION.md`.

## T150-06 — OPERATOR-PRESENT: local trust and reboot verification

First start Codex interactively:

```powershell
codex -C $env:USERPROFILE\GSDedits
```

Approve the displayed project hooks in Codex's interactive prompt. Do not pass a trust-bypass flag. Exit the interactive client after approval, then run:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = '$env:USERPROFILE\GSDedits'
Set-Location -LiteralPath $p150LocalRepo

sgsd -NoOpen
if ($LASTEXITCODE -ne 0) { throw 'Local no-open smoke failed' }

node .\super-gsd\tools\codex-hooks\self-test.cjs --project . --json
if ($LASTEXITCODE -ne 0) { throw 'Local hook self-test failed' }

$p150ForbiddenFile = Join-Path $p150LocalRepo 'secrets\p150-trust-probe.env'
codex exec -C $p150LocalRepo --sandbox workspace-write --ask-for-approval never --json "Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST. Do not use a shell command; report the hook denial."

if (Test-Path -LiteralPath $p150ForbiddenFile) {
  throw 'Forbidden local probe file was created'
}

$p150EventFile = Join-Path $p150LocalRepo '.planning\metrics\codex-tool-events.jsonl'
$p150BlockEvents = Get-Content -LiteralPath $p150EventFile |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object {
    $_.hook -eq 'block-forbidden-write' -and
    $_.decision -eq 'block' -and
    $_.reason -eq 'forbidden_path' -and
    $_.path -eq 'secrets/p150-trust-probe.env'
  }
if (-not $p150BlockEvents) { throw 'Local block event was not recorded' }

. $PROFILE
Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null

$p150McpProcesses = @(
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match '^(node|node\.exe)$' -and
      $_.CommandLine -match '(?i)super-gsd' -and
      $_.CommandLine -match '(?i)mcp'
    }
)
if ($p150McpProcesses.Count -gt 0) {
  $p150McpProcesses | Select-Object ProcessId, ParentProcessId, CommandLine | Format-List
  $p150McpConfirmation = Read-Host 'Type KILL to terminate only the displayed SGSD MCP children'
  if ($p150McpConfirmation -ne 'KILL') { throw 'MCP restart not approved' }
  foreach ($p150McpProcess in $p150McpProcesses) {
    Stop-Process -Id $p150McpProcess.ProcessId -ErrorAction Stop
  }
}

$p150CockpitPidFile = Join-Path $p150LocalRepo '.planning\runtime\cockpit-server.pid'
$p150OldCockpitPid = [int](Get-Content -LiteralPath $p150CockpitPidFile)
$p150OldCockpitProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$p150OldCockpitPid"
if (-not $p150OldCockpitProcess -or $p150OldCockpitProcess.CommandLine -notmatch '(?i)cockpit') {
  throw 'Cockpit PID file does not identify a cockpit process'
}
Stop-Process -Id $p150OldCockpitPid -ErrorAction Stop

sgsd-refresh -SkipPreflight
if ($LASTEXITCODE -ne 0) { throw 'Cockpit relaunch failed' }

$p150NewCockpitPid = [int](Get-Content -LiteralPath $p150CockpitPidFile)
$p150NewCockpitProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$p150NewCockpitPid"
if ($p150NewCockpitPid -eq $p150OldCockpitPid -or -not $p150NewCockpitProcess -or $p150NewCockpitProcess.CommandLine -notmatch '(?i)cockpit') {
  throw 'Cockpit did not relaunch as a new verified process'
}
```

Exit the current Claude session cleanly. Open a new Warp tab and run exactly:

```powershell
sg
```

The orchestrator then reruns `sgsd -NoOpen`, confirms the hook event and new cockpit PID, and records `PROFILE_RELOAD`, `LOCAL_MCP_RESTART`, and `LOCAL_COCKPIT_RESTART` with `exit=0` in `150-VERIFICATION.md`.

## T150-07 — OPERATOR-PRESENT: devcp reconciliation, update, trust, and reboot

This task follows the VTP shadow-deployment posture: preserve the old installed layer, update without deletion, verify the candidate, and only then reset the live session.

### A. Safety check, inventory, backup, and bootstrap

Connect:

```powershell
ssh devcp
```

On devcp, paste:

```bash
set -euo pipefail

p150_project=/opt/clarity/project-clarity-erp
p150_source="$HOME/.claude/super-gsd/source"
p150_global="$HOME/.claude/super-gsd"
p150_fork="$HOME/GSDedits"
p150_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
p150_reconcile="$p150_global/reconciliation/$p150_stamp"

printf '%s\n' '=== tmux sessions ==='
tmux list-sessions 2>/dev/null || true
printf '%s\n' '=== relevant processes ==='
pgrep -af 'claude|codex|sgsd-remote-tmux|sgsd-(mission-control|codex-monitor|narrative|autopilot-watchdog)' || true
printf '%s\n' '=== Clarity state; inspect only ==='
git -C "$p150_project" status --short --branch
printf '%s\n' '=== canonical source state ==='
git -C "$p150_source" status --porcelain=v1 --branch
printf '%s\n' '=== quarantined fork state; never update or push ==='
git -C "$p150_fork" status --short --branch

read -r -p 'Coordinate all relevant work above. Type CONTINUE only when propagation may proceed: ' p150_coordination
test "$p150_coordination" = CONTINUE

test -z "$(git -C "$p150_source" status --porcelain=v1)"
git -C "$p150_fork" show-ref --verify refs/heads/devcp-fork-backup-2026-08-05
git -C "$p150_fork" rev-list --left-right --count origin/master...HEAD

mkdir -p "$p150_reconcile"
tar -czf "$p150_reconcile/scripts-before.tgz" -C "$p150_global" scripts

(
  cd "$p150_global/scripts"
  find . -type f -print0 | sort -z | xargs -0 sha256sum
) >"$p150_reconcile/installed-before.sha256"

diff -qr "$p150_source/super-gsd/scripts" "$p150_global/scripts" \
  >"$p150_reconcile/diff-before.txt" || true

for p150_fork_file in \
  board-runner.cjs \
  execution-authority.sh \
  concurrency-policy.cjs \
  decision-registry.cjs
do
  test -f "$p150_global/scripts/$p150_fork_file"
  {
    printf '\n=== %s ===\n' "$p150_fork_file"
    rg -n "require\\(|import |source |\\. " "$p150_global/scripts/$p150_fork_file" || true
  } >>"$p150_reconcile/fork-only-dependencies.txt"
done

git -C "$p150_source" fetch origin master
git -C "$p150_source" merge-base --is-ancestor HEAD origin/master
git -C "$p150_source" merge --ff-only origin/master
test "$(git -C "$p150_source" rev-parse HEAD)" = "$(git -C "$p150_source" rev-parse origin/master)"

cd "$p150_project"
bash "$p150_source/super-gsd/install.sh" --install-global
```

This bootstrap installs the repaired `/sgsd-update` implementation without deleting installed extras. Do not run any pull, push, reset, rebase, or author rewrite in `~/GSDedits`.

### B. Exercise the actual `/sgsd-update`

From `/opt/clarity/project-clarity-erp`, start Claude interactively:

```bash
claude
```

At the Claude prompt, enter exactly:

```text
/sgsd-update
```

Wait for its guarded source-SHA and installer-success output, then exit Claude cleanly.

### C. Verify the candidate before switching live processes

```bash
set -euo pipefail

p150_project=/opt/clarity/project-clarity-erp
p150_source="$HOME/.claude/super-gsd/source"
p150_global="$HOME/.claude/super-gsd"
p150_reconcile="$(find "$p150_global/reconciliation" -mindepth 1 -maxdepth 1 -type d | sort | tail -1)"
p150_origin_sha="$(git -C "$p150_source" ls-remote origin refs/heads/master | cut -f1)"
p150_source_sha="$(git -C "$p150_source" rev-parse HEAD)"
p150_project_sha="$(cat "$p150_project/.super-gsd-version")"

test "$p150_source_sha" = "$p150_origin_sha"
test "$p150_project_sha" = "$p150_origin_sha"
test -z "$(git -C "$p150_source" status --porcelain=v1)"

while IFS= read -r -d '' p150_canonical_file; do
  p150_relative="${p150_canonical_file#"$p150_source/super-gsd/scripts/"}"
  cmp -s "$p150_canonical_file" "$p150_global/scripts/$p150_relative" || {
    printf 'Installed canonical file differs: %s\n' "$p150_relative" >&2
    exit 1
  }
done < <(find "$p150_source/super-gsd/scripts" -type f -print0)

for p150_fork_file in \
  board-runner.cjs \
  execution-authority.sh \
  concurrency-policy.cjs \
  decision-registry.cjs
do
  test -f "$p150_global/scripts/$p150_fork_file"
done

(
  cd "$p150_global/scripts"
  find . -type f -print0 | sort -z | xargs -0 sha256sum
) >"$p150_reconcile/installed-after.sha256"

diff -qr "$p150_source/super-gsd/scripts" "$p150_global/scripts" \
  >"$p150_reconcile/diff-after.txt" || true

grep -F 'gpt-5.6-sol' "$p150_project/.planning/config.json"

cd "$p150_project"
sgsd -NoOpen
node "$p150_source/super-gsd/tools/codex-hooks/self-test.cjs" --project "$p150_project" --json
```

The smoke must print the global scripts path and `$p150_source_sha`; output referencing `$p150_project/super-gsd/scripts` is a failure.

### D. Grant devcp Codex hook trust

Run interactively:

```bash
cd /opt/clarity/project-clarity-erp
codex
```

Approve the displayed hooks. Do not use `--dangerously-bypass-hook-trust`. Exit Codex, then run:

```bash
set -euo pipefail

p150_project=/opt/clarity/project-clarity-erp
cd "$p150_project"

codex exec -C "$p150_project" --sandbox workspace-write --ask-for-approval never --json \
  "Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST. Do not use a shell command; report the hook denial."

test ! -e "$p150_project/secrets/p150-trust-probe.env"

node - "$p150_project/.planning/metrics/codex-tool-events.jsonl" <<'NODE'
const fs = require('fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const found = rows.some((row) =>
  row.hook === 'block-forbidden-write' &&
  row.decision === 'block' &&
  row.reason === 'forbidden_path' &&
  row.path === 'secrets/p150-trust-probe.env');
if (!found) {
  console.error('Expected forbidden-write event is absent');
  process.exit(1);
}
NODE
```

### E. Switch verified runtime processes

```bash
set -euo pipefail

p150_project=/opt/clarity/project-clarity-erp
p150_global="$HOME/.claude/super-gsd"
p150_source="$HOME/.claude/super-gsd/source"

mapfile -t p150_mcp_pids < <(
  for p150_candidate_pid in $(pgrep -f '[m]cp' || true); do
    test -r "/proc/$p150_candidate_pid/cmdline" || continue
    p150_candidate_cmd="$(tr '\0' ' ' <"/proc/$p150_candidate_pid/cmdline")"
    if printf '%s' "$p150_candidate_cmd" | grep -qi 'super-gsd' &&
       printf '%s' "$p150_candidate_cmd" | grep -qi 'mcp'; then
      printf '%s\n' "$p150_candidate_pid"
    fi
  done
)

if ((${#p150_mcp_pids[@]} > 0)); then
  for p150_mcp_pid in "${p150_mcp_pids[@]}"; do
    printf '%s: ' "$p150_mcp_pid"
    tr '\0' ' ' <"/proc/$p150_mcp_pid/cmdline"
    printf '\n'
  done
  read -r -p 'Type KILL to terminate only the displayed SGSD MCP children: ' p150_mcp_confirmation
  test "$p150_mcp_confirmation" = KILL
  kill "${p150_mcp_pids[@]}"
fi

p150_cockpit_pid_file="$p150_project/.planning/runtime/cockpit-server.pid"
if test -f "$p150_cockpit_pid_file"; then
  p150_old_cockpit_pid="$(cat "$p150_cockpit_pid_file")"
  test -r "/proc/$p150_old_cockpit_pid/cmdline"
  p150_old_cockpit_cmd="$(tr '\0' ' ' <"/proc/$p150_old_cockpit_pid/cmdline")"
  printf '%s\n' "$p150_old_cockpit_cmd" | grep -qi 'cockpit'
  kill "$p150_old_cockpit_pid"
fi

bash "$p150_global/scripts/sgsd-remote-tmux.sh" \
  --project "$p150_project" \
  --session clarity-sgsd \
  --scripts-dir "$p150_global/scripts" \
  --agents-dir "$HOME/.claude/agents" \
  --source-dir "$p150_source" \
  --reset --greet --no-attach

tmux has-session -t clarity-sgsd

p150_new_cockpit_pid="$(cat "$p150_cockpit_pid_file")"
test -r "/proc/$p150_new_cockpit_pid/cmdline"
tr '\0' ' ' <"/proc/$p150_new_cockpit_pid/cmdline" | grep -qi 'cockpit'

bash "$p150_global/scripts/sgsd-remote-tmux.sh" \
  --project "$p150_project" \
  --session clarity-sgsd \
  --scripts-dir "$p150_global/scripts" \
  --agents-dir "$HOME/.claude/agents" \
  --source-dir "$p150_source" \
  --doctor
```

Only after all mechanical post-checks pass may the operator attach:

```bash
tmux attach -t clarity-sgsd
```

The orchestrator records the origin/source/project SHAs, backup path, manifest paths, preserved fork-only files, model-pin probe, trust event, and before/after process IDs in `150-VERIFICATION.md`.

## Acceptance mapping

| Criterion | Tasks |
|---|---|
| AC-150a — devcp shows pushed HEAD | T150-01, T150-03, T150-05, T150-07 |
| AC-150b — both post-update smokes | T150-02, T150-03, T150-06, T150-07 |
| AC-150c — trust and forbidden-write block on both | T150-02, T150-06, T150-07 |
| AC-150d — runbook reboot commands executed | T150-04, T150-06, T150-07 |
| No-PII publication | T150-04, T150-05, T150-07 |
| Non-destructive 43-file reconciliation | T150-04, T150-07 |
| 883-commit fork quarantine | T150-04, T150-07 |

## Source Audit

| Source | Status | Plan use |
|---|---|---|
| CONTEXT | Supplied verbatim in the planning request | Goals, target machines, operator-present boundaries, worktree behavior, devcp fork/drift facts, and acceptance criteria. |
| RESEARCH | Supplied verbatim in the planning request; cited files selectively audited | Canonical installer behavior, updater defects, hook installation gap, trust mechanism, cache/restart boundaries, runtime-provenance conflict, and safe devcp bootstrap. |
| VTP | Supplied enrichment; one applicable hit | Shadow-deployment posture in T150-04 and T150-07: backup and verify before switching live runtime; no destructive reconciliation. |
| design-spec | `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:159-163` as quoted by RESEARCH | AC-150(a–d) is preserved in the semantic acceptance criteria and task mapping. |

