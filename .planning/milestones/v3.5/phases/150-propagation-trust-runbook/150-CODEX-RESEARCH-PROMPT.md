# P150 RESEARCH — Propagation + Trust Grant + Reboot Runbook

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose — and the whole substrate propagates to every SGSD install (local + devcp).</intent>

You are the Codex phase researcher (read-only). Answer with file:line/command evidence; a planner turns this directly into a locked plan. Budget ~5 minutes; stay inside this repo (no SSH).

## Phase goal + constraints (CONTEXT.md verbatim)
---
phase: "150"
slug: propagation-trust-runbook
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p150"
depends_on: ["145", "146", "147", "148", "149"]
---

# P150 Context — Propagation + Trust Grant + Reboot Runbook

## Goal

Every SGSD install gets the v3.5 substrate: push to origin (Berrowj/super-gsd),
local installer re-run, devcp `/sgsd-update`, interactive Codex hook-trust
ceremony on both machines, and a PROPAGATION.md runbook distinguishing
live-updatable pieces from reboot-required pieces with exact commands.

## Targets

- **Local (this machine):** GSDedits worktrees + any repo with super-gsd
  junction. Installer re-run refreshes skills/scripts/registries/hooks.
- **devcp:** SSH host `devcp`, `/opt/clarity/project-clarity-erp`, native-Linux
  codex under WSL-equivalent env. `/sgsd-update` = pull origin/master +
  installer re-run.

## Live-update vs reboot (to be verified, seed expectation)

- Live (next session pickup): skills, scripts, registries, agents, hook script
  bodies.
- Reboot required: PowerShell profile functions (sg/sgsd), MCP server processes
  (stale-child memory: source edit does nothing for spawned child), running
  Claude sessions (need restart to re-read settings.json hook registrations).
- Runbook must include: Windows (`. $PROFILE` vs new terminal; killing stale
  MCP children), devcp (session restart command), and cockpit relaunch.

## Trust ceremony (operator-present, board item 1)

Interactive approval of .codex/hooks.json hooks on BOTH machines; no
`--dangerously-bypass-hook-trust`. Verification probe: dispatch attempting a
forbidden-path write → `block-forbidden-write.cjs` fires (AC-150c).

## Constraints

- Push targets `origin master` after merge from working branch; no PII in
  commits (operator identity rule).
- devcp update must not interrupt in-flight devcp work: check for running
  sessions/uncommitted state before pulling; coordinate or defer.
- PROPAGATION.md commands must be actually executed once as verification
  (AC-150d), not just written.

## devcp reconciliation facts (discovered 2026-08-05, planning-push session)

- `~/GSDedits` on devcp is a FORK: 883 local commits not on GitHub / 1,152
  behind. **Commit authors carry real name + two real emails (googlemail +
  johncullenlighting) — MUST NOT be pushed to GitHub without author rewrite
  (no-PII rule).** Local backup branch created: `devcp-fork-backup-2026-08-05`.
- `~/.claude/super-gsd/source` fast-forwarded cleanly to `d1d95fb` and
  `.super-gsd-version` pinned; but the INSTALLED layer
  (`~/.claude/super-gsd/scripts`) had 43 drifted/extra files, including
  fork-only libs (`board-runner.cjs`, `execution-authority.sh`,
  `concurrency-policy.cjs`, `decision-registry.cjs`) that may depend on fork
  versions of shared libs — blanket sync deferred to this phase.
- Targeted sync done 2026-08-05: `codex-exec.sh`, `codex-executor.sh`,
  `codex-patch-executor.sh` copied from source (timeout fix verified present).
  Full-tree backup: `~/.claude/super-gsd/scripts-backup-2026-08-05.tgz`.
- devcp default codex model is `gpt-5.6-sol` (pinned in clarity config.json —
  wrapper-default overwrite is behavior-safe there; do not regress their pin).
- `/opt/clarity/project-clarity-erp/super-gsd` is VENDORED inside the clarity
  repo (origin = Berrowj/project-clarity-erp), 339 dirty files, branch
  `feat/launch-guide-gate` — out of scope for framework propagation; clarity
  project's own flow governs it.
- P150 must decide: fork author-rewrite + reconcile strategy for the 883
  commits, and the 43-file installed-layer reconciliation.

## Acceptance criteria

AC-150 (a)(b)(c)(d) from the design spec.

## Questions
1. Installer surface: which script re-installs the local substrate (sgsd-onboard? sgsd-update? installer under super-gsd/), what exactly does it copy/junction, and what is the exact re-run command for (a) this machine, (b) devcp /sgsd-update?
2. Trust ceremony mechanics: where does codex hook trust state live (.codex/, codex config), what interactive command grants it, and how can AC-150c's forbidden-write probe be dispatched mechanically after the grant (cite block-forbidden-write.cjs)?
3. Live-vs-reboot inventory: verify the CONTEXT seed expectation against actual wiring — which pieces are read per-session vs held by long-lived processes (MCP servers, PowerShell profile, running Claude sessions, cockpit)?
4. devcp safety: what checks distinguish in-flight devcp work (running sessions, uncommitted state) before a pull, and what is the exact safe-update command sequence given the fork facts in CONTEXT (883 PII commits — no push from devcp)?
5. Which pieces of the 43-file installed-layer drift on devcp remain unreconciled (read .planning/analyses/ or decisions referencing devcp reconciliation), and what should P150 do vs defer?
6. AC-150 (a)(b)(c)(d): quote verbatim from the design spec section p150.

## Report format: ## Findings (numbered, cited), ## AC-150 verbatim, ## Risks, ## Recommended plan shape (tasks with files_touched; mark operator-present tasks explicitly). Max ~120 lines.
