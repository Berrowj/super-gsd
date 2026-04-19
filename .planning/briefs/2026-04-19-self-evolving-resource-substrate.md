# Brief: Self-evolving resource substrate — RSPL / SEPL / distillation adoption

## Situation

Three 2026 research papers formalise architecture patterns that align with what SGSD has built piecemeal across DLB-01/02/03 but stop short of committing to.

**Autogenesis: A Self-Evolving Agent Protocol** (arXiv 2604.15034, submitted 2026-04-16) proposes a two-layer architecture:
* **Resource Substrate Protocol Layer (RSPL)** — treats Prompts, Agents, Tools, Environments, and Memory as protocol-registered resources with explicit state, lifecycle, and versioned interfaces.
* **Self-Evolution Protocol Layer (SEPL)** — closed-loop operator that *proposes → assesses → commits* improvements with auditable lineage and rollback.

**EvolveR: Self-Evolving LLM Agents through an Experience-Driven Lifecycle** (arXiv 2510.16079) specifies a two-stage loop:
* **Offline self-distillation** — trajectories become structured repository of abstract reusable principles.
* **Online interaction with retrieval** — agent retrieves principles during execution; policy reinforces based on action consequences.

**A Survey of Self-Evolving Agents** (arXiv 2507.21046, Jan 2026 update) observes that current agent systems "remain fundamentally static and unable to adapt their internal parameters to novel tasks and dynamic interaction contexts" — naming exactly the limitation DLB-02 and DLB-03 were designed to work around.

Today SGSD has:
* **Memory as protocol-registered resource**: `.brv/context-tree/` + `INDEX.md` + `sgsd-curate` atomic lifecycle (git-versioned). Matches RSPL for one of five resource types.
* **Tools as versioned resources**: scripts in `super-gsd/scripts/` with atomic commits. Matches RSPL.
* **Write-path learning**: `sgsd-muda-audit` captures findings; `sgsd-muda-recurrence` signals when patterns repeat.
* **Propose-only deliberation**: `/sgsd-deliberate` proposes architectural decisions; no automated assess-and-commit loop on individual resource updates.
* **Intent injection** (DLB-03 Step 5.5): structural prepend to every sub-agent prompt; closest analog to EvolveR's "retrieved principles guide decision-making" — but only for milestone-level intent, not waste lessons.

