---
plan_id: 44-01
phase: 44
title: Legal Context Registry
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [REG-01, REG-02, REG-03, REG-04, REG-05]
locked_decisions: [4, 6, 13]
depends_on: [41, 42, 43]
created: 2026-04-27
tags: [context-registry, legal-keys, packet-admission-boundary, lock-4, lock-6, lock-13, sgsd-research]
files_modified:
  - super-gsd/tools/context-registry/build.cjs
  - super-gsd/tools/context-registry/check.cjs
  - super-gsd/tools/context-registry/build.test.cjs
  - super-gsd/tools/context-registry/legal-keys.json
  - .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md
autonomous: true
wave: 1
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/tools/context-registry/build.cjs
      - super-gsd/tools/context-registry/check.cjs
      - super-gsd/tools/context-registry/build.test.cjs
    hypothesis: "A canonical-source walker (build.cjs ~550 LOC) + read-only validator (check.cjs ~250 LOC) + 13-assertion self-test (~180 LOC) produces a deterministic legal-keys.json projection across 13 canonical sources with 4 distinct outcomes for reference validation (active=valid, superseded-with-replacement=invalid+suggested, superseded-retired=invalid+retired, unknown=invalid+unknown_key); both modules wrap every public API in try/catch and never throw upward (Lock 13 mirror)."
    falsifier: "Self-test F2 (rebuild equivalence) yields H1 != H2 OR self-test F3 (superseded visibility) does not distinguish replaced-with-suggestion from retired OR self-test F4 (invalid rejection) accepts any of 5 invented keys OR validateReferences/validateOne/build throws upward on any input OR canonical-source fingerprint changes after --self-test (read-only invariant breached). Any one disqualifies the lib."
    stop_rule: "node super-gsd/tools/context-registry/build.cjs --self-test exits 0 with literal 'context-registry self-test: 13 pass, 0 fail'; F2 H1===H2 binding asserts (modulo generated_at + generated_by stripped); F3 binding asserts validateReferences distinguishes 4 outcomes per sec.5.4 of 44-RESEARCH.md; F4 binding asserts 5 invented keys all rejected with category + reason populated; build/check/validateReferences/validateOne/isLegal/loadRegistry all return shapes never throw; __dirname-anchored fingerprint guard over 19 sources reports byte-equivalent before/after."
    minimal_test: "node super-gsd/tools/context-registry/build.cjs --self-test -> exit 0 with literal 'context-registry self-test: 13 pass, 0 fail'."
  - id: T2
    type: backfill
    files_touched:
      - super-gsd/tools/context-registry/legal-keys.json
    hypothesis: "Running --build against the live repo walks 13 canonical sources (gates.yaml, agents.yaml, agents.jsonl, review-providers.yaml, command-envelope-v1.yaml, command-envelope-v1.json, PHASE-CAPSULE.schema.json, Phase 41 report.cjs, Phase 42 check.cjs, 8 PHASE-INDEX.jsonl files, archive README, milestone REQUIREMENTS.md frontmatter) + filesystem phase-folder glob and emits legal-keys.json with 10 top-level keys (5 metadata + 8 categories + 2 derived) covering ~9 milestones, ~50 phase folders, 13 gates, ~23 agents, 4 providers, 36 reason_codes, 6 envelope statuses, 5 capsule statuses, 4 agent statuses, 1 superseded milestone, 5 superseded phases, 1 malformed phase folder; second run produces byte-equivalent content_hash."
    falsifier: "Generated legal-keys.json fails _validateRegistry (closed-shape check) OR any expected count is off (e.g., gates !== 13, agents < 8, providers !== 4, reason_codes < 30, envelope_statuses !== 6, capsule_statuses !== 5, milestones < 8) OR any of the 13 canonical sources is byte-modified by the build (read-only invariant breached) OR re-running --build produces a different content_hash."
    stop_rule: "super-gsd/tools/context-registry/legal-keys.json exists; _validateRegistry returns true; counts table green: milestones.active >= 8, phases.active >= 40, gates.active === 13, agents.active >= 8, providers.active === 4, statuses.envelope === 6, statuses.capsule === 5, statuses.agent === 4, reason_codes.active >= 30, phase_folders.active >= 40, milestones.superseded.length === 1 (v1.9-knowledge-memory-governance), phase_folders.malformed.length >= 1 (v1.3/p5-codex-monitor); idempotent rebuild (delete + rebuild) yields identical content_hash; git diff --quiet on 13 canonical sources after run."
    minimal_test: "node super-gsd/tools/context-registry/build.cjs --build && node super-gsd/tools/context-registry/build.cjs --build -> second run reports content_hash equality + 0 source mutations."
  - id: T3
    type: backfill-validation
    files_touched:
      - .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md
    hypothesis: "Running --check against every existing PHASE-CAPSULE.json (44 capsules across v1.6-v1.9) via validateReferences over capsule.downstream_contract.consumers + capsule.files[] yields a per-capsule invalid_keys[] report; report identifies which capsule consumers reference invented or stale phase IDs; report is informational only (Phase 45 owns the elide/warn/reject decision) and never halts; total run time < 10s; emits VERIFICATION.md table that maps each capsule to {valid:bool, invalid_count:N, sample_invalid_keys:[...]}."
    falsifier: "Validation throws on any malformed capsule (must return {valid:false,invalid_keys:[{reason:'malformed_key'}]} instead) OR validateReferences mutates any capsule (read-only invariant breached) OR run time exceeds 30s OR report omits any of the 44 capsules."
    stop_rule: "44-VERIFICATION.md exists with one row per backfilled capsule; each row carries {capsule_path, valid, invalid_count, sample_invalid_keys[<=3]}; aggregate summary present (total capsules / valid count / invalid count / total invalid_keys across all capsules); read-only diff on the 44 capsules + 4 PHASE-INDEX.jsonl is empty; CLI exits 0 regardless of invalid_count (Lock 13)."
    minimal_test: "node super-gsd/tools/context-registry/check.cjs --validate-all-capsules > .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md -> exit 0 + non-empty file."
