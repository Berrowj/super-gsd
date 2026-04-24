---
phase: 14
phase_name: Codex CLI Provider Substrate
verified: 2026-04-23T23:59:00Z
verifier: gsd-verifier (goal-backward, Opus)
status: passed
score: 6/6 predicates verified
verify_mjs_exit: 0
verify_mjs_invariants: 6/6 green
vtp_mode: BYPASSED
re_verification: false
---

# Phase 14 — Codex CLI Provider Substrate — VERIFICATION

## 1. Verdict

**PASS.** Phase 14's promised goal — a reviewer-provider abstraction that lets any `gates.yaml` row route review to Claude OR Codex without the gate layer caring which is running, shipping dark with `codex_enabled: false` — is delivered. All 6 goal-backward predicates (V1..V6) evaluate TRUE against committed code. All 7 non-goal constraints hold. The mechanical verifier `.planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/verify.mjs` exits 0 with all 6 D-23 invariants green.

The substrate is in place; Phase 15 has a clean surface to wire routing on top of without architectural surprises.

## 2. Goal statement under test

From `14-CONTEXT.md:12`:

> "Phase 14 ships the reviewer-provider abstraction that lets any gates.yaml row route code review to Claude OR Codex without the gate layer caring which is running. Phase 14 ships dark — codex_enabled: false."

Decomposed into six falsifiable predicates V1..V6 plus non-goal compliance.

## 3. Predicate results

### V1 — The abstraction EXISTS: gates row → registry bridge → provider record

**Status: PASS.**

Evidence:

- `super-gsd/registry/gates.yaml:53` declares `reviewer_provider: claude-sonnet-reviewer` on `per-dispatch-ATC`.
- `super-gsd/registry/gates.yaml:67` declares `reviewer_provider: claude-sonnet-reviewer` on `phase-level-ATC`.
- `super-gsd/registry/review-providers.yaml` exists (`ls -la` confirms 2357 bytes, 2026-04-24). Schema_version 1, registry_version 1.0.0.
- Two provider rows, both `state: active`:
  - `claude-sonnet-reviewer` — `invocation: agent`, `agent_subagent_type: sgsd-code-reviewer`, `report_contract: code-reviewer-v1` (lines 42-49).
  - `codex-cli-reviewer` — `invocation: shell`, `shell_script: super-gsd/scripts/codex-exec.sh`, `report_contract: code-reviewer-v1`, `fallback_to: claude-sonnet-reviewer` (lines 51-59).
- `super-gsd/scripts/lib/providers-registry.cjs:149-156` exports `resolveReviewerProvider(gateName, gatesRegistry, opts)`:
  1. Reads gate row via `gatesRegistry.getGate(gateName)`.
  2. Returns `null` if gate has no `reviewer_agent` (not reviewer-shaped).
  3. Reads `gate.reviewer_provider` OR falls back to `config.review_providers.default_provider`.
  4. Looks up that provider via `getProvider(name)` and returns the full record.
- `getProvider(name)` (lines 94-99) throws on unknown name — D-06a typo catch at cold-start.

Manual call-path trace: `gates.yaml` row → `gates-registry.getGate(name)` → provider name string → `providers-registry.getProvider(name)` → provider record (including `invocation` discriminator + `shell_script` OR `agent_subagent_type`) returned to caller. Clean one-way import, no circular dependency (P1 deviation correctly implemented).

### V2 — The abstraction is TRANSPARENT to the gate layer (no provider branching)

**Status: PASS.**

Evidence:

- `grep -n -E "reviewer_provider|invocation_type|codex-cli|codex-exec" super-gsd/scripts/lib/predicate-eval.cjs` → **zero matches**. Predicate evaluation is untouched (D-10a held).
- `grep -n -E "reviewer_provider|invocation_type|codex-cli|codex-exec" super-gsd/scripts/lib/gates-registry.cjs` → **zero matches**. Gates registry reads `reviewer_agent` + `reviewer_provider` as opaque strings; it does not know what the values mean semantically.
- `grep -rn "resolveReviewerProvider" super-gsd/ --include="*.md" --include="*.cjs" --include="*.mjs" --include="*.sh"` (excluding `providers-registry.cjs` itself) → **zero production callers**. The bridge exists but no Phase-14 code branches on it yet. This is the correct Phase-14 shape: substrate is in place, Phase 15 will wire the orchestrator call sites.
- `sgsd-orchestrate/SKILL.md` Steps 6.5 / 9.5 / 9.6 hardcode `Agent(subagent_type: "gsd-code-reviewer" ...)` and `Agent(subagent_type: "gsd-verifier" ...)` directly (SKILL.md:474, 837, 913). These hardcoded dispatches were NOT modified (D-11 held) — the orchestrator remains a pure Claude-via-Agent() dispatcher. Phase 15 will replace the hardcoded subagent_type with `resolveReviewerProvider(...)` + invocation-type branching.

