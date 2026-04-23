---
phase: 14
phase_name: Codex CLI Provider Substrate
generated: 2026-04-24
plans_count: 4
waves: 3
vtp_mode: BYPASSED
---

# Phase 14 — Plan Index

Four v2-schema plans deliver CODEX-01..CODEX-06, gated under the "substrate-only,
ships dark" discipline (D-11 / D-18b / D-24). No orchestrator rewire lands in
Phase 14; Phase 15 flips the lane on.

## Plans

| Plan | Wave | Deliverable (one-line) | Depends on |
|------|------|------------------------|------------|
| [14-01 codex-exec-wrapper](./14-01-codex-exec-wrapper.md) | 1 | `codex-exec.sh` bash wrapper — OAuth-gated, GNU-timeout, stdin-pipe to `codex exec`, 5-field report parse, JSONL provenance | — |
| [14-02 provider-registry](./14-02-provider-registry.md) | 2 | `providers-registry.cjs` sibling + `review-providers.yaml` + `gates.yaml` field ext + `sgsd-code-reviewer.md` + `sgsd-codex-reviewer.md` | 14-01, 14-03 |
| [14-03 config-and-known-keys](./14-03-config-and-known-keys.md) | 1 | `.planning/config.json` `review_providers` block (ships dark) + `KNOWN_TOP_LEVEL` patch re-run | — |
| [14-04 contract-check-harness](./14-04-contract-check-harness.md) | 3 | Pure parser `contract-check.mjs` + `toy-diff.patch` fixture + `make-fixtures.sh` capture + Phase 14 `verify.mjs` invariants | 14-01, 14-02, 14-03 |

## Wave model (per D-22)

- **Wave 1 (parallel)**: {14-01, 14-03} — disjoint files (`codex-exec.sh` and
  `.planning/config.json`), no shared dependency. Safe to fan out.
- **Wave 2 (solo)**: {14-02} — depends on 14-01's `shell_script` path (referenced
  in `review-providers.yaml`) AND 14-03's config keys (`providers-registry.cjs`
  reads `config.review_providers.*` via `loadReviewProvidersConfig`). Serial.
- **Wave 3 (solo)**: {14-04} — depends on all of {wrapper, registry, agent
  stubs, config}. The contract-check harness's fixtures need to reference real
  files created in waves 1-2; `verify.mjs` wires invariants 1-6 spanning all
  three prior plans. Serial.

## Planner deviations taken (P1..P4)

Four items surfaced in RESEARCH + PATTERNS that CONTEXT did not lock. Positions
taken in the plans (all four need plan-checker verification and operator
acknowledgement at plan review):

| ID | Scope | CONTEXT original | Position taken (this planner) | Plan | Justification |
|----|-------|------------------|-------------------------------|------|---------------|
| **P1** | `providers-registry.cjs` placement | D-06: extend `gates-registry.cjs` with `getProvider` / `resolveReviewerProvider` | **Sibling module** `super-gsd/scripts/lib/providers-registry.cjs` (RESEARCH §2b + §3 R-3, PATTERNS D1) | 14-02 | Separation of concerns — `gates-registry.cjs` is cleanly scoped to gates.yaml; bolting a second YAML + a `config.json` read onto it violates that scope. Bridge (`resolveReviewerProvider(gate, gatesRegistry)`) lives on the sibling; one-directional import; no circular dependency. |
| **P2** | `contract-check.mjs` shape | D-14/D-15: harness dispatches Claude via `Agent()` AND Codex via `codex-exec.sh` from one binary | **Pure parser-comparator** — takes `--claude-report <path>` + `--codex-report <path>` as fixture inputs; emits JSON divergence summary; does NOT dispatch | 14-04 | RESEARCH §3 R-2: `Agent()` is unavailable from a plain `node` invocation (only inside a running Claude Code session). Keeps harness deterministic and runnable without credentials. Capture flow moves into a sibling `make-fixtures.sh` one-shot; D-17 soft-fail moves with it. |
| **P3** | `sgsd-code-reviewer` naming drift | D-05/D-12 reference `sgsd-code-reviewer.md` which does not exist (only legacy `gsd-code-reviewer` under `custom-gsd-extract/`) | **Create `sgsd-code-reviewer.md` stub** in plan 14-02 alongside `sgsd-codex-reviewer.md` (RESEARCH §5 14-02, PATTERNS D4 option b) | 14-02 | Respects the feedback rule (`feedback_sgsd_rename_rule.md`: `sgsd-` prefix earned by active enrichment — the stub declares `invocation`, `report_contract`, and v2 handover contract, which counts). Keeps D-05 working verbatim. ~30 LoC. Option (a) = permanently break the rename convention for this one agent; option (c) = ship a broken registry pointer that CODEX-05 would catch. |
| **P4** | `codex-exec.sh` prompt input | D-01: `--prompt-file <path>` passed to `codex exec` | **stdin pipe**: wrapper keeps `--prompt-file` as its own external flag but internally pipes via `cat "$file" \| codex exec ... -` | 14-01 | RESEARCH §1a verified against developers.openai.com/codex/cli/reference: **no `--prompt-file` flag exists on `codex exec`**. Codex accepts prompts only as positional arg or via stdin. Wrapper-facing flag name preserved; internal transport changed. Documented prominently in 14-01 scope + sidecar README. |

