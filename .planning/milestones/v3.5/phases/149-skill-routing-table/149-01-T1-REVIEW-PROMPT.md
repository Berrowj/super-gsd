# P149-T1 SPEC + PER-DISPATCH ATC REVIEW

Review the new file below against the T1 contract. (1) Spec: does it satisfy the input/output contract, falsifier, and Registry Content Contract — every inventory item covered as route or explicit alias/omit, no gate-predicate duplication? (2) ATC: 10-point anti-slop on the content (no speculative rows, no dead config). Host verification: rows=24, field check passed.

Emit ALL these exact lines:
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <N/M>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required
Then FINDINGS_DETAIL lines for CRITICAL/WARNING.

## T1 contract
  - id: "P149-T1"
    type: "registry"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/registry/skill-routing.yaml"
    input_contract: >
      Implement only the registry table using the Registry Content Contract and Inventory Decisions. Do not edit classifier or orchestrator code in this task.
    output_contract: >
      `super-gsd/registry/skill-routing.yaml` exists with a single top-level routing array that covers the required inventory decisions without duplicating gate predicates.
    hypothesis: "A single per-skill routing table can cover neglected skill inventory and legacy alias decisions without duplicating gate predicates."
    falsifier: >
      Any required inventory item is absent, any route row lacks skill/signatures/moment/modes, or any cooldown copies a predicate instead of referencing a gate name or route policy.
    stop_rule: >
      Stop after the registry table exists and the verification command reports row count plus inventory coverage; do not edit classifier, orchestrator, or docs in this task.
    verification:
      commands:
        - >-
          node -e "const fs=require('fs'); const yaml=require('js-yaml'); const doc=yaml.load(fs.readFileSync('super-gsd/registry/skill-routing.yaml','utf8')); const rows=doc.routes||doc.skills; if(!Array.isArray(rows)) throw new Error('routes array missing'); for(const [i,r] of rows.entries()){ for(const k of ['skill','signatures','moment','modes']) if(r[k]===undefined) throw new Error(i+': missing '+k); if(r.cooldown&&r.cooldown.predicate) throw new Error(i+': predicate duplication forbidden'); } console.log('skill-routing rows='+rows.length);"

## Registry Content Contract + Inventory Decisions
## Registry Content Contract

The table should use a single top-level array, preferably `routes`, where each row is one `skill + moment` decision. Repeating a skill across moments is allowed.

Required row fields:

- `skill`: canonical skill name to invoke or suggest.
- `signatures`: prompt regexes/phrases and/or event names.
- `moment`: one of `prompt-time`, `phase-close`, `milestone-close`, `weekly`, `on-demand`.
- `modes`: any of `manual`, `semi`, `auto`.
- `cooldown`: optional policy object.

Allowed optional fields:

- `aliases`: legacy names or operator-entered names covered by the row.
- `availability`: `canonical`, `alias`, `manual-only`, `external-if-installed`, or `omitted`.
- `gate_ref`: gate registry name when eligibility belongs to `gates.yaml`.
- `skip_reason`: fixed reason for omitted/unavailable legacy rows.
- `notes`: operator-facing explanation.

Do not copy `gates.yaml` predicates into this file. For MUDA and memory gates, encode only a gate reference such as `gate_ref: muda-audit` or `gate_ref: memory-curate`; the runtime helper consults existing gate/gate-adjacent mechanisms or records `skipped` with `gate_ref_not_triggered`.

## Inventory Decisions

Minimum table coverage must include these decisions:

- `sgsd-muda-audit`: prompt-time suggestion plus phase-close scheduled route; phase-close eligibility references `muda-audit` gate, no threshold duplication.
- `sgsd-token-audit`: prompt-time suggestion plus milestone-close route; milestone behavior remains owned by `sgsd-complete-milestone`.
- `sgsd-distill`: milestone-close route with once-per-milestone cooldown.
- `sgsd-sepl`: prompt-time/on-demand route for major proposals and architecture tradeoffs.
- `sgsd-overwatcher`: phase-close auto route with once-per-phase cooldown.
- `sgsd-readiness`: prompt-time/on-demand route and auto-mode readiness route reference.
- `sgsd-audit`: phase-close route and milestone-close route; milestone-close can remain blocking where existing audit policy says so.
- `sgsd-memory hygiene`: route as canonical `sgsd-memory-hygiene` or paired aliases `sgsd-recall` and `sgsd-curate`; use gate references for recall/curate discipline rather than copied predicates.
- `sgsd-vtp-advise`: prompt-time/on-demand route; graceful-fail behavior remains in the skill.
- `sgsd-health` and `gsd-health`: alias to `sgsd-readiness`; do not create a new health skill.
- `gsd-cleanup`: omit from auto scheduling; manual/on-demand suggestion only if a first-class command exists, otherwise `availability: omitted` with `skip_reason: legacy_unregistered`.
- `gsd-code-review`: prompt-time/on-demand route as `external-if-installed`; phase-close governance remains `sgsd-audit`.
- `gsd-code-review-fix`: prompt-time/on-demand only; never scheduled automatically because it mutates code.
- `gsd-verify-work`: alias to existing SGSD verification/ATC flow; prompt-time suggestion may preserve the legacy name.
- `gsd-secure-phase`: alias to existing security/edge-guard governance if registered; otherwise manual/on-demand omitted row with explicit skip reason.

