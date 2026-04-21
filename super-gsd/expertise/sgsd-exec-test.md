---
agent: sgsd-exec-test
category: C
model_default: sonnet
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - LLMS-P-01
  - LLMS-P-08
  - MET-P-08
  - ISO-P-05
  - ISO-P-01
  - ASS-P-04
---

# Expertise — sgsd-exec-test

*Tests are executable experiment cards (MET-P-08). Each test is a hypothesis + falsifier + stop-rule. This expertise captures how to write tests that are useful, fast, and falsifiable.*

## Seeded Methods

- **AAA / Given-When-Then** — every test has three distinct sections: Arrange (setup + fixtures), Act (invoke the system under test), Assert (verify the outcome). Violations: setup in assertions, multiple acts per test, assertions split across helpers.
- **Fixture isolation** — fixtures do not leak state between tests. DB fixtures use transactions that rollback; in-memory fixtures reconstruct per-test; filesystem fixtures use tmp dirs. ASS-P-06: seed with established fixture patterns for the project's framework.
- **Falsifiable hypothesis** — the test asserts a specific, falsifiable claim about behavior. "should work" is not a hypothesis; "returns 400 when amount < 0" is.
- **Table-driven tests** where applicable — for functions with many (input, output) pairs, a table of cases beats duplicated test bodies.
- **Property-based tests** where applicable — invariants under random input (Hypothesis, fast-check, QuickCheck). Good for parsers, serialization round-trips, math.
- **Golden-file tests** for formatters/generators — the expected output is a committed file; the test asserts equivalence.
- **Characterization tests** — for legacy code, capture current behavior first, THEN refactor. The char-test is the falsifier for the refactor (see `sgsd-exec-refactor`).

## Failure Modes

- **Flaky tests** — pass sometimes, fail sometimes. Root causes: shared state, time-dependence, network, ordering-sensitive. Zero tolerance; flake = defect, not "rerun it".
- **Tautology tests** — pass regardless of implementation. Indicator: mocking the system under test, asserting mock's return value.
- **Over-mocking** — every dependency is mocked; test exercises nothing real. Rule: mock at the boundary (HTTP clients, databases if the project uses in-memory DB for tests), not internal classes.
- **Snapshot-test sprawl** — committing snapshots without reading them. Rule: every snapshot has at least one human review before commit; stale snapshots are defects.
- **Test-the-framework** — assertions like "renders a div" in React tests. Useless; either remove or replace with a meaningful behavior assertion.
- **Shared-state pollution** — one test sets module-level state, another depends on it. Test order dependency is a defect.

## Output Quality Bar

- **Completeness:** named hypothesis in the test description; covers happy path + at least 2 boundary conditions + at least 1 failure mode
- **Accuracy:** runs in <1s (unit) / <10s (integration) on developer machine; deterministic (10 reruns = 10 passes)
- **Surgical-ness:** new tests only in `files_touched`; shared fixtures extracted minimally (only if 2+ tests genuinely share them)
- **Readability:** failure messages identify the specific assertion + expected vs actual + context
- **Confidence calibration:**
  - 5 = tests for happy + boundaries + failure modes; 10-run stability confirmed
  - 4 = tests for happy + boundaries; failure modes partial
  - 3 = happy path only, with rationale DEVIATION-noted
  - 2 = tests added but flakiness suspected
  - 1 = tests added but not all pass — BLOCKER almost certainly

## Known Pitfalls

- **DO NOT** test private methods directly — test them via public interface.
- **DO NOT** use `sleep()` or arbitrary time waits for async — use proper `await` / `await until` with timeout.
- **DO NOT** share mutable test fixtures across tests without explicit cleanup.
- **DO NOT** assert on log output unless logging IS the feature under test.
- **DO NOT** commit tests that are skipped (`test.skip`, `xit`, `@skip`) without operator-approved reason.
- **DO NOT** generate fake data at test-time with random seeds that vary (non-deterministic); fix seeds or use golden values.
- **DO NOT** mock `datetime.now()` by replacing the module — inject a clock parameter or use library-provided test doubles.

## Reference Patterns

- **Pattern: table-driven test**
  - Approach: list of `(input, expected, description)` tuples; loop + sub-test per tuple
  - Failure mode: one failed case hides others; slow to debug
  - Rule: use language-native sub-test support (Go's `t.Run`, Python's `pytest.mark.parametrize`, Node's `describe.each`)

- **Pattern: happy-path + boundaries + error modes**
  - Approach: minimum 3 tests per function — happy, boundary (empty/max/zero), error (invalid input)
  - Failure mode: 100% line coverage without exercising boundaries
  - Rule: design test cases from `task.hypothesis` + `task.falsifier` + failure-mode exploration

- **Pattern: integration test via real boundary**
  - Approach: test hits a real HTTP/DB client against a local server / in-memory DB
  - Failure mode: slow + env-dependent; tests become operational burden
  - Rule: keep integration tests in a separate suite; CI runs them; unit suite stays fast

- **Pattern: property-based test for invariants**
  - Approach: declare the invariant (e.g. `serialize(deserialize(x)) == x`); framework generates random inputs
  - Failure mode: generators don't exercise the edge cases you care about
  - Rule: use shrinking-enabled frameworks; save failing inputs as regression tests

## Handover Specifics

- **Routes to** `sgsd-verifier` at phase close — verifier cross-checks that the phase's stated acceptance criteria have corresponding tests
- **Does NOT trigger** per-dispatch ATC (Step 9.5) in full tier unless the test file also modifies production code (ISO-P-01 semantic check)
- **Feeds** `.planning/memory/architecture/patterns/` with reusable test patterns via sgsd-curate
- **Blocks** on ambiguous system-under-test contract or missing falsifier specification

## Research Citations

- **LLMS-P-01** — diagnose failure modes before scaling. Tests ARE the failure-mode documentation; absent tests = absent diagnosis.
- **LLMS-P-08** — peer review reveals blind spots. Tests are the pre-review for implementation; they catch what the author missed.
- **MET-P-08** — falsifiable experiment cards. Each test is a hypothesis with a falsifier; the test either passes or documents the failure.
- **ISO-P-05** — real-world tasks with measurable ground truth. Tests grounded in actual PRs/bugs outperform synthetic benchmarks.
- **ISO-P-01** — execution + semantic metrics. A test that executes (runs) AND semantically asserts the right behavior; tests that pass vacuously are defects.
- **ASS-P-04** — reflection cycles convert outcomes to rules. Each failing test captures a rule; accumulated rules are the regression suite.

## Revision Log

- 2026-04-21 — v2.0 created.
