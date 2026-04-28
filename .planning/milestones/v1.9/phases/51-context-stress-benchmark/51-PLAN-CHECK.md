---
phase: 51
checked: 2026-04-28
checker: gsd-plan-checker
plan: 51-01-context-stress-benchmark-PLAN.md
verdict: warn
blockers: 0
warnings: 5
infos: 3
---

# Phase 51 Plan Check Verdict

## VERDICT: WARN (proceed with amendments)

The plan is fundamentally sound: it correctly maps to RESEARCH.md locked decisions, decomposes 7 tasks against the contracts (6 fixtures + 16 injectors + 18 assertions + 5 public APIs), respects Lock 4 (import-by-reference) and Lock 11 (no semantic similarity), and binds the falsifiable claim (>=50% reduction + 100% retention) to the median-aggregate gate at section 4.4 of RESEARCH. T1-T7 dependency graph is acyclic and disjoint files_touched (modulo harness.cjs serial-touch by all tasks, addressed in wave_decomposition).

However, 5 warnings need addressing before execution because they affect goal achievement, not just plan structure. None are blockers; T7 can adapt at execution time, but the planner should pre-resolve to avoid mid-execution thrash.

---

## Per-Task Analysis

### T1 (skeleton + scenario schema) - PASS
- Bootstrap 3-5 assertions are right-sized (Object.freeze, public-API surface, BENCH_REASON_CODES >=10).
- ASCII-only constraint correctly inherited from CLAUDE.md.
- SCENARIO.schema.json closed-enum design (kind, must_appear_in) prevents fixture drift.
- Falsifier correctly forbids relative-path imports of Phase 41-50 modules (Lock 4).

### T2 (baseline ledger reader) - PASS-WITH-NOTE
- Correctly imports summarize by reference; no fork.
- assertWorkspaceClean secret-prefix paranoia (AKIA, sk-, ghp_) implements CLAUDE.md absolute rule beautifully.
- NOTE: Self-test 9 anchor "S2 baseline >= 150,000 tokens" is testable and the live ledger has 26,491 rows (grew from 11,294 cited in RESEARCH; growth is fine because the assertion uses >=).
- NOTE: summarize filter is {role: scenario.drawn_from.role} (singular). Lock R1 researcher+planner aggregate is correctly satisfied at the SCENARIO level (S4 is planner; S1-S3+S5+S6 are researcher) and at the AGGREGATE level by the median over all 6 scenarios in T6 aggregateGate. Two-stage aggregation is internally consistent with section 4.4.

### T3 (6 baseline scenario fixtures) - PASS
- Each fixture baseline_signature.source_event_id MUST resolve to a real ledger row, catches fictional scenarios.
- S5 enumerates only review-ledger + verifier_verdict (Q7 Lock; correctly tests Phase 47 substitution).
- Object.freeze on SCENARIOS array length 6 prevents accidental 7th scenario.

### T4 (16-fixture failure injection) - PASS-WITH-NOTE
- snapshot/inject/observe/restore mandatory 4-step protocol with hash-equality assertion is the correct anti-pollution mechanism.
- F10 SECRET_PLACEHOLDER_X literal correctly enforces CLAUDE.md absolute rule.
- F11 (semantic-only) injection correctly leverages Phase 45 REASON_VOCAB closure (no semantic_similarity_only entry), Lock 11 mechanically enforced by the consumer, not by the injector.
- F8 byte-verbatim CRIT preservation is testable via byte-equality assertion (Test 13).
- Soft-skip semantics for F12-F15 (bench_fixture_skipped:phase_49_writer_unwired) is correct - RESEARCH section 13 confirms memory-revocations.jsonl and memory-demotions.jsonl do NOT YET EXIST in canonical location, so soft-skip is the only graceful path. Verified by direct filesystem check.
- NOTE: Self-test 11 (canonical fingerprint guard) lists 4 streams. route-decisions.jsonl does NOT yet exist on disk; when F1-F16 self-test runs, the fingerprint of a missing file is well-defined (sha256 of empty bytes / mtime=0). T4 should explicitly document the stream-doesnt-yet-exist baseline, otherwise self-test 11 may FAIL deterministically on first run.

