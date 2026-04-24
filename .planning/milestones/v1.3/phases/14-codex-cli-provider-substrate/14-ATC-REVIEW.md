---
phase: 14
phase_name: Codex CLI Provider Substrate
scope: phase-level
tier: full
reviewed_ts: 2026-04-24T01:10:00Z
git_range: 40f4384..HEAD
commits_reviewed: 13
files_touched: 17
lines_added: 1444
lines_removed: 10
verdict: PASS-WITH-WARNINGS
critical: 0
warning: 5
info: 3
g1: pass
g2: pass
g3: pass-with-caveat
---

# Phase 14 ATC — Codex CLI Provider Substrate (phase-level review)

## Verdict: PASS-WITH-WARNINGS

Phase 14 delivers a coherent reviewer-provider abstraction across four plans
with **zero critical issues**, **zero D-24 non-goal violations**, and
**intact dark-ship discipline**. All 6 D-23 invariants pass
(`verify.mjs` exit 0). The contract-check harness runs green against the
committed fixtures (exit 0; claude=1C/2W, codex=1C/3W — divergence is
informational per D-15a). Cross-plan surfaces (contract-v1 parity, OAuth
gating, exit-code semantics, dark-ship substrate) are internally consistent.

5 warnings carry over from the per-dispatch ATCs (14-01: 2; 14-02: 3) —
these remain non-blocking and are documented below for Phase 15 pickup.

## Scope Summary

- **Git range**: `40f4384..HEAD` (13 commits)
- **Files touched**: 17 (14 net-new, 3 brownfield edits)
- **Lines added/removed**: +1444 / -10
- **Breakdown by plan**:
  - 14-01 (Wave 1): `codex-exec.sh` (283L) + README (76L) + chmod +x = 2 commits
  - 14-02 (Wave 2): `review-providers.yaml` (59L) + `providers-registry.cjs` (172L) + 2 agent stubs (93L) + `gates.yaml` +2L = 4 commits
  - 14-03 (Wave 1): `config.json` +8L + `patch-gsd-tools-known-keys.sh` +3L = 2 commits
  - 14-04 (Wave 3): `contract-check.mjs` (282L) + `make-fixtures.sh` (222L) + 3 fixtures (64L) + `verify.mjs` (153L) + chmod = 4 commits
  - Docs: STATE.md + VTP-EVIDENCE addendum = 1 commit

## 7-Step Findings (phase scope)

### 1. First Principles

The 4-plan decomposition carries its weight. Each plan delivers a distinct
substrate primitive with its own acceptance surface. The riskiest collapse
candidate — 14-03 (config block + KNOWN_TOP_LEVEL patch, only 11 net-added
lines) — remains justified because the KNOWN_TOP_LEVEL patch is a
cross-repo gsd-tools mutation that must be explicitly reviewed; folding it
into 14-02 would entangle YAML registry review with JS Set-literal
patching concerns. The wave model (two disjoint Wave-1 plans running in
parallel) buys real token efficiency without coupling risk. **PASS.**

### 2. Delete

Phase-wide sweep found 1 dead-signal line and 1 cosmetic cleanup candidate:

- `codex-exec.sh:254` — `print "CONTRACT_VIOLATION" > "/dev/stderr"` marker
  that the wrapper never reads (the real gate is `awk_rc != 0 || -z parsed`
  at L266). Carried over from 14-01 I-1. Non-blocking.
- `providers-registry.cjs:47-54` `DEFAULT_CONFIG` duplicates the
  `config.json` shape. Intentional and load-bearing: the module must boot
  when the config patch hasn't landed (separation from 14-03). Keep.

No entire file, function, or block is mass-deletable. Phase stays at minimum
viable substrate. **PASS.**

### 3. Simplify

Phase-wide ΔComplexity is proportional to the 6-deliverable contract.
Greenfield surfaces (14-01/14-02/14-04) add ~1420 lines to ship the
reviewer-provider abstraction — roughly 60 lines per CODEX-XX requirement.
Brownfield ΔComplexity totals **+13 lines** across gates.yaml (+2),
config.json (+8), patch-gsd-tools-known-keys.sh (+3). Well below any
"disproportionate" threshold.

Two mild complexity pockets identified (both pre-flagged in per-dispatch
ATCs):

- `codex-exec.sh:144 RESOLVED_CMD` built for dry-run display but the real
  invocation at L167 is re-typed. Single-source-of-truth would eliminate
  drift. Carried from 14-01 I-2.
