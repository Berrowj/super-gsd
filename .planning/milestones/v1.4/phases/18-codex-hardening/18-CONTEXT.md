# Phase 18: Codex Hardening — Context

**Gathered:** 2026-04-24 (inline from REQUIREMENTS.md + Phase 17 signals — discuss-phase skipped per v1.4 "autonomous except discuss-phase" design invariant; REQ-AC is specific enough to lock decisions directly)
**Status:** Ready for research
**Milestone:** v1.4 — Clean Close + Codex Visibility

<domain>
## Phase Boundary

Harden Codex CLI integration from "works" to "reliable under failure modes." Phase 17 proved Codex works end-to-end (6 invocations, 2 CRITICALs found + fixed, 622.9s wall-clock). Phase 18 adds:

1. **Pre-flight self-check** so milestone readiness catches Codex problems before the first executor burns tokens
2. **Runtime contract validation** so malformed Codex responses fall through to Claude instead of silently propagating garbage
3. **Formal recognition of dogfood evidence** already captured in Phase 17 (CXOPS-03/04)

**4 items in scope (per REQUIREMENTS.md CXOPS-01..04):**
- CXOPS-01: `codex-exec.sh --self-test` flag (probes PATH / auth / timeout math / known-good contract). Exit 0 on pass, non-zero on any failure. Callable from `sgsd-readiness`.
- CXOPS-02: Runtime contract validator in orchestrator. After codex-exec.sh exits 0, parse FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER. On parse fail → GATE_PROVIDER_FALLBACK single-retry to claude-sonnet-reviewer with reason=parse_failure (distinct from timeout/auth/generic).
- CXOPS-03: Dogfood proof — at least one v1.4 phase's commit-reviews.jsonl has a Step 9.5 row with `provider: openai-codex` and valid FINDINGS contract.
- CXOPS-04: Same phase's Step 6.5 phase-level ATC-REVIEW.md authored by Codex with `provider: openai-codex` stamp.

**Retroactive satisfaction (key leverage):** Phase 17 already delivered 6 Codex invocations with 4 per-dispatch ATC rows (2× 17-01, 2× 17-03) + 1 phase-level row (17-phase after retry), all stamped `provider: openai-codex`. CXOPS-03 and CXOPS-04 can be RECOGNISED via evidence aggregation, not re-dogfooded.

**Non-goals:**
- Parse-failure retry in EVERY gate (scope is single-retry at per-dispatch + phase-level only)
- Codex on classifier / executor / primary verifier roles (stays at reviewer-shaped gates only)
- Gemini / third-provider support (deferred beyond v1.4)
- Per-project provider override (deferred)
- Contract output format changes (5-line contract stays; parse-failure is about malformed OUTPUT of that contract, not contract evolution)

</domain>

<decisions>
## Implementation Decisions (locked inline)

### D-01: Wave grouping — 2 plans by work character
- **18-01 Code hardening** (FULL tier): CXOPS-01 `--self-test` + CXOPS-02 parse validator. Both touch codex-exec.sh + SKILL.md. Serialize CXOPS-01 BEFORE CXOPS-02 (self-test baseline first, then runtime hook).
- **18-02 Dogfood recognition** (LITE tier, docs-only): CXOPS-03 + CXOPS-04 evidence aggregation. Produces audit artifact citing Phase 17 evidence, marks REQ-IDs complete. No code changes. LITE → skips per-dispatch ATC.

**Wave order:** 18-01 → 18-02 (dogfood recognition sits last — references Phase 17 evidence + any new evidence 18-01 generates by running).

### D-02: `--self-test` probe set (CXOPS-01)
Match REQ-AC verbatim:
1. `codex` on PATH — `command -v codex` exit 0
2. Auth — `codex auth status` or equivalent silent probe; OAuth token file present (`~/.codex/config.json` or `$CODEX_HOME`); no `$OPENAI_API_KEY` set (would trigger exit 4)
3. Timeout math — call the new tier resolver with synthetic `--timeout-tier review` + `--step per-dispatch-ATC` inputs, confirm resolver returns configured review tier value (120s default)
4. Known-good contract response — run a micro-prompt (the existing smoke test shape: ~400B, returns FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER) against a real Codex call with short timeout (60s). Confirm 5-line parse succeeds.

