---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P136-01-design-tokens-ia-scaffold
phase_id: 136-cockpit-design-tokens-ia-scaffold
phase_number: 136
milestone: v3.4
workstream: core
title: Cockpit Design Tokens + IA Scaffold (Light Editorial Palette + IBM Plex + renderShell Refactor)
created_by: orchestrator (Claude Opus 4.7, 1M context)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on: []
known_deadends: []
verification_cmd: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
lessons_path: null
tasks:
  - id: P136-T1
    agent: sgsd-exec-ui
    model: codex
    files_touched:
      - super-gsd/tools/shared/sgsd-design-system.css
    input_contract: |-
      Reads .planning/milestones/v3.4/phases/136-cockpit-design-tokens-ia-scaffold/136-CONTEXT.md
      §"Binding invariants" and §"Implementation decisions" for the token table; reads
      .planning/milestones/v3.4/design-pack/Cockpit.html :root block for canonical values.
    output_contract: |-
      sgsd-design-system.css :root section declares the light-palette tokens verbatim:
      --page #F6F7F4, --surface #FFFFFF, --ink #151A1E, --line #D6DBD2,
      --live #006D77, --done #2F7D5C, --attn #B7791F, --severe #B42318,
      --crit #B42318, --indigo #515E9C.
      Old dark tokens removed. Rules-as-data structure (R01-R12 references) preserved.
      No selector renames. No import.
    hypothesis: |-
      The current dark-mode design tokens are an isolated :root block at the top of
      sgsd-design-system.css; swapping the eight color tokens and removing dark-only
      fallbacks does not touch downstream selectors. Existing R13-R18 conformance rules
      pass on token VALUES that are not dark-specific (they bind on class names + structure),
      so the swap is byte-stable for the conformance gate.
    falsifier: |-
      Running the full 57/57 self-test after the token swap shows ≥1 regression (any pre-
      existing SAC-P125..P134 turns red), OR --json output changes shape, OR any selector
      not in the :root block needs editing to compile.
    stop_rule: |-
      Self-test 57/57 still green after T1 lands. sgsd-design-system.css contains exactly
      the 9 light tokens above and no dark-only token names. git diff confined to
      super-gsd/tools/shared/sgsd-design-system.css.

  - id: P136-T2
    agent: sgsd-exec-ui
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/render-html.cjs
    input_contract: |-
      Reads 136-CONTEXT.md §"Scope" + §"Implementation decisions" + §"Open questions";
      reads .planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md §"INFORMATION
      ARCHITECTURE" table for the canonical section order + IDs; reads existing
      render-html.cjs::renderShell() for the bands skeleton it must preserve.
    output_contract: |-
      renderShell() (exported from render-html.cjs) emits:
        1. <!doctype html> + <html> + <head>
        2. <head> includes <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
           AND <link rel="stylesheet" ...fonts.googleapis...family=IBM+Plex+Sans...> +
           family=IBM+Plex+Mono...> + family=Big+Shoulders+Display...>
        3. <body> chrome line including <span data-conn="state"></span> placeholder
        4. Command strip placeholder
        5. ScanBar placeholder (6 cells, empty contents — populated by client.js)
        6. Section nav placeholder
        7. Seven section roots in order:
           <section id="sec-mission"   data-source="mission"      data-band="1"></section>
           <section id="sec-telemetry" data-source="telemetry"    data-band="2"></section>
           <section id="sec-architecture" data-source="architecture" data-band="3"></section>
           <section id="sec-milestone" data-source="milestone"></section>
           <section id="sec-memory"    data-source="memory"></section>
           <section id="sec-evidence"  data-source="evidence"></section>
           <section id="sec-events"    data-source="events"></section>
        8. Bottom drawer placeholder
      renderHtml(out) is UNCHANGED in P136 (preserves --json/--html output for SAC-P127-*).
    hypothesis: |-
      The IA scaffold is structural HTML only — no JavaScript wiring, no data injection.
      Empty <section> tags with the correct IDs and data-* attributes give P137+P138 the
      DOM hooks they need without breaking existing R13-R18 binding rules (which check
      class="northstar|recommended-action", class="stage", and data-band="1|2|3" — all
      preserved). The first three sections retain data-band markers; later sections do not
      need them (R18 only checks the three placeholders exist somewhere in the shell).
    falsifier: |-
      Running the full self-test after T2 lands shows any of: SAC-P132-06 fails (renderShell
      starts<!doctype html> + has all 3 data-band markers must remain), SAC-P127-01..05 fails
      (renderHtml conformance regression), OR R18 binding regression on cockpit-html surface
      via SAC-P134-03.
    stop_rule: |-
      Self-test still 57/57 green after T2 lands (before SAC-P136-* tests are appended).
      renderShell() output contains all 7 section IDs + data-conn="state" + 3 font links +
      3 data-band placeholders. git diff confined to render-html.cjs.

  - id: P136-T3
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads 136-CONTEXT.md §"Semantic Acceptance Criteria" — SAC-P136-01..06 verbatim.
      Reads existing run-self-test.cjs to locate the SAC-P134-04 block (last in the
      IIFE-pushed tests array) and append after it.
    output_contract: |-
      run-self-test.cjs has 6 new test entries (SAC-P136-01..06) appended after SAC-P134-04
      inside the IIFE block. Each assertion verbatim against 136-CONTEXT.md SAC outcomes.
      No imports added at top of file (CSS read via fs already in scope).
      Full self-test runs 63/63 PASS exit 0. Per-SAC --sac SAC-P136-NN exits 0 each.
    hypothesis: |-
      The SAC tests are simple grep/string-includes assertions on file contents or
      renderShell() output. All required dependencies (fs, assert, renderers via
      require('./render-html.cjs')) are already available in run-self-test.cjs scope.
    falsifier: |-
      Any of SAC-P136-01..06 fails after T1+T2 landed, indicating T1 or T2 missed a token
      or DOM hook. Diagnosis routes back to T1 or T2 — not to T3.
    stop_rule: |-
      63/63 PASS exit 0. Tests appended verbatim (no relaxations beyond what 136-CONTEXT.md
      specifies). git diff confined to run-self-test.cjs.

  - id: P136-T4
    agent: orchestrator
    model: opus
    files_touched:
      - .planning/milestones/v3.4/phases/136-cockpit-design-tokens-ia-scaffold/136-VERIFICATION.md
      - .planning/milestones/v3.4/phases/136-cockpit-design-tokens-ia-scaffold/PHASE-CAPSULE.json
    input_contract: |-
      Reads T1/T2/T3 git diffs + final self-test output. Reads 136-CONTEXT.md for SAC
      results table. No code changes — phase-close artefacts only.
    output_contract: |-
      136-VERIFICATION.md authored with frontmatter (status, verdict, completed_at, SAC
      results 6/6, files counts, deviations).
      PHASE-CAPSULE.json authored per v3.3 capsule shape (schema_version 1, milestone, phase,
      phase_name, status, goal, outputs, files, sac_ids, self_test_*, decisions, debt,
      downstream_contract, bypass_refs, source_commits, source_hashes, gates, created_*).
    hypothesis: |-
      Phase-close artefacts are deterministic given the T1/T2/T3 evidence. The capsule
      schema is stable across v3.3 (use any v3.3 capsule as the shape reference).
    falsifier: |-
      136-VERIFICATION.md frontmatter omits a required key (phase, milestone, status,
      verdict, sacs_total, sacs_passed, self_test_count) OR PHASE-CAPSULE.json fails to
      validate against the v3.3 capsule shape.
    stop_rule: |-
      Both files exist, written with complete frontmatter + body. Commit message follows
      "feat(P136): ..." convention. Self-test re-run still 63/63 green.

