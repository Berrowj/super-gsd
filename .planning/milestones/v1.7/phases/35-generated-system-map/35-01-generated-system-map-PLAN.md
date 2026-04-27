---
plan_id: 35-01
phase: 35
title: Generated System Map
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [MAP-01, MAP-02, MAP-03, MAP-04]
locked_decisions: [35=B]
depends_on: [31, 32, 33, 34]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/tools/system-map/generate.cjs
      - super-gsd/docs/ARCHITECTURE.md
      - .planning/SYSTEM-MAP.json
      - .planning/SYSTEM-MAP.md
    hypothesis: "A deterministic registries+frontmatter catalog generator turns hand-maintained ARCHITECTURE.md sections into stale-detectable artifacts (--check drift guard) without requiring a topology analyzer."
    falsifier: "If --generate twice produces non-identical output (modulo generated_at), determinism is broken and --check is useless."
    stop_rule: "self-test 12+ assertions PASS; --generate twice produces byte-identical output (modulo generated_at); SYSTEM-MAP.md renders human-readable; ARCHITECTURE.md sections 6/7/8 contain deprecation notes."
    minimal_test: "node super-gsd/tools/system-map/generate.cjs --self-test -> exit 0; node super-gsd/tools/system-map/generate.cjs --generate -> writes both .json+.md; node super-gsd/tools/system-map/generate.cjs --check -> exit 0 on freshly-generated."

must_haves:
  truths:
    - "Generator is deterministic: same input -> same output modulo generated_at field"
    - "All 5 contract levels enumerated (envelope-v1, code-reviewer-v1, review-providers-v1, handover-contract-v2, plan-schema-v2)"
    - "Sort all collections alphabetically with codepoint comparator; stable JSON serialization with sorted keys"
    - "Public APIs never throw upward (mirrors route-ledger.cjs locked design)"
    - "Anchored to __dirname for fingerprint guard (Phase 32 W3 lesson)"
    - "ARCHITECTURE.md sections 6, 7, 8 carry a single deprecation block pointing to .planning/SYSTEM-MAP.md (existing tables preserved per Q17 lock)"
  artifacts:
    - super-gsd/tools/system-map/generate.cjs (NEW ~650 LOC)
    - super-gsd/docs/ARCHITECTURE.md (modified, ~12 LOC deprecation block placed after the section-6/7/8 tables)
    - .planning/SYSTEM-MAP.json (NEW, generated)
    - .planning/SYSTEM-MAP.md (NEW, generated)
  key_links:
    - 35-CONTEXT.md
    - 35-RESEARCH.md (sections 2, 3, 5, 7, 8, 11 for output schema, determinism, CLI, generator, self-test, locks)
    - command-envelope-v1.yaml (Phase 31 5th contract anchor)
    - super-gsd/scripts/lib/route-ledger.cjs (Phase 32 architectural template)
    - super-gsd/scripts/lib/review-ledger.cjs (Phase 34 most recent precedent)
---

# Phase 35-01: Generated System Map

> Controlling principle: "Autonomy continues; evidence tells the truth."
>
> Phase 35 closes v1.7 by making the registries discoverable. Phases 31-34
> built the contracts; this phase generates the map. After this ships, an
> operator (or future tooling) reads ONE file (.planning/SYSTEM-MAP.md) for
> the canonical agent / gate / provider / skill / contract / script / lib
> catalog instead of grepping 5 yaml files + 21 SKILL.md frontmatters + 40
> script banners.

## Objective

Produce a single Node CLI generator at `super-gsd/tools/system-map/generate.cjs`
that walks the SGSD registries + skills frontmatter + scripts/libs banners and
emits TWO byte-stable outputs:

- `.planning/SYSTEM-MAP.json` (machine-readable, sorted-key JSON, 8 top-level
  data sections + schema_version + generated_at)
- `.planning/SYSTEM-MAP.md` (rendered ASCII Markdown, table-first)

Then add a deprecation block to `super-gsd/docs/ARCHITECTURE.md` after the
hand-maintained section-6 file-layout / section-7 model-routing / section-8
data-flow tables, citing `.planning/SYSTEM-MAP.md` as canonical going forward.

Locked decision 35=B: registries + frontmatter only. NO dependency graph.

## Why

v1.7 mission line (REQUIREMENTS.md): "Generate a deterministic system map from
registries + frontmatter that supersedes hand-maintained handbook tables."
This is the FINAL v1.7 phase. After it ships, every v1.7 contract (envelope-v1
from Phase 31, route-decisions ledger from Phase 32, repair fields from Phase
33, review-ledger from Phase 34) is auto-enumerated in one human + one machine
view. The map is the proof: if you can faithfully auto-generate a map from the
contracts, the contracts are well-shaped.

## Inputs the planner has read

- `.planning/milestones/v1.7/phases/35-generated-system-map/35-CONTEXT.md`
- `.planning/milestones/v1.7/phases/35-generated-system-map/35-RESEARCH.md`
  (HIGH confidence; 18 derivation calls all locked)
- `.planning/milestones/v1.7/REQUIREMENTS.md` (MAP-01..04)
- `super-gsd/registry/agents.yaml` (8 active agents under `agents:`)
- `super-gsd/registry/gates.yaml` (15 gates; Phase-33 repair_instruction +
  2 repair_command rows on `MUDA-waste-audit` + `sgsd-curate-learnings`)
- `super-gsd/registry/review-providers.yaml` (2 providers)
- `super-gsd/registry/board-members.yaml` (5 members + escalation_policy)
- `super-gsd/registry/command-envelope-v1.yaml` (5th contract; envelope_version
  1; schema_ref super-gsd/templates/command-envelope-v1.json; locked_decision
  31=A; reconciliation collides_with: [])
- `super-gsd/registry/handover-contract-v2.yaml` (path + contract_version 2;
  4th contract path)
- `super-gsd/templates/plan-schema-v2.json` (4th-of-5 schema path)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` head (frontmatter pattern:
  `---\n<yaml>\n---`)
- `super-gsd/skills/sgsd-deliberate/SKILL.md` head (second sample)
- `super-gsd/scripts/sgsd-muda-audit.sh` head (bash banner pattern)
- `super-gsd/scripts/lib/route-ledger.cjs` (Phase 32; 1:1 architectural mirror
  for self-test layout, never-throws-upward, __dirname fingerprint anchor)
- `super-gsd/scripts/lib/review-ledger.cjs` (Phase 34; most recent precedent)
- `super-gsd/scripts/lib/gates-registry.cjs:38-72` (vendored js-yaml resolution
  pattern via `super-gsd/tools/plan-schema/node_modules/js-yaml`)
- `super-gsd/docs/ARCHITECTURE.md:198-263` (sections 6, 7, 8 -- deprecation
  target)

Counts verified on disk this planning session:

- `super-gsd/skills/` -> 21 entries (one SKILL.md per skill folder)
- `super-gsd/scripts/` (excluding `lib/`) -> 40 script files (.sh / .ps1 /
  .cjs / .js)
- `super-gsd/scripts/lib/` -> 18 files total; 14 are .cjs, 4 are .ps1
- `super-gsd/registry/agents.yaml` active rows -> 8
- `super-gsd/registry/gates.yaml` active rows -> 15
- `super-gsd/registry/review-providers.yaml` -> 2
- `super-gsd/registry/board-members.yaml` -> 5

These are the values self-test assertion 2..7 will check at run-time (the
generator reads `agents.yaml` etc., so any future row addition extends the
map; the self-test asserts `>= today's count` rather than `==` to stay
robust to growth -- see Section "Self-test" below).

## Tasks

### T1 -- code (FULL ATC tier)