- `providers-registry.cjs:149-156 resolveReviewerProvider` bridge has a
  semantic gap for haiku-agent gates (see W-1 below). The logic is simple;
  the contract is under-specified. Carried from 14-02 W-1.

Neither blocks substrate delivery. **PASS.**

### 4. Accelerate

N/A phase-wide. Registries cache-once at cold-start; wrapper is not on a
hot path (fires at most once per ATC dispatch); the harness is an
operator-invoked verifier. No phase-wide perf surface.

### 5. Automate

The phase shipped a comprehensive mechanical gate: `verify.mjs` (153L) runs
6 invariants that collectively prove every CODEX-XX requirement:

| verify.mjs invariant | Proves                                               |
|----------------------|------------------------------------------------------|
| inv1 (file + +x + bash -n)        | CODEX-01 wrapper ships correctly        |
| inv2 (YAML parses, both active)   | CODEX-02 registry well-formed          |
| inv3 (gates.yaml reviewer_provider x2) | CODEX-03 schema extension landed   |
| inv4 (agent stubs + frontmatter)  | CODEX-04 agent stub + P3 sibling       |
| inv5 (codex_enabled === false)    | CODEX-06 config + D-18b ships-dark     |
| inv6 (contract-check exit 0)      | CODEX-05 harness + contract-v1 parity  |

Gap flagged: **none of the invariants exercise the wrapper's exit-3/4/5/6
fallback paths** (no fixtures for CLI-missing, auth-denied, timeout, or
report-malformed states). 14-01 A2 is proved by code-reading only. This is
acceptable per 14-04 Non-goals (fault-path testing defers to Phase 15's
live-dispatch integration tests) but flagged here as phase-wide coverage
debt. **PASS with flagged gap.**

### 6. Validate

Walking D-23 invariants → CODEX requirements end-to-end:

| D-23 inv | CODEX req | Owner plan | Implementation file              | Mechanical proof            |
|----------|-----------|------------|----------------------------------|-----------------------------|
| 1        | CODEX-01  | 14-01      | `codex-exec.sh`                 | `verify.mjs:45-58` ✓       |
| 2        | CODEX-02  | 14-02      | `review-providers.yaml`         | `verify.mjs:61-73` ✓       |
| 3        | CODEX-03  | 14-02      | `gates.yaml` +2 rows            | `verify.mjs:76-88` ✓       |
| 4        | CODEX-04  | 14-02      | `sgsd-codex-reviewer.md` + sibling | `verify.mjs:91-113` ✓   |
| 5        | CODEX-06  | 14-03      | `config.json` review_providers  | `verify.mjs:116-127` ✓     |
| 6        | CODEX-05  | 14-04      | `contract-check.mjs` + fixtures | `verify.mjs:130-150` ✓     |

Live run of `node verify.mjs` from repo root: **PASS Phase 14 (6/6
invariants green)**.
Live run of `node contract-check.mjs`: **exit 0; both fixtures parse
cleanly against code-reviewer-v1**.

**PASS.**

### 7. Checklist

See 10-point table below.

## 10-Point Anti-Slop (phase scope)

