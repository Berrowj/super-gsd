---
name: sgsd-audit
description: "Evidence-gated audit skill. Catches the 'file never existed' class of implementation-vs-roadmap gap (M026's 22%-gap root cause). Merges ATC SpaceX gate + Karpathy evidence-over-assertions + optional runtime probes + DLB-07 semantic-AC enforcement. Produces AUDIT.md + REMEDIATION.md for every phase close."
argument-hint: "[phase_number] — e.g. /sgsd-audit 124  or  /sgsd-audit (auto-detect from STATE.md)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
---

<objective>
Four-layer evidence audit run against a single phase before it can be marked complete.

- **Layer 1 — Existence reconciler**: grep + filesystem checks. Catches "the plan said X.py exists with class Y" when there is no X.py or Y isn't in it. M026 22%-gap catcher. Fast (<10s), mandatory.
- **Layer 2 — Evidence-block verdicts**: for each must-have claim in PLAN.md, there must be a corresponding evidence block classified LIVE | CODE | STUB. Abolishes "VERIFIED (code-level)". Fast (<30s), mandatory.
- **Layer 3 — Runtime probes (OPTIONAL)**: curl API endpoints + Chrome DevTools MCP browser navigation. Timebox 60s total. Opt-in via non-empty `key_links:` block.
- **Layer 4 — Semantic-AC enforcement (DLB-07, mandatory for v2 plans)**: read `semantic_acceptance_criteria` from PLAN.md frontmatter; execute each entry's `verification_cmd` against real data; bind exit codes to the audit verdict. Replaces "structural-only ACs are sufficient" — the lesson from the Clarity ERP 2026-05-18 incident.

Output: `{PHASE_DIR}/AUDIT.md` + (if FAIL) `{PHASE_DIR}/REMEDIATION.md`.

Design constraints (binding, from DLB-03 + DLB-07):
- Soft enforcement only at phase close. Blocking at milestone close (orchestrator check).
- Zero false negatives tolerated. False positives tolerated (audit flags FAIL when actually fine → operator reviews).
- Hard 120s total timeout (90s for Layers 1-3 + 30s for Layer 4). Audit that hangs is broken.
- Never silently re-run on FAIL. Write AUDIT.md + REMEDIATION.md separately; commit both.
- 5 guardrails from DLB-03 Contrarian all binding: VACUOUS-PASS, CONTRACTS-MODIFIED flag, dirty-state, timeout → non-blocking, REMEDIATION.md separation.
- **Feature-wide claims require Pattern E `scope_checks:`** (added 2026-04-16 after C-007 mistake). Single-file `artifacts:` checks UNDER-AUDIT when the claim is "matches design system / no inline styles / uses [framework] / no hardcoded X". When you see those phrases in PLAN.md, look for a `scope_checks:` block — if missing, audit should auto-suggest one and downgrade the claim to PARTIALLY_VERIFIED.
- **Semantic ACs must run against real data** (DLB-07). The `verification_cmd` must exercise production data, real APIs, real files on disk. Fixtures don't count. Empty-array `semantic_acceptance_criteria` is rejected at plan-schema-v2 level (SCHEMA-09), so by the time audit sees a plan there's at least one entry.
</objective>

<phase_resolution>
## Step 1 — Resolve target phase

If argument provided: `PHASE={arg}` (e.g., "124", "97.5", "115-enrichment-pipeline-supplier-stock").

If no argument:
1. Read `.planning/STATE.md` frontmatter — extract `active_phase` (or derive from `milestone_status`).
2. If no active phase resolvable → stop with error: "No active phase. Pass one as argument."

Set `PHASE_DIR=.planning/milestones/{milestone}/phases/{NN-...}/` (glob match for "{PHASE}-*" if user passed just "124").
Fallback to `.planning/phases/{NN-...}/` for legacy layouts.
If no dir matches → stop with error: "Phase {PHASE} not found."
</phase_resolution>

<layer_1>
## Step 2 — Layer 1: Existence reconciler

### Inputs
- `{PHASE_DIR}/PLAN.md` OR per-plan `{NN}-PLAN.md` files
- `.planning/PROJECT.md` (or `.gsd/PROJECT.md`) for canonical-package list
- `CLAUDE.md` for `min_lines` defaults per file type

