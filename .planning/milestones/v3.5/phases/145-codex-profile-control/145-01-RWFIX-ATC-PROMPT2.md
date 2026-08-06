# Step 9.5 Per-Dispatch ATC — P145 RWFIX diff (RETRY — budget discipline)

HARD CONSTRAINTS: Review ONLY the diff below (63 added lines). Do NOT open,
grep, or explore any other file. Do NOT run any command. Emit the 5 contract
lines FIRST, then FINDINGS_DETAIL lines, then stop. Partial confidence is
acceptable; note it in ONE_LINER.

ATC focus on the diff: correctness of report_bytes_positive regex; whether
`handle_report_write_failure || true` at non-success call sites can hide a
failure that matters; exit 9 collision risk (existing wrapper codes:
1/3/4/5/6/8/14/16); determinism of Probe 7 (parent-is-a-file + fake codex).

## Raw diff (uncommitted)
diff --git a/super-gsd/scripts/codex-exec.sh b/super-gsd/scripts/codex-exec.sh
index f6613b9..9305168 100755
--- a/super-gsd/scripts/codex-exec.sh
+++ b/super-gsd/scripts/codex-exec.sh
@@ -33,6 +33,7 @@
 #   4 — auth-denied: $OPENAI_API_KEY set OR codex stderr matched /auth|401|unauthori[sz]ed/i
 #   5 — timeout (GNU timeout returned 124)
 #   6 — report contract violation (one or more of the 5 required fields missing)
+#   9 — report write failure (host-side persistence failure after valid output)
 #
 # See super-gsd/scripts/codex-exec.README.md for the full reference.
 # ============================================================================
@@ -451,6 +452,7 @@ if [[ "$SELF_TEST" == true ]]; then
 
     ST_PROFILE=false
     ST_FINALIZE=false
+    ST_REPORT_WRITE=false
     if [[ "$SKIP_NETWORK" == true && "$EXIT_CODE" -eq 0 ]]; then
         ST_TMP_ROOT="$(mktemp -d)"
         ST_PROJECT="$ST_TMP_ROOT/project"
@@ -553,6 +555,22 @@ EOS
             [[ "$rc" -eq 6 ]] && grep -q 'report contract violation' "$case_dir/stderr.txt"
         }
 
+        sgsd_codex_exec_self_test_report_write_failure_case() {
+            local case_dir case_project case_prompt report_parent case_report rc
+            case_dir="$ST_TMP_ROOT/case-report-write-failure"
+            case_project="$case_dir/project"
+            case_prompt="$case_dir/prompt.txt"
+            report_parent="$case_dir/report-parent-is-file"
+            case_report="$report_parent/report.txt"
+            mkdir -p "$case_project/.planning/metrics"
+            printf 'prompt for report write failure\n' > "$case_prompt"
+            printf 'not a directory\n' > "$report_parent"
+            set +e
+            PATH="$ST_BIN:$PATH" SGSD_CODEX_FORCE_LAUNCHER=direct SGSD_FAKE_CODEX_MODE="success" "$0" --prompt-file "$case_prompt" --report-out "$case_report" --project "$case_project" --timeout 5 --phase 145 --plan 145-01 --step "self-test-report-write-failure" > "$case_dir/stdout.txt" 2> "$case_dir/stderr.txt"
+            rc=$?
+            set -e
+            [[ "$rc" -eq 9 ]] && ! grep -q '^codex-exec: OK' "$case_dir/stdout.txt" && grep -q 'report write failure' "$case_dir/stderr.txt"
+        }
         if sgsd_codex_exec_self_test_case success 0 5 && \
            sgsd_codex_exec_self_test_case contract 6 5 && \
            sgsd_codex_exec_self_test_case generic 1 5 && \
@@ -563,6 +581,11 @@ EOS
         else
             EXIT_CODE=15
         fi
+        if sgsd_codex_exec_self_test_report_write_failure_case; then
+            ST_REPORT_WRITE=true
+        elif [[ "$EXIT_CODE" -eq 0 ]]; then
+            EXIT_CODE=16
+        fi
         rm -rf "$ST_TMP_ROOT"
     fi
     # Structured stdout
@@ -577,6 +600,7 @@ EOS
         "$([ "$SKIP_NETWORK" = true ] && echo ' (skipped)' || echo '')"
     printf "Probe 5 profiles: %s\n" "$([ "$ST_PROFILE" = true ] && echo PASS || echo FAIL)"
     printf "Probe 6 finalize: %s\n" "$([ "$ST_FINALIZE" = true ] && echo PASS || echo FAIL)"
+    printf "Probe 7 report write: %s\n" "$([ "$ST_REPORT_WRITE" = true ] && echo PASS || echo FAIL)"
     echo "Exit: $EXIT_CODE"
 
     # Append JSONL row to codex-log.jsonl (D-05) with probe metadata for triage.