semantic_acceptance_criteria:
  - id: SAC-P136-01
    input: "read sgsd-design-system.css"
    expected_outcome: "css contains --page: #F6F7F4, --surface: #FFFFFF, --ink: #151A1E, --line: #D6DBD2, --live: #006D77, --done: #2F7D5C, --attn: #B7791F, --severe: #B42318, --indigo: #515E9C as :root tokens"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P136-01"

  - id: SAC-P136-02
    input: "renderShell() output"
    expected_outcome: "html string includes <link href* fonts.googleapis with IBM+Plex+Sans + IBM+Plex+Mono + Big+Shoulders+Display"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P136-02"

  - id: SAC-P136-03
    input: "renderShell() output"
    expected_outcome: "html string includes data-band=\"1\", data-band=\"2\", data-band=\"3\" (R18 binding preserved)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P136-03"

  - id: SAC-P136-04
    input: "renderShell() output"
    expected_outcome: "html string includes id=\"sec-mission\", id=\"sec-telemetry\", id=\"sec-architecture\", id=\"sec-milestone\", id=\"sec-memory\", id=\"sec-evidence\", id=\"sec-events\""
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P136-04"

  - id: SAC-P136-05
    input: "renderShell() output"
    expected_outcome: "html string includes <span data-conn=\"state\""
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P136-05"

  - id: SAC-P136-06
    input: "full self-test suite"
    expected_outcome: "57 prior + 6 new = 63/63 PASS; zero regression on P125-P134 SACs"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs"