### Extraction patterns

**Pattern A — YAML frontmatter `artifacts:` / `files:` block**

```yaml
artifacts:
  - path: clarity_pipeline/stages/enrich_items.py
    min_lines: 150
    contains: [class EnrichItemsFlow, def run_enrichment]
    imports_from: [pipeline.config, clarity_pipeline.readers]
```

Each entry = one `check_unit`.

**Pattern B — Inline backtick paths** (`path/to/file.ext`)
Treat each unique path as a `check_unit` with only `exists` enabled, unless a `must contain:` / `shall export:` clause is paired within 3 lines.

**Pattern C — `key_links:` frontmatter**

```yaml
key_links:
  - from: src/internal-dashboard/src/pages/DataQuality.tsx
    to: http://localhost:8000/api/data-quality
    via: src/services/api/useDataQuality.ts
    pattern: useQuery hook with transformation
```

Extract `from` + `via` as Pattern A-style units with `exists` + `contains`.

**Pattern D — `must contain:` / `shall export:` inline bullets**
Extract path + contains-list.

**Pattern E — `scope_checks:` for feature-wide assertions**

```yaml
scope_checks:
  - dir: src/internal-dashboard/src/features/procurement/
    extensions: [tsx, ts]
    must_not_match:
      - regex: "#[0-9a-fA-F]{6}"
        label: "no hardcoded hex color literals"
        max_occurrences: 0
    must_match:
      - regex: "@mantine/core"
        label: "every .tsx file imports Mantine"
        min_occurrences: 1
        per_file: true
```

Each entry expands to N×M check_units. Per-unit shell:

```bash
COUNT=$(grep -rcE "{regex}" --include="*.{ext}" {dir} | awk -F: '{sum+=$2} END {print sum}')
[ "$COUNT" -gt "{max_occurrences}" ] && verdict=FAIL
```

When PLAN claims include any of: "matches design system", "no inline styles", "uses [framework]", "no hardcoded URLs / colors / paths", "no TODOs left", "all components import [package]" — auto-suggest a `scope_checks:` block; downgrade to PARTIALLY_VERIFIED if absent.

### Per-unit checks (each 5s timeout)

1. **`exists`** — `Path(repo_root / unit.path).is_file()`. Fail → halt unit, verdict=FAIL.
2. **`min_lines`** — `wc -l {path}`. Defaults: `clarity_pipeline/stages/*.py` → 100, `pipeline/flows/*.py` → 150, `backend-dotnet/**/*Endpoints.cs` → 80, `src/internal-dashboard/src/pages/*.tsx` → 120, `src/internal-dashboard/src/components/*.tsx` → 60, else → 20. Fail → verdict=WARN (some files legitimately short).
3. **`contains`** — language-aware grep:
   - Python: `grep -E "^class {Symbol}|^def {symbol}|^{Symbol}\s*=" {path}`
   - TS/TSX: `grep -E "export (const|function|class|interface|type) {Symbol}" {path}`
   - C#: `grep -E "(class|interface|record) {Symbol}|public.*{Symbol}\s*\(" {path}`
   - Fail → verdict=FAIL with grep command in evidence.
4. **`imports_from`** — canonical-package compliance:
   - Python: `grep -E "^(from|import) {package}" {path}`
   - TS: `grep -E "^import.*from ['\"]{package}" {path}`
   - Fail → verdict=FAIL.
5. **`pattern`** (Pattern C key_links) — naive word-grep on the `via` file; ≥80% of words hit → PASS, else WARN.

### Aggregation
- Any unit FAIL → Layer 1 = FAIL; stop propagating to Layer 2.
- All units PASS → Layer 1 = PASS.
- Mix of PASS + WARN → Layer 1 = WARN, continue.
- Zero extractable units → Layer 1 = SKIPPED, reason="PLAN.md lacks artifacts/files/key_links blocks".

### Timebox
30s total for Layer 1. Per-unit 5s cap. Timeout → partial + TIMEOUT verdict for unchecked units.
</layer_1>

<layer_2>
## Step 3 — Layer 2: Evidence-block verdicts