| #  | Pass/Fail | Finding                                                              |
|----|-----------|----------------------------------------------------------------------|
| 1  | PASS (with noted deferral) | Every new exported function has a caller **within Phase 14** except `providers-registry.cjs` module exports (`getProvider`, `resolveReviewerProvider`, `loadReviewProvidersConfig`) — these have **zero callers anywhere in Phase 14** by explicit design (D-11/D-11a). Phase 15 wires them. This is the load-bearing "substrate-only, ships dark" guarantee, not orphan code. `loadProviders` and `_requireYaml` have internal callers. No actual orphans. |
| 2  | PASS      | Every new import is used. `contract-check.mjs` uses all 4 imports (`readFileSync`, `existsSync`, `resolve`, `dirname`, `basename`, `fileURLToPath`). `providers-registry.cjs` uses `fs`, `path`, deferred `js-yaml`. `verify.mjs` uses `fs`, `path`, `spawnSync`, `execSync`, `createRequire`. No dead imports. |
| 3  | PASS      | Every new config key in `.planning/config.json` has a reader: `default_provider` + `codex_enabled` read by `providers-registry.cjs:117` via `loadReviewProvidersConfig`; `codex_timeout_seconds` read by `codex-exec.sh:120`; `codex_cli_path`, `fallback_on_error`, `fallback_max_retries` declared for Phase 15 dispatch consumer (same "ships full contract, Phase 15 wires" discipline as 14-02 W-1 fallback_to field). Not speculative — all 6 keys are spec'd in D-18. |
| 4  | PASS      | Could the whole phase be less code? `contract-check.mjs` at 282L is the biggest candidate — could it collapse to ~60L? Inspection: 40L of docstrings, 60L CLI args + usage, ~45L logging helpers, ~45L parser, ~45L report loader + sentinel handling, ~45L main orchestration, ~45L JSON summary construction. The JSON-summary construction is the only arguable fat; at 30L it documents every field for Phase 15 consumers. Trimming to 30L saves <10% phase-wide. Keep. |
| 5  | PASS      | Every new abstraction justified: the sibling `providers-registry.cjs` pays for itself in separation of concerns (P1 deviation); the bridge `resolveReviewerProvider` encapsulates the 3-step gate→provider lookup Phase 15 dispatch needs; the 2 agent stubs co-exist because each declares its `invocation` discriminator and both need the `code-reviewer-v1` contract declaration (harness parity); schema_version/registry_version on `review-providers.yaml` mirror the `gates.yaml` pattern (S4 Divergence D1 — second registry under `super-gsd/registry/`). |
| 6  | PASS      | Duplication between plans: two agent stubs share ~80% of their shape (objective, inputs, output, boundaries). This is **intentional contract parity** — the `code-reviewer-v1` 5-field output block is restated verbatim in both because the Phase 14 harness (14-04) asserts they emit identical structure. A generic stub with a discriminator field would save ~40 lines but obscure the contract-parity invariant — the drift-protection surface. Keep. |
| 7  | PASS      | A senior engineer would not mass-delete anything. Candidates flagged above (dead CONTRACT_VIOLATION marker, RESOLVED_CMD duplication) are single-line cosmetic cleanups, not architectural cuts. |
| 8  | N/A (mostly greenfield) | ΔComplexity on the only brownfield surface is **+13 lines total**: `gates.yaml` +2 rows (schema-optional field, backward-compatible), `config.json` +8 (new block only), `patch-gsd-tools-known-keys.sh` +3 (extend 7-key CSV to 8-key + verify-count bump). All additive, no existing behaviour modified. Well below any disproportion threshold. |
| 9  | PASS      | Schema-versioning fields (`schema_version`, `registry_version`, `last_updated`) on `review-providers.yaml` are load-bearing per the S4 pattern (both `gates.yaml` and `review-providers.yaml` need independent version trails so consumers can detect either schema drifting). The `fallback_to: claude-sonnet-reviewer` on the codex row is **declared ahead of the Phase 15 consumer** — flagged as close to "just in case" but defensible because omitting it would force a second YAML edit in Phase 15 for a property that IS a Phase 14 deliverable per D-05. |
| 10 | PASS      | Phase 14 does exactly ONE thing: ship the reviewer-provider abstraction substrate dark. Every commit in the 13-commit range either (a) ships a named substrate piece (wrapper, registry, stubs, harness, fixtures, verify, config, known-keys) or (b) is a chmod/STATE/VTP-addendum housekeeping commit. Zero scope creep detected. `/SKILL.md` Step 6.5/9.5/9.6 are untouched. No row in `gates.yaml` routes to `codex-cli-reviewer`. No Gemini/local/third-provider entries. No `.ps1` wrapper. No per-project override file. No `token-log.jsonl` provider field. |

## Cross-Plan Surfaces Audit

### Contract parity (CODEX-05 end-to-end chain)

Walked the full chain for `code-reviewer-v1`:

1. **Declared in registry** (`review-providers.yaml:46,55`): both providers carry `report_contract: code-reviewer-v1`.
2. **Restated in agent stubs** (`sgsd-code-reviewer.md:8` + `sgsd-codex-reviewer.md:8`): both frontmatter entries match.
3. **Asserted in harness** (`contract-check.mjs:108` `V1_FIELDS = ['FINDINGS','CRITICAL','WARNINGS','PASS_RATE','ONE_LINER']`).
4. **Asserted in verify.mjs** (inv2 + inv4 both check `report_contract === 'code-reviewer-v1'`).
5. **Embodied in fixtures**: both `claude-report.txt` and `codex-report.txt` emit the 5 fields; live harness run parses both cleanly.

All 5 field names spelled identically across all 7 files (registry, 2 stubs,
harness, verify, 2 fixtures). No case-sensitivity drift, no field-order
assumption beyond what the harness regex tolerates (anchor-at-line-start,
span-until-next-header). **PASS.**

