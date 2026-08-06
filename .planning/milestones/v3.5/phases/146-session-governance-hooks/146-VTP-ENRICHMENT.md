---
phase: "146"
artifact: VTP-ENRICHMENT
gate: Step 6.b.5
status: success
vtp_available: true
tool_used: mcp__vtp-kb__vtp_search_substrate
queries: 1
empty_hit: false
seed: CONTEXT (session-lifecycle hooks, report-only enforcement) + AC-146 + RESEARCH Q1/Q5/Q9
---

# P146 VTP Enrichment — Session Governance Hooks

## Hit 1 — harness as governance substrate (doc:5e6e7334ce6f, chunk:68e30f387c0f)
`wiki/research/security-of-long-term-memory-llm-agents-survey.md` §11.4
"The Agent Harness as a Governance Substrate", entity_types: [principle],
score 0.641.

Directly load-bearing for this phase's thesis:

- Zhou et al. 2026 frame agent-system evolution as **weights → context →
  harness**, positioning harness engineering as the unification layer that
  coordinates externalized memory, skills, and protocols. P146 is exactly this
  move for SGSD: governance stops being prompt-resident (CLAUDE.md text the
  model may or may not honor) and becomes harness-resident (hooks the runtime
  executes unconditionally).
- **AgentSpec (Wang et al. 2026a, ICSE 2026)** — a lightweight DSL for
  **trigger–predicate–enforcement** rules applied by the runtime at
  *millisecond-level overhead*. This is precedent for both the shape and the
  budget of P146's classifier/quality-gate: the rule form SGSD already uses in
  `gates.yaml` (trigger + predicate + escalation) is the published pattern, and
  ms-level overhead is the demonstrated bar — supporting RESEARCH Q9's
  hook-stacking concern and the <1s p95 classifier budget as *conservative*.
- ClawVM (Rafique & Bindschaedler 2026) makes the harness "a deterministic
  enforcement point for lifecycle policy" — argues for install-time-resolved
  deterministic hook wiring over runtime discovery.
- **Constraint the paper puts on us:** "the harness is not a semantic oracle."
  Provenance semantics, trust attribution, and content-level truth verification
  still need model/policy-level validation. Read against P146: the
  UserPromptSubmit classifier should stay deterministic/lexical and *route to*
  judgment (inject `/sgsd-triage`), never attempt the judgment itself. This
  independently confirms the board-binding "NO LLM in the classifier" and
  report-only postures.

## Hit 2 — adaptive-evaluation warning (chunk:945ff93c451a, score 0.641)
Same survey, §on defense evaluation: 12 recent defenses reporting near-zero
static attack success were bypassed >90% by *adaptive* attackers (Nasr et al.
2025). Defense claims should be read as lower bounds on attacker effort.

Applied to P146: report-only gates that merely *log* a missing PLAN are
trivially ignorable by a determined operator/agent — so AC-146c's value is
observability, not enforcement, and the phase should not claim otherwise. Also
argues for the cockpit-consumer wiring RESEARCH Q6 flags: an evidence row no
one reads is an unevaluated defense.

## Hits 3–5 — not relevant
WCAG redundant-entry, connascence-of-execution, SVM hinge loss. Lexical
overlap only ("session", "execution"); discarded.

## Planner directives
1. Cite AgentSpec's trigger–predicate–enforcement shape as precedent for
   keeping hook rules declarative and registry-driven (eases the P149
   skill-routing.yaml swap named in RESEARCH Q5).
2. Treat ms-level as the target and <1s p95 as the ceiling; make the latency
   bench a real plan task, not a note (RESEARCH task 4).
3. Do not let the classifier make semantic judgments — route only.
4. AC-146c is not complete without a reader; keep the cockpit-consumer wiring
   inside this phase rather than deferring it (RESEARCH Q6).
