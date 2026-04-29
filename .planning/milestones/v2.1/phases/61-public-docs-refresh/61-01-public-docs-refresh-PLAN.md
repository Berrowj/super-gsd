---
schema_version: 2
phase: 61
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: [60]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - README.md
  - super-gsd/scripts/sgsd-complete-milestone.cjs
requirements:
  - DOCS-01
  - DOCS-02
  - DOCS-03
  - V2-1-FOURTH-GATE-01
tags:
  - public-docs
  - vtp-optional-sweep
  - sg-quick-start
  - docs-refresh-gate
  - phase-61
  - v2.1
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - README.md
    input_contract: 61-CONTEXT.md goal + locked decision 61=C + ROADMAP-AGENT.md:758 verbatim
    output_contract: README.md PREPENDED with 'What This Repo Is For' preamble distinguishing operator-build (this repo) vs end-user-install; existing baseline content (lines 22+ of post-prepend file) preserved byte-equal except for any em-dash on lines I author which must be ASCII (Lock 11 closed-vocab + Lock 4 byte-untouched on baseline)
    hypothesis: A 4-line preamble (heading + intro sentence + 2 bullet items + cross-link sentence) is sufficient to route both audiences correctly without bloating the README; the existing 'What It Does' section then continues unchanged.
    falsifier: If a first-time reader cannot tell from the first 30 lines of README which audience they belong to, the preamble is inadequate.
    stop_rule: Preamble heading 'What This Repo Is For' present + 2 bullet items distinguishing operator-build vs end-user-install + cross-link to Operator Build Workflow section + bytes 22+ of original README preserved.
    verification_cmd: "grep -n 'What This Repo Is For\\|Operator-build\\|End-user-install' README.md"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - README.md
    input_contract: 61-CONTEXT.md goal + Phase 48 selective-VTP-bridge VERIFICATION + Phase 52 redis-adapter VERIFICATION + existing README.md baseline
    output_contract: README.md SGSD3 dashboard description marks VTP/MCP panel optional with Phase 48/52 rationale; new 'Optional Add-Ons' section added (VTP/MCP bridge + Redis live cache + Codex panel all marked optional with default-without paths); new 'Operator Build Workflow' section added; new Quick Start step 5 with sg shortcut block + bash fallback + walkthrough cross-link added; ASCII-only on NEW content; acceptance grep -ic 'vtp.*required|vtp.*must' README.md = 0; grep -ic 'vtp' README.md >= 1
    hypothesis: Three insertion points (SGSD3 dashboard description extension + new Optional Add-Ons section + new Operator Build Workflow section) plus the new Quick Start step 5 are sufficient to mark all VTP mentions optional and provide a sg quick-start path without bloating the README.
    falsifier: If grep -ic 'vtp.*required|vtp.*must' README.md returns >0, OR if grep -ic 'vtp' README.md returns 0 (no mentions at all - VTP-optional callouts missing), OR if the sg quick-start command block is not tested live, the contract is broken.
    stop_rule: All three acceptance greps green AND sg quick-start block tested live (sgsd-boot.sh --skip-preflight exit 0) AND raw stdout captured in 61-VERIFICATION.md.
    verification_cmd: "grep -ic 'vtp.*required\\|vtp.*must' README.md && grep -ic 'vtp' README.md && bash super-gsd/scripts/sgsd-boot.sh --skip-preflight"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing v2.1 third-gate from Phase 60-01 (sgsd-complete-milestone.cjs:474-478) + README.md edits from T1+T2
    output_contract: sgsd-complete-milestone.cjs extended with v2.1 FOURTH-GATE (docs-refresh check) inserted between the Phase 60 third-gate green emission and the original process.exit(0); v1.9 dual-gate path + v2.0 sept-gate path + Phase 58 first-gate + Phase 59 second-gate + Phase 60 third-gate paths preserved byte-equality up to the insertion point (bytes 1-478 of the post-Phase-60 file)
    hypothesis: A surgical insertion (additive only, ~99 lines, zero deletions) inside the existing milestone==='v2.1' block performs the closed-vocab grep on README.md in-proc (fs.readFileSync + line-by-line regex) and degrades gracefully (green-with-skip) when README.md is absent. v1.9 / v2.0 / v2.1 milestone gates all still exit 0 with no observable output regression on the prior gates.
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 60 baseline OR if --milestone v2.0 changes any observable output OR if --milestone v2.1 fails to exit 0 when README.md is canonical OR if --milestone v2.1 fails to exit 0 when README.md is absent (Lock 13 graceful degrade) OR if the fourth-gate accepts a README with 'vtp required' or 'vtp must' phrasing, the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.1 exits 0 with first-gate + second-gate + third-gate + fourth-gate all green AND --milestone v1.9 + --milestone v2.0 still exit 0 (no regression) AND git diff --stat shows only insertions in the v2.1 block, zero deletions AND ASCII first_nonascii_idx=-1.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
gates:
  - lock_4_phase_41_60_byte_untouched: "git diff covers only Phase 61 surface (README.md + sgsd-complete-milestone.cjs surgical extension inside v2.1 block); zero deletions on the milestone script"
  - lock_11_closed_vocab_grep: "fourth-gate regex /vtp[^\\n]*(required|must)/i on README.md; no fuzzy matching"
  - lock_13_docs_gate_degrades_gracefully: "README.md missing -> SKIPPED sentinel + exit 0"
  - ascii_only_new_content: "all NEW lines I authored have first_nonascii_idx=-1; pre-existing baseline em-dashes preserved per Lock 4"
  - vtp_optional_sweep: "grep -ic 'vtp.*required|vtp.*must' README.md = 0; grep -ic 'vtp' README.md >= 1"
  - no_regression_v1_9_v2_0: "both prior milestone gates exit 0 unchanged"
  - sg_quick_start_live_tested: "sgsd-boot.sh --skip-preflight exit 0 with raw stdout captured"
