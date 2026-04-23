# Phase 15: Codex-Routed Gates + Qualitative MUDA Probe — Context

**Drafted:** 2026-04-23
**Status:** Staged (awaiting v1.2 close + `/gsd-new-milestone v1.3` + Phase 14 ship)
**Prerequisites:** Phase 14 fully shipped with green verify.mjs. In particular: `review-providers.yaml` registry exists, `gates.yaml` schema has `reviewer_provider:` field, `codex-exec.sh` wrapper is operational + contract-check harness PASS.

<domain>
## Phase Boundary

Phase 15 **flips the switch**. It wires Codex into the three review-shaped gate surfaces (Step 6.5 / 9.5 / 9.6), adds the first qualitative MUDA probe (Step 6.55), and lands the mechanical accounting that proves (or kills — see CODEX-12) the whole multimodal experiment.

Six deliverables (CODEX-07 through CODEX-12):

1. **CODEX-07** — Flip `reviewer_provider: codex-cli-reviewer` on `gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC`. Teach `sgsd-orchestrate/SKILL.md` Step 6.5 + 9.5 to honour the registry dispatch indirection (agent vs shell). Single-retry fallback to Claude on Codex error, logs `GATE_PROVIDER_FALLBACK`.
2. **CODEX-08** — Add `codex_qualitative_waste` as a 4th probe in `sgsd-muda-audit.sh`. Shells to Codex with the phase diff + goal, emits findings in the WASTE.md 4th row + curates to `.brv/context-tree/anti-patterns/` under `waste-overproduction-*` slug.
3. **CODEX-09** — Gate the CODEX-08 probe: fires only when mechanical probes PASS AND `diff_lines >= 200` AND `phase_type NOT IN (docs, config)`. Declared on a new `gates.yaml` row `qualitative-waste-audit`.
4. **CODEX-10** — Extend `token-log.jsonl` schema with a `provider` field. Extend `sgsd-token-audit` dashboard with a `claude_tokens_saved_by_codex` tile computing the savings across the active milestone.
5. **CODEX-11** — Adversarial verifier challenger (Step 9.6 MACH-04) routes **always** to Codex when firing. Sampling rate stays `0.2`; what changes is the challenger provider is always the non-primary-reviewer vendor.
6. **CODEX-12** — Milestone-close kill condition. `sgsd-token-audit --milestone-close-check` computes `critical_count_delta` + `claude_tokens_saved`. If both below thresholds, flip `codex_enabled: false` + emit anti-pattern note.

**Not in scope:**
- Adding third providers (Gemini, local models) — registry supports them, but first-real-data-first.
- Per-project overrides — deferred post-v1.3.
- Refactoring `sgsd-code-reviewer.md` — stays as the default / fallback reviewer; unchanged.
- Adding Codex to classifier (Haiku) or primary verifier (mechanical verify.mjs) — scope-discipline per the brief.
</domain>

<canonical_refs>
## Canonical References

- **Phase 14 outputs** (all must be green before Phase 15 starts):
  - `super-gsd/scripts/codex-exec.sh` — wrapper.
  - `super-gsd/registry/review-providers.yaml` — registry.
  - `super-gsd/scripts/lib/gates-registry.cjs` — `resolveReviewerProvider()` method.
  - `super-gsd/agents/sgsd-codex-reviewer.md` — agent stub.
  - `super-gsd/tools/provider-contract/contract-check.mjs` — harness.
  - `.planning/config.json` `review_providers:` block.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — the rewire target:
  - Step 6.5 (line 440-506): Phase-level ATC gate. CODEX-07 rewires the `Agent(subagent_type: "gsd-code-reviewer", ...)` call at line 473-490 into a provider-resolution branch.
  - Step 9.5 (line 800-850): Per-dispatch ATC. CODEX-07 rewires the `Agent(subagent_type: "gsd-code-reviewer", ...)` call at line 812-824.
  - Step 9.6 (line 852-900): Adversarial verifier challenger. CODEX-11 rewires the `Agent(subagent_type: "gsd-verifier", ...)` call at line 888 to use the codex-cli-reviewer provider when firing (not via the existing reviewer-provider indirection — adversarial is its own routing rule).
