---
milestone: v1.6
status: proposed
source:
  - .planning/milestones/HANDBOOK-FUTURE-ROADMAP.md
  - .planning/milestones/HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md
  - .planning/milestones/VIO-ROADMAP-ENRICHMENT.md
activation_rule: Promote through deliberate scoping before editing STATE.md.
---

# Milestone v1.6 Proposed Requirements

## Name

Cockpit 2.0 And Startup Verification

## Why This Replaces The Earlier v1.6 Shape

The earlier v1.6 proposal focused on boot, portability, and knowledge setup.
The implementation audit found that most of that behavior already exists:

- `sg` starts Claude in the current terminal and cockpit separately.
- `sgsd-setup` writes knowledge and memory configuration.
- VTP is no longer hardcoded as the only knowledge source.
- dashboard panes run through a visible failure host.
- the startup guide already exists.

The useful next milestone is therefore not "build boot." It is:

1. verify and document existing boot behavior,
2. redesign the cockpit around operator questions,
3. expose model/agent/Codex activity in a clearer structure,
4. create the data contract needed for future cockpit and roadmap work.

## Mission

Make the cockpit answer what the operator actually cares about:

1. what the model is doing right now,
2. what SGSD is trying to complete,
3. what completing it unlocks,
4. what is blocked or risky,
5. which agents were used and what each did,
6. what Codex is doing or concluded,
7. what evidence was produced,
8. what should happen next.

Keep it terminal-first. Reuse existing telemetry before adding new telemetry.
Do not start a web dashboard rewrite inside v1.6.

## VTP Book, Research, And VIO Enrichment

### Book Lens

- The Design of Everyday Things: the cockpit is the system image. It should
  make the hidden SGSD process visible enough that the user's mental model
  matches what is happening.
- Don't Make Me Think: the first viewport should remove mental chatter. It
  should not force the operator to infer intent from scattered logs.
- Writing Effective Use Cases: each visible lane should be tied to an actor
  goal, trigger, success result, failure alternative, and repair path.
- Software Architecture for Developers: the cockpit should be a "just enough"
  live architecture view, not a decorative terminal animation.
- Software Architecture in Practice and Fundamentals of Software Architecture:
  cockpit usefulness is a quality attribute and should be verified with
  scenario checks.
- A Philosophy of Software Design: do not leak every subsystem detail into the
  top-level view. Hide complexity behind a small operator model.

### Research Lens

- Shift-Up: autonomous software needs executable guardrails and persistent
  architecture/decision records. Cockpit 2.0 should show those records, not just
  prose summaries.
- Skill-RAG: classify failure before retrying. Cockpit 2.0 should distinguish
  blocked, waiting, reviewing, stale, timed out, and complete states.
- HiveMind: provider contention and timeouts need visible state, not repeated
  blind retries.
- Mnemonic Sovereignty: memory and knowledge state should have provenance and
  privacy boundaries before being surfaced or written back.
- ISO-Bench / Why LLMs Aren't Scientists Yet: status can look good while the
  real outcome is wrong. Cockpit 2.0 should link to evidence, not only narrative
  confidence.

### VIO Lens

The VIO conversation search changes v1.6 in four ways:

- show the workflow as a tree, not as loose text;
- hide detail until needed through progressive disclosure;
- validate one thin path end to end before broadening;
- make current AI activity visible enough that a collaborator can help without
  reading raw logs.

The controlling VIO source for promotion is:

```text
C:\Users\user\GSDedits\.planning\milestones\VIO-ROADMAP-ENRICHMENT.md
```

## Requirements

### COCKPIT

- [ ] **COCKPIT-01**: First viewport answers the eight operator questions in
  the mission statement without requiring the operator to scan raw logs.
- [ ] **COCKPIT-02**: Cockpit has a stable "objective tree" model:
  milestone -> phase -> objective -> gate/agent/artifact/blocker/unlock.
- [ ] **COCKPIT-03**: Cockpit separates primary, secondary, and diagnostic
  lanes so useful data is not duplicated across panes.
- [ ] **COCKPIT-04**: Cockpit shows current model activity from the live tool
  stream or cache: current action, current file/command if known, last artifact,
  and last meaningful model status.
- [ ] **COCKPIT-05**: Cockpit shows current objective, expected unlock, latest
  blocker, latest repair action, and next action.
- [ ] **COCKPIT-06**: Cockpit shows agents used in the current phase/session,
  what each was asked to do, and the latest result or artifact.