ONE plan, ONE task with three byte-exact sub-deliverables (A1, A2, A3).
Sequencing inside T1 follows RESEARCH section 12.4 waves W0..W6, which the
executor walks top-to-bottom.

#### A1 -- `super-gsd/tools/system-map/generate.cjs` (NEW, ~650 LOC)

Single-file Node CLI. Mirrors Phase 32 / Phase 33 / Phase 34 architecture:
vendored js-yaml only, public API never throws upward, ASCII-only outputs,
__dirname-anchored fingerprint guard, single-file (Phase 34 Q13 lock).

Header (verbatim, first 60 lines):

```javascript
'use strict';
// ============================================================================
// SGSD - SYSTEM-MAP generator (Phase 35, v1.7)
// ============================================================================
// Reads SGSD registries + super-gsd/skills/* SKILL.md frontmatter +
// super-gsd/scripts/* and super-gsd/scripts/lib/* banners. Emits a
// deterministic catalog at .planning/SYSTEM-MAP.{json,md}.
//
// Locked: 35=B (registries + frontmatter -- NO dependency graph).
// Cites: 35-RESEARCH.md sections 7 (impl outline) and 11 (locked Q1..Q18).
//
// Determinism contract:
//   - Same input -> byte-identical output, modulo single field generated_at.
//   - All collections sorted by stable key (name or path) using codepoint
//     comparator (locale-independent).
//   - All object keys sorted in JSON serialization.
//   - No git-rev / mtime / pid / cwd / env reads. Only ISO-now for the
//     generated_at field.
//
// Public API contract (mirrors route-ledger.cjs:198 LOCKED):
//   - compose(), renderJson(map), renderMd(map), stableStringify(value)
//     never throw upward at the operator boundary. Internal helpers may
//     throw on poisoned YAML; modeGenerate() wraps the whole pipeline.
//
// Fingerprint guard (Phase 32 W3 lesson):
//   - Self-test paths anchored to __dirname (not process.cwd()) so the
//     test is invokable from any directory and always identifies the SAME
//     canonical .planning/SYSTEM-MAP.{json,md}.
//
// CLI:
//   --generate    (default) write .planning/SYSTEM-MAP.{json,md}; exit 0
//   --check       regen in-memory; byte-compare modulo generated_at;
//                 exit 0 = clean, exit 1 = drift, exit 2 = missing artifact
//   --self-test   tmpdir fixtures + 12+ assertions; exit 0 = all pass
//   --help        usage banner; exit 0
//
// Schema-without-consumer rule satisfied with FOUR production callers:
//   1) Operator reads SYSTEM-MAP.md (the canonical catalog)
//   2) Future tooling reads SYSTEM-MAP.json (deterministic API surface)
//   3) --check is the structural caller (drift guard)
//   4) ARCHITECTURE.md deprecation block (docs reader follows the link)
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// Vendored js-yaml resolution -- mirrors gates-registry.cjs:41-44.
// From super-gsd/tools/system-map/, walk up to tools/ then into
// plan-schema/node_modules/js-yaml.
const yamlLibPath = path.resolve(
  __dirname, '..', 'plan-schema', 'node_modules', 'js-yaml'
);
const yaml = require(yamlLibPath);

const SCHEMA_VERSION = 1;
const OUT_JSON_NAME = 'SYSTEM-MAP.json';
const OUT_MD_NAME = 'SYSTEM-MAP.md';

// Repo root: from super-gsd/tools/system-map/, walk up 3 dirs.
//   __dirname  = <repo>/super-gsd/tools/system-map
//   .., ..     = <repo>/super-gsd/tools, <repo>/super-gsd
//   .., .., .. = <repo>
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
```

Source paths (frozen constants, all `__dirname`-anchored, never `cwd`):

```javascript
const REGISTRY_DIR = path.join(REPO_ROOT, 'super-gsd', 'registry');
const SKILLS_DIR   = path.join(REPO_ROOT, 'super-gsd', 'skills');
const SCRIPTS_DIR  = path.join(REPO_ROOT, 'super-gsd', 'scripts');
const SCRIPTS_LIB_DIR = path.join(SCRIPTS_DIR, 'lib');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'super-gsd', 'templates');

const REG_AGENTS    = path.join(REGISTRY_DIR, 'agents.yaml');
const REG_GATES     = path.join(REGISTRY_DIR, 'gates.yaml');
const REG_PROVIDERS = path.join(REGISTRY_DIR, 'review-providers.yaml');
const REG_BOARD     = path.join(REGISTRY_DIR, 'board-members.yaml');
const REG_ENVELOPE  = path.join(REGISTRY_DIR, 'command-envelope-v1.yaml');
const REG_HANDOVER  = path.join(REGISTRY_DIR, 'handover-contract-v2.yaml');
const TPL_PLAN_SCHEMA = path.join(TEMPLATES_DIR, 'plan-schema-v2.json');
const TPL_ENVELOPE_JSON = path.join(TEMPLATES_DIR, 'command-envelope-v1.json');

// Output destination (default; overridable via --out-dir for tests).
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, '.planning');
```

Public API surface:

```javascript
module.exports = {
  // High-level
  compose,           // (rootOverride?) => SystemMap (in-memory)
  renderJson,        // (SystemMap) => string  (with trailing newline)
  renderMd,          // (SystemMap) => string  (ASCII)
  // Determinism helpers
  stableStringify,   // (value, indent?=2) => string
  // Constants
  SCHEMA_VERSION,    // 1 (frozen)
  OUT_JSON_NAME,     // "SYSTEM-MAP.json"
  OUT_MD_NAME,       // "SYSTEM-MAP.md"
};
```

Internal readers (NOT exported -- internal seam, signatures may change):

| Reader | Signature | Source | Output shape |
|--------|-----------|--------|--------------|
| `_readAgents()` | () -> object[] | `agents.yaml` `agents:` array | row-shape Section 2.1 |
| `_readGates()` | () -> object[] | `gates.yaml` `gates:` array | row-shape Section 2.1 (trigger -> trigger_clause_count) |
| `_readProviders()` | () -> object[] | `review-providers.yaml` `providers:` array | verbatim |
| `_readBoard()` | () -> object | `board-members.yaml` whole file | `{members[], escalation_policy}` |
| `_readContracts()` | () -> object[] | 5 sources (Section 2.1) | 5-element array |
| `_readSkills()` | () -> object[] | walk `super-gsd/skills/*/SKILL.md` | row-shape Section 2.1 |
| `_readScripts()` | () -> object[] | walk `super-gsd/scripts/*.{sh,ps1,cjs,js}` (NOT lib/) | row-shape Section 2.1 |
| `_readLibs()` | () -> object[] | walk `super-gsd/scripts/lib/*.{cjs,ps1}` | row-shape Section 2.1 |

Composer:

```javascript
function compose() {
  const map = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    agents:    _sortByName(_readAgents()),
    gates:     _sortByName(_readGates()),
    providers: _sortByName(_readProviders()),
    board:     _readBoard(),
    contracts: _sortByName(_readContracts()),
    skills:    _sortByName(_readSkills()),
    scripts:   _sortByPath(_readScripts()),
    libs:      _sortByPath(_readLibs()),
  };
  return map;
}

// Codepoint comparator (locale-independent, matching RESEARCH 3.1).
const _byName = (a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
const _byPath = (a, b) => (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
function _sortByName(arr) { return arr.slice().sort(_byName); }
function _sortByPath(arr) { return arr.slice().sort(_byPath); }
```

Stable serializer (the determinism load-bearing primitive):

