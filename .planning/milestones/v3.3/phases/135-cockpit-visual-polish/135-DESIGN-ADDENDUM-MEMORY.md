# Design Addendum — Context Memory as First-Class Concept

> **Critical addition to the design package.** Memory provenance is what makes SGSD different from vanilla GSD. The cockpit must make this visible. This addendum extends the brief — read AFTER `135-DESIGN-PACKAGE.md`.

## The differentiator

GSD runs agents. **SGSD runs agents with memory.** Every Codex dispatch reads from a curated set of artefacts: phase CONTEXT, milestone INTENT, prior phase SUMMARYs, research outputs, VTP enrichment evidence, decision precedents (DLB-01 through DLB-12), gate verdicts, operator constraints.

The operator should be able to look at the cockpit and answer: **"Why is Codex doing what it's doing right now?"** The answer is the memory state — the artefacts in its read-pack — not just the prompt.

## Data shape addition (cockpit-sidecar.cjs --json extension)

Add a new top-level `memory` key to the snapshot:

```json
{
  "memory": {
    "milestone_context_loaded": [
      { "id": "v3.3-intent", "name": "v3.3 INTENT.md", "path": ".planning/milestones/v3.3/INTENT.md", "type": "context", "authority": "canonical", "relevance": 1.0, "influencing": true, "loaded_at": "2026-05-24T18:30:00Z" }
    ],
    "phase_context_loaded": [
      { "id": "p135-context", "name": "135-CONTEXT.md", "path": ".planning/milestones/v3.3/phases/135-cockpit-visual-polish/135-CONTEXT.md", "type": "context", "authority": "canonical", "relevance": 1.0, "influencing": true, "loaded_at": "2026-05-24T18:30:00Z" },
      { "id": "p135-plan", "name": "135-01-PLAN-LOCKED.md", "path": ".planning/milestones/v3.3/phases/135-cockpit-visual-polish/135-01-...-PLAN-LOCKED.md", "type": "context", "authority": "validated", "relevance": 1.0, "influencing": true, "loaded_at": "2026-05-24T18:30:00Z" }
    ],
    "research_artefacts": [
      { "id": "ui-ux-design-system", "name": "ui-ux-pro-max design system query", "path": "(synthesised)", "type": "research", "authority": "claim", "relevance": 0.9, "influencing": true, "loaded_at": "2026-05-24T18:25:00Z" }
    ],
    "vtp_enrichment": {
      "status": "complete",
      "doc_ids_loaded": ["doc:89dcc7ffdb35", "doc:26a16f009f60", "doc:97507741a473"],
      "tier": "framing",
      "completed_at": "2026-05-24T15:35:00Z"
    },
    "applied_precedents": [
      { "id": "DLB-12", "name": "DLB-12 Operator Comprehension System", "path": ".planning/decisions/DLB-12-...", "type": "precedent", "authority": "canonical", "relevance": 0.85, "influencing": true },
      { "id": "DLB-07", "name": "DLB-07 Semantic Verification (SAC required)", "path": ".planning/decisions/DLB-07-...", "type": "precedent", "authority": "canonical", "relevance": 1.0, "influencing": true },
      { "id": "P132-VERIFICATION", "name": "P132 phase-close artefacts (localhost-live shipped)", "path": ".planning/milestones/v3.3/phases/132-...", "type": "evidence", "authority": "validated", "relevance": 0.7, "influencing": true }
    ],
    "review_findings_considered": [
      { "id": "operator-feedback-2026-05-24", "name": "Operator screenshot reaction", "path": "(conversation)", "type": "evidence", "authority": "claim", "relevance": 1.0, "influencing": true, "loaded_at": "2026-05-24T18:00:00Z" }
    ],
    "evidence_verdicts": [
      { "id": "p134-t2-regression", "name": "P134-T2 R16 fail-safe correction", "path": "(commit 5ba5bec)", "type": "evidence", "authority": "validated", "relevance": 0.5, "influencing": false }
    ],
    "operator_constraints": [
      { "id": "operator-decision-design-first", "name": "Design with Claude Design first", "path": "(conversation 2026-05-24)", "type": "decision", "authority": "canonical", "relevance": 1.0, "influencing": true, "loaded_at": "2026-05-24T18:10:00Z" }
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

### Artefact descriptor fields (every artefact has these)

| Field | Type | Values | Purpose |
|---|---|---|---|
| `id` | string | unique slug | identifier for linking + filtering |
| `name` | string | human-readable | what shows in the panel |
| `path` | string | file path or pseudo-path | where the artefact lives (clickable when local) |
| `type` | enum | `context` / `research` / `decision` / `evidence` / `precedent` / `gate` | classification — drives icon + colour |
| `authority` | enum | `canonical` / `validated` / `claim` / `stale` / `disputed` | trust tier — drives visual treatment |
| `relevance` | number | 0.0-1.0 | how relevant to current phase — drives sort order + size |
| `influencing` | boolean | true/false | actively in the current dispatch's read-pack — drives glow/highlight |
| `loaded_at` | ISO timestamp | optional | when it was loaded — drives staleness check |

### Authority tier → visual treatment

| authority | colour | icon | meaning |
|---|---|---|---|
| `canonical` | `var(--gold)` border + `var(--gold-soft)` text | 🏛 (or shield) | DLB decisions, locked INTENT, operator decrees |
| `validated` | `var(--green)` border + green-soft bg | ✓ | PASS-verdict phases, locked PLAN.md, schema-validated |
| `claim` | `var(--blue)` border | ◇ (diamond) | research outputs, agent reports, unverified |
| `stale` | `var(--ink-soft)` border + opacity 0.6 | ⌛ | loaded > 24h ago / superseded |
| `disputed` | `var(--red)` border + red-soft bg | ⚠ | flagged by review or contradicted by later evidence |

### Type → icon (Heroicons / Lucide preferred; emoji fallback)

| type | symbol | meaning |
|---|---|---|
| `context` | 📋 / document-text | INTENT.md, CONTEXT.md, PROJECT.md |
| `research` | 🔬 / beaker | RESEARCH.md, VTP enrichment, external research |
| `decision` | 🗂 / archive-box | DLB-NN decision-memo files |
| `evidence` | 📊 / chart-bar | VERIFICATION.md, PHASE-CAPSULE.json, test results |
| `precedent` | ⚖ / scale | prior milestone/phase outcomes treated as authority |
| `gate` | 🚦 / shield-check | ATC review, conformance, validate.cjs results |

## Visual integration — where Memory goes in the 3-band IA

The operator's instruction: *"This should visually connect to the active agent card."* So Memory needs to be present in BOTH Band 2 (where the active dispatch lives) AND Band 3 (the reflective layer where full artefact lists make sense).

### Band 2 addition — Dispatch Flow Lineage strip

After the stage pipeline strip, add a small **Dispatch Flow** card showing the artefact-to-agent-to-gate flow:

```
┌─ DISPATCH FLOW ────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│   │ 7 artefacts  │ ──▶│ Claude       │ ──▶│ Codex exec   │ ──▶ gate     │
│   │ (chip cluster│    │ orchestrator │    │ (next)       │      pending │
│   └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                          │
│   Active read-pack: v3.3-intent · p135-context · p135-plan ·            │
│                     DLB-07 · DLB-12 · operator-decision-design-first    │
└──────────────────────────────────────────────────────────────────────────┘
```

CSS: horizontal flex, three nodes with arrow connectors (CSS `::after` triangle, or inline SVG arrows). Each node is a small card with rounded corners. Active artefact chips below in a wrap-flow row.

### Band 3 addition — Memory Provenance table (full lineage)

Promote the existing rationale grid to a 2-row Band 3:
- Row 1: existing rationale cards (WHY / CONTEXT / ELI5 / WHAT IS / WHAT COULD BE)
- Row 2 (new): **Memory Provenance** as a structured table/grid

```
┌─ BAND 3 · RATIONALE & MEMORY ─────────────────────────────────────────┐
│  ┌─ rationale-cards (existing 5+evidence) ───────────────────────┐    │
│  │  (as designed)                                                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─ MEMORY PROVENANCE ──────────────────────────────────────────────┐  │
│  │  [tabs: All · Context · Research · Decisions · Evidence · Gates] │  │
│  │  ┌─ artefact-card ─┐ ┌─ artefact-card ─┐ ┌─ artefact-card ─┐    │  │
│  │  │ v3.3 INTENT.md  │ │ DLB-07 ...      │ │ ui-ux design    │    │  │
│  │  │ ▣ context       │ │ ⚖ precedent     │ │ 🔬 research     │    │  │
│  │  │ canonical · 100%│ │ canonical · 100%│ │ claim · 90%     │    │  │
│  │  │ ● influencing   │ │ ● influencing   │ │ ● influencing   │    │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘    │  │
│  │  (more cards...)                                                  │  │
│  │                                                                    │  │
│  │  Stats: 9 loaded · 7 influencing · 0 stale · 18.4k tokens          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

Each artefact card:
```html
<article class="memory-card" data-id="..." data-type="context" data-authority="canonical" data-influencing="true">
  <header>
    <span class="memory-icon" aria-hidden="true">📋</span>
    <span class="memory-name">v3.3 INTENT.md</span>
    <span class="memory-influence-dot" title="actively in current read-pack" aria-label="influencing">●</span>
  </header>
  <div class="memory-meta">
    <span class="chip authority-canonical">canonical</span>
    <span class="chip type-context">context</span>
    <span class="memory-relevance" data-value="1.0">relevance 100%</span>
  </div>
  <div class="memory-path"><code>.planning/milestones/v3.3/INTENT.md</code></div>
</article>
```

CSS:
- `.memory-card`: padding `var(--space-3)`, border `1px solid var(--line)`, background `var(--panel2)`, rounded `var(--radius)`. Variants by `data-authority`:
  - `[data-authority="canonical"]`: border-left 3px `var(--gold)`
  - `[data-authority="validated"]`: border-left 3px `var(--green)`
  - `[data-authority="claim"]`: border-left 3px `var(--blue)`
  - `[data-authority="stale"]`: opacity 0.5, no border accent
  - `[data-authority="disputed"]`: border-left 3px `var(--red)`, background `var(--red-soft)`
- `[data-influencing="true"]`: subtle pulse animation (or static glow `box-shadow: 0 0 12px rgba(103,232,249,0.25)`) — connects visually to active dispatch
- `.memory-influence-dot`: 8px cyan dot when influencing; otherwise hidden

Filter tabs at the top:
```html
<div class="memory-tabs" role="tablist">
  <button role="tab" aria-selected="true" data-filter="all">All <span class="chip">9</span></button>
  <button role="tab" data-filter="context">Context <span class="chip">2</span></button>
  <button role="tab" data-filter="research">Research <span class="chip">2</span></button>
  <button role="tab" data-filter="decision">Decisions <span class="chip">2</span></button>
  <button role="tab" data-filter="evidence">Evidence <span class="chip">2</span></button>
  <button role="tab" data-filter="precedent">Precedents <span class="chip">1</span></button>
  <button role="tab" data-filter="gate">Gates <span class="chip">0</span></button>
</div>
```

Stats footer:
```html
<footer class="memory-stats">
  <span><strong>9</strong> loaded</span>
  <span><strong>7</strong> influencing</span>
  <span><strong>0</strong> stale</span>
  <span><strong>18.4k</strong> tokens in read-pack</span>
</footer>
```

## The lineage thread — connecting Band 2 to Band 3

The operator's instruction: *"This should visually connect to the active agent card."*

Implementation idea: when an artefact in the Band 2 Dispatch Flow's chip cluster is hovered or clicked, the matching card in the Band 3 Memory Provenance grid glows/highlights. And vice versa — clicking a memory card filters the Band 2 dispatch-flow strip to show "this artefact is in the active read-pack at position N."

Stretch goal: a thin visual line (SVG overlay) connecting Band 2's flow nodes to the artefact cards in Band 3 when filtered. But this is hover-only; default view has them visually-distinct but not connected.

For v3.3 P135 implementation, the simpler approach:
- Each artefact has a stable `data-id` attribute
- Clicking a memory card scrolls Band 2 into view + highlights the active-read-pack chip with matching `data-id`
- No SVG connector lines (deferred)

## Why this matters — the elevator pitch for the panel

The Memory Provenance panel answers the question every operator asks halfway through an autonomous run:

> "Why is it doing this? Did it remember the last operator decision? Is it using stale context? Did the VTP enrichment fire? Are the precedents I expect actually loaded?"

Without Memory Provenance, the operator either trusts blindly or stops the loop to inspect. With Memory Provenance:
- A glance at the influencing-dots confirms the read-pack is what it should be.
- The authority tier exposes whether the agent is reasoning from canonical decisions or from claims.
- The stats footer shows token spend per dispatch (operator-controllable, prevents context bloat).
- The stale/disputed filter surfaces drift before it causes harm.

This is **the** SGSD differentiator. Vanilla GSD gives you "the agent did this." SGSD gives you "the agent did this BECAUSE OF these artefacts, with these authority levels, at this token cost."

## Server-side implementation notes (for after Claude Design ships visuals)

The new `snapshot.memory` key needs server-side population. The implementation path:

1. **New module** `super-gsd/tools/cockpit-sidecar/memory-provenance.cjs` exports `computeMemory(opts)` returning the `memory` object documented above.

2. Sources:
   - `milestone_context_loaded`: read `.planning/milestones/{active}/INTENT.md` frontmatter + roadmap
   - `phase_context_loaded`: read active phase directory's CONTEXT.md, RESEARCH.md, *-PLAN-LOCKED.md
   - `research_artefacts`: read VTP enrichment artefact if present; any `.planning/research/` files referenced from the active phase
   - `vtp_enrichment`: read `.planning/metrics/vtp-routing-log.jsonl` tail (last successful row for the active phase)
   - `applied_precedents`: parse the active CONTEXT.md / PLAN-LOCKED.md for DLB-NN references; resolve them to decision-memo files in `.planning/decisions/`
   - `review_findings_considered`: read most recent REVIEW.md / `.planning/metrics/findings.jsonl`
   - `evidence_verdicts`: read prior phase VERIFICATION.md files in the active milestone
   - `operator_constraints`: read `.planning/decisions/` files marked as operator-precedent (DLB-02 invariant)
   - `dispatch_flow`: derive from the most recent codex-executor-log.jsonl entry + the next pending dispatch
   - `stats`: aggregate from the lists above

3. Wire into `cockpit-sidecar.cjs` via new `attachMemory(output, opts)` helper called in `run()` after `attachRationale`.

4. SACs: ≥4 new SAC tests covering shape correctness, type enum validity, authority enum validity, dispatch_flow non-empty when an active phase exists.

**For P135 scope:** Claude Design's visual prototype can use the sample JSON above directly (mock data); the server-side `memory-provenance.cjs` becomes P136. That way visual ships fast; data wiring is its own phase.

## What to update in the Claude Design prompt

Add to the prompt I shared earlier:

> Bonus requirement: the cockpit must include a **Context Memory** panel as a first-class section showing artefact lineage. Read `135-DESIGN-ADDENDUM-MEMORY.md` for the data shape, visual treatment per authority tier (canonical / validated / claim / stale / disputed), and the Dispatch Flow lineage strip (artefacts → agent → next agent → gate). Memory Provenance lives in Band 3 below the rationale cards; a thin Dispatch Flow card goes in Band 2 below the stage pipeline. Use the sample JSON in the addendum to design against.

## Outstanding questions for the designer

1. **Filter tabs vs sidebar** for Memory Provenance: tabs are compact but a left-rail sidebar with the artefact list might scan better. Both work — designer's call.

2. **Influence-dot animation:** static cyan glow, slow pulse (2s ease), or no animation (just colour)? Pulse risks distracting from the loud line in Band 1. Recommend static.

3. **Token count display:** prominent (stats footer + per-artefact bar) or buried (stats footer only)? Operator cares about token spend; recommend prominent.

4. **Drill-down on a memory card:** modal showing artefact content excerpt, OR a hover-tooltip with the first paragraph, OR click-to-open the file in the operator's editor (file:// link)? File-link is cleanest but requires the operator to have a path-handler registered.

5. **Authority tier disputes — visual escalation:** when an artefact is `disputed`, should the whole row turn red, or just the authority chip? The brief's "presumed-guilty noise rule" suggests prominent escalation; but red-flooded rows for one disputed artefact could feel alarming. Recommend authority chip + left-border, not full row.
