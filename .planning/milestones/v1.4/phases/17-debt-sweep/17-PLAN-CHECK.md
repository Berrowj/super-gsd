# Phase 17 Plan Check — WARN

## Goal-backward verification (7 CLEAN items)

| REQ-ID   | Plan  | Task(s) | Hypothesis falsifiable? | Verdict |
|----------|-------|---------|-------------------------|---------|
| CLEAN-01 | 17-01 | T1      | Yes — grep + node --check, specific lines named (17-19, 137-138, 157-158) | ✓ PASS |
| CLEAN-02 | 17-01 | T2      | Yes — both edit sites (accumulation loop + hardcoded 3-row table) explicitly addressed; QUAL_V/INVT_V named | ✓ PASS |
| CLEAN-03 | 17-02 | T1      | Yes — file existence + frontmatter key-set match + commit SHA extraction all specified | ✓ PASS |
| CLEAN-04 | 17-02 | T2      | Yes — 3 files named; mandatory frontmatter fields in stop_rule + verification_cmd | ✓ PASS |
| CLEAN-05 | 17-02 | T3      | Partial — v1.2 archive existence checked; v1.3-REQUIREMENTS.md check absent from verification_cmd | ⚠ WARN |
| CLEAN-06 | 17-03 | T1, T2  | Partial — MILESTONES.md Shipped + ROADMAP.md collapse + git tag covered; v1.2-ROADMAP.md archive file NOT in any task | ✗ GAP |
| CLEAN-07 | 17-03 | T3,T4,T5,T6 | Yes — all 4 consumers (codex-exec.sh, config.json, SKILL.md×3, sgsd-muda-audit.sh) named with specific tier args | ✓ PASS |

## Cross-cutting checks

- Dependency ordering (17-03 depends_on 17-01): ✓
- CLEAN-02 two-edit-site (accumulation loop + table): ✓
- SKILL.md serialization in 17-03 (T3 before T5/T6 via depends_on): ✓
- CLEAN-06 tag target 0191168 (verification_cmd checks git rev-parse): ✓
- P5 artifact location (.planning/milestones/v1.3/phases/p5-codex-monitor/): ✓
- LITE tier on 17-02 (expected_ATC_tier: LITE declared): ✓
- Per-dispatch ATC routing intent (D-06 dogfood, 17-01 + 17-03 FULL): ✓

## Gaps / Warnings

**GAP — CLEAN-06: v1.2-ROADMAP.md archive file missing from plans**
REQUIREMENTS.md CLEAN-06 acceptance criteria: "create `.planning/milestones/v1.2-ROADMAP.md` archive (from current ROADMAP.md Phase-9-through-13 content + MILESTONES.md v1.2 entry narrative)".
17-03/T1 files_touched = [`.planning/MILESTONES.md`, `.planning/ROADMAP.md`] — collapse only, no archive file.
Neither T1 nor T2 mentions creating `.planning/milestones/v1.2-ROADMAP.md`.
Fix: Add v1.2-ROADMAP.md to T1 files_touched + output_contract + success_criteria.

**WARN — CLEAN-05: v1.3-REQUIREMENTS.md check absent from verification_cmd**
REQUIREMENTS.md CLEAN-05 AC: "`.planning/milestones/v1.3-REQUIREMENTS.md` exists (already shipped)."
17-02/T3 verification_cmd checks only v1.2-REQUIREMENTS.md.
Low risk (v1.3-REQUIREMENTS.md was confirmed shipped and is unlikely to vanish), but AC is not fully proven by plan.
Fix: Add `test -f .planning/milestones/v1.3-REQUIREMENTS.md` to T3 verification_cmd.

## Verdict

WARN: 6/7 requirements fully owned. CLEAN-06 has a concrete gap — the v1.2-ROADMAP.md archive file required by the acceptance criteria appears in no task's files_touched, output_contract, or success_criteria. CLEAN-05 has a minor verification gap. All other requirements and cross-cutting checks pass. The CLEAN-06 gap is addressable by adding one file to T1 without a plan split.