## Coverage table

Every CODEX-01..06 requirement is assigned to exactly one plan. Every D-23
verify.mjs invariant maps to an acceptance criterion in the plan that owns the
artifact under test.

### Decision → plan mapping

| Decision | Requirement | Plan | Acceptance ID |
|----------|-------------|------|---------------|
| D-01 (w/ P4 deviation) | `codex-exec.sh` wrapper exists; stdin-pipe invocation; flags `--prompt-file` `--timeout` `--report-out` `--dry-run` `--project` | 14-01 | A1, A4 |
| D-01a | wrapper exit codes 3/4/5/6 map correctly (no-CLI, auth, timeout, report-contract) | 14-01 | A2 |
| D-01b | timeout default 30s; `--timeout` flag override; config knob read; GNU `timeout` wrap + exit 124 → 5 remap | 14-01 | A6 |
| D-01c | JSONL provenance row appended to `.planning/metrics/codex-log.jsonl` with 11 fields | 14-01 | A5 |
| D-02 | OAuth-only; API-key env vars explicitly unset | 14-01 | A3 |
| D-02a | refuse-to-run on `OPENAI_API_KEY` set; exit 4 + message | 14-01 | A3 |
| D-03 | 5-field report contract parsed (FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER); parse failure → exit 6 | 14-01 | A2, A4 |
| D-04 | WSL-first on Windows; no PowerShell-native wrapper | 14-01 | (non-goals) |
| D-04a | `wslpath -u` translation for Windows-style `--project` paths | 14-01 | A8 |
| D-05 | `review-providers.yaml` exists with two providers per schema | 14-02 | A1 |
| D-05a | both providers advertise `report_contract: code-reviewer-v1` | 14-02 | A1, A6, A7 |
| D-06 (w/ P1 deviation) | sibling `providers-registry.cjs` loads providers + exposes `getProvider`/`resolveReviewerProvider` | 14-02 | A2 |
| D-06a | unknown provider name = hard error at cold-start | 14-02 | A3 |
| D-07 | `invocation_type: agent \| shell` discriminator declared | 14-02 | A1 |
| D-08 | registry is read-only; no `sgsd-provider-add` skill | 14-02 | (non-goals) |
| D-09 | `reviewer_provider:` field added to `gates.yaml` rows | 14-02 | A5 |
| D-09a | exactly 2 rows touched (`per-dispatch-ATC`, `phase-level-ATC`); default `claude-sonnet-reviewer` | 14-02 | A5 |
| D-10 | `resolveReviewerProvider(gateName)` method returns record or null | 14-02 | A4 |
| D-10a | predicate-eval untouched (scope discipline) | 14-02 | A8 |
| D-11 | `sgsd-orchestrate/SKILL.md` Step 6.5/9.5/9.6 NOT modified | 14-02 | A8 |
| D-11a | substrate-only discipline preserved | all | (non-goals) |
| D-12 | `sgsd-codex-reviewer.md` agent stub with 3 net-new frontmatter fields | 14-02 | A6 |
| D-12a | `invocation: shell` is net-new field; no validator added | 14-02 | A6 (non-goals) |
| D-13 | contract version label `code-reviewer-v1` declared in both registry + agent file | 14-02 | A6, A7 |
| D-14 | `contract-check.mjs` Node ESM tool, exits 0/1/2 | 14-04 | A1, A4 |
| D-14a | toy-diff fixture (1 bug + 1 YAGNI + 1 nit) | 14-04 | A6 |
| D-15 (w/ P2 deviation) | harness parses two reports against schema, emits JSON summary (capture moved outside) | 14-04 | A2, A5 |
| D-15a | divergence is informational, not assertive | 14-04 | A5 |
| D-16 | Phase 14 `verify.mjs` runs the harness as an invariant | 14-04 | A9 |
| D-17 | dual-CLI-absent → exit 2 soft-fail allowed by verifier | 14-04 | A4, A7 |
| D-18 | `config.json` `review_providers` block with 6 keys | 14-03 | A1, A2 |
| D-18a | `default_provider: claude-sonnet-reviewer` | 14-03 | A1, A2 |
| D-18b | `codex_enabled: false` — ships dark kill-switch | 14-03 | A1 |
| D-18c | `codex_cli_path: "auto-detect"` sentinel | 14-03 | A2 |
| D-19 | append `review_providers` to `KNOWN_TOP_LEVEL` via existing patcher | 14-03 | A3, A4, A6 |
| D-20 | cold-start read at Step 3.6 (wiring lives in `providers-registry.cjs`) | 14-02 | A2 |
| D-21 | four plans shipped (wrapper, registry, config, harness) | INDEX | — |
| D-22 | three-wave dispatch ({14-01, 14-03} ‖ 14-02 → 14-04) | INDEX | — |
| D-23 | `verify.mjs` runs all 6 invariants | 14-04 | A9 |
| D-24 | deferred items NOT shipped | all | (non-goals blocks) |

