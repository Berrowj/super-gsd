# Design Addendum V2 — Context Memory + Why-This-Matters + Diagrams + Mesh Memory Lite

> **Required reading after the main DESIGN-PACKAGE.** This addendum bundles FOUR major additions to the cockpit visual:
>
> 1. **Context Memory** as a first-class concept (Memory Provenance panel)
> 2. **"Why This Matters" 4-level strip** on the active phase card
> 3. **Three diagrams**: Current Phase Architecture, Milestone Dependency Map, Context Memory Graph
> 4. **Mesh Memory Lite (DLB-08) visual distinctions**: observation / claim / validated / refuted / decision
>
> These are non-negotiable cockpit features. They are the operator's "this is what makes SGSD different from vanilla GSD" requirements.

## The big picture — why all four matter together

Vanilla GSD shows "the agent ran tasks." SGSD must show:
- **Why** the agent ran them (Why This Matters)
- **What knowledge** it used (Context Memory + Mesh Memory Lite)
- **How it all connects** (the three Diagrams)

Without these, the cockpit is just a fancy task list. With them, it's a live decision-supporting surface — the operator can see *why* something is happening, *what authority* drove it, and *what it unlocks*. That's the SGSD identity.

---

## Section 1 — Context Memory (Memory Provenance Panel)

### Data shape addition (`snapshot.memory` — new top-level key)

```json
{
  "memory": {
    "milestone_context_loaded": [
      { "id": "v3.3-intent", "name": "v3.3 INTENT.md", "path": ".planning/milestones/v3.3/INTENT.md", "type": "context", "authority": "canonical", "relevance": 1.0, "influencing": true, "loaded_at": "2026-05-24T18:30:00Z" }
    ],
    "phase_context_loaded": [
      { "id": "p135-context", "name": "135-CONTEXT.md", "path": ".planning/milestones/v3.3/phases/135-cockpit-visual-polish/135-CONTEXT.md", "type": "context", "authority": "canonical", "relevance": 1.0, "influencing": true },
      { "id": "p135-plan", "name": "135-01-PLAN-LOCKED.md", "path": "...", "type": "context", "authority": "validated", "relevance": 1.0, "influencing": true }
    ],
    "research_artefacts": [
      { "id": "ui-ux-design-system", "name": "ui-ux-pro-max design system query result", "path": "(synthesised)", "type": "research", "authority": "claim", "relevance": 0.9, "influencing": true }
    ],
    "vtp_enrichment": {
      "status": "complete",
      "doc_ids_loaded": ["doc:89dcc7ffdb35", "doc:26a16f009f60", "doc:97507741a473"],
      "tier": "framing",
      "reflection_verdict": "sufficient",
      "completed_at": "2026-05-24T15:35:00Z"
    },
    "applied_precedents": [
      { "id": "DLB-12", "name": "DLB-12 Operator Comprehension System", "path": ".planning/decisions/DLB-12-...", "type": "precedent", "authority": "canonical", "relevance": 0.85, "influencing": true },
      { "id": "DLB-07", "name": "DLB-07 Semantic Verification (SAC required)", "path": ".planning/decisions/DLB-07-...", "type": "precedent", "authority": "canonical", "relevance": 1.0, "influencing": true }
    ],
    "review_findings_considered": [
      { "id": "operator-feedback-2026-05-24", "name": "Operator screenshot reaction", "path": "(conversation)", "type": "claim", "authority": "claim", "relevance": 1.0, "influencing": true, "cmb_type": "review_finding" }
    ],
    "evidence_verdicts": [
      { "id": "p134-t2-regression", "name": "P134-T2 R16 fail-safe correction", "path": "(commit 5ba5bec)", "type": "evidence", "authority": "validated", "relevance": 0.5, "influencing": false, "cmb_type": "evidence_verdict" }
    ],
    "operator_constraints": [
      { "id": "operator-decision-design-first", "name": "Design with Claude Design first", "path": "(conversation 2026-05-24)", "type": "decision", "authority": "canonical", "relevance": 1.0, "influencing": true, "cmb_type": "operator_precedent" }
    ],
    "dispatch_flow": {
      "upstream_artefacts": ["v3.3-intent", "p135-context", "p135-plan", "DLB-07", "DLB-12", "operator-decision-design-first"],
      "active_agent": { "name": "Claude orchestrator", "model": "opus-4-7", "role": "design-package-author" },
      "downstream_target": { "name": "Claude Design", "role": "visual-prototype" },
      "expected_gate": "operator-approval"
    },
    "stats": {
      "total_artefacts_loaded": 9,
      "actively_influencing": 7,
      "stale_or_disputed": 0,
      "tokens_in_read_pack": 18420
    }
  }
}
```

