---
schema_version: 2
plan_id: "150-01"
phase: "150"
slug: propagation-trust-runbook
milestone: "v3.5"
title: "Propagation, Trust Grant, and Reboot Runbook"
status: planned
depends_on: ["145", "146", "147", "148", "149"]
objective: "Make SGSD governance propagate as a verified runtime mechanism across local and devcp installations, with guarded updates, installable Codex hooks, explicit runtime provenance, interactive trust grants, complete installed-layer recovery, and identity-verified reboot procedures."
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
    input: "The published origin/master SHA, devcp canonical-source HEAD, devcp project .super-gsd-version, and devcp no-open runtime provenance after the guarded update."
    expected_outcome: "The three full commit SHAs are identical, and the devcp no-open smoke identifies the global canonical scripts path while rejecting Clarity's vendored super-gsd path."
    verification_cmd: |
      $ErrorActionPreference = 'Stop'
      $p150OriginRow = @(git ls-remote origin refs/heads/master)
      if ($LASTEXITCODE -ne 0 -or $p150OriginRow.Count -ne 1) {
        throw 'Could not resolve the published origin/master SHA'
      }
      $p150OriginSha = (($p150OriginRow[0] -split '\s+')[0]).Trim()
      if ($p150OriginSha -notmatch '^[0-9a-f]{40}$') {
        throw "Invalid origin/master SHA: $p150OriginSha"
      }

      $p150RemoteScript = @'
      set -euo pipefail
      expected_sha="$1"
      project=/opt/clarity/project-clarity-erp
      source="$HOME/.claude/super-gsd/source"
      global_scripts="$HOME/.claude/super-gsd/scripts"
      vendored_scripts="$project/super-gsd/scripts"
      output="$(mktemp)"
      trap 'rm -f -- "$output"' EXIT

      source_sha="$(git -C "$source" rev-parse HEAD)"
      project_sha="$(cat "$project/.super-gsd-version")"
      test "$source_sha" = "$expected_sha"
      test "$project_sha" = "$expected_sha"

      cd "$project"
      sgsd -NoOpen >"$output" 2>&1
      grep -F -- "$expected_sha" "$output"
      grep -F -- "$global_scripts" "$output"
      if grep -F -- "$vendored_scripts" "$output"; then
        printf 'Vendored runtime path appeared in no-open output\n' >&2
        exit 1
      fi

      printf 'source_sha=%s\n' "$source_sha"
      printf 'project_pin=%s\n' "$project_sha"
      printf 'runtime_scripts=%s\n' "$global_scripts"
      '@

      $p150RemoteOutput = @(
        $p150RemoteScript | ssh devcp bash -s -- $p150OriginSha
      )
      if ($LASTEXITCODE -ne 0) {
        $p150RemoteOutput | Write-Host
        throw 'devcp propagation SHA or runtime-provenance verification failed'
      }

      foreach ($p150ExpectedMarker in @(
        "source_sha=$p150OriginSha",
        "project_pin=$p150OriginSha"
      )) {
        if (-not ($p150RemoteOutput | Where-Object { $_.Trim() -eq $p150ExpectedMarker })) {
          throw "Missing devcp propagation marker: $p150ExpectedMarker"
        }
      }

  - id: "AC-150b"
    input: "Real local and devcp installations after updater and installer execution."
    expected_outcome: "The local canonical-source HEAD equals published origin/master, and both machines complete the literal sgsd -NoOpen preflight and the installed Codex-hook self-test with zero exit status."
    verification_cmd: |
      $ErrorActionPreference = 'Stop'
      $p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'

      $p150LocalHead = (git -C $p150LocalRepo rev-parse HEAD).Trim()
      if ($LASTEXITCODE -ne 0 -or $p150LocalHead -notmatch '^[0-9a-f]{40}$') {
        throw 'Could not resolve local canonical-source HEAD'
      }
      $p150OriginRow = @(
        git -C $p150LocalRepo ls-remote origin refs/heads/master
      )
      if ($LASTEXITCODE -ne 0 -or $p150OriginRow.Count -ne 1) {
        throw 'Could not resolve published origin/master for local verification'
      }
      $p150OriginSha = (($p150OriginRow[0] -split '\s+')[0]).Trim()
      if ($p150OriginSha -notmatch '^[0-9a-f]{40}$') {
        throw "Invalid published origin/master SHA: $p150OriginSha"
      }
      if ($p150LocalHead -ne $p150OriginSha) {
        throw "Local canonical HEAD $p150LocalHead differs from published SHA $p150OriginSha"
      }

      Push-Location -LiteralPath $p150LocalRepo
      try {
        sgsd -NoOpen
        if ($LASTEXITCODE -ne 0) { throw 'Local no-open smoke failed' }

        node .\super-gsd\tools\codex-hooks\self-test.cjs --project . --json
        if ($LASTEXITCODE -ne 0) { throw 'Local hook self-test failed' }
      } finally {
        Pop-Location
      }

      $p150RemoteScript = @'
      set -euo pipefail
      project="$1"
      source="$HOME/.claude/super-gsd/source"
      cd "$project"
      sgsd -NoOpen
      node "$source/super-gsd/tools/codex-hooks/self-test.cjs" \
        --project "$project" \
        --json
      '@

      $p150RemoteScript |
        ssh devcp bash -s -- /opt/clarity/project-clarity-erp
      if ($LASTEXITCODE -ne 0) {
        throw 'devcp post-update no-open or hook self-test failed'
      }

  - id: "AC-150c-local"
    input: "A uniquely identified real Codex workspace-write dispatch in %USERPROFILE%\\GSDedits attempting exactly one apply_patch write to secrets/p150-trust-probe.env, with the ledger byte offset captured before dispatch."
    expected_outcome: "The dispatch exits successfully after reporting the trusted hook denial, the forbidden file remains absent, and a matching block event with a timestamp no earlier than the probe start occurs only in bytes newly appended after the captured ledger offset."
    verification_cmd: |
      $ErrorActionPreference = 'Stop'
      $p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
      $p150ForbiddenFile = Join-Path $p150LocalRepo 'secrets\p150-trust-probe.env'
      $p150EventFile = Join-Path $p150LocalRepo '.planning\metrics\codex-tool-events.jsonl'
      $p150ProbeId = [guid]::NewGuid().ToString('N')

      if (Test-Path -LiteralPath $p150ForbiddenFile) {
        throw 'Forbidden local probe file already exists; inspect it rather than deleting it'
      }

      $p150LedgerOffset = if (Test-Path -LiteralPath $p150EventFile) {
        (Get-Item -LiteralPath $p150EventFile).Length
      } else {
        0L
      }
      $p150ProbeStarted = [DateTimeOffset]::UtcNow

      $p150Prompt = @"
      Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST_$p150ProbeId. Do not use a shell command; report the hook denial. Probe ID: $p150ProbeId.
      "@
      codex exec `
        -C $p150LocalRepo `
        --sandbox workspace-write `
        --ask-for-approval never `
        --json `
        $p150Prompt
      if ($LASTEXITCODE -ne 0) {
        throw "Local Codex trust probe process failed for probe $p150ProbeId"
      }

      if (Test-Path -LiteralPath $p150ForbiddenFile) {
        throw 'Forbidden local probe file was created'
      }
      if (-not (Test-Path -LiteralPath $p150EventFile)) {
        throw 'Local hook ledger was not created'
      }
      if ((Get-Item -LiteralPath $p150EventFile).Length -le $p150LedgerOffset) {
        throw 'Local hook ledger received no newly appended bytes'
      }

      $p150Stream = [IO.File]::Open(
        $p150EventFile,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite
      )
      try {
        [void]$p150Stream.Seek($p150LedgerOffset, [IO.SeekOrigin]::Begin)
        $p150Reader = [IO.StreamReader]::new(
          $p150Stream,
          [Text.Encoding]::UTF8,
          $true,
          4096,
          $true
        )
        try {
          $p150AppendedText = $p150Reader.ReadToEnd()
        } finally {
          $p150Reader.Dispose()
        }
      } finally {
        $p150Stream.Dispose()
      }

      $p150NewEvents = @(
        $p150AppendedText -split '\r?\n' |
          Where-Object { $_.Trim() } |
          ForEach-Object { $_ | ConvertFrom-Json }
      )
      $p150MatchingEvents = @(
        $p150NewEvents |
          Where-Object {
            $_.hook -eq 'block-forbidden-write' -and
            $_.decision -eq 'block' -and
            $_.reason -eq 'forbidden_path' -and
            $_.path -eq 'secrets/p150-trust-probe.env' -and
            [DateTimeOffset]$_.ts -ge $p150ProbeStarted
          }
      )
      if ($p150MatchingEvents.Count -lt 1) {
        throw "No newly appended local forbidden-write event for probe $p150ProbeId"
      }

  - id: "AC-150c-devcp"
    input: "A uniquely identified real Codex workspace-write dispatch in /opt/clarity/project-clarity-erp attempting exactly one apply_patch write to secrets/p150-trust-probe.env, with the ledger byte offset captured before dispatch."
    expected_outcome: "The independently trusted devcp hook denies the write, the dispatch and SSH transport exit successfully, the file remains absent, and a matching block event occurs in newly appended ledger bytes after the captured offset and probe start."
    verification_cmd: |
      $ErrorActionPreference = 'Stop'
      $p150ProbeId = [guid]::NewGuid().ToString('N')

      $p150RemoteScript = @'
      set -euo pipefail
      project="$1"
      probe_id="$2"
      event_file="$project/.planning/metrics/codex-tool-events.jsonl"
      forbidden_file="$project/secrets/p150-trust-probe.env"

      if test -e "$forbidden_file"; then
        printf 'Forbidden devcp probe file already exists; inspect it without deleting it\n' >&2
        exit 1
      fi

      if test -e "$event_file"; then
        ledger_offset="$(stat -c '%s' "$event_file")"
      else
        ledger_offset=0
      fi
      probe_started="$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"

      prompt="Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST_${probe_id}. Do not use a shell command; report the hook denial. Probe ID: ${probe_id}."
      if ! codex exec \
        -C "$project" \
        --sandbox workspace-write \
        --ask-for-approval never \
        --json \
        "$prompt"
      then
        printf 'devcp Codex trust-probe process failed: %s\n' "$probe_id" >&2
        exit 1
      fi

      test ! -e "$forbidden_file"
      test -e "$event_file"
      test "$(stat -c '%s' "$event_file")" -gt "$ledger_offset"

      node - "$event_file" "$ledger_offset" "$probe_started" <<'NODE'
      const fs = require("fs");
      const [eventFile, rawOffset, probeStarted] = process.argv.slice(2);
      const offset = Number(rawOffset);
      const bytes = fs.readFileSync(eventFile);
      if (!Number.isSafeInteger(offset) || offset < 0 || bytes.length <= offset) {
        console.error("No newly appended devcp ledger bytes");
        process.exit(1);
      }
      const rows = bytes
        .subarray(offset)
        .toString("utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      const startMs = Date.parse(probeStarted);
      const found = rows.some((row) =>
        row.hook === "block-forbidden-write" &&
        row.decision === "block" &&
        row.reason === "forbidden_path" &&
        row.path === "secrets/p150-trust-probe.env" &&
        Date.parse(row.ts) >= startMs
      );
      if (!found) {
        console.error("No matching event in newly appended devcp ledger bytes");
        process.exit(1);
      }
      NODE

      printf 'probe_id=%s ledger_offset=%s\n' "$probe_id" "$ledger_offset"
      '@

      $p150RemoteScript |
        ssh devcp bash -s -- /opt/clarity/project-clarity-erp $p150ProbeId
      if ($LASTEXITCODE -ne 0) {
        throw "devcp forbidden-write trust probe failed for probe $p150ProbeId"
      }

  - id: "AC-150d"
    input: "The Windows profile/MCP/cockpit restart and devcp MCP/cockpit/tmux reset procedures executed from PROPAGATION.md, with machine-readable before/after identities and provenance."
    expected_outcome: "Every required evidence marker independently records exit=0; local and devcp MCP, cockpit, and tmux identities differ before and after; all recorded after-processes are live; and MCP/cockpit command lines resolve through the intended canonical runtime."
    verification_cmd: |
      $ErrorActionPreference = 'Stop'
      $p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
      $p150PhaseDir = Join-Path $p150LocalRepo '.planning\milestones\v3.5\phases\150-propagation-trust-runbook'
      $p150Verification = Join-Path $p150PhaseDir '150-VERIFICATION.md'
      $p150LocalEvidencePath = Join-Path $p150PhaseDir '150-LOCAL-RESTART-EVIDENCE.json'
      $p150DevcpEvidencePath = Join-Path $p150PhaseDir '150-DEVCP-RESTART-EVIDENCE.json'
      $p150CockpitPidFile = Join-Path $p150LocalRepo '.planning\runtime\cockpit-server.pid'

      foreach ($p150RequiredMarker in @(
        'PROFILE_RELOAD',
        'LOCAL_MCP_RESTART',
        'LOCAL_COCKPIT_RESTART',
        'DEVCP_MCP_RESTART',
        'DEVCP_COCKPIT_RESTART',
        'DEVCP_TMUX_RESET'
      )) {
        $p150MarkerMatch = Select-String `
          -LiteralPath $p150Verification `
          -SimpleMatch `
          -Pattern "$p150RequiredMarker exit=0"
        if (-not $p150MarkerMatch) {
          throw "Missing independent reboot marker: $p150RequiredMarker exit=0"
        }
      }

      $p150LocalEvidence = Get-Content -Raw -LiteralPath $p150LocalEvidencePath |
        ConvertFrom-Json
      $p150DevcpEvidence = Get-Content -Raw -LiteralPath $p150DevcpEvidencePath |
        ConvertFrom-Json

      foreach ($p150Component in @(
        $p150LocalEvidence.profile,
        $p150LocalEvidence.local_mcp,
        $p150LocalEvidence.local_cockpit,
        $p150DevcpEvidence.devcp_mcp,
        $p150DevcpEvidence.devcp_cockpit,
        $p150DevcpEvidence.devcp_tmux
      )) {
        if ($null -eq $p150Component -or $p150Component.exit -ne 0) {
          throw 'Restart evidence contains a missing or non-zero component'
        }
      }

      Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null

      $p150LocalMcpBefore = @(
        $p150LocalEvidence.local_mcp.before |
          ForEach-Object { "$($_.pid)|$($_.started_utc)" }
      )
      $p150LocalMcpAfter = @(
        $p150LocalEvidence.local_mcp.after |
          ForEach-Object { "$($_.pid)|$($_.started_utc)" }
      )
      if ($p150LocalMcpBefore.Count -eq 0 -or $p150LocalMcpAfter.Count -eq 0) {
        throw 'Local MCP before/after evidence is empty'
      }
      if (@($p150LocalMcpAfter | Where-Object { $p150LocalMcpBefore -contains $_ }).Count -ne 0) {
        throw 'A local MCP identity survived the required restart'
      }

      $p150ExpectedLocalRoot = $p150LocalEvidence.local_mcp.expected_root
      foreach ($p150RecordedMcp in @($p150LocalEvidence.local_mcp.after)) {
        if ($p150RecordedMcp.command_line.IndexOf(
          $p150ExpectedLocalRoot,
          [StringComparison]::OrdinalIgnoreCase
        ) -lt 0 -or $p150RecordedMcp.command_line -notmatch '(?i)mcp') {
          throw "Recorded local MCP provenance is invalid for PID $($p150RecordedMcp.pid)"
        }
        $p150LiveMcp = Get-CimInstance Win32_Process `
          -Filter "ProcessId=$($p150RecordedMcp.pid)"
        if (-not $p150LiveMcp) {
          throw "Recorded local MCP PID is no longer live: $($p150RecordedMcp.pid)"
        }
        $p150LiveStarted = ([DateTime]$p150LiveMcp.CreationDate).
          ToUniversalTime().
          ToString('o')
        if ($p150LiveStarted -ne $p150RecordedMcp.started_utc) {
          throw "Local MCP PID was reused: $($p150RecordedMcp.pid)"
        }
      }

      $p150LocalCockpitBefore = "$($p150LocalEvidence.local_cockpit.before.pid)|$($p150LocalEvidence.local_cockpit.before.started_utc)"
      $p150LocalCockpitAfter = "$($p150LocalEvidence.local_cockpit.after.pid)|$($p150LocalEvidence.local_cockpit.after.started_utc)"
      if ($p150LocalCockpitBefore -eq $p150LocalCockpitAfter) {
        throw 'Local cockpit process identity did not change'
      }
      $p150CurrentCockpitPid = [int](Get-Content -LiteralPath $p150CockpitPidFile)
      if ($p150CurrentCockpitPid -ne [int]$p150LocalEvidence.local_cockpit.after.pid) {
        throw 'Local cockpit PID file does not match recorded after identity'
      }
      $p150CurrentCockpit = Get-CimInstance Win32_Process `
        -Filter "ProcessId=$p150CurrentCockpitPid"
      if (-not $p150CurrentCockpit -or
          $p150CurrentCockpit.CommandLine -notmatch '(?i)cockpit') {
        throw 'Local cockpit after-process is not live or lacks cockpit provenance'
      }

      $p150DevcpMcpBefore = @(
        $p150DevcpEvidence.devcp_mcp.before |
          ForEach-Object { "$($_.pid):$($_.start_ticks)" }
      )
      $p150DevcpMcpAfter = @(
        $p150DevcpEvidence.devcp_mcp.after |
          ForEach-Object { "$($_.pid):$($_.start_ticks)" }
      )
      if ($p150DevcpMcpBefore.Count -eq 0 -or $p150DevcpMcpAfter.Count -eq 0) {
        throw 'devcp MCP before/after evidence is empty'
      }
      if (@($p150DevcpMcpAfter | Where-Object { $p150DevcpMcpBefore -contains $_ }).Count -ne 0) {
        throw 'A devcp MCP identity survived the required restart'
      }

      $p150DevcpCockpitBefore = "$($p150DevcpEvidence.devcp_cockpit.before.pid):$($p150DevcpEvidence.devcp_cockpit.before.start_ticks)"
      $p150DevcpCockpitAfter = "$($p150DevcpEvidence.devcp_cockpit.after.pid):$($p150DevcpEvidence.devcp_cockpit.after.start_ticks)"
      if ($p150DevcpCockpitBefore -eq $p150DevcpCockpitAfter) {
        throw 'devcp cockpit process identity did not change'
      }

      $p150DevcpTmuxBefore = "$($p150DevcpEvidence.devcp_tmux.before.session_id):$($p150DevcpEvidence.devcp_tmux.before.session_created):$($p150DevcpEvidence.devcp_tmux.before.session_pid)"
      $p150DevcpTmuxAfter = "$($p150DevcpEvidence.devcp_tmux.after.session_id):$($p150DevcpEvidence.devcp_tmux.after.session_created):$($p150DevcpEvidence.devcp_tmux.after.session_pid)"
      if ($p150DevcpTmuxBefore -eq $p150DevcpTmuxAfter) {
        throw 'devcp tmux session identity did not change'
      }

      $p150McpPairs = $p150DevcpMcpAfter -join ','
      $p150RemoteScript = @'
      set -euo pipefail
      mcp_pairs="$1"
      cockpit_pair="$2"
      tmux_identity="$3"
      expected_sha="$4"
      project=/opt/clarity/project-clarity-erp
      source="$HOME/.claude/super-gsd/source"
      expected_mcp_root="$source/super-gsd/"
      expected_cockpit_root="$HOME/.claude/super-gsd/scripts"

      test "$(git -C "$source" rev-parse HEAD)" = "$expected_sha"

      IFS=',' read -r -a pairs <<<"$mcp_pairs"
      test "${#pairs[@]}" -gt 0
      for pair in "${pairs[@]}"; do
        pid="${pair%%:*}"
        ticks="${pair#*:}"
        test -r "/proc/$pid/stat"
        test "$(awk '{print $22}' "/proc/$pid/stat")" = "$ticks"
        cmd="$(tr '\0' ' ' <"/proc/$pid/cmdline")"
        printf '%s\n' "$cmd" | grep -F -- "$expected_mcp_root"
        printf '%s\n' "$cmd" | grep -qi -- 'mcp'
      done

      cockpit_pid="${cockpit_pair%%:*}"
      cockpit_ticks="${cockpit_pair#*:}"
      test -r "/proc/$cockpit_pid/stat"
      test "$(awk '{print $22}' "/proc/$cockpit_pid/stat")" = "$cockpit_ticks"
      cockpit_cmd="$(tr '\0' ' ' <"/proc/$cockpit_pid/cmdline")"
      printf '%s\n' "$cockpit_cmd" | grep -F -- "$expected_cockpit_root"
      printf '%s\n' "$cockpit_cmd" | grep -qi -- 'cockpit'

      current_tmux="$(tmux display-message -p -t clarity-sgsd '#{session_id}:#{session_created}:#{pid}')"
      test "$current_tmux" = "$tmux_identity"
      '@

      $p150OriginRow = @(git ls-remote origin refs/heads/master)
      if ($LASTEXITCODE -ne 0 -or $p150OriginRow.Count -ne 1) {
        throw 'Could not resolve origin/master for reboot provenance'
      }
      $p150OriginSha = (($p150OriginRow[0] -split '\s+')[0]).Trim()

      $p150RemoteScript |
        ssh devcp bash -s -- `
          $p150McpPairs `
          $p150DevcpCockpitAfter `
          $p150DevcpTmuxAfter `
          $p150OriginSha
      if ($LASTEXITCODE -ne 0) {
        throw 'Live devcp after-identities or post-restart provenance are invalid'
      }

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
        - "bash super-gsd/scripts/sgsd-boot.sh -NoOpen --project \"$PWD\" --scripts-dir \"$PWD/super-gsd/scripts\" --agents-dir \"$PWD/super-gsd/agents\" --source-dir \"$PWD\""
        - "bash super-gsd/scripts/sgsd-remote-tmux.sh --project \"$PWD\" --scripts-dir \"$PWD/super-gsd/scripts\" --agents-dir \"$PWD/super-gsd/agents\" --source-dir \"$PWD\" --doctor"
        - "rg -n -- \"-NoOpen|--no-open|--scripts-dir|--agents-dir|--source-dir|Framework HEAD\" super-gsd/scripts/sgsd super-gsd/scripts/sgsd-boot.sh super-gsd/scripts/sgsd-remote-tmux.sh"

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
    type: operator-present
    agent: codex
    model: codex
    files_touched:
      - "~/.claude/agents/"
      - "~/.claude/commands/"
      - "~/.claude/hooks/"
      - "~/.claude/settings.json"
      - "~/.claude/get-shit-done/templates/super-gsd/"
      - "~/.claude/get-shit-done/workflows/"
      - "~/.claude/get-shit-done/config/model-routing.json"
      - "~/.claude/super-gsd/scripts/"
      - "~/.local/bin/sgsd"
      - "PowerShell:$PROFILE"
      - "%USERPROFILE%/GSDedits/.codex/hooks.json"
      - "git:%USERPROFILE%/GSDedits:refs/heads/master"
      - "git:refs/remotes/origin/master"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VERIFICATION.md"
    input_contract: |
      Tasks T150-01 through T150-04 are committed on a clean feature branch. The operator is present for the identity gate, guarded fast-forward of the clean local canonical master worktree, local installer/profile mutation, local audit, and fast-forward publication to origin/master.
    output_contract: |
      Every outgoing commit has the generic operator author and committer identity. Before local installation and verification, the expected-origin local canonical master worktree fast-forwards with --ff-only to the verified feature SHA under explicit operator coordination. Before publication, the local global installation is refreshed, PowerShell functions are reinstalled, the local target receives merged Codex hooks, and the local audit and smoke pass from that SHA. Only then does origin/master fast-forward to the verified feature SHA.
    hypothesis: "Making a guarded local canonical-source fast-forward, installation, and audit a pre-publication gate prevents publishing a substrate that already fails its first real installation."
    falsifier: "An outgoing identity differs from the generic identity, the local canonical worktree is dirty or has an unexpected origin, its master does not fast-forward to the feature SHA before installation, local installation or audit fails yet publication occurs, publication is non-fast-forward, or origin/master differs from the verified feature SHA."
    stop_rule: "Any dirty-worktree, unexpected remote, missing operator coordination, identity, fast-forward, SHA, test, installer, hook-merge, audit, or smoke failure before push prevents publication. If the local canonical worktree is dirty, display its status and abort with instructions to coordinate and clean it manually; do not stash, discard, or overwrite its changes. Once push succeeds it is not undone by force or history rewrite: any later verification failure freezes further propagation, records the published SHA and failure, and is repaired only by a new forward commit."
    verification:
      commands:
        - "git fetch origin master && git rev-parse HEAD && git rev-parse origin/master"
        - "git log origin/master..HEAD --format=\"%H %an <%ae> %cn <%ce>\""
        - "git -C $HOME/GSDedits rev-parse --abbrev-ref HEAD && git -C $HOME/GSDedits rev-parse HEAD"
        - "node super-gsd/tools/feature-propagation/audit.cjs --project-dir $HOME/GSDedits --json"
        - "powershell.exe -NoProfile -Command \"Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop | Select-Object Name,CommandType\""

  - id: "T150-06"
    type: operator-present
    agent: codex
    model: codex
    files_touched:
      - "~/.codex/state_5.sqlite"
      - "%USERPROFILE%/GSDedits/.planning/metrics/codex-tool-events.jsonl"
      - "%USERPROFILE%/GSDedits/.planning/runtime/cockpit-server.pid"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-LOCAL-RESTART-EVIDENCE.json"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VERIFICATION.md"
    input_contract: |
      Local hooks are installed and the operator can interact with Codex's trust prompt. No trust-bypass flag is permitted. The operator can exit and reopen the owning Warp/Claude session, and the SGSD MCP process command lines can be inspected before termination.
    output_contract: |
      Local trust is granted interactively. A real forbidden-write dispatch is blocked and matched only within newly appended ledger bytes. sgsd -NoOpen passes. Profile functions reload. Verified MCP children and cockpit are replaced by new identities, the after-MCP command lines use %USERPROFILE%\GSDedits\super-gsd, and Claude is relaunched through sg.
    hypothesis: "Interactive approval, a byte-offset-bounded hook event, and explicit before/after process evidence prove both enforcement and removal of stale runtime state."
    falsifier: "The forbidden file is created, Codex exits unchecked, a historical ledger row satisfies the probe, an unverified PID is killed, an old process identity survives, or post-restart MCP provenance points outside the canonical local source."
    stop_rule: "Do not claim trust from state-database presence alone. Do not delete a pre-existing probe file. Do not kill an MCP or cockpit PID unless its command line is displayed and matches the intended SGSD process. Do not emit exit=0 markers until after identities and provenance are compared."
    verification:
      commands:
        - "sgsd -NoOpen"
        - "node $HOME/GSDedits/super-gsd/tools/codex-hooks/self-test.cjs --project $HOME/GSDedits --json"
        - "Test-Path $HOME/GSDedits/secrets/p150-trust-probe.env | Where-Object { $_ } | ForEach-Object { throw 'Forbidden file exists' }"
        - "Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop"
        - "Get-Content -Raw $HOME/GSDedits/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-LOCAL-RESTART-EVIDENCE.json | ConvertFrom-Json"

  - id: "T150-07"
    type: operator-present
    agent: codex
    model: codex
    files_touched:
      - "devcp:~/.claude/super-gsd/source/"
      - "devcp:~/.claude/agents/"
      - "devcp:~/.claude/commands/"
      - "devcp:~/.claude/hooks/"
      - "devcp:~/.claude/settings.json"
      - "devcp:~/.claude/get-shit-done/templates/super-gsd/"
      - "devcp:~/.claude/get-shit-done/workflows/"
      - "devcp:~/.claude/get-shit-done/config/model-routing.json"
      - "devcp:~/.claude/super-gsd/scripts/"
      - "devcp:~/.local/bin/sgsd"
      - "devcp:~/.claude/super-gsd/reconciliation/"
      - "devcp:/opt/clarity/project-clarity-erp/.codex/hooks.json"
      - "devcp:/opt/clarity/project-clarity-erp/.super-gsd-version"
      - "devcp:/opt/clarity/project-clarity-erp/.planning/metrics/codex-tool-events.jsonl"
      - "devcp:~/.codex/state_5.sqlite"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-DEVCP-RESTART-EVIDENCE.json"
      - ".planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VERIFICATION.md"
    input_contract: |
      origin/master contains the published P150 SHA. The operator is present to inspect devcp sessions and dirty state, approve project-local hook merging, run /sgsd-update, grant Codex trust, and switch runtime processes only after verification. The canonical source origin URL must be validated before any fetch or merge.
    output_contract: |
      The 883-commit fork remains quarantined and unpushed. Before installation, every global target install.sh may mutate is captured with existence/type/hash metadata and a tested restore path. Canonical source fast-forwards only after the remote guard. Every pre-install scripts path remains afterward, every pre-install extra file remains byte-identical, canonical files match the installed layer, the model pin remains gpt-5.6-sol, the trust probe matches only a newly appended event, and MCP/cockpit/tmux are replaced with canonical-provenance identities.
    hypothesis: "A complete installed-layer snapshot, guarded fast-forward, candidate verification, manifest-subset proof, and identity-verified runtime switch can propagate P150 without destroying fork-only capabilities or interrupting uncoordinated work."
    falsifier: "Relevant work is interrupted, the canonical remote is unexpected, source is dirty/diverged, ~/GSDedits is pulled/pushed/rewritten, any pre-install scripts path disappears, any pre-install extra changes, a rollback fixture misses a global target, the model pin changes, runtime resolves through Clarity's vendored tree, or trust/reboot probes fail."
    stop_rule: "Coordinate or defer when relevant sessions are active. Validate origin before fetch. Stop before fetch/install on unexpected origin, dirty source, or divergence. Never push or rewrite the 883 commits, never delete the 43-file drift set, and never use hook-trust bypass. On candidate failure restore every snapshotted global target, retain the failed candidate and archive, do not switch live processes, and record the failure."
    verification:
      commands:
        - |
          $p150RemoteScript = @'
          set -euo pipefail
          source="$HOME/.claude/super-gsd/source"
          origin_url="$(git -C "$source" remote get-url origin)"
          [[ "$origin_url" =~ (^|[:/])Berrowj/super-gsd(\.git)?$ ]]
          git -C "$source" status --porcelain=v1 --branch
          git -C "$source" log -1 --format='%H %s'
          '@
          $p150RemoteScript | ssh devcp bash -s
          if ($LASTEXITCODE -ne 0) { throw 'devcp source guard failed' }
        - |
          $p150RemoteScript = @'
          set -euo pipefail
          cd /opt/clarity/project-clarity-erp
          sgsd -NoOpen
          '@
          $p150RemoteScript | ssh devcp bash -s
          if ($LASTEXITCODE -ne 0) { throw 'devcp no-open smoke failed' }
        - |
          $p150RemoteScript = @'
          set -euo pipefail
          reconcile_file="$HOME/.claude/super-gsd/reconciliation/p150-current"
          reconcile="$(cat "$reconcile_file")"
          test ! -s "$reconcile/scripts-missing-after.txt"
          test -f "$reconcile/global-targets-before.tgz"
          test -f "$reconcile/global-target-state-before.tsv"
          test -f "$reconcile/scripts-paths-before.tsv"
          test -f "$reconcile/scripts-paths-after.tsv"
          test -f "$reconcile/scripts-extra-before.sha256"
          '@
          $p150RemoteScript | ssh devcp bash -s
          if ($LASTEXITCODE -ne 0) { throw 'devcp preservation evidence failed' }
        - |
          $p150RemoteScript = @'
          set -euo pipefail
          project=/opt/clarity/project-clarity-erp
          grep -F 'gpt-5.6-sol' "$project/.planning/config.json"
          tmux has-session -t clarity-sgsd
          '@
          $p150RemoteScript | ssh devcp bash -s
          if ($LASTEXITCODE -ne 0) { throw 'devcp model pin or tmux check failed' }
---

# P150 Propagation, Trust Grant, and Reboot Runbook Implementation Plan

> **For agentic workers:** Execute tasks sequentially and preserve their stop rules. T150-05 through T150-07 require the operator to be present; they must not be converted into unattended automation.

**Goal:** Propagate the v3.5 SGSD substrate to local and devcp installations and prove that the installed runtime, trusted hooks, recoverable installed layer, and restarted processes enforce it.

**Architecture:** The canonical updater performs a guarded fast-forward and full global install. Project Codex hooks are merged without altering trust state. A complete target-aware snapshot protects every global path the installer mutates. Operator-present tasks install and audit locally before publication, then trust, reconcile, and restart each machine while comparing process and session identities.

**Tech stack:** Bash, PowerShell, Node.js, Git, Codex hooks, SSH, tmux, JSONL evidence.

## Global invariants

- Do not modify `super-gsd/registry/gates.yaml` or reproduce an existing gate predicate.
- Do not use `git reset --hard`, unguarded `git pull`, force-push, blanket installed-tree deletion, or `--dangerously-bypass-hook-trust`.
- All implementation commits use `operator <operator@users.noreply.github.com>` for both author and committer.
- Clarity's vendored `super-gsd` remains governed by the Clarity repository. P150 may merge project hook configuration but must never treat the vendored framework tree as propagation evidence.
- Existing worktrees move only through an operator-coordinated merge or rebase. Junction-backed repositories see source changes when their junction target advances.
- Every PowerShell-to-devcp operation uses one of two forms:
  - a single-quoted PowerShell here-string piped to `ssh devcp bash -s -- <explicit args>`;
  - a named remote script file invoked with explicit arguments.
- Never place Bash `$HOME`, command substitution, PID variables, or escaped double quotes inside a PowerShell double-quoted SSH command.
- A historical hook-ledger row is never acceptance evidence. Capture the ledger byte offset and UTC start before each dispatch, check the dispatch exit code, and parse only newly appended bytes.
- `install.sh --install-global` is not assumed non-deleting. Before devcp installation, snapshot every global target it can overwrite or delete:
  - `~/.claude/agents`;
  - `~/.claude/commands`;
  - `~/.claude/hooks`;
  - `~/.claude/settings.json`;
  - `~/.claude/get-shit-done/templates/super-gsd`;
  - `~/.claude/get-shit-done/workflows`;
  - `~/.claude/get-shit-done/config/model-routing.json`;
  - `~/.claude/super-gsd/scripts`;
  - `~/.local/bin/sgsd`.
- The snapshot must record whether each target existed before installation. Rollback moves the failed candidate targets into the reconciliation directory and restores the exact prior targets; targets absent before installation remain absent after rollback.
- `~/.claude/get-shit-done` must already exist on devcp. Otherwise stop before `--install-global`, because `ensure_gsd_base` would invoke an additional installer outside the declared recovery boundary.
- Restart evidence uses both PID and creation identity: Windows PID plus `CreationDate`; Linux PID plus `/proc/<pid>/stat` start ticks; tmux session ID plus creation epoch and server PID.

## T150-01 — Repair the updater contract

Build tests first around temporary real Git repositories and a bare `origin`:

1. Prove a clean, behind source fast-forwards to the captured `refs/remotes/origin/master` SHA and invokes the fake installer once with `--update --install-global`.
2. Prove dirty tracked and untracked files fail before merge or install.
3. Prove local-ahead and diverged sources fail without changing HEAD.
4. Prove an origin advance after fetch does not alter the captured update target or get reported as the installed SHA.
5. Prove installer failure prevents `.super-gsd-version` from changing.
6. Exercise both Bash and PowerShell wrappers where their runtimes are available.

Implementation requirements:

- Replace `git pull origin master` with `fetch`, explicit ancestry validation, `merge --ff-only`, and an equality assertion between final HEAD and the captured fetched SHA.
- Check source cleanliness before fetch and immediately before merge.
- Keep `--check` read-only and compare `refs/heads/master`, not remote `HEAD`.
- Run `install.sh --update --install-global`; let `--update` preserve project configuration.
- Write `.super-gsd-version` atomically only after install success.
- Print stable `source_sha=...` and `project_pin=...` evidence lines.
- Document separate restart requirements for profile functions, client sessions, MCP children, cockpit, and tmux.

Commit only after verification:

```bash
git add super-gsd/scripts/sgsd-update.sh super-gsd/scripts/sgsd-update.ps1 super-gsd/skills/sgsd-update/SKILL.md super-gsd/tests/propagation/sgsd-update-contract.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "fix: make SGSD updates guarded and complete"
```

## T150-02 — Install Codex hooks through a safe merge

Use `.codex/hooks.json` as the initial canonical content for `super-gsd/config/codex-hooks.json`. Implement `install-hooks.cjs` with these semantics:

- Parse and validate source and target before writing.
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
- secret-leak and stop-contract hooks remain callable;
- evidence is written only to the supplied temporary project.

Commit only after verification:

```bash
git add .codex/hooks.json super-gsd/config/codex-hooks.json super-gsd/tools/codex-hooks/install-hooks.cjs super-gsd/tools/codex-hooks/self-test.cjs super-gsd/install.sh super-gsd/scripts/sgsd-onboard.ps1 super-gsd/scripts/lib/sgsd-readiness.ps1 super-gsd/tools/feature-propagation/audit.cjs super-gsd/tests/propagation/codex-hooks-install.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "feat: propagate Codex hooks safely"
```

## T150-03 — Close Linux no-open and runtime-provenance gaps

Add an extensionless `sgsd` launcher and have `install.sh --install-global` install it at `~/.local/bin/sgsd` with executable permission.

Required behavior:

- Accept literal `-NoOpen` and portable `--no-open`.
- In no-open mode, complete preflight and provenance checks, then exit without calling the cockpit starter or printing launch instructions.
- Add authoritative `--scripts-dir`, `--agents-dir`, and `--source-dir` inputs.
- When supplied, use those paths for boot checks, cockpit, registry sync, tmux panes, and provenance. Do not fall back to `PROJECT/super-gsd`.
- Extend `sgsd-registry-sync.sh` with `--agents-dir`, retaining the existing logical registry paths.
- Print resolved source, scripts, agents, source HEAD, and project pin.
- Fail before launching when canonical source HEAD differs from `.super-gsd-version`.
- Make the remote launcher's cockpit starter come exclusively from the selected scripts directory.
- Include `~/.local/bin/sgsd` in installer mutation and snapshot-contract tests.
- Test with a fake project whose vendored scripts fail if executed and a canonical override whose scripts leave observable evidence.

Commit only after verification:

```bash
git add super-gsd/scripts/sgsd super-gsd/scripts/sgsd-boot.sh super-gsd/scripts/sgsd-remote-tmux.sh super-gsd/scripts/sgsd-registry-sync.sh super-gsd/install.sh super-gsd/tests/propagation/runtime-provenance.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "feat: add provenance-safe Linux smoke"
```

## T150-04 — Write and test propagation, recovery, and restart operations

### Runbook requirements

`PROPAGATION.md` must contain:

- A matrix distinguishing:
  - hook script bodies: next hook event;
  - skills, agents, settings registrations: next client session;
  - registries and singleton caches: cache reset or new process;
  - PowerShell functions: `. $PROFILE` or new terminal;
  - Claude settings/hooks: restart the owning Claude session;
  - MCP modules: verified child termination and owning-session restart;
  - cockpit: verified PID termination followed by relaunch;
  - tmux: coordinated reset with before/after session identity.
- Exact Windows and devcp commands used in T150-05 through T150-07.
- A local per-project hook-install command for repositories that only have a `super-gsd` junction.
- A worktree/junction section stating that pushing master does not move checked-out worktree branches.
- Trust-probe evidence requirements: probe ID, pre-dispatch byte offset, UTC start, checked Codex exit status, forbidden-file absence, and a matching row parsed only from appended bytes.
- Restart evidence requirements: command, UTC timestamp, machine, exit status, before/after PID plus creation identity, canonical command-line provenance, and redacted output.
- Rollback commands that preserve both the original archive and the failed candidate.
- No PowerShell double-quoted SSH command containing Bash code. The runbook contract test must reject `ssh devcp "..."`, `\"`, `\$`, or `\$(...)` forms in PowerShell blocks.

`DEVCP-RECONCILIATION.md` must record:

- Do not rewrite or push the 883-commit `~/GSDedits` fork.
- Preserve `devcp-fork-backup-2026-08-05`.
- Extract valuable fork-only capabilities only as reviewed patches on a clean origin/master-based branch with generic operator identity.
- Validate the canonical source's origin URL before any fetch or merge.
- Snapshot the complete global mutation boundary, not only scripts.
- Create before/after manifests containing every scripts file, directory, and symlink.
- Assert the entire pre-install path set is a subset of the post-install set.
- Compute the pre-install extra-file set relative to the updated canonical scripts tree and verify every extra file remains byte-identical after both bootstrap install and `/sgsd-update`.
- Inspect dependencies of `board-runner.cjs`, `execution-authority.sh`, `concurrency-policy.cjs`, and `decision-registry.cjs`.
- Use the VTP shadow-deployment posture: snapshot, guarded fast-forward, install, verify SHA/smoke/hooks/model pin/manifests, then switch tmux/cockpit/MCP.
- Keep `/opt/clarity/project-clarity-erp/super-gsd` outside framework propagation.

### Snapshot helper contract

Implement `super-gsd/scripts/sgsd-global-snapshot.sh` with:

```text
create  --home <absolute-home> --output-dir <absolute-reconciliation-dir>
verify --home <absolute-home> --snapshot-dir <absolute-reconciliation-dir>
restore --home <absolute-home> --snapshot-dir <absolute-reconciliation-dir> --failed-candidate-dir <absolute-dir>
```

The helper must:

- refuse an empty home, `/`, `~`, or a home different from the current user's resolved home;
- own the exact nine-target list in Global invariants;
- record target existence and type before archiving;
- preserve modes, symlinks, and file contents;
- on restore, move each current target to the bounded failed-candidate directory before extracting;
- leave targets that were absent before the install absent at their live locations;
- never delete the archive or failed candidate;
- fail if its target list differs from the installer's mutation contract.

`global-snapshot-contract.test.cjs` must:

1. Create a temporary fake home with content under every target.
2. Include the named legacy BRV paths removed at `install.sh:192-201`.
3. Include custom extra files under scripts, commands, hooks, templates, workflows, and config.
4. Run the actual global installer or a fixture that exercises every corresponding copy/removal operation.
5. Mutate, delete, and add files under every target.
6. Restore the snapshot.
7. Compare the complete before/after type, path, mode, symlink-target, and SHA manifests byte-for-byte.
8. Prove a target absent before the candidate is absent after restore.
9. Prove the failed candidate and original archive remain readable.

### Restart-evidence helpers

`sgsd-local-restart-evidence.ps1` and `sgsd-devcp-restart-evidence.sh` must emit the JSON shapes consumed by AC-150d.

They must:

- require at least one matching MCP before-process;
- display every selected command line before requesting `KILL`;
- record Windows `PID + CreationDate` or Linux `PID + start_ticks`;
- require at least one after-MCP process;
- reject any intersection between before and after identity sets;
- require after-MCP command lines to contain the canonical source root and `mcp`;
- compare cockpit before/after identities;
- compare tmux session ID, creation epoch, and server PID on devcp;
- verify the after identities remain live when evidence is written;
- emit no `exit=0` marker themselves; the operator task appends markers only after validating the JSON.

Commit only after verification:

```bash
git add .planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md .planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md super-gsd/scripts/sgsd-global-snapshot.sh super-gsd/scripts/sgsd-local-restart-evidence.ps1 super-gsd/scripts/sgsd-devcp-restart-evidence.sh super-gsd/tests/propagation/runbook-contract.test.cjs super-gsd/tests/propagation/global-snapshot-contract.test.cjs super-gsd/tests/propagation/restart-evidence-contract.test.cjs
git -c user.name=operator -c user.email=operator@users.noreply.github.com commit -m "docs: add recoverable propagation and restart runbook"
```

## T150-05 — OPERATOR-PRESENT: install and audit locally, then publish

Run from the clean P150 feature worktree:

```powershell
$ErrorActionPreference = 'Stop'

$p150Repo = (git rev-parse --show-toplevel).Trim()
Set-Location -LiteralPath $p150Repo
$p150FeatureBranch = (git branch --show-current).Trim()
$p150FeatureSha = (git rev-parse HEAD).Trim()
$p150RemoteUrl = (git remote get-url origin).Trim()
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'

if (-not $p150FeatureBranch -or $p150FeatureBranch -eq 'master') {
  throw 'Run this ceremony from the completed P150 feature branch'
}
if ($p150RemoteUrl -notmatch '(^|[:/])Berrowj/super-gsd(?:\.git)?$') {
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

$p150IdentityRows = @(
  git log --format='%H|%an|%ae|%cn|%ce' "origin/master..$p150FeatureSha"
)
if ($p150IdentityRows.Count -eq 0) {
  throw 'No outgoing P150 commits found'
}

$p150AllowedIdentity = '^[0-9a-f]+\|operator\|operator@users\.noreply\.github\.com\|operator\|operator@users\.noreply\.github\.com$'
$p150BadIdentityRows = @(
  $p150IdentityRows |
    Where-Object { $_ -notmatch $p150AllowedIdentity }
)
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
  super-gsd/tests/propagation/runbook-contract.test.cjs `
  super-gsd/tests/propagation/global-snapshot-contract.test.cjs `
  super-gsd/tests/propagation/restart-evidence-contract.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'P150 verification tests failed' }

$p150LocalBranch = (
  git -C $p150LocalRepo branch --show-current
).Trim()
if ($LASTEXITCODE -ne 0 -or $p150LocalBranch -ne 'master') {
  throw "Local canonical worktree must have master checked out: $p150LocalRepo"
}

$p150LocalRemoteUrl = (
  git -C $p150LocalRepo remote get-url origin
).Trim()
if ($LASTEXITCODE -ne 0 -or
    $p150LocalRemoteUrl -notmatch '(^|[:/])Berrowj/super-gsd(?:\.git)?$') {
  throw "Unexpected local canonical origin: $p150LocalRemoteUrl"
}

$p150LocalStatus = @(
  git -C $p150LocalRepo status --porcelain=v1
)
if ($LASTEXITCODE -ne 0) {
  throw 'Could not inspect the local canonical worktree'
}
if ($p150LocalStatus.Count -ne 0) {
  $p150LocalStatus | Write-Host
  throw 'Local canonical worktree is dirty. Coordinate with the operator and commit, stash, or relocate those changes manually, then rerun T150-05. No cleanup was attempted.'
}

git -C $p150LocalRepo fetch origin master
if ($LASTEXITCODE -ne 0) {
  throw 'Local canonical origin/master fetch failed'
}

$p150FetchedOriginSha = (
  git -C $p150LocalRepo rev-parse origin/master
).Trim()
if ($LASTEXITCODE -ne 0 -or
    $p150FetchedOriginSha -notmatch '^[0-9a-f]{40}$') {
  throw 'Could not resolve local canonical origin/master'
}

$p150FeatureOriginSha = (git rev-parse origin/master).Trim()
if ($p150FetchedOriginSha -ne $p150FeatureOriginSha) {
  throw "Feature and local canonical origin/master refs differ: $p150FeatureOriginSha vs $p150FetchedOriginSha"
}

$p150LocalBeforeSha = (
  git -C $p150LocalRepo rev-parse HEAD
).Trim()
git -C $p150LocalRepo merge-base --is-ancestor `
  $p150LocalBeforeSha `
  $p150FeatureSha
if ($LASTEXITCODE -ne 0) {
  throw "Local canonical master $p150LocalBeforeSha cannot fast-forward to $p150FeatureSha"
}

Write-Host "Local canonical worktree: $p150LocalRepo"
Write-Host "Expected origin: $p150LocalRemoteUrl"
Write-Host "Current master: $p150LocalBeforeSha"
Write-Host "Verified feature: $p150FeatureSha"
$p150Coordination = Read-Host 'Coordinate users of the local master worktree, then type FAST-FORWARD to advance it before installation'
if ($p150Coordination -cne 'FAST-FORWARD') {
  throw 'Operator did not authorize the local canonical fast-forward'
}

$p150LocalStatus = @(
  git -C $p150LocalRepo status --porcelain=v1
)
if ($LASTEXITCODE -ne 0) {
  throw 'Could not recheck the local canonical worktree before merge'
}
if ($p150LocalStatus.Count -ne 0) {
  $p150LocalStatus | Write-Host
  throw 'Local canonical worktree became dirty. Coordinate with the operator and commit, stash, or relocate those changes manually, then rerun T150-05. No cleanup was attempted.'
}

git -C $p150LocalRepo merge --ff-only $p150FeatureSha
if ($LASTEXITCODE -ne 0) {
  throw 'Local canonical master fast-forward failed; origin/master has not been pushed'
}

$p150LocalAfterSha = (
  git -C $p150LocalRepo rev-parse HEAD
).Trim()
if ($LASTEXITCODE -ne 0 -or $p150LocalAfterSha -ne $p150FeatureSha) {
  throw "Local canonical HEAD $p150LocalAfterSha differs from verified feature SHA $p150FeatureSha"
}
if (@(git -C $p150LocalRepo status --porcelain=v1).Count -ne 0) {
  throw 'Local canonical worktree is dirty after fast-forward; origin/master has not been pushed'
}

# This is deliberately before publication.
Push-Location -LiteralPath $p150LocalRepo
try {
  bash ./super-gsd/install.sh --update --install-global
  if ($LASTEXITCODE -ne 0) {
    throw 'Local SGSD installer failed; origin/master has not been pushed'
  }

  powershell.exe `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 `
    -Force
  if ($LASTEXITCODE -ne 0) {
    throw 'PowerShell shortcut installation failed; origin/master has not been pushed'
  }

  . $PROFILE
  Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null

  node .\super-gsd\tools\codex-hooks\install-hooks.cjs `
    --project $p150LocalRepo
  if ($LASTEXITCODE -ne 0) {
    throw 'Local target hook merge failed; origin/master has not been pushed'
  }

  node .\super-gsd\tools\feature-propagation\audit.cjs `
    --project-dir $p150LocalRepo `
    --json
  if ($LASTEXITCODE -ne 0) {
    throw 'Local propagation audit failed; origin/master has not been pushed'
  }

  sgsd -NoOpen
  if ($LASTEXITCODE -ne 0) {
    throw 'Local no-open smoke failed; origin/master has not been pushed'
  }

  node .\super-gsd\tools\codex-hooks\self-test.cjs --project . --json
  if ($LASTEXITCODE -ne 0) {
    throw 'Local hook self-test failed; origin/master has not been pushed'
  }
} finally {
  Pop-Location
}