Missing relative to the papers:
1. Agents and Prompts are not individually addressable as protocol-registered resources with lifecycle state.
2. Environments are not modeled at all.
3. No closed propose → assess → commit loop for single-resource improvements. (DLB-02's write path records findings but never proposes rule changes.)
4. No offline distillation from findings to abstract lessons. DLB-02 explicitly deferred this as the threshold-of-3 promotion step.
5. No classifier consultation of distilled lessons pre-dispatch. DLB-02 explicitly deferred this as the read-path.
6. No resource-typed rollback primitive — `git revert` is available but no skill understands the resource taxonomy.

The question before the board is whether to adopt these patterns now, build only a subset, or reject the formalisation entirely as vocabulary-for-vocabulary's-sake.

## Stakes

**If adopted well:** SGSD converges on research-validated patterns. The resource registry gives operator and classifier a complete inventory. SEPL's propose/assess/commit closes the gap between "we know we have waste" (DLB-02 write path) and "we fix it automatically" (currently operator-only). Distillation + classifier-consult closes the compounding-improvement loop the user explicitly asked for ("orchestrator improves with every phase").

**If adopted too aggressively:** We ship a 5-resource state machine, protocol schemas, auditable lineage logs, and an automated proposal engine — most of which SGSD has no observed need for yet. Autogenesis is three days old; treating it as a stable protocol risks locking into a vocabulary that shifts. DLB-02 Contrarian's sample-of-one critique applies again: we have zero examples of distillation actually being triggered in a SGSD milestone.

**If ignored:** We stay at the DLB-02/03 plateau indefinitely. The write paths accumulate data nobody reads. The memory tier exists but doesn't evolve. The orchestrator "improves" only when the operator manually rewires it after deliberation.

## Constraints

* Must not violate DLB-02's discipline: the MUDA kill-condition + Contrarian's "prove-it" gate on the read path. If we wire a classifier-consults-lessons path, it must be evidence-gated (≥2 milestones of real recurrence data before activation).
* Must not violate DLB-03's Architect structural-injection principle: enforcement happens via context-window mechanics, not via regex presence checks or scored gates.
* Must reuse existing primitives: sgsd-recall, sgsd-curate, sgsd-muda-* scripts. New work is glue + formalisation, not replacement.
* No external paid infra. Local filesystem + git only.
* Must respect the "operator decides kill conditions" invariant. Automated *proposals* are fine; automated *retirements* are not.
* Token budget: any per-dispatch overhead ≤ 100 tokens. We're already at Step 5.5 + Step 9.5 conditional costs — another always-on hook needs justification.

## Key Questions

Four structured questions for the board:

1. **Resource registry scope — which RSPL resource types to formalise now?**
   Autogenesis names five: Prompts, Agents, Tools, Environments, Memory. SGSD has Memory and Tools covered. Options:
   * **All five** — full RSPL alignment. Includes modelling Environments (e.g., project working-directory, .mcp.json state) that we've never tracked. High ceremony.
   * **Agents + Tools + Memory (3)** — formalise what we already have + the agents/ directory. Skip Prompts (embedded in SKILL.md; addressing them individually is a bigger refactor) and Environments (no observed use case).
   * **Registry-only, no state machines** — walk the filesystem and emit a manifest of every resource with path + sha + last-modified. Don't build explicit state/lifecycle machines yet. Cheapest; gives operator + classifier the inventory without committing to a state model.

2. **SEPL closed loop — how much to automate?**
   Autogenesis specifies *propose → assess → commit* as an operator protocol with auditable lineage. Options:
   * **Operator-gated** — `sgsd-propose-improvement` drafts proposals to `.planning/proposals/`; operator reads and manually approves (which triggers `sgsd-commit-proposal`). No automatic commit.
   * **Auto-commit on assessment PASS** — proposals with passing assessment commit themselves, with lineage logged. Operator reviews via dashboard / nightly.
   * **Auto-commit ONLY for narrow resource types** — e.g., CLAUDE.md rule additions auto-commit; agent/skill/script changes stay operator-gated. Hybrid.
   The operator-decides-kill-conditions invariant constrains us; this question decides what "decide" means at the per-improvement grain.

3. **Distillation (Wave C) — build now or wait for recurrence data?**
   DLB-02 deferred the finding→lesson promotion explicitly because no recurrence data exists yet. The papers make the pattern more compelling but don't change the evidence situation. Options:
   * **Build now with low threshold** — threshold-of-2 promotion, materialise lessons from Phase 8's waste findings as a seed. Replays the DLB-02 seed-library argument that got settled against.
   * **Build the script, gate activation** — ship `sgsd-muda-distill.sh` but don't run it until `sgsd-muda-recurrence` reports ≥3 same-class findings. Harmless to have sitting. Matches DLB-02 discipline.
   * **Defer entirely until v1.3+** — stay aligned with DLB-02's original deferral until genuine recurrence data appears.

4. **Protocol conformance or SGSD-idiomatic?**
   Autogenesis proposes its layers as a *protocol*. Options:
   * **Conform** — structure our resource registry JSON to match AGP's spec so future SGSD installs could interoperate with other AGP agents.
   * **Borrow vocabulary, keep idiom** — reuse the RSPL/SEPL framing and distillation concepts but keep our file layouts + JSONL conventions.
   * **Ignore the protocol entirely** — the paper is three days old; the protocol may not stabilise; we gain nothing from interop with a one-paper standard.

Answers must be consistent across all four — they form a coherent stance, not independent yes/nos.

## Additional Context

* Alignment matrix (my synthesis, open to board correction):

  | Paper concept | SGSD today | Gap classification |
  |---|---|---|
  | Memory resource | ✅ `.brv/context-tree/` + INDEX + sgsd-curate | No gap |
  | Tools resource | ✅ `super-gsd/scripts/` git-versioned | No gap |
  | Agents resource | ⚠️ Frontmatter only, no state machine | Formalisation gap |
  | Prompts resource | ⚠️ Embedded in SKILL.md | Structural gap |
  | Environments resource | ❌ Not modeled | Full gap |
  | SEPL closed loop | ⚠️ Propose (deliberate) but no assess/commit for single resources | Architectural gap |
  | Auditable lineage + rollback | ⚠️ git revert exists, no resource-typed skill | Small gap |
  | Offline distillation | ❌ DLB-02 deferred explicitly | Deliberate deferral |
  | Online retrieval (classifier consult) | ❌ DLB-02 deferred explicitly | Deliberate deferral |
  | Policy reinforcement | ❌ Static ATC tier rules | Future research |

* Wave groupings for any eventual plan:
  * **Wave A** — Resource registry (manifest + rollback). ~2-3h. Matches RSPL's minimal requirement.
  * **Wave B** — SEPL closed loop (propose/assess/commit scripts + lineage log). ~3-4h.
  * **Wave C** — Distillation (`sgsd-muda-distill.sh` + lesson schema). Build anytime; activate only on real recurrence.
  * **Wave D** — Classifier consults distilled lessons. Post-v1.2, evidence-gated.

* The 20 OPEN recommendations from Phase 8's gap audit are separate from this brief. Many are housekeeping (agent name typos, documented commands, etc.) and already mostly fixed. This brief is forward-looking architecture, not remediation.

* DLB-01/02/03 must be consulted by the board — any decision here must be consistent with their prior resolutions, especially DLB-02's evidence-gate on the read path and DLB-03's structural injection enforcement model.

## Termination

phases_affected: 8
max_rounds: 2
gate_score: pending

<!-- 8 = Wave A (registry + rollback, ~3 phases), Wave B (SEPL scripts + lineage, ~3 phases),
     Wave C (distill script + schema, ~2 phases). Wave D is deliberately out of scope for
     this deliberation — it's evidence-gated. Max rounds 2 keeps total spend <120k. -->