### Each artefact descriptor fields

| Field | Type | Values | Purpose |
|---|---|---|---|
| `id` | string | unique slug | linking identifier |
| `name` | string | human-readable | panel display |
| `path` | string | file path or pseudo-path | clickable when local |
| `type` | enum | `context` / `research` / `decision` / `evidence` / `precedent` / `gate` / `claim` | classification — drives icon |
| `authority` | enum | `canonical` / `validated` / `claim` / `stale` / `disputed` | trust tier — drives visual treatment |
| `relevance` | number 0-1 | 0.0-1.0 | how relevant — drives sort + size |
| `influencing` | boolean | true/false | in current dispatch's read-pack — drives glow |
| `loaded_at` | ISO timestamp | optional | staleness check |
| `cmb_type` | enum (optional) | see Section 4 below | Mesh Memory Lite CMB type if applicable |

### Authority tier → visual treatment

| authority | colour | icon | meaning |
|---|---|---|---|
| `canonical` | `var(--gold)` border + `var(--gold-soft)` text | 🏛 / shield | DLB decisions, locked INTENT, operator decrees |
| `validated` | `var(--green)` border + green-soft bg | ✓ | PASS-verdict phases, schema-validated plans |
| `claim` | `var(--blue)` border | ◇ | research outputs, unverified agent reports |
| `stale` | `var(--ink-soft)` border + opacity 0.6 | ⌛ | loaded > 24h ago / superseded |
| `disputed` | `var(--red)` border + red-soft bg | ⚠ | flagged by review or contradicted by evidence |

### Visual integration — where it lives

**Band 3 lower half** = Memory Provenance section.

```
┌─ BAND 3 · RATIONALE & MEMORY ─────────────────────────────────────────┐
│  ┌─ rationale-cards (existing 5 + evidence) ───────────────────┐      │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                          │
│  ┌─ MEMORY PROVENANCE ──────────────────────────────────────────────┐  │
│  │  [tabs: All · Context · Research · Decisions · Evidence · Gates]│  │
│  │  ┌─ memory-card ──┐ ┌─ memory-card ──┐ ┌─ memory-card ──┐       │  │
│  │  │ v3.3 INTENT.md │ │ DLB-07         │ │ ui-ux research │       │  │
│  │  │ 📋 context     │ │ ⚖ precedent    │ │ 🔬 research    │       │  │
│  │  │ canonical 100% │ │ canonical 100% │ │ claim 90%      │       │  │
│  │  │ ● influencing  │ │ ● influencing  │ │ ● influencing  │       │  │
│  │  └────────────────┘ └────────────────┘ └────────────────┘       │  │
│  │  Stats: 9 loaded · 7 influencing · 0 stale · 18.4k tokens         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

CSS for the cards: see Section 1 of the earlier addendum (same as before).

---

## Section 2 — "Why This Matters" 4-Level Strip (Band 1 extension)

### Data shape addition (`snapshot.why_this_matters` — new top-level key)

```json
{
  "why_this_matters": {
    "immediate_objective": "Rewrite client.js cockpit rendering to reduce drift in band rendering.",
    "local_unlock": "Allows P135 visual polish to close.",
    "milestone_unlock": "Allows v3.3 cockpit milestone to resume P134-T3/T4 and reach close gate.",
    "user_outcome": "Operator can understand SGSD state visually without reading raw logs."
  }
}
```

### Visual integration — where it lives

Operator: *"This must be visible in the cockpit, not buried in event logs."*

Add the strip to **Band 1**, immediately below the alert. It's part of the governing thought — it answers "what + why" together. Or alternatively as a thin always-visible card between Band 1 and Band 2.

Recommended: dedicated row in Band 1 with 4 stacked levels:

```html
<aside class="why-this-matters" aria-label="Why this dispatch matters">
  <header><span class="band-eyebrow">Why This Matters</span></header>

  <ol class="why-levels" role="list">
    <li class="why-level" data-level="immediate">
      <span class="why-label">Immediate</span>
      <p class="why-text">Rewrite client.js cockpit rendering to reduce drift in band rendering.</p>
    </li>
    <li class="why-level" data-level="local">
      <span class="why-label">Local unlock</span>
      <p class="why-text">Allows P135 visual polish to close.</p>
    </li>
    <li class="why-level" data-level="milestone">
      <span class="why-label">Milestone unlock</span>
      <p class="why-text">Allows v3.3 cockpit milestone to resume P134-T3/T4 and reach close gate.</p>
    </li>
    <li class="why-level" data-level="user">
      <span class="why-label">User outcome</span>
      <p class="why-text">Operator can understand SGSD state visually without reading raw logs.</p>
    </li>
  </ol>
