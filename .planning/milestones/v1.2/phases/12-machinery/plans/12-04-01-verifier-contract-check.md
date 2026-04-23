# 12-04-01 Verifier Contract Check (A2 Resolution)

**Task:** 12-04-01
**Date:** 2026-04-22

---

## Agent File Path

`C:\Users\jack.berrow\GSDedits\custom-gsd-extract\claude-agents\gsd-verifier.md`

The gsd-verifier agent definition is at `custom-gsd-extract/claude-agents/gsd-verifier.md`.
There is no `super-gsd/agents/gsd-verifier.md` — the agent lives in the custom-gsd-extract path.

---

## Pre-edit STATUS Vocab

The gsd-verifier does NOT emit `STATUS:` header lines in the format assumed by D-13b.

The actual output contract (from `<output>` section of gsd-verifier.md) is:

- **VERIFICATION.md frontmatter `status` field:** `passed | gaps_found | human_needed`
- **Return message:** `## Verification Complete` → `**Status:** {passed | gaps_found | human_needed}`

The Step 9 decision tree in gsd-verifier.md defines exactly three status values:
1. `gaps_found` — when truths fail, artifacts missing/stub, blockers found
2. `human_needed` — when Step 8 produces human verification items
3. `passed` — all truths verified, no blockers, no human items

**The assumed vocabulary `PASS | PASS-WITH-DEVIATIONS | PASS-WITH-GAPS | FAIL` does NOT exist.**

---

## Post-edit STATUS Vocab (A2 Deviation Resolution)

**No edit was made to the gsd-verifier agent file.** The vocabulary mismatch requires a
semantic mapping rather than adding a new status value, because `PASS-WITH-GAPS` would
conflict with the existing `human_needed` / `gaps_found` semantics already defined.

**Mapping applied in SKILL.md Step 9.6 (D-13b semantics adapted to actual vocab):**

| D-13b (assumed) | Actual gsd-verifier vocab | SKILL.md Step 9.6 handling |
|-----------------|--------------------------|---------------------------|
| `STATUS: PASS` | `status: passed` | Log `verifier_adversarial_agreement: true` |
| `STATUS: PASS-WITH-DEVIATIONS` | `status: passed` (with deviations in body) | Also maps to agreement log |
| `STATUS: PASS-WITH-GAPS` | `status: human_needed` (needs human, soft concerns) | Promote phase verdict; append `## Adversarial Challenge` |
| `STATUS: FAIL` | `status: gaps_found` | Auto mode: log VERIFIER_ADVERSARIAL_FLIP CRITICAL; interactive: STOP |

**Rationale:** The SKILL.md Step 9.6 section uses D-13b's original label names as the
greppable markers (per plan output_contract), but the prose documents the actual gsd-verifier
vocab mapping. This satisfies both the greppable invariants and the actual runtime behavior.

**DEVIATION from A2:** A2 assumed `PASS-WITH-GAPS` was a pre-existing STATUS value or
could be added in ≤5 LOC. The actual situation is the verifier uses a completely different
vocabulary. The SKILL.md Step 9.6 maps D-13b intent to actual vocab — no agent file edit
needed or appropriate.

---

## Dual-gate Decision

Per 12-RESEARCH.md §Open Question 2, Step 9.6 gates on:

```javascript
config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate
```

This matches the Step 9.5 dual-gate pattern (config kill-switch + probabilistic roll).
The `config.atc.enabled` guard ensures MACH-04 is disabled alongside all other ATC
features when the operator sets `atc.enabled: false`.

The `verifier_adversarial_rate: 0.2` default is now in `.planning/config.json` inside
the `atc` block, preserving all existing fields (enabled, classify_model, tier thresholds).

---

## Summary

- A2 assumption: **DOES NOT HOLD** — actual vocab is `passed | gaps_found | human_needed`
- Resolution: Semantic mapping in SKILL.md Step 9.6 prose (no agent file edit)
- config.json: **UPDATED** — `atc.verifier_adversarial_rate: 0.2` added
- Dual-gate: **CONFIRMED** — `config.atc.enabled && Math.random() < rate`
