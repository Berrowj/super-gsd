---
phase: "152"
slug: kb-triage-shadow
milestone: v3.6-vtp-bridge
verdict: PASS
verified_by: orchestrator (independent) + codex spec-compliance review
date: 2026-08-12
---

# P152 Verification — KB-Triage Shadow Classifier

## Verdict: PASS

Text-free shadow classifier that records whether a KB-directed prompt WOULD route
to `vtp-query-triage`, firing nothing and injecting nothing. Built as the
measurement instrument that gates any future hard gate (28-day locked metric).

## Task evidence

| Task | Deliverable | Status |
|---|---|---|
| T1 | Frozen self-invocation baseline (read-only snapshot + sha256 of the VTP-owned skill) | ✅ `355f174` |
| T2 | `shadow` enforcement kind + `kb-lookup-triage` route + text-free ledger + self-test | ✅ `acc58f4`, fixed `5e32325` |
| T3 | Locked promote-or-kill metric doc (`KB-TRIAGE-SHADOW.md`) | ✅ `97ae7a7`, clarified `852ecd7` |

## Independent verification (not the executor's summary)

- `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` → **exit 0** (pass)
- `node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test` → **exit 0, 10 pass / 0 fail**
- `node -e "require('...sgsd-intent-classifier.cjs')"` → **no throw**

### Behavioral safety proof (live prompts through the classifier)

| Prompt | Injected to model | Shadow fired |
|---|---|---|
| "what did Ada say about **fixing** the customs flow" | `[]` (nothing) | ✅ yes (strong KB beats `fix`) |
| "**fix** the failing test" | `[]` | ❌ no (no KB positive) |
| "**fix** - what did Ada say about the last meeting" | `[]` | ✅ yes (strong KB overrides start-anchored verb) |
| "**fix** the meeting notes" | `[]` | ❌ no (weak positive suppressed by leading verb) |

- **Zero prompt injection** on every prompt (the safety-critical invariant).
- **Text-free ledger**: rows carry exactly `{ts, decision_id(uuid), matcher_version,
  matched_signature_ids, soft_path_action, latency_ms, operator_label}`; a grep for
  every prompt word found nothing. `matched_signature_ids` = route ids only.

## Design-invariant audit (diff-level)

- `shadow` NOT in `CLASSIFIER_ENFORCEMENT_KINDS` (cannot inject).
- `validateRouteShape` shadow branch forbids `directive`, sets `classifierUsable=false`.
- `evaluateShadowRoutes` has no `safeStdout`; fire-and-forget; wired non-blocking.
- Shared `matchesRoute` (exclusion-beats-trigger) correctly NOT reused; isolated
  tiered matcher instead.

## Spec-compliance review (Codex gpt-5.6-sol, independent)

Checks 1–5 (no injection / privacy / text-free / tiering / scope) all **PASS**.
Initial **NOGO** on measurement findings — all resolved in `5e32325`:
- Governance yaml was parsed twice per prompt → now one cached parse per (path,mtime)
  shared by injection path + shadow evaluator (removes hot-path overhead on every prompt).
- `latency_ms` excluded uuid+serialize → now measured entry→serialization (valid for
  the p95 promote threshold).
- Redundant double try/catch collapsed; explicit start-anchored precedence tests added.

## Scope honored (board + 2× Codex challenge)

Built: shadow only. NOT built (deferred): hard gate, `/triage` alias, raw-query
logging, KB entity lookup in the trigger, any edit to the VTP-owned skill. Hard gate
deferred to 28-day locked metric (≥20 fires, FP≤5%, ≥5 incremental catches,
catches/TP≥20%, p95≤1ms) — else kill.