must_haves:
  truths:
    - "SCHEMA_VERSION = 1 (integer, frozen, top-of-file const in build.cjs)"
    - "REGISTRY_VERSION = '1.0.0' (string, frozen, top-of-file const)"
    - "CATEGORIES = Object.freeze 10-entry array: ['milestones','phases','gates','agents','artifacts','providers','statuses','phase_folders','commands','reason_codes'] (closed enum; mass-discuss row 44 + ROADMAP A1 binding)"
    - "STATUS_KIND = Object.freeze 3-entry array: ['envelope','capsule','agent'] (statuses subkey vocab)"
    - "REASONS = Object.freeze 6-entry array in check.cjs: ['unknown_key','superseded_key','superseded_key_retired','malformed_key','registry_missing','registry_malformed'] (closed enum; sec.5.4 + sec.6.4 of 44-RESEARCH.md)"
    - "Phase 41 const imports BY REFERENCE: ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS, COMMAND_NAME, ENVELOPE_VERSION are require()'d from super-gsd/tools/token-attribution/report.cjs at module top; NEVER redefined; if Phase 41 surface is unavailable build returns {ok:false,reason:'phase41_import_failed'}"
    - "Phase 42 const imports BY REFERENCE: VERDICTS, ROUTE_REASONS are require()'d from super-gsd/tools/token-waste/check.cjs (informational; legal-keys.json includes Phase 42 verdicts under derived/commands category if needed); NEVER redefined"
    - "Public APIs of build.cjs (build, loadRegistry, registryPath, resetCache) wrap internals in try/catch and NEVER throw upward (Lock 13 mirror; Phase 41/42/43 contract verbatim)"
    - "Public APIs of check.cjs (validateReferences, validateOne, isLegal, loadRegistry, registryPath) wrap internals in try/catch and NEVER throw upward; isLegal returns false on any error (boolean shorthand)"
    - "validateReferences contract: (packet, opts?) -> {valid:bool, invalid_keys:[{key, category, reason, superseded_record?, suggested?}], checked_count:N, stale_warning?:bool, stale_sources?:[]}; default behavior walks known capsule-schema fields (downstream_contract.consumers, files[].path, outputs[].path, gates[].id); recursive walk for opts.deep:true"
    - "validateOne contract: (key, category, opts?) -> {valid:bool, reason?, superseded_record?, suggested?}; 4 outcomes per sec.5.4 of 44-RESEARCH.md: active=>{valid:true}, superseded-with-replacement=>{valid:false, reason:'superseded_key', superseded_record, suggested:replaced_by}, superseded-retired=>{valid:false, reason:'superseded_key_retired', superseded_record}, unknown=>{valid:false, reason:'unknown_key'}"
    - "isLegal contract: (key, category) -> bool; convenience wrapper around validateOne; returns false on any error; NEVER throws"
    - "_normalize + _assertRegistrySchema + _writeRegistryInternal trio enforces closed-shape JSON Schema + per-category {active,superseded} structure on every write; closed-enum violations raise inside _writeRegistryInternal but public build() catches and returns {ok:false,reason}"
    - "Read-only against ALL 13 canonical sources: super-gsd/registry/{gates,agents,review-providers,command-envelope-v1}.yaml + super-gsd/templates/command-envelope-v1.json + super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json + super-gsd/tools/token-attribution/report.cjs + super-gsd/tools/token-waste/check.cjs + .planning/resource-registry/agents.jsonl + .planning/milestones/v*/PHASE-INDEX.jsonl (8 files) + .planning/archive/superseded/v1.9-knowledge-memory-governance/README.md + .planning/milestones/v1.9/REQUIREMENTS.md (frontmatter only); ONLY owned writes: super-gsd/tools/context-registry/{build,check,build.test}.cjs + super-gsd/tools/context-registry/legal-keys.json + 44-VERIFICATION.md"
    - "__dirname-anchored 3-up walk to .planning for canonical-path defaults (Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 41 sec 7.1 + Phase 42 + Phase 43 sec 10.3 lessons applied verbatim) AND __dirname-anchored fingerprint guard over 19 sources at self-test entry/exit"
    - "_registryContentHash strips generated_at + generated_by, INCLUDES source_hashes (deterministic if sources unchanged), sorts top-level keys, recursively sorts nested object keys, sorts arrays of {id} ascending; result is sha256 hex64 of canonical JSON serialization (MIRROR Phase 43 _capsuleContentHash sec.5.2 verbatim)"
    - "_walkSupersededArchive globs .planning/archive/superseded/*/README.md, parses YAML frontmatter, surfaces 1 row {id:'v1.9-knowledge-memory-governance', superseded_at:'2026-04-27', replaced_by:'v1.9', reason:'Renumbered. Original Knowledge + Memory Governance plan superseded by SGSD-Research...', evidence_path:'.planning/archive/superseded/v1.9-knowledge-memory-governance/README.md'}; missing archive dir -> empty superseded[] (graceful, never throws)"
    - "_classifyPhaseFolders walks .planning/milestones/v*/phases/*/; matches NN-name regex (^\\d{2}-); active dirs go to phase_folders.active, malformed dirs (e.g., v1.3/p5-codex-monitor) go to phase_folders.malformed[] with reason; sorted ascending by id; mirrors Phase 40 phase-folder-audit/audit.cjs walker"
    - "_walkPhaseIndices reads each .planning/milestones/v*/PHASE-INDEX.jsonl line-by-line, JSON.parse each row, projects to {id:'<milestone>/<phase>', phase_name, status, milestone, phase}; missing PHASE-INDEX.jsonl on a milestone -> milestone has no phases.active rows (graceful)"
    - "_mergeAgents unions agents.yaml (8 entries with category + research_principles metadata) and .planning/resource-registry/agents.jsonl (23 entries with id + status:active filter) by .id; status='active' filter applied; deprecated/retired/draft go to agents.superseded[] when lifecycle_events present"
    - "Phase 41 P41 audit reference 'v1.9/P41' form is NORMALIZED on input: validateOne and validateReferences strip optional 'P' prefix from phase id before lookup (so 'v1.9/P41' and 'v1.9/41' both validate as active when '41' is in registry); registry stores canonical 'v1.9/41' form (no P prefix; lock Q4 of 44-RESEARCH.md)"
    - "Lock 4 binding (REQUIREMENTS:39): registry IS the role-specific packet's reference allowlist; Phase 45 PACKET-03 calls validateReferences(packet) BEFORE serializing packet; Phase 44 supplies mechanism, Phase 45 wires call site"
    - "Lock 6 binding (REQUIREMENTS:39-49): provider IDs ('claude','codex','local-script','vtp') appear VERBATIM in registry from Phase 41 PROVIDERS const; critical-bypass-relevant provider names are protected against rename"
    - "Lock 13 binding (REQUIREMENTS:67-68): invalid keys are INFORMATIONAL; validateReferences returns {valid:false,invalid_keys}, NEVER halts; CLI exit codes: --self-test pass=0/fail=1, --build ok=0/source-missing=1/bad-invocation=2, --check valid=0/invalid=0 (NOT 1; informational), registry-missing=1, bad-invocation=2 (mirror Phase 42 sec 8.5)"
    - "A1 binding (ROADMAP:127): registry includes all 8 named categories (milestones, phases, gates, agents, artifacts, providers, statuses, phase_folders) PLUS 2 derived categories (commands, reason_codes); F1 self-test fixture asserts each present and populated"
    - "A2 binding (ROADMAP:128): F4 self-test fixture seeds packet referencing 5 invented keys (1 unknown phase 'v9.9/99', 1 unknown gate 'sgsd-foo-bar', 1 typo agent 'sgsd-classifyer', 1 superseded retired 'v1.9-knowledge-memory-governance/41', 1 malformed 'p5-codex-monitor'); validateReferences returns valid:false + invalid_keys.length===5 + each row has category + reason populated; assertion 4 in self-test"
    - "A3 binding (ROADMAP:129): TWO self-test fixtures bind A3 -- F2 idempotency (build->H1; delete legal-keys.json; rebuild->H2; H1===H2 modulo generated_at/by stripped) AND F3 visibility (validateReferences on packet referencing 1 active + 1 superseded-with-replacement + 1 unknown returns {valid:false, invalid_keys:[{key:superseded, reason:'superseded_key', suggested:replaced_by},{key:unknown, reason:'unknown_key'}]}, active key NOT in invalid_keys)"
    - "Self-test 13 assertions: 4 named fixtures (F1 happy A1, F2 rebuild A3-idempotency, F3 superseded A3-visibility, F4 invalid A2) + 9 secondary covering schema closed-shape, sort order, empty packet, validateOne 4 outcomes, malformed legal-keys.json -> registry_malformed reason, source_hashes hex64, fingerprint invariant, never-throws, CLI exit codes (mirror Phase 43 sec.10 size; Phase 41 14 + Phase 42 15)"
    - "_registryContentHash F2 binding: build with synthetic canonical sources -> H1 = _registryContentHash(legal-keys.json); fs.unlinkSync legal-keys.json; rebuild -> H2 = _registryContentHash(legal-keys.json); assert H1 === H2; A3 binding regression"
    - "Forward contract for Phase 45 PACKET-03 (sec.9.1): validateReferences(packet, {categoriesToCheck:['phases','gates','agents','artifacts','providers']}) is the admission boundary; Phase 45 logs invalid_keys to context-complaints.jsonl + applies per-category elide/warn/reject policy; Phase 44 supplies mechanism only"
    - "Forward contract for Phase 49 GOV-02 (sec.9.2): loadRegistry() is consumed by memory write admission; promoted memory rules cite registry phase IDs / gate IDs / agent IDs; admission rejects rules with unknown_key references"
    - "Forward contract for Phase 50 cockpit (sec.9.3, REG-04 binding): status-consistency check reads legal-keys.json to verify cockpit-displayed phase / agent / gate IDs all resolve; Phase 50 is REG-04 second wire-in (Phase 45 is first)"
    - "Forward contract for Phase 51 BENCH-05 (sec.9.4): failure injection includes (a) stale registry (modify gates.yaml without rebuild -> validateReferences emits stale_warning:true) and (b) invalid phase ID ('v9.9/99' -> invalid_keys row with reason:'unknown_key'); Phase 44 self-test F3+F4 cover unit level, Phase 51 covers integration"
    - "Stale-registry detection: validateReferences loads legal-keys.json AND records its mtime; if any canonical source mtime > legal-keys.json mtime, validator emits stale_warning:true + stale_sources:[<paths>]; informational only, NEVER blocks (Lock 13)"
    - "PHASE-CAPSULE.schema.json status enum (5 values: PASS, PASS-WITH-DEFERRED-N, FAIL, UNKNOWN, IN_PROGRESS) is read DIRECTLY from the schema file's $.properties.status.enum or oneOf; never duplicated as a const in build.cjs"
    - "command-envelope-v1.json envelope_status enum (6 values: ok, warn, fail, skipped, timeout, blocked) is read DIRECTLY from the JSON template's $.properties.status.enum; never duplicated"
    - "command-envelope-v1.yaml emitter list (codex-exec, audit, sgsd-readiness-probe, sgsd-muda-audit, atc-review, edge-guard, handoff) + Phase 41 COMMAND_NAME ('logTokenSpend') + Phase 42 ('checkTokenWaste') + Phase 43 ('writeCapsule') unions to commands.active; commands NOT in the yaml but referenced by Phase 41/42/43 source const are MARKED with owner_phase metadata"
    - "command-envelope-v1.yaml reason_codes (36 codes) split into reason_codes.active (31 active) and reason_codes.future (5 marked status:future_v1_9); split derives from the yaml's `status: future_v1_9` field per row; mirror Phase 42 ROUTE_REASONS forward-stable contract"
    - "registry NEVER includes generated_at or generated_by in content_hash (mirror Phase 43 _capsuleContentHash fix sec.5.2 verbatim); rebuild equivalence regression test F2 binds this"
    - "Backfill output 44-VERIFICATION.md captures per-capsule validation result for ALL existing PHASE-CAPSULE.json files (44 capsules across v1.6/v1.7/v1.8/v1.9 milestones); informational only, never halts; Lock 13 binding"
    - "ASCII-only across build.cjs, check.cjs, build.test.cjs, legal-keys.json, 44-VERIFICATION.md (zero non-ASCII bytes target)"
    - "No external dependencies beyond pinned js-yaml at super-gsd/tools/plan-schema/node_modules/js-yaml (loaded via gates-registry.cjs:38-44 fallback pattern; never throws upward on poisoned config)"
    - "Atomic write to legal-keys.json via tmpfile-rename (fs.writeFileSync to <path>.tmp + fs.renameSync to <path>); preserves previous registry on partial failure; mirrors Phase 43 PHASE-INDEX.jsonl atomic-replace pattern"
    - "Phase 44 NEVER emits envelope status 'blocked'; NEVER writes to crit-backlog.jsonl; NEVER modifies any canonical source; NEVER asks operator confirmation; NEVER blocks packet build on invalid_keys (Phase 45 owns elide/warn/reject)"
  artifacts:
    - super-gsd/tools/context-registry/build.cjs (NEW; ~550 LOC; mirrors Phase 35 system-map walker + Phase 41 report.cjs frozen-const emitter + Phase 42 check.cjs read-only invariant + Phase 43 write.cjs content-hash idempotency)
    - super-gsd/tools/context-registry/check.cjs (NEW; ~250 LOC; read-only validator; imports build.cjs::loadRegistry; Phase 41 const imports by reference; mirrors Phase 42 token-waste/check.cjs surface)
    - super-gsd/tools/context-registry/build.test.cjs (NEW; ~180 LOC; 13 assertions = 4 fixtures F1-F4 + 9 secondary; __dirname fingerprint guard over 19 sources; tmpdir-only writes)
    - super-gsd/tools/context-registry/legal-keys.json (NEW; generated; ~700 LOC initial; 10 top-level keys; 5 metadata + 8 categories + 2 derived; per-category {active,superseded} shape; sorted; canonical JSON; rebuild-equivalent)
    - .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md (NEW; per-capsule validation report; 44 capsules + aggregate summary)
  key_links:
    - 44-CONTEXT.md (sparse stub goal; depends_on:[41]; unblocks:[45,49,51])
    - 44-RESEARCH.md (1054 lines; 11 LOCKED derivation calls; sec 1 acceptance mapping; sec 3 schema design; sec 4 build sources mapping; sec 5 stale/superseded representation; sec 6 build+check API; sec 7 idempotency+read-only invariant; sec 8 self-test design; sec 9 cross-phase contract; sec 10 hard stop conditions; sec 12 single-plan recommendation 11-task structure)
    - .planning/milestones/v1.9/REQUIREMENTS.md:39-49 (design lock 4 + 6 verbatim)
    - .planning/milestones/v1.9/REQUIREMENTS.md:67-68 (design lock 13 verbatim)
    - .planning/milestones/v1.9/REQUIREMENTS.md:121-130 (REG-01..05 verbatim)
    - .planning/milestones/v1.9/REQUIREMENTS.md:280-291 (kill/defer + hard-stops; "Hard stop if context packet builder can invent or accept unknown phase/gate IDs" -- binding on Phase 45, Phase 44 supplies mechanism)
    - .planning/milestones/v1.9/ROADMAP.md:114-129 (Phase 44 deliverables + acceptance A1/A2/A3)
    - .planning/discussions/2026-04-26-mass-discuss.md:239 (mass-discuss row 44 LOCKED decision: "Reject invented references at packet boundary")
    - super-gsd/tools/token-attribution/report.cjs (Phase 41; UPSTREAM IMPORT for ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS, COMMAND_NAME, ENVELOPE_VERSION; ~1017 LOC mirror surface)
    - super-gsd/tools/token-waste/check.cjs (Phase 42; ARCHITECTURAL MIRROR for never-throws-upward + closed-flag CLI parser + read-only invariant; UPSTREAM IMPORT for VERDICTS, ROUTE_REASONS by reference)
    - super-gsd/tools/phase-capsule/write.cjs (Phase 43; CONTENT-HASH IDEMPOTENCY MIRROR; _capsuleContentHash sec.5.2 verbatim pattern -> _registryContentHash; PHASE-CAPSULE.schema.json status enum SOURCE)
    - super-gsd/tools/system-map/generate.cjs (Phase 35; CANONICAL-SOURCE WALKER MIRROR; stableStringify, _readAgents/_readGates/_readProviders pattern, sortKeys + sortArrays)
    - super-gsd/scripts/lib/gates-registry.cjs (yaml.load via vendored plan-schema/node_modules/js-yaml; cache-singleton pattern :38-94)
    - super-gsd/scripts/lib/gate-value-log.cjs (envelope-v1 writer self-test scaffold mirror :344-545)
    - super-gsd/registry/gates.yaml (13 active gates; canonical gate IDs verbatim; line 33-282)
    - super-gsd/registry/agents.yaml (8 agents with category + research_principles metadata; line 42-219)
    - super-gsd/registry/review-providers.yaml (2 providers: claude-sonnet-reviewer, codex-cli-reviewer; line 42-59)
    - super-gsd/registry/command-envelope-v1.yaml (7 emitters line 22-93; 36 reason_codes line 100-232 incl. 5 future_v1_9)
    - super-gsd/templates/command-envelope-v1.json (6 envelope statuses :24-27)
    - super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json (5 capsule statuses :32-35)
    - .planning/resource-registry/agents.jsonl (23 agents; status:active filter; ID enumeration)
    - .planning/milestones/v*/PHASE-INDEX.jsonl (44 capsuled phases across 8 milestone files)
    - .planning/archive/superseded/v1.9-knowledge-memory-governance/README.md (concrete superseded fixture for A3 binding test)
    - super-gsd/templates/command-envelope-v1.json (envelope-v1 contract; legal-keys.json explicitly NOT envelope-v1; closed-shape registry contract level)
