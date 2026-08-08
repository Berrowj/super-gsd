# P149-T2 — Loader + schema self-test + compiled fallback

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose.</intent>

You are a fresh SDD implementer (Codex gpt-5.5/xhigh). ONE task: create super-gsd/scripts/lib/skill-routing-registry.cjs + malformed fixture. The registry table (T1) already exists at super-gsd/registry/skill-routing.yaml with a top-level routes array.

SURGICAL CONSTRAINT — every changed line traces to this task; no orphan edits; deviations reported, never silent.

## Task contract (from locked plan)
  - id: "P149-T2"
    type: "loader-schema-fallback"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/skill-routing-registry.cjs"
      - "super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
    input_contract: >
      Implement only the js-yaml loader/helper module and malformed fixture. Reuse `js-yaml`; do not wire classifier or orchestrator callers in this task.
    output_contract: >
      The helper exports normalized loading, prompt adapter, scheduled-route query, compiled fallback, and CLI probes; malformed self-test fails while runtime probe falls back and logs degradation.
    hypothesis: "A js-yaml loader can validate the runtime table in self-test, adapt it for callers, and fall back loudly at runtime when malformed."
    falsifier: >
      Malformed registry self-test exits zero, runtime probe throws upward, fallback routes are unavailable, or registry degradation is not written to gate evidence.
    stop_rule: >
      Stop after the loader self-test, malformed self-test, and malformed runtime probe commands demonstrate the expected self-test failure and runtime fallback behavior.
    verification:
      commands:
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test"
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test --registry super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --runtime-probe --registry super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml --moment prompt-time --mode manual"

## Architecture + Adapter Decision (plan body)
## Architecture

Use `skill-routing.yaml` for human-maintained routing metadata. Add `super-gsd/scripts/lib/skill-routing-registry.cjs` as the only parser/validator/adapter: it loads YAML with `js-yaml`, schema-validates for self-test, adapts prompt-time rows into P146’s existing route shape, and exposes scheduled rows for orchestrator phase-close hooks.

Runtime behavior differs from self-test behavior deliberately: self-test fails malformed tables; runtime falls back to a compiled embedded lexicon and logs degradation through the existing gate-evidence command-envelope writer. This preserves sessions while making the failure loud.

## Adapter Decision

Choose adapter-in-loader, not a classifier parser extension. P149’s desired table is per-skill routing metadata, while P146 currently expects `routes[].trigger/predicate/enforcement`; changing every classifier call site to understand two registry shapes would create dual semantics. The loader should own the adaptation: `loadSkillRoutingRegistry()` returns normalized route rows, `toPromptGovernanceRoutes()` emits P146-compatible prompt-time routes, and `getScheduledRoutes(moment, mode)` serves the orchestrator. That keeps `skill-routing.yaml` as the one maintained source after P149 and confines fallback/degradation logic to one module.

## Registry Content Contract

## Task-specific prompt from plan
### P149-T2

Implement only `super-gsd/scripts/lib/skill-routing-registry.cjs` and the malformed fixture. Reuse `js-yaml`. Export normalized loading, prompt adapter, scheduled-route query, compiled fallback, and CLI probes. Self-test must fail malformed YAML; runtime probe must fall back and log degradation.

### P149-T3

## House precedents (read these two files)
- super-gsd/scripts/lib/gates-registry.cjs (js-yaml load + validate + cache pattern)
- super-gsd/tools/dispatch-router/route.cjs (compiled-fallback pattern for malformed/missing YAML)

## Verify before reporting (sandbox may block spawns — say so if it does)
Run the task verification commands from the plan, including --self-test.

## Report contract (exact sections, max 300 words)
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
