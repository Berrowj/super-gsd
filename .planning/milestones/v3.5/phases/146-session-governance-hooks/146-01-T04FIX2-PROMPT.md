# P146 T146-04 fix 2 — lexicon misses planning intent AND false-routes execution

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files you may touch:
`super-gsd/registry/session-governance-hooks.yaml`,
`super-gsd/hooks/sgsd-intent-classifier.cjs`. Nothing else.

## CRITICAL — the task's own falsifier is currently triggered
The locked falsifier fails this task if it "misses a planning-shaped prompt".
Measured on the real hook just now — ALL of these were MISSED (no /sgsd-triage):
    how would you approach the migration?
    lets scope the next milestone
    can you make a roadmap for P149?
    what are our options for the cache layer?
    help me decide between the two designs
And ALL of these FALSE-ROUTED (emitted /sgsd-triage when they should not):
    evaluate the failing test and patch it
    design tokens are wrong in the css file
    architect.js has a typo
Root cause of the false positives: `^\s*design\b` and `^\s*architect\b` and
`^\s*evaluate\b` are unconditional line-start matches, so ordinary code talk in
a UI or JS repo trips them. A hook that fires on "architect.js has a typo"
trains the operator to ignore it — false positives are as damaging as misses.

## Required fix — widen recall, tighten precision
Rework the planning routes in the registry (and the matcher only if genuinely
required) so the corpus below passes exactly. Techniques available: require an
intent-bearing verb to co-occur with a planning object; anchor the bare
`design`/`architect`/`evaluate` verbs to imperative or question forms rather
than any line-start token; add phrase families for approach / scope / roadmap /
options / decide-between / tradeoff; exclude matches where the token is
obviously part of a filename or identifier (e.g. followed by `.js`, `.ts`,
`.css`, `/`, or `_`).

Do NOT solve this by lowering the bar: no route may match so broadly that the
MUST-NOT corpus starts firing. Both halves are graded.

## Acceptance corpus — ALL must hold
MUST ROUTE (emit /sgsd-triage):
    how should we architect the retry layer?
    how would you approach the migration?
    lets scope the next milestone
    let's plan the next phase
    can you make a roadmap for P149?
    what are our options for the cache layer?
    help me decide between the two designs
    i'm thinking about redesigning the gate system
    what if we replaced the classifier entirely?
    should we split this into two phases?
    can you plan the next phase and write the implementation plan?
    design the schema for the evidence ledger
    evaluate the tradeoffs between polling and webhooks

MUST NOT ROUTE (emit nothing):
    evaluate the failing test and patch it
    design tokens are wrong in the css file
    architect.js has a typo
    fix the typo in line 12
    run the tests
    git status please
    what does this function return?
    please read README.md and report the first heading
    rename the variable in scope.js
    the roadmap file has a broken link
    plan.md is missing a heading

## Also fix (WARNING, same dispatch)
The registry carries surface the classifier never consumes or enforces:
`schema_version`, `registry_version`, `owner_phase`, `intent`,
`predicate.match`, and `kind: none` routes. Either CONSUME them meaningfully or
DELETE them — do not leave inert fields that only grow the hand-rolled parser's
attack surface. State which you chose per field and why in your report.

## Preserve (all currently pass — must not regress)
- plan fixture (temp repo with ONLY .planning/STATE.md, no super-gsd/) routes
  correctly; registry resolves from `__dirname` via the single
  `REGISTRY_SOURCE_PATH` constant (keep the one-line P149 swap property);
- non-SGSD dir → exit 0, empty stdout, zero files written;
- bench records intent_classifier_bench with numeric p95_ms < 1000 and
  iterations 200; non-canonical `--record` still refused;
- empty/garbage/null stdin → exit 0, no stack trace;
- no LLM, no network; never emits `decision`/`continue:false`; never blocks;
- mandatory directives still emit BEFORE optional suggestions.

## ReDoS guard
This hook runs on EVERY prompt. No regex may backtrack catastrophically. Avoid
nested quantifiers over overlapping character classes. Sanity-check your worst
pattern against a 10,000-character adversarial prompt and report the timing.

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-intent-classifier.cjs`
2. The FULL corpus above — report any single miss or false positive explicitly.
   Build payloads with JSON.stringify (hand-written JSON with Windows paths
   breaks on unescaped backslashes and silently yields an empty payload).
3. The preserve list above.
4. The 10k-character ReDoS timing check.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. Orphan
edits are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
