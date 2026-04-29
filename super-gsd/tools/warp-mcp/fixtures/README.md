# SGSD MCP Fixtures

Per-tool fixture files consumed by `super-gsd/tools/warp-mcp/run-self-test.cjs` (Phase 69) and the per-tool implementations (Phase 70/71). The fixture format is locked at Phase 68 close as part of the SGSD MCP Contract.

## Directory Shape

```
super-gsd/tools/warp-mcp/fixtures/
  README.md                                 (this file)
  sgsd_current_state/
    happy.input.json
    happy.expected.json
    state-md-missing.input.json
    state-md-missing.expected.json
  sgsd_current_phase/
    active.input.json
    active.expected.json
    roadmap-complete.input.json
    roadmap-complete.expected.json
    drift-phase-missing.input.json
    drift-phase-missing.expected.json
  ...one folder per tool name...
```

Per tool: at least one `happy` scenario (current real state of the repo) plus at least one `degraded` scenario (source file missing or unparseable). Phase 70/71 add scenarios as edge cases surface.

## Fixture Pair Shape

### `{scenario}.input.json`

```json
{
  "tool": "sgsd_current_state",
  "args": {},
  "fixture_planning_dir": ".planning",
  "scenario_description": "happy path — STATE.md present, current milestone v2.2"
}
```

- `tool`: name of the tool the fixture exercises.
- `args`: input args matching the tool's contract Inputs schema.
- `fixture_planning_dir`: optional — for degraded-path scenarios that need a synthesised `.planning/` tree (e.g., temp dir with corrupted STATE.md).
- `scenario_description`: human-readable why-this-fixture-exists.

### `{scenario}.expected.json`

```json
{
  "ok": true,
  "schema_version": 1,
  "tool": "sgsd_current_state",
  "data": {
    "milestone": "v2.2",
    "milestone_name": "<contains>SGSD Warp Integration</contains>"
  },
  "_truncated": false,
  "_degraded": false,
  "_redactions_applied": []
}
```

The expected envelope can use these matchers (Phase 69 implements):
- Literal value: exact match.
- `<contains>...substring...</contains>`: substring match (used for free-form text fields).
- `<regex>^pattern$</regex>`: regex match (used for ts fields, hashes).
- `<exists>true</exists>`: field presence check (used when value is non-deterministic).

Matchers are wrapped in XML-style brackets so they remain valid JSON strings that Phase 69's matcher engine can detect and dispatch on.

## Naming Conventions

- `happy.{input,expected}.json` — current real state passes
- `{source}-missing.{input,expected}.json` — source file absent
- `{source}-unparseable.{input,expected}.json` — source file present but corrupt
- `{source}-too-large.{input,expected}.json` — source exceeds max output size, expects `_truncated: true`
- `{source}-redaction-{category}.{input,expected}.json` — fixture triggers a specific redaction category

## How Phase 69 Consumes

```
1. for each tool folder under fixtures/:
2.   for each {scenario}.input.json:
3.     load matching .expected.json
4.     dispatch tool with input.args (mocking source files per fixture_planning_dir)
5.     compare actual envelope to expected envelope using the matcher engine
6.     PASS / FAIL per fixture
7. selfTest aggregate exit 0 only if all fixtures pass
```

## How Phase 70/71 Add Fixtures

Each implementation phase adds:
1. At least 1 `happy` fixture (real-state verification).
2. At least 1 `*-missing` fixture (source file absent).
3. At least 1 `*-unparseable` fixture (source file present but corrupt).
4. Edge-case fixtures discovered during implementation.

Fixtures are committed as part of each implementation phase's atomic commit.

## Redaction Fixtures (Phase 72)

Phase 72 adds fixtures under `super-gsd/tools/warp-mcp/fixtures/_redaction/`:
- `env-secrets.{input,expected}.json` — input contains AKIA / sk- / Bearer; expected has `<REDACTED:apikey>` / `<REDACTED:bearer>`.
- `redis-urls.{input,expected}.json` — input has `redis://user:pass@host`; expected stripped credentials.
- `private-kb-paths.{input,expected}.json` — input has `.brv/private/foo`; expected `<REDACTED:private_kb>`.
- `onedrive-paths.{input,expected}.json` — input has OneDrive org segment; expected `<REDACTED:onedrive_org>`.

## Updating This README

This file is part of the Phase 68 contract. Edits to add new naming conventions or matcher syntax require:
- A subsequent phase (>= 69) that ships the implementation matching the new convention, OR
- A v2.3.1+ patch phase explicitly authoring the change.

Do not introduce conventions in this README that aren't backed by implementation.
