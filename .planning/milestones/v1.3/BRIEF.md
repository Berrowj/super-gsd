# Brief: v1.3 Multimodal Review — Codex Integration

**Drafted:** 2026-04-23
**Staging path:** `.planning/proposals/v1.3-multimodal-review/` (will move to `.planning/milestones/v1.3/` when `/gsd-new-milestone v1.3` fires after v1.2 closes).
**Parent decision:** Operator directive 2026-04-23 — integrate Codex Pro subscription as the code-review-shaped reviewer for SGSD gates.

## Situation

SGSD is mono-vendor. Every reviewer, verifier, and classifier is a Claude model (Opus/Sonnet/Haiku) dispatched through `Agent(subagent_type, model, ...)` inside `super-gsd/skills/sgsd-orchestrate/SKILL.md`. The operator now holds a Codex Pro subscription. The 2026-04-22 Phase 12/13-planning session exited on `Exit #4 — operator out of OAuth quota until 2026-04-23 ~20:00`, which means the Claude Max quota is a live rate-limiting constraint on autonomous runs. Codex runs out of band on its own subscription quota.

This milestone is therefore not "add Codex everywhere." It is a narrower move: create a cross-vendor reviewer lane for code-review-shaped work, prove it on the surfaces where disagreement is useful, and leave the rest of SGSD mono-vendor until evidence says otherwise.

Three gate surfaces are code-review-shaped and would benefit from an external reviewer:
- **Step 6.5 Phase-level ATC** (`gates.yaml` row `phase-level-ATC`, reviewer `sgsd-code-reviewer`, emits `.planning/phases/{N}/{N}-ATC-REVIEW.md`)
- **Step 9.5 Per-dispatch ATC** (`gates.yaml` row `per-dispatch-ATC`, reviewer `sgsd-code-reviewer`, emits `.planning/phases/{N}/commit-reviews.jsonl`)
- **Step 9.6 Adversarial verifier challenger** (MACH-04, same `gsd-verifier` agent with a contrarian prompt, 20% sampling rate — cross-vendor disagreement is the strongest adversarial signal)

A fourth surface is MUDA Step 6.55 (`sgsd-muda-audit.sh`). Today it runs three **mechanical** probes (haiku_fails / narrative_age_sec / git_spawn_pct). There is **no qualitative LLM probe** — the 8-waste taxonomy explicitly parks Overproduction, Non-utilised-talent, Transportation, Inventory, and Extra-processing as "operator-judgment-only." Codex is the natural fit for a qualitative Overproduction probe (YAGNI / cross-plan duplication / over-engineered abstractions), which is exactly what ATC-style review catches at per-dispatch granularity but MUDA doesn't catch at phase scope.

Existing cross-AI precedent: `.claude/skills/gsd-review/SKILL.md` already shells out to external AI CLIs for peer review of phase plans. v1.3 reuses that shape, it does not invent it.

Milestone shape:
- **Phase 14** ships the provider substrate dark. No live routing changes.
- **Phase 15** flips the lane on only at review-shaped gates, qualitative MUDA, and the adversarial challenger.
- **Milestone close** decides whether the lane earned its keep. If not, it is disabled and documented.

## Stakes

**If built:** (1) Claude Max quota offload — every Codex review is tokens not burnt on the OAuth quota that currently rate-limits runs. (2) Genuine cross-vendor signal on adversarial verifier firings — same-vendor challengers share blind spots by construction. (3) First qualitative MUDA probe lands, closing the "operator-judgment-only" half of the 8-waste taxonomy without forcing operator-in-the-loop. (4) Establishes the provider-abstraction precedent for future multi-vendor work (Gemini, local models, etc.) without having to rewrite the gate layer again.

**If ignored:** (1) Operator keeps hitting OAuth quota on long autonomous runs (the 2026-04-22 exit was not a one-off). (2) Adversarial challenger stays same-vendor and keeps missing class-of-blind-spot failures the primary verifier shares. (3) MUDA stays mechanical-only; the five unclaimed waste classes never get mechanized.

**If built halfway:** Substrate without wiring = dead infrastructure. Wiring without substrate = hardcoded coupling that will break the next time a provider is added. Qualitative MUDA probe without the provider substrate = one-off shell-out with no contract-check safety net (this is exactly the Phase-147 silent-drift failure mode v1.2 just fixed).

