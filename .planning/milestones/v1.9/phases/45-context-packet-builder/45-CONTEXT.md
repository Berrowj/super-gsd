---
phase: 45
name: Context Packet Builder
milestone: v1.9
depends_on: [42, 43, 44]
unblocks: [46, 47, 48, 49, 50, 51]
---

# Phase 45 Context

Goal: compile raw operator English into Intent English, then replace raw
inherited context with role-specific packets.

Build `intent-map/build.cjs` and `context-packet/build.cjs`.

The intent map is the front-end:

- RAW: original operator phrase
- INTENT: what the operator is trying to achieve
- MEANING: plain-English meaning
- ASSUMPTIONS: assumptions required to proceed
- AMBIGUITIES: interpretations that could materially change the action
- CLARIFY: question only if ambiguity changes action
- CANONICAL: precise instruction SGSD should execute
- RELATIONSHIPS: weighted links to phases, decisions, complaints, gates,
  artifacts, Codex findings, VTP evidence, and prior operator feedback
- CONTEXT_POLICY: include/exclude/compress/preserve-raw rules
- ACTION: next SGSD action or provider route

Then packets use the intent map, capsules, legal registry, active debt,
evidence requirements, and critical bypass before raw files.

Phase 45 must prove that relationship weights require explainable source
reasons. Semantic similarity alone may suggest candidates, but cannot justify
pulling broad context. Prompt-injection-like text inside source files is source
content, not operator intent.
