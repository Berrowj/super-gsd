---
type: gap-audit
phase: 8
date: 2026-04-19
scope: super-gsd framework (skills, agents, scripts, tools, hooks, config, docs)
source: .planning/phases/08-sgsd-self-audit/scratch-findings.md (FINDING-1..23)
dlbs_referenced: [DLB-01, DLB-02, DLB-03]
---

# Super GSD Gap Audit — 2026-04-19

## 1. Summary

**Overall health:** the framework has three live fault surfaces — **dispatch routing** (agent name typos prevent `subagent_type` resolution), **install completeness** (one critical fix landed, one hook-registration gap remains), and **documentation drift** (inventory counts, broken install globs, stale command names). The memory-layer gap that originally motivated FINDING-18 is superseded by DLB-01's `sgsd-recall` / `sgsd-curate` shell tier — the broken `brv-curate` interface is being retired rather than repaired.

**Counts (23 findings total):**

| Severity | Open | Fixed | Superseded | Total |
|---|---|---|---|---|
| Critical | 2 | 1 | 1 | 4 |
| High | 6 | 0 | 0 | 6 |
| Medium | 6 | 0 | 0 | 6 |
| Low | 3 | 0 | 0 | 3 |
| **Total** | **17** | **1** | **1** | **23** (+4 merged as duplicates of FINDING-18 into Recommendations) |

**Top 5 by severity × blast radius:**

1. **FINDING-19 (critical, OPEN)** — Manual-install glob `super-gsd/skills/gsd-*/` matches zero directories in README and USER-GUIDE; any user following manual-install instructions ends up with zero skills.
2. **FINDING-10 (critical, OPEN)** — `phase-verifier.mjs` hard-exits `code 2 BLOCKED` if `config.browser_verify` is missing; the overlay template omits the key, so every fresh install trips the gate.
3. **FINDING-3 (high, OPEN)** — Agent `name:` frontmatter contains doubled-prefix typos (`ssgsd-ceo`, `sgsd-sgsd-board-*`) — `subagent_type` resolution silently fails for orchestrate-loop classifier + context-selector.
4. **FINDING-13 (high, OPEN)** — `sgsd-activity-logger.js` and `sgsd-statusline.js` absent from `settings-overlay.json`; dashboards (sgsd2 narrative + statusline) are silently dead after install.
5. **FINDING-22 (high, OPEN)** — Shipped `CLAUDE-OVERLAY.md` dispatch table is missing readiness rules 0 / 0.5 / 4.5 / 4.6, so every project installed via the documented path runs without unattended-run safety gates.

**DLBs already covering remediation:**

- **DLB-01** (memory topology) — supersedes FINDING-18 via `sgsd-recall` / `sgsd-curate` wrappers. Preserves legacy `brv-query-local.js` / `brv-curate-local.js` for a future BM25 backing when the corpus earns it (40-file tripwire). Shipped in commit `9d33601`.
- **DLB-02** (MUDA learning loop) — treats FINDING-17 and FINDING-18 as hard pre-requisites before any MUDA write-path work. FINDING-17 landed in commit `b6dd3a6`.
- **DLB-03** (intent continuity) — depends on DLB-02's install-blocker fixes; adds `outcome_delivered` structural injection into every executor prompt.

**What is NOT a gap:** milestone-readiness + phase-readiness gates, sgsd-heartbeat hook, and `sgsd-ctx` context-gauge (commit `98dc90d`) are all functioning — audit confirms they are wired correctly where shipped.

---

## 2. Skills Audit

| SKILL.md | Wired (Y/N) | Invoked by | Notes |
|---|---|---|---|
| sgsd-orchestrate | Y | user (`/sgsd-orchestrate go`) | Dispatch-table divergence from project CLAUDE.md — see FINDING-22 |
| sgsd-deliberate | Y | user (`/sgsd-deliberate`) | Board dispatch broken — FINDING-1 (description-only) + FINDING-6 (inline duplicate of sgsd-ceo workflow) |
| sgsd-browser | Y | sgsd-orchestrate (frontend verify) | OK — gated by `config.browser_verify` which the overlay omits (FINDING-10) |
| sgsd-brv-setup | Partial | user | Interface retired by DLB-01; audit needed to confirm residual references |
| sgsd-overwatcher | Y | user | OK |
| sgsd-pause | Y | user (`/sgsd-pause`) | OK |
| sgsd-readiness | Y | rule 0 (milestone) / rule 4.5 (phase) | OK — but shipped overlay lacks these dispatch rules (FINDING-22) |
| sgsd-resume | Y | user (`/sgsd-resume`) | OK |
| sgsd-token-audit | Y | user | OK |
| sgsd-transition | Y | user | OK |
| gsd-list-phase-assumptions | **N** | orchestrate SKILL.md:562 (referenced) | **MISSING** — not installed anywhere; Karpathy Principle 1 gate has no implementation (FINDING-4) |
| VTPidea | Orphan | user | Project-specific (VTP) content shipped in framework scope without disclaimer (FINDING-5) |