- `super-gsd/scripts/sgsd-muda-audit.sh` — the probe-shell target. CODEX-08 adds a 4th probe invocation after the three mechanical ones (~line 111).
- `super-gsd/registry/gates.yaml` — CODEX-09 adds the `qualitative-waste-audit` row. CODEX-07 flips `reviewer_provider` on two existing rows.
- `super-gsd/skills/sgsd-token-audit/SKILL.md` — CODEX-10 dashboard extension. CODEX-12 milestone-close-check invocation.
- `.planning/metrics/token-log.jsonl` — CODEX-10 schema extension (add `provider` field).
- `.planning/metrics/codex-log.jsonl` — Phase 14 CODEX-01 output. CODEX-10 joins against this to compute offload.
- `.planning/phases/{NN}-{slug}/commit-reviews.jsonl` — per-dispatch ATC evidence emitted by both Claude and Codex (CODEX-07 preserves path; provider field distinguishes source).
- `.planning/phases/{NN}-{slug}/{NN}-ATC-REVIEW.md` — phase-level ATC evidence. Same path for both providers (CODEX-07 preserves).
- `.planning/phases/{NN}-{slug}/WASTE.md` — CODEX-08 adds a 4th row.
- `.brv/context-tree/anti-patterns/` — CODEX-08 curation target. Slug convention: `waste-overproduction-p{N}-{finding-slug}.md`.
- **Phase 13's `sgsd-complete-milestone` skill** — CODEX-12 extends its milestone-close hook. Phase 13 must have shipped Rule 6.7 (auto-dispatch sgsd-complete-milestone) and the skill itself.
</canonical_refs>

<decisions>
## Implementation Decisions

### CODEX-07 — Flip Claude→Codex on Review Gates (D-01 through D-05)

- **D-01** — Update `gates.yaml`:
  - `per-dispatch-ATC`: change `reviewer_provider: claude-sonnet-reviewer` → `reviewer_provider: codex-cli-reviewer`.
  - `phase-level-ATC`: change `reviewer_provider: claude-sonnet-reviewer` → `reviewer_provider: codex-cli-reviewer`.
  - Phase 15 is the diff that introduces Codex as the operational default for ATC. Audit trail is clean.
- **D-02** — Teach `sgsd-orchestrate/SKILL.md` to honour the indirection. Replace the hardcoded `Agent(subagent_type: "gsd-code-reviewer", model: "sonnet", ...)` at Step 6.5 (line 473) and Step 9.5 (line 812) with a provider-resolution branch:
  ```javascript
  const provider = gates.resolveReviewerProvider(gateName);
  // Honours config kill-switch: codex_enabled=false → force fallback
  const effective = (provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
    ? gates.getProvider(provider.fallback_to)
    : provider;

  let report;
  if (effective.invocation_type === 'agent') {
    report = await Agent({
      subagent_type: effective.agent_subagent_type,
      model: effective.agent_model,
      mode: 'auto',
      prompt: composedPrompt
    });
  } else if (effective.invocation_type === 'shell') {
    report = await shellDispatch(effective.shell_script, {
      promptFile: writeTempPrompt(composedPrompt),
      timeout: effective.timeout_seconds,
      reportOut: tempReportPath
    });
    // On non-zero exit AND fallback_to != null: retry ONCE with fallback provider
    if (report.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
      logDeviation(`GATE_PROVIDER_FALLBACK: ${effective.name} exit=${report.exit} → ${effective.fallback_to}`);
      report = await dispatchProvider(gates.getProvider(effective.fallback_to), composedPrompt);
    }
  }
  ```
