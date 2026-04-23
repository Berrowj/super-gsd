---
phase: 14
phase_name: Codex CLI Provider Substrate
researched: 2026-04-23
confidence: HIGH
vtp_mode: BYPASSED
---

# Phase 14 — Research (Codex CLI Provider Substrate)

Scope per `14-CONTEXT.md` D-01..D-24: wrapper + registry + agent stub + contract harness + config block; ships dark. VTP bypassed per `14-VTP-EVIDENCE.md` — no `mcp__vtp-kb__*` calls; evidence is codebase paths + official Codex docs only.

---

## 1. Codex CLI contract findings

### 1a. `codex exec` invocation shape [VERIFIED: developers.openai.com]

- Prompt input: **positional `PROMPT` argument OR stdin via `-`** — "`PROMPT` accepts string | `-` (read stdin)". There is **no `--prompt-file` flag**. CODEX-01 D-01 states "prompt from file" — wrapper must `cat <file> | codex exec -` (pipe) or pass the file contents as a positional arg. **Pipe-from-stdin is the idiomatic form** per [CLI reference](https://developers.openai.com/codex/cli/reference).
- JSON mode: `--json` (alias `--experimental-json`) emits newline-delimited JSON events; without it, stderr gets progress, stdout gets **only the final assistant message**. For the CODEX-01 D-03 parse pipeline, **plain mode is sufficient and preferred** (one FINDINGS/CRITICAL/... block on stdout, no JSON-event reassembly required).
- Final-message capture: `--output-last-message, -o <path>` writes the assistant's final message to a file. Useful as an alternative to stdout parsing if buffering becomes an issue.
- Working dir: `--cd, -C <path>` sets workspace root.
- Sandbox: `--sandbox {read-only | workspace-write | danger-full-access}`. For a review (no file writes), **`--sandbox read-only`** is the right pick — reviewer can't mutate the diff being reviewed.
- Automation preset: `--full-auto` = workspace-write + on-request approvals. **Don't use for reviewer** (wrong sandbox). Use `--sandbox read-only` explicitly.
- Bypass guards: `--dangerously-bypass-approvals-and-sandbox` (alias `--yolo`). **Do not use**.
- Git check: `--skip-git-repo-check` bypasses the "must run inside git repo" guard.
- Session persistence: `--ephemeral` skips rollout-file writes. **Recommended for CODEX-01** (reviewer sessions are one-shot, no need to persist).
- **No built-in `--timeout` flag**. Wrapper must use GNU `timeout` ([per issue #7353](https://github.com/openai/codex/issues/7353)). GNU timeout's own exit convention is **124 on timeout** — D-01a reserves wrapper exit `5` for timeout, so wrapper should trap 124 and remap.

Sources: [exec subcommand reference](https://developers.openai.com/codex/cli/reference) · [non-interactive guide](https://developers.openai.com/codex/noninteractive) · [exec.md stub](https://github.com/openai/codex/blob/main/docs/exec.md).

### 1b. OAuth hygiene — D-02a is the right shape [VERIFIED: openai/codex#15151]

- Codex CLI has **no `CODEX_AUTH_MODE` env var**. Admin-side config has `forced_login_method = "chatgpt" | "api"` but that's a file-based policy knob, not a runtime env flag.
- **Env precedence: `OPENAI_API_KEY` silently overrides OAuth** ([openai/codex#15151](https://github.com/openai/codex/issues/15151), filed 2026-03-19, **status: OPEN, no fix shipped**). When both are present, the CLI uses the API key and emits a misleading 401 if it's stale.
- OAuth token cached at `~/.codex/auth.json` (or OS credential store if `cli_auth_credentials_store` is set) ([auth docs](https://developers.openai.com/codex/auth)).
- **Implication for CODEX-01**: D-02a's "refuse-to-run when `OPENAI_API_KEY` is set" is exactly right. Additionally, wrapper should `unset OPENAI_API_KEY` before exec'ing codex as a belt-and-braces defence for any sub-shell invocation (Issue #15151 workarounds section recommends this pattern verbatim).

### 1c. Exit code semantics [VERIFIED: official docs + #7353]

| Exit | Meaning | Source |
|------|---------|--------|
| `0` | success | [docs](https://developers.openai.com/codex/noninteractive) |
| non-zero (unspecified) | agent error / auth failure / sandbox violation | [auth](https://developers.openai.com/codex/auth) |
| `124` | **GNU `timeout` wrapper** (not codex itself) | [#7353](https://github.com/openai/codex/issues/7353) |

Codex CLI **does not document a specific exit code contract** (auth failure vs tool error vs model error all collapse to non-zero). **Wrapper-reserved exits 3-6 (CODEX-01 D-01a) don't collide with codex's own 0/non-zero scheme** — but wrapper should never pass codex's non-zero exit through unchanged; always remap via its own table so downstream consumers have a deterministic alphabet.

### 1d. WSL path handling [CITED: developers.openai.com/codex/windows]

- Codex CLI on Windows runs in **two modes**: native Windows sandbox **or** WSL. The official Windows doc says: *"Keep your repositories under your Linux home directory (like ~/code/my-app) for faster I/O and fewer symlink and permission issues."*
- WSL mode **does accept `/mnt/c/...` paths** — that's how it bridges to Windows filesystems — but they're slow and carry permission/symlink footguns. Codex doc's recommendation is POSIX paths.
- **Implication for CODEX-01**: D-04a's `wslpath -u` translation **is correct and necessary** when the wrapper is called from Windows tooling that hands in `C:\Users\...`. If the orchestrator always invokes from a bash/WSL context, translation is a no-op (input already POSIX); if ever called from PowerShell shelling into `wsl bash codex-exec.sh --project 'C:\path'`, the translation is required. Cheap to always apply (idempotent on POSIX inputs).

Sources: [Windows install](https://developers.openai.com/codex/windows) · [WSL setup guide](https://apidog.com/blog/codex-on-windows-wsl/) · [#6521 WSL mandatory](https://github.com/openai/codex/issues/6521).

---

## 2. Codebase pattern findings

### 2a. Shell-wrapper precedent — three-script family

- **Root detection** (auto-discover project root by walking up until `.planning/` or `.brv/context-tree/` found): `super-gsd/scripts/sgsd-muda-audit.sh:57-67`, `sgsd-recall.sh:60-76`, `sgsd-curate.sh:101-126`. Same `while [[ "$d" != "/" ]]` pattern each time. CODEX-01 should copy verbatim.
- **Atomic write via tmp + mv**: `sgsd-muda-audit.sh:226-229` (`mkdir -p; compose > "$tmp"; mv "$tmp" "$WASTE_FILE"`), `sgsd-curate.sh:228-229` + `249-259`. CODEX-01's `--report-out` should follow same idiom when writing the parsed contract report.
- **JSONL append-only provenance**: `sgsd-muda-audit.sh:305-308` — `mkdir -p "$(dirname "$METRICS_LOG")"; printf '{"ts":"%s",...}\n' ... >> "$METRICS_LOG"`. CODEX-01's `codex-log.jsonl` D-01c row should be a single `printf` identical to this, no JSON libs.
- **`--dry-run` discipline**: `sgsd-muda-audit.sh:216-223` — dry-run prints what would happen and exits with probe's exit code; no side effects. CODEX-01 should mirror (dry-run prints composed codex command line + parsed report preview, no actual exec).
- **Arg parsing via while/case**: `sgsd-curate.sh:42-57` is the cleanest template (9 flags). CODEX-01 has 4 flags — same shape.

### 2b. YAML registry / cache-singleton pattern [super-gsd/scripts/lib/gates-registry.cjs]

- **Cache singleton at module scope** (`gates-registry.cjs:29` `let _cache = null`). `loadGates` returns cache if present; first call loads YAML, builds `byName` hash map, caches. CODEX-02's `review-providers.yaml` loader must follow — add `getProvider(name)` + `resolveReviewerProvider(gateName)` to the same module **or** create a sibling `providers-registry.cjs` that reuses the `_cache = null + load-then-return` pattern.
- **js-yaml resolution path** (`gates-registry.cjs:41-44`): `path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml')`. Same require path; do **not** `npm install` a second copy.
- **Schema-versioned frontmatter** (`gates.yaml:14-16`): `schema_version: 2`, `registry_version: 2.0.0`, `last_updated:`. CODEX-02 D-05 matches exactly (`schema_version: 1`, `registry_version: 1.0.0`).
- **Hard-error on unknown name** (`gates-registry.cjs:65-69`): `if (!g) throw new Error(...)`. CODEX-02 D-06a's "unknown provider = hard error at cold-start" matches; use the same throw shape.
- **`resolveReviewerProvider` stub**: there is no existing `resolve*` method on the registry — CODEX-02 adds the first one. Signature should be `(gateName) → providerRecord|null` returning null when the gate has no `reviewer_provider` field (D-10 semantics).

### 2c. Agent-stub frontmatter [super-gsd/agents/sgsd-board-contrarian.md]

Existing frontmatter fields across 19 agents in `super-gsd/agents/`:
- `name:` (required)
- `description:` (required)
- `tools:` (optional — list of Read/Grep/etc.)
- `model:` (optional — sonnet/haiku/opus)
- `color:` (optional — legacy, one file only)

**No agent declares `invocation:` today** ([grep output above confirms]). CODEX-04 D-12a's `invocation: shell` + `shell_script:` + `report_contract:` fields are **net-new** for the agent schema. XML block conventions are consistent: `<role>`, `<objective>`, `<inputs>`, `<output>`, `<boundaries>` (see `sgsd-board-contrarian.md:8-47`). CODEX-04 should mirror that XML tag set.

### 2d. Mechanical verifier tool [super-gsd/tools/phase-verifier/phase-verifier.mjs]

- **Entry shape**: `#!/usr/bin/env node`, ESM (`import ... from 'node:fs'`), `parseArgs` hand-rolled function (lines 42-58). CODEX-05's `contract-check.mjs` should copy — Node ESM, no framework, hand-rolled args.
- **Exit discipline** (lines 72-76 printUsage docs): `0=PROVEN, 1=UNPROVEN, 2=BLOCKED`. CODEX-05 D-14's `0=both-valid-and-compatible, 1=divergence, 2=tool-error` matches semantically; reuse the three-way exit vocabulary.
- **stdout-JSON, stderr-progress split**: phase-verifier writes human progress to stderr (via `log`/`ok`/`warn`/`err` helpers, lines 87-90) and reserves stdout for machine output. CODEX-05 D-15's JSON summary on stdout + diagnostic prose on stderr is the same pattern — copy the four-function log helper block verbatim.

### 2e. Config-key extension [super-gsd/scripts/patch-gsd-tools-known-keys.sh]

- The script (235 lines) is a **self-contained, idempotent, anchor-guarded Node-in-bash patcher** that adds keys to `KNOWN_TOP_LEVEL` in `~/.claude/get-shit-done/bin/lib/core.cjs`.
- CODEX-06 D-19 says "reuse the existing `patch-gsd-tools-known-keys.sh` script from Phase 12". **Verified** — the script already lives at the expected path and supports adding arbitrary keys via the `NEW_KEYS` array on line 87. For Phase 14, the approach is one of:
  1. **Extend in place**: edit line 87 to append `review_providers` to the `NEW_KEYS` array. Re-run script; idempotency check (lines 108-116) skips the previously-patched 7 keys, adds only `review_providers`.
  2. **Sibling script**: new `patch-gsd-tools-known-keys-14.sh` that targets just `review_providers`. More files, but doesn't touch Phase-12 artifact.
  - D-19 strongly implies option 1 (reuse the script). Planner choice — recommend option 1 for MUDA-waste-avoidance.
- Anchor line in `core.cjs` is `'git', 'workflow', 'planning', 'hooks', 'features',` — as long as that's still present upstream, the patcher is safe; if gsd-tools has drifted upstream, exit code 2 (`ANCHOR_NOT_FOUND`) flags it.

### 2f. `code-reviewer-v1` contract declaration site

- **The contract is declared inline in `sgsd-orchestrate/SKILL.md:488`**: `report_format: "FINDINGS | CRITICAL | WARNINGS | PASS_RATE | ONE_LINER"`. That's the entire spec — no standalone contract file, no schema.
- **There is no `sgsd-code-reviewer.md` agent file in `super-gsd/agents/`**. The old `gsd-code-reviewer.md` lives at `custom-gsd-extract/claude-agents/gsd-code-reviewer.md` (legacy, pre-SGSD-v2) with a different role description. SKILL.md dispatches `subagent_type: "gsd-code-reviewer"` (lines 474, 837) — which **resolves to the legacy agent file via the custom-gsd extraction**, not to any file in `super-gsd/agents/`.
- **Implication for CODEX-05**: the contract-check harness has a moving target. It needs to parse reports against the **FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER** shape declared in SKILL.md — that's the only authoritative source. Hardcode the 5 field names in `contract-check.mjs`; don't try to import them from anywhere.
- **Implication for CODEX-02 / D-05a**: `report_contract: code-reviewer-v1` is a version label; the v1 definition is the 5-field list above. Both `review-providers.yaml` provider entries advertise `code-reviewer-v1`, and CODEX-05 validates the label means what they both think.
- **Naming drift flag**: the broader SGSD v1.3 rename policy (feedback note `feedback_sgsd_rename_rule.md` — quoted in session context) says only actively-enriched agents get the `sgsd-` prefix; the current `gsd-code-reviewer` hasn't been. Phase 14's CODEX-02 D-05 calls it `claude-sonnet-reviewer` and maps it to `agent_subagent_type: sgsd-code-reviewer`. That mapping **will dispatch to a non-existent agent** unless Phase 14 also either (a) creates the `sgsd-code-reviewer.md` stub or (b) maps `agent_subagent_type: gsd-code-reviewer` (current legacy). **This is a planner decision** — research flags it, doesn't resolve it.

---

## 3. Risk surfaces

### R-1. `invocation: shell` frontmatter field is net-new

Confirmed via grep: **zero existing agents declare `invocation:`** in frontmatter. No schema validator exists in `super-gsd/scripts/lib/` that parses agent frontmatter (no `parseAgentFrontmatter`, no `validateAgent`). The field is consumed only by whatever reads it in Phase 15 (`sgsd-orchestrate` Step 6.5/9.5/9.6, rewire deferred per D-11/D-11a). **Phase 14 risk: none** — no current code validates agent frontmatter, so unknown fields are silently ignored. Planner should not add a validation sibling task; let the field sit dormant until Phase 15 wires the consumer.

### R-2. Contract-check harness dual-CLI fail-soft (D-17)

D-17 says exit 2 when either Claude Max or Codex CLI absent. This is correct because:
- CODEX-05's harness invokes `Agent(subagent_type: "...")` — that primitive is only available inside a running Claude Code session. Running `node contract-check.mjs` from a plain shell **cannot dispatch an Agent() call**; the harness either has to be a skill/slash-command invoked inside Claude Code, or it fakes the Claude call via a pre-captured fixture report.
- **Simpler implementation path**: the harness takes TWO pre-captured reports (Claude + Codex) from disk and parses both. The "dispatch" step lives outside the harness — an operator (or Phase 14's verify.mjs) captures Claude report via Agent() and Codex report via `codex-exec.sh`, writes both to fixture paths, then runs `contract-check.mjs --claude-report path --codex-report path`. Harness is a pure parser/comparator.
- This **inverts D-15 step 1-2** slightly — the capture happens before the harness, not inside it. Planner should consider this shape; it makes the harness cleanly testable without live CLI access.

### R-3. `config.review_providers` cold-start read wiring (D-20)

Cold-start Step 3.6 is verified to exist (`super-gsd/skills/sgsd-orchestrate/SKILL.md:107-120`) and loads `gates-registry.cjs`. But **there is no current config-read call at Step 3.6** — the gates registry loads `gates.yaml`, not `config.json`. Config reads happen ad-hoc wherever `require('.planning/config.json')` is called. D-20 says "`gates-registry.cjs` reads `review_providers.*` at cold-start Step 3.6 and caches" — this is **net-new behaviour** for `gates-registry.cjs`. Either:
- **Option A**: extend `gates-registry.cjs:loadGates` to also read `config.json` and cache `review_providers` block alongside. Single load, two caches.
- **Option B**: add a new `loadReviewProvidersConfig(configPath)` function to a sibling module; call it from Step 3.6 immediately after `gates.loadGates()`. Keeps concerns separated.
- Recommend **Option B** — `gates-registry.cjs` currently only handles gates.yaml; bolting config reads onto it breaks separation. The sibling `providers-registry.cjs` proposed in 2b can own both `review-providers.yaml` AND the `config.review_providers` block.

---

## 4. Unknowns left for implementation time

1. **Exact non-zero exit codes from `codex exec`**. Docs don't specify auth-failure vs tool-error vs model-error. Wrapper should treat all non-zero-and-non-124 as generic "codex failed", capture stderr preamble for debug, and map to wrapper exit `1` (generic failure) unless specific patterns match (auth keyword → exit 4).
2. **Whether `--output-last-message -o <path>` is more robust than stdout capture** under long-report scenarios. Untested — wrapper should start with stdout capture (simpler) and fall back to `-o` if buffer issues appear in the contract-check harness.
3. **`--ephemeral` side-effects on rate limits / quota**. Docs don't say whether ephemeral sessions count against quota differently. Default to always-ephemeral for reviewer use; revisit if Phase 15 sees unexpected billing behaviour.
4. **Whether Codex honours the `--cd` path when given a symlinked WSL path**. Known-WSL-symlink issue (#13762) — if wrapper ever runs against a `/mnt/c/...` symlink resolving to WSL home, behaviour undocumented. Stick to `wslpath -u` output (resolves to real WSL path) to avoid the edge case.

---

## 5. Planner hints (per plan)

### 14-01 codex-exec-wrapper — CODEX-01

**Shape impact**: D-01's `--prompt-file` is the wrong mental model — **use stdin pipe** (`cat "$prompt_path" | codex exec --sandbox read-only --ephemeral -`). Wrapper flag should be renamed `--prompt-file <path>` but internally pipes the file contents on stdin. Rationale: no `--prompt-file` flag exists on codex itself (verified at [CLI reference](https://developers.openai.com/codex/cli/reference)).

**Reuse**: copy root-detection from `sgsd-curate.sh:101-126`, atomic-write from `sgsd-muda-audit.sh:226-229`, JSONL append from `sgsd-muda-audit.sh:305-308`, `--dry-run` discipline from `sgsd-muda-audit.sh:216-223`. **Drop** `--project` CLI flag if not needed — wrapper can derive project root via same walk-up idiom.

**Timeout**: wrap `codex exec` in GNU `timeout ${TIMEOUT_SECONDS}s codex exec ...`; trap exit 124 and remap to wrapper exit 5. Document in D-01a comment block.

**Auth hygiene**: at start of script, `if [[ -n "$OPENAI_API_KEY" ]]; then echo "ERR"; exit 4; fi` — matches D-02a verbatim. Also `unset OPENAI_API_KEY` defensively.

**Sandbox**: always pass `--sandbox read-only` + `--ephemeral` + `--skip-git-repo-check` (reviewers run against diffs that may include non-committed changes). **Do not** pass `--full-auto` or `--yolo`.

### 14-02 provider-registry — CODEX-02 / CODEX-03 / CODEX-04

**Shape impact**: the registry loader is **net-new sibling module** (`providers-registry.cjs`), not an extension of `gates-registry.cjs`. Reason: `gates-registry.cjs` is cleanly scoped to gates.yaml; bolting a second YAML + config.json read onto it violates separation. New module mirrors the `_cache = null + loadProviders + getProvider + resolveReviewerProvider` API.

**Critical naming issue (flagged R-3 of §2f)**: D-05 says Claude provider's `agent_subagent_type: sgsd-code-reviewer`. That agent file **does not exist** in `super-gsd/agents/`. Planner must decide:
- Map to `gsd-code-reviewer` (legacy, exists in `custom-gsd-extract/`)?
- Create `sgsd-code-reviewer.md` stub as sibling task in 14-02?
- Defer to Phase 15 (but then Phase 14 ships a registry pointing at a non-existent agent, which CODEX-05's harness would catch)?

Recommend **create stub** — CODEX-04 already adds `sgsd-codex-reviewer.md`; adding `sgsd-code-reviewer.md` at the same time (mirrors the same contract) completes the two-provider pair in one commit.

**CODEX-03 `gates.yaml` edit**: touch exactly two rows — `per-dispatch-ATC` (line 37-58) and `phase-level-ATC` (line 60-71). Add `reviewer_provider: claude-sonnet-reviewer` as the last field before `evidence_emitted:`. **Bump `registry_version: 2.0.0 → 2.1.0`** and `last_updated`.

**CODEX-04 agent stub**: XML block set = `<objective>`, `<inputs>`, `<output>`, `<boundaries>` (same as `sgsd-board-contrarian.md`). Frontmatter adds `invocation: shell`, `shell_script:`, `report_contract:` — net-new fields, silently tolerated by current schema (no validator exists).

### 14-03 config-and-known-keys — CODEX-06

**Shape impact**: D-19 script reuse is straightforward — edit line 87 of `patch-gsd-tools-known-keys.sh` to append `'review_providers'` to `NEW_KEYS`, re-run. Idempotency check (lines 108-116) handles re-runs cleanly.

**Verify discipline**: the script already has post-patch verification (lines 192-215). After Phase 14's patch, the verify block will confirm 8 keys instead of 7.

**Cold-start wiring**: D-20's cold-start read needs one new invocation at `sgsd-orchestrate/SKILL.md` Step 3.6 — *"load provider registry after gates.loadGates()"*. Planner can either edit SKILL.md directly in this plan, or defer to a sibling task. Recommend **defer to 14-02** — the registry loader module ships there; its consumer (Step 3.6 read call) is the plan that puts both pieces in the same commit.

### 14-04 contract-check-harness — CODEX-05

**Shape impact (from R-2)**: rethink D-15. The harness cannot directly call `Agent()` because that primitive only works inside a Claude Code session, not from a plain `node contract-check.mjs` invocation. Two shapes:

- **Shape A (pure parser)**: harness takes `--claude-report <path>` and `--codex-report <path>` args, parses each against `code-reviewer-v1` schema, emits JSON divergence summary. An outer orchestration step (Phase 14's verify.mjs or a slash-command) captures the reports before calling the harness. **Recommended** — clean separation, testable without live CLIs.
- **Shape B (dispatch-and-parse)**: harness is a skill invoked inside Claude Code that has access to `Agent()`. This means CODEX-05 produces a skill dir + SKILL.md, not just a `.mjs` tool. More complex; matches original D-14 shape but breaks the "mirrors phase-verifier.mjs" canonical ref (phase-verifier is pure node, no Agent()).

Recommend Shape A. Planner should document the fixture-capture path (where the two reports come from) in the plan task list.

**Fixture**: D-14a toy diff contents (1 bug + 1 YAGNI + 1 nit) — commit at `super-gsd/tools/provider-contract/fixtures/toy-diff.patch`. Planner adds a sibling `fixtures/expected-shape.json` documenting the parsed-schema expectations.

**Tool structure** (reuse from phase-verifier.mjs): ESM, hand-rolled `parseArgs`, four-function log helpers (log/ok/warn/err) to stderr, JSON result on stdout, exit 0/1/2.

---

## Sources

### Primary (HIGH confidence)
- [Codex CLI command line reference](https://developers.openai.com/codex/cli/reference) — flags for `codex exec`
- [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive) — stdout/stderr contract, `--json`
- [Codex authentication](https://developers.openai.com/codex/auth) — credential storage, `forced_login_method`
- [Codex Windows guide](https://developers.openai.com/codex/windows) — WSL recommendation, path guidance
- [openai/codex#15151](https://github.com/openai/codex/issues/15151) — OAuth/API-key precedence bug (OPEN)
- [openai/codex#7353](https://github.com/openai/codex/issues/7353) — timeout handling (exit 124 / GNU timeout)

### Codebase (HIGH confidence — direct Read)
- `super-gsd/scripts/sgsd-muda-audit.sh` — shell wrapper template
- `super-gsd/scripts/sgsd-recall.sh`, `sgsd-curate.sh` — root-detection + atomic-write
- `super-gsd/scripts/lib/gates-registry.cjs` — cache-singleton loader
- `super-gsd/registry/gates.yaml:37-71` — two target rows for CODEX-03
- `super-gsd/agents/sgsd-board-contrarian.md` — agent-stub shape
- `super-gsd/tools/phase-verifier/phase-verifier.mjs` — verifier tool shape
- `super-gsd/scripts/patch-gsd-tools-known-keys.sh` — KNOWN_TOP_LEVEL patcher
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:107-120, 466-506, 830-845` — cold-start Step 3.6 + dispatch sites + inline contract

### Secondary (MEDIUM confidence — needs implementation-time verification)
- Unknowns §4 items 1-4 (undocumented exit codes, `-o` vs stdout, ephemeral quota, symlink `--cd` behaviour).

---

## Metadata

**Confidence breakdown:**
- Codex CLI contract (§1): HIGH — all 4 unknowns answered against official docs + GitHub issues.
- Codebase patterns (§2): HIGH — every claim cites path:line from direct Read.
- Risk surfaces (§3): HIGH for R-1 (grep-verified absence); MEDIUM for R-2/R-3 (recommendations, not facts).
- Planner hints (§5): MEDIUM — plan shape recommendations, planner decides.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (Codex CLI is fast-moving; re-verify before Phase 15 implementation)
