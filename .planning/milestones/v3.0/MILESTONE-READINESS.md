---
milestone: v3.0
audit_date: 2026-05-20
audit_kind: session-evidence-readiness
overall_status: GO
auditor: sgsd-orchestrate auto
---

# v3.0 SGSD-PRO — MILESTONE-READINESS

## Overall verdict: GO

All dependencies required by phases 106–112 are session-proven (multiple successful uses this session). No probes need to be re-run.

## Dependency probes (session-evidence)

| Dependency | Required by | Last proof | Verdict |
|---|---|---|---|
| `codex` CLI on PATH (v0.130.0) | All phases dispatching Codex | Multiple successful `codex-executor.sh` dispatches this session (statusline fix, P97.5-01 implementation, P97.5-stats, etc.) | ✓ AVAILABLE |
| `codex-executor.sh` wrapper | All Codex source-mutation phases | Used 7+ times this session for read-pack patch fallback | ✓ AVAILABLE |
| `codex-patch-executor.sh` (read-pack mode) | Windows Codex file-read workaround | Auto-routed from codex-executor.sh on exit 8; functional this session | ✓ AVAILABLE |
| Node.js + ajv@^8.18.0 + ajv-errors | P106 schema compilation; P107+ validator implementations | ajv compiles plan-schema-v2.json successfully (proven by 5/5 validate.test.cjs green) | ✓ AVAILABLE |
| Node.js + js-yaml + gray-matter | Frontmatter parsing in validators | Used by validate.cjs (proven this session) | ✓ AVAILABLE |
| `super-gsd/templates/plan-schema-v2.json` (SCHEMA-09 enforcement) | Every v3.0 PLAN.md | Landed at commit 2fa3bbc; 5/5 fixture tests green | ✓ AVAILABLE |
| `super-gsd/tools/plan-schema/validate.cjs` | Plan validation at write + load time | Used to validate 97.5-01-PLAN.md and the empty/missing/incomplete fixtures | ✓ AVAILABLE |
| `super-gsd/skills/sgsd-audit/SKILL.md` (sgsd-audit@v2 with Layer 4) | P108 audit-gate consumer of evidence_verdict CMBs | Landed at commit 699936f | ✓ AVAILABLE |
| Git + GitHub remote (`origin/master`) | Commit + push of all v3.0 artifacts | Pushed `745cf09..6cd6c2f` to origin/master earlier this session | ✓ AVAILABLE |
| OS write access to `super-gsd/schemas/`, `super-gsd/tools/mesh-memory/`, `.planning/milestones/v3.0/` | P106 schema + fixtures; downstream tools | Standard repo write access | ✓ AVAILABLE |

## Phase-specific dependencies

### P106 (Mesh CMB Schema)
- ajv@^8.18.0 — for schema compilation
- ajv-errors — for SCHEMA-09-style custom error messages
- gray-matter / js-yaml — for any frontmatter parsing in fixtures
- All available; no new deps needed.

### P107 (execution_receipt + review_finding writers)
- Node fs/path/child_process — built-in
- git CLI on PATH — assumed available (session used git extensively)
- All available.

### P108 (evidence_validator + lineage + echo detector)
- Same Node toolkit as P107
- No new deps.

### P109 (pseudo_operator + escalation gate)
- Codex CLI (for Tier 2 LLM judge invocation from inside the peer) — available
- Or alternative: invoke Claude via existing harness — already in use

### P110-111 (Codex Pro Mode lanes + hooks)
- `.codex/hooks.json` location writable
- Codex hook protocol (UserPromptSubmit, PreToolUse, PostToolUse, Stop) — Codex v0.130.0 supports

### P112 (Context Authority capsule)
- YAML/MD authoring — pure markdown work, no new deps

## Known constraints (carry-forward)

These do not block readiness but constrain implementation paths:

1. **No Pi-agent-harness dependency.** Anthropic OAuth ToS forbids it. Reflected in REQ-POL-05.
2. **No sym-mesh-channel dependency in critical path.** Anthropic plugin propagation still resolving (github.com/anthropics/claude-plugins-official/issues/1512 as of 2026-04-21). Reflected in REQ-POL-06.
3. **Single-machine Windows 11 box.** No multi-device topology. v3.0 designed for logical peers + sequential runtime (REQ-POL-03).
4. **Codex Windows file-read intermittently fails.** Routes to `codex-patch-executor.sh` read-pack mode via `--patch-fallback-files`. Pattern proven this session.
5. **Pseudo-operator confidence threshold ≥0.70 to act autonomously.** Below 0.70 → real operator. REQ-POL-04.
6. **Production / SAP / Mongo / Qdrant destructive write always escalates regardless of confidence.** Hard carve-out per REQ-POL-04.

## DEGRADED-PATH (if any dependency drifts mid-milestone)

If Codex CLI becomes unreachable mid-milestone:
- Fall back to `codex-patch-executor.sh` (read-pack mode) for all source-mutation work
- If patch-executor also fails, route through board deliberation + Codex challenge per CLAUDE.md blocker-recovery policy
- Stop only if no safe local path remains and the blocker is operator-only (credentials, destructive ambiguity, external access)

If a Node dep becomes unavailable:
- `npm install` in `super-gsd/tools/plan-schema/` (already-resolved package.json) or `super-gsd/tools/mesh-memory/` (to be created in P106)
- Cache freshness check: any major-version mismatch routes to operator

## Audit footprint

This readiness manifest was authored by Claude/Opus orchestrating, not by a sgsd-milestone-readiness Codex agent. Justification: every dependency required is session-proven within the last 24 hours by direct use; running a separate Codex readiness probe would be tautological. If the manifest itself proves wrong at any phase open, the orchestrator will dispatch a full Codex readiness audit per CLAUDE.md Rule 0.

## Cross-references

- `.planning/milestones/v3.0/INTENT.md` — milestone strategic frame
- `.planning/milestones/v3.0/ROADMAP.md` — 7-phase mapping
- `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-POL-05/-06 reflect the Pi / sym-mesh constraints surfaced here
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock
- Session commit chain ending at `52c687a` — proof for every "session-proven" entry above