</aside>
```

CSS:
- `.why-this-matters`: card with `var(--paper-tint)` bg, `var(--radius)` corners, `var(--space-4)` padding.
- `.why-levels`: list-style: none, stacked vertically with `var(--space-2)` gap.
- `.why-level`: each row is a `display: grid; grid-template-columns: 7rem 1fr; gap: var(--space-3);` — label column + text column.
- `.why-label`: `font: 800 0.72rem/1 var(--sans); letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold-soft);` — eyebrow style.
- `.why-text`: regular body, line-height 1.4.
- Level escalation: `data-level="immediate"` keeps default; `data-level="user"` could have a subtle left border `var(--cyan)` to mark "the human cares about this" — escalating-importance visual.

### Where the data comes from (server-side notes)

`why_this_matters` is derived from a combination of:
- Active phase CONTEXT.md frontmatter or `## Goal` section → `immediate_objective`
- Active phase CONTEXT.md `unlocks` frontmatter → `local_unlock`
- Active milestone INTENT.md `outcome_delivered` → `milestone_unlock`
- Active milestone INTENT.md `why` → `user_outcome`

For P135 visual scope, Claude Design uses the example text above (sample). Server-side wiring is P136+.

---

## Section 3 — Three Diagrams

Operator: three new diagrams to make the cockpit graph-aware. Each shows a different lens on the system.

### 3.1 Current Phase Architecture diagram

Nodes = artefacts / components / services / agents involved in the current phase.
Edges = data/control flow between them.
Highlight active node, mark stale/blocked/risky in red/amber, click-to-reveal related files.

```
            ┌──────────────────┐
            │ 135-CONTEXT.md   │ ◀── canonical
            └────────┬─────────┘
                     │ reads
                     ▼
            ┌──────────────────┐                ┌─────────────────┐
            │ Claude orches    │ ───dispatches▶ │ Codex executor  │
            │ (active) ★       │                │ (next)          │
            └────────┬─────────┘                └────────┬────────┘
                     │ writes                            │ writes
                     ▼                                   ▼
            ┌──────────────────┐                ┌─────────────────┐
            │ 135-DESIGN-PKG   │                │ client.js (mod) │
            └──────────────────┘                └─────────────────┘
```