## Serial Execution Prompts

## The new file (full)
```yaml
routes:
  - skill: sgsd-muda-audit
    signatures:
      phrases:
        - muda
        - waste
        - retrospective
        - retro
        - what went wrong
        - conformance drift
      regexes:
        - '\b(?:muda|waste|wasted|wasting)\b'
        - '\b(?:retrospective|retro)\b.{0,160}\b(?:waste|drift|missed|wrong)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: Suggest MUDA review when the operator asks about waste, drift, or retrospective learning.

  - skill: sgsd-muda-audit
    signatures:
      event_names:
        - phase-close
    moment: phase-close
    modes:
      - semi
      - auto
    availability: canonical
    gate_ref: MUDA-waste-audit
    cooldown:
      policy: gate-controlled
      scope: phase
    notes: Scheduled eligibility belongs to the existing MUDA-waste-audit gate; this table does not copy its thresholds.

  - skill: sgsd-token-audit
    signatures:
      phrases:
        - token spend
        - token budget
        - token burn
        - context cost
        - token waste
      regexes:
        - '\btokens?\b.{0,160}\b(?:spend|spent|burn|budget|cost|waste)\b'
        - '\b(?:spend|spent|burn|budget|cost|waste)\b.{0,160}\btokens?\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: Suggest token triage when the prompt discusses token burn, budget, or cost.

  - skill: sgsd-token-audit
    signatures:
      event_names:
        - milestone-close
    moment: milestone-close
    modes:
      - semi
      - auto
    availability: canonical
    cooldown:
      policy: sgsd-complete-milestone-owned
      scope: milestone
    notes: Milestone token behavior remains owned by sgsd-complete-milestone.

  - skill: sgsd-distill
    signatures:
      event_names:
        - milestone-close
      phrases:
        - distill milestone
        - trajectory distill
        - summarize learnings
    moment: milestone-close
    modes:
      - semi
      - auto
    availability: canonical
    cooldown:
      policy: once-per-milestone
      scope: milestone
    notes: Distill milestone learnings once per milestone boundary.

  - skill: sgsd-sepl
    signatures:
      phrases:
        - major proposal
        - architecture tradeoff
        - architecture trade-off
        - strategic tradeoff
        - strategic trade-off
        - sets precedent
      regexes:
        - '\b(?:architecture|system|governance)\b.{0,120}\b(?:tradeoffs?|trade-offs?|decision|proposal)\b'
        - '\bshould\s+we\b.{0,160}\b(?:choose|adopt|standardize|centralize|decentralize|replace)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: Suggest SEPL deliberation for major proposals and architecture tradeoffs.

  - skill: sgsd-sepl
    signatures:
      phrases:
        - sgsd-sepl
        - sepl
        - deliberate
        - deliberate decision
    moment: on-demand
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: Preserve explicit operator access to SEPL deliberation.

  - skill: sgsd-overwatcher
    signatures:
      event_names:
        - phase-close
    moment: phase-close
    modes:
      - auto
    availability: canonical
    cooldown:
      policy: once-per-phase
      scope: phase
    notes: Auto-mode phase-close watcher fires at most once for a phase.

  - skill: sgsd-readiness
    aliases:
      - sgsd-health
      - gsd-health
    signatures:
      phrases:
        - readiness
        - release readiness
        - health check
        - sgsd-health
        - gsd-health
      regexes:
        - '\b(?:ready|readiness|health)\b.{0,120}\b(?:ship|release|close|phase|milestone)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: Health legacy names are aliases to readiness, not separate skills.

  - skill: sgsd-readiness
    aliases:
      - sgsd-health
      - gsd-health
    signatures:
      phrases:
        - readiness
        - release readiness
        - health check
        - sgsd-readiness
        - sgsd-health
        - gsd-health
    moment: on-demand
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: On-demand health/readiness requests route to sgsd-readiness.

  - skill: sgsd-readiness
    signatures:
      event_names:
        - phase-close
        - auto-mode-readiness
    moment: phase-close
    modes:
      - auto
    availability: canonical
    cooldown:
      policy: route-policy
      scope: phase
    notes: Auto-mode readiness is a route reference; readiness scoring remains in existing readiness policy.

  - skill: sgsd-audit
    signatures:
      event_names:
        - phase-close
    moment: phase-close
    modes:
      - semi
      - auto
    availability: canonical
    gate_ref: phase-level-ATC
    cooldown:
      policy: gate-controlled
      scope: phase
    notes: Phase-close governance remains SGSD audit/ATC.

  - skill: sgsd-audit
    signatures:
      event_names:
        - milestone-close
    moment: milestone-close
    modes:
      - semi
      - auto
    availability: canonical
    cooldown:
      policy: sgsd-complete-milestone-owned
      scope: milestone
    notes: Milestone-close audit can remain blocking where existing audit policy says so.

  - skill: sgsd-memory-hygiene
    aliases:
      - sgsd-recall
    signatures:
      phrases:
        - sgsd-memory
        - sgsd-memory-hygiene
        - sgsd-recall
        - recall memory
        - memory recall
      regexes:
        - '\b(?:recall|remember|memory)\b.{0,120}\b(?:context|decision|precedent|learning)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    gate_ref: sgsd-recall-queries
    notes: Recall discipline references the existing recall-query gate instead of duplicating its predicate.

  - skill: sgsd-memory-hygiene
    aliases:
      - sgsd-curate
    signatures:
      event_names:
        - phase-close
      phrases:
        - sgsd-curate
        - curate memory
        - curate learnings
        - memory hygiene
    moment: phase-close
    modes:
      - semi
      - auto
    availability: canonical
    gate_ref: sgsd-curate-learnings
    cooldown:
      policy: gate-controlled
      scope: phase
    notes: Curate discipline references the existing learning-curation gate instead of duplicating its predicate.

  - skill: sgsd-vtp-advise
    signatures:
      phrases:
        - vtp advise
        - vtp context
        - vtp enrichment
        - private kb
        - knowledge bank
      regexes:
        - '\bvtp\b.{0,120}\b(?:advise|context|enrich|knowledge|kb)\b'
        - '\b(?:private\s+kb|knowledge\s+bank)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: VTP graceful-fail behavior remains inside the skill.

  - skill: sgsd-vtp-advise
    signatures:
      phrases:
        - sgsd-vtp-advise
        - vtp advise
        - advise from vtp
        - check vtp
    moment: on-demand
    modes:
      - manual
      - semi
      - auto
    availability: canonical
    notes: Explicit VTP requests route to the VTP adviser, which degrades gracefully when absent.

  - skill: gsd-cleanup
    signatures:
      phrases:
        - gsd-cleanup
        - cleanup gsd
        - clean up gsd
        - cleanup workspace
    moment: on-demand
    modes:
      - manual
    availability: omitted
    skip_reason: legacy_unregistered
    notes: Not auto-scheduled; no first-class registered cleanup command was found.

  - skill: gsd-code-review
    signatures:
      phrases:
        - gsd-code-review
        - code review
        - review my code
        - review this change
      regexes:
        - '\bcode\s+review\b'
        - '\breview\b.{0,120}\b(?:diff|change|commit|code)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
    availability: external-if-installed
    notes: Prompt-time external review can be suggested; phase-close governance remains sgsd-audit.

  - skill: gsd-code-review
    signatures:
      phrases:
        - gsd-code-review
        - run code review
        - external code review
    moment: on-demand
    modes:
      - manual
      - semi
    availability: external-if-installed
    notes: On-demand external review remains opt-in and is not a phase-close scheduler.

  - skill: gsd-code-review-fix
    signatures:
      phrases:
        - gsd-code-review-fix
        - fix review findings
        - apply code review fixes
        - address review comments
      regexes:
        - '\bfix\b.{0,120}\b(?:review|findings|comments)\b'
    moment: prompt-time
    modes:
      - manual
    availability: manual-only
    notes: Never scheduled automatically because this route mutates code.

  - skill: gsd-code-review-fix
    signatures:
      phrases:
        - gsd-code-review-fix
        - fix review findings
        - apply code review fixes
    moment: on-demand
    modes:
      - manual
    availability: manual-only
    notes: Manual-only on-demand route for mutation-bearing review fixes.

  - skill: sgsd-audit
    aliases:
      - gsd-verify-work
    signatures:
      phrases:
        - gsd-verify-work
        - verify work
        - verify this work
        - run verification
        - atc flow
      regexes:
        - '\bverify\b.{0,120}\b(?:work|change|phase|implementation)\b'
    moment: prompt-time
    modes:
      - manual
      - semi
      - auto
    availability: alias
    gate_ref: phase-level-ATC
    notes: Legacy verify-work requests route to existing SGSD verification and ATC flow.

  - skill: gsd-secure-phase
    signatures:
      phrases:
        - gsd-secure-phase
        - secure phase
        - security phase
        - phase security review
    moment: on-demand
    modes:
      - manual
    availability: omitted
    skip_reason: legacy_security_governance_unregistered
    notes: No first-class secure-phase route or gate registry entry was found; security remains covered by existing edge-guard and review governance.```
