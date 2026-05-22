---
status: handover
created: 2026-04-26
target: v1.6 through v2.1
mode: full-autopilot
activation: Paste this into Claude Remote when the operator wants SGSD to run the entire proposed roadmap unattended.
---

# Claude Auto Handover: Full SGSD Roadmap

This is the unattended mission packet.

Use this when the operator wants Claude/SGSD to work through the whole future
roadmap in auto mode without being babysat.

Remote repo:

```text
git@github.com:Berrowj/super-gsd.git
branch: master
```

Cloud/remote path rule:

- If running in Claude Remote, work from the cloned repo root.
- Treat Windows `C:\Users\user\GSDedits\...` paths as source-location
  hints only.
- Translate those paths to relative repo paths before reading or editing.
- Do not stop because the Windows path is unavailable in the cloud checkout.

## Operator Intent

Run the proposed SGSD roadmap from **v1.6 through v2.1**, in order:

1. v1.6 - Cockpit 2.0 And Startup Verification (SHIPPED-WITH-DEBT-10)
2. v1.7 - Stable Command Contracts And Route Intelligence (SHIPPED)
3. v1.8 - Gate Fitness And MUDA Pruning (SHIPPED)
4. v1.9 - **SGSD-Research (Context Compression, Token Governance, And Research Routing)** [SLOT-CHANGE 2026-04-27: was Knowledge Relevance + Memory Governance; new v1.9 absorbs it; phases 41-52]
5. v2.0 - SpaceX-Style Failure Injection [renumbered to phases 53-57; was 46-50]
6. v2.1 - Distribution And New-User Onboarding [renumbered to phases 58-62; was 51-55]

**Note (2026-04-27):** The original v1.9 (Knowledge Relevance And Memory
Governance) plan listed in the v1.9 sections below is preserved at
`.planning/archive/superseded/v1.9-knowledge-memory-governance/` for
reference. The active v1.9 is now SGSD-Research; see
`.planning/milestones/v1.9/SGSD-HANDOVER.md` and `REQUIREMENTS.md`.

Do not stop after each milestone for approval. Promote, execute, verify, close,
commit, and advance automatically.

The operator has already approved full-roadmap autonomous execution.

## Start Command

Best start path from the repo root:

```powershell
sg -FullPreflight
```

Then paste the prompt under `Prompt To Paste Into Claude`.

Fast start path:

```powershell
sg -Go
```

If using the fast path, paste the same prompt as the first instruction after
Claude starts.

## Scheduled Start

The operator asked for this full-autopilot run to be scheduled through Claude
Remote, not through Windows Task Scheduler.

Scheduled target:

```text
2026-04-26 20:21 Europe/London
2026-04-26 19:21 UTC
```

Create the remote routine/reminder with Claude's schedule command:

```text
/schedule 2026-04-26 20:21 Europe/London: Start SGSD full-roadmap autopilot. Clone/use git@github.com:Berrowj/super-gsd.git on branch master, read .planning/milestones/CLAUDE-AUTO-HANDOVER-FULL-ROADMAP.md, then run the full roadmap from v1.6 through v2.1 in auto mode.
```

If Claude is reading this at or after the scheduled target, do not create
another one-hour reminder. Start the full-autopilot run immediately.

No Windows Scheduled Task should be created for this run. The previous local
task named `SGSD Full Auto Roadmap` was cancelled and verified as unregistered.

## Required Reading

Read these first:

```text
CLAUDE.md
.planning/STATE.md
.planning/ROADMAP.md
.planning/milestones/CLAUDE-AUTO-HANDOVER-FULL-ROADMAP.md
.planning/milestones/HANDBOOK-FUTURE-ROADMAP.md
.planning/milestones/HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md
.planning/milestones/VIO-ROADMAP-ENRICHMENT.md
.planning/milestones/COCKPIT-2.0-SCOPE.md
.planning/milestones/v1.6-PROPOSED-REQUIREMENTS.md
.planning/milestones/v1.6-PROPOSED-PHASES.md
docs/reports/SGSD-VTP-Book-Enrichment-Map.html
docs/reports/SGSD-VTP-Visual-Handbook.html
super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md
```

Read implementation surfaces as each milestone reaches them. Do not bulk-load
everything. Start with the audit file and follow its existing-surface map.

## Full Autopilot Rules

Follow `CLAUDE.md` auto-mode rules, with these additions:

- the operator already approved all milestone promotions from v1.6 through v2.1;
- do not ask for approval between milestones;
- do not stop at phase boundaries;
- do not stop at milestone boundaries;
- do not ask whether to continue after warnings;
- repair warnings and blockers when possible;
- if an optional service is unavailable, degrade and continue;
- write checkpoint artifacts frequently enough that a forced restart can resume;
- if context is getting high, write a checkpoint and continue if the session can
  still safely operate; stop only if the runtime genuinely cannot continue;
