# P146 Plan REVISION 2 — surgical block replacement (revision 1 REGRESSED)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Revision 1 failed: it regenerated the whole plan from scratch, dropped `tasks`
and `semantic_acceptance_criteria` entirely (schema INVALID: SCHEMA-01 +
SCHEMA-09), renamed frontmatter keys, and invented new DEFERRED/DEVIATION text.
Do NOT regenerate the plan.

## What to output — EXACTLY two fenced blocks, nothing else

Block 1, fenced as ```yaml, labelled by its first line being
`semantic_acceptance_criteria:` — the COMPLETE replacement for that key.

Block 2, fenced as ```yaml, labelled by its first line being `tasks:` —
the COMPLETE replacement for that key.

No prose before, between, or after. No other frontmatter keys. The orchestrator
splices these two blocks into the existing validated plan file verbatim, so
YAML indentation must match the current blocks exactly (2-space list indent
under the top-level key, as shown below).

## Findings to resolve (from the NOGO plan-check)

**CRIT-1 — stub-satisfiable ACs.** AC-146a/b/c pass with stubs today:
hardcoded SessionStart text, hardcoded `/sgsd-triage`, and `--self-test` exit 0
prove nothing. Rewrite those criteria so a stub CANNOT pass:
 - Drive the REAL hook entrypoint against a CONSTRUCTED TEMP repo fixture, not
   a `--self-test` flag. Self-test flags may exist for developers but must not
   be the proof surface.
 - Assert values only a real read could produce — e.g. temp repo STATE declares
   `current_phase: "873"` and the injected contract must contain 873.
 - Classifier criterion must assert BOTH a positive (planning prompt → the
   directive appears) AND a negative control (a trivial/execution prompt →
   the directive does NOT appear) in the same criterion, so a hardcoded
   emitter fails the negative half.
 - Quality-gate criterion must send a real PostToolUse payload naming a real
   edited file in the temp fixture, then assert the APPENDED JSONL row's field
   values match that fixture's phase and file path, and have the cockpit
   reader consume THAT row.

**CRIT-2 — punted decision.** Decide the PostToolUse matcher NOW. The live
harness file-mutation tools are `Edit`, `Write`, `NotebookEdit` — there is NO
`MultiEdit` in this harness. Put the matcher in the relevant task's
output_contract and state the degradation rule: unknown tool name → no row,
exit 0, never block.

**CRIT-3 — DAG/file collision.** `gate-evidence-log.cjs`,
`.planning/metrics/gate-evidence.jsonl`, and
`super-gsd/registry/session-governance-hooks.yaml` are touched by multiple
tasks; T146-03/T146-05 also overlap shared state helpers. Codex executor
dispatches are SERIAL with exclusive workspace write access. For every shared
file, name the OWNING task (creates it) in that task's output_contract; later
tasks may only append/register and must say so. Ensure `depends_on` yields one
unambiguous total order.

**WARN-1 — latency not asserted.** The bench criterion must parse the recorded
`p95_ms` from the JSONL row and FAIL if absent or >= 1000, and assert the
iteration count row exists. Exit 0 alone is insufficient.

**WARN-2 — T146-05 oversized.** Split it into a producer task (PostToolUse
quality-gate hook + evidence rows) and a reader task (cockpit adapter / MCP
consumer). BOTH stay inside P146 — the VTP directive is explicit that AC-146c
is incomplete without a reader. Renumber subsequent tasks accordingly.

## Preserve exactly
Every other field of every task (agent, model, type, hypothesis, falsifier,
stop_rule, input_contract, traces_to, expected_ATC_tier) unless a finding
requires the change. Keep `agent: "gsd-executor"` and `model: "codex"` as-is.
Keep all verification commands Windows-safe, deterministic, network-free, and
free of any chmod dependence.