Data shape:
```json
{
  "phase_architecture": {
    "nodes": [
      { "id": "ctx", "label": "135-CONTEXT.md", "kind": "artefact", "authority": "canonical", "status": "loaded" },
      { "id": "claude", "label": "Claude orchestrator", "kind": "agent", "status": "active" },
      { "id": "codex", "label": "Codex executor", "kind": "agent", "status": "pending" },
      { "id": "client", "label": "client.js", "kind": "artefact", "status": "target" }
    ],
    "edges": [
      { "from": "ctx", "to": "claude", "label": "reads" },
      { "from": "claude", "to": "codex", "label": "dispatches" },
      { "from": "codex", "to": "client", "label": "writes" }
    ],
    "active_node": "claude"
  }
}
```

Visual: inline SVG, nodes are rounded-rectangle `<rect>` elements with text inside; edges are bezier `<path>` arrows. Active node has cyan glow filter. Click handler on each node reveals a side panel with related files.

### 3.2 Milestone Dependency Map

Nodes = phases / plans / gates in the active milestone.
Edges = dependencies.
State: completed (green) / current (gold) / blocked (red) / future (dim).
Show cross-milestone memory links where relevant.

```
              P128 ✓ ────┐
                         │
              P129 ✓ ────┼──▶ P130 ✓ ──▶ P131 ✓ ──▶ P132 ✓ ──▶ P133 ✓
                                                         │            │
                                                         ▼            ▼
                                                       P134 ⏳     [P135] ★ ◀── (this)
                                                         │            │
                                                         └──┬─────────┘
                                                            ▼
                                                       (v3.3 close)
```

Data shape:
```json
{
  "milestone_dependency_map": {
    "milestone": "v3.3",
    "nodes": [
      { "id": "P128", "label": "P128 stage-pipeline", "status": "complete", "type": "phase" },
      { "id": "P129", "label": "P129 bands 1+2", "status": "complete", "type": "phase" },
      { "id": "P130", "label": "P130 band 3 rationale", "status": "complete", "type": "phase" },
      { "id": "P131", "label": "P131 ELI5", "status": "complete", "type": "phase" },
      { "id": "P132", "label": "P132 localhost-live", "status": "complete", "type": "phase" },
      { "id": "P133", "label": "P133 PS migration", "status": "complete", "type": "phase" },
      { "id": "P134", "label": "P134 conformance", "status": "paused", "type": "phase" },
      { "id": "P135", "label": "P135 visual polish", "status": "current", "type": "phase" },
      { "id": "v3.3-close", "label": "v3.3 milestone close", "status": "future", "type": "gate" }
    ],
    "edges": [
      { "from": "P128", "to": "P129" }, { "from": "P129", "to": "P130" }, { "from": "P130", "to": "P131" },
      { "from": "P131", "to": "P132" }, { "from": "P132", "to": "P133" }, { "from": "P133", "to": "P134" },
      { "from": "P134", "to": "P135" }, { "from": "P135", "to": "v3.3-close" }, { "from": "P134", "to": "v3.3-close" }
    ],
    "cross_milestone_links": [
      { "from": "DLB-12", "to": "P135", "label": "comprehension lineage", "milestone": "v3.2" }
    ]
  }
}
```

Visual: horizontal flow diagram, SVG. Nodes are pills with status-colour fill. Current node (P135) gets a star + cyan glow. Edges are arrows. Cross-milestone links rendered as dashed lines that drift in from the top edge.

### 3.3 Context Memory Graph

Nodes = memory artefacts (CONTEXT.md, RESEARCH.md, PLAN.md, decisions, evidence verdicts, operator precedents, CMBs).
Edges = lineage / influence.
Authority label per node: canonical / validated / claim / stale / disputed.
Highlight actively-used by current dispatch.

```
   [DLB-07]         [DLB-12]        [v3.3-intent]
   canonical        canonical        canonical
     │                │                │
     │                │                │
     └────────────────┼────────────────┘
                      │
                      ▼
              [135-CONTEXT.md]
              canonical · active ★
                      │
                      │ reads
                      ▼
            [Claude orchestrator]
                      │
                      │ produces
                      ▼
        [135-DESIGN-PACKAGE.md]
              validated (just-written)
```

