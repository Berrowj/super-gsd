---
schema_version: 2
phase: 146
plan: "146-01"
title: "Session Governance Hooks"
model: codex
expected_ATC_tier: GATE
prior_errors_lookup: true
depends_on: []
skip_gates: []
lessons_path: null
vtp_status: "success: 2 relevant hits"
lock_status: locked
locked_at: "2026-08-06T00:00:00+01:00"
locked_by: "codex-phase-planner"
risk_rating: high
rollback_plan: >
  Revert this plan's allowed file changes, remove only P146 hook entries from
  the target repo-local .claude/settings.json, leave ~/.claude/settings.json
  untouched, and rerun the P146 acceptance commands to confirm hooks are absent
  or fail open.
allowed_files:
  - ".planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md"
  - ".planning/STATE.md"
  - ".claude/settings.json"
  - ".planning/metrics/gate-evidence.jsonl"
  - "super-gsd/registry/session-governance-hooks.yaml"
  - "super-gsd/scripts/lib/sgsd-state.cjs"
  - "super-gsd/scripts/lib/gate-evidence-log.cjs"
  - "super-gsd/hooks/sgsd-session-start.js"
  - "super-gsd/hooks/sgsd-intent-classifier.cjs"
  - "super-gsd/hooks/sgsd-quality-gate.js"
  - "super-gsd/install.sh"
  - "super-gsd/scripts/merge-settings.js"
  - "super-gsd/config/settings-overlay.json"
  - "super-gsd/config/repo-settings-overlay.json"
  - "super-gsd/scripts/sgsd-stop-handoff.sh"
  - "super-gsd/tools/autopilot-watchdog/check.cjs"
  - "super-gsd/tools/cockpit-state/adapter.cjs"
  - "super-gsd/tools/warp-mcp/server.cjs"
  - "super-gsd/config/**/*.json"
  - "super-gsd/config/**/*.yaml"
forbidden_files:
  - "~/.claude/settings.json"
  - "~/.claude/hooks/**"
  - "super-gsd/registry/gates.yaml"
  - "super-gsd/hooks/gsd-atc-slice-gate.js"
  - "devcp/**"
invariants:
  - "No edit-seam blocking anywhere. PostToolUse quality gate is report-only and never emits block decisions."
  - "Every hook has narrow try/catch boundaries; unexpected SGSD-repo errors append a failure row and exit 0."
  - "Every hook exits quiet 0 when root-walk finds no .planning directory."
  - "No hook or installer path reads ~/.claude/settings.json or copies any env block from it."
  - "Installer writes repo-local .claude/settings.json only; never write machine-global Claude settings."
  - "Hook command paths are resolved at install time from the target repo. Source files contain no hardcoded machine paths."
  - "Classifier is local Node only, performs no LLM call, routes to SGSD skills, and never judges semantic truth."
  - "Classifier p95 latency must be under 1000 ms; the recorded target is millisecond-level overhead."
  - "Hook rules are declarative and registry-driven so P149 skill-routing.yaml can be swapped in with one registry-source line change."
  - "Quality-gate evidence uses .planning/metrics/gate-evidence.jsonl as a new stream with envelope-v1 shape."
  - "AC-146c requires both evidence writer and cockpit reader wiring in this phase."
  - "Mutation tool names must be confirmed in this harness before matching; do not add MultiEdit unless confirmed."
  - "Do not duplicate SGSD gates or edit super-gsd/registry/gates.yaml."
acceptance_commands:
  - "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --plan-file .planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md"
  - >
    powershell -NoProfile -Command "foreach ($f in @('super-gsd/scripts/lib/sgsd-state.cjs','super-gsd/scripts/lib/gate-evidence-log.cjs','super-gsd/hooks/sgsd-session-start.js','super-gsd/hooks/sgsd-intent-classifier.cjs','super-gsd/hooks/sgsd-quality-gate.js')) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"
  - "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"
  - >
    powershell -NoProfile -Command "1..200 | ForEach-Object { '{\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"How should we plan this?\"}' | node super-gsd/hooks/sgsd-intent-classifier.cjs > $null; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"
  - "node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt \"How should we plan this?\" --record .planning/metrics/gate-evidence.jsonl"
  - "node super-gsd/hooks/sgsd-quality-gate.js --self-test-report-only-missing-plan --record .planning/metrics/gate-evidence.jsonl"
  - "node super-gsd/tools/cockpit-state/adapter.cjs --self-test-gate-evidence-reader"
  - "bash -n super-gsd/scripts/sgsd-stop-handoff.sh"
  - >
    powershell -NoProfile -Command "rg 'checkpoint_threshold_percent|context_warning_percent|context_warnings|gsd-atc-slice-gate.js' super-gsd --glob '!**/*.md'; if ($LASTEXITCODE -eq 0) { exit 1 } elseif ($LASTEXITCODE -eq 1) { exit 0 } else { exit $LASTEXITCODE }"