---

<objective>
Phase 44 ships SGSD's 7th canonical contract level: the **legal-references
contract** (legal-keys.json + check.cjs::validateReferences). The contract
breaks the failure mode where ambient context inheritance produces references
that LOOK real but don't resolve -- e.g., agents free-form generating "Phase 56"
or "gate sgsd-foo-bar" or "v1.9/P41" with the wrong P-prefix.

Controlling principle (mass-discuss row 44, line 239 verbatim):

> "Reject invented references at packet boundary."

Phase 44 IS the boundary mechanism. Phase 45 packet builder wires the call
site BEFORE serializing packets. Phase 44 supplies `validateReferences(packet)`;
Phase 45's PACKET-03 enforces the contract.

Lock 4 (REQUIREMENTS:39 verbatim):

> "Agents consume role-specific context packets, not raw milestone history."

The registry is THE role-specific packet's reference allowlist. Without
Phase 44, the packet builder cannot reject hallucinated keys.

Lock 13 (REQUIREMENTS:67-68 verbatim):

> "Autonomy continues; evidence tells the truth. Budget breaches degrade
>  or reroute by policy. They do not become silent overrun."

Mechanical embodiment: invalid-key detection NEVER halts auto-mode.
`check.cjs::validateReferences()` returns `{valid:false, invalid_keys:[...]}`;
orchestrator continues; packet builder elides invalid rows or flags them;
NEVER throws. CLI exit 0 on informational invalid; only self-test failure
or registry-missing exit 1; only bad invocation exit 2.

REQUIREMENTS line 285 hard-stop ("Hard stop if context packet builder can
invent or accept unknown phase/gate IDs") is binding on Phase 45 (the
packet builder), NOT on Phase 44. Phase 44 supplies the mechanism;
Phase 45 enforces the contract.

The registry is a PROJECTION. Canonical = code + config (gates.yaml +
agents.yaml/jsonl + review-providers.yaml + command-envelope-v1 +
PHASE-CAPSULE schema + Phase 41/42/43 frozen-const emitters + PHASE-INDEX
files + filesystem phase-folder glob + archive README + milestone
REQUIREMENTS frontmatter). Deleting legal-keys.json and rebuilding from
canonical sources MUST yield byte-equivalent content_hash (modulo
generated_at + generated_by stripped). A3 acceptance is the binding
regression test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.9/phases/44-legal-context-registry/44-CONTEXT.md
@.planning/milestones/v1.9/phases/44-legal-context-registry/44-RESEARCH.md
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@super-gsd/tools/token-attribution/report.cjs
@super-gsd/tools/token-waste/check.cjs
@super-gsd/tools/phase-capsule/write.cjs
@super-gsd/tools/system-map/generate.cjs
@super-gsd/scripts/lib/gates-registry.cjs
@super-gsd/registry/gates.yaml
@super-gsd/registry/agents.yaml
@super-gsd/registry/review-providers.yaml
@super-gsd/registry/command-envelope-v1.yaml
@super-gsd/templates/command-envelope-v1.json
@super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json
@.planning/resource-registry/agents.jsonl

<interfaces>
<!-- Frozen-const exports the executor MUST require() by reference; NEVER redefine. -->
<!-- Failure to require these by-reference is the #1 trap (Known Dead-End #1). -->

From super-gsd/tools/token-attribution/report.cjs (Phase 41):
```javascript
// Module exports (verified at report.cjs:73-100)
const ROLES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier',
  'reviewer', 'orchestrator', 'classifier', 'other',
]);  // 8 entries
const PROVIDERS = Object.freeze([
  'claude', 'codex', 'local-script', 'vtp',
]);  // 4 entries -- Lock 6 critical-bypass-relevant
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);  // 6 entries -- envelope-v1 status enum
const BLOAT_THRESHOLDS = Object.freeze({
  cache_read_ratio_high: 0.90,
  useful_findings_low: 15,
  files_read_high: 50,
  diff_lines_low: 100,
});  // 4 keys
const COMMAND_NAME = 'logTokenSpend';
const ENVELOPE_VERSION = 1;
module.exports = {
  appendTokenSpend, backfillFromMetrics, report, summarize, ledgerPath,
  ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS, COMMAND_NAME, ENVELOPE_VERSION,
};
```

From super-gsd/tools/token-waste/check.cjs (Phase 42):
```javascript
// Phase 41 imports by reference at top of module (check.cjs:84-91)
const {
  summarize, BLOAT_THRESHOLDS, ROLES, STATUSES, PROVIDERS, ledgerPath,
} = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
const VERDICTS = Object.freeze(['ok', 'warn', 'degraded', 'false_positive', 'error']);
const ROUTE_REASONS = Object.freeze({
  R1: 'researcher_local_script_candidate',
  R2: 'codex_reviewer_fallback_candidate',
  R3: 'executor_context_packet_candidate',
  R4: 'verifier_goal_backward_candidate',
  R5: 'orchestrator_turn_trim_candidate',
});
module.exports = { runCheck, renderTable, appendCheckRun, VERDICTS, ROUTE_REASONS, ... };
```

