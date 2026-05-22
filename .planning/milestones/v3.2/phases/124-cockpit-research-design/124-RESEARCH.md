---
phase: 124
artifact: RESEARCH
milestone: v3.2
ws: B
created: 2026-05-22
research_method: retrieve-per-book-first VTP Qdrant pass — 7-book base (the 4 WS-A books + 3 since-ingested)
books_queried: 7
vtp_health: ok (62 books, 90 research docs)
---

# Phase 124 — Cockpit Research (RESEARCH artifact)

> Answer-first. The cockpit redesign decision is in §1. Evidence is in §2-3. Current-cockpit audit is in §4. Synthesis (clearly separated from direct evidence) is in §5.

## §1 — The answer

The cockpit should become a **terminal-primary, answer-first glance surface** that does the *active looking* for the operator: it computes and shows **one North Star**, **exactly one preattentive alert**, and **one recommended action** — everything else demoted or folded. An optional `--html` snapshot consumes the P120 shared design system for archival/sharing. This evolves `cockpit-sidecar.cjs` only; the v2.9 Lock-13 cockpit array is untouched.

The current sidecar fails this: its `renderText()` emits a **flat 14-line dump of equal-weight lines** — the single most important signal (binding gate) is line 6 of 14, the fog tier is buried mid-list, and nothing tells the operator what to *do*. It lists; it does not rank.

## §2 — Direct evidence (VTP book passages — chunk id + similarity score)

Every row is a retrieved passage. Synthesis is deferred to §5.

| Principle | Book | Chunk id | Score | What the passage says |
|---|---|---|---|---|
| Information overload is the default condition | The Back of the Napkin | `the-back-of-the-napkin::ch00::0030` | 0.69 | "Information overload is today's standard operating condition… *active* looking serves as a useful approach for figuring out what's important." |
| Precognitive visual triage | The Back of the Napkin | `the-back-of-the-napkin::ch00::0036` | 0.67 | "Our visual processing centers take a quick glance at everything, make a rapid decision about what's really worth looking at… rejecting everything else." |
| One North Star, not five | Made to Stick | `made-to-stick…::ch00::0018` | 0.64 | "The Army's Commander's Intent forces its officers to highlight the most important goal… You can't have five North Stars, you can't have five 'most important goals'." |
| Forced prioritization | Made to Stick | `made-to-stick…::ch00::0021` | 0.63 | "Suppose you can telegraph only one thing before the line gets cut, what would it be? There's only one lead, and there's only one core. You must choose." |
| Threshold→duration→channel alert grammar | Designing ML Systems | `designing-machine-learning-systems::ch08::0025` | 0.75 | "Create an alert when a metric breaches a threshold, optionally over a certain duration… Notification channels describe who is to be notified when the condition is met." |
| Alert fatigue | Designing ML Systems | `designing-machine-learning-systems::ch08::0022` | 0.62 | "You might soon be overwhelmed by alerts… 'alert fatigue' where the monitoring team stops paying attention because they are so frequent." |
| Colour used sparingly | Storytelling with Data | `storytelling-with-data-lets-practice::ch00::0109` | 0.62 | "By making so many things different, we actually lose the potential strategic preattentive value of color… difficult to create sufficient contrast to focus the eyes." |
| Preattentive single-focus | Storytelling with Data | `storytelling-with-data-lets-practice::ch00::0107` | 0.63 | "My eyes immediately go to the speed limit sign… big, bold, black number on white is striking. The red demands attention… we are conditioned that red is an alert." |
| Visual hierarchy — bold for highlight, minimal noise | Storytelling with Data | `storytelling-with-data-lets-practice::ch00::0152` | 0.69 | "Bold is generally preferred over italics and underlining because it adds minimal noise while clearly highlighting." |
| Clear message: short, simple, audience-focused | Simply Said | `simply-said-communicating-better-at-work::ch03::0002` | 0.74 | "A clear message: is short, uses simple language, is focused on the needs of the audience. Limit your key message to one sentence, preferably fewer than 10 words." |
| Jargon harms the non-specialist | Resonate | `resonate-present-visual-stories::ch167::0004` | 0.67 | "Using highly specialized jargon when addressing nonspecialists can harm comprehension… you can't assume people have kept up with your field." |
| Contrast holds attention | Resonate | `resonate-present-visual-stories::ch12::0003` | 0.61 | "People are naturally drawn to contrast… building highly contrasting elements holds the audience's attention." |

### Chart-redesign book figures (book_figures collection — figure id + similarity)

