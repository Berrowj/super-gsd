---
title: MUDA Read-Path Algorithm Spec (DLB-05 SPEC-NOW)
tags: [dlb-02, dlb-05, muda, read-path, spec, deferred]
importance: 85
maturity: spec
created: 2026-04-20T20:49:43Z
---


## Status

**Activation**: DEFERRED.
**Gate**: DLB-02's 2-milestone recurrence rule ("classifier consults memory pre-dispatch is deferred until 2 milestones of real dispatch data exist").
**Reviewer**: Architect has veto on any PR that cites this spec to justify early activation before the gate fires.

This is **documentation only**. No code executes against this spec. No read-path wires until DLB-02's gate unlocks.

## Purpose

Fills the gap DLB-02 explicitly left open: the read-path's query templates were never specified. DLB-04 Contrarian Gate 3 and DLB-05 Moonshot's retype-MUDA conversation surfaced Process Mining's 7 anomaly patterns as a structured vocabulary for pre-dispatch classifier queries. This file commits the vocabulary without committing to the wiring.

## The 7 Query Templates

Each template maps a Process Mining anomaly pattern (from the 2026-03-15 Technical Briefing, §9) to a pre-dispatch query the classifier would run against the MUDA write-path corpus IF the read-path were active.

### 1. Bottleneck
**Anomaly**: disproportionate time/cost concentration on a single step.
**Query template**: "For phase-type `<type>`, are there MUDA findings where a single dispatch consumed >N% of phase-total tokens?"
**Classifier use**: pre-dispatch, warn if the planned unit of work matches a historical bottleneck signature.

### 2. Rework
**Anomaly**: same step executed multiple times with different outcomes.
**Query template**: "For task-pattern `<p>`, are there MUDA findings of Rule-1 deviations (planner→executor corrections) in the last 3 phases?"
**Classifier use**: pre-dispatch, surface prior rework history for similar tasks.

### 3. Deviation
**Anomaly**: planned path vs actual path divergence.
**Query template**: "For this plan's structure, are there MUDA findings where `DEVIATIONS` count > N?"
**Classifier use**: overlaps with DLB-05 Q2 conformance metric — drift_pct becomes the quantitative version.

### 4. Resource outlier
**Anomaly**: a specific agent/model consuming abnormally for a task class.
**Query template**: "For model `<M>` on task-type `<T>`, are there MUDA findings of `extra_processing` verdict?"
**Classifier use**: pre-dispatch, flag if the selected model is historically wasteful on this task class.

### 5. Temporal
**Anomaly**: step timing outside expected distribution.
**Query template**: "For unit-type `<t>`, are there MUDA findings of `narrative_age_sec` > N in the last milestone?"
**Classifier use**: surface timing-related waste without new probes.

### 6. Variant
**Anomaly**: same nominal process executed with materially different structures.
**Query template**: "For phase-goal matching `<signature>`, are there MUDA findings showing >N variant executions?"
**Classifier use**: detect divergent handling of nominally-similar work.

### 7. Handoff
**Anomaly**: friction at transitions between agents/phases.
**Query template**: "For agent-to-agent handoff `<A->B>`, are there MUDA findings of `inventory` verdict (orphaned artifacts)?"
**Classifier use**: pre-dispatch, surface handoff waste history.

## Why SPEC-NOW (not ACTIVATE-NOW)

DLB-05 Moonshot R2 concession: "The retype is Option A: adopt 7 Process Mining anomaly patterns as specification for which waste classes trigger the eventual read-path wiring, while leaving that wiring gated on DLB-02's 2-milestone rule. The DLB-02 decision memo is explicit — 'read path deferred until 2 milestones of real dispatch data exist.' The retype does not bypass this. What it does is name the algorithm that DLB-02 left unnamed."

Contrarian R2 (C-verdict): "Same empty-store activation problem, DLB-02 gate still unmet, no recurrence data exists. The Process Mining framing is a relabeling of the same pre-dispatch query."

CEO synthesis accepted SPEC-NOW on the narrow interpretation: docs only. Architect veto on PRs citing this for early activation is the mitigation for Contrarian's Trojan-horse concern.

## Activation Trigger

This spec becomes executable ONLY when:

1. DLB-02's 2-milestone recurrence gate fires (≥2 milestones of real waste-class recurrence in `.planning/metrics/muda-log.jsonl`), AND
2. A new DLB fires with the recurrence data as evidence, AND
3. That DLB votes ADOPT on classifier-consults-memory read-path activation, AND
4. The implementation PR references THIS file as the algorithm spec.

Until those four conditions hold, this is a paper commitment, nothing more.

## Related

- `.planning/decisions/DLB-02-muda-learning-loop.md` — original write-path + read-path deferral
- `.planning/decisions/DLB-05-vtp-audit-sharpening.md` — the deliberation that adopted this spec
- `super-gsd/scripts/sgsd-muda-probe.sh` — the write-path that will feed the corpus queried here
- `.planning/metrics/muda-log.jsonl` — where recurrence data accumulates for the 2-milestone gate