The gate layer's ignorance of provider identity is exactly the transparency contract: it does not branch on `invocation_type` because it does not inspect it. The bridge method returns a record; Phase 15 will teach one caller to read it.

### V3 — Phase 14 ships DARK

**Status: PASS.**

Evidence:

- `.planning/config.json` `review_providers` block (verified via `node -e` extraction):
  ```json
  {
    "default_provider": "claude-sonnet-reviewer",
    "codex_enabled": false,
    "codex_cli_path": "auto-detect",
    "codex_timeout_seconds": 30,
    "fallback_on_error": true,
    "fallback_max_retries": 1
  }
  ```
  `codex_enabled: false` is the kill-switch (D-18b).
- `grep -rn 'codex-exec' super-gsd/skills/sgsd-orchestrate/` → **0 matches**.
- `grep -rn 'codex-cli-reviewer' super-gsd/skills/sgsd-orchestrate/` → **0 matches**.

No orchestrator code routes to Codex today. If a hypothetical gate row set `reviewer_provider: codex-cli-reviewer`, nothing would happen — the orchestrator still dispatches via hardcoded `Agent(subagent_type: "gsd-code-reviewer", ...)`. Substrate-only ships correctly.

### V4 — Provider contracts are IDENTICAL (`code-reviewer-v1`)

**Status: PASS.**

Evidence:

- `super-gsd/agents/sgsd-code-reviewer.md` frontmatter declares `report_contract: code-reviewer-v1` (line 8).
- `super-gsd/agents/sgsd-codex-reviewer.md` frontmatter declares `report_contract: code-reviewer-v1` (line 8).
- `super-gsd/registry/review-providers.yaml:46` and `:55` both declare `report_contract: code-reviewer-v1`.
- Five-field harness parser in `super-gsd/tools/provider-contract/contract-check.mjs` asserts FINDINGS + CRITICAL + WARNINGS + PASS_RATE + ONE_LINER on both fixtures.
- `codex-exec.sh` awk parser (lines 245-263) extracts the same 5 fields from `codex exec` stdout; exits 6 on any missing.
- Live harness run: `node contract-check.mjs --claude-report fixtures/claude-report.txt --codex-report fixtures/codex-report.txt` → **exit 0**, both fixtures parse cleanly, divergence surfaces correctly (CRITICAL=1 matches on both; WARNINGS differ 2 vs 3, PASS_RATE differs 60% vs 50%, flagged informationally per D-15a).

Five-field contract agreement across registry + two agent stubs + wrapper parser + harness = end-to-end contract identity.

### V5 — Auth hygiene HOLDS (OAuth-only refuse-to-run)

**Status: PASS.**

Evidence (live test):

```
$ OPENAI_API_KEY=x bash super-gsd/scripts/codex-exec.sh --prompt-file /dev/null --report-out /tmp/out.txt
codex-exec: ERR — codex-exec is OAuth-only per D-02/D-02a; unset OPENAI_API_KEY before invoking.
$ echo $?
4
```

Exit code 4 matches D-02a spec exactly. The check (`codex-exec.sh:73-77`) fires BEFORE any other validation (before prompt-file existence, before `codex` binary detection, before root detection), which is the correct fail-loud placement — no chance of silently burning API credits.

### V6 — Mechanical verifier passes all 6 D-23 invariants

**Status: PASS.**

Evidence (live run):

```
$ node .planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/verify.mjs
PASS Phase 14 (6/6 invariants green)
$ echo $?
0
```

The 6 D-23 invariants covered:

| # | Invariant | Status |
|---|-----------|--------|
| 1 | `codex-exec.sh` exists, executable, `bash -n` clean | green |
| 2 | `review-providers.yaml` parses YAML; both providers `state: active` | green |
| 3 | `gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC` declare `reviewer_provider: claude-sonnet-reviewer` | green |
| 4 | `sgsd-codex-reviewer.md` exists with required frontmatter (name, invocation, shell_script, report_contract) | green |
| 5 | `config.review_providers.codex_enabled === false` | green |
| 6 | `contract-check.mjs` exits 0 on the toy fixture (soft-fail allowed on dual-CLI-absent) | green |