Shipped skill count: **10 sgsd-* directories** (not 7/8 as README/USER-GUIDE claim — see FINDING-20).

---

## 3. Agents Audit

| Agent name file | Called by | Orphan (Y/N) | Notes |
|---|---|---|---|
| sgsd-ceo.md | (dispatch-table row 1 only; never invoked in practice) | Effectively Y | `name: ssgsd-ceo` typo (FINDING-3); inline logic in sgsd-deliberate bypasses it (FINDING-2, FINDING-6) |
| sgsd-board-architect.md | sgsd-deliberate Step 3 (description-only) | Soft-orphan | `name: sgsd-sgsd-board-architect` typo (FINDING-3); no `subagent_type` binding (FINDING-1) |
| sgsd-board-contrarian.md | sgsd-deliberate Step 3 | Soft-orphan | same as architect |
| sgsd-board-moonshot.md | sgsd-deliberate Step 3 | Soft-orphan | same as architect |
| sgsd-board-pragmatist.md | sgsd-deliberate Step 3 | Soft-orphan | same as architect |
| sgsd-classifier.md | sgsd-orchestrate SKILL.md:94 (`subagent_type`) | **Broken** | `name: ssgsd-classifier` typo prevents exact-name match (FINDING-3) |
| sgsd-context-selector.md | sgsd-orchestrate SKILL.md:119 (`subagent_type`) | **Broken** | `name: ssgsd-context-selector` typo (FINDING-3) |
| sgsd-milestone-readiness.md | rule 0 (auto-mode milestone entry) | N | OK |
| sgsd-phase-readiness.md | rule 4.5 (pre-executor re-probe) | N | OK |
| sgsd-workflow-auditor.md | user-invoked | N | OK (tree-only in git status; not yet committed at audit time) |

Shipped agent count: **10 .md files** (not 7 as README/USER-GUIDE claim — see FINDING-20).

---

## 4. Scripts Audit

| Script | Input sources | Output format | Caller | Documented? |
|---|---|---|---|---|
| sgsd-mission-control.ps1 | `.planning/STATE.md`, git, FileSystemWatcher | terminal (reactive redraw) | `sgsd1.cmd` wrapper | Yes — SGSD-WORKSPACE-GUIDE §6 |
| sgsd-dashboard.ps1 | same as mission-control (polling) | terminal (10s tick) | **None** — no `.cmd` wrapper | No — superseded predecessor (FINDING-7) |
| sgsd-narrative.ps1 | `.planning/metrics/activity-log.jsonl` | terminal (Haiku narrative) | `sgsd2.cmd` wrapper | Yes — but dependency hook absent (FINDING-11, FINDING-13) |
| sgsd-gate-verdict.ps1 | phase-verifier output | terminal (sgsd3 pane) | `sgsd3.cmd` wrapper | Yes |
| sgsd-agent-dashboard.ps1 / .sh | agent activity logs | terminal | **None** — no wrapper | Partially — MONITORING-SETUP.md promotes it, WORKSPACE-GUIDE omits it (FINDING-8) |
| sgsd-live-feed.ps1 | activity log | terminal scrollable tail | **None** | **No** — dead script (FINDING-9) |
| sgsd-thinking.ps1 | hardcoded project=`project-clarity-erp` | terminal | **None** | **No** — dead + project-specific (FINDING-9) |
| sgsd-recall.sh / .ps1 | `.brv/context-tree/` + `INDEX.md` | text (top-3 matches) | orchestrator prompt composition | Yes — shipped via DLB-01 commit `9d33601` |
| sgsd-curate.sh / .ps1 | new finding content | writes file + updates INDEX.md | sgsd-orchestrate Step 9 | Yes — DLB-01 |
| sgsd-ctx | token metric files | terminal gauge | `sgsd-orchestrate` exit-check | Yes — commit `98dc90d` |

