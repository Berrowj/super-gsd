---
name: sgsd-triage
description: "Planning-mode router. Detects when operator is figuring something out, invokes superpowers:brainstorming + superpowers:writing-plans, classifies the result, drafts the right artifact (brief / phase / audit invocation), and routes to /sgsd-deliberate OR /sgsd-discuss-phase + /sgsd-orchestrate OR /sgsd-muda-audit. Respects DELIBERATION-FLOOR. Use when the operator says things like 'I'm thinking about...', 'How should we...', 'Let's plan...', 'Design...', 'Evaluate...', or describes a problem without asking for execution."
allowed-tools:
  - Read
  - Write
  - Bash
  - Skill
  - AskUserQuestion
  - mcp__vtp-kb__vtp_route_and_retrieve
  - mcp__vtp-kb__vtp_search_substrate
---

<trigger>

**Auto-invoke this skill when** the operator's most recent message contains planning/figuring-out intent. Explicit signals:

- Starts with phrases like *"I'm thinking about..."*, *"I want to figure out..."*, *"How should we..."*, *"What if we..."*, *"Let's plan..."*, *"Let's explore..."*, *"Design..."*, *"Architect..."*, *"Evaluate..."*, *"Should we..."*
- Describes a problem or ambition without asking for immediate execution (no *"build this now"*, *"ship it"*, *"fix the bug"*)
- Mentions tradeoffs, alternatives, or multiple valid approaches
- Asks a research-style question that the operator clearly wants thought through, not answered off-the-cuff

**Do NOT invoke when:**
- Operator asks a direct factual question (*"what's the current phase?"*, *"where does X live?"*)
- Operator explicitly requests execution (*"go"*, *"run /sgsd-orchestrate"*, *"ship the fix"*)
- Operator is mid-build and asking for a specific code change
- The question is trivial (<5 min inline answer, no skill chain needed)

Getting this detection right matters — false-positive auto-invocation annoys; false-negative misses the whole point. When ambiguous, do NOT auto-invoke; ask the operator *"sounds like a planning question — want me to run /sgsd-triage?"* first.
</trigger>

<objective>

Convert an ambiguous planning query into a structured artifact (deliberation brief, phase plan, or audit invocation), then route to the correct continuation skill.

Eliminates the *"ad-hoc planning, then realise I should have briefed the board / run MUDA / opened a phase"* pattern. Forces the planning discipline at message-one, then dispatches with the right primitive.
</objective>

<process>

## Step 0: VTP Enrichment (triage context grounding)

Before brainstorming, run a VTP-routing pass so the downstream steps act against routed evidence instead of raw operator prose. This step is implemented via `super-gsd/scripts/lib/vtp-context-composer.cjs` — never call `mcp__vtp-kb__*` directly from this skill body. All VTP invocations flow through the composer's `callVtp(...)` wrapper, which is the single measurement point for `elapsed_ms` (E-03) and the single log-writer for `.planning/metrics/vtp-routing-log.jsonl`.

1. **Config toggle check.** Read `.planning/config.json#workflow.triage_vtp_enrichment`. If `false`, skip Step 0 entirely and proceed to Step 1 with the operator's raw query verbatim.
2. **Compose context.** Invoke `node super-gsd/scripts/lib/vtp-context-composer.cjs` via Bash to run `compose(sgsd_state)` and return the `full_context_object`. `sgsd_state` is derived from `.planning/STATE.md` frontmatter (milestone, phase, plan, active_file) + the operator's raw message.
3. **Project to triage tier.** Call `project(ctx, 'triage')` → returns the 4-field slice `{repo, current_task, recent_turns, explicit_constraints}`.
4. **Fast-path check.** If `isFastPathEligible(ctx)` returns true (current_task resolves to a known active phase AND explicit_constraints is non-empty), call `mcp__vtp-kb__vtp_search_substrate` via `callVtp(...)` with phase-scoped `source_types` and `topics` filters.
   Else: call `mcp__vtp-kb__vtp_route_and_retrieve` via `callVtp(...)` with `{raw_query: operator_message, context: tier_slice}`.
5. **Timing.** `callVtp` already brackets the MCP invocation with `Date.now()` — no additional timing needed here. Budget is 3s P95 per D-07.
6. **Parse response.** Extract `{selected_query, retrieval_mode, reflection_verdict, top_3_doc_ids}` from `response.retrieval_plan` + `response.reflection` + `response.evidence.documents`. When `response.reflection` is null, record `reflection_verdict: null` verbatim.
7. **Write VTP-EVIDENCE.md.** Write framing-only artifact to `.planning/phases/{active_phase}/VTP-EVIDENCE.md` using the template below. Framing-only per D-04 — never embed full document content, only doc-ID references. Target ≤300 lines.
8. **Routing log.** `callVtp` already appends a row to `.planning/metrics/vtp-routing-log.jsonl` — no additional logging needed here.
9. **Hand to Step 1.** Pass `{selected_query, reflection_verdict, top_3_doc_ids}` into Step 1 brainstorming as a context prelude so the brainstorm receives routed framing instead of raw query.
10. **Graceful-fail discipline (critical).** If `callVtp` returns `{ok:false}` OR `elapsed_ms > 3000`:
    - The row is already logged with the failure reason (or with `elapsed_ms` exceeding budget as the marker).
    - Do NOT block — proceed to Step 1 with the operator's raw query verbatim.
    - Do NOT retry — one attempt, one fall-through. Retry logic belongs in a later phase.