### T5 (hybrid replay --mode=full) - WARN-LEVEL
- Anti-cheat boundary mirror to sgsd-blind-live-controller.mjs is the correct pattern (verified by direct read of source).
- Token ceiling at 1.5M is sane (Q1 Lock).
- Lock 13 graceful downgrade on missing claude CLI is correct.
- WARNING 1 (W1): Test 18 asserts route-decisions.jsonl gains rows with matching scenario_id. Phase 47 route.cjs row shape (verified by direct grep) does NOT include a scenario_id field; only run_id is the identifier. Recommendation: Test 18 must match by run_id_prefix=bench-post-{scenario_id}- substring (the unforgeable witness per T5 step 4), not by a literal scenario_id field. Otherwise this assertion will fail at execution.
- WARNING 2 (W2): --mode=ledger-only returns tokens_after = null (per T2 stub line 259). pct_reduction formula is undefined. Recommendation: T6 must explicitly handle tokens_after === null -> pct_reduction = null, verdict = PASS-WITH-DEFERRED-N. Currently implied but never spelled out.

### T6 (scoring + report renderer) - WARN-LEVEL
- Median (not mean) aggregation correctly implements Pitfall 2 fix.
- evidence_retention deterministic set-membership oracle correctly implements Lock 11.
- PASS-WITH-DEFERRED-N at median in [0.40, 0.50) is the right tier for VTP-DELTA CANDIDATE-WITH-DEBT.
- WARNING 3 (W3): BENCH-03 useful_findings_per_token requires useful_findings field on every ledger row. Phase 41 schema (report.cjs:148-153) computes this only for role IN (researcher, executor, planner). Older rows may have useful_findings: 0, dragging metric to zero. Recommendation: T6 must specify behavior when baseline sum(useful_findings) === 0 - emit null, render as em-dash.
- WARNING 4 (W4 - CRITICAL): evidence_retention oracle reads postArtifacts and checks expected_evidence membership. T5 replayScenario returns post_artifacts but does NOT specify population. Without a deterministic source, evidence_retention defaults to 0.0 and every scenario hard-fails for the WRONG reason. SIMPLEST FIX: post_artifacts = [...packet.metadata.consumed_capsule_decisions, ...packet.bypass_refs, ...packet.metadata.consumed_atc_findings]. This is fully deterministic, byte-equality-checkable, Lock-11-compliant. Most important amendment.

### T7 (self-test entry + milestone-close gate) - WARN-LEVEL
- run-self-test.cjs as a thin shim is correct.
- Lock 13 wrap on milestone-close hook is correctly specified.
- 18-assertion list-lock prevents silent test disable.
- WARNING 5 (W5): T7 says Edits super-gsd/scripts/sgsd-complete-milestone.cjs. THIS FILE DOES NOT EXIST. Verified: ls super-gsd/scripts/ contains no sgsd-complete-milestone.cjs. Closest: sgsd-distill-milestone.sh, sgsd-headless.{ps1,sh}. Recommendation: Either (a) executor CREATES the file as a stub referenced from CLAUDE.md as the operator command for milestone close, OR (b) edit the actual close-hook (e.g., sgsd-headless.sh final step). Without a downstream consumer, the milestone-close gate is non-binding.

---

## Goal Achievement Narrative

> If executor completes T1-T7 atomically and self-test passes 18/18, does Phase 51 actually achieve the falsifiable bar?

Partial yes - depends on environment + 5 warnings resolved.

### a. Will the harness MEASURE researcher token reduction? - YES (with caveat)
- T2 readBaselineFromLedger correctly reuses summarize() (Lock 4) and filters by role+phase+milestone. Per-scenario role filter is correct (S1-S3+S5+S6 researcher; S4 planner); aggregation across both roles happens implicitly in T6 median over 6 scenarios. Lock R1 satisfied at aggregate level.
- Phase 41 ledger has 26,491 rows of REAL token evidence; baseline is real.
- Caveat: tokens_after only measured in --mode=full; W2 means --mode=ledger-only emits PASS-WITH-DEFERRED-N rather than proving the headline claim. Phase 51 cannot fully prove >=50% reduction unless claude CLI is on operator machine.

