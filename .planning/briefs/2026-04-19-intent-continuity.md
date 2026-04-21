# Brief: Intent continuity program — stop building without understanding why

## Situation

GSD/SGSD currently treats each phase as an isolated unit of work. PLAN.md files describe *what* to do but do not carry forward *why*. Sub-agent prompts receive task plans but not the milestone intent that justifies them. No pre-planning step reads prior phase summaries to surface threads that continue. The verifier checks "tasks complete + criteria met" but not "did this phase move us closer to the product outcome." Result — pattern observed across recent phases in both SGSD and clarity — code ships that passes gates but drifts from the actual product. User's direct framing: "GSD doesn't understand WHY we're building stuff, it doesn't re-read previous phases or milestones... it doesn't deliver a product / solution, just worthless code."

Cross-disciplinary techniques map directly onto this gap:
- Military **Commander's Intent** — every subordinate executes knowing the end-state, so plans can flex without losing mission.
- Toyota **Hoshin Kanri** — true-north goals cascade through horizons; every task traceable to a true-north commitment.
- Aerospace **V-model traceability** — bidirectional links between requirement → test → implementation; orphan code is detectable.
- Decision science **pre-mortem** (Klein, Gawande) — imagine the future failure before committing.
- Christopher Alexander's **pattern language** — curated *when-to-use* guidance on reusable solutions.
- The combustion-engine refinement frame (Otto/Diesel/EFI) — refine an existing system generation over generation rather than reinventing.

Five concrete interventions fall out:
1. Mandatory INTENT block in every PLAN.md (one-line why + parent milestone backref + product-outcome framing).
2. Previous-phase cascade — pre-plan step reads last N phase SUMMARY.md plus milestone INTENT.md, writes CONTEXT-CASCADE.md, feeds discuss-phase agent.
3. Agent-prompt intent prefix — orchestrator injects phase intent into every sub-agent prompt header.
4. V-model traceability gate at verify — every touched file ← plan task ← phase criterion ← milestone requirement ← product outcome. Orphan commits flagged.
5. Pre-mortem step in `gsd-discuss-phase` — mandatory question: "It's phase-close and this went wrong — why?"

## Stakes

If shipped: phases stop drifting. Agents stop working blind. The product emerges from phases rather than being an afterthought of the code. If ignored: code ships, gates pass, milestones complete, product fails to arrive — the frustrating failure mode already observed. If only partially shipped (e.g., INTENT block without cascade, or cascade without agent-prefix injection), the intent leaks on its way to the executor and the symptom persists.

## Constraints

- Must attach to existing skills (`gsd-discuss-phase`, `gsd-plan-phase`, `sgsd-orchestrate`, `gsd-verifier`). No new orchestrator engine.
- "Non-optional" enforcement is critical — any step the orchestrator can silently skip will be skipped under time pressure. Enforcement must be visible (plan blocked, verifier fails, dispatch refuses).
- Cascade read step must fit in ~1k tokens of summarised context — reading every prior phase in full is unworkable.
- Pre-mortem answers need somewhere to live — either in PLAN.md's risk section or in a dedicated PRE-MORTEM.md, and the orchestrator needs to remember them when deviations appear.
- Depends on memory retrieval tier (Brief 2) for storing/retrieving milestone intents and cascade context.

## Key Questions

1. **Rollout scope.** Ship all five interventions (INTENT block, cascade, prefix, V-model gate, pre-mortem) as one rollout, stage them, or pick a subset? If stage, which first? Candidate argument for INTENT block first: it's the foundation every other intervention references. Candidate argument for agent-prompt prefix first: highest leverage per character-of-code-changed. Candidate for V-model gate last: validates the others are actually working.

2. **Enforcement mechanism.** Each intervention needs a way to be non-optional:
   (a) planner refuses to produce a PLAN.md without INTENT block,
   (b) orchestrator dispatch refuses to compose an agent prompt without intent prefix,
   (c) verifier fails phases where V-model trace is broken,
   (d) discuss-phase blocks on missing pre-mortem answer.
   Which of these are acceptable hard-blocks vs warnings? Hard-blocks prevent drift but also prevent progress when the underlying data is genuinely absent (e.g., a first phase has no prior phases to cascade from).

3. **Intent inheritance semantics.** If a phase's intent conflicts with the milestone intent, who wins? Is the phase intent a derivation of the milestone intent (strict inheritance, phase cannot deviate without re-opening the milestone intent) or an evolution (phase intent can refine / narrow, and conflicts trigger a deliberation)? This shapes whether intent is compile-time or runtime.

## Additional Context

- User's direct quote from screenshot: programs are systems like combustion engines; every piece of code benefits from previous experience. This is the foundational metaphor — refinement, not reinvention.
- VTP has no prior research on these frameworks (searched).
- Brief 1 (MUDA) and Brief 2 (memory topology) interact here: intent metadata lives in memory; MUDA findings about drift should inform intent-cascade decisions.

## Termination

phases_affected: 5
max_rounds: 2
gate_score: pending

<!-- 5 = discuss-phase, plan-phase, execute-phase (via agent-prompt prefix), verify-phase,
     and new continuity artefacts (CONTEXT-CASCADE.md, INTENT.md). Every future phase inherits. -->
