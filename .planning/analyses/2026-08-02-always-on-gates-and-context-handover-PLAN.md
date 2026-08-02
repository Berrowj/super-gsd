
# 2026-08-02 Always-On Gates And Context Handover PLAN

## 1. Problem statement

Defect 1: SGSD quality gates are declared as hard controls but only enforced by orchestration prose. `super-gsd/registry/gates.yaml` declares `per-dispatch-ATC` as `enforcement_mode: hard-halt`, `gate_sampling_tier: always`, triggered by `code_files_changed_count > 0`, with `escalation: halt` at lines 37-58; `phase-level-ATC` appears at lines 60-74 and `MUDA-waste-audit` at lines 136-160. The real registry implementation exists in `super-gsd/scripts/lib/gates-registry.cjs`, with `loadGates` / `getGate` / `shouldFire` and supporting predicate, sampling, and value-log libraries. However, the only consumer that makes dispatch decisions is prose inside `super-gsd/skills/sgsd-orchestrate/SKILL.md`, specifically phase ATC at lines 1235-1448, MUDA at 1480-1576, spec compliance at 2149-2158, and per-dispatch ATC at 2161-2185. Outside `/sgsd-orchestrate`, ordinary `Edit`, `MultiEdit`, `Write`, or commits can mutate source without any mechanical gate.

Defect 2: SGSD context handover is not a real compaction-safe transfer mechanism. `super-gsd/registry/hooks.yaml:115` declares a `gsd-checkpoint-writer` for `Stop | PreCompact`, but no `PreCompact` hook exists. The registered checkpoint writer is actually `PostToolUse`/`Bash` and writes `.planning/ORCHESTRATOR-CHECKPOINT.json`, not the declared `.planning/ORCHESTRATOR-CHECKPOINT.md`. `super-gsd/hooks/gsd-context-monitor.js` tracks wall-clock and tool-call count in `$TMPDIR/gsd-phase-timer.json`; it never sees the runtime context window and only prints advisory stdout after 80 tool calls. The only real context percentage is display-only in `super-gsd/hooks/sgsd-statusline.js:207-214`. Current handover is process respawn through the `Stop` hook and `super-gsd/scripts/sgsd-stop-handoff.sh`, but that chain has been latched dead since `2026-04-24T15:55:17Z` because refused rows at `chain_depth: 5` do not reset the derived previous depth.

## 2. Design: always-on gate substrate

Add one repo-safe, always-on quality-gate substrate that runs from Claude hook events and calls the existing registry library rather than re-implementing gates.

Hook entry points:

- Global settings touched: `~/.claude/settings.json`, `hooks` key only. Do not read, echo, rewrite, or preserve by printing the `env` block. The patch executor must load JSON, update only `hooks`, and write the same object back without logging secret-bearing fields.
- Register a global `PreToolUse` hook for source mutation attempts:
  - matcher: `Edit|MultiEdit|Write`
  - command: `node C:/Users/jack.berrow/GSDedits/super-gsd/hooks/sgsd-quality-gate.js pretool`
  - timeout: `15`
- Register a global `PostToolUse` hook for source mutation results:
  - matcher: `Edit|MultiEdit|Write`
  - command: `node C:/Users/jack.berrow/GSDedits/super-gsd/hooks/sgsd-quality-gate.js posttool`
  - timeout: `30`
- Register a global `PreToolUse` hook for commit attempts:
  - matcher: `Bash`
  - command: `node C:/Users/jack.berrow/GSDedits/super-gsd/hooks/sgsd-quality-gate.js prebash`
  - timeout: `15`
  - The script only inspects the attempted bash command enough to detect `git commit`; all other bash commands no-op.

Blast radius: these are global Claude hooks and therefore affect GSDedits, devcp, clarity, and any other project for this operator. `sgsd-quality-gate.js` must silently exit `0` unless it can prove the current working directory is an SGSD repo by finding `super-gsd/registry/gates.yaml` and `.planning/STATE.md` under the same repo root. In non-SGSD repos, malformed payloads, missing `.planning`, or missing registry files are silent no-ops.

New script:

- Add `super-gsd/hooks/sgsd-quality-gate.js`.
- Responsibilities:
  - Parse Claude hook JSON from stdin.
  - Resolve the repo root from `cwd` or tool payload file paths.
  - No-op outside SGSD repos.
  - Load gates through `super-gsd/scripts/lib/gates-registry.cjs`.
  - Build a small runtime fact object:
    - `event_name`
    - `tool_name`
    - `file_path`
    - `code_files_changed_count`
    - `planning_files_changed_count`
    - `audit_stub_exists`
    - `plan_path`
    - `dispatch_id`
    - `override_present`
  - Call `shouldFire()` for `per-dispatch-ATC`, `phase-level-ATC`, and `MUDA-waste-audit` where applicable.
  - Append all decisions to the existing gate value log via `gate-value-log.cjs`.

