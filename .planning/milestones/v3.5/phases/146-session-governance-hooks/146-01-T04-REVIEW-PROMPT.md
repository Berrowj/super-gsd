# Combined Spec (9.4) + ATC (9.5) — P146 T146-04 intent classifier (post-fix)

You MUST read the two files below (use whatever read command your environment
provides — reading is required). Do NOT run self-tests, node, or bash. Do NOT
read any other file. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL,
then stop.

## Files
- super-gsd/hooks/sgsd-intent-classifier.cjs (created, then fixed)
- super-gsd/registry/session-governance-hooks.yaml (created)

## PART A — spec compliance
output_contract: a LOCAL Node UserPromptSubmit classifier that lowercases the
prompt, applies REGISTRY-BACKED lexical routes, injects `/sgsd-triage` for
planning intent, suggests neglected SGSD skills, and records `p95_ms` bench
rows. T146-04 OWNS `session-governance-hooks.yaml`. Append ONLY
`intent_classifier_bench` rows via the T146-01 writer.

falsifier — FAILS if: calls an LLM; blocks prompts; judges plan quality itself;
misses a planning-shaped prompt; cannot switch registry source with a ONE-LINE
change for P149; or records p95_ms >= 1000.

## PART B — ATC, with this phase's THREE recurring defects as the lens
1. **Writer accepts a caller-supplied destination** (CRITICAL in T146-01, twice
   in T146-02). Trace every write. `runBench` takes `--record` from the CLI —
   is `recordTargetIsCanonical` genuinely sufficient, or can a crafted
   `--record` (relative traversal, symlink, junction, UNC path) still land
   outside the validated root? Note T146-02 needed realpath, not lexical checks.
2. **Silent success** (CRITICAL in T146-03; and the registry-root bug just
   fixed here, where the classifier silently emitted nothing in any repo
   lacking super-gsd/). Are there remaining paths where the hook returns
   quietly while governance simply does not happen? Is `registry_unavailable`
   still reachable in a NORMAL deployment?
3. **Optional work before mandatory emit** (T146-03). Does `emitClassification`
   emit mandatory directives before attempting suggestions on every path?

Also check:
4. Regex safety in the registry: any pattern vulnerable to catastrophic
   backtracking on a long adversarial prompt? The hook runs on EVERY prompt —
   a ReDoS here stalls the operator's session.
5. Lexicon quality: obvious planning phrasings that would be MISSED (falsifier
   names this explicitly), and obvious execution phrasings that would FALSELY
   route. Name concrete examples.
6. Anti-slop: dead exports, unused registry fields, speculative routes with no
   enforcement, hand-rolled YAML parser complexity vs a JSON sidecar.

## Verified by the orchestrator already (do NOT re-run)
Plan fixture (temp repo with ONLY .planning/STATE.md, NO super-gsd/): planning
prompt → `/sgsd-triage`, README prompt → nothing, exit 0 both, no
registry_unavailable breadcrumb. 4 execution prompts → no false positives.
3 additional planning phrasings → all routed. Non-SGSD dir → exit 0, empty
stdout, zero files. Bench with cwd inside a fixture repo → row written,
p95_ms 0.016–0.044, iterations 200. Bench with a non-canonical `--record` →
refused, no file. empty/garbage/null stdin → exit 0, no stack. No network/LLM
imports. Registry source is a single named constant
(`REGISTRY_SOURCE_PATH`, resolved from `__dirname`).

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
