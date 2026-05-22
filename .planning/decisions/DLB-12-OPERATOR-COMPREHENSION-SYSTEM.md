---
type: design-decision
date: 2026-05-22
trigger: Operator request — upgrade chronicle HTML to gold-reference + improve the cockpit, grounded in VTP book research
board: none (operator-directed; scope confirmed via two scoping questions 2026-05-22)
predecessor: DLB-11 Operator Chronicle Layer (v3.1)
host_milestone: v3.2 Operator Comprehension System
decision: "Make SGSD explain itself world-class across BOTH operator-facing surfaces. v3.1 proved the chronicle can be a validated projection of phase truth; v3.2 (a) upgrades the chronicle HTML to the gold-reference standard derived from book research, and (b) extends the same answer-first discipline to the LIVE cockpit by evolving cockpit-sidecar.cjs. One shared design system, two surfaces, 8 phases (P120-P127)."
---

# DLB-12: Operator Comprehension System

## The problem this decision exists to fix

v3.1 (DLB-11) shipped the Chronicle Layer — a validated, evidence-grounded projection of what happened in a phase. It works. But two things became clear immediately after:

1. **The chronicle HTML is structurally correct but not yet world-class.** It renders 17 flat sections. A retrieve-per-book-first research pass against the VTP Qdrant knowledge base (`.planning/analyses/2026-05-22-chronicle-html-book-research.html`) mined 4 communication books — The Minto Pyramid Principle, Made to Stick, Storytelling with Data, The Back of the Napkin — and produced 12 evidence-grounded design rules + an answer-first 11-section order. None of that is wired into the renderer yet.

2. **The cockpit is the operator's LIVE surface and it lags the chronicle.** The chronicle answers "what happened?" well; the cockpit answers "what's happening now?" poorly. The same book principles — answer-first (Minto), preattentive single-focus and colour-used-sparingly (Storytelling with Data), one North Star not five (Made to Stick Commander's Intent), information-overload is the default condition (Back of the Napkin) — apply to a live dashboard even harder than to a static report.

v3.1 made SGSD explain a phase *after* it closes. v3.2 makes that explanation excellent, and extends the same discipline to the surface the operator actually watches while work is happening.

## The decision

**DLB-12 Operator Comprehension System.** One shared design system, two operator-facing surfaces, both answer-first, both grounded in the 2026-05-22 book research.

### The architectural rule (binding)

```
The chronicle and the cockpit are two views of the same truth, not two codebases.
They share one visual design system and one set of comprehension rules.
A design choice on either surface must trace to a retrieved book principle,
or be explicitly flagged as un-grounded.
```

### The six DLB-12 invariants

1. **One shared design system.** The gold-reference visual language (`super-gsd/tools/chronicle/templates/chronicle-gold-reference.html`) becomes a shared stylesheet that BOTH the chronicle HTML and the cockpit consume. No per-surface CSS divergence.
2. **Answer-first everywhere.** Both surfaces lead with the decision / North Star; support sits beneath (Minto top-down). The chronicle's Operator Decision Panel and the cockpit's North-Star banner are the same idea in two tenses.
3. **Cockpit evolves `cockpit-sidecar.cjs`; it does not rebuild and does not touch Lock-13.** The v3.1 P118 sidecar already reads every relevant signal read-only and deliberately sidesteps the v2.9 frozen cockpit array (Lock-13). v3.2 upgrades its output, not its read-surface.
4. **Preattentive discipline.** Exactly one element grabs the eye per surface; colour is used sparingly (Storytelling with Data: "by making so many things different we lose the strategic preattentive value of colour"). A cockpit that highlights everything highlights nothing.
5. **Still a projection, never an opinion.** DLB-11 R3 holds — the chronicle is a deterministic projection with cited claims. The cockpit shows live SGSD state read-only; it is also never an agent opinion layer.
6. **Book-research-grounded.** The 12 design rules in `.planning/analyses/2026-05-22-chronicle-html-book-research.html` are binding. New design choices must cite a retrieved principle. The 3 absent books (Resonate, Simply Said, Thing Explainer) are a known gap; ingesting them is operator-owned and out of v3.2 scope.

