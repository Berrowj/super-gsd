---
type: design-spec
date: 2026-08-05
slug: always-on-orchestration
status: operator-approved
approvals:
  - "2026-08-05 operator: Approach A approved as presented (P145-P150 extending v3.5)"
  - "2026-08-05 operator: triage firing = classifier-gated"
  - "2026-08-05 operator: gate posture = board line (report-only + commit-seam warn, auto-flip on falsifier)"
  - "2026-08-05 operator: codex hook trust = interactive approval on both machines"
supersedes_acs: ".planning/milestones/v3.5/phases/144-chronicle-host-shell-boundary/HANDOVER.md — Binding ACs written pre-board; the 2026-08-02 board memo rejected edit-seam hard-blocking. This spec's ACs replace them."
governing_decision: .planning/decisions/2026-08-02-always-on-gate-substrate.md
brief: .planning/briefs/2026-08-02-always-on-gate-substrate.md
vtp_evidence: .planning/briefs/2026-08-04-orchestration-always-on-VTP-EVIDENCE.md
provider_lock: "Claude orchestrates; Codex gpt-5.5/xhigh authors all SGSD orchestration source code."
---

# Design — Always-On Orchestration (v3.5 P145–P150)

## Problem

Six operator asks, one root cause. SGSD's governance (ATC, MUDA, phase discipline,
triage, skill routing) exists as prose that only a cooperating model follows, and
only inside `/sgsd-orchestrate auto`. Manual and `sg`-launched sessions get a
one-line greeting and nothing else. Codex sandbox flags are hardcoded in two
shell scripts. Dozens of SGSD skills are never invoked because nothing routes to
them. The 2026-08-02 investigation found six declared-but-dead mechanisms, all
failing silently while reporting success.

Design principle (carried from P144 handover): **absence of evidence must be loud.**
Board constraint (2026-08-02 memo): **no blocking at the edit seam; report-only
first; eventual blocking at the commit seam; Codex hook trust is the single
highest-leverage item; routing must be a runtime dispatch decision.**

## P145 — Codex Profile Registry + /sgsd-codex-control

**What:** `super-gsd/registry/codex-profiles.yaml` — named dispatch profiles:

| profile  | sandbox          | ephemeral | approval    | model / effort      | used by |
|----------|------------------|-----------|-------------|---------------------|---------|
| executor | workspace-write  | no        | full-auto   | gpt-5.5 / xhigh     | codex-executor.sh |
| review   | read-only        | yes       | n/a         | gpt-5.5 / xhigh     | codex-exec.sh (review/gate steps) |
| triage   | read-only        | **no**    | n/a         | gpt-5.5 / xhigh     | sgsd-triage Step 0.5 (P148) |

`codex-executor.sh` and `codex-exec.sh` resolve flags from the registry
(single source of truth) instead of inline literals. New skill
`/sgsd-codex-control`: `show`, `set <profile> <field> <value>`, per-dispatch
`--profile` override. Guardrail: `danger-full-access` sandbox and any trust
change always require interactive operator confirmation — the skill refuses to
set them non-interactively.

**AC-145:** (a) both wrappers produce byte-identical codex invocations for
today's defaults when the registry is untouched; (b) `/sgsd-codex-control set`
round-trips a change and the next dispatch uses it; (c) a `danger-full-access`
set attempt without a TTY fails loudly.

## P146 — Session Governance Hooks (all modes)

**What:** Repo-local `.claude/settings.json` hook registrations (installed by the
SGSD installer, so any repo onboarded to SGSD gets them; never global on day one
per board):

- **SessionStart** — injects the governance contract: the gate tier table
  (SKIP/LITE/FULL/GATE), which gates apply in the current mode (manual /
  semi-auto / full-auto are the same table — mode changes who confirms, not what
  runs), and the active milestone/phase from STATE.md frontmatter.
- **UserPromptSubmit** — `sgsd-intent-classifier.cjs` (local node, <1s, no LLM):
  stamps intent class (planning / execution / retrospective / trivial) using the
  trigger lexicon from sgsd-triage + skill-routing.yaml (P149). On planning
  intent: injects a directive to invoke `/sgsd-triage`. On matches for neglected
  skills: injects "consider /sgsd-X — matched signature Y".
- **Report-only quality gate** — `sgsd-quality-gate.js` (PostToolUse, report
  mode ONLY): on source-file mutation, resolves active phase from STATE.md
  frontmatter + glob of real `{NN}-*-PLAN-LOCKED.md` naming (never regex-over-
  prose), and appends an evidence row (phase, artifacts present/missing) to
  `.planning/metrics/gate-evidence.jsonl`. Missing evidence = loud cockpit tile,
  never a block. Exit 0 always in non-SGSD repos.
- **Board cheap fixes landed here, unbundled** (memo item 2): handoff-chain
  latch reset on `refused` rows; autopilot-watchdog reads STATE.md frontmatter
  instead of prose regex; unregister dead `gsd-atc-slice-gate.js`; delete dead
  config knobs.

**AC-146:** (a) an `sg`-launched manual session shows the governance contract in
its first response with zero operator action; (b) a planning-shaped prompt in a
manual session produces a visible `/sgsd-triage` directive; (c) a source edit
with no PLAN for the active phase produces a gate-evidence row and a cockpit
signal within one refresh; (d) all hooks exit 0 in a non-SGSD repo.

## P147 — Commit-Seam Gate (warn → earned block)