- **D-02a** — The fallback retry is single-shot. Per `config.review_providers.fallback_max_retries: 1` (Phase 14 D-18). No retry storms.
- **D-02b** — On fallback success: the Claude report IS the phase's ATC record. `commit-reviews.jsonl` gets one row with `provider: "claude-via-fallback"` (not `"openai-codex"` — CODEX-10 metric correctness depends on this distinction).
- **D-02c** — On fallback failure (both providers fail): hard blocker. Write checkpoint, exit with `GATE_PROVIDER_DOUBLE_FAIL` DEVIATION. This is the only path where a provider error blocks an auto run. Matches existing auto-mode Golden Rule 13 discipline.
- **D-03** — Evidence emission MUST be path-identical to current Claude path:
  - Per-dispatch ATC: append to `.planning/phases/{NN}/commit-reviews.jsonl` — same schema, with new `provider: "openai-codex" | "claude-sonnet" | "claude-via-fallback"` field. Edge-guard expects this exact path — no divergence permitted.
  - Phase-level ATC: write to `.planning/phases/{NN}/{NN}-ATC-REVIEW.md` — same path. First line frontmatter gains `provider:` key.
- **D-03a** — Frontmatter for `{NN}-ATC-REVIEW.md`:
  ```yaml
  ---
  phase: N
  run_at: ISO
  provider: codex-cli-reviewer | claude-sonnet-reviewer
  tier: lite | full | gate
  critical_count: N
  warning_count: N
  duration_ms: N
  fallback_triggered: bool
  ---
  ```
  Schema versioned; consumers (Phase 16+ tooling) MUST check `provider:` before parsing downstream fields.
- **D-04** — Surgical-constraint header is NOT auto-injected into Codex prompts. The surgical constraint (`sgsd-orchestrate/SKILL.md:704-715`) is a Claude-executor-prompt concept; reviewers don't need it. Codex reviewer prompt is purely the ATC checks + the diff + the report contract. Strict scope.
- **D-05** — Phase 15 `verify.mjs` invariant: after a mock phase run, `commit-reviews.jsonl` has at least one row where `provider == "openai-codex"` AND `.planning/metrics/codex-log.jsonl` has a matching timestamp row. End-to-end evidence that the rewire is live.

### CODEX-08 — Qualitative MUDA Probe (D-06 through D-09)

- **D-06** — Extend `super-gsd/scripts/sgsd-muda-audit.sh` with a 4th probe class `codex_qualitative_waste`. Runs AFTER the three mechanical probes succeed (or with `--probe codex` flag bypass for isolated testing). Invocation:
  ```bash
  # Inside sgsd-muda-audit.sh, after lines 112-114 where probe JSON is captured:
  if [[ "$PROBE_EXIT" == "0" && $DIFF_LINES -ge 200 && "$CODEX_QUAL_ENABLED" == "true" ]]; then
    CODEX_REPORT=$(bash "$SCRIPT_DIR/codex-exec.sh" \
      --prompt-file "$(compose_codex_muda_prompt "$PHASE_DIR")" \
      --timeout 60 \
      --report-out "$TMP_REPORT")
    # parse CODEX_REPORT into findings, emit WASTE.md 4th row, curate to anti-patterns/
  fi
  ```
- **D-06a** — Prompt contract for Codex (composed by a new helper in `sgsd-muda-audit.sh`):
  ```
  PHASE {N} QUALITATIVE WASTE AUDIT
  Goal: {from ROADMAP.md phase row}
  Diff: <git diff --stat + first 500 lines of git diff>
  Plans: <list of plan IDs>

  Identify up to 5 findings across these classes (emit 0-5 findings; 'none' is a valid answer):
  - YAGNI: features/code added that no task required
  - Duplication: similar logic in ≥2 plans that should be extracted
  - Over-engineering: abstractions that have only one call site
  - Defensive code without failure mode: try/catch/fallback without documented why
  - Orphan files: files touched that no plan claimed in `files_touched`

  Report format:
  FINDINGS: <0-5 items, each "- class: finding (file:line)">
  CRITICAL: <count of findings that block phase close; typically 0 — this is advisory>
  WARNINGS: <count>
  PASS_RATE: <100 if CRITICAL=0, else "blocked">
  ONE_LINER: <summary>
  ```