## CURRENT semantic_acceptance_criteria block (replace this)
semantic_acceptance_criteria:
  - input: >
      A real SessionStart hook payload from an sg-launched manual session in this SGSD repo.
    expected_outcome: >
      The hook exits 0 and injects a first-response governance contract containing the ATC tier table, v3.5 milestone, and active phase 146 with no operator action.
    verification_cmd: >
      powershell -NoProfile -Command "$payload=@{hook_event_name='SessionStart';cwd=(Get-Location).Path;source='startup';session_id='ac146a'} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-session-start.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join \"`n\"); if ($text -notmatch 'Governance Contract' -or $text -notmatch 'ATC' -or $text -notmatch 'v3.5' -or $text -notmatch '146') { exit 1 }"
  - input: >
      A manual-session planning prompt asking how to plan the next phase.
    expected_outcome: >
      The UserPromptSubmit classifier exits 0, emits a visible /sgsd-triage directive, and records only a routing decision without making semantic judgments.
    verification_cmd: >
      powershell -NoProfile -Command "$payload=@{hook_event_name='UserPromptSubmit';cwd=(Get-Location).Path;prompt='Can you plan the next phase and write the implementation plan?';session_id='ac146b'} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join \"`n\"); if ($text -notmatch '/sgsd-triage' -or $text -match 'decision.:.block') { exit 1 }"
  - input: >
      A PostToolUse source-edit payload in a temporary SGSD-shaped repo whose STATE frontmatter declares current_phase 999 and whose phase has no matching PLAN-LOCKED file.
    expected_outcome: >
      The quality gate exits 0, appends a missing-plan row to gate-evidence.jsonl, and the cockpit adapter reads that row as a visible governance signal.
    verification_cmd: >
      powershell -NoProfile -Command "node super-gsd/hooks/sgsd-quality-gate.js --self-test-report-only-missing-plan --record .planning/metrics/gate-evidence.jsonl; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node super-gsd/tools/cockpit-state/adapter.cjs --self-test-gate-evidence-reader; exit $LASTEXITCODE"
  - input: >
      SessionStart, UserPromptSubmit, and PostToolUse payloads whose cwd is a normal directory with no .planning ancestor.
    expected_outcome: >
      All hooks exit 0 quietly, write no SGSD metrics, and emit no governance context.
    verification_cmd: >
      powershell -NoProfile -Command "$tmp=Join-Path ([IO.Path]::GetTempPath()) ('sgsd-nonrepo-' + [guid]::NewGuid()); New-Item -ItemType Directory -Path $tmp | Out-Null; try { foreach ($pair in @(@('sgsd-session-start.js','SessionStart'),@('sgsd-intent-classifier.cjs','UserPromptSubmit'),@('sgsd-quality-gate.js','PostToolUse'))) { $payload=@{hook_event_name=$pair[1];cwd=$tmp;prompt='hello';tool_name='Edit';tool_input=@{file_path='x.txt'};session_id='ac146d'} | ConvertTo-Json -Depth 5 -Compress; $out=$payload | node (Join-Path 'super-gsd/hooks' $pair[0]); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join '').Trim().Length -gt 0) { exit 1 } } } finally { if ($tmp -like (Join-Path ([IO.Path]::GetTempPath()) 'sgsd-nonrepo-*')) { Remove-Item -LiteralPath $tmp -Recurse -Force } }"
  - input: >
      Two hundred real UserPromptSubmit planning prompts run through the local Node classifier in this repo.
    expected_outcome: >
      The benchmark exits 0, records a p95_ms value in gate-evidence.jsonl, and that p95_ms is below 1000 ms.
    verification_cmd: "node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt \"How should we plan this?\" --record .planning/metrics/gate-evidence.jsonl"
  - input: >
      Repo-local hook installation into a target repo with a fake home settings file containing env-like secret sentinel keys.
    expected_outcome: >
      The installer writes only target .claude/settings.json, uses install-time absolute target-repo paths in hook args, and does not copy or read home env values.
    verification_cmd: "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"

