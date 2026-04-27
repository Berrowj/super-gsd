---
status: handover
created: 2026-04-26
target: v1.6 Cockpit 2.0 And Startup Verification
mode: autonomous
activation: Paste this into Claude only when the operator wants v1.6 promoted and run.
---

# Claude Auto Handover: v1.6 Cockpit 2.0

This is the mission packet to hand to Claude when the operator wants SGSD to run
the Cockpit 2.0 milestone in auto mode.

For a full unattended roadmap run from v1.6 through v2.1, use this file instead:

```text
C:\Users\jack.berrow\GSDedits\.planning\milestones\CLAUDE-AUTO-HANDOVER-FULL-ROADMAP.md
```

## Operator Intent

Promote and execute **v1.6 Cockpit 2.0 And Startup Verification** only.

Do not activate v1.7, v1.8, v1.9, v2.0, or v2.1. Those remain proposed future
milestones.

The operator wants the cockpit redesigned so it clearly answers:

1. what the model is doing right now,
2. what SGSD is trying to complete,
3. what completing it unlocks,
4. what is blocked or risky,
5. which agents were used and what each did,
6. what Codex is doing or concluded,
7. what evidence/artifacts were produced,
8. what should happen next.

## How To Start

Preferred unattended path from the repo root:

```powershell
sg -FullPreflight
```

When Claude opens in the current terminal, paste the prompt under
`Prompt To Paste Into Claude`, then type:

```text
go
```

Fast path when the operator is comfortable skipping full preflight:

```powershell
sg -Go
```

If using the fast path, paste the same handover prompt as the first instruction
after Claude starts.

## Required Reading

Read these first, in this order:

```text
C:\Users\jack.berrow\GSDedits\CLAUDE.md
C:\Users\jack.berrow\GSDedits\.planning\STATE.md
C:\Users\jack.berrow\GSDedits\.planning\ROADMAP.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\CLAUDE-AUTO-HANDOVER-v1.6-COCKPIT-2.0.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6-PROPOSED-REQUIREMENTS.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6-PROPOSED-PHASES.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\COCKPIT-2.0-SCOPE.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\VIO-ROADMAP-ENRICHMENT.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\HANDBOOK-FUTURE-ROADMAP.md
C:\Users\jack.berrow\GSDedits\docs\reports\SGSD-VTP-Book-Enrichment-Map.html
C:\Users\jack.berrow\GSDedits\docs\reports\SGSD-VTP-Visual-Handbook.html
C:\Users\jack.berrow\GSDedits\super-gsd\docs\SGSD-BOOT-STARTUP-GUIDE.md
```

Read these implementation files before code changes:

```text
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-mission-control.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-narrative.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-codex-monitor.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-dashboard-host.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-boot.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\Install-SgsdShortcut.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-configure.ps1
```

## VTP / Knowledge Use

Use VTP/private KB if it is configured and healthy. Do not block the milestone
if VTP is unavailable.

If VTP is available, run one focused enrichment pass before Phase 26 planning:

- UX/dashboard/operator visibility books,
- VIO workflow/cockpit/validation/progressive disclosure conversations,
- agent orchestration and guardrail research.

Extract rules, not decorative citations. Each extracted rule must become an
acceptance criterion, a kill/defer rule, or an implementation choice.

## Autonomous Rules

Follow `CLAUDE.md` auto-mode rules:

- do not ask for confirmation during auto mode;
- every response in auto mode must include a tool call;
- commit after every unit of work;
- stage specific files only;
- write a checkpoint before stopping for context, blockers, or user pause;
- stop only for genuine human-judgment blockers, credentials, or unsafe actions.

Extra rules for this milestone:

- audit first, then implement;
- do not duplicate existing boot/setup behavior;
- terminal cockpit first, no web dashboard;
- no always-on LLM summarizer;
- no new telemetry unless a named operator question cannot be answered from
  existing sources;
- no VTP hard dependency;
- no v1.7+ activation.

## Promotion Work

Promote v1.6 from proposed to active only after the required reading and
existing-surface audit.

Create:

```text
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\REQUIREMENTS.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\EXISTING-SURFACE-AUDIT.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\26-cockpit-operator-question-contract\
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\27-cockpit-data-source-objective-tree-audit\
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\28-mission-control-2-layout\
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\29-agent-codex-visibility-lanes\
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\30-startup-verification-cockpit-acceptance\
```

Update:

```text
C:\Users\jack.berrow\GSDedits\.planning\ROADMAP.md
C:\Users\jack.berrow\GSDedits\.planning\STATE.md
```