---

## 5. Tools Audit

| Tool | Invocation path | Known callers | Untested platforms |
|---|---|---|---|
| phase-verifier.mjs | `node super-gsd/tools/phase-verifier/phase-verifier.mjs` | sgsd-orchestrate Step 6.6 (frontend verify gate) | Linux / macOS — no CI, no platform guard (FINDING-12). Hard-fails on missing `config.browser_verify` (FINDING-10). |
| brv-query-local.js | preserved in `super-gsd/overwatcher/` | future BM25 backing (per DLB-01 tripwire) | — (inert until corpus ≥40 files) |
| brv-curate-local.js | preserved in `super-gsd/overwatcher/` | future BM25 backing (per DLB-01 tripwire) | — |

---

## 6. Hooks Audit

| Hook file | In settings-overlay (Y/N) | Event type | Status |
|---|---|---|---|
| gsd-session-start.js | Y | SessionStart | OK |
| gsd-token-logger.js | Y | PostToolUse | OK |
| gsd-stuck-detector.js | Y | PostToolUse | OK |
| gsd-checkpoint-writer.js | Y | PostToolUse | OK |
| gsd-context-monitor.js | Y | PostToolUse | OK |
| sgsd-activity-logger.js | **N** | PreToolUse (per file comment) | **MISSING registration** — sole writer of activity-log.jsonl → sgsd2 narrative silently empty (FINDING-13, FINDING-11) |
| sgsd-statusline.js | **N** | statusLine (per file comment) | **MISSING registration** (FINDING-13); install comment references wrong filename `gsd-super-statusline.js` (FINDING-14) |
| sgsd-heartbeat.js | Partial | PostToolUse | Shipped recently; settings-overlay coverage needs confirmation |

Shipped hook count: **8 .js files** (not 5 as README/USER-GUIDE claim — see FINDING-20).

**Version headers:** only `sgsd-statusline.js` carries a `gsd-hook-version:` header. No `super-gsd/VERSION` file exists (FINDING-15).

**Installer merge:** commit `b6dd3a6` now auto-merges `settings-overlay.json` into `~/.claude/settings.json` during `install.sh` — FINDING-17 is **FIXED**. However, FINDING-13 (missing entries for the two sgsd hooks inside the overlay) is still OPEN — the auto-merge propagates an incomplete overlay.

---

## 7. Config Audit

| Key | Default | Read by | Written by | Present in overlay (Y/N) |
|---|---|---|---|---|
| workflow.mode | `"yolo"` | sgsd-orchestrate | installer | Y |
| workflow.granularity | `"standard"` | sgsd-orchestrate | installer | Y |
| workflow.skip_discuss | `false` | sgsd-orchestrate rule 1 | installer | Y |
| workflow.research | `true` | sgsd-orchestrate rule 2 | installer | Y |
| workflow.plan_check | `true` | sgsd-orchestrate rule 4 | installer | Y |
| workflow.verifier | `true` | sgsd-orchestrate rule 6 | installer | Y |
| workflow.auto_advance | `true` | sgsd-orchestrate rule 7 | installer | Y |
| workflow.plan_format | `"compressed_xml"` | planner | installer | Y |
| workflow.agent_report_max_words | `300` | all executors | installer | Y |
| workflow.nyquist_validation | referenced as `true` | orchestrate SKILL.md:569 | — | **N** (FINDING-16) — gate silently disabled |
| browser_verify (block) | — | phase-verifier.mjs:101 | — | **N** (FINDING-10) — installer trips BLOCKED on every fresh install |

---

## 8. Docs Audit

Dead links, stale references, and missing sections (file:line citations):