- **D-07** — Emit a 4th row in WASTE.md:
  ```markdown
  | codex_qualitative_waste | WARN | N findings | diff_lines=X | overproduction | ... |
  ```
  Verdict mapping: `CRITICAL > 0` → FAIL (blocks phase close, same semantics as mechanical FAIL — per D-06c below). `WARNINGS > 0, CRITICAL == 0` → WARN. `findings == 0` → PASS.
- **D-07a** — Each individual finding is curated via `sgsd-curate.sh` to `.brv/context-tree/anti-patterns/waste-overproduction-p{N}-{finding-slug}.md`. Same pipeline as the mechanical probes (see `sgsd-muda-audit.sh` lines 232-302). No new curate-path required.
- **D-07b** — Wait, clarification: the mechanical probes currently curate under `waste-{class}-p{N}-{probe}.md` where class ∈ {defects, waiting, motion}. CODEX-08 extends to class=overproduction. Class name is load-bearing — the 8-waste taxonomy mechanical mapping becomes: **defects** (haiku fails, mechanical), **waiting** (narrative stale, mechanical), **motion** (git spawn rate, mechanical), **overproduction** (YAGNI/duplication/over-engineering, qualitative). Four of eight waste classes now mechanically probed. Remaining four (transportation, inventory, non-utilised-talent, extra-processing) stay operator-judgment-only for v1.3.
- **D-07c** — `--no-curate` flag extends naturally (already in `sgsd-muda-audit.sh` line 43). Codex findings respect the same flag. `--dry-run` extends naturally (already line 216). No new flags needed.
- **D-08** — **MUDA is NEVER a phase blocker** per DLB-02. Even with `CRITICAL > 0`, phase close proceeds; the finding is curated and surfaces via recurrence check at milestone close. Matches existing `sgsd-muda-audit.sh` line 541-545: "NEVER block on MUDA failures."
  - **D-08a** — Correction: D-07's "blocks phase close" wording is wrong. Revise to: `CRITICAL > 0` → FAIL verdict recorded in WASTE.md + DEVIATIONS entry + curate, phase continues. MUDA's purpose is data accumulation for the recurrence kill check (DLB-02 Contrarian kill). If operators start treating CRITICAL findings as blockers, they rewrite DLB-02 by accident.
- **D-09** — `config.review_providers` block gains `codex_qualitative_waste_enabled: true` (defaults on, Phase 15 is when we flip it). Operators who don't want qualitative MUDA can disable without touching gates.yaml.

### CODEX-09 — Gate Row for Qualitative Waste (D-10 through D-11)

- **D-10** — Add new row to `gates.yaml`:
  ```yaml
  - name: qualitative-waste-audit
    category: process-hygiene
    step: 6.55   # same step as mechanical MUDA — they co-fire
    enforcement_mode: soft-warn
    trigger:
      - field: phase_type
        op: not_in
        value: [docs, config]
      - field: diff_lines
        op: gte
        value: 200
      - field: mechanical_muda_verdict
        op: in
        value: [PASS, WARN]  # don't burn Codex tokens if mechanical probes already FAIL
    reviewer_provider: codex-cli-reviewer
    evidence_emitted:
      - .planning/phases/{N}/WASTE.md   # same file as mechanical MUDA, 4th row
    escalation: log-only
    source_dlb: DLB-02
    state: active
    version: 2.0
  ```
- **D-10a** — New predicate field: `mechanical_muda_verdict`. Must be added to `predicate-eval.cjs` DISPATCH_CONTEXT_FIELDS registry (Phase 10 D-10c pattern). Assembled in dispatch context AFTER the three mechanical probes run; value ∈ {PASS, WARN, FAIL}. Phase 15 execution plan must update `predicate-eval.cjs` as part of 15-02.
- **D-10b** — Field-ordering constraint: `qualitative-waste-audit` MUST evaluate AFTER the existing `MUDA-waste-audit` row fires, because it depends on `mechanical_muda_verdict` which is only populated after the mechanical probes complete. Enforced by row order in `gates.yaml` (place new row immediately after `MUDA-waste-audit`) AND by a check in the orchestrator step executor.
- **D-11** — Trigger AND semantics are top-level (Phase 10 D-10b). All three clauses must be true for the gate to fire. Short-circuit on first false clause — cheap gate eval.

