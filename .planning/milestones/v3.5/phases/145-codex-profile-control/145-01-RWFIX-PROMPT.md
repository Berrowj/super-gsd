# P145 phase-ATC CRIT fix — codex-exec.sh must not exit 0 on report-write failure

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer contract: fresh context, this task only, verify before report,
self-review, explicit DONE/DONE_WITH_CONCERNS/BLOCKED status.

## Defect (phase-level ATC CRITICAL, confirmed at source)
`super-gsd/scripts/codex-exec.sh`:
- `write_report_payload()` (~line 831) swallows write failures: on failed
  printf/mv it prints `0` and the caller continues.
- Success path (~line 1097): `REPORT_BYTES="$(write_report_payload "$parsed")"`
  then unconditionally `write_live_state "ok" 0`, `append_jsonl 0`,
  `codex_completed` narrative, `echo OK — written (0B)`, exit 0.
Contract violated: exit 0 must mean the report file was written. A consumer
(orchestrator) can read a stale/absent report while the wrapper claims OK.

## Fix (surgical)
1. After `REPORT_BYTES="$(write_report_payload "$parsed")"` on the success
   path: if `REPORT_BYTES` is not a positive integer, treat as report-write
   failure — stderr message `codex-exec: report write failure — could not
   write $REPORT_OUT`, `write_live_state`/`append_jsonl` with a dedicated
   nonzero exit code (pick the next unused wrapper exit code consistent with
   the script's existing vocabulary: 3/4/5/6/8/14 are taken), an
   `append_narrative_event` failure row, `provider_circuit_record_result`
   consistent with how exit 6 handles provider-side failure (report-write is
   HOST-side, so decide: do NOT count it against the provider circuit —
   justify in a one-line comment), and exit with that code.
2. Audit the OTHER call sites of write_report_payload / write_raw_report_payload
   (timeout path, fallback path, rd-memo path if any): apply the same
   0-bytes-means-fail handling so no path reports success or a "written"
   message with 0 bytes. Keep failure-path exit codes unchanged (a timeout
   must still exit 5, etc.) — only the "written (NB)" claim and JSONL
   report_bytes must be truthful.
3. Add one self-test probe (in the script's --self-test block, cheap and
   in-process, following existing probe style): point REPORT_OUT at an
   unwritable location (e.g. a path whose parent is a FILE, which fails
   mkdir -p deterministically on all filesystems — do NOT rely on chmod a-w,
   see Probe 6's SKIPPED precedent) with --dry-run … if dry-run bypasses
   report writing, use the cheapest non-network invocation that reaches
   write_report_payload; if none exists, test the function directly by
   sourcing or a bash -c harness. Assert nonzero exit + no "OK" line.
4. Do NOT restructure anything else. `bash -n` must pass.

## Verify (all must pass)
- bash -n super-gsd/scripts/codex-exec.sh → exit 0
- bash super-gsd/scripts/codex-exec.sh --self-test --skip-network → exit 0,
  all probes PASS including the new one
- bash super-gsd/scripts/codex-executor.sh --self-test → parity PASS
  (executor sources/invokes codex-exec)

SURGICAL CONSTRAINT — every changed line must trace to this fix. Orphan edits
are DEVIATIONS; report, don't commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
