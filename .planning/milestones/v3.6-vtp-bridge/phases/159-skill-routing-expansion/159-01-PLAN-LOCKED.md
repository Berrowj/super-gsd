---
schema_version: 2
phase: 159
slug: skill-routing-expansion
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 1
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/159-skill-routing-expansion/CONTEXT.md
depends_on: ['155', '158']
intent: >
  Expand prompt-time skill and VTP surface routing with anchored lexical rows,
  local availability guards, text-free shadow/demand evidence, and a mechanical
  description standard without invoking skills or MCP from the hook.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      Production-stdin UserPromptSubmit fixtures under isolated project and
      HOME/USERPROFILE roots where the same matched slash target exists first
      under ~/.claude/skills, then ~/.claude/commands, then project .claude,
      followed by a control where it exists in none of those roots.
    expected_outcome: >
      Each present direction emits exactly the matched suggestion or directive
      and records the normal matched decision. The absent direction emits zero
      stdout and records one intent_routing_decision with
      decision=skill_unavailable, the stable route/target identifiers, empty
      directives/suggestions, and no prompt, entity, path, command content, or
      other text-bearing field. Existing repo-owned SGSD skills still resolve.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case availability-guard &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
  - input: >
      An isolated fake instance with all T2 target skills installed and a
      positive/negative matrix for quote creation, ERP record resolution,
      Clarity/RAG lookup, meeting import, JCL procurement status, HTML
      explainers, and standalone diagrams, including weak start-verb and strong
      domain-positive controls.
    expected_outcome: >
      Anchored lexical rows select only the intended family: create-quote,
      vtp-implementation-pack, jcl-procurement-report, vtp-html-explainer, and
      diagram-design emit availability-guarded suggestions; erp-resolve and
      clarity-engines remain shadow-only. Strong domain positives beat a
      start-verb exclusion, weak noun hits do not, and explainer and diagram
      fixtures never select each other. No row uses cosine, embeddings, or
      similarity scoring, and every written row contains fixed identifiers only.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case erp-vtp-skill-family &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
  - input: >
      The real super-gsd/skills tree plus generated skill directories containing
      respectively no description, a one-noun description, and a compliant
      description that states triggers, its neighbour boundary, when not to use
      it, and its safety posture.
    expected_outcome: >
      The production tree and compliant fixture pass. The missing and one-noun
      fixtures exit with findings and stable description_missing and
      description_one_noun codes. The standard applies directly to
      super-gsd/skills and the overlay points instance-local skill authors to
      the same contract without copying a second standard.
    verification_cmd: >
      node super-gsd/tools/skill-description-lint/lint.cjs --skills-dir super-gsd/skills &&
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case description-lint &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
  - input: >
      A project .mcp.json registering the canonical server name read from
      vtp-services.yaml, with lexical fixtures for book/paper/transcript
      content, people/projects/ideas/analyses, end-to-end retrieval, meeting
      export, and triage verdicts. The registered command is deliberately
      non-runnable so a liveness check would fail.
    expected_outcome: >
      The recorded rule is encoded exactly: book/paper/transcript content ->
      vtp_search_substrate; people/projects/ideas/analyses -> wiki_search
      family; end-to-end -> vtp_route_and_retrieve; meeting export ->
      /vtp-implementation-pack; triage verdicts -> vtp_triage advisory.
      Tool-level routes stay shadow-only with zero stdout; the skill route is a
      suggestion only. Every fired route appends one text-free shadow/decision
      row and one idempotent text-free Phase-0 demand row with shared lineage,
      without calling MCP, spawning a process, or probing network/liveness.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case vtp-tool-family-registered &&
      node super-gsd/scripts/lib/demand-baseline-ledger.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
  - input: >
      The same T4 matrix with missing, malformed, and canonical-name-absent
      project .mcp.json controls, plus a human prompt quoting the full P158
      task-notification envelope and an actual automated task-notification that
      contains every new T2/T4 trigger.
    expected_outcome: >
      An unregistered MCP server produces no suggestion, shadow fire, or demand
      row and writes only text-free mcp_server_unregistered evidence; config
      values and errors are never copied. The quoted human prompt remains
      routable, while the automated turn writes exactly automated_turn_skip
      with both evaluation counters zero before any skill, MCP-config, shadow,
      or demand read/write. All prior classifier and KB-shadow assertions pass.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case vtp-tool-family-unavailable-origin-gate &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
