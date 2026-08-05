# Portability fix — codex-exec.sh Probe 6 write-failure sub-case

CONTEXT: codex-exec.sh --self-test Probe 6 "finalize" (lines ~509-564) proves
the WARNING-2 finalize hardening: for each fake-codex scenario it asserts
(exit code, report written, exactly one codex-log.jsonl row). The 5 exit-code
scenarios (success/contract/generic/auth/timeout, lines 558-562) are correct
and fast and MUST be preserved unchanged.

PROBLEM: the write-failure sub-case `sgsd_codex_exec_self_test_write_failure_case`
(lines 533-556) uses `chmod a-w "$report_dir"` to force a report-write failure,
then expects exit 6 + 'report contract violation'. On Windows Git-Bash chmod
does NOT reliably make a directory unwritable, so the `if [[ -w "$report_dir" ]]`
fallback fires, writes a "not a directory" parent FILE, and the resulting
codex-exec invocation behaves unpredictably (slow / wrong exit) → Probe 6 FAIL
on this host, though the finalize CODE is correct.

REQUIRED FIX (portability, minimal): in
`sgsd_codex_exec_self_test_write_failure_case`, after the chmod, probe whether
read-only enforcement actually took effect. If the directory is STILL writable
after `chmod a-w` (i.e. `[[ -w "$report_dir" ]]` is true → non-POSIX-perm
filesystem like Windows), SKIP this sub-case as inconclusive: return 0 (treat
as pass) and echo a single line to stderr like
"Probe 6 write-failure: SKIPPED (filesystem does not enforce chmod a-w)".
Do NOT take the fragile file-as-parent fallback path at all — delete that
fallback branch (lines ~543-549). On a real POSIX FS where chmod works, keep
the existing assertion (exit 6 + 'report contract violation').

Do NOT change the 5 exit-code scenarios, the fake codex, or any non-test code.
After the fix `bash super-gsd/scripts/codex-exec.sh --self-test --skip-network`
must print "Probe 6 finalize: PASS" and exit 0 within ~30s on this host.

Output a single unified git diff touching ONLY super-gsd/scripts/codex-exec.sh.