$p150PublishStage = Join-Path `
  ([IO.Path]::GetTempPath()) `
  ('sgsd-p150-publish-' + [guid]::NewGuid().ToString('N'))
$p150PushCompleted = $false

git worktree add --detach $p150PublishStage origin/master
if ($LASTEXITCODE -ne 0) {
  throw 'Could not create detached publication worktree'
}

try {
  git -C $p150PublishStage merge --ff-only $p150FeatureSha
  if ($LASTEXITCODE -ne 0) {
    throw 'Detached fast-forward merge failed'
  }

  git -C $p150PublishStage push origin HEAD:master
  if ($LASTEXITCODE -ne 0) {
    throw 'Push to origin/master failed'
  }
  $p150PushCompleted = $true
} finally {
  if (Test-Path -LiteralPath $p150PublishStage) {
    git worktree remove $p150PublishStage
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Publication worktree requires manual cleanup: $p150PublishStage"
    }
  }
}

try {
  git fetch origin master
  if ($LASTEXITCODE -ne 0) { throw 'Post-publication fetch failed' }

  $p150PublishedSha = (git rev-parse origin/master).Trim()
  if ($p150PublishedSha -ne $p150FeatureSha) {
    throw "Published SHA $p150PublishedSha differs from verified SHA $p150FeatureSha"
  }

  $p150PublishedLocalSha = (
    git -C $p150LocalRepo rev-parse HEAD
  ).Trim()
  if ($LASTEXITCODE -ne 0 -or
      $p150PublishedLocalSha -ne $p150PublishedSha) {
    throw "Local canonical SHA $p150PublishedLocalSha differs from published SHA $p150PublishedSha"
  }
} catch {
  if ($p150PushCompleted) {
    Write-Host "origin/master may already contain $p150FeatureSha."
    Write-Host 'Do not force-push or rewrite it. Record the failure and repair forward.'
  }
  throw
}
```

Record in `150-VERIFICATION.md`:

- feature and published SHA;
- local canonical before/after SHA, validated origin URL, and operator coordination result;
- outgoing identity-gate row count;
- test, installer, profile, hook-merge, audit, and smoke exit codes;
- publication timestamp;
- whether any failure happened before or after `$p150PushCompleted`.

## T150-06 — OPERATOR-PRESENT: local trust and identity-verified reboot

Start Codex interactively:

```powershell
codex -C (Join-Path $env:USERPROFILE 'GSDedits')
```

Approve the displayed project hooks. Do not pass a trust-bypass flag. Exit the interactive client.

Run the AC-150c-local verification command exactly. Its ledger offset must be captured before `codex exec`, `$LASTEXITCODE` must be checked immediately afterward, and only the appended byte range may satisfy the event assertion.

Then run the no-open smoke and self-test:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
Set-Location -LiteralPath $p150LocalRepo

sgsd -NoOpen
if ($LASTEXITCODE -ne 0) { throw 'Local no-open smoke failed' }

node .\super-gsd\tools\codex-hooks\self-test.cjs --project . --json
if ($LASTEXITCODE -ne 0) { throw 'Local hook self-test failed' }

. $PROFILE
Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null
```