## CURRENT tasks block (replace this)
tasks:
  - id: "T146-01"
    type: "shared-helper"
    agent: "gsd-executor"
    model: "codex"
    depends_on: []
    files_touched:
      - ".planning/STATE.md"
      - "super-gsd/scripts/lib/sgsd-state.cjs"
      - "super-gsd/scripts/lib/gate-evidence-log.cjs"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146a"
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command "foreach ($f in @('super-gsd/scripts/lib/sgsd-state.cjs','super-gsd/scripts/lib/gate-evidence-log.cjs')) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"
    verification_cmd: >
      powershell -NoProfile -Command "foreach ($f in @('super-gsd/scripts/lib/sgsd-state.cjs','super-gsd/scripts/lib/gate-evidence-log.cjs')) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; node -e 'const s=require(\"./super-gsd/scripts/lib/sgsd-state.cjs\"); const root=s.findSgsdRoot(process.cwd()); const st=s.readState(root); if (!root || !st || st.milestone !== \"v3.5\") process.exit(1); if (st.phaseSource === \"status_prose\") process.exit(2);'"
    input_contract: >
      Use RESEARCH Q3/Q6/Q9 and CONTEXT constraints. Canonical STATE frontmatter phase key is current_phase. Keep legacy phase as read-only compatibility. Do not parse prose status.
    output_contract: >
      Add shared SGSD root, STATE frontmatter, active phase, PLAN-LOCKED glob, and gate-evidence envelope writer helpers. Add current_phase: "146" to .planning/STATE.md if absent so this phase has canonical frontmatter data.
    hypothesis: >
      A shared resolver and never-throw evidence writer remove duplicated phase parsing while giving hooks and watchdog one deterministic fail-open path.
    falsifier: >
      Any caller parses prose status for a phase, throws in a non-SGSD repo, writes malformed JSONL, or cannot distinguish missing phase frontmatter from a real phase.
    stop_rule: >
      Node syntax checks pass, resolver reads milestone v3.5 from real STATE frontmatter without prose parsing, and gate-evidence writer can append envelope-v1 rows without throwing.
    expected_ATC_tier: GATE

  - id: "T146-02"
    type: "repo-local-installer"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-01"
    files_touched:
      - ".claude/settings.json"
      - "super-gsd/install.sh"
      - "super-gsd/scripts/merge-settings.js"
      - "super-gsd/config/settings-overlay.json"
      - "super-gsd/config/repo-settings-overlay.json"
    traces_to:
      - "AC-146a"
      - "AC-146b"
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"
      - >
        powershell -NoProfile -Command "Select-String -Path .claude/settings.json -Pattern 'SessionStart','UserPromptSubmit','PostToolUse' | Out-Null"
    verification_cmd: "node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks"
    input_contract: >
      Use RESEARCH Q1/Q2/Q7. Preserve merge-settings idempotency by command plus matcher, but target <repo>/.claude/settings.json only.
    output_contract: >
      Install SessionStart, UserPromptSubmit, and PostToolUse hook entries into repo-local .claude/settings.json using command: node and install-time absolute target-repo script paths in args.
    hypothesis: >
      Repo-local install-time hook wiring gives SGSD always-on governance without reading home Claude settings or depending on runtime project-dir expansion.
    falsifier: >
      The installer writes ~/.claude/settings.json, copies env keys from a home settings fixture, emits hardcoded machine paths from source, duplicates hook entries, or omits any of the three hook events.
    stop_rule: >
      Self-test installs into a temp target, proves home settings are untouched, proves no env sentinel is copied, and confirms all hook args resolve under the target repo.
    expected_ATC_tier: GATE

  - id: "T146-03"
    type: "session-start-hook"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-01"
      - "T146-02"
    files_touched:
      - "super-gsd/hooks/sgsd-session-start.js"
      - "super-gsd/scripts/lib/sgsd-state.cjs"
      - "super-gsd/scripts/lib/gate-evidence-log.cjs"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146a"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command "$payload=@{hook_event_name='SessionStart';cwd=(Get-Location).Path;source='startup';session_id='t146-03'} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-session-start.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join \"`n\"); if ($text -notmatch 'Governance Contract' -or $text -notmatch 'ATC' -or $text -notmatch 'v3.5' -or $text -notmatch '146') { exit 1 }"
    verification_cmd: >
      powershell -NoProfile -Command "$payload=@{hook_event_name='SessionStart';cwd=(Get-Location).Path;source='startup';session_id='t146-03'} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-session-start.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $text=($out -join \"`n\"); if ($text -notmatch 'Governance Contract' -or $text -notmatch 'ATC' -or $text -notmatch 'v3.5' -or $text -notmatch '146') { exit 1 }"
    input_contract: >
      Use Claude hook stdout/additionalContext behavior from RESEARCH Q1 and active phase resolver from T146-01.
    output_contract: >
      SessionStart injects the governance contract with ATC tier table, gate table, mode confirmation note, and active milestone/phase. Non-SGSD cwd exits quiet 0.
    hypothesis: >
      Injecting the contract from the runtime hook makes governance visible in manual sessions before the model can omit or reinterpret prompt-resident instructions.
    falsifier: >
      An sg-launched SessionStart payload produces no first-turn governance context, lacks active milestone/phase, blocks the session, or emits context in a non-SGSD directory.
    stop_rule: >
      Real repo SessionStart payload prints the contract and non-SGSD payload exits 0 with empty output.
    expected_ATC_tier: GATE

  - id: "T146-04"
    type: "intent-classifier"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-01"
      - "T146-02"
    files_touched:
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/registry/session-governance-hooks.yaml"
      - "super-gsd/scripts/lib/gate-evidence-log.cjs"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146b"
      - "AC-146d"
    acceptance_commands:
      - >
        powershell -NoProfile -Command "$payload=@{hook_event_name='UserPromptSubmit';cwd=(Get-Location).Path;prompt='Can you plan the next phase and write the implementation plan?';session_id='t146-04'} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join \"`n\") -notmatch '/sgsd-triage') { exit 1 }"
      - "node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt \"How should we plan this?\" --record .planning/metrics/gate-evidence.jsonl"
    verification_cmd: >
      powershell -NoProfile -Command "$payload=@{hook_event_name='UserPromptSubmit';cwd=(Get-Location).Path;prompt='Can you plan the next phase and write the implementation plan?';session_id='t146-04'} | ConvertTo-Json -Compress; $out=$payload | node super-gsd/hooks/sgsd-intent-classifier.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (($out -join \"`n\") -notmatch '/sgsd-triage') { exit 1 }; node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt 'How should we plan this?' --record .planning/metrics/gate-evidence.jsonl; exit $LASTEXITCODE"
    input_contract: >
      Use RESEARCH Q5 trigger inventory and VTP directive 1. The registry shape is trigger, predicate, enforcement, with embedded defaults until P149 skill-routing.yaml exists.
    output_contract: >
      Add a local Node UserPromptSubmit classifier that lowercases prompt text, applies registry-backed lexical routes, injects /sgsd-triage for planning intent, suggests neglected SGSD skills, and records p95_ms benchmark rows.
    hypothesis: >
      Declarative lexical routing gives manual sessions visible governance nudges at millisecond-level overhead while leaving semantic judgment to /sgsd-triage and other SGSD skills.
    falsifier: >
      The classifier calls an LLM, blocks prompts, judges plan quality itself, misses a planning-shaped prompt, cannot switch registry source with one line for P149, or records p95_ms >= 1000.
    stop_rule: >
      Planning prompt emits /sgsd-triage, neglected-skill prompts route to the named skill suggestion, non-SGSD cwd exits quiet 0, and the 200-iteration bench records p95_ms below 1000.
    expected_ATC_tier: GATE

  - id: "T146-05"
    type: "quality-gate-and-cockpit"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-01"
      - "T146-02"
    files_touched:
      - "super-gsd/hooks/sgsd-quality-gate.js"
      - "super-gsd/registry/session-governance-hooks.yaml"
      - "super-gsd/scripts/lib/sgsd-state.cjs"
      - "super-gsd/scripts/lib/gate-evidence-log.cjs"
      - "super-gsd/tools/cockpit-state/adapter.cjs"
      - "super-gsd/tools/warp-mcp/server.cjs"
      - ".planning/metrics/gate-evidence.jsonl"
    traces_to:
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - "node super-gsd/hooks/sgsd-quality-gate.js --self-test-report-only-missing-plan --record .planning/metrics/gate-evidence.jsonl"
      - "node super-gsd/tools/cockpit-state/adapter.cjs --self-test-gate-evidence-reader"
    verification_cmd: >
      powershell -NoProfile -Command "node super-gsd/hooks/sgsd-quality-gate.js --self-test-report-only-missing-plan --record .planning/metrics/gate-evidence.jsonl; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node super-gsd/tools/cockpit-state/adapter.cjs --self-test-gate-evidence-reader; exit $LASTEXITCODE"
    input_contract: >
      Use RESEARCH Q1/Q6/Q9 and VTP directive 4. Confirm real PostToolUse mutation tool_name values in this harness before adding names to the registry; do not assume MultiEdit.
    output_contract: >
      Add a report-only PostToolUse quality gate that resolves active phase from STATE frontmatter, checks real PLAN-LOCKED naming, appends missing-plan evidence rows, and exposes those rows through cockpit adapter and MCP reader.
    hypothesis: >
      Evidence plus cockpit visibility gives AC-146c observability without violating the board's no edit-seam blocking constraint.
    falsifier: >
      The hook blocks or exits nonzero on edits, logs no row for a missing active-phase plan, matches unconfirmed mutation tools, or cockpit cannot surface the row within one refresh.
    stop_rule: >
      Self-test creates a temporary SGSD-shaped repo with no active PLAN, sends a confirmed mutation-tool payload, sees a gate-evidence row, and adapter self-test reads it as a cockpit signal.
    expected_ATC_tier: GATE

  - id: "T146-06"
    type: "cheap-fixes-cleanup"
    agent: "gsd-executor"
    model: "codex"
    depends_on:
      - "T146-01"
      - "T146-05"
    files_touched:
      - "super-gsd/scripts/sgsd-stop-handoff.sh"
      - "super-gsd/tools/autopilot-watchdog/check.cjs"
      - "super-gsd/config/settings-overlay.json"
      - "super-gsd/config/**/*.json"
      - "super-gsd/config/**/*.yaml"
    traces_to:
      - "AC-146c"
      - "AC-146d"
    acceptance_commands:
      - "bash -n super-gsd/scripts/sgsd-stop-handoff.sh"
      - "node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution"
      - >
        powershell -NoProfile -Command "rg 'checkpoint_threshold_percent|context_warning_percent|context_warnings|gsd-atc-slice-gate.js' super-gsd --glob '!**/*.md'; if ($LASTEXITCODE -eq 0) { exit 1 } elseif ($LASTEXITCODE -eq 1) { exit 0 } else { exit $LASTEXITCODE }"
    verification_cmd: >
      powershell -NoProfile -Command "bash -n super-gsd/scripts/sgsd-stop-handoff.sh; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; rg 'checkpoint_threshold_percent|context_warning_percent|context_warnings|gsd-atc-slice-gate.js' super-gsd --glob '!**/*.md'; if ($LASTEXITCODE -eq 0) { exit 1 } elseif ($LASTEXITCODE -eq 1) { exit 0 } else { exit $LASTEXITCODE }"
    input_contract: >
      Use RESEARCH Q4/Q8 and CONTEXT cheap-fix list. Keep DEVIATION-W out of this task because research did not prove it is a few-line isolated codex-exec.sh fix.
    output_contract: >
      Reset handoff-chain latch when latest valid row is reason refused, move autopilot-watchdog phase resolution to shared STATE frontmatter helper, unregister dead gsd-atc-slice-gate.js references, and delete dead token/context config knobs from live config.
    hypothesis: >
      These bounded cleanups remove known always-on governance distortions without changing gate semantics or widening P146 beyond session governance hooks.
    falsifier: >
      Refused handoff rows still preserve stale depth, watchdog reads phase from prose regex, dead hook registration remains live, or dead config knobs remain under super-gsd runtime config.
    stop_rule: >
      Shell syntax passes, watchdog phase self-test proves frontmatter resolution, and runtime config grep finds no dead knobs or dead hook registration.
    expected_ATC_tier: GATE
