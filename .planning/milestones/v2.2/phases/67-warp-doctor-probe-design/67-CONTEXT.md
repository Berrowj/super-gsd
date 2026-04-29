---
phase: 67
phase_name: Warp Doctor Probe Design
milestone: v2.2
roadmap: warp-integration
created: 2026-04-29
operator: jack.berrow
status: in-progress
deviation_from_standard: standard 10-step (code phase, FULL tier ATC, READ-ONLY invariant enforced like upgrade-drift Phase 62)
unblocked: yes (does not depend on M1-M5 manual UI checks; all probes are filesystem/env/profile-grep operations)
---

# Phase 67 — Warp Doctor Probe Design (CONTEXT)

## Goal

Build a read-only local diagnostic command at
`super-gsd/tools/warp-doctor/check.cjs` that probes the operator's Warp +
SGSD setup and emits a concise table + structured JSON for the cockpit and
future MCP. This is the canonical surface for "is my Warp + SGSD install
healthy?" that v2.2 onward depends on.

## Locked Scope (D67.1-D67.7)

- **D67.1**: Mirror the v2.1 `upgrade-drift` shape verbatim — 4 public APIs
  Lock-13-wrapped (`runWarpDoctor`, `getProbe`, `selfTest`, `_internals`),
  frozen probe-name array, frozen reason-notes, frozen status vocabulary,
  `--self-test` and `--json` and `--project` CLI flags, thin
  `run-self-test.cjs` shell that delegates via `spawnSync`. This minimises
  reviewer cognitive load and reuses an already-shipped pattern.
- **D67.2**: READ-ONLY invariant enforced exactly like Phase 62: `selfTest`
  scans `check.cjs` source for `fs.writeFileSync` / `fs.appendFileSync` /
  `fs.unlinkSync` / `fs.mkdirSync` / `fs.rmSync` / `fs.rmdirSync` and
  asserts zero matches. The doctor never writes — operator gets to choose
  what to do with the diagnosis.
- **D67.3**: Probe set seeded from Phase 63 audit findings (Section A-G of
  63-RESEARCH.md). Probe count >= 12 (richer than the roadmap's "probe
  list" minimum of 10).
- **D67.4**: PowerShell profile probe is grep-based: read `$PROFILE` (resolved
  via `process.env.USERPROFILE` + standard PowerShell profile path
  conventions) and grep for `function sg {` / `function sgsd {` / `function
  sgsd-setup {`. This gives terminal-derivable evidence without spawning
  PowerShell. On non-Windows hosts the probe returns `NOT-APPLICABLE`.
- **D67.5**: Codebase Context state is recorded as `MANUAL-CHECK-REQUIRED`
  (mirrors Phase 63 / WARP-SMOKE.md row Q10). Cannot be probed from
  terminal. The doctor must NOT pretend to verify it.
- **D67.6**: MCP config probe is a placeholder returning `NOT-APPLICABLE`
  (with reason: `mcp_not_yet_shipped`) until v2.3 Phase 68+ lands. Doctor
  will need a follow-up edit at MCP-ship time; encoded in the probe table
  as a forward-reference.
- **D67.7**: Self-test target = 12-15 assertions covering frozen-vocab
  shapes, every probe's degraded-sentinel path, READ-ONLY invariant, and
  ASCII-only enforcement. Mirrors Phase 62's selfTest assertion count.

## Inputs Consumed

- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-RESEARCH.md`
  Sections A-G (probe set source of truth)
- `.planning/milestones/v2.2/WARP-SMOKE.md` (acceptance probe list)
- `super-gsd/tools/upgrade-drift/check.cjs` (canonical shape pattern)
- `super-gsd/tools/upgrade-drift/run-self-test.cjs` (thin shell pattern)
- `super-gsd/tools/installer-audit/audit.cjs` (sister pattern)
- `WARP.md` + `AGENTS.md` (existence-probe targets; AGENTS.md just
  authored in Phase 65 commit `c0201af`)

## Outputs

- `super-gsd/tools/warp-doctor/check.cjs` (NEW; ~400 lines target)
- `super-gsd/tools/warp-doctor/run-self-test.cjs` (NEW; thin shell ~40 lines)
- Phase 67 standard artifacts: 67-CONTEXT.md (this), 67-01-…-PLAN.md,
  67-RESEARCH.md, 67-VERIFICATION.md, 67-ATC-REVIEW.md

## Acceptance

1. `node super-gsd/tools/warp-doctor/run-self-test.cjs` exits 0.
2. `node super-gsd/tools/warp-doctor/check.cjs --project C:\Users\jack.berrow\GSDedits`
   exits 0 (or 1 with actionable instructions; doctor never aborts hard).
3. `node super-gsd/tools/warp-doctor/check.cjs --project ... --json` emits
   parseable JSON conforming to `{ok, schema_version, ts, probes:[...], summary:{...}}`.
4. READ-ONLY invariant: `git status` before/after `check.cjs --run` (or any
   probe path) is byte-identical. Verified by selfTest A8.
5. ASCII-only enforced across both files (selfTest A11).
6. `runWarpDoctor` / `getProbe` / `selfTest` / `_internals` all
   Lock-13-wrapped (try/catch returns degraded sentinel; never throws upward).
7. PROBE_NAMES is `Object.freeze`d; selfTest A1 verifies length and frozen.
8. REASON_NOTES, STATUS_VALUES, MANUAL_CHECK_REASONS all frozen.
9. `WARP.md` / `AGENTS.md` / `CLAUDE.md` existence probes return PASS for
   the current repo (all three exist after Phase 65 commit `c0201af`).
10. Phase 67 close commit is atomic, isolated under
    `super-gsd/tools/warp-doctor/` + `.planning/milestones/v2.2/phases/67-…/`.

## Hard Boundaries

- Operator brief Rule 8: don't patch Warp source — Phase 67 doctor only
  reads filesystem/env, no Warp internals.
- Operator brief Rule 14: UI-bound facts MUST NOT be silently passed —
  Codebase Context probe returns MANUAL-CHECK-REQUIRED, never PASS.
- READ-ONLY invariant (D67.2): no fs writes anywhere in check.cjs.
- AGENTS.md Hard Rule 5: no source mutations outside an active plan —
  Phase 67 IS the active plan; it touches only its own
  `super-gsd/tools/warp-doctor/` tree plus its own phase artifacts.

## Out Of Scope

- PowerShell alias wrapper for `warp-doctor` (deferred; the roadmap calls
  it "optional ... later").
- MCP config probe content beyond placeholder (Phase 72 territory).
- Authoring `.warpindexingignore` (separate phase or fold into Phase 65
  follow-up).
- Auto-fixing any defects found (the doctor diagnoses; humans fix).

## Decisions Locked At Phase Open

- D67.8: Phase 67 dispatched without operator confirmation per
  `/sgsd-orchestrate go` auto-mode contract. Adds to the c0201af Phase 65
  close in this auto-run session.
- D67.9: Implementation strategy = orchestrator-authored (Opus) consistent
  with Phase 65 deviation D1. Reason identical: source pattern (upgrade-drift)
  and probe set (Phase 63) already loaded; dispatching executor would
  re-read the same context. Logged as DEVIATION D1 in 67-VERIFICATION.md.
  This is the second deviation from CLAUDE.md golden rule 2 in this auto-run;
  if a third phase repeats it, escalate to operator review.
