---
phase: 44
phase_name: Legal Context Registry
milestone: v1.9
researched: 2026-04-27
domain: Canonical-source registry generator + reference validator + Phase 45 admission boundary
confidence: HIGH
controlling_principle: Reject invented references at packet boundary (mass-discuss row 44, line 239)
mirror_template: Phase 35 system-map/generate.cjs (canonical-source walker) + Phase 42 token-waste/check.cjs (read-only validator)
upstream: Phase 41 (ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS), Phase 42 (VERDICTS, ROUTE_REASONS), Phase 43 (STATUS_VOCAB, BypassRef, Decision, GitCommit)
downstream: Phase 45 PACKET-03 (validateReferences at packet build), Phase 49 GOV-02 (memory write admission), Phase 50 cockpit (status-consistency reads), Phase 51 BENCH-05 (failure injection: stale registry, invalid phase ID)
---

# Phase 44 - Legal Context Registry - Research

## 1. Goal Restatement + Acceptance Mapping

Phase 44 ships TWO tools and ONE generated artifact under `super-gsd/tools/context-registry/`:

1. `build.cjs` -- walks canonical sources (registries, schemas, phase folders) and EMITS `legal-keys.json`.
2. `check.cjs` -- READS `legal-keys.json` and validates arbitrary input objects against the eight legal categories.
3. `legal-keys.json` -- the generated registry; canonical = code + config; this file is a PROJECTION (lock 3).

**Mass-discuss row 44 lock (verbatim, line 239):** "Reject invented references at packet boundary". Phase 44 is the boundary. Phase 45 packet builder calls `check.cjs::validateReferences(packet)` BEFORE serializing the packet; any invented or stale key produces an `invalid_keys[]` row that Phase 45 must surface, not silently drop.

This phase exists because the bloat audit found agents free-form generating phase IDs ("Phase 56", "Phase v1.7/P29") and gate IDs that did NOT exist. Without a canonical legal list, ambient context inheritance produces references that look real but don't resolve. Phase 44 is the deterministic local check that breaks this failure mode.

### 1.1 ROADMAP sec.44 acceptance (lines 114-129, verbatim)

| # | Acceptance | Phase 44 binding |
|---|------------|------------------|
| A1 | generated registry includes milestones, phases, gates, agents, artifacts, providers, statuses, and known phase folders | sec.3 schema (8 top-level keys) + sec.4 build sources |
| A2 | invalid phase/gate/agent/artifact IDs are rejected | sec.6 `check.cjs` validation API + sec.8 self-test fixture F2/F4 |
| A3 | stale/superseded keys are represented explicitly, not silently accepted | sec.5 `{active, superseded[]}` shape + sec.8 self-test fixture F3 |

### 1.2 REG-01..05 binding (REQUIREMENTS.md:121-130, verbatim)

| ID | Description | Phase 44 binding |
|----|-------------|------------------|
| REG-01 | Generate `super-gsd/tools/context-registry/legal-keys.json` | sec.6.1 build.cjs API |
| REG-02 | Include valid milestone IDs, phase IDs, gate IDs, agent IDs, artifact IDs, provider IDs, status vocabulary | sec.3 schema (8 categories: milestones, phases, gates, agents, artifacts, providers, statuses, phase_folders) |
| REG-03 | Implement validator that rejects invented references | sec.6.2 check.cjs API |
| REG-04 | Wire validator into packet builder and at least one cockpit or status-consistency path | sec.9 cross-phase contract: Phase 45 PACKET-03 + Phase 50 cockpit fallback |
| REG-05 | Self-test covers valid, invalid, stale, and superseded keys | sec.8 self-test (4 fixtures + 9 secondary = 13 assertions) |

### 1.3 Design lock 4 + 6 + 13 (REQUIREMENTS.md:39-49, 67-68)

> Lock 4: "Agents consume role-specific context packets, not raw milestone history."
> Lock 6: "Critical outputs bypass compression: ... behaviorally proven provider outage."
> Lock 13: "Autonomy continues; evidence tells the truth. Budget breaches degrade or reroute by policy. They do not become silent overrun."

Phase 44 binding:
- Lock 4: registry IS the role-specific packet's reference allowlist. Without Phase 44, the packet builder cannot reject hallucinated keys.
- Lock 6: provider IDs (`claude`, `codex`, `local-script`, `vtp`) are critical-bypass-relevant; they MUST appear in the registry verbatim.
- Lock 13: invalid-key detection NEVER halts auto-mode. `check.cjs` returns `{valid: false, invalid_keys: [...]}`; orchestrator continues, packet builder elides the invalid rows or flags them, never throws.

REQUIREMENTS line 285 hard-stop: "Hard stop if context packet builder can invent or accept unknown phase/gate IDs." Phase 44 is the mechanical embodiment of that hard-stop, BUT the hard-stop is at the boundary contract level (packet builder rejects invalid keys); Phase 44 itself emits a `{valid:false, ...}` result, never throws upward (Lock 13 + Phase 41/42/43 contract pattern).

---

## 2. Audit-Driven Evidence -- Why a Registry Now

### 2.1 Direct evidence: invented references in current SGSD

Live registry surface count (verified via direct ls / grep / wc):

| Category | Count | Source |
|----------|------:|--------|
| Active milestones | 9 | `ls .planning/milestones/v*` filtered to dirs |
| Active phase folders | 50 | walk all `phases/{NN}-name/` across milestones |
| Superseded milestones | 1 | `.planning/archive/superseded/v1.9-knowledge-memory-governance/` |
| Gates | 13 | `grep -c '^  - name:' super-gsd/registry/gates.yaml` |
| Agents (jsonl) | 23 | `wc -l .planning/resource-registry/agents.jsonl` |
| Agents (yaml) | 8 | `super-gsd/registry/agents.yaml` (subset of jsonl) |
| Review providers | 2 | `super-gsd/registry/review-providers.yaml` (claude-sonnet-reviewer, codex-cli-reviewer) |
| Reason codes | 36 | `grep -c '^      - code:' super-gsd/registry/command-envelope-v1.yaml` |
| Envelope statuses | 6 | `command-envelope-v1.json:25` (ok, warn, fail, skipped, timeout, blocked) |
| Capsule statuses | 5 | `PHASE-CAPSULE.schema.json:32-35` (PASS, PASS-WITH-DEFERRED-N, FAIL, UNKNOWN, IN_PROGRESS) |

This is the FACTUAL legal-keys content. Anything outside these counts (e.g., a packet referencing "Phase 56" or "gate sgsd-foo-bar") is INVENTED.

### 2.2 Phase 43 capsule output as direct evidence

44 PHASE-CAPSULE.json files exist (verified `find .planning/milestones -name PHASE-CAPSULE.json | wc -l`). Phase 43 captured `downstream_contract.consumers[]` for each, e.g., Phase 41's capsule lists consumers `["Phase 42", "Phase 43"...]` as free-form strings. If Phase 45 packet builder dereferences those strings without registry validation, "Phase 56" (which doesn't exist) cannot be distinguished from "Phase 42" (which does). Phase 44 closes this gap.

### 2.3 Existing pollution example

v1.3 has a phase folder `p5-codex-monitor` that does NOT match `^\d{2}-` and is therefore SKIPPED by Phase 43 capsule writer (see `.planning/milestones/v1.3/PHASE-INDEX.jsonl` -- 3 rows for 4 phase dirs). Phase 44 must surface this in `phase_folders.superseded[]` or `phase_folders.malformed[]` so downstream consumers don't dereference "p5-codex-monitor" as a regular phase ID.

### 2.4 Stale superseded artifact (the binding A3 case)

`.planning/archive/superseded/v1.9-knowledge-memory-governance/README.md` documents that the prior v1.9 (Knowledge + Memory Governance) was renumbered/superseded on 2026-04-27, with retired locks `41=C, 41.1, 41.2, 41.3, 42=C, 43=A, 44=A, 45=B`. If a packet builder dereferences "v1.9 lock 41=C" in 2026-05-01 expecting the OLD v1.9, registry MUST surface `superseded[]` with `replaced_by` pointing at the new v1.9 SGSD-Research. This is A3's regression test.

---

## 3. Existing Surface Inventory + Schema Design (Q1, Q4)

### 3.1 Consume, do not duplicate

| Surface | Path | Phase 44 use |
|---------|------|--------------|
| Phase 41 reporter | `super-gsd/tools/token-attribution/report.cjs` | **IMPORT** `ROLES`, `PROVIDERS`, `STATUSES`, `BLOAT_THRESHOLDS`, `COMMAND_NAME`, `ENVELOPE_VERSION` |
| Phase 42 checker | `super-gsd/tools/token-waste/check.cjs` | **IMPORT** `VERDICTS`, `ROUTE_REASONS`, `BUDGETS` |
| Phase 43 capsule schema | `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` | **IMPORT** capsule status enum (5 values) + capsule file kinds (PhaseOutput.kind, BypassRef.kind) |
| gates.yaml | `super-gsd/registry/gates.yaml` | **READ** for legal_gates (13 entries verbatim) |
| agents.jsonl | `.planning/resource-registry/agents.jsonl` | **READ** for legal_agents (23 entries with status:active filter) |
| agents.yaml | `super-gsd/registry/agents.yaml` | **READ** for category metadata + supersedes mapping |
| review-providers.yaml | `super-gsd/registry/review-providers.yaml` | **READ** for legal_providers (2 entries) |
| command-envelope-v1.yaml | `super-gsd/registry/command-envelope-v1.yaml` | **READ** for legal_commands (emitter names) + legal_reason_codes (36) |
| command-envelope-v1.json | `super-gsd/templates/command-envelope-v1.json` | **READ** for envelope_status (6) |
| PHASE-INDEX.jsonl files | `.planning/milestones/{ms}/PHASE-INDEX.jsonl` | **READ** for legal_phases (44 capsuled phases) |
| Phase folder glob | `.planning/milestones/v*/phases/{NN}-name/` | **WALK** for legal_phase_folders (50 dirs) |
| Archive superseded | `.planning/archive/superseded/*/README.md` | **READ** for superseded_milestones[] |
| system-map/generate.cjs | `super-gsd/tools/system-map/generate.cjs` | **MIRROR** canonical-source walker pattern (yaml load, sort, stableStringify) |
| status-consistency/check.cjs | `super-gsd/tools/status-consistency/check.cjs` | **MIRROR** read-only check + JSONL validator |