known_deadends:
  - Do not add cosine, embeddings, similarity scoring, fuzzy matching, an LLM call, or any non-lexical router; the Phase 47/48 structural-predicate lock remains binding.
  - Do not invoke a skill, command, MCP tool, child process, network probe, or liveness check from UserPromptSubmit; the hook emits suggestions or shadow evidence only.
  - Do not weaken, move, or evaluate anything before P158's automated task-notification origin gate, and do not infer origin from prompt text.
  - Do not log prompt/query text, excerpts, entity names, config values, paths, commands, args, URLs, raw errors, task ids, or notification contents in routing, shadow, availability, or demand evidence.
  - Do not log every absent installed skill during registry adaptation; skill_unavailable is written only when a route lexically matches and its target then fails local resolution.
  - Do not let generic nouns such as quote, record, engine, meeting, report, diagram, person, project, paper, or transcript fire alone; use anchored verbs, domain pairs, exclusions, and strong-positive-beats-verb tiering.
  - Do not make explainer and diagram routes co-fire, or let generic transcript-content routing beat the explicit meeting-export implementation-pack route.
  - Do not duplicate gates, shadow classifiers, route ledgers, or Phase-0 demand storage; extend the P149 adapter, P152 matcher/evidence, and P151 ledger.
  - Do not edit Voice-Text-Plan, add MCP tools, mutate gates.yaml, fix the devcp MODULE_NOT_FOUND issue, or promote any new route to auto-invocation/directive enforcement.
