---
plan_id: 14-02
phase: 14
wave: 2
depends_on: ["14-01", "14-03"]
deliverable: providers-registry.cjs sibling module + review-providers.yaml + gates.yaml field extension + sgsd-code-reviewer.md + sgsd-codex-reviewer.md agent stubs
estimate_tokens: ~750
estimate_commits: 3
---

# Plan 14-02: provider registry + agent stubs + gates.yaml field

## Scope

Lands the reviewer-provider abstraction. Ships:

1. A new sibling cache-singleton loader `super-gsd/scripts/lib/providers-registry.cjs`
   that reads `review-providers.yaml` AND the `config.review_providers` block from
   `.planning/config.json`. Exposes `loadProviders`, `getProvider`, `loadReviewProvidersConfig`,
   and the first-ever `resolveReviewerProvider(gateName)` method on the registry pair.
2. The `super-gsd/registry/review-providers.yaml` file with both providers per D-05.
3. A surgical 2-row edit to `super-gsd/registry/gates.yaml` adding
   `reviewer_provider: claude-sonnet-reviewer` to `per-dispatch-ATC` (line 52) and
   `phase-level-ATC` (line 65); bumps `registry_version: 2.0.0 → 2.1.0`.
4. **Two** agent stubs: `super-gsd/agents/sgsd-code-reviewer.md` (resolves P3
   naming drift) and `super-gsd/agents/sgsd-codex-reviewer.md` (CODEX-04). Both
   declare the net-new `invocation:`, `shell_script:` (codex only), and
   `report_contract:` frontmatter fields.

## Deviations from CONTEXT (P1 + P3 — must be surfaced at plan review)

### P1 — Sibling module, not gates-registry.cjs extension

**D-06** originally said "`gates-registry.cjs` loads `review-providers.yaml`".
RESEARCH §2b and §3 R-3 + PATTERNS D1 recommend a **sibling module**
`super-gsd/scripts/lib/providers-registry.cjs` for separation of concerns —
`gates-registry.cjs` is cleanly scoped to gates.yaml; bolting a second YAML
plus a `config.json` read onto it violates separation.

This plan ships the **sibling module**. The bridge method lives on the sibling:
`providers-registry.resolveReviewerProvider(gateName)` takes the gate name,
calls `gatesRegistry.getGate(gateName)` to read the `reviewer_provider` field,
looks up that provider name in the providers cache, falls back to the
`config.review_providers.default_provider` if the gate has no
`reviewer_provider` field, and returns the provider record (or `null` if the
gate is not reviewer-shaped). The bridge calls *into* gates-registry but lives
*in* providers-registry — one-directional dependency, avoids circular imports.

### P3 — Create `sgsd-code-reviewer.md` stub in this plan

D-05 references `agent_subagent_type: sgsd-code-reviewer`, but that agent file
does not exist in `super-gsd/agents/`. Only the legacy `gsd-code-reviewer` lives
under `custom-gsd-extract/claude-agents/` (pre-SGSD-v2).

This plan ships **option (b)**: create `super-gsd/agents/sgsd-code-reviewer.md`
as a sibling task, as a thin v2-handover-contract stub that mirrors the
`sgsd-codex-reviewer.md` shape but with `invocation: agent` and no `shell_script`.
The two agents are contract-mirror siblings — shipping them together in one
commit keeps the registry pointing at real files and satisfies the feedback
rule (`feedback_sgsd_rename_rule.md`: the `sgsd-` prefix is earned by actively
enriching with v2-handover-contract + report-format declaration, which the stub
does). Option (a) — remap D-05 to `gsd-code-reviewer` — would ship a cleaner
diff but permanently break the rename convention for exactly this one agent.
Option (c) — defer — would ship Phase 14 with a registry-to-agent pointer that
doesn't resolve, which CODEX-05's harness would catch as a soft-fail. Option
(b) costs ~30 LoC and gets us to a clean substrate.

## Tasks

T1. **Author `super-gsd/registry/review-providers.yaml`**
  - Files: `super-gsd/registry/review-providers.yaml` (new)
  - Closest analog: `super-gsd/registry/gates.yaml:1-27` (header + frontmatter + enum block)
  - Reuse scripts: none (YAML only)
  - Content: banner comment header (what this registry is + P1-precedent note "first non-gates registry; new registries go here"); frontmatter triple per S4 (`schema_version: 1`, `registry_version: 1.0.0`, `last_updated: 2026-04-23`); enum block documenting `invocation_type: agent | shell` (reserved: `mcp`, `http`); `providers:` list with the two records per D-05. `claude-sonnet-reviewer` → `agent_subagent_type: sgsd-code-reviewer` (per P3). `codex-cli-reviewer` → `shell_script: super-gsd/scripts/codex-exec.sh` (matches 14-01 deliverable).
  - Verification: `node -e "const y=require('super-gsd/tools/plan-schema/node_modules/js-yaml'); const r=y.load(require('fs').readFileSync('super-gsd/registry/review-providers.yaml','utf8')); if (r.providers.length!==2) process.exit(1); if (!r.providers.every(p=>p.state==='active')) process.exit(1);"` exits 0.