---

# P146 Session Governance Hooks PLAN-LOCKED

> For agentic workers: implement task-by-task. Each changed line must trace to one task above. Do not touch forbidden files.

## Goal

Make SGSD governance fire in every session mode through repo-local Claude hooks: SessionStart contract injection, UserPromptSubmit intent routing, and a report-only PostToolUse quality gate with cockpit visibility.

## Architecture

The runtime hook layer becomes the governance substrate. Hook scripts use shared SGSD root and STATE frontmatter helpers, declarative rule registry data, and never-throw evidence logging. Mode changes who confirms governance decisions, not which governance signals run.

The classifier routes prompts to SGSD skills and never judges their truth. The quality gate reports missing active-phase PLAN evidence after source edits but never blocks an edit seam. Cockpit reads the new gate-evidence stream so AC-146c is observable rather than a silent log-only defense.

## Required Evidence Read

- `.planning/milestones/v3.5/phases/146-session-governance-hooks/CONTEXT.md`
- `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-RESEARCH.md`
- `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-VTP-ENRICHMENT.md`
- `super-gsd/templates/plan-schema-v2.json`
- `.planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md`

## Source Audit

| Source | Status | Relevant findings used |
|---|---|---|
| CONTEXT | success | Defines SessionStart, UserPromptSubmit, PostToolUse report-only gate, board-binding constraints, and cheap fixes. |
| RESEARCH | success | Treats Q1-Q9, file list, reuse inventory, six-task decomposition, and verification commands as authoritative. |
| VTP-ENRICHMENT | success, 2 relevant hits | Hit 1 supports trigger-predicate-enforcement declarative hooks and ms-level overhead; Hit 2 requires observability via cockpit reader and limits claims to report-only evidence. |
| plan-schema-v2 | success | Requires schema_version 2, semantic_acceptance_criteria, and task id/agent/model/files_touched/input/output/hypothesis/falsifier/stop_rule. |
| P145 plan | success | Provides locked-plan frontmatter shape, task tone, allowed/forbidden file framing, rollback plan, and acceptance command style. |

