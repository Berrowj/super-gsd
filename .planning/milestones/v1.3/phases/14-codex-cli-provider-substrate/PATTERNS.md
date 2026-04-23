---
phase: 14
phase_name: Codex CLI Provider Substrate
mapped: 2026-04-23
vtp_mode: BYPASSED
files_analyzed: 9
analogs_found: 8
---

# Phase 14 — Pattern Map

Maps each NEW/MODIFIED file to its closest existing codebase analog, so the
planner can write plans as *"model X after Y:N-M"* rather than inventing shapes.

Consumes `14-CONTEXT.md` D-01..D-24 (locked) and `RESEARCH.md` (citations
verified against live codebase). VTP-KB bypassed per `14-VTP-EVIDENCE.md` —
no `mcp__vtp-kb__*` calls made.

---

## File Classification

| File | New/Mod | Role | Data Flow | Closest Analog | Match |
|------|---------|------|-----------|----------------|-------|
| `super-gsd/scripts/codex-exec.sh` | NEW | shell wrapper (external-CLI shell-out) | request-response, file-I/O, JSONL append | `super-gsd/scripts/sgsd-muda-audit.sh` | exact |
| `super-gsd/registry/review-providers.yaml` | NEW | YAML registry (resource declaration) | static/config | `super-gsd/registry/gates.yaml` | exact |
| `super-gsd/agents/sgsd-codex-reviewer.md` | NEW | agent stub (frontmatter + XML) | agent-definition | `super-gsd/agents/sgsd-board-contrarian.md` | exact |
| `super-gsd/tools/provider-contract/contract-check.mjs` | NEW | mechanical verifier (Node ESM) | file-I/O, parse, compare, exit-code | `super-gsd/tools/phase-verifier/phase-verifier.mjs` | role-match |
| `super-gsd/tools/provider-contract/fixtures/toy-diff.patch` | NEW | test fixture (ground-truth patch) | static fixture | *no existing fixture dir* | no analog |
| `super-gsd/registry/gates.yaml` | MOD | YAML registry row extension | static/config | *self* — bump registry_version | self |
| `.planning/config.json` | MOD | config block addition | static/config | *self* — `atc:` block precedent | self |
| `super-gsd/scripts/lib/gates-registry.cjs` or new `providers-registry.cjs` | MOD/NEW | cache-singleton loader | lazy-load + cache | `super-gsd/scripts/lib/gates-registry.cjs` (self or sibling) | exact |
| `super-gsd/scripts/patch-gsd-tools-known-keys.sh` | REUSE | script re-run (one-line `NEW_KEYS` edit) | patch + verify | *self* | reuse |

---

## Pattern Assignments

### `super-gsd/scripts/codex-exec.sh`

- **Closest analog**: `super-gsd/scripts/sgsd-muda-audit.sh:50-99` (arg parse + root detect + phase resolve) and `:215-311` (dry-run, atomic write, JSONL append, exit propagation).
- **Pattern elements to reuse**:
  - Root-detection walk-up loop (`while [[ "$d" != "/" ]]; do ... done`) — `sgsd-muda-audit.sh:57-63` or `sgsd-curate.sh:101-112`. Look for `.planning/` as sentinel.
  - Arg parsing `while [[ $# -gt 0 ]]; do case "$1" in ... esac` — `sgsd-curate.sh:42-57` is the cleanest template (copy verbatim with 4 flags: `--prompt-file`, `--timeout`, `--report-out`, `--dry-run`).
  - Dry-run discipline — `sgsd-muda-audit.sh:216-223` (print what would happen, propagate probe exit code, no side effects).
  - Atomic write for `--report-out` — `sgsd-muda-audit.sh:225-229` (`tmp="$target.tmp"; compose > "$tmp"; mv "$tmp" "$target"`).
  - JSONL append for provenance log — `sgsd-muda-audit.sh:304-308` (`mkdir -p "$(dirname "$METRICS_LOG")"; printf '{"ts":"%s",...}\n' ... >> "$METRICS_LOG"`). **One `printf`, no JSON libs.**
  - `wslpath -u` path translation — `sgsd-curate.sh` already does this for `--root` arg on Windows; idempotent on POSIX inputs (D-04a).
