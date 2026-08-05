# Syntax-error fix — codex-exec.sh line 895 missing `if` token

The WARNING-2 finalize hardening restructured the live-state write block into an
if/else guard but DROPPED the `if` keyword before the opening brace group, so
bash reports "syntax error near unexpected token `then`" at line 921 and
codex-exec.sh does not parse (every invocation fails).

Current structure (lines 895-926):
    {                                              # line 895 — MISSING `if`
        printf '{\n'
        ...many printf lines...
        printf '}\n'
    } > "$LIVE_FILE.tmp" 2>/dev/null; then         # line 921 — orphaned `then`
        mv "$LIVE_FILE.tmp" "$LIVE_FILE" 2>/dev/null || true
    else
        rm -f "$LIVE_FILE.tmp" 2>/dev/null || true
    fi

REQUIRED FIX (single token): change line 895 from
    {
to
    if {
so the construct becomes a valid `if { ...; } > file; then mv; else rm; fi`.
This is the ONLY change. Do not alter any printf, the redirect, or the
mv/rm/else/fi logic.

After the fix, `bash -n super-gsd/scripts/codex-exec.sh` must exit 0 (parses
clean) and `bash super-gsd/scripts/codex-exec.sh --self-test --skip-network`
must print "Probe 6 finalize: PASS" and exit 0.

Output a single unified git diff touching ONLY super-gsd/scripts/codex-exec.sh.
