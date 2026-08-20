---
schema_version: 2
phase: 157
slug: vtp-readiness
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 1
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
depends_on: ['155']
intent: >
  Make VTP topology a durable names-only contract, run three probes through
  automatic Rule 0 and manual readiness, and show only pending-ledger depth.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      Production vtp-services.yaml and malformed copies that add a host/default/
      value, rename vtp-kb, omit an env name, or change a locked path or pin.
    expected_outcome: >
      Production validates with canonical name, six env names, paths, pins,
      lock, pending ledger, and ingest pointer. Mutations are refused by stable
      reason code without echoing their fake inserted values.
    verification_cmd: 'node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case registry-contract'
  - input: >
      Isolated fake home with fake VTP source/dist, local TCP listener reached
      by fake QDRANT_URL, and fake sqlite target. Execute production Rule 0 and
      production manual on-demand readiness.
    expected_outcome: >
      Both entrypoints execute three probes and report fresh dist, Qdrant
      connect, and evidence presence. Manual proof traverses canonical routing
      and real dispatch, not imported checker functions.
    verification_cmd: 'node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case readiness-entrypoints-green'
  - input: >
      Both entrypoints with dist older than src, unreachable fake Qdrant, and
      absent fake sqlite; fake env values carry sentinels and children receive
      a scrubbed environment.
    expected_outcome: >
      Both take findings with three results. Freshness says reconnect MCP,
      never rebuild. Only env names/reason codes appear; no sentinel, URL,
      credential, host, port, path, or raw error reaches output or evidence.
    verification_cmd: 'node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case readiness-entrypoints-degraded'
  - input: >
      Real install.sh --install-global into isolated fake HOME/USERPROFILE where
      pending-ledger.jsonl has three opaque rows and settings have unrelated
      SessionStart hooks. Execute the command selected from merged settings.
    expected_outcome: >
      Install replaces stale hook; repeat merge leaves one registration and
      preserves unrelated hooks. Output is only VTP pending-ledger depth: 3;
      no network, disclosure, or byte change; absent ledger exits 0 silently.
    verification_cmd: 'node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case session-start-depth'
known_deadends:
  - Do not store or print env values, URLs, credentials, hosts, ports, operator paths, defaults, or raw errors; use env names and stable reason codes only.
  - Do not inherit the operator environment in fixtures; use a minimal launch allowlist, isolated fake HOME/USERPROFILE, and fake VTP env values.
  - Do not prove review change 7 by importing probes or grepping prose; execute Rule 0 and production manual routing.
  - Do not add a gate or edit gates.yaml; extend existing readiness policy and routing.
  - Do not put network, MCP, child-process, or liveness work in SessionStart hooks.
  - Do not recommend rebuilding for a stale MCP child; the action is reconnect MCP.
  - Do not add MCP tools, change Voice-Text-Plan, start services, or block a runnable degraded path when optional VTP is absent.
