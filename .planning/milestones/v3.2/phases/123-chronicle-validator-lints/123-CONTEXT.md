---
phase: 123
phase_name: Chronicle Validator Lints + Conformance Gate
milestone: v3.2
created: 2026-05-22
status: queued-planning-only
implementation_status: not-started
source: DLB-12.4 — Operator Comprehension System; WS-A phase 3 (final)
predecessor: v3.2 P122 PASS (chronicle renderer rebuilt to gold reference)
---

# Phase 123 — Chronicle Validator Lints + Conformance Gate

> Final WS-A phase. `validate-chronicle.cjs` gains four book-grounded lints + wires the P120 conformance checker as a binding gate, so a v3.2 chronicle is rejected at phase close if it drifts from the design rules — not just if a claim is uncited.

## Goal

After P123, the chronicle validator enforces the v3.2 design contract: jargon-free ELI5, takeaway headings, one primary next-action, takeaway figcaptions, and full P120 conformance. WS-A (chronicle HTML upgrade) is then complete — the renderer produces the gold-reference shape AND the validator guarantees it.

## Binding invariants (from DLB-12)

1. **Validator enforces the design rules (DLB-12 invariant 6 + book rules).** The new lints make R02/R04/R08/R11 machine-checked at phase close, not aspirational.
2. **Re-derive from raw evidence (DLB-11 R4 carried forward).** The lints inspect the rendered HTML + context directly; they do not trust a self-report.
3. **Binding vs advisory.** `CHRONICLE-JARGON` is advisory (warn) — jargon is a quality signal, not a correctness failure. The conformance gate's binding rules are binding (a structural drift halts close). Takeaway-heading + figcaption≠title are advisory. One-primary-action is binding (R04 — decision paralysis is a real failure).
4. **Zero substrate regression.** P113 schema, P114 builder, P115/P122 renderer untouched. The chronicle self-test (102 assertions) stays green.

## The four lints + the conformance gate

1. **`CHRONICLE-JARGON`** (advisory) — scans ELI5 + synthesis section text for denylisted internal terms (`CMB`, `SAC`, `ATC`, `MUDA`, `signifier_role`, `REPORT_`, `escalation_gate`, `denominator` used un-glossed) not expanded on first use. Emits a warning list, never fails the verdict.
2. **takeaway-heading check** (advisory) — flags section headings that are bare labels ("Validator Output") rather than takeaway statements. Heuristic: a heading with a verb / a number / a clause is a takeaway; a 1-2 word noun phrase is a label. Warn only.
3. **one-primary-action check** (binding) — the "what happens next" section must contain exactly ONE primary action node. Zero or multiple → REPORT_UNGROUNDED (decision paralysis, R04).
4. **figcaption≠title check** (advisory) — every `<figure>` figcaption text must differ from its diagram title (a restated title is not a takeaway, R08). Warn only.
5. **conformance gate** — the validator runs `conformance-check.cjs --surface chronicle` (P120) on the chronicle HTML; any binding-rule FAIL → REPORT_UNGROUNDED.

## Files this phase will modify/create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/validate-chronicle.cjs` | modify — add the 4 lints + wire the P120 conformance gate |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — extend with SAC-P123-NN |
| `super-gsd/tools/chronicle/benchmarks/bad-jargon-eli5.json` | create — chronicle with un-glossed jargon in ELI5 |
| `super-gsd/tools/chronicle/benchmarks/bad-multi-primary-action.json` | create — chronicle with 2 primary next-actions → REPORT_UNGROUNDED |
| `super-gsd/tools/chronicle/benchmarks/good-v32-conformant.json` | create — a fully v3.2-conformant chronicle (passes all lints + conformance) |

~2 modified + 3 created.

## Semantic acceptance criteria (target — 123-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P123-01
    input: "benchmarks/bad-jargon-eli5.json"
    expected_outcome: "validator emits a CHRONICLE-JARGON advisory warning naming the un-glossed term; verdict NOT failed by it (advisory)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-01"
  - id: SAC-P123-02
    input: "benchmarks/bad-multi-primary-action.json"
    expected_outcome: "validator emits REPORT_UNGROUNDED — more than one primary next-action (R04 binding)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-02"
  - id: SAC-P123-03
    input: "a chronicle whats-next section with zero primary actions"
    expected_outcome: "validator emits REPORT_UNGROUNDED — one-primary-action check fails closed"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-03"
  - id: SAC-P123-04
    input: "a chronicle with a figure whose figcaption restates the diagram title"
    expected_outcome: "validator emits a figcaption-not-takeaway advisory; verdict not failed by it"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-04"
  - id: SAC-P123-05
    input: "a chronicle with a bare-label section heading"
    expected_outcome: "validator emits a takeaway-heading advisory"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-05"
  - id: SAC-P123-06
    input: "a chronicle HTML that fails a P120 binding conformance rule"
    expected_outcome: "validator emits REPORT_UNGROUNDED — conformance gate binding"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-06"
  - id: SAC-P123-07
    input: "benchmarks/good-v32-conformant.json"
    expected_outcome: "validator emits REPORT_GROUNDED — passes all 4 lints + the conformance gate"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-07"
  - id: SAC-P123-08
    input: "the v3.1 good benchmark fixtures (pre-lint chronicles)"
    expected_outcome: "still classified as before — advisory lints add warnings but do not flip a prior GROUNDED verdict"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P123-08"
  - id: SAC-P123-09
    input: "full chronicle self-test"
    expected_outcome: "all prior 102 assertions green + SAC-P123 additions — zero regression"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

9 SACs. SAC-P123-08 (advisory lints don't flip prior verdicts) + SAC-P123-09 (zero regression) are the keystones.

## Out of scope

- Cockpit (P124-P127)
- Changing the renderer (P122) or the data model (P121)
- New schema fields

## Cross-references

- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — rules R02/R04/R08/R11 the lints enforce
- `super-gsd/tools/shared/conformance-check.cjs` — the P120 checker wired as a gate
- `super-gsd/tools/chronicle/validate-chronicle.cjs` — the validator extended here (v3.1 P116)