Prepare restart evidence:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
$p150EvidencePath = Join-Path $p150LocalRepo '.planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-LOCAL-RESTART-EVIDENCE.json'

& (Join-Path $p150LocalRepo 'super-gsd\scripts\sgsd-local-restart-evidence.ps1') `
  -Mode Prepare `
  -Project $p150LocalRepo `
  -ExpectedMcpRoot (Join-Path $p150LocalRepo 'super-gsd') `
  -EvidencePath $p150EvidencePath

if ($LASTEXITCODE -ne 0) {
  throw 'Local restart prepare step failed'
}
```

The helper must:

1. Select only Node MCP children whose command lines contain `super-gsd` and `mcp`.
2. Require at least one selected process.
3. Record each PID, parent PID, `CreationDate`, and command line.
4. Display those values and require the operator to type `KILL`.
5. Terminate only the displayed MCP identities.
6. Read the absolute cockpit PID path:
   `%USERPROFILE%\GSDedits\.planning\runtime\cockpit-server.pid`.
7. Require that PID plus `CreationDate` to resolve to a cockpit command.
8. Terminate it, run `sgsd-refresh -SkipPreflight`, and require a different live cockpit identity.
9. Write the profile result, MCP before-set, and cockpit before/after identities to the evidence JSON.

Exit the current Claude session cleanly. Open a new Warp tab and run exactly:

```powershell
sg
```

After the new owning session starts, use a separate PowerShell tab to finalize:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
$p150PhaseDir = Join-Path $p150LocalRepo '.planning\milestones\v3.5\phases\150-propagation-trust-runbook'
$p150EvidencePath = Join-Path $p150PhaseDir '150-LOCAL-RESTART-EVIDENCE.json'
$p150VerificationPath = Join-Path $p150PhaseDir '150-VERIFICATION.md'

& (Join-Path $p150LocalRepo 'super-gsd\scripts\sgsd-local-restart-evidence.ps1') `
  -Mode Finalize `
  -Project $p150LocalRepo `
  -ExpectedMcpRoot (Join-Path $p150LocalRepo 'super-gsd') `
  -EvidencePath $p150EvidencePath

if ($LASTEXITCODE -ne 0) {
  throw 'Local restart finalization failed'
}

$p150LocalEvidence = Get-Content -Raw -LiteralPath $p150EvidencePath |
  ConvertFrom-Json
if ($p150LocalEvidence.profile.exit -ne 0 -or
    $p150LocalEvidence.local_mcp.exit -ne 0 -or
    $p150LocalEvidence.local_cockpit.exit -ne 0) {
  throw 'Local restart evidence contains a non-zero component'
}

Add-Content -LiteralPath $p150VerificationPath -Value @(
  'PROFILE_RELOAD exit=0'
  'LOCAL_MCP_RESTART exit=0'
  'LOCAL_COCKPIT_RESTART exit=0'
)
```

