---
schema: sgsd-handover-pack/v1
milestone: v3.5
phase: "144"
phase_dir: ".planning/milestones/v3.5/phases/144-chronicle-host-shell-boundary"
created_at: "2026-08-02T13:50:53Z"
created_by: "manual — hand-written as a live test of the sgsd-handover-pack/v1 schema before it is automated"
trigger:
  kind: "manual"
  remaining_percentage: null
  natural_boundary: true
git_head: "900bced3678758c6f6bcb41d674a986e23b09670"
source_artifacts:
  plan: ".planning/analyses/2026-08-02-always-on-gates-and-context-handover-PLAN.md"
  audit: null
  verification: null
  gate_log: ".planning/metrics/codex-log.jsonl"
  hook_event_log: ".planning/metrics/codex-tool-events.jsonl"
  codex_live_output: ".planning/metrics/codex-live-output.txt"
resume:
  next_action: "Operator decides hook-trust route (see Open Blockers #1), then execute Tasks 1-6 of the PLAN (gate substrate)."
  open_dispatch_id: null
  drift_check_required: true
---

# Handover — always-on gates and context handover remediation

## Current State

Operator reported two defects: (1) ATC and the full audit sequence only run under
`/sgsd-orchestrate`, not in ordinary sessions; (2) no context handover exists.
Investigation found both true, plus four further defects sharing one root cause.

**Root cause (the finding that matters):** every one of these mechanisms fails
*silently and reports success*. A dead regex exits 0. A capped Codex dispatch
exits 0. A skipped gate leaves no trace. A missing `AUDIT.md` is indistinguishable
from a passed audit. SGSD cannot currently distinguish "ran and passed" from
"never ran". The devcp incident (5 units shipped, 0 `AUDIT.md`, ATC/MUDA never
run, three real defects caught only after shipping) is the downstream consequence.

Design principle adopted for the fix: **absence of evidence must be loud.**

Delivered this session:
- `edb008c` — 14-task implementation plan authored by Codex gpt-5.5/xhigh.
- `b010373` — correction of a false claim + two post-authoring defects added.
- `900bced` — codex-exec.sh timeout fix (verified) + .codex/hooks.json schema fix
  (correct, but inert pending trust).

NOT started: the gate substrate itself (PLAN Tasks 1-14).

## Binding Acceptance Criteria

Verbatim from the PLAN. None of these are met yet.

- A source `Write`/`Edit`/`MultiEdit` outside `/sgsd-orchestrate` must trigger a
  mechanical gate, hard-blocking when no PLAN/AUDIT exists for the active phase.
- Every source-mutation path must find or create
  `.planning/milestones/{milestone}/phases/{NN-slug}/AUDIT.md`; if the phase
  cannot be resolved, the hook blocks *before* mutation.
- Gate hooks must exit 0 silently in non-SGSD repos (blast radius is global).
- Overrides must be file-based, path-scoped, gate-scoped, expiring, and logged on
  both accept and reject.
- Handover trigger must be `handover_pending`, never `halted` — context pressure
  must never become an exit condition.
- `## Dead Ends` in every pack is mandatory and may not be empty.
- Packs are append-only and versioned; never overwrite.

## Open Blockers

1. **OPERATOR DECISION REQUIRED — Codex hook trust.** `.codex/hooks.json` now
   parses and the hooks are proven to execute, but codex-cli skips *untrusted*
   hooks silently. All five Phase-111 hooks — including `block-secret-leak.cjs`,
   a credential-leak guard — remain inert. Two routes: (a) run `codex`
   interactively once in this repo and approve the hooks, persisting trust to
   `~/.codex/state_5.sqlite`; (b) add `--dangerously-bypass-hook-trust` to the
   SGSD wrappers. Route (b) is a security-relevant change; the flag's own help
   says "intended only for automation that already vets hook sources". Not
   actioned — this is an operator security decision, not a routing choice.

2. **Windows Codex cannot execute shell tools.** `CreateProcessAsUserW failed:
   216`. All executor dispatches must run inside WSL. Not fixed — routed around.
   This is P144's exact subject matter.

3. **PreCompact hook support unverified.** The PLAN's preferred handover trigger
   assumes Claude Code exposes a `PreCompact` hook event. Not confirmed on this
   runtime. Fallback is the `PostToolUse` pressure path reading
   `data.context_window.remaining_percentage`.

## Failing Tests And Error Traces

Verbatim, uncompressed.

```
warning: failed to parse hooks config .codex\hooks.json: invalid type: string
"super-gsd/tools/codex-hooks/block-secret-leak.cjs", expected struct MatcherGroup
at line 4 column 57
```
Status: FIXED in 900bced. Warning no longer emitted.

```
The shell command could not run because the configured PowerShell executable
failed to launch:
CreateProcessAsUserW failed: 216
This version of %1 is not compatible with the version of Windows you're running.
```
Status: OPEN. Windows codex only. Route through WSL.

```
{"step":"always-on-gates-plan","exit":5,"duration_ms":182540,"timeout_hit":true,
"report_bytes":0}
```
Status: FIXED in 900bced (timeout precedence).

```
codex-exec: report contract violation — one or more of
FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER missing from codex stdout
```
Status: NOT A DEFECT. Correct fail-loud behaviour. Callers must satisfy the
contract. See Dead Ends #1.

## Unresolved Deviations

