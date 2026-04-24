---
phase: 15
phase_name: Codex-Routed Gates + Qualitative MUDA Probe
generated: 2026-04-24
plans_count: 5
waves: 4
vtp_mode: REAL
vtp_query_frame: qf_08971fd9c2
---

# Phase 15 — Plan Index

Five v2-schema plans deliver CODEX-07..CODEX-12, with the switch flipped:
`sgsd-orchestrate/SKILL.md` Steps 6.5/9.5/9.6 route through the registry,
qualitative MUDA gets a 4th probe, token accounting gains a provider field,
and the milestone-close kill condition lands.

The SKILL.md serialization constraint (Phase 10 W-2 lesson, RESEARCH pitfall 3)
forces plans 15-01/15-04/15-05 into separate waves even though they are
logically independent. Plans 15-02 and 15-03 are file-disjoint and run in Wave 1
to maximise early parallelism.

## Plans

| Plan | Wave | Deliverable (one-line) | Depends on |
|------|------|------------------------|------------|
| [15-01 provider-indirection-wire](./15-01-provider-indirection-wire.md) | 2 | W-1 fix + SKILL.md Steps 6.5/9.5 provider-dispatch branch + gates.yaml flip + W-4 codex-exec.sh fix + config flip | 15-02, 15-03 |
| [15-02 qualitative-muda-probe](./15-02-qualitative-muda-probe.md) | 1 | sgsd-muda-audit.sh 4th probe (CODEX-08) + qualitative-waste-audit gate row + predicate-eval + SKILL.md Step 9.2 ctx field (CODEX-09) | — |
| [15-03 quota-offload-metric](./15-03-quota-offload-metric.md) | 1 | token-log.jsonl provider field + sgsd-token-audit multimodal tile + SKILL.md Step 11 schema update + W-5 doc fix (CODEX-10) | — |
| [15-04 cross-vendor-adversarial](./15-04-cross-vendor-adversarial.md) | 3 | SKILL.md Step 9.6 challenger → always-Codex + skip-on-unavailable path (CODEX-11) | 15-01 |
| [15-05 kill-condition-milestone-wire](./15-05-kill-condition-milestone-wire.md) | 4 | sgsd-token-audit --milestone-close-check + sgsd-complete-milestone step renumber (CODEX-12) | 15-03, 15-04 |

## Wave model (per CONTEXT D-25)

- **Wave 1 (parallel)**: {15-02, 15-03} — fully disjoint file sets.
  15-02 owns `sgsd-muda-audit.sh` + `predicate-eval.cjs` + `gates.yaml` (new row only).
  15-03 owns `sgsd-token-audit/SKILL.md` + `token-log.jsonl` schema doc + `sgsd-orchestrate/SKILL.md` Step 11 (schema comment only — no collision with 15-01's Step 6.5/9.5 edits or 15-04's Step 9.6 edit).
- **Wave 2 (solo)**: {15-01} — primary rewire. Touches `sgsd-orchestrate/SKILL.md`
  Steps 6.5+9.5, `providers-registry.cjs`, `gates.yaml` (reviewer_provider flip),
  `codex-exec.sh` (W-4 fix), `.planning/config.json` (codex_enabled: true).
  Serialized after Wave 1 so executor reads SKILL.md fresh.
- **Wave 3 (solo)**: {15-04} — Step 9.6 adversarial challenger rewire. Serialized
  after 15-01 because both touch `sgsd-orchestrate/SKILL.md`. Each executor must
  read SKILL.md fresh — never from plan-time stale snapshots.
- **Wave 4 (solo)**: {15-05} — milestone-close wire. Depends on CODEX-10 metric
  live (15-03) and SKILL.md Step 9.6 settled (15-04) before touching
  `sgsd-complete-milestone/SKILL.md`.

## ATC Warning Coverage (W-1..W-5)

| Warning | Resolution | Plan |
|---------|-----------|------|
| W-1 `resolveReviewerProvider` haiku-gate gap | Change null-guard to `!gate.reviewer_provider` at providers-registry.cjs:151 | 15-01 T1 |
| W-2 `registry_version` not bumped | Bump `2.0.0 → 2.1.0` + `last_updated` in gates.yaml when adding qualitative-waste-audit row | 15-01 T3 |
| W-3 `invocation_type` typo in plan verification | Plans 15-01/15-02 verification assertions use `g.reviewer_provider` not `g.invocation_type` | 15-01/15-02 (never introduced) |
| W-4 JSONL `--phase` tag unquoted in codex-exec.sh | Add `[[ "$PHASE_TAG" =~ ^[0-9]+$ ]]` validation or quote as string | 15-01 T2 |
| W-5 plan-text drift on `unset OPENAI_API_KEY` | Fix description in SKILL.md Step 11 update | 15-03 T2 |