- **What's genuinely new**:
  - **`codex exec` invocation shape** — uses stdin pipe (`cat "$prompt_file" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check -`), NOT `--prompt-file` on codex itself (no such flag exists per RESEARCH §1a). Wrapper takes a `--prompt-file` flag but internally pipes.
  - **GNU `timeout` trap** — wrap the codex call in `timeout ${SECS}s ... ; rc=$?`, remap exit 124 → wrapper exit 5. No prior SGSD script wraps an external CLI in a timeout guard.
  - **OAuth hygiene refuse-to-run** (D-02a) — `if [[ -n "$OPENAI_API_KEY" ]]; then exit 4; fi` + defensive `unset OPENAI_API_KEY`. No SGSD script currently gates on env-var absence; this is a new discipline for Phase 14.
  - **Report parse with awk/sed** — D-03's 5-field contract (`FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER`) parsed with a small awk pipeline and emitted to `--report-out` path. Parse-failure → exit 6 with first 200 bytes captured. No existing script parses an external CLI's structured output.
- **Planner hint**: *"Model wrapper shell structure after `sgsd-muda-audit.sh:50-311` (arg-parse + root-detect + dry-run + atomic-write + JSONL-append). Replace probe invocation block (lines 110-119) with the codex stdin-pipe + GNU-timeout + OAuth-guard sequence from RESEARCH §5 14-01 hints. Report parse is net-new — use awk, no JSON libs."*

---

### `super-gsd/registry/review-providers.yaml`

- **Closest analog**: `super-gsd/registry/gates.yaml:1-71` (frontmatter + versioning + two rows matching D-05 shape).
- **Pattern elements to reuse**:
  - Banner comment header with source reference and research grounding — `gates.yaml:1-12`.
  - Frontmatter triple: `schema_version:`, `registry_version: X.Y.Z`, `last_updated: YYYY-MM-DD` — `gates.yaml:14-16`. D-05 matches 1-for-1 (`schema_version: 1`, `registry_version: 1.0.0`).
  - Enum declaration block — `gates.yaml:23-27` (`enforcement_modes:` list). D-07's `invocation_type: agent|shell` can be documented the same way at registry head.
  - Two-row body with inline comments per section — `gates.yaml:33-71` structure.
- **What's genuinely new**:
  - **First non-gates YAML in `super-gsd/registry/`** — this file sets the precedent for future resource registries (DLB-05 patterns.yaml, Phase 15+ MCP registry, etc.). See Pattern Divergences §D1 below.
  - **`invocation_type: shell` discriminator** — D-07 load-bearing. Not present anywhere else in the codebase.
  - **`fallback_to:` field** — explicit single-retry target. No prior YAML uses this shape.
- **Planner hint**: *"Copy `gates.yaml:1-27` header block verbatim; replace enum+rows with D-05's two-provider spec. Set `schema_version: 1, registry_version: 1.0.0`. Document that this is the first non-gates registry — precedent for v1.4+."*

---

### `super-gsd/agents/sgsd-codex-reviewer.md`

- **Closest analog**: `super-gsd/agents/sgsd-board-contrarian.md:1-47` (frontmatter + XML blocks; pulled out explicitly in 14-CONTEXT.md `<canonical_refs>`).
- **Pattern elements to reuse**:
  - Frontmatter triple: `name:`, `description:`, `tools:` (optional) — `sgsd-board-contrarian.md:2-4`. Agents also commonly declare `model:` (5 of 19 agents).
  - XML block tags: `<role>`, `<objective>` (or `<temperament>`/`<reasoning>` variants), `<inputs>` (implicit in most), `<output>`, `<boundaries>` (implicit). See `sgsd-board-contrarian.md:8-47` — inline `<temperament>`, `<reasoning>`, `<heuristics>`, `<output>`.
  - Output block declares **exact** report shape — `sgsd-board-contrarian.md:30-47` emits a YAML block with no prose wrapper, same discipline CODEX-04 D-12 requires (FINDINGS | CRITICAL | WARNINGS | PASS_RATE | ONE_LINER).
