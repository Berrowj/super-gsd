# P161-T3H — walk the WHOLE recovery case statically; fix every seam in one pass

Files: super-gsd/scripts/lib/hook-registration-preflight.cjs, install.sh if
threading requires, guard test ONLY for genuine fixture bugs (never weaken
assertions). Edits-first; no spawns; do NOT commit.

## Why this dispatch is different

Six prior rounds each fixed the fragment named and surfaced the next seam:
launch_invalid on args-form global rows (fixed) -> repaired-phase smoke ran
dead-but-covered rows (fixed) -> NOW: statusLine validated as a hook launch:
FAIL: HookRegistrationPreflightError: hook_registration_launch_invalid
<unresolved> [statusLine/status-line] (expected node|bash followed by exactly
one script path)
statusLine is a NATIVE surface (your own T2 manifest says so) — it must never
enter hook-launch validation; "<unresolved>" says its shape isn't even parsed.

## Required method (the actual task)

READ the ENTIRE sgsd-update-clarity-recovery case in the guard test, top to
bottom. For EVERY phase (seed, broken update, uncovered-rows refusal, upstream
advance, repaired update, post-assertions incl. dead-row survival, pin
advance, SKILL.md ordering), reconstruct the preflight/enumerator inputs
STATICALLY in-process and prove each passes with the current lib. Fix every
divergence you find in ONE pass — statusLine (and any other native-surface
entries) excluded from event-hook enumeration everywhere; smoke set correct;
warn/refuse semantics per contract. Then run the same static walk again clean.
List in the report each seam found and fixed, in order.

Report: FILES_CHANGED / VERIFICATION (the full static walk, phase by phase) /
DEVIATIONS / BLOCKERS / ONE_LINER, max 200 words.