operator_checkpoints:
  - "After T146-02, operator reviews generated repo-local .claude/settings.json for absolute target-repo paths and absence of secrets."
  - "After T146-04, operator records the classifier p95_ms value from gate-evidence.jsonl before phase review."
  - "After T146-05, operator confirms cockpit displays the quality-gate evidence signal within one refresh."
semantic_acceptance_criteria:
  - input: >
      A real SessionStart hook payload executed against a constructed temporary SGSD-shaped repo whose STATE frontmatter declares current_phase "873".
    expected_outcome: >
      The hook exits 0 and injects a first-response governance contract containing the ATC tier table, v3.5 milestone, and the fixture-derived active phase 873 with no operator action.
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-ac146a-" + [guid]::NewGuid()); try { $planning=Join-Path $tmp ".planning"; New-Item -ItemType Directory -Path $planning -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"873`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Encoding UTF8; $payload=@{hook_event_name="SessionStart";cwd=$tmp;source="startup";session_id="ac146a"} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-session-start.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join "`n"); if ($text -notmatch "Governance Contract" -or $text -notmatch "ATC" -or $text -notmatch "v3.5" -or $text -notmatch "873") { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-ac146a-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
  - input: >
      Real UserPromptSubmit hook payloads executed against a constructed temporary SGSD-shaped repo: one planning prompt and one trivial execution prompt.
    expected_outcome: >
      The classifier exits 0, emits a visible /sgsd-triage directive only for the planning prompt, emits no directive for the trivial prompt, and records routing without making semantic judgments.
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-ac146b-" + [guid]::NewGuid()); try { $planning=Join-Path $tmp ".planning"; New-Item -ItemType Directory -Path $planning -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"874`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Encoding UTF8; $posPayload=@{hook_event_name="UserPromptSubmit";cwd=$tmp;prompt="Can you plan the next phase and write the implementation plan?";session_id="ac146b-pos"} | ConvertTo-Json -Compress; $pos=$posPayload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $posText=($pos -join "`n"); if ($posText -notmatch "/sgsd-triage" -or $posText -match "decision.:.block") { exit 1 }; $negPayload=@{hook_event_name="UserPromptSubmit";cwd=$tmp;prompt="Please read README.md and report the first heading.";session_id="ac146b-neg"} | ConvertTo-Json -Compress; $neg=$negPayload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $negText=($neg -join "`n"); if ($negText -match "/sgsd-triage" -or $negText -match "decision.:.block") { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-ac146b-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
  - input: >
      A real PostToolUse source-edit payload naming a real edited file in a temporary SGSD-shaped repo whose STATE frontmatter declares current_phase "999" and whose phase has no matching PLAN-LOCKED file.
    expected_outcome: >
      The quality gate exits 0, appends a missing-plan row to that fixture's gate-evidence.jsonl with phase 999 and the edited file path, and the cockpit reader consumes that same row as a visible governance signal.
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-ac146c-" + [guid]::NewGuid()); try { New-Item -ItemType Directory -Path (Join-Path $tmp ".planning\metrics"),(Join-Path $tmp ".planning\milestones\v3.5\phases\999-fixture"),(Join-Path $tmp "src") -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"999`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $tmp ".planning\STATE.md") -Encoding UTF8; $edit=Join-Path $tmp "src\edited.js"; "module.exports = 1;" | Set-Content -LiteralPath $edit -Encoding UTF8; $record=Join-Path $tmp ".planning\metrics\gate-evidence.jsonl"; $payload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="Edit";tool_input=@{file_path=$edit};session_id="ac146c"} | ConvertTo-Json -Depth 8 -Compress; $out=$payload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join "").Trim().Length -gt 0) { exit 1 }; if (!(Test-Path -LiteralPath $record)) { exit 1 }; $rows=Get-Content -LiteralPath $record | ForEach-Object { $_ | ConvertFrom-Json }; $row=$rows | Where-Object { $_.signal -eq "missing_plan" -and $_.phase -eq "999" -and $_.file_path -eq $edit -and $_.tool_name -eq "Edit" } | Select-Object -Last 1; if (-not $row) { exit 1 }; $snapJson=node super-gsd/tools/cockpit-state/adapter.cjs --json --project $tmp; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $snapText=($snapJson -join "`n"); if ($snapText -notmatch "missing_plan" -or $snapText -notmatch "999" -or $snapText -notmatch [regex]::Escape($edit)) { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-ac146c-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
  - input: >
      SessionStart, UserPromptSubmit, and PostToolUse payloads whose cwd is a normal directory with no .planning ancestor.
    expected_outcome: >
      All hooks exit 0 quietly, write no SGSD metrics, and emit no governance context.
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-nonrepo-" + [guid]::NewGuid()); $record=".planning\metrics\gate-evidence.jsonl"; $before=0; if (Test-Path -LiteralPath $record) { $before=(Get-Content -LiteralPath $record).Count }; try { New-Item -ItemType Directory -Path $tmp | Out-Null; foreach ($pair in @(@("sgsd-session-start.js","SessionStart"),@("sgsd-intent-classifier.cjs","UserPromptSubmit"),@("sgsd-quality-gate.js","PostToolUse"))) { $payload=@{hook_event_name=$pair[1];cwd=$tmp;prompt="hello";tool_name="Edit";tool_input=@{file_path="x.txt"};session_id="ac146d"} | ConvertTo-Json -Depth 5 -Compress; $out=$payload | node (Join-Path "super-gsd/hooks" $pair[0]); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join "").Trim().Length -gt 0) { exit 1 } }; $after=0; if (Test-Path -LiteralPath $record) { $after=(Get-Content -LiteralPath $record).Count }; if ($after -ne $before) { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-nonrepo-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
  - input: >
      Two hundred real UserPromptSubmit planning prompts run through the local Node classifier in this repo.
    expected_outcome: >
      The benchmark exits 0, records an intent_classifier_bench row in gate-evidence.jsonl with iterations 200, and that row's p95_ms value is present and below 1000 ms.
    verification_cmd: >
      powershell -NoProfile -Command '$record=".planning\metrics\gate-evidence.jsonl"; node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt "How should we plan this?" --record $record; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (!(Test-Path -LiteralPath $record)) { exit 1 }; $row=Get-Content -LiteralPath $record | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.signal -eq "intent_classifier_bench" -and $_.iterations -eq 200 } | Select-Object -Last 1; if (-not $row -or $null -eq $row.p95_ms -or [double]$row.p95_ms -ge 1000) { exit 1 }'
  - input: >
      Repo-local hook installation into a target repo with a fake home settings file containing env-like secret sentinel keys.
    expected_outcome: >
      The installer writes only target .claude/settings.json, uses install-time absolute target-repo paths in hook args, and does not copy or read home env values.
    verification_cmd: "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"
tasks:
  - id: "T146-01"
    type: "shared-helper"
    agent: "gsd-executor"
    model: "codex"
    depends_on: []
    files_touched:
      - ".planning/STATE.md"
      - "super-gsd/scripts/lib/sgsd-state.cjs"
      - "super-gsd/scripts/lib/gate-evidence-log.cjs"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146a"
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command "foreach ($f in @('super-gsd/scripts/lib/sgsd-state.cjs','super-gsd/scripts/lib/gate-evidence-log.cjs')) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"
    verification_cmd: >
      powershell -NoProfile -Command "foreach ($f in @('super-gsd/scripts/lib/sgsd-state.cjs','super-gsd/scripts/lib/gate-evidence-log.cjs')) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; node -e 'const s=require(\"./super-gsd/scripts/lib/sgsd-state.cjs\"); const root=s.findSgsdRoot(process.cwd()); const st=s.readState(root); if (!root || !st || st.milestone !== \"v3.5\") process.exit(1); if (st.phaseSource === \"status_prose\") process.exit(2);'"
    input_contract: >
      Use RESEARCH Q3/Q6/Q9 and CONTEXT constraints. Canonical STATE frontmatter phase key is current_phase. Keep legacy phase as read-only compatibility. Do not parse prose status.
    output_contract: >
      Add shared SGSD root, STATE frontmatter, active phase, PLAN-LOCKED glob, and gate-evidence envelope writer helpers. Add current_phase: "146" to .planning/STATE.md if absent so this phase has canonical frontmatter data. T146-01 owns creation/update of super-gsd/scripts/lib/sgsd-state.cjs, super-gsd/scripts/lib/gate-evidence-log.cjs, and .planning/metrics/gate-evidence.jsonl; later tasks consume helpers and append envelope-v1 rows only.
    hypothesis: >
      A shared resolver and never-throw evidence writer remove duplicated phase parsing while giving hooks and watchdog one deterministic fail-open path.
    falsifier: >
      Any caller parses prose status for a phase, throws in a non-SGSD repo, writes malformed JSONL, or cannot distinguish missing phase frontmatter from a real phase.
    stop_rule: >
      Node syntax checks pass, resolver reads milestone v3.5 from real STATE frontmatter without prose parsing, and gate-evidence writer can append envelope-v1 rows without throwing.
    expected_ATC_tier: GATE

  - id: "T146-02"
    type: "repo-local-installer"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-01"
    files_touched:
      - ".claude/settings.json"
      - "super-gsd/install.sh"
      - "super-gsd/scripts/merge-settings.js"
      - "super-gsd/config/settings-overlay.json"
      - "super-gsd/config/repo-settings-overlay.json"
    traces_to:
      - "AC-146a"
      - "AC-146b"
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"
      - >
        powershell -NoProfile -Command "Select-String -Path .claude/settings.json -Pattern 'SessionStart','UserPromptSubmit','PostToolUse' | Out-Null"
    verification_cmd: "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"
    input_contract: >
      Use RESEARCH Q1/Q2/Q7. Preserve merge-settings idempotency by command plus matcher, but target <repo>/.claude/settings.json only.
    output_contract: >
      Install SessionStart, UserPromptSubmit, and PostToolUse hook entries into repo-local .claude/settings.json using command: node and install-time absolute target-repo script paths in args. T146-02 owns repo-local hook installation entries in .claude/settings.json and hook overlay config; later cleanup may remove unrelated dead config knobs but must not rewrite hook entries.
    hypothesis: >
      Repo-local install-time hook wiring gives SGSD always-on governance without reading home Claude settings or depending on runtime project-dir expansion.
    falsifier: >
      The installer writes ~/.claude/settings.json, copies env keys from a home settings fixture, emits hardcoded machine paths from source, duplicates hook entries, or omits any of the three hook events.
    stop_rule: >
      Self-test installs into a temp target, proves home settings are untouched, proves no env sentinel is copied, and confirms all hook args resolve under the target repo.
    expected_ATC_tier: GATE

  - id: "T146-03"
    type: "session-start-hook"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-02"
    files_touched:
      - "super-gsd/hooks/sgsd-session-start.js"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146a"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-03-" + [guid]::NewGuid()); try { $planning=Join-Path $tmp ".planning"; New-Item -ItemType Directory -Path $planning -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"873`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Encoding UTF8; $payload=@{hook_event_name="SessionStart";cwd=$tmp;source="startup";session_id="t146-03"} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-session-start.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join "`n"); if ($text -notmatch "Governance Contract" -or $text -notmatch "ATC" -or $text -notmatch "v3.5" -or $text -notmatch "873") { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-03-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-03-" + [guid]::NewGuid()); try { $planning=Join-Path $tmp ".planning"; New-Item -ItemType Directory -Path $planning -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"873`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Encoding UTF8; $payload=@{hook_event_name="SessionStart";cwd=$tmp;source="startup";session_id="t146-03"} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-session-start.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join "`n"); if ($text -notmatch "Governance Contract" -or $text -notmatch "ATC" -or $text -notmatch "v3.5" -or $text -notmatch "873") { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-03-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
    input_contract: >
      Use Claude hook stdout/additionalContext behavior from RESEARCH Q1 and active phase resolver from T146-01.
    output_contract: >
      SessionStart injects the governance contract with ATC tier table, gate table, mode confirmation note, and active milestone/phase read from the payload cwd repo. Non-SGSD cwd exits quiet 0. Consume shared helpers owned by T146-01; append only state_phase_missing evidence rows to .planning/metrics/gate-evidence.jsonl when SGSD STATE frontmatter lacks a phase.
    hypothesis: >
      Injecting the contract from the runtime hook makes governance visible in manual sessions before the model can omit or reinterpret prompt-resident instructions.
    falsifier: >
      An sg-launched SessionStart payload produces no first-turn governance context, lacks active milestone/phase, blocks the session, or emits context in a non-SGSD directory.
    stop_rule: >
      Temporary-repo SessionStart payload prints the contract with fixture phase 873 and non-SGSD payload exits 0 with empty output.
    expected_ATC_tier: GATE

  - id: "T146-04"
    type: "intent-classifier"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-03"
    files_touched:
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/registry/session-governance-hooks.yaml"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146b"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-04-" + [guid]::NewGuid()); try { $planning=Join-Path $tmp ".planning"; New-Item -ItemType Directory -Path $planning -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"874`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Encoding UTF8; $posPayload=@{hook_event_name="UserPromptSubmit";cwd=$tmp;prompt="Can you plan the next phase and write the implementation plan?";session_id="t146-04-pos"} | ConvertTo-Json -Compress; $pos=$posPayload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $posText=($pos -join "`n"); if ($posText -notmatch "/sgsd-triage" -or $posText -match "decision.:.block") { exit 1 }; $negPayload=@{hook_event_name="UserPromptSubmit";cwd=$tmp;prompt="Please read README.md and report the first heading.";session_id="t146-04-neg"} | ConvertTo-Json -Compress; $neg=$negPayload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $negText=($neg -join "`n"); if ($negText -match "/sgsd-triage" -or $negText -match "decision.:.block") { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-04-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
      - >
        powershell -NoProfile -Command '$record=".planning\metrics\gate-evidence.jsonl"; node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt "How should we plan this?" --record $record; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (!(Test-Path -LiteralPath $record)) { exit 1 }; $row=Get-Content -LiteralPath $record | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.signal -eq "intent_classifier_bench" -and $_.iterations -eq 200 } | Select-Object -Last 1; if (-not $row -or $null -eq $row.p95_ms -or [double]$row.p95_ms -ge 1000) { exit 1 }'
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-04-" + [guid]::NewGuid()); try { $planning=Join-Path $tmp ".planning"; New-Item -ItemType Directory -Path $planning -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"874`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Encoding UTF8; $posPayload=@{hook_event_name="UserPromptSubmit";cwd=$tmp;prompt="Can you plan the next phase and write the implementation plan?";session_id="t146-04-pos"} | ConvertTo-Json -Compress; $pos=$posPayload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $posText=($pos -join "`n"); if ($posText -notmatch "/sgsd-triage" -or $posText -match "decision.:.block") { exit 1 }; $negPayload=@{hook_event_name="UserPromptSubmit";cwd=$tmp;prompt="Please read README.md and report the first heading.";session_id="t146-04-neg"} | ConvertTo-Json -Compress; $neg=$negPayload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $negText=($neg -join "`n"); if ($negText -match "/sgsd-triage" -or $negText -match "decision.:.block") { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-04-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }; $record=".planning\metrics\gate-evidence.jsonl"; node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt "How should we plan this?" --record $record; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $row=Get-Content -LiteralPath $record | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.signal -eq "intent_classifier_bench" -and $_.iterations -eq 200 } | Select-Object -Last 1; if (-not $row -or $null -eq $row.p95_ms -or [double]$row.p95_ms -ge 1000) { exit 1 }'
    input_contract: >
      Use RESEARCH Q5 trigger inventory and VTP directive 1. The registry shape is trigger, predicate, enforcement, with embedded defaults until P149 skill-routing.yaml exists.
    output_contract: >
      Add a local Node UserPromptSubmit classifier that lowercases prompt text, applies registry-backed lexical routes, injects /sgsd-triage for planning intent, suggests neglected SGSD skills, and records p95_ms benchmark rows. T146-04 owns creation of super-gsd/registry/session-governance-hooks.yaml; later tasks may only register their hook-specific sections. Append only intent_classifier_bench rows to .planning/metrics/gate-evidence.jsonl owned by T146-01.
    hypothesis: >
      Declarative lexical routing gives manual sessions visible governance nudges at millisecond-level overhead while leaving semantic judgment to /sgsd-triage and other SGSD skills.
    falsifier: >
      The classifier calls an LLM, blocks prompts, judges plan quality itself, misses a planning-shaped prompt, cannot switch registry source with one line for P149, or records p95_ms >= 1000.
    stop_rule: >
      Planning prompt emits /sgsd-triage, trivial execution prompt does not emit /sgsd-triage, neglected-skill prompts route to the named skill suggestion, non-SGSD cwd exits quiet 0, and the 200-iteration bench records p95_ms below 1000.
    expected_ATC_tier: GATE

  - id: "T146-05"
    type: "quality-gate-producer"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-04"
    files_touched:
      - "super-gsd/hooks/sgsd-quality-gate.js"
      - "super-gsd/registry/session-governance-hooks.yaml"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-05-" + [guid]::NewGuid()); try { New-Item -ItemType Directory -Path (Join-Path $tmp ".planning\metrics"),(Join-Path $tmp ".planning\milestones\v3.5\phases\999-fixture"),(Join-Path $tmp "src") -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"999`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $tmp ".planning\STATE.md") -Encoding UTF8; $edit=Join-Path $tmp "src\edited.js"; "module.exports = 1;" | Set-Content -LiteralPath $edit -Encoding UTF8; $record=Join-Path $tmp ".planning\metrics\gate-evidence.jsonl"; $payload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="Edit";tool_input=@{file_path=$edit};session_id="t146-05"} | ConvertTo-Json -Depth 8 -Compress; $out=$payload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join "").Trim().Length -gt 0) { exit 1 }; $rows=Get-Content -LiteralPath $record | ForEach-Object { $_ | ConvertFrom-Json }; $row=$rows | Where-Object { $_.signal -eq "missing_plan" -and $_.phase -eq "999" -and $_.file_path -eq $edit -and $_.tool_name -eq "Edit" } | Select-Object -Last 1; if (-not $row) { exit 1 }; $before=(Get-Content -LiteralPath $record).Count; $badPayload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="UnconfirmedMutator";tool_input=@{file_path=$edit};session_id="t146-05-unknown"} | ConvertTo-Json -Depth 8 -Compress; $badOut=$badPayload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($badOut -join "").Trim().Length -gt 0) { exit 1 }; $after=(Get-Content -LiteralPath $record).Count; if ($after -ne $before) { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-05-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-05-" + [guid]::NewGuid()); try { New-Item -ItemType Directory -Path (Join-Path $tmp ".planning\metrics"),(Join-Path $tmp ".planning\milestones\v3.5\phases\999-fixture"),(Join-Path $tmp "src") -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"999`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $tmp ".planning\STATE.md") -Encoding UTF8; $edit=Join-Path $tmp "src\edited.js"; "module.exports = 1;" | Set-Content -LiteralPath $edit -Encoding UTF8; $record=Join-Path $tmp ".planning\metrics\gate-evidence.jsonl"; $payload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="Edit";tool_input=@{file_path=$edit};session_id="t146-05"} | ConvertTo-Json -Depth 8 -Compress; $out=$payload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join "").Trim().Length -gt 0) { exit 1 }; $rows=Get-Content -LiteralPath $record | ForEach-Object { $_ | ConvertFrom-Json }; $row=$rows | Where-Object { $_.signal -eq "missing_plan" -and $_.phase -eq "999" -and $_.file_path -eq $edit -and $_.tool_name -eq "Edit" } | Select-Object -Last 1; if (-not $row) { exit 1 }; $before=(Get-Content -LiteralPath $record).Count; $badPayload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="UnconfirmedMutator";tool_input=@{file_path=$edit};session_id="t146-05-unknown"} | ConvertTo-Json -Depth 8 -Compress; $badOut=$badPayload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($badOut -join "").Trim().Length -gt 0) { exit 1 }; $after=(Get-Content -LiteralPath $record).Count; if ($after -ne $before) { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-05-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
    input_contract: >
      Use RESEARCH Q1/Q6/Q9 and VTP directive 4. The confirmed PostToolUse file-mutation tool_name matcher for this harness is exactly Edit, Write, NotebookEdit. There is no MultiEdit in this harness.
    output_contract: >
      Add a report-only PostToolUse quality gate that resolves active phase from STATE frontmatter, checks real PLAN-LOCKED naming, and appends missing-plan evidence rows. Register only Edit, Write, and NotebookEdit in super-gsd/registry/session-governance-hooks.yaml owned by T146-04. Unknown tool name means no row, exit 0, and never block. Append only to .planning/metrics/gate-evidence.jsonl owned by T146-01.
    hypothesis: >
      Evidence rows give AC-146c report-only source-edit observability without violating the board's no edit-seam blocking constraint, and T146-06 makes those rows visible to cockpit and MCP consumers.
    falsifier: >
      The hook blocks or exits nonzero on edits, logs no row for a missing active-phase plan, matches unconfirmed mutation tools, emits a row for an unknown tool name, or includes MultiEdit in this harness.
    stop_rule: >
      Temporary SGSD-shaped repo with no active PLAN receives a confirmed Edit payload, appends a row whose phase and file_path match the fixture, and an unknown tool payload exits 0 without appending a row.
    expected_ATC_tier: GATE

  - id: "T146-06"
    type: "cockpit-gate-evidence-reader"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-05"
    files_touched:
      - "super-gsd/tools/cockpit-state/adapter.cjs"
      - "super-gsd/tools/warp-mcp/server.cjs"
    traces_to:
      - "AC-146c"
    acceptance_commands:
      - >
        powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-06-" + [guid]::NewGuid()); try { New-Item -ItemType Directory -Path (Join-Path $tmp ".planning\metrics"),(Join-Path $tmp ".planning\milestones\v3.5\phases\999-fixture"),(Join-Path $tmp "src") -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"999`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $tmp ".planning\STATE.md") -Encoding UTF8; $edit=Join-Path $tmp "src\edited.js"; "module.exports = 1;" | Set-Content -LiteralPath $edit -Encoding UTF8; $payload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="Edit";tool_input=@{file_path=$edit};session_id="t146-06"} | ConvertTo-Json -Depth 8 -Compress; $out=$payload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $snapJson=node super-gsd/tools/cockpit-state/adapter.cjs --json --project $tmp; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $snapText=($snapJson -join "`n"); if ($snapText -notmatch "missing_plan" -or $snapText -notmatch "999" -or $snapText -notmatch [regex]::Escape($edit)) { exit 1 }; $req=@{jsonrpc="2.0";method="tools/call";id=1;params=@{name="sgsd_cockpit_snapshot";arguments=@{project_dir=$tmp}}} | ConvertTo-Json -Depth 10 -Compress; $mcpJson=$req | node super-gsd/tools/warp-mcp/server.cjs --stdio; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $mcpText=($mcpJson -join "`n"); if ($mcpText -notmatch "missing_plan" -or $mcpText -notmatch "999" -or $mcpText -notmatch [regex]::Escape($edit)) { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-06-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
    verification_cmd: >
      powershell -NoProfile -Command '$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sgsd-t146-06-" + [guid]::NewGuid()); try { New-Item -ItemType Directory -Path (Join-Path $tmp ".planning\metrics"),(Join-Path $tmp ".planning\milestones\v3.5\phases\999-fixture"),(Join-Path $tmp "src") -Force | Out-Null; @("---","milestone: v3.5","current_phase: `"999`"","---","# Fixture") | Set-Content -LiteralPath (Join-Path $tmp ".planning\STATE.md") -Encoding UTF8; $edit=Join-Path $tmp "src\edited.js"; "module.exports = 1;" | Set-Content -LiteralPath $edit -Encoding UTF8; $payload=@{hook_event_name="PostToolUse";cwd=$tmp;tool_name="Edit";tool_input=@{file_path=$edit};session_id="t146-06"} | ConvertTo-Json -Depth 8 -Compress; $out=$payload | node super-gsd/hooks/sgsd-quality-gate.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $snapJson=node super-gsd/tools/cockpit-state/adapter.cjs --json --project $tmp; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $snapText=($snapJson -join "`n"); if ($snapText -notmatch "missing_plan" -or $snapText -notmatch "999" -or $snapText -notmatch [regex]::Escape($edit)) { exit 1 }; $req=@{jsonrpc="2.0";method="tools/call";id=1;params=@{name="sgsd_cockpit_snapshot";arguments=@{project_dir=$tmp}}} | ConvertTo-Json -Depth 10 -Compress; $mcpJson=$req | node super-gsd/tools/warp-mcp/server.cjs --stdio; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $mcpText=($mcpJson -join "`n"); if ($mcpText -notmatch "missing_plan" -or $mcpText -notmatch "999" -or $mcpText -notmatch [regex]::Escape($edit)) { exit 1 } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) "sgsd-t146-06-*")) { Remove-Item -LiteralPath $tmp -Recurse -Force } }'
    input_contract: >
      Use RESEARCH Q1/Q6/Q9 and VTP directive 4. Consume gate-evidence rows produced by T146-05 through the existing cockpit adapter and MCP snapshot surfaces.
    output_contract: >
      Expose missing-plan gate-evidence rows through cockpit adapter and MCP reader output. This task reads .planning/metrics/gate-evidence.jsonl owned by T146-01 and must not create, append, or rewrite that stream.
    hypothesis: >
      Cockpit and MCP visibility gives AC-146c observability without changing the report-only quality-gate semantics.
    falsifier: >
      The cockpit adapter cannot surface the row within one refresh, MCP output disagrees with the adapter, the reader writes to gate-evidence.jsonl, or missing evidence degrades the whole snapshot instead of only the governance signal.
    stop_rule: >
      A row emitted by the real T146-05 hook in a temporary fixture appears in adapter --json output and in the sgsd_cockpit_snapshot MCP response with the same phase and file_path.
    expected_ATC_tier: GATE

  - id: "T146-07"
    type: "cheap-fixes-cleanup"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-06"
    files_touched:
      - "super-gsd/scripts/sgsd-stop-handoff.sh"
      - "super-gsd/tools/autopilot-watchdog/check.cjs"
      - "super-gsd/config/settings-overlay.json"
      - "super-gsd/config/**/*.json"
      - "super-gsd/config/**/*.yaml"
    traces_to:
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - "bash -n super-gsd/scripts/sgsd-stop-handoff.sh"
      - "node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution"
      - >
        powershell -NoProfile -Command "rg 'checkpoint_threshold_percent|context_warning_percent|context_warnings|gsd-atc-slice-gate.js' super-gsd --glob '!**/*.md'; if ($LASTEXITCODE -eq 0) { exit 1 } elseif ($LASTEXITCODE -eq 1) { exit 0 } else { exit $LASTEXITCODE }"
    verification_cmd: >
      powershell -NoProfile -Command "bash -n super-gsd/scripts/sgsd-stop-handoff.sh; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; rg 'checkpoint_threshold_percent|context_warning_percent|context_warnings|gsd-atc-slice-gate.js' super-gsd --glob '!**/*.md'; if ($LASTEXITCODE -eq 0) { exit 1 } elseif ($LASTEXITCODE -eq 1) { exit 0 } else { exit $LASTEXITCODE }"
    input_contract: >
      Use RESEARCH Q4/Q8 and CONTEXT cheap-fix list. Keep DEVIATION-W out of this task because research did not prove it is a few-line isolated codex-exec.sh fix.
    output_contract: >
      Reset handoff-chain latch when latest valid row is reason refused, move autopilot-watchdog phase resolution to shared STATE frontmatter helper, unregister dead gsd-atc-slice-gate.js references, and delete dead token/context config knobs from live config. Changes to super-gsd/config/settings-overlay.json are cleanup-only and must not rewrite T146-02 repo-local hook entries.
    hypothesis: >
      These bounded cleanups remove known always-on governance distortions without changing gate semantics or widening P146 beyond session governance hooks.
    falsifier: >
      Refused handoff rows still preserve stale depth, watchdog reads phase from prose regex, dead hook registration remains live, or dead config knobs remain under super-gsd runtime config.
    stop_rule: >
      Shell syntax passes, watchdog phase self-test proves frontmatter resolution, and runtime config grep finds no dead knobs or dead hook registration.
    expected_ATC_tier: GATE
