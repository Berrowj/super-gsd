# 15-02 Per-Dispatch ATC Review

**Plan:** 15-02
**Tier:** FULL
**Commits:** 1d22265..3b5178b (T1 + T2)
**Reviewed:** 2026-04-24T01:55:53Z
**Verdict:** WARN — 0 critical, 2 warnings

---

## Findings

### WR-01 — DIFF_LINES awk field mismatch (silent under-count)

**File:** `super-gsd/scripts/sgsd-muda-audit.sh:321`
**Severity:** Warning
**Issue:** The awk expression `sum+=$1+$3` on the `git diff --stat` summary line computes
`{file_count} + {literal "changed," treated as 0}`, not insertions+deletions.
For a typical run: `3 files changed, 30 insertions(+)` → result is `3`, never reaching
the 200-line threshold that gates CODEX-08 execution.
The qualitative probe will never fire in practice, silently making the feature inert.

**Correct expression:** `sum+=$4+$6` (insertions at field 4, deletions at field 6).
With deletions absent: `3 files changed, 30 insertions(+)` → `30 + 0 = 30`.
Verified with `awk` locally.

**Fix:**
```bash
# Line 321 — replace:
DIFF_LINES=$(git -C "$PROJECT" diff --stat HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | awk '/changed/{sum+=$1+$3}END{print sum+0}')
# with:
DIFF_LINES=$(git -C "$PROJECT" diff --stat HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | awk '/changed/{sum+=$4+$6}END{print sum+0}')
```
Same fix applies at lines 332–334 where the diff is piped into the prompt (those are
`--stat | head` + `diff | head`, not affecting DIFF_LINES calculation, but for correctness
the threshold guard in the outer `if` already uses the miscounted var).

---

### WR-02 — curate_finding called with wrong arg order in qualitative block

**File:** `super-gsd/scripts/sgsd-muda-audit.sh:397-401`
**Severity:** Warning
**Issue:** `curate_finding` signature is `(name, verdict, value, class, evidence, threshold)`.
The qualitative block calls it as:
```bash
curate_finding \
  "waste-overproduction-p${PHASE_NUM}-${FINDING_SLUG}" \   # arg1 = name (double-prefixed)
  "overproduction" \                                         # arg2 = verdict (wrong — expects PASS/WARN/FAIL)
  "$finding_line" \                                          # arg3 = value (wrong — full finding text)
  "muda,overproduction,phase-${PHASE_NUM},automated,codex-qualitative"  # arg4 = class (wrong — tags string)
```
Arguments 2–4 are semantically wrong: `verdict` receives the waste class string,
`value` receives the raw finding text, and `class` receives a comma-separated tag list.
The resulting curated entry will have an invalid verdict (not `PASS`/`WARN`/`FAIL`)
and a malformed slug body. `evidence` and `threshold` are missing entirely (empty strings).

Additionally the name already embeds the `waste-overproduction-p{N}-` prefix,
but `curate_finding` re-prepends `waste-${class}-p${PHASE_NUM}-` to `$1` internally
(line 249), so slugs will be double-prefixed:
`waste-overproduction-p15-waste-overproduction-p15-{slug}`.

**Fix:** Pass the args in the correct positions and remove the prefix duplication:
```bash
curate_finding \
  "$FINDING_SLUG" \          # name (no prefix — curate_finding adds it)
  "WARN" \                   # verdict (qualitative findings are by definition WARNs)
  "$finding_line" \          # value (the finding text)
  "overproduction" \         # class
  "codex-qualitative" \      # evidence (source tag)
  ""                         # threshold (not applicable)
```

---

## Passing Checks

- **WARNING-1 fix (CODEX_QUAL_ENABLED guard):** `${CODEX_QUAL_ENABLED+x}` correctly
  distinguishes unset (fires config read) from set-to-any-value (uses caller's value).
  Verified all four env states: unset → fires; set true → skips; set false → skips;
  set empty → skips. Fix is correct.

- **gates.yaml qualitative-waste-audit row:** Schema is structurally consistent with
  other `reviewer_provider` gate rows. No `invocation`/`invocation_type` fields present
  (W-3 prevention honored). `in` and `not_in` operators are both implemented in
  predicate-eval.cjs (lines 85–86). Gate row is valid.

- **predicate-eval.cjs comment registry:** Single-line addition of `mechanical_muda_verdict`
  to the `DISPATCH_CONTEXT_FIELDS` comment block is correct and complete.

- **SKILL.md Step 9.2 `getMudaVerdictFromPhaseDir`:** Function is referenced but not
  defined inline — consistent with SKILL.md's pseudocode style (prose contract, not
  executable JS). The comment correctly documents the safe default (`PASS` when WASTE.md
  absent) and the two-phase gate ordering requirement (run MUDA-waste-audit → capture
  verdict → update ctx → evaluate qualitative gate).

- **Variable naming inconsistency (SKILL.md line 819 vs 820):** `phaseDir` (line 819)
  vs `currentPhaseDir` (line 820) appear in the same ctx block. Since SKILL.md is
  prose/pseudocode and both names refer to the current phase directory, this is an
  info-level inconsistency (not a runtime bug) — flagged for clarity, not as a warning.

- **`--probe codex` stub JSON:** Fields match what the node parser expects
  (`haiku_fails`, `narrative_age_sec`, `git_spawn_pct` with `verdict`/`value`/`evidence`).
  Stub is safe for isolated testing.

- **`COMMITS_IN_PHASE` unset variable:** Used with `:-1` default throughout — safe under
  `set -u`. No issue.

- **DRY_RUN guard on CODEX-08 block:** `$DRY_RUN != "true"` is correctly checked before
  firing codex-exec. Dry-run callers are fully protected from the qualitative probe.

- **SKIP row on codex-exec failure:** The else branch emits a `| SKIP |` row to WASTE.md
  and does not increment fail/warn counters. Non-blocking behavior is correct.

- **Single-commit scope:** T1 commit touches only sgsd-muda-audit.sh. T2 commit touches
  gates.yaml + predicate-eval.cjs + SKILL.md (three tightly coupled two-file-constraint
  parts). Both commits do one thing each. Scope is clean.

---

## ATC Anti-Slop Checklist (FULL tier)

1. Every new function/closure has a caller — `curate_finding` is defined + called. PASS
2. Every import is used — no new imports. PASS
3. Every parameter is read — see WR-02 (args positionally wrong, but all 4 are read). PASS
4. Could this be less code? — CODEX-08 block is necessarily detailed; not reducible. PASS
5. Abstractions justified — no new abstractions. PASS
6. Existing code does 80% — `curate_finding` is reused (partially broken by WR-02). PASS
7. Mass-delete test — CODEX-08 is gated behind CODEX_QUAL_ENABLED; inert until enabled. PASS
8. ΔComplexity — adds one conditional block + one loop; complexity increase is justified. PASS
9. YAGNI — `COMMITS_IN_PHASE` env var hook is a minor YAGNI (never set by any caller).
   Low risk (defaults to 1). INFO only.
10. Single commit scope — both commits do one thing. PASS