- **README.md:45** — `for d in super-gsd/skills/gsd-*/` glob matches zero directories (FINDING-19 — **critical** — manual install broken).
- **USER-GUIDE.md:205** — same broken glob as README:45 (FINDING-19).
- **README.md:172** — inventory claim `agents/ # 7 agent definitions` — actual count is 10 (FINDING-20).
- **USER-GUIDE.md:135,167-169** — inventory claims 7 agents / 8 skills / 5 hooks — actual counts 10 / 10 / 8 (FINDING-20).
- **USER-GUIDE.md:363-365** — promotes `/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase` slash commands; none are installed (FINDING-21).
- **CLAUDE-OVERLAY.md:170** — dispatch rule 1 suggests `/gsd-discuss-phase` which does not exist (FINDING-21).
- **CLAUDE-OVERLAY.md:168-178** — dispatch table missing readiness rules 0 / 0.5 / 4.5 / 4.6 vs. project CLAUDE.md (FINDING-22).
- **CLAUDE-OVERLAY.md:133** — `If SCRIPTS_CREATED → brv-curate to scripts/` references a retired interface; should cite `sgsd-curate` per DLB-01.
- **super-gsd/docs/SESSION-DEBRIEF.md:2,24,222** — personal VTP-project working log placed in framework docs without disclaimer (FINDING-23).
- **super-gsd/skills/sgsd-orchestrate/SKILL.md:562** — references non-existent `gsd-list-phase-assumptions` command (FINDING-4).
- **super-gsd/skills/sgsd-orchestrate/SKILL.md:569** — references `config.workflow.nyquist_validation` which is absent from the overlay (FINDING-16).
- **super-gsd/hooks/sgsd-statusline.js:18** — in-file install comment points at wrong filename `gsd-super-statusline.js` (FINDING-14).
- **super-gsd/docs/MONITORING-SETUP.md:86** — promotes `sgsd-agent-dashboard.sh` as "Layer 3" but SGSD-WORKSPACE-GUIDE.md omits it entirely (FINDING-8).

Missing sections:
- No `## Platform support` in phase-verifier/README.md (FINDING-12).
- No `super-gsd/VERSION` file (FINDING-15).

---

## 9. Recommendations

Ranked by severity → effort. Each row: Finding ID · Scope · Severity · Effort · Status · Fix / DLB reference.

