# P155-T4b spec-compliance review (GATE tier)

Read only. Did the executor implement task P155-T4b exactly? Raw evidence:
the task block in `155-01-PLAN-LOCKED.md`; the diff (`155-T4b-DIFF.txt` in the phase
dir, spot-checked against the working tree); executor report `155-T4b-REPORT.md`;
orchestrator evidence: assert-state-resolver --case all 68/0 unsandboxed including
real-git cases, resolver matrix 142/0, full all-tool matrix 0 fail, install-layout,
audit self-test and p153 regression all exit 0.

Falsifier clauses to verify against the diff:
- any tier truncating or coercing v-scheme tokens; pulse/git misresolution
- an invalid or ambiguous marker becoming evidence instead of abstaining
- "next phase" arithmetic surviving anywhere (`num + 1`, pad2 probes)
- the devcp fixture permitting a highest-legacy-integer win or a backwards re-sync
- private parser logic reappearing outside phase-name.cjs
- any registry, alias data, rename, or STATE.md write
- evidence-tier priorities, confidence values, projection_stale or conflicts semantics
  CHANGED beyond scheme recognition (they were required to be preserved)

Also check the executor stayed off T4's turf: no consumer wiring, no install.sh, no
hook changes in this diff.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
TIER_SEMANTICS_PRESERVED: yes|no — <evidence>
```
