---
phase: "148"
slug: cross-model-triage
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p148"
depends_on: ["145", "146"]
---

# P148 Context — Cross-Model Triage (Codex second opinion + VTP)

## Goal

`sgsd-triage` becomes two-model and self-healing: a classifier-gated Codex
gpt-5.5/xhigh dispatch (P145 `triage` profile — read-only sandbox = full repo
read, non-ephemeral) produces an independent routing verdict; VTP enrichment
gets a mechanical fallback for its observed null-reflection failure mode.

## Components

1. **Step 0 hardening:** `vtp_route_and_retrieve` returns `reflection: null` OR
   <2 evidence hits → fall back to direct `vtp_search_substrate` with the raw
   query; log degradation row. (Null-reflection observed 3× consecutively
   2026-08-02→04; router once rewrote a design question into "markdown patterns
   for <active_file>".)
2. **Step 0.5 Codex verdict:** prompt = operator raw query + triage tier slice +
   VTP evidence framing + STATE frontmatter. Returns structured
   `{path: A|B|C|D, risk_flags, missed_context, recommended_skills}`.
   Dispatch via codex-exec with `--timeout-tier custom:300` (60s-cap memory —
   never bare `--step`).
3. **Reconciliation:** Claude compares Codex verdict to its own classification.
   Disagreement → BOTH verdicts surfaced to operator with a recommendation;
   never silently resolved.
4. **Auto-fire:** P146 UserPromptSubmit directive makes the trigger list
   structural in every session type.

## Constraints

- Codex failure/timeout → triage completes single-model + logged degradation
  row; never blocks the operator.
- All VTP calls through vtp-context-composer `callVtp` contract (single
  measurement + log point).
- Triage skill doc (SKILL.md at ~/.claude/commands/sgsd-triage + canonical
  super-gsd copy) updated to match; installer syncs both.

## Acceptance criteria

AC-148 (a)(b)(c)(d) from the design spec.
