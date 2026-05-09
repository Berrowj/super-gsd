# 98-03 PLAN - Cross-Repo Feature Propagation Guard

## Goal

Make SGSD boot detect and repair the class of failures where a repo silently misses
new SGSD behavior because of stale project-local agents, stale installed agents,
missing Codex executor defaults, disabled VTP/intent-context routing, or missing
PowerShell helper functions.

## Tasks

1. Add a source-controlled audit/repair tool for:
   - project-local `.claude/agents/*.md` shadowing global/canonical agents
   - stale global `~/.claude/agents/sgsd-*.md` installs
   - missing globally installed SGSD VTP agents
   - legacy `gsd-*` planner/researcher/checker agents missing SGSD VTP
     planning contracts or VTP MCP tool exposure
   - project config missing Codex GPT-5.5/xhigh executor defaults
   - project config missing VTP enrichment and triage VTP flags
   - project config missing Opus/xhigh planner routing and plan-final
     Codex/MUDA review flags
   - project config missing auto-mode continuation / planning-pipeline
     enforcement flags
   - project `CLAUDE.md` missing current SGSD overlay-critical contracts:
     Karpathy principles, DLB-03 cascade read, DLB-01 `sgsd-recall` /
     `sgsd-curate`, planning-intent triage, and loop-force golden rule
   - auto-mode orchestration drift: command alias, Codex-first research,
     VTP enrichment after research, Opus 4.7/xhigh planning, Codex plan
     final review, Codex execution, and board-plus-Codex blocker recovery
   - missing intent/context-packet telemetry
   - stale non-junction `super-gsd` trees
   - PowerShell profile not loading `sgsd-profile-extensions.ps1`
2. Wire the audit into `sgsd-boot.ps1` so `sg` reports these before autonomous mode.
3. Add a read-only installer-audit probe so Warp Doctor / installer checks surface drift.
4. Repair current known repos:
   - `project-clarity-erp`
   - `horse-racing-predictor`
   - `Voice-Text-Plan`
   - `SGSD-WARP`
   - `GSDedits`
5. Verify with self-tests and an audit pass.
6. Repair cockpit boot topology so the Codex/ATC pane owns the long pane and
   Mission Control + Claude/Agents are split beside it.
7. Repair cockpit redraw / launch behavior:
   - dashboards and Codex narrator must not clear to a black screen on every
     refresh
   - `sg` must not repeatedly raise Windows Terminal / PowerShell windows to
     the foreground
   - auxiliary Codex watch windows should launch without stealing focus unless
     the operator explicitly asks for foreground behavior

## Acceptance

- `node super-gsd/tools/feature-propagation/audit.cjs --self-test` passes.
- `node super-gsd/tools/feature-propagation/audit.cjs --project-dir <repo>` reports
  missing/drifted features without throwing.
- `--repair` mode applies safe repairs only:
  config defaults, global SGSD agent install, profile extension loader.
- Boot preflight prints a concise `Feature propagation` status line.
- Clarity no longer has stale local `gsd-*` agent shadows after repair.
- VTP MCP availability is checked separately from VTP feature enablement.
- Legacy `gsd-planner`, `gsd-phase-researcher`, and `gsd-plan-checker`
  cannot silently plan/check with VTP enabled but no VTP artifact or bypass
  reason.
- `gsd-planner` dispatch is pinned to Opus/xhigh; Sonnet planner dispatches
  are treated as stale and overridden.
- Plan sets are final-draft gated before execution: Codex GPT-5.5/xhigh runs
  ATC + MUDA review, and NOGO routes back to Opus planner revision.
- `/sgsd-orchestrate go` treats phase/milestone completion as an intermediate
  state: it closes/advances and continues until no roadmap work remains, a hard
  blocker occurs, or the operator pauses.
- Windows Terminal cockpit launch gives the full-height pane to `SGSD2-Codex`
  because it carries ATC / gate synopsis / SpaceX checks.
- Cockpit panes repaint in place after the initial alternate-screen setup; no
  steady-state render path uses `Clear-Host` or `ESC[2J` full-screen clears.
- Boot no longer auto-raises Windows Terminal with `AppActivate`; foreground
  activation is opt-in.
- Auxiliary Codex watch windows launch minimized / no-focus by default.
- GSDedits root `CLAUDE.md` matches `super-gsd/CLAUDE-OVERLAY.md` for the
  overlay-critical session-start, memory, planning-triage, and loop-force
  sections.
- Feature propagation audit flags a stale project `CLAUDE.md` when active SGSD
  contracts are missing or legacy `brv-query` / `brv-curate` commands remain.
- `/sgsd-orchestrate auto` is documented as a hard auto loop: Codex handles
  research and code execution, VTP enrichment runs after research, Opus 4.7
  plans, Codex checks the plan, and blockers route to board adjudication plus
  a separate Codex challenge before any operator stop.
