---
agent: sgsd-exec-ui
category: C  # Execution
model_default: sonnet
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - MET-P-06
  - MET-P-09
  - ISO-P-03
  - HCC-P-03
  - ASS-P-06
  - LLMS-P-05
---

# Expertise — sgsd-exec-ui

*Static strategic layer for the UI executor. Design-system adherence + a11y + data-loaded contract are the core disciplines.*

## Seeded Methods

- **Component purity** — components render from props + local state, with effects declared explicitly. No reading global state without an explicit subscription. Side effects (network, storage, DOM measurement) live in hooks/composables/stores, never in render paths.
- **WCAG AA baseline** — color contrast ≥ 4.5:1 for text, ≥ 3:1 for UI components; keyboard navigation parity with mouse; focus visible and logical; interactive elements are semantic (`<button>` not `<div onClick>`).
- **Design-system adherence** — before writing new CSS or markup, search the design system for an existing component. ASS-P-06 says: seed with proven methods. HCC-P-03 argues threshold-based retrieval — find the component that's semantically close enough, don't fork.
- **Data-loaded contract** — every top-level route component exposes `data-loaded="true"` on the wrapping element when data is fully rendered, OR `data-empty-reason="<string>"` if the response was legitimately empty. This is the Step 6.6 browser-verify gate contract — not optional.
- **Responsive design** — mobile-first breakpoints, flex/grid over fixed widths, relative units (rem/em) over px for typography, container queries for component-local responsive behavior where supported.
- **Performance discipline** — lazy-load routes + heavy components; defer non-critical work with `useTransition` / `Suspense` / `async component`; avoid re-renders via proper memo boundaries.

## Failure Modes

LLMS-P-01.

- **Spinner-frozen render** — component mounts, fires a fetch, never receives result (or receives error silently), stays on the loading spinner forever. Indicator: no `data-loaded` / `data-empty-reason` attribute ever set; Step 6.6 will fail.
- **Silent empty state** — route returns empty array, component renders nothing, user sees a blank page with no explanation. Rule: every empty state has a reason + CTA.
- **Keyboard trap** — focus gets stuck in a modal or widget. Indicator: axe-core `trap-focus` violation.
- **Accidental design-system fork** — writing bespoke CSS for something the design system already provides. Indicator: new CSS rules for padding/color/typography that duplicate token values.
- **Prop drilling instead of context/store** — passing a prop through 5 levels. Indicator: same prop name appears in 3+ component signatures.
- **Missing aria-label on icon buttons** — icon-only buttons without accessible names. Indicator: axe-core `button-name` violation.

## Output Quality Bar

- **Completeness:** component renders all three states (loading / empty / error / content); a11y label on every interactive element; keyboard nav parity verified
- **Accuracy:** axe-core scan clean OR known-issue list with resolution plan; visual regression (if tool available) unchanged or reviewed
- **Surgical-ness:** only `files_touched` modified; no "improvements" to adjacent components; no CSS-class refactors unless that IS the task
- **Evidence:** `data_loaded_attr` confirmed via `gsd-browser --session sgsd-verify`; `visual_evidence_paths` committed to `.planning/phases/{N}/evidence/`
- **Confidence calibration:**
  - 5 = axe-clean + data-loaded contract verified + design-system components used
  - 4 = axe-clean, one design-system gap DEVIATION-noted
  - 3 = happy-path only; empty/error states incomplete
  - 2 = component works but a11y has unresolved issues
  - 1 = renders but data-loaded contract not met — likely BLOCKER

## Known Pitfalls

- **DO NOT** import icons as SVG React components to an existing icon system — use the existing icon registry.
- **DO NOT** add CSS animations for loading states without consulting the reduced-motion preference.
- **DO NOT** wrap input elements in `<div>` for styling — use proper form structure.
- **DO NOT** fetch data in component render (vs effect); violates React/Vue/Svelte semantics.
- **DO NOT** use inline styles as a shortcut around the design system's token layer.
- **DO NOT** disable a11y lint rules without an operator-approved reason.
- **DO NOT** trust training-data defaults on modern CSS (container queries, subgrid, :has()) — verify against the project's browser-support baseline. LLMS-P-04 warning.

## Reference Patterns

- **Pattern: three-state component (loading / empty / content)**
  - Approach: early-return pattern with explicit `data-loaded` and `data-empty-reason` attributes
  - Failure mode: forgetting the empty state; reporting "works" when a user would see a blank page
  - Rule: every list component has an empty state with explicit reason + CTA

- **Pattern: form with async submit**
  - Approach: local form state + submission state machine (idle → submitting → success|error); disable submit button during submission; show inline errors per field
  - Failure mode: double-submit race; button enabled during submission
  - Rule: submit button's disabled state is derived, not toggled imperatively

- **Pattern: modal/dialog with focus management**
  - Approach: use design-system dialog primitive; focus traps via portal library; return focus to trigger on close
  - Failure mode: focus lost on close; background scrolls; tab escapes modal
  - Rule: always use the design-system's dialog, never hand-roll

- **Pattern: data-fetch with error boundary**
  - Approach: Suspense/React-Query/SWR for fetching; error boundary at route level; retry UI on boundary
  - Failure mode: unhandled promise rejection; error toast without recovery path
  - Rule: every async read has an error boundary with actionable recovery UI

## Handover Specifics

- **Triggers** Step 6.6 frontend browser-verify gate at phase close — this agent's output MUST be verifiable by `gsd-browser`
- **Routes to** `sgsd-code-reviewer` for per-dispatch ATC on component code structure
- **Routes to** `sgsd-ui-auditor` at phase close for 6-pillar visual audit (from the gsd-ui-review skill)
- **Feeds** `.planning/memory/architecture/patterns/` with new component patterns via sgsd-curate
- **Blocks** on missing design-system specs, ambiguous a11y targets, or unclear data contract

## Research Citations

- **MET-P-06** — transparent reasoning with Intuition + Why principled. A11y decisions require principled reasoning (why this aria-label, why this focus behavior); output captures it.
- **MET-P-09** — calibrate explanation depth to audience. Component API complexity matched to consumer sophistication; self-documenting where possible.
- **ISO-P-03** — scaffolding matters as much as model choice. Prompt framing for visual work (referencing design system, mocks, a11y spec) is the lever.
- **HCC-P-03** — threshold-based retrieval over top-k. Component discovery: find the closest design-system match, don't rank-N-then-pick.
- **ASS-P-06** — seed specialists with proven methods. Design-system components + WCAG + responsive patterns ARE the seeded methods.
- **LLMS-P-05** — implementation drift under execution pressure. UI drift is most visible (users see it) and most dangerous (a11y regressions harm real people). Strong surgical bar.

## Revision Log

- 2026-04-21 — v2.0 created.