Exit codes: 0 on all probes pass. Non-zero per-probe: 10 (PATH), 11 (auth), 12 (timeout math), 13 (contract). Caller distinguishes.

Invocation: `bash codex-exec.sh --self-test [--skip-network]` where `--skip-network` runs only probes 1-3 (path + auth + timeout math), skipping the real Codex call for CI/offline.

### D-03: Parse-failure validator placement (CXOPS-02)
Hook lives in **SKILL.md orchestrator dispatch path**, NOT in codex-exec.sh. Reason: codex-exec.sh already parses the 5-line contract internally (exit 6 on contract violation). The orchestrator needs a SECONDARY check in case codex-exec.sh reports exit 0 but the report file itself is malformed (e.g., trailing garbage, missing CRITICAL line that passed contract but failed semantic check).

Orchestrator steps 6.5 + 9.5 gain a `validateContract(reportPath)` call after shellDispatch returns exit 0:
- Read report file
- Re-parse the 5 required fields
- Validate: each field has a numeric/string value matching its contract
- If parse fails → log `GATE_PROVIDER_FALLBACK` with `fallback_reason: "parse_failure"`, single-retry to claude-sonnet-reviewer, proceed as if codex exit was non-zero

Keep existing `fallback_triggered` on-error logic for timeout/auth/generic. Add new row dimension `fallback_reason` (string) alongside.

### D-04: CXOPS-03 + CXOPS-04 evidence recognition (18-02)
18-02 produces a single AUDIT.md under Phase 18 dir referencing:
- CXOPS-03 evidence: `.planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl` rows 1-4 (4× Step 9.5 per-dispatch ATC with `provider: openai-codex`)
- CXOPS-04 evidence: commit-reviews.jsonl row 5 (Step 6.5 phase-level ATC with `provider: openai-codex`) + `17-ATC-REVIEW.md` frontmatter `provider: "openai-codex"` + `gate: "phase-level-ATC"`
- If 18-01's self-test or parse-validator integration runs through any Codex gate during 18-01 execution, THAT evidence is also captured (bonus rows)

No code change, no new feature — pure evidence audit + REQ-ID tickbox. Atomic commit: `audit(18-02): CXOPS-03/04 dogfood evidence — 5 Codex per-dispatch + phase-level rows from Phase 17`

### D-05: Self-test outputs
`--self-test` writes a structured verdict to stdout (human-readable) + appends a provenance row to `.planning/metrics/codex-log.jsonl` with `step: "self-test"`, `exit: <0|10..13>`, probe-level pass/fail breakdown in a new field `self_test_probes: {path, auth, timeout, contract}`.

If `sgsd-readiness` (milestone pre-flight) calls `--self-test --skip-network`, the row still lands — gives operator a log of readiness-check outcomes over time.

### D-06: Parse-failure fallback telemetry
commit-reviews.jsonl rows gain optional `fallback_reason` field when fallback_triggered=true. Existing rows (fallback_triggered=false) unchanged. Gate status row stays single-JSON-per-line format — no schema break.

Expected values: `"timeout"` (codex-exec exit 5), `"auth"` (exit 4), `"parse_failure"` (codex-exec exit 0 but validateContract failed), `"generic"` (any other non-zero exit).

### Claude's Discretion
- Exact bash idiom for the `--self-test` probe harness (case statement vs if-else chain)
- Exact Node/JS idiom for validateContract in SKILL.md shellDispatch wrapper
- AUDIT.md artifact layout (follow Phase 17 17-ATC-REVIEW.md shape, scaled up for 2 REQ-IDs)
- Whether to bump `fallback_max_retries` from 1 to 2 if parse failures prove flaky (NOT in scope — D-03 says single-retry)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §CXOPS-01..04 — acceptance criteria verbatim
- `.planning/ROADMAP.md` §"Phase 18: Codex Hardening" — phase structure + dependencies
- `.planning/milestones/v1.4/phases/17-debt-sweep/17-ATC-REVIEW.md` — dogfood evidence reference for 18-02