## CODEX Deliverable Coverage

| Deliverable | Plan | Tasks |
|-------------|------|-------|
| CODEX-07 (provider dispatch indirection, gates.yaml flip, fallback) | 15-01 | T1, T2, T3 |
| CODEX-08 (qualitative MUDA 4th probe) | 15-02 | T1 |
| CODEX-09 (qualitative-waste-audit gate row + ctx field) | 15-02 | T1, T2 |
| CODEX-10 (token-log provider field + dashboard tile) | 15-03 | T1, T2 |
| CODEX-11 (cross-vendor adversarial challenger) | 15-04 | T1 |
| CODEX-12 (milestone-close kill condition) | 15-05 | T1, T2 |

## VTP Evidence Integration

VTP doc-IDs cited across plans:
- **doc:6b62b76ceab5 (AGP-P-04, AGP-P-05, AGP-P-07, AGP-P-08)** — cited in 15-01 (provider dispatch indirection rationale, fallback safety) and 15-05 (lifecycle kill condition).
- **doc:5a50cc9b459e (HiveMind single-retry)** — cited in 15-01 (fallback_max_retries: 1, no retry storms).
- **doc:70a3d5757b6a (Shift-Up dual-vendor)** — cited in 15-04 (cross-vendor adversarial challenger rationale).

## Verify.mjs coverage (D-26)

Phase 15 `verify.mjs` runs 9 invariants (8 required + 1 bonus):

| Inv | Check | Owner plan |
|-----|-------|-----------|
| 1 | `gates.yaml` rows `per-dispatch-ATC` + `phase-level-ATC` declare `reviewer_provider: codex-cli-reviewer` | 15-01 |
| 2 | `gates.yaml` row `qualitative-waste-audit` exists with correct trigger | 15-02 |
| 3 | `sgsd-muda-audit.sh` invokes `codex-exec.sh` when `CODEX_QUAL_ENABLED=true` | 15-02 |
| 4 | `sgsd-orchestrate/SKILL.md` Steps 6.5 + 9.5 reference `resolveReviewerProvider` + shell-invocation branch | 15-01 |
| 5 | `sgsd-orchestrate/SKILL.md` Step 11 schema includes `provider` field | 15-03 |
| 6 | `sgsd-token-audit` emits `claude_tokens_saved_by_codex` on synthetic fixture | 15-03 |
| 7 | `sgsd-orchestrate/SKILL.md` Step 9.6 references non-primary-vendor provider | 15-04 |
| 8 | `sgsd-complete-milestone` includes `--milestone-close-check` in step list | 15-05 |
| 9 (bonus) | `sgsd-token-audit --milestone-close-check --dry-run` exits 0, emits `{"kill": false, ...}` | 15-05 |

`verify.mjs` is authored in plan 15-05 (final wave, all artifacts present).

## Notes for plan-checker

1. **SKILL.md serialization is the dominant wave constraint.** Three plans touch
   `sgsd-orchestrate/SKILL.md` — each in a different step (Step 11 / Steps 6.5+9.5 / Step 9.6 / sgsd-complete-milestone). The wave order ensures each executor reads fresh. Plan-checker must verify no two SKILL.md-touching plans share a wave.
2. **W-1 fix is the gating entry condition.** 15-01 T1 must land first within the
   plan, before any live dispatch path can be exercised. Acceptance criterion A1 enforces this.
3. **config.json `codex_enabled: true` flip is the last action in 15-01.** The
   order within plan 15-01 is: (a) providers-registry.cjs W-1 fix, (b) SKILL.md
   Steps 6.5+9.5 rewire, (c) codex-exec.sh W-4 fix, (d) gates.yaml flip + W-2 bump,
   (e) config.json flip. Per RESEARCH AD-04.
4. **No deviations taken.** All decisions locked in CONTEXT.md D-01..D-27. No
   P-series deviations introduced. RESEARCH AD-01..AD-05 recommendations adopted
   verbatim as specified in each plan.
5. **`mechanical_muda_verdict` is a two-file change.** Both `predicate-eval.cjs`
   (comment registry) and `sgsd-orchestrate/SKILL.md` Step 9.2 must be updated
   in the same plan (15-02) — never split. RESEARCH pitfall 2 enforces this.
