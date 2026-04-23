# Phase 14: Codex CLI Provider Substrate — Context

**Drafted:** 2026-04-23 (staged pre-v1.2-close) · **Activated:** 2026-04-23 (moved into `.planning/milestones/v1.3/phases/` post-Phase-16-ship via `/gsd-discuss-phase 14` Option A — operator accepted staged context as-is with one deferral addendum)
**Status:** Active — decisions D-01..D-24 locked. Ready for `/gsd-plan-phase 14`.
**Prerequisites:** Phase 13 (Governance) shipped ✓. Phase 16 (VTP Enrichment) shipped ✓ — adds a VTP-awareness question for Phase 15 resolved in `<deferred>`.

**Phase 16 integration note (added 2026-04-23):** Phase 16 shipped the VTP cross-phase primitive (composer, `callVtp` wrapper, `VTP-EVIDENCE.md` per-phase artifact, triage Step 0 enrichment). Phase 14 is **substrate-only, ships dark** — it does NOT consume VTP evidence. The question of whether `sgsd-codex-reviewer` reads `VTP-EVIDENCE.md` before running a review is a **Phase 15 decision** (see `<deferred>` entry). Keeping Phase 14 VTP-agnostic preserves the substrate-first discipline that v1.2 proved (Phase-147 silent-drift kill).

<domain>
## Phase Boundary

Phase 14 ships the **reviewer-provider abstraction** that lets any `gates.yaml` row route code review to Claude (via `Agent()`) OR Codex (via `codex exec`) without the gate layer caring which is running. Phase 14 ships **dark** — `codex_enabled: false` in `config.json` means no auto run routes to Codex. Phase 15 flips the switch.

Six deliverables (CODEX-01 through CODEX-06):

1. **CODEX-01** — `super-gsd/scripts/codex-exec.sh` wrapper with timeout, JSONL provenance, <300-word report parsing.
2. **CODEX-02** — `super-gsd/registry/review-providers.yaml` registry declaring the two initial providers (`claude-sonnet-reviewer`, `codex-cli-reviewer`) with their invocation contracts.
3. **CODEX-03** — `gates.yaml` schema extension: optional `reviewer_provider:` field on each row. `gates-registry.cjs` resolves it.
4. **CODEX-04** — `super-gsd/agents/sgsd-codex-reviewer.md` stub mirroring the `sgsd-code-reviewer` report contract exactly.
5. **CODEX-05** — `super-gsd/tools/provider-contract/contract-check.mjs` mechanical harness that runs Claude + Codex on the same toy diff and asserts identical evidence emission.
6. **CODEX-06** — `config.json` gains `review_providers` block, defaults to Claude, Codex-enabled flag false.