From super-gsd/tools/phase-capsule/write.cjs (Phase 43):
```javascript
const SCHEMA_VERSION = 1;
const STATUS_VOCAB = Object.freeze([
  'PASS', 'PASS-WITH-DEFERRED-N', 'FAIL', 'UNKNOWN', 'IN_PROGRESS',
]);  // 5 entries
const BYPASS_KIND_VOCAB = Object.freeze([
  'verifier_fail','edge_guard_miss','security_issue','privacy_issue',
  'destructive_op','provider_outage','stack_trace',
]);  // 7 entries
const CAPSULE_FILE_KINDS = Object.freeze([
  'context','research','plan','verification','atc_review',
]);  // 5 entries
// _capsuleContentHash strips created_at + created_by; sortKeys + sortArrays;
// sha256 hex64 of canonical JSON serialization. MIRROR THIS PATTERN.
module.exports = {
  writeCapsule, writeAllCapsulesForMilestone, readCapsule, capsulePath,
  backfillFromCanonical, SCHEMA_VERSION, STATUS_VOCAB, BYPASS_KIND_VOCAB, CAPSULE_FILE_KINDS,
};
```

From super-gsd/scripts/lib/gates-registry.cjs (yaml load fallback pattern):
```javascript
// :38-94 -- vendored js-yaml under super-gsd/tools/plan-schema/node_modules/js-yaml
let yaml;
try {
  yaml = require(path.join(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'));
} catch (e) {
  console.warn('[context-registry] js-yaml unavailable; build returning {ok:false}');
  yaml = null;
}
```

From super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json (Phase 43 contract):
```json
{
  "properties": {
    "status": {
      "enum": ["PASS", "PASS-WITH-DEFERRED-N", "FAIL", "UNKNOWN", "IN_PROGRESS"]
    }
  }
}
```
This is the SOURCE for `statuses.capsule` -- read DIRECTLY from $.properties.status.enum.

From super-gsd/templates/command-envelope-v1.json:
```json
{
  "properties": {
    "status": {
      "enum": ["ok", "warn", "fail", "skipped", "timeout", "blocked"]
    }
  }
}
```
This is the SOURCE for `statuses.envelope` -- read DIRECTLY from $.properties.status.enum.

From super-gsd/registry/gates.yaml (canonical 13 gates; verified `grep -c '^  - name:' = 13`):
```yaml
gates:
  - name: per-dispatch-ATC
    category: code-quality
    enforcement_mode: hard-halt
    state: active
  - name: phase-level-ATC
  - name: MUDA-waste-audit
  ... (10 more)
```
Gate IDs are MIXED-CASE verbatim from `name` field. NEVER re-case.

From super-gsd/registry/command-envelope-v1.yaml (7 emitters + 36 reason_codes):
```yaml
emitters:
  - name: codex-exec
  - name: audit
  - name: sgsd-readiness-probe
  - name: sgsd-muda-audit
  - name: atc-review
  - name: edge-guard
  - name: handoff
reason_codes:
  - code: codex_timeout
    group: provider_runtime
  - code: empty_hit
    group: retrieval
    status: future_v1_9     # split marker -> reason_codes.future
  ... (33 more)
```
Reason codes with `status: future_v1_9` go to `reason_codes.future[]`; rest go to `reason_codes.active[]`.

From .planning/resource-registry/agents.jsonl (23 active agents; verified `wc -l` = 23):
```jsonl
{"id":"sgsd-classifier","model":"haiku","status":"active","category":null}
{"id":"sgsd-exec-backend","model":"sonnet","status":"active","category":"C"}
... (21 more)
```
Agent IDs are KEBAB-CASE verbatim from `id` field. Status filter: `status === 'active'`.

From super-gsd/registry/review-providers.yaml (2 providers):
```yaml
providers:
  - name: claude-sonnet-reviewer
  - name: codex-cli-reviewer
```
NOTE: review-providers.yaml provider names are ALIASES; canonical `providers.active`
enum is the Phase 41 PROVIDERS const (4 entries: claude, codex, local-script, vtp).
review-providers.yaml may be exposed as `providers.review_aliases[]` if Phase 45
ambiguity surfaces (Assumption A7 in 44-RESEARCH.md sec 12.3).

From .planning/archive/superseded/v1.9-knowledge-memory-governance/README.md:
```yaml
---
superseded_at: 2026-04-27
replaced_by: v1.9
reason: "Renumbered. Original Knowledge + Memory Governance plan superseded by SGSD-Research..."
retired_locks: [41=C, 41.1, 41.2, 41.3, 42=C, 43=A, 44=A, 45=B]
---
```
This is the concrete superseded fixture for A3 binding test.

From .planning/milestones/v1.3/phases/p5-codex-monitor/ (verified malformed):
```text
Directory name `p5-codex-monitor` does NOT match ^\d{2}- regex.
Phase 43 capsule writer skips this dir (verified PHASE-INDEX.jsonl has 3 rows for 4 phase dirs).
Phase 44 surfaces this in phase_folders.malformed[].
```
</interfaces>

<canonical_sources_table>
<!-- 13 canonical sources (sec.4.1 of 44-RESEARCH.md). All read-only. -->

