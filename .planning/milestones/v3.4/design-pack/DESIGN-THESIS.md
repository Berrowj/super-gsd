# SGSD Cockpit · Design Thesis

> Implementation: `Cockpit.html` + `mc-state.jsx` · `mc-components.jsx` · `mc-arch.jsx` · `mc-app.jsx`
> Reference brief: operator-comprehension cockpit for autonomous software execution (v3.3 / P135)

---

## 1 · Design thesis

**The cockpit is not a dashboard. It is a model of the live execution system, rendered.**

A dashboard shows you numbers. A cockpit lets you act. The five-second test is the contract:
a calm operator opens the page, and in five seconds they know **what is happening, why, what just
changed, what risk is rising, what to do next, and what evidence backs the recommendation.** If any
of those answers requires scrolling, hunting, or interpreting prose, the design has failed.

We hold three lines simultaneously:

- **Calm by default** — normal execution should look quiet. Color is reserved for state, never decoration.
- **Loud on anomaly** — when something exceeds a threshold, the screen knows. The signal carries cause,
  consequence, and corrective action — never just a colored chip.
- **Domain-honest** — the page uses SGSD's own words: *milestone, phase, band, dispatch, fog, token,
  SLA, blocker, unlock, rationale, gate*. No "status" or "overview" labels that could belong to any
  CRUD app.

---

## 2 · Information architecture

The cockpit reads top to bottom as a comprehension funnel, not a card grid. Reading order is the IA.

```
chrome              localhost + milestone + phase · SSE pulse · hotkeys
command strip       objective · next action · owner · risk · time-left · controls
5-second scan       NOW · WHY · JUST CHANGED · RISK · DO NEXT · EVIDENCE        ← sticky

§1 Current mission        Mission Card  ⊕  Phase Runway  ⊕  Agents lane         ← anchor
§2 Architecture map       Phase dataflow  /  SGSD orchestration                 ← peer
§3 Milestone dependency   Milestone strip + clickable phase chips + drawer      ← peer
§4 Context memory         Typed memory mesh  /  Evidence lineage chain          ← peer
§5 Evidence & gates       Summary + 5 category cards + unresolved findings      ← peer
§6 Live event tape        Streaming events, monospace, secondary                ← recede
§7 Raw telemetry          5 sparkline channels, secondary                       ← recede

bottom drawer       Alarms (HMI cause/consequence/action) + Rationale layer
```

The seven canonical regions from the brief are mapped 1-to-1. The two **deep dive** regions
(Alarms, Rationale) sit below the brief so operators only meet them when asked.

---

## 3 · Visual hierarchy plan

Three weight tiers, not seven:

| Tier | Sections | Treatment |
|---|---|---|
| **Anchor** | §1 Mission | Cyan-tinted bg wash, taller title, 2px bottom rule. Mission card is the visual centre of mass — phase ID at ~5rem, title in Big Shoulders Display 900, "Decision required" panel with a pulsing pip. |
| **Peer** | §2 §3 §4 §5 | Standard editorial title (~3.4rem Big Shoulders), alternating bg rows, no decoration. |
| **Recede** | §6 Event tape · §7 Telemetry | Smaller title (~2.4rem), muted color, no megatype watermark, reduced padding. Operationally useful but never the lead story. |

Typography:
- **Display** — Big Shoulders Display 900 for section openers and the mission phase ID. Wide,
  geometric, monumental — sets the editorial register.
- **Sans** — IBM Plex Sans 500/600/700 for paragraphs, labels, and the mission objective line.
- **Mono** — IBM Plex Mono everywhere a number, file path, code identifier, or live tick lands.
  Tabular numerals throughout. Time, dispatch counts, fog scores all align column-by-column.

Color is semantic only:

| Token | Use |
|---|---|
| `--live` cyan | "this is happening now" · active stage · live consumer · SSE pulse |
| `--done` muted teal | completed / normal / healthy |
| `--attn` yellow | attention · operator action owed · threshold approached |
| `--severe` orange | severe · degraded · degraded gate |
| `--crit` red | critical · refuted · abnormal only |
| neutral slate | everything else — *most* of the page |

There is **no purple/blue gradient AI vibe**, no glassmorphism, no decorative orbs, no card-in-card.

