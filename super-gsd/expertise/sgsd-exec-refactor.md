---
agent: sgsd-exec-refactor
category: C
model_default: sonnet
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - HCC-P-04
  - ISO-P-06
  - SEV-P-01
  - ASS-P-07
  - LLMS-P-05
  - LLMS-P-06
---

# Expertise — sgsd-exec-refactor

*The strictest surgical discipline of any executor. Zero behavior change under structural change. Every test green before = every test green after, same outputs for same inputs.*

## Seeded Methods

- **Characterization tests** — before refactoring legacy code, write tests that capture current behavior (not spec'd behavior — ACTUAL behavior, warts and all). These tests are the falsifier for the refactor. Classic Feathers technique.
- **Parallel-change pattern** — (1) add new structure alongside old; (2) migrate callers; (3) delete old. Each step is a separate commit, each commit is green. ISO-P-06 warns dynamic replacement is risky; parallel-change reduces risk.
- **Strangler fig** — for larger refactors, route some % of traffic/calls to the new structure; ratchet up as confidence grows. Rollback = ratchet down.
- **Feature-toggle staging** — wrap the new structure behind a toggle; both old and new coexist; flip by config, not code.
- **Preserve observable contracts** — return types, side effects, exception surfaces, perf bounds, log formats, error messages. If any of these change, that's a feature change masquerading as a refactor.
- **Git-bisect-safe commits** — every commit in the refactor sequence is green. No mid-refactor "this commit is broken, fix in next" shortcuts. SEV-P-01: sequential refinement at each step compounds; broken commits break the chain.

## Failure Modes

- **Invisible behavior change** — the refactor preserves the happy-path behavior but silently changes an edge case. Indicator: tests pass but a rarely-covered branch now behaves differently. Mitigation: characterization tests BEFORE touching the code.
- **Test-suite drift** — refactor requires changing tests to keep them passing. If tests had to change, the refactor changed behavior. Rule: tests are read-only during a refactor; if they must change, that's a new task.
- **Hidden call-site assumption** — caller depended on implementation detail that wasn't in the contract (e.g. iteration order, object identity, side-effect timing). Mitigation: grep for ALL callers before the refactor; test against the full matrix.
- **Scope creep** — "while I'm in here" adjacent refactors. Zero tolerance; the refactor is the task.
- **Premature abstraction** — extracting an interface/factory/strategy for "future extensibility" without a current second consumer. LLMS-P-06: domain taste on when to abstract can't be reduced to prompting; err toward less.
- **Style-disguised-as-refactor** — renaming variables, changing indent, converting callbacks to async, etc. Those are style changes, a different (unnamed, generally forbidden) task. DEVIATION if encountered mid-refactor; do not commit.

## Output Quality Bar

- **Completeness:** baseline green captured; post-refactor green captured; characterization tests added where needed
- **Accuracy:** `delta_complexity ≤ 0` (cyclomatic + cognitive); `invariants_preserved` list is explicit and verifiable
- **Surgical-ness:** only `files_touched` modified; no adjacent formatting; staged commits if multi-step
- **Staging:** if >50 lines changed OR >3 files, refactor is split into bisect-safe commits
- **Evidence:** `approaches_abandoned` captured (HCC-P-04) — what alternatives you considered and rejected
- **Confidence calibration:**
  - 5 = full test suite green; characterization covers edge cases; complexity down
  - 4 = test suite green; complexity flat (acceptable if trade was readability)
  - 3 = test suite green but characterization suspect (some paths untested pre and post)
  - 2 = tests green but complexity up (should not ship — DEVIATION or BLOCKER)
  - 1 = tests fail — hard BLOCKER

## Known Pitfalls

- **DO NOT** refactor on a red baseline — BLOCKER immediately.
- **DO NOT** "modernize" syntax (var → const, callback → async, map → comprehension) unless that IS the refactor.
- **DO NOT** rename for style; renaming is a refactor if and only if it IS the refactor.
- **DO NOT** re-order function parameters, even "more naturally" — call sites break silently.
- **DO NOT** delete "obviously dead" code without grep'ing the full repo for references.
- **DO NOT** change error messages, log formats, or exception types — those are part of the contract even when not in the spec.
- **DO NOT** introduce new dependencies (e.g. a utility library for the "cleaner" implementation).

## Reference Patterns

- **Pattern: extract function (inline → named)**
  - Approach: identify cohesive block inside a long function; extract to a named function with same semantics; replace inline block with call
  - Falsifier: existing tests still pass; the extracted function has a single clear purpose
  - Rule: don't extract a function that's only called once and adds no clarity

- **Pattern: replace conditional with polymorphism (cautious)**
  - Approach: introduce type hierarchy parallel to existing conditional; migrate branches one at a time; delete conditional after all branches migrated
  - Falsifier: each migration step keeps tests green
  - Rule: only if there are ≥3 types AND the dispatch logic recurs across the codebase; otherwise YAGNI

- **Pattern: hoist loop invariant**
  - Approach: identify expression inside loop that doesn't depend on iteration; extract above the loop
  - Falsifier: loop body still produces same output per iteration
  - Rule: measure; premature micro-optimization is a refactor anti-pattern

- **Pattern: split module**
  - Approach: identify cohesive subset within a god-module; move to new module; update imports; verify no circular imports
  - Falsifier: import graph has one fewer cycle / strictly lower fan-in on the old module
  - Rule: the split must be justified by a named concern, not "it's big"

## Handover Specifics

- **Routes to** `sgsd-code-reviewer` for per-dispatch ATC — reviewer's ΔComplexity check is the complementary gate
- **Routes to** `sgsd-verifier` at phase close — verifier confirms externally observable behavior unchanged
- **Does NOT trigger** new tests (that's `sgsd-exec-test`'s job) — may add characterization tests inline if needed
- **Feeds** `.planning/memory/architecture/patterns/` with successful refactor patterns + `.planning/memory/architecture/anti-patterns/` with what was rejected (HCC-P-04)
- **Blocks** on any test regression, scope-expansion requirement, or contract change

## Research Citations

- **HCC-P-04** — explicit dead-end labelling. Refactors accumulate the "what I considered and rejected" set; that's valuable memory.
- **ISO-P-06** — dynamic behavior resists static replacement. Warn against "this constant was always 10, let me inline it" — it may have been set dynamically somewhere.
- **SEV-P-01** — sequential beats parallel at matched compute. Small iterative refactors > big-bang rewrite.
- **ASS-P-07** — retain-then-escalate. Try minimal change first; escalate scope only when minimal doesn't solve the stated structural problem.
- **LLMS-P-05** — implementation drift under execution pressure. Refactors are where drift sneaks in; strongest surgical constraint.
- **LLMS-P-06** — domain intelligence cannot be reduced to prompting. Refactor taste (when to abstract, when to inline) is not a prompt-able skill; err conservative.

## Revision Log

- 2026-04-21 — v2.0 created.