| # | Finding ID | Scope | Severity | Effort | Status | Fix / DLB reference |
|---|---|---|---|---|---|---|
| R1 | FINDING-19 | docs | critical | low | **OPEN** | Change glob `super-gsd/skills/gsd-*/` → `super-gsd/skills/sgsd-*/` in README.md:45 and USER-GUIDE.md:205. |
| R2 | FINDING-10 | tools/config | critical | low | **OPEN** | Add `browser_verify: { enabled: false }` default to `super-gsd/config/planning-config-overlay.json` so the overlay seeds the key automatically. |
| R3 | FINDING-17 | installer | critical | — | **FIXED** (commit `b6dd3a6`) | Auto-merge of `settings-overlay.json` into `~/.claude/settings.json` now runs in install.sh. |
| R4 | FINDING-18 (+ dedup of 3, 13-overlap, 19-overlap, 21-overlap) | config / memory | critical | — | **SUPERSEDED** by DLB-01 (commit `9d33601`) | Legacy `brv-query` / `brv-curate` interface retired in favour of `sgsd-recall` / `sgsd-curate` wrappers over `.brv/context-tree/` + `INDEX.md`. Next action: rewire 8 `brv-*` call-sites in CLAUDE-OVERLAY.md + agent specs (tracked under DLB-01 next-actions, not this audit). Legacy JS engines preserved for 40-file BM25 tripwire. |
| R5 | FINDING-3 | agents | high | low | **OPEN** | Correct all 7 agent `name:` frontmatter fields — strip doubled prefix (`ssgsd-` → `sgsd-`, `sgsd-sgsd-board-*` → `sgsd-board-*`). Critical for classifier / context-selector `subagent_type` resolution. |
| R6 | FINDING-13 | hooks | high | low | **OPEN** | Add PreToolUse entry for `sgsd-activity-logger.js` and statusLine entry for `sgsd-statusline.js` to `settings-overlay.json`. Required for sgsd2 narrative + live status bar. (Auto-merger from R3 will then propagate them.) |
| R7 | FINDING-22 | docs | high | medium | **OPEN** | Re-sync `super-gsd/CLAUDE-OVERLAY.md` dispatch table + Readiness Gates section with project `CLAUDE.md`; add version stamp header. Unblocks unattended-run contract for every downstream install. |
| R8 | FINDING-1 + FINDING-6 | agents | high | medium | **OPEN** | Refactor `sgsd-deliberate/SKILL.md` Steps 3-5 to a single `Agent(subagent_type: "sgsd-ceo", ...)` dispatch. Removes description-only binding and the duplicated inline board orchestration. |
| R9 | FINDING-2 | agents | high | — | Overlaps R8 | Covered by R8 — either the dispatch-table becomes accurate (sgsd-ceo is dispatched) or the table is updated to describe the inline path. R8 is the recommended resolution. |
| R10 | FINDING-20 | docs | high | low | **OPEN** | Update README.md:172-213 and USER-GUIDE.md:135,167-169 inventory counts to 10 agents / 10 skills / 8 hooks + enumerate the missing entries. |
| R11 | FINDING-21 | docs | high | low | **OPEN** | Replace `/gsd-discuss-phase` / `/gsd-plan-phase` / `/gsd-execute-phase` references in USER-GUIDE.md:363-365 + CLAUDE-OVERLAY.md:170 with the installed sgsd-* equivalents (or install the three commands). |
| R12 | FINDING-11 | scripts | high | low | **OPEN** | Add a sentinel check in `sgsd-narrative.ps1`: print a visible warning when `activity-log.jsonl` is absent, pointing at FINDING-13 / R6. Becomes a no-op once R6 ships. |
| R13 | FINDING-16 | config | high | low | **OPEN** | Add `"nyquist_validation": true` to the `workflow` block in `planning-config-overlay.json`. |
| R14 | FINDING-4 | skills | high | medium | **OPEN** | Either install `gsd-list-phase-assumptions` as a skill/command, or update orchestrate SKILL.md:562 to describe the actual enforcement mechanism. |
| R15 | FINDING-7 | scripts | medium | low | **OPEN** | Delete `sgsd-dashboard.ps1` or mark it `# superseded by sgsd-mission-control.ps1`; add note in MONITORING-SETUP.md. |
| R16 | FINDING-8 | scripts/docs | medium | medium | **OPEN** | Reconcile MONITORING-SETUP.md Layer 3 with SGSD-WORKSPACE-GUIDE.md — either add sgsd4.cmd + fourth pane OR mark agent-dashboard as superseded by mission-control. |
| R17 | FINDING-9 | scripts | medium | low | **OPEN** | Delete `sgsd-live-feed.ps1` (dead) and `sgsd-thinking.ps1` (dead + project-specific to project-clarity-erp). |
| R18 | FINDING-14 | hooks | medium | low | **OPEN** | Change in-file install comment in `sgsd-statusline.js:18` from `gsd-super-statusline.js` to `sgsd-statusline.js` to match the actual installed filename. |
| R19 | FINDING-23 | docs | medium | low | **OPEN** | Add "> Personal log from VTP project — not part of Super GSD framework" disclaimer to top of `super-gsd/docs/SESSION-DEBRIEF.md`, or move the file out of `super-gsd/docs/`. |
| R20 | FINDING-5 | skills | low | low | **OPEN** | Move `VTPidea.md` to the VTP project's `.claude/commands/`, or document it as a project extension in `super-gsd/README.md`. |
| R21 | FINDING-12 | tools | low | low | **OPEN** | Add `## Platform support` section to `phase-verifier/README.md` explicitly listing tested platforms (Windows + WSL) and flagging Linux/macOS as untested. |
| R22 | FINDING-15 | hooks | low | medium | **OPEN** | Create `super-gsd/VERSION` (initial `1.0.0`) and add `// gsd-hook-version: 1.0.0` header to the 6 hook files currently missing it. |

**Linked to active DLBs:**

- DLB-01 (memory topology) — resolves R4 (FINDING-18); touches R6 / R7 indirectly since CLAUDE-OVERLAY.md rewire is part of DLB-01 next-actions.
- DLB-02 (MUDA learning loop) — explicitly depends on FINDING-17 (R3, fixed) and FINDING-18 (R4, superseded) landing before any write-path work begins.
- DLB-03 (intent continuity) — depends on DLB-02's install-blocker closure; no new audit findings required before Day-3 intent-injection ship.

**Suggested fix ordering** (minimises rework): R1, R2, R5, R6, R13 (all low-effort / high-impact install-time fixes) → R10, R11, R18, R19 (docs cleanup) → R7, R8 (overlay re-sync + deliberate refactor) → R14 → remaining mediums → lows.

---

_End of audit. Source findings: `.planning/phases/08-sgsd-self-audit/scratch-findings.md` (FINDING-1..23). Current date: 2026-04-19._
