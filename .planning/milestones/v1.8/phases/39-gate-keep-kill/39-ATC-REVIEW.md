# Phase 39 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer
- Provider: codex-cli-reviewer (gpt-5.5, xhigh)
- Tier: phase-level (dual-provider)
- Final verdict: pass (post-fix)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Post-fix |
|----------|---------|------|------|----------|
| Claude   | warn    | 0    | 4    | pass     |
| Codex    | warn    | 1    | 4    | pass     |

## Findings (deduplicated)

### CRIT (1, fixed in-loop)

**C1 [Codex+Claude] -- edge-guard milestone-window scoping bug**
- File: `super-gsd/tools/gate-keep-kill/rubric.cjs:347` (pre-fix `milestoneStart = null`)
- The `milestoneStartIso` parameter of `_readEdgeGuardRows` was permanently unreachable; edge-guard halt rows were never time-filtered even when `--milestone` flag was passed. Halt window scoping was not merge-safe.
- Fix: derive milestoneStart from MILESTONE-READINESS.md `created:` field (preferred) or earliest review-ledger ts for the milestone (fallback). `if neither available` -> permissive null (treats all halt rows as in-window; matches pre-fix behavior on cold start).

### WARN (5 distinct, fixed in-loop or accepted)

**W1 [Claude] -- LOC overrun + dead variable**
- File: `rubric.cjs` 641 LOC vs ~360 estimate; `rubric.test.cjs:285` `totalAssertions` dead variable.
- Fix: removed dead `totalAssertions`. LOC overrun documented as INFO; correctness gates all PASS.

**W2 [Claude] -- bare relative `'.planning'` in SKILL.md (Phase 36 W2 lesson regression)**
- File: `super-gsd/skills/sgsd-complete-milestone/SKILL.md:106-117` Step 4.5
- Pre-fix used bare relative `'.planning'` string; CWD-dependent.
- Fix: `path.join(process.cwd(), '.planning')` explicit. Inline comment cites Phase 36 W2 lesson.

**W3 [Claude+Codex] -- review-ledger `_legacy.gate` partial coverage**
- File: `rubric.cjs:144` `_filterReviewRowsForGate`
- Only atc-review bridge layer populates `_legacy.gate`; cross-ledger match is best-effort.
- ACCEPTED -- RESEARCH §1.4 explicitly says review-ledger pass_rate is informational only (notes-only; verdict NEVER changes from this). Behavior matches locked design intent.

**W4 [Codex] -- ASCII-only violation (em dashes U+2014)**
- Files: `rubric.cjs` (12 occurrences) + `rubric.test.cjs` (8 occurrences)
- Comment text used literal em-dashes; violates ASCII-only constraint.
- Fix: bulk-replaced U+2014 with `--`. Verified 0 non-ASCII bytes post-fix in both files.

**W5 [Codex] -- public API / test / review-ledger observations**
- INFO bundle — public API surface match RESEARCH §5; 9 test assertions match RESEARCH §11; review-ledger limitation documented (W3).
- ACCEPTED.

### NIT (0)

None.

## ATC checklist (post-fix)

| Step | Verdict |
|------|---------|
| 1 First Principles | PASS |
| 2 Delete | PASS (dead `totalAssertions` removed) |
| 3 Simplify | PASS (em-dash fix; cwd anchor; milestone window) |
| 4 Validate | PASS (14/14 self-test + 6/6 fixtures + status-consistency v1.8 OK) |
| 5 Anti-slop | 9/10 (combined) |

**Combined anti-slop score (post-fix): ~9/10.**

## Codex provider health

AVAILABLE throughout. 1 invocation, exit 0, JSONL row appended.

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN. 1 INFO accepted (W3 review-ledger _legacy.gate partial coverage matches locked notes-only design).

## One-liner

Phase 39 keep/kill rubric: dual-provider review surfaced 1 CRIT (edge-guard milestone-window scoping bug — unreachable parameter) + 5 WARNs (dead variable, cwd anchor, em-dashes, review-ledger limitation, INFO bundle); CRIT fixed via MILESTONE-READINESS.md + earliest-review-ts derivation; em-dashes purged; combined anti-slop ~9/10.