## Constraints

- **No API keys.** Respects D006 (Key Decisions). Codex CLI auth must be Pro-subscription OAuth, identical posture to Claude Max OAuth.
- **Must preserve evidence contracts.** The edge-guard layer (Phase 10 GATE-04) monitors `evidence_emitted` paths per gate. Any new reviewer MUST emit the same paths as the Claude reviewer or edge-guard will halt. This is the structural invariant that makes provider swapping safe — exploit it, don't fight it.
- **Must fall back gracefully.** Codex CLI unavailability / auth drift / network error in an auto run MUST NOT block the phase. Single-retry-to-Claude fallback + `GATE_PROVIDER_FALLBACK` DEVIATION logged.
- **Must measure the offload win mechanically.** `token-log.jsonl` gains a `provider` field so "Claude tokens saved by Codex" is a computable number, not a vibes claim. Without this, CODEX-12's milestone-close kill condition has nothing to key off.
- **Must respect existing gate policy discipline.** New Codex routing declares `reviewer_provider:` on `gates.yaml` rows — no hardcoded branches in SKILL.md, no bypass of the predicate evaluator, no out-of-band shell execution that edge-guard can't see.
- **Must scope-discipline.** Only swap where Codex has comparative advantage (code review, adversarial challenge, qualitative waste review). Classifier (Haiku, ~50 tok) and primary Verifier (mechanical `verify.mjs`) stay Claude. Any instinct to "Codex everything" is cargo-cult and gets killed by CODEX-12 at milestone close.
- **Must preserve the one-active-milestone rule.** v1.3 stays staged until v1.2 actually closes through `sgsd-complete-milestone`; no parallel milestone execution.
- **Must leave a reusable substrate, not a one-off Codex branch.** Even though the first consumer is Codex, the abstraction has to stay provider-shaped (`review-providers.yaml`, `reviewer_provider:`) so future vendors do not require another gate-layer rewrite.
- **Platform:** Windows-first (operator primary), must also work on macOS and Linux per the existing super-gsd constraint.

## Key Questions

1. **Substrate-first or wire-first?**
   - (a) Phase 14 ships substrate dark (`codex_enabled: false`), Phase 15 flips on. Two phases, evidence-first. Proven pattern (v1.2-B).
   - (b) Single phase, substrate + wiring land together. Faster but conflates substrate with behaviour change — the exact failure mode Phase 147 exhibited.
   - (c) Wire-first with a mock Codex CLI (shim that returns canned reviews), then swap to real Codex in Phase 15. Makes the orchestrator-integration work testable without burning Codex quota during substrate development.
   - **Default answer:** (a). v1.2's evidence-first lesson argues against collapsing substrate and behavioural change into one move.

2. **Claude-fallback-on-error or Claude-always-parallel?**
   - (a) Primary-Codex, single retry to Claude on error, log fallback. Minimises Codex burn.
   - (b) Always run both, store both reviews, use disagreement as the adversarial-challenger signal for free. Maximises cross-vendor signal but doubles reviewer token cost.
   - (c) Primary-Codex, Claude only on a sampling rate (e.g., 10% of phase-ATC dispatches). Cheaper version of (b).
   - **Default answer:** (a) for Step 6.5 and 9.5. (c) or (b) for Step 9.6 adversarial challenger only (where cross-vendor IS the signal). Will re-litigate during Phase 14 discuss.

3. **Qualitative MUDA probe: inside `sgsd-muda-audit.sh` or as a new skill?**
   - (a) 4th probe class inside `sgsd-muda-audit.sh`. Reuses the curate pipeline, one script to maintain, taxonomy stays in one place.
   - (b) New `sgsd-codex-review` skill invoked from Step 6.55 alongside `sgsd-muda-audit.sh`. Clean boundary between mechanical and qualitative, but two scripts to maintain.
   - **Default answer:** (a). The 8-waste taxonomy is already a single axis — splitting into two scripts creates a coordination tax at phase-close time. Will re-litigate if the audit-script complexity starts bloating.

