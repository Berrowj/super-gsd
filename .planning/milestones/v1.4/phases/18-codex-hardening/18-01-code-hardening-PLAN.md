---
schema_version: 2
phase: 18
plan: "18-01"
wave: 1
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: []
goal: "Add codex-exec.sh --self-test + orchestrator runtime contract validator with parse_failure single-retry fallback"
tasks:
  - id: "T1"
    req: "CXOPS-01"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/codex-exec.sh"
    input_contract: |
      D-02 probe set: PATH (exit 10) / auth (exit 11) / timeout-math (exit 12) / known-good contract (exit 13).
      RESEARCH gap #1: --prompt-file/--report-out required guard fires at line 88-93 before any self-test branch.
      RESEARCH gap #2: OPENAI_API_KEY gate at line 96 fires before self-test harness; must be skipped when SELF_TEST=true.
      Existing arg parser at line 65: while/case pattern. New flags slot before the -* fallthrough at line 77.
      resolve_step_timeout already maps 'self-test' to TIER_DEFAULT (line 197). append_jsonl exists at line 296.
    output_contract: |
      bash -n codex-exec.sh exits 0.
      bash codex-exec.sh --self-test --skip-network exits 0 when codex on PATH + no OPENAI_API_KEY + timeout resolver returns 120.
      append_jsonl row written to codex-log.jsonl with step:"self-test" + self_test_probes:{path,auth,timeout,contract} fields.
    hypothesis: "Inserting SELF_TEST=false/SKIP_NETWORK=false defaults + moving required-flag guard + OPENAI_API_KEY gate behind SELF_TEST=true branch delivers a 4-probe harness that exits 10-13 per probe and exits 0 on all passing."
    falsifier: "bash codex-exec.sh --self-test --skip-network exits non-zero, OR bash -n codex-exec.sh fails syntax check."
    stop_rule: "If probe #3 (timeout-math) cannot call resolve_timeout_tier deterministically without a real Codex binary, call resolve_timeout_tier review directly and compare against $TIER_REVIEW (120 hardcoded fallback). Do NOT invoke codex binary for probe #3."
    verification_cmd: "bash -n super-gsd/scripts/codex-exec.sh && bash super-gsd/scripts/codex-exec.sh --self-test --skip-network"
    known_deadends:
      - "Do not gate --self-test behind --prompt-file existence check; --prompt-file is irrelevant in self-test mode."
      - "Do not call resolve_step_timeout for probe #3; call resolve_timeout_tier 'review' directly to stay off the step-number label mismatch (RESEARCH gap #3)."
  - id: "T2"
    req: "CXOPS-02"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
    input_contract: |
      D-03: hook lives in SKILL.md at Steps 6.5 (line ~521) and 9.5 (line ~937), NOT in codex-exec.sh.
      RESEARCH gap #4: dispatchResult.report is the content string (confirmed line 521/937: report = { content: dispatchResult.report, _provider: 'openai-codex' }).
      validateContract receives the content string directly — not a file path.
      Insertion point: AFTER dispatchResult.exit === 0 is confirmed, BEFORE report = { content: dispatchResult.report, ... }.
      On parse fail: log GATE_PROVIDER_FALLBACK with fallback_reason:"parse_failure", single-retry to claude-sonnet-reviewer, tag report._provider = 'claude-via-fallback'.
      commit-reviews.jsonl rows gain fallback_reason field only when fallback_triggered=true (D-06, additive).
      codex-log.jsonl (append_jsonl) is separate from commit-reviews.jsonl — do not conflate.
    output_contract: |
      grep -c 'validateContract' super-gsd/skills/sgsd-orchestrate/SKILL.md returns ≥2.
      validateContract function defined once above Step 6.5, called at both Step 6.5 (~line 521) and Step 9.5 (~line 937).
      On parse fail: GATE_PROVIDER_FALLBACK deviation logged + fallback_reason:"parse_failure" in commit-reviews.jsonl row.
    hypothesis: "A single validateContract(content) function checking presence of FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER and inserted at both shellDispatch exit-0 branches is sufficient to catch malformed Codex responses before they propagate."
    falsifier: "grep -c 'validateContract' SKILL.md returns <2, OR the fallback path on parse fail does not log fallback_reason:'parse_failure'."
    stop_rule: "If SKILL.md shellDispatch return shape is ambiguous, grep for dispatchResult.report vs dispatchResult.reportPath before writing the function signature. The confirmed shape (line 521/937) is dispatchResult.report = content string."
    verification_cmd: "grep -c 'validateContract' super-gsd/skills/sgsd-orchestrate/SKILL.md"
    known_deadends:
      - "Do not add validateContract inside codex-exec.sh — that is the secondary check at orchestrator layer per D-03."
      - "Do not change fallback_max_retries — single-retry only per D-03 deferred note."