```javascript
function stableStringify(value, indent) {
  const ind = (indent === undefined) ? 2 : indent;
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object' && v.constructor === Object) {
      const sorted = {};
      for (const k of Object.keys(v).sort()) sorted[k] = sortKeys(v[k]);
      return sorted;
    }
    return v;
  }
  return JSON.stringify(sortKeys(value), null, ind);
}

function renderJson(map) {
  // Trailing newline -- assertion 13 checks exactly one.
  return stableStringify(map) + '\n';
}
```

Markdown renderer (ASCII-only; assertion 14 enforces). Sections in fixed
order matching JSON top-level keys (excluding `schema_version` /
`generated_at` which appear in the header block). Long fields truncated
at 80 chars with `...`. Tables use ASCII pipes.

```javascript
function renderMd(map) {
  const lines = [];
  lines.push('# SGSD System Map');
  lines.push('');
  lines.push('> AUTO-GENERATED -- do not hand-edit. Edit the underlying registries');
  lines.push('> in `super-gsd/registry/` then re-run:');
  lines.push('> `node super-gsd/tools/system-map/generate.cjs --generate`');
  lines.push('');
  lines.push('Schema version: ' + map.schema_version);
  lines.push('Generated at: ' + map.generated_at);
  lines.push('Generator: super-gsd/tools/system-map/generate.cjs');
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  lines.push('- [Agents](#agents) (' + map.agents.length + ')');
  lines.push('- [Gates](#gates) (' + map.gates.length + ')');
  lines.push('- [Review providers](#review-providers) (' + map.providers.length + ')');
  lines.push('- [Board](#board) (' + map.board.members.length + ' members)');
  lines.push('- [Contracts](#contracts) (' + map.contracts.length + ')');
  lines.push('- [Skills](#skills) (' + map.skills.length + ')');
  lines.push('- [Scripts](#scripts) (' + map.scripts.length + ')');
  lines.push('- [Libs](#libs) (' + map.libs.length + ')');
  lines.push('');
  lines.push(_renderAgents(map.agents));
  lines.push(_renderGates(map.gates));
  lines.push(_renderProviders(map.providers));
  lines.push(_renderBoard(map.board));
  lines.push(_renderContracts(map.contracts));
  lines.push(_renderSkills(map.skills));
  lines.push(_renderScripts(map.scripts));
  lines.push(_renderLibs(map.libs));
  return lines.join('\n') + '\n';
}
```

Each `_render*` helper produces a single ASCII pipe-table preceded by a
`## <Section>` heading; long fields go through `_trunc(s, 80)`. Helpers
follow the column shapes in RESEARCH section 2.3:

- Agents: `Name | Cat | Model | Expertise | Picks-when | State`
- Gates: `Name | Category | Step | Mode | Reviewer | Repair? | State`
- Providers: `Name | Invocation | Target | Auth | Fallback | State`
- Board: `Member | Role | Model | Perspective` then a paragraph rendering
  `escalation_policy` (default minimal board + escalate_add triggers +
  always_present)
- Contracts: `Name | Level | Path | Version`
- Skills: `Name | Description | Allowed tools`
- Scripts / Libs: `Path | Purpose | Lines`

Banner extraction (3 forms verified per RESEARCH 1):

```javascript
// Form A (bash): shebang line + contiguous '# ' lines, first non-banner becomes purpose.
//   Example: super-gsd/scripts/sgsd-muda-audit.sh:1-30
// Form B (cjs):  'use strict'; + contiguous '// ' lines.
//   Example: super-gsd/scripts/lib/route-ledger.cjs:1-49
// Form C (jsdoc): /** ... */ block.
//   Example: super-gsd/scripts/lib/gates-registry.cjs:1-17
//
// Anything else -> purpose: "(no banner)" (assertion 15 covers).
function _extractBanner(source) {
  // Try jsdoc first (form C): /**\n * <purpose>\n ... */
  const jsdoc = source.match(/^\s*\/\*\*[\r\n]+([\s\S]*?)\*\//);
  if (jsdoc) {
    const body = jsdoc[1].split(/\r?\n/)
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l.length > 0);
    if (body.length > 0) return _firstSentence(body[0]);
  }
  // Try bash (form A): shebang followed by '# ' lines (skip rule lines '#==')
  // Try cjs (form B): 'use strict'; followed by '// ' lines (skip rule lines '//==')
  const lineRe = /^(?:#!.*\r?\n)?(?:'use strict';\r?\n)?((?:\s*(?:#|\/\/)[^\r\n]*\r?\n)+)/;
  const m = source.match(lineRe);
  if (m) {
    const body = m[1].split(/\r?\n/)
      .map(l => l.replace(/^\s*(?:#|\/\/)\s?/, '').trim())
      .filter(l => l.length > 0 && !/^[=\-_]{3,}$/.test(l));
    for (const l of body) {
      // First non-rule, non-empty line that isn't the file's own name is the purpose.
      if (l.length > 0) return _firstSentence(l);
    }
  }
  return '(no banner)';
}
```

Frontmatter extraction (mirrors review-ledger.cjs:422 STATE.md pattern):

```javascript
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
function _extractFrontmatter(source) {
  const m = source.match(FRONTMATTER_RE);
  if (!m) return null;
  try { return yaml.load(m[1]); }
  catch { return null; }  // malformed -> null, no throw (RESEARCH 1)
}
```

Modes:

```javascript
function modeGenerate(outDir) {
  const dest = outDir || DEFAULT_OUT_DIR;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  let map;
  try { map = compose(); }
  catch (e) {
    console.error('[SGSD] system-map generate failed: ' + e.message);
    return 1;
  }
  fs.writeFileSync(path.join(dest, OUT_JSON_NAME), renderJson(map), 'utf8');
  fs.writeFileSync(path.join(dest, OUT_MD_NAME),   renderMd(map),   'utf8');
  console.log('system-map: wrote ' + path.join(dest, OUT_JSON_NAME));
  console.log('system-map: wrote ' + path.join(dest, OUT_MD_NAME));
  return 0;
}

function modeCheck(outDir) {
  const dest = outDir || DEFAULT_OUT_DIR;
  const jsonPath = path.join(dest, OUT_JSON_NAME);
  const mdPath = path.join(dest, OUT_MD_NAME);
  if (!fs.existsSync(jsonPath) || !fs.existsSync(mdPath)) {
    console.error('[SGSD] system-map --check: artifact missing under ' + dest);
    return 2;
  }
  let regenJson, regenMd;
  try {
    const map = compose();
    regenJson = renderJson(map);
    regenMd = renderMd(map);
  } catch (e) {
    console.error('[SGSD] system-map --check failed: ' + e.message);
    return 1;
  }
  const onDiskJson = fs.readFileSync(jsonPath, 'utf8');
  const onDiskMd = fs.readFileSync(mdPath, 'utf8');
  // Strip generated_at from JSON for compare.
  const stripped1 = onDiskJson.replace(/"generated_at"\s*:\s*"[^"]+"\s*,?\s*\n/, '');
  const stripped2 = regenJson.replace(/"generated_at"\s*:\s*"[^"]+"\s*,?\s*\n/, '');
  // Strip "Generated at: ..." line from MD.
  const stripMd = (s) => s.replace(/^Generated at: .*$/m, 'Generated at: <stripped>');
  if (stripped1 !== stripped2) {
    console.error('[SGSD] system-map drift: SYSTEM-MAP.json differs from regenerated');
    return 1;
  }
  if (stripMd(onDiskMd) !== stripMd(regenMd)) {
    console.error('[SGSD] system-map drift: SYSTEM-MAP.md differs from regenerated');
    return 1;
  }
  console.log('system-map --check: clean (json + md byte-identical mod generated_at)');
  return 0;
}
```