- commit after each unit of meaningful work;
- stage specific files only.

## Hard Stop Conditions

Only stop for:

- credentials/API tokens/passwords are needed;
- a destructive operation would affect files outside this repo;
- current state cannot be parsed and no safe reconstruction is possible;
- a security/privacy issue requires human judgment;
- tests expose a critical bug that cannot be repaired after three focused
  repair attempts;
- the runtime or terminal cannot continue and requires a new human-launched
  Claude session.

If stopping, write:

```text
.planning/ORCHESTRATOR-CHECKPOINT.md
```

The checkpoint must include:

- current milestone,
- current phase,
- completed work,
- exact next action,
- files changed since last checkpoint,
- commands run,
- unresolved blocker,
- resume prompt.

## Degraded-Path Rules

### VTP / Private KB Down

Do not stop.

Use:

1. SGSD local docs,
2. `.planning/memory`,
3. the existing book map,
4. the visual handbook,
5. local code/doc audit.

Record VTP status as `unavailable` in the relevant research/verification file.
Continue.

### Codex Timeout

Do not stop immediately.

Use this order:

1. read the latest partial Codex report if present,
2. retry once with the smaller scope,
3. use available Claude/self-review gate if Codex remains unavailable,
4. record `codex_status: timed_out` and continue only if no hard critical is
   present.

If a hard critical exists, repair it and rerun the smallest viable check.

### Test Failure

Do not stop immediately.

Use three focused repair attempts:

1. inspect failure,
2. patch the smallest owning surface,
3. rerun the specific failing test/check.

After three failed attempts, stop only if the failure is critical. If it is not
critical, record it as a known gap with a repair plan and continue.

### Ambiguous Scope

Do not ask the operator.

Create a local `DELIBERATE.md` or `DECISION.md` artifact with:

- options considered,
- chosen option,
- why it is safest,
- kill/defer condition,
- rollback path.

Then continue.

## Milestone Loop

For each milestone from v1.6 to v2.1:

1. Read the proposal section in `HANDBOOK-FUTURE-ROADMAP.md`.
2. Read `HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md`.
3. Read `VIO-ROADMAP-ENRICHMENT.md` where operator workflow applies.
4. Query VTP/private KB if available.
5. Create or update the active milestone folder.
6. Create `EXISTING-SURFACE-AUDIT.md`.
7. Create `REQUIREMENTS.md`.
8. Create phase folders and phase docs.
9. Execute phases in order.
10. Verify each phase.
11. Commit after each unit.
12. Complete milestone summary and verification.
13. Update `.planning/ROADMAP.md` and `.planning/STATE.md`.
14. Commit milestone close.
15. Immediately promote the next milestone.

Do not wait for user approval between steps.

## Milestone Queue

### v1.6 - Cockpit 2.0 And Startup Verification

Phases:

- 26 Cockpit Operator Question Contract
- 27 Cockpit Data Source And Objective Tree Audit
- 28 Mission Control 2.0 Layout
- 29 Agent And Codex Visibility Lanes
- 30 Startup Verification And Cockpit Acceptance

Primary surfaces:

```text
super-gsd/scripts/sgsd-mission-control.ps1
super-gsd/scripts/sgsd-narrative.ps1
super-gsd/scripts/sgsd-codex-monitor.ps1
super-gsd/scripts/sgsd-dashboard-host.ps1
super-gsd/scripts/sgsd-boot.ps1
```

Must not become a web-dashboard rewrite.

### v1.7 - Stable Command Contracts And Route Intelligence

Phases:

- 31 Canonical Command Envelope
- 32 Route Decision Ledger
- 33 Repair Instruction Contract
- 34 Canonical Review Ledger
- 35 Generated System Map

Audit warning:

There are existing contracts. Reconcile these first:

```text
super-gsd/registry/review-providers.yaml
super-gsd/registry/handover-contract-v2.yaml
super-gsd/tools/provider-contract/contract-check.mjs
super-gsd/scripts/codex-exec.sh
super-gsd/skills/sgsd-orchestrate/SKILL.md
```

Do not create a fifth incompatible schema.

### v1.8 - Gate Fitness And MUDA Pruning

Phases:

- 36 Gate Value Telemetry
- 37 MUDA Deletion Candidates
- 38 Risk-Tiered Gate Sampling
- 39 Gate Keep/Kill Review
- 40 Phase Folder Perfection Contract

Audit warning:

MUDA already exists. Extend value metrics and keep/kill/sample decisions. Do not
build another MUDA tool from scratch.

Primary surfaces:

```text
super-gsd/registry/gates.yaml
super-gsd/scripts/sgsd-muda-audit.sh
super-gsd/scripts/sgsd-muda-probe.sh
super-gsd/scripts/sgsd-muda-recurrence.sh
super-gsd/scripts/lib/edge-guard.cjs
```

