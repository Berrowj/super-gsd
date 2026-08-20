# P156-T1 fix round (sole round) — two spec-review findings

You are the implementer. Fresh context. Node works; no `claude` spawning. Do NOT
commit. Scope is EXACTLY these two fixes in the two named files; nothing else.

Contract: task P156-T1 in `156-01-PLAN-LOCKED.md` (same dir as this prompt),
spec review verdict in `156-T1-SPECREVIEW-REPORT.md` context below.

## Fix 1 — unreachable ambiguity refusal (write.cjs)
The shared parser (scripts/lib/phase-name.cjs) deduplicates identities before
`roadmapIndex` is built (write.cjs around line 324), so the duplicate-ROADMAP-identity
ambiguity branch can never fire. Detect duplicate ROADMAP identities BEFORE
deduplication collapses them — without copying the parser (e.g. compare raw
row-token count against deduped identity count, or track parser-reported duplicates).
Refusal stays fail-closed exit 1 with a stable reason. Add an ambiguity-refusal
fixture to assert-state-write.cjs (a ROADMAP listing the same phase identity twice
must refuse, byte-identical STATE).

## Fix 2 — installer-test false pass (assert-state-write.cjs ~line 282)
The orchestrator-hook-wire case has an EPERM manual-copy fallback: when spawn of
install.sh is denied, the TEST copies the hook itself and then asserts it exists —
a self-fulfilling pass. Remove the fallback entirely: SAC-3 passes ONLY when the real
install.sh run deployed the hook into the isolated HOME. If install.sh cannot execute
in this sandbox, the case must FAIL loudly naming the spawn error — never self-copy.

## Verify before reporting (both must pass)

    node super-gsd/tests/state-close-contract/assert-state-write.cjs --case all
    node super-gsd/tools/state-resolver/resolve.cjs --self-test

Include in the report the new ambiguity fixture failing against a write.cjs with
Fix 1 reverted (red proof), if feasible within sandbox limits; otherwise say so.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 200 words.
