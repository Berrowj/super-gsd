---
milestone: v1.7
status: active
created: 2026-04-27
purpose: Audit-first promotion gate. v1.7 must NOT collide with the 4 existing contracts.
---

# v1.7 Existing-Surface Audit — Stable Command Contracts + Route Intelligence

## The 4 existing contracts (do NOT duplicate)

| Contract | File | Owns | Schema level |
|----------|------|------|--------------|
| `code-reviewer-v1` | implicit (referenced by review-providers.yaml) | review verdicts (CRIT/WARN/PASS, 5 required fields) | reviewer report |
| `review-providers-v1` | `super-gsd/registry/review-providers.yaml` | invocation type (agent/shell), auth, fallback chain | provider registry |
| `handover-contract-v2` | `super-gsd/registry/handover-contract-v2.yaml` | input/output for sgsd-* agents (FILES_CHANGED, VERIFICATION, DEVIATIONS, etc.) | agent dispatch |
| `plan-schema-v2` | `super-gsd/templates/plan-schema-v2.json` | YAML frontmatter for PLAN.md (tasks list, schema_version, etc.) | plan file |

## What v1.7 adds (FIFTH abstraction level — command/script output)

The 4 existing contracts cover **agents, providers, plans, reviews**. They do NOT cover
**SGSD command/script/skill output** — when `sg`, `sgsd-muda-audit.sh`, `/gsd-progress`
run, there is no shared output envelope. Dashboards regex prose; gates parse bespoke shapes.

The canonical command envelope (Phase 31) is the **fifth contract** at a different level:
**command-output**, not agent-report.

## Existing telemetry envelope-compatibility

| Stream | Schema | Envelope-fit |
|--------|--------|--------------|
| `codex-log.jsonl` | provider/state/exit/duration_ms/report_path | ~80% (missing `status`, `reason_codes`, `next_action`) |
| `audit-log.jsonl` | phase/status/severity/reason | ~70% |
| `edge-guard-log.jsonl` | from_step/to_step/result/missing_emits | ~90% (already structured) |
| `readiness-log.jsonl` | probe/result/repair | ~95% (closest existing match) |
| `muda-log.jsonl` | probe/threshold/finding | ~60% |
| `commit-reviews.jsonl` | per-dispatch ATC (uses code-reviewer-v1) | ~75% |
| `crit-backlog.jsonl` | v1 schema (kind/missing_evidence/suspected_cause/confidence) | independent — not subsumed |

## v1.5 Codex kill-check data gap (Phase 34 target)

`v1.5/SUMMARY.md` recorded that the v1.5 Codex kill-check ran on an empty baseline
because the canonical review ledger does not yet exist (per-phase commit-reviews.jsonl
exists, but no aggregator). Phase 34 closes this — aggregator + real-time writer.

## Reconciliation Plan (no overlap with the 4 existing contracts)

| Phase | What it adds | What it does NOT touch |
|------:|--------------|------------------------|
| 31 | Command Envelope schema (NEW level: command-output) | code-reviewer-v1, handover-v2, plan-schema-v2, review-providers (untouched) |
| 32 | `route-decisions.jsonl` + lib (NEW metric stream, boundary-only) | existing JSONL streams |
| 33 | `repair_instruction:` field on gates.yaml block-shaped rows + optional safe `repair_command:` (under 26.3 4-AND predicate) | gate enforcement modes unchanged |
| 34 | canonical review ledger aggregator + real-time writer (reads existing per-phase commit-reviews.jsonl + codex-log.jsonl, writes consolidated `.planning/metrics/review-ledger.jsonl`) | per-phase logs untouched |
| 35 | generated system-map command (reads frontmatter from agents/skills/scripts/gates) | manual handbook catalogs deprecated, NOT deleted |

## Locked decisions for v1.7 (from `.planning/discussions/2026-04-26-mass-discuss.md`)

| Phase | Locked option | Rationale |
|------:|---------------|-----------|
| 31 | A — new envelope-v1, separate from existing 4 | different abstraction level |
| 32 | A — boundary-only logging (6 named decisions) | avoids "log everything" trap |
| 33 | C — text + optional `repair_command` (under 26.3 safety predicate) | text for humans, command for autonomous repair |
| 34 | C — aggregator + real-time writer | closes v1.5 backfill gap AND captures forward |
| 35 | B — registries + frontmatter (no dependency graph) | graph is gilding |

## Schema-without-consumer rule (per ROADMAP-AGENT.md, enforced)

Phases that introduce a new contract/log/lib MUST include ≥1 production caller
as part of the phase's acceptance, NOT "deferred to next phase". Specifically:
- Phase 32 (route-ledger): orchestrator SKILL.md must call `logRouteDecision()` at ≥1 boundary
- Phase 33 (repair_instruction): cockpit Mission Strip Q4 must read it; milestone close must enumerate unresolved
- Phase 34 (review-ledger): codex-exec.sh + Claude reviewer agent must invoke real-time writer
- Phase 35 (system-map): output must be referenced/linked from somewhere live

## Kill / defer conditions

- Defer envelope adoption beyond 5 commands until Phase 34 ledger validates
- Kill route logging if first 10 rows show no signal value (revisit in v1.8)
- Defer system-map auto-deletion of manual catalogs to v2.1 docs refresh