**VTP-EVIDENCE.md template:**

```markdown
# Phase {N}: VTP Evidence Framing

**Generated by:** sgsd-triage Step 0
**Generated at:** {ISO timestamp}
**Composer version:** {TIERS schema version}

## Framing

- **raw_query:** {operator message or agent-internal task}
- **selected_query:** {from vtp_route_and_retrieve.retrieval_plan.selected_query}
- **retrieval_mode:** {from retrieval_plan.retrieval_mode}
- **reflection_verdict:** {sufficient | too_generic | over_narrowed | weak_evidence | null}

## Top-3 Evidence Doc-IDs (references only — not full content)

1. `{doc_id}` — {rel_path, title}
2. `{doc_id}` — {rel_path, title}
3. `{doc_id}` — {rel_path, title}

## Re-query Contract

Downstream agents must re-query VTP for tier-specific evidence at call time using these doc-IDs as seeds. This file holds framing only; evidence is always fresh-at-use.
```

**Trigger exclusion (D-06):** Step 0 relies on the existing `<trigger>` block's "Do NOT invoke when..." list (trivial questions, execution requests, mid-build fixes) to handle Path D style queries. No per-call flag — see D-06 rationale. System-wide disable via `workflow.triage_vtp_enrichment: false`.

## Step 1: Brainstorm (superpowers:brainstorming)

Invoke `superpowers:brainstorming` with the operator's query verbatim. Its job per its own description: *"explore user intent, requirements and design before implementation."*

This step is interactive — brainstorming may ask the operator clarifying questions. Let it. Do not truncate. The output should be a sharper, de-ambiguated framing of the problem.

**Checkpoint after brainstorm:** is the problem now concrete enough that the operator's intent is captured? If still fuzzy, loop (second brainstorm pass) or escalate to the operator *"this feels exploratory — should we keep brainstorming or park it and come back?"*

## Step 2: Plan (superpowers:writing-plans)

Feed the brainstorm output into `superpowers:writing-plans`. Its job per its description: *"Use when you have a spec or requirements for a multi-step task, before touching code."*

Output will be a structured multi-step plan — steps, dependencies, acceptance criteria, risk flags.

**Checkpoint after plan:** is the plan executable? If the plan reveals fundamental uncertainty (*"we actually don't know which of A/B/C to pick"*), that's a signal that step 3 routes to deliberation, not execution.

## Step 3: Classify + route

Read the plan output and classify into one of four paths:

### Path A — Architectural decision (deliberate-worthy)

**Indicators:**
- Cross-cutting change (touches ≥3 phases, multiple skills, or establishes precedent)
- Multiple valid approaches with genuine tradeoffs
- Invariants are at stake (DLB-02 kill discipline, DLB-03 structural-over-theatrical, etc.)
- No single obvious right answer

**But first — DELIBERATION-FLOOR gate (DLB-06 / DELIBERATION-FLOOR.md):**
Estimate the Q1 implementation time for the decided path. If `< 2h` AND fully reversible via `git revert`:
- SKIP `/sgsd-deliberate` entirely
- Write a 1-paragraph decision note to `.planning/decisions/{YYYY-MM-DD}-{slug}.md`
- Route to Path B (orchestrate) instead

**Otherwise:**
1. Draft a brief at `.planning/briefs/{YYYY-MM-DD}-{slug}.md` using `super-gsd/templates/brief-template.md` as the skeleton
2. Fill Situation / Stakes / Constraints / Key Questions from the brainstorm + plan
3. Set `phases_affected` honestly (count from the plan)
4. Set `q1_impl_hours` + `q1_revertable` (these unlock the FLOOR gate check in /sgsd-deliberate Step 0a)
5. Report: *"Drafted brief at {path}. Ready to fire `/sgsd-deliberate {path}`?"*

### Path B — Executable work (orchestrate-worthy)

**Indicators:**
- Clear acceptance criteria surfaced from brainstorm
- Implementation is the next step, not "decide what to do"
- Fits within existing phase scope OR is a crisp new phase
- Risks are known/bounded, not existential

**Route:**
1. If the plan fits in an existing phase's remaining work → suggest `/sgsd-discuss-phase {N}` to gather context before dispatch
2. If it's a new phase → draft `.planning/phases/{N}-{slug}/CONTEXT.md` with the plan as seed, then suggest `/sgsd-discuss-phase {N}`
3. After discuss → `/sgsd-orchestrate go` will pick it up via the orchestrator loop's dispatch rules