@@ -855,6 +879,33 @@ write_raw_report_payload() {
         printf '0'
     fi
 }
+
+REPORT_WRITE_FAILURE_EXIT=9
+
+report_bytes_positive() {
+    [[ "${1:-}" =~ ^[1-9][0-9]*$ ]]
+}
+
+report_bytes_for_json() {
+    if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
+        printf '%s' "$1"
+    else
+        printf '0'
+    fi
+}
+
+note_report_write_failure() {
+    echo "codex-exec: report write failure — could not write $REPORT_OUT" >&2
+}
+
+handle_report_write_failure() {
+    if report_bytes_positive "$REPORT_BYTES"; then
+        return 0
+    fi
+    REPORT_BYTES="$(report_bytes_for_json "$REPORT_BYTES")"
+    note_report_write_failure
+    return 1
+}
 NARRATIVE_FILE="$PROJECT/.planning/metrics/narrative.md"
 
 append_narrative_event() {
@@ -938,6 +989,7 @@ if [[ $RC -eq 124 ]]; then
         # exec replaces process; reached only if exec itself fails
     fi
     REPORT_BYTES="$(write_raw_report_payload "codex-exec: timeout after ${TIMEOUT}s")"
+    handle_report_write_failure || true
     write_live_state "timeout" 5 "true" "$REPORT_BYTES"
     append_jsonl 5 "true" "$REPORT_BYTES"
     append_narrative_event "codex_timeout" "timeout after ${TIMEOUT}s step=$STEP_TAG" "lastfail"
@@ -967,6 +1019,7 @@ if [[ $RC -ne 0 ]]; then
     # Check for auth-denial patterns in stderr first
     if grep -qiE '(auth|401|unauthori[sz]ed)' "$STDERR_TMP" 2>/dev/null; then
         REPORT_BYTES="$(write_raw_report_payload "codex-exec: auth-denied")"
+        handle_report_write_failure || true
         write_live_state "auth-denied" 4 "false" "$REPORT_BYTES"
         append_jsonl 4 "false" "$REPORT_BYTES"
         append_narrative_event "codex_fallback" "auth-denied step=$STEP_TAG" "lastfail"
@@ -977,6 +1030,7 @@ if [[ $RC -ne 0 ]]; then
         exit 4
     fi
     REPORT_BYTES="$(write_raw_report_payload "codex-exec: codex exit=$RC (generic failure)")"
+    handle_report_write_failure || true
     write_live_state "error" 1 "false" "$REPORT_BYTES"
     append_jsonl 1 "false" "$REPORT_BYTES"
     append_narrative_event "codex_fallback" "error exit=$RC step=$STEP_TAG" "lastfail"
@@ -1029,6 +1083,7 @@ if [[ "$CONTRACT" == "rd-memo-v1" ]]; then
             ' "$schema_lib" 2>/dev/null || true)"
             if [[ -n "$validation_errors" ]]; then
                 REPORT_BYTES="$(write_raw_report_payload "codex-exec: report contract violation")"
+                handle_report_write_failure || true
                 write_live_state "contract-violation" 6 "false" "$REPORT_BYTES"
                 append_jsonl 6 "false" "$REPORT_BYTES"
                 append_narrative_event "codex_fallback" "rd_memo_schema_fail step=$STEP_TAG" "lastfail"
@@ -1081,6 +1136,7 @@ fi
 set +e
 if [[ $awk_rc -ne 0 || -z "$parsed" ]]; then
     REPORT_BYTES="$(write_raw_report_payload "codex-exec: report contract violation")"
+    handle_report_write_failure || true
     write_live_state "contract-violation" 6 "false" "$REPORT_BYTES"
     append_jsonl 6 "false" "$REPORT_BYTES"
     append_narrative_event "codex_fallback" "parse_failure step=$STEP_TAG" "lastfail"
@@ -1095,6 +1151,13 @@ if [[ $awk_rc -ne 0 || -z "$parsed" ]]; then
 fi
 
 REPORT_BYTES="$(write_report_payload "$parsed")"
+if ! handle_report_write_failure; then
+    write_live_state "report-write-failure" "$REPORT_WRITE_FAILURE_EXIT" "false" "$REPORT_BYTES"
+    append_jsonl "$REPORT_WRITE_FAILURE_EXIT" "false" "$REPORT_BYTES"
+    append_narrative_event "codex_fallback" "report_write_failure step=$STEP_TAG" "lastfail"
+    # Host-side persistence failure; provider returned valid output, so do not update provider circuit.
+    exit "$REPORT_WRITE_FAILURE_EXIT"
+fi
 
 # ── JSONL append on success ─────────────────────────────────────────────────
 write_live_state "ok" 0 "false" "$REPORT_BYTES"

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