- **What's genuinely new**:
  - **`invocation: shell` frontmatter field** (D-12a) — **zero existing agents declare this** (grep-verified in RESEARCH §2c). The agent-frontmatter schema has no validator (`no parseAgentFrontmatter, no validateAgent` in `super-gsd/scripts/lib/`), so the new field sits dormant until Phase 15 consumes it. See Pattern Divergences §D2 below.
  - **`shell_script:` + `report_contract:` frontmatter fields** — also net-new. `report_contract: code-reviewer-v1` is a version label that matches `review-providers.yaml`.
  - **The execution primitive is EXTERNAL** — unlike every existing agent, this one doesn't run via `Agent()`; it's a contract declaration that points at a shell script. The `<boundaries>` block should explicitly state "No external network beyond Codex CLI; no file writes; report-only output."
- **Planner hint**: *"Model frontmatter + `<role>` + `<output>` after `sgsd-board-contrarian.md:1-47`. Add the 3 net-new frontmatter fields (`invocation: shell`, `shell_script:`, `report_contract:`) as documented in D-12. Output block MUST match CODEX-04 D-12 exact-text contract (5 fields, pipe-delimited list)."*

---

### `super-gsd/tools/provider-contract/contract-check.mjs`

- **Closest analog**: `super-gsd/tools/phase-verifier/phase-verifier.mjs:1-91` (entry shape, CLI parsing, log helpers, exit codes).
- **Pattern elements to reuse**:
  - Shebang + ESM imports + `fileURLToPath(import.meta.url)` pattern — `phase-verifier.mjs:31-36`.
  - Hand-rolled `parseArgs(argv)` function — `phase-verifier.mjs:42-58`. Four-flag loop, no framework.
  - `printUsage()` with exit-code documentation in the help block — `phase-verifier.mjs:60-77`.
  - Four-function log helpers (`log/ok/warn/err`) **to stderr**, reserving stdout for machine output (JSON) — `phase-verifier.mjs:83-91`. Copy verbatim.
  - Three-way exit vocabulary — `phase-verifier.mjs:72-76` documents `0=PROVEN, 1=UNPROVEN, 2=BLOCKED`. CODEX-05 D-14 matches semantically: `0=both-parsed-and-compatible, 1=divergence, 2=tool-error`. **Reuse the three-way discipline.**
  - Config loader that fails with exit 2 on missing/invalid config — `phase-verifier.mjs:97-103` (adapt for fixture + report paths instead of `browser_verify` block).
- **What's genuinely new**:
  - **Dual-report parser-comparator** — phase-verifier drives a browser and captures new evidence; contract-check takes **two pre-existing report files** and parses both against the `code-reviewer-v1` schema. Pure parser, not a dispatcher. See Pattern Divergences §D3 below — RESEARCH §3 R-2 argues this inversion is load-bearing (D-15 step 1-2 happen *outside* the harness, not inside it).
  - **`code-reviewer-v1` schema assertions** — hardcode the 5 field names (FINDINGS, CRITICAL, WARNINGS, PASS_RATE, ONE_LINER) inline; RESEARCH §2f confirmed no separate schema file exists to import from (only declaration site is `sgsd-orchestrate/SKILL.md:488`).
  - **JSON divergence summary to stdout** — `{"claude":{...}, "codex":{...}, "divergence":{...}}` per D-15. phase-verifier writes a markdown review file; contract-check writes a JSON doc on stdout for mechanical consumption.
