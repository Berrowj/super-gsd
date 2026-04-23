---
phase: 09-atc-147-evidence
verified: 2026-04-22T12:00:00Z
status: pass_with_deviations
score: 3/3 requirements satisfied (1 arithmetic deviation in gate-bypass note)
overrides_applied: 0
gaps: []
deviations:
  - item: "lower_bound_tokens: 9340 explanatory note arithmetic is self-contradictory"
    detail: >-
      The note claims: "Lower = 800+1600+9600+480+0+600+100+800+160 = 14,140 minus the FULL ATC
      cost (4800 saved) = 9,340." The described sum (LITE/SKIP on per-dispatch ATC) correctly
      yields 14,140. Subtracting 4,800 again from 14,140 to reach 9,340 is a double-subtraction.
      The value 9,340 is arithmetically reachable only as upper_bound (18,940) minus ByteRover
      (9,600) — not as "per-dispatch ATC at LITE/SKIP" which would produce 14,140. The label
      comment and the note headline ("LITE/SKIP on per-dispatch ATC") are inconsistent with the
      stated bound. The 9,340 figure itself is not wrong as a floor scenario — it represents a
      world where ByteRover is also entropy-gated — but the prose explanation is incorrect.
    severity: warning
    recommended_action: >-
      Update the note field in 09-gate-bypass.yaml totals section to either (a) correct the
      sum to 14,140 if the intent is "only per-dispatch ATC excluded", or (b) change the
      label and note to reflect that the lower bound also excludes ByteRover query injection,
      and update 147-review.md's gate-bypass table footnote accordingly.
---

# Phase 9: ATC-147-Evidence — Verification Report

**Phase Goal:** Close the evidence gap from Phase 147's silent-gate-skip by running a retroactive ATC review and a bypass-cost audit, producing the empirical finding count that Phase 10's keep/kill matrix will key against.
**Verified:** 2026-04-22
**Status:** PASS-WITH-DEVIATIONS
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ATC review exists at external path with all 10 findings classified | VERIFIED | `project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` exists, SHA ca5be16b..c41634c4 confirmed live in that repo, 10 findings (W1-W4, I1-I6) present and classified |
| 2 | v1.2 evidence registry cross-links to external review via operator-resolvable path | VERIFIED | `.planning/milestones/v1.2/evidence/147-review.md` SHA-pins ca5be16b..c41634c4 and includes `review_path: ../../../../project-clarity-erp/...` in frontmatter |
| 3 | Gate-bypass audit enumerates 9 gates with token-cost estimates per gate | VERIFIED | `09-gate-bypass.yaml` has 9-row audit with per_dispatch_tokens and total_bypass_cost on every row |
| 4 | Finding count surfaced in form Phase 10 can consume (≥3/1-2/0 thresholds) | VERIFIED | `headline_finding_count: 4` in classification YAML and inlined in registry doc; verdict "≥3 bracket" stated in 09-01 SUMMARY |

**Score:** 4/4 truths verified

---

## Verification Focus Analysis

### 1. Real bloat identified correctly?

The classification holds up against the source review. Spot-checking two findings:

**W3 (real-bloat — "Two unused imports"):** The 147-ATC-REVIEW.md §W3 says `from typing import Iterator` in calendar.py has no Iterator annotation, and `from functools import lru_cache` in owners.py is never used — textbook ATC point 2 violations. Classification as `real-bloat` is correct; there is no spec justification for dead imports.

**I1 (false-positive — "paused= parameter never non-default"):** The review explicitly states "Justified as a Phase 2 hook per spec §6.1; Acceptable." Classification as `false-positive` is correct — the parameter exists by deliberate design, not by neglect.

The bucket assignments are non-arbitrary: `real-bloat` requires immediate deletion, `integration-gap` requires wiring in a future wave, `false-positive` is spec-backed, and `nit` is functional but could be simplified. The two integration-gaps (W1: OwnerLookup orphaned; W2: resolve_target_seconds never called) are correctly distinguished from false-positives — they are missing production wiring, not spec-intended stubs.

### 2. INTENT.md is non-shallow?

The `outcome_delivered` line — "Operators run autonomous phases with empirically-gated ATC gates and v2-schema plans." — is substantive. It is forward-referencing (it asserts a post-Phase-10-through-13 state), concrete (names the mechanism: empirically-gated gates + v2-schema plans), and testable (an executor can deviate and cite this in a deviation log: "gate skip not defensible because headline_finding_count=4 places this in the ≥3 keep bracket"). The INTENT.md body also carries the ≥3/1-2/0 threshold framing, the SHA pin, and the per-phase "how we'll know" success conditions — this is a usable Architect-R2 injection target, not boilerplate.

### 3. Gate-bypass numbers are grounded?

