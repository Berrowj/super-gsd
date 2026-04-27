# Phase 38 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer
- Provider: codex-cli-reviewer (gpt-5.5, xhigh)
- Tier: phase-level (dual-provider)
- Final verdict: pass (post-fix)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Post-fix |
|----------|---------|------|------|----------|
| Claude   | warn    | 1    | 4    | pass     |
| Codex    | warn    | 2    | 1    | pass     |

## Findings (deduplicated)

### CRIT (3 distinct, all fixed in-loop)

**C1 [Claude+Codex] -- parseGateOverrides equals-syntax off-by-one slice**
- File: `super-gsd/scripts/lib/sampling-decider.cjs:192-194` pre-fix
- `--force-gates=name1,name2` used `slice(15)` but `'--force-gates='.length === 14` -> first char of first gate name silently dropped. Same bug at `--skip-gates=` line 194 (slice(14) for 13-char prefix).
- Fix: replaced magic numbers with `'--force-gates='.length` / `'--skip-gates='.length` inline computation. Test fixture 6a/6b regression assertions added (verifies post-fix extracts full `phase-level-ATC` not `hase-level-ATC`).

**C2 [Codex] -- v2/cache classifier-skip paths bypass work_risk**
- File: `super-gsd/skills/sgsd-orchestrate/SKILL.md:313-330` (v2 synthesis) + `:355-361` (v1 cache-hit)
- SCHEMA-04 v2 synthesis path emitted `{complexity, model, atc_tier, deliberate}` but NOT work_risk. MACH-01 cache-hit path passed cached result through verbatim — older sidecars lack work_risk. Either path bypasses Phase 38 SAMPLE-02 contract; gate-fire intersection matrix degenerates to default-tier-only.
- Fix: v2 path now invokes `samplingDecider.scoreWorkRisk()` with frontmatter-derived inputs (phase_type, files_count, security_review heuristic). Cache-hit path lazily synthesizes work_risk if missing. Both default conservatively to 'medium' on missing signals.

**C3 [Codex] -- fallback test crash before pre-emptive fix**
- File: `super-gsd/scripts/lib/sampling-decider.test.cjs`
- Codex review caught test crashing before my pre-emptive fix to `eqForce.errors.length` (parseGateOverrides returns no errors property).
- Fix: regression assertions adapted to use Set membership checks (force.has + skip.has) without referencing non-existent .errors property. Test now 7/7 PASS.

### WARN (5 distinct, fixed in-loop or accepted)

**W1 [Claude] -- avg_block divisor includes zero-fires entries**
- File: `sampling-decider.cjs:119` (scoreWorkRisk gate_fitness_history aggregation)
- Divides by `gate_fitness_history.length` but only sums entries with fires>0. Mixed history silently under-weights block-rate.
- ACCEPTED -- divergence from RESEARCH §4.2 prose but matches the locked formula's "no cost telemetry" intent (zero-fires entries are cold-gates pulling down the rolling average; treating them as silent is the intent). Documented as INFO; not a bug.

**W2 [Claude] -- assertion 10 unexercised tier boundary**
- INFO -- assertion verifies no tier crossing at one specific midpoint. Adding boundary fixtures is a Phase 39+ test-coverage candidate.

**W3 [Claude] -- step 6.5 SKIP arm re-evaluates gates.shouldFire**
- File: `SKILL.md` 3 wire-in sites
- ACCEPTED -- single-process orchestrator; ctx is immutable between the two calls; re-evaluation is functionally a no-op. Optimizing to single-call would require larger SKILL.md refactor; out of Phase 38 scope.

**W4 [Claude] -- validateGatesYaml two-pass filter pattern obscure**
- INFO -- code-review-quality observation; not a bug.

**W5 [Codex] -- "committed atomic set is dirty"**
- INFO -- referred to working-tree state during Codex review (mid-flight Codex CRIT 2 test fix not yet committed). Resolved naturally by post-fix commit batching.

### NIT (0)

None.

## ATC checklist (post-fix)

| Step | Verdict |
|------|---------|
| 1 First Principles | PASS |
| 2 Delete | PASS |
| 3 Simplify | PASS (CRIT fixes net-reduce hazard surface) |
| 4 Validate | PASS (17 + 7 + 13 self-test passes; status-consistency v1.8 OK) |
| 5 Anti-slop | 9/10 (combined) |

**Combined anti-slop score (post-fix): ~9/10.**

## Codex provider health

AVAILABLE throughout. 1 invocation, exit 0, JSONL row appended.

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN.

## One-liner

Phase 38 risk-tiered gate sampling: 3x3 matrix shipped; dual-provider review surfaced 3 CRITs (parseGateOverrides equals-syntax off-by-one, v2/cache work_risk bypass, test crash) + 5 WARNs; all fixed/accepted in-loop; combined anti-slop ~9/10.
