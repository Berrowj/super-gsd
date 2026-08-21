# P161-T1 — install.sh copies every shipped hook type (edits-first)

You are the implementer for ONE task. Fresh context. The sandbox denies nested
spawns — do NOT run suites, do NOT stop on spawnSync EPERM; write the edits,
verify with node --check / bash -n / static assertions, report. Do NOT commit.

Task P161-T1 in `161-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract.
Files ONLY: super-gsd/install.sh and
super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs.

The defect (handover section 13, verified on devcp): install.sh's hook copy
glob excludes .cjs — a real deploy lands 23 files with ZERO .cjs;
sgsd-intent-classifier.cjs and sgsd-commit-gate.cjs never arrive. Fix the copy
loops (global AND repo-local) to ship every hook file type present in
super-gsd/hooks/ and the codex-hooks the overlays register.

Test: add the hook-distribution-all-types case per the plan — isolated-HOME
deploy must land ALL shipped hooks including every .cjs; encode the red as a
fixture (a copy loop filtered to the old glob must fail the case). All eight
existing P160 cases must remain untouched and green.

Report: FILES_CHANGED / VERIFICATION (static, name checks) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 150 words.
