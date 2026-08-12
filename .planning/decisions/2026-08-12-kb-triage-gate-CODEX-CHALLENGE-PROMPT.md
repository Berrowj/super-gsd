# CODEX CHALLENGE — KB-triage gate board memo

Separate adversarial Codex review of the SGSD board's decision before it executes. Find the flaw. Challenge specifically:
1. Is 'build shadow-only, gate promotion on data' genuinely safe, or does shipping a report_only route that logs every prompt create its own cost/privacy issue (logging prompt text)?
2. Is the exclude_regexes approach sound, or will build/fix/run verbs appear INSIDE legitimate KB queries ('what did Luke say about fixing the customs flow') and wrongly suppress them?
3. Is the promote-or-kill threshold well-formed, or hand-wavy? What exact metric + number should be locked?
4. Anything the board should have killed.

Report contract (exact lines): CHALLENGE_VERDICT: memo-sound|memo-needs-revision|memo-unsafe ; SURVIVING_OBJECTIONS: none|<list> ; BINDING_ADDITIONS: none|<list> ; ONE_LINER: <summary>

## Memo
---
decision: hard KB-triage gate
date: 2026-08-12
board: Architect SUPPORT-WITH-CONDITIONS / Contrarian OPPOSE (both conf 4)
verdict: BUILD SHADOW ONLY — promotion to directive gated on measured data
status: PENDING CODEX CHALLENGE
---

# Decision Memo — Hard KB-Triage Gate

## The real split
Architect: build directive gate (a), shadow-first. Contrarian: directive (a) is
NOT a hard gate (injects a string Claude can ignore = forgettable soft-invocation
moved down); soft path miss-rate unmeasured; the deletion beats the build.

## Ruling (CEO synthesis)
BUILD ONLY THE SAFE, MEASURED PART NOW. Do not ship a blind hard gate.

### Unanimous, adopted
1. KILL the "entity exists in KB" trigger — poison pill (per-prompt KB coupling,
   guaranteed false-fires). Pure anchored-lexical only.
2. SHADOW / report_only first — reuse P151 demand-baseline + the existing
   intent_routing_decision ledger. Logs "would-fire", fires nothing. Zero risk.
3. Mandatory exclude_regexes: build|fix|run|test|file-ops verbs. Anchor regexes;
   hold p95 via runBench.

### Build now (safe, ~0 risk, ~0 latency)
- New route in session-governance-hooks.yaml: KB-directed lexical trigger,
  enforcement: kind: report_only (SHADOW), signal logged to the routing ledger.
- Strengthen vtp-query-triage self-invocation description (Contrarian: operator
  may just want reliable self-invoke, not a hook).
- Manual /triage verb the operator can type on demand.

### Gated on data (do NOT build yet)
- Promotion report_only -> directive: ONLY after a shadow window publishes the
  soft-path miss rate + false-fire rate against real prompts, against an explicit
  PROMOTE-OR-KILL threshold set up front (e.g. >=N real KB prompts in 2 weeks the
  soft path demonstrably missed AND false-fire < X%). If the soft path already
  routes KB queries reliably -> KILL the gate (Contrarian wins).
- Option (b) pre-run-inject-result (the only TRULY deterministic form): build
  ONLY if shadow shows directive-inject is routinely IGNORED on true KB hits.

## Honest label
Do not sell directive-inject as "un-forgettable." It is MORE reliable than
CLAUDE.md (fresh injection every matching prompt) but Claude can still ignore it.
The truly-hard form is (b), deferred until data justifies its cost.

## Brief
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
