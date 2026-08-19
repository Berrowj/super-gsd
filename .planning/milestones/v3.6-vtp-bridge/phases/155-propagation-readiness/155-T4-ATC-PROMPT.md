# P155-T4 per-dispatch ATC (GATE tier, final dispatch of the phase)

Read only. Spec passed 420/420 with execution-proven deployment; do not re-check
conformance. Quality of the diff only: `155-T4-DIFF.txt` (phase dir) against the
working tree. Files: decision-state.cjs (new adapter), gsd-session-state.sh (repo
hook), sgsd-orchestrate/SKILL.md (two sites), install.sh (deploy hunk),
assert-decision-state-consumers.cjs, plus the fix4 parser changes in resolve.cjs.

10-point anti-slop checklist, plus specifically:
- decision-state.cjs render paths: does the "resolver unavailable" fallback swallow
  the reason? Any path where a throw yields empty output instead of the loud one-liner?
- The hook's node invocation: quoting, absolute-vs-relative resolution when invoked
  from the global hooks dir versus repo, exit-code propagation.
- SKILL.md: do the replacement instructions stay consistent with the loop's token
  budget (the old step read 30 lines; the new one runs a CLI)?
- Any duplication between decision-state.cjs rendering and cockpit-state/adapter.cjs.

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>   (per CRITICAL/WARNING, omit if none)
```
