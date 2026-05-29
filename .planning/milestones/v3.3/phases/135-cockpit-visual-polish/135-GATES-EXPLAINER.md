# SGSD Gates — Stage-Keyed Explainer for Cockpit Redesign

> Source-of-truth for the "Evidence & Gates" panel redesign. Maps the existing `super-gsd/registry/gates.yaml` (13 rows) to the NEW stage-centric predicate chain (CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE), and explains MUDA + ATC distinctly because those are the operator-named gates in the redesign.

## The mental model — what a gate IS

A **gate** in SGSD is a mechanical check that runs at a specific point in the phase lifecycle and produces a verdict. Three things define a gate:

1. **Stage** — when it fires (CONTEXT / PLAN / EXECUTE / VERIFY / CLOSE)
2. **Enforcement mode** — what failure means:
   - `hard-halt` (blocking) — orchestrator stops; operator must repair
   - `amortized` (blocking, batched) — fires at boundaries; failure blocks next batch
   - `soft-warn` — logs to WARN evidence row; continues; visible in cockpit
   - `disabled` — registered but turned off
3. **Sampling tier** — how often it actually runs:
   - `always` — every fire-point
   - `sampled-rate-50` — every other fire-point
   - `low-risk-skip` — skipped when other indicators say "low risk"
   - `disabled` — never

A gate's predicate is YES/NO. Aggregated across the active phase, the gates produce the **evidence chain**: 5 GREEN · 2 WARN · 0 FAIL · 3 PENDING (the counters in your mockup).

---

## Stage 1 · CONTEXT — what runs before any code is touched

Goal: prove the read-pack the agents will use is complete, fresh, and authoritative.

