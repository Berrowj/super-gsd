# vtp-query-triage — Frozen Self-Invocation Baseline

FROZEN-BASELINE-2026-08-12

> **Read-only snapshot.** `vtp-query-triage` is a VTP product skill living at the
> user-global `~/.claude/skills/vtp-query-triage/SKILL.md`. super-gsd neither owns
> nor version-controls it, so this phase does **not** edit it. This file captures the
> skill's current self-invocation trigger verbatim so the 28-day KB-triage shadow
> window (P152) measures its "would-fire" signal against a **fixed** soft-path baseline.
>
> **Deferred:** actually *strengthening* the VTP skill's self-invocation is a
> VTP-lane change, out of super-gsd's boundary and out of scope for P152.

## Frozen trigger prose (verbatim `description:`)

```
description: FIRST STOP for any QUESTION touching the VTP knowledge base, meetings, corpus, or Clarity/JCL context - consults the vtp_triage Phase-2 advisory compiler first, then classifies against the Triage v2.1 archetype table and routes to the right skills before any retrieval. Recordings/transcripts route to vtp-triage (ingestion) instead.
```

- **sha256(trigger prose):** `6420e87947ee6f234743978f7d6ca1f259a21cdcf8202696d186f6bc94fcf50b`
- **Source file:** `~/.claude/skills/vtp-query-triage/SKILL.md` (89 lines at snapshot)
- **Snapshot method:** read-only; the global skill is byte-unchanged by this phase.

## Frozen archetype routing table (verbatim)

## Archetype routing (spec §27, condensed to current handlers)

| # | Question shape | Route | Run today |
| --- | --- | --- | --- |
| 1 | "Find the clip/quote where <speaker> says X" | RETRIEVE.SPEAKER_POSITION | meeting retrieval (speaker-scoped), cite span, stop |
| 2 | "What is X?" (concept, no speaker) | EXPLAIN.CORPUS_CONTENT | vtp-deep-answer Tier A/B light |
| 3 | "Why does <speaker> say X?" | EXPLAIN.SPEAKER_POSITION | speaker passages FIRST (primary source), then vtp-deep-answer Tier B lenses — books/papers are lenses, never substitutes for the speaker's own words |
| 4 | "Is <speaker> right that X?" | EVALUATE.WORLD_CLAIM | Row 3 + explicit evaluation section with mixed evidence, labelled |
| 5 | "Compare <A> and <B> on X" | COMPARE.SPEAKER_POSITION | per-speaker primary passages, then synthesis |
| 6 | "What did we decide about X in <meeting>?" | RETRIEVE.BUSINESS_RECORD | document-scoped retrieval, cite |
| 7 | "Summarise <client> call" | SYNTHESIZE (client scope) | client-tenant material ONLY; never blend shared corpus |
| 8 | "Should we do X or Y?" | DECIDE.PROCESS_OR_POLICY | vtp-deep-answer Tier C (board round); recommend, never act |
| 9 | "Draft/build <deliverable>" | GENERATE | vtp-html-explainer + Tier C content |
| 10 | "Here's a recording / worth processing? / add to VTP" | INGEST | **hand off to the vtp-triage skill (Intake A)** — never retrieval, never summary-before-admission |
| 11 | "Update the KB/graph with X" | ACT | graphify / write flows, operator-approved |
| 12 | "Why is <VTP tool/skill> misbehaving?" | DIAGNOSE.SYSTEM_STATE | logs/receipts/health, not corpus |
| 13 | "How does VTP route/triage?" | META | answer from the v2.1 spec |
| 14 | Doesn't fit confidently | UNKNOWN → CLARIFY | ask one targeted question; never force a bucket |

## Why this is the baseline

The shadow classifier (P152 T2) records, per KB-directed prompt, whether it
**would** route to this skill — firing nothing. To decide whether a future hard
gate adds value over this soft path, the soft path must not move underneath the
measurement. This snapshot + hash is the anchor: if the global skill's trigger
prose changes during the window, the hash mismatch flags that the baseline drifted
and the 28-day comparison must restart.