T2. **Author `super-gsd/scripts/lib/providers-registry.cjs`**
  - Files: `super-gsd/scripts/lib/providers-registry.cjs` (new, ~110 lines)
  - Closest analog: `super-gsd/scripts/lib/gates-registry.cjs:1-97` (whole file, line-for-line shape)
  - Reuse scripts: js-yaml require path `gates-registry.cjs:41-44` (shared install; **do NOT `npm install` a second copy**)
  - API:
    - `let _cache = null` + `let _configCache = null` (module-level singletons)
    - `loadProviders(yamlPath = resolved-default)` — cache-once, build `byName` map
    - `getProvider(name)` — O(1) lookup; **hard-error on unknown name** per D-06a (copy `gates-registry.cjs:65-69` throw shape)
    - `loadReviewProvidersConfig(configPath = '.planning/config.json')` — reads JSON, caches `review_providers` block, returns the object (or defaults if the block is missing — warn, don't throw, so Phase 14 ships functional even if config wasn't patched yet)
    - `resolveReviewerProvider(gateName, gatesRegistry)` — one-direction import of `gates-registry.cjs` at top. Reads the gate row via `gatesRegistry.getGate(gateName)`. If the row has `reviewer_provider`, look that up. Otherwise read `loadReviewProvidersConfig().default_provider` and look **that** up. Return record, or `null` if the gate is not reviewer-shaped (no `reviewer_agent` field at all).
    - `resetCache()` — clears both caches for tests (copy from `gates-registry.cjs:92-94`)
  - Exports: `{ loadProviders, getProvider, loadReviewProvidersConfig, resolveReviewerProvider, resetCache }`
  - Verification:
    - `node -e "const p=require('./super-gsd/scripts/lib/providers-registry.cjs'); const g=p.getProvider('claude-sonnet-reviewer'); if (g.invocation_type!=='agent') process.exit(1);"` exits 0.
    - `node -e "const p=require('./super-gsd/scripts/lib/providers-registry.cjs'); try { p.getProvider('nonexistent'); process.exit(1); } catch(e) { if(!e.message.match(/unknown/i)) process.exit(1); }"` exits 0 (confirms D-06a hard-error).
    - `node -e "const p=require('./super-gsd/scripts/lib/providers-registry.cjs'); const g=require('./super-gsd/scripts/lib/gates-registry.cjs'); const r=p.resolveReviewerProvider('per-dispatch-ATC', g); if (r.name!=='claude-sonnet-reviewer') process.exit(1);"` exits 0.

T3. **Surgical edit to `super-gsd/registry/gates.yaml`**
  - Files: `super-gsd/registry/gates.yaml` (modify — 2 rows + 2 header lines)
  - Closest analog: *self* — rows `per-dispatch-ATC:37-58` and `phase-level-ATC:60-71`
  - Reuse scripts: none (text edit)
  - Edit sites (exact):
    1. Line 52 (`per-dispatch-ATC`, after `reviewer_agent: sgsd-code-reviewer`, before `evidence_emitted:`): insert `    reviewer_provider: claude-sonnet-reviewer`.
    2. Line 65 (`phase-level-ATC`, same position): insert `    reviewer_provider: claude-sonnet-reviewer`.
    3. Line 15 header: bump `registry_version: 2.0.0` → `registry_version: 2.1.0`.
    4. Line 16 header: update `last_updated:` to `2026-04-23`.
  - Verification: `grep -c 'reviewer_provider: claude-sonnet-reviewer' super-gsd/registry/gates.yaml` reports **2**; `grep 'registry_version:' super-gsd/registry/gates.yaml` reports `2.1.0`.

