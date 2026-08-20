---
phase: "159"
slug: skill-routing-expansion
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: ["155", "158"]
scope_locked_by: operator
scope_locked_at: 2026-08-20
---

# P159 Context — Skill-Routing Expansion (shadow-first)

## Goal

Triage today routes a fixed ~24-row registry; the devcp inventory holds 60+ skills the
classifier can never offer (/create-quote, /erp-resolve, /clarity-engines,
/vtp-implementation-pack, the diagram family). Extend coverage the way P152
established: SHADOW ROWS first, measured, then promoted — never blanket directives.

## Locked design constraints (do not relitigate)

- NO embeddings/cosine/similarity scoring in the hook. Phase 47/48 lock: routing is
  gated only by structural predicates; the classifier is a local lexical router with a
  2s budget. Operator raised cosine 2026-08-20; answered with the shadow-measurement
  alternative and accepted via "go".
- Evidence-first (DLB-02): every new route family enters as `kind: shadow` or
  `suggestion`, with text-free telemetry, and promotes only on measured hits.
- The registry is super-gsd-owned and propagates; the SKILLS it references are often
  instance-local. A row must therefore be AVAILABILITY-GUARDED: the classifier checks
  the skill exists on this instance before emitting a suggestion, else logs
  skill_unavailable (text-free) and stays silent. Suggesting a skill an instance lacks
  is a new defect class; do not ship it.

## Scope

### T1 — Availability guard in the classifier
Suggestion/directive emission verifies the target skill resolves on the local instance
(global ~/.claude/skills, ~/.claude/commands, project .claude). Unavailable => silent +
ledger row. Falsifier both ways.

### T2 — Shadow/suggestion rows for the ERP and VTP skill families
Anchored-lexical triggers for: quote-shaped intents (/create-quote), record-resolution
(/erp-resolve), engine/RAG lookups (/clarity-engines), meeting-import
(/vtp-implementation-pack), procurement-status (/jcl-procurement-report), and
explainer/diagram intents (/vtp-html-explainer vs /diagram-design boundary). Start
suggestion-tier for low-risk, shadow-tier where a wrong fire would mislead. Reuse
strong-positive-beats-verb tiering from kb-lookup-triage.

### T3 — Description standard + lint
Ship a skill-description standard (trigger conditions + boundary against neighbours +
when-NOT-to-use, modelled on /create-quote's "gated, dry-run first") and a lint that
flags description-less or one-noun descriptions. Applies to super-gsd skills directly;
devcp-local skills get the standard via overlay docs.

## Explicitly out

- The devcp MODULE_NOT_FOUND hook fix: operator-side per-worktree reinstall,
  documented in P155 SUMMARY. Not code here.
- Any cosine/embedding scorer (locked out above).
- Auto-invoking skills. Suggestions and shadows only; directives need their own
  promotion case per route.

## Evidence available to the planner

- Live ledger already shows the mechanism working: matched suggestion rows
  (/sgsd-readiness, /sgsd-vtp-advise fired 2026-08-20) and explicit no_match rows.
- P152's promote-or-kill metric shape is the template for any shadow row family.
- Devcp's control plane (ae3522a5) has a job registry; unrelated to this phase but do
  not collide with its files.