---

## 4 · Component list

| Component | File | Role |
|---|---|---|
| `CommandStrip` | mc-components.jsx | Top command bar: objective · next · owner · risk · time-left · ctrl buttons |
| `ScanBar` | mc-arch.jsx | Sticky 6-cell scan answering the canonical questions |
| `MissionCard` | mc-arch.jsx | The visual anchor — phase ID, title, objective, decision-required, success criteria |
| `PhaseRunway` | mc-components.jsx | Single horizontal track with stops, elapsed/remaining, blocker, next-action |
| `AgentLanes` | mc-components.jsx | claude ↔ codex with model / state / recent actions / handoff |
| `PhaseArchitectureDiagram` | mc-arch.jsx | Technical dataflow SVG (server / wire / browser / DOM) |
| `OrchestrationDiagram` | mc-arch.jsx | claude → codex → review → evidence → checkpoint, with operator-approval loop |
| `MilestoneStrip` | mc-arch.jsx | v3.2 / v3.3 / v3.4 at a glance |
| `MilestoneDependencyDiagram` | mc-arch.jsx | DAG with clickable chips; opens `PhaseDetailPanel` |
| `PhaseDetailPanel` | mc-arch.jsx | Drawer with ELI5 + why/context/unlocks/outcome per phase |
| `MemoryGraph` | mc-arch.jsx | Typed mesh — observation / claim (?/✓/✗) / decision visuals |
| `LineageChain` | mc-arch.jsx | execution_receipt → review_finding → evidence_verdict → decision_recommendation → promotion_decision |
| `EvidencePanel` | mc-arch.jsx | Summary + 5 categories (tests / code / browser / audit gates / reviewer) + unresolved findings |
| `EventTape` | mc-components.jsx | Streaming events, type filters, auto-scroll on new |
| `TelemetryRail` | mc-components.jsx | 5 instrument cells with sparkline + range bar + tier color |
| `AlarmList` | mc-components.jsx | HMI rows — click to reveal threshold · cause · consequence · action · linked |
| `RationaleLayer` | mc-components.jsx | Collapsible 5-section drawer: why phase / what changed / what could go wrong / evidence / what happens next |

All edges in the architecture/milestone diagrams route as **orthogonal elbow connectors** — no
bezier curves cross node boxes.

---

## 5 · Interaction details

**Alerts** (HMI alarm drawer)
- Row collapsed: severity badge · signal name · single-line detail · time-since
- Click → row expands in place with a 3-column drawer: cause / consequence / corrective action
- Above the drawer: a `Threshold breached` row — the exact predicate that fired
- Below the drawer: linked evidence chips (phase / log / file) — clickable in production

**Phase chips** (milestone dependency)
- Hover: chip brightens
- Click: opens `PhaseDetailPanel` below the diagram with ELI5 + why/context/unlocks/outcome
- The active chip glows cyan and gets a dashed selection ring
- "← Back to map" or clicking the same chip again closes the drawer

**Pipeline stops** (phase runway)
- Hover: tooltip with owner / SLA / status / elapsed / remaining
- Active stage radiates a pulsing radar ring; done stages stamp the ✓ pip
- Time-left in the command strip recolors yellow under 5m, red under 1m

**Telemetry cells**
- Each cell shows live number + delta arrow + sparkline + range bar + tier color
- Range bar carries ticks for normal/attn/severe boundaries plus a target marker
- Cell bg tints with the tier — only when crossing a band

**Section nav**
- Click jumps to section with smooth scroll
- Active section highlights cyan as the page scrolls (IntersectionObserver)

**Decision required**
- When `operator_decision_required` is true, the Mission Card shows a yellow-tinted panel with a
  pulsing pip + the decision prompt — and the Command Strip's "Approve" button highlights cyan
  with an "A" hotkey label

---

## 6 · Copy examples

Labels and alert text use SGSD's domain language directly. Short, declarative, no marketing.