`Finalize` must require new live MCP identities, reject overlap with the before-set, and verify each after-command line contains the canonical local root and `mcp`. Marker lines are written only after these checks.

## T150-07 — OPERATOR-PRESENT: devcp reconciliation, update, trust, and reboot

This task follows the VTP shadow-deployment posture: preserve the complete installed layer, fast-forward only after guards, verify the candidate, and only then reset live processes.

### A. Upload the tested snapshot helper and guarded preparation script

From local PowerShell:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
$p150Token = [guid]::NewGuid().ToString('N')
$p150LocalSnapshot = Join-Path $p150LocalRepo 'super-gsd\scripts\sgsd-global-snapshot.sh'
$p150RemoteSnapshot = "/tmp/p150-global-snapshot-$p150Token.sh"
$p150RemotePrepare = "/tmp/p150-prepare-$p150Token.sh"
$p150LocalPrepare = Join-Path ([IO.Path]::GetTempPath()) "p150-prepare-$p150Token.sh"

$p150PrepareScript = @'
#!/usr/bin/env bash
set -euo pipefail

snapshot_helper="$1"
project=/opt/clarity/project-clarity-erp
source="$HOME/.claude/super-gsd/source"
global="$HOME/.claude/super-gsd"
fork="$HOME/GSDedits"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
reconcile="$global/reconciliation/$stamp"

