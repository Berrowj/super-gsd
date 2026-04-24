# Phase 17: Debt Sweep — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 17-debt-sweep
**Milestone:** v1.4 Clean Close + Codex Visibility
**Areas discussed:** Wave grouping, v1.2 tag target, codex_timeout tier discriminator

---

## Gray Area 1: Wave grouping for 3 plans

| Option | Description | Selected |
|--------|-------------|----------|
| A) By category | 17-01 Code debt (CLEAN-01+02) / 17-02 Process debt (CLEAN-03+04+05) / 17-03 Milestone ceremony (CLEAN-06+07) | ✓ |
| B) By blast radius | Tiny / medium / large grouping | |
| C) One plan per item | 7 atomic plans, highest discipline | |

**User's choice:** A — by category
**Notes:** Clean review scope per plan. 17-01 is pure bug fixes, 17-02 pure docs backfill, 17-03 has config + ceremony work. Serialize 17-03 after 17-01 because both may touch codex-exec.sh.

---

## Gray Area 2: CLEAN-06 — What commit gets `git tag v1.2`?

| Option | Description | Selected |
|--------|-------------|----------|
| A) Last commit before Phase 14 started | Safest/most accurate — tag `0191168` (last commit before `e74a763` which is Phase 16's seed / first v1.3 commit) | ✓ |
| B) Fresh retroactive empty commit | Create `chore: v1.2 closed retroactively` empty commit, tag it | |
| C) Arbitrary v1.2-era commit | e.g., the Phase 13 phase-close commit | |

**User's choice:** A — last commit before Phase 14 started
**Notes:** `git log --oneline e74a763~1 -1` confirmed target = `0191168 chore(roadmap): add Phase 16 VTP Enrichment to v1.3 staging`. Gives v1.2 a clean boundary without inventing empty commits.

---

## Gray Area 3: CLEAN-07 — How does the timeout tier get chosen at runtime?

| Option | Description | Selected |
|--------|-------------|----------|
| A) Step-name fallback only | codex-exec.sh reads `--step` arg and maps to tier internally | |
| B) Explicit --timeout-tier flag only | Caller decides tier, orchestrator passes it explicitly | |
| C) Both (step-name fallback + explicit override) | Default behavior from step-name; explicit flag overrides when needed; `custom:N` allows one-off override | ✓ |

**User's choice:** C — both mechanisms
**Notes:** Maximum flexibility. Default case (step-name mapping) handles all in-tree call sites without caller changes. Explicit `--timeout-tier` flag supports ad-hoc tuning and edge cases. `custom:N` format allows one-off numeric overrides without adding new tier keys. Precedence: explicit custom > explicit tier > step-name mapping > legacy codex_timeout_seconds fallback.

---

## Claude's Discretion

- Exact wording of v1.2 tag annotation message
- Exact JSDoc rewrite prose in CLEAN-01 providers-registry.cjs
- Exact shape of P5-SPEC.md (follows super-gsd phase-artifact conventions)

## Deferred Ideas

- Phase 18 CXOPS-02 contract validator (parse_failure fallback) — not Phase 17 scope
- MC tiles for Phase 17 activity — that's Phase 19
- Third-provider support (Gemini, local) — deferred beyond v1.4
- Per-project provider override — deferred beyond v1.4
- Codex on classifier/executor/primary verifier — scope-disciplined out

## Discussion metadata

- Gray areas identified: 3
- Gray areas discussed: 3 (100%)
- Areas presented in single-batch format (efficiency due to heavy session context)
- No scope creep surfaced during discussion
- No prior phase conflicts surfaced
- Answer format: compact `1-A / 2-A / 3-C` single-line response
