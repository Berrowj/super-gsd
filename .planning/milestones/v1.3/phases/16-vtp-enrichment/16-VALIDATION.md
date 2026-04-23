---
phase: 16
slug: vtp-enrichment
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-23
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `16-RESEARCH.md` §Validation Architecture (lines 355-408) and §8 Nyquist dimensions.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Built-in `--self-test` CLI per CJS module (SGSD house discipline — no formal runner). Pattern from `edge-guard.cjs:128-265`, `gates-registry.cjs`, `classifier-cache.cjs`. |
| **Config file** | None — each module's `--self-test` is self-contained. |
| **Quick run command** | `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` |
| **Full suite command** | `for f in super-gsd/scripts/lib/*.cjs; do node "$f" --self-test 2>/dev/null \|\| true; done; bash super-gsd/scripts/sgsd-sepl-propose.test.sh` |
| **Estimated runtime** | ~5 seconds (unit + bash test); +~30 seconds for manual smoke runbook |

---

## Sampling Rate

- **After every task commit:** Run quick command for the touched module (e.g., composer task → `node vtp-context-composer.cjs --self-test`)
- **After every plan wave:** Run full suite + grep-lint over `custom-gsd-extract/claude-agents/`
- **Before `/gsd-verify-work`:** Full suite green + all 8 Nyquist dimensions covered (automated + manual)
- **Max feedback latency:** 5 seconds for automated tests; manual smoke runbook is out-of-band

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-T1 | 01 | A | VTP-04, VTP-05, VTP-07 (fast-path), VTP-09, VTP-10 | T-16-02, T-16-03 | Composer sanitizes env-vars before include; no direct MCP calls elsewhere | unit (self-test) | `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` | ❌ W0 | ⬜ pending |
| 16-01-T2 | 01 | A | VTP-01 | T-16-01 | Step 0 graceful-fail on VTP failure; never blocks Step 1 | smoke (manual) | `super-gsd/docs/vtp-enrichment-smoke.md` Dim 2/3/5/6 | ❌ W0 | ⬜ pending |
| 16-01-T3 | 01 | A | VTP-09 (template) | — | VTP-EVIDENCE.md template is framing-only per D-04 | lint (grep) | `grep -q "selected_query\|retrieval_mode\|reflection_verdict" super-gsd/templates/VTP-EVIDENCE.template.md` | ❌ W0 | ⬜ pending |
| 16-02-T1 | 02 | B | VTP-02, VTP-03 | T-16-09, T-16-10, T-16-12 | `vtp_research_gate` gated behind keyword+verdict precondition; agents invoke via composer never direct MCP | lint (grep) | `grep -q "mcp__vtp-kb__vtp_research_gate" custom-gsd-extract/claude-agents/gsd-phase-researcher.md && grep -q "vtp-context-composer" custom-gsd-extract/claude-agents/gsd-planner.md` | ❌ W0 | ⬜ pending |
| 16-02-T2 | 02 | B | VTP-06 (per E-01), VTP-07 | T-16-11, T-16-13 | Wiki-contradiction advisory only; operator-reviewed | lint (grep) | `grep -q "mcp__vtp-kb__vtp_search_substrate" custom-gsd-extract/claude-agents/gsd-codebase-mapper.md && grep -q "mcp__vtp-kb__wiki_find_contradictions" custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md` | ❌ W0 | ⬜ pending |
| 16-03-T1 | 03 | C | VTP-08a | T-16-14, T-16-18 | `candidate_areas` validated client-side before MCP call; 5s advise timeout | smoke (manual) | invoke `/sgsd-vtp-advise sgsd-triage` → verify `.planning/advise/{today}-sgsd-triage.md` written | ❌ W0 | ⬜ pending |
| 16-03-T2 | 03 | C | VTP-08b | T-16-15 | HEREDOC-safe body capture via temp-file writer (not bash interpolation) | unit (bash test) | `bash super-gsd/scripts/sgsd-sepl-propose.test.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## 8 Nyquist Validation Dimensions (from RESEARCH.md §Validation Architecture)

| # | Dimension | Approach | Coverage Task | Automated? |
|---|-----------|----------|---------------|------------|
| 1 | Composer unit-test vectors | `--self-test` asserts `compose({milestone:'v1.3',phase:16,...})` returns fixed-shape object with all TIERS keys projectable. | 16-01-T1 | ✅ unit |
| 2 | Triage Step 0 happy path | Smoke: VTP live + known-fixture query; assert VTP-EVIDENCE.md written + routing-log row appended. | 16-01-T2 | ⚠️ manual smoke |
| 3 | Triage Step 0 VTP-failure path | Point composer at broken MCP OR set 1ms timeout; assert Step 1 proceeds AND log captures `elapsed_ms = budget-exceeded` marker. | 16-01-T2 | ⚠️ manual smoke |
| 4 | Agent-tier VTP-call instrumentation | Dispatch `gsd-phase-researcher` with VTP-EVIDENCE.md present; assert agent output cites ≥1 VTP doc-ID AND a new routing-log row with `tier:"research"` appears. | 16-02 must_haves (added post-checker-review) + extended smoke runbook Dim 4 section | ⚠️ manual smoke |
| 5 | Fast-path short-circuit | Unit test: given SGSD state with `active_phase=16, explicit_constraints=[...non-empty...]`, `isFastPathEligible(ctx) === true` AND composer dispatches to `vtp_search_substrate` not `vtp_route_and_retrieve`. | 16-01-T1 | ✅ unit |
| 6 | Config toggle disables Step 0 | Set `workflow.triage_vtp_enrichment: false` in test fixture; assert composer no-ops (no MCP call, no log row, no VTP-EVIDENCE.md write). | 16-01-T1 (config-fixture branch) + 16-01-T2 (end-to-end smoke) | ✅ unit + ⚠️ manual smoke |
| 7 | `/sgsd-vtp-advise` smoke | Invoke on `SGSD-triage` (VTP's own test payload); assert report file exists at `.planning/advise/{today}-sgsd-triage.md` with `recommendations` and `skipped_opportunities` sections. | 16-03-T1 | ⚠️ manual smoke |
| 8 | sepl major detection coverage | Bash test: 7 fixture proposals (one per D-09 criterion); each detected as "major"; 1 control proposal (minor script tweak) NOT detected. | 16-03-T2 | ✅ bash unit |

**Automated coverage: 5/8** (Dims 1, 5, 6 via `--self-test`; Dim 8 via bash test; partial Dim 6 via fixture branch).
**Manual-smoke coverage: 3/8** (Dims 2, 3, 4, 7 — each documented in `super-gsd/docs/vtp-enrichment-smoke.md`).

---

## Wave 0 Requirements

- [ ] `super-gsd/scripts/lib/vtp-context-composer.cjs` — created in 16-01-T1 with embedded `--self-test` (covers VTP-04, VTP-07 fast-path, VTP-10 config toggle, Dim 1, Dim 5, Dim 6 fixture branch).
- [ ] `super-gsd/scripts/sgsd-sepl-propose.test.sh` — bash unit test with 8 fixture proposals (covers VTP-08b, Dim 8).
- [ ] `super-gsd/docs/vtp-enrichment-smoke.md` — manual smoke runbook (covers VTP-01, VTP-08a, Dims 2, 3, 4, 7).
- [ ] `super-gsd/templates/VTP-EVIDENCE.template.md` — framing-only artifact template per D-04 (covers VTP-09 template).
- [ ] Grep-lint step in wave-merge gate checking `custom-gsd-extract/claude-agents/*.md` for VTP frontmatter tokens (covers VTP-02/03/06/07 coverage).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Triage Step 0 actually writes VTP-EVIDENCE.md in a real triage invocation | VTP-01, Dim 2 | Requires live MCP + real-world operator query — not automatable without fixturing the entire triage brainstorm chain | Smoke runbook Dimension 2: invoke `/sgsd-triage "How should we evolve SGSD's observability?"`; verify `.planning/phases/16-vtp-enrichment/VTP-EVIDENCE.md` exists and has `selected_query` populated. |
| Triage Step 0 falls through when VTP unavailable | VTP-01, Dim 3 | Requires intentionally breaking MCP — too destructive for CI | Smoke runbook Dimension 3: point `.mcp.json` at a nonexistent binary path; invoke `/sgsd-triage`; verify Step 1 (brainstorm) proceeds AND routing-log captures `elapsed_ms = budget-exceeded` marker. |
| Agent-tier VTP calls appear in routing-log (Dim 4) | Dim 4 | Requires live subagent dispatch + real VTP responses | Smoke runbook Dimension 4: after 16-01 + 16-02 execute, dispatch `gsd-phase-researcher` on a stub phase with pre-populated VTP-EVIDENCE.md; `tail -1 .planning/metrics/vtp-routing-log.jsonl` shows row with `tier:"research"`; agent's RESEARCH.md output cites ≥1 VTP doc-ID. |
| `/sgsd-vtp-advise` end-to-end smoke | VTP-08a, Dim 7 | Requires live `vtp_advise_service_enrichment` tool + operator-reviewable output | Smoke runbook Dimension 7: invoke `/sgsd-vtp-advise sgsd-triage`; verify `.planning/advise/{today}-sgsd-triage.md` written with `recommendations` + `skipped_opportunities` sections; operator reviews content. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies identified
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (all plans have unit or grep-lint tests)
- [ ] Wave 0 covers all MISSING references (composer, bash test, smoke runbook doc, template)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s for automated tests
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] All 8 Nyquist dimensions mapped to at least one task OR smoke-runbook section
- [ ] Research errata E-01/E-02/E-03 reflected in test expectations

**Approval:** pending execution; re-visit at `/gsd-verify-work 16`.

---

## Post-Execution Checklist

After Waves A/B/C all commit:
- [ ] `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` → exit 0
- [ ] `bash super-gsd/scripts/sgsd-sepl-propose.test.sh` → exit 0
- [ ] Grep-lint passes: every agent in Wave B has `mcp__vtp-kb__` in `tools:` + `vtp-context-composer` in body
- [ ] Manual smoke runbook executed end-to-end at least once; results committed to `16-SUMMARY.md`
- [ ] Update `nyquist_compliant: true` → sign off → phase ready for `/gsd-verify-work`

---

*Derivation source: `16-RESEARCH.md` §Validation Architecture (lines 355-408) and §Nyquist Dimensions table.*
*Generated post-planner via editorial pass (checker-flagged BLOCKER #1 resolution).*
