---
phase: 115
phase_name: HTML Renderer + PUML Diagram Templates
milestone: v3.1
created: 2026-05-21
status: queued-planning-only
implementation_status: not-started
source: DLB-11.3 — Operator Chronicle Layer; third phase
predecessor: v3.1 P114 PASS @ 398cd17 (context-pack builder + validate helper shipped)
---

# Phase 115 — HTML Renderer + PUML Diagram Templates

> The Chronicle Writer's terminal stage. Consumes CHRONICLE-CONTEXT.json (P114 output), renders a self-contained HTML chronicle with inline SVG diagrams, collapsible PUML source, and operator-authored section templates filled with cited evidence. This is where DLB-11 R1 (PUML mandate) lands.

## Goal

Ship the deterministic HTML renderer + 6 PUML diagram templates + section templates + fallback SVG generator + ≥15-assertion self-test. Output: a self-contained, offline-survivable, inline-only HTML chronicle that the operator reads to maintain cognitive grip after a phase closes.

## Binding invariants (from DLB-11 R1-R6)

1. **R1 — PlantUML source mandatory for every diagram.** All 6 diagrams authored as `.puml` source under `super-gsd/tools/chronicle/templates/puml/`. Pre-rendered to SVG via local `plantuml.jar`. Inlined into HTML AS rendered SVG + collapsible `<details><summary>PUML source</summary><pre>...</pre></details>` blocks. Components labelled with actual repo paths (e.g., `super-gsd/tools/mesh-memory/lineage.cjs`). Arrows labelled with intent (e.g., `writes execution_receipt CMB`). No `!include http://...` (validator P116 rejects).
2. **R3 — Deterministic writer.** Pure Node.js. No agent prose. Section content flows from operator-authored templates with cited-slot injection. MISSING_EVIDENCE placeholders for unfilled slots.
3. **R1 fallback — plantuml.jar absent path.** If `plantuml.jar` not found (probed paths: `$PLANTUML_JAR`, `$HOME/plantuml.jar`, `C:/tools/plantuml.jar`, `C:/Program Files/PlantUML/plantuml.jar`, `C:/Users/<user>/plantuml.jar`), renderer falls back to `svg-fallback-generator.cjs` (hand-coded SVG synthesis from JSON spec) + emits a visible banner: `"PUML source available; rendered via fallback generator (plantuml.jar absent)"`. Operator can `skip_gates: ["puml-render"]` to suppress the banner if desired.
4. **Self-contained HTML.** Inline SVG only. Inline CSS only. NO external CDN, NO `<script src="...">`, NO `<link rel="stylesheet" href="//...">`. P116 validator cross-checks (CHRONICLE-04).
5. **Norman signifier roles.** Each HTML section uses `<section role="claims|observations|decisions|...">` matching its bucket. Body content from section templates.
6. **Determinism.** Same CHRONICLE-CONTEXT.json input → byte-identical HTML output (sorted iteration; deterministic timestamps only at top metadata level, never in body).

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/render-html.cjs` | create — main renderer (~400-600 LOC) |
| `super-gsd/tools/chronicle/svg-fallback-generator.cjs` | create — hand-coded SVG synthesis from JSON spec (~200-300 LOC) |
| `super-gsd/tools/chronicle/templates/puml/architecture.puml` | create — Architecture-at-a-glance diagram |
| `super-gsd/tools/chronicle/templates/puml/lineage-dag.puml` | create — CMB lineage graph |
| `super-gsd/tools/chronicle/templates/puml/gate-waterfall.puml` | create — phase gate progression (preflight → schema-gate → plan-check → ATC → evidence-validator → pseudo-operator → promotion-gate) |
| `super-gsd/tools/chronicle/templates/puml/file-impact.puml` | create — files changed/read/at-risk/protected/out-of-scope map |
| `super-gsd/tools/chronicle/templates/puml/persona-lanes.puml` | create — persona impact lanes (configurable per project; default lanes: operator / executor / reviewer / validator / pseudo-operator) |
| `super-gsd/tools/chronicle/templates/puml/timeline.puml` | create — phase timeline (CONTEXT → RESEARCH → PLAN → PLAN-CHECK → EXECUTION → REVIEW → VALIDATION → PROMOTION) |
| `super-gsd/tools/chronicle/templates/sections/eli5.md` | create — operator-authored ELI5 template with cited-slot syntax |
| `super-gsd/tools/chronicle/templates/sections/remember-tomorrow.md` | create — "what to remember" template |
| `super-gsd/tools/chronicle/templates/sections/risks.md` | create — risks + rollback template |
| `super-gsd/tools/chronicle/templates/sections/persona-impact.md` | create — persona impact template |
| `super-gsd/tools/chronicle/templates/style.css` | create — inline CSS (clarity-board-deck colour scheme) |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — extend with renderer assertions (the file shipped P114; P115 adds new SACs) |
| `super-gsd/tools/chronicle/fixtures/sample-rendered-chronicle.html` | create — golden HTML output for byte-identical comparison |

15 files (14 new + 1 modified). Mirrors v3.0 P107's mid-milestone tooling phase scale.

## PUML authoring contract (the binding part)

### Architecture diagram (`architecture.puml`)

Shape: shows the SGSD subsystem footprint with actual repo folder labels. Components grouped:
- **Schema layer**: `super-gsd/schemas/*.json` (cmb / chronicle / chronicle-manifest)
- **Mesh memory tools**: `super-gsd/tools/mesh-memory/*` (validate / hash / lineage / writers / pseudo-operator)
- **Chronicle tools**: `super-gsd/tools/chronicle/*` (this phase's deliverables)
- **Codex Pro Mode**: `super-gsd/tools/codex-pro/*`
- **Context Authority**: `super-gsd/tools/context-authority/*`
- **Codex hooks**: `super-gsd/tools/codex-hooks/*`
- **Mesh ledger**: `.planning/mesh/memory/cmbs.jsonl`
- **Codex CLI substrate**: `super-gsd/scripts/codex-{exec,executor,patch-executor}.sh`
- **Cockpit**: `super-gsd/tools/cockpit/*`

Colour-coded status (clarity-board-deck style):
- **sage** (`#7CB479`) — shipped (v3.0 + v3.1 closed phases)
- **terracotta** (`#C97B5B`) — added this milestone (v3.1 in-flight)
- **amber** (`#E6A23C`) — at-risk / DEGRADED-PATH (e.g., plantuml.jar absent)
- **slate** (`#5C6776`) — read-only / context-only

Arrows labelled with intent. Example:
- `chronicle_writer --> mesh_ledger : "reads CMBs filtered by phase_id"`
- `cmb_validate --> cmb_schema : "validates against draft-07"`

### Lineage DAG (`lineage-dag.puml`)

CMB lineage graph: nodes = CMBs (labelled with id + class + signifier_role); edges = `parents[]` references. Render per-phase (filtered by phase_id) OR per-milestone (filtered by milestone_id). Used in the chronicle's "Lineage graph" section.

### Gate waterfall (`gate-waterfall.puml`)

Vertical waterfall: each gate (preflight / schema-gate / plan-check / ATC / evidence-validator / pseudo-operator / promotion-gate / chronicle-validation [P116]) with PASS / FAIL / SKIPPED status colour-coded.

### File impact map (`file-impact.puml`)

Phase's file-touch footprint partitioned: `created` (terracotta), `modified` (amber), `read-only-referenced` (slate), `out-of-scope` (gray dashed border).

### Persona lanes (`persona-lanes.puml`)

Default 5 lanes: operator / executor / reviewer / validator / pseudo-operator. Each lane shows what that role did during the phase (drawn from CMB classes — execution_receipt → executor lane, etc).

### Timeline (`timeline.puml`)

Horizontal timeline: 8 stage rectangles (CONTEXT → RESEARCH → PLAN → PLAN-CHECK → EXECUTION → REVIEW → VALIDATION → PROMOTION); each stage GREEN / AMBER / RED based on stoplight (v3.0 P110 Codex Pro Mode).

## Section template syntax

Templates use double-brace slot syntax with cited-evidence injection:

```markdown
# What changed (ELI5)

In this phase, SGSD shipped {{file_count}} files implementing {{phase_name}}. {{eli5_one_liner}}

The most important change: {{key_change_summary}}.

[Evidence: {{key_change_citation}}]
```

Slot population rules (in `render-html.cjs`):
- `{{file_count}}` ← count of `files_changed` from chronicle context
- `{{phase_name}}` ← from chronicle metadata
- `{{eli5_one_liner}}` ← from VERIFICATION.md frontmatter `eli5:` field if present, else MISSING_EVIDENCE
- `{{key_change_summary}}` ← derived from highest-confidence promotion_decision CMB body excerpt, else MISSING_EVIDENCE
- `{{key_change_citation}}` ← the citation reference (cmb-... or file path)

Any unfilled `{{...}}` slot AT RENDER TIME becomes `<span class="missing-evidence" data-slot="...">MISSING_EVIDENCE</span>` in HTML. P116 validator counts these + rejects if any are present without a `denominators_empty_reason`-style justification.

## Semantic acceptance criteria (target — 115-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P115-01
    input: "fixtures/sample-chronicle-context.json (P114 golden output)"
    expected_outcome: "renderer produces phase-chronicle.html that contains all 6 inline SVG diagrams + 4 section template blocks"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-01"

  - id: SAC-P115-02
    input: "same input twice"
    expected_outcome: "byte-identical HTML output (deterministic)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-02"

  - id: SAC-P115-03
    input: "rendered HTML"
    expected_outcome: "passes self-contained check: no http(s):// in src/href; no <script src>; no <link rel=\"stylesheet\" href>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-03"

  - id: SAC-P115-04
    input: "rendered HTML"
    expected_outcome: "every diagram block contains both rendered <svg> AND collapsible <details><summary>PUML source</summary>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-04"

  - id: SAC-P115-05
    input: "PUML file with !include http://... attempted"
    expected_outcome: "renderer rejects with REPORT_PUML_EXTERNAL_INCLUDE before invoking plantuml.jar / fallback"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-05"

  - id: SAC-P115-06
    input: "plantuml.jar absent + skip_gates: [] (no opt-in fallback)"
    expected_outcome: "renderer falls back to svg-fallback-generator + emits visible 'PUML source available; rendered via fallback generator' banner in HTML"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-06"

  - id: SAC-P115-07
    input: "plantuml.jar absent + skip_gates: ['puml-render']"
    expected_outcome: "renderer falls back silently (no banner) but still emits PUML source in collapsible details"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-07"

  - id: SAC-P115-08
    input: "section template with {{slot_without_evidence}}"
    expected_outcome: "rendered HTML contains <span class=\"missing-evidence\" data-slot=\"slot_without_evidence\">MISSING_EVIDENCE</span>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-08"

  - id: SAC-P115-09
    input: "rendered HTML"
    expected_outcome: "every <section> has role attribute matching one of the 7 Norman signifier classes"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-09"

  - id: SAC-P115-10
    input: "architecture.puml"
    expected_outcome: "contains ≥3 actual repo path labels (e.g. super-gsd/tools/...) and ≥3 arrows with intent labels"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-10"

  - id: SAC-P115-11
    input: "all 6 PUML templates"
    expected_outcome: "each parses (PUML syntax valid by static grep + structural check)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-11"

  - id: SAC-P115-12
    input: "rendered HTML"
    expected_outcome: "matches golden fixture sample-rendered-chronicle.html (byte-identical)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-12"

  - id: SAC-P115-13
    input: "full self-test"
    expected_outcome: "all ≥15 assertions green (12 SAC + ≥3 STRUCT)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

13 SACs declared at CONTEXT-level. Self-test adds STRUCT checks for: HTML doctype/charset, CSS inline-only, character escape coverage, SVG element count per diagram.

## Out of scope

- Validator binding gate (P116)
- Storage adapter / VTP routing (P117)
- Cockpit integration (P118)
- Milestone chronicle + roadmap miner (P119)
- Modifying P113 schemas (frozen substrate)
- Modifying P114 builder (frozen substrate; renderer is downstream-only)

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — design lock (R1 PUML mandate, R3 deterministic writer)
- `.planning/milestones/v3.1/INTENT.md` — milestone WHY
- `.planning/milestones/v3.1/ROADMAP.md` — Non-Negotiable Rule 10 (PUML source mandatory)
- `.planning/milestones/v3.1/MILESTONE-READINESS.md` — P115 DEGRADED-PATH (plantuml.jar absent → fallback generator)
- `.planning/milestones/v3.1/phases/114-context-pack-builder/114-VERIFICATION.md` — predecessor; P115 consumes CHRONICLE-CONTEXT.json from P114 builder
- `.planning/analyses/2026-05-21-sgsd-v3-user-guide.html` — POC for HTML style + ELI5 idiom
- `C:\Users\jack.berrow\Downloads\clarity-board-deck (2).pdf` — visual style reference (sage / terracotta colour scheme)
- `super-gsd/tools/mesh-memory/lineage.cjs` — pattern for the lineage-dag.puml node/edge derivation