### b. Will it MEASURE evidence retention or hand-wave it? - YES IF W4 RESOLVED
- T6 scoreScenario correctly implements byte-equality set-membership oracle (Lock 11). Code Example 9.3 in RESEARCH is right.
- Critical gap (W4): Without specifying post_artifacts population, evidence_retention will default to 0.0 and every scenario hard-fails - for the WRONG reason.
- W4 must be resolved before execution begins. The simplest path is to populate post_artifacts from packet.metadata + packet.bypass_refs (deterministic, byte-equality-checkable).

### c. Will failure injection FAIL HARD on Phase 41 mode and DEGRADE GRACEFULLY on Phase 42-50? - MIXED
- Plan does NOT distinguish Phase 41 mode from Phase 42-50 mode explicitly. F1-F16 are scenario-overlay tests, not phase-mode tests. Each injector treated symmetrically (snapshot/inject/observe/restore + verify gate fired).
- Probably fine because each injector expected outcome is per-fixture in RESEARCH section 3.1: F8 = byte-verbatim preservation = HARD; F12-F15 = soft-skip if writer unwired = GRACEFUL.
- No remediation needed. If user intent was to test phase-mode strictness as DIFFERENT MODES, this plan does not implement that - it implements per-fixture gates which is what RESEARCH actually specifies.

### d. Does T5 hybrid replay produce REAL token data, or could stubbed dispatch slip through? - REAL (with W1 fix)
- Test 18 (real-dispatch witness) is the correct anti-stub mechanism; asserts route-decisions.jsonl gains rows during --mode=full.
- W1 fix needed: match by run_id substring, not by literal scenario_id field.
- claude CLI absent -> ledger-only -> no Sonnet dispatch -> route-decisions.jsonl also gains 0 rows. Test 18 must distinguish 0-rows-because-no-dispatch (ledger-only) from 0-rows-because-stubbed (a bug). Recommendation: Test 18 conditional on mode_used == full AND claudeBinary != null.

---

## Cross-Plan Integration Check

The plan correctly imports by reference from Phase 41/43/44/45/47/49 modules. Direct verification by Grep confirms:

| Module | Imported in T# | Symbol | Verified? |
|--------|---------------|--------|-----------|
| super-gsd/tools/token-attribution/report.cjs | T2, T6 | summarize | exists at line 513 |
| super-gsd/tools/context-packet/build.cjs | T5 | buildPacket | exists |
| super-gsd/tools/context-registry/check.cjs | T1 | validateReferences | assumed exists per RESEARCH section 13 |
| super-gsd/tools/dispatch-router/route.cjs | T4, T5 | route-decisions row shape | exists, but does NOT include scenario_id field (W1) |
| super-gsd/tools/phase-capsule/write.cjs | T4 (F8) | _gatherBypassRefs | assumed exists per RESEARCH section 13 |
| super-gsd/tools/memory-governance/lifecycle.cjs | T4 (F12-F15) | revocations/demotions writers | files NOT yet on disk -> soft-skip path correctly invoked |
| super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs | T5 (mirror) | anti-cheat pattern | exists |
| .planning/metrics/agent-token-spend.jsonl | T2 | baseline ledger | 26,491 rows (grew from 11,294 cited; uses >= so OK) |
| .planning/metrics/route-decisions.jsonl | T5 (Test 18) | dispatch witness | does NOT yet exist on disk -> Phase 47 has not written first row, or writer not wired |
| .planning/metrics/memory-revocations.jsonl | T4 (F12) | gracefully soft-skipped | does NOT exist (per RESEARCH section 13) |
| .planning/metrics/memory-demotions.jsonl | T4 (F15) | gracefully soft-skipped | does NOT exist (per RESEARCH section 13) |
| super-gsd/scripts/sgsd-complete-milestone.cjs | T7 (edit) | milestone-close hook | DOES NOT EXIST (W5) |

---

## Lock Invariant Verification