| # | Path | Read mode | Contributes to |
|---|------|-----------|----------------|
| 1 | super-gsd/registry/gates.yaml | yaml.load | gates.active (13) |
| 2 | super-gsd/registry/agents.yaml | yaml.load | agents.active metadata + supersedes mapping |
| 3 | .planning/resource-registry/agents.jsonl | line-by-line JSON.parse | agents.active (23 status:active) + agents.superseded |
| 4 | super-gsd/registry/review-providers.yaml | yaml.load | providers.review_aliases (2; informational) |
| 5 | super-gsd/registry/command-envelope-v1.yaml | yaml.load | commands.active (7 emitters) + reason_codes.{active,future} (31+5) |
| 6 | super-gsd/templates/command-envelope-v1.json | JSON.parse | statuses.envelope (6) |
| 7 | super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json | JSON.parse | statuses.capsule (5), artifacts (PhaseOutput.kind) |
| 8 | super-gsd/tools/token-attribution/report.cjs | require() | providers.active (4: PROVIDERS const), statuses.agent (subset of ROLES) |
| 9 | super-gsd/tools/token-waste/check.cjs | require() | commands.active (Phase 42 COMMAND_NAME), VERDICTS metadata |
| 10 | .planning/milestones/v*/PHASE-INDEX.jsonl (8 files) | per-file line read | phases.active (44 capsuled) + milestones.active derivation |
| 11 | filesystem walk .planning/milestones/v*/phases/{NN}-name/ | fs.readdirSync + regex | phase_folders.active (~50) + phase_folders.malformed (>=1) |
| 12 | .planning/archive/superseded/*/README.md | YAML frontmatter | milestones.superseded (1) |
| 13 | .planning/milestones/v1.9/REQUIREMENTS.md | YAML frontmatter | milestones.active enrichment (name, phase_range) |

Source #14 (write.cjs Phase 43) IS read for STATUS_VOCAB but covered by source #7 (schema).

</canonical_sources_table>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build context-registry library + 13-assertion self-test</name>
  <files>
    super-gsd/tools/context-registry/build.cjs (NEW),
    super-gsd/tools/context-registry/check.cjs (NEW),
    super-gsd/tools/context-registry/build.test.cjs (NEW)
  </files>

  <behavior>
    <!-- Test expectations BEFORE implementation. RED first. -->
    Self-test 13 assertions (mirror Phase 43 sec.10):

    F1 (happy path; A1 binding):
      - Setup: 13 synthetic canonical sources in tmpdir (1 gates.yaml with 1 row, 1 agents.yaml with 1 row, 1 agents.jsonl with 1 line, 1 review-providers.yaml with 1 row, 1 command-envelope-v1.yaml with 1 emitter + 1 reason_code, 1 command-envelope-v1.json with 1 status enum, 1 PHASE-CAPSULE.schema.json with status enum, 1 stub report.cjs exporting PROVIDERS, 1 stub check.cjs exporting VERDICTS, 1 PHASE-INDEX.jsonl, 1 phase folder, 1 archive README, 1 REQUIREMENTS.md frontmatter).
      - Call: result = build(tmpdir).
      - Assert: result.ok === true; result.content_hash matches /^[a-f0-9]{64}$/; result.counts.{milestones,phases,gates,agents,artifacts,providers,statuses,phase_folders,commands,reason_codes} all >= 1.
      - Assert: legal-keys.json exists; _validateRegistry(JSON.parse(read(legal-keys.json))) === true.
      - Assert: all 8 ROADMAP A1 categories present at top level + 2 derived (commands, reason_codes).

    F2 (rebuild equivalence; A3 idempotency binding):
      - Setup: F1 setup; build -> H1 = result.content_hash.
      - Action: fs.unlinkSync(legal-keys.json); rebuild -> H2 = result.content_hash.
      - Assert: H1 === H2 (modulo generated_at + generated_by stripped from hash; source_hashes INCLUDED in hash because deterministic on unchanged sources).

    F3 (superseded representation; A3 visibility binding):
      - Setup: F1 setup PLUS synthetic archive README with frontmatter `replaced_by: v1.9` for `v1.9-old`.
      - Action: build then validateReferences({phases: ["v1.9/41", "v1.9-old/41", "v9.9/99"]}).
      - Assert: result.valid === false.
      - Assert: result.invalid_keys.length === 2.
      - Assert: invalid_keys[0] = {key:"v1.9-old/41", category:"phases", reason:"superseded_key", suggested:"v1.9/41", superseded_record: {...}} (when replaced_by present); OR reason:"superseded_key_retired" (when replaced_by absent).
      - Assert: invalid_keys[1] = {key:"v9.9/99", category:"phases", reason:"unknown_key"}.
      - Assert: "v1.9/41" is in NEITHER invalid_keys NOR rejected (it's valid).

    F4 (invalid rejection; A2 binding):
      - Setup: F1 setup. Synthetic packet referencing 5 invented keys: 1 unknown phase ("v9.9/99"), 1 unknown gate ("sgsd-foo-bar"), 1 typo agent ("sgsd-classifyer"), 1 superseded retired ("v1.9-knowledge-memory-governance/41"), 1 malformed ("p5-codex-monitor").
      - Action: result = validateReferences(packet, {categoriesToCheck:['phases','gates','agents','artifacts','providers']}).
      - Assert: result.valid === false.
      - Assert: result.invalid_keys.length === 5.
      - Assert: each invalid_keys row has BOTH .category and .reason populated; reasons drawn from REASONS frozen array.

    Secondary 5: SCHEMA_VERSION === 1 (integer); CATEGORIES is Object.freeze 10-entry array.
    Secondary 6: All arrays in registry sorted ascending by .id.
    Secondary 7: validateReferences({}) -> {valid:true, invalid_keys:[], checked_count:0}.
    Secondary 8: validateOne 4 outcomes verified explicitly (active/superseded-replaced/superseded-retired/unknown).
    Secondary 9: loadRegistry(<malformed.json>) -> {valid:false, invalid_keys:[{reason:"registry_malformed"}]}; NEVER throws.
    Secondary 10: source_hashes contains sha256 hex64 (^[a-f0-9]{64}$) for every expected canonical source; null for absent sources at build time.
    Secondary 11: Read-only invariant -- fingerprint guard over 19 sources, before/after self-test; assert byte-equivalent.
    Secondary 12: build/validateReferences/validateOne/isLegal/loadRegistry NEVER throw on bad input; all return shapes.
    Secondary 13: CLI exit codes -- --self-test pass=0 fail=1; --build ok=0 source-missing=1 bad-invocation=2; --check valid=0 invalid=0 (informational; NOT 1) registry-missing=1 bad-invocation=2.

    Self-test stdout MUST end with literal: "context-registry self-test: 13 pass, 0 fail" (exact string; mirror Phase 43 "phase-capsule self-test: 13 pass, 0 fail").
  </behavior>

  <action>
Create three NEW files under super-gsd/tools/context-registry/:

(1) build.cjs (~550 LOC) -- canonical-source walker + writer

Mirror Phase 43 super-gsd/tools/phase-capsule/write.cjs structure 1:1:

```
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// FROZEN CONSTANTS (RESEARCH sec 6.1)
// ---------------------------------------------------------------------------
const SCHEMA_VERSION = 1;
const REGISTRY_VERSION = '1.0.0';
const CATEGORIES = Object.freeze([
  'milestones','phases','gates','agents','artifacts',
  'providers','statuses','phase_folders','commands','reason_codes',
]);
const STATUS_KIND = Object.freeze(['envelope','capsule','agent']);

// Phase 41 imports BY REFERENCE (NEVER redefine):
let phase41 = null;
try {
  phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
} catch (e) { phase41 = null; }

// js-yaml fallback (mirror gates-registry.cjs:38-44):
let yaml = null;
try {
  yaml = require(path.join(__dirname, '..', 'plan-schema', 'node_modules', 'js-yaml'));
} catch (e) { yaml = null; }

// ---------------------------------------------------------------------------
// SOURCE READERS (sec 4.1) -- 13 sources
// ---------------------------------------------------------------------------
function _readGates(p)               { /* yaml.load -> gates[] */ }
function _readAgentsYaml(p)          { /* yaml.load -> agents[] with category, supersedes */ }
function _readAgentsJsonl(p)         { /* line-by-line JSON.parse, status:active filter */ }
function _readReviewProviders(p)     { /* yaml.load -> providers[] (review aliases) */ }
function _readEnvelopeRegistry(p)    { /* yaml.load -> {emitters[], reason_codes[]} */ }
function _readEnvelopeJsonStatuses(p){ /* JSON.parse, $.properties.status.enum -> 6 values */ }
function _readCapsuleSchema(p)       { /* JSON.parse, $.properties.status.enum -> 5 values */ }
function _readPhase41Const()         { /* phase41.PROVIDERS, phase41.ROLES, phase41.STATUSES */ }
function _readPhase42Const()         { /* require token-waste/check.cjs -> VERDICTS, ROUTE_REASONS */ }
function _walkPhaseIndices(rootDir)  { /* glob v*/PHASE-INDEX.jsonl, line-read each */ }
function _walkPhaseFolders(rootDir)  { /* readdirSync milestones/v*/phases, regex split active/malformed */ }
function _walkSupersededArchive(p)   { /* glob archive/superseded/*/README.md, YAML frontmatter parse */ }
function _readMilestoneRequirements(p){ /* parse YAML frontmatter for milestone metadata */ }

// ---------------------------------------------------------------------------
// MERGERS + DE-DUPLICATORS (sec 4.2)
// ---------------------------------------------------------------------------
function _mergeAgents(yamlAgents, jsonlAgents) { /* union by .id, dedup, status:active filter */ }
function _distinctMilestones(phases)           { /* derive milestones from phases.milestone field */ }
function _classifyPhaseFolders(allDirs)        { /* split active vs malformed by ^\d{2}- regex */ }
function _splitReasonCodes(allCodes)           { /* split by .status === 'future_v1_9' */ }

// ---------------------------------------------------------------------------
// SCHEMA VALIDATOR + CONTENT-HASH (sec 7.1)
// ---------------------------------------------------------------------------
function _validateRegistry(obj) {
  // Closed-shape check: 10 top-level keys, per-category {active,superseded} shape.
  // Returns true if valid; throws inside if used by _writeRegistryInternal.
}

function _registryContentHash(obj) {
  // MIRROR Phase 43 _capsuleContentHash sec.5.2 verbatim.
  const stripped = { ...obj };
  delete stripped.generated_at;
  delete stripped.generated_by;
  // source_hashes INCLUDED (deterministic if sources unchanged).
  const json = JSON.stringify(_sortKeysDeep(stripped));
  return crypto.createHash('sha256').update(json).digest('hex');
}

function _sortKeysDeep(value) {
  if (Array.isArray(value)) {
    const sorted = value.map(_sortKeysDeep);
    // Sort arrays of objects with .id ascending.
    if (sorted.length && typeof sorted[0] === 'object' && sorted[0] !== null && 'id' in sorted[0]) {
      sorted.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    } else if (sorted.length && typeof sorted[0] === 'string') {
      sorted.sort();
    }
    return sorted;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = _sortKeysDeep(value[k]);
    return out;
  }
  return value;
}