### Goal
Ensure every claim ("the user can click X and see Y" / "the endpoint returns Z") is backed by an explicit evidence classification, not a hand-wave.

### Verdicts per claim (mandatory triage)

**`LIVE`** — runtime-verifiable. Evidence is real interaction:
- curl output with status + JSON body
- mongosh/psql query result
- Playwright/Chrome-DevTools screenshot + network trace
- log excerpt with timestamp

Evidence block (in PLAN.md or `EVIDENCE.md`):

```markdown
### Evidence: {claim_text}
**Verdict**: LIVE
**Captured**: 2026-04-15 14:32
**Method**: curl http://localhost:8000/api/reports/summary
```json
{"total_docs": 605034, "enriched_pct": 97.4, ...}
```
```

**`CODE`** — code implementing the claim exists, compiles, imports correctly. Layer 1 PASS auto-marks file claims as CODE-eligible. CODE alone is **WARN**, not PASS.

**`STUB`** — explicit "not yet implemented". Must include `STUB_REASON: {why}`. Never blocks.

### Rules

**R1 — `VERIFIED (code-level)` is abolished.** Any occurrence of that literal string in any audit-readable file → Layer 2 verdict = ERROR, halt audit, surface string + file + line.

**R2 — Missing evidence for LIVE-class claim = FAIL.** Classification-inference heuristics:
- "returns", "shows", "displays", "renders", "responds with" → LIVE
- "implements", "exports", "defines", "includes" → CODE
- "eventually", "future", "out of scope", "deferred" → STUB

**R3 — Empty result ≠ evidence.** `[]`, `{}`, 0 docs → VACUOUS-PASS. Never green.

**R4 — Stale evidence.** `Captured:` > 7 days from audit time → downgrade to CODE-equivalent, flag STALE.