### CODEX-10 — Quota-Offload Metric (D-12 through D-15)

- **D-12** — Extend `.planning/metrics/token-log.jsonl` schema with a `provider` field. Values:
  - `"claude"` — dispatched via `Agent()`. Current rows implicitly `claude` — need a one-time migration OR backfill-on-read (choose: backfill-on-read, cheaper).
  - `"openai-codex"` — dispatched via `codex-exec.sh` with `exit == 0`.
  - `"claude-via-fallback"` — dispatched via `codex-exec.sh` with exit != 0 followed by single-retry `Agent()` call. Distinct from pure-Claude because the Codex attempt was counted against Codex's log but the tokens billed on Claude's side.
- **D-13** — Extend `super-gsd/skills/sgsd-token-audit/SKILL.md` with a new dashboard tile:
  ```
  ## Multimodal Review Offload (v1.3)
  - Codex reviews this milestone: N
  - Claude tokens saved by Codex: ~K tokens (estimated)
  - Provider fallback rate: P%
  - Per-phase provider breakdown: <table>
  ```
  Calculation for "Claude tokens saved":
  ```
  Σ (est_input + est_output) for rows where:
    role ∈ {code_reviewer, adversarial_verifier}
    AND provider == "openai-codex"
  ```
  I.e., the tokens Codex spent doing review-shaped work that would otherwise have been billed to Claude Max.
- **D-13a** — This is an **estimate**, not a billing reconciliation. The actual Claude tokens saved are what Claude would have charged for the same prompt+response; Codex emitted its own response which may be longer/shorter. We're estimating the shape-of-the-win, not auditing a bill. Brief language on the dashboard to make this clear.
- **D-14** — `sgsd-token-audit --quick` (existing flag) emits the offload tile. `--milestone-close-check` (new flag, Phase 15 CODEX-12) emits the kill-condition verdict.
- **D-15** — `sgsd-orchestrate/SKILL.md` Step 11 (token-log append) — update the JSONL row template (line 1183) with `provider` field. Default value derived from the dispatch path; NEVER allow empty provider.

### CODEX-11 — Cross-Vendor Adversarial Challenger (D-16 through D-18)

- **D-16** — Rewire `sgsd-orchestrate/SKILL.md` Step 9.6 adversarial challenger dispatch (line 888) so that when `Math.random() < config.atc.verifier_adversarial_rate` fires:
  - Primary verifier provider is determined by the normal `verifier` agent path (Claude Sonnet today, unchanged).
  - **Challenger provider is the OTHER vendor**. If primary was Claude, challenger is Codex. If primary was Codex (future-proofing), challenger is Claude.
  - Current behaviour: challenger is same model (Sonnet) with contrarian prompt. After CODEX-11: challenger is the non-primary-vendor with the SAME contrarian prompt (`sgsd-orchestrate/SKILL.md:872-873` unchanged).
- **D-16a** — Dispatch code pattern:
  ```javascript
  const primary = 'claude-sonnet-verifier';  // Phase 15: primary always Claude for verifier
  const challenger = (primary === 'claude-sonnet-verifier')
    ? 'codex-cli-reviewer'
    : 'claude-sonnet-reviewer';
  // Dispatch challenger via provider indirection from CODEX-07
  ```
- **D-17** — If Codex is disabled (`codex_enabled: false`) or auth fails: adversarial challenger **skips entirely** (logs `VERIFIER_ADVERSARIAL_SKIP: codex unavailable`). Does NOT fall back to same-vendor Sonnet challenger. The whole point of D-16 is cross-vendor signal; same-vendor challenger was the old behaviour and is strictly worse. Better to skip than produce a false signal.
- **D-17a** — This is the ONE place in Phase 15 where Codex unavailability is NOT fallback-to-Claude. Justified: adversarial challenger is advisory, not blocking, and same-vendor-challenger defeats its own purpose.
- **D-18** — Token-log row for adversarial challenger: `role: "adversarial_verifier"`, `provider: "openai-codex"`. Feeds CODEX-10 offload calculation. Same row shape as regular code-reviewer rows.