Hard-block versus soft-warn:

- Hard-block:
  - `Edit`, `MultiEdit`, or `Write` against source files when no active phase PLAN can be resolved and no narrowly scoped override is present.
  - `Edit`, `MultiEdit`, or `Write` against source files when the current dispatch lacks an `AUDIT.md` stub.
  - `git commit` when source files changed but required ATC evidence, spec-compliance evidence, or audit stub is missing.
  - Any override attempt that is broad, expired, malformed, or not tied to a specific gate and path set.
- Soft-warn:
  - Planning/doc-only edits under `.planning/` that are not source mutations.
  - Gate registry load failures in non-SGSD repos only.
  - Missing optional VTP/private-KB inputs.
- In SGSD repos, registry load failure is a hard-block because failing open would make `enforcement_mode: hard-halt` fictional again.

Override:

- Override must be explicit, narrow, and logged.
- Use an override file rather than an environment variable, to avoid AHE 2604.25850 App. C's soft-token failure mode.
- Path: `.planning/OVERRIDES/{timestamp}-{gate-id}.json`.
- Required fields:
  - `gate_id`
  - `reason`
  - `expires_at`
  - `allowed_paths`
  - `created_by`
  - `dispatch_id`
- The hook accepts an override only when:
  - `gate_id` matches the blocking gate.
  - `expires_at` is in the future.
  - Every changed path is under `allowed_paths`.
  - The override file itself is committed or already present before the blocked mutation.
- Every accepted or rejected override is appended to the gate value log with `override_status`.

AUDIT.md stub guarantee:

- Even when a gate samples to SKIP or LITE, the hook guarantees an audit artifact exists before source edits proceed.
- Stub path: `.planning/milestones/{milestone}/phases/{NN-slug}/AUDIT.md`.
- Stub content is minimal and mechanical:
  - frontmatter with `milestone`, `phase`, `created_at`, `created_by: sgsd-quality-gate`, `sampling_tier`, `dispatch_id`
  - body section `## Gate Decisions`
  - body section `## Evidence Links`
- `sgsd-quality-gate.js posttool` may create this stub only inside `.planning/milestones/.../phases/.../AUDIT.md`; it must not edit source.
- If the hook lacks write permission or cannot resolve the phase, it hard-blocks subsequent source edits and tells the operator the exact missing path. This makes "zero AUDIT.md across N units" structurally impossible per AHE-P-09.

Commit gate:

- `prebash` detects `git commit`.
- It computes changed files mechanically with `git diff --name-only --cached` and `git diff --name-only`.
- It derives region-touched evidence by comparing changed files to PLAN task file lists. This satisfies ISO-Bench §5.2: gate evidence is based on touched regions, not claim-of-done.
- If staged source changes do not overlap any active PLAN task files, block commit.
- If tests are failing or unrecorded for a task that requires verification, block commit unless a scoped override exists.

Bootstrap for this change:

- Because this plan fixes the gates themselves, this implementation cannot rely on the broken gate substrate.
- Bootstrap rule for the implementation dispatch:
  - Codex must execute this PLAN through `codex-executor.sh` or `codex-patch-executor.sh`.
  - Before source edits, manually create the phase `AUDIT.md` stub in the implementation phase directory.
  - After implementation, run the new `sgsd-quality-gate.js` directly against recorded sample hook payloads for `Write`, `Edit`, `MultiEdit`, and `git commit`.
  - Append the direct-run outputs to the implementation phase `VERIFICATION.md`.
  - Only after direct verification may the global hook registration be changed.
- This is a one-time bootstrap exception and must be recorded in the audit log as `bootstrap_reason: gates-being-installed`.

## 3. Design: context handover pack

Trigger semantics:

- Do not make context percentage an exit condition. `CLAUDE.md` explicitly says context percentage is observability only and not an exit condition because a prior loop stopped prematurely.
- Use context percentage as a pressure signal for handover-and-continue:
  - At or below 50% remaining context, SGSD stops accepting new work units.
  - It finishes the unit already in flight at its natural boundary.
  - It writes a handover pack.
  - It rotates or resumes with the next session.
  - It does not halt the milestone, phase, or autonomous loop.
