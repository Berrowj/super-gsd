---
schema_version: 2
phase: "152"
slug: "kb-triage-shadow"
milestone: "v3.6-vtp-bridge"
status: "PLANNED"
depends_on: ["151"]
intent: "Text-free shadow classifier that logs whether a KB-directed prompt WOULD route to vtp-query-triage, firing nothing; the measurement instrument gating any future hard gate. Board + 2x Codex challenge design; conditions non-negotiable."
execution_mode: "serial-codex"
tasks:
  - id: "P152-T1"
    type: "baseline-snapshot"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/docs/kb-triage-shadow/vtp-query-triage-baseline-2026-08-12.md"
    input_contract: >
      REPO-BOUNDARY SAFE. vtp-query-triage is a VTP product skill at the user-global ~/.claude/skills/vtp-query-triage/SKILL.md — super-gsd neither owns nor versions it, so DO NOT edit it. Instead capture a read-only frozen baseline INSIDE super-gsd: copy the skill's current self-invocation / trigger prose verbatim into an in-repo snapshot file, record a sha256 content hash of that prose, and stamp FROZEN-BASELINE-2026-08-12. Note that strengthening the VTP skill itself is a separate VTP-lane change, deferred. No other files; no mutation of the global skill.
    output_contract: >
      super-gsd/docs/kb-triage-shadow/vtp-query-triage-baseline-2026-08-12.md contains the verbatim current self-invocation prose of the global vtp-query-triage skill, a sha256 hash of that prose, a FROZEN-BASELINE-2026-08-12 stamp, and a one-line note that VTP-side strengthening is deferred to the VTP lane. The global skill is byte-unchanged.
    hypothesis: "A read-only in-repo snapshot + hash of the soft path gives the 28-day shadow window a stable, version-controlled baseline without super-gsd mutating a VTP product file."
    falsifier: >
      The global ~/.claude/skills/vtp-query-triage/SKILL.md is modified; or the snapshot lacks the verbatim prose, the sha256 hash, or the FROZEN-BASELINE-2026-08-12 stamp; or the doc claims a hard gate ships now.
    stop_rule: >
      Stop after the in-repo baseline snapshot is written; never touch the global skill.
    verification:
      commands:
        - "grep -c 'FROZEN-BASELINE-2026-08-12' super-gsd/docs/kb-triage-shadow/vtp-query-triage-baseline-2026-08-12.md"
        - "grep -ciE 'sha256|[a-f0-9]{64}' super-gsd/docs/kb-triage-shadow/vtp-query-triage-baseline-2026-08-12.md"
  - id: "P152-T2"
    type: "shadow-classifier"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/registry/session-governance-hooks.yaml"
      - "super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
    input_contract: >
      Add a `shadow` enforcement kind to the classifier and a kb-lookup-triage route. The shadow kind evaluates the match and appends ONE text-free telemetry row, injecting NOTHING into the prompt. The route trigger is pure anchored-lexical for KB intent; verb exclusions (build|fix|run|test|file) are START-ANCHORED and SUBORDINATE to a strong KB positive.
    output_contract: >
      A prompt matching the kb-lookup-triage route emits zero prompt injection and appends a text-free row to .planning/metrics/kb-triage-shadow.jsonl containing ONLY {ts, decision_id, matcher_version, matched_signature_ids[], soft_path_action, latency_ms, operator_label(null)}. No prompt text, excerpt, or entity string is ever written. "what did Ada say about fixing the customs flow" MATCHES (KB positive beats the 'fix' exclusion); "fix the failing test" does NOT match.
    hypothesis: "A shadow kind can measure would-fire on KB intent with zero prompt injection and zero PII in telemetry, with KB positives overriding verb exclusions."
    falsifier: >
      Any prompt text/excerpt/entity string appears in the ledger; the shadow route injects anything into the prompt; a KB-positive-plus-verb prompt is suppressed; a pure imperative ("fix the test") matches; or p95 added latency is not bounded/anchored.
    stop_rule: >
      Stop after the shadow kind + route + text-free ledger + self-test pass; do NOT add a directive gate or /triage alias.
    verification:
      commands:
        - "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
        - "node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test"
  - id: "P152-T3"
    type: "metric-doc"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/docs/KB-TRIAGE-SHADOW.md"
    input_contract: >
      Document the locked promote-or-kill metric and how to read the shadow ledger. Documentation only; no enforcement.
    output_contract: >
      KB-TRIAGE-SHADOW.md states the 28-day window, the exact promote thresholds (>=20 adjudicated shadow fires, FP/(TP+FP) <= 5%, >=5 true incremental catches missed by soft path, incremental catches/TP >= 20%, p95 added latency <= 1 ms), the KILL condition (soft path already reliable), the text-free telemetry schema, and that operator_label is how a shadow fire gets adjudicated.
    hypothesis: "A locked, numeric promote-or-kill contract prevents perpetual tuning and makes the gate decision falsifiable."
    falsifier: >
      Any threshold is hand-wavy/undefined, or the doc implies the hard gate ships before the window, or it describes logging prompt text.
    stop_rule: >
      Stop after the doc is written.
    verification:
      commands:
        - "grep -c 'promote' super-gsd/docs/KB-TRIAGE-SHADOW.md"
        - "test -f super-gsd/docs/KB-TRIAGE-SHADOW.md"
semantic_acceptance_criteria:
  - id: "SCHEMA-09"
    input: >
      The real prompt "what did Ada say about fixing the customs flow" and the real prompt "fix the failing test", run through the classifier shadow route.
    expected_outcome: >
      The first MATCHES (KB positive overrides the 'fix' verb exclusion) and logs a text-free row; the second does NOT match. Asserted in assert-shadow.cjs.
    verification_cmd: "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
  - id: "DLB-07"
    input: >
      The kb-triage-shadow.jsonl produced by a shadow fire.
    expected_outcome: >
      Every row contains ONLY opaque/structured fields (ts, decision_id, matcher_version, matched_signature_ids, soft_path_action, latency_ms, operator_label); grep finds no prompt text, excerpt, or entity string.
    verification_cmd: "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
  - id: "SCHEMA-09"
    input: >
      A prompt that matches the shadow route, run through the classifier.
    expected_outcome: >
      Zero characters are injected into the prompt/output by the shadow kind (it logs only). Asserted by the classifier self-test.
    verification_cmd: "node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test"
---

## Goal
Ship the text-free KB-triage shadow classifier + frozen self-invocation baseline
+ locked metric doc. Fires nothing. Hard gate deferred to the 28-day data.

## Locked promote-or-kill metric (Codex challenge)
28-day window; PROMOTE report_only→directive only if: ≥20 adjudicated shadow
fires; FP/(TP+FP) ≤ 5%; ≥5 true incremental catches the soft path missed;
incremental catches / TP ≥ 20%; p95 added latency ≤ 1 ms. Else KILL.

## Source Audit
- CONTEXT.md (this phase dir).
- Decision Memo — .planning/decisions/2026-08-12-kb-triage-gate-MEMO.md (board + 2x Codex challenge; all conditions).
- Board seats — Architect (a/pure-lexical/shadow-first), Contrarian (measure-first/text-free).