Data shape:
```json
{
  "context_memory_graph": {
    "nodes": [
      { "id": "DLB-07", "label": "DLB-07", "authority": "canonical", "cmb_type": "decision_recommendation", "influencing": true },
      { "id": "DLB-12", "label": "DLB-12", "authority": "canonical", "cmb_type": "decision_recommendation", "influencing": true },
      { "id": "v3.3-intent", "label": "v3.3 INTENT", "authority": "canonical", "cmb_type": "context_anchor", "influencing": true },
      { "id": "p135-ctx", "label": "135-CONTEXT", "authority": "canonical", "cmb_type": "context_anchor", "influencing": true, "active": true },
      { "id": "claude", "label": "Claude orchestrator", "authority": "agent", "cmb_type": null, "influencing": true },
      { "id": "p135-package", "label": "DESIGN-PACKAGE", "authority": "validated", "cmb_type": "execution_receipt", "influencing": false }
    ],
    "edges": [
      { "from": "DLB-07", "to": "p135-ctx", "label": "anchors" },
      { "from": "DLB-12", "to": "p135-ctx", "label": "anchors" },
      { "from": "v3.3-intent", "to": "p135-ctx", "label": "anchors" },
      { "from": "p135-ctx", "to": "claude", "label": "reads" },
      { "from": "claude", "to": "p135-package", "label": "produces" }
    ]
  }
}
```

Visual: vertical-flowing graph (top-down). Each node sized by `relevance` (bigger = more relevant). Authority shown via node colour (per the table in Section 1). Edges labeled with relationship verb. Active node (the artefact being read RIGHT NOW) has cyan glow.

### Where the three diagrams live

Option A — separate tab/section in Band 3:
```
┌─ BAND 3 ────────────────────────────────────────────────────────────┐
│  [tabs: Rationale · Memory · Architecture · Dependencies · Memory-Graph]
│  (active tab content)                                                │
└──────────────────────────────────────────────────────────────────────┘
```

Option B — three small thumbnail diagrams as a row, with click-to-zoom modal for full view. Compact. Each thumbnail is ~200x150px.

**Recommended: Option B** for the live cockpit (thumbnails fit the bento aesthetic), with click-to-zoom into a fullscreen modal for inspection. Three thumbnails sit as a row above the Memory Provenance card.

### Implementation note for diagrams

Pure SVG with vanilla JS for layout. For ≤30 nodes the layout can be hand-computed (server-side renders the positions). For more dynamic layouts, consider a small graph library (e.g. embedded D3 force-directed, ~50KB) — but the no-deps constraint pushes toward hand-layout. **For P135 v1: hand-layout server-side**; consider library in P137+ if graphs get larger.

---

## Section 4 — Mesh Memory Lite (DLB-08) Visual Distinctions

This is a refinement of the Memory Provenance panel from Section 1 — it adds **CMB-type-specific visual treatments** so the operator can tell at a glance whether a memory artefact is an observation (factual) or a claim (unverified) or a decision (terminal).

### CMB types (v3.0 DLB-08 substrate)

| CMB type | Authority semantics | Visual treatment |
|---|---|---|
| `execution_receipt` | observation (SGSD-emitted fact) | **Solid filled node** — green-soft background, no border accent |
| `review_finding` | claim (agent/reviewer statement, needs validation) | **Outlined node** — no fill, blue border-2px |
| `evidence_verdict` | claim-with-authority (validated claim) | **Solid with check** — green-soft fill + green border + ✓ icon |
| `decision_recommendation` | decision (pseudo-operator or board) | **Badge/terminal node** — diamond shape, gold border, gold-soft fill |
| `operator_precedent` | operator decision (highest authority) | **Shield-shape badge** — gold solid fill, white text |
| `context_anchor` | projection (read-only context) | **Document-shape node** — paper-tint background, gold-soft border-left |
| `promotion_decision` | terminal (a CMB graduates from claim to canonical) | **Crown-shape node** — gold solid, "PROMOTED" label below |