## Open Decisions Locked

1. Canonical STATE phase key: use `current_phase` in `.planning/STATE.md` frontmatter. Resolver reads `current_phase` first, then legacy `phase`, and never parses prose `status`. When absent, SGSD hooks log `state_phase_missing` and continue with phase null; non-SGSD repos exit quiet 0.
2. Evidence stream: create `.planning/metrics/gate-evidence.jsonl` as a new envelope-v1 stream. Do not extend `gate-value-log.jsonl`; that stream keeps existing gate-value semantics.
3. Hook path binding: use install-time absolute paths from the target repo inside repo-local `.claude/settings.json`. Do not rely on `${CLAUDE_PROJECT_DIR}` expansion.
4. Mutation tool names: confirm actual PostToolUse mutation `tool_name` values in this harness before registry matching. `MultiEdit` is not assumed and is included only if confirmed.
5. DEVIATION-W: not folded into P146. It concerns codex-exec step-contract enforcement and research did not prove a few-line isolated fix. Keep it recorded as deferred.

## Task Decomposition Note

This plan keeps RESEARCH section 5's six tasks. The only expansion is the explicit `super-gsd/registry/session-governance-hooks.yaml` file, required by VTP directive 1 so P149 can swap to `super-gsd/registry/skill-routing.yaml` with a one-line registry-source change.