Self-test (12 baseline + 3 bonus = 15 assertions). Walks the same skeleton
as `route-ledger.cjs:286-420` and `review-ledger.cjs:451-651`. Fingerprint
guard at top-of-function captures canonical-output mtime+size+existence;
asserts unchanged at end. The self-test always writes to `os.tmpdir()`.

```javascript
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Fingerprint guard anchored to __dirname (Phase 32 W3 lesson).
  // Tool at <repo>/super-gsd/tools/system-map/generate.cjs;
  // canonical at <repo>/.planning/SYSTEM-MAP.{json,md} (3 dirs up + .planning).
  const realJson = path.resolve(__dirname, '..', '..', '..', '.planning', OUT_JSON_NAME);
  const realMd   = path.resolve(__dirname, '..', '..', '..', '.planning', OUT_MD_NAME);
  const snap = (p) => ({
    exists: fs.existsSync(p),
    mtime: fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0,
    size:  fs.existsSync(p) ? fs.statSync(p).size : 0,
  });
  const beforeJson = snap(realJson);
  const beforeMd   = snap(realMd);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smap-'));
  try {
    // 1. Top-level keys present (10 keys total: 2 metadata + 8 data).
    const m = compose();
    assert('1. compose() returns object with all 10 top-level keys',
      m && typeof m === 'object' &&
      'schema_version' in m && 'generated_at' in m &&
      'agents' in m && 'gates' in m && 'providers' in m &&
      'board' in m && 'contracts' in m && 'skills' in m &&
      'scripts' in m && 'libs' in m);

    // 2. Agents count >= 8 (today's active rows; tolerates future growth).
    assert('2. agents length >= 8',
      Array.isArray(m.agents) && m.agents.length >= 8);

    // 3. Gates count >= 15.
    assert('3. gates length >= 15',
      Array.isArray(m.gates) && m.gates.length >= 15);

    // 4. Providers length is exactly 2.
    assert('4. providers length == 2',
      Array.isArray(m.providers) && m.providers.length === 2);

    // 5. Board members length is 5 + escalation_policy is an object.
    assert('5. board members length 5 + escalation_policy object',
      Array.isArray(m.board.members) && m.board.members.length === 5 &&
      m.board.escalation_policy && typeof m.board.escalation_policy === 'object');

    // 6. Contracts length is exactly 5 (envelope-v1 + 4 pre-existing).
    assert('6. contracts length == 5',
      Array.isArray(m.contracts) && m.contracts.length === 5);

    // 7. Skills count >= 21 (today's count).
    assert('7. skills length >= 21',
      Array.isArray(m.skills) && m.skills.length >= 21);

    // 8. Determinism (JSON): two compose+renderJson; strip generated_at; equal.
    const jA = renderJson(compose());
    const jB = renderJson(compose());
    const stripJ = (s) => s.replace(/"generated_at"\s*:\s*"[^"]+"\s*,?\s*\n/, '');
    assert('8. JSON byte-identical modulo generated_at',
      stripJ(jA) === stripJ(jB));

    // 9. Determinism (MD): two compose+renderMd; strip Generated at line; equal.
    const mA = renderMd(compose());
    const mB = renderMd(compose());
    const stripM = (s) => s.replace(/^Generated at: .*$/m, 'Generated at: <s>');
    assert('9. MD byte-identical modulo Generated at line',
      stripM(mA) === stripM(mB));

    // 10. Sort stability: agents/gates/providers/skills sorted ASC by name.
    const isSorted = (arr, key) => arr.every((r, i) =>
      i === 0 || (arr[i - 1][key] <= r[key]));
    assert('10. collections sorted ASC by name (agents/gates/providers/skills/contracts)',
      isSorted(m.agents,'name') && isSorted(m.gates,'name') &&
      isSorted(m.providers,'name') && isSorted(m.skills,'name') &&
      isSorted(m.contracts,'name'));

    // 11. Fixture mode: synthesize a tmp registry with 2 fake agents +
    //     1 fake skill; assert generation against tmp dest is deterministic
    //     and produces the expected row counts.
    //     (Implementation note: simplest path is to copy real REGISTRY_DIR
    //     to tmp, mutate agents.yaml + skills/, then call modeGenerate(tmp).
    //     Self-test does NOT mutate live registries.)
    const fixtureRoot = path.join(tmp, 'fixture');
    fs.mkdirSync(path.join(fixtureRoot, '.planning'), { recursive: true });
    const rc = modeGenerate(path.join(fixtureRoot, '.planning'));
    assert('11. modeGenerate against tmp out-dir produces .json + .md',
      rc === 0 &&
      fs.existsSync(path.join(fixtureRoot, '.planning', OUT_JSON_NAME)) &&
      fs.existsSync(path.join(fixtureRoot, '.planning', OUT_MD_NAME)));

    // 12. Canonical .planning/SYSTEM-MAP.{json,md} untouched by self-test.
    const afterJson = snap(realJson);
    const afterMd   = snap(realMd);
    assert('12. canonical SYSTEM-MAP.json untouched',
      beforeJson.exists === afterJson.exists &&
      beforeJson.mtime === afterJson.mtime &&
      beforeJson.size  === afterJson.size);
    assert('12b. canonical SYSTEM-MAP.md untouched',
      beforeMd.exists === afterMd.exists &&
      beforeMd.mtime === afterMd.mtime &&
      beforeMd.size  === afterMd.size);

    // 13 (bonus). renderJson ends with exactly one trailing newline.
    const j = renderJson(compose());
    assert('13. renderJson ends with exactly one trailing newline',
      j.endsWith('\n') && !j.endsWith('\n\n'));

    // 14 (bonus). renderMd is ASCII-only (no codepoint > 0x7F).
    const md = renderMd(compose());
    let nonAscii = -1;
    for (let i = 0; i < md.length; i++) {
      if (md.charCodeAt(i) > 0x7F) { nonAscii = i; break; }
    }
    assert('14. renderMd is ASCII-only (no codepoint > 0x7F)',
      nonAscii === -1, nonAscii >= 0 ? ('non-ASCII at ' + nonAscii) : '');

    // 15 (bonus). Banner-regex tolerance: synthesize fake .cjs with no
    //   banner; _extractBanner returns "(no banner)".
    const fakePath = path.join(tmp, 'no-banner.cjs');
    fs.writeFileSync(fakePath, "function x() {}\n", 'utf8');
    // _extractBanner is internal; assertion uses the published behavior --
    //   walk scripts/* would produce purpose:'(no banner)' for this input.
    //   Cheap proxy: read the file ourselves and run the same matcher.
    //   (Self-test does NOT call walkers against the real tree for #15.)
    const fakeSrc = fs.readFileSync(fakePath, 'utf8');
    assert('15. banner extractor tolerates no-banner files',
      /\(no banner\)/.test(/* call the internal helper here -- exposed via __test__ ref */
        // For implementation: expose _extractBanner through a frozen __test__
        // helper namespace, or copy the regex inline in the test. Either is
        // fine; assertion outcome is identical.
        '(no banner)' /* placeholder; executor wires the real call */));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('system-map self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const f of failures)
      console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
    return 1;
  }
  return 0;
}
```

Implementation note on assertion 15: the executor MUST wire the real
`_extractBanner` call (not the placeholder shown above). Pattern: expose
an internal `__test__` namespace at the bottom of the file mirroring
review-ledger.cjs internal-helper exposure for test paths only. The
placeholder is a planning artifact, not an instruction to ship a stub.

Main dispatch:

```javascript
if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || '--generate';

  if (cmd === '--help' || cmd === '-h') {
    console.log('Usage:');
    console.log('  node super-gsd/tools/system-map/generate.cjs --generate [--out-dir <path>]');
    console.log('  node super-gsd/tools/system-map/generate.cjs --check    [--out-dir <path>]');
    console.log('  node super-gsd/tools/system-map/generate.cjs --self-test');
    console.log('  node super-gsd/tools/system-map/generate.cjs --help');
    process.exit(0);
  }

  let outDir = null;
  const oIdx = argv.indexOf('--out-dir');
  if (oIdx > 0 && argv[oIdx + 1]) outDir = path.resolve(argv[oIdx + 1]);

  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === '--check')     process.exit(modeCheck(outDir));
  if (cmd === '--generate')  process.exit(modeGenerate(outDir));
  console.error('Unknown command: ' + cmd);
  process.exit(3);
}
```

Contracts list (`_readContracts()` returns this 5-element array, sorted by
name post-composer):

```javascript
function _readContracts() {
  // 5 contract levels (RESEARCH 2.1 + Q6 lock).
  const handoverYaml = yaml.load(fs.readFileSync(REG_HANDOVER, 'utf8')) || {};
  const envelopeYaml = yaml.load(fs.readFileSync(REG_ENVELOPE, 'utf8')) || {};
  const planSchemaJson = JSON.parse(fs.readFileSync(TPL_PLAN_SCHEMA, 'utf8'));

  return [
    {
      name: 'code-reviewer-v1',
      level: 'reviewer-report',
      registry_path: 'super-gsd/registry/review-providers.yaml',
      schema_path: null,
      version: '1',
      envelope_or_schema_version: 1,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'review-providers-v1',
      level: 'provider-registry',
      registry_path: 'super-gsd/registry/review-providers.yaml',
      schema_path: null,
      version: '1.0.0',
      envelope_or_schema_version: 1,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'handover-contract-v2',
      level: 'agent-dispatch',
      registry_path: 'super-gsd/registry/handover-contract-v2.yaml',
      schema_path: null,
      version: String(handoverYaml.contract_version || '2'),
      envelope_or_schema_version: 2,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'plan-schema-v2',
      level: 'plan-frontmatter',
      registry_path: null,
      schema_path: 'super-gsd/templates/plan-schema-v2.json',
      version: String(planSchemaJson.$schema_version || planSchemaJson.schema_version || '2'),
      envelope_or_schema_version: 2,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'command-envelope-v1',
      level: 'command-output',
      registry_path: 'super-gsd/registry/command-envelope-v1.yaml',
      schema_path: 'super-gsd/templates/command-envelope-v1.json',
      version: String(envelopeYaml.registry_version || '1.0.0'),
      envelope_or_schema_version: envelopeYaml.envelope_version || 1,
      locked_decision: envelopeYaml.locked_decision || null,
      collides_with: (envelopeYaml.reconciliation && envelopeYaml.reconciliation.collides_with) || [],
    },
  ];
}
```

Gate row reduction (per RESEARCH 2.2: emit `trigger_clause_count`, NOT the
full predicate tree):

```javascript
function _readGates() {
  const raw = yaml.load(fs.readFileSync(REG_GATES, 'utf8'));
  const all = (raw && Array.isArray(raw.gates)) ? raw.gates : [];
  return all.map(g => ({
    name: g.name,
    category: g.category || null,
    step: g.step ?? null,
    enforcement_mode: g.enforcement_mode || null,
    trigger_clause_count: Array.isArray(g.trigger) ? g.trigger.length : 0,
    reviewer_agent: g.reviewer_agent || null,
    reviewer_provider: g.reviewer_provider || null,
    evidence_emitted: Array.isArray(g.evidence_emitted) ? g.evidence_emitted.slice() : [],
    escalation: g.escalation || null,
    repair_instruction: g.repair_instruction || null,
    repair_command: g.repair_command || null,
    state: g.state || null,
    version: g.version ?? null,
  }));
}
```

Skipped paths (intentional, per RESEARCH 1):

- `super-gsd/scripts/lib/route-ledger.test.cjs` (test file; excluded from libs[])
- `super-gsd/scripts/codex-exec.README.md` (doc, not script)
- `super-gsd/agents/*.md` (canonical agent surface IS agents.yaml; agent
  files referenced via agent_file: link)
- Anything under `super-gsd/tools/` (tools consume the map, not appear in it)

Walker for skills (mirrors the readdirSync + frontmatter pattern):

```javascript
function _readSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, e.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const src = fs.readFileSync(skillFile, 'utf8');
    const fm = _extractFrontmatter(src);
    out.push({
      name: e.name,
      skill_path: path.relative(REPO_ROOT, skillFile).replace(/\\/g, '/'),
      description: (fm && fm.description) || null,
      argument_hint: (fm && fm['argument-hint']) || null,
      allowed_tools: (fm && Array.isArray(fm['allowed-tools'])) ? fm['allowed-tools'].slice() : [],
    });
  }
  return out;
}
```

#### A2 -- ARCHITECTURE.md deprecation block

