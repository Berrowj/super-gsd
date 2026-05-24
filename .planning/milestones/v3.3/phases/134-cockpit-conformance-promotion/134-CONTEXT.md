---
phase: 134
phase_name: Conformance Promotion (advisory→binding; 4-surface coverage)
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 brief P134 + plan P134 scoped summary (inherited from v3.2 backlog)
predecessor: P133 PASS (all 4 surfaces now exist)
unlocks: milestone v3.3 CLOSE
---

# Phase 134 — Conformance Promotion (Final v3.3 Phase)

> The capstone phase. Extends the v3.2 conformance gate to cover all four operator-facing surfaces (chronicle HTML, sidecar `--html`, localhost-live cockpit, PS terminal fallback). Adds 6 new v3.3-specific rules (R13-R18). Flips advisory chronicle rules to binding.

## Goal

After P134:
- `conformance-check.cjs` `--surface` flag accepts: `chronicle`, `cockpit`, `cockpit-html`, `monitor`.
- 6 new rules R13-R18 added to `design-rules.json` covering v3.3 band-grammar invariants.
- 1 advisory chronicle rule promoted to binding (where the v3.2 close-summary noted "advisory promote" was queued).
- The full v3.3 conformance run (`node conformance-check.cjs --surface chronicle`) returns `binding_fail=0` end-to-end.
- 4 new SAC tests.

## Binding invariants

1. **Lock-13 untouched** — only `super-gsd/tools/shared/conformance-check.cjs` + `super-gsd/tools/shared/design-rules.json` + `super-gsd/tools/cockpit-sidecar/run-self-test.cjs`.
2. **Existing rules byte-stable** — R01-R12 keep their current severity + applies_to + check logic.
3. **Pure mechanical checks** — no LLM in conformance code paths.
4. **Backward compatible** — `--surface chronicle` and `--surface cockpit` still produce the same verdicts they did in v3.2.

## What ships

### `super-gsd/tools/shared/design-rules.json` (modified, additive)

Append 6 new rules R13-R18 with `severity: "binding"`. Each rule has the same shape as existing R01-R12 (id, name, source_book, citation, check_type, severity, applies_to, description).

Proposed rules:

- **R13: Band 1 carries exactly one loud line** (applies_to: cockpit-html). Pattern: in renderHtml output, exactly one element has class `northstar` OR `band-1` AND class `loud` / `recommended-action`.
- **R14: Stage-pipeline strip has 5 cells** (applies_to: cockpit-html). Output contains 5 elements matching `class="stage` (or 5 `data-stage` markers).
- **R15: Band 3 subheadings — when present, all 6** (applies_to: cockpit-html). If Band 3 is rendered (`data-band="3"` not hidden), it contains the 6 subhead labels.
- **R16: Alert palette_tier ∈ Primer 5-tier** (applies_to: cockpit, cockpit-html). Every alert in `cockpit-sidecar.cjs --json` output has `palette_tier ∈ {accent,success,attention,severe,danger,done}`.
- **R17: ELI5 Munroe-lint pass** (applies_to: cockpit-html, monitor). When an ELI5 block is rendered, `eli5-lint.lintEli5(content).out_of_list_count <= 5`.
- **R18: Localhost-live shell has 3 data-band placeholders** (applies_to: cockpit-html). `renderShell()` output contains `data-band="1"`, `data-band="2"`, `data-band="3"`.

If any rule is too complex to mechanically check given the artifact, mark `check_type: "advisory"` instead — but try for binding where possible.

### `super-gsd/tools/shared/conformance-check.cjs` (modified)

- Extend `--surface` accepted values to include `cockpit-html` and `monitor`.
- Add `checkR13` through `checkR18` functions following the existing checkRNN pattern.
- Register them in the rule map.
- The chronicle surface conformance gate moves from advisory to binding at the wrapper level (the v3.2 backlog item).

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended)

SAC-P134-01..04 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P134-01
    input: "design-rules.json contents loaded"
    expected_outcome: "contains rule entries with ids R13, R14, R15, R16, R17, R18 (6 new rules)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-01"
  - id: SAC-P134-02
    input: "conformance-check.cjs rule registry (the object mapping ids to check functions)"
    expected_outcome: "registry contains R13, R14, R15, R16, R17, R18 keys mapped to functions"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-02"
  - id: SAC-P134-03
    input: "node conformance-check.cjs --surface cockpit-html against renderShell+renderHtml output (synthesized fixture)"
    expected_outcome: "returns exit 0 with binding_fail=0 (current implementation is conformant); accepts cockpit-html as a valid surface name"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-03"
  - id: SAC-P134-04
    input: "node conformance-check.cjs --surface monitor against the PS file (read as text)"
    expected_outcome: "exit 0; accepts monitor as a valid surface name; reports the rule subset that applies"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-04"
```

## Files touched

| Operation | Path |
|---|---|
| MODIFY | `super-gsd/tools/shared/design-rules.json` (T1) |
| MODIFY | `super-gsd/tools/shared/conformance-check.cjs` (T2) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (T3) |
| CREATE | `134-VERIFICATION.md` + `PHASE-CAPSULE.json` (T4) |

## Out of scope

- Chronicle layer changes (chronicle is v3.1; conformance just covers it).
- New `--mode` flags or output formats.
- A full rule-coverage audit (R02 + R09 are still advisory; revisit in a maintenance phase).

## Source references

- v3.3 brief P134 (inherited from v3.2 backlog)
- v3.2 SUMMARY.md lines 86-106 (conformance gate advisory→binding queued debt)
- existing design-rules.json R01-R12 (shape to mirror)
- existing conformance-check.cjs checkRNN pattern (shape to mirror)
