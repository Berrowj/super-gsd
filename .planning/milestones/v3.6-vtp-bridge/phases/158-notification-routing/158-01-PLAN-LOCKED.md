---
schema_version: 2
phase: 158
slug: notification-routing
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 1
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
carved_from: "155"
depends_on: ["155"]
intent: >
  Keep automated task-notification turns out of prompt-time routing and demand
  evidence while preserving genuine operator intent, including operator turns
  that quote notification-shaped text.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      A real operator-shaped UserPromptSubmit payload with origin.kind=human,
      promptSource=typed, and a planning prompt that matches the established
      planning-triage route.
    expected_outcome: >
      Classification evaluates the existing route tables, returns the matched
      planning route and directive, and writes the normal text-free matched
      intent_routing_decision row rather than automated_turn_skip.
    verification_cmd: 'node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test'
  - input: >
      A text-redacted fixture preserving the two 2026-08-19 false-positive
      payloads' real structure: UserPromptSubmit, origin.kind=task-notification,
      promptSource=system, and a whole anchored task-notification envelope whose
      opaque inner content contains known planning, suggestion, and KB-shadow
      triggers.
    expected_outcome: >
      Classification returns no routes, directives, suggestions, or stdout;
      reads/evaluates zero route tables and zero shadow routes; writes exactly
      one text-free intent_routing_decision row with
      decision=automated_turn_skip, empty route/directive/suggestion arrays,
      structural origin markers and zero evaluation counters; and writes no
      KB-shadow row. No prompt, inner value, task id, output path, summary, or
      result text appears in evidence.
    verification_cmd: 'node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test'
  - input: >
      A real operator-shaped UserPromptSubmit payload with origin.kind=human and
      promptSource=typed whose planning request quotes the same
      notification-shaped envelope and trigger-bearing text used by the
      automated-turn fixture.
    expected_outcome: >
      The operator turn is not skipped: its established planning route fires
      and the written decision is matched. Quoted notification text cannot
      substitute for automated origin metadata.
    verification_cmd: 'node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test'
  - input: >
      The complete existing intent-classifier self-test and P152 KB-shadow
      assertion after the origin gate is added.
    expected_outcome: >
      All pre-existing classifier assertions remain green; kb-lookup-triage
      stays shadow-only and text-free; no route, predicate, enforcement kind,
      or cosine behavior changes.
    verification_cmd: >
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
known_deadends:
  - Do not blacklist phrases such as notification summaries, completion wording, planning verbs, or system-reminder text. A lexical blacklist fails the operator-quoting direction and can hide real demand.
  - Do not infer automated origin from prompt text or envelope tags alone. Require the recorded task-notification/system origin tuple and whole-envelope structure so a human quote remains routable.
  - Do not add routes, weaken predicates, change enforcement kinds, add cosine matching, edit either routing registry, or change P152 shadow behavior.
  - Do not represent a skipped automated turn by an absent row or by no_match. P153 requires written negative evidence, and automated_turn_skip must be distinguishable from an evaluated operator non-match.
  - Do not write prompt text, excerpts, inner envelope values, task ids, tool-use ids, output paths, summaries, results, entities, or query text to any ledger.
  - Do not create a second ledger or duplicate gate-evidence machinery; extend the classifier's existing intent_routing_decision append path and no_match row envelope.
tasks:
  - id: P158-T1
    type: automated-turn-origin-gate
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/hooks/sgsd-intent-classifier.cjs
    input_contract: >
      Work red-first in the classifier's existing selfTest(). Before changing
      routing, add three stdin child-process fixtures using the production
      parsePayload -> rootFromPayload -> emitClassification path and isolated
      temporary SGSD roots: (1) human/typed planning input, (2) the redacted
      real automated shape, and (3) human/typed input quoting the same
      notification shape. Preserve only structural facts from the two
      2026-08-19 false positives: origin.kind=task-notification,
      promptSource=system, a whole anchored task-notification envelope, and the
      established text-free intent_routing_decision row shape. Use fresh opaque
      sentinels for every inner value; never copy notification text into the
      plan, fixture output, or ledger. Make the automated prompt contain known
      compatibility, P149 suggestion, and P152 strong-KB triggers so any
      evaluation is observable. Record the genuine red: today it emits matched
      routing evidence. Add one small payload-origin classifier requiring
      hook_event_name=UserPromptSubmit, the exact automated origin/source tuple,
      and the whole supported task-notification/system-reminder envelope. Invoke
      it at the start of emitClassification, before readRegistry,
      matchingRoutes, evaluateShadowRoutes, routeDirectives, or stdout. On an
      automated result, extend/reuse appendRoutingDecision's existing
      logGateEvidence envelope to append one intent_routing_decision row with
      decision=automated_turn_skip, reason_codes containing only a stable
      automated-origin code, empty route_ids/directives/suggestions,
      origin_kind=task-notification, prompt_source=system,
      route_evaluation_count=0, and shadow_evaluation_count=0; then return the
      existing empty classification shape. Normal matched/no_match rows must
      retain their current behavior. In the self-test, assert the automated
      child has empty stdout, exactly one skip row, no degraded/matched/no_match
      companion row, no KB-shadow row, and none of its sentinels or forbidden
      text-bearing keys in serialized evidence. Assert both human children
      match planning-triage and never write automated_turn_skip. Clean every
      temporary root in finally blocks.
    output_contract: >
      The classifier structurally identifies automated task-notification origin
      before every compatibility, P149, and P152 evaluation; records one
      explicit text-free automated_turn_skip row with zero-evaluation evidence;
      and leaves human routing, including quoted notification text, unchanged.
      The implementation and its existing in-file falsifier are one-file and
      independently revertable.
    hypothesis: >
      The hook payload's recorded origin/source tuple plus whole-envelope shape
      separates system-generated task notifications from human turns without
      inspecting or suppressing lexical intent.
    falsifier: >
      The pre-fix automated fixture starts green; a human planning turn stops
      matching; the automated fixture reads a registry, evaluates any normal or
      shadow route, emits stdout, writes absent/no_match/matched or multiple
      evidence instead of one automated_turn_skip row, or leaks any inner text;
      a human turn quoting the same notification shape is skipped; any registry,
      route, predicate, enforcement kind, cosine behavior, KB-shadow test, or
      file outside the classifier changes.
    stop_rule: >
      Stop after the recorded red, all three directions pass through production
      stdin parsing, the skip row is written and mechanically text-free with
      both evaluation counters zero, the existing classifier and KB-shadow
      self-tests exit 0, the source diff is exactly one file, and T1 is one
      revertable commit.
    verification_cmd: >
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
    expected_ATC_tier: GATE
---

# P158 - Notification Routing

One red-first, independently revertable classifier change adds a structural
origin gate before all prompt-time route evaluation. The existing in-file
self-test owns the three-direction falsifier; the P152 assertion remains an
unchanged regression guard. No route table, registry, or additional ledger is
introduced.