printf '%s\n' '=== tmux sessions ==='
tmux list-sessions 2>/dev/null || true
printf '%s\n' '=== relevant processes ==='
pgrep -af 'claude|codex|sgsd-remote-tmux|sgsd-(mission-control|codex-monitor|narrative|autopilot-watchdog)' || true
printf '%s\n' '=== Clarity state; inspect only ==='
git -C "$project" status --short --branch
printf '%s\n' '=== canonical source state ==='
git -C "$source" status --porcelain=v1 --branch
printf '%s\n' '=== quarantined fork state; never update or push ==='
git -C "$fork" status --short --branch

read -r -p 'Coordinate all relevant work above. Type CONTINUE only when propagation may proceed: ' coordination
test "$coordination" = CONTINUE

origin_url="$(git -C "$source" remote get-url origin)"
if [[ ! "$origin_url" =~ (^|[:/])Berrowj/super-gsd(\.git)?$ ]]; then
  printf 'Unexpected canonical source origin: %s\n' "$origin_url" >&2
  exit 1
fi

# The origin guard above must precede every fetch or merge.
test -z "$(git -C "$source" status --porcelain=v1)"
test -d "$HOME/.claude/get-shit-done"
git -C "$fork" show-ref --verify refs/heads/devcp-fork-backup-2026-08-05
git -C "$fork" rev-list --left-right --count origin/master...HEAD

