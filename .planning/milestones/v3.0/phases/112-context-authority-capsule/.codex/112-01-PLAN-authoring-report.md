SUCCESS: The process with PID 31168 (child process of PID 24492) has been terminated.
SUCCESS: The process with PID 46716 (child process of PID 24492) has been terminated.
SUCCESS: The process with PID 3660 (child process of PID 24492) has been terminated.
PATCH_BEGIN
diff --git a/.planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md b/.planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md
new file mode 100644
index 0000000..245f367
--- /dev/null
+++ b/.planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md
@@ -0,0 +1,250 @@
+---
+schema_version: 2
+plan_id: 112-01
+phase: 112
+phase_name: Context Authority Capsule
+milestone: v3.0
+title: Context Authority capsule templates, composer, and v3.0 dogfood instances
+status: PLAN-LOCKED
+expected_ATC_tier: FULL
+skip_gates: []
+depends_on: []
+lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+semantic_acceptance_criteria:
+  - id: SAC-P112-01
+    input: "all 6 capsule YAML templates under super-gsd/templates/"
+    expected_outcome: "each parses as valid YAML and contains at least the minimum required sections"
+    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs --self-test-templates; test $? -eq 0"
+
+  - id: SAC-P112-02
+    input: "context-anchor-writer.cjs invoked with a sample MILESTONE-CONTEXT.yaml"
+    expected_outcome: "emits one context_anchor CMB with canonical_source_path + canonical_source_hash + projection_summary"
+    verification_cmd: "node super-gsd/tools/context-authority/context-anchor-writer.cjs --self-test; test $? -eq 0"
+
+  - id: SAC-P112-03
+    input: "context-composer.cjs --milestone v3.0"
+    expected_outcome: "emits 6 context_anchor CMBs (one per capsule YAML) to mesh ledger; all validate against cmb.schema.json"
+    verification_cmd: "node super-gsd/tools/context-authority/context-composer.cjs --self-test; test $? -eq 0"
+
+  - id: SAC-P112-04
+    input: "all 6 v3.0 capsule YAML instances (MILESTONE-CONTEXT, PERSONA-MATRIX, DOMAIN-ONTOLOGY, LEXICON, SOURCE-OF-TRUTH, NON-GOALS)"
+    expected_outcome: "each file exists, parses, has all template-required sections, and projects cleanly via context-composer"
+    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs --self-test-v3-capsule; test $? -eq 0"
+
+  - id: SAC-P112-05
+    input: "context_anchor CMB with stale canonical_source_hash (manually mutated YAML after projection)"
+    expected_outcome: "context-anchor-writer --check-staleness detects mismatch and reports 'stale'"
+    verification_cmd: "node super-gsd/tools/context-authority/context-anchor-writer.cjs --self-test-stale; test $? -eq 0"
+
+  - id: SAC-P112-06
+    input: "integrated self-test covering all 6 templates + composer + writer + v3.0 capsule + staleness detection"
+    expected_outcome: "exit 0 with ≥15 assertions passed"
+    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs; test $? -eq 0"
+tasks:
+  - id: t1
+    agent: codex-executor
+    model: codex
+    expected_ATC_tier: FULL
+    skip_gates: []
+    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+    files_touched:
+      - super-gsd/templates/MILESTONE-CONTEXT.template.yaml
+      - super-gsd/templates/PERSONA-MATRIX.template.yaml
+      - super-gsd/templates/DOMAIN-ONTOLOGY.template.yaml
+      - super-gsd/templates/LEXICON.template.yaml
+      - super-gsd/templates/SOURCE-OF-TRUTH.template.yaml
+      - super-gsd/templates/NON-GOALS.template.yaml
+      - super-gsd/tools/context-authority/package.json
+      - super-gsd/tools/context-authority/README.md
+    input_contract: |
+      Consume Phase 112 context, v3.0 INTENT, v3.0 REQUIREMENTS, and the
+      context_anchor branch of cmb.schema.json. Treat the six capsule templates
+      as canonical authoring starting points for per-milestone context, not as
+      generated projections or hard commandments for every future milestone.
+      Preserve the binding invariant that YAML is canonical truth and
+      context_anchor CMBs are projections.
+    output_contract: |
+      The six template YAML files exist under super-gsd/templates/ and parse as
+      valid YAML. MILESTONE-CONTEXT.template.yaml covers milestone WHY, outcome,
+      non-goals, entry/exit criteria, and operator preferences.
+      PERSONA-MATRIX.template.yaml covers per-persona cares_about,
+      does_not_want, search_bias.include, and search_bias.suppress.
+      DOMAIN-ONTOLOGY.template.yaml covers entity types, children, and
+      source-of-truth mappings. LEXICON.template.yaml covers polysemy and
+      domain-specific terminology with senses and personas.
+      SOURCE-OF-TRUTH.template.yaml covers authoritative ownership by data
+      class. NON-GOALS.template.yaml covers explicit out-of-scope items.
+      package.json and README.md document the local-only context-authority tool
+      package, template purpose, and expected commands.
+    hypothesis: |
+      Six small, hand-authorable YAML templates plus package documentation can
+      make Context Authority repeatable across milestones without replacing the
+      canonical source files or forcing future milestones into irrelevant
+      sections.
+    falsifier: |
+      Any template fails to parse as YAML, omits the minimum required sections
+      named in Phase 112, implies that context_anchor CMBs are authoritative
+      instead of projections, requires optional VTP/private KB access, or lacks
+      enough documentation for an executor to author the v3.0 instances.
+    stop_rule: |
+      Stop once all six templates exist, parse with js-yaml, contain the minimum
+      required sections, and package.json plus README.md describe local use of
+      the Context Authority package.
+    depends_on: []
+    verification_cmd: "node -e \"const yaml = require(require('path').resolve('super-gsd/tools/plan-schema/node_modules/js-yaml')); for (const f of ['MILESTONE-CONTEXT','PERSONA-MATRIX','DOMAIN-ONTOLOGY','LEXICON','SOURCE-OF-TRUTH','NON-GOALS']) yaml.load(require('fs').readFileSync('super-gsd/templates/'+f+'.template.yaml','utf8'))\""
+
+  - id: t2
+    agent: codex-executor
+    model: codex
+    expected_ATC_tier: FULL
+    skip_gates: []
+    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+    files_touched:
+      - super-gsd/tools/context-authority/context-anchor-writer.cjs
+      - super-gsd/tools/context-authority/context-composer.cjs
+    input_contract: |
+      Consume t1's template contract, the context_anchor branch in
+      super-gsd/schemas/cmb.schema.json, DLB-08 Mesh Memory Lite projection
+      rules, and Phase 112 binding invariants. Reuse existing mesh-memory
+      validation and hash utilities where available instead of duplicating SGSD
+      gates. context-composer.cjs depends on context-anchor-writer.cjs for
+      single-source projection behavior.
+    output_contract: |
+      context-anchor-writer.cjs exposes importable functions plus CLI help. It
+      projects one YAML or Markdown canonical source file into exactly one
+      context_anchor CMB with canonical_source_path, canonical_source_hash as
+      sha256 of source contents at projection time, and projection_summary. It
+      supports self-test and staleness-check modes that detect a mismatch
+      between recorded canonical_source_hash and the current source hash.
+      context-composer.cjs loads a milestone's six capsule YAML files from
+      .planning/milestones/{milestone}/context/, calls the writer for each
+      source, emits six context_anchor CMBs to the mesh ledger, and validates
+      each emitted CMB against cmb.schema.json.
+    hypothesis: |
+      A single-file writer plus a milestone composer can keep source projection
+      deterministic, auditable, and stale-detectable while preserving one CMB
+      per capsule YAML.
+    falsifier: |
+      The writer emits non-context_anchor CMBs, omits canonical_source_path or
+      canonical_source_hash, hashes generated projection text instead of source
+      contents for staleness, lets the composer emit one mega-CMB, bypasses CMB
+      schema validation, or invents ontology terms outside the YAML sources.
+    stop_rule: |
+      Stop once both CLIs expose --help, writer self-tests projection and stale
+      detection, composer can load a milestone capsule and validates emitted
+      context_anchor CMBs, and no optional private KB or network access is
+      required.
+    depends_on: [t1]
+    verification_cmd: "node super-gsd/tools/context-authority/context-composer.cjs --help"
+
+  - id: t3
+    agent: codex-executor
+    model: codex
+    expected_ATC_tier: FULL
+    skip_gates: []
+    lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"
+    files_touched:
+      - .planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml
+      - .planning/milestones/v3.0/context/PERSONA-MATRIX.yaml
+      - .planning/milestones/v3.0/context/DOMAIN-ONTOLOGY.yaml
+      - .planning/milestones/v3.0/context/LEXICON.yaml
+      - .planning/milestones/v3.0/context/SOURCE-OF-TRUTH.yaml
+      - .planning/milestones/v3.0/context/NON-GOALS.yaml
+      - super-gsd/tools/context-authority/run-self-test.cjs
+    input_contract: |
+      Consume t1 templates, t2 writer/composer, v3.0 INTENT.md, v3.0
+      REQUIREMENTS.md, and the Phase 112 dogfood requirement. The v3.0 capsule
+      instances must be hand-authored from the milestone's actual intent and
+      requirements, especially REQ-CTX-01 through REQ-CTX-05 and REQ-MML-15,
+      rather than generated as placeholder examples.
+    output_contract: |
+      The six v3.0 capsule instance YAML files exist under
+      .planning/milestones/v3.0/context/. MILESTONE-CONTEXT.yaml captures the
+      v3.0 WHY, outcome, entry criteria, exit criteria, non-goals, and operator
+      preferences from INTENT.md. PERSONA-MATRIX.yaml covers operator,
+      codex-executor, and claude-orchestrator personas with cares_about,
+      does_not_want, and search_bias fields. DOMAIN-ONTOLOGY.yaml captures CMB
+      types and relationships. LEXICON.yaml captures DLB-07, DLB-08, DLB-09,
+      DLB-10, Tier 0/1/2, and carve-out terminology. SOURCE-OF-TRUTH.yaml maps
+      schemas, registries, decision logs, ledgers, and canonical milestone files
+      to their owning paths. NON-GOALS.yaml captures Pi harness,
+      sym-mesh-channel, concurrent mesh, executor-authored CMBs, embeddings, and
+      Tier 3 SVAF as out of scope. run-self-test.cjs covers all six templates,
+      writer, composer, v3.0 capsule projection, and stale detection with at
+      least 15 assertions.
+    hypothesis: |
+      Dogfooding Context Authority against v3.0 itself proves the capsule shape
+      can preserve milestone intent, persona bias, ontology, lexicon,
+      source-of-truth, and non-goal context before post-v3.0 pseudo-operator
+      consumption work begins.
+    falsifier: |
+      Any v3.0 capsule file is missing, invalid YAML, disconnected from
+      INTENT.md/REQUIREMENTS.md, omits a required template section, fails
+      projection through context-composer, or the self-test reports fewer than
+      15 assertions while still exiting 0.
+    stop_rule: |
+      Stop once all six v3.0 capsule instances exist, parse, satisfy template
+      minimums, project cleanly via context-composer, stale detection is covered,
+      and run-self-test.cjs exits 0 with at least 15 assertions passed.
+    depends_on: [t1, t2]
+    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs"
+---
+
+# Plan 112-01 - Context Authority Capsule
+
+## Goal
+
+Ship DLB-10.1 Context Authority for Phase 112. The work creates the six
+canonical capsule templates, implements the writer/composer tooling that
+projects those YAML sources into `context_anchor` CMBs, and adds a local
+self-test that proves template parsing, projection, validation, v3.0 dogfood,
+and staleness detection.
+
+The binding shape is unchanged from Phase 112 context: YAML is canonical truth;
+`context_anchor` CMBs are projections; every projection carries
+`canonical_source_path` and `canonical_source_hash`; CAT7 wraps the YAML
+anchors without inventing new ontology; and composer emits one CMB per capsule
+file, not a merged mega-CMB.
+
+## Dogfood Note
+
+The first capsule instance is v3.0 itself. The executor must author
+`.planning/milestones/v3.0/context/*.yaml` from
+`.planning/milestones/v3.0/INTENT.md` and
+`.planning/milestones/v3.0/REQUIREMENTS.md`, with special attention to
+REQ-CTX-01 through REQ-CTX-05 and REQ-MML-15. This proves the format is usable
+for the SGSD-PRO milestone before any post-v3.0 pseudo-operator consumption
+work begins.
+
+## Dispatch
+
+Dispatch all tasks to `codex-executor` on model `codex`, with
+`expected_ATC_tier: FULL`, `skip_gates: []`, and lessons from
+`.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`.
+
+`t1` has no dependencies and creates the six template YAMLs plus package
+metadata and README. `t2` depends on `t1`, then creates
+`context-anchor-writer.cjs` and `context-composer.cjs`, with the composer using
+the writer for per-source projection. `t3` depends on `t1` and `t2`, then
+creates the six v3.0 capsule YAML instances and the integrated self-test
+runner.
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md (created)
VERIFICATION: PLAN validates by inspection against plan-schema-v2 required fields; 6 SACs copied verbatim from 112-CONTEXT.md; 3 tasks declared with depends_on chain t1=[], t2=[t1], t3=[t1, t2] and requested verification_cmds.
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: P112-01 PLAN authored — 6 capsule templates + composer + writer + v3.0 capsule instances + self-test.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