---

<objective>
Harden codex-exec.sh with a 4-probe self-test harness and add a runtime contract validator to the SKILL.md orchestrator dispatch path.

Purpose: Probes let milestone pre-flight detect Codex problems before executors burn tokens. Contract validator catches malformed Codex responses that slip past codex-exec.sh's exit-6 guard.
Output: Modified codex-exec.sh (--self-test / --skip-network flags + probe harness) + modified SKILL.md (validateContract at Steps 6.5 and 9.5).
</objective>

<execution_context>
@C:/Users/user/GSDedits/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/Users/user/GSDedits/.planning/REQUIREMENTS.md
@C:/Users/user/GSDedits/.planning/milestones/v1.4/phases/18-codex-hardening/18-CONTEXT.md
@C:/Users/user/GSDedits/.planning/milestones/v1.4/phases/18-codex-hardening/18-RESEARCH.md

<interfaces>
<!-- Key contracts extracted from source. Executor uses these directly. -->

From super-gsd/scripts/codex-exec.sh (lines 39-48) — Defaults block:
```bash
PROMPT_FILE=""
REPORT_OUT=""
TIMEOUT_SECONDS=""
TIMEOUT_TIER=""
DRY_RUN=false
PROJECT=""
PHASE_TAG=""
PLAN_TAG=""
STEP_TAG=""
```

From codex-exec.sh (lines 65-80) — Arg parser pattern:
```bash
while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
        --dry-run)     DRY_RUN=true; shift ;;
        --timeout-tier) TIMEOUT_TIER="$2"; shift 2 ;;
        -*)            echo "codex-exec: unknown flag $1" >&2; exit 1 ;;
    esac
done
```

From codex-exec.sh (lines 88-99) — Guards to be conditioned on SELF_TEST:
```bash
# Required flags guard (line 88-93)
if [[ -z "$PROMPT_FILE" || -z "$REPORT_OUT" ]]; then
    echo "codex-exec: --prompt-file and --report-out are required" >&2; exit 1
fi
# OAuth hygiene gate (line 96-99)
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    echo "codex-exec: ERR — codex-exec is OAuth-only"; exit 4
fi
```

From codex-exec.sh (lines 183-206) — Tier resolvers:
```bash
resolve_timeout_tier() { local tier="$1"; case "$tier" in review) echo "$TIER_REVIEW" ;; ... esac }
resolve_step_timeout() { local step="$1"; case "$step" in smoke|self-test) echo "$TIER_DEFAULT" ;; per-dispatch-ATC|phase-level-ATC) echo "$TIER_REVIEW" ;; ... esac }
# TIER_REVIEW hardcoded fallback = 120
```

From super-gsd/skills/sgsd-orchestrate/SKILL.md — Step 6.5 shellDispatch exit-0 path (line ~520-521):
```javascript
} else {
  report = { content: dispatchResult.report, _provider: 'openai-codex' };
}
// Then: appendReviewEvidence(report, { gate: 'phase-level-ATC', provider: ..., fallback_triggered: false })
```

