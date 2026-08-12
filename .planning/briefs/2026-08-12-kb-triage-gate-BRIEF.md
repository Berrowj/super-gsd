---
brief: hard KB-triage gate (auto-route KB-directed prompts through vtp-query-triage)
date: 2026-08-12
for: SGSD Board (Architect + Contrarian)
---

# Proposal
Make VTP triage a HARD, always-on gate — not CLAUDE.md discipline (which the LLM
forgets). Mechanism: extend the P146 UserPromptSubmit hook
(sgsd-intent-classifier.cjs + session-governance-hooks.yaml) with a NEW route
whose trigger matches KB-directed intent and whose enforcement routes to
vtp-query-triage. Deterministic (harness-fired), un-forgettable.

# Operator's hard constraint
Must NOT fire on literally every prompt. Precision over recall. Bias to
false-negatives (miss a borderline KB query) over false-positives (nag on coding
tasks / general chat).

# Proposed trigger scope
FIRE on: meeting|call|transcript|recording refs; "import"; "last/latest meeting
with <name>"; "what did <person> say"; explicit Clarity/VTP/corpus refs; a named
entity that EXISTS in the KB (person/project/company).
DON'T FIRE on: coding tasks, file ops, fix/run/build/test, general chat.

# Proposed calibration (the safe path)
Build SHADOW / log-only first (reuse the P151 demand-baseline instrument):
matcher records "would have fired" per real prompt WITHOUT firing. Read the log
after real usage; tune trigger to acceptable precision; THEN flip enforcement
log-only -> directive. Do not hard-gate a blind regex.

# Design dial to rule on
(a) enforcement: kind: directive — injects "run vtp-query-triage" (an instruction
    Claude acts on), vs
(b) hook pre-runs the triage classifier and injects the RESULT (route already
    decided) — strongest/most un-forgettable, more to build.

# Questions for the board
1. Is shadow-first-then-promote the right discipline, or over-engineering for an
   internal gate we fully control?
2. directive-inject (a) vs pre-run-inject-result (b) — which for a true hard gate?
3. What is the kill-switch / false-positive budget that says "the trigger is too
   loose, revert to log-only"?
4. Entity-check against the KB in the trigger: worth the coupling, or keep the
   trigger pure-lexical for speed/independence?