### CODEX-12 — Milestone-Close Kill Condition (D-19 through D-22)

- **D-19** — Extend `sgsd-token-audit` with a `--milestone-close-check` subcommand. Computes from `.planning/metrics/token-log.jsonl` + `.planning/phases/*/commit-reviews.jsonl` + `.planning/phases/*/{NN}-ATC-REVIEW.md`:
  - **Quality metric**: `critical_count_delta` = count of critical findings in Codex reviews MINUS count in Claude reviews across the milestone. Higher = Codex finding more issues Claude missed.
  - **Quota offload metric**: `claude_tokens_saved` from CODEX-10 calculation, summed across the milestone.
- **D-20** — Kill thresholds (strawman, tunable in `config.review_providers`):
  - `critical_count_delta < 5` (Codex not catching enough additional issues)
  - AND `claude_tokens_saved < 50000` (Codex not saving enough quota)
  - Both conditions must hold → fire the kill.
- **D-20a** — One-condition kill is weaker: Codex providing real quota offload IS a win even if finding parity with Claude (quota-offload was one of the motivating constraints). Codex finding real additional issues IS a win even if the offload is small (quality lift was another motivating constraint). Require BOTH to fail before retiring.
- **D-20b** — Thresholds are in `config.review_providers.kill_critical_count_delta` and `config.review_providers.kill_claude_tokens_saved`. Default values match D-20. Operator can raise thresholds if they want stricter kill (e.g., demand 10k findings delta) or disable kill entirely with `-1` sentinel.
- **D-21** — Kill action:
  1. Set `config.review_providers.codex_enabled: false` in `.planning/config.json`.
  2. Write an anti-pattern note via `sgsd-curate` to `.brv/context-tree/anti-patterns/multimodal-codex-retired-{milestone}.md` documenting the metrics and thresholds that fired the kill.
  3. Append a one-line summary to `MILESTONES.md` next-milestone section: "v1.3 Codex Multimodal: RETIRED per kill condition."
  4. Do NOT delete `super-gsd/scripts/codex-exec.sh` or the registry entry — retirement is "disable and document", not "forget." Future milestones can re-enable via config flip if new data emerges.
- **D-22** — Kill is **advisory** in auto mode. Auto mode logs the kill action AND proceeds; interactive mode asks for confirmation. Rationale: retiring infrastructure mid-autonomous-run would be an unexpected side-effect at milestone-close; auto mode logs the decision for operator review, doesn't silently flip.

### Integration with `sgsd-complete-milestone` (D-23)

- **D-23** — `sgsd-complete-milestone` skill (from Phase 13) runs in sequence at milestone close. Add CODEX-12 kill-check as a new step:
  1. Run GOV-05 deliberation scoring audit (Phase 13).
  2. Run MUDA recurrence check per DLB-02 (existing).
  3. **NEW — Run `sgsd-token-audit --milestone-close-check`** (CODEX-12). If kill fires, execute kill actions D-21 before proceeding to step 4.
  4. Run cross-phase integration check (existing).
  5. Generate `.planning/milestones/v{N}/SUMMARY.md` (existing; summary mentions kill verdict if fired).
  6. Ingest from VTP (existing).
  7. Publish to VTP (existing).
  8. Archive phases (existing).
  9. Bump STATE.md (existing).
- **D-23a** — Step 3 placement is deliberate: BEFORE the cross-phase integration check and summary generation, so the summary reflects the final kill state. If placed after summary gen, the summary would be stale.

### Plan Decomposition (D-24 through D-26)