### v1.9 - Knowledge Relevance And Memory Governance

Phases:

- 41 Knowledge Provider Registry
- 42 Relevance Scoring And Citation Theater Prevention
- 43 Typed Retrieval Failure Modes
- 44 Memory Provenance And Retention
- 45 Public Fallback Corpus Policy

Audit warning:

VTP integration already exists. The task is to generalize knowledge providers,
decision impact, retrieval failure taxonomy, and memory governance.

Primary surfaces:

```text
super-gsd/scripts/lib/vtp-enrichment-gate.cjs
super-gsd/skills/sgsd-vtp-advise/SKILL.md
super-gsd/scripts/sgsd-configure.ps1
super-gsd/scripts/sgsd-memory-migrate.ps1
.planning/config.json
```

### v2.0 - SpaceX-Style Failure Injection

Phases:

- 46 Gate Failure-Injection Harness
- 47 Restart And Handoff Chaos Tests
- 48 Provider Backpressure And Timeout Circuits
- 49 Scenario-Based Acceptance Suite
- 50 Release Readiness Score

Audit warning:

Several harness pieces already exist. Compose them before adding new ones.

Primary surfaces:

```text
super-gsd/tools/provider-contract/contract-check.mjs
super-gsd/tools/phase-verifier/phase-verifier.mjs
super-gsd/scripts/lib/edge-guard.cjs
super-gsd/skills/sgsd-readiness/SKILL.md
super-gsd/scripts/sgsd-stop-handoff.sh
```

### v2.1 - Distribution And New-User Onboarding

Phases:

- 51 Installer Portability Audit
- 52 New Project Wizard
- 53 Example Project And Demo Script
- 54 Public Docs Refresh
- 55 Migration And Upgrade Safety

Audit warning:

Installer and setup already exist. Harden them. Do not create a second startup
system.

Primary surfaces:

```text
super-gsd/scripts/Install-SgsdShortcut.ps1
super-gsd/scripts/sgsd-configure.ps1
super-gsd/scripts/sgsd-memory-migrate.ps1
super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md
README.md
```

## Verification Baseline

Run the strongest practical checks after each edited unit:

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\sgsd-boot.ps1 -NoOpen
```

Add targeted checks based on changed files:

- PowerShell parse/smoke checks for `.ps1`;
- Node tests or `node --check` for `.js`, `.cjs`, `.mjs`;
- shell syntax/smoke checks for `.sh`;
- contract-check fixtures for provider contract changes;
- existing SGSD scripts where available.

Do not pretend a visual test ran if it did not. Record visual verification gaps
in the relevant verification file and continue unless the gap is critical.

## Checkpoint Cadence

Write/update a checkpoint:

- after every phase,
- before every milestone close,
- before any risky migration,
- before context pressure becomes dangerous,
- before stopping.

Keep the checkpoint committed.

## Commit Pattern

Use specific, scoped commits:

```text
docs(26): define cockpit operator question contract
feat(28): redesign mission control primary lane
feat(31): add canonical command envelope
feat(36): record gate value telemetry
feat(41): add knowledge provider registry
test(46): add gate failure injection harness
docs(54): refresh public onboarding docs
chore(v2.1): close full roadmap run
```

Never `git add -A`. Never `git add .`. Stage exact files.

## End State

The run is complete only when:

- v1.6 through v2.1 are closed or explicitly marked partially complete with
  non-critical gaps;
- `.planning/ROADMAP.md` reflects the final status;
- `.planning/STATE.md` is coherent;
- every active phase has verification;
- milestone summaries exist;
- outstanding gaps are recorded with repair paths;
- final commit is made.

## Prompt To Paste Into Claude

```text
You are in the cloned repo root for git@github.com:Berrowj/super-gsd.git on branch master.

Run the full SGSD future roadmap in autonomous mode from v1.6 through v2.1.

Operator approval: full autopilot is approved. Do not stop after each phase or
milestone for approval. Promote, execute, verify, close, commit, and continue
until v2.1 is complete or a true hard stop condition occurs.

Read this mission packet first:
.planning/milestones/CLAUDE-AUTO-HANDOVER-FULL-ROADMAP.md

Then follow it exactly:
- audit existing surfaces before building;
- use VTP/private KB if healthy, but degrade and continue if unavailable;
- use the book map, VIO enrichment, and visual handbook for each milestone;
- promote and run v1.6, then v1.7, v1.8, v1.9, v2.0, and v2.1;
- repair warnings and failures autonomously where safe;
- commit after every unit;
- write checkpoints frequently;
- stop only for credentials, unsafe destructive operations, unrecoverable state,
  security/privacy judgment, or an unrepaired critical after three focused
  repair attempts.

go
```