### D-23 invariants → plan acceptance mapping

| D-23 invariant | Plan | Acceptance ID |
|----------------|------|---------------|
| 1. `codex-exec.sh` exists, executable, `bash -n` clean | 14-01 | A1 |
| 2. `review-providers.yaml` parses, both providers `state: active` | 14-02 | A1 |
| 3. Both target `gates.yaml` rows declare `reviewer_provider: claude-sonnet-reviewer` | 14-02 | A5 |
| 4. `sgsd-codex-reviewer.md` exists with required frontmatter | 14-02 | A6 |
| 5. `config.review_providers.codex_enabled === false` | 14-03 | A1 |
| 6. `contract-check.mjs` exits 0 on committed fixtures (soft-fail allowed) | 14-04 | A9 |

## What's NOT in Phase 14 (for clarity — Phase 15 pickup)

All items below are explicit D-24 deferrals. Plan-checker should verify no plan
accidentally touches them:

- Any edit to `super-gsd/skills/sgsd-orchestrate/SKILL.md` (Steps 6.5 / 9.5 / 9.6 hardcoded dispatches).
- Any `gates.yaml` row routed to `codex-cli-reviewer` (all rows default to Claude).
- Qualitative MUDA probe (CODEX-08).
- `token-log.jsonl` `provider` field (CODEX-10).
- Cross-vendor adversarial challenger rewire (CODEX-11).
- Milestone-close kill condition (CODEX-12).
- Gemini / local / third-provider registry entries.
- Per-project provider override `.planning/review-providers.override.yaml`.
- `codex-exec.ps1` PowerShell-native wrapper.
- VTP evidence consumption by Codex reviewer (Phase-16 integration).
- Runtime provider swap CLI flag.

## Notes for plan-checker

1. **Four deviations (P1..P4)** need explicit plan-checker approval. Each one
   overrides a CONTEXT-locked decision with RESEARCH- or PATTERNS-grounded
   justification. If the operator rejects any deviation, the plan owning it
   needs to revert to the literal CONTEXT shape — but the RESEARCH-documented
   issue (P4 in particular — `--prompt-file` does not exist on `codex exec`)
   will still block implementation, so the reversion is more ceremony than
   substance.
2. **Balance**: plans 14-01..14-03 each deliver one subsystem; plan 14-04
   stitches them together via fixtures + verifier. Wave 3 (harness) is the
   thickest plan (~750 tokens) because it owns 3 files + verify.mjs wiring; if
   context pressure emerges at execute time, split 14-04 into (a) harness +
   fixtures and (b) verify.mjs invariant wiring.
3. **Coverage audit**: the Decision→Plan table above has 40 rows covering
   D-01..D-24 (all sub-decisions included). D-21/D-22 are plan-structure decisions
   tracked in the INDEX itself. D-24 items are intentionally uncovered (the
   "not in Phase 14" section above is the positive assertion that nothing
   deferred leaked in). Every D-XX appears somewhere.
4. **VTP discipline**: all four plans carry `VTP evidence: BYPASSED` in their
   evidence-lineage blocks per D-11/D-24 and `14-VTP-EVIDENCE.md`. None cite a
   doc-ID. None attempt a `mcp__vtp-kb__*` call.