Edit `super-gsd/docs/ARCHITECTURE.md`. Per RESEARCH Q17 LOCKED ("LINK ONLY")
and CONTEXT kill-condition ("only the 3 stale catalog sections get replaced
[deprecation note added]; other sections preserved"), the existing tables in
sections 6, 7, 8 (lines 198-263) are PRESERVED. Insert a single deprecation
block immediately after the section-8 data-flow table (i.e. directly before
section 9 "Golden invariants" at the previous line 265).

Exact insertion (between current line 263 and current line 265, i.e. after
the closing row of the data-flow table and before `## 9. Golden invariants`):

```markdown

> **Catalog moved (Phase 35, v1.7) -- DEPRECATED.** The agent / gate /
> provider / skill / contract / script enumerations in sections 6, 7, and 8
> above are now auto-generated. The canonical living catalog is at
> `.planning/SYSTEM-MAP.md` (machine view at `.planning/SYSTEM-MAP.json`).
> Edit the underlying registries under `super-gsd/registry/` -- not this
> file. Regenerate via:
>
> ```bash
> node super-gsd/tools/system-map/generate.cjs --generate
> ```
>
> Drift detection: `node super-gsd/tools/system-map/generate.cjs --check`
> exits 1 if SYSTEM-MAP.* is older than the registries.

```

This is a 12-line block. The word `DEPRECATED` appears verbatim so that
MAP-04 grep `grep -q 'DEPRECATED' super-gsd/docs/ARCHITECTURE.md` returns
exit 0.

Constraints on the edit:

- DO NOT delete lines 198-263 (the section-6/7/8 tables remain as historical
  reference; the deprecation block flags them, mass-discuss line 77 forbids
  auto-deletion until v2.1).
- DO NOT modify any line outside the inserted 12 lines + adjacent blank
  separators. Other ARCHITECTURE.md content (sections 1-5, 9+) untouched.
- LF line endings (project constraint, all SGSD docs are LF).
- ASCII only (no smart quotes, no em dashes, no Unicode bullets -- use plain
  `>`, plain `-`, plain `--`).

#### A3 -- First `--generate` run produces committed artifacts

After A1 + A2 land and the self-test passes, run:

```bash
node super-gsd/tools/system-map/generate.cjs --generate
```

This writes:

- `.planning/SYSTEM-MAP.json` (sorted-key JSON; ~12-25 KB; ~600-1200
  pretty-printed lines, depending on registry size)
- `.planning/SYSTEM-MAP.md` (ASCII Markdown; ~250-400 lines)

Both files are committed to git (RESEARCH Q16 LOCKED YES; same logic as
Phase 34's review-ledger.jsonl commit).

Then run `--check` to prove the loop closes on freshly-generated artifacts:

```bash
node super-gsd/tools/system-map/generate.cjs --check
```

Expected output: `system-map --check: clean (json + md byte-identical mod
generated_at)` and exit code 0.

## Known dead-ends (DO NOT pursue)

These are explicit stop signs for the executor. Each is locked in CONTEXT or
RESEARCH; do NOT relitigate any of them.

1. **DO NOT modify `super-gsd/registry/command-envelope-v1.yaml`** or
   `super-gsd/templates/command-envelope-v1.json`. Phase 31 contract is
   locked. Generator READS only.
2. **DO NOT modify any of the other 4 contracts**: code-reviewer-v1,
   review-providers-v1, handover-contract-v2, plan-schema-v2. The map
   READS metadata about them; their files stay unchanged.
3. **DO NOT introduce any new npm dependency.** Use Node built-ins only
   (`fs`, `path`, `os`) plus the vendored js-yaml at
   `super-gsd/tools/plan-schema/node_modules/js-yaml` (resolved exactly
   like `gates-registry.cjs:41-44`).
4. **DO NOT add a dependency-graph analyzer.** 35=B is locked: registries
   + frontmatter ONLY. Cross-resource topology is gilding; explicitly
   deferred to v1.8+.
5. **DO NOT embed `git rev-parse HEAD`** or any other volatile field in the
   output. RESEARCH Q11 LOCKED OUT -- spawning git breaks pure-fs and
   introduces non-determinism on uncommitted changes.
6. **DO NOT delete or rewrite ARCHITECTURE.md content outside sections
   6/7/8 area.** Only the 12-line deprecation block is added (between
   current line 263 and current line 265). Sections 1-5 and 9+ are
   untouched. Even within 6/7/8, the existing tables are PRESERVED
   (mass-discuss line 77 forbids auto-deletion).
7. **DO NOT split the file into `tools/system-map/` + `scripts/lib/`.**
   Phase 34 Q13 lock: ONE file, ONE fingerprint guard, ONE self-test, ONE
   require path. The generator is a TOOL; it lives only at
   `super-gsd/tools/system-map/generate.cjs`.
8. **DO NOT wire `--check` into a git pre-commit hook or CI in this phase.**
   RESEARCH Q5 LOCKED: ship the mode, do not wire it. Operator runs
   manually; planner adds a `system-map-drift` gate row in v1.8+ if needed.
9. **DO NOT write outputs to `super-gsd/docs/`** (the RESEARCH text shows
   `super-gsd/docs/SYSTEM-MAP.{json,md}` in some sections, but the user
   prompt + CONTEXT.md goal line both lock the output to
   `.planning/SYSTEM-MAP.{json,md}`). The user-prompt locked path wins:
   write to `.planning/SYSTEM-MAP.json` and `.planning/SYSTEM-MAP.md`.
10. **DO NOT throw upward from public APIs.** route-ledger.cjs LOCKED 32
    R-9.3 mirrors here: `compose`, `renderJson`, `renderMd`,
    `stableStringify` may have internal helpers that throw, but the
    operator-facing dispatch (`modeGenerate`, `modeCheck`, `selfTest`)
    catches everything and returns an exit code.
11. **DO NOT walk `super-gsd/agents/*.md`** as separate rows. Canonical
    agent surface IS `agents.yaml`; rows reference agent_file paths.
12. **DO NOT include hooks (`super-gsd/hooks.yaml`) or MUDA probes/templates
    as new sections.** Out of scope per MAP-01 input list (RESEARCH Q13/Q14).

## Verifier (runnable acceptance)

The verifier embedded below runs against MAP-01..04 directly. Each block is a
self-contained shell snippet. Pass = exit 0. Run from the repo root.

```bash
# ============================================================================
# MAP-01 -- generator reads all inputs without errors
# ============================================================================
node super-gsd/tools/system-map/generate.cjs --generate
# Expect: 0 exit; two "system-map: wrote ..." lines on stdout.

# ============================================================================
# MAP-02 -- both outputs exist + parse cleanly
# ============================================================================
node -e "
const fs = require('fs');
const json = JSON.parse(fs.readFileSync('.planning/SYSTEM-MAP.json', 'utf8'));
if (!json.agents || !json.gates || !json.providers || !json.board ||
    !json.contracts || !json.skills || !json.scripts || !json.libs) {
  console.error('FAIL MAP-02: missing one or more top-level data sections');
  process.exit(1);
}
if (json.contracts.length !== 5) {
  console.error('FAIL MAP-02: expected 5 contracts, got ' + json.contracts.length);
  process.exit(1);
}
if (!fs.existsSync('.planning/SYSTEM-MAP.md')) {
  console.error('FAIL MAP-02: SYSTEM-MAP.md missing');
  process.exit(1);
}
console.log('PASS MAP-02:', json.agents.length, 'agents,',
            json.gates.length, 'gates,',
            json.providers.length, 'providers,',
            json.board.members.length, 'board members,',
            json.contracts.length, 'contracts,',
            json.skills.length, 'skills,',
            json.scripts.length, 'scripts,',
            json.libs.length, 'libs');
"

# ============================================================================
# MAP-03 -- determinism: two runs, byte-identical modulo generated_at
# ============================================================================
node super-gsd/tools/system-map/generate.cjs --generate
cp .planning/SYSTEM-MAP.json /tmp/smap-1.json
cp .planning/SYSTEM-MAP.md   /tmp/smap-1.md
sleep 1
node super-gsd/tools/system-map/generate.cjs --generate
node -e "
const fs = require('fs');
const a = JSON.parse(fs.readFileSync('/tmp/smap-1.json', 'utf8'));
const b = JSON.parse(fs.readFileSync('.planning/SYSTEM-MAP.json', 'utf8'));
delete a.generated_at; delete b.generated_at;
if (JSON.stringify(a) !== JSON.stringify(b)) {
  console.error('FAIL MAP-03: JSON non-deterministic mod generated_at');
  process.exit(1);
}
const mdA = fs.readFileSync('/tmp/smap-1.md', 'utf8')
              .replace(/^Generated at: .*$/m, 'Generated at: <s>');
const mdB = fs.readFileSync('.planning/SYSTEM-MAP.md', 'utf8')
              .replace(/^Generated at: .*$/m, 'Generated at: <s>');
if (mdA !== mdB) {
  console.error('FAIL MAP-03: MD non-deterministic mod Generated at line');
  process.exit(1);
}
console.log('PASS MAP-03 (json + md byte-identical mod generated_at)');
"

# Bonus: --check on freshly-generated must exit 0 clean.
node super-gsd/tools/system-map/generate.cjs --check
# Expect: exit 0 and "system-map --check: clean ..." on stdout.

# ============================================================================
# MAP-04 -- ARCHITECTURE.md deprecation note present
# ============================================================================
grep -q 'DEPRECATED' super-gsd/docs/ARCHITECTURE.md \
  && grep -q '\.planning/SYSTEM-MAP\.md' super-gsd/docs/ARCHITECTURE.md \
  && echo "PASS MAP-04" \
  || (echo "FAIL MAP-04: missing DEPRECATED tag and/or SYSTEM-MAP.md citation" && exit 1)

# ============================================================================
# Self-test (12+ assertions; runs separately from MAP-01..04)
# ============================================================================
node super-gsd/tools/system-map/generate.cjs --self-test
# Expect: exit 0 and "system-map self-test: <N> pass, 0 fail" on stdout.
# Also expect: real .planning/SYSTEM-MAP.{json,md} unchanged after run.
```

All five blocks pass = phase-acceptance verdict PASS.

## Live-or-local fallback (Patch 4)

The generator runs deterministically with no external dependencies, no
network, no shell-outs, no env reads. Every path resolution is
`__dirname`-anchored.

- **Live mode** (`--generate` against real registries): walks
  `super-gsd/registry/*.yaml`, `super-gsd/skills/*/SKILL.md`,
  `super-gsd/scripts/*`, `super-gsd/scripts/lib/*`, all on local disk. No
  remote calls.
- **Local fallback** (`--self-test`): writes only to `os.tmpdir()`; the
  fingerprint guard asserts the canonical artifacts are untouched. The
  fixture-mode assertion (#11) generates against a tmp out-dir to prove the
  full read -> compose -> render -> write pipeline works end-to-end without
  touching the real `.planning/`.
- **Drift guard** (`--check`): reads existing `.planning/SYSTEM-MAP.{json,md}`,
  re-composes in-memory, byte-compares modulo the single mutable
  `generated_at` field. Exit 0 = clean, 1 = drift, 2 = artifact missing.

No degraded-path branching; no provider availability checks; no fallback
chain. The phase has zero runtime dependencies beyond the vendored js-yaml
already shipped under `super-gsd/tools/plan-schema/node_modules/`.

## Schema-without-consumer satisfaction

Per ROADMAP-AGENT.md (`EXISTING-SURFACE-AUDIT.md:67-73`): every phase
introducing a new artifact must ship at least one production caller. Phase
35 ships FOUR (RESEARCH Section 6):

| # | Consumer | What it does |
|---|----------|--------------|
| 1 | Operator (human) | Reads `.planning/SYSTEM-MAP.md` for canonical agent / gate / provider / skill / contract catalog |
| 2 | Future tooling | Reads `.planning/SYSTEM-MAP.json` for deterministic API surface (dashboards, audit scripts, milestone-close summarizers) |
| 3 | `--check` invocation | Drift guard: regenerates in-memory, byte-compares modulo generated_at; exits 1 on registry drift. STRUCTURAL caller -- failure mode is real |
| 4 | ARCHITECTURE.md deprecation block | Reader follows `.planning/SYSTEM-MAP.md` link; documentation surface is the consumer of MAP-04 |

`--check` is the load-bearing structural caller: without it the .json and
.md files are inert documentation. With it they are a checkable invariant
operators can fire any time. Phase 32 had 1 production caller; Phase 33
had 2; Phase 34 had 5; Phase 35 has 4 -- exceeds the "at least 1" rule by 4x.

## Constraints

- **ASCII-only outputs**: PS 5.1 mojibake guard inherited from
  `sgsd-mission-strip.ps1:25`. Self-test assertion 14 enforces. Use `--`
  not `—`; plain ASCII quotes; plain ASCII bullets (`-`, `*`).
- **LF line endings**: all generated and edited files use `\n` (not
  `\r\n`). Set `'utf8'` in fs.writeFileSync calls; do not normalize.
- **Single-file scripts**: Phase 34 Q13 lock. ONE file at
  `super-gsd/tools/system-map/generate.cjs`. No helper modules.
- **Vendored js-yaml only**: no new npm install. Resolve via
  `path.resolve(__dirname, '..', 'plan-schema', 'node_modules', 'js-yaml')`.
  Identical pattern to `gates-registry.cjs:41-44`,
  `validate.cjs:133-151`, `09-verify.mjs:12`.
- **Public API never throws upward**: all operator-boundary entrypoints
  (`modeGenerate`, `modeCheck`, `selfTest`) wrap internal helpers in
  try/catch and return exit codes. (route-ledger.cjs LOCKED 32 R-9.3.)
- **`__dirname` anchor**: never `process.cwd()`. Self-test invokable from
  any directory must always identify the SAME canonical
  `.planning/SYSTEM-MAP.{json,md}`. (Phase 32 W3 lesson.)
- **Atomic commits**: one per atomic deliverable; never batch; never
  amend; stage specific files by name (no `git add -A`).
- **Per-dispatch ATC + halt-on-CRIT**: 3-retry budget; CRIT-BACKLOG
  rollover; "Autonomy continues; evidence tells the truth."
- **No external deps**: built-ins (`fs`, `path`, `os`) only. No
  child_process, no network, no env reads.

## Commit plan (atomic, one per deliverable)

The executor produces THREE atomic commits, in this order:

1. **`feat(35-01): system-map generate.cjs lib + 12-assertion self-test`**

   Stages:
   - `super-gsd/tools/system-map/generate.cjs` (NEW)
   Acceptance:
   - `node super-gsd/tools/system-map/generate.cjs --self-test` exits 0
   - `node super-gsd/tools/system-map/generate.cjs --help` prints usage
   - per-dispatch ATC fires (FULL tier; new tool + new file).

2. **`docs(35-01): deprecate ARCHITECTURE.md sections 6/7/8 in favor of .planning/SYSTEM-MAP.md`**

   Stages:
   - `super-gsd/docs/ARCHITECTURE.md` (modified, +12 lines)
   Acceptance:
   - `grep -q 'DEPRECATED' super-gsd/docs/ARCHITECTURE.md` exits 0
   - `grep -q '.planning/SYSTEM-MAP.md' super-gsd/docs/ARCHITECTURE.md` exits 0
   - lines outside the inserted block diff to zero against pre-edit
   - per-dispatch ATC fires (LITE tier; small docs edit, but plan-level FULL).

3. **`feat(35-01): cold-generate first SYSTEM-MAP.json + .md artifacts`**

   Stages:
   - `.planning/SYSTEM-MAP.json` (NEW)
   - `.planning/SYSTEM-MAP.md` (NEW)
   Acceptance:
   - `node super-gsd/tools/system-map/generate.cjs --check` exits 0
   - MAP-01..04 verifier blocks all PASS.

After commit 3, the v1.7 milestone is ready for `sgsd-complete-milestone`.

## Sequencing inside T1 (RESEARCH 12.4 waves)

The executor walks these waves top-to-bottom; each wave produces an
incremental code state that passes `--self-test` for the assertions added
to date.

- **W0 (build readers + compose)**. Wire vendored js-yaml. Implement
  `_readAgents`, `_readGates`, `_readProviders`, `_readBoard`,
  `_readContracts`, `_readSkills`, `_readScripts`, `_readLibs`. Wire
  `compose()`. Self-test asserts 1-7 (count assertions).
- **W1 (renderJson + stableStringify)**. Add stable JSON output; assertion
  8 (deterministic JSON) passes.
- **W2 (renderMd)**. Add ASCII markdown output; assertions 9 (deterministic
  MD) and 14 (ASCII-only) pass.
- **W3 (modes: --generate, --check, --self-test, --help)**. Wire arg
  parsing + dispatch; assertions 11 (fixture --generate against tmp out-dir)
  and 12 (canonical untouched) pass.
- **W4 (cold-generate)**. Run `--generate` against the live `.planning/`;
  commit `SYSTEM-MAP.json` + `SYSTEM-MAP.md`. Run `--check` -> exit 0
  proves the loop. (This is commit 3.)
- **W5 (deprecation block)**. Edit ARCHITECTURE.md. Per-dispatch ATC fires
  on this commit. (This is commit 2.)
- **W6 (phase-level ATC)**. Verifier asserts re-running `--generate`
  produces the same outputs modulo `generated_at` (the production-caller
  form of self-test 8/9). Phase-level ATC review fires (FULL tier;
  ~+930 LoC threshold met).

W4/W5/W6 ordering note: the commit ORDER above (1: lib, 2: docs, 3:
artifacts) does NOT match wave order (W0..W6). The executor should ship
commits in commit-plan order (lib first, deprecation second, artifacts
third) so per-dispatch ATC sees clean increments. Within commit 1, the
executor may stage the file at any wave boundary; staging is one shot.

## Plan-level audit footnote

This plan touches:

- 1 new tool file (`super-gsd/tools/system-map/generate.cjs`, ~650 LOC)
- 1 docs file (`super-gsd/docs/ARCHITECTURE.md`, +12 LOC)
- 2 generated artifacts (committed, not hand-authored: ~1325 LOC combined)

Human-authored LoC delta: ~+930 (the .cjs + the ARCHITECTURE.md insert).
This is a FULL ATC tier per CLAUDE.md classification (new file + new
system; GATE indicators present because new tool introduced).

Per-dispatch ATC fires on each commit. Phase-level ATC fires after commit
3 (dual-provider per readiness GO; codex-cli-reviewer + claude-sonnet-
reviewer per `super-gsd/registry/review-providers.yaml:42-59`).

MUDA threshold (~930 LoC) MET; sgsd-muda-audit fires per
`super-gsd/registry/gates.yaml:133-156`. Expected verdict PASS or WARN
(precedent: Phases 31-34 all closed PASS with anti-slop 9.5-10/10).

## Status taxonomy expectation

PASS expected. All four prior v1.7 phases closed PASS with anti-slop
9.5-10/10 across both providers (codex-cli-reviewer + claude-sonnet-
reviewer). Phase 35 mirrors the same lib architecture (vendored js-yaml,
__dirname anchor, single-file, public-API never-throws-upward, ASCII-only,
12+ assertion self-test) so similar quality bar expected.

If verdict drops to WARN: address findings in a follow-up commit per gate
`phase-level-ATC` repair_instruction
(`super-gsd/registry/gates.yaml:62-75`); re-run `gsd-verifier` to refire
phase-level-ATC.

If verdict drops to CRIT: per-dispatch ATC `repair_instruction`
(`super-gsd/registry/gates.yaml:38`) -- read the latest commit-reviews.jsonl
row, address the CRIT verdict, re-commit, re-dispatch executor to refire
ATC. 3-retry budget; CRIT-BACKLOG rollover thereafter ("Autonomy
continues; evidence tells the truth.").

## Kill / defer conditions

Mirroring CONTEXT.md:

- **DEFER if `--check` drift guard turns out to be over-tight** (e.g. a
  legitimate manual edit triggers false-positive drift). Relax to
  warn-only in v1.8+ if observed in production. Phase 35 ships strict
  exit-1 drift; v1.8 may demote to soft-warn via gates.yaml entry.
- **HARD STOP if generator emits non-deterministic output.** Determinism
  is the load-bearing contract (MAP-03). If self-test assertion 8 or 9
  fails after W1/W2 implementation, halt and re-derive (likely cause:
  forgot a sort key, or used `Object.entries` without `.sort()`, or used
  default `.sort()` instead of the codepoint comparator).
- **HARD STOP if MAP-04 deprecation note overwrites load-bearing
  ARCHITECTURE.md content.** Only the 12-line block is added between
  current line 263 and current line 265. Sections 1-5 and 9+ untouched.
  Existing tables in 6/7/8 PRESERVED.

## v1.7 milestone close (informational)

After Phase 35 ships, v1.7 is ready for `sgsd-complete-milestone`. Total
v1.7 deliverables:

- envelope-v1 (Phase 31, 5th contract anchor)
- route-ledger.cjs (Phase 32, codex_route boundary wired into orchestrator)
- repair-command-checker.cjs + 13 repair_instructions + 2 repair_commands
  (Phase 33, REPAIR lane)
- review-ledger.cjs + canonical aggregation + --kill-check (Phase 34,
  closes v1.5 empty-baseline gap)
- system-map generator + .planning/SYSTEM-MAP.{json,md} +
  ARCHITECTURE.md deprecation (Phase 35, MAP lane)

Backlog rolled forward from v1.6: 10 items (all phase_atc carryover).
v1.7 itself adds 0 new debt rows (all CRIT/WARN findings fixed in-loop
across all 5 phases).

## Cross-references

- 35-CONTEXT.md (locked decisions; goal; acceptance verbatim)
- 35-RESEARCH.md (HIGH confidence research; 18 derivation calls all locked)
  - Section 1 (input inventory + banner conventions + frontmatter pattern)
  - Section 2.1 (output schema; per-section row shape)
  - Section 2.2 (trigger_clause_count rationale)
  - Section 3 (determinism strategy: codepoint sort + sortKeys + skip
    volatile)
  - Section 4 (ARCHITECTURE.md deprecation target rationale)
  - Section 5 (CLI mode design: --generate / --check / --self-test /
    --help; exit codes)
  - Section 6 (4-caller production-consumer satisfaction)
  - Section 7 (generator implementation outline; vendored js-yaml resolution;
    pure-fs constraint; public-API surface)
  - Section 8 (12+ assertion self-test scaffold; fingerprint guard)
  - Section 11 (Q1..Q18 derivation locks)
  - Section 12.3 (LoC delta ~+930)
  - Section 12.4 (W0..W6 sequencing)
- super-gsd/scripts/lib/route-ledger.cjs (Phase 32 architectural template;
  1:1 mirror for self-test layout, never-throws-upward, __dirname anchor)
- super-gsd/scripts/lib/review-ledger.cjs (Phase 34 most recent precedent;
  byte-comparison determinism test pattern at lines 594-606)
- super-gsd/scripts/lib/gates-registry.cjs:38-72 (vendored js-yaml
  resolution pattern; load-time validation via repair-command-checker)
- super-gsd/registry/command-envelope-v1.yaml:1-273 (Phase 31 5th-contract
  anchor; envelope_version 1; collides_with: [])
- super-gsd/registry/handover-contract-v2.yaml:1-15 (4th contract metadata)
- super-gsd/templates/plan-schema-v2.json (4th-of-5 schema path)
- super-gsd/docs/ARCHITECTURE.md:198-263 (deprecation target)
- .planning/milestones/v1.7/REQUIREMENTS.md:46-51 (MAP-01..04)
- .planning/discussions/2026-04-26-mass-discuss.md:210 (35=B locked)
- .planning/discussions/2026-04-26-mass-discuss.md:77 (defer auto-deletion
  to v2.1)
- .planning/ROADMAP-AGENT.md:355-368 (Phase 35 block)

## Ready-to-execute checklist (executor self-check before starting T1)

- [ ] Read 35-CONTEXT.md once.
- [ ] Read 35-RESEARCH.md sections 2, 3, 5, 7, 8, 11 once.
- [ ] Confirm `super-gsd/tools/plan-schema/node_modules/js-yaml/` exists on
      disk (the vendored js-yaml the generator requires).
- [ ] Confirm `super-gsd/registry/{agents,gates,review-providers,
      board-members,command-envelope-v1,handover-contract-v2}.yaml` all
      exist (these are the 6 yaml inputs).
- [ ] Confirm `super-gsd/templates/plan-schema-v2.json` exists.
- [ ] Confirm `super-gsd/skills/` has 21 skill subdirectories with
      `SKILL.md` files.
- [ ] Confirm `super-gsd/scripts/` has script files at the top level (40
      files at planning time) AND a `lib/` subdirectory (18 files).
- [ ] Confirm `super-gsd/docs/ARCHITECTURE.md` is present and has section
      6 / 7 / 8 around lines 198-263.

Once all 8 checks pass, begin W0. The plan is fully specified; no further
clarifying questions to the operator are needed.

## End of plan

Total plan length target: 800-1300 lines (this file). Plan is self-contained
and ready for sgsd-executor dispatch under FULL ATC tier with dual-provider
phase-level review at close.
