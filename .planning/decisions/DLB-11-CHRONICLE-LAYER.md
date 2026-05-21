---
type: design-decision
date: 2026-05-21
trigger: Operator-authored DLB-11 proposal — anti-brain-fog Chronicle Layer
board: none (operator-authored design proposal; ratified after orchestrator surfaced 4 tensions; operator confirmed all 3 recommended paths)
predecessor: DLB-10 Context Authority (v3.0 P112)
host_milestone: v3.1 SGSD Chronicle Layer
decision: "Add Operator Chronicle Layer as a first-class SGSD subsystem (DLB-11). Every phase close ships a validated Chronicle: HTML + Markdown + JSON + manifest. Chronicle is a projection of mesh memory + canonical artefacts + cockpit logs + git evidence — never an agent opinion. Validator is a binding gate at phase close (REPORT_UNGROUNDED halts). Forward-only backport policy (v3.0 phases not retrofitted). VTP routing with local fallback. Seven phases (P113-P119)."
---

# DLB-11: Operator Chronicle Layer

## The problem this decision exists to fix

v3.0 (DLB-08 + DLB-09 + DLB-10) shipped a substrate that prevents three failure modes at the AGENT layer:
- Reviewer hallucination (evidence_validator)
- Lost milestone context (Context Authority capsule)
- Session memory death (mesh ledger + lineage DAG)

A fourth failure mode remains at the **operator layer**: brain fog after autonomous phase runs. Each v3.0 phase produced 50-200 commits, 100+ self-test assertions, 5-15 Codex dispatches. The operator can technically resume work but loses the mental model of what just happened. Cognitive drift compounds across phases.

The Clarity ERP 2026-05-18 incident demonstrated the cost from INSIDE: six phases closed PASS while end-to-end behavior was broken, because the operator wasn't tracking what the gates actually verified vs what they claimed to verify. The v3.0 substrate prevents that class of failure at agent layer; v3.1 prevents it at operator layer.

## The decision

**DLB-11 Operator Chronicle Layer.** Every phase close (and milestone close) ships a validated chronicle. The chronicle is an HTML projection of SGSD truth — mesh memory + canonical artefacts + cockpit logs + git evidence — that the operator reads to maintain cognitive grip.

### The architectural rule (binding)

```
A phase is not cognitively complete until the operator can understand it.
Technical completeness (tests pass, gates pass, promotion decision exists) is necessary but not sufficient.
SGSD optimizes for both.
```

### The four invariants

1. **Chronicle = projection, never authority.** Same rule as `context_anchor` in DLB-10. Every claim in the HTML links to a CMB key, file path, test name, or commit SHA. Synthesis (ELI5, "what to remember tomorrow") is OK iff it sits on top of cited evidence.
2. **Separate doing / judging / deciding / explaining.** The Chronicle Writer is a new role peer with its own input contract; it does NOT also do the work. Validator is yet another role. Same architectural shape that fixed ATC v22-13c.
3. **Validator before publish.** Ungrounded reports become fog machines. The validator must run before any HTML is operator-facing. Binding gate at phase close (REPORT_UNGROUNDED halts).
4. **Static, self-contained, offline-survivable.** Inline SVG, no CDN, no JS deps. Matches the v3.0 user-guide pattern.

### The chronicle pipeline

```
phase-close
  ↓
collect artefacts (mesh CMBs + planning files + git evidence + cockpit logs)
  ↓
build CHRONICLE-CONTEXT.json (context-pack builder, P114)
  ↓
render HTML + MD + JSON (renderer, P115)
  ↓
validate against evidence (validator, P116; binding gate)
  ↓
publish (VTP-MCP if available, local fallback, P117)
  ↓
index for future retrieval (P119 roadmap miner)
```

### The six roles (separation enforced)

| Role | Job |
|---|---|
| Executor (Codex) | Does the work |
| SGSD | Emits execution_receipt from observable facts |
| Reviewer (ATC / Codex native) | Emits review_finding claims |
| Evidence validator | Emits evidence_verdict per claim |
| Pseudo operator | Emits decision_recommendation |
| **Chronicle Writer** | **Renders human-readable story (NEW)** |
| **Chronicle Validator** | **Checks chronicle is grounded (NEW)** |

The Chronicle Writer does NOT also do the work. The Chronicle Validator does NOT also write the chronicle. Same architectural lesson as DLB-08.

### The HTML document structure

Standard layout for every chronicle:

1. At-a-glance summary
2. ELI5 explanation
3. Why this phase existed
4. What changed
5. How it worked
6. What agents did
7. What was verified
8. What reviewers claimed
9. What was refuted or disputed
10. Key decisions made
11. File and architecture impact
12. Persona/user impact
13. Risks and rollback
14. What happens next
15. Lineage graph
16. Timeline
17. Raw evidence appendix

Plus an **Agent Autonomy Disclosure** panel showing what SGSD decided without operator and the hard carve-outs that fired vs didn't.

### Visualizations (all inline SVG)

1. Phase timeline (CONTEXT → RESEARCH → PLAN → PLAN-CHECK → EXECUTION → REVIEW → VALIDATION → PROMOTION; green/amber/red per stage)
2. Lineage graph (CMB DAG visualization)
3. File impact map (changed / read / at-risk / protected / out-of-scope)
4. Decision matrix (options + chosen path + rationale + risk + rollback)
5. Persona impact lanes (sales / procurement / warehouse / finance / operator etc.)
6. Gate waterfall (preflight / schema gate / plan-check / ATC / evidence validator / pseudo operator / promotion gate; status per gate)
7. Before/after repo state ("what changed in plain language")
8. Operator cognition check ("what you should understand" vs "what SGSD decided without you" vs "what SGSD did NOT decide")

