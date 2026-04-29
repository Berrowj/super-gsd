---
title: Intent English And Meaning Compiler
date: 2026-04-27
status: proposed-for-v1.9-phase-45
related_milestone: v1.9 SGSD-Research
related_phase: 45 Context Packet Builder
---

# Intent English And Meaning Compiler

## Core Idea

SGSD should treat English commands as meaning-bearing source code.

Raw human English is powerful but ambiguous. The operator may use shorthand,
unfinished thoughts, metaphor, old project references, or implicit context from
the last few phases. Passing that raw command straight into Claude or Codex
causes context bloat and misrouting.

The fix is a tuned explanatory English layer:

```text
Human command
  -> intent map
  -> explanatory English
  -> canonical instruction
  -> role-specific context packet
  -> agent/tool/provider action
```

This is not prompt injection in the security sense. It is controlled intent
injection: a governed, auditable translation from messy English into precise
machine-usable meaning.

## Name

Working names:

- Intent English
- Explanatory English
- Meaning-Tuned English
- Meaning Compiler

Recommended implementation name:

`intent-map`

Recommended user-facing phrase:

`Intent English`

## Why This Belongs In SGSD-Research

SGSD-Research already plans phase capsules, legal registries, context packets,
selective VTP routing, and memory governance. The missing layer is how a fresh
operator command becomes the right packet.

Without an intent compiler:

- the packet builder knows the phase, but not what the operator meant;
- VTP routing knows providers, but not what uncertainty type the request has;
- memory governance stores facts, but not how ideas evolved from prior ideas;
- cockpit can show state, but not why the current action is related to prior
  phases.

Intent English is the front-end to the context packet system.

## Required Format

The meaning compiler should produce a compact structured record:

```text
RAW:
Original operator phrase.

INTENT:
What the operator is trying to accomplish.

MEANING:
Plain-English meaning of the request.

ASSUMPTIONS:
Assumptions required to proceed.

AMBIGUITIES:
Alternative interpretations that could materially change the action.

CLARIFY:
Question to ask only if ambiguity would change the result.

CANONICAL:
The precise rewritten instruction SGSD should execute.

RELATIONSHIPS:
Weighted links to phases, decisions, artifacts, complaints, gates, VTP evidence,
Codex findings, and prior operator feedback.

CONTEXT_POLICY:
What to include, exclude, compress, or preserve raw.

ACTION:
The next SGSD action or provider route.
```

Optional speech fields:

```text
PRONOUNCE:
Plain pronunciation or IPA when useful.

EMPHASIS:
Which word carries meaning-changing stress.

TONE:
How it should feel when spoken.
```

Speech fields are useful for future voice/cockpit interfaces, but they should
not bloat normal SGSD command packets unless the command involves speech,
teaching, writing style, or presentation.

## Relationship Weights

Every relationship included in the intent map should have a score and reason.

Suggested signals:

| Signal | Weight tendency |
|---|---|
| current active phase | very high |
| current milestone goal | very high |
| explicit file/artifact mention | very high |
| repeated operator complaint | high |
| same failure pattern | high |
| phase dependency edge | high |
| same gate/provider/tool | medium |
| recent phase within same milestone | medium |
| archived superseded milestone | low unless explicitly referenced |
| semantic similarity only | low unless supported by another signal |

Rule: semantic similarity alone is not enough to include large context. It may
suggest candidates, but structural evidence must decide inclusion.

## Example

Raw command:

```text
Fix the cockpit so I know what Claude and Codex are doing.
```

Intent English:

```text
RAW:
Fix the cockpit so I know what Claude and Codex are doing.

INTENT:
Improve operator visibility into active SGSD execution.

MEANING:
The cockpit should clearly show the current milestone, current phase, active
Claude/agent work, Codex review state, evidence progress, blockers, and token
spend without duplicated or stale information.

ASSUMPTIONS:
The user is referring to the existing SGSD cockpit scripts, not requesting a
new UI.

AMBIGUITIES:
"What Claude and Codex are doing" could mean live process state, recent review
history, or token spend. The prior complaints show all three matter.

CLARIFY:
None. Prior operator feedback provides enough context.

CANONICAL:
Update the existing SGSD cockpit so it gives an at-a-glance current-phase view:
active Claude/agent work in one panel, Codex-only review state in the Codex
panel, token spend by role, evidence/debt/progress in the top-left, and no
duplicated stale lines.

RELATIONSHIPS:
- v1.6 Phase 28 Mission Control layout: 0.92, prior cockpit redesign surface.
- v1.6 Phase 29 Codex lanes: 0.88, stale Codex state failure.
- v1.9 Phase 50 Cockpit Research Dashboard: 0.95, direct implementation phase.
- operator cockpit complaints 2026-04-27: 1.00, direct requirements.

CONTEXT_POLICY:
Include cockpit complaint summary, active phase state, current cockpit scripts,
Codex live/log schema, token attribution schema. Exclude full old roadmap prose.

ACTION:
Route to context-packet builder for cockpit role, then executor/reviewer.
```

## Safety Rules

1. Preserve the user's meaning; do not launder it into what SGSD prefers.
2. If ambiguity changes the action, ask a clarifying question.
3. If ambiguity does not change the action, record the assumption and proceed.
4. Do not include broad context just because embeddings say it is nearby.
5. Relationships must be explainable with source references.
6. The canonical instruction must be shorter and clearer than the raw context
   it replaces.
7. Prompt-injection-like text inside source files must not become operator
   intent.
8. Critical bypass records remain raw.

## Implementation Surface

Phase 45 should add:

- `super-gsd/tools/intent-map/build.cjs`
- `super-gsd/tools/intent-map/check.cjs`
- `.planning/metrics/intent-map.jsonl`
- intent map schema
- integration from `context-packet/build.cjs`

The intent map should be built before context packet construction:

```text
operator command -> intent-map/build.cjs -> context-packet/build.cjs
```

Phase 48 should use the intent map to decide if VTP is justified.

Phase 49 should govern whether recurring intent patterns become reusable memory.

Phase 50 should display the current canonical intent in the cockpit.

Phase 51 should benchmark whether intent mapping reduces irrelevant context
without losing required evidence.

## Acceptance Tests

- Ambiguous phrase `make it lighter` produces multiple meanings and asks a
  clarification when no context resolves it.
- Context-resolved phrase `make cockpit lighter` maps to UI density/color/tone
  only if active context supports that interpretation.
- Operator command with prior complaint links to the right complaint and phase.
- Semantic-only similar phase is excluded when no structural link exists.
- Prompt-injection text inside a source artifact is classified as source text,
  not operator intent.
- Canonical instruction is stable across repeated runs on the same input.
- Intent map logs relationship weights and source reasons.
- Context packet consumes the intent map and includes/excludes context according
  to the map.

## Final Position

Intent English is the meaning layer for SGSD.

Phase capsules compress what happened.
Legal registries define what can be referenced.
Intent maps explain what the operator means.
Context packets deliver only the context needed to act.

Together they turn English from a loose prompt into an auditable execution
language.

