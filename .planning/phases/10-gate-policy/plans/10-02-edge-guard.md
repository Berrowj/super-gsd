---
phase: 10-gate-policy
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/lib/edge-guard.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
autonomous: true
requirements:
  - GATE-04

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 10-02-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/edge-guard.cjs
    input_contract: |
      10-CONTEXT.md D-11 (default log-only; JSONL row shape `{from_step, to_step, expected_emits,
      actual_emits, missing_emits, context, resolution}` at `.planning/metrics/edge-guard-log.jsonl`).
      D-11a (per-gate opt-in `escalation: halt` halts the orchestrator).
      D-11b (NO rollback — halt + manual recovery only).
      D-11c (Step 11 token-log exempt from emit-check).
      10-RESEARCH.md §Pattern 4 (recommended ~80 LOC transition wrapper shape)
      and §Q4 (architecture: post-step audit via mtime diff on declared emit paths).
      R3 mitigation: snapshots restricted to paths in `gate.evidence_emitted` only (no broad globs).
      NOTE: This task builds the module but does NOT wire it into the live loop — that is Plan 10-03's
      job (per 10-RESEARCH.md §Recommended Plan Decomposition: "10-02 … no replacement of existing
      step-gate integration yet — that's 10-03's job").
    output_contract: |
      `super-gsd/scripts/lib/edge-guard.cjs` exists as a CJS module exporting `{ recordTransition }`.
      ~80 LOC. Depends on `./gates-registry.cjs` (for `getGate(name, gatesYamlPath)` lookup of
      `escalation` field) + `fs`, `path`.
      `recordTransition({fromStep, toStep, phase, plan, gateName, expectedEmits, actualEmits, ctx,
      gatesYamlPath, projectDir})` behaviour:
        - If `fromStep === 11`: early-return `{status:'ok', missing_emits:[]}` (D-11c exemption).
        - Compute `missing = expectedEmits.filter(e => !actualEmits.includes(e))`.
        - Look up gate if gateName provided; read `gate.escalation` (default `log-only`).
        - Build row `{ts, phase, plan, from_step, to_step, gate, expected_emits, actual_emits,
          missing_emits, context, resolution}` where resolution is `'pass'` (missing empty),
          `'log-only'` (missing but gate escalation is log-only or absent), or `'halt'`
          (missing AND gate.escalation === 'halt').
        - Append row as JSONL to `path.resolve(projectDir, '.planning/metrics/edge-guard-log.jsonl')`
          via `fs.appendFileSync` (after `fs.mkdirSync(..., {recursive:true})` for parent).
        - Return `{status: 'ok'|'logged'|'halt', missing_emits, row}`.
      Module MUST ship a CLI `--self-test` flag (invoked as `node edge-guard.cjs --self-test`) that:
        (a) creates a temp `gatesYamlPath` fixture with one gate `{name:'self-test', escalation:'log-only'}`,
        (b) calls `recordTransition` twice (once with no missing, once with one missing emit),
        (c) reads back the JSONL file, asserts 2 rows with expected `resolution` values,
        (d) deletes the JSONL rows (or the whole file), exits 0 on PASS / non-zero on FAIL.
    hypothesis: |
      A post-step mtime-diff wrapper restricted to `gate.evidence_emitted` paths captures
      missing-emit events with zero false positives from unrelated writers (R3 mitigation).
      Log-only by default (D-11) keeps the orchestrator running; per-gate `escalation: halt`
      opt-in (D-11a) gives hard-halt power only where explicitly configured. No git mutation
      means no rollback risk (D-11b). `--self-test` CLI lets GATE-04's jsonl-schema invariant
      be asserted without needing a live orchestrator loop.
    falsifier: |
      (a) `fromStep === 11` does NOT early-return → would log token-log's own transition (D-11c violation).
      (b) Missing emits with gate escalation absent OR `log-only` returns `{status:'halt', ...}`
      (defaults broken).
      (c) JSONL row missing any of the required fields (ts, phase, plan, from_step, to_step, gate,
      expected_emits, actual_emits, missing_emits, context, resolution).
      (d) Module writes to a path OUTSIDE `.planning/metrics/` (e.g. absolute path fallback) —
      violates projectDir scoping.
      (e) `--self-test` exits 0 without having written AND read back AND cleaned up the sample rows.
      (f) Introduces any git mutation (`git reset`, `git checkout`) — D-11b violation.
    stop_rule: |
      File exists; `node super-gsd/scripts/lib/edge-guard.cjs --self-test` exits 0 with a clear
      PASS line; the JSONL file either doesn't exist OR contains no self-test leftover rows after
      the self-test run (cleanup contract satisfied).
    verification_cmd: |
      test -f super-gsd/scripts/lib/edge-guard.cjs && node super-gsd/scripts/lib/edge-guard.cjs --self-test
    verification_gates:
      - "test -f super-gsd/scripts/lib/edge-guard.cjs → exit 0"
      - "node super-gsd/scripts/lib/edge-guard.cjs --self-test → exit 0"

  - id: 10-02-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: |
      10-RESEARCH.md §Q4 (architecture narrative — BEFORE/runs/AFTER pseudo-code) and §Q5 (halt
      integration with existing checkpoint routine, re-entry protection, no rollback).
      10-CONTEXT.md D-11, D-11a, D-11b, D-11c.
      Existing SKILL.md structure (9 loop steps; Step 11 token-log per D-11c is exempt).
      IMPORTANT: This task adds a NEW `<edge_guard>` SECTION (pseudo-code documentation), NOT the
      live per-step replacement (that's 10-03-02's job: replacing hard-coded thresholds at 9 sites
      with `gates.shouldFire(...)` calls). Plan boundary is explicit in 10-RESEARCH.md
      §Recommended Plan Decomposition.
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` has a new top-level section (approx H2 heading)
      titled `## Edge-Guard Layer` — content is pseudo-code + narrative describing:
        - The BEFORE / step-runs / AFTER mtime-snapshot pattern from §Q4.
        - The row schema (11 fields) and JSONL append path `.planning/metrics/edge-guard-log.jsonl`.
        - Resolution vocabulary: `pass` | `log-only` | `halt` | `gate_eval_error`.
        - D-11c token-log exemption (Step 11 wrapper is a no-op).
        - D-11b no-rollback guarantee (edge-guard NEVER issues git mutations).
        - Halt-escalation flow per §Q5: write JSONL row → call existing checkpoint routine →
          set `operator_action` field → exit. Re-entry guard via `resolved_by:` ack.
      Section MUST include a fenced code-block containing the exact `recordTransition(...)` call
      signature and a sample JSONL row (copy §Q4 "row format" verbatim as the canonical example).
      Section positioning: AFTER the existing loop-pseudocode block, BEFORE any "Checkpoint Protocol"
      section (logical order — edge-guard reads BEFORE/writes AFTER loop steps).
      No existing step narratives are modified by this task. (Plan 10-03-02 does the per-step
      `gates.shouldFire(...)` rewrites.)
    hypothesis: |
      Documenting edge-guard as a dedicated SKILL.md section (pseudo-code, not wiring) lets Plan
      10-03-02 reference it from each of the 9 per-step replacements without re-describing the
      mechanic each time. Matches the existing hybrid pattern (SKILL.md Steps 6.2 / 6.6 mix
      narrative + code-fences). Zero runtime-semantics change from this task alone — the section
      is documentation; live invocation lands in 10-03.
    falsifier: |
      (a) `grep -c '^## Edge-Guard Layer' super-gsd/skills/sgsd-orchestrate/SKILL.md` ≠ 1
      (section missing or duplicated).
      (b) Section does not mention `.planning/metrics/edge-guard-log.jsonl` (missing log path).
      (c) Section does not mention D-11c token-log exemption (readers must know Step 11 is exempt).
      (d) Task accidentally edits an existing step's gating logic (out of scope — that's 10-03-02).
      Detectable via diff: this task's commit should touch only the new `## Edge-Guard Layer`
      region, not step bodies.
      (e) Section mentions git reset / rollback / revert as an escalation (D-11b violation).
    stop_rule: |
      `grep -q '^## Edge-Guard Layer' super-gsd/skills/sgsd-orchestrate/SKILL.md` is exit 0,
      AND the section contains the literal strings `edge-guard-log.jsonl`, `recordTransition`,
      and `D-11c` (or `token-log` + `exempt`), AND `grep -q 'git reset' "<new section>"` is exit non-zero
      (no rollback references). Diff scope: no lines outside the new section are modified.
    verification_cmd: |
      grep -q '^## Edge-Guard Layer' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'edge-guard-log.jsonl' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'recordTransition' super-gsd/skills/sgsd-orchestrate/SKILL.md && ! awk '/^## Edge-Guard Layer/{flag=1;next} /^## /{flag=0} flag' super-gsd/skills/sgsd-orchestrate/SKILL.md | grep -q 'git reset'
    verification_gates:
      - "grep ^## Edge-Guard Layer SKILL.md → exit 0"
      - "grep edge-guard-log.jsonl + recordTransition in SKILL.md → exit 0"
      - "no 'git reset' inside Edge-Guard Layer section (awk-scoped grep) → exit 0 (negated)"
    depends_on: [10-02-01]

  - id: 10-02-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/edge-guard.cjs
    input_contract: |
      The edge-guard.cjs module authored in 10-02-01 (this task extends / hardens the CLI branch).
      10-VALIDATION.md row for 10-02-03: "node super-gsd/scripts/lib/edge-guard.cjs --self-test"
      + JSONL schema assertion.
      Sample row schema from 10-RESEARCH.md §Q4 (11 required keys).
    output_contract: |
      `super-gsd/scripts/lib/edge-guard.cjs` CLI `--self-test` flag is hardened to also assert
      EVERY JSONL field it writes back, covering both success and missing-emit paths:
        - After writing a `pass` row: parse the row; assert keys
          `ts, phase, plan, from_step, to_step, gate, expected_emits, actual_emits, missing_emits,
           context, resolution` ALL present and `resolution === 'pass'`.
        - After writing a missing-emit row with gate escalation `log-only`: assert
          `resolution === 'log-only'`, `missing_emits` is a non-empty array.
        - Clean up (delete file OR truncate the self-test rows) before exit.
        - Exit 0 on full PASS; exit non-zero with a message naming the first failing key.
      The schema assertions ARE the GATE-04 evidence (no separate verifier needed) — the CLI
      is self-verifying per 10-VALIDATION.md.
      This task MAY also update the narrative in 10-02-02's SKILL.md section to reference the
      `--self-test` CLI as the standalone GATE-04 verification surface (link added, not rewritten).
    hypothesis: |
      Folding the schema-assertion logic directly into `--self-test` means GATE-04 is verifiable
      by running ONE command (`node edge-guard.cjs --self-test`). No additional test harness file.
      Keeps verification surface small and close to the module under test — same philosophy as
      the Phase 9 verify.mjs pattern.
    falsifier: |
      (a) `--self-test` writes a row missing any of the 11 required keys and still exits 0.
      (b) `--self-test` leaves leftover JSONL rows in `.planning/metrics/edge-guard-log.jsonl`
      after exit (cleanup contract violation).
      (c) `--self-test` exits 0 when the `missing_emits` path row has `resolution: 'pass'`
      (semantically wrong — missing emits should be `log-only` or `halt`, never `pass`).
      (d) `--self-test` actually writes to `.planning/metrics/` at real project root and
      doesn't clean up — would pollute the production log. Solution: use `--self-test` with a
      temp projectDir (e.g. `/tmp/sgsd-edge-guard-selftest/`) and delete it on exit.
    stop_rule: |
      `node super-gsd/scripts/lib/edge-guard.cjs --self-test` exits 0 with PASS line;
      after the run, `cat .planning/metrics/edge-guard-log.jsonl 2>/dev/null | grep -c self-test`
      returns 0 (no leftover self-test rows in the production log).
    verification_cmd: |
      node super-gsd/scripts/lib/edge-guard.cjs --self-test && ( [ ! -f .planning/metrics/edge-guard-log.jsonl ] || ! grep -q self-test .planning/metrics/edge-guard-log.jsonl )
    verification_gates:
      - "edge-guard.cjs --self-test → exit 0 + PASS output"
      - "no self-test leftover rows in .planning/metrics/edge-guard-log.jsonl → cleanup contract honoured"
    depends_on: [10-02-01]

