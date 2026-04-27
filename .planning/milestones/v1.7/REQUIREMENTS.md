---
milestone: v1.7
name: Stable Command Contracts And Route Intelligence
status: active
created: 2026-04-27
---

# v1.7 Requirements

## Mission

Standardize command output so the cockpit, orchestrator, gates, and milestone
close consume the same shape instead of bespoke prose. Wire the orchestrator's
route decisions into the canonical review ledger that closes the v1.5
empty-baseline kill-check gap. Generate a deterministic system map from
registries + frontmatter that supersedes hand-maintained handbook tables.

## ENVELOPE lane (Phase 31)

- [ ] **ENV-01** JSON schema published: status / reason_codes / artifacts / evidence / next_action / risk / duration_ms / run_id / phase / milestone
- [ ] **ENV-02** ≥5 high-value commands documented as envelope emitters or candidates
- [ ] **ENV-03** Schema reconciles with the 4 existing contracts (no level overlap)
- [ ] **ENV-04** Mission Strip + dashboards parse envelope without bespoke regex

## ROUTE lane (Phase 32)

- [ ] **ROUTE-01** `.planning/metrics/route-decisions.jsonl` writer module with --self-test
- [ ] **ROUTE-02** 6 boundary types: milestone_promotion, phase_dispatch_first, executor_choice, gate_skip, codex_route, handoff_decision
- [ ] **ROUTE-03** Orchestrator (sgsd-orchestrate SKILL.md) invokes `logRouteDecision()` at ≥1 boundary in production
- [ ] **ROUTE-04** Rows include phase + milestone + reason_codes + outcome + linked artifacts

## REPAIR lane (Phase 33)

- [ ] **REPAIR-01** Every blocking-gate row in `gates.yaml` has `repair_instruction:` text
- [ ] **REPAIR-02** Optional `repair_command:` allowed under DISCUSS 26.3 4-AND predicate (deterministic AND safe AND local AND auth-free)
- [ ] **REPAIR-03** Schema-load checker rejects `repair_command:` violating the predicate
- [ ] **REPAIR-04** Mission Strip Q4 lane surfaces repair_instruction; milestone close lists unresolved repairs

## LEDGER lane (Phase 34)

- [ ] **LEDGER-01** Aggregator over per-phase `commit-reviews.jsonl` → `.planning/metrics/review-ledger.jsonl`
- [ ] **LEDGER-02** Real-time writer wired into `codex-exec.sh` + Claude reviewer (path-identical to existing per-phase writes)
- [ ] **LEDGER-03** `--kill-check` flag returns `baseline_ok` when ledger non-empty; `empty_baseline` otherwise (closes v1.5 gap)
- [ ] **LEDGER-04** Mission Strip + dashboard read the canonical ledger

## MAP lane (Phase 35)

- [ ] **MAP-01** `super-gsd/tools/system-map/generate.cjs` reads agents.yaml + gates.yaml + review-providers.yaml + board-members.yaml + skills/*/SKILL.md frontmatter + scripts/* headers
- [ ] **MAP-02** Output: SYSTEM-MAP.json (machine-readable) + SYSTEM-MAP.md (rendered)
- [ ] **MAP-03** Deterministic — same input → same output (modulo `generated_at`)
- [ ] **MAP-04** Replaces ≥1 hand-maintained handbook catalog (deprecation note added)

## Phase Map

| Phase | Reqs | Type |
|------:|------|------|
| 31 | ENV-01..04 | docs+schema |
| 32 | ROUTE-01..04 | code (lib + orchestrator wire) |
| 33 | REPAIR-01..04 | config + checker code |
| 34 | LEDGER-01..04 | code (aggregator + writer + wire) |
| 35 | MAP-01..04 | code (generator) |

## Phase Dependencies

```
31 → {32 ∥ 33 ∥ 34} → 35
```

31 first (envelope schema is the fifth-contract anchor).
32, 33, 34 can run in any order — independent.
35 last — generates a system map that includes the new contracts/registries from 31-34.

## Kill / Defer Conditions

- Defer envelope adoption beyond 5 commands until Phase 34 ledger validates the shape
- Kill route logging if first 10 rows show no signal value
- Defer system-map auto-deletion of manual catalogs to v2.1
- Hard stop if any new contract collides with the 4 existing — escalate to operator