- **D-24** — Five plans, all v2 schema:
  - **15-01 provider-indirection-wire** — CODEX-07 (SKILL.md Step 6.5 + 9.5 rewire, gates.yaml flip, fallback path). Touches `sgsd-orchestrate/SKILL.md` and `gates.yaml`.
  - **15-02 qualitative-muda-probe** — CODEX-08 + CODEX-09 (sgsd-muda-audit.sh 4th probe, new `qualitative-waste-audit` gate row, `mechanical_muda_verdict` dispatch context field in predicate-eval.cjs).
  - **15-03 quota-offload-metric** — CODEX-10 (token-log.jsonl provider field, sgsd-token-audit dashboard tile, SKILL.md Step 11 row schema update).
  - **15-04 cross-vendor-adversarial** — CODEX-11 (SKILL.md Step 9.6 challenger provider rewire, skip-on-unavailable path).
  - **15-05 kill-condition-and-sgsd-complete-milestone-wire** — CODEX-12 (sgsd-token-audit --milestone-close-check subcommand, sgsd-complete-milestone step insertion, kill action D-21).
- **D-25** — Wave model:
  - **Wave 1 parallel** = {15-02, 15-03}. Disjoint files: 15-02 touches `sgsd-muda-audit.sh` + `gates.yaml` + `predicate-eval.cjs`; 15-03 touches `token-log` schema + `sgsd-token-audit/SKILL.md` + `sgsd-orchestrate/SKILL.md` Step 11. The Step 11 touchpoint is a one-line schema comment — no collision risk with 15-01's Step 6.5/9.5 edits.
  - **Wave 2 solo** = {15-01}. Primary rewire. Touches Steps 6.5 + 9.5 of `sgsd-orchestrate/SKILL.md`. Serializes against all other SKILL.md-touching plans.
  - **Wave 3 solo** = {15-04}. Step 9.6 rewire. Serializes after 15-01 because both touch `sgsd-orchestrate/SKILL.md` and the file-coupling discipline (Phase 10 W-2 lesson) forbids concurrent SKILL.md edits.
  - **Wave 4 solo** = {15-05}. Milestone-close wire. Depends on CODEX-10 metric being live (15-03) for the kill check to have data.
  - Four waves. The SKILL.md coupling forces serialization across 15-01/15-04/15-05 even though logically they're independent — this is Phase 10's lesson applied honestly.
- **D-26** — Phase 15 `verify.mjs` invariants (≥8 required):
  1. `gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC` declare `reviewer_provider: codex-cli-reviewer`.
  2. `gates.yaml` row `qualitative-waste-audit` exists with the correct trigger per D-10.
  3. `sgsd-muda-audit.sh` invokes `codex-exec.sh` when `CODEX_QUAL_ENABLED=true`.
  4. `sgsd-orchestrate/SKILL.md` Steps 6.5 and 9.5 reference `gates.resolveReviewerProvider` and the shell-invocation branch.
  5. `token-log.jsonl` schema (as documented in SKILL.md Step 11) includes the `provider` field.
  6. `sgsd-token-audit` emits a `claude_tokens_saved_by_codex` value (on a synthetic fixture).
  7. `sgsd-orchestrate/SKILL.md` Step 9.6 challenger dispatch references the non-primary-vendor provider.
  8. `sgsd-complete-milestone` includes the `--milestone-close-check` invocation in its step list.
  9. (Bonus) Running `sgsd-token-audit --milestone-close-check --dry-run` with synthetic data exits 0 and emits a JSON verdict `{"kill": false, "reason": "..."}`.

### Out of Scope (D-27)

- **D-27** — Explicitly deferred:
  - Third-provider support (Gemini, local). Registry supports, but first-real-data discipline applies — see DLB-02.
  - Per-project provider overrides.
  - Refactoring `sgsd-code-reviewer.md` (Sonnet) — stays as default/fallback, unchanged.
  - Codex in classifier or primary verifier — scope-discipline (brief constraint).
  - Auto-tune of `verifier_adversarial_rate` — Phase 12 already deferred this; not revived here.
  - A UI for reviewing Codex findings — `.planning/metrics/codex-log.jsonl` + `WASTE.md` + `commit-reviews.jsonl` are the operator-facing surfaces.
  - Full billing reconciliation for the offload metric — D-13a calls out it's an estimate. Real billing audit is out-of-scope for v1.3.
</decisions>

<specifics>
## References Used

