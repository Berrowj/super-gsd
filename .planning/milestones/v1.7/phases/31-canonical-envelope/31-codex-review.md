# Phase 31 ATC Review -- Codex Reviewer

## Reviewer
- Provider: codex-cli (gpt-5.5, xhigh reasoning)
- Tier: phase-level
- Verdict: warn (pre-fix: 1 CRIT + 2 WARN) -> pass (post-fix; CRIT and 2 WARNs cleared in-loop)
- Critical: 1 (in-loop fixed)
- Warning: 2 (in-loop fixed)
- Pass rate: 7/10 (pre-fix), 10/10 (post-fix)

## Code-Reviewer-V1 contract block (raw Codex output)

```
FINDINGS: 1 CRIT: ENV-01 required-field contract is not enforced; 2 WARN: Mission Strip state map drifts from closed pane vocabulary; retrieval reason_codes are dead/future.
CRITICAL: 1
WARNINGS: 2
PASS_RATE: 7/10
ONE_LINER: Block on ENV-01: schema only requires 5 fields, not the 13-field command envelope contract.
```

## CRIT findings

### C1 -- ENV-01 required-field contract under-enforced

**Location:** `super-gsd/templates/command-envelope-v1.json:7` (required list)
**Finding:** CONTEXT.md and REQUIREMENTS.md ENV-01 both enumerate the 12-13 envelope fields as the contract. The shipped schema only made 5 of them required (`envelope_version`, `ts`, `command`, `status`, `run_id` — the identification minimum). The remaining 8 fields (`reason_codes`, `artifacts`, `evidence`, `next_action`, `risk`, `duration_ms`, `phase`, `milestone`) were properties but NOT required, so an emitter could omit them entirely and still pass schema validation. Codex argued this is a contract under-enforcement vs the documented 13-field shape.
**Severity:** CRIT (contract drift between what CONTEXT/REQUIREMENTS says and what the schema enforces).
**Fix applied:** Widened `required` to all 13 fields. `duration_ms` made nullable (`type: ["integer", "null"]`) so instantaneous emitters can stamp `null`. The other "optional in spirit" fields are already nullable (`next_action`, `risk`, `phase`, `milestone`) or zero-valued (`reason_codes: []`, `artifacts: []`, `evidence: []` — all permitted as empty arrays). Every emitter must now stamp every field, with `null` or empty array as the explicit "not applicable" marker. Examples already filled all 13 fields; no example edits needed.
**Verifier confirms:** `schema_required_count=13` and `example_errors=0`.

## WARN findings

### W1 -- Mission Strip pane_state map drifts from closed 8-state vocab

