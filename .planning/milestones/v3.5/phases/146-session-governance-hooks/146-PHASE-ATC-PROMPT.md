# Step 6.5 PHASE-LEVEL ATC — P146 Session Governance Hooks (tier: GATE)

Review the ENTIRE phase as one coherent unit (not individual commits). Apply
ATC 7-step (first-principles / delete / simplify / accelerate / automate /
validate / checklist) plus the 10-point anti-slop checklist.

BUDGET (hard): you MUST read the files listed (reading is required — use
whatever read command your environment provides). Do NOT run self-tests,
benchmarks, node, or bash — every suite passes on the host and re-running in
the sandbox produces false failures (proven: adapter A7/A10 fail in-sandbox but
pass 19/19 on host; Git Bash dies with CreateFileMapping). Emit the 5 contract
lines FIRST, then FINDINGS_DETAIL, then stop.

## Phase goal
Governance fires in EVERY session type via repo-local `.claude/settings.json`
hooks: SessionStart contract injection, UserPromptSubmit intent classifier,
report-only PostToolUse quality gate, cockpit/MCP visibility, plus the board's
cheap fixes.

## Read (the phase's whole surface)
- super-gsd/scripts/lib/sgsd-state.cjs            (T146-01, shared resolver)
- super-gsd/scripts/lib/gate-evidence-log.cjs     (T146-01, shared writer)
- super-gsd/scripts/merge-settings.js             (T146-02, repo-local install)
- super-gsd/hooks/sgsd-session-start.js           (T146-03)
- super-gsd/hooks/sgsd-intent-classifier.cjs      (T146-04)
- super-gsd/hooks/sgsd-quality-gate.js            (T146-05)
- super-gsd/registry/session-governance-hooks.yaml (T146-04 owns, T146-05 appends)
- super-gsd/tools/cockpit-state/adapter.cjs       (T146-06, governance section)
- super-gsd/scripts/sgsd-stop-handoff.sh          (T146-07)
- super-gsd/tools/autopilot-watchdog/check.cjs    (T146-07)

## Phase review history (do NOT re-litigate closed per-dispatch findings)
7 tasks. Per-dispatch review found and closed: 2 CRIT path-escapes in the
installer (lexical, then NTFS junction), a CRIT non-SGSD write escape in the
evidence writer, a CRIT never-throw gap + CRIT contract-suppression in
SessionStart, a CRIT registry-root silent no-op + CRIT lexicon
recall/precision failure in the classifier, a CRIT blind-ledger-reads-as-healthy
in the cockpit adapter, and a CRIT MAX_CHAIN_DEPTH bypass in the handoff script.
Phase verification then found 2 more silent-success instances (degraded paths
warning without logging; corrupt-but-parseable registry) — both closed.

## Judge the phase as a WHOLE
1. **Coherence.** Three hooks + two shared libs + a registry + a reader. Is
   there ONE consistent contract for: resolving the SGSD root, deciding
   silence-outside-a-repo, writing evidence, and reporting degradation? Or do
   the seven tasks each solve it slightly differently?
2. **The recurring classes.** This phase shipped the SAME two defect classes
   repeatedly — "writer accepts a caller-supplied destination" (4 instances)
   and "silent success" (6 instances). Is the CURRENT code structurally immune,
   or merely patched at each discovered site? Name any remaining site.
3. **Delete/simplify.** Total added surface across the phase. What could be
   removed outright? Is the hand-rolled YAML parser justified versus a JSON
   sidecar? Do the three hooks duplicate logic that belongs in the shared libs?
4. **Always-on cost.** These run on EVERY session start, EVERY prompt, EVERY
   edit, forever. Is the per-event cost defensible? Is the injected contract
   text bloated (it is prepended to every first turn)?
5. **Anti-slop 1-10** across the phase's added surface.
6. **Would a senior engineer mass-delete any of this?**

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