| Lock | Mechanically Enforced in Plan? | Evidence |
|------|-------------------------------|----------|
| Lock 2 (.planning + git canonical) | YES | T6 writes .planning/milestones/v1.9/CONTEXT-BENCH-RESULTS.md; never primary-writes to Redis |
| Lock 4 (import-by-reference) | YES | T2/T4/T5/T6 falsifiers reject forks/reimplementations of summarize/buildPacket/etc. |
| Lock 6 (bypass byte-verbatim) | YES | F8/F16 self-tests assert byte-equality of CRIT text in packet body |
| Lock 11 (no semantic similarity) | YES | T6 falsifier line 493 rejects regex/levenshtein/embedding; oracle uses kind+ref byte-equality only |
| Lock 12 (prompt injection as data) | YES | F10 self-test 14 verifies fenced-code wrap + intent-map flag |
| Lock 13 (never throws upward) | YES (mostly) | All 5 public APIs wrapped per success_criteria. T7 milestone-close hook also Lock 13 wrapped. T1 bootstrap stubs may not yet have try/catch wrappers - bootstrap self-test should assert try{ substring exists in each public-API function body. |

Lock 11 audit: plan verification line 741 (grep -niE 'embedding|cosine|levenshtein|fuzzy|semantic_similarity|similarity_score' super-gsd/tools/context-bench/) returns 0 matches. Sound. The verification will catch any regression.

Lock 13 audit: plan verification line 742 (grep on each function name + body for try{) is weaker than ideal (could pass with try{}catch(e){throw e}), but combined with self-test assertions for graceful-degradation paths (claudeBinary=null -> ledger-only), it is sufficient.

---

## Token Budget for Plan Execution

Estimated cost of executing T1-T7 to green:

| Task | Files Touched | Estimated Lines | Sonnet Tokens |
|------|---------------|-----------------|---------------|
| T1 | 3 | ~250 | ~25k |
| T2 | 1 | ~150 | ~20k |
| T3 | 7 (6 fixtures + harness const) | ~300 | ~30k |
| T4 | 2 | ~600 (16 injectors) | ~50k |
| T5 | 2 | ~250 | ~30k |
| T6 | 5 | ~400 | ~40k |
| T7 | 3 | ~150 | ~20k |
| Total | | ~2,100 lines | ~215k tokens |

Plus --mode=full validation: ~300k Sonnet tokens (6 scenarios x ~50k each per RESEARCH section 2.3).

Total Phase 51 cost: ~515k tokens (executor) + ~300k tokens (post-Sonnet validation) = ~815k tokens.

This is well under the v1.9 baseline orchestrator turn (1.24M tokens at v1.9/P41) and proves the headline claim with margin. The >=50% reduction bar is self-falsifiable at acceptable cost.

---

## Surgical Constraint Compliance

files_modified in plan frontmatter (lines 10-27) confirms NO file under super-gsd/tools/{token-attribution, token-waste, phase-capsule, context-registry, context-packet, sqlite-context-index, dispatch-router, vtp-bridge, memory-governance} is touched. T7 stop_rule + falsifier explicitly verify with git diff --quiet. Read-only invariant on Phase 41-50 tool trees is mechanically enforced.

The only non-tool-tree edit outside super-gsd/tools/context-bench/ is super-gsd/scripts/sgsd-complete-milestone.cjs (W5). This script is NOT in the protected list, so the invariant holds. But W5 file-doesn't-exist issue still needs resolution.

Disjoint files_touched check across T1-T7:
- T1: harness.cjs, SCHEMA.md, SCENARIO.schema.json (disjoint)
- T2: replay.cjs (disjoint)
- T3: scenarios/{S1..S6}.json + harness.cjs (SCENARIOS const region only)
- T4: failure-injectors.cjs + harness.cjs (INJECTION_FIXTURES const region only)
- T5: replay.cjs (extends T2 stub) + harness.cjs (replay wiring region only)
- T6: scoring.cjs, BENCHMARK-REPORT.template.md, harness.cjs (runBench region) + 2 .planning outputs
- T7: run-self-test.cjs + harness.cjs (final consolidation) + sgsd-complete-milestone.cjs

harness.cjs is touched by every task. wave_decomposition correctly notes this and recommends sequential edits. Acceptable.

---

## Concerns / Recommended Amendments

### Blockers: 0

### Warnings (must address before T5/T6 begin):

**W1 - route.cjs row shape mismatch (T5 Test 18)**
Test 18 asserts route-decisions.jsonl gains rows with matching scenario_id. Phase 47 does not write a scenario_id field. Fix: Match by run_id_prefix=bench-post-{scenario_id}- substring (the actual unforgeable witness). Update T5 output_contract step 5 to use run_id substring match.

**W2 - --mode=ledger-only pct_reduction undefined**
When tokens_after is null, pct_reduction formula is undefined. Fix: T6 must specify tokens_after === null -> pct_reduction = null, verdict = PASS-WITH-DEFERRED-N, reason_codes = [bench_fixture_skipped:claude_cli_unavailable]. Make this explicit in T6 output_contract.

**W3 - useful_findings_per_token may be zero on legacy rows**
Phase 41 ledger has rows pre-dating the useful_findings retrofit. Fix: T6 must specify behavior when baseline sum(useful_findings) === 0: emit null rather than 0, render as em-dash in report.

**W4 - post_artifacts source not specified (THE CRITICAL GAP)**
T5 replayScenario returns post_artifacts but does not specify population. T6 scoreScenario consumes it. Without a deterministic population step, evidence_retention defaults to 0.0 and every scenario hard-fails - for the wrong reason. Fix (recommended): T5 output_contract specifies post_artifacts = [...packet.metadata.consumed_capsule_decisions, ...packet.bypass_refs, ...packet.metadata.consumed_atc_findings]. Fully deterministic, byte-equality-checkable, Lock-11-compliant. Single most important amendment.

**W5 - sgsd-complete-milestone.cjs does not exist**
T7 says edit but the file does not exist. Fix: Change T7 to create-or-edit and specify the wider entry-point. Recommend either (a) creating it as a stub referenced from CLAUDE.md as the operator command for milestone close, or (b) identifying the actual close-hook (e.g., sgsd-headless.sh final step) and editing that instead.

### Infos (nice-to-have):

**I1 - Self-test 11 baseline behavior on missing streams**
When route-decisions.jsonl does not exist on disk yet, the canonical fingerprint guard (Test 11/18) must define the before hash as the fingerprint of an empty/absent file. Document this explicitly in T4.

**I2 - RESEARCH cites 11,294 ledger rows; live count is 26,491**
RESEARCH.md is 1 day old; the ledger grew. T2 S2 anchor uses >= 150,000 tokens so the assertion still holds. No code change needed; just an awareness note.

**I3 - Dimension-7 (architectural tier compliance) not applicable**
Phase 51 is a Local Node script with zero browser/API/database tier concerns. The Architectural Responsibility Map at RESEARCH:76 is correctly populated and consistent with the plan files_modified. No tier mismatch.

---

## Summary

**Verdict: WARN (proceed with 5 amendments)**

The plan is structurally complete (frontmatter valid, 8 requirements all covered, dependency graph acyclic, Lock invariants enforced) and aligned with RESEARCH.md locked decisions. T1-T7 will achieve the falsifiable bar IF:

1. **W4 (the critical gap)** is resolved: specify post_artifacts population from packet metadata.
2. **W1** is resolved: Test 18 matches by run_id substring, not scenario_id field.
3. **W2** is resolved: ledger-only mode emits null pct_reduction with PASS-WITH-DEFERRED-N.
4. **W3** is resolved: useful_findings=0 case handled gracefully.
5. **W5** is resolved: sgsd-complete-milestone.cjs creation contract clarified.

The orchestrator should return this verdict to the planner for amendment, then re-verify. At second pass, with W1-W5 addressed in plan text, expect **PASS**.

The plan respects Lock 4 (Phase 41-50 byte-untouched), Lock 11 (no semantic similarity), and Lock 13 (never-throws-upward). The 18-assertion self-test is well-shaped and ~60-second runtime is plausible. The hybrid replay anti-cheat boundary mirror to sgsd-blind-live-controller.mjs is the right architectural decision. Token budget (~815k) is well below the v1.9/P41 baseline single turn (1.24M), proving the bench is self-funding under its own headline claim.