## 4. Non-goal compliance audit (D-24 leak check)

All Phase-14 forbidden modifications verified absent:

| Non-goal item | Check | Result |
|---|---|---|
| Modified `sgsd-orchestrate/SKILL.md` Steps 6.5/9.5/9.6 | `grep -n "sgsd-codex-reviewer\|reviewer_provider\|codex-exec" super-gsd/skills/sgsd-orchestrate/SKILL.md` → 0 matches on those tokens in those steps | PASS |
| Created `codex-exec.ps1` | `ls super-gsd/scripts/codex-exec.ps1` → not found | PASS |
| Added Gemini/local/third provider to `review-providers.yaml` | `grep "^\s*- name:" super-gsd/registry/review-providers.yaml` → exactly 2 rows (claude-sonnet-reviewer, codex-cli-reviewer) | PASS |
| `provider` field in `token-log.jsonl` schema | `head -3 .planning/metrics/token-log.jsonl \| grep -c '"provider"'` → 0 | PASS |
| Created `.planning/review-providers.override.yaml` | `ls .planning/review-providers.override.yaml` → not found | PASS |
| Called any `mcp__vtp-kb__*` tool in Phase-14 runtime code | Grep hits in Phase-14 artifacts are exclusively inside discussion documents (`14-VTP-EVIDENCE.md`, `PATTERNS.md`, `PLAN-INDEX.md`, `RESEARCH.md`, `VALIDATION.md`) — each one documenting the explicit bypass. Zero hits in `codex-exec.sh`, `providers-registry.cjs`, `sgsd-codex-reviewer.md`, `sgsd-code-reviewer.md`, `review-providers.yaml`, `contract-check.mjs`. | PASS |
| Cross-vendor adversarial challenger routing | No challenger logic in `codex-exec.sh`, `providers-registry.cjs`, or either agent stub; Phase-15 deferral (CODEX-11) intact | PASS |

Clean. No D-24 item leaked.

## 5. Mechanical verifier output

```
PASS Phase 14 (6/6 invariants green)
EXIT=0
```

All 6 D-23 invariants green (detail in V6 above). No per-invariant failures or warnings surfaced by the verifier.

## 6. Warnings carried forward

From `.planning/phases/14/commit-reviews.jsonl` — per-dispatch ATCs logged 5 non-blocking warnings across plans 14-01 and 14-02. Both dispatches had verdict `warn` with `critical: 0`:

- **14-01 (2 warnings)** — JSONL tag types unvalidated (phase/plan/step fields go straight into the log without type-coercion); plan-text drift in auth-hygiene messaging (plan said "unset" but wrapper now refuses outright per D-02a).
- **14-02 (3 warnings)** — `resolveReviewerProvider` treats haiku-agent gates as reviewer-shaped (uses `reviewer_agent !== undefined` as the reviewer-shape predicate; any gate with that field qualifies, even if the agent is haiku-class); `registry_version` in `gates.yaml` not bumped to reflect schema extension (optional field addition is semver-minor but no version bump recorded); plan §T2 verification command cited the wrong field name in a doc example.

Phase-level ATC review (`14-ATC-REVIEW.md`) was not yet written at verification time — if the sibling ATC agent surfaces additional concerns, they should be merged into this section post-hoc. The per-dispatch warnings above are all non-blocking and do not change the PASS verdict; they are operational refinements for Phase 15 or a Phase 14 follow-up pass.

Plan-checker's own PASS-WITH-WARNINGS verdict raised W1 (14-03 patcher requires actual execution of `patch-gsd-tools-known-keys.sh` outside the repo) and W2 (14-04 verify.mjs hedge between new-or-extended). Spot-checked at verification: the patcher executor path appears satisfied (verify.mjs exists and passes), and the `KNOWN_TOP_LEVEL` runtime effect is not grep-checkable from within this repo but is verifiable via the patcher script's own exit code at the operator's shell.

## 7. Rollup

Phase 14 delivers exactly what its goal statement promised: a reviewer-provider abstraction exists, is transparent to the gate layer, has identical report contracts across both providers, ships dark, enforces OAuth auth hygiene, and the mechanical verifier corroborates every D-23 invariant — providing Phase 15 a clean substrate to wire routing against without refactoring the registry surface.