- [ ] **COCKPIT-07**: Cockpit shows Codex review state: idle/running/timed out/
  blocked/complete, scope, conclusion, critical/warning count, and report path.
- [ ] **COCKPIT-08**: Cockpit marks stale, missing, or unavailable data instead
  of presenting old data as current.

### DATA

- [ ] **DATA-01**: Cockpit 2.0 reads existing sources first:
  `.planning/STATE.md`, `.planning/ROADMAP.md`, phase folders,
  `.planning/metrics/activity-log.jsonl`, `codex-log.jsonl`,
  `token-log.jsonl`, `muda-log.jsonl`, `edge-guard-log.jsonl`,
  `readiness-log.jsonl`, and current Claude session JSONL files.
- [ ] **DATA-02**: Any new cockpit state file must be justified by a missing
  answer to one of the eight operator questions.
- [ ] **DATA-03**: If a new state file is needed, it should be small and typed:
  `cockpit-state.json` or `cockpit-intel.json`, not a second telemetry system.
- [ ] **DATA-04**: Cockpit state must include stable IDs for milestone, phase,
  objective, agent, gate, artifact, blocker, and Codex run when available.

### UX

- [ ] **UX-01**: The top area should be operator-question-led, not
  subsystem-led.
- [ ] **UX-02**: Long lists use progressive disclosure or truncation with
  counts and evidence paths.
- [ ] **UX-03**: The cockpit remains readable in typical Windows Terminal and
  Warp layouts.
- [ ] **UX-04**: Status vocabulary is normalized: active, waiting, blocked,
  reviewing, timed-out, stale, complete, unavailable.
- [ ] **UX-05**: No lane should repeat the same information unless it changes
  the operator's decision.

### BOOT

- [ ] **BOOT-01**: Existing `sg`, `sg -Go`, `sg -FullPreflight`,
  `sg -NoClaude`, `sg -NoCockpit`, `sgsd`, and `sgsd -Claude -Greet` behavior
  is verified and recorded.
- [ ] **BOOT-02**: Fast boot and full preflight timings are captured.
- [ ] **BOOT-03**: Startup guide and README point users to the right daily
  command without requiring VTP.
- [ ] **BOOT-04**: Dashboard host failures still show a red failure pane and do
  not collapse into a normal PowerShell prompt.

### KNOWLEDGE

- [ ] **KNOW-01**: VTP/private KB state is shown as optional context, not a
  hard dependency.
- [ ] **KNOW-02**: If knowledge enrichment is unavailable, cockpit shows
  unavailable/disabled with a repair path.
- [ ] **KNOW-03**: Roadmap promotion reads the VIO enrichment file, book map,
  implementation audit, and visual handbook before final phase planning.

## Claude Enrichment Required Before Planning

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Read:
- docs/reports/SGSD-VTP-Visual-Handbook.html
- docs/reports/SGSD-VTP-Book-Enrichment-Map.html
- .planning/milestones/HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md
- .planning/milestones/VIO-ROADMAP-ENRICHMENT.md
- .planning/milestones/COCKPIT-2.0-SCOPE.md
- super-gsd/scripts/sgsd-mission-control.ps1
- super-gsd/scripts/sgsd-narrative.ps1
- super-gsd/scripts/sgsd-codex-monitor.ps1
- super-gsd/scripts/sgsd-boot.ps1
- super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md

Then replace this slot with:
1. current cockpit signal inventory,
2. duplicate-risk list,
3. cockpit objective-tree schema,
4. layout proposal for terminal view,
5. evidence paths,
6. kill/defer conditions.
-->
```

## Proposed Phases

- Phase 26: Cockpit Operator Question Contract
- Phase 27: Cockpit Data Source And Objective Tree Audit
- Phase 28: Mission Control 2.0 Layout
- Phase 29: Agent And Codex Visibility Lanes
- Phase 30: Startup Verification And Cockpit Acceptance

## Kill Or Defer Conditions

- Defer any web-dashboard work until the terminal cockpit has one verified thin
  path.
- Defer new telemetry if existing logs already answer the operator question.
- Kill any cockpit section that does not help the operator decide continue,
  repair, wait, or stop.
- Keep boot changes to verification unless a real failing behavior is found.

## Do Not Start Until

- Operator confirms v1.6 should be promoted.
- Claude runs the enrichment slot above.
- Claude creates an active milestone folder with an existing-surface audit.
- ROADMAP.md and STATE.md are updated intentionally, not by this proposal file.