- **Planner hint**: *"Model CLI + log + exit-code scaffold after `phase-verifier.mjs:1-91` (verbatim headers, parseArgs, log helpers, exit vocabulary). Body is pure parser — take `--claude-report <path>` + `--codex-report <path>` args, parse both against the 5-field `code-reviewer-v1` contract hardcoded inline, emit JSON divergence summary on stdout. **Do NOT call `Agent()` from inside the harness** (R-2 — not available outside a Claude Code session)."*

---

### `super-gsd/tools/provider-contract/fixtures/toy-diff.patch`

- **Closest analog**: *No existing fixture directory under `super-gsd/tools/*/fixtures/` — genuinely new*.
- **Pattern elements to reuse**: none — this is a net-new fixture convention for `super-gsd/tools/`.
- **What's genuinely new**:
  - **Whole fixtures directory layout** under `super-gsd/tools/provider-contract/`. Planner may want to establish `fixtures/` as the canonical subdir for all `super-gsd/tools/*` test fixtures going forward.
  - **Content shape (D-14a)**: git-format patch with 1 obvious bug (off-by-one) + 1 YAGNI (unused helper) + 1 nit (trailing whitespace). Expected reviewer verdict: `CRITICAL: 1, WARNINGS: 2`.
- **Planner hint**: *"Write as a plain `diff --git`–format patch. No analog — don't pretend reuse. Precedent setter: fixtures live under `super-gsd/tools/{tool-name}/fixtures/`."*

---

### `super-gsd/registry/gates.yaml` (MODIFIED)

- **Closest analog**: `super-gsd/registry/gates.yaml:37-71` (self; the two rows getting the new field).
- **Pattern elements to reuse**:
  - The exact row shapes already present — just add one field. Row `per-dispatch-ATC` at `:37-58` (already declares `reviewer_agent: sgsd-code-reviewer` on `:52`). Row `phase-level-ATC` at `:60-71` (already declares same on `:65`).
  - Field ordering convention — add `reviewer_provider:` **immediately after** `reviewer_agent:` and **before** `evidence_emitted:` (keeps agent/provider colocated; matches reader flow).
  - Registry version bump — `gates.yaml:15` currently `registry_version: 2.0.0`; D-09/D-09a imply a minor bump to `2.1.0` and `last_updated:` to 2026-04-NN.
- **What's genuinely new**:
  - Nothing — this is a surgical two-row field addition. The field is schema-optional (absence = `claude-sonnet-reviewer` default per D-09) so all other rows remain untouched.
- **Planner hint**: *"Surgical edit to 2 rows (lines 52 and 65 get a new sibling line `reviewer_provider: claude-sonnet-reviewer`). Bump `registry_version: 2.0.0 → 2.1.0` and update `last_updated:`. No structural changes."*

---

### `.planning/config.json` (MODIFIED)

- **Closest analog**: `.planning/config.json:69-79` (`atc:` block — explicitly cited in 14-CONTEXT.md `<canonical_refs>` line 45).
- **Pattern elements to reuse**:
  - Flat block of scalar keys with JSON-native types (no nested objects beyond depth 2) — `atc:` block uses booleans + numbers + strings. CODEX-06 D-18 follows same convention.
  - Boolean kill-switch convention — `browser_verify.enabled` at `:81` is the precedent for `review_providers.codex_enabled` (D-18b).
  - `auto-detect` string-literal sentinel — `browser_verify.approved_fallbacks: ["puppeteer"]` shows the fallback-list pattern; D-18c's `codex_cli_path: "auto-detect"` uses the same stringly-typed sentinel for "resolve at runtime".
  - Timeout-in-seconds naming — `browser_verify.load_timeout_ms: 15000` uses `_ms`; CODEX-06 uses `_seconds` suffix per D-18. Acceptable divergence (domain-appropriate unit).
- **What's genuinely new**:
  - `fallback_on_error` + `fallback_max_retries` key pair — no existing config block has fallback-retry semantics. Precedent-setting for any future provider-shaped config.