function _hashSource(p) {
  try {
    const buf = fs.readFileSync(p);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// PUBLIC API (sec 6.1)
// ---------------------------------------------------------------------------
function build(repoRoot, opts) {
  // try { ... } catch { return {ok:false, reason:'internal_error', detail:e.message}; }
  // Walk 13 sources; merge; sort; hash; atomic write to legal-keys.json via tmpfile-rename.
  // NEVER throws upward.
  // Returns { ok:true, written:<path>, content_hash, source_hashes:{...}, counts:{...} }
  //      OR { ok:false, reason, missing?, detail? }
}

function loadRegistry(legalKeysPath) {
  // try { ... } catch { return null; }
  // mtime cache; resetCache via test-only export.
  // Returns registry object OR null on missing/malformed.
}

function registryPath() {
  return path.join(__dirname, 'legal-keys.json');
}

function resetCache() { /* test-only */ }

module.exports = {
  build, loadRegistry, registryPath, resetCache,
  SCHEMA_VERSION, REGISTRY_VERSION, CATEGORIES, STATUS_KIND,
};

// ---------------------------------------------------------------------------
// CLI (sec 6.4)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) { /* require ./build.test.cjs and run */ }
  else if (args.includes('--build')) { /* call build(repoRoot); print counts; exit 0/1 */ }
  else if (args.includes('--check')) { /* delegate to check.cjs */ }
  else { /* --help; exit 2 on bad invocation */ }
}
```

(2) check.cjs (~250 LOC) -- read-only validator

```
'use strict';
const fs = require('fs');
const path = require('path');
const buildModule = require('./build.cjs');
const { loadRegistry, registryPath } = buildModule;

const REASONS = Object.freeze([
  'unknown_key','superseded_key','superseded_key_retired',
  'malformed_key','registry_missing','registry_malformed',
]);

// Phase 41 imports BY REFERENCE (informational; not directly used here):
let phase41 = null;
try { phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs')); }
catch (e) { phase41 = null; }

function _normalizeKey(key, category) {
  // Strip optional 'P' prefix from phase IDs ('v1.9/P41' -> 'v1.9/41').
  if (category === 'phases' && typeof key === 'string') {
    return key.replace(/\/P(\d)/, '/$1');
  }
  return key;
}

function validateOne(key, category, opts) {
  try {
    const reg = loadRegistry(opts && opts.registryPath);
    if (!reg) return { valid:false, reason:'registry_missing' };
    const norm = _normalizeKey(key, category);
    const cat = reg[category];
    if (!cat) return { valid:false, reason:'unknown_key' };
    // active lookup
    if ((cat.active || []).find(r => r.id === norm || r === norm)) return { valid:true };
    // superseded lookup
    const sup = (cat.superseded || []).find(r => r.id === norm);
    if (sup) {
      if (sup.replaced_by) return { valid:false, reason:'superseded_key', superseded_record:sup, suggested:sup.replaced_by };
      return { valid:false, reason:'superseded_key_retired', superseded_record:sup };
    }
    return { valid:false, reason:'unknown_key' };
  } catch (e) {
    return { valid:false, reason:'malformed_key', detail:e.message };
  }
}

function validateReferences(packet, opts) {
  try {
    if (packet === null || packet === undefined) {
      return { valid:false, invalid_keys:[{key:null, category:null, reason:'malformed_key'}], checked_count:0 };
    }
    const reg = loadRegistry(opts && opts.registryPath);
    if (!reg) return { valid:false, invalid_keys:[{key:null, category:null, reason:'registry_missing'}], checked_count:0 };

    const categoriesToCheck = (opts && opts.categoriesToCheck) || ['phases','gates','agents','artifacts','providers'];
    const invalid_keys = [];
    let checked_count = 0;

    // Walk known capsule-schema fields by default; opts.deep:true for full recursive walk.
    const refs = _extractRefs(packet, categoriesToCheck, opts && opts.deep);
    for (const { key, category } of refs) {
      checked_count++;
      const r = validateOne(key, category, opts);
      if (!r.valid) invalid_keys.push({ key, category, reason:r.reason, superseded_record:r.superseded_record, suggested:r.suggested });
    }

    // Stale-registry detection (sec 7.4).
    let stale_warning = false; let stale_sources = [];
    /* compare legal-keys.json mtime vs canonical sources mtimes */

    return { valid: invalid_keys.length === 0, invalid_keys, checked_count, stale_warning, stale_sources };
  } catch (e) {
    return { valid:false, invalid_keys:[{key:null, category:null, reason:'malformed_key', detail:e.message}], checked_count:0 };
  }
}

function isLegal(key, category) {
  try { return validateOne(key, category).valid; } catch (e) { return false; }
}

function _extractRefs(packet, categoriesToCheck, deep) {
  const refs = [];
  // Default: walk known capsule-schema fields:
  //   downstream_contract.consumers[]  -> phases
  //   files[].path or files[]          -> phases (if shaped 'v?.?/*')
  //   gates[]                          -> gates
  //   agents[]                         -> agents
  //   provider                         -> providers
  // deep:true: recursive walk; tag each string by inferred category from parent key name.
  return refs;
}

module.exports = {
  validateReferences, validateOne, isLegal, loadRegistry, registryPath, REASONS,
};

// CLI: --check <packet.json>, --validate-all-capsules, --self-test (delegates to build.cjs).
if (require.main === module) { /* CLI dispatch */ }
```

(3) build.test.cjs (~180 LOC) -- 13-assertion self-test

Mirror Phase 43 build.test.cjs scaffold:

```
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { build, loadRegistry, registryPath, resetCache, CATEGORIES } = require('./build.cjs');
const { validateReferences, validateOne, isLegal, REASONS } = require('./check.cjs');

let pass = 0; let fail = 0;
function assert(cond, label) {
  if (cond) { pass++; console.log(`  PASS ${label}`); }
  else { fail++; console.log(`  FAIL ${label}`); }
}

// __dirname-anchored fingerprint guard over 19 sources (RESEARCH sec 8.3).
const realSources = [
  path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'agents.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'review-providers.yaml'),
  path.resolve(__dirname, '..', '..', 'registry', 'command-envelope-v1.yaml'),
  path.resolve(__dirname, '..', '..', 'templates', 'command-envelope-v1.json'),
  path.resolve(__dirname, '..', 'phase-capsule', 'PHASE-CAPSULE.schema.json'),
  path.resolve(__dirname, '..', 'token-attribution', 'report.cjs'),
  path.resolve(__dirname, '..', 'token-waste', 'check.cjs'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'resource-registry', 'agents.jsonl'),
  ...['v1.2','v1.3','v1.4','v1.5','v1.6','v1.7','v1.8','v1.9'].map(ms =>
    path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', ms, 'PHASE-INDEX.jsonl')),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'archive', 'superseded',
    'v1.9-knowledge-memory-governance', 'README.md'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', 'v1.9', 'REQUIREMENTS.md'),
];

function fingerprintSources() {
  const out = {};
  for (const p of realSources) {
    try {
      const buf = fs.readFileSync(p);
      out[p] = crypto.createHash('sha256').update(buf).digest('hex');
    } catch (e) { out[p] = null; }
  }
  return out;
}

const fpBefore = fingerprintSources();

// Each fixture: setup tmpdir with synthetic 13 canonical sources; call build/check; assert.
// F1, F2, F3, F4 + 9 secondary = 13 assertions total.
runFixture_F1_happy();
runFixture_F2_rebuildEquivalence();
runFixture_F3_supersededVisibility();
runFixture_F4_invalidRejection();
runSecondary_5_through_13();

const fpAfter = fingerprintSources();
const drift = realSources.filter(p => fpBefore[p] !== fpAfter[p]);
assert(drift.length === 0, `secondary 11: read-only invariant (19 sources unchanged)`);

console.log(`context-registry self-test: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
```

Implementation rules (RESEARCH sec 11.2 + Known Dead-Ends):
1. NEVER redefine ROLES/STATUSES/PROVIDERS -- import from Phase 41 by reference (sec 3.1).
2. NEVER throw upward from validateReferences/validateOne/build/loadRegistry/isLegal -- return shapes (sec 6.4).
3. NEVER write to canonical sources -- read-only invariant (sec 7.3).
4. NEVER silently accept superseded keys -- 4 outcomes per sec 5.4 (active=valid, superseded-replaced=invalid+suggested, superseded-retired=invalid+retired_reason, unknown=invalid+unknown_key).
5. NEVER couple to Phase 45/49/50/51 -- forward contract via shape only (sec 9).
6. NEVER include generated_at or generated_by in content_hash -- mirror Phase 43 _capsuleContentHash sec.5.2 verbatim (Known Dead-End #6).
7. NEVER exit non-zero on valid:false -- CLI exit 0 on validation failure (informational); only exit 2 on bad invocation; only exit 1 on self-test failure or registry missing (sec 6.4 + Lock 13).
8. NEVER proliferate docs.

ASCII-only. Atomic write via tmpfile-rename. js-yaml via vendored fallback (gates-registry.cjs:38-44 pattern).
  </action>

  <verify>
    <automated>node super-gsd/tools/context-registry/build.cjs --self-test 2>&1 | tail -3 | grep -q "context-registry self-test: 13 pass, 0 fail"</automated>
    <readonly>git diff --quiet super-gsd/registry/gates.yaml super-gsd/registry/agents.yaml super-gsd/registry/review-providers.yaml super-gsd/registry/command-envelope-v1.yaml super-gsd/templates/command-envelope-v1.json super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json super-gsd/tools/token-attribution/report.cjs super-gsd/tools/token-waste/check.cjs .planning/resource-registry/agents.jsonl</readonly>
  </verify>

  <done>
    - super-gsd/tools/context-registry/build.cjs exists (~550 LOC; ASCII-only)
    - super-gsd/tools/context-registry/check.cjs exists (~250 LOC; ASCII-only)
    - super-gsd/tools/context-registry/build.test.cjs exists (~180 LOC; ASCII-only)
    - --self-test prints exact line: "context-registry self-test: 13 pass, 0 fail"
    - All 4 fixtures (F1 A1, F2 A3-idempotency, F3 A3-visibility, F4 A2) PASS
    - All 9 secondary assertions PASS (schema closed-shape, sort, empty packet, validateOne 4 outcomes, malformed registry, source_hashes hex64, fingerprint invariant, never-throws, CLI exit codes)
    - Phase 41 ROLES/PROVIDERS/STATUSES require()'d by reference (NEVER redefined)
    - Phase 42 VERDICTS/ROUTE_REASONS require()'d by reference
    - PHASE-CAPSULE.schema.json status enum read DIRECTLY from $.properties.status.enum
    - command-envelope-v1.json status enum read DIRECTLY from $.properties.status.enum
    - All 13 canonical sources unchanged by --self-test (git diff --quiet)
    - validateReferences/validateOne/isLegal/build/loadRegistry NEVER throw upward
    - CLI exit codes mirror sec 6.4: --self-test 0/1; --build 0/1/2; --check 0/0/1/2
    - REASONS frozen 6-entry array exported from check.cjs
    - CATEGORIES frozen 10-entry array exported from build.cjs
  </done>
</task>

<task type="auto">
  <name>Task 2: Generate legal-keys.json from 13 canonical sources (live repo backfill)</name>
  <files>super-gsd/tools/context-registry/legal-keys.json (NEW; generated)</files>

  <action>
Run `node super-gsd/tools/context-registry/build.cjs --build` against the live repo to materialize legal-keys.json.

Expected counts (verified in 44-RESEARCH.md sec 2.1):
- milestones.active: >= 8 (v1.2-v1.9 plus any new)
- milestones.superseded: 1 (v1.9-knowledge-memory-governance)
- phases.active: >= 40 (44 capsuled + any active without capsule)
- phases.superseded: 5 (original v1.9 41-45 absorbed into renumber)
- gates.active: 13 (from gates.yaml)
- agents.active: >= 8 (union of agents.yaml 8 + agents.jsonl 23 status:active; expect ~23 unique)
- providers.active: 4 (claude, codex, local-script, vtp from Phase 41 PROVIDERS)
- statuses.envelope: 6 (ok, warn, fail, skipped, timeout, blocked)
- statuses.capsule: 5 (PASS, PASS-WITH-DEFERRED-N, FAIL, UNKNOWN, IN_PROGRESS)
- statuses.agent: 4 (active, deprecated, retired, draft)
- phase_folders.active: >= 40
- phase_folders.malformed: >= 1 (v1.3/p5-codex-monitor confirmed)
- commands.active: >= 7 (envelope emitters) + 3 Phase 41/42/43 = >= 10
- reason_codes.active: >= 30 (36 total - 5 future = 31)
- reason_codes.future: >= 5 (status:future_v1_9 marked)

Verify second run yields identical content_hash (A3 idempotency at scale beyond synthetic F2):
```
node super-gsd/tools/context-registry/build.cjs --build  # H1
node super-gsd/tools/context-registry/build.cjs --build  # H2; assert H1 === H2
```

Verify read-only invariant against live canonical sources:
```
git diff --quiet super-gsd/registry/ super-gsd/templates/command-envelope-v1.json \
  super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json \
  super-gsd/tools/token-attribution/report.cjs \
  super-gsd/tools/token-waste/check.cjs \
  .planning/resource-registry/agents.jsonl
```

Verify the 13 canonical sources fingerprint unchanged (sha256 each before+after build).

Stage + commit (atomic commit #2 from required atomic commits):
```
git add super-gsd/tools/context-registry/legal-keys.json
git commit -m "feat(44-01): generate legal-keys.json from 13 canonical sources"
```

NEVER edit legal-keys.json by hand. Always regenerate via --build.
  </action>

  <verify>
    <automated>node super-gsd/tools/context-registry/build.cjs --build && [ -f super-gsd/tools/context-registry/legal-keys.json ] && node -e "const r=require('./super-gsd/tools/context-registry/build.cjs'); const reg=r.loadRegistry(); const ok = reg && reg.gates.active.length===13 && reg.providers.active.length===4 && reg.statuses.envelope.length===6 && reg.statuses.capsule.length===5 && reg.milestones.superseded.length>=1 && reg.phase_folders.malformed.length>=1; console.log(ok?'COUNTS-OK':'COUNTS-FAIL'); process.exit(ok?0:1);"</automated>
    <idempotency>node super-gsd/tools/context-registry/build.cjs --build 2>&1 | grep -oE 'content_hash=[a-f0-9]{64}' > /tmp/h1 && node super-gsd/tools/context-registry/build.cjs --build 2>&1 | grep -oE 'content_hash=[a-f0-9]{64}' > /tmp/h2 && diff -q /tmp/h1 /tmp/h2</idempotency>
    <readonly>git diff --quiet super-gsd/registry/ super-gsd/templates/command-envelope-v1.json super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json super-gsd/tools/token-attribution/report.cjs super-gsd/tools/token-waste/check.cjs .planning/resource-registry/agents.jsonl</readonly>
  </verify>

  <done>
    - super-gsd/tools/context-registry/legal-keys.json exists; valid JSON; ASCII-only
    - 10 top-level keys present: schema_version, registry_version, generated_at, generated_by, source_hashes, milestones, phases, gates, agents, artifacts, providers, statuses, phase_folders, commands, reason_codes
    - All 8 ROADMAP A1 categories populated with non-empty active arrays
    - per-category {active, superseded} shape verified
    - milestones.superseded includes v1.9-knowledge-memory-governance with replaced_by:'v1.9'
    - phase_folders.malformed includes v1.3/p5-codex-monitor
    - source_hashes contains 64-hex sha256 for every expected canonical source
    - Second --build run produces byte-equivalent content_hash (modulo generated_at + generated_by stripped)
    - 13 canonical sources unchanged by --build (git diff --quiet)
    - File committed: feat(44-01): generate legal-keys.json from 13 canonical sources
  </done>
</task>

<task type="auto">
  <name>Task 3: Backfill capsule consumers[] validation report (44-VERIFICATION.md)</name>
  <files>.planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md (NEW)</files>

  <action>
Run `node super-gsd/tools/context-registry/check.cjs --validate-all-capsules` against every existing PHASE-CAPSULE.json (44 capsules across v1.6/v1.7/v1.8/v1.9 milestones; verified `find .planning/milestones -name PHASE-CAPSULE.json | wc -l` = 44 in 44-RESEARCH.md sec 2.2).

For each capsule, the validator:
1. Reads PHASE-CAPSULE.json (read-only).
2. Calls validateReferences(capsule, {categoriesToCheck:['phases','gates','agents','artifacts','providers']}).
3. Walks downstream_contract.consumers[] (free-form strings; primary surface for invalid refs per sec 2.2).
4. Walks files[].path entries (capsule schema field).
5. Records per-capsule {valid, invalid_count, sample_invalid_keys[<=3], total_checked}.

Emit 44-VERIFICATION.md with structure:

```markdown
---
phase: 44
title: Legal Context Registry -- Capsule Validation Backfill
generated_at: <ISO-8601>
generated_by: super-gsd/tools/context-registry/check.cjs --validate-all-capsules
total_capsules: 44
total_valid: <N>
total_invalid: <M>
total_invalid_keys: <K>
---

# 44-VERIFICATION

## Aggregate

| Metric | Count |
|--------|------:|
| Capsules scanned | 44 |
| Capsules with all-valid references | <N> |
| Capsules with at least one invalid ref | <M> |
| Total invalid_keys across all capsules | <K> |
| Most common reason | <reason> |

## Per-capsule results

| Milestone | Phase | Capsule path | Valid | invalid_count | sample_invalid_keys |
|-----------|-------|--------------|-------|--------------:|---------------------|
| v1.6 | 26 | .planning/milestones/v1.6/phases/26-cockpit-question-contract/PHASE-CAPSULE.json | true / false | N | [...] |
| ... | ... | ... | ... | ... | ... |

## ROADMAP acceptance binding

| Acceptance | Status | Evidence |
|------------|--------|----------|
| A1 (registry includes 8 categories + phase_folders) | PASS | super-gsd/tools/context-registry/legal-keys.json (counts: ...) |
| A2 (invalid IDs rejected) | PASS | Self-test F4 + this report rejects N invented refs across 44 capsules |
| A3 (stale/superseded explicit) | PASS | Self-test F2 (rebuild equiv) + F3 (4-outcome visibility); milestones.superseded[1] populated |

## Read-only invariant

| Source | Pre-check sha256 | Post-check sha256 | Drift |
|--------|------------------|--------------------|-------|
| (44 capsules + 4 PHASE-INDEX.jsonl) | <h1> | <h1> | NONE |

## Lock 13 binding

CLI exit 0 regardless of invalid_count. invalid_keys are INFORMATIONAL; Phase 45 PACKET-03 owns elide/warn/reject decision; Phase 49 GOV-02 owns memory-write admission decision; Phase 50 cockpit owns rendering decision.
```

Verification rules:
- CLI MUST exit 0 even if total_invalid > 0 (Lock 13; informational only).
- Run time < 30s for 44 capsules (RESEARCH sec 11.5; "T9 build = `--build` ~5s").
- Read-only diff against 44 PHASE-CAPSULE.json + 4 PHASE-INDEX.jsonl is empty after run.
- ASCII-only output.

Stage + commit (atomic commit #3 from required atomic commits):
```
git add .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md
git commit -m "feat(44-01): backfill capsule consumers[] validation report"
```
  </action>

  <verify>
    <automated>[ -f .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md ] && grep -q "total_capsules: 44" .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md && grep -q "ROADMAP acceptance binding" .planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md</automated>
    <exit-code>node super-gsd/tools/context-registry/check.cjs --validate-all-capsules > /dev/null 2>&1; test $? -eq 0</exit-code>
    <readonly>git diff --quiet .planning/milestones/v*/phases/*/PHASE-CAPSULE.json .planning/milestones/v*/PHASE-INDEX.jsonl</readonly>
  </verify>

  <done>
    - 44-VERIFICATION.md exists with one row per backfilled capsule (44 rows + aggregate)
    - Each row carries {milestone, phase, capsule_path, valid, invalid_count, sample_invalid_keys[<=3]}
    - Aggregate summary present (total_capsules:44 + valid + invalid + total_invalid_keys + most_common_reason)
    - ROADMAP acceptance binding table maps A1/A2/A3 to evidence
    - Read-only invariant table proves 44 capsules + 4 PHASE-INDEX.jsonl unchanged
    - CLI exits 0 regardless of invalid_count (Lock 13 binding)
    - File committed: feat(44-01): backfill capsule consumers[] validation report
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| canonical sources -> build.cjs | yaml/json/cjs read inputs; build is read-only consumer; never writes back |
| build.cjs -> legal-keys.json | sole owned write; atomic via tmpfile-rename; previous registry preserved on partial failure |
| Phase 45 packet -> check.cjs | external untrusted packets cross here; validateReferences MUST never throw on malformed input |
| user CLI invocation -> argv | bad flag combinations exit 2; never silent ignore |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-44-01 | Spoofing | validateReferences accepts forged "active" key | mitigate | Active list derived ONLY from canonical sources; manual edits to legal-keys.json caught by source_hashes mismatch on next build |
| T-44-02 | Tampering | Build mutates a canonical source | mitigate | Read-only invariant; secondary 11 fingerprint guard over 19 sources at self-test entry/exit; Task 1 verify.readonly + Task 2 verify.readonly + Task 3 verify.readonly |
| T-44-03 | Tampering | Self-test pollutes super-gsd/tools/context-registry/legal-keys.json | mitigate | All synthetic fixtures use os.tmpdir(); fingerprint guard ensures owned legal-keys.json byte-equivalent before/after self-test |
| T-44-04 | Repudiation | Caller cannot trace why a key was rejected | mitigate | invalid_keys[] rows carry {key, category, reason, superseded_record?, suggested?}; closed REASONS enum; Phase 45 logs to context-complaints.jsonl with full provenance |
| T-44-05 | Information Disclosure | legal-keys.json leaks internal source paths | accept | source_hashes carries paths but only relative to repo root; no secret material; legal-keys.json is intended public registry consumed by Phase 45/49/50/51 |
| T-44-06 | Denial of Service | Malformed yaml causes build to hang | mitigate | yaml.load wrapped in try/catch; on parse error returns {ok:false, reason:'source_malformed', path, detail}; never throws upward; previous legal-keys.json preserved |
| T-44-07 | Denial of Service | validateReferences on adversarially deep packet exhausts stack | mitigate | _extractRefs walks known capsule-schema fields by default (shallow); opts.deep:true uses iterative walk with depth cap (mirror Phase 35 stableStringify pattern) |
| T-44-08 | Elevation of Privilege | check.cjs writes to a canonical source | mitigate | check.cjs has zero fs.write* calls; only fs.readFileSync; verified by code review + Task 3 verify.readonly diff |
| T-44-09 | Tampering | Adversary edits legal-keys.json to inject "active" entries | accept (low value) | legal-keys.json is a projection; canonical = sources; next --build regenerates and surfaces drift via source_hashes comparison; mitigation is operator workflow (rebuild before validation) |
| T-44-10 | Spoofing | Phase 45 invokes legacy validateReferences without categoriesToCheck | mitigate | validateReferences defaults categoriesToCheck to canonical 5-entry set; opts is optional; Phase 45 contract documented in sec 9.1 |
| T-44-11 | Tampering | superseded archive README YAML frontmatter forged | accept | archive/ is operator-controlled write space; supersession is operator declaration; informational only; build never auto-supersedes |
| T-44-12 | Repudiation | Stale registry not surfaced to caller | mitigate | validateReferences emits stale_warning:true + stale_sources[] when canonical source mtime > legal-keys.json mtime; informational, never blocks (Lock 13) |

</threat_model>

<verification>
Phase 44 acceptance verification (ROADMAP:114-129 + REQUIREMENTS:121-130):

A1 (registry includes milestones, phases, gates, agents, artifacts, providers, statuses, and known phase folders):
- VERIFY: `node -e "const r=require('./super-gsd/tools/context-registry/build.cjs').loadRegistry(); const cats=['milestones','phases','gates','agents','artifacts','providers','statuses','phase_folders']; for(const c of cats){if(!r[c])throw new Error('missing '+c)} console.log('A1 OK')"` -> "A1 OK"
- BIND: F1 self-test fixture; legal-keys.json counts table in Task 2 done block

A2 (invalid phase/gate/agent/artifact IDs are rejected):
- VERIFY: F4 self-test fixture rejects 5 invented keys with category + reason populated
- BIND: 44-VERIFICATION.md aggregate rejects N invalid refs across 44 capsules

A3 (stale/superseded keys explicit, not silently accepted):
- VERIFY: F2 self-test fixture asserts H1 === H2 idempotency
- VERIFY: F3 self-test fixture asserts validateReferences distinguishes 4 outcomes (active=valid, superseded-replaced=invalid+suggested, superseded-retired=invalid+retired, unknown=invalid+unknown_key)
- VERIFY: legal-keys.json milestones.superseded[1] populated with v1.9-knowledge-memory-governance

REG-01..REG-05 (REQUIREMENTS:121-130):
- REG-01: legal-keys.json exists at super-gsd/tools/context-registry/legal-keys.json
- REG-02: registry includes milestone IDs (>=8), phase IDs (>=40), gate IDs (13), agent IDs (>=8), artifact IDs (>=4), provider IDs (4), status vocabulary (envelope 6 + capsule 5 + agent 4 = 15)
- REG-03: validator (validateReferences) rejects invented references; F4 binding
- REG-04: validator wired into packet builder (Phase 45 PACKET-03 forward contract sec 9.1) AND status-consistency path (Phase 50 cockpit forward contract sec 9.3 OR 44-VERIFICATION.md backfill report as second wire-in IF Phase 50 not yet shipped)
- REG-05: self-test covers valid (F1), invalid (F4), stale (F2 idempotency), and superseded (F3 visibility)

Lock 4 binding (REQUIREMENTS:39): registry IS role-specific packet's reference allowlist; verified by Phase 45 PACKET-03 contract documentation in sec 9.1
Lock 6 binding (REQUIREMENTS:39-49): provider IDs (claude, codex, local-script, vtp) appear VERBATIM in registry from Phase 41 PROVIDERS const; verified by Task 2 counts (providers.active === 4)
Lock 13 binding (REQUIREMENTS:67-68): CLI exit 0 on valid:false; build/check/validateReferences/validateOne/isLegal/loadRegistry never throw upward; verified by self-test secondary 12 + 13

REQUIREMENTS line 285 hard-stop: "Hard stop if context packet builder can invent or accept unknown phase/gate IDs" -- BINDING ON PHASE 45 (the packet builder), NOT on Phase 44. Phase 44 supplies mechanism (validateReferences); Phase 45 enforces contract (rejects packet with unknown_key).

Read-only invariant (sec 7.3):
- 13 canonical sources unchanged by --self-test (secondary 11 fingerprint guard)
- 13 canonical sources unchanged by --build (Task 2 verify.readonly)
- 44 PHASE-CAPSULE.json + 4 PHASE-INDEX.jsonl unchanged by --validate-all-capsules (Task 3 verify.readonly)

Idempotency (sec 7.1):
- F2 self-test: build -> H1; delete legal-keys.json; rebuild -> H2; H1 === H2
- Task 2 verify.idempotency: live --build twice, content_hash equal
- _registryContentHash strips generated_at + generated_by; mirrors Phase 43 _capsuleContentHash sec 5.2 verbatim

Cross-phase contracts (sec 9):
- Phase 45 PACKET-03: validateReferences(packet, {categoriesToCheck:[...]}) is the admission boundary; documented + tested
- Phase 49 GOV-02: loadRegistry() consumed by memory write admission; documented
- Phase 50 cockpit (REG-04 second wire-in): status-consistency reads legal-keys.json; documented
- Phase 51 BENCH-05: stale-registry + invalid-phase-ID failure injections documented; F3 + F4 cover unit level
</verification>

<success_criteria>
**Plan 44-01 ships when:**

1. **Three new modules exist** under super-gsd/tools/context-registry/:
   - build.cjs (~550 LOC)
   - check.cjs (~250 LOC)
   - build.test.cjs (~180 LOC)

2. **Self-test prints exactly:**
   `context-registry self-test: 13 pass, 0 fail`

3. **All 4 fixtures + 9 secondary = 13 assertions PASS:**
   - F1 (A1) happy path: 8 ROADMAP categories present, _validateRegistry true
   - F2 (A3 idempotency): H1 === H2 across rebuild
   - F3 (A3 visibility): 4 distinct outcomes for active/superseded-replaced/superseded-retired/unknown
   - F4 (A2): 5 invented keys all rejected with category + reason
   - 9 secondary cover schema closed-shape, sort, empty packet, validateOne 4 outcomes, malformed registry, source_hashes hex64, fingerprint invariant, never-throws, CLI exit codes

4. **legal-keys.json exists and is schema-conformant:**
   - 10 top-level keys (5 metadata + 8 categories + 2 derived)
   - All 8 ROADMAP A1 categories populated
   - milestones.superseded[1] populated (v1.9-knowledge-memory-governance)
   - phase_folders.malformed[>=1] (v1.3/p5-codex-monitor)
   - second --build yields byte-equivalent content_hash

5. **Read-only invariant green:**
   - 13 canonical sources unchanged by --self-test
   - 13 canonical sources unchanged by --build
   - 44 PHASE-CAPSULE.json + 4 PHASE-INDEX.jsonl unchanged by --validate-all-capsules

6. **44-VERIFICATION.md exists** with per-capsule validation results (44 capsules + aggregate + ROADMAP acceptance binding)

7. **Three atomic commits in order:**
   - `feat(44-01): context-registry/{build,check}.cjs lib + schema + 13-assertion self-test`
   - `feat(44-01): generate legal-keys.json from 13 canonical sources`
   - `feat(44-01): backfill capsule consumers[] validation report`

8. **No-throw contract verified:**
   - build, validateReferences, validateOne, isLegal, loadRegistry never throw
   - bad input returns shape ({ok|valid:false, reason})
   - CLI exit codes: --self-test 0/1; --build 0/1/2; --check 0/0/1/2 (Lock 13)

9. **Phase 41/42 const imports BY REFERENCE:**
   - ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS, COMMAND_NAME, ENVELOPE_VERSION require()'d from token-attribution/report.cjs
   - VERDICTS, ROUTE_REASONS require()'d from token-waste/check.cjs
   - NEVER redefined as local consts (Known Dead-End #1)

10. **ASCII-only across all 5 owned files** (build.cjs, check.cjs, build.test.cjs, legal-keys.json, 44-VERIFICATION.md): zero non-ASCII bytes

11. **REG-01..05 + ROADMAP A1/A2/A3 + Lock 4/6/13 all green** per <verification> table.

12. **Forward contracts documented** for Phase 45 PACKET-03 (primary), Phase 49 GOV-02, Phase 50 cockpit (REG-04 second wire-in), Phase 51 BENCH-05 failure fixtures.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.9/phases/44-legal-context-registry/44-01-legal-context-registry-SUMMARY.md` with:

- Files created (5)
- Self-test result (13 pass, 0 fail expected)
- Counts table (milestones, phases, gates, agents, etc.)
- F1/F2/F3/F4 fixture outcomes
- Read-only fingerprint diff (must be empty)
- 3 atomic commits SHAs
- Cross-phase wire-in checklist (Phase 45/49/50/51 contracts documented)
- ROADMAP A1/A2/A3 + REG-01..05 + Lock 4/6/13 green checklist
</output>