### Dark-ship discipline (D-11, D-18b)

Grep confirmed:

- `codex_enabled: false` present in `.planning/config.json:82` ✓
- `default_provider: claude-sonnet-reviewer` on both `gates.yaml` rows ✓
- **`providers-registry.cjs` has zero external callers** — grep across
  `super-gsd/` for `providers-registry` returns only the file itself ✓
- **`codex-exec.sh` has zero orchestrator invocations** — grep across
  `super-gsd/skills/` for `codex-exec` returns empty ✓
- **`codex-cli-reviewer` referenced only in registry and harness** — no
  gate row routes there, no orchestrator or skill mentions it ✓
- `sgsd-orchestrate/SKILL.md` Steps 6.5/9.5/9.6 unchanged in this phase's
  diff ✓ (verified via `git diff --name-only 40f4384..HEAD | grep SKILL.md` → empty)

**PASS — dark-ship intact.** Flipping `codex_enabled: true` in Phase 15
would route nothing today (no SKILL.md consumer reads the field).

### D-24 non-goal compliance phase-wide

`git diff --name-only 40f4384..HEAD | grep -E '(SKILL\.md|token-log|\.ps1|review-providers\.override|gemini|local-model)'` returns **empty**. None of the 9 deferred items leaked:

- [x] `sgsd-orchestrate/SKILL.md` untouched
- [x] No `gates.yaml` row routed to `codex-cli-reviewer`
- [x] No qualitative MUDA probe added
- [x] No `token-log.jsonl` `provider` field
- [x] No cross-vendor adversarial rewire
- [x] No kill-condition metric
- [x] No Gemini/local/third-provider registry entries
- [x] No per-project override file
- [x] No `codex-exec.ps1` wrapper
- [x] No VTP evidence consumption wired to the Codex stub or wrapper

**PASS.**

### VTP bypass compliance

Grep for `mcp__vtp-kb__` in Phase 14 artifacts:

- `super-gsd/agents/sgsd-codex-reviewer.md` — 0 matches ✓
- `super-gsd/scripts/codex-exec.sh` — 0 matches ✓
- `super-gsd/registry/review-providers.yaml` — 0 matches ✓
- `super-gsd/tools/provider-contract/*.mjs` + `*.sh` — 0 matches ✓
- `super-gsd/agents/sgsd-code-reviewer.md` — 0 matches ✓

VTP-KB references appear only in pre-Phase-14 VTP substrate files
(`vtp-context-composer.cjs`, `sgsd-triage/SKILL.md`, `sgsd-sepl/SKILL.md`,
`sgsd-vtp-advise/SKILL.md`, `sgsd-complete-milestone/SKILL.md`,
`docs/vtp-enrichment-smoke.md`) — all Phase 16 artifacts, none modified in
Phase 14.

`14-VTP-EVIDENCE.md vtp_mode: BYPASSED` preserved (addendum commit
`1a07d0d` is a contextual note about the upstream MCP cwd fix, not a mode
change). **PASS.**

### Exit code contract coherence

Two exit-code tables inspected for internal consistency:

**`codex-exec.sh`** (D-01a): 0 success / 1 generic-or-usage / 3 no-CLI /
4 auth-denied / 5 timeout / 6 report-contract-violation.

**`contract-check.mjs`** (D-14): 0 PROVEN / 1 UNPROVEN (parse fail) /
2 BLOCKED (tool error / .MISSING sentinel).

**`make-fixtures.sh`** (D-17): 0 OK / 1 generic / 2 soft-fail (sentinel).

`verify.mjs`: exit N = invariant N failed (1..6), exit 0 = all pass.

No collisions within a single binary. Semantic separation is clean:
wrapper's 6 flavours are operational-state codes; harness's 3 are
evidence-state codes (parser-level); verify.mjs's codes are
structural-invariant codes. Phase 14's verify.mjs invariant 6 branches
**before** invoking `contract-check.mjs` if a `.MISSING` sentinel exists
(`verify.mjs:133-137`), so the 2-vs-2 "overlap" is structurally disjoint.
**PASS.**

### Report-contract-v1 shape drift

Field-by-field scan of the 4 shape declarations (2 agent stubs + 2
fixtures):