- This follows HCC-P-02: token thresholds must not slice mid-thought. The threshold pulls the next boundary earlier; it never cuts work mid-unit.

Hooking:

- Add a real `PreCompact` hook if Claude supports it in this runtime:
  - event: `PreCompact`
  - command: `node C:/Users/jack.berrow/GSDedits/super-gsd/hooks/sgsd-handover-pack.js precompact`
  - timeout: `30`
- Add a `PostToolUse` hook for context pressure:
  - matcher: `.*`
  - command: `node C:/Users/jack.berrow/GSDedits/super-gsd/hooks/sgsd-handover-pack.js pressure`
  - timeout: `10`
- The pressure hook must no-op unless the payload exposes `data.context_window.remaining_percentage`. It must not use wall-clock or tool-call count as a substitute for context.
- If `PreCompact` is not supported by the installed Claude hook system, keep the `PreCompact` registry entry out of active hooks and document that pressure-mode handover is the active path.

Pack writer:

- Add `super-gsd/hooks/sgsd-handover-pack.js`.
- It reads `.planning/STATE.md` frontmatter for milestone and phase. It must not parse the prose `status:` field for phase numbers.
- It writes under the active phase:
  - `.planning/milestones/{milestone}/phases/{NN-slug}/HANDOVER.md`
  - `.planning/milestones/{milestone}/phases/{NN-slug}/HANDOVER_v2.md`
  - `.planning/milestones/{milestone}/phases/{NN-slug}/HANDOVER_v3.md`
- Versioning is append-only. Never overwrite an existing pack.
- Each pack has structured frontmatter plus a free-text strategy body.

Pack schema:

```yaml
---
schema: sgsd-handover-pack/v1
milestone: v3.5
phase: "144"
phase_dir: ".planning/milestones/v3.5/phases/144-slug"
created_at: "2026-08-02T00:00:00Z"
created_by: "sgsd-handover-pack"
trigger:
  kind: "context-pressure|precompact|stop-handoff|manual"
  remaining_percentage: 49.8
  natural_boundary: true
source_artifacts:
  plan: "PLAN.md"
  audit: "AUDIT.md"
  verification: "VERIFICATION.md"
  diff_summary: ".planning/.../diff-summary.txt"
  gate_log: ".planning/metrics/gate-value-log.jsonl"
resume:
  next_action: ""
  open_dispatch_id: ""
  drift_check_required: true
---
```

Required body sections:

- `## Current State`
- `## Binding Acceptance Criteria`
- `## Open Blockers`
- `## Failing Tests And Error Traces`
- `## Unresolved Deviations`
- `## Dead Ends`
- `## Evidence Map`
- `## Resume Strategy`
- `## Drift Checks`

Mandatory dead-ends:

- `## Dead Ends` is required and cannot be empty.
- If no dead ends are known, the section must contain `None recorded as of {timestamp}`.
- This follows HCC-P-04.

Derived projection rule:

- The handover pack is a projection over durable artifacts, not the source of truth.
- It must cite existing PLAN, AUDIT, VERIFICATION, gate logs, diffs, commits, and blocker files.
- It must not replace any of those source artifacts, satisfying DPM-P-01 + HCC.

Uncompressable bypass list:

- The following pass through verbatim and are not summarized:
  - open blockers
  - failing tests
  - error traces
  - unresolved deviations
  - binding acceptance criteria
- This follows TACO-P-05.

Resume and drift detection:

- On `SessionStart`, `sgsd-session-start.js` must look for the newest phase-local `HANDOVER*.md`.
- It compares:
  - STATE milestone/phase against handover frontmatter.
  - Current `git rev-parse HEAD` against the handover's recorded source state if present.
  - Current changed files against handover evidence map.
  - Open blockers and failing tests listed in the pack against current artifacts.
- If drift is detected, the briefing must say `HANDOVER DRIFT DETECTED` and list the mechanical mismatch.
- The resume path can guide Claude/Codex, but must not claim work is complete without gate evidence.

## 4. Defect fixes

