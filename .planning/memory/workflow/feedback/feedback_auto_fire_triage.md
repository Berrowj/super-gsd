---
name: Auto-fire /sgsd-triage on planning intent, don't ask
description: When operator's message shows planning/figuring-out intent, invoke the sgsd-triage skill directly without gating on "want me to run /sgsd-triage?"
type: feedback
originSessionId: 383f3687-d752-4f3b-8935-5c48d88dd028
---
Invoke `/sgsd-triage` (via the Skill tool) automatically when the operator's message shows planning/figuring-out intent. Do NOT pause to ask "sounds like a planning question — want me to run /sgsd-triage?" first.

**Why:** Operator (the operator, 2026-04-21) explicitly said "Yeah triage should be automatic don't ask" after I gated a cross-cutting architecture question on confirmation. The sgsd-triage skill's own trigger already says auto-invoke; the "ask when ambiguous" escape hatch was being used too liberally. Triage is cheap — worst case it routes to Path D (inline answer), so false-fire cost is small; false-not-fire cost is the operator having to manually structure a multi-thread planning question.

**How to apply:** Default fire `Skill(skill: "sgsd-triage", args: "<the operator's question + any structured context you already have>")` whenever triage trigger signals are present:
- Phrases: "I'm thinking about...", "How should we...", "What if we...", "Let's plan...", "Design...", "Evaluate...", "Should we..."
- Problem described without execution ask
- Multiple valid approaches / tradeoffs surfaced
- Multi-thread / composite question where the operator is asking for a decision, not a task

Let triage's own brainstorming step handle ambiguity. Do NOT ask first.

Keep the existing do-NOT-invoke exceptions:
- Direct factual question ("what's the current phase?", "where does X live?")
- Explicit execution request ("go", "run /sgsd-orchestrate", "ship the fix")
- Mid-build specific code change
- Trivial (<5 min inline)

Downstream discipline is unchanged: triage may auto-fire, but `/sgsd-deliberate` still requires operator confirmation per the DELIBERATION-FLOOR invariant.