| Figure id | Score | Caption | Relevance to the cockpit |
|---|---|---|---|
| `c07f043` | 0.69 | "Focus attention" | Bold dark-navy series vs de-emphasised light grey — "immediate focal contrast draws the eye." The cockpit's one-alert pattern. |
| `c07f050` | 0.68 | "Focus on lowest scoring items" | Same selective-intensity technique reapplied — only the signal-bearing items get colour. |
| `c03f029` | 0.72 | "Upper-left-most orient graph title" | Decluttered near-final state; takeaway title left-aligned upper-left. Layout mirrors logic (R10). |
| `c03f025` | 0.67 | "Eliminate data labels" | Removing 24 numbers calmed the visual — "the eye can perceive the overall pattern." Demote detail. |

## §3 — Book-slug confirmation

All 7 books resolve in VTP `book_passages` / `book_figures`:
`the-back-of-the-napkin`, `storytelling-with-data-lets-practice`, `made-to-stick-why-some-ideas-survive-and-others-die`, `simply-said-communicating-better-at-work`, `resonate-present-visual-stories`. The Minto Pyramid Principle is vision-ingested in `book_figures` (per operator). Thing Explainer is ingested but returned no passage above 0.55 for cockpit-relevant queries — its single principle (explain with only common words) is folded into Simply Said + Resonate jargon evidence rather than separately cited. The cockpit-relevant alert grammar additionally draws on `designing-machine-learning-systems` ch8 (a technical book already in the base).

## §4 — Current-cockpit audit (`cockpit-sidecar.cjs` + `fog-score.cjs`)

**What it reads (read-only, no Lock-13 touch):** `.planning/STATE.md` frontmatter, chronicle `INDEX.jsonl`, `chronicle-validation-log.jsonl`, `codex-executor-log.jsonl`, `token-attribution.jsonl`. It deliberately sidesteps the v2.9 frozen `cockpit-state/*` array — confirmed: no `require` of any `cockpit-state` or `cockpit/*` module.

**What it computes:** `latest_chronicle`, `binding_gate_status` (GREEN/YELLOW/RED), `fog_score` via `computeFogScore` (10 weighted signals → tier + `must_read_sections`), `recent_chronicles` (last 5), the 10 fog signals + `commits_in_phase`, and a `warnings[]` list.

**Form factor today:** a CLI with `--json` (machine) and `--text` (human). `--json` is the default.

**Where it diverges from answer-first / preattentive discipline:**

1. **It lists, it does not rank.** `renderText()` emits 14 lines of equal visual weight. No North Star. Violates Made-to-Stick `::0018` (one North Star) and the §1 forced-prioritization principle.
2. **The most important signal is buried.** `binding_gate: RED` is line 6 of 14; `fog_score` is line 7. The operator must read the whole dump to find the one thing that matters. Violates Storytelling-with-Data `::0107` (preattentive single-focus).
3. **No alert grammar.** Nothing fires on a threshold-over-duration. Either everything is shown flatly or nothing is. No condition→duration→channel structure (Designing-ML-Systems `ch08::0025`).
4. **No recommended action.** The cockpit reports state; it never says "do X next." The operator does the active looking the cockpit should do for them (Back-of-the-Napkin `::0030`).
5. **No colour discipline.** `--text` is plain monochrome; `--json` has none. There is no sparing, strategic use of colour to mark the one alert (Storytelling-with-Data `::0109`).
6. **`warnings[]` is an undifferentiated dump.** All warnings are equal; a benign `executor_log_unavailable` sits beside a real signal — the alert-fatigue failure mode (Designing-ML-Systems `ch08::0022`).

**What stays:** the read surface (the 5 ledger inputs), `fog-score.cjs` and its 10 signals, `binding_gate_status` derivation, the `--json` output (machine consumers keep it byte-stable). Only the **human render** and a new **ranking + alert layer** change.

## §5 — Synthesis (NOT direct evidence — orchestrator inference for the design spec)

- The cockpit and the chronicle face the same operator with the same failure mode (overload) in two tenses; the WS-A answer-first treatment transfers directly. The cockpit's North-Star banner is the chronicle's Operator Decision Panel, live.
- "One North Star" + "preattentive single-focus" + "colour sparingly" compose into a single rule for the redesign: **exactly one element is allowed to be loud per render** — and it is whichever signal currently matters most.
- The alert grammar (threshold→duration→channel) plus alert-fatigue evidence implies the cockpit must *rank then gate*: compute every candidate alert, then surface only the top-ranked one; the rest are counted, not shown.
- Terminal-primary is the right call: per the operator's Mission Control setup the cockpit already runs live in a Windows Terminal pane. ANSI colour can carry "colour sparingly" (one bold/red line). The optional `--html` snapshot is where the literal P120 shared stylesheet is consumed — satisfying invariant 1 without forcing a browser for the live glance.