- **Phase 14 D-05..D-08** — registry schema shape is Phase 14's output; Phase 15 consumes it verbatim.
- **Phase 10 D-10c** — predicate-eval field registry extension; CODEX-09 D-10a follows pattern.
- **Phase 10 D-11** — edge-guard log-only default with `escalation: halt` opt-in; CODEX-09 stays `escalation: log-only`.
- **Phase 12 D-13..D-15** — adversarial verifier sampling + rate tuning; CODEX-11 layers cross-vendor on top of this without changing the rate.
- **DLB-02 kill discipline** — MUDA skill retirement if zero recurrence across 2 milestones. CODEX-12 applies the same discipline to the Codex provider itself.
- **Golden Rule 13** (`sgsd-orchestrate/SKILL.md:1213-1221`) — phase-ATC failure semantics in auto mode (log + continue). CODEX-07 D-02c's DOUBLE_FAIL is the narrow exception (can't review = can't certify, genuine blocker).
- **`sgsd-complete-milestone`** (Phase 13 13-05) — milestone-close hook extension target.
</specifics>

<deferred>
## Deferred Ideas

- **Dual-provider by default for phase-ATC** — both Claude and Codex review every phase, findings unioned. Doubles reviewer cost but catches class-of-blind-spot failures per-phase instead of only on 20% adversarial samples. Reopen if CODEX-12 data shows Codex-alone is under-delivering on quality lift.
- **Per-finding confidence weighting** — each reviewer self-rates confidence; synthesis weights by confidence. GOV-02 precedent from Phase 13. Reopen post-v1.3 if raw find-counts prove noisy.
- **Codex-specific prompt tuning** — current design reuses Claude's prompt verbatim. Codex may perform better with a model-specific prompt shape (more structured, different few-shot examples). Defer until post-v1.3 empirical data; premature optimisation otherwise.
- **Milestone-close kill thresholds self-tuning** — auto-adjust `kill_critical_count_delta` and `kill_claude_tokens_saved` based on rolling-3-milestone averages. Defer; static thresholds are honest until data proves otherwise.
- **Adversarial challenger on primary-verifier failures** (not just passes) — current MACH-04 samples only PASS verdicts. Extending to FAIL verdicts for "are we sure it actually failed" review has signal value but also cost. Defer.
- **Cross-vendor deliberation** — Codex as a board member in `/sgsd-deliberate`. Could be Contrarian or a new Challenger role. Much larger scope; defer to v1.4+.
- **Provider-specific report-contract evolution** — Codex may want to return richer output (e.g., proposed patches). v1.3's `code-reviewer-v1` is deliberately narrow. Defer contract v2 until a concrete need surfaces.
</deferred>

<next_steps>
## Next Steps

**Pre-activation** (while v1.2 still open / Phase 14 not yet shipped):
1. Operator reviews this CONTEXT draft alongside Phase 14's. Edit in place.
2. Research task (can be done any time): quantify current Claude code-reviewer token burn per phase using `.planning/metrics/token-log.jsonl` from v1.1/v1.2. Seeds CODEX-10 / CODEX-12 threshold calibration.

**Activation flow** (after Phase 14 closes):
1. `/sgsd-discuss-phase 15` — consumes this CONTEXT as starting decision log.
2. `/gsd-plan-phase 15` — generates 5 plans per D-24. Wave model per D-25.
3. `/sgsd-orchestrate go` — Wave 1 parallel (15-02 + 15-03), then Wave 2 (15-01), then Wave 3 (15-04), then Wave 4 (15-05).

**Phase 15 success =** all 6 CODEX requirements green + Phase 15 verify.mjs ≥8 invariants pass + at least one real phase run produces a `commit-reviews.jsonl` row with `provider: "openai-codex"` + `sgsd-token-audit` dashboard shows a non-zero `claude_tokens_saved_by_codex` value.

**v1.3 milestone close triggers** CODEX-12 kill-check via `sgsd-complete-milestone`. If kill fires: v1.3 ships with Codex retired; framework keeps substrate but operator restarts v1.4 with `codex_enabled: false` until new data justifies reopening.
</next_steps>