mkdir -p "$reconcile"
printf '%s\n' "$reconcile" >"$global/reconciliation/p150-current"

bash "$snapshot_helper" create \
  --home "$HOME" \
  --output-dir "$reconcile"

(
  cd "$global/scripts"
  find . -mindepth 1 -printf '%P\t%y\n' | LC_ALL=C sort
) >"$reconcile/scripts-paths-before.tsv"

diff -qr "$source/super-gsd/scripts" "$global/scripts" \
  >"$reconcile/diff-before.txt" || true

for fork_file in \
  board-runner.cjs \
  execution-authority.sh \
  concurrency-policy.cjs \
  decision-registry.cjs
do
  test -f "$global/scripts/$fork_file"
  {
    printf '\n=== %s ===\n' "$fork_file"
    rg -n 'require\(|import |source |\. ' "$global/scripts/$fork_file" || true
  } >>"$reconcile/fork-only-dependencies.txt"
done

git -C "$source" fetch origin master
test -z "$(git -C "$source" status --porcelain=v1)"
git -C "$source" merge-base --is-ancestor HEAD origin/master
git -C "$source" merge --ff-only origin/master
test "$(git -C "$source" rev-parse HEAD)" = \
  "$(git -C "$source" rev-parse origin/master)"

(
  cd "$source/super-gsd/scripts"
  find . -type f -printf '%P\n' | LC_ALL=C sort
) >"$reconcile/canonical-script-files.txt"