tasks:
  - id: P157-T1
    type: vtp-topology-registry
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/registry/vtp-services.yaml
      - super-gsd/tools/vtp-readiness/registry.cjs
      - super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs
    input_contract: >
      Work red-first and record registry-contract failing before registry/loader
      exist. Add schema_version 1 with canonical MCP vtp-kb and adjacent names
      jcl-internal, jcl-products, qmd. Record only QDRANT_URL, VTP_EMBED_PYTHON,
      VTP_EVIDENCE_STORE_URL, CLARITY_MONGO_URI, CLARITY_MONGO_DB, CLARITY_ES_URL.
      Lock ~/Voice-Text-Plan/ with src/ and dist/cli.js; canonical KB_DIR ~/.vtp/;
      mirror-only ~/Voice-Text-Plan/kb-data/; ~/.vtp/pending-ledger.jsonl;
      ~/.vtp/ingest.lock; config/ingest-manifest.yaml. Record Qdrant JS 1.18.0,
      bge-base-en-v1.5, and sentence-transformers/torch NEVER-upgrade.
      registry.cjs loads pinned js-yaml; rejects duplicate keys, wrong exact
      facts or single-writer semantics, value/default/url/uri/host/endpoint/
      credential fields, and embedded host scalars; and returns stable reason
      codes without rejected values. Bad sentinel registries stay in temp.
    output_contract: >
      A durable names-only registry and loadRegistry({registryPath, homeDir})
      returning validated home-expanded local paths without logging values.
    hypothesis: >
      Strict topology data stays probeable without making configuration or
      secrets repository data.
    falsifier: >
      Red starts green; identity/env/path/pin/lock is wrong; canonical and mirror
      blur; forbidden value is accepted or echoed; YAML is unpinned; unlisted
      files change; or T1 is not one revertable commit.
    stop_rule: >
      Stop after red evidence, registry-contract green with zero sentinel leak,
      a three-file diff, and one independently revertable T1 commit.
    verification_cmd: 'node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case registry-contract'
    expected_ATC_tier: GATE
  - id: P157-T2
    type: vtp-readiness-probes-and-entrypoints
    agent: codex
    model: codex
    depends_on: ['P157-T1']
    files_touched:
      - super-gsd/tools/vtp-readiness/run.cjs
      - super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs
      - super-gsd/registry/skill-routing.yaml
      - super-gsd/scripts/lib/skill-routing-registry.cjs
      - super-gsd/skills/sgsd-readiness/SKILL.md
      - super-gsd/agents/sgsd-milestone-readiness.md
      - super-gsd/agents/sgsd-phase-readiness.md
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: >
      Implement review change 7 verbatim: Exercise T5 through automatic Rule 0
      and manual readiness, not only its checker. Record two red runs: Rule 0
      CLI absent, and production skillRoutingConsult with on-demand/manual/
      execute=true skipping readiness because its row has no dispatch. Build
      run.cjs on T1 with --trigger auto|manual|semi, --project-dir, optional
      --registry, and JSON limited to trigger, aggregate status, probe id,
      status, env_name when applicable, and stable reason_code.
      Freshness compares dist/cli.js with newest regular src file without
      following symlink escapes; stale warns with reconnect MCP and no rebuild.
      Qdrant checks QDRANT_URL presence, internally parses it, and makes one
      bounded TCP connect; no HTTP and no URL part/socket error output.
      Evidence-store checks VTP_EVIDENCE_STORE_URL presence, internally resolves
      sqlite file URL or path, and accepts an existing file or directory; no
      target/error output. Exit 0 all-pass, 1 findings/degraded, 2 input/registry/
      internal failure. Add dispatch to canonical on-demand readiness YAML row
      using {mode}/{project_dir}, success [0], verdict [1], bounded timeout;
      update compiled fallback equivalently.
      Replace manual skill legacy-only dispatch with production on-demand
      consult. Both readiness agents consume these three PROBE LOG rows rather
      than copy probes. Put exact run.cjs --trigger auto command in Rule 0 before
      manifest classification; exit 1 follows existing DEGRADED-PATH policy and
      exit 2 is execution failure. Phase readiness reuses runner for drift.
      Tests use fake paths/envs, a disposable listener, scrubbed child envs, and
      fixed diagnostics that never interpolate child output or fake values.
    output_contract: >
      One runner owns three probes; Rule 0 executes it automatically, manual
      readiness uses canonical routing and real dispatch, and readiness agents
      report identical results without a duplicate gate.
    hypothesis: >
      A shared runner detects degradation early while keeping optional VTP and
      values out of readiness evidence.
    falsifier: >
      Either red starts green; entrypoint omits a probe; manual proof stubs
      dispatch/imports run.cjs; auto bypasses Rule 0; outputs differ; fake value,
      path, address, or raw error leaks; stale says rebuild or blocks; hook probes;
      gates.yaml changes; routing/orchestrator regressions fail; or T2 is not
      independently revertable after T1.
    stop_rule: >
      Stop when green/degraded actual-entrypoint cases and leak scans pass,
      routing/orchestrator regressions pass, no gate/hook file changed, and T2
      is one revertable commit after T1.
    verification_cmd: >
      node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case readiness-entrypoints &&
      node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test &&
      node super-gsd/scripts/lib/orchestrator-hooks.cjs --self-test
    expected_ATC_tier: GATE
  - id: P157-T3
    type: session-start-pending-ledger-depth
    agent: codex
    model: codex
    depends_on: ['P157-T2']
    files_touched:
      - super-gsd/hooks/sgsd-vtp-pending.js
      - super-gsd/config/settings-overlay.json
      - super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs
    input_contract: >
      Work red-first: session-start-depth fails because merged global settings
      have no VTP command. Reuse P155 activation exactly: isolated fake home and
      project; distinguishable stale live hook; unrelated SessionStart settings;
      real install.sh --init-project --install-global --skip-cockpit-deps; parse
      merged settings; execute its command with genuine SessionStart JSON; install
      again for idempotence. Register node ~/.claude/hooks/sgsd-vtp-pending.js.
      Reuse existing JS install loop and merge-settings.js unchanged.
      Hook validates SessionStart, resolves only ~/.vtp/pending-ledger.jsonl,
      counts non-empty records without parsing or retaining text, and emits
      exactly VTP pending-ledger depth: N plus newline. Missing/unreadable ledger,
      malformed/non-SessionStart input, and non-VTP homes exit 0 silently. Do not
      import or invoke net, http, https, dns, fetch, child_process, MCP, shell, or
      service envs. Fixture uses three opaque sentinel rows, scrubbed env, byte
      hashes, and fixed diagnostics; assert exact stdout, empty stderr, unchanged
      bytes, stale replacement, unrelated-hook preservation, and one registration.
    output_contract: >
      A globally installed settings-overlay SessionStart hook emits one numeric
      backlog row, stays silent without VTP, and cannot probe or disclose content.
    hypothesis: >
      A cheap count-only hook adds useful startup visibility without coupling
      SessionStart to VTP availability or secrets.
    falsifier: >
      Red starts green; source-only execution replaces merged-settings proof;
      install leaves stale/duplicate hook or removes unrelated hooks; output is
      not exactly the count, leaks text, or appears without ledger; network or
      process code exists; real VTP env is inherited; bytes change; install or
      merge script is edited; P155 regression fails; or T3 is not revertable.
    stop_rule: >
      Stop after red evidence, real-install and absent-ledger cases green, P155
      regression green, a three-file diff, and one revertable T3 commit.
    verification_cmd: >
      node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case session-start-depth &&
      node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs all
    expected_ATC_tier: GATE
---

# P157 - VTP Readiness

Three serial commits close the carve-out without padding. T1 owns the stable
topology contract. T2 consumes it across two production readiness entrypoints.
T3 reuses the proven installer/settings seam and stays independent of liveness
probes. No VTP source, MCP tool, hook network path, or gates registry changes.