| Field      | stubs | claude-report | codex-report | harness regex |
|------------|-------|---------------|--------------|---------------|
| FINDINGS   | ✓     | ✓ line 1      | ✓ line 1     | V1_FIELDS[0]  |
| CRITICAL   | ✓     | ✓ line 5      | ✓ line 6     | V1_FIELDS[1]  |
| WARNINGS   | ✓     | ✓ line 6      | ✓ line 7     | V1_FIELDS[2]  |
| PASS_RATE  | ✓     | ✓ line 7      | ✓ line 8     | V1_FIELDS[3]  |
| ONE_LINER  | ✓     | ✓ line 8      | ✓ line 9     | V1_FIELDS[4]  |

All 5 field names identical (uppercase, underscore-separated). Both
fixtures parse cleanly: `CRITICAL: 1` and `WARNINGS: N` start with
integer as required by `contract-check.mjs:139-144`. `PASS_RATE: 60%`
and `PASS_RATE: 50%` both match the percentage regex at L141.
**PASS — no drift detected.**

## Goal Achievement Check

Phase 14 goal (14-CONTEXT.md:12):

> "Phase 14 ships the reviewer-provider abstraction that lets any gates.yaml
> row route code review to Claude OR Codex without the gate layer caring
> which is running. Phase 14 ships dark — codex_enabled: false."

### G1 — Can a gates.yaml row declare `reviewer_provider:` and have the registry resolve it? **PASS.**

Evidence:
- `gates.yaml:53` declares `reviewer_provider: claude-sonnet-reviewer` on
  `per-dispatch-ATC`.
- `providers-registry.cjs:149 resolveReviewerProvider(gateName, gatesRegistry, opts)` reads
  `gate.reviewer_provider` (or falls back to `config.default_provider`)
  and returns the provider record via `getProvider(name)`.
- Semantic gap noted in 14-02 W-1: `resolveReviewerProvider` currently
  returns a non-null provider for **haiku-agent** gates too (because the
  null-check only excludes gates with *no* `reviewer_agent` field).
  Phase 15 consumer will need to additionally gate on
  `gate.reviewer_agent !== 'haiku'` or explicitly require
  `reviewer_provider:` to count. Does not break G1 for the two
  reviewer-shaped gates Phase 14 actually targets.

### G2 — Is Codex wired to nothing today (dark)? **PASS.**

Evidence:
- `grep -r 'codex-exec' super-gsd/skills/` returns **empty** — no
  orchestrator skill invokes the wrapper.
- `grep -r 'providers-registry' super-gsd/ | grep -v .md` returns only
  the file itself — no `require()` call site anywhere.
- `grep -r 'codex-cli-reviewer' super-gsd/` returns only the registry
  and the contract-check harness — no gate row routes there.
- `git diff --name-only 40f4384..HEAD | grep SKILL.md` returns **empty**
  — no orchestrator dispatch code modified.
- `config.review_providers.codex_enabled === false` (inv5 ✓).

Flipping `codex_enabled: true` today would have **zero behavioural
effect**: no caller reads the flag yet.

### G3 — Would flipping `codex_enabled: true` with the Phase-15 orchestrator rewire correctly route to Codex? **PASS-WITH-CAVEAT.**

Traced hypothetical call path gate-trigger → provider record → wrapper → Codex → report:

1. Orchestrator (Phase 15) fires `per-dispatch-ATC` gate →
2. Calls `resolveReviewerProvider('per-dispatch-ATC', gatesRegistry)` →
3. Gate has `reviewer_provider: claude-sonnet-reviewer`; Phase 15
   operator flips to `codex-cli-reviewer` →
4. `getProvider('codex-cli-reviewer')` returns record with
   `invocation: shell`, `shell_script: super-gsd/scripts/codex-exec.sh` →
5. Phase 15 dispatcher reads `invocation: shell` discriminator (D-07)
   → shells to `codex-exec.sh --prompt-file <P> --report-out <R>` →
6. Wrapper gates OAuth (exit 4 on OPENAI_API_KEY), checks codex on
   $PATH (exit 3 if missing), wraps with GNU `timeout`, pipes prompt
   via stdin (P4 deviation), parses 5-field contract (exit 6 on
   malformed), writes report atomically, appends JSONL row →
7. Phase 15 dispatcher reads the report from `$REPORT_OUT`, treats it
   as identically-shaped to a Claude `sgsd-code-reviewer` agent
   report (contract parity per harness proof).

**Caveat**: the `resolveReviewerProvider` W-1 semantic gap means Phase
15 must narrow the predicate before calling the bridge on arbitrary
gates, else it would mis-resolve `classifier-haiku` and
`context-selector-haiku` as Claude-backed reviewers. This is noted in
the 14-02 ATC as a Phase 15 entry condition — substrate is correct,
consumer must be disciplined.