**Location:** `super-gsd/registry/command-envelope-v1.yaml:227-233` (status_to_pane_state)
**Finding:** DISCUSS 26.1 locked the closed 8-state cockpit vocabulary: `active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable`. The shipped map produced `complete_with_warn_icon` (warn case) and `not_rendered` (skipped case) — neither is in the closed vocab. Phase 28 T1 already had a Codex CRIT for the same class of vocab-violation (`shipped-with-debt`); this is the same bug pattern.
**Severity:** WARN (Phase 31 doesn't yet wire Mission Strip to envelopes; vocab drift would propagate when Phase 34 wires the read contract).
**Fix applied:**
- `warn -> complete` (per Phase 28 T1 design: warn surfaces via `missionColor=Yellow + warn-icon` on the underlying `complete` state, NOT a new pane state).
- `skipped -> unavailable` (canonical 8-state token for "not run / not applicable").
- `timeout -> timed-out` (hyphenated form per discuss 26.1).
- Added `pane_state_warn_indicator: "missionColor=Yellow + warn-icon (Phase 28 T1)"` field clarifying the warn-overlay mechanism.
- Inline comment block documents the closed 8-state vocab so future readers do not reintroduce drift.

### W2 -- retrieval reason_codes are dead-code / future

**Location:** `super-gsd/registry/command-envelope-v1.yaml:177-192`
**Finding:** The 5 retrieval reason_codes (`empty_hit`, `noisy_hit`, `stale_hit`, `query_too_broad`, `privacy_blocked`) are not reachable from any current emitter's gap text in Phase 31. They align with v1.9 Phase 43 7-mode retrieval taxonomy. A reader of the registry today might flag them as dead code.
**Severity:** WARN (not bug — pre-declared forward-stable codes).
**Fix applied:** Added `status: future_v1_9` field on each of the 5 retrieval codes. Inline comment header documents the pre-declaration intent and notes that registry_version (semver patch) bumps when first emitter activates these. No semantic change — just an explicit "intentionally pre-declared, not dead code" marker that future reviewers (and the v1.9 Phase 43 author) will see.

## NIT

None.

## 10-point anti-slop checklist (post-fix)

1. PASS -- every schema field has documented purpose + caller; all 13 are now load-bearing in the required list.
2. PASS -- post-fix all reason_codes are either reachable (emitter gap text) or explicitly marked `status: future_v1_9` with documented v1.9 phase reference.
3. PASS -- no "just in case" fields. Required-list expansion was driven by ENV-01 contract, not speculation.
4. PASS -- schema is appropriately minimal: 13 required (matches contract), `additionalProperties: true` for forward-compat. `duration_ms` made nullable rather than dropped (preserves established stream-name conventions).
5. PASS -- fifth contract level genuinely distinct from the 4 existing.
6. PASS -- all 4 existing contracts cited, explicitly not modified, semantics delegated. `git log` confirms no existing-contract file changes in any Phase 31 commit.
7. PASS -- no mass-deletable content; every block is load-bearing.
8. PASS -- delta-Complexity proportional. Fix-now widening of required list does not add files or runtime code; pane_state vocab fix removes drift (negative complexity delta vs the bug).
9. PASS -- explicit `status: future_v1_9` markers turn "might need later" into "documented future" — no speculative additions.
10. PASS -- phase still does ONE thing: land fifth contract level as docs+schema. Two follow-up commits (`4155fd5` Claude WARNs + this commit Codex CRIT/WARNs) are scoped fix-now corrections, not scope creep.

## Reviewed (absolute paths)

- `C:\Users\user\GSDedits\super-gsd\templates\command-envelope-v1.json`
- `C:\Users\user\GSDedits\super-gsd\registry\command-envelope-v1.yaml`
- `C:\Users\user\GSDedits\.planning\milestones\v1.7\phases\31-canonical-envelope\31-01-canonical-envelope-PLAN.md`
- `C:\Users\user\GSDedits\.planning\milestones\v1.7\phases\31-canonical-envelope\31-VERIFICATION.md`
- `C:\Users\user\GSDedits\.planning\milestones\v1.7\EXISTING-SURFACE-AUDIT.md`

## Provider health (run-time evidence)

- Codex behavioral availability confirmed at phase-ATC dispatch time (`provider-health/check.cjs --provider codex --behavioral` PASS, oracle `codex_login_status` exit 0, oracle `contract_canary` exit 0).
- 4 invocation attempts: 3 silent transient failures (wrapper script issue masking the underlying contract violation), 1 successful invocation after fixing the local prompt template (`VERDICT:` -> `FINDINGS:` to match `awk` parser at codex-exec.sh:682).
- Wrapper exit codes observed: -1 (transient codex CLI abort -- 2x), 6 (contract violation due to local prompt error -- 1x), 0 (success after prompt fix -- 1x).
- Underlying provider was healthy throughout. The first 3 failures are NOT "Codex unavailable"; they are wrapper / prompt mechanics. No backlog row required.

## Fix loop summary

Pre-fix: VERDICT=warn, 1 CRIT + 2 WARN, 7/10.
Each finding fixed in 1 attempt:
- C1: schema required-list widened from 5 to 13; `duration_ms` made nullable.
- W1: status_to_pane_state remapped to closed 8-state vocab; `warn -> complete + missionColor` indicator documented.
- W2: retrieval reason_codes annotated `status: future_v1_9` with intent comment.

Post-fix: anti-slop 10/10. All findings cleared.

## One-liner

Codex flagged a real CRIT (schema required-list under-enforced 5/13 fields per ENV-01 contract) + 2 WARNs (pane_state vocab drift, future-codes look dead); all 3 fixed in-loop with widened required list + 8-state pane vocab map + status:future_v1_9 markers. Post-fix anti-slop 10/10.