- Dead ATC slice-gate regex: delete `~/.claude/hooks/gsd-atc-slice-gate.js` registration or leave the file unregistered. Justification: it matches `.gsd/milestones/(M\d+)/slices/(S\d+)`, but this repo uses `.planning/milestones/v3.5/phases/NNN-slug/`; it only sees `Write`, not `Edit`/`MultiEdit`, and gates a summary file rather than source diffs.
- Latched handoff chain depth: fix `super-gsd/scripts/sgsd-stop-handoff.sh` so `refused` rows do not keep `PREV_CHAIN_DEPTH` latched at 5. Justification: the last row from `2026-04-24T15:55:17Z` is `reason:"refused", chain_depth:5, refused:"max_chain_depth"`, causing permanent refusal.
- Watchdog phase regex: fix `super-gsd/tools/autopilot-watchdog/check.cjs` to read phase from `.planning/STATE.md` frontmatter or canonical active phase fields, never from `/\bPhase\s+([0-9]+)\b/i` over prose `status:`. Justification: it currently reports phase 95 when the real next phase is P144 and has repeated this wrong-phase briefing across milestones.
- Duplicate context-monitor registration: keep one registration or delete both in favor of `sgsd-handover-pack.js pressure`. Justification: `super-gsd/hooks/gsd-context-monitor.js` tracks wall-clock/tool-call count, not context, and duplicate `PostToolUse` registrations create noisy overlapping advisory behavior.
- Unregistered `sgsd-session-start.js`: fix by registering the superset `~/.claude/hooks/sgsd-session-start.js` and removing the older `gsd-session-start.js` registration. Justification: the superset version pairs the handoff-log child row; the old registered version misses the current handoff chain model.
- Dead config knobs: delete or deprecate `token_efficiency.checkpoint_threshold_percent: 100000`, `token_efficiency.context_warning_percent: 70`, and `hooks.context_warnings: true` from `.planning/config.json`, or move them under `deprecated`. Justification: no reader exists anywhere, and the unreachable `100000` percent field encodes obsolete behavior.
- **[ADDED 2026-08-02, post-authoring] `codex-exec.sh` silently caps long dispatches.** Timeout resolution goes through a tier ladder (`default=60s`, `review=120s`, `analysis=180s`) which takes precedence over an explicit `--timeout`. A `--step` label absent from the step-name map logs `has no tier mapping, using default` and caps at **60s**. Fix: honour an explicit `--timeout` as `custom:N`, and make an unmapped `--step` a loud failure rather than a silent 60s downgrade. Justification: any research/planning/verification dispatch exceeding 180s dies as a false blocker; verified empirically 2026-08-02 (`codex-log.jsonl` row `exit:5, timeout_hit:true, duration_ms:182540`).
- **[ADDED 2026-08-02, post-authoring] `.codex/hooks.json` fails to parse; five Phase-111 hooks have never run.** Every Codex invocation prints `warning: failed to parse hooks config .codex\hooks.json: invalid type: string "super-gsd/tools/codex-hooks/block-secret-leak.cjs", expected struct MatcherGroup at line 4 column 57`. The file uses bare string arrays where Codex expects a MatcherGroup struct. Fix: correct the schema against the installed codex-cli version (0.146.0) and add a parse assertion to preflight. Justification: `block-secret-leak.cjs`, `block-forbidden-write.cjs`, `enforce-allowed-files.cjs`, `log-tool-event.cjs` and `validate-stop-contract.cjs` are all inert; DLB-09.2 shipped and was marked complete. Codex degrades to a warning and continues, so nothing noticed.
- **[CORRECTION 2026-08-02] `codex-exec.sh --report-out` is NOT defective.** An earlier note in commit `edb008c` claimed the wrapper never writes its report on success. That was a measurement error. The wrapper enforces a report contract (`FINDINGS`/`CRITICAL`/`WARNINGS`/`PASS_RATE`/`ONE_LINER`); non-conforming stdout is rejected with `CONTRACT_VIOLATION` and **exit 6**, which is correct fail-loud behaviour. The apparent "exit 0 on failure" was a `| tail` pipeline masking the real exit code. Verified: a contract-conforming prompt writes the report and reports `codex-exec: OK — ... written (85B)`. No fix required. Callers must satisfy the contract or use a writing executor.
- Fictional `hooks.yaml` PreCompact declaration: fix `super-gsd/registry/hooks.yaml` to match reality. If `PreCompact` is implemented, declare the actual `sgsd-handover-pack.js precompact` hook and write path. If not supported, remove the `PreCompact` claim. Justification: registry declarations must describe registered mechanism, not intended behavior.

## 5. Task breakdown

Task 1: Create SGSD hook payload fixtures.

- Files touched:
  - `super-gsd/test/fixtures/hooks/write-source.json`
  - `super-gsd/test/fixtures/hooks/edit-source.json`
  - `super-gsd/test/fixtures/hooks/multiedit-source.json`
  - `super-gsd/test/fixtures/hooks/git-commit.json`
  - `super-gsd/test/fixtures/hooks/non-sgsd-write.json`