T4. **Author `super-gsd/agents/sgsd-code-reviewer.md` (P3 resolution — stub for Claude reviewer)**
  - Files: `super-gsd/agents/sgsd-code-reviewer.md` (new, ~45 lines)
  - Closest analog: `super-gsd/agents/sgsd-board-contrarian.md:1-47`
  - Reuse scripts: none (markdown)
  - Frontmatter: `name: sgsd-code-reviewer`; `description:` (ATC 7-step + 10-point anti-slop reviewer, Claude-backed, mirrors Codex sibling's report contract); `invocation: agent` (net-new field, agent-dispatch path); `model: sonnet`; `report_contract: code-reviewer-v1`.
  - XML blocks: `<role>`, `<objective>`, `<inputs>` (phase, scope, tier, diff_summary, plans_completed, checks), `<output>` (FINDINGS | CRITICAL | WARNINGS | PASS_RATE | ONE_LINER — **exact text match** with CODEX-04 D-12), `<boundaries>` (max 300 words, report-only, no preamble, no file writes beyond the review target).
  - Verification: file exists; frontmatter has `invocation: agent` + `report_contract: code-reviewer-v1`; `<output>` block contains literal text `FINDINGS | CRITICAL | WARNINGS | PASS_RATE | ONE_LINER`.

T5. **Author `super-gsd/agents/sgsd-codex-reviewer.md` (CODEX-04)**
  - Files: `super-gsd/agents/sgsd-codex-reviewer.md` (new, ~45 lines)
  - Closest analog: `super-gsd/agents/sgsd-board-contrarian.md:1-47` PLUS T4 sibling (for contract mirror)
  - Reuse scripts: none (markdown)
  - Frontmatter per D-12: `name: sgsd-codex-reviewer`; `description:`; `invocation: shell` (net-new, D-12a); `shell_script: super-gsd/scripts/codex-exec.sh` (net-new; points at 14-01 deliverable); `report_contract: code-reviewer-v1` (matches T4 sibling and D-13).
  - XML blocks: identical **shape** to T4; description says "External code reviewer backed by Codex CLI (OAuth). Mirrors `sgsd-code-reviewer` report contract exactly." Boundaries include "no external network beyond Codex CLI" (D-12 `<boundaries>`).
  - Verification: file exists; frontmatter has `invocation: shell` + `shell_script: super-gsd/scripts/codex-exec.sh` + `report_contract: code-reviewer-v1`; `<output>` block matches T4's verbatim. **(covers D-23 invariant 4)**

## Acceptance criteria

A1. `super-gsd/registry/review-providers.yaml` exists, parses as YAML, has `schema_version: 1`, `registry_version: 1.0.0`, and two providers both with `state: active`. **(covers D-23 invariant 2)**
A2. `providers-registry.cjs` sibling module exists at `super-gsd/scripts/lib/providers-registry.cjs`, exports `{ loadProviders, getProvider, loadReviewProvidersConfig, resolveReviewerProvider, resetCache }`, and requires `js-yaml` from the shared install path (no second `npm install`). **(covers P1, D-06-as-revised)**
A3. `getProvider('unknown-name')` throws with a message matching `/unknown provider/i`. **(covers D-06a)**
A4. `resolveReviewerProvider('per-dispatch-ATC', gatesRegistry)` returns a record with `name: "claude-sonnet-reviewer"`; the same call for a non-reviewer-shaped gate returns `null`. **(covers D-10)**
A5. `gates.yaml` rows `per-dispatch-ATC` AND `phase-level-ATC` both declare `reviewer_provider: claude-sonnet-reviewer`; `registry_version: 2.1.0`. **(covers D-23 invariant 3)**
A6. `super-gsd/agents/sgsd-codex-reviewer.md` exists with required frontmatter keys (`name`, `description`, `invocation: shell`, `shell_script`, `report_contract: code-reviewer-v1`) and the 5-field output contract declared in the `<output>` block. **(covers D-23 invariant 4)**
A7. `super-gsd/agents/sgsd-code-reviewer.md` exists as a sibling stub; `invocation: agent`, `model: sonnet`, `report_contract: code-reviewer-v1`; `<output>` block verbatim-identical to the Codex sibling's `<output>` block. **(covers P3, enables `sgsd-code-reviewer` pointer from review-providers.yaml to resolve)**
A8. No `sgsd-orchestrate/SKILL.md` edit lands in this plan (Phase 14 substrate-only discipline). **(covers D-11/D-11a)**

## Non-goals

- **No orchestrator rewire** — `sgsd-orchestrate/SKILL.md` Steps 6.5 / 9.5 / 9.6 stay hardcoded at `Agent(subagent_type: "sgsd-code-reviewer" OR "gsd-verifier", ...)`. Phase 15 flips this.
- **No third provider** — Gemini, local models, etc., are post-v1.3 per D-24.
- **No agent-frontmatter schema validator** — RESEARCH §3 R-1 verified none exists; adding one now is out of scope. Phase 15 consumer will add validation where it lives (in the dispatch path).
- **No registry self-mutation skill** — D-08: no `sgsd-provider-add`. Registry is operator-gated.
- **No `gsd-code-reviewer` legacy agent cleanup** — `custom-gsd-extract/claude-agents/gsd-code-reviewer.md` stays untouched. Plan ships a sibling sgsd-* stub and lets the legacy file stay where it is for now.

## Evidence lineage

- CONTEXT decisions covered: **D-05, D-05a, D-06 (w/ P1 deviation), D-06a, D-07, D-08, D-09, D-09a, D-10, D-10a, D-11, D-11a, D-12, D-12a, D-13**
- RESEARCH findings consumed: **§2b (cache-singleton pattern), §2c (agent frontmatter fields), §2f (`code-reviewer-v1` inline at SKILL.md:488 + naming-drift flag), §3 R-1 (no agent validator), §3 R-3 (sibling module recommendation), §5 14-02**
- PATTERNS analogs reused: **gates-registry.cjs:1-97 (whole shape for sibling), gates.yaml:14-16 (frontmatter triple — S4), sgsd-board-contrarian.md:1-47 (agent stub shape), S5 (js-yaml shared install), S8 (hard-error-on-unknown)**
- Pattern Divergences: **D1 (first non-gates registry), D2 (invocation: shell net-new), D4 (naming drift — resolved via P3)**
- VTP evidence: BYPASSED (Phase 14 VTP-agnostic per D-11/D-24)