| Gate (registry name) | What it does | Mode | Stage trigger |
|---|---|---|---|
| **gate.context.completeness** (NEW — redesign target) | Walks the DLB-03 cascade (PROJECT.md core-value + active milestone INTENT.md + last completed phase SUMMARY.md + active phase CONTEXT.md). Pass = all 4 sources resolved + non-placeholder content. | `hard-halt` | enters phase |
| **context-selector-haiku** | Haiku picks which artefacts go into the read-pack. Pass = picks ≥1 source per cascade tier, doesn't exceed token budget. | `soft-warn` | enters phase |
| **sgsd-recall-queries** | Memory-recall queries against `.planning/memory/` substrate to surface relevant precedents. Pass = at least one recall result returned. | `soft-warn` (sampled-rate-50) | enters phase |
| **intent-injection** | Verifies milestone INTENT.md is actually injected into the agent prompt (not silently dropped). Pass = grep for the INTENT signature in the dispatch prompt. | `soft-warn` | per-dispatch |
| **vtp-enrichment** | If `.planning/config.json#workflow.triage_vtp_enrichment=true`, runs VTP retrieval (book corpus + research) and writes `VTP-EVIDENCE.md`. Pass = VTP MCP reachable + ≥1 doc-ID returned. **Escalates to `hard-halt` on api_error** (orchestrator override). | `soft-warn` (low-risk-skip when phase doesn't reference book content) | post-research |

**Cockpit display for CONTEXT stage:** show "context complete · 9 sources loaded" with a green chip. If any gate is WARN, show "context partial · 7/9 sources" with amber chip.

---

## Stage 2 · PLAN — what runs when the plan is being authored or about to be locked

Goal: prove the plan is schema-valid, the SACs are real-data-grounded, and the operator has approved if needed.

| Gate (registry name) | What it does | Mode | Stage trigger |
|---|---|---|---|
| **plan-schema-v2 validate** (mechanical, runs via `validate.cjs`) | Schema-validates the PLAN-LOCKED.md frontmatter against `plan-schema-v2.json`. Required: `schema_version: 2`, `tasks[]` with 9 required fields each, `semantic_acceptance_criteria[]` with ≥1 entry. SCHEMA-09 / DLB-07 enforces SACs at write-time. | `hard-halt` | plan write + load |
| **gate.plan.operator-approval** (NEW — redesign target) | Operator must explicitly approve plans flagged for human review (the FLOOR-bypass exception). Triggers when `expected_ATC_tier == GATE` OR plan modifies operator-decision-protected artefacts. | `hard-halt` (blocking) | plan close |
| **classifier-haiku** | Haiku determines `complexity`, `model` routing, and `expected_ATC_tier` (SKIP/LITE/FULL/GATE) when not declared by the plan. Pass = classifier returned a valid JSON with all 3 fields. | `soft-warn` | plan dispatch |

**Cockpit display for PLAN stage:** if `expected_ATC_tier=GATE` and operator hasn't approved → "awaits operator approval" amber chip + BLOCKING marker. If all else green → "plan validated · 4 tasks · 9 SACs ✓".

---

## Stage 3 · EXECUTE — what runs while code is being mutated

Goal: prove each dispatch is sane (per-dispatch ATC) and we're not bleeding tokens or dispatches.

| Gate (registry name) | What it does | Mode | Stage trigger |
|---|---|---|---|
| **per-dispatch-ATC** (the headline ATC gate) | Air Traffic Control quality check. Runs AFTER each Codex executor dispatch, BEFORE commit. Tier-based (SKIP/LITE/FULL/GATE — see ATC section below). On failure: blocks the commit; orchestrator must repair. | `hard-halt` | per Codex dispatch |
| **gate.execute.dispatch-ceiling** (NEW — redesign target) | Counts Codex dispatches in the active phase. Pass = `dispatch_count ≤ ceiling` (default ceiling 5). Operator-tunable via `.planning/config.json`. Tripping it = the phase is overproducing (MUDA waste class). | `soft-warn` (escalates to `hard-halt` at 2× ceiling) | per dispatch |
| **token-log** | Appends each dispatch's token spend to `.planning/metrics/token-log.jsonl`. Pass = log row written + parseable + within configured budget. | `soft-warn` | per dispatch |

**Cockpit display for EXECUTE stage:** show current `dispatch_count` against ceiling, warn at >ceiling, blocking at >2× ceiling. ATC tier badge per dispatch (SKIP/LITE/FULL/GATE).

---

## Stage 4 · VERIFY — what runs after code is written but before phase close

Goal: prove the work matches the SACs, the verifier's claims line up with evidence, and nothing has regressed.

| Gate (registry name) | What it does | Mode | Stage trigger |
|---|---|---|---|
| **gate.verify.self-test** (NEW — redesign target) | After each Codex executor commit, run the phase's self-test (or repo-wide). Pass = exit 0 + ALL SACs from PLAN-LOCKED.md pass + count ≥ prior baseline (no regression). | `hard-halt` | per commit + at phase close |
| **verifier-row-arithmetic** | Cross-checks the verifier agent's claimed pass count vs the actual self-test row count. Pass = `claimed_pass + claimed_fail == total_sacs` AND matches the actual runner output. | `soft-warn` | at phase close |
| **verifier-detail-vs-summary** | Verifies the verifier's free-form summary in VERIFICATION.md doesn't contradict the structured SAC table below it. Pass = no detected contradictions (e.g. summary says "all green" but table has a FAIL row). | `soft-warn` | at phase close |

**Cockpit display for VERIFY stage:** show "53/53 must hold post-edit" — pending while dispatch in progress, green when test suite passes.

---

## Stage 5 · CLOSE — what runs when the phase is about to close

Goal: prove the phase actually delivered on its INTENT, learnings were curated, and the operator approves (if needed).

| Gate (registry name) | What it does | Mode | Stage trigger |
|---|---|---|---|
| **phase-level-ATC** (the second ATC fire) | Phase-level ATC review (NOT per-dispatch). Runs after VERIFY green. Same 7 steps + 10-point anti-slop, but applied to the full phase diff, not just the last dispatch. Can downgrade a Step-8 verifier PASS verdict to PASS-WITH-DEFERRED-N if it finds residual issues. | `amortized` (blocking) | at phase close |
| **MUDA-waste-audit** | 8-waste watchdog (DLB-02). Captures: classifier failures, narrative staleness, git-spawn rate, extra-processing, inventory bloat. Writes WASTE.md + curates findings. Fires when `files_changed ≥ 4` OR `diff_lines ≥ 100`. Soft-warn — never blocks. | `soft-warn` (low-risk-skip when phase is tiny) | at phase close |
| **qualitative-waste-audit** | Companion to MUDA — surfaces qualitative waste (over-engineered abstractions, "just in case" additions, unjustified complexity). Sampled at 50% of phase closes. | `soft-warn` (sampled-rate-50) | at phase close |
| **sgsd-curate-learnings** | After a phase closes, calls `bash super-gsd/scripts/sgsd-curate.sh --dry-run` to surface candidate learnings worth promoting to `.planning/memory/` (scripts/patterns/decisions). Pass = curate proposals written without error. | `soft-warn` (sampled-rate-50) | post-phase-close |
| **gate.close.operator-promote** (NEW — redesign target) | Operator-gated promotion: phase verdict moves from PASS to "milestone-eligible" only when operator confirms. Required only for phases marked `operator_close_required` in PLAN frontmatter. | `hard-halt` (blocking when applicable) | terminal |

**Cockpit display for CLOSE stage:** depends-on chip ("depends on verify green") before VERIFY closes. Becomes pending → blocking on operator if applicable, then green at promote.

---

## ATC — the headline gate, explained

**A**ir **T**raffic **C**ontrol. The quality framework. Runs at TWO points:

### ATC fire #1 — per-dispatch (Stage EXECUTE)
After each Codex dispatch, before commit.

1. **Haiku classifier** picks tier:
   - **SKIP** (<10 lines, 1 file, no new files) → no check; commit immediately
   - **LITE** (10–50 lines, ≤3 files) → 2 checks (DELETE / SIMPLIFY); ~200 tokens; soft-warn deviations
   - **FULL** (50+ lines, 4+ files, OR any new file) → full 7-step checklist; ~500 tokens; critical issues add to DEVIATIONS + human review flag
   - **GATE** (new system / dependency / architecture / API) → FULL checks PLUS deliberation suggestion; ~500+ tokens; in auto-mode adds a `gate` flag to the commit

2. **The 7 steps** (from `~/.claude/atc/`):
   1. First Principles — challenge the requirement; is this needed?
   2. Delete — target ≥10% reduction
   3. Simplify — `ΔComplexity ≤ 0` on brownfield
   4. Accelerate — parallelize bottlenecks
   5. Automate — only what survived steps 1–4
   6. Validate — 7-point validation
   7. Checklist — 10-point anti-slop

3. **10-point anti-slop checklist** (memorize):
   1. Every new function/class has a caller (no orphans)
   2. Every import used (no dead imports)
   3. Every parameter read (no unused args)
   4. Could it be less code?
   5. Are new abstractions justified?
   6. Does existing code do 80% of this?
   7. Would a senior engineer mass-delete?
   8. `ΔComplexity ≤ 0`?
   9. Any "just in case" additions?
   10. Does this commit do ONE thing?

### ATC fire #2 — phase-level (Stage CLOSE)
After verifier verdict PASS, before phase-close commit. Same 7 + 10 applied to the FULL phase diff, not the last dispatch.

**Why ATC matters in the cockpit redesign:** ATC is what stops Codex from shipping orphan code, dead imports, premature abstractions, and "just in case" additions. It's the discipline gate. The cockpit should show ATC tier per dispatch + show the phase-level ATC verdict as a separate evidence row.

---

## MUDA — the lean gate, explained

**MUDA** = 「無駄」 = "waste" in Japanese. From the Toyota Production System (Lean). The 8 wastes:

1. **Defects** — bugs, broken tests
2. **Overproduction** — building more than needed
3. **Waiting** — idle dispatches, stalled phases
4. **Non-utilized talent** — skipped agents, missed gates
5. **Transportation** — passing data unnecessarily between agents
6. **Inventory** — stale plans, unread artefacts piling up
7. **Motion** — bouncing between agents/contexts
8. **Extra-processing** — over-engineering, gold-plating

### How SGSD's MUDA gate fires

`MUDA-waste-audit` (`sgsd-muda-audit` skill + script):
- **Trigger:** phase close when `files_changed ≥ 4` OR `diff_lines ≥ 100`
- **Mode:** `soft-warn` (low-risk-skip when phase is tiny)
- **What it checks:**
  - **Classifier-failure rate** — how often Haiku got the tier wrong
  - **Narrative staleness** — STATE.md / SUMMARY.md mtime vs last activity
  - **Git-spawn rate** — commits per task (target ≤2)
  - **Extra-processing** — premature abstractions, dead code surface
  - **Inventory** — unread plans, stale read-packs
- **What it produces:** `WASTE.md` in the phase directory + curated findings

### Why MUDA matters in the cockpit redesign

MUDA tells the operator "you're building TOO MUCH / WAITING TOO LONG / SHIPPING UNNECESSARY ABSTRACTIONS." It's the *do-less* gate. Where ATC says "is this clean?", MUDA says "is this needed?"

**Cockpit display for MUDA:** post-close evidence row with the 5-row probe table (failures, staleness, spawn-rate, extra-processing, inventory). Each row green/amber/red.

---

## Predicate chain for the active phase (what your mockup shows)

In your new "Evidence & Gates" panel, the **predicate chain** is the left-to-right view of the stage gates as they fire for the CURRENT phase:

```
CONTEXT  →  PLAN  →  EXECUTE  →  VERIFY  →  CLOSE
  GREEN     WARN     WARN       PENDING    PENDING
            BLOCKING
```

Each box is a **stage cell** and rolls up:
- the dominant verdict across all gates that ran at that stage (green / warn / fail / pending)
- the blocking flag (if any `hard-halt` gate is unresolved at that stage)
- a one-line "why" — the most important reason for the verdict

For the screenshot's PLAN cell:
> WARN · BLOCKING
> `plan.operator-approval`
> awaits operator approval

This is `gate.plan.operator-approval` being WARN (operator hasn't approved yet) AND blocking the predicate chain from advancing.

---

## Stage → gate matrix (reference)

| Stage | Gates that fire | Modes | Cockpit verdict source |
|---|---|---|---|
| **CONTEXT** | gate.context.completeness · context-selector-haiku · sgsd-recall-queries · intent-injection · vtp-enrichment | hard-halt + 4×soft-warn (+ escalation) | dominant verdict across 5 gates |
| **PLAN** | plan-schema-v2 validate · gate.plan.operator-approval · classifier-haiku | hard-halt · hard-halt · soft-warn | operator-approval is the blocker |
| **EXECUTE** | per-dispatch-ATC · gate.execute.dispatch-ceiling · token-log | hard-halt · soft-warn (escalating) · soft-warn | dispatch-ceiling drives warn count |
| **VERIFY** | gate.verify.self-test · verifier-row-arithmetic · verifier-detail-vs-summary | hard-halt + 2×soft-warn | self-test green = stage green |
| **CLOSE** | phase-level-ATC · MUDA-waste-audit · qualitative-waste-audit · sgsd-curate-learnings · gate.close.operator-promote | amortized + 3×soft-warn + hard-halt (conditional) | phase-level-ATC drives close-green |

---

## What the operator can do per stage when a gate is WARN/FAIL/PENDING

This is the **repair surface**. Each gate row in `gates.yaml` has a `repair_command` field. The cockpit should expose the repair commands as actions on each gate row.

Examples from the registry:
- `MUDA-waste-audit` warn → `bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run`
- `sgsd-curate-learnings` warn → `bash super-gsd/scripts/sgsd-curate.sh --dry-run`
- `gate.plan.operator-approval` blocking → operator decision (no repair command — operator action required)
- `gate.context.completeness` fail → walk the cascade manually (`/sgsd-discuss-phase {N}` for missing CONTEXT.md)

---

## Prompt-ready summary (paste into Claude Design / cockpit redesign)

> SGSD has 13 registered gates in `super-gsd/registry/gates.yaml` plus 5 stage-keyed gates in the new redesign (gate.context.completeness, gate.plan.operator-approval, gate.execute.dispatch-ceiling, gate.verify.self-test, gate.close.operator-promote). Gates fire across 5 stages of the phase lifecycle: CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE.
>
> Each gate has: name, stage, enforcement_mode (hard-halt / amortized / soft-warn / disabled), gate_sampling_tier (always / sampled-rate-50 / low-risk-skip), and an optional repair_command. Verdicts: GREEN / WARN / FAIL / PENDING.
>
> Two named "concept gates" drive the most operator attention:
> - **ATC** (Air Traffic Control) — quality discipline. Fires per-dispatch (Stage EXECUTE) and per-phase (Stage CLOSE). Haiku-classified tier: SKIP / LITE / FULL / GATE. Runs 7-step + 10-point anti-slop checklist.
> - **MUDA** (Lean waste audit) — overproduction guard. Fires at phase close (Stage CLOSE) when files_changed≥4 OR diff_lines≥100. Checks 5 waste probes: classifier failures, narrative staleness, git-spawn rate, extra-processing, inventory.
>
> Cockpit redesign goal: a stage-keyed predicate chain (5 cells left-to-right) where each cell rolls up the gates that fire at that stage + shows the dominant verdict + the blocking reason. Below the chain: 4 counters (N green · M warn · K fail · J pending). Below that: 4 evidence cards (Tests / Code / Browser-Audit / Audit Gates) listing the actual underlying gates with status dots and repair commands.

---

## File reference

- `super-gsd/registry/gates.yaml` (278 lines) — canonical gate registry
- `super-gsd/scripts/lib/gates-registry.cjs` — load/cache/predicate-eval
- `super-gsd/scripts/lib/predicate-eval.cjs` — predicate language evaluator
- `super-gsd/workflows/atc-gate.md` — ATC procedure (read for cockpit visual treatment)
- `super-gsd/scripts/sgsd-muda-audit.sh` — MUDA audit script (referenced by repair_command)
- `super-gsd/scripts/sgsd-curate.sh` — learnings curator
- `super-gsd/scripts/lib/muda-deletion-candidates.cjs` — MUDA's surface for deletion candidates
- `.planning/memory/architecture/patterns/muda-read-path-spec.md` — MUDA read-path algorithm spec (DLB-05)
- `.planning/decisions/` — DLB-NN decision-memo files (precedent/canonical sources cited by gates)
