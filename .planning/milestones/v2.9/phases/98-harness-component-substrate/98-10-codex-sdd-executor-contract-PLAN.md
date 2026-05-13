---
plan_id: 98-10
phase: 98
title: Codex SDD Executor Contract
status: active
owner: codex
created: 2026-05-13
---

# Plan 98-10 - Codex SDD Executor Contract

## Goal

Apply the subagent-driven-development discipline to SGSD Codex execution
without introducing unsafe parallel Codex writers: one fresh Codex executor run
per task, serial workspace writes, independent spec review over raw artifacts,
then the existing ATC/code-quality review.

## Research Inputs

- AHE: make harness changes explicit, reversible, and evidence-backed.
- Forage V2: separate executor from evaluator; use format contracts between
  isolated collaborators.
- HiveMind: avoid naive parallelism on shared constrained resources; central
  admission/serialization prevents contention defects.
- Why LLMs Aren't Scientists Yet: evaluate raw logs, diffs, tests, and original
  artifacts rather than agent-written summaries.

## Tasks

- [ ] Update the Claude/SGSD contract so Codex executor dispatches are described
      as serial SDD implementer runs, not parallel Codex subagent swarms.
- [ ] Add a mandatory spec-compliance review stage between Codex execution and
      per-dispatch ATC for any file-changing task.
- [ ] Define the spec review evidence artifact and require it to inspect raw
      PLAN, diff, report, and verification output.
- [ ] Keep ATC as the second review stage, focused on implementation quality,
      safety, maintainability, tests, and gate risk.
- [ ] Run syntax/search checks proving the new contract is present and stale
      "parallel Codex writers" wording is not introduced.

## Non-Goals

- Do not enable concurrent Codex file writers in the same workspace.
- Do not re-enable Sonnet/Haiku executor fallback.
- Do not modify `.planning/STATE.md` freshness or duplicate-key cleanup.