Report: *"Plan is executable. {discuss-then-orchestrate path}. Proceed?"*

### Path C — Retrospective / analysis (muda-worthy)

**Indicators:**
- Question is about existing work, not new work (*"why did X happen"*, *"is Y producing value"*, *"audit Z"*)
- Named phase or milestone already exists
- Looking for waste, conformance drift, or process failures

**Route options (pick based on the question's shape):**
- *"is phase N producing what it should"* → `/sgsd-muda-audit {N}` + optionally `bash sgsd-conformance-check.sh {N}` (DLB-05 Wave B)
- *"did we build what the plan said"* → `bash sgsd-conformance-check.sh {N}` + `/sgsd-audit {N}`
- *"what went wrong in phase N"* → `/sgsd-audit {N}` (evidence gate)
- *"are we wasting tokens"* → `/sgsd-token-audit`
- *"should we retire skill X"* — NOT a muda question, that's deliberation. Route to Path A.

Report: *"Retrospective mapped to {tool}. Run it?"*

### Path D — Trivial / inline

**Indicators:**
- Single-line question
- Answer fits in <5 min of operator time
- No artifact needed
- No phase impact

**Route:**
Just answer inline. Do NOT invoke any skill. Report the answer directly in the conversation.

The cost of triage/deliberation/phase-spawn for a trivial question is the same anti-pattern DELIBERATION-FLOOR.md formalises at the decision-grain. The skill itself respects that floor.

## Step 4: Report + offer

After classification, emit a concise summary:

```
TRIAGE: {operator's one-line framing}

Brainstorm produced: {1 sentence}
Plan has N steps, M decision points, K risks.
Classification: {A/B/C/D} — {one-line reason}
Route: {specific next skill or inline answer}

Ready to {fire the next skill | write the brief | continue inline}? (y/N)
```

NEVER auto-fire the next skill. The FLOOR invariant applies here too — operator decides. But have the artifact (brief, phase seed, audit invocation) ready to hand off.
</process>

<disciplines>

- **Respect DELIBERATION-FLOOR:** if the Q1 implementation is <2h and revertable, never route to `/sgsd-deliberate`. Route to Path B with a 1-paragraph decision note.
- **Respect evidence-before-machinery (DLB-02):** if the plan depends on data we don't have yet, route to Path C (retrospective) to gather evidence first, then come back.
- **Respect structural-over-theatrical (DLB-03):** don't route to a gate/check that the plan's structure already handles. If the plan is structurally safe, skip the governance layer.
- **Respect operator-decides-retirements (DLB-02/04 invariant):** never auto-fire the downstream skill. Always confirm.

</disciplines>

<examples>

**Example 1 — deliberate path**
> Operator: "I'm thinking about how to handle credentials across multiple projects. Should they live in a shared store or stay per-project?"
>
> Triage → brainstorm (de-ambiguates: "shared read-only vs per-project write") → plan (lists 3 options) → classify as Path A (cross-cutting, invariants at stake, >2h impl) → drafts brief at `.planning/briefs/2026-04-21-credential-topology.md` → suggests `/sgsd-deliberate`.

**Example 2 — orchestrate path**
> Operator: "Let's plan adding a BACKUP.md audit step to the phase-close gate chain."
>
> Triage → brainstorm → plan (3 tasks, clear acceptance) → classify Path B → drafts phase seed at `.planning/phases/09-backup-audit/CONTEXT.md` → suggests `/sgsd-discuss-phase 9`.

**Example 3 — floor path (deliberation skipped)**
> Operator: "How should we rename the `TODO` marker in CLAUDE.md to `FIXME`?"
>
> Triage → brainstorm → plan (1 task, <30 min, revertable) → classify Path A but FLOOR-gate fires → drops to Path B with 1-paragraph decision note → skips `/sgsd-deliberate` per DLB-06.

**Example 4 — muda path**
> Operator: "Why does the narrative dashboard keep crashing?"
>
> Triage → brainstorm → plan → classify Path C (retrospective) → suggests `/sgsd-audit <phase>` + `bash sgsd-conformance-check.sh` + recommends running the DLB-02 3-watchdog probes.

**Example 5 — trivial / inline**
> Operator: "What's `phases_affected` default in a brief?"
>
> Triage detects <5-min question → Path D → answer inline (no skill chain): *"It's an integer the operator fills in. The Haiku gate requires >=3 to proceed with deliberation."*

</examples>

<related>

- `.planning/decisions/DELIBERATION-FLOOR.md` — the governance rule this skill respects
- `.planning/decisions/DLB-06-central-distribution.md` — floor's origin deliberation
- `super-gsd/skills/sgsd-deliberate/SKILL.md` — where Path A routes
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — where Path B ultimately routes
- `super-gsd/skills/sgsd-muda-audit/SKILL.md` — where Path C mostly routes
- `superpowers:brainstorming` — Step 1 invoked
- `superpowers:writing-plans` — Step 2 invoked
</related>