tasks:
  - id: P159-T1
    type: matched-route-availability-guard
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/hooks/sgsd-intent-classifier.cjs
      - super-gsd/scripts/lib/skill-routing-registry.cjs
      - super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
    input_contract: >
      Work red-first with production-stdin fixtures and isolated project plus
      HOME/USERPROFILE roots. Record both failing directions before source
      changes: a locally installed non-sgsd slash target is wrongly suppressed,
      while a lexically matched absent target is either silently discarded
      without evidence or considered before its actual match. Refactor the P149
      adapter so the classifier can defer availability until after lexical
      matching without changing the adapter's default filtering contract.
      Export/reuse one names-only resolver that accepts only a safe slash target
      grammar and checks existing repo-owned super-gsd/skills plus the locked
      Claude locations: ~/.claude/skills/<target>/SKILL.md,
      ~/.claude/commands/<target>.md,
      ~/.claude/commands/<target>/SKILL.md, and the corresponding project
      .claude/skills and .claude/commands shapes. Preserve existing .agents and
      .codex compatibility roots. Replace the classifier's /sgsd-only emission
      restriction with the safe grammar plus successful resolution; apply it to
      both directive and suggestion emissions. Partition matched routes before
      routeDirectives/stdout. For a matched absent target, emit nothing and
      append exactly one existing-ledger intent_routing_decision row with
      decision=skill_unavailable, fixed route_id/target_skill/reason code, and
      empty directives/suggestions; never include a checked path or prompt.
      Keep isAutomatedTurnPayload at the first branch in emitClassification so
      automated turns perform zero registry reads and zero availability checks.
    output_contract: >
      Every emitted slash directive/suggestion resolves on the current instance,
      external skill names are supported safely, and a matched unavailable route
      is silent but explicitly measurable through one text-free existing-ledger
      row. P149 default adapter behavior and P158 origin gating remain intact.
    hypothesis: >
      Deferring a shared names-only entrypoint check until after lexical matching
      prevents phantom suggestions without creating per-prompt noise for every
      skill absent from the registry's installation instance.
    falsifier: >
      The installed-target red starts green; any supported Claude project/global
      shape fails; an absent target emits stdout or no skill_unavailable row;
      an unrelated absent row logs despite no lexical match; a path/prompt leaks;
      unsafe slash syntax passes; P149 adapter defaults change; P158 evaluates
      availability on an automated turn; or T1 is not one revertable commit.
    stop_rule: >
      Stop after both availability directions pass through production stdin,
      the text-free leak scan and safe-target controls pass, classifier/loader/
      KB-shadow regressions exit 0, the diff matches the three listed files,
      and T1 is one independently revertable commit.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case availability-guard &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
    expected_ATC_tier: GATE
  - id: P159-T2
    type: erp-vtp-skill-family-shadow-suggestions
    agent: codex
    model: codex
    depends_on: ['P159-T1']
    files_touched:
      - super-gsd/registry/skill-routing.yaml
      - super-gsd/registry/session-governance-hooks.yaml
      - super-gsd/scripts/lib/skill-routing-registry.cjs
      - super-gsd/hooks/sgsd-intent-classifier.cjs
      - super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
    input_contract: >
      Work red-first against the T1 fake-instance harness. Add prompt-time YAML
      rows and matching compiled-fallback rows for the low-risk, explicit skill
      suggestions create-quote, vtp-implementation-pack (meeting import),
      jcl-procurement-report, vtp-html-explainer, and diagram-design. Add
      compatibility-registry shadow rows for the higher-ambiguity erp-resolve
      and clarity-engines families, carrying a fixed target skill and fixed
      would-route action but no directive. Generalize the existing shadow
      matcher only enough to accept generic strong_phrases/strong_regexes while
      retaining strong_kb_phrases/strong_kb_regexes unchanged for P152; a strong
      positive wins over exclude_start_verbs, while a weak positive is
      suppressed by build/fix/run/test/file. Use start/word-boundary anchored
      verbs plus domain pairs: quote creation plus SAP/JCL or quote artifact;
      resolve/reconcile plus ERP/SAP and customer/vendor/material/order/record;
      query/search/compare plus Clarity/RAG and engine/index/retrieval; meeting
      import/convert plus transcript/recording and implementation pack/actions;
      JCL plus procurement and status/report/order; and explicit HTML explainer/
      interactive walkthrough versus standalone diagram/flowchart/sequence
      requests. Give the two visual routes mutual exclusions so they cannot
      co-fire. Keep every row availability-guarded by T1 and emit one text-free
      P152-shaped shadow row per matched shadow route with its fixed action.
      Do not promote erp-resolve or clarity-engines beyond shadow.
    output_contract: >
      Seven anchored skill families become observable: five explicit low-risk
      families suggest a locally installed skill, two ambiguous families accrue
      shadow evidence only, and the explainer/diagram boundary is exclusive.
      YAML and compiled fallback remain deeply equivalent.
    hypothesis: >
      Anchored domain pairs and strong-positive precedence expand useful coverage
      without the false fires that generic business and visual nouns would cause.
    falsifier: >
      The red matrix starts green; a noun-only or weak start-verb fixture fires;
      a strong positive is suppressed; explainer and diagram co-fire; a shadow
      emits stdout; an unavailable target is suggested; YAML/fallback parity
      drifts; any telemetry contains fixture text; cosine appears; P152/P158
      regress; or T2 cannot be reverted independently after T1.
    stop_rule: >
      Stop after the full positive/negative/boundary matrix and text-free scans
      pass, loader/classifier/KB-shadow regressions exit 0, the diff matches the
      five listed files, and T2 is one independently revertable commit after T1.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case erp-vtp-skill-family &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
    expected_ATC_tier: GATE
  - id: P159-T3
    type: skill-description-standard-and-lint
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/docs/SKILL-DESCRIPTION-STANDARD.md
      - super-gsd/tools/skill-description-lint/lint.cjs
      - super-gsd/CLAUDE-OVERLAY.md
      - super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
    input_contract: >
      Work red-first with generated compliant, missing-description, and one-noun
      SKILL.md fixtures. Write one canonical standard requiring a description to
      state positive trigger conditions, the boundary against neighbouring
      skills, when NOT to use it, and the relevant safety posture, using
      create-quote's gated/dry-run-first wording as the model. Build a dependency-
      local Node CLI with --skills-dir and optional --json that recursively scans
      SKILL.md files, parses delimited YAML frontmatter with the repository's
      pinned js-yaml JSON_SCHEMA and duplicate-key rejection, and emits stable
      relative file plus reason-code findings. It must flag an absent/blank
      description as description_missing and a description whose normalized
      lexical content is one noun as description_one_noun; malformed frontmatter
      is a separate stable finding, not a crash. Exit 0 clean, 1 findings, and 2
      invalid input/internal failure. Run it directly against super-gsd/skills.
      Add only a pointer and applicability statement to CLAUDE-OVERLAY.md so
      devcp-local skills receive the standard without duplicating its prose.
    output_contract: >
      One documented description contract and one mechanical lint protect all
      repo-owned super-gsd skills, while propagated overlay guidance applies the
      same contract to instance-local skills.
    hypothesis: >
      A small frontmatter lint catches descriptions too weak for routing while
      human-readable trigger/boundary/negative guidance supplies the semantic
      standard that cannot be inferred safely by lexical code.
    falsifier: >
      Either negative fixture starts green; the production tree is not scanned;
      missing or one-noun descriptions pass; a compliant description fails;
      malformed YAML crashes or echoes description content; a second standard
      is copied into the overlay; unrelated skills are rewritten; or T3 is not
      independently revertable.
    stop_rule: >
      Stop after fixture falsifiers and the real super-gsd/skills lint exit as
      expected, classifier/KB-shadow regressions exit 0, the diff matches the
      four listed files, and T3 is one independently revertable commit.
    verification_cmd: >
      node super-gsd/tools/skill-description-lint/lint.cjs --skills-dir super-gsd/skills &&
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case description-lint &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
    expected_ATC_tier: GATE
  - id: P159-T4
    type: vtp-mcp-tool-family-triage
    agent: codex
    model: codex
    depends_on: ['P159-T1']
    files_touched:
      - super-gsd/registry/session-governance-hooks.yaml
      - super-gsd/registry/skill-routing.yaml
      - super-gsd/scripts/lib/skill-routing-registry.cjs
      - super-gsd/hooks/sgsd-intent-classifier.cjs
      - super-gsd/scripts/lib/demand-baseline-ledger.cjs
      - super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
    input_contract: >
      Work red-first with isolated project config and production-stdin fixtures.
      Encode the RECORDED layer-routing rule verbatim, not a rediscovered
      heuristic: book/paper/transcript content -> vtp_search_substrate;
      people/projects/ideas/analyses -> wiki_search family; end-to-end ->
      vtp_route_and_retrieve; meeting export -> /vtp-implementation-pack;
      triage verdicts -> vtp_triage advisory. Add tool-family rows as shadow
      enforcement with fixed surface IDs/actions and no directives. Add a
      separate anchored meeting-export prompt-time suggestion row plus compiled
      fallback parity; T2's meeting-import row remains independently owned.
      Make specific meeting export, triage-verdict, and end-to-end signatures
      outrank/exclude generic transcript/entity content so one fixture selects
      one correct surface. Obtain the canonical server name by calling the P157
      vtp-readiness registry loader, then establish availability solely by a
      cheap parse of project .mcp.json and own-property presence under
      mcpServers; do not inspect/execute command or args and do not probe
      liveness. Missing/malformed config or missing canonical key is silent and
      appends one existing-ledger mcp_server_unregistered row containing only
      stable IDs/reason codes. For every available T4 route that fires, reuse
      the P152 shadow/decision append and extend the P151 ledger with one
      recordRoutedDemand-style helper that writes no query/note: fixed
      artefact_kind/surface, adequate=false, reason=no_enrichment_attempted,
      zero VTP calls, measured classifier latency, an incremented unique
      denominator, and a shared decision_id for idempotent lineage. Treat the
      meeting-export suggestion as a fired T4 route too. Keep all recording
      fire-and-forget and after the P158 origin gate. Tests monkeypatch or deny
      net/http/https/dns/fetch/child_process and use sentinel config values to
      prove zero liveness work and zero disclosure; a registered but deliberately
      non-runnable command must still count as available.
    output_contract: >
      KB-shaped prompts accrue one mutually exclusive, availability-guarded
      lexical surface decision and one text-free Phase-0 demand row. Tool-level
      routes remain shadow-only, meeting export suggests an installed skill,
      hooks never invoke anything, and registration means config presence only.
    hypothesis: >
      A names-only config guard plus a fixed lexical precedence table can expose
      real VTP surface demand without coupling the 2s hook to MCP liveness or
      prematurely promoting tool routes.
    falsifier: >
      A red direction starts green; any recorded mapping is changed or co-fires;
      transcript content beats explicit meeting export; an unregistered server
      emits a suggestion/shadow/demand row; a registered broken command is
      rejected; MCP/network/process work occurs; any row contains prompt/config/
      entity/error text; a fired route lacks or duplicates its demand row;
      replay increments the denominator; P151/P152/P158 regress; YAML/fallback
      drift; or T4 cannot be reverted independently after T1.
    stop_rule: >
      Stop after registered/unregistered, mapping precedence, no-liveness,
      idempotent-demand, and text-free leak cases pass; demand/loader/classifier/
      KB-shadow regressions exit 0; the diff matches the six listed files; and
      T4 is one independently revertable commit after T1.
    verification_cmd: >
      node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case vtp-tool-family &&
      node super-gsd/scripts/lib/demand-baseline-ledger.cjs --self-test &&
      node super-gsd/tests/demand-baseline/assert-ledger.cjs &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test &&
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs
    expected_ATC_tier: GATE
---

# P159 - Skill-Routing Expansion

Four independently revertable commits implement the operator-locked T1-T4
scope. T1 is the shared availability seam; T2 and T4 consume it. T3 is an
independent documentation/lint unit. All routing remains anchored lexical,
shadow or suggestion only, text-free in evidence, and downstream of P158's
automated-turn origin gate.