- **Planner hint**: *"Add top-level `review_providers` block mirroring the shape of `atc:` block (`:69-79`). Six keys per D-18. Insert after `atc:` block, before `browser_verify:` to keep config.json's existing ordering convention (workflow → safety → hooks → parallelization → routing → efficiency → deliberation → git → **atc** → browser_verify → overwatcher)."*

---

### `super-gsd/scripts/lib/gates-registry.cjs` (MODIFIED) — OR NEW `providers-registry.cjs`

- **Closest analog**: `super-gsd/scripts/lib/gates-registry.cjs:1-97` (the whole file — 97 lines total).
- **Pattern elements to reuse**:
  - Module-level cache singleton pattern — `gates-registry.cjs:29` (`let _cache = null`). Same shape for providers.
  - `loadX(yamlPath)` cache-once pattern — `gates-registry.cjs:38-55` (early-return on cache hit, load + parse + build byName map, assign cache, return).
  - js-yaml require path — `gates-registry.cjs:41-44` (resolve to `super-gsd/tools/plan-schema/node_modules/js-yaml`). **Do NOT `npm install` a second copy.**
  - `getX(name, yamlPath)` lookup with hard-error-on-missing — `gates-registry.cjs:65-69` (`if (!g) throw new Error(...)`). D-06a's "unknown provider = hard error at cold-start" maps 1-for-1.
  - `resetCache()` test-only helper — `gates-registry.cjs:92-94`. Providers registry needs the same for test isolation.
  - Exports shape — `gates-registry.cjs:96` (`module.exports = { loadGates, getGate, shouldFire, resetCache };`).
- **What's genuinely new**:
  - **Module placement is contested** — D-06 says "gates-registry.cjs loads review-providers.yaml" (add to existing module). RESEARCH §2b + §3 R-3 argue for a sibling `providers-registry.cjs` (clean separation of concerns — gates-registry handles gates.yaml only; new module handles review-providers.yaml AND `config.review_providers` block).
  - **`resolveReviewerProvider(gateName)` — the FIRST `resolve*` method on the registry pair** (D-10). Returns the provider record for a gate's `reviewer_provider` field (falling back to config's `default_provider` when absent), or `null` if the gate has no reviewer field.
  - **Cross-YAML + config.json read** — if sibling module, it loads both `review-providers.yaml` AND `.planning/config.json` at Step 3.6. Single cold-start, two caches.
- **Planner hint**: *"Recommend sibling module `super-gsd/scripts/lib/providers-registry.cjs` following `gates-registry.cjs:1-97` shape **line-for-line** (singleton + loadProviders + getProvider + resolveReviewerProvider + resetCache + matching exports). Add a `loadReviewProvidersConfig(configPath)` helper for the `config.review_providers` block (R-3 option B). Planner to resolve D-06 tension: CONTEXT says extend existing module; RESEARCH R-3 recommends sibling. Recommend sibling (cleaner separation)."*

---

### `super-gsd/scripts/patch-gsd-tools-known-keys.sh` (REUSE existing script)

- **Closest analog**: *Self* — the script already exists and is designed for exactly this re-use case (Phase 10 D-13b precedent).
- **Pattern elements to reuse**:
  - **`NEW_KEYS` array at line 87** — currently `(safety model_routing token_efficiency deliberation atc browser_verify overwatcher)`. Append `review_providers` (D-19).
  - **Idempotency check** at `:108-116` — re-running is safe; script short-circuits with `ALREADY_PATCHED` if all keys already present, adds only new ones.
  - **Anchor guard** at `:119-124` — `'git', 'workflow', 'planning', 'hooks', 'features',` must remain present in upstream `core.cjs`. Exit 2 (`ANCHOR_NOT_FOUND`) signals upstream drift.
  - **Post-patch verification** at `:192-215` — re-parses core.cjs to confirm all keys present. After Phase 14, this block confirms **8 keys** instead of 7 (also needs updating to reflect the count).