| Surface | Copy |
|---|---|
| Mission objective | "Match the brief HTML quality bar in the live cockpit" |
| Why running | "After P132 shipped the cockpit-sidecar server with minimal text rendering, operator review against the brief flagged a quality gap. P135 closes it." |
| Decision required | "Approve consolidated P135 plan; dispatch P135-T1." |
| Risk reason | "dispatch_count = 7 (operator ceiling 5)" |
| Alarm signal | `dispatch_count` · "7 dispatches in P132 — operator-defined ceiling is 5" |
| Alarm threshold | `dispatch_count ≤ 5 per phase (operator precedent)` |
| Alarm cause | "Phase plan was re-dispatched twice during execute after `vtp-enrich` flagged stale context." |
| Alarm action | "Approve the consolidated P135 plan to lock dispatch and resume execute. Hotkey: A." |
| Rationale · what changed | "P134-T2 closed 20m ago. Stage moved vtp-enrich → plan ~6m ago. dispatch_count crossed the operator ceiling." |
| Rationale · what could go wrong | "Plan re-roll if approval is delayed — would breach token envelope. Dispatch overshoot already at 7/5." |
| Phase ELI5 (P135) | "We're rewriting `client.js` to bring the live cockpit up to the brief HTML quality bar." |

---

## 7 · Before → after

| Aspect | Before | After |
|---|---|---|
| Layout primitive | Bento grid of equal-weight cards | Top-to-bottom comprehension funnel with three weight tiers |
| 5-second answer | Operator must read several cards to assemble | Sticky ScanBar answers all 6 questions in one row |
| Architecture | Implicit; lived in rationale prose | Three first-class SVG diagrams (phase dataflow / SGSD orchestration / milestone dependency) |
| Memory | Flat list of "context sources" | Typed mesh — observation / claim (?/✓/✗) / decision — plus a 5-step lineage chain |
| Milestone fit | A breadcrumb | A clickable dependency DAG with per-phase ELI5 drawers |
| Edges in diagrams | Bezier curves crossing through boxes | Orthogonal elbow connectors |
| Alerts | Signal + detail only | Signal · threshold · cause · consequence · action · linked evidence |
| Rationale | Six prose blocks (why / context / ELI5 / what is / what could be / evidence) | Five structured operational reasoning sections (why phase / what changed / what could go wrong / evidence / what happens next) |
| Color | Decorative cyan/purple gradients | Five semantic tokens, used only on state |
| Typography | Single sans family | Editorial display + sans + mono triad with clear roles |
| Tape/telemetry weight | Equal to other panels | Visually receded — operationally useful, never the lead story |
| Aesthetic | "Claude dark SaaS dashboard" | Mission control × high-performance HMI × trading desk |

---

## 8 · Success checklist

A redesigned cockpit ships when **every** box checks:

- [ ] **5-second test** — within 5 seconds an operator can answer: *what is happening now / why / what changed / what risk / what next / what evidence?*
- [ ] **Quiet normal state** — when nothing is wrong, the page is mostly neutral slate, with cyan only on the active stage and live indicators.
- [ ] **Loud anomaly state** — when a threshold trips, the relevant surface tints the tier color, and the alarm carries threshold / cause / consequence / action.
- [ ] **No card-in-card** — every panel sits at one nesting level inside its section.
- [ ] **No equal weight** — the Mission section is visibly the anchor; tape and telemetry visibly recede.
- [ ] **Domain language** — labels read milestone / phase / dispatch / fog / token / SLA / blocker / gate, never "status / details / info / overview".
- [ ] **First-class architecture** — the system model is visible as three SVG diagrams, not buried in markdown.
- [ ] **Typed memory** — observations, claims (pending/validated/refuted), and decisions are visually distinct.
- [ ] **Evidence lineage** — operator can trace any decision back through `execution_receipt → review_finding → evidence_verdict → decision_recommendation → promotion_decision`.
- [ ] **Above-the-fold action** — the operator's next required move is reachable without scrolling.
- [ ] **Live without thrash** — SSE updates land in under 200ms, but telemetry jitter is smoothed; no flicker.
- [ ] **Keyboard-first** — `A` approves, `P` pauses, `O` opens phase, `Esc` aborts; each shortcut is labeled in the UI.
- [ ] **No decoration** — no glassmorphism, no orbs, no decorative gradients, no random emoji.
- [ ] **Reads like a system, not a report** — operators describe it as "a model of the live execution", not "a dashboard".

---

*Document version · drafted alongside P135 implementation.*