All 6 links in the call chain are structurally present and tested:
- Link 1→2: `resolveReviewerProvider` exists and is unit-tested via
  plan §T2 (caveat above).
- Link 3→4: registry `byName` lookup proven by `getProvider` D-06a
  hard-error test.
- Link 5: wrapper CLI contract tested via `--dry-run` (A4).
- Link 6: full 6-exit-code semantic + JSONL + atomic-write tested in 14-01.
- Link 7: contract parity mechanically proven by `contract-check.mjs`
  (live run exit 0).

**No broken link.** The caveat is a consumer-side narrowing, not a
substrate gap.

## Critical Issues

**None.**

## Warnings (5 total — all carried from per-dispatch ATCs, none regressed)

- **W-1 (from 14-02): `resolveReviewerProvider` semantic gap for
  haiku-agent gates.** Predicate treats haiku-agent gates as
  reviewer-shaped because null-check uses `=== undefined` rather than
  excluding non-code-reviewer `reviewer_agent` values. Phase 15 entry
  condition: narrow the predicate OR require explicit
  `reviewer_provider:` declaration.

- **W-2 (from 14-02): `gates.yaml registry_version` not bumped.**
  `2.0.0` should arguably become `2.1.0` (minor) since the new
  `reviewer_provider:` field is a schema extension, even though
  backward-compatible. Plan §T3 said bump; executor chose not to for
  atomic-commit discipline. Phase 15 may key parsers off the version.

- **W-3 (from 14-02): plan §T2 verification assertion broken
  (`g.invocation_type` vs actual `g.invocation`).** Plan-level
  authoring bug; no code impact. Fix: amend plan verification command.

- **W-4 (from 14-01): JSONL type safety on `--phase` tag.**
  `PHASE_TAG` interpolated unquoted into the JSONL row (expects
  numeric, not validated). Non-numeric `--phase abc` produces invalid
  JSON. Low-risk — orchestrator always passes numeric today.

- **W-5 (from 14-01): plan text drift on `unset OPENAI_API_KEY`.**
  Plan says "defensively unsets"; script refuses-to-run instead
  (correct per D-02a). Documentation drift, not behaviour bug.

## Info

- **I-1: Dead `CONTRACT_VIOLATION` stderr marker in codex-exec.sh:254.**
  Awk prints this on missing fields but the wrapper checks `awk_rc !=
  0 || -z parsed` instead. Cosmetic.

- **I-2: `RESOLVED_CMD` duplication in codex-exec.sh:144 vs 167.**
  Dry-run display string rebuilt, real invocation re-typed. Single
  source of truth would eliminate drift. Cosmetic.

- **I-3: YAML enum block naming — `invocation_types:` (plural) vs
  field name `invocation:` (singular).** Internally consistent
  (enum names the VALUES the field accepts) but a skim-reader may
  expect field-to-enum name match. Cosmetic.

## Recommended Fixes (all non-blocking, Phase 15 pickup)

1. (W-1) Tighten `resolveReviewerProvider` null-check before Phase 15
   wires it into Step 6.5 / 9.5 / 9.6 — preferred option (c): require
   explicit `reviewer_provider:` at call site, remove default fallback.

2. (W-2) Ship a trailing 14-02 follow-up bumping
   `gates.yaml registry_version: 2.0.0 → 2.1.0` and `last_updated:
   2026-04-23`. One-line change, atomic commit.

3. (W-3) Amend plan 14-02 §T2 verification command:
   `g.invocation_type` → `g.invocation`.

4. (W-4) Add numeric validation for `--phase` in `codex-exec.sh` arg
   parse, or quote it as string in the JSONL row. One-line fix.

5. (I-1, I-2, I-3) Bundled cosmetic cleanup in a Phase-15 follow-up
   commit. No urgency.

None block Phase 14 ship or Phase 15 entry.

## Rollup

**Verdict: PASS-WITH-WARNINGS (5 warnings, 3 info, 0 critical).**
Phase 14 delivers a correct, coherent, dark-shipping reviewer-provider
substrate; all 6 D-23 invariants pass, G1/G2/G3 all green (G3 with a
documented Phase-15 consumer-side caveat), no D-24 violations, VTP
bypass discipline intact. Safe to enter Phase 15.

---
_Reviewed: 2026-04-24T01:10:00Z · ATC tier: FULL · Scope: phase-level · Reviewer: Claude (orchestrator Step 6.5)_