must_haves:
  truths:
    - "`edge-guard.cjs` exports `recordTransition(...)` that writes `.planning/metrics/edge-guard-log.jsonl` with the 11-field row schema (D-11)"
    - "`recordTransition` early-returns `{status:'ok'}` when `fromStep === 11` (D-11c token-log exemption)"
    - "Default resolution when missing_emits + no halt-escalation = `log-only`; per-gate `escalation: halt` opt-in triggers `halt` status (D-11a)"
    - "Module NEVER issues git mutations — no rollback path (D-11b)"
    - "SKILL.md has a new `## Edge-Guard Layer` section documenting the BEFORE/runs/AFTER pattern, the row schema, D-11c exemption, and the `--self-test` CLI"
    - "No existing SKILL.md step narratives are rewritten in this plan (per-step replacements land in Plan 10-03)"
    - "`node super-gsd/scripts/lib/edge-guard.cjs --self-test` writes two rows (pass + log-only), asserts all 11 keys on each, cleans up, exits 0"
    - "No self-test leftover rows in `.planning/metrics/edge-guard-log.jsonl` after `--self-test` run (uses tmp projectDir)"
  artifacts:
    - path: "super-gsd/scripts/lib/edge-guard.cjs"
      provides: "Step-transition audit wrapper + self-test CLI (GATE-04)"
      contains: "recordTransition({fromStep,toStep,phase,plan,gateName,expectedEmits,actualEmits,ctx,gatesYamlPath,projectDir}); --self-test CLI branch; import `./gates-registry.cjs` for gate.escalation lookup"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "## Edge-Guard Layer section — pseudo-code + JSONL schema + halt-escalation narrative"
      contains: "## Edge-Guard Layer heading, recordTransition call signature, sample row JSON, D-11c exemption note, --self-test CLI reference"
  key_links:
    - from: "super-gsd/scripts/lib/edge-guard.cjs"
      to: "super-gsd/scripts/lib/gates-registry.cjs"
      via: "require('./gates-registry.cjs').getGate for escalation lookup"
      pattern: "require\\(['\"]\\./gates-registry\\.cjs['\"]\\)"
    - from: "super-gsd/scripts/lib/edge-guard.cjs"
      to: ".planning/metrics/edge-guard-log.jsonl"
      via: "fs.appendFileSync after fs.mkdirSync parent dir recursive"
      pattern: "edge-guard-log\\.jsonl"
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/scripts/lib/edge-guard.cjs"
      via: "pseudo-code reference in ## Edge-Guard Layer section to recordTransition + --self-test"
      pattern: "recordTransition"