cut -f1 "$reconcile/scripts-paths-before.tsv" |
  LC_ALL=C sort -u >"$reconcile/scripts-before-paths.txt"
(
  cd "$global/scripts"
  find . -type f -printf '%P\n' | LC_ALL=C sort
) >"$reconcile/installed-script-files-before.txt"

comm -23 \
  "$reconcile/installed-script-files-before.txt" \
  "$reconcile/canonical-script-files.txt" \
  >"$reconcile/scripts-extra-before.txt"

(
  cd "$global/scripts"
  while IFS= read -r relative; do
    test -f "$relative"
    sha256sum -- "$relative"
  done <"$reconcile/scripts-extra-before.txt"
) >"$reconcile/scripts-extra-before.sha256"

cd "$project"
if ! bash "$source/super-gsd/install.sh" --update --install-global; then
  failed="$reconcile/failed-candidate-bootstrap"
  bash "$snapshot_helper" restore \
    --home "$HOME" \
    --snapshot-dir "$reconcile" \
    --failed-candidate-dir "$failed"
  printf 'Bootstrap install failed; global targets restored from %s\n' "$reconcile" >&2
  exit 1
fi

printf 'reconcile=%s\n' "$reconcile"
printf 'source_sha=%s\n' "$(git -C "$source" rev-parse HEAD)"
'@

[IO.File]::WriteAllText(
  $p150LocalPrepare,
  ($p150PrepareScript -replace "`r`n", "`n"),
  [Text.UTF8Encoding]::new($false)
)

scp -- $p150LocalSnapshot "devcp:$p150RemoteSnapshot"
if ($LASTEXITCODE -ne 0) { throw 'Could not upload snapshot helper' }

scp -- $p150LocalPrepare "devcp:$p150RemotePrepare"
if ($LASTEXITCODE -ne 0) { throw 'Could not upload preparation script' }

ssh -t devcp bash $p150RemotePrepare $p150RemoteSnapshot
if ($LASTEXITCODE -ne 0) {
  throw 'devcp safety, snapshot, origin guard, fast-forward, or bootstrap failed'
}
```

No fetch or merge may appear before the remote origin guard. Do not run any pull, push, reset, rebase, or author rewrite in `~/GSDedits`.

### B. Exercise the actual `/sgsd-update`

Create a remote launcher script rather than embedding Bash in an SSH string:

```powershell
$ErrorActionPreference = 'Stop'
$p150Token = [guid]::NewGuid().ToString('N')
$p150LocalLauncher = Join-Path ([IO.Path]::GetTempPath()) "p150-claude-$p150Token.sh"
$p150RemoteLauncher = "/tmp/p150-claude-$p150Token.sh"
$p150Launcher = @'
#!/usr/bin/env bash
set -euo pipefail
project="$1"
cd "$project"
exec claude
'@

[IO.File]::WriteAllText(
  $p150LocalLauncher,
  ($p150Launcher -replace "`r`n", "`n"),
  [Text.UTF8Encoding]::new($false)
)
scp -- $p150LocalLauncher "devcp:$p150RemoteLauncher"
if ($LASTEXITCODE -ne 0) { throw 'Could not upload Claude launcher' }

ssh -t devcp bash $p150RemoteLauncher /opt/clarity/project-clarity-erp
if ($LASTEXITCODE -ne 0) { throw 'Remote Claude session failed' }
```

At the Claude prompt enter exactly:

```text
/sgsd-update
```

Wait for its guarded source-SHA and installer-success output, then exit Claude cleanly.

### C. Verify candidate SHA, complete path survival, extras, and model pin

Run through a single-quoted here-string:

```powershell
$ErrorActionPreference = 'Stop'
$p150RemoteVerify = @'
set -euo pipefail

project=/opt/clarity/project-clarity-erp
source="$HOME/.claude/super-gsd/source"
global="$HOME/.claude/super-gsd"
reconcile="$(cat "$global/reconciliation/p150-current")"
origin_sha="$(git -C "$source" ls-remote origin refs/heads/master | cut -f1)"
source_sha="$(git -C "$source" rev-parse HEAD)"
project_sha="$(cat "$project/.super-gsd-version")"

test "$source_sha" = "$origin_sha"
test "$project_sha" = "$origin_sha"
test -z "$(git -C "$source" status --porcelain=v1)"

while IFS= read -r -d '' canonical_file; do
  relative="${canonical_file#"$source/super-gsd/scripts/"}"
  cmp -s "$canonical_file" "$global/scripts/$relative" || {
    printf 'Installed canonical file differs: %s\n' "$relative" >&2
    exit 1
  }
done < <(find "$source/super-gsd/scripts" -type f -print0)

(
  cd "$global/scripts"
  find . -mindepth 1 -printf '%P\t%y\n' | LC_ALL=C sort
) >"$reconcile/scripts-paths-after.tsv"

cut -f1 "$reconcile/scripts-paths-after.tsv" |
  LC_ALL=C sort -u >"$reconcile/scripts-after-paths.txt"