- Acceptance criterion: fixtures cover source mutation, planning-only mutation, commit attempt, malformed payload, and non-SGSD repo no-op.
- Verification command: `node -e "for (const f of require('fs').readdirSync('super-gsd/test/fixtures/hooks')) JSON.parse(require('fs').readFileSync('super-gsd/test/fixtures/hooks/'+f,'utf8')); console.log('fixtures valid')"`

Task 2: Implement `sgsd-quality-gate.js`.

- Files touched:
  - `super-gsd/hooks/sgsd-quality-gate.js`
  - `super-gsd/scripts/lib/gates-registry.cjs` only if a small exported helper is required
- Acceptance criterion: direct invocation hard-blocks a source `Write` without PLAN/AUDIT, exits `0` for non-SGSD repos, and logs gate decisions through `gate-value-log.cjs`.
- Verification command: `node super-gsd/hooks/sgsd-quality-gate.js pretool < super-gsd/test/fixtures/hooks/write-source.json; echo $LASTEXITCODE`

Task 3: Add audit stub guarantee.

- Files touched:
  - `super-gsd/hooks/sgsd-quality-gate.js`
  - active implementation phase `AUDIT.md`
- Acceptance criterion: every source mutation path either finds or creates `.planning/milestones/{milestone}/phases/{NN-slug}/AUDIT.md`; if phase cannot be resolved, the hook blocks before source mutation.
- Verification command: `node super-gsd/hooks/sgsd-quality-gate.js posttool < super-gsd/test/fixtures/hooks/edit-source.json`

Task 4: Add commit gate.

- Files touched:
  - `super-gsd/hooks/sgsd-quality-gate.js`
- Acceptance criterion: `git commit` attempts with changed source files outside the active PLAN file list are blocked; commits with only planning docs are allowed or soft-warned.
- Verification command: `node super-gsd/hooks/sgsd-quality-gate.js prebash < super-gsd/test/fixtures/hooks/git-commit.json`

Task 5: Add scoped override support.

- Files touched:
  - `super-gsd/hooks/sgsd-quality-gate.js`
  - `.planning/OVERRIDES/.gitkeep`
- Acceptance criterion: valid override allows only the named gate and paths until expiry; invalid, expired, or broad override is hard-blocked and logged.
- Verification command: `node super-gsd/hooks/sgsd-quality-gate.js pretool < super-gsd/test/fixtures/hooks/write-source-with-override.json`

Task 6: Register global gate hooks safely.

- Files touched:
  - `~/.claude/settings.json` hooks key only
  - optionally `super-gsd/registry/hooks.yaml`
- Acceptance criterion: settings contains `PreToolUse` and `PostToolUse` entries for `sgsd-quality-gate.js`; no command output or diff exposes the `env` block.
- Verification command: `node -e "const s=require('fs').readFileSync(process.env.USERPROFILE+'/.claude/settings.json','utf8'); const j=JSON.parse(s); console.log(JSON.stringify(j.hooks,null,2).includes('sgsd-quality-gate.js'))"`

Task 7: Implement handover pack writer.

- Files touched:
  - `super-gsd/hooks/sgsd-handover-pack.js`
- Acceptance criterion: pressure-mode with `remaining_percentage <= 50` records `handover_pending` and refuses new work units, but does not halt the process; at natural boundary it writes phase-local `HANDOVER.md`.
- Verification command: `node super-gsd/hooks/sgsd-handover-pack.js pressure < super-gsd/test/fixtures/hooks/context-pressure-49.json`

Task 8: Add append-only versioning and pack schema validation.

- Files touched:
  - `super-gsd/hooks/sgsd-handover-pack.js`
  - `super-gsd/test/fixtures/handover/`
- Acceptance criterion: repeated writes create `HANDOVER.md`, then `HANDOVER_v2.md`, never overwrite; each pack contains all required sections including non-empty `## Dead Ends`.
- Verification command: `node super-gsd/hooks/sgsd-handover-pack.js precompact < super-gsd/test/fixtures/hooks/precompact.json`

Task 9: Wire resume and drift detection.

- Files touched:
  - `~/.claude/hooks/sgsd-session-start.js`
  - `~/.claude/settings.json` hooks key only