From SKILL.md — Step 9.5 shellDispatch exit-0 path (line ~936-937): identical shape.

From SKILL.md — existing fallback path (exit !== 0):
```javascript
if (dispatchResult.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
  logDeviation(`GATE_PROVIDER_FALLBACK: ${effective.name} exit=${dispatchResult.exit} → ${effective.fallback_to}`);
  report = await Agent({ subagent_type: fallbackProvider.agent_subagent_type, ... });
  report._provider = 'claude-via-fallback';
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>T1: CXOPS-01 — Add --self-test and --skip-network flags with 4-probe harness to codex-exec.sh</name>
  <files>super-gsd/scripts/codex-exec.sh</files>
  <action>
1. In the Defaults block (near line 39), add two new vars: `SELF_TEST=false` and `SKIP_NETWORK=false`. Maintain `set -u` compliance — both must be initialised before the arg parser runs.

2. In the arg-parser case block, add two branches BEFORE the `-*)` fallthrough:
   ```bash
   --self-test)    SELF_TEST=true;    shift ;;
   --skip-network) SKIP_NETWORK=true; shift ;;
   ```

3. Wrap the required-flag guard (lines 88-93) and the OPENAI_API_KEY gate (lines 96-99) in `if [[ "$SELF_TEST" == false ]]; then ... fi` so both are skipped when running in self-test mode.

4. After the OPENAI_API_KEY gate block, insert the self-test harness:
   ```bash
   if [[ "$SELF_TEST" == true ]]; then
     ST_PATH=false ST_AUTH=false ST_TIMEOUT=false ST_CONTRACT=false
     EXIT_CODE=0

     # Probe 1 — codex on PATH (exit 10)
     if command -v codex >/dev/null 2>&1; then ST_PATH=true; else EXIT_CODE=10; fi

     # Probe 2 — auth: OAuth token readable, OPENAI_API_KEY NOT set (exit 11)
     if [[ "$ST_PATH" == true ]]; then
       if [[ -n "${OPENAI_API_KEY:-}" ]]; then
         EXIT_CODE=11
       else
         CODEX_CFG="${CODEX_HOME:-$HOME/.codex}/config.json"
         if [[ -f "$CODEX_CFG" ]]; then ST_AUTH=true; else EXIT_CODE=11; fi
       fi
     fi

     # Probe 3 — timeout math: resolve_timeout_tier review == TIER_REVIEW (exit 12)
     if [[ "$SELF_TEST" == true ]]; then
       tier_check="$(resolve_timeout_tier review)"
       if [[ "$tier_check" == "$TIER_REVIEW" && -n "$tier_check" ]]; then
         ST_TIMEOUT=true
       else
         EXIT_CODE=12
       fi
     fi

     # Probe 4 — known-good contract: real Codex call (skip when --skip-network) (exit 13)
     if [[ "$SKIP_NETWORK" == false && "$ST_PATH" == true && "$ST_AUTH" == true ]]; then
       ST_PROMPT_TMP="$(mktemp -t codex-self-test.XXXXXX)"
       ST_REPORT_TMP="$(mktemp -t codex-self-test-report.XXXXXX)"
       printf 'Output exactly:\nFINDINGS: 0\nCRITICAL: 0\nWARNINGS: 0\nPASS_RATE: 0/0\nONE_LINER: self-test\n' > "$ST_PROMPT_TMP"
       set +e
       timeout 60s bash -c 'cat "$0" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -' \
         "$ST_PROMPT_TMP" "$PROJECT" > "$ST_REPORT_TMP" 2>/dev/null
       ST_RC=$?
       set -e
       if [[ $ST_RC -eq 0 ]]; then
         # Check 5-line contract
         if grep -q "^FINDINGS:" "$ST_REPORT_TMP" && grep -q "^CRITICAL:" "$ST_REPORT_TMP" && \
            grep -q "^WARNINGS:" "$ST_REPORT_TMP" && grep -q "^PASS_RATE:" "$ST_REPORT_TMP" && \
            grep -q "^ONE_LINER:" "$ST_REPORT_TMP"; then
           ST_CONTRACT=true
         else
           EXIT_CODE=13
         fi
       else
         EXIT_CODE=13
       fi
       rm -f "$ST_PROMPT_TMP" "$ST_REPORT_TMP"
     elif [[ "$SKIP_NETWORK" == true ]]; then
       ST_CONTRACT=true  # skipped — treated as pass for offline mode
     fi

     # Structured stdout
     echo "=== codex-exec --self-test ==="
     printf "Probe 1 PATH:     %s\n" "$([ "$ST_PATH"     == true ] && echo PASS || echo FAIL)"
     printf "Probe 2 auth:     %s\n" "$([ "$ST_AUTH"     == true ] && echo PASS || echo FAIL)"
     printf "Probe 3 timeout:  %s (tier_review=%s)\n" "$([ "$ST_TIMEOUT"  == true ] && echo PASS || echo FAIL)" "$TIER_REVIEW"
     printf "Probe 4 contract: %s%s\n" "$([ "$ST_CONTRACT" == true ] && echo PASS || echo FAIL)" "$([ "$SKIP_NETWORK" == true ] && echo ' (skipped)' || echo '')"
     echo "Exit: $EXIT_CODE"

     # Append JSONL row to codex-log.jsonl
     if [[ -n "$ROOT" ]]; then
       METRICS_LOG="$ROOT/.planning/metrics/codex-log.jsonl"
       TS_ST="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
       mkdir -p "$(dirname "$METRICS_LOG")"
       printf '{"ts":"%s","step":"self-test","exit":%d,"skip_network":%s,"self_test_probes":{"path":%s,"auth":%s,"timeout":%s,"contract":%s}}\n' \
         "$TS_ST" "$EXIT_CODE" \
         "$([ "$SKIP_NETWORK" == true ] && echo true || echo false)" \
         "$([ "$ST_PATH"     == true ] && echo true || echo false)" \
         "$([ "$ST_AUTH"     == true ] && echo true || echo false)" \
         "$([ "$ST_TIMEOUT"  == true ] && echo true || echo false)" \
         "$([ "$ST_CONTRACT" == true ] && echo true || echo false)" \
         >> "$METRICS_LOG"
     fi
     exit $EXIT_CODE
   fi
   ```

Per D-05: JSONL row uses `step: "self-test"` + `self_test_probes` object. Per D-02 (RESEARCH gap #1 + #2): SELF_TEST=true check runs before required-flag guard and before OPENAI_API_KEY gate. Per RESEARCH gap #3: probe #3 uses `resolve_timeout_tier review` (canonical tier name), NOT a step-number label.
  </action>
  <verify>
    <automated>bash -n super-gsd/scripts/codex-exec.sh && bash super-gsd/scripts/codex-exec.sh --self-test --skip-network</automated>
  </verify>
  <done>bash -n exits 0 (syntax clean). --self-test --skip-network exits 0 with probes 1-3 PASS and probe 4 SKIPPED. JSONL row with step:"self-test" appended to codex-log.jsonl.</done>
</task>

<task type="auto">
  <name>T2: CXOPS-02 — validateContract hook at Steps 6.5 + 9.5 in SKILL.md with parse_failure fallback telemetry</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
1. Define a single `validateContract(content)` function ONCE, inserted above the Step 6.5 shellDispatch block. The function checks that the content string contains all 5 required field prefixes on their own lines:
   ```javascript
   function validateContract(content) {
     if (typeof content !== 'string') return false;
     const required = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:', 'PASS_RATE:', 'ONE_LINER:'];
     return required.every(field => content.split('\n').some(line => line.startsWith(field)));
   }
   ```

2. At Step 6.5 (line ~520), in the `else` branch after `dispatchResult.exit === 0` is confirmed, insert before `report = { content: dispatchResult.report, _provider: 'openai-codex' }`:
   ```javascript
   if (!validateContract(dispatchResult.report)) {
     logDeviation(`GATE_PROVIDER_FALLBACK: openai-codex exit=0 but contract invalid → ${effective.fallback_to} (parse_failure)`);
     const fallbackProvider = gates.getProvider(effective.fallback_to);
     report = await Agent({
       subagent_type: fallbackProvider.agent_subagent_type,
       prompt: composedPrompt
     });
     report._provider = 'claude-via-fallback';
     report._fallback_reason = 'parse_failure';
   } else {
     report = { content: dispatchResult.report, _provider: 'openai-codex' };
   }
   ```

3. Mirror the identical insertion at Step 9.5 (line ~936).

4. In the `appendReviewEvidence` call at both steps, thread `fallback_reason` from `report._fallback_reason` into the row:
   ```javascript
   appendReviewEvidence(report, {
     gate: 'phase-level-ATC',       // or 'per-dispatch-ATC' at 9.5
     provider: report._provider || effective.name,
     fallback_triggered: !!(report._provider === 'claude-via-fallback'),
     ...(report._fallback_reason ? { fallback_reason: report._fallback_reason } : {})
   });
   ```

This delivers D-03 (hook at SKILL.md, not codex-exec.sh), D-06 (fallback_reason field additive, existing rows unchanged), RESEARCH gap #4 (uses dispatchResult.report content string, not a path).
  </action>
  <verify>
    <automated>grep -c 'validateContract' super-gsd/skills/sgsd-orchestrate/SKILL.md</automated>
  </verify>
  <done>grep -c 'validateContract' returns ≥2 (definition + 2 call sites = 3 minimum). Both Steps 6.5 and 9.5 shellDispatch exit-0 branches have validateContract inserted before report assignment. fallback_reason:'parse_failure' would appear in commit-reviews.jsonl row when parse fails.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| codex-exec.sh → Codex CLI stdout | Codex response is untrusted external output; contract parser treats it as opaque string |
| SKILL.md validateContract → dispatchResult.report | Report content from shell subprocess; must not be eval'd or executed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-18-01 | Tampering | codex-exec.sh self-test JSONL row | mitigate | Use printf with positional args; json_escape function already in scope for string fields |
| T-18-02 | Information Disclosure | Probe #2 auth check reads ~/.codex/config.json path | accept | File existence check only — no content read; OAuth token not logged |
| T-18-03 | Denial of Service | --self-test --skip-network called repeatedly by readiness loop | accept | Each call exits in <5s (no Codex call); JSONL append is atomic printf |
| T-18-04 | Spoofing | Malformed dispatchResult.report passes validateContract | mitigate | validateContract checks all 5 required field prefixes on dedicated lines |
</threat_model>

<verification>
1. `bash -n super-gsd/scripts/codex-exec.sh` — syntax clean
2. `bash super-gsd/scripts/codex-exec.sh --self-test --skip-network` — exits 0, probes 1-3 PASS, probe 4 SKIPPED
3. `grep -c 'validateContract' super-gsd/skills/sgsd-orchestrate/SKILL.md` — returns ≥2
4. `grep 'fallback_reason' super-gsd/skills/sgsd-orchestrate/SKILL.md` — returns the parse_failure fallback_reason line
</verification>

<success_criteria>
- codex-exec.sh accepts --self-test and --skip-network flags without syntax error
- --self-test --skip-network exits 0 when codex on PATH, no OPENAI_API_KEY set, TIER_REVIEW=120
- Self-test appends a JSONL row with step:"self-test" + self_test_probes object to codex-log.jsonl
- validateContract defined once in SKILL.md, called at Steps 6.5 and 9.5 shellDispatch exit-0 branches
- Parse failure triggers GATE_PROVIDER_FALLBACK deviation + fallback_reason:"parse_failure" in commit-reviews.jsonl row
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/18-codex-hardening/18-01-SUMMARY.md` per the standard summary template.
</output>