**R5 — `acceptance` without structure** → SKIPPED-MALFORMED (WARN, not FAIL; don't retroactively block).

**R6 — UI-flow claims require browser-trace evidence.** Verbs *type, click, see, navigate to, dropdown opens, results appear, page renders, button works, search returns* mean **API 200 is insufficient**:

1. The frontend component must be identified (source file). If audit can't name the component → `MISSING_FE_REF` (FAIL).
2. Every endpoint the component calls must be enumerated (grep `fetch(`, `axios.`, `useQuery`, `useMutation`, `apiClient.`). The endpoints in the audit must MATCH this list.
3. Each endpoint returns 200 with non-empty payload OR explicitly satisfies the contract.
4. The browser probe shows the resulting UI state — dropdown opens with rows, page navigates, toast appears. "Spinner shown" / "Searching…" → `STUCK_UI` (FAIL).
5. The 200-only path is forbidden. `curl /api/search → 200 []` against a populated domain → `ENDPOINT_ONLY` (FAIL).

Required evidence-block format for UI-flow claims:

```markdown
### Evidence: header search bar returns results when user types a name
**Verdict**: LIVE (UI-flow)
**FE component**: src/internal-dashboard/src/components/feedback/CommandPalette/CommandPalette.tsx
**Endpoints called** (from grep):
  - GET /api/search/?q=...&top=8       (via useGlobalSearch hook)
  - GET /api/search/hybrid?q=...&limit=6  (inline fetch line 98)
**Probe**: .planning/tools/browser-audit/probe-searchbar-e2e.mjs
**Screenshots**:
  - sb-2-typed-{ts}.png — dropdown shows ≥1 row (NOT "Searching…")
**API trace**:
  - 200 GET /api/search/?q=Wallace → 8 results
**Captured**: 2026-04-16 22:42
```

Missing FE-component, endpoints-called, screenshots, or API trace → FAIL with specific subclass (`MISSING_FE_REF` / `ENDPOINT_ONLY` / `STUCK_UI`).

**R6 precipitating incident** (2026-04-16): procurement search bar claimed "fixed" three times based on adding a route returning 200 — frontend never called that route. Endpoint-200 audits passed every time. User flow was dead every time.

### Aggregation
- All PASS + LIVE-class claims have LIVE evidence → Layer 2 = PASS.
- All PASS but ≥1 LIVE-class claim only has CODE evidence → Layer 2 = WARN.
- ≥1 FAIL → Layer 2 = FAIL.
- ≥1 VACUOUS-PASS → Layer 2 = VACUOUS (milestone blocker, not phase blocker).
- ≥1 R6 sub-class → Layer 2 = FAIL with `ui_flow_failed: true`; never downgradeable.
- ≥1 ERROR (code-level string) → Layer 2 = ERROR, halt audit.
- Zero extractable claims → SKIPPED, reason="PLAN.md lacks acceptance/must_haves section".

### Timebox
30s total. Per-claim 3s cap. Timeout → partial + TIMEOUT for unchecked.
</layer_2>

<layer_3>
## Step 4 — Layer 3 (OPTIONAL): Runtime probes

Skip if `{PHASE_DIR}/PLAN.md` has no `key_links:` block OR block is empty.

For each `key_link`:

**API probe** — `curl -sS --max-time 15 <url>`:
- 2xx (FAIL on 4xx/5xx)
- Response non-empty (FAIL on empty body → VACUOUS-PASS flag)
- If `expected_fields:` listed, each field present in parsed JSON

**Browser probe** — Chrome DevTools MCP (`.mcp.json`):
- `Page.navigate` to `http://localhost:5173/{route}`
- Wait 10s (networkidle)
- Collect `Network.responseReceived`
- Assert: HTTP 200, zero "error"-level console errors, ≥1 XHR/fetch to declared API, screenshot to `{PHASE_DIR}/audit-screenshots/{timestamp}.png`

### Timebox
60s total, 15s per sub-op. Timeout → partial + TIMEOUT verdict.
Skip gracefully if dev stack is down (port 5173 not responding). Record SKIPPED with reason.
</layer_3>

<layer_4>
## Step 5 — Layer 4 (NEW, DLB-07): Semantic-AC enforcement

The load-bearing layer of DLB-07's protection plan. Catches the "Clarity 2026-05-18" failure class: structural ACs all green while end-to-end behavior broken.

### When this layer runs

For ANY PLAN.md whose YAML frontmatter has `schema_version: 2`. (Plans without `schema_version: 2` are legacy and fall through Layer 1+2 only; the orchestrator flags them via plan-schema-v2 SCHEMA-09 at write-time so this list shrinks.)

### Extraction

1. Read PLAN.md frontmatter.
2. Locate `semantic_acceptance_criteria:` array. Plan-schema-v2 enforces `minItems: 1` (SCHEMA-09), so an empty array is impossible by the time audit runs. If for any reason the array is absent → Layer 4 = ERROR with `reason: SCHEMA-09 violation`.
3. For each entry, extract `input` (string), `expected_outcome` (string), `verification_cmd` (string). Plan-schema-v2 enforces these three fields per entry (SCHEMA-10).

### Per-entry execution

For each entry:

1. **Run** the `verification_cmd` via `bash -c`. Capture: exit code, stdout (first 2000 bytes), stderr (first 2000 bytes), duration.
2. **Bind to verdict**:
   - exit 0 → tentative PASS
   - non-zero exit → FAIL (record exit code + stderr excerpt)
3. **Cross-check expected_outcome** (best-effort substring match):
   - If `expected_outcome` contains a verbatim substring that appears in stdout → strengthen PASS verdict.
   - If `expected_outcome` describes a different state than the command surfaced (e.g. expected "PASS" but stdout shows "FAILED") → downgrade tentative PASS to WARN with `outcome_mismatch: true`.
4. **Real-data guard** (DLB-07 enforcement):
   - If `verification_cmd` references a path under `fixtures/`, `test-fixtures/`, `mock/`, or `__mocks__/` → Layer 4 = FAIL with `reason: fixture_path_in_real_data_check`. Semantic ACs must hit real data.
   - Whitelist: paths under `super-gsd/tools/plan-schema/fixtures/` are exempt (the plan-schema validator's OWN fixtures are intentionally real data for that validator's purpose).

### Aggregation

- All entries PASS → Layer 4 = PASS.
- ≥1 entry FAIL → Layer 4 = FAIL.
- ≥1 entry WARN (outcome_mismatch) → Layer 4 = WARN.
- Real-data guard fired → Layer 4 = FAIL with `fixture_violation_count: N`.
- All entries timed out → Layer 4 = TIMEOUT (non-blocking on phase close, blocking on milestone close).

### Per-entry output

```json
{
  "input": "SO 130018965 (real Mongo doc)",
  "expected_outcome": "overall_verdict == PASS",
  "verification_cmd": "python audit_gate_run.py --so 130018965",
  "exit_code": 0,
  "stdout_excerpt": "overall_verdict: PASS\nchain.invoice_present: PASS\n...",
  "stderr_excerpt": "",
  "duration_ms": 3421,
  "verdict": "PASS",
  "outcome_match": true,
  "real_data": true
}
```

### Timebox
30s total for Layer 4. Per-entry 10s cap. Timeout → partial + TIMEOUT verdict.

### Carve-out
A phase plan whose frontmatter declares `skip_gates: ["layer-4-semantic-ac"]` skips Layer 4. The orchestrator records this as a debt declaration in `.planning/metrics/audit-log.jsonl` with `skip_reason:` REQUIRED. This is the explicit historic-exemption path for plans that pre-date DLB-07.
</layer_4>

<output>
## Step 6 — Write output

### Top-level verdict (combined across all layers)

- All layers PASS + ≥1 LIVE evidence for LIVE claims + Layer 4 PASS → `PASS`
- All layers PASS but LIVE claims only have CODE evidence → `WARN`
- ≥1 FAIL in any layer → `FAILED`
- ≥1 VACUOUS-PASS (empty collection queried) → `VACUOUS`
- ≥1 Layer 4 real-data-guard violation → `FAILED` with `fixture_violation: true`
- Ran out of budget → `TIMEOUT`

### AUDIT.md format

Path: `{PHASE_DIR}/AUDIT.md`. Frontmatter:

```yaml
---
type: audit
phase: "{PHASE_ID}"
status: "PASS | WARN | FAILED | VACUOUS | TIMEOUT | ERROR"
run_at: "2026-05-18T14:32:00Z"
runner: "sgsd-audit@v2"
duration_ms: 8421
layers_run: [1, 2, 4]
layer1: { verdict: "PASS", checks: 12, passed: 12, failed: 0, skipped: 0, warn: 0 }
layer2: { verdict: "WARN", claims: 5, pass: 3, warn: 2, fail: 0, vacuous: 0 }
layer3: null
layer4: { verdict: "PASS", entries: 3, pass: 3, warn: 0, fail: 0, fixture_violations: 0 }
contracts_modified: false
vacuous_pass_count: 0
semantic_ac_count: 3
---
```

Body sections:
- `## Summary` — one paragraph of what the phase claimed and what audit proved
- `## Overall verdict: {STATUS}` — explicit next-action pointer to REMEDIATION.md if FAILED/WARN
- `## Layer 1 — Existence Reconciler` — table of file/check rows + failed-checks detail
- `## Layer 2 — Evidence-Block Verdicts` — one section per claim with class + verdict + evidence
- `## Layer 3 — Runtime Probes` — only rendered if layers_run includes 3
- `## Layer 4 — Semantic Acceptance Criteria` — one section per entry with input + expected_outcome + verification_cmd + exit code + stdout/stderr excerpts + verdict
- `## Failed Checks` — consolidated list with REMEDIATION.md pointers
- `## Evidence Attachments` — paths of captured files

Closing: `*Generated by /sgsd-audit on {ISO-date}. Do not edit by hand. Re-run /sgsd-audit {PHASE} after fixing to regenerate.*`

### REMEDIATION.md format

Path: `{PHASE_DIR}/REMEDIATION.md`. Written ONLY when AUDIT.md status is `FAILED`. Committed SEPARATELY after AUDIT.md (anti-gaming).

Frontmatter: `type: remediation`, `phase`, `audit_ref: AUDIT.md`, `generated_at`.

Body: one `## §N — {what failed}` section per failed check with **Failed check**, **Evidence of failure**, **Proposed fix** (concrete code), **Why this isn't a PASS**, **Re-audit** instruction.

Closing: `*Generated by /sgsd-audit. Delete this file manually after remediation lands and re-audit passes.*`

### Commit discipline (anti-gaming)

1. AUDIT.md commit — single commit, message:
   ```
   audit(P{N}): {STATUS} — L1:{pass/total} L2:{pass/total} L3:{...|skipped} L4:{pass/total}

   {CONTRACTS-MODIFIED tag if applicable}

   Generated by /sgsd-audit.
   ```
2. REMEDIATION.md commit (only on FAILED) — separate commit after AUDIT.md.
3. **Never amend audit commits.** Re-running audit = new commit, new timestamp. Append-only trail.

### Log artefact

Append to `.planning/metrics/audit-log.jsonl`:
```json
{"ts": "2026-05-18T14:32:30Z", "phase": "124", "status": "PASS", "l1_ms": 2341, "l2_ms": 4219, "l3_ms": 1861, "l4_ms": 8123, "total_ms": 16544, "contracts_modified": false, "semantic_ac_count": 3, "fixture_violations": 0}
```

### Schema contract

`runner: "sgsd-audit@v2"` (bumped from v1 with Layer 4 addition). Schema changes bump the version. `/sgsd-complete-milestone` parses frontmatter, tolerates unknown fields for forward-compat, refuses unknown `runner` versions — forces re-audit with new tool.
</output>

<anti_gaming>
## Non-negotiables (DLB-03 + DLB-07 guardrails)

1. **Never edit AUDIT.md after writing.** Fix the phase, re-run `/sgsd-audit`. Don't patch in-place.
2. **Never suppress a FAIL into a WARN** without an explicit `# OVERRIDE: reason` block in PLAN.md that a human wrote.
3. **VACUOUS-PASS never renders as green.** Empty collection = MILESTONE BLOCKER, not a green phase.
4. **TIMEOUT is non-blocking on phase close but blocking on milestone close.**
5. **120s hard total budget** (L1=30s, L2=30s, L3=60s, L4=30s; L3 budget reclaimable if skipped).
6. **Layer 3 is OPT-IN.** Missing `key_links:` ≠ FAIL.
7. **`VERIFIED (code-level)`** triggers ERROR, not WARN. Abolished verdict.
8. **Layer 4 fixture-guard is non-bypassable** except via the `skip_gates: ["layer-4-semantic-ac"]` historic-exemption path with `skip_reason:` REQUIRED. The DLB-07 lesson is mechanical, not advisory.
9. **Uniform results are alarms** (DLB-07 Rule 2): if Layer 4 reports N-of-N PASS across a sample where statistical heterogeneity is expected, log `uniform_result_warning: true` to AUDIT.md frontmatter. Future verifier hook can act on this signal.
10. **Operator-eyeball ACs are DONE or REMEDIATION** (DLB-07 Rule 3): claims that depend on human visual verification ("operator captures screenshot") must have evidence committed BEFORE phase close. No "post-session follow-up" punts.
</anti_gaming>

<usage>
## Invocation patterns

- **Manual**: `/sgsd-audit` — audits active phase from STATE.md
- **Manual (specific)**: `/sgsd-audit 124` — audits phase 124
- **From orchestrator Step 6.6** (see `sgsd-orchestrate/SKILL.md`): auto-dispatched after ATC code review passes, before phase marked complete
- **From `/sgsd-complete-milestone`**: checks that every phase in the milestone has a valid AUDIT.md (`runner: sgsd-audit@v2`) before allowing milestone close

## When NOT to run
- Phase has no PLAN.md → nothing to audit. Refuse with error.
- Phase is still being drafted (status != ready-for-verification) → skip, wait for verifier.
- Phase is explicitly marked `audit: skip` in PLAN.md frontmatter → emit SKIPPED-BY-CONFIG verdict.

## Budget accountability

Every run logs to `.planning/metrics/audit-log.jsonl` (see schema above). If p50 > 60s or p95 > 120s, operator gets a warning: "audit is drifting toward disabling-budget, review performance".

## DLB-07 cross-references

- `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — full post-mortem
- `super-gsd/templates/plan-schema-v2.json` — where SCHEMA-09/-10 reject plans without semantic_acceptance_criteria
- `super-gsd/tools/plan-schema/validate.cjs` — validator that emits those error codes at write-time
- `.planning/memory/architecture/patterns/semantic-vs-structural-verification.md` — operator-facing rule summary
</usage>
