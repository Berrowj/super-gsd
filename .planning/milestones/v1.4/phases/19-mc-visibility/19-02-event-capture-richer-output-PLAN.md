---
schema_version: 2
phase: 19
plan: "19-02"
wave: 2
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: ["19-01"]
autonomous: true
requirements: ["MC-03", "MC-04", "D-05 #3/#4/#5/#6/#7/#9"]
files_modified:
  - super-gsd/scripts/codex-exec.sh
  - super-gsd/scripts/sgsd-narrative.ps1
  - super-gsd/scripts/sgsd-live-feed.ps1
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/tests/codex-contract-fixtures/ok.txt
  - super-gsd/tests/codex-contract-fixtures/missing-field.txt
  - super-gsd/tests/codex-contract-fixtures/non-integer-findings.txt
  - super-gsd/tests/codex-contract-fixtures/wrong-pass-rate.txt
  - super-gsd/tests/codex-contract-fixtures/extra-trailing-lines.txt
  - super-gsd/tests/codex-contract-fixtures/empty-report.txt
  - super-gsd/tests/codex-contract-fixtures/substring-findings.txt
  - super-gsd/tests/run-parse-fuzz.sh

goal: >
  MC-03 narrative.md Codex event writes (net-new write path in codex-exec.sh) +
  MC-04 live-feed dual-source poll loop (codex-log.jsonl alongside activity-log.jsonl) +
  6 Phase 17/18 richer-output-contract deferrals: D-05 #3 (tier recal), #4 (FINDINGS_DETAIL),
  #5 (timeout-escalate retry), #6 (self-test exit precedence), #7 (validateContract regex),
  #9 (parse-rigor test corpus).

tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/codex-exec.sh"
    input_contract: |
      MC-03: net-new append_narrative_event() write path. append_jsonl() defined at line 400.
      Call sites (must ALL get a paired append_narrative_event call):
        Line 459: append_jsonl 5 "true" 0          # timeout (RC=124)
        Line 468: append_jsonl 4 "false" 0          # auth-denied
        Line 474: append_jsonl 1 "false" 0          # generic error
        Line 511: append_jsonl 6 "false" 0          # contract/parse failure
        Line 525: append_jsonl 0 "false" "$REPORT_BYTES"  # success
      Available vars at all exit paths: $TS, $PHASE_TAG, $PLAN_TAG, $STEP_TAG, $DURATION_MS, $PROJECT, $METRICS_LOG.
      NARRATIVE_FILE = "$PROJECT/.planning/metrics/narrative.md". Initialize if missing with template.
      Event types: codex_started | codex_completed | codex_timeout | codex_fallback.
      latest/lastfail fields updated via sed -i on known prefix pattern.
    output_contract: |
      grep -c 'append_narrative_event' super-gsd/scripts/codex-exec.sh returns >= 7
      (1 definition + 1 codex_started call + 5 exit-path calls).
      NARRATIVE_FILE path uses $PROJECT variable (not hardcoded).
      narrative.md initialized if missing (mkdir -p + printf template with latest/lastfail/Events sections).
      All 4 event types represented across the 6 call sites.
    hypothesis: "Adding append_narrative_event() after append_jsonl() and pairing it at each of the 5 exit paths plus one pre-run call site is sufficient to satisfy MC-03's 4-event-type requirement without altering any existing exit logic."
    falsifier: "grep -c 'append_narrative_event' super-gsd/scripts/codex-exec.sh returns <7, OR any of the 4 event types (codex_started/codex_completed/codex_timeout/codex_fallback) is absent from the call sites."
    stop_rule: "Function defined and all 6 call sites added. bash -n super-gsd/scripts/codex-exec.sh exits 0."
    verification_cmd: "grep -c 'append_narrative_event' super-gsd/scripts/codex-exec.sh"
    known_deadends:
      - "Do not modify sgsd-narrative.ps1 for MC-03 — it already reads narrative.md for display; write path belongs in codex-exec.sh only."

  - id: "T2"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-live-feed.ps1"
    input_contract: |
      MC-04: replace single-source blocking Get-Content -Wait section (lines 92-end) with dual-source polling loop.
      $logPath = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"  (line 14, keep as-is).
      Add: $codexLogPath = Join-Path $ProjectDir ".planning\metrics\codex-log.jsonl"
      Pattern: snapshot-diff polling every 1500ms. Track $activitySeenCount + $codexSeenCount.
      Merge new lines by ts; sort before rendering. Dedup: skip codex-log row if ts already in $renderedTsSet.
      Prefix: activity-log rows = "[act]"; codex-log rows = "[cdx]".
      Color: codex exit=0 → DarkCyan, exit=5 → DarkYellow, other → Red.
      Keep everything above line 92 unchanged.
    output_contract: |
      grep -q 'codex-log.jsonl' super-gsd/scripts/sgsd-live-feed.ps1 passes.
      No Get-Content -Wait call remains for either source.
      [cdx] prefix present for codex-log rows.
      $renderedTsSet dedup logic present.
    hypothesis: "Replacing the blocking Get-Content -Wait section with a 1500ms snapshot-diff polling loop reading both files independently and merging by ts is sufficient to display codex-log rows with [cdx] prefix without blocking the activity-log stream."
    falsifier: "grep -q 'Get-Content.*-Wait' super-gsd/scripts/sgsd-live-feed.ps1 still matches after edit, OR codex-log.jsonl is not referenced in the script."
    stop_rule: "Polling loop present. Both source paths referenced. No -Wait pattern remains. Script parses without PS syntax error."
    verification_cmd: "powershell.exe -Command \"Select-String -Path 'super-gsd\\scripts\\sgsd-live-feed.ps1' -Pattern 'codex-log\\.jsonl' -Quiet; exit ($LASTEXITCODE)\""
    known_deadends:
      - "Do not add a second Get-Content -Wait — PowerShell blocks on the first -Wait call, preventing a second source from being polled."

  - id: "T3"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/codex-exec.sh"
      - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
    depends_on: ["T1"]
    input_contract: |
      D-05 #3 (codex-exec.sh): resolve_step_timeout() case at line 198. Current branch:
        per-dispatch-ATC|phase-level-ATC|adversarial) echo "$TIER_REVIEW"
      Split to:
        per-dispatch-ATC|adversarial) echo "$TIER_REVIEW"
        phase-level-ATC)              echo "$TIER_ANALYSIS"
      Add comment: # D-05 #3: phase-level-ATC uses analysis tier (90s), not review (120s)

      D-05 #5 (codex-exec.sh): add --retry-on-timeout-escalate flag.
        Default: RETRY_ON_TIMEOUT_ESCALATE=false
        In timeout exit path (line 457-461), before exit 5, if flag=true and STEP_TAG=phase-level-ATC:
          exec "$0" "$@" --no-retry-on-timeout-escalate (exec replaces process, no fork bomb)
        Add --no-retry-on-timeout-escalate as silent flag setting RETRY_ON_TIMEOUT_ESCALATE=false.

      D-05 #3 (SKILL.md): timeoutTier fix at exactly 2 sites:
        Line 513: 'review' → 'analysis'  (comment: // D-05 #3: phase-level-ATC → analysis tier)
        Line 945: 'review' → 'analysis'  (same comment)
        Line 1082: LEAVE UNCHANGED (adversarial gate, correct tier is review)

      D-05 #5 (SKILL.md): near line 513 dispatch options, add:
        retryOnTimeoutEscalate: true,  // D-05 #5: auto-escalate once to analysis on timeout
    output_contract: |
      grep -n 'timeoutTier' super-gsd/skills/sgsd-orchestrate/SKILL.md shows:
        line 513 = 'analysis', line 945 = 'analysis', line 1082 = 'review' (unchanged).
      grep -q 'retry-on-timeout-escalate' super-gsd/scripts/codex-exec.sh passes.
      resolve_step_timeout: phase-level-ATC echoes TIER_ANALYSIS; adversarial still echoes TIER_REVIEW.
      bash -n super-gsd/scripts/codex-exec.sh exits 0.
    hypothesis: "Splitting the phase-level-ATC case in resolve_step_timeout and updating both SKILL.md dispatch sites to timeoutTier: 'analysis' (while leaving line 1082 adversarial unchanged) fully closes D-05 #3 without breaking existing adversarial gate behavior."
    falsifier: "grep at line 513 or 945 still shows 'review', OR line 1082 has been changed to 'analysis', OR codex-exec.sh bash -n fails."
    stop_rule: "All three timeoutTier grep lines match expected values. retry-on-timeout-escalate flag present with exec loop-prevention."
    verification_cmd: "grep -n 'timeoutTier' super-gsd/skills/sgsd-orchestrate/SKILL.md"
    known_deadends:
      - "Do not change line 1082 timeoutTier — that is the adversarial gate and intentionally uses review tier."
      - "Do not use fork/subshell for retry — use exec to replace the process and prevent resource doubling."

  - id: "T4"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
    depends_on: ["T3"]
    input_contract: |
      D-05 #4: FINDINGS_DETAIL optional footer. Find prompt-composition block for phase-level-ATC
      (Step 6.5, after line 487) and Step 9.5 (near line 945 dispatch). Append to prompt instructions
      (after required 5-line contract description) in both locations:
        "After the 5 required contract lines, you MAY optionally emit one or more FINDINGS_DETAIL lines:
          FINDINGS_DETAIL: [severity] [dimension] <description>
          severity: CRITICAL | WARNING | INFO
          dimension: naming | logic | security | performance | style | architecture
        These lines are optional. The orchestrator will render them in ATC-REVIEW.md if present."
      validateContract must ACCEPT (not reject) FINDINGS_DETAIL lines — no change to required array.

      D-05 #7: validateContract regex hardening. Current definition at line 479: startsWith check only.
      ADD value validation after missing-field check (single definition, deduplicated):
        FINDINGS / CRITICAL / WARNINGS: value must match /^\d+$/
        PASS_RATE: value must match /^\d+\/\d+$/
        Malformed value → push to missing array → returns { valid: false, missing: [...] }
      If validateContract is duplicated at line 479 and elsewhere, deduplicate to single definition.
    output_contract: |
      grep -q 'FINDINGS_DETAIL' super-gsd/skills/sgsd-orchestrate/SKILL.md passes.
      validateContract contains /^\d+$/ regex guard for FINDINGS/CRITICAL/WARNINGS.
      validateContract contains /^\d+\/\d+$/ regex guard for PASS_RATE.
      Malformed-value path pushes to missing array (same handling as absent field).
      grep -c 'validateContract' SKILL.md count unchanged or reduced (no new duplicate definition).
    hypothesis: "Adding FINDINGS_DETAIL instructions to both Step 6.5 and Step 9.5 prompt blocks and extending validateContract with value-regex guards (additive after existing startsWith check) closes D-05 #4 and #7 without breaking existing valid-contract acceptance."
    falsifier: "grep -q 'FINDINGS_DETAIL' SKILL.md fails, OR validateContract still accepts non-integer FINDINGS value, OR extra-trailing-lines fixture (valid) would be rejected by the new regex logic."
    stop_rule: "FINDINGS_DETAIL text present in both Step 6.5 and Step 9.5 prompt areas. validateContract has all four regex guards. Single definition, no duplication."
    verification_cmd: "grep -n 'FINDINGS_DETAIL\\|\\^\\\\\\\\d' super-gsd/skills/sgsd-orchestrate/SKILL.md | head -10"
    known_deadends:
      - "Do not add FINDINGS_DETAIL to the required[] array in validateContract — it is optional, additive only."
      - "Do not duplicate validateContract — update the single definition already present above Step 6.5."

  - id: "T5"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/codex-exec.sh"
      - "super-gsd/tests/codex-contract-fixtures/ok.txt"
      - "super-gsd/tests/codex-contract-fixtures/missing-field.txt"
      - "super-gsd/tests/codex-contract-fixtures/non-integer-findings.txt"
      - "super-gsd/tests/codex-contract-fixtures/wrong-pass-rate.txt"
      - "super-gsd/tests/codex-contract-fixtures/extra-trailing-lines.txt"
      - "super-gsd/tests/codex-contract-fixtures/empty-report.txt"
      - "super-gsd/tests/codex-contract-fixtures/substring-findings.txt"
      - "super-gsd/tests/run-parse-fuzz.sh"
    depends_on: ["T4"]
    input_contract: |
      D-05 #6 (codex-exec.sh): add --self-test-exit-priority flag. In self-test harness section (~line 212):
        if SELF_TEST_EXIT_PRIORITY=true: print probe order table (4 probes with exit codes 10-13), exit 0.
        Add --self-test-exit-priority to arg parser. Default: SELF_TEST_EXIT_PRIORITY=false.

      D-05 #9: create super-gsd/tests/codex-contract-fixtures/ dir with 7 files + run-parse-fuzz.sh.
      Expected assertions:
        ok.txt                     → assert_valid   (baseline: all 5 fields, correct formats)
        missing-field.txt          → assert_invalid (CRITICAL field absent)
        non-integer-findings.txt   → assert_invalid (FINDINGS: two)
        wrong-pass-rate.txt        → assert_invalid (PASS_RATE: 100%)
        extra-trailing-lines.txt   → assert_valid   (FINDINGS_DETAIL additive — must PASS)
        empty-report.txt           → assert_invalid (0 bytes)
        substring-findings.txt     → assert_invalid (FINDINGS: embedded in sentence, not startsWith)
      run-parse-fuzz.sh: uses Node.js inline ESM mirror of validateContract logic. exit 0 if all pass.
      Make run-parse-fuzz.sh executable (chmod +x).
    output_contract: |
      bash super-gsd/tests/run-parse-fuzz.sh exits 0 with "7 passed, 0 failed".
      super-gsd/tests/codex-contract-fixtures/ contains exactly 7 files.
      grep -q 'self-test-exit-priority' super-gsd/scripts/codex-exec.sh passes.
      grep -q 'parse_failure' super-gsd/tests/run-parse-fuzz.sh passes.
    hypothesis: "A Node.js inline mirror of validateContract in run-parse-fuzz.sh that applies the same startsWith + regex guards against 7 known fixtures (2 valid, 5 invalid) is sufficient to establish parse-rigor regression coverage for D-05 #9."
    falsifier: "bash super-gsd/tests/run-parse-fuzz.sh exits non-zero, OR extra-trailing-lines.txt is incorrectly detected as invalid, OR fixture count in codex-contract-fixtures/ is not 7."
    stop_rule: "run-parse-fuzz.sh exits 0. All 7 assertions pass. --self-test-exit-priority exits 0 with probe-order table."
    verification_cmd: "bash super-gsd/tests/run-parse-fuzz.sh"
    known_deadends:
      - "Do not use require() in the Node.js inline script — use --input-type=module ESM to avoid CommonJS/ESM interop issues."
      - "extra-trailing-lines.txt must be asserted as VALID (not invalid) — FINDINGS_DETAIL is additive and optional."
---

<objective>
Close the MC-03 narrative event write path (net-new in codex-exec.sh), extend
MC-04 live-feed to dual-source, and address 6 Phase 17/18 richer-output-contract
deferrals. super-gsd/tests/ dir must be created (RESEARCH: missing).

Purpose: Completes the 5-surface feedback loop for Codex visibility and closes
the 6 parse/dispatch hygiene items accumulated from Phase 17 + 18.

Output: 5 modified/created files, 5 atomic commits, 1 SUMMARY.
</objective>

<execution_context>
@C:\Users\jack.berrow\.claude\get-shit-done\workflows\execute-plan.md
</execution_context>

<context>
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\19-mc-visibility\19-CONTEXT.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\19-mc-visibility\19-RESEARCH.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\19-mc-visibility\19-01-SUMMARY.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From super-gsd/scripts/codex-exec.sh:

  append_jsonl() — defined at line 400. Signature:
    append_jsonl <wrapper_exit> <timeout_hit> <report_bytes>
  Call sites (must ALL get a paired append_narrative_event call):
    Line 459: append_jsonl 5 "true" 0          # exit path: timeout (RC=124)
    Line 468: append_jsonl 4 "false" 0          # exit path: auth-denied
    Line 474: append_jsonl 1 "false" 0          # exit path: generic error
    Line 511: append_jsonl 6 "false" 0          # exit path: contract/parse failure
    Line 525: append_jsonl 0 "false" "$REPORT_BYTES"  # exit path: success

  Available variables at all exit paths:
    $TS (ISO timestamp), $PHASE_TAG, $PLAN_TAG, $STEP_TAG, $DURATION_MS,
    $PROJECT (project dir), $METRICS_LOG (codex-log.jsonl path)

  resolve_step_timeout() — defined at line 198:
    case "phase-level-ATC"|"adversarial" → echo "$TIER_REVIEW"
    D-05 #3 fix: change "phase-level-ATC" branch to echo "$TIER_ANALYSIS" (NOT adversarial — leave that as review)

From super-gsd/scripts/sgsd-live-feed.ps1:

  $logPath = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"  # line 14
  Lines 92+102: current single-source Get-Content -Wait -Tail 0 pattern.
  RESEARCH GAP-4: cannot simply add second Get-Content -Wait (PS blocks).
  Replace the tail section (lines 92-end) with a polling loop:
    Collect snapshot of both files every 1-2s via Get-Content -Tail 0 (snapshot, not -Wait)
    Track last seen line counts per file; emit only new lines each iteration
    Merge new lines by ts field; sort before rendering
    Prefix: activity-log rows → no prefix (existing behavior preserved); codex-log rows → "[cdx] "
    Dedup: skip codex-log row if ts+step matches an activity-log row already rendered

From super-gsd/skills/sgsd-orchestrate/SKILL.md:

  validateContract at line 479-485:
    Current: startsWith string check only for 5 required field prefixes
    D-05 #7 additive fix: after missing-field check, add value regex guards:
      FINDINGS:   value must match /^\d+$/
      CRITICAL:   value must match /^\d+$/
      WARNINGS:   value must match /^\d+$/
      PASS_RATE:  value must match /^\d+\/\d+$/
    Malformed value → push field to missing array → returns { valid: false, missing: [...] }

  timeoutTier fix (D-05 #3):
    Line 513: timeoutTier: 'review'  → timeoutTier: 'analysis'
    Line 945: timeoutTier: 'review'  → timeoutTier: 'analysis'
    Line 1082: timeoutTier: 'review' → LEAVE UNCHANGED (adversarial gate, different step)
    Update the inline comment at each changed line to say "analysis tier = 90s" (verify actual TIER_ANALYSIS value from codex-exec.sh if needed)

  FINDINGS_DETAIL footer (D-05 #4):
    In the prompt-composition block before codex-exec.sh dispatch, append to prompt:
    "After the 5 required lines, you MAY optionally emit additional lines in the format:
     FINDINGS_DETAIL: [severity] [dimension] <description>
     One line per finding. Orchestrator will render these in ATC-REVIEW.md if present."
    validateContract must accept (not require) FINDINGS_DETAIL lines — no change needed to
    required array since it's additive/optional.

  --retry-on-timeout-escalate (D-05 #5):
    SKILL.md phase-level-ATC gate section: add `retryOnTimeoutEscalate: true` to the
    codex dispatch options object (near timeoutTier line 513). This opt-in flag tells
    codex-exec.sh to retry once with analysis tier on exit 5.

From super-gsd/scripts/sgsd-narrative.ps1:

  Line 42: $NarrativeCache = Join-Path $PlanningDir "metrics\narrative.md"  (read-only today)
  RESEARCH GAP-1: no write path exists. The write happens in CODEX-EXEC.SH, not in sgsd-narrative.ps1.
  sgsd-narrative.ps1 does NOT need modification for MC-03 — it already reads narrative.md for display.
  Only codex-exec.sh gains the write path. Remove sgsd-narrative.ps1 from files_modified if executor
  confirms existing render is sufficient after write path exists.

  narrative.md schema (D-04) — executor must initialize if file missing:
    ```
    # Narrative

    latest: <empty or last codex_completed one_liner>
    lastfail: <empty or last codex_timeout/fallback one_liner>

    ## Events
    <!-- codex events appended below -->
    ```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>T1: MC-03 — append_narrative_event() in codex-exec.sh + 5 call sites</name>
  <files>super-gsd/scripts/codex-exec.sh</files>
  <action>
Add `append_narrative_event()` function immediately after `append_jsonl()` (after line 412).

Function signature and body:
```bash
NARRATIVE_FILE="$PROJECT/.planning/metrics/narrative.md"

append_narrative_event() {
    local event_type="$1"   # codex_started | codex_completed | codex_timeout | codex_fallback
    local detail="$2"       # short description string (no newlines)
    local update_field="$3" # "latest" | "lastfail" | "" (no field update)

    # Initialize narrative.md if missing
    if [[ ! -f "$NARRATIVE_FILE" ]]; then
        mkdir -p "$(dirname "$NARRATIVE_FILE")"
        printf '# Narrative\n\nlatest: \nlastfail: \n\n## Events\n' > "$NARRATIVE_FILE"
    fi

    # Append event entry to ## Events section
    local entry="- [$TS] $event_type: $detail"
    printf '%s\n' "$entry" >> "$NARRATIVE_FILE"

    # Update latest or lastfail field (sed in-place)
    if [[ "$update_field" == "latest" ]]; then
        sed -i "s|^latest:.*|latest: $detail|" "$NARRATIVE_FILE"
    elif [[ "$update_field" == "lastfail" ]]; then
        sed -i "s|^lastfail:.*|lastfail: $detail|" "$NARRATIVE_FILE"
    fi
}
```

Pair calls alongside the 5 existing append_jsonl call sites:

  Line 459 (timeout): after `append_jsonl 5 "true" 0`
    add: `append_narrative_event "codex_timeout" "timeout after ${TIMEOUT}s step=$STEP_TAG" "lastfail"`

  Line 468 (auth-denied): after `append_jsonl 4 "false" 0`
    add: `append_narrative_event "codex_fallback" "auth-denied step=$STEP_TAG" "lastfail"`

  Line 474 (generic error): after `append_jsonl 1 "false" 0`
    add: `append_narrative_event "codex_fallback" "error exit=$RC step=$STEP_TAG" "lastfail"`

  Line 511 (parse/contract failure): after `append_jsonl 6 "false" 0`
    add: `append_narrative_event "codex_fallback" "parse_failure step=$STEP_TAG" "lastfail"`

  Line 525 (success): after `append_jsonl 0 "false" "$REPORT_BYTES"`
    add: `append_narrative_event "codex_completed" "ok step=$STEP_TAG dur=${DURATION_MS}ms bytes=$REPORT_BYTES" "latest"`

Also add a `codex_started` call just BEFORE the codex command runs (find the write_live_state "running" call at line 454 and add below it):
    `append_narrative_event "codex_started" "step=$STEP_TAG plan=$PLAN_TAG phase=$PHASE_TAG" ""`

Commit: `feat(19-02/T1): MC-03 append_narrative_event in codex-exec.sh + 6 call sites`
  </action>
  <verify>
    <automated>grep -c 'append_narrative_event' super-gsd/scripts/codex-exec.sh</automated>
  </verify>
  <done>
    `grep -c 'append_narrative_event' super-gsd/scripts/codex-exec.sh` returns >= 7 (1 definition + 6 call sites).
    NARRATIVE_FILE path defined and uses $PROJECT variable (not hardcoded).
    narrative.md initialized if missing (mkdir -p + printf template).
    All 4 D-04 event types (codex_started / codex_completed / codex_timeout / codex_fallback) represented across the 6 call sites.
  </done>
</task>

<task type="auto" tdd="false">
  <name>T2: MC-04 — sgsd-live-feed.ps1 dual-source polling loop with ts-dedup</name>
  <files>super-gsd/scripts/sgsd-live-feed.ps1</files>
  <action>
Replace the current single-source blocking `Get-Content -Wait` section (lines 92-end)
with a dual-source polling loop. Keep everything above line 92 unchanged (variable setup,
$ProjectDir resolution, $logPath assignment for activity-log).

New polling section (replaces lines 92 onwards):

```powershell
$codexLogPath = Join-Path $ProjectDir ".planning\metrics\codex-log.jsonl"

# Snapshot-diff polling: read last N lines each iteration, emit only new ones
# Avoids Get-Content -Wait blocking when adding a second source
$activitySeenCount = 0
$codexSeenCount    = 0
$renderedTsSet     = [System.Collections.Generic.HashSet[string]]::new()

# Initial tail: show last 30 activity lines to seed the display
$initial = @(Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue)
foreach ($line in $initial) {
    try {
        $e = $line | ConvertFrom-Json -ErrorAction Stop
        $ts   = if ($e.ts)    { "$($e.ts)" }    else { "" }
        $kind = if ($e.command_kind) { "$($e.command_kind)" } else { "event" }
        $tool = if ($e.tool_name)   { "$($e.tool_name)" }   else { "" }
        Write-Host ("[act] $ts $kind $tool") -ForegroundColor DarkGray
        if ($ts) { [void]$renderedTsSet.Add($ts) }
    } catch {
        Write-Host $line -ForegroundColor DarkGray
    }
}
$activitySeenCount = (Get-Content $logPath -ErrorAction SilentlyContinue | Measure-Object -Line).Lines

Write-Host "--- watching activity-log + codex-log (Ctrl-C to stop) ---" -ForegroundColor DarkGray

while ($true) {
    Start-Sleep -Milliseconds 1500

    # Activity log: new lines since last check
    $actLines = @(Get-Content $logPath -ErrorAction SilentlyContinue)
    if ($actLines.Count -gt $activitySeenCount) {
        $newAct = $actLines[$activitySeenCount..($actLines.Count - 1)]
        foreach ($line in $newAct) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                $ts   = if ($e.ts)    { "$($e.ts)" }    else { "" }
                $kind = if ($e.command_kind) { "$($e.command_kind)" } else { "event" }
                $tool = if ($e.tool_name)   { "$($e.tool_name)" }   else { "" }
                Write-Host ("[act] $ts $kind $tool") -ForegroundColor Gray
                if ($ts) { [void]$renderedTsSet.Add($ts) }
            } catch {
                Write-Host $line -ForegroundColor Gray
            }
        }
        $activitySeenCount = $actLines.Count
    }

    # Codex log: new lines since last check — distinct prefix + color
    if (Test-Path $codexLogPath) {
        $cdxLines = @(Get-Content $codexLogPath -ErrorAction SilentlyContinue)
        if ($cdxLines.Count -gt $codexSeenCount) {
            $newCdx = $cdxLines[$codexSeenCount..($cdxLines.Count - 1)]
            foreach ($line in $newCdx) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    $ts   = if ($e.ts)   { "$($e.ts)" }   else { "" }
                    $step = if ($e.step) { "$($e.step)" } else { "" }
                    # Dedup: skip if ts already rendered by activity-log heartbeat
                    $dedupKey = "$ts|$step"
                    if ($ts -and $renderedTsSet.Contains($ts)) { continue }
                    $exitCode = if ($null -ne $e.exit) { "exit=$($e.exit)" } else { "" }
                    $dur      = if ($e.duration_ms) { "dur=$($e.duration_ms)ms" } else { "" }
                    $fb       = if ($e.fallback_triggered) { "[FALLBACK]" } else { "" }
                    $cdxColor = if ($e.exit -eq 0) { "DarkCyan" } elseif ($e.exit -eq 5) { "DarkYellow" } else { "Red" }
                    Write-Host ("[cdx] $ts $step $exitCode $dur $fb") -ForegroundColor $cdxColor
                } catch {
                    Write-Host ("[cdx] $line") -ForegroundColor DarkCyan
                }
            }
            $codexSeenCount = $cdxLines.Count
        }
    }
}
```

Legend line (add before the while loop):
```powershell
Write-Host "[act] = activity-log events  [cdx] = codex-log reviews" -ForegroundColor DarkGray
```

Commit: `feat(19-02/T2): MC-04 live-feed dual-source poll loop with ts-dedup`
  </action>
  <verify>
    <automated>powershell -Command "Select-String -Path 'super-gsd\scripts\sgsd-live-feed.ps1' -Pattern 'codex-log.jsonl' -Quiet; if ($?) { exit 0 } else { exit 1 }"</automated>
  </verify>
  <done>
    `grep -q 'codex-log.jsonl' super-gsd/scripts/sgsd-live-feed.ps1` passes.
    No `Get-Content -Wait` call remains for either source (snapshot-diff pattern only).
    Script parses without error in PS 5.1 AST parser.
    [cdx] prefix present for codex-log rows; [act] prefix or no prefix for activity-log rows.
    dedup logic using $renderedTsSet present.
  </done>
</task>

<task type="auto" tdd="false">
  <name>T3: D-05 #3+#5 — phase-level-ATC tier recal + timeout-escalate retry flag</name>
  <files>super-gsd/scripts/codex-exec.sh, super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
Two changes in two files:

**codex-exec.sh — D-05 #3 — resolve_step_timeout() fix:**
In the case statement at line 198-209, change the branch:
  Before: `per-dispatch-ATC|phase-level-ATC|adversarial)  echo "$TIER_REVIEW" ;;`
  After:  separate the cases:
    `per-dispatch-ATC|adversarial)  echo "$TIER_REVIEW" ;;`
    `phase-level-ATC)               echo "$TIER_ANALYSIS" ;;`
  Add comment: `# D-05 #3: phase-level-ATC uses analysis tier (90s), not review (120s)`

**codex-exec.sh — D-05 #5 — --retry-on-timeout-escalate flag:**
1. In the arg-parsing section (find `--self-test` flag parsing for pattern), add:
   ```bash
   --retry-on-timeout-escalate) RETRY_ON_TIMEOUT_ESCALATE=true ;;
   ```
   with default at top: `RETRY_ON_TIMEOUT_ESCALATE=false`

2. In the timeout exit path (around line 457-461), before `exit 5`, add retry logic:
   ```bash
   if [[ "$RETRY_ON_TIMEOUT_ESCALATE" == true && "$STEP_TAG" == "phase-level-ATC" ]]; then
       echo "codex-exec: timeout on review tier — retrying once with analysis tier" >&2
       # Re-invoke self with analysis tier override (set env var to bypass resolver)
       CODEX_TIMEOUT_TIER_OVERRIDE=analysis exec "$0" "$@" --no-retry-on-timeout-escalate
       # exec replaces process; code below is fallback if exec fails
   fi
   write_live_state "timeout" 5 "true" 0
   append_jsonl 5 "true" 0
   ```
   Add `--no-retry-on-timeout-escalate` as a silent flag (sets RETRY_ON_TIMEOUT_ESCALATE=false)
   to prevent infinite loops on exec re-invocation.

**SKILL.md — D-05 #3 — timeoutTier fix (2 sites):**
  Line 513: `timeoutTier: 'review'` → `timeoutTier: 'analysis'`
  Update inline comment: `// D-05 #3: phase-level-ATC → analysis tier`

  Line 945: `timeoutTier: 'review'` → `timeoutTier: 'analysis'`
  Update inline comment same way.

  Line 1082: `timeoutTier: 'review'` → LEAVE UNCHANGED (adversarial gate, correct tier)

**SKILL.md — D-05 #5 — opt-in flag:**
  Near line 513 (phase-level-ATC dispatch options object), add:
    `retryOnTimeoutEscalate: true,  // D-05 #5: auto-escalate once to analysis on timeout`

Commit: `fix(19-02/T3): D-05 #3+#5 phase-level-ATC tier analysis + timeout-escalate retry`
  </action>
  <verify>
    <automated>grep -n 'timeoutTier' super-gsd/skills/sgsd-orchestrate/SKILL.md</automated>
  </verify>
  <done>
    SKILL.md line 513 shows `timeoutTier: 'analysis'` (not 'review').
    SKILL.md line 945 shows `timeoutTier: 'analysis'` (not 'review').
    SKILL.md line 1082 shows `timeoutTier: 'review'` (unchanged — adversarial gate).
    codex-exec.sh resolve_step_timeout: phase-level-ATC case echoes TIER_ANALYSIS; adversarial still echoes TIER_REVIEW.
    codex-exec.sh has RETRY_ON_TIMEOUT_ESCALATE flag parsing.
    `grep -q 'retry-on-timeout-escalate' super-gsd/scripts/codex-exec.sh` passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>T4: D-05 #4+#7 — FINDINGS_DETAIL optional footer + validateContract regex</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
Two additive changes to SKILL.md:

**D-05 #4 — FINDINGS_DETAIL optional contract lines:**
Find the prompt-composition block for phase-level-ATC (Step 6.5, after line 487). Locate
where the prompt string/template is assembled before passing to codex-exec.sh dispatch.
Append to the prompt instructions (after the required 5-line contract description):

```
After the 5 required contract lines, you MAY optionally emit one or more FINDINGS_DETAIL lines:
  FINDINGS_DETAIL: [severity] [dimension] <description>
  severity: CRITICAL | WARNING | INFO
  dimension: naming | logic | security | performance | style | architecture
Example: FINDINGS_DETAIL: [WARNING] [logic] Missing null check before array access at line 42
These lines are optional. The orchestrator will render them in ATC-REVIEW.md if present.
```

Apply the same optional-footer instruction in Step 9.5 per-dispatch prompt (near line 945 dispatch).

**D-05 #7 — validateContract regex hardening:**
At line 479, the validateContract function checks startsWith for 5 required fields.
ADD value validation after the missing-field check:

```javascript
function validateContract(content) {
  if (typeof content !== 'string') return { valid: false, missing: ['(content not a string)'] };
  const required = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:', 'PASS_RATE:', 'ONE_LINER:'];
  const lines = content.split('\n');
  const missing = required.filter(field => !lines.some(line => line.startsWith(field)));

  // D-05 #7: value regex guards — malformed values treated same as missing fields
  const getValue = (prefix) => {
    const line = lines.find(l => l.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : null;
  };
  const intFields = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:'];
  for (const f of intFields) {
    const v = getValue(f);
    if (v !== null && !/^\d+$/.test(v)) missing.push(f + '(non-integer value: ' + v + ')');
  }
  const passRate = getValue('PASS_RATE:');
  if (passRate !== null && !/^\d+\/\d+$/.test(passRate)) {
    missing.push('PASS_RATE:(invalid format: ' + passRate + ')');
  }

  return { valid: missing.length === 0, missing };
}
```

This function definition appears at line 479 and is reused at Step 9.5 — update the single
definition (not two copies). If validateContract is duplicated at line 479 and elsewhere,
deduplicate to a single definition and reference.

Commit: `feat(19-02/T4): D-05 #4+#7 FINDINGS_DETAIL optional footer + validateContract regex`
  </action>
  <verify>
    <automated>grep -n 'FINDINGS_DETAIL\|test.*\\\d' super-gsd/skills/sgsd-orchestrate/SKILL.md | head -10</automated>
  </verify>
  <done>
    `grep -q 'FINDINGS_DETAIL' super-gsd/skills/sgsd-orchestrate/SKILL.md` passes.
    validateContract contains `/^\d+$/` regex guard for FINDINGS/CRITICAL/WARNINGS.
    validateContract contains `/^\d+\/\d+$/` regex guard for PASS_RATE.
    Malformed-value path pushes to missing array (same handling as absent field).
  </done>
</task>

<task type="auto" tdd="false">
  <name>T5: D-05 #6+#9 — exit-precedence diagnostic flag + parse-rigor fixture corpus</name>
  <files>super-gsd/scripts/codex-exec.sh, super-gsd/tests/codex-contract-fixtures/ok.txt, super-gsd/tests/codex-contract-fixtures/missing-field.txt, super-gsd/tests/codex-contract-fixtures/non-integer-findings.txt, super-gsd/tests/codex-contract-fixtures/wrong-pass-rate.txt, super-gsd/tests/codex-contract-fixtures/extra-trailing-lines.txt, super-gsd/tests/codex-contract-fixtures/empty-report.txt, super-gsd/tests/codex-contract-fixtures/substring-findings.txt, super-gsd/tests/run-parse-fuzz.sh</files>
  <action>
**codex-exec.sh — D-05 #6 — --self-test-exit-priority flag:**
In the self-test harness section (around line 212), add a new diagnostic mode flag:
```bash
# D-05 #6: --self-test-exit-priority — print probe order table, exit 0
if [[ "$SELF_TEST_EXIT_PRIORITY" == true ]]; then
    echo "codex-exec: self-test exit priority table"
    echo "  Probe 1: PATH check         (exit 10 on failure — highest priority)"
    echo "  Probe 2: auth check         (exit 11 on failure)"
    echo "  Probe 3: timeout-math check (exit 12 on failure)"
    echo "  Probe 4: contract check     (exit 13 on failure — lowest priority)"
    echo "  Note: PATH failure takes precedence over auth failure when both conditions hold."
    exit 0
fi
```
Add `--self-test-exit-priority) SELF_TEST_EXIT_PRIORITY=true ;;` to arg parser.
Default: `SELF_TEST_EXIT_PRIORITY=false`

**Create super-gsd/tests/ dir + 6 malformed fixtures + 1 valid fixture:**

super-gsd/tests/codex-contract-fixtures/ok.txt — valid contract (baseline):
```
FINDINGS: 2
CRITICAL: 0
WARNINGS: 2
PASS_RATE: 8/10
ONE_LINER: Two minor style warnings found; logic is sound.
```

super-gsd/tests/codex-contract-fixtures/missing-field.txt — missing CRITICAL line:
```
FINDINGS: 1
WARNINGS: 1
PASS_RATE: 9/10
ONE_LINER: Missing CRITICAL field should trigger parse_failure.
```

super-gsd/tests/codex-contract-fixtures/non-integer-findings.txt — FINDINGS is not an int:
```
FINDINGS: two
CRITICAL: 0
WARNINGS: 1
PASS_RATE: 9/10
ONE_LINER: Non-integer FINDINGS should fail regex guard.
```

super-gsd/tests/codex-contract-fixtures/wrong-pass-rate.txt — PASS_RATE wrong format:
```
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 100%
ONE_LINER: PASS_RATE as percentage not fraction should fail.
```

super-gsd/tests/codex-contract-fixtures/extra-trailing-lines.txt — junk after required fields
(valid — extra lines allowed; FINDINGS_DETAIL is additive, so this should PASS validate):
```
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 10/10
ONE_LINER: Clean report with trailing notes.
FINDINGS_DETAIL: [INFO] [style] Minor whitespace inconsistency on line 3
```

super-gsd/tests/codex-contract-fixtures/empty-report.txt — completely empty:
```
(empty file — 0 bytes)
```

super-gsd/tests/codex-contract-fixtures/substring-findings.txt — FINDINGS: appears mid-line (not startsWith):
```
Some preamble text FINDINGS: 3 embedded in sentence
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 8/10
ONE_LINER: FINDINGS not at line start should fail startsWith check.
```

**Create super-gsd/tests/run-parse-fuzz.sh:**
```bash
#!/usr/bin/env bash
# D-05 #9: parse-rigor fixture runner
# Usage: bash super-gsd/tests/run-parse-fuzz.sh
# Feeds each fixture through a JS validateContract excerpt and asserts result.

set -euo pipefail
FIXTURE_DIR="$(cd "$(dirname "$0")/codex-contract-fixtures" && pwd)"
PASS=0; FAIL=0

validate_contract() {
    local content="$1"
    node --input-type=module <<EOF
const content = ${content@Q} ?? '';
// D-05 #7 validateContract (mirrors SKILL.md implementation)
function validateContract(c) {
  if (typeof c !== 'string') return { valid: false, missing: ['(not a string)'] };
  const required = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:', 'PASS_RATE:', 'ONE_LINER:'];
  const lines = c.split('\n');
  const missing = required.filter(f => !lines.some(l => l.startsWith(f)));
  const getValue = (p) => { const l = lines.find(x => x.startsWith(p)); return l ? l.slice(p.length).trim() : null; };
  for (const f of ['FINDINGS:', 'CRITICAL:', 'WARNINGS:']) {
    const v = getValue(f); if (v !== null && !/^\d+$/.test(v)) missing.push(f + '(bad)');
  }
  const pr = getValue('PASS_RATE:'); if (pr !== null && !/^\d+\/\d+$/.test(pr)) missing.push('PASS_RATE:(bad)');
  return { valid: missing.length === 0, missing };
}
const r = validateContract(content);
console.log(JSON.stringify(r));
EOF
}

assert_invalid() {
    local fixture="$1"
    local content
    content="$(cat "$fixture" 2>/dev/null || true)"
    local result
    result="$(validate_contract "$content")"
    local valid
    valid="$(node -e "console.log(JSON.parse(process.argv[1]).valid)" -- "$result")"
    if [[ "$valid" == "false" ]]; then
        echo "PASS (parse_failure detected): $(basename "$fixture")"
        PASS=$((PASS+1))
    else
        echo "FAIL (expected parse_failure, got valid=true): $(basename "$fixture")"
        FAIL=$((FAIL+1))
    fi
}

assert_valid() {
    local fixture="$1"
    local content
    content="$(cat "$fixture" 2>/dev/null || true)"
    local result
    result="$(validate_contract "$content")"
    local valid
    valid="$(node -e "console.log(JSON.parse(process.argv[1]).valid)" -- "$result")"
    if [[ "$valid" == "true" ]]; then
        echo "PASS (valid contract accepted): $(basename "$fixture")"
        PASS=$((PASS+1))
    else
        echo "FAIL (expected valid, got invalid): $(basename "$fixture")"
        FAIL=$((FAIL+1))
    fi
}

assert_valid   "$FIXTURE_DIR/ok.txt"
assert_invalid "$FIXTURE_DIR/missing-field.txt"
assert_invalid "$FIXTURE_DIR/non-integer-findings.txt"
assert_invalid "$FIXTURE_DIR/wrong-pass-rate.txt"
assert_valid   "$FIXTURE_DIR/extra-trailing-lines.txt"  # FINDINGS_DETAIL is additive — should pass
assert_invalid "$FIXTURE_DIR/empty-report.txt"
assert_invalid "$FIXTURE_DIR/substring-findings.txt"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
```

Make run-parse-fuzz.sh executable: `chmod +x super-gsd/tests/run-parse-fuzz.sh`

Commit: `test(19-02/T5): D-05 #6+#9 exit-precedence flag + parse-rigor fixtures + fuzz runner`
  </action>
  <verify>
    <automated>bash super-gsd/tests/run-parse-fuzz.sh</automated>
  </verify>
  <done>
    `bash super-gsd/tests/run-parse-fuzz.sh` exits 0 with "7 passed, 0 failed" (2 valid + 5 invalid).
    super-gsd/tests/codex-contract-fixtures/ contains 7 files (ok + 6 malformed).
    codex-exec.sh has `--self-test-exit-priority` flag and exits 0 with probe-order table.
    `grep -q 'self-test-exit-priority' super-gsd/scripts/codex-exec.sh` passes.
    `grep -q 'parse_failure' super-gsd/tests/run-parse-fuzz.sh` passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| codex-exec.sh → narrative.md | Shell script appends operator-local narrative; no external input |
| codex-log.jsonl → sgsd-live-feed.ps1 | File written by codex-exec.sh; read by PS rendering loop |
| SKILL.md prompt injection | validateContract parses LLM output; regex guards prevent malformed values propagating |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-19-02-01 | Tampering | narrative.md write via sed -i | accept | Local operator file; no PII; sed replaces field on known prefix pattern only |
| T-19-02-02 | DoS | Infinite exec loop via --retry-on-timeout-escalate | mitigate | --no-retry-on-timeout-escalate flag on re-invocation prevents loop; exec replaces process (no fork bomb) |
| T-19-02-03 | Repudiation | validateContract rejects valid but unusual format | accept | Regex guards are additive to existing checks; only tightens FINDINGS/CRITICAL/WARNINGS to integers and PASS_RATE to N/M |
| T-19-02-04 | Info Disclosure | stderr_preview in narrative.md entries | accept | detail string passed to append_narrative_event is constructed from controlled variables (STEP_TAG, DURATION_MS), not raw stderr |
</threat_model>

<verification>
After all 5 tasks commit:

```bash
# T1: narrative event writer present
grep -c 'append_narrative_event' super-gsd/scripts/codex-exec.sh  # >= 7

# T2: codex-log.jsonl in live-feed
grep -q 'codex-log.jsonl' super-gsd/scripts/sgsd-live-feed.ps1 && echo PASS

# T3: tier fix at both SKILL.md sites, not adversarial
grep -n "timeoutTier" super-gsd/skills/sgsd-orchestrate/SKILL.md
# Expect: line 513 = 'analysis', line 945 = 'analysis', line 1082 = 'review'

# T4: FINDINGS_DETAIL and regex present
grep -q 'FINDINGS_DETAIL' super-gsd/skills/sgsd-orchestrate/SKILL.md && echo PASS
grep -q '\\\\d+' super-gsd/skills/sgsd-orchestrate/SKILL.md && echo PASS

# T5: fuzz runner
bash super-gsd/tests/run-parse-fuzz.sh  # must exit 0
```
</verification>

<success_criteria>
- MC-03: codex-exec.sh writes 4 event types to narrative.md; file initialized if missing; latest/lastfail fields updated
- MC-04: sgsd-live-feed.ps1 polls both sources without blocking; [cdx] prefix distinct; ts-dedup prevents double-render
- D-05 #3: phase-level-ATC uses 'analysis' tier at lines 513+945; adversarial still uses 'review' at line 1082
- D-05 #4: FINDINGS_DETAIL optional footer in both Step 6.5 and Step 9.5 prompt instructions
- D-05 #5: --retry-on-timeout-escalate flag in codex-exec.sh with loop-prevention guard; SKILL.md opt-in set
- D-05 #6: --self-test-exit-priority flag exits 0 with probe-order table
- D-05 #7: validateContract rejects non-integer FINDINGS/CRITICAL/WARNINGS and non-N/M PASS_RATE
- D-05 #9: 7 fixture files exist; run-parse-fuzz.sh passes all assertions (exit 0)
- 5 atomic commits, one per task
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/19-mc-visibility/19-02-SUMMARY.md`
with fields: FILES_CHANGED, VERIFICATION results, DEVIATIONS, ONE_LINER.
</output>