### 3.2 Phase 44 creates exclusively

| New artifact | Reason |
|--------------|--------|
| `super-gsd/tools/context-registry/build.cjs` | REG-01 verbatim (canonical writer) |
| `super-gsd/tools/context-registry/check.cjs` | REG-03 verbatim (validator) |
| `super-gsd/tools/context-registry/legal-keys.json` | REG-01 generated artifact (PROJECTION) |
| `super-gsd/tools/context-registry/build.test.cjs` | self-test scaffold (REG-05) |

### 3.3 Surfaces NOT to duplicate (EXISTING-SURFACE-AUDIT.md:136-144)

- No second registry yaml (gates.yaml + agents.yaml + review-providers.yaml + command-envelope-v1.yaml ARE the canonical sources; Phase 44 reads them).
- No second route-decision ledger.
- legal-keys.json is NOT canonical; canonical = the source yaml/jsonl files. Deleting legal-keys.json and rebuilding from canonical sources MUST yield byte-equivalent output (Lock 3 mirror; same as Phase 43's capsule rule).

### 3.4 Q1 -- Top-level schema (LOCKED, 8 categories + 1 metadata)

```json
{
  "schema_version": 1,
  "registry_version": "1.0.0",
  "generated_at": "2026-04-27T...Z",
  "generated_by": "super-gsd/tools/context-registry/build.cjs@<gitsha>",
  "source_hashes": { "<canonical-source-path>": "<sha256>", ... },
  "milestones": { "active": [...], "superseded": [...] },
  "phases": { "active": [...], "superseded": [...] },
  "gates": { "active": [...], "superseded": [] },
  "agents": { "active": [...], "superseded": [...] },
  "artifacts": { "active": [...], "superseded": [] },
  "providers": { "active": [...], "superseded": [] },
  "statuses": { "envelope": [...], "capsule": [...], "agent": [...] },
  "phase_folders": { "active": [...], "malformed": [...] },
  "commands": { "active": [...], "superseded": [] },
  "reason_codes": { "active": [...], "future": [...] }
}
```

10 keys total: `schema_version`, `registry_version`, `generated_at`, `generated_by`, `source_hashes`, plus 8 category keys.

**Why not a flat array per category?** A3 acceptance demands explicit superseded representation. Per-category `{active, superseded}` shape is the cleanest forward-stable expression. A1 names 8 categories verbatim ("milestones, phases, gates, agents, artifacts, providers, statuses, and known phase folders") -- registry covers all 8 plus 2 derived (`commands` and `reason_codes`) which are legal-key consumers in Phase 45 packet builder.

### 3.5 Q4 -- Per-category ID format (LOCKED, table)

| Category | ID format | Example | Source |
|----------|-----------|---------|--------|
| milestones | string `vN.M` | `"v1.9"` | dir name under `.planning/milestones/` |
| phases | string `<milestone>/<phase>` | `"v1.9/41"` | from PHASE-INDEX.jsonl `{milestone, phase}` |
| gates | string (lower-kebab or mixed-case) | `"per-dispatch-ATC"` | gates.yaml `name` field verbatim |
| agents | string (kebab-case) | `"sgsd-classifier"` | agents.jsonl `id` field verbatim |
| artifacts | string `<kind>` | `"PHASE-CAPSULE.json"`, `"agent-token-spend.jsonl"` | extracted from PHASE-CAPSULE.schema.json + agent emitters[] |
| providers | string | `"claude"`, `"codex"`, `"local-script"`, `"vtp"` | Phase 41 PROVIDERS const verbatim |
| statuses | string | `"ok"`, `"PASS"`, `"researcher"` | per-vocab subkey (envelope/capsule/agent) |
| phase_folders | string `<milestone>/<dirname>` | `"v1.8/40-phase-folder-audit"` | filesystem glob + name regex |
| commands | string | `"logTokenSpend"`, `"checkTokenWaste"`, `"writeCapsule"` | command-envelope-v1.yaml emitters + Phase 41/42/43 COMMAND_NAME |
| reason_codes | string | `"codex_timeout"` | command-envelope-v1.yaml reason_codes |

**Phase IDs as `<milestone>/<phase>` not just `<phase>`:** disambiguates collision (milestones v1.6 ph 26 vs v1.7 ph 26 don't exist today, but the contract is forward-stable). Phase 41 P41 audit reference uses the form "v1.9/P41" which matches.

**Gate IDs verbatim from gates.yaml:** mixed casing (`per-dispatch-ATC`, `MUDA-waste-audit`, `phase-level-ATC`) is the EXISTING source-of-truth; Phase 44 must NOT re-case. Phase 44 enforces the canonical form.

**Agent IDs from agents.jsonl `id`:** the JSONL has 23 rows (verified `wc -l`); agents.yaml has 8 (subset, the active execution specialists). Both are sources -- jsonl is the broader registry (board members, classifier, executor, etc.); yaml carries pick_heuristic + research_principles. Phase 44 unions the two by ID, status:active filter.

### 3.6 Per-category record shape (LOCKED)

```json
{
  "milestones": {
    "active": [
      {"id": "v1.9", "status": "active", "name": "Context Compression, Token Governance, And Research Routing", "phase_range": "41-52"},
      {"id": "v1.8", "status": "active"},
      ...
    ],
    "superseded": [
      {"id": "v1.9-knowledge-memory-governance", "superseded_at": "2026-04-27", "replaced_by": "v1.9", "reason": "renumbered to v1.9 SGSD-Research"}
    ]
  },
  "phases": {
    "active": [
      {"id": "v1.9/41", "phase_name": "Baseline Token Attribution", "status": "PASS", "milestone": "v1.9", "phase": "41"},
      ...
    ],
    "superseded": [
      {"id": "v1.9-old/41", "milestone": "v1.9-knowledge-memory-governance", "phase": "41", "reason": "renumbered to v1.9/41 (different scope)"}
    ]
  },
  "gates": {
    "active": [
      {"id": "per-dispatch-ATC", "category": "code-quality", "enforcement_mode": "hard-halt", "state": "active"},
      ...
    ]
  },
  "agents": {
    "active": [
      {"id": "sgsd-classifier", "model": "haiku", "status": "active", "category": null},
      {"id": "sgsd-exec-backend", "model": "sonnet", "status": "active", "category": "C"},
      ...
    ]
  },
  "artifacts": {
    "active": [
      {"id": "PHASE-CAPSULE.json", "schema_ref": "super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json", "owner_phase": "v1.9/43"},
      {"id": "agent-token-spend.jsonl", "schema_ref": "super-gsd/tools/token-attribution/report.cjs", "owner_phase": "v1.9/41"},
      ...
    ]
  },
  "providers": {
    "active": [
      {"id": "claude", "source": "Phase 41 PROVIDERS"},
      {"id": "codex", "source": "Phase 41 PROVIDERS"},
      {"id": "local-script", "source": "Phase 41 PROVIDERS"},
      {"id": "vtp", "source": "Phase 41 PROVIDERS"}
    ]
  },
  "statuses": {
    "envelope": ["ok", "warn", "fail", "skipped", "timeout", "blocked"],
    "capsule": ["PASS", "PASS-WITH-DEFERRED-N", "FAIL", "UNKNOWN", "IN_PROGRESS"],
    "agent": ["active", "deprecated", "retired", "draft"]
  },
  "phase_folders": {
    "active": [
      {"id": "v1.9/41-baseline-token-attribution", "milestone": "v1.9", "dir_name": "41-baseline-token-attribution", "phase_id": "41"},
      ...
    ],
    "malformed": [
      {"id": "v1.3/p5-codex-monitor", "milestone": "v1.3", "dir_name": "p5-codex-monitor", "reason": "does not match ^\\d{2}-"}
    ]
  },
  "commands": {
    "active": [
      {"id": "logTokenSpend", "owner_phase": "v1.9/41", "writes_to": ".planning/metrics/agent-token-spend.jsonl"},
      {"id": "checkTokenWaste", "owner_phase": "v1.9/42"},
      {"id": "writeCapsule", "owner_phase": "v1.9/43"},
      {"id": "codex-exec", "owner_phase": "v1.7/31", "writes_to": ".planning/metrics/codex-log.jsonl"},
      ...
    ]
  },
  "reason_codes": {
    "active": [
      {"id": "codex_timeout", "group": "provider_runtime"},
      ...
    ],
    "future": [
      {"id": "empty_hit", "group": "retrieval", "status": "future_v1_9"}
    ]
  }
}
```

Every entry has at minimum `{id}`. Optional metadata (status, source, replaced_by, reason) is per-category.

### 3.7 Tool location decision (LOCKED)

`super-gsd/tools/context-registry/{build,check}.cjs` (REQUIREMENTS:121-124 verbatim). Tools/ folder hosts CLI report-style tools (matches phase-folder-audit, gate-keep-kill, system-map, token-attribution, token-waste, phase-capsule). NOT a `scripts/lib/*-log.cjs` because no real-time append emitter exists -- registry is generated once per canonical-source-change and read at packet build time.

Sibling test file: `super-gsd/tools/context-registry/build.test.cjs` (mirror Phase 43 `phase-capsule/write.test.cjs` pair).

---

## 4. Build Sources Mapping (Q6)

LOCKED: 8 canonical sources, each contributing to specific categories. Build is a deterministic walk; no LLM judgment.

### 4.1 Canonical-source -> category mapping table

| Canonical source | Path | Contributes to | Read mode |
|------------------|------|----------------|-----------|
| `super-gsd/registry/gates.yaml` | yaml | `gates` | `yaml.load` (mirror gates-registry.cjs:38-94) |
| `super-gsd/registry/agents.yaml` | yaml | `agents` (category, model_default, supersedes metadata) | `yaml.load` |
| `.planning/resource-registry/agents.jsonl` | jsonl | `agents` (canonical id list, status filter) | line-by-line `JSON.parse` |
| `super-gsd/registry/review-providers.yaml` | yaml | `providers` (provider IDs as legal targets) -- but Phase 41 PROVIDERS const is the canonical `providers` enum | `yaml.load` |
| `super-gsd/registry/command-envelope-v1.yaml` | yaml | `commands` (emitter names: codex-exec, audit, sgsd-readiness-probe, sgsd-muda-audit, atc-review, edge-guard, handoff) + `reason_codes` (36 codes) | `yaml.load` |
| `super-gsd/templates/command-envelope-v1.json` | json | `statuses.envelope` (6 values) | `JSON.parse` |
| `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` | json | `statuses.capsule` (5 values), `artifacts` (PhaseOutput.kind enum if present) | `JSON.parse` |
| `super-gsd/tools/token-attribution/report.cjs` | cjs | `providers` (4: claude, codex, local-script, vtp), `statuses.agent` (8: ROLES treated as the agent role vocab) | `require()` -- import frozen consts |
| `super-gsd/tools/token-waste/check.cjs` | cjs | `commands` (`checkTokenWaste`), Phase 42 `VERDICTS` | `require()` |
| `.planning/milestones/v*/PHASE-INDEX.jsonl` | jsonl x N | `phases.active` (44 capsuled phases) + `milestones.active` (derived via distinct(milestone)) | per-file line-by-line read |
| Filesystem walk: `.planning/milestones/v*/phases/{NN}-name/` | dir glob | `phase_folders.active` (50 dirs) + `phase_folders.malformed` (1 dir) | `fs.readdirSync` + regex match |
| `.planning/archive/superseded/*/README.md` | markdown | `milestones.superseded` (1 entry: v1.9-knowledge-memory-governance) | YAML frontmatter parse |
| `.planning/milestones/v1.9/REQUIREMENTS.md` | markdown | `milestones.active` (current milestone metadata: name, phase_range) | YAML frontmatter parse |

**13 sources total.** All read-only. No source is written to by build.cjs.

### 4.2 Walk algorithm (deterministic)

```text
build(repoRoot, opts):
  result = { schema_version: 1, registry_version: "1.0.0",
             generated_at: ISO_NOW, generated_by: "...@<gitsha>",
             source_hashes: {}, ... 8 categories }

  // Step 1: contracts + enums (in-tree, deterministic)
  result.statuses.envelope = readEnvelopeSchema()  // 6 values from $schema enum
  result.statuses.capsule  = readCapsuleSchema()   // 5 values
  result.statuses.agent    = readAgentRegistry()   // ['active','deprecated','retired','draft']

  result.providers.active  = importPhase41ProvidersConst()  // 4 values
  result.commands.active   = unionEmittersAndPhase41To43Commands()
  result.reason_codes      = readEnvelopeRegistry()  // 36 + 5 future

  // Step 2: gates
  result.gates.active = walkGates(REG_GATES)

  // Step 3: agents (union of yaml + jsonl, dedup by id, status:active filter)
  const yamlAgents = walkAgentsYaml(REG_AGENTS)
  const jsonlAgents = walkAgentsJsonl(RESOURCE_AGENTS)
  result.agents.active = mergeAgents(yamlAgents, jsonlAgents)
  result.agents.superseded = pickSuperseded(yamlAgents.lifecycle_events, jsonlAgents)

  // Step 4: phase_folders (filesystem glob)
  const allDirs = walkPhaseFolders(REPO_PLANNING_MILESTONES)
  result.phase_folders.active = allDirs.filter(matchesNNDash)
  result.phase_folders.malformed = allDirs.filter(notMatchesNNDash)

  // Step 5: phases (from PHASE-INDEX.jsonl files)
  result.phases.active = walkPhaseIndices(REPO_PLANNING_MILESTONES)

  // Step 6: milestones (derived from phases + superseded archive)
  result.milestones.active = distinctMilestonesFromPhases(result.phases.active)
                              .map(enrichWithRequirements)
  result.milestones.superseded = walkSupersededArchive(ARCHIVE_DIR)

  // Step 7: artifacts (extracted from contracts + emitter list)
  result.artifacts.active = collectArtifactKinds()

  // Step 8: source_hashes (sha256 each source for A3 idempotency)
  result.source_hashes = hashAllSources(SOURCES_LIST)

  // Step 9: sort all arrays + sort keys for stableStringify
  return stableSerialize(result)
```

### 4.3 Source-hash idempotency

`source_hashes` records sha256 of every canonical-source file at write time. If sources unchanged, rebuild produces identical legal-keys.json (modulo `generated_at`). A3 binding test: build -> H1; rebuild -> H2; assert H1 === H2 (modulo `generated_at`/`generated_by` strip, mirror Phase 43 `_capsuleContentHash`).

### 4.4 Read-only invariant

Every source is opened with `fs.readFileSync(p, 'utf8')`. No source is written to. legal-keys.json is the ONLY new artifact created. Self-test assertion 11 binds via fingerprint guard over all 13 sources (mirror Phase 41 sec.7.1).

---

## 5. Stale / Superseded Representation (Q3, A3 binding)

### 5.1 The non-negotiable rule

ROADMAP line 129 verbatim: "stale/superseded keys are represented explicitly, not silently accepted."

Two failure modes Phase 44 MUST prevent:

1. **Silent accept:** packet builder dereferences `"v1.9-old/41"` and gets back the NEW v1.9 P41. Fixed by: registry has NO entry for `"v1.9-old/41"` in `phases.active`; it appears in `phases.superseded[]` with `replaced_by: "v1.9/41"` if reference semantics carry forward, or just `superseded[]` with `reason: "milestone renumbered"` if not.

2. **Silent reject:** packet builder dereferences `"v1.9-old/41"`, `check.cjs` returns `valid:false` without explaining why. Fixed by: `invalid_keys[]` row carries `{key, category, reason: "superseded_key", superseded_record: <record>}`. Caller sees the supersession explicitly.

### 5.2 Per-category supersession shape

```json
{
  "<category>": {
    "active": [
      {"id": "<id>", ...metadata}
    ],
    "superseded": [
      {
        "id": "<old-id>",
        "superseded_at": "2026-04-27",
        "replaced_by": "<new-id>" | null,
        "reason": "<plain-text>",
        "evidence_path": ".planning/archive/superseded/<dir>/README.md"
      }
    ]
  }
}
```

`replaced_by` is null when the superseded entity has no direct replacement (e.g., a retired gate with no successor).

### 5.3 Concrete superseded entries (verified)

**milestones.superseded** (1 entry, from `.planning/archive/superseded/v1.9-knowledge-memory-governance/README.md`):

```json
{
  "id": "v1.9-knowledge-memory-governance",
  "superseded_at": "2026-04-27",
  "replaced_by": "v1.9",
  "reason": "Renumbered. Original Knowledge + Memory Governance plan superseded by SGSD-Research (Context Compression, Token Governance, And Research Routing). Archive preserved for mining.",
  "evidence_path": ".planning/archive/superseded/v1.9-knowledge-memory-governance/README.md"
}
```

**phases.superseded** (5 entries, original phases 41-45 of old v1.9):

```json
[
  {"id": "v1.9-knowledge-memory-governance/41", "superseded_at": "2026-04-27", "replaced_by": null, "reason": "renumbered milestone; original phase 41 Knowledge Provider Registry concept absorbed into v1.9/44 (Legal Context Registry)", "evidence_path": ".planning/archive/superseded/v1.9-knowledge-memory-governance/PHASES-41-45.md"},
  {"id": "v1.9-knowledge-memory-governance/42", "superseded_at": "2026-04-27", "replaced_by": null, "reason": "absorbed into v1.9/45 (Context Packet Builder)", ...},
  ... (3 more)
]
```

**phase_folders.malformed** (1 entry):

```json
{
  "id": "v1.3/p5-codex-monitor",
  "milestone": "v1.3",
  "dir_name": "p5-codex-monitor",
  "reason": "does not match ^\\d{2}- regex; predates current naming convention; Phase 43 capsule writer skips this dir",
  "evidence_path": ".planning/milestones/v1.3/phases/p5-codex-monitor/"
}
```

### 5.4 Validation behavior on superseded keys

`check.cjs::validateReferences(packet)` distinguishes 4 outcomes per reference:

| Reference state | Validator return | invalid_keys row |
|-----------------|------------------|------------------|
| key in `active[]` | valid | -- |
| key in `superseded[]` with `replaced_by` set | invalid | `{key, category, reason:"superseded_key", superseded_record, suggested:replaced_by}` |
| key in `superseded[]` without `replaced_by` | invalid | `{key, category, reason:"superseded_key_retired", superseded_record}` |
| key absent from both | invalid | `{key, category, reason:"unknown_key"}` |

Phase 45 packet builder reads `invalid_keys[]` and decides per-category policy: drop the row (for capsule consumers list), warn-and-continue (for free-form prose references), or hard-reject (for capsule schema-required fields).

### 5.5 Self-test binding (F3)

F3 fixture: seed legal-keys.json with `phases.active = ["v1.9/41"]` and `phases.superseded = [{id: "v1.9-old/41", replaced_by: "v1.9/41", ...}]`. Call `validateReferences({phases: ["v1.9/41", "v1.9-old/41", "v9.9/99"]})`. Assert:
- `valid: false`
- `invalid_keys.length === 2`
- `invalid_keys[0]: {key:"v1.9-old/41", reason:"superseded_key", suggested:"v1.9/41"}`
- `invalid_keys[1]: {key:"v9.9/99", reason:"unknown_key"}`
- "v1.9/41" appears in NEITHER invalid_keys nor active rejection (it's valid).

This is the A3 binding test.

---

## 6. Build + Check API Design (Q2, Q5, Q8, Q9)

### 6.1 build.cjs public API (LOCKED)

```javascript
module.exports = {
  build,              // (repoRoot, opts) -> { ok, written, content_hash, source_hashes } | { ok:false, reason }
  loadRegistry,       // (legalKeysPath) -> registryObj  (read-only loader, with mtime cache)
  registryPath,       // () -> string  (canonical path: super-gsd/tools/context-registry/legal-keys.json)
  resetCache,         // () -> void  (test-only)

  SCHEMA_VERSION,     // const 1
  REGISTRY_VERSION,   // const "1.0.0"
  CATEGORIES,         // frozen array: ['milestones','phases','gates','agents','artifacts','providers','statuses','phase_folders','commands','reason_codes']
  STATUS_KIND,        // frozen array: ['envelope','capsule','agent']
};
```

### 6.2 check.cjs public API (LOCKED)

```javascript
module.exports = {
  validateReferences,  // (packet, opts?) -> { valid, invalid_keys[] }
  validateOne,         // (key, category, opts?) -> { valid, reason?, superseded_record? }
  loadRegistry,        // (legalKeysPath?) -> registryObj  (re-exports build.cjs::loadRegistry)
  isLegal,             // (key, category) -> bool  (shorthand; never throws)
  registryPath,        // re-exports build.cjs

  REASONS,             // frozen array: ['unknown_key','superseded_key','superseded_key_retired','malformed_key','registry_missing','registry_malformed']
};
```

### 6.3 Function contracts

```text
build(repoRoot, opts):
  - opts: { dryRun:false, outPath?, sourcesOverride? }
  - reads 13 canonical sources (see sec.4.1)
  - emits legal-keys.json at opts.outPath || super-gsd/tools/context-registry/legal-keys.json
  - returns { ok:true, written:<path>, content_hash:<sha256>, source_hashes:{...}, counts:{milestones:N, phases:N,...} }
  - on any source missing: returns { ok:false, reason:"source_missing", missing:["<path>",...] }
  - on yaml parse error: returns { ok:false, reason:"source_malformed", path, detail }
  - NEVER throws upward (Lock 13 + Phase 41/42/43 contract)

validateReferences(packet, opts):
  - packet: arbitrary object; recursively walked; any string field MAY be a reference key
  - opts: { categoriesToCheck?, registryPath?, strictMode? }
  - default behavior: walk known capsule-schema fields (downstream_contract.consumers, files[], outputs[].path)
  - returns { valid:bool, invalid_keys:[{key, category, reason, superseded_record?, suggested?}], checked_count:N }
  - on registry missing: returns { valid:false, invalid_keys:[{key:null, category:null, reason:"registry_missing"}], checked_count:0 }
  - NEVER throws upward

validateOne(key, category, opts):
  - returns { valid:bool, reason?, superseded_record? }
  - 4 outcomes per sec.5.4
  - NEVER throws upward

isLegal(key, category):
  - returns bool; convenience for boolean checks
  - NEVER throws (returns false on any error)
```

### 6.4 No-throw contract (Lock 13 binding)

Per Phase 42 lock 13 + Phase 41/43 mirror:

| Failure mode | build.cjs return | check.cjs return |
|--------------|------------------|------------------|
| Source file missing | `{ok:false, reason:"source_missing", missing:[...]}` | `{valid:false, invalid_keys:[{reason:"registry_missing"}]}` |
| YAML parse error | `{ok:false, reason:"source_malformed", path, detail}` | `{valid:false, invalid_keys:[{reason:"registry_malformed"}]}` |
| Registry hash drift (legal-keys.json mtime older than canonical sources) | `{ok:false, reason:"registry_stale", stale_sources:[...]}` (build only checks at write time; check.cjs warns via reason_code on validateReferences if drift detected) | `{valid:bool, invalid_keys:[...], stale_warning:true, stale_sources:[...]}` |
| Bad invocation (CLI) | exit 2 (CLI only; module return is `{ok:false}`) | exit 2 |
| `validateReferences()` invalid input (null packet) | n/a | `{valid:false, invalid_keys:[{reason:"malformed_key", key:null}], checked_count:0}` |

CLI exit codes:
- `--self-test` pass = 0; fail = 1
- `--build` ok = 0; source missing = 1; bad invocation = 2
- `--check <packet.json>` valid = 0; invalid = 0 (NOT 1 -- per Lock 13 invalid is informational, never halt); registry missing = 1; bad invocation = 2

Phase 42 precedent: `--self-test` exit 0/1; `runCheck degraded=0` (informational, NOT halt). Phase 44 mirrors: invalid keys are informational; CLI exit 0 except for self-test failure.

### 6.5 Schema-without-consumer rule (4 in-phase consumers)

| Consumer | Use |
|----------|-----|
| `build.cjs` itself | writes the schema |
| `check.cjs::validateReferences` | reads + walks every category |
| `check.cjs::validateOne` | reads single category lookup |
| Phase 44 self-test (F1-F4) | exercises both APIs |

Phase 45 packet builder is the next-phase consumer (PACKET-03). Phase 50 cockpit may be a third-phase consumer for status-consistency. Both reference the same `loadRegistry` + `validateReferences` exports.

---

## 7. Idempotency + Read-Only Invariant (Q7)

### 7.1 Build idempotency rule

Per Lock 3 (canonical = source files): legal-keys.json is a PROJECTION; deleting it and rebuilding from canonical sources MUST yield byte-equivalent output (modulo `generated_at` / `generated_by` strip).

```javascript
function _registryContentHash(registryObj) {
  const stripped = {...registryObj};
  delete stripped.generated_at;
  delete stripped.generated_by;
  delete stripped.source_hashes; // source_hashes also depends on file mtimes/content; recompute on rebuild
  // Actually: source_hashes IS deterministic if sources unchanged. Keep it in hash.
  // BUT: re-add source_hashes back into stripped after deletion above if we keep it in hash.
  stripped.source_hashes = registryObj.source_hashes;
  const json = JSON.stringify(stripped, Object.keys(stripped).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}
```

Mirrors Phase 43 `_capsuleContentHash` exactly (sec.5.2 of 43-RESEARCH.md).

A3 self-test fixture F2: build -> H1; delete legal-keys.json; rebuild -> H2; assert H1 === H2.

### 7.2 Determinism rules

| Source of non-determinism | Mitigation |
|---------------------------|------------|
| `fs.readdirSync` order | `.sort()` before iterating (mirror Phase 43 sec.5.3) |
| Phase 41/42/43 frozen const order | already deterministic via `Object.freeze` arrays |
| YAML key order | `yaml.load` preserves source order; we `.sort()` arrays in registry shape post-load |
| JSON key order in output | `stableStringify(value, indent)` walks keys with `.sort()` (mirror Phase 35 generate.cjs:97-109) |
| Array order per category | sort by `.id` ascending |
| `superseded[].id` order | sort ascending |

### 7.3 Read-only invariants

**Read-only inputs (fingerprint-protected):**

```javascript
const realSources = [
  REG_GATES, REG_AGENTS, RESOURCE_AGENTS_JSONL, REG_PROVIDERS,
  REG_ENVELOPE_YAML, REG_ENVELOPE_JSON, REG_CAPSULE_SCHEMA,
  REG_PHASE41_REPORT, REG_PHASE42_CHECK,
  // PHASE-INDEX files (8: v1.2-v1.9)
  ...PHASE_INDEX_FILES,
  // archive
  ARCHIVE_README,
  // milestone REQUIREMENTS.md
  MILESTONE_REQUIREMENTS,
];
```

**Owned writes:**
- `super-gsd/tools/context-registry/legal-keys.json` (overwrite-on-rebuild)
- `super-gsd/tools/context-registry/build.cjs`, `check.cjs` (own source)
- `super-gsd/tools/context-registry/build.test.cjs` (own test)

**Self-test invariant (assertion 11):** fingerprint over 13 sources; assert unchanged after `--self-test` run (mirror Phase 41 sec.7.1, Phase 42 sec.9, Phase 43 sec.10.3 verbatim).

```javascript
const realSourcesAndIndices = [
  path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'agents.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'review-providers.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'command-envelope-v1.yaml'),
  path.resolve(__dirname, '..', '..', 'templates', 'command-envelope-v1.json'),
  path.resolve(__dirname, '..', 'phase-capsule', 'PHASE-CAPSULE.schema.json'),
  path.resolve(__dirname, '..', 'token-attribution', 'report.cjs'),
  path.resolve(__dirname, '..', 'token-waste', 'check.cjs'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'resource-registry', 'agents.jsonl'),
  // PHASE-INDEX glob: v1.2-v1.9
  ...['v1.2','v1.3','v1.4','v1.5','v1.6','v1.7','v1.8','v1.9'].map(ms =>
    path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', ms, 'PHASE-INDEX.jsonl')),
  // archive
  path.resolve(__dirname, '..', '..', '..', '.planning', 'archive', 'superseded',
    'v1.9-knowledge-memory-governance', 'README.md'),
];
```

13+ sources fingerprinted. Same pattern as Phase 43 sec.10.3.

### 7.4 Stale-registry detection at validateReferences time

When `check.cjs::validateReferences()` is called, it loads legal-keys.json AND records `legal-keys.json.mtime`. If any canonical source's mtime is NEWER than legal-keys.json's mtime, validator emits `stale_warning: true` + `stale_sources: [...]`. Phase 45 packet builder MAY decide to call `build.cjs::build()` first to refresh, OR continue with stale registry and log a complaint to `.planning/metrics/context-complaints.jsonl` (Phase 49 surface).

This is the soft drift detection. It does NOT block. Lock 13 binding: drift is informational, not a halt.

---

## 8. Self-Test Design (4 fixtures + 9 secondary = 13 assertions)

Mirror Phase 41 sec.7 (14 assertions), Phase 42 sec.7 (15 assertions), Phase 43 sec.10 (13 assertions). Settle on 13 to match Phase 43 (the closest analog: read-only walker + content-hash idempotency + closed-shape JSON schema).

### 8.1 Fixture summary

| F | Setup | Expected | Acceptance |
|---|-------|----------|-----------|
| F1 happy path | Fixture canonical sources (synthetic gates.yaml, agents.jsonl, etc.) in tmpdir; call `build(tmpdir)` | legal-keys.json valid against schema; all 8 categories populated; `_validateRegistry` returns true | A1 |
| F2 rebuild equivalence | F1 setup; build -> H1; delete legal-keys.json; rebuild -> H2 | H1 === H2 (modulo generated_at/by stripped) | **A3 BINDING (idempotency)** |
| F3 superseded representation | Seed canonical sources with synthetic superseded archive entry; call `build`; then `validateReferences({phases:["v1.9/41","v1.9-old/41","v9.9/99"]})` | `phases.superseded[]` includes `v1.9-old/41`; `validateReferences` returns `{valid:false, invalid_keys:[{key:"v1.9-old/41", reason:"superseded_key", suggested:"v1.9/41"},{key:"v9.9/99", reason:"unknown_key"}]}` | **A3 BINDING (visibility)** |
| F4 invalid references rejected | Synthetic packet referencing 5 invalid keys (1 unknown phase, 1 unknown gate, 1 typo agent, 1 superseded retired, 1 malformed) | `validateReferences` returns `valid:false`, `invalid_keys.length === 5`, each row has `category` + `reason` populated | **A2 BINDING** |

F1 -> A1; F2 -> A3 (idempotency); F3 -> A3 (visibility); F4 -> A2.

### 8.2 Secondary assertions (9)

| # | Assertion |
|---|-----------|
| 5 | `SCHEMA_VERSION === 1`; field is integer; registry is closed-shape; CATEGORIES frozen 10-entry array (`['milestones','phases','gates','agents','artifacts','providers','statuses','phase_folders','commands','reason_codes']`) |
| 6 | All arrays in registry sorted ascending by `.id` |
| 7 | `validateReferences` empty packet -> `{valid:true, invalid_keys:[], checked_count:0}` |
| 8 | `validateOne` 4 outcomes verified: active=>valid, superseded(replaced_by set)=>invalid+suggested, superseded(no replaced_by)=>invalid+retired_reason, unknown=>invalid+unknown_key |
| 9 | `loadRegistry` malformed legal-keys.json -> `{valid:false, invalid_keys:[{reason:"registry_malformed"}]}`; never throws |
| 10 | source_hashes contains sha256 (64 hex chars) for every canonical source; null for sources that were absent at build time |
| 11 | Read-only invariant: `--self-test` does not modify any file outside tmpdir; fingerprint guard over 13+ sources, before/after |
| 12 | `build` never throws upward; bad inputs return `{ok:false, reason:...}`; `check.cjs` mirrors |
| 13 | CLI exit codes: `--self-test` pass=0, fail=1; `--build` ok=0, source-missing=1, bad-invocation=2; `--check <file>` valid=0, invalid=0 (NOT 1; informational), registry-missing=1, bad-invocation=2 |

### 8.3 Fingerprint guard (Phase 41 sec.7.1 mirror)

```javascript
const realSources = [
  // 8 canonical registry/template/contract sources
  path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'agents.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'review-providers.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'command-envelope-v1.yaml'),
  path.resolve(__dirname, '..', '..', 'templates', 'command-envelope-v1.json'),
  path.resolve(__dirname, '..', 'phase-capsule', 'PHASE-CAPSULE.schema.json'),
  path.resolve(__dirname, '..', 'token-attribution', 'report.cjs'),
  path.resolve(__dirname, '..', 'token-waste', 'check.cjs'),
  // 1 jsonl + 8 phase-indices + 1 archive readme + 1 milestone REQUIREMENTS = 11
  path.resolve(__dirname, '..', '..', '..', '.planning', 'resource-registry', 'agents.jsonl'),
  ...['v1.2','v1.3','v1.4','v1.5','v1.6','v1.7','v1.8','v1.9'].map(ms =>
    path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', ms, 'PHASE-INDEX.jsonl')),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'archive', 'superseded',
    'v1.9-knowledge-memory-governance', 'README.md'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', 'v1.9', 'REQUIREMENTS.md'),
];
// Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 40 AUDIT-04 + Phase 41 sec.7.1 +
// Phase 42 lock-13 + Phase 43 AUDIT-04 lessons all applied.
```

19 sources fingerprinted at self-test entry/exit.

### 8.4 Test fixtures expected count

F1: 13 synthetic canonical sources (1 gates.yaml, 1 agents.yaml, 1 agents.jsonl, etc.) under tmpdir.
F2: same as F1 + delete-and-rebuild.
F3: F1 sources + 1 archive README YAML frontmatter row.
F4: F1 sources + handcrafted invalid packet referencing 5 known-bad keys.

Total: 4 fixture setups, 13 assertions, ~80-120 LOC self-test scaffold. Mirror Phase 43 size.

---

## 9. Cross-Phase Contract (Q11)

### 9.1 Phase 44 -> Phase 45 (PACKET-03) forward contract -- THE PRIMARY CONSUMER

REQUIREMENTS line 285: "Hard stop if context packet builder can invent or accept unknown phase/gate IDs." Phase 45 packet builder MUST call `check.cjs::validateReferences(packet)` BEFORE serializing the packet.

```typescript
import {
  validateReferences,
  loadRegistry,
  REASONS,
} from '../context-registry/check.cjs';

// In Phase 45 packet builder:
function buildPacketForRole(role, options) {
  const packet = composeFromCapsules(role, options);  // Phase 43 capsules + Phase 41 token data
  const validation = validateReferences(packet, {
    categoriesToCheck: ['phases', 'gates', 'agents', 'artifacts', 'providers'],
  });
  if (!validation.valid) {
    // Phase 45 PACKET-03 binding: log invalid_keys[] to context-complaints.jsonl
    appendContextComplaint({
      phase: '45',
      role,
      reason: 'invented_or_stale_references',
      invalid_keys: validation.invalid_keys,
      action: 'elide_or_warn',
    });
    // Phase 45 strategy per category:
    //   - phases: elide invalid entries from consumers list
    //   - gates: warn-and-keep (gates may be in flux)
    //   - agents: hard-reject (dispatching to invented agent fails)
    //   - artifacts: warn-and-keep
    packet = elideInvalidKeys(packet, validation.invalid_keys);
  }
  return packet;
}
```

Phase 45's PACKET-03 is the binding consumer. Phase 44 ships the `validateReferences` API; Phase 45 wires the call site.

### 9.2 Phase 44 -> Phase 49 (GOV-02) forward contract

Phase 49 memory write admission checks consume `loadRegistry()` to verify that promoted memory rules cite legal references:

```javascript
const { loadRegistry } = require('../context-registry/check.cjs');
const reg = loadRegistry();
const ruleRefs = parseReferencesFromRule(promotedRule);
for (const ref of ruleRefs) {
  if (!reg.phases.active.find(p => p.id === ref.phase_id)) {
    rejectMemoryWrite(promotedRule, `unknown_phase_id: ${ref.phase_id}`);
  }
}
```

### 9.3 Phase 44 -> Phase 50 (cockpit) forward contract

Phase 50 status-consistency check reads legal-keys.json to verify cockpit-displayed phase IDs / agent IDs / gate IDs all resolve. This is the REG-04 "wire validator into ... at least one cockpit or status-consistency path" binding -- Phase 50 cockpit is the second consumer beyond Phase 45.

### 9.4 Phase 44 -> Phase 51 (BENCH-05) forward contract

ROADMAP sec.51 acceptance: "failure fixtures cover missing capsule, **stale registry**, **invalid phase ID**, deleted SQLite DB, ..."

Phase 51 benchmark MUST include 2 failure injections:
1. **Stale registry:** modify a canonical source (e.g., delete a gate from gates.yaml), but DON'T rebuild legal-keys.json. Verify check.cjs surfaces `stale_warning:true`.
2. **Invalid phase ID:** synthetic packet with `"v9.9/99"` phase reference. Verify validateReferences emits `invalid_keys[{key:"v9.9/99", reason:"unknown_key"}]`.

Phase 44 self-test F3+F4 already cover both at the unit level; Phase 51 covers the integration level.

### 9.5 Retroactive Phase 43 capsule validation (out of scope for Phase 44; deferred to Phase 45)

Phase 43 wrote 44 PHASE-CAPSULE.json files with `downstream_contract.consumers[]` carrying free-form strings. Phase 44 does NOT retroactively validate these capsules; Phase 45 packet builder validates capsule references at packet construction time (lazy validation).

If operator wants eager validation, a `--validate-all-capsules` mode of check.cjs CAN walk every capsule and emit invalid_keys. This is OPTIONAL for Phase 44; the 4 self-test fixtures + Phase 45 wiring are the binding work.

---

## 10. Hard Stop Conditions

Halt is reserved for `SGSD-HANDOVER.md:79-86`:

1. credentials required (not Phase 44)
2. destructive operation outside repo (not Phase 44)
3. privacy/security judgment required (not Phase 44)
4. filesystem/runtime cannot continue (not Phase 44; missing source -> graceful `{ok:false}` return)

**Phase 44 NEVER does:**
- emit envelope status `blocked`
- exit non-zero on `valid:false` (CLI exit 0 except on self-test failure or bad invocation)
- write to `crit-backlog.jsonl`
- modify any canonical source (gates.yaml, agents.jsonl, etc.)
- ask the operator for confirmation
- block packet build on invalid_keys (Phase 45 owns the elide/warn/reject decision)
- throw upward from any public API (`build`, `validateReferences`, `validateOne`, `isLegal`, `loadRegistry`)

**Phase 44 ALWAYS does on invalid keys:**
- return `{valid:false, invalid_keys:[...]}` from `check.cjs`
- include category, reason, and (where applicable) suggested replacement
- continue execution; never halt

**Phase 44 ALWAYS does on source missing:**
- return `{ok:false, reason:"source_missing", missing:[...]}` from `build.cjs`
- log to stderr (informational); never throw
- preserve previous legal-keys.json (no overwrite on failure)

This is design lock 13's mechanical embodiment for Phase 44 specifically.

REQUIREMENTS line 285 "Hard stop if context packet builder can invent or accept unknown phase/gate IDs" is binding on Phase 45 (the packet builder), NOT on Phase 44 (the validator). Phase 44 supplies the mechanism; Phase 45 enforces the contract.

---

## 11. Open Derivation Calls -- LOCKED

| Q | Status | Lock |
|---|--------|------|
| Q1 schema shape | LOCKED | 10 top-level keys: `schema_version`, `registry_version`, `generated_at`, `generated_by`, `source_hashes`, + 8 categories (milestones, phases, gates, agents, artifacts, providers, statuses, phase_folders) + 2 derived (commands, reason_codes); per-category `{active, superseded}` shape with `{id, ...metadata}` rows |
| Q2 build vs check separation | LOCKED | TWO public modules: `build.cjs` (canonical-source walker, owns legal-keys.json write); `check.cjs` (read-only validator, imports `build.cjs::loadRegistry`); different entrypoints, different responsibilities |
| Q3 stale/superseded handling | LOCKED | Per-category `{active:[], superseded:[{id, superseded_at, replaced_by, reason, evidence_path}]}`; A3 binding: F2 (rebuild equivalence) + F3 (visibility on validateReferences); 4 reason codes for invalid keys: unknown_key, superseded_key (with suggested), superseded_key_retired, malformed_key |
| Q4 ID format | LOCKED | phase IDs `<milestone>/<phase>` (e.g., `"v1.9/41"`); gate IDs verbatim from gates.yaml `name`; agent IDs verbatim from agents.jsonl `id`; provider IDs from Phase 41 PROVIDERS const; status per-vocab subkey |
| Q5 validation API | LOCKED | `validateReferences(packet, opts)` walks packet recursively, returns `{valid, invalid_keys[], checked_count}`; `validateOne(key, category)` for single-key lookup; `isLegal(key, category)` boolean shorthand; all NEVER throw |
| Q6 build sources | LOCKED | 13 canonical sources mapped to category contributions; gates.yaml->gates; agents.yaml+agents.jsonl->agents; review-providers.yaml->providers; command-envelope-v1.{yaml,json}->commands+reason_codes+envelope_status; PHASE-CAPSULE.schema.json->capsule_status+artifacts; PHASE-INDEX.jsonl x 8->phases+milestones; phase-folder glob->phase_folders; archive README->milestones.superseded; Phase 41/42 .cjs imports->providers+commands |
| Q7 idempotency + read-only | LOCKED | content_hash strips generated_at/by, includes source_hashes; F2 binding test; fingerprint guard over 19 sources; mirror Phase 43 sec.5.2 verbatim |
| Q8 no-throw contract | LOCKED | All public APIs return `{ok|valid:false, reason}` shapes on failure; CLI exit 0 for informational invalid; exit 1 for self-test failure or registry missing; exit 2 for bad invocation; mirror Phase 41/42/43 |
| Q9 Phase 45 contract | LOCKED | `validateReferences(packet)` is THE Phase 45 admission boundary; Phase 45 wires call BEFORE packet serialization; per-category elide/warn/reject policy is Phase 45's decision; Phase 44 only supplies mechanism |
| Q10 self-test design | LOCKED | 4 named fixtures (F1 happy, F2 rebuild equivalence, F3 superseded visibility, F4 invalid rejected) + 9 secondary = 13 assertions; mirror Phase 43 size |
| Q11 cross-phase integration | LOCKED | 4 downstream consumers: Phase 45 PACKET-03 (primary), Phase 49 GOV-02, Phase 50 cockpit (REG-04 second wire-in), Phase 51 BENCH-05; Phase 44 retroactive capsule validation is OPTIONAL `--validate-all-capsules` mode, not in critical path |

**Status: zero open derivations. Phase 44 is plan-ready.**

---

## 12. Single Plan Recommendation

### 12.1 File count

| Path | Status | Lines |
|------|--------|------:|
| `super-gsd/tools/context-registry/build.cjs` | NEW | ~550 |
| `super-gsd/tools/context-registry/check.cjs` | NEW | ~250 |
| `super-gsd/tools/context-registry/legal-keys.json` | NEW (generated; ~600-1000 LOC depending on sort) | grows with milestones |
| `super-gsd/tools/context-registry/build.test.cjs` | NEW | ~180 |

**Hand-written total: ~980 lines** (build + check + test). Generated artifact ~700 LOC initial.

### 12.2 Plan task structure (single 44-01-PLAN.md)

```text
T1.  Skeleton: frozen consts (SCHEMA_VERSION, REGISTRY_VERSION, CATEGORIES,
     STATUS_KIND) + helper imports (path, fs, crypto, yaml via vendored
     plan-schema/node_modules/js-yaml)
T2.  Source readers (mirror system-map/generate.cjs:262-330):
       _readGates(), _readAgentsYaml(), _readAgentsJsonl(),
       _readReviewProviders(), _readEnvelopeRegistry(), _readCapsuleSchema(),
       _readPhase41Const(), _readPhase42Const(),
       _walkPhaseIndices(), _walkPhaseFolders(), _walkSupersededArchive(),
       _readMilestoneRequirements()
T3.  Mergers + de-duplicators:
       _mergeAgents(yaml, jsonl), _distinctMilestones(phases),
       _classifyPhaseFolders(allDirs)  // active vs malformed
T4.  Schema validators:
       _validateRegistry(obj)  // closed-shape check + per-category rules
       _registryContentHash(obj)  // canonical JSON, key-sorted, strip
                                   // generated_at/by
T5.  Public API for build.cjs:
       build(repoRoot, opts) -> result
       loadRegistry(legalKeysPath?) -> registryObj  (with mtime cache)
       registryPath() -> string
       resetCache()
T6.  Public API for check.cjs (separate file):
       validateReferences(packet, opts) -> { valid, invalid_keys[], checked_count, stale_warning?, stale_sources? }
       validateOne(key, category) -> { valid, reason?, superseded_record?, suggested? }
       isLegal(key, category) -> bool
       loadRegistry (re-export from build.cjs)
T7.  CLI argv (build.cjs):
       --self-test
       --build [--out-path <p>] [--dry-run]
       --check <packet.json>  (delegates to check.cjs)
       --help
T8.  Self-test scaffold: 4 fixtures + 9 secondary = 13 assertions +
     __dirname fingerprint guard over 19 sources
T9.  Run --build against live repo; verify legal-keys.json:
       counts: ~9 milestones, ~50 phases, 13 gates, ~23 agents,
               4 providers, 36+ reason_codes
T10. Run --self-test; verify 13/13 pass; verify F2 hash equality;
     verify F3 superseded visibility; verify F4 invalid rejection
T11. Verifier acceptance: REG-01..05 + ROADMAP sec.44 A1-A3 green
```

T1-T8 mechanical (no LLM judgment). T9-T11 integration tests.

### 12.3 Risks (with mitigations)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Build silently misses a canonical source | Critical | T8 assertion 10 verifies source_hashes contains every expected source; missing source -> sha256 = null + log |
| Legal-keys.json non-deterministic across rebuilds | Critical (A3 binding) | T4 _registryContentHash strips generated_at/by; sortKeys + sortArrays; F2 test asserts H1===H2 |
| validateReferences false positive on legal key | High | T8 assertion 7 (empty packet -> valid); F1 happy-path packet round-trips |
| validateReferences false negative (accepts unknown key) | Critical (A2 binding) | F4 fixture asserts 5 unknown keys all rejected |
| Stale archive README missed | Medium | _walkSupersededArchive globs `.planning/archive/superseded/*/README.md`; missing -> empty superseded[] (graceful) |
| Phase 41 P41 audit example "v1.9/P41" form vs registry "v1.9/41" form | High | LOCK Q4: registry uses "v1.9/41" (no "P" prefix); Phase 45 packet builder strips "P" prefix in user input before validation |
| Self-test pollutes canonical legal-keys.json | Critical | Assertion 11 fingerprints 19 sources; tmpdir-only writes |
| Build never finishes (deep recursion in walkPhaseFolders) | Low | Glob is shallow (1 dir level under phases/); time-bounded; mirror Phase 40 audit:351-395 |
| Mass-discuss row 44 lock drift | Low (locked) | LOCK Q11 cites mass-discuss line 239 verbatim; checker MUST flag any deviation |
| Phase 45 wires `validateOne` instead of `validateReferences` | Medium | Both APIs exposed; both have F-fixture coverage; Phase 45 packet builder docs cite `validateReferences` as primary |
| Future milestone adds new gate / agent without rebuilding registry | Medium | T1 stale-registry detection (sec.7.4); validateReferences emits `stale_warning:true` |
| `--validate-all-capsules` mode tempts feature creep | Low | Documented as OPTIONAL in Q11 LOCK; not in critical-path plan tasks |
| Phase 41/42 const imports re-circular | Medium | check.cjs imports report.cjs via require(); already a one-way dependency (Phase 41 doesn't import Phase 44) |
| jsonl/yaml format drift breaks build | Medium | Source-hash guard surfaces it; build returns `{ok:false, reason:"source_malformed"}` rather than corrupt registry |

### 12.4 Pattern summary

Phase 44 establishes the **legal-references contract level** -- the 7th SGSD contract level (after code-reviewer-v1, review-providers-v1, handover-contract-v2, plan-schema-v2, command-envelope-v1, phase-capsule-v1):

```text
canonical writer:    super-gsd/scripts/lib/*-log.cjs       (Phase 32, 34, 36, 41)
canonical reporter:  super-gsd/tools/<stream>/report.cjs   (Phase 41)
canonical checker:   super-gsd/tools/<gate>/check.cjs      (Phase 42, Phase 44 second module)
canonical auditor:   super-gsd/tools/<aspect>/audit.cjs    (Phase 40)
canonical writer:    super-gsd/tools/phase-capsule/write.cjs (Phase 43)
canonical builder:   super-gsd/tools/<registry>/build.cjs  (Phase 35 system-map, Phase 44 NEW)
```

Phase 35 system-map already established the canonical-source walker pattern; Phase 44 is `system-map`'s sibling for legal-key references vs. system-shape catalog. Both walk the same canonical sources but project different shapes.

A focused executor with `system-map/generate.cjs` + `phase-capsule/write.cjs` + `token-waste/check.cjs` in context can produce both build.cjs and check.cjs in ONE plan.

### 12.5 Estimated effort

Single executor dispatch. Mirror discipline: walker structure + source-hash + content-hash + closed-enum reasons + frozen consts + envelope-pattern self-test + __dirname fingerprint guard. Novel work: 13-source merger, supersession shape, validateReferences recursive walk, stale-warning detection.

T1-T8 + schema ~800 LOC in one pass. T9 build = `--build` ~5s; verify counts. T10 self-test = 13/13 pass. T11 verifier = closed-enum reasons + binding F2/F3/F4 tests.

---

## Sources

### Primary (HIGH confidence)

- `.planning/milestones/v1.9/REQUIREMENTS.md:39-49` (design locks 4, 6 verbatim)
- `.planning/milestones/v1.9/REQUIREMENTS.md:67-68` (design lock 13 verbatim)
- `.planning/milestones/v1.9/REQUIREMENTS.md:121-130` (REG-01..05 verbatim)
- `.planning/milestones/v1.9/REQUIREMENTS.md:280-291` (kill/defer + hard-stops)
- `.planning/milestones/v1.9/ROADMAP.md:114-129` (Phase 44 deliverables + acceptance)
- `.planning/milestones/v1.9/SGSD-HANDOVER.md:79-101` (4 hard-stops + Implementation Rules)
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:21-60`, `124-144` (existing surfaces / no-duplicate)
- `.planning/discussions/2026-04-26-mass-discuss.md:239` (mass-discuss row 44 locked decision: "Reject invented references at packet boundary")
- `.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-RESEARCH.md` (mirror template; ROLES, PROVIDERS, STATUSES; envelope-v1 emitter pattern)
- `.planning/milestones/v1.9/phases/42-token-budget-admission/42-RESEARCH.md` (mirror template: VERDICTS, ROUTE_REASONS, BUDGETS; read-only check pattern; Lock 13 binding)
- `.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-RESEARCH.md` (mirror template: STATUS_VOCAB, BypassRef, content_hash idempotency, fingerprint guard)
- `.planning/archive/superseded/v1.9-knowledge-memory-governance/README.md` (concrete superseded fixture for A3 binding test)
- `.planning/milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json` (canonical capsule format -- consumers list shape)
- `.planning/milestones/v1.9/phases/44-legal-context-registry/44-CONTEXT.md` (phase context + dependency map)
- `super-gsd/registry/gates.yaml:33-282` (13 active gates; canonical gate IDs verbatim)
- `super-gsd/registry/agents.yaml:42-219` (8 agents with category C metadata)
- `super-gsd/registry/review-providers.yaml:42-59` (2 providers: claude-sonnet-reviewer, codex-cli-reviewer)
- `super-gsd/registry/command-envelope-v1.yaml:22-93` (7 emitters), `:100-232` (36 reason_codes incl. 5 future_v1_9)
- `super-gsd/templates/command-envelope-v1.json:24-27` (6 envelope statuses)
- `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json:32-35` (5 capsule statuses)
- `super-gsd/tools/system-map/generate.cjs:1-330` (canonical-source walker template, stableStringify, _readAgents/_readGates/_readProviders pattern)
- `super-gsd/scripts/lib/gates-registry.cjs:1-120` (yaml.load via vendored plan-schema/node_modules/js-yaml; cache-singleton pattern)
- `super-gsd/scripts/lib/gate-value-log.cjs:344-545` (self-test scaffold mirror)
- `super-gsd/tools/token-waste/check.cjs:1-100` (read-only check pattern + envelope-v1 row + frozen consts)
- `super-gsd/tools/token-attribution/report.cjs:73-100` (frozen consts to import: ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS)
- `.planning/resource-registry/agents.jsonl` (23 agents; status:active filter; ID enumeration)
- `.planning/milestones/*/PHASE-INDEX.jsonl` (44 capsule index rows across 8 milestone files; verified `wc -l` output)
- Direct filesystem: `node -e "..."` for milestone/phase counts (verified 9 milestones, 50 phase folders, 1 malformed)
- Direct schema: `grep -c '^  - name:' super-gsd/registry/gates.yaml` (13)
- Direct schema: `grep -c '^      - code:' super-gsd/registry/command-envelope-v1.yaml` (36)
- Direct schema: `grep '"id":' .planning/resource-registry/agents.jsonl | sort -u` (23 distinct IDs)

### Secondary (MEDIUM confidence)

None. Every claim anchored to file:line ref or verified shell command. All locks (Q1-Q11) cite primary sources.

### Tertiary (LOW confidence)

- ~600-1000 LOC for generated legal-keys.json -- estimate based on counts above; actual size depends on JSON pretty-print indent; mitigation is N/A (size is informational, not load-bearing).

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Schema design (10 keys, 8 categories) | HIGH | Each category anchored to a verified canonical source + downstream consumer; mass-discuss row 44 + REQUIREMENTS line 285 are the binding rules |
| Build sources (13 canonical sources) | HIGH | All 13 verified by direct filesystem inspection + grep + wc-l counts |
| Stale/superseded representation | HIGH | F2+F3 binding tests; concrete superseded archive entry verified at .planning/archive/superseded/v1.9-knowledge-memory-governance/README.md |
| Build + Check API | HIGH | Mirrors Phase 35 system-map/generate.cjs + Phase 42 token-waste/check.cjs verbatim; no novel surface |
| ID format (Q4) | HIGH | gates.yaml mixed-case verified; agents.jsonl kebab verified; phase format `<milestone>/<phase>` matches PHASE-INDEX shape |
| Validation API (validateReferences) | HIGH | 4 outcomes per sec.5.4; F1-F4 cover all paths; recursive walk pattern proven in Phase 35 stableStringify |
| Idempotency + read-only | HIGH | content_hash mirrors Phase 43 verbatim; fingerprint guard mirrors Phase 41/42/43; A3 binding test |
| No-throw contract | HIGH | Mirrors Phase 41 "never throws upward" verbatim; CLI exit 0/1/2 mirrors Phase 42 |
| Cross-phase contract (Phase 45/49/50/51) | HIGH | Phase 45 PACKET-03 wiring locked; Phase 50 status-consistency is REG-04 second wire-in; Phase 51 BENCH-05 enumerated in ROADMAP |
| Self-test design (13 assertions) | HIGH | 4 fixtures map 1:1 to 4 acceptance criteria (A1, A2, A3 idempotency, A3 visibility); 9 secondary mirror Phase 41/42/43 |
| Tool location | HIGH | REQUIREMENTS:121-124 verbatim |

---

## Project Constraints (from CLAUDE.md / SGSD design locks)

- Permissions: never ask for confirmation; auto mode owns dispatch.
- Commit discipline: `feat(44-01): {one-liner}`; commit after every unit; stage specific files by name.
- Mirror Phase 35 system-map walker + Phase 41 emitter consts + Phase 42 read-only check + Phase 43 content-hash idempotency 1:1 where applicable.
- Atomic writes: `fs.writeFileSync` for legal-keys.json (overwrite-on-rebuild via tmpfile-rename).
- Stderr-only error logging; both build and check tools never throw upward (Lock 13).
- ASCII-only RESEARCH.md (verified -- 0 non-ASCII bytes target).
- Redis NOT canonical (lock 1); `.planning` JSONL + git remain source of truth (lock 2); legal-keys.json is a PROJECTION (lock 3 + mass-discuss row 44).
- **Reject invented references at packet boundary** -- mass-discuss row 44, the controlling correctness rule.
- Critical bypass (lock 6): provider IDs (`claude`, `codex`, `local-script`, `vtp`) are critical-bypass-relevant; MUST appear in registry verbatim from Phase 41 PROVIDERS const.
- Autonomy continues (lock 13): invalid keys are informational; `validateReferences` returns `{valid:false, invalid_keys}`, never halts; CLI exit 0 on informational invalid; exit 1 only for self-test or registry-missing failure.
- Hard stop (REQUIREMENTS:285): "Hard stop if context packet builder can invent or accept unknown phase/gate IDs" is binding on Phase 45 (packet builder), NOT on Phase 44 (validator). Phase 44 supplies mechanism; Phase 45 enforces contract.
- Token spend logged by role/phase/provider/model (lock 8; Phase 41 IMPLEMENTS, Phase 42 GOVERNS, Phase 44 PROVIDES legal vocab).
- Schema-without-consumer rule (Phase 36 + Phase 43): every category in legal-keys.json has at least one validated downstream consumer (Phase 45 PACKET-03 + Phase 50 cockpit + Phase 49 GOV-02 + Phase 51 BENCH-05).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 45 PACKET-03 will accept `validateReferences(packet, opts)` as the binding admission API verbatim | sec.9.1 | If Phase 45 needs additional fields (e.g., `categoriesToCheck`), they're already in opts; backward-compat path locked at Q5 LOCK |
| A2 | Phase 50 cockpit will adopt `loadRegistry()` for status-consistency rendering | sec.9.3 | If Phase 50 doesn't wire it, REG-04 is satisfied by Phase 45 alone; not a blocker for Phase 44 acceptance |
| A3 | `.planning/archive/superseded/` is the canonical archive root; future supersessions follow same `<milestone>/README.md` pattern with YAML frontmatter | sec.5.3 | If archive root differs, build.cjs `_walkSupersededArchive` glob needs reconfig; covered by SOURCES_LIST opts override |
| A4 | gates.yaml mixed-case names (e.g., `per-dispatch-ATC`, `MUDA-waste-audit`) are the canonical IDs and Phase 45 packets reference them in same form | sec.3.5, sec.3.6 | If callers normalize to lowercase, validateOne returns `unknown_key`; mitigation is documented case-sensitivity in Phase 45 contract |
| A5 | `phase_folders.malformed[]` is informational only; no consumer rejects on malformed dirs | sec.3.6, sec.5.3 | If a future consumer needs to halt on malformed, add a `strict:true` opt to validateReferences; deferred to Phase 49+ |
| A6 | Vendored js-yaml under `super-gsd/tools/plan-schema/node_modules/js-yaml` is available and version-stable across SGSD invocations | sec.6.1, sec.7.3 | If vendoring breaks, build.cjs returns `{ok:false, reason:"yaml_lib_unavailable"}`; mirror gates-registry.cjs:38-44 fallback pattern |
| A7 | Phase 41 PROVIDERS const (4 entries) is THE canonical provider enum; review-providers.yaml provider names (claude-sonnet-reviewer, codex-cli-reviewer) are ALIASES routed via Phase 41 PROVIDERS | sec.3.5, sec.4.1 | If providers diverge, registry exposes both: `providers.active` (Phase 41 verbatim) + `providers.review_aliases` (review-providers.yaml); deferred unless ambiguity surfaces in Phase 45 wiring |

All other claims VERIFIED via direct file inspection or CITED from REQUIREMENTS / ROADMAP / SGSD-HANDOVER / Phase 41/42/43 RESEARCH / mass-discuss / archive README.

---

## Metadata

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; stable -- canonical sources locked at v1.9, mass-discuss row 44 binding rule, schema design has zero open derivations, four upstream phases (41/42/43) just shipped with locked enum exports)

**Confidence breakdown:**
- Standard stack: HIGH (template = Phase 35 system-map walker + Phase 41 frozen-const emitter + Phase 42 read-only check + Phase 43 content-hash idempotency; all v1.7-v1.9 in-tree)
- Architecture: HIGH (legal-references contract = 7th SGSD contract level; mass-discuss row 44 + REQUIREMENTS line 285 are binding rules; Phase 41 PROVIDERS / Phase 42 VERDICTS / Phase 43 STATUS_VOCAB are all upstream sources)
- Pitfalls: HIGH (Phase 32 W3 + Phase 35 W1/W2 + Phase 36 W2 + Phase 39 W3 + Phase 40 AUDIT-04 + Phase 41 sec.7.1 + Phase 42 lock-13 + Phase 43 AUDIT-04 lessons applied)
- Hash + idempotency: HIGH (canonical JSON serialization + key-sorted array + strip operational metadata; F2 binding self-test catches non-determinism; mirror Phase 43 sec.5.2 verbatim)
- Stale/superseded representation: HIGH (concrete superseded archive entry verified; F3 binding self-test enforces visibility; per-category `{active, superseded}` shape forward-stable)
- Build sources: HIGH (13 canonical sources verified by direct ls/grep/wc; counts cross-checked: 13 gates, 23 agents, 36 reason_codes, 6 envelope statuses, 5 capsule statuses, 50 phase folders, 9 milestones, 1 superseded)
- Cross-phase contracts (Phase 45/49/50/51): HIGH (Phase 45 PACKET-03 is primary consumer; Phase 50 cockpit is REG-04 second wire-in; Phase 51 BENCH-05 enumerates stale-registry + invalid-phase-ID failure injections)

**Single recommendation locked:** ONE plan, TWO modules under `super-gsd/tools/context-registry/` (`build.cjs` ~550 LOC + `check.cjs` ~250 LOC), ONE generated artifact (legal-keys.json ~600-1000 LOC), ONE test file (~180 LOC), THREE public APIs in build.cjs (`build`, `loadRegistry`, `registryPath`), FIVE public APIs in check.cjs (`validateReferences`, `validateOne`, `isLegal`, `loadRegistry`, `registryPath`), THIRTEEN self-test assertions (4 named fixtures binding A1+A2+A3-idempotency+A3-visibility + 9 secondary), TEN top-level registry keys (5 metadata + 8 categories + 2 derived: commands, reason_codes), THIRTEEN canonical sources walked, EIGHTEEN PROVIDERS verbatim from Phase 41 (4), STATUSES x 3 vocabs (envelope 6, capsule 5, agent 4 = 15), GATES (13 from gates.yaml verbatim), AGENTS (~23 from agents.jsonl status:active union with agents.yaml metadata). Mirror Phase 35 walker + Phase 41/42 const-import + Phase 43 content-hash. SEVENTH SGSD contract level (legal-references). NO new architectural surface. Phase 45 forward contract locked: `validateReferences(packet)` is the admission boundary. Total ~980 lines hand-written + ~700 LOC generated registry.
