# P155-T4 warning cleanup — two 10-minute fixes, then done

Fresh context. Do NOT commit. Two ATC warnings, exact lines given:

1. `super-gsd/hooks/gsd-session-state.sh:25` discards the adapter's stderr, replacing
   its error detail with a generic "decision-state command failed". Keep the loud
   non-empty one-liner and non-blocking exit 0, but include the adapter's actual error
   code and first stderr line in it (never a raw STATE dump, never the env block).
2. `super-gsd/skills/sgsd-orchestrate/SKILL.md:122,169,1808,2585` still direct raw
   STATE.md frontmatter reads, contradicting the resolver-only guidance now at
   186/528. Align each of the four to the decision-state CLI (or, where the line is
   inside an illustrative legacy code block, mark it explicitly as superseded by the
   resolver step). Change nothing else in the file.

Verify: `node --check` on nothing needed; run
    node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer adapter
if the sandbox allows.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 80 words.
