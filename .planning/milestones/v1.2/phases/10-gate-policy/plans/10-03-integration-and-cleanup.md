---
phase: 10-gate-policy
plan: 03
type: execute
wave: 3
depends_on:
  - 10-01
  - 10-02
files_modified:
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/phases/09-atc-147-evidence/verify.mjs
  - .planning/config.json
autonomous: true
requirements:
  - GATE-01
  - GATE-02
  - GATE-03
  - GATE-04

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: 10-03-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml
    input_contract: |
      10-RESEARCH.md §R2 (cross-repo caveat): editing `KNOWN_TOP_LEVEL` in
      `~/.claude/get-shit-done/bin/lib/core.cjs:322-331` may be OUTSIDE the GSDedits git repo.
      Planner flag: this task runs a pre-flight probe BEFORE any other 10-03 tasks touch that file.
      Probe: `git -C "$(dirname "$(readlink -f ~/.claude/get-shit-done/bin/lib/core.cjs 2>/dev/null || echo ~/.claude/get-shit-done/bin/lib/core.cjs)")" rev-parse --show-toplevel`
      Compare to `git -C . rev-parse --show-toplevel` (current repo root).
      If different → gsd-tools is a separate repo; DO NOT commit from this executor. Emit a BLOCKER
      report and instruct the operator to patch globally. Task 10-03-04 will be SKIPPED in that
      case, but the verify.mjs invariant 8 (no byterover key) is still satisfiable via the
      config.json deletion alone.
      If same repo → the global gsd-tools install is sibling-vendored; 10-03-04 can patch as planned.
    output_contract: |
      Write .planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml with:
        repo_status: same | separate
        gsd_tools_root: <path from rev-parse>
        local_root: <path from rev-parse>
        action_for_10_03_04: patch-in-repo | skip-patch-external
        probed_at: <ISO timestamp>
      AND emit task ONE_LINER:
        - `CROSS_REPO: same — 10-03-04 patches core.cjs inside this repo`
        - `CROSS_REPO: separate (<gsd-tools-root>) — 10-03-04 SKIPS core.cjs patch; operator must patch externally`
      The YAML is authoritative for 10-03-04 (which reads it as input_contract).
    hypothesis: |
      Probing git-repo-root before any write prevents the executor from attempting a commit
      against a file that belongs to a different repo — which would fail silently (commit to wrong
      repo) or loudly (permission denied / path-not-in-repo). R2 in 10-RESEARCH.md explicitly
      flagged this. Matches standard cross-repo patch protocol.
    falsifier: |
      (a) Task attempts a write or `git add` on core.cjs BEFORE emitting the probe result (R2 violation).
      (b) Probe returns neither `same` nor `separate` (unexpected state — e.g., core.cjs not found) —
      must emit BLOCKER.
      (c) Task 10-03-04 proceeds to patch core.cjs when probe said `separate`.
    stop_rule: |
      Probe command runs; result classified into `same` / `separate` / `BLOCKER (core.cjs not found)`.
      Decision recorded for 10-03-04. No files modified.
    verification_cmd: |
      CORE=$(readlink -f ~/.claude/get-shit-done/bin/lib/core.cjs 2>/dev/null || echo ~/.claude/get-shit-done/bin/lib/core.cjs); test -f "$CORE" && ( CORE_ROOT=$(git -C "$(dirname "$CORE")" rev-parse --show-toplevel 2>/dev/null); LOCAL_ROOT=$(git -C . rev-parse --show-toplevel); if [ "$CORE_ROOT" = "$LOCAL_ROOT" ]; then echo "CROSS_REPO: same"; else echo "CROSS_REPO: separate ($CORE_ROOT)"; fi ) || ( echo "BLOCKER: core.cjs not found at expected path"; exit 1 )
    verification_gates:
      - "core.cjs locatable + git rev-parse succeeds → probe output classifies repo boundary"

  - id: 10-03-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: |
      10-RESEARCH.md §Q3 (integration table: 9 step call sites with line-number anchors in
      current SKILL.md — Step 2:148-185, Step 4:200-210, Step 5:212-216, Step 5.5:217-248,
      Step 6.5:361-426, Step 6.55:427-468, Step 9.5:686-733, Step 10:735-738, Step 11:740-743).
      §Q3 "hybrid" recipe: keep prose, add one-line `gates.shouldFire(name, ctx, GATES_YAML_PATH)`
      inside the existing code-fence, delete the redundant bullet list that duplicated gates.yaml
      policy. Keep `config.atc.enabled` kill-switches per R5 (compose: BOTH must agree).
      §Q3 "Registry load site": add a new cold-start step (suggested "3.6 LOAD GATES REGISTRY")
      that does `gates.loadGates(GATES_YAML_PATH)` ONCE at orchestrator boot.
      §Q2 injection point: add a "9.2 BUILD DISPATCH CONTEXT" sub-step between Steps 9 and 9.5.
      10-CONTEXT.md D-11c: Step 11 (token-log) is the one step where `gates.shouldFire` IS wired
      (controls whether the token-log ROW WRITE happens per `enforcement_mode: soft-warn`) — BUT
      the edge-guard transition wrapper around Step 11 is suppressed per D-11c.
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` contains:
      - A new cold-start "3.6 LOAD GATES REGISTRY" sub-step (or equivalent named anchor) that
        caches `loadGates(GATES_YAML_PATH)` ONCE.
      - A new "9.2 BUILD DISPATCH CONTEXT" sub-step that assembles the ctx object with all 11
        enumerated fields from §Q2 table (classifier.complexity/atc_tier/type,
        files_changed_count, code_files_changed_count, diff_lines, phase_type,
        new_pattern_detected, script_created, error_discovered, phase_has_verify_mjs).
      - At MINIMUM 9 call sites replacing the hard-coded gate checks with
        `gates.shouldFire('<gate-name>', ctx, GATES_YAML_PATH)`:
          classifier-haiku, context-selector-haiku, sgsd-recall-queries, intent-injection,
          phase-level-ATC, MUDA-waste-audit, per-dispatch-ATC, sgsd-curate-learnings, token-log.
      - Each of the 9 corresponding step bodies references edge-guard via the `## Edge-Guard Layer`
        section from Plan 10-02 (exception: Step 11 / token-log, which per D-11c is exempt from
        edge-guard but DOES use `shouldFire` for enforcement).
      - `config.atc.enabled` kill-switches at Step 6.5 and Step 9.5 are PRESERVED (R5: compose).
      Measurable invariant: `grep -c 'gates.shouldFire' super-gsd/skills/sgsd-orchestrate/SKILL.md`
      returns >= 9.
    hypothesis: |
      Replacing 9 hard-coded threshold checks with `gates.shouldFire(name, ctx, path)` calls at
      the sites enumerated in §Q3 keeps the SKILL.md narrative intact (hybrid pattern — matches
      existing Step 6.2 / 6.6 style) while making the gates.yaml registry the single source of
      policy truth. The greppable `gates.shouldFire` count becomes the R1 mitigation signal
      (missed site = count < 9).
    falsifier: |
      (a) `grep -c 'gates.shouldFire' super-gsd/skills/sgsd-orchestrate/SKILL.md` < 9 (missed site).
      (b) Any of the 9 step bodies still contains a hard-coded bullet duplicating a gates.yaml
      trigger clause (e.g., Step 9.5 still lists `classifier.atc_tier in {full,gate}` as a bullet).
      (c) `config.atc.enabled` checks deleted from Step 6.5 or Step 9.5 (R5 violation — kill-switch
      lost).
      (d) The "3.6 LOAD GATES REGISTRY" block is missing OR calls `loadGates` inside the per-step
      loop (cache bypassed — performance regression, not correctness, but still wrong).
      (e) The "9.2 BUILD DISPATCH CONTEXT" block omits any of the 11 dispatch-context fields
      from §Q2 (would cause runtime unknown-field throws at unrelated gates when those fields
      are referenced — R8 risk).
    stop_rule: |
      `grep -c 'gates.shouldFire' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns 9 or more;
      `grep -c '3\\.6 LOAD GATES REGISTRY' SKILL.md` returns 1; `grep -c '9\\.2 BUILD DISPATCH CONTEXT'`
      returns 1; `grep -q 'config.atc.enabled' SKILL.md` still returns exit 0 (kill-switches preserved).
    verification_cmd: |
      test $(grep -c 'gates.shouldFire' super-gsd/skills/sgsd-orchestrate/SKILL.md) -ge 9 && grep -q 'LOAD GATES REGISTRY' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'BUILD DISPATCH CONTEXT' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'config.atc.enabled' super-gsd/skills/sgsd-orchestrate/SKILL.md
    verification_gates:
      - "grep -c gates.shouldFire SKILL.md → >= 9 (R1 mitigation)"
      - "LOAD GATES REGISTRY cold-start section present → exit 0"
      - "BUILD DISPATCH CONTEXT sub-step present → exit 0"
      - "config.atc.enabled kill-switch preserved → exit 0 (R5 compose)"
    depends_on: [10-03-01]

  - id: 10-03-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/09-atc-147-evidence/verify.mjs
    input_contract: |
      10-CONTEXT.md D-12b (retro-fix 09-verify.mjs to add WR-01 and WR-02 invariants as
      numbered entries 8 and 9).
      10-RESEARCH.md §Q6 (exact patch text — copy verbatim). The patch adds two numbered blocks
      before the closing `console.log('PASS')` line.
      Invariant 8 (WR-01 row arithmetic): for every `per-dispatch` audit row,
      `total_bypass_cost === per_dispatch_tokens × dispatches_bypassed`.
      Invariant 9 (WR-02 detail-vs-summary): bucket strings in `findings_detail[].bucket`
      map-consistent to `findings_by_bucket` keys (via the provided bucketMap lookup).
      Existing verify.mjs uses `fail(N, msg)` helper + exit-code-matches-invariant-number convention —
      the two new invariants MUST follow the same convention (exit 8 for WR-01 fail; exit 9 for WR-02).
    output_contract: |
      `.planning/phases/09-atc-147-evidence/verify.mjs` contains TWO additional numbered invariant
      blocks (8 and 9) inserted before the final PASS print. Each uses the existing `fail(N, msg)`
      helper. No existing invariants 1-7 are modified.
      Running `node .planning/phases/09-atc-147-evidence/verify.mjs` on the existing Phase-9
      artefacts still exits 0 with the updated PASS message ("PASS: all 9 invariants hold"
      — OR the existing message plus a secondary line, executor choice but message must reflect
      9 not 7).
      File remains <= 120 LOC after the patch (research estimate was +30 LOC on top of original 63).
    hypothesis: |
      Pasting §Q6's patch text verbatim appends the two invariants without touching any existing
      logic, preserving the 1-7 exit-code mapping and adding 8/9. Because the Phase-9 artefacts
      were already authored with the bucket-map contract in mind (09-CONTEXT D-01b bucket taxonomy),
      both new invariants SHOULD pass on the committed `09-classification.yaml` and
      `09-gate-bypass.yaml`. If they fail, the artefact is the bug — not the verifier.
    falsifier: |
      (a) `grep -cE 'Invariant [89]\\b' .planning/phases/09-atc-147-evidence/verify.mjs` != 2.
      (b) `node .planning/phases/09-atc-147-evidence/verify.mjs` exits 0 but the PASS message
      still claims only 7 invariants (executor cosmetically broken).
      (c) `node .planning/phases/09-atc-147-evidence/verify.mjs` exits 8 or 9 against the
      committed Phase 9 artefacts — the artefact is inconsistent; flag as BLOCKER for a separate
      patch, do NOT quietly relax the invariant.
      (d) Any of invariants 1-7 regressed (bug in patch placement).
    stop_rule: |
      `grep -cE 'Invariant [89]\\b' .planning/phases/09-atc-147-evidence/verify.mjs` == 2,
      `node .planning/phases/09-atc-147-evidence/verify.mjs` exits 0, and the script's success
      message reflects 9 invariants.
    verification_cmd: |
      test $(grep -cE 'Invariant [89]\b' .planning/phases/09-atc-147-evidence/verify.mjs) -eq 2 && node .planning/phases/09-atc-147-evidence/verify.mjs
    verification_gates:
      - "09-verify.mjs has Invariant 8 and Invariant 9 blocks → count == 2"
      - "node 09-verify.mjs → exit 0 (all 9 invariants pass on committed Phase-9 artefacts — D-12b closed)"
    depends_on: [10-03-02]

  - id: 10-03-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/config.json
    input_contract: |
      10-CONTEXT.md D-13 (DELETE `config.byterover` block entirely from .planning/config.json),
      D-13a (keep safety, model_routing, token_efficiency, deliberation, atc, browser_verify,
      overwatcher blocks — they're runtime knobs), D-13b (ADD these 7 keys to the
      KNOWN_TOP_LEVEL Set in `~/.claude/get-shit-done/bin/lib/core.cjs:322-331`).
      10-RESEARCH.md §Q8 — the exact patch text for core.cjs (list of 7 strings appended to
      KNOWN_TOP_LEVEL Set).
      10-03-01 probe result: if `CROSS_REPO: separate`, this task SKIPS the core.cjs patch AND
      emits a user-action blocker ("Operator must edit `~/.claude/get-shit-done/bin/lib/core.cjs`
      at lines 322-331: append 'safety', 'model_routing', 'token_efficiency', 'deliberation',
      'atc', 'browser_verify', 'overwatcher' to the KNOWN_TOP_LEVEL Set"). The config.json
      deletion proceeds unconditionally either way.
    output_contract: |
      `.planning/config.json` no longer contains a top-level `byterover` key. Parses as valid JSON.
      All other top-level keys preserved (safety, model_routing, token_efficiency, deliberation,
      atc, browser_verify, overwatcher, workflow, git, hooks, features, model_profile,
      parallelization).
      IF 10-03-01 probe said `CROSS_REPO: same`: `~/.claude/get-shit-done/bin/lib/core.cjs`
      KNOWN_TOP_LEVEL Set gains 7 new strings (safety, model_routing, token_efficiency,
      deliberation, atc, browser_verify, overwatcher). Patch is a single-line insertion per §Q8
      recommended diff shape.
      IF 10-03-01 probe said `CROSS_REPO: separate`: this task SKIPS the core.cjs patch,
      reports operator-action blocker, and still succeeds at the config.json deletion. The
      Phase-10 verify.mjs invariant 8 (no byterover key) turns green regardless.
    hypothesis: |
      Deleting the config.byterover block unconditionally + conditionally patching core.cjs based
      on the 10-03-01 repo-boundary probe means invariant 8 of Phase-10 verify.mjs turns green
      in all cases (the invariant only checks config.json, not core.cjs). The core.cjs patch is
      a warning-suppression improvement — nice to have when possible, not a correctness gate.
    falsifier: |
      (a) `grep -q '"byterover"' .planning/config.json` returns exit 0 (key still present).
      (b) `node -e "JSON.parse(require('fs').readFileSync('.planning/config.json','utf8'))"`
      throws (invalid JSON after edit).
      (c) Any of the 7 keys D-13a says to preserve (safety, model_routing, ...) gets accidentally
      deleted alongside the byterover removal.
      (d) 10-03-01 probe said `separate` but this task still attempted a write to core.cjs
      (cross-repo violation).
      (e) 10-03-01 probe said `same` but this task did NOT patch core.cjs (missing D-13b work).
    stop_rule: |
      `! grep -q '"byterover"' .planning/config.json` exits 0; `node -e "JSON.parse(...)"` on
      config.json exits 0; the 7 preserved keys still present; AND core.cjs patch status matches
      10-03-01 probe decision (same → patched / separate → blocker emitted).
    verification_cmd: |
      ! grep -q '"byterover"' .planning/config.json && node -e "const c=JSON.parse(require('fs').readFileSync('.planning/config.json','utf8'));for(const k of ['safety','model_routing','token_efficiency','deliberation','atc','browser_verify','overwatcher']){if(!(k in c)){console.error('FAIL preserve',k);process.exit(1);}}console.log('PASS');"
    verification_gates:
      - "byterover key absent from .planning/config.json → exit 0"
      - "7 preserved keys (safety/model_routing/token_efficiency/deliberation/atc/browser_verify/overwatcher) all present → exit 0"
      - "config.json parses as valid JSON → exit 0"
      - "core.cjs patched iff 10-03-01 probe == same (conditional; verified by executor report)"
    depends_on: [10-03-01, 10-03-03]

  - id: 10-03-05
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/10-gate-policy/plans/10-03-SUMMARY.md
    input_contract: |
      10-VALIDATION.md "Full suite command": `node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs` — BOTH must exit 0 after all 10-03 tasks complete.
      10-CONTEXT.md D-16b: Wave 2 (this plan) is the integrator; phase-close signal is both
      verifiers green.
      10-RESEARCH.md §Q7 invariant 7: Phase-10 verify.mjs calls execSync on 09-verify.mjs —
      this cross-invariant chain means "Phase-10 verify.mjs exit 0" implies "09-verify.mjs exit 0"
      already. Full-suite double-run is defence-in-depth.
    output_contract: |
      Both verifiers run AND both exit 0. Write/append the final exit codes + PASS lines from each
      verifier into .planning/phases/10-gate-policy/plans/10-03-SUMMARY.md under a
      "## Full-Suite Verification (10-03-05)" section. Report records the same in the task summary.
      Optional curation: if new learnings emerged (e.g., edge-guard pattern novel vs prior art per
      10-RESEARCH §Q9), executor MAY curate via sgsd-curate per D-08, but that is not gated here.
    hypothesis: |
      Running both verifiers end-to-end is the single unambiguous signal that Phase 10 is closed:
      - Phase-10 verify.mjs exit 0 means all 8 Phase-10 invariants hold (gates.yaml well-formed,
        predicate evaluator parses every trigger, 09-verify.mjs child green, no byterover key).
      - 09-verify.mjs exit 0 independently confirms D-12b retrofit.
      Combined green is the operational gate before `/gsd-verify-work` (per 10-VALIDATION.md
      sampling rate).
    falsifier: |
      (a) `node .planning/phases/10-gate-policy/verify.mjs` exits non-zero — something upstream
      is incomplete. Do NOT retry; propagate as BLOCKER naming the invariant number.
      (b) `node .planning/phases/09-atc-147-evidence/verify.mjs` exits non-zero after D-12b work —
      retrofit didn't land correctly; flag 10-03-03 for rework.
      (c) This task attempts any file mutation (out of contract — it is pure validation).
    stop_rule: |
      Both verifiers exit 0 on the same run. Log the verdict for the Plan 10-03 SUMMARY.
    verification_cmd: |
      node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs
    verification_gates:
      - "Phase-10 verify.mjs → exit 0 (all 8 invariants pass)"
      - "Phase-9 verify.mjs → exit 0 (all 9 invariants pass including D-12b WR-01/02)"
    depends_on: [10-03-02, 10-03-03, 10-03-04]

must_haves:
  truths:
    - "10-03-01 probe classifies core.cjs repo boundary as `same` or `separate` BEFORE any 10-03 task touches core.cjs (R2 cross-repo guardrail)"
    - "SKILL.md has >= 9 occurrences of `gates.shouldFire(` — one per per-step call site (R1 mitigation)"
    - "SKILL.md has a new '3.6 LOAD GATES REGISTRY' cold-start block + '9.2 BUILD DISPATCH CONTEXT' ctx-assembly block"
    - "`config.atc.enabled` kill-switches at Steps 6.5 and 9.5 are PRESERVED (R5 compose — both kill-switches must agree)"
    - "`09-verify.mjs` gains invariants 8 (WR-01 row arithmetic) and 9 (WR-02 detail-vs-summary); running it exits 0 with a 9-invariant PASS message (D-12b closed)"
    - "`.planning/config.json` no longer has a `byterover` key; the 7 D-13a-preserved blocks remain; JSON parses cleanly"
    - "IFF 10-03-01 probe == `same`: `core.cjs` KNOWN_TOP_LEVEL Set gains 7 strings (safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher) per D-13b"
    - "IFF 10-03-01 probe == `separate`: 10-03-04 emits operator-action blocker for external core.cjs patch; config.json deletion proceeds regardless"
    - "Phase-close: `node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs` both exit 0"
  artifacts:
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "9-site integration: hard-coded gate thresholds replaced with gates.shouldFire(...) calls; cold-start registry load; dispatch-context builder"
      contains: ">= 9 gates.shouldFire references; LOAD GATES REGISTRY sub-step; BUILD DISPATCH CONTEXT sub-step; preserved config.atc.enabled kill-switches"
    - path: ".planning/phases/09-atc-147-evidence/verify.mjs"
      provides: "Retro-fitted Phase-9 verifier with WR-01 + WR-02 invariants (D-12b closed)"
      contains: "Invariant 8 (per-dispatch row arithmetic total_bypass_cost === per_dispatch_tokens × dispatches_bypassed), Invariant 9 (bucket map consistency); exit codes 8/9 reserved for these fails"
    - path: ".planning/config.json"
      provides: "Post-cleanup config — byterover block deleted, 7 runtime-knob blocks preserved (D-13)"
      contains: "workflow, safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher, hooks, features, git, parallelization, model_profile (NO byterover)"
  key_links:
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/scripts/lib/gates-registry.cjs"
      via: "require('super-gsd/scripts/lib/gates-registry.cjs') at cold-start + 9 gates.shouldFire call sites"
      pattern: "gates\\.shouldFire\\("
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/registry/gates.yaml"
      via: "GATES_YAML_PATH constant passed to gates.loadGates + gates.shouldFire"
      pattern: "registry/gates\\.yaml"
    - from: ".planning/phases/09-atc-147-evidence/verify.mjs"
      to: ".planning/phases/09-atc-147-evidence/09-classification.yaml"
      via: "Invariant 9 reads findings_detail + findings_by_bucket; consistency check"
      pattern: "findings_by_bucket"
    - from: ".planning/phases/09-atc-147-evidence/verify.mjs"
      to: ".planning/phases/09-atc-147-evidence/09-gate-bypass.yaml"
      via: "Invariant 8 reads audit rows + row arithmetic assertion"
      pattern: "per_dispatch_tokens"
    - from: ".planning/phases/10-gate-policy/verify.mjs"
      to: ".planning/phases/09-atc-147-evidence/verify.mjs"
      via: "Invariant 7 execSync call — Phase-10 green implies Phase-9 green"
      pattern: "execSync.*09-atc-147-evidence/verify\\.mjs"
---

# Plan 10-03: Integration & Cleanup

## Objective

Wire the Plan 10-01 (predicate evaluator + gates-registry + gates.yaml) and Plan 10-02 (edge-guard) artefacts into the live `sgsd-orchestrate` SKILL.md at all 9 step call sites; retro-fix `09-verify.mjs` with the WR-01 + WR-02 invariants (D-12b); delete the `byterover` block from `.planning/config.json` (D-13); and — conditionally, subject to a cross-repo probe (R2) — patch `KNOWN_TOP_LEVEL` in the global `gsd-tools` `core.cjs` (D-13b). Finally run both `verify.mjs`s green.

Purpose: Integrates all four GATE-XX requirements end-to-end. Turns the Phase-10 verifier's red invariants 7 (09-verify.mjs exit 0) and 8 (no byterover key) from red to green, closing the Phase-10 gate.

Output: 3 files modified (`SKILL.md`, `09-verify.mjs`, `.planning/config.json`). Wave 2 — depends on both 10-01 AND 10-02 (this plan imports from 10-01's registry module + references 10-02's `## Edge-Guard Layer` section).

## Tasks

Breakdown per 10-VALIDATION.md (5 tasks: 10-03-01 through 10-03-05). Task 10-03-01 is a pure discovery probe (no writes); 10-03-02/03/04 are the three mutations; 10-03-05 is the phase-close double-verifier run.

### 10-03-01 — Cross-repo probe for `core.cjs`

Per 10-RESEARCH.md §R2: before any write that touches `~/.claude/get-shit-done/bin/lib/core.cjs`, run `git rev-parse --show-toplevel` on its containing directory and compare to the current repo root. Report `CROSS_REPO: same` or `CROSS_REPO: separate (<path>)`. If separate, task 10-03-04 will skip the core.cjs patch and emit an operator-action blocker. This task does NO file mutations.

### 10-03-02 — Wire 9 SKILL.md call sites to `gates.shouldFire`

Per 10-RESEARCH.md §Q3. Add a cold-start `## 3.6 LOAD GATES REGISTRY` block and a `## 9.2 BUILD DISPATCH CONTEXT` block assembling the 11-field ctx object. Replace the hard-coded threshold bullets inside each of the 9 step code-fences with a one-line `if (gates.shouldFire('<name>', ctx, GATES_YAML_PATH)) { ... }` pattern, keeping surrounding prose intact. **R5 compose rule:** `config.atc.enabled` kill-switches at Steps 6.5 and 9.5 MUST be preserved as an additional outer guard (both gates must agree for the step to run).

**R1 mitigation invariant** (post-commit grep): `grep -c 'gates.shouldFire' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns `>= 9`. Fewer than 9 means a site was missed.

### 10-03-03 — Retro-fix `09-verify.mjs` (D-12b)

Append invariants 8 and 9 per 10-RESEARCH.md §Q6 verbatim. Use the existing `fail(N, msg)` helper. Update the success print to reflect 9 invariants. Running `node .planning/phases/09-atc-147-evidence/verify.mjs` on the committed Phase-9 artefacts must exit 0 after the patch — if it fails with exit 8 or 9, the ARTEFACT is inconsistent (not the verifier); flag as a separate blocker.

### 10-03-04 — Delete `config.byterover` + conditionally patch `core.cjs`

`.planning/config.json`: remove the top-level `byterover` block (any nested keys under it). Preserve the 7 D-13a blocks (safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher). Re-parse JSON to confirm validity.

If 10-03-01 probe said `CROSS_REPO: same`: apply the §Q8 one-line patch to `~/.claude/get-shit-done/bin/lib/core.cjs` appending 7 strings to the `KNOWN_TOP_LEVEL` Set. Commit with message `fix(gsd-tools): add Phase 10 config blocks to known-keys (D-13b)`.

If 10-03-01 probe said `CROSS_REPO: separate`: SKIP the core.cjs patch; emit operator-action blocker in the executor report detailing the exact lines the operator must edit. The config.json deletion proceeds either way.

### 10-03-05 — Phase-close full-suite run

Run both verifiers consecutively: `node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs`. Both must exit 0. Non-zero from either = BLOCKER; identify which invariant failed by the exit code and route back to the responsible task (10-03-02 for SKILL.md issues / 10-03-03 for 09-verify / 10-03-04 for byterover). No file mutations.

## Verification Gates (Wave close)

1. 10-03-01 probe emits classified result (same | separate) → exit 0 or controlled BLOCKER.
2. `grep -c 'gates.shouldFire' SKILL.md` ≥ 9 (R1 mitigation signal).
3. `grep -q 'LOAD GATES REGISTRY' SKILL.md` AND `grep -q 'BUILD DISPATCH CONTEXT' SKILL.md` → both exit 0.
4. `grep -q 'config.atc.enabled' SKILL.md` → exit 0 (R5 kill-switches preserved).
5. `grep -cE 'Invariant [89]\b' .planning/phases/09-atc-147-evidence/verify.mjs` == 2.
6. `node .planning/phases/09-atc-147-evidence/verify.mjs` → exit 0 (9 invariants).
7. `! grep -q '"byterover"' .planning/config.json` → exit 0.
8. All 7 D-13a keys present in config.json → verified via `node -e` JSON parse + key loop.
9. `node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs` → both exit 0.

## Success Criteria

- All 5 tasks' `verification_cmd`s pass (10-03-01 emits a structured probe result; 10-03-04 handles both branches correctly).
- `gates.shouldFire` count in SKILL.md ≥ 9 (R1).
- Phase 10 verify.mjs invariant 7 (`09-verify.mjs` exits 0) turns green.
- Phase 10 verify.mjs invariant 8 (no byterover in config.json) turns green.
- Both verifiers green → Phase 10 closes.
- Cross-repo contract honoured: core.cjs is either patched (probe==same) OR NOT touched + operator-action blocker emitted (probe==separate).

## Output

After completion, create `.planning/phases/10-gate-policy/plans/10-03-SUMMARY.md` summarising:
- 10-03-01 probe result (same / separate / BLOCKER).
- SKILL.md `gates.shouldFire` call count post-integration.
- 09-verify.mjs status (7 → 9 invariants, all green).
- config.json final key list (confirm no byterover).
- Whether core.cjs was patched and on which repo; OR the operator-action blocker text emitted.
- Final double-verifier exit codes (both 0 expected).
- The 3-5 commit SHAs (one per mutation task — 10-03-01 and 10-03-05 are no-op on git).