### Two workstreams

**Workstream A — Chronicle HTML upgrade (P120-P123).** Wire `render-html.cjs` + `style.css` + section templates + `validate-chronicle.cjs` to the gold-reference. The research doc's Output 6 is the engineering spec.

**Workstream B — Cockpit redesign (P124-P127).** A dedicated cockpit RESEARCH pass, then evolve `cockpit-sidecar.cjs` from a JSON/text CLI into a glanceable answer-first surface with a real alert grammar.

### Phase map (P120-P127)

| Phase | WS | Topic | Outcome |
|---:|---|---|---|
| P120 | shared | Shared design system | Extract the gold-reference visual language into one shared stylesheet + formalize the 12 design rules as a machine-checkable conformance checklist both surfaces honour. |
| P121 | A | Chronicle data-model upgrade | New context-pack + schema fields: `big_idea`, section `signal: high\|low`, `fog.dominant_signal`, `next.primary_action` + `next.alternatives[]`, SCQA slots. |
| P122 | A | Chronicle renderer rebuild | `render-html.cjs` + section templates → gold-reference: Operator Decision Panel, 11-section answer-first order, SCQA, evidence expanders, fog gauge, inline-SVG diagrams with takeaway figcaptions. |
| P123 | A | Chronicle validator lints + conformance | `CHRONICLE-JARGON` lint, takeaway-heading check, one-primary-action check, figcaption≠title check. Gold-reference structural conformance test. |
| P124 | B | Cockpit research + design lock | Dedicated VTP research pass (pull the chart-redesign figure images c05f017 / c07f034 etc.), audit the current cockpit, produce the cockpit design spec. |
| P125 | B | Cockpit alert grammar + North-Star ranking | Threshold→duration→alert→channel grammar; "one North Star" ranking logic so the cockpit surfaces the single most-important thing. |
| P126 | B | Cockpit answer-first surface | Evolve `cockpit-sidecar.cjs` to emit a glanceable answer-first cockpit (shared design system, preattentive single-alert, colour-sparingly). |
| P127 | B | Cockpit integration + cross-surface self-test | Wire to chronicle INDEX + validator log; conformance test that both surfaces obey the shared 12 rules. |

## Drift risks (binding watchlist, re-checked every phase close)

1. **Chronicle and cockpit visual systems diverge.** Prevented by: one shared stylesheet (invariant 1); P127 cross-surface conformance test.
2. **Cockpit becomes a second fog machine.** Prevented by: preattentive + one-North-Star discipline (invariant 4); P124 research lock.
3. **Renderer rebuild regresses the 96/96 chronicle self-test.** Prevented by: P123 conformance test gates the rebuild; existing assertions preserved.
4. **Lock-13 violation.** Prevented by: cockpit evolves the sidecar only (invariant 3); zero touches to `super-gsd/tools/cockpit/*`.
5. **Un-grounded design drift.** Prevented by: every design choice traces to a retrieved principle or is flagged (invariant 6); P120 conformance checklist.
6. **Scope creep into the 3 absent books.** Prevented by: forward-only — ingest is operator-owned, explicitly out of v3.2 scope.
7. **Chronicle stops being a projection.** Prevented by: DLB-11 R3 carried forward (invariant 5).

## What this decision explicitly does NOT do

- Does not rebuild the cockpit from scratch or touch the v2.9 Lock-13 frozen cockpit array.
- Does not ingest Resonate / Simply Said / Thing Explainer — operator-owned, out of scope.
- Does not change the chronicle's projection-not-opinion contract (DLB-11 R3 holds).
- Does not add an LLM to either render path — both surfaces stay deterministic.
- Does not introduce external CDN/JS dependencies — offline-survivable invariant from DLB-11 carries forward.

## Cross-references

- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — the 7-output book research; Output 6 is the WS-A engineering spec
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` — the gold-reference render target
- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — predecessor; chronicle layer this milestone upgrades
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — the cockpit surface WS-B evolves
- `.planning/milestones/v3.2/INTENT.md` + `ROADMAP.md` — milestone framing
- `sgsd_pro_mode_codex_infographic.html` — visual language source for the shared design system