**Not in scope** (defers to Phase 15):
- Actually routing any `gates.yaml` row to Codex (all rows keep `reviewer_provider: claude-sonnet-reviewer` or omit the field for Claude default).
- The qualitative MUDA probe (CODEX-08).
- `token-log.jsonl` `provider` field (CODEX-10 — lives in Phase 15 because it's only useful once Codex is actually firing).
- Cross-vendor adversarial challenger rewire (CODEX-11).
- Milestone-close kill condition (CODEX-12).

**Not in scope** (defers post-v1.3):
- Gemini, local model, or any third provider (CODEX-02 registry is extensible but ships 2-provider only).
- Per-project provider overrides (`.planning/review-providers.override.yaml`).
- Runtime provider swap mid-phase (no `--reviewer-provider codex` CLI flag; phase-scoped config only).
</domain>

<canonical_refs>
## Canonical References

- `super-gsd/registry/gates.yaml` — target of CODEX-03. Two rows already declare `reviewer_agent: sgsd-code-reviewer` (`per-dispatch-ATC` line 52, `phase-level-ATC` line 65). The new `reviewer_provider:` field is optional; absence defaults to `claude-sonnet-reviewer`.
- `super-gsd/scripts/lib/gates-registry.cjs` — cache singleton loaded at cold-start Step 3.6 (see `sgsd-orchestrate/SKILL.md:107-120`). Adds a `resolveProvider(gate)` method that reads the new field.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` Steps 6.5 (line 440), 9.5 (line 800), 9.6 (line 852) — all three currently hardcode `Agent(subagent_type: "sgsd-code-reviewer" OR "gsd-verifier", model: "sonnet", ...)`. Phase 14 does NOT touch these hardcoded dispatches — that's Phase 15's job. Phase 14 only adds the registry + wrapper + contract harness so Phase 15 can flip them safely.
- `super-gsd/scripts/sgsd-muda-audit.sh` — existing shell-out-to-external-tool precedent (lines 102-119 probe shell-out + 232-302 curate shell-out). Wrapper style for CODEX-01 follows this shape.
- `super-gsd/scripts/sgsd-recall.sh` + `sgsd-curate.sh` — same shell-CLI pattern with root-detection + atomic writes. CODEX-01 inherits their `@file:` IPC-guard pattern (see `sgsd-orchestrate/SKILL.md:124-135`).
- `super-gsd/agents/sgsd-board-contrarian.md` — agent-stub template (prompt contract, report format). CODEX-04's `sgsd-codex-reviewer.md` follows this shape but declares the execution primitive is external.
- `.planning/config.json` line 68-78 (`atc:` block) — precedent for how config keys are referenced by gates.yaml runtime knobs. CODEX-06's `review_providers:` block follows the same convention.
- `.claude/skills/gsd-review/SKILL.md` — existing cross-AI CLI precedent. Description: "Request cross-AI peer review of phase plans from external AI CLIs." CODEX-01 and CODEX-04 reuse patterns from this skill; Phase 14 does NOT modify this skill (it's a plan-review surface, not a gate-layer surface).
- `super-gsd/tools/phase-verifier/phase-verifier.mjs` — existing mechanical verifier tool. CODEX-05's `contract-check.mjs` follows the same shape (exit-code discipline, stdout JSON report, no sub-agent).
- **Codex CLI docs** — to be verified during research phase. Key unknowns: exact `codex exec` flag set, stdin contract, output format, auth env var name. These drive CODEX-01's wrapper design.
</canonical_refs>

<decisions>
## Implementation Decisions

### CODEX-01 — Codex CLI Wrapper (D-01 through D-04)

- **D-01** — Wrapper script at `super-gsd/scripts/codex-exec.sh`. Shell (bash) for cross-platform — WSL on Windows, native on macOS/Linux. Invocation pattern:
  ```
  super-gsd/scripts/codex-exec.sh \
    --prompt-file <path> \
    --timeout 30 \
    --report-out <path> \
    [--dry-run] [--project <path>]
  ```
  Reads prompt from file (stdin alternative rejected — bash stdin pipes are fragile in Codex CLI based on existing `sgsd-muda-audit.sh` experience with `codex`/similar CLIs; file-based IPC is the proven pattern).
- **D-01a** — Exit codes inherit from Codex CLI when present; wrapper-specific exits: `3` = CLI not found, `4` = auth failure, `5` = timeout, `6` = report format violation (agent didn't emit the required <300-word contract). Each maps 1:1 to a `GATE_PROVIDER_FALLBACK` sub-category so Phase 15 can distinguish drift flavours.
- **D-01b** — Timeout default `30s`. Tunable via `--timeout` flag AND via `config.review_providers.codex_timeout_seconds`. Wrapper reads config first, CLI flag overrides. No per-invocation timeout override from the orchestrator — it goes through the config knob.
- **D-01c** — Every invocation appends one row to `.planning/metrics/codex-log.jsonl`:
  ```json
  {"ts":"ISO","phase":N,"plan":"NN-PP","step":6.5|9.5|9.6|6.55,"exit":N,"duration_ms":N,"prompt_bytes":N,"report_bytes":N,"timeout_hit":bool,"fallback_triggered":bool}
  ```
  Fields are provenance-only; no model output content logged (privacy + size discipline). The `fallback_triggered` field is written by the orchestrator AFTER the wrapper exits, not by the wrapper itself.
- **D-02** — Auth: **OAuth-only**, respecting D006 (no API keys). Wrapper sets `CODEX_AUTH_MODE=oauth` env var (or whatever Codex CLI's equivalent is — to be confirmed during research). API-key env vars (`OPENAI_API_KEY` etc.) are **explicitly unset** inside the wrapper to prevent accidental inheritance from the parent shell.
- **D-02a** — If the CLI has no `CODEX_AUTH_MODE` concept and just uses whichever auth is available: wrapper detects presence of `OPENAI_API_KEY` env var and **refuses to run**, emitting exit 4 + a message "remove OPENAI_API_KEY from env; this wrapper is OAuth-only per D006." Hard constraint — better to fail loud than silently burn API credits.
- **D-03** — Report contract: wrapper expects Codex to emit exactly:
  ```
  FINDINGS: <list or "none">
  CRITICAL: <count> — <short list>
  WARNINGS: <count> — <short list>
  PASS_RATE: <pct>
  ONE_LINER: <single sentence>
  ```
  Same shape as current `sgsd-code-reviewer` output. Wrapper parses this with a small awk/sed pipeline; on parse failure emits exit 6 with the first 200 bytes of malformed output to `.planning/metrics/codex-log.jsonl` debug field. Zero tolerance for drift here — downstream `commit-reviews.jsonl` schema depends on exact field names.
- **D-04** — Windows compatibility: wrapper is bash, runs under WSL. PowerShell wrapper (`codex-exec.ps1`) deferred post-v1.3 unless operator hits a WSL-unavailable machine. The install.sh already assumes WSL on Windows for all shell scripts; this follows suit.
  - **D-04a** — Path translation: wrapper takes `--project` paths in WSL form. If the orchestrator calls it with a Windows path (`C:\Users\...`), the wrapper translates via `wslpath -u` before passing to Codex CLI. This is the same translation `sgsd-curate.sh` already does — reuse, don't reinvent.

### CODEX-02 — Reviewer-Provider Registry (D-05 through D-08)

- **D-05** — Registry file at `super-gsd/registry/review-providers.yaml`. Schema:
  ```yaml
  schema_version: 1
  registry_version: 1.0.0
  last_updated: 2026-04-NN

  providers:
    - name: claude-sonnet-reviewer
      invocation_type: agent                    # dispatched via Agent() primitive
      agent_subagent_type: sgsd-code-reviewer
      agent_model: sonnet
      report_contract: code-reviewer-v1
      auth: claude-max-oauth
      timeout_seconds: 60
      fallback_to: null                         # Claude IS the fallback; has no further fallback
      state: active

    - name: codex-cli-reviewer
      invocation_type: shell                    # shelled via scripts/codex-exec.sh
      shell_script: super-gsd/scripts/codex-exec.sh
      report_contract: code-reviewer-v1         # must match claude-sonnet-reviewer contract
      auth: codex-pro-oauth
      timeout_seconds: 30
      fallback_to: claude-sonnet-reviewer       # single-retry fallback target
      state: active
  ```
- **D-05a** — `report_contract: code-reviewer-v1` is a named contract version. If Phase 15+ introduces a v2 contract (e.g., with cross-file findings), both providers must advertise v2 or downstream parsing rejects them. Contract versioning is the drift-protection surface.
- **D-06** — `gates-registry.cjs` loads `review-providers.yaml` at cold-start Step 3.6 (same time as `gates.yaml`). Exposes `getProvider(name) → providerRecord`. O(1) lookups.
- **D-06a** — Unknown provider name = hard error at cold-start (not lazy-evaluated). Catches typos in `gates.yaml` rows before any phase dispatch fires.
- **D-07** — The `invocation_type` discriminator is load-bearing. Orchestrator Step 6.5/9.5/9.6 (Phase 15 rewire) will branch on it:
  - `agent`: `Agent(subagent_type, model, ...)` — current path, unchanged for Claude.
  - `shell`: shell-out via `shell_script` path, parse report from stdout — new path for Codex.
  - Future: `mcp`, `http` — reserved but not implemented.
- **D-08** — Registry is **read-only** in v1.3. No `sgsd-provider-add` skill, no runtime mutation. Adding a provider = hand-edit the YAML + bump `registry_version`. Same discipline as DLB-04 operator-gated SEPL: infrastructure registries don't self-modify.

### CODEX-03 — `gates.yaml` Schema Extension (D-09 through D-11)

- **D-09** — Add optional `reviewer_provider:` field to every `gates.yaml` row whose enforcement_mode involves a reviewer. Default when absent: `claude-sonnet-reviewer` (the current Claude path). Phase 14 ships the schema change but sets the field to `claude-sonnet-reviewer` on all existing rows so diff is explicit and revertable.
- **D-09a** — Fields touched (all already exist; just add the new field):
  - `per-dispatch-ATC` (line 37-58): add `reviewer_provider: claude-sonnet-reviewer`.
  - `phase-level-ATC` (line 60-71): add `reviewer_provider: claude-sonnet-reviewer`.
  - No other row gets the field (classifier, context-selector, MUDA, curate, token-log — none are reviewer-shaped).
- **D-10** — `gates-registry.cjs` gains `resolveReviewerProvider(gateName) → providerRecord` method. Reads the `reviewer_provider` field from the gate row, looks up the provider in the registry from CODEX-02. Returns `null` if the gate has no reviewer field (i.e., not a reviewer-shaped gate). O(1) given both registries are cache-singletons.
- **D-10a** — Predicate-eval (`predicate-eval.cjs`) is untouched. Provider resolution happens AFTER `shouldFire` returns true — it's not part of the trigger evaluation, it's part of the dispatch routing that follows. Cleanly separated concerns.
- **D-11** — `sgsd-orchestrate/SKILL.md` Step 6.5 / 9.5 / 9.6 are **not modified** in Phase 14. They continue dispatching `Agent(subagent_type: "sgsd-code-reviewer", ...)` as today. The registry exists and is resolvable, but no orchestrator code reads it yet. This is deliberate — Phase 14 is pure substrate, zero behaviour change.
  - **D-11a** — The choice to NOT modify SKILL.md in Phase 14 was load-bearing in the milestone-scoping brief (Key Question 1). Collapsing SKILL.md changes into Phase 14 would reintroduce the Phase-147 silent-drift failure mode. Hard line.

### CODEX-04 — `sgsd-codex-reviewer` Agent Stub (D-12 through D-13)

- **D-12** — New agent definition at `super-gsd/agents/sgsd-codex-reviewer.md`. Shape mirrors `super-gsd/agents/sgsd-board-contrarian.md`:
  ```markdown
  ---
  name: sgsd-codex-reviewer
  description: "External code reviewer backed by Codex CLI (OAuth). Mirrors sgsd-code-reviewer report contract."
  invocation: shell
  shell_script: super-gsd/scripts/codex-exec.sh
  report_contract: code-reviewer-v1
  ---

  <objective>
  Run ATC 7-step + 10-point anti-slop review against the provided diff. Emit identical report format to sgsd-code-reviewer. No prose freelancing — report contract is mechanical.
  </objective>

  <inputs>
  - phase: N
  - scope: phase-level | per-dispatch
  - tier: lite | full | gate
  - diff_summary: <git diff --stat output>
  - plans_completed: [list]
  - checks: <task-specific check list>
  </inputs>

  <output>
  FINDINGS | CRITICAL | WARNINGS | PASS_RATE | ONE_LINER
  </output>

  <boundaries>
  - No external network calls beyond Codex CLI.
  - No file writes; report is the only output.
  - Max 300 words. Report-only; no preamble.
  </boundaries>
  ```
- **D-12a** — The `invocation: shell` frontmatter field is new for SGSD — existing agents are all `invocation: agent` (implicit). This field is added to the agent-definition schema for the first time in Phase 14. Agents with `invocation: shell` are NOT dispatched via `Agent()`; they're dispatched via the registry's `shell_script` path. Phase 15 will teach `sgsd-orchestrate` to honour this; Phase 14 just lands the schema.
- **D-13** — The report contract `code-reviewer-v1` is declared once in `review-providers.yaml` AND restated in this agent file. Canonical source is the registry; agent file is documentation for humans. Drift between them is caught by CODEX-05's contract-check harness.

### CODEX-05 — Contract-Check Harness (D-14 through D-17)

- **D-14** — New tool at `super-gsd/tools/provider-contract/contract-check.mjs`. Node.js (consistent with `phase-verifier.mjs`). Exit codes: `0` = both providers emit valid + compatible reports, `1` = divergence (details in stderr), `2` = tool error (missing binary, auth failure, etc.).
- **D-14a** — Input: a toy diff fixture committed to `super-gsd/tools/provider-contract/fixtures/toy-diff.patch`. Intentionally contains:
  - 1 obvious bug (off-by-one in a loop)
  - 1 YAGNI item (unused helper function)
  - 1 nit (trailing whitespace)
  Reviewers should agree on all 3 at `CRITICAL: 1, WARNINGS: 2`. The fixture is the shared ground truth for both providers.
- **D-15** — Harness flow:
  1. Dispatch Claude review via `Agent(subagent_type: "sgsd-code-reviewer", ...)` with the fixture as input. Capture report.
  2. Dispatch Codex review via `codex-exec.sh` with the same fixture. Capture report.
  3. Parse both reports against the `code-reviewer-v1` schema (field-presence check, type check, word-count bound).
  4. Assert both report structures parse cleanly.
  5. Emit a JSON summary to stdout:
     ```json
     {"claude":{"parsed":true,"critical":N,"warnings":N,"one_liner":"..."},
      "codex": {"parsed":true,"critical":N,"warnings":N,"one_liner":"..."},
      "divergence":{"both_parsed":true,"critical_match":bool,"warnings_match":bool}}
     ```
- **D-15a** — Divergence is **informational, not assertive**. Two reviewers finding different things on the same diff is the whole point of dual-provider review. The harness asserts both parsed cleanly and both produced valid structured output. It does NOT assert the findings are identical.
- **D-16** — Harness is run by Phase 14's verifier (`verify.mjs`) as one invariant: "contract-check.mjs exits 0 on the toy fixture." If Phase 15 subsequently rewires gates to Codex, Phase 15's verifier re-runs the harness — it becomes a regression gate for the registry + wrapper boundary.
- **D-17** — Harness requires BOTH Codex CLI installed AND Claude CLI available. On a Codex-only machine (no Claude), harness exits `2` with a descriptive message. Phase 14's verifier allows this exit path to pass in environments where Claude Max is absent — since those machines couldn't run SGSD anyway, it's a weak constraint.

### CODEX-06 — `config.json` Block (D-18 through D-20)

- **D-18** — Add `review_providers` block to `.planning/config.json`:
  ```json
  "review_providers": {
    "default_provider": "claude-sonnet-reviewer",
    "codex_enabled": false,
    "codex_cli_path": "auto-detect",
    "codex_timeout_seconds": 30,
    "fallback_on_error": true,
    "fallback_max_retries": 1
  }
  ```
- **D-18a** — `default_provider` is the fallback when a `gates.yaml` row has no `reviewer_provider:` field. Keeps behaviour identical for any row that hasn't opted into Codex.
- **D-18b** — `codex_enabled: false` is the kill-switch. Even if a gate row declares `reviewer_provider: codex-cli-reviewer`, the orchestrator (Phase 15) will honour `codex_enabled: false` and route to Claude. This is the Phase-14-ships-dark guarantee.
- **D-18c** — `codex_cli_path: auto-detect` means the wrapper runs `which codex` at startup. Operators can override with an absolute path if they have multiple Codex installs.
- **D-19** — Add the new config keys to the `KNOWN_TOP_LEVEL` Set in gsd-tools (same discipline as Phase 10 D-13b — unknown keys emit warnings). Ship the patch via the existing `patch-gsd-tools-known-keys.sh` script from Phase 12.
- **D-20** — Config reads: `gates-registry.cjs` reads `review_providers.*` at cold-start Step 3.6 and caches. Any runtime change to config requires a fresh orchestrator session.

### Plan Decomposition (D-21 through D-23)

- **D-21** — Four plans, all v2 schema:
  - **14-01 codex-exec-wrapper** — CODEX-01 (`codex-exec.sh` + codex-log.jsonl schema + D-02 auth hygiene + D-04 WSL path translation).
  - **14-02 provider-registry** — CODEX-02 (`review-providers.yaml` + gates-registry.cjs `getProvider/resolveReviewerProvider` + D-06a typo-catches) AND CODEX-03 (`gates.yaml` adds `reviewer_provider:` field to 2 rows, defaults to claude-sonnet-reviewer) AND CODEX-04 (`sgsd-codex-reviewer.md` agent stub + `invocation:` frontmatter field).
  - **14-03 config-and-known-keys** — CODEX-06 (`config.json` `review_providers` block + KNOWN_TOP_LEVEL patch).
  - **14-04 contract-check-harness** — CODEX-05 (`contract-check.mjs` + fixture + Phase 14 `verify.mjs` invariant).
- **D-22** — Wave model:
  - **Wave 1 parallel** = {14-01, 14-03}. `codex-exec.sh` and `config.json` block are disjoint — different files, no shared dependency. Safe to fan out.
  - **Wave 2 solo** = {14-02}. Depends on CODEX-01 (registry declares the shell_script path that 14-01 ships) and CODEX-06 (registry reads `review_providers.*` config added by 14-03). Serial after Wave 1.
  - **Wave 3 solo** = {14-04}. Contract-check harness depends on ALL of {wrapper, registry, agent stub, config}. Serial after Wave 2.
  - Three-wave dispatch plan. Matches Phase 12 D-23 discipline: serialize where coupling exists, parallelize where files are genuinely disjoint.
- **D-23** — Phase 14 `verify.mjs` invariants (≥6 required):
  1. `super-gsd/scripts/codex-exec.sh` exists and is executable + parses with `bash -n`.
  2. `super-gsd/registry/review-providers.yaml` exists, parses as YAML, has both providers with `state: active`.
  3. `gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC` both declare `reviewer_provider: claude-sonnet-reviewer`.
  4. `super-gsd/agents/sgsd-codex-reviewer.md` exists and has required frontmatter keys.
  5. `.planning/config.json` has `review_providers.codex_enabled === false` (Phase 14 ships dark).
  6. `super-gsd/tools/provider-contract/contract-check.mjs` exits 0 on the toy fixture (skipped in environments where either CLI is absent — exit 2 allowed).

### Out of Scope (D-24)

- **D-24** — Explicitly deferred:
  - Any modification of `sgsd-orchestrate/SKILL.md` Step 6.5 / 9.5 / 9.6 (Phase 15).
  - Qualitative MUDA probe (Phase 15 CODEX-08).
  - `token-log.jsonl` provider field (Phase 15 CODEX-10 — no value until Codex is firing).
  - Cross-vendor adversarial challenger routing (Phase 15 CODEX-11).
  - Kill-condition metric + retire logic (Phase 15 CODEX-12).
  - Gemini / local-model provider entries in `review-providers.yaml` (post-v1.3).
  - PowerShell-native wrapper `codex-exec.ps1` (post-v1.3, WSL-first in v1.3).
  - Per-project provider override (`.planning/review-providers.override.yaml`) (post-v1.3).
</decisions>

<specifics>
## References Used

- **Phase 10 D-01..D-09** — gate-row population discipline. CODEX-03 follows the same per-row explicit-default pattern.
- **Phase 10 D-13b** — KNOWN_TOP_LEVEL schema extension precedent. CODEX-06 D-19 reuses the same patch-gsd-tools script.
- **Phase 12 D-01..D-04** — classifier-cache sidecar pattern. CODEX-01's `codex-log.jsonl` provenance row follows the same append-only JSONL discipline.
- **Phase 12 D-23** — "serial where coupling exists, parallelize where disjoint" wave discipline. CODEX D-22 follows verbatim.
- **DLB-04 operator-gated SEPL** — CODEX-02 D-08 (no self-mutation of the provider registry) is the same discipline.
- **`sgsd-muda-audit.sh`** — external-CLI shell-out pattern (Codex wrapper mirrors shape).
- **`sgsd-board-contrarian.md`** — agent-stub shape. CODEX-04 reuses frontmatter + XML block structure.
</specifics>

<deferred>
## Deferred Ideas

- **Codex + Claude dual-dispatch on every phase-ATC** (Key Question 2 option b) — double the reviewer token cost but gets cross-vendor signal for free on every phase, not just adversarial samples. Defer to Phase 15 discuss; if CODEX-12 shows Codex-alone isn't catching enough additional issues, dual-dispatch is the upgrade path.
- **Per-project provider overrides** — `.planning/review-providers.override.yaml` that layers over the super-gsd default. Useful for projects that want Codex on Python but Claude on TypeScript. Not needed for v1.3; super-gsd ships the canonical policy.
- **Runtime provider swap CLI flag** — `/sgsd-orchestrate go --reviewer-provider codex`. Useful for debug sessions. Out of scope v1.3; config is phase-scoped.
- **Provider health check skill** — `/sgsd-provider-health` that probes each provider with a ping fixture and reports auth + latency. Nice for operator ergonomics. Defer until a provider outage bites.
- **Multi-provider report aggregation** — a synthesis step that merges Claude + Codex findings into a single report for gates that want the union. Defer; Phase 15 CODEX-07 keeps it simple with primary-provider + fallback.
- **`codex-exec.ps1` native PowerShell wrapper** — for operators without WSL. Defer; WSL-first in v1.3.
- **VTP evidence consumption by Codex reviewer (post-Phase-16 integration)** — Phase 16 shipped the VTP cross-phase primitive (`super-gsd/scripts/lib/vtp-context-composer.cjs`, `VTP-EVIDENCE.md` per-phase artifact, `callVtp` wrapper). The `sgsd-codex-reviewer` agent stub (CODEX-04) and `codex-exec.sh` wrapper (CODEX-01) COULD be taught to read `VTP-EVIDENCE.md` and pass its framing (`selected_query`, top-3 doc-IDs) as prompt-file context, giving Codex reviews cross-project pattern awareness on par with Claude reviewers post-Phase-16. **Deferred to Phase 15** — Phase 14 explicitly ships substrate-only / zero-behaviour-change (per D-11/D-24), and forward-compatible VTP wiring now would pre-commit Phase 15's live-routing design (e.g., `--vtp-evidence` arg on codex-exec.sh, `vtp_consumes:` field on review-providers.yaml) without real routing pressure to pick the right shape. If Phase 15's discuss decides Codex reviews should be VTP-grounded, the wrapper + registry + agent stub get the relevant knobs at that time — not earlier. Phase-14 ships VTP-agnostic; Phase 16's primitive is available if/when Phase 15 wants it.
</deferred>

<next_steps>
## Next Steps

**Pre-activation** (while v1.2 still open):
1. Operator reviews this CONTEXT draft and the sibling BRIEF. Edit `.planning/proposals/v1.3-multimodal-review/*.md` in place.
2. Research task (pre-v1.3): verify exact Codex CLI invocation (`codex exec` flag set, stdin vs file-prompt, auth env var name, non-interactive mode). This seeds CODEX-01 D-01 / D-02 / D-03. Can be done any time — doesn't block v1.2.

**Activation flow** (after v1.2 closes):
1. `/gsd-new-milestone v1.3` — reads `.planning/proposals/v1.3-multimodal-review/BRIEF.md`, seeds `.planning/PROJECT.md` Next-Milestone-Goals, moves proposal dir contents into the active milestone location.
2. `/sgsd-discuss-phase 14` — consumes this CONTEXT file verbatim as the starting decision log. Re-litigates any Key Question from the BRIEF flagged `pending` against Codex CLI research data.
3. `/gsd-plan-phase 14` — generates 4 plans per D-21. Wave model per D-22.
4. `/sgsd-orchestrate go` — Wave 1 parallel (14-01 + 14-03), then Wave 2 (14-02), then Wave 3 (14-04).

**Phase 14 success =** all 6 CODEX requirements green + Phase 14 verify.mjs ≥6 invariants pass + contract-check harness PASS on toy fixture + no gate row actually routed to Codex yet (substrate ships dark per D-11/D-18b).
</next_steps>