- The PLAN (`edb008c`) was authored before defects 5 and 6 were found. Section 4
  was amended in `b010373`, but the Task Breakdown (§5) still has no tasks for
  them. Tasks 1-14 are numbered against the original scope.
- PLAN Task 2's verification command uses `echo $LASTEXITCODE` — PowerShell
  syntax in a bash context. Will fail as written.
- `.planning/` carries 9 pre-existing modified files unrelated to this work
  (STATE.md, MONITORING-SETUP.md, vtp-remote-access.md, sgsd-remote-launch.ps1,
  vtp-tunnel-supervisor.cjs/.test.mjs, legal-keys.json, scripts/README.md,
  memory/MEMORY.md). Not touched, not committed. Pre-dates this session.

## Dead Ends

Do not re-explore these. Each cost real time this session.

1. **`codex-exec.sh --report-out` is NOT broken.** It was reported as a defect in
   `edb008c` and that claim was wrong. It enforces a report contract and exits 6
   on violation. The apparent "exit 0 with no report" was a `| tail` pipeline
   masking the real exit code. Do not "fix" it.
2. **Do not invoke Codex wrappers from Git Bash.** `/proc/version` lacks
   "microsoft" there, so the WSL branch is skipped and it resolves the Windows
   shim, which cannot spawn a shell. Presents as a false `BLOCKERS:` report with
   `FILES_CHANGED: none` and a clean exit. Always `wsl -e bash -lc`.
3. **Do not grep `wsl.exe` output directly.** It emits UTF-16LE; grep reports
   `Binary file (standard input) matches` and hides everything. Pipe through
   `tr -d '\000'`.
4. **Do not conclude "hooks work" from the parse warning disappearing.** Schema
   validity and hook execution are independent. Verified only by observing rows
   appended to `codex-tool-events.jsonl`.
5. **Do not trust a hook-fire test run under Windows codex.** Tools never
   execute there (216), so `PostToolUse` has nothing to fire on and the test
   returns a false negative. Cost one full round trip.
6. **The 5 pre-existing rows in `codex-tool-events.jsonl` are not evidence of
   working hooks.** All timestamped within one second on 2026-05-20 — a synthetic
   Phase-111 acceptance run. The hooks have never fired in real operation.
7. **A raw 50%-context cut is the wrong primitive.** Rejected on evidence, not
   preference — `2601.10402v5-ml-master-2-hcc` (HCC-P-02): token-count triggers
   slice mid-thought. Adopted instead: at 50% stop accepting new work, close the
   unit in flight, write the pack at that boundary. Do not re-litigate as a
   simple threshold.

## Evidence Map

| Claim | Evidence |
|---|---|
| Gates are prose, not runtime | `super-gsd/skills/sgsd-orchestrate/SKILL.md` steps 6.5/6.55/9.4/9.5; `shouldFire` has no executable caller |
| ATC slice-gate hook is dead | regex targets `.gsd/milestones/M*/slices/`; `.gsd/milestones` absent; fed a real Write payload → exit 0, no output |
| Timeout cap was real | `.planning/metrics/codex-log.jsonl` row `exit:5, timeout_hit:true, duration_ms:182540` |
| Timeout fix works | `--timeout 900` + unmapped step → 900s; `--timeout-tier analysis` → 180s; unmapped alone → `using default (60s)` |
| Hooks execute once trusted | `codex-tool-events.jsonl` 5 → 9 rows under `--dangerously-bypass-hook-trust`; `hook: UserPromptSubmit` in stdout |
| Stop-handoff latched | `handoff-log.jsonl` last row `2026-04-24T15:55:17Z reason:"refused" chain_depth:5` |
| Watchdog reports wrong phase | `stall-log.jsonl` says `phase:"95"`; STATE.md admits P144; regex `/\bPhase\s+([0-9]+)\b/i` over prose `status:` |
| devcp shares super-gsd | `project-clarity-erp/super-gsd` is a Junction → `GSDedits\super-gsd` |

## Resume Strategy

1. Resolve Open Blocker #1 (hook trust). Everything Codex-hook-related is gated on it.
2. Execute PLAN Tasks 1-6 (gate substrate) via `codex-executor.sh` **inside WSL**.
3. Then Tasks 7-9 (handover pack automation), validating against *this* file as
   the reference instance of `sgsd-handover-pack/v1`.
4. Then Tasks 10-13 (defect fixes), adding tasks for the two amended defects.
5. Task 14 end-to-end verification.
6. `git push origin master` — devcp inherits super-gsd through the junction, but
   the remote needs it for other machines.

Do NOT resume by re-reading `sgsd-orchestrate/SKILL.md` in full (2,988 lines).
Everything needed from it is cited above.

## Drift Checks

Run these before trusting this pack:

- `git rev-parse HEAD` — expect `900bced...`. If different, commits landed after
  this pack; re-read `git log` before acting.
- `bash super-gsd/scripts/codex-exec.sh ... --timeout 900 --step no-such-step --dry-run`
  — expect `timeout: 900s`. If 60s, the fix was reverted.
- `wc -l .planning/metrics/codex-tool-events.jsonl` — expect 9. If higher, hooks
  may now be trusted and Blocker #1 may be resolved.
- `ls .planning/milestones/v3.5/phases/` — if directories beyond
  `144-chronicle-host-shell-boundary` exist, phase work started after this pack.
- If any of the above mismatch, say `HANDOVER DRIFT DETECTED` and list the
  mismatch before proceeding. Do not claim work complete without gate evidence.