## Implementation Notes

SessionStart should prefer hook JSON `hookSpecificOutput.additionalContext` when supported and fall back to stdout context. It must include ATC tiers, gate expectations per mode, active milestone, active phase, and the report-only nature of PostToolUse governance.

UserPromptSubmit uses deterministic lexical rules from the registry. Planning-shaped prompts route to `/sgsd-triage`; neglected-skill signatures route to the relevant SGSD skill suggestion. It must not emit `decision: "block"`.

PostToolUse quality gate reads confirmed mutation tools from the registry, resolves SGSD root from `payload.cwd || process.cwd()`, resolves active phase from STATE frontmatter, checks real `{NN}-*-PLAN-LOCKED.md` files, and appends evidence only. It never blocks, even on missing plans.

Cockpit adapter and MCP reader must consume `gate-evidence.jsonl`; AC-146c is incomplete if only the hook writer exists.

## Deferred

- DEFERRED-A: selfTestCliGuard non-TTY forcing.
- DEFERRED-B: 3-way CLI-default drift guard.
- DEFERRED-C: inert trust/hook resolver fields for P148/P150.
- DEVIATION-1: codex-exec finalize probe simplification.
- DEVIATION-W: codex-exec enforces the 5-line ATC contract on every `--step`; keep for a codex-exec follow-up because P146 has no evidence it is a bounded cheap fix.