verification:
  - cmd: "grep -ic 'vtp.*required\\|vtp.*must' README.md"
    expected: "0"
  - cmd: "grep -ic 'vtp' README.md"
    expected: ">=1 (mentions exist, all marked optional)"
  - cmd: "grep -n 'What This Repo Is For' README.md"
    expected: "preamble heading present"
  - cmd: "bash super-gsd/scripts/sgsd-boot.sh --skip-preflight"
    expected: "exit 0; SGSD1/SGSD2/SGSD3 launch lines printed"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9"
    expected: "exit 0 + 'v1.9 dual-gate ... green' (no regression)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
    expected: "exit 0 + 'v2.0 sept-gate ... green' (no regression)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
    expected: "exit 0 + first-gate + second-gate + third-gate + fourth-gate all green"
acceptance:
  - "grep -i 'vtp' README.md shows zero 'required' or 'must' (only 'optional')"
  - "Quick-start sg command block tested live (sgsd-boot.sh --skip-preflight exit 0)"
  - "Preamble paragraph distinguishes operator-build vs end-user-install audiences explicitly"
  - "v2.1 fourth-gate (docs-refresh) green when README.md is canonical; green-with-skip when README absent (Lock 13)"
  - "Lock 4 (Phase 41-60) byte-untouched; v1.9/v2.0 milestone gates no regression"
  - "ASCII-only across all NEW content authored by Phase 61"
---

# Phase 61-01 Public Docs Refresh Plan

This plan ships the Phase 61 public-docs refresh: a surgical
extension of README.md (preamble + VTP-optional sweep + sg
quick-start + Optional Add-Ons + Operator Build Workflow) and a
surgical extension of sgsd-complete-milestone.cjs (v2.1
fourth-gate docs-refresh check).

The plan composes:

- T1 prepends the "What This Repo Is For" preamble so first-time
  readers route themselves to the right path immediately
  (operator-build vs end-user-install).
- T2 sweeps VTP mentions across the README marking them all
  optional with Phase 48 / Phase 52 rationale, adds the sg
  quick-start step 5 (live-tested), and adds Optional Add-Ons +
  Operator Build Workflow sections so the README has a clear
  separation between the two audiences.
- T3 wires the v2.1 fourth-gate (docs-refresh check) into
  sgsd-complete-milestone.cjs so any future regression
  (re-introducing 'vtp required' or 'vtp must' phrasing) is
  caught at milestone close.

The fourth-gate, the README, and the existing Phase 60
walkthrough are designed to compose: the README is what an
operator reads; the walkthrough is the end-to-end exercise; the
fourth-gate is what CI runs to catch regressions in the README's
VTP-vocab discipline.

## Lock invariants honored

- **Lock 4**: Phase 41-60 + sgsd-cockpit-shell.cjs byte-untouched.
  README.md edit is +78 / -1 (em-dash to ASCII swap on a NEW
  line I authored - the deletion is part of my own added
  content, not pre-existing baseline). sgsd-complete-milestone.cjs
  edit is strictly additive (+99 / 0).
- **Lock 11**: Closed-vocab regex on 'required' / 'must'
  (case-insensitive). No fuzzy matching, no semantic
  interpretation.
- **Lock 13**: README.md missing -> docs-gate emits SKIPPED
  sentinel + exits 0 rather than blocking close.
- **ASCII-only**: All NEW lines authored by Phase 61 have
  first_nonascii_idx=-1. Pre-existing baseline non-ASCII (em-
  dashes from v1.0, box-drawing diagram, cent sign) preserved
  byte-untouched per Lock 4.