Only update active state for v1.6. Leave all future roadmap seeds as proposed.

## Phase Sequence

### Phase 26: Cockpit Operator Question Contract

Deliver:

- question-by-question contract,
- owner lane for each question,
- freshness rules,
- empty states,
- repair-path rules,
- current source for each answer,
- duplicate-risk list.

Do not edit cockpit rendering until this contract exists.

### Phase 27: Cockpit Data Source And Objective Tree Audit

Deliver:

- data-source matrix,
- objective tree model,
- stable ID plan,
- decision on whether `cockpit-state.json` or `cockpit-intel.json` is needed.

Read existing sources first:

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/milestones/**`
- `.planning/metrics/activity-log.jsonl`
- `.planning/metrics/codex-log.jsonl`
- `.planning/metrics/token-log.jsonl`
- `.planning/metrics/muda-log.jsonl`
- `.planning/metrics/edge-guard-log.jsonl`
- `.planning/metrics/readiness-log.jsonl`
- Claude session JSONL files

### Phase 28: Mission Control 2.0 Layout

Deliver code changes mainly in:

```text
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-mission-control.ps1
```

Goal:

- first viewport shows objective, unlock, blocker/risk, next action, freshness;
- existing useful sections stay available;
- raw counts move lower unless they change operator decisions;
- long rows truncate cleanly.

### Phase 29: Agent And Codex Visibility Lanes

Deliver code changes mainly in:

```text
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-narrative.ps1
C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-codex-monitor.ps1
```

Goal:

- agents show role, task, status, artifact, result;
- Codex shows idle/running/timed-out/blocked/stale/complete;
- Codex timeout is visible as state, not repeated generic event spam;
- evidence/report paths are visible.

### Phase 30: Startup Verification And Cockpit Acceptance

Verify:

```powershell
sgsd -NoOpen
sg -NoClaude
sg -NoCockpit
sg -FullPreflight
```

If direct `sg` invocations are unsafe inside the active Claude session, verify
the underlying scripts without launching duplicate Claude sessions.

Acceptance scenarios:

- normal active work,
- blocked gate,
- Codex timed out,
- Codex completed with warnings,
- no private KB/VTP,
- stale dashboard data,
- forced restart/resume,
- no active Claude tool event.

Update docs only after behavior is verified.

## Verification Expectations

Run the strongest practical checks for changed files:

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\sgsd-boot.ps1 -NoOpen
```

Also run targeted PowerShell syntax checks for edited scripts where practical.

Do not fake screenshot verification. If visual verification cannot be run,
record the gap in `30-VERIFICATION.md`.

## Commit Discipline

Commit after each unit:

```text
docs(26): define cockpit operator question contract
docs(27): audit cockpit data sources
feat(28): add mission control 2 layout
feat(29): clarify agent and codex cockpit lanes
test(30): verify cockpit startup acceptance
docs(v1.6): summarize cockpit 2 milestone
```

Stage specific files by name. Do not use `git add -A`.

## Hard Stop Conditions

Stop and write a checkpoint only if:

- credentials are needed,
- a destructive operation would affect files outside this repo,
- current state cannot be safely parsed,
- boot verification would launch recursive Claude sessions and no safe script
  alternative exists,
- a hard gate reports critical issues that cannot be repaired without operator
  judgment.

## Final Deliverables

At the end, produce:

```text
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\SUMMARY.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\VERIFICATION.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\26-*\26-VERIFICATION.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\27-*\27-VERIFICATION.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\28-*\28-VERIFICATION.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\29-*\29-VERIFICATION.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.6\phases\30-*\30-VERIFICATION.md
```

Final response should include:

- exact changed files,
- exact commands run,
- what passed,
- what could not be verified,
- remaining risks,
- next recommended milestone but do not activate it.

## Prompt To Paste Into Claude

```text
You are in C:\Users\jack.berrow\GSDedits.

Run SGSD v1.6 Cockpit 2.0 And Startup Verification in autonomous mode.

Operator approval: promote v1.6 only. Do not activate v1.7+.

Read this mission packet first:
C:\Users\jack.berrow\GSDedits\.planning\milestones\CLAUDE-AUTO-HANDOVER-v1.6-COCKPIT-2.0.md

Then follow it exactly:
- audit first,
- use VTP/private KB if healthy but do not block if unavailable,
- create active v1.6 milestone docs,
- implement phases 26-30,
- redesign terminal cockpit around the eight operator questions,
- verify startup and cockpit acceptance,
- commit after every unit,
- checkpoint only for genuine blockers.

go
```