---

# Phase 136 — Cockpit Design Tokens + IA Scaffold — PLAN-LOCKED

## Scope (one paragraph)

P136 lands the v3.4 light command-room visual foundation (palette + type stack in
`sgsd-design-system.css`) and refactors `renderShell()` in `render-html.cjs` to emit the
new IA skeleton (chrome → command → ScanBar → sec-nav → seven section roots → bottom
drawer) with reserved DOM hooks for the liveness contract (`<span data-conn="state">`
in chrome + `data-source` on every section). P136 is structural plumbing only — no live
data wiring (P137), no sticky chrome behavior (P138), no component implementation
(P139-P142). Existing 57/57 self-test stays green; six new SACs lock the new structure.

## Authoritative Inputs

- `.planning/milestones/v3.4/INTENT.md` — 10 binding invariants
- `.planning/milestones/v3.4/design-pack/Cockpit.html` — canonical light prototype (tokens
  in `:root`, IA section order in body)
- `.planning/milestones/v3.4/design-pack/DESIGN-THESIS.md` — design rationale + tokens table
- `.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md` — IA section table + priorities
- `.planning/milestones/v3.4/phases/136-cockpit-design-tokens-ia-scaffold/136-CONTEXT.md`
- `super-gsd/tools/cockpit-sidecar/render-html.cjs` (v3.3/P132 extract; renderShell baseline)
- `super-gsd/tools/shared/sgsd-design-system.css` (dark token baseline to be replaced)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (target for SAC-P136-* append)

## Binding Invariants (from 136-CONTEXT.md)

1. Light palette only — 9 tokens locked.
2. IBM Plex Sans/Mono + Big Shoulders Display 900; no other type families.
3. Lock-13: changes confined to `super-gsd/tools/cockpit-sidecar/` +
   `super-gsd/tools/shared/sgsd-design-system.css`.
4. `--json` contract unchanged in P136.
5. Zero regression on P125-P134 SACs.
6. Liveness DOM hooks reserved: `data-conn="state"` + per-section `data-source`.

## File Operations

| Op | Path | Purpose |
|---|---|---|
| MODIFY | `super-gsd/tools/shared/sgsd-design-system.css` | Replace dark tokens with 9 light tokens |
| MODIFY | `super-gsd/tools/cockpit-sidecar/render-html.cjs` | Rebuild `renderShell()` to new IA skeleton |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | Append SAC-P136-01..06 |
| CREATE | `.planning/milestones/v3.4/phases/136-.../136-VERIFICATION.md` | Phase close (T4) |
| CREATE | `.planning/milestones/v3.4/phases/136-.../PHASE-CAPSULE.json` | Phase capsule (T4) |

## Verification

```
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected: 63/63 PASS exit 0 (57 prior + 6 P136). Per-SAC `--sac SAC-P136-NN` exits 0 each.

## Success Criteria

- All 6 SACs PASS.
- 63/63 self-test green; zero pre-existing SAC regressed.
- `renderShell()` emits all 7 section IDs + 3 data-band placeholders + `data-conn="state"`
  + 3 font links.
- git diff confined to Lock-13 paths.
- Phase capsule + verification authored at close.