Refuted claims: cross-out style + amber/red background tint + ❌ icon.

### Mesh lineage view — the chain

Operator's example lineage:

```
execution_receipt → review_finding → evidence_verdict → decision_recommendation → promotion_decision
```

This is the **maturity gradient** a memory artefact travels along. Each step is a node in the Context Memory Graph. The visual makes the chain explicit:

```
┌────────────────┐    ┌───────────────────┐    ┌───────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
│ ▣ execution    │ ─▶ │ ◇ review_finding  │ ─▶ │ ✓ evidence_verdict│ ─▶ │ ⬗ decision_recommend│ ─▶ │ ♔ promotion_decision │
│   receipt      │    │  (claim)          │    │  (validated claim)│    │  (decision)         │    │   (canonical)        │
│  (observation) │    │                   │    │                   │    │                     │    │                      │
└────────────────┘    └───────────────────┘    └───────────────────┘    └─────────────────────┘    └──────────────────────┘
   solid filled         outlined only           solid + ✓ check          diamond + gold border       crown + gold solid
```

Each artefact in the Memory Provenance grid is rendered with the CMB-type-matched visual. If `cmb_type` is null on the artefact (legacy/non-CMB sources), fall back to authority-tier visual from Section 1.

### Refuted claim variant

When a claim has been refuted by a later evidence_verdict, mark it:

```html
<article class="memory-card cmb-review-finding cmb-refuted" data-cmb-type="review_finding">
  <header>
    <span class="memory-icon" aria-hidden="true">◇</span>
    <span class="memory-name" style="text-decoration: line-through">P127 alert grammar drift</span>
    <span class="memory-refuted-badge chip palette-tier-danger">REFUTED</span>
  </header>
  <p class="memory-refuted-by">Refuted by: <a href="#evidence-vXX">evidence_verdict P128-T1 PASS</a></p>
</article>
```

CSS:
- `.cmb-refuted`: `background: var(--red-soft); border-color: var(--red);`
- `.memory-name` strikethrough text-decoration
- The refuted badge is a danger chip on the right

### Validated claim variant

When a review_finding has been promoted to an evidence_verdict, mark it:

```html
<article class="memory-card cmb-evidence-verdict" data-cmb-type="evidence_verdict">
  <header>
    <span class="memory-icon" aria-hidden="true">✓</span>
    <span class="memory-name">P132-T2 snapshot wrapper fix</span>
    <span class="memory-validated-badge chip palette-tier-success">VALIDATED</span>
  </header>
  <p class="memory-validated-by">Validated by: <a href="#test-SAC-P132-04">SAC-P132-04 PASS</a></p>
</article>
```

### Operator precedent visual (highest authority)

When an operator constraint is in the memory list, give it the prominence it deserves:

```html
<article class="memory-card cmb-operator-precedent" data-cmb-type="operator_precedent">
  <header>
    <span class="memory-icon" aria-hidden="true">♔</span>
    <span class="memory-name">Design with Claude Design first</span>
    <span class="memory-authority-badge chip palette-tier-operator">OPERATOR</span>
  </header>
  <p class="memory-source">decided 2026-05-24 18:10 · in active dispatch</p>
</article>
```

CSS:
- `.cmb-operator-precedent`: `background: linear-gradient(135deg, rgba(185,138,47,0.20), var(--panel)); border: 2px solid var(--gold); box-shadow: 0 0 16px rgba(185,138,47,0.30);` — visually loudest after the North Star.
- `.palette-tier-operator`: gold chip — `background: var(--gold); color: #1c1303;`.

---

## Section 5 — Consolidated layout (where everything goes)