- **What's genuinely new**:
  - Nothing — this is a pure one-line array edit + array-count update in the post-verify block.
- **Planner hint**: *"**REUSE existing script** — do NOT create a new patch utility. Task is: (1) edit line 87 of `patch-gsd-tools-known-keys.sh` to append `review_providers` to `NEW_KEYS`; (2) update post-verify `need` array at `:200` to match (8 keys); (3) update error-message key list at `:157` to match; (4) re-run script on operator machine (idempotent — already-patched keys are skipped). Phase 14 does NOT create a sibling `patch-gsd-tools-known-keys-14.sh` — MUDA waste."*

---

## Pattern Divergences

Places where Phase 14 INTENTIONALLY breaks from existing patterns, and why.

### D1. First non-gates YAML in `super-gsd/registry/`

**Divergence**: `review-providers.yaml` is the first registry file in `super-gsd/registry/` that isn't `gates.yaml`. Current directory contains only `gates.yaml` + the schema directive files around it.

**Why divergent**: The registry directory was scoped to a single resource type (gates). Phase 14 expands it to a multi-resource registry pattern.

**Implication for planner**: This sets a **precedent** for v1.4+ registries (mcp-servers.yaml, patterns.yaml, etc.). Planner should document the convention in the new file's header: *"This is the second registry in super-gsd/registry/. New registries go here; each gets its own `schema_version` and `registry_version` independently."*

### D2. `invocation: shell` frontmatter field is net-new for agents

**Divergence**: Zero existing agents in `super-gsd/agents/` declare `invocation:` in frontmatter. All are implicitly `invocation: agent` (dispatched via `Agent()` primitive). CODEX-04 D-12a introduces the field for the first time.

**Why divergent**: D-24 explicitly gates on this — Phase 14 must land the schema extension *without* rewiring any consumer (no `sgsd-orchestrate/SKILL.md` modifications in Phase 14, per D-11). The field is **dormant** until Phase 15 Step 6.5/9.5/9.6 rewire reads it. RESEARCH §3 R-1 verified no current agent-frontmatter validator exists, so the unknown field is silently tolerated.

**Implication for planner**: Do NOT add a validation/schema-check sibling task to Phase 14. Let the field sit dormant. Phase 15's planner will add the consumer.

### D3. `contract-check.mjs` — tension between dispatcher and pure parser

**Divergence**: CONTEXT D-14/D-15 describes the harness as dispatching Claude (via `Agent()`) **and** shelling out to Codex (via `codex-exec.sh`) from inside one tool. RESEARCH §3 R-2 argues this is impossible in practice — `Agent()` is only available inside a running Claude Code session, not from a plain `node contract-check.mjs` invocation.

**Why divergent**: The dispatch-from-node model is a CONTEXT-level shape that doesn't survive RESEARCH-level scrutiny. No prior mechanical verifier in `super-gsd/tools/` does both Agent-dispatch and shell-out from one binary (phase-verifier.mjs is pure Node with CDP; no Agent calls).

**Implication for planner**: Resolve the tension by making `contract-check.mjs` a **pure parser-comparator** (RESEARCH §5 14-04 Shape A). An outer step (Phase 14 `verify.mjs` or a one-shot slash-command) captures Claude + Codex reports to fixture paths, then calls the harness with `--claude-report <path> --codex-report <path>`. This keeps the tool shape aligned with phase-verifier.mjs (no Agent() calls inside). The planner should write the plan to reflect Shape A, not the literal D-15 text.

### D4. Naming drift — `sgsd-code-reviewer` doesn't exist

**Divergence**: D-05's `claude-sonnet-reviewer` provider maps `agent_subagent_type: sgsd-code-reviewer`, but that agent file **does not exist** in `super-gsd/agents/` (RESEARCH §2f). The extant agent is `gsd-code-reviewer` under `custom-gsd-extract/claude-agents/` (legacy, pre-SGSD-v2). The global feedback rule `feedback_sgsd_rename_rule.md` says the `sgsd-` prefix is reserved for actively-enriched v2 agents only.