### Source files in scope (18-01)
- `super-gsd/scripts/codex-exec.sh` — CXOPS-01 target (add `--self-test` + `--skip-network` flags, probe harness)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — CXOPS-02 target (validateContract call in Step 6.5 + 9.5 shellDispatch wrapper)
- `.planning/config.json` `review_providers.fallback_on_error` — already `true`, no change needed; new `fallback_reason` is row-level not config-level

### Source files in scope (18-02)
- `.planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl` — source of CXOPS-03/04 evidence
- `.planning/milestones/v1.4/phases/17-debt-sweep/17-ATC-REVIEW.md` — phase-level frontmatter reference for CXOPS-04

### Step-name tier calibration (deferred from Phase 17)
- Phase 17's phase-level ATC timed out at 120s (review tier) on a 46-line prompt / 28-file scope. CXOPS-01 self-test should include tier calibration validation as probe #3.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **codex-exec.sh arg parser** already handles `--project / --phase / --plan / --step / --timeout-tier / --prompt-file / --report-out / --dry-run`. Adding `--self-test / --skip-network` is consistent.
- **codex-log.jsonl append_jsonl function** already exists in codex-exec.sh — self-test can reuse it with `step: "self-test"`.
- **SKILL.md shellDispatch wrapper** at Steps 6.5 + 9.5 already reads the report file after exit 0. Adding validateContract is a 20-line addition per call site.
- **commit-reviews.jsonl row schema** is open (Node appends freely) — adding `fallback_reason` is additive.

### Established Patterns
- **Atomic commit per task:** `fix(18-NN/TX): ...` or `feat(18-NN/TX): ...`
- **Node read-mutate-write for config/metrics:** never cat/head/echo per feedback_never_head_settings rule
- **Shell set -u:** codex-exec.sh uses it; --self-test code must maintain

### Integration Points
- `sgsd-readiness` (milestone pre-flight, per SKILL.md Step 0) — becomes caller of `--self-test --skip-network` if codex_enabled=true. Need to update sgsd-readiness script OR leave unwired for this phase (defer wiring to Phase 19 MC work which touches mission-control scripts anyway).
- Phase 17 retroactive evidence: 5 commit-reviews.jsonl rows + 17-ATC-REVIEW.md artifact. 18-02 references them, does not move/modify.

</code_context>

<specifics>
## Specific Ideas

- Operator wants "clean close" — every CXOPS item must have verifiable evidence. 18-02's AUDIT.md is the compliance artifact.
- Phase 17's Codex signals that got deferred (awk brittleness, step-name tier calibration, richer output contract, dual-gate timeout policy, MUDA probe flat-path bug) are ALL Phase 18 scope-adjacent. Keep 18 focused on the 4 CXOPS items; file the 5 others as Phase 19 MC + calibration follow-ups. DO NOT scope-creep Phase 18.
- If 18-01's code changes trigger per-dispatch ATC via Codex (they will — touches codex-exec.sh + SKILL.md = FULL tier), that run serves as LIVE-FIRE validation of the NEW parse validator (does it handle its own review cleanly?).

</specifics>

<deferred>
## Deferred Ideas

- **Multi-retry parse-failure** — D-03 locks single-retry, consistent with existing fallback_max_retries: 1. Escalating only on repeated failures is future work.
- **Schema-validation of contract fields** (e.g. FINDINGS must be integer, PASS_RATE must match N/M regex) — current validator checks presence only. Deeper schema validation is future CXOPS-05 scope if needed.
- **Self-test as scheduled cronjob** — manual invocation only for v1.4.
- **Codex on non-reviewer roles** — scope-disciplined out.
- **Richer output contract (extended FINDINGS detail lines)** — filed at Phase 17 close, deferred here.

</deferred>

---

*Phase: 18-codex-hardening*
*Milestone: v1.4 Clean Close + Codex Visibility*
*Context gathered: 2026-04-24 (inline — no discuss-phase run)*