---

# Plan 10-02: Edge-Guard Layer

## Objective

Ship the `edge-guard.cjs` step-transition audit module and add a SKILL.md `## Edge-Guard Layer` documentation section. Module is self-verifying via `--self-test` CLI that asserts the full 11-field JSONL row schema on both pass and missing-emit paths.

Purpose: Satisfies **GATE-04** (edge-guard writes `.planning/metrics/edge-guard-log.jsonl` with the declared row shape; per-gate `escalation: halt` opt-in halts the orchestrator; NO rollback per D-11b).

Output: 2 files (`edge-guard.cjs` new, `SKILL.md` augmented with a new section). Wave 1 — parallel with Plan 10-01 (zero file overlap; Plan 10-01 touches `scripts/lib/predicate-eval.cjs`, `scripts/lib/gates-registry.cjs`, `registry/gates.yaml`, `.planning/phases/10-gate-policy/verify.mjs` — all disjoint from this plan's `files_modified`).

## Tasks

Breakdown per 10-VALIDATION.md (3 tasks: 10-02-01 through 10-02-03). Frontmatter holds the canonical contract.

### 10-02-01 — `edge-guard.cjs` module (new ~80 LOC)

Build per 10-RESEARCH.md §Pattern 4. Export `{ recordTransition }`. Depends on `./gates-registry.cjs` for `getGate(name, path)` to read the `escalation` field. Writes JSONL via `fs.appendFileSync` after `fs.mkdirSync({recursive:true})`. Early-returns `{status:'ok'}` on `fromStep === 11` per D-11c.

**CLI:** Detect `--self-test` arg via `process.argv`. In self-test mode, use a temp projectDir (e.g. `fs.mkdtempSync(os.tmpdir() + '/sgsd-edge-guard-')`) so the real `.planning/metrics/` is untouched. Run two recordTransition calls: one pass, one missing-emit with escalation `log-only`. Read back the JSONL, assert 11 keys present on each row, assert resolution values match expectation. Delete temp dir. Exit 0 on PASS.

### 10-02-02 — SKILL.md `## Edge-Guard Layer` section

Add a NEW section only — do NOT modify existing step bodies. Content: Q4 narrative (BEFORE mtime snapshot → step runs → AFTER snapshot diff) + Q5 halt-escalation flow + row schema + D-11c exemption callout + D-11b no-rollback guarantee. Code-fence the `recordTransition(...)` call signature and paste the sample JSON row from §Q4 verbatim. Reference the `--self-test` CLI from 10-02-03 as the standalone verification surface.

**Scope guard:** The diff must touch only this new section. Per-step integration (replacing hard-coded thresholds with `gates.shouldFire(...)` calls at 9 sites) belongs to Plan 10-03-02 — explicitly NOT this task.

### 10-02-03 — Harden `--self-test` CLI schema assertions

Extend the `--self-test` branch added in 10-02-01 to explicitly assert every one of the 11 JSONL row keys (`ts, phase, plan, from_step, to_step, gate, expected_emits, actual_emits, missing_emits, context, resolution`) on both the pass row and the missing-emit row, and that `resolution` values match (`pass` for no-missing, `log-only` for missing+no-halt-escalation). Uses a temp projectDir and cleans up so no rows leak into the real `.planning/metrics/edge-guard-log.jsonl`.

## Verification Gates (Wave close)

1. `test -f super-gsd/scripts/lib/edge-guard.cjs` → exit 0
2. `node super-gsd/scripts/lib/edge-guard.cjs --self-test` → exit 0 with PASS output
3. `grep -q '^## Edge-Guard Layer' super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
4. `grep -q 'edge-guard-log.jsonl' SKILL.md` AND `grep -q 'recordTransition' SKILL.md` → both exit 0
5. Negation: no `git reset` / `git checkout` appears inside the `## Edge-Guard Layer` section (awk-scoped grep) — D-11b guard.
6. No self-test leftover rows in real `.planning/metrics/edge-guard-log.jsonl` after the self-test run.

## Success Criteria

- `edge-guard.cjs` ships, exports `recordTransition`, has a working `--self-test` CLI.
- SKILL.md has exactly one new `## Edge-Guard Layer` section; existing step bodies untouched.
- All three task `verification_cmd`s exit 0.
- GATE-04 evidence is self-contained: one command (`node edge-guard.cjs --self-test`) verifies the full row schema + JSONL round-trip.

## Output

After completion, create `.planning/phases/10-gate-policy/plans/10-02-SUMMARY.md` summarising:
- 2 files touched (edge-guard.cjs ~80 LOC new; SKILL.md +~one section).
- The exact byte range of the new SKILL.md section (start/end line numbers) for Plan 10-03's cross-reference.
- Confirmation that `--self-test` exits 0 and no rows leak.
- The 3 commit SHAs.