**Why divergent**: Phase 14's CONTEXT decisions were drafted before the rename rule was codified. Per the rule, either (a) `sgsd-code-reviewer.md` must be created as a sibling task in plan 14-02 (actively-enriched = fits rule), or (b) the registry entry maps to `gsd-code-reviewer` (legacy).

**Implication for planner**: RESEARCH §5 14-02 recommends option (a) — create `sgsd-code-reviewer.md` stub alongside `sgsd-codex-reviewer.md` in plan 14-02. The two agents are contract-mirror siblings; shipping them together keeps the registry entries pointing at real files and passes the contract-check harness's agent-resolution probe. Planner decides. If (b), then `review-providers.yaml` D-05's `agent_subagent_type: sgsd-code-reviewer` must change to `gsd-code-reviewer`.

---

## No Analog Found

| File | Reason |
|------|--------|
| `super-gsd/tools/provider-contract/fixtures/toy-diff.patch` | No existing `fixtures/` convention under `super-gsd/tools/*`. Genuinely new directory layout. |

---

## Shared Patterns Applied Across Multiple Files

### S1. Cache-singleton loader pattern (`let _cache = null; if (_cache) return _cache; ...`)

**Source**: `super-gsd/scripts/lib/gates-registry.cjs:29-55`
**Applies to**: `providers-registry.cjs` (new or extension). Same shape line-for-line.

### S2. Three-way exit code discipline (0/1/2)

**Source**: `super-gsd/tools/phase-verifier/phase-verifier.mjs:72-76`
**Applies to**: `contract-check.mjs` (0=compat, 1=divergence, 2=tool-error). Also `codex-exec.sh` extends with 3-6 (wrapper-specific).

### S3. stderr-for-progress / stdout-for-machine-output split

**Source**: `phase-verifier.mjs:83-91` (log/ok/warn/err all go to stderr; stdout reserved for JSON report)
**Applies to**: `contract-check.mjs` directly. `codex-exec.sh` follows the same discipline for its --report-out payload vs progress messages.

### S4. YAML frontmatter triple (`schema_version:`, `registry_version: X.Y.Z`, `last_updated:`)

**Source**: `super-gsd/registry/gates.yaml:14-16`
**Applies to**: `review-providers.yaml`. Also triggers `registry_version` bump on `gates.yaml` (2.0.0 → 2.1.0).

### S5. js-yaml require path (shared install, no second `npm install`)

**Source**: `gates-registry.cjs:41-44` (`path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml')`)
**Applies to**: providers-registry loader; contract-check.mjs if it needs YAML parsing.

### S6. Atomic write pattern (tmp + mv)

**Source**: `sgsd-muda-audit.sh:225-229`, `sgsd-curate.sh:228-229`
**Applies to**: `codex-exec.sh --report-out` file write.

### S7. JSONL append-only provenance log

**Source**: `sgsd-muda-audit.sh:304-308` (single `printf` formatter, no JSON lib, `mkdir -p` before append)
**Applies to**: `codex-exec.sh` writing to `.planning/metrics/codex-log.jsonl`.

### S8. Hard-error-on-unknown-name in registry lookup

**Source**: `gates-registry.cjs:65-69`
**Applies to**: `providers-registry.cjs` `getProvider(name)` (D-06a — cold-start typo-catch).

---

## Metadata

- **Analog search scope**: `super-gsd/scripts/`, `super-gsd/scripts/lib/`, `super-gsd/registry/`, `super-gsd/agents/`, `super-gsd/tools/`, `.planning/config.json`.
- **Files scanned**: 9 targets, 8 analogs confirmed via direct `Read`, 1 (`toy-diff.patch` fixture) genuinely new.
- **Citations verified**: all line ranges cited above match the live files as of 2026-04-23 read.
- **Pattern extraction date**: 2026-04-23