The upper bound (18,940) is fully traceable: sum of 9 rows in the YAML (`800+1600+9600+480+4800+600+100+800+160 = 18,940`), with per-dispatch gates multiplied by 16 (confirmed by `dispatches_denominator: 16`, itself traced to the 16 T-commits in project-clarity-erp's Phase 147 git log `ca5be16b..c41634c4`).

The lower bound (9,340) has an arithmetic error in its explanatory note. The note states the lower is computed by zeroing per-dispatch ATC to get 14,140, then subtracting 4,800 again to reach 9,340 — this is a double-subtraction. The value 9,340 is arithmetically correct as `upper_bound (18,940) minus ByteRover (9,600)`, suggesting the real semantic of the lower bound is "per-dispatch ATC at LITE/SKIP AND ByteRover at zero for a fresh-codebase phase." The note's prose is self-contradictory. The number itself (9,340) is a valid floor, but Phase 10 should receive a corrected note to avoid misreading the lower-bound scenario.

### 4. verify.mjs is load-bearing?

Confirmed load-bearing. Invariant 3 checks `headline_finding_count === real_bloat + integration_gap`. Mutating `headline_finding_count: 4` to `headline_finding_count: 0` causes verify.mjs to fail with `FAIL invariant 3: headline_finding_count is 0, expected 4`. The verifier also enforces: findings_detail.length === 10, bucket sum === 10, audit.length === 9, per-phase steps === [6,7], step-6 row has fired_retroactively === true, and registry doc contains SHA pin verbatim. All 7 invariants are structurally enforced, not just file-existence checks.

### 5. External SHA pin is real?

Verified. `git cat-file -t ca5be16b` and `git cat-file -t c41634c4` both return `commit` in project-clarity-erp. `git log --oneline ca5be16b..c41634c4` returns 16 T-commit entries matching the `dispatches_denominator: 16` claim. The ATC-REVIEW.md file exists at the path `../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` and its frontmatter pins `commits_reviewed: ca5be16b..c41634c4`. Pin is real and traceable.

### 6. Requirements trace?

All three requirements satisfied. See table below.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `09-classification.yaml` | 10 findings, 4 buckets, headline count | VERIFIED | 10 rows, buckets sum to 10, headline_finding_count=4 matches real_bloat+integration_gap |
| `09-gate-bypass.yaml` | 9-row gate audit with token costs | VERIFIED | 9 rows, per-dispatch/per-phase split correct, arithmetic correct except lower-bound note |
| `.planning/milestones/v1.2/INTENT.md` | Milestone intent with injection-contract outcome_delivered | VERIFIED | All 5 required frontmatter fields present, outcome_delivered 85 chars (within 120-char limit) |
| `.planning/milestones/v1.2/evidence/147-review.md` | Registry pointer with SHA pin + inline tables | VERIFIED | SHA pin present verbatim, 10-row classification table + 9-row gate table inlined |
| `verify.mjs` | Mechanical verifier, exit 0 | VERIFIED | `node verify.mjs` exits 0 ("PASS: all 7 invariants hold"), confirmed mutation-resistant |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ATC-147-01 | 09-01 | Retroactive ATC review with each finding classified as real-bloat/nit/false-positive | SATISFIED | 09-classification.yaml has 10 findings across 5 buckets; external ATC-REVIEW.md exists at pinned path |
| ATC-147-02 | 09-03 | ATC review cross-linked from v1.2 milestone evidence registry | SATISFIED | 147-review.md exists with SHA pin + review_path pointer; verify.mjs invariant 7 enforces pin |
| ATC-147-03 | 09-02 | Gate-bypass audit with 9 gates and token-cost estimates | SATISFIED | 09-gate-bypass.yaml with 9 rows, per_dispatch_tokens and total_bypass_cost on every row |

---

## Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `09-gate-bypass.yaml` line 95 (note field) | Lower-bound arithmetic note is self-contradictory: describes "LITE/SKIP on ATC = 14,140" then subtracts 4,800 again to claim 9,340 | WARNING | Phase 10 could misread the lower-bound scenario; the 9,340 value is a valid floor but corresponds to excluding ByteRover, not just per-dispatch ATC |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| verify.mjs exits 0 | `node .planning/phases/09-atc-147-evidence/verify.mjs` | "PASS: all 7 invariants hold" | PASS |
| verify.mjs catches headline mutation | mutate headline_finding_count=0, run verifier | "FAIL invariant 3: headline_finding_count is 0, expected 4" | PASS |
| SHA pin resolves in external repo | `git cat-file -t ca5be16b` + `c41634c4` in project-clarity-erp | both return "commit" | PASS |
| Dispatch denominator matches git log | `git log --oneline ca5be16b..c41634c4 \| wc -l` | 16 T-commits | PASS |
| Upper bound arithmetic | sum of 9 total_bypass_cost rows | 18,940 | PASS |

---

## Human Verification Required

None — all phase deliverables are mechanical artifacts (YAML, markdown, .mjs) verifiable programmatically.

---

## Gaps Summary

No blocking gaps. Phase goal is achieved: the empirical finding count (4, in the ≥3 bracket) is grounded in a real external review, the gate-bypass audit covers all 9 gates with traceable token estimates, the evidence registry is SHA-pinned and path-linked, and the mechanical verifier enforces all 7 key invariants.

One arithmetic deviation: the lower-bound note in `09-gate-bypass.yaml` is internally contradictory (claims "LITE/SKIP on ATC = 14,140" then subtracts 4,800 again). The value 9,340 is arithmetically reachable (upper minus ByteRover), but the prose explanation is wrong. This is a WARNING, not a blocker — Phase 10 receives correct upper/lower bound numbers and per-row verdict pointers regardless. A one-line note correction is recommended before Phase 10 consumes this file.

---

_Verified: 2026-04-22_
_Verifier: Claude (gsd-verifier)_