- Acceptance criterion: SessionStart briefing reads newest phase-local handover, reports drift when STATE milestone/phase or git HEAD differs, and no-ops outside SGSD repos.
- Verification command: `node C:/Users/jack.berrow/.claude/hooks/sgsd-session-start.js < super-gsd/test/fixtures/hooks/session-start-with-handover.json`

Task 10: Fix handoff chain depth latch.

- Files touched:
  - `super-gsd/scripts/sgsd-stop-handoff.sh`
- Acceptance criterion: last `refused` row at chain depth 5 does not permanently prevent future handoff after cooldown or a new root session; spawned rows still count toward max depth.
- Verification command: `bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run --log-fixture super-gsd/test/fixtures/handoff/refused-depth-5.jsonl`

Task 11: Fix autopilot watchdog phase derivation.

- Files touched:
  - `super-gsd/tools/autopilot-watchdog/check.cjs`
- Acceptance criterion: watchdog reports P144 for current `.planning/STATE.md` and never extracts phase from prose `status:`.
- Verification command: `node super-gsd/tools/autopilot-watchdog/check.cjs --dry-run`

Task 12: Clean hook registry and duplicate context monitor.

- Files touched:
  - `super-gsd/registry/hooks.yaml`
  - `~/.claude/settings.json` hooks key only
- Acceptance criterion: registry active hooks match real registered hooks; no duplicate `gsd-context-monitor.js` PostToolUse registrations remain; no fictional `PreCompact` declaration remains unless backed by a real registration.
- Verification command: `node super-gsd/scripts/preflight-hooks.cjs`

Task 13: Retire dead config knobs.

- Files touched:
  - `.planning/config.json`
  - any docs that reference those knobs
- Acceptance criterion: the three obsolete knobs are removed or marked deprecated, and no runtime code claims to read them.
- Verification command: `rg "checkpoint_threshold_percent|context_warning_percent|context_warnings" .planning super-gsd`

Task 14: End-to-end bootstrap verification.

- Files touched:
  - active implementation phase `VERIFICATION.md`
- Acceptance criterion: verification records direct hook runs for `Write`, `Edit`, `MultiEdit`, `git commit`, non-SGSD no-op, handover pressure, handover versioning, SessionStart drift, watchdog phase, and handoff depth.
- Verification command: `npm test -- --runInBand` or, if no project test runner exists, run each command listed in Tasks 1-13 and append outputs to `VERIFICATION.md`.

## 6. Risks and rollback

Risk: global hooks can affect non-SGSD projects. Mitigation: every new hook must prove SGSD repo identity using both `super-gsd/registry/gates.yaml` and `.planning/STATE.md`; otherwise silent exit `0`. Rollback: remove only the added hook entries from `~/.claude/settings.json` `hooks`; leave files in repo for inspection.

Risk: a gate bug could block legitimate edits. Mitigation: hard-block only source mutations and commits in SGSD repos; planning docs remain available for repair. Rollback: unregister `sgsd-quality-gate.js` hooks, then use the old orchestrate flow while fixing the hook.

Risk: override support could become another soft bypass. Mitigation: file-based, path-scoped, gate-scoped, expiring overrides; every accepted and rejected override is logged. Rollback: disable override recognition in `sgsd-quality-gate.js` while keeping normal gates active.

Risk: context pressure could be mistaken for a STOP condition. Mitigation: code and docs must name the state `handover_pending`, not `halted`; the hook refuses new work units only after the current unit reaches a natural boundary. Rollback: unregister `sgsd-handover-pack.js pressure`; keep manual `precompact` or Stop handover.

Risk: pack content may become a replacement for source artifacts. Mitigation: schema requires `source_artifacts` and evidence links; uncompressable items pass through verbatim. Rollback: ignore `HANDOVER*.md` in SessionStart while preserving the files for audit.

Risk: hook registry drift can recur. Mitigation: extend preflight to check both active-to-registered and registered-to-active for SGSD-owned hooks. Rollback: keep registry declarative but mark unregistered hooks as `planned`, not `active`.

## 7. Explicit non-goals

- Do not rewrite SGSD orchestration or replace `sgsd-orchestrate/SKILL.md`.
- Do not invent a second gate registry.
- Do not make context percentage a halt or exit condition.
- Do not implement token-count summarisation or mid-thought compaction.
- Do not move checkpoints back to `.planning/` root.
- Do not make VTP/private KB required for gates or handover.
- Do not inspect or print the `env` block of `~/.claude/settings.json`.
- Do not broaden this into a general Claude hook framework.
- Do not fix unrelated milestone, cockpit, or roadmap behavior.
- Do not delete historical logs; append corrective evidence instead.