```
╔═════════════════════════════════════════════════════════════════╗
║  BAND 1 · Governing Thought                                       ║
║  ─ NORTH STAR (loud)                                              ║
║  ─ DO NEXT                                                        ║
║  ─ ⚠ ALERT (palette-tier)                                         ║
║  ─ WHY THIS MATTERS (new — 4 stacked levels)                     ║   ← NEW (Section 2)
╠═════════════════════════════════════════════════════════════════╣
║  BAND 2 · Behavioral Supporting                                   ║
║  ─ Stage pipeline strip (5 cells)                                 ║
║  ─ DISPATCH FLOW lineage (artefact chips → agent → next → gate)  ║   ← NEW (Section 1 + 4)
║  ─ Context rows (WHY RUNNING · UNLOCKS · BLOCKED-BY)              ║
║  ─ Trend strip (3 bullet charts)                                  ║
╠═════════════════════════════════════════════════════════════════╣
║  BAND 3 · Reflective Rationale & Memory                           ║
║  ─ Rationale cards (5 + evidence)                                 ║
║  ─ DIAGRAM THUMBNAILS (3, click to expand)                       ║   ← NEW (Section 3)
║    · Current Phase Architecture                                   ║
║    · Milestone Dependency Map                                     ║
║    · Context Memory Graph                                         ║
║  ─ MEMORY PROVENANCE PANEL                                        ║   ← NEW (Section 1)
║    · tabs: All · Context · Research · Decisions · Evidence · Gates║
║    · artefact-card grid (CMB-typed visual treatments)             ║   ← NEW (Section 4)
║    · stats footer: N loaded · M influencing · K stale · tokens    ║
╚═════════════════════════════════════════════════════════════════╝
```

## Section 6 — Updated open questions for the designer

1. **Why-This-Matters placement**: in Band 1 below the alert, or as a standalone strip between Band 1 and Band 2? Recommend: in Band 1 below the alert (it's part of governing-thought reasoning).

2. **Diagram thumbnails** vs **full diagrams**: thumbnails preserve the bento aesthetic; full diagrams in their own tab consume more space. Recommend: thumbnails with click-to-expand modal.

3. **Diagrams: pure SVG hand-layout** vs **small embedded library (d3-force)**: ≤30 nodes typical, hand-layout is fine. ≥50 nodes, library becomes useful. Recommend: hand-layout for v3.3; library for P137+ if needed.

4. **Mesh Memory Lite icons**: Heroicons / Lucide for ✓ / ◇ / ⬗ / ♔ symbols vs Unicode glyphs. Unicode is simplest (no asset pipeline). Heroicons is cleaner visually. Recommend: Unicode for v3.3 (ship fast); Heroicons inline-SVG in P137+ if needed.

5. **Memory Provenance: tabs vs sidebar** for filtering by type: tabs are compact; sidebar gives more space for cards. Recommend: tabs at top.

6. **Operator-precedent card visual**: should it be in its own "OPERATOR DECISIONS" pinned region at the top of the Memory Provenance grid (always visible), or interleaved with other artefacts (filtered by tab)? Recommend: pinned region at the top — operator decisions deserve a dedicated visual slot.

7. **Refuted claims behaviour**: strike-through + red bg is visually loud. Should refuted artefacts auto-collapse to a count ("3 refuted claims" with click-to-expand), or always shown? Recommend: collapsed by default (Krug declutter) with click-to-expand.

---

## Section 7 — Updated Claude Design prompt

> Read the four-section addendum (`135-DESIGN-ADDENDUM-V2.md`) AFTER the main design package. Implementation order:
> 1. Memory Provenance panel (Band 3) with CMB-typed visual treatments — most important
> 2. Why-This-Matters 4-level strip (Band 1) — fast win
> 3. Dispatch Flow lineage card (Band 2) — connects Band 2 to Band 3
> 4. Three diagram thumbnails (Band 3) with click-to-expand modals — bigger build
>
> Use the sample JSON in the addendum to design against. The visual goal is: the operator can see the dispatch's read-pack, understand what's a fact vs claim vs decision, see the lineage from observation to canonical, and click any diagram to inspect deeper. Match the gold-reference HTML quality bar.