**What:** `super-gsd/hooks/sgsd-commit-gate.cjs` wired as a git pre-commit hook
(installer-managed). Warn mode: commit touching source without phase evidence
(PLAN-LOCKED + ATC/AUDIT artifacts for the active phase) prints a loud
governance warning and logs a shadow row to `.planning/metrics/commit-gate-shadow.jsonl`.
Block mode flips ONLY when the board falsifier is met: **≥200 real payloads
across GSDedits AND devcp with false-block rate <5%** (computed by
`sgsd-commit-gate.cjs --shadow-report`). Escape hatch: `.sgsd-gate-off` sentinel
skips the block and logs that it did. One invocation per commit; full
`git diff --cached` evidence; failure mode is "commit refused, files intact".

**AC-147:** (a) warn rows accumulate on real commits in both repos; (b)
`--shadow-report` computes the falsifier verdict mechanically; (c) block mode
cannot activate before the falsifier passes; (d) sentinel bypass is logged.

## P148 — Cross-Model Triage (Codex second opinion + VTP)

**What:** `sgsd-triage` upgrade:

- **Step 0 hardening:** if `vtp_route_and_retrieve` returns `reflection: null`
  OR fewer than 2 evidence hits, fall back to direct `vtp_search_substrate` with
  the raw query; log the degradation row. (Three consecutive null-reflection runs
  observed 2026-08-02→04.)
- **Step 0.5 (new):** classifier-gated Codex dispatch via the `triage` profile —
  prompt = operator raw query + tier slice + VTP evidence framing + STATE
  frontmatter. Codex returns a structured verdict: `{path: A|B|C|D, risk_flags,
  missed_context, recommended_skills}`. Claude reconciles; **disagreement between
  Codex verdict and Claude's classification is surfaced to the operator, never
  silently resolved.** Timeout: `--timeout-tier custom:300` (per the
  codex-exec 60s-cap memory). On Codex failure: proceed single-model, log row.
- Auto-fire contract: the P146 UserPromptSubmit directive makes triage fire on
  planning intent in every session type — the trigger list stops being prose.

**AC-148:** (a) planning-shaped prompt → triage fires with a Codex verdict row
in `.planning/metrics/vtp-routing-log.jsonl`; (b) forced VTP null-reflection →
fallback search runs and is logged; (c) Codex-unavailable → triage completes
single-model with a logged degradation; (d) a seeded disagreement fixture
surfaces both verdicts to the operator.

## P149 — Skill-Routing Table (utilization)

**What:** `super-gsd/registry/skill-routing.yaml` — one source of truth mapping
intent signatures → skills, covering the neglected inventory (sgsd-muda-audit,
sgsd-token-audit, sgsd-distill, sgsd-sepl, sgsd-overwatcher, sgsd-readiness,
sgsd-audit, sgsd-health, gsd-health, gsd-cleanup, …) with per-skill: trigger
signatures, dispatch moment (prompt-time / phase-close / milestone-close /
weekly), and mode applicability. Consumed by (a) the P146 classifier for
prompt-time suggestions, and (b) the orchestrate loop for scheduled moments
(phase close → muda-audit candidacy check; milestone close → distill; etc.).
Orchestrate SKILL.md's routing prose is *replaced by a reference* to the table —
prose stops being the mechanism (board addendum).

**AC-149:** (a) the table validates against a schema check in self-test; (b) a
prompt matching a neglected-skill signature yields a visible suggestion in a
manual session; (c) at phase close in auto mode the loop consults the table and
logs which scheduled skills fired or why not.

## P150 — Propagation + Trust Grant + Reboot Runbook

**What:** Merge → push `origin master` (Berrowj/super-gsd). Local: re-run
installer to refresh junctions/hooks/profile functions. devcp:
`ssh devcp` → `/sgsd-update` (pull + installer) in
`/opt/clarity/project-clarity-erp`. Interactive Codex hook-trust grant ceremony
executed on BOTH machines (operator present; exact command provided; trust
persisted, no `--dangerously-bypass-hook-trust`). Deliverable artifact
`PROPAGATION.md`: what live-updates (skills, scripts, registries — next session
pickup) vs what needs reboot (PowerShell profile functions, MCP servers,
already-running Claude sessions) with exact reboot commands per machine.

**AC-150:** (a) `git log` on devcp shows the pushed HEAD; (b) both machines pass
a post-update smoke (`sgsd -NoOpen` preflight + hook self-test); (c) Codex hook
trust verified granted on both (probe: dispatch touches a forbidden path →
`block-forbidden-write.cjs` fires); (d) PROPAGATION.md reboot commands verified
by running them.

## Follow-on (recorded, NOT scheduled)

- **SKILL.md excision** (board item 6 / Q5): replace sgsd-orchestrate's 2,988
  lines of pseudo-code prose with executable dispatch scripts. Separate
  decision; do not bundle.
- Commit-seam block-mode activation — happens automatically when the P147
  falsifier passes; no new phase needed.

## Error handling (cross-cutting)

Every new hook: narrow try/catch, exit 0 on anything unexpected, log the
failure row — a broken governance hook must never brick editing (board risk:
fail-closed registry load). No hook reads `~/.claude/settings.json` env block.
Absolute paths resolved at install time from the repo the installer runs in,
never hardcoded to a machine path.

## Testing

Each phase ships self-test assertions in the existing harness style
(`--self-test` CLI per house pattern, registered in the milestone self-test
run). P150 smoke is cross-machine and manual-verified once.
