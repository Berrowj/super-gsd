# P148 T148-03 fix — test isolation broken: "codex missing" dispatches REAL codex

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/codex-exec.sh` (ONE minimal override — see below),
`super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`,
`super-gsd/scripts/sgsd-triage-runtime.cjs` (only if a pass-through is
genuinely required). Nothing else.

## Diagnosis (orchestrator-confirmed on host)
`codex-missing-single-model` and `runtime-dispatch-reconciliation` FAIL on the
host because the fixtures' PATH-stripping does not survive the Windows
node→bash boundary: Git Bash's profile re-derives PATH, so the wrapper's
`command -v codex` (codex-exec.sh:679) finds the REAL binary. A live probe
returned `singleModel:false` with a genuine LLM-authored rationale — i.e. the
"missing codex" test BURNED A REAL gpt-5.5/xhigh DISPATCH. In the executor
sandbox, spawn-EPERM masqueraded as "missing" (runtime line 565 maps EPERM →
codex_missing), which is why the scenarios passed there. Two defects:
(1) fixtures are not isolated from the real binary on hosts;
(2) every host test run of these scenarios costs a real dispatch.

## Fix — explicit command override, not PATH surgery
1. codex-exec.sh: honor `SGSD_CODEX_COMMAND` FIRST:
   change `CODEX_COMMAND="codex"` (line ~208) to
   `CODEX_COMMAND="${SGSD_CODEX_COMMAND:-codex}"` with a one-line comment
   (test-isolation override; production never sets it). When the override is
   set, SKIP the WSL cmd.exe fallback rewrite (the override is authoritative).
   Touch NOTHING else in the wrapper. Probes 1-7 must keep passing; the
   override unset must be byte-equivalent behavior.
2. Fixtures: replace PATH-stripping with the override:
   - valid/nonzero/malformed modes → SGSD_CODEX_COMMAND=<abs path to the fake
     codex script> (keep the fake-bin mechanism, just point at it explicitly);
   - missing mode → SGSD_CODEX_COMMAND=<contained path that does not exist>
     → `command -v` fails → wrapper's existing not-on-PATH handling → runtime
     maps to codex_missing. Assert the reason code is codex_missing (not
     EPERM-derived).
   Keep the stripped-HOME isolation (real ~/.codex auth must stay unreachable
   in ALL modes — add an assertion that no fixture row/verdict content could
   have come from real codex: e.g. fake verdict carries a fixture-unique
   marker string and the valid-mode assertion requires it).
3. If the runtime needs to forward SGSD_CODEX_COMMAND into the spawn env,
   add ONLY that pass-through.

## Verify (report exact exit codes)
1. bash -n codex-exec.sh; node --check both cjs files.
2. FULL 16-scenario triage suite (sandbox EPERM caveat → say so).
3. codex-exec.sh --self-test --skip-network Probes 1-7.
4. NEW assertion proving valid-mode verdicts carry the fixture marker (no
   real-codex leakage possible).
SURGICAL CONSTRAINT. <250-word report.