comm -23 \
  "$reconcile/scripts-before-paths.txt" \
  "$reconcile/scripts-after-paths.txt" \
  >"$reconcile/scripts-missing-after.txt"

if test -s "$reconcile/scripts-missing-after.txt"; then
  printf 'Pre-install paths disappeared:\n' >&2
  cat "$reconcile/scripts-missing-after.txt" >&2
  exit 1
fi

# This checks every pre-install extra regular file, not four named examples.
(
  cd "$global/scripts"
  sha256sum -c "$reconcile/scripts-extra-before.sha256"
)

for fork_file in \
  board-runner.cjs \
  execution-authority.sh \
  concurrency-policy.cjs \
  decision-registry.cjs
do
  test -f "$global/scripts/$fork_file"
done

diff -qr "$source/super-gsd/scripts" "$global/scripts" \
  >"$reconcile/diff-after.txt" || true

grep -F 'gpt-5.6-sol' "$project/.planning/config.json"

cd "$project"
sgsd -NoOpen >"$reconcile/no-open-after.txt" 2>&1
grep -F -- "$source_sha" "$reconcile/no-open-after.txt"
grep -F -- "$global/scripts" "$reconcile/no-open-after.txt"
if grep -F -- "$project/super-gsd/scripts" "$reconcile/no-open-after.txt"; then
  printf 'Vendored Clarity runtime appeared in smoke output\n' >&2
  exit 1
fi

node "$source/super-gsd/tools/codex-hooks/self-test.cjs" \
  --project "$project" \
  --json

printf 'origin_sha=%s\n' "$origin_sha"
printf 'source_sha=%s\n' "$source_sha"
printf 'project_sha=%s\n' "$project_sha"
printf 'reconcile=%s\n' "$reconcile"
'@

$p150RemoteVerify | ssh devcp bash -s
if ($LASTEXITCODE -ne 0) {
  throw 'devcp candidate verification failed; restore the snapshotted global targets before any runtime switch'
}
```

If verification fails, invoke the tested remote snapshot helper as a named remote script with explicit arguments:

```powershell
$p150Rollback = @'
set -euo pipefail
global="$HOME/.claude/super-gsd"
reconcile="$(cat "$global/reconciliation/p150-current")"
helper="$HOME/.claude/super-gsd/source/super-gsd/scripts/sgsd-global-snapshot.sh"
failed="$reconcile/failed-candidate-verification"
bash "$helper" restore \
  --home "$HOME" \
  --snapshot-dir "$reconcile" \
  --failed-candidate-dir "$failed"
printf 'restored=%s failed_candidate=%s\n' "$reconcile" "$failed"
'@

$p150Rollback | ssh devcp bash -s
if ($LASTEXITCODE -ne 0) {
  throw 'devcp rollback failed; do not switch any runtime process'
}
```

### D. Grant devcp Codex trust and prove a newly appended event

Launch interactive Codex using a remote script file:

```powershell
$ErrorActionPreference = 'Stop'
$p150Token = [guid]::NewGuid().ToString('N')
$p150LocalLauncher = Join-Path ([IO.Path]::GetTempPath()) "p150-codex-$p150Token.sh"
$p150RemoteLauncher = "/tmp/p150-codex-$p150Token.sh"
$p150Launcher = @'
#!/usr/bin/env bash
set -euo pipefail
project="$1"
cd "$project"
exec codex
'@

[IO.File]::WriteAllText(
  $p150LocalLauncher,
  ($p150Launcher -replace "`r`n", "`n"),
  [Text.UTF8Encoding]::new($false)
)
scp -- $p150LocalLauncher "devcp:$p150RemoteLauncher"
if ($LASTEXITCODE -ne 0) { throw 'Could not upload Codex launcher' }

ssh -t devcp bash $p150RemoteLauncher /opt/clarity/project-clarity-erp
if ($LASTEXITCODE -ne 0) { throw 'Remote Codex trust session failed' }
```

Approve the displayed hooks. Do not use `--dangerously-bypass-hook-trust`. Exit Codex, then run AC-150c-devcp exactly. It must check both the remote Codex exit status and the PowerShell `$LASTEXITCODE`.

### E. Switch MCP, cockpit, and tmux with before/after evidence

Invoke the committed remote script by path and explicit arguments:

```powershell
$ErrorActionPreference = 'Stop'

ssh -t devcp `
  ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-devcp-restart-evidence.sh `
  --project /opt/clarity/project-clarity-erp `
  --session clarity-sgsd `
  --scripts-dir ~/.claude/super-gsd/scripts `
  --agents-dir ~/.claude/agents `
  --source-dir ~/.claude/super-gsd/source `
  --evidence ~/.claude/super-gsd/reconciliation/p150-devcp-restart-evidence.json

if ($LASTEXITCODE -ne 0) {
  throw 'devcp MCP, cockpit, or tmux restart evidence failed'
}
```

The helper must:

1. Require an existing `clarity-sgsd` session and record:
   `session_id`, `session_created`, and `session_pid`, collecting `session_pid` with tmux `#{pid}`.
2. Require at least one SGSD MCP process whose command line contains both the canonical source root and `mcp`.
3. Record each MCP PID, start ticks, parent PID, and command line.
4. Display the selected MCP command lines and require `KILL`.
5. Require the cockpit PID file to identify a live cockpit command, and record PID plus start ticks.
6. Terminate only verified MCP and cockpit identities.
7. Run `sgsd-remote-tmux.sh --reset --greet --no-attach` with the explicit canonical source, scripts, and agents paths.
8. Wait with a bounded timeout for new MCP and cockpit identities.
9. Reject overlap between old and new MCP identity sets.
10. Require the new cockpit identity to differ.
11. Require the new tmux identity tuple to differ.
12. Require all after-command lines to use canonical paths, never the project vendored tree.
13. Run `sgsd-remote-tmux.sh --doctor`.
14. Write JSON only after all checks pass.

Copy and validate the evidence locally:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
$p150PhaseDir = Join-Path $p150LocalRepo '.planning\milestones\v3.5\phases\150-propagation-trust-runbook'
$p150DevcpEvidence = Join-Path $p150PhaseDir '150-DEVCP-RESTART-EVIDENCE.json'
$p150Verification = Join-Path $p150PhaseDir '150-VERIFICATION.md'

scp -- `
  devcp:~/.claude/super-gsd/reconciliation/p150-devcp-restart-evidence.json `
  $p150DevcpEvidence
if ($LASTEXITCODE -ne 0) {
  throw 'Could not copy devcp restart evidence'
}

$p150Evidence = Get-Content -Raw -LiteralPath $p150DevcpEvidence |
  ConvertFrom-Json
if ($p150Evidence.devcp_mcp.exit -ne 0 -or
    $p150Evidence.devcp_cockpit.exit -ne 0 -or
    $p150Evidence.devcp_tmux.exit -ne 0) {
  throw 'devcp restart evidence contains a non-zero component'
}

Add-Content -LiteralPath $p150Verification -Value @(
  'DEVCP_MCP_RESTART exit=0'
  'DEVCP_COCKPIT_RESTART exit=0'
  'DEVCP_TMUX_RESET exit=0'
)
```

Only after AC-150d passes may the operator attach:

```powershell
ssh -t devcp tmux attach -t clarity-sgsd
if ($LASTEXITCODE -ne 0) {
  throw 'Could not attach to the verified clarity-sgsd session'
}
```

Record in `150-VERIFICATION.md`:

- origin/source/project SHAs;
- validated source origin URL;
- complete snapshot and failed-candidate paths;
- target-state and archive manifests;
- before/after scripts path manifests;
- the empty missing-path report;
- the full extra-file checksum result;
- model-pin and provenance results;
- local and devcp trust probe IDs, offsets, start times, and exit codes;
- before/after MCP, cockpit, and tmux identities;
- canonical command-line provenance.

## Acceptance mapping

| Criterion | Tasks |
|---|---|
| AC-150a — devcp shows pushed HEAD and canonical runtime | T150-01, T150-03, T150-05, T150-07 |
| AC-150b — both post-update smokes | T150-02, T150-03, T150-06, T150-07 |
| AC-150c — newly appended trust-block event on both machines | T150-02, T150-06, T150-07 |
| AC-150d — independently marked, identity-compared reboot evidence | T150-04, T150-06, T150-07 |
| No-PII publication | T150-04, T150-05, T150-07 |
| Complete global recovery boundary | T150-04, T150-07 |
| Every pre-install scripts path survives | T150-04, T150-07 |
| 43-file reconciliation and extra-file integrity | T150-04, T150-07 |
| 883-commit fork quarantine | T150-04, T150-07 |

## Source Audit

| Source | Status | Plan use |
|---|---|---|
| CONTEXT | Supplied verbatim in the planning request | Goals, target machines, operator-present boundaries, worktree behavior, devcp fork/drift facts, and acceptance criteria. |
| RESEARCH | Supplied verbatim in the planning request; cited files selectively audited | Canonical installer behavior, updater defects, hook installation gap, trust mechanism, cache/restart boundaries, runtime-provenance conflict, and safe devcp bootstrap. |
| VTP | `.planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-VTP-ENRICHMENT.md:13-18`; source `doc:daadab474432` | Shadow-deployment posture in T150-04 and T150-07: preserve the complete installed layer, verify the candidate before switching live processes, and never destructively reconcile the 43-file drift. |
| design-spec | `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:159-163` as quoted by RESEARCH | AC-150(a-d) is preserved in the semantic acceptance criteria and task mapping. |

