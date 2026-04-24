---
schema_version: 2
phase: 17
plan: "17-01"
wave: 1
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: []
goal: "Fix providers-registry.cjs JSDoc drift + dead branch (CLEAN-01); sync sgsd-muda-audit.sh WASTE.md summary to cover all 5 probes (CLEAN-02)"
tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/lib/providers-registry.cjs"
    input_contract: "17-CONTEXT.md CLEAN-01 + 17-RESEARCH.md CLEAN-01 validation + 15-ATC-REVIEW.md finding IDs WR-01/WR-02"
    output_contract: "providers-registry.cjs lines 17-19 + 137-138 JSDoc updated; lines 157-158 dead || fallback deleted; file passes lint. Commit: fix(17-01/T1): CLEAN-01 refresh providers-registry JSDoc + delete dead fallback branch (WR-01/WR-02)"
    hypothesis: "providers-registry.cjs is lint-clean and dead-code-free — JSDoc no longer references stale reviewer_agent shape and the unreachable || fallback is removed"
    falsifier: "grep -n 'reviewer_agent' super-gsd/scripts/lib/providers-registry.cjs still returns lines 17-19 or 137-138 after edit, OR lines 157-158 still contain the || loadReviewProvidersConfig fallback"
    stop_rule: "grep -c 'reviewer_agent' returns 0 AND lines 157-158 contain no || fallback AND node --check super-gsd/scripts/lib/providers-registry.cjs exits 0"
    verification_cmd: "grep -n 'reviewer_agent' super-gsd/scripts/lib/providers-registry.cjs | wc -l | grep -q '^0$' && node --check super-gsd/scripts/lib/providers-registry.cjs && echo PASS"
    known_deadends: []

  - id: "T2"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-muda-audit.sh"
    input_contract: "17-RESEARCH.md CLEAN-02 validation (lines 170-173 accumulation loop + line 386 4th probe row); sgsd-muda-audit.sh lines 155-215 (read before editing)"
    output_contract: "sgsd-muda-audit.sh accumulation loop at lines 170-173 extended to include $QUAL_V and $INVT_V; compose_waste_md table rows match actual probe count (5 rows, not 3); summary sentence reflects updated fail_count/warn_count. Commit: fix(17-01/T2): CLEAN-02 extend WASTE.md summary accumulation to 5 probes (extra_processing + inventory)"
    hypothesis: "WASTE.md summary table reflects actual probe verdicts for all 5 probes (not hardcoded 3 rows) and fail_count/warn_count are computed from all 5 values"
    falsifier: "Running sgsd-muda-audit.sh and inspecting WASTE.md still shows only 3 rows in Probe Results table, or fail_count does not increment when QUAL_V=FAIL"
    stop_rule: "compose_waste_md generates 5 probe rows; accumulation loop iterates over $HAIKU_V $NARR_V $GIT_V $QUAL_V $INVT_V; bash -n super-gsd/scripts/sgsd-muda-audit.sh exits 0"
    depends_on: []
    verification_cmd: "bash -n super-gsd/scripts/sgsd-muda-audit.sh && grep -A2 'for v in' super-gsd/scripts/sgsd-muda-audit.sh | grep -q 'QUAL_V' && echo PASS"
    known_deadends: []
---

<objective>
Fix two concrete code defects that carry over from Phase 15's ATC review findings (WR-01, WR-02) and the MUDA display inconsistency noted in v1.3-MILESTONE-AUDIT.md.

**T1** corrects stale JSDoc in `providers-registry.cjs` (lines 17-19, 137-138 still reference the old `reviewer_agent` field shape) and deletes the unreachable `||` fallback branch at lines 157-158.

**T2** extends the `compose_waste_md` summary accumulation loop in `sgsd-muda-audit.sh` from 3 probes to 5, so `fail_count`/`warn_count` and the Probe Results table consistently reflect all running probes including qualitative (QUAL) and inventory (INVT).
</objective>

<context>
@.planning/milestones/v1.4/phases/17-debt-sweep/17-CONTEXT.md
@.planning/milestones/v1.4/phases/17-debt-sweep/17-RESEARCH.md
@.planning/milestones/v1.3-MILESTONE-AUDIT.md

Read before T1: super-gsd/scripts/lib/providers-registry.cjs lines 10-165
Read before T2: super-gsd/scripts/sgsd-muda-audit.sh lines 155-215
</context>

<tasks>

**T1 — CLEAN-01: providers-registry.cjs JSDoc + dead branch**

Files: `super-gsd/scripts/lib/providers-registry.cjs`

Edit sites (surgical — do not touch surrounding logic):
1. Lines 17-19: JSDoc `@returns` — replace `reviewer_agent` references with the current field name used in production gate records (check live code to confirm correct field name; likely `reviewer_provider`).
2. Lines 137-138: JSDoc step 2 — same `reviewer_agent` → `reviewer_provider` update.
3. Lines 157-158: Delete the dead `|| loadReviewProvidersConfig(...).default_provider` fallback. The `if (!gate || !gate.reviewer_provider) return null` guard at line 155 makes this branch unreachable.

Commit: `fix(17-01/T1): CLEAN-01 refresh providers-registry JSDoc + delete dead fallback branch (WR-01/WR-02)`

Verify: `node --check super-gsd/scripts/lib/providers-registry.cjs` exits 0; `grep -c 'reviewer_agent'` returns 0.

---

**T2 — CLEAN-02: sgsd-muda-audit.sh WASTE.md display sync**

Files: `super-gsd/scripts/sgsd-muda-audit.sh`

Read lines 155-215 before editing. Two distinct edit sites:

1. **Accumulation loop (lines 170-173):** The loop `for v in "$HAIKU_V" "$NARR_V" "$GIT_V"` only counts 3 probes. Extend it to include `$QUAL_V` and `$INVT_V` so `fail_count` and `warn_count` accumulate over all 5 probe verdicts.

2. **Hardcoded 3-row table in `compose_waste_md`:** The function generates rows only for `haiku_fails`, `narrative_age_sec`, `git_spawn_pct`. Add rows for the qualitative overproduction probe (line 386 emits this verdict into WASTE.md but `compose_waste_md` does not include it) and the inventory probe. Match the existing row format exactly.

Also update the summary sentence (lines 193-199) if it references a fixed probe count — replace with the actual computed count.

Commit: `fix(17-01/T2): CLEAN-02 extend WASTE.md summary accumulation to 5 probes (extra_processing + inventory)`

Verify: `bash -n super-gsd/scripts/sgsd-muda-audit.sh` exits 0; grep confirms QUAL_V in the accumulation loop.

</tasks>

<success_criteria>
- `grep -c 'reviewer_agent' super-gsd/scripts/lib/providers-registry.cjs` returns 0
- `node --check super-gsd/scripts/lib/providers-registry.cjs` exits 0
- `bash -n super-gsd/scripts/sgsd-muda-audit.sh` exits 0
- Accumulation loop in sgsd-muda-audit.sh includes QUAL_V and INVT_V
- compose_waste_md generates 5 probe rows
- 2 atomic commits present with format `fix(17-01/T{N}): ...`
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/17-debt-sweep/17-01-SUMMARY.md`
</output>