### The Fog Score

Metric on cognitive cost per phase. Computed from:
- Number of agent dispatches
- Token spend
- Number of files changed
- Number of review loops
- Number of disputed claims
- Number of stale/echoed findings
- Number of plan revisions
- Number of unresolved risks
- Time since last operator decision
- Dependency depth

High Fog Score triggers a "must read sections X, Y, Z" recommendation in the chronicle.

### Storage routing

- **VTP-MCP if available**: upsert phase-chronicle.json + summary embedding + HTML/blob reference + linked CMB IDs
- **Local fallback**: `.planning/chronicles/{milestone}/P{NN}/` directory tree + index ledger
- Chronicle generation NEVER blocks on VTP availability. Local-first is always safe.

### Forward-only backport policy

v3.0 phases (P106-P112) closed WITHOUT chronicles under v3.0 rules. They are NOT retrofitted. Operator lived through them; backport effort exceeds value.

**One exception under consideration**: P119 may author a single v3.0 milestone-level retrospective chronicle. Per-phase backport is OFF; milestone-level one-off is OPEN (P119 decides).

### Phase-close binding gate

A phase progresses through these statuses:

```
PHASE_COMPLETE_PENDING_CHRONICLE
  → PHASE_CHRONICLE_RENDERED
  → PHASE_CHRONICLE_VALIDATED
  → PHASE_CLOSED
```

If chronicle-validator returns REPORT_UNGROUNDED, the phase HALTS at PENDING_CHRONICLE. Operator may either fix the chronicle (re-render) or explicitly skip-gate via `skip_gates: ["chronicle-validation"]` with `skip_reason:` REQUIRED. The strict reading wins.

## Drift Risks (binding watchlist)

Eight risks re-checked at every v3.1 phase close:

1. Chronicle becomes another agent opinion (prevented by validator binding gate + cite-every-claim rule)
2. Synthesis bloat (prevented by sized ELI5/recommendations + cite-or-omit rule)
3. Phase close gates degrade to advisory (REPORT_UNGROUNDED is HARD halt)
4. External CDN/JS dependencies creep in (validator checks for inline-only)
5. Backport scope creep (forward-only; max one v3.0 milestone retro)
6. VTP storage becomes critical-path dependency (local fallback always safe)
7. Cockpit-Chronicle overlap (enforced different roles)
8. Chronicle writer becomes the same agent that did the work (separate role + separate Codex dispatch)

## What this decision explicitly does NOT do

- Does not replace mesh memory ledger as canonical truth (chronicle is projection)
- Does not retrofit chronicles for v3.0 phases (forward-only)
- Does not introduce external CDN/JS dependencies (offline-survivable)
- Does not allow agent self-summary (six distinct roles)
- Does not gate phase close in advisory mode (binding hard-halt)
- Does not pre-promote operator escalation past escalation_gate carve-outs (DLB-08 invariants survive)

## Implementation sequence (P113–P119)

| Phase | DLB | Files (approx) | Outcome |
|---:|---|---|---|
| P113 | DLB-11.1 | chronicle.schema.json + chronicle-manifest.schema.json + fixtures (good × 5, bad × 5) | Schema contract; ajv-errors CHRONICLE-XX codes |
| P114 | DLB-11.2 | super-gsd/tools/chronicle/build-context-pack.cjs + run-self-test | Reads mesh + planning + git → CHRONICLE-CONTEXT.json |
| P115 | DLB-11.3 | super-gsd/tools/chronicle/render-html.cjs + inline SVG diagram modules | HTML + MD + JSON renderer; static; no JS deps |
| P116 | DLB-11.4 | super-gsd/tools/chronicle/validate-chronicle.cjs + binding-gate wiring | Validator emits REPORT_GROUNDED or REPORT_UNGROUNDED |
| P117 | DLB-11.5 | super-gsd/tools/chronicle/publish.cjs + VTP/local adapter | Storage routing; index ledger |
| P118 | DLB-11.6 | Cockpit integration (TBD: 12th section vs sidecar) | Chronicle ↔ Cockpit cross-links + Fog Score badge |
| P119 | DLB-11.7 | super-gsd/tools/chronicle/milestone-chronicle.cjs + mine-roadmap.cjs + optional v3.0 retro | Milestone-level chronicles + cross-milestone roadmap mining |

After P119, every v3.1 phase has cognitive completeness as a binding gate, plus a first cross-milestone retrospective lens.

## Cross-references

- `.planning/milestones/v3.1/INTENT.md` — milestone strategic frame
- `.planning/milestones/v3.1/ROADMAP.md` — 7-phase mapping
- `.planning/milestones/v3.1/phases/113-chronicle-schema-manifest/113-CONTEXT.md` — first phase contract (next)
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — predecessor; mesh memory substrate that chronicles consume
- `.planning/milestones/v3.0/SUMMARY.md` — v3.0 close marker
- `.planning/analyses/2026-05-21-sgsd-v3-user-guide.html` — POC for HTML style + ELI5 idiom
- `super-gsd/schemas/cmb.schema.json` — CMB types chronicle consumes as evidence
- `super-gsd/tools/mesh-memory/*` — runtime inputs to context-pack builder