4. **Kill condition thresholds (CODEX-12) — what numbers?**
   - `critical_count_delta < 5` across the milestone → insufficient quality lift.
   - `claude_tokens_saved < 50k` across the milestone → insufficient quota offload.
   - Both must hold to trigger the kill. Either alone is not enough to retire infrastructure that provides genuine value on the other axis.
   - Numbers are strawman. Will calibrate against Phase 14 contract-check data plus the real v1.1/v1.2 reviewer-token baseline from `.planning/metrics/token-log.jsonl`.

5. **Does `sgsd-complete-milestone` need to know about the Codex metric?**
   - It runs the milestone-close hook. CODEX-12 kill check is a candidate hook slot.
   - Alternative: `sgsd-token-audit` runs the kill check as an extension of its dashboard logic, sgsd-complete-milestone just reads its verdict.
   - **Default answer:** Extend `sgsd-token-audit`; sgsd-complete-milestone consumes. Keeps the skill boundaries honest.

## Additional Context

- **Existing reviewer-agent precedent:** `super-gsd/agents/sgsd-board-contrarian.md` and the other board members are Sonnet-backed agents with specific prompt contracts. Phase 14's `sgsd-codex-reviewer.md` mirrors that shape — it's an agent definition, just the execution primitive (`codex exec`) is external.
- **Existing external-CLI precedent:** `super-gsd/scripts/sgsd-muda-audit.sh` already shells out to `sgsd-muda-probe.sh` and `sgsd-curate.sh`. `super-gsd/scripts/sgsd-recall.sh` is another shell-based external primitive. Codex CLI wrapper follows the same pattern — it's not a foreign architecture.
- **Phase 13 dependency:** Phase 13 (v1.2 final phase) ships `sgsd-complete-milestone` + Rule 6.7 auto-trigger. v1.3 consumes that machinery at close-time (CODEX-12 kill check runs there). Phase 13 must close cleanly before v1.3 opens.
- **No parallel-milestone work:** Per the existing project discipline (one active milestone at a time), v1.3 does not start until v1.2's milestone-close hook runs. This brief is staged, not active.
- **Carried ergonomics items:** WR-A (`patch-gsd-tools-known-keys.sh` interactive confirm) and WR-B (typed-error refactor in gates-registry) were deferred from Phase 10/12 to a post-v1.2 ergonomics sweep. If that sweep is bundled into v1.3, it becomes Phase 16 (not Phases 14/15). Not folded in — separate scope.

## Milestone Intent

v1.3 establishes a narrow, evidence-gated multi-model reviewer lane inside SGSD.
It dark-launches the provider substrate first, then activates Codex only where
review-shaped work benefits from cross-vendor signal or quota offload. Success is
not "Codex integrated." Success is: the lane preserves all existing evidence
contracts, measurably saves Claude review quota, catches enough additional issues
to justify itself, and can be retired cleanly if it does not.

## Termination

```yaml
phases_affected: 4   # 14 + 15 + sgsd-muda-audit.sh + sgsd-token-audit
max_rounds: 2
gate_score: pending
q1_impl_hours: 12    # strawman across both phases — will refine in discuss
q1_revertable: true  # all work lives under super-gsd/ + config.json flags; revertable via git + codex_enabled:false
```

<!--
phases_affected = 4 counts: (1) Phase 14 substrate, (2) Phase 15 wiring,
(3) sgsd-muda-audit.sh (CODEX-08 adds 4th probe), (4) sgsd-token-audit
(CODEX-10 dashboard tile + CODEX-12 kill check). All four are in-scope
for v1.3; Phase 13 is NOT in scope (ships separately as v1.2 close).

q1_impl_hours: 12 is an estimate. Phase 14 substrate (~6h: wrapper +
registry + schema field + contract harness + agent stub + config block).
Phase 15 wiring (~6h: gate rewire + MUDA probe + metric field + kill
check + cross-vendor adversarial). Revisit at /sgsd-discuss-phase 14.

Gate score pending — respects DELIBERATION-FLOOR: q1_impl_hours > 2h
AND cross-cutting (affects orchestrator dispatch path). Candidates
for /sgsd-deliberate if gate_score returns >= 3 via the Haiku gate.
-->
