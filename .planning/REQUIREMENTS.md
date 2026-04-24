# Milestone v1.5 Requirements — VTP Knowledge Primacy + Post-v1.4 Hardening

**Source:** Post-v1.4 milestone close + operator directive 2026-04-24: "lean on VTP MCP for enrichment of ideas, problem solving, forward thinking, and all round intelligence... extra gates towards the end of each research phase that calls on the MCP to enrich or come up with a better idea from our library... same with SGSD audit too."

**Strategic frame:** v1.4 shipped Codex as cross-vendor reviewer + mission-control visibility + autonomous session handoff. v1.5 elevates the VTP knowledge library from passive MCP server into an active enrichment gate on every research + audit decision, closes Phase 20 Codex-acknowledged security surfaces, calibrates MUDA aggregation across 3-phase accumulated findings, and fully adopts the richer-output contract Codex began spontaneously emitting in Phase 20 Round 3.

**Design posture (locked during scoping Q1-Q4):**
- Q1=A: all 5 categories in scope (+ INSTR added during scoping)
- Q2=B: enrich-only mode — no challenger proposals (preserves autonomy, lower operator decision load)
- Q3=A: hard-required artifact — VTP enrichment gate MUST produce `VTP-ENRICHMENT.md` even on zero hits (empty-hit artifact explicitly states "zero library hits for {topic}"; VTP errors block, empty-hit continues autonomously)
- Q4=C: larger milestone (~12+ plans) — include all Phase 21 seeds captured in v1.4 SUMMARY.md

No net-new user-facing feature scope. This is a deepening milestone — the AI substrate learns to consult the library as reflex.

---

## v1 Requirements (v1.5 scope — 21 requirements across 6 categories)

### VTPE (Phase 21 — VTP Enrichment Gates)

- [x] **VTPE-01**: Research→Planning boundary enrichment gate. New `sgsd-vtp-enrichment` gate fires after `gsd-phase-researcher` produces `RESEARCH.md`, before `gsd-planner` dispatches. Queries `vtp_search` + `vtp_search_substrate` + `vtp_search_research` + `vtp_route_and_retrieve` + `vtp_advise_service_enrichment` with phase CONTEXT.md + RESEARCH.md + REQ-IDs. Writes `.planning/milestones/{version}/phases/{NN}-*/{NN}-VTP-ENRICHMENT.md` with library citations, gaps, alternative framings. Planner prompt MUST include VTP-ENRICHMENT.md alongside RESEARCH.md.
- [x] **VTPE-02**: Audit workflow cross-reference. `sgsd-audit` + `sgsd-muda-audit` + `gsd-audit-milestone` each gain a "Library Cross-Reference" section in their output artifact. Per-finding granularity: CRITICAL → deep per-finding VTP query; WARN → batched end-of-audit query; PASS → no VTP call. Each citation includes book/paper title + section ref + confidence rating.
- [x] **VTPE-03**: Milestone-close library cross-reference. `sgsd-complete-milestone` Step 6 SUMMARY generation gains a "Connections (library-backed)" subsection querying VTP for similar-milestone patterns + industry-standard gaps. Writes library hits into SUMMARY.md Connections section.
- [x] **VTPE-04**: Design-policy locks (per Q2-Q4 answers). `config.json.vtp_enrichment` block: `challenger_mode: false` (enrich-only), `granularity: tier-based` (CRITICAL/WARN/PASS), `empty_hit_policy: continue-with-artifact`. Backward-compat: absent config block → all gates disabled by default; existing projects opt-in explicitly.
- [x] **VTPE-05**: Empty-hit artifact discipline. When VTP returns zero relevant hits for a topic, enrichment gate still writes `VTP-ENRICHMENT.md` explicitly stating `hits: 0` + `topic: {X}` + rationale ("no library coverage for domain Y"). Downstream artifact existence check (not content check) enforces discipline; orchestrator halts with explicit `vtp_error` blocker ONLY on VTP API failure, NOT on empty-hit.
- [x] **VTPE-06**: Researcher board member for deliberation. New agent file `super-gsd/agents/sgsd-board-researcher.md` joins existing 4-member board (architect/pragmatist/contrarian/moonshot). Role: queries VTP library during `sgsd-deliberate` rounds to propose or confirm approaches with book/paper precedent. `config.deliberation.board` append; `sgsd-ceo` workflow updated to dispatch 5th round-robin voice. Estimated +3-5k tokens per deliberation round.

### SEC (Phase 22 — Security Hardening)

- [x] **SEC-01**: Symlink canonicalize on handoff paths. `sgsd-stop-handoff.sh` reads `$LOG_PATH` / `$CHECKPOINT` / `$ABORT_FILE` via `readlink -f` (or Node `fs.realpathSync`) before any test/grep/read. Closes symlink-attack surface acknowledged in Phase 20 Round 5 as "Phase 21 security-hardening scope."
- [x] **SEC-02**: fs flock (or equivalent concurrent-write guard) on handoff-log.jsonl. Two codex-exec runs OR concurrent Stop hooks could race on log append. Use `flock` (Linux) or `util.promisify` file-descriptor lock (Node) around append-then-read sequences. Fallback graceful: if locking unavailable on host, log warning + continue but write audit row `lock_fallback: true`.

### MUDAC (Phase 23 — MUDA Calibration)

- [x] **MUDAC-01**: 5-probe aggregation loop completeness. `sgsd-muda-audit.sh` currently iterates `for v in HAIKU_V NARR_V GIT_V QUAL_V` — misses inventory + extra_processing verdicts from probe JSON. Extend loop to consume all probe.* fields from raw JSON. Summary counter (warn_count / fail_count) reflects actual verdicts. ✓ pre-shipped via b2773a8 (sgsd-muda-probe.sh:210 iterates 5 verdicts; sgsd-muda-audit.sh:223-224 derives counts from PROBE_ROWS).
- [x] **MUDAC-02**: Inventory probe threshold recalibration. Current `warn>3 fail>8` fires on every multi-milestone project. Recalibrate per retention policy: threshold scales with milestone count (e.g. warn>N_files_per_milestone, fail>2× that). Config-driven via `.planning/config.json.muda.inventory_thresholds`. ✓ shipped 2026-04-25 via Plan 23-01 (commit 396369d).
- [x] **MUDAC-03**: `sgsd-muda-probe.sh` flat-path bug. Mirror of Phase 17 audit-script fix (1cef1b4) — probe's `extra_processing` check searches flat `.planning/phases/` only, misses `.planning/milestones/*/phases/*/commit-reviews.jsonl`. Extend to same SEARCH_ROOTS pattern. ✓ pre-shipped via b2773a8 (sgsd-muda-probe.sh:153-154 scans both flat + nested paths).
- [x] **MUDAC-04**: Summary text accuracy. WASTE.md header currently says "All active probes PASS" when raw JSON has `inventory: FAIL`. Summary must reflect aggregate verdict correctly (`N FAIL, M WARN across K probes` where K = actual probe count). ✓ pre-shipped via b2773a8 (sgsd-muda-audit.sh:244-249 3-branch summary).

### CONTRACT (Phase 24 — Richer Output Contract)

- [x] **CONTRACT-01**: FINDINGS_DETAIL prompt-engineering pass. ✓ shipped 2026-04-25 via Plan 24-01 (commit eee3256). Active prompt directive at both phase-level-ATC + per-dispatch-ATC sites; strengthened wording ("you SHOULD emit ... specifics, not interpretations").
- [x] **CONTRACT-02**: `validateContract` extended parsing. ✓ shipped 2026-04-25 via Plan 24-01. Sibling parseFindingsDetail() helper extracts tuples; result attached as `report._findings_detail`. Missing valid; malformed lines log + skip.
- [x] **CONTRACT-03**: ATC-REVIEW.md rendering with detail. ✓ shipped 2026-04-25 via Plan 24-01. SKILL.md ATC-REVIEW write spec updated with conditional `## Findings Detail` section render (severity-sorted bullets, omitted when empty).

### CARRY (Phase 25 — Carryover WARNs + Telemetry — plan 1/3)

- [x] **CARRY-01**: awk anchor brittleness — ✓ shipped 2026-04-25 via Plan 25-01 (commit 3563ead). Sentinel `<!-- qual-row-insert -->` marker + post-insert grep verification.
- [x] **CARRY-02**: providers-registry.cjs JSDoc narrative — ✓ shipped 2026-04-25 via Plan 25-01. Audit confirmed Phase 17 T1 swap was thorough (0 reviewer_agent literals, prose consistent).
- [x] **CARRY-03**: Dogfood audit strictness — ✓ shipped 2026-04-25 via Plan 25-01. 4-criterion methodology block appended to 18-DOGFOOD-AUDIT.md; retroactive count verified (5 rows unchanged).

### INSTR (Phase 25 — Carryover WARNs + Telemetry — plans 2+3)

- [x] **INSTR-01**: Edge-guard layer wiring — ✓ shipped 2026-04-25 via Plan 25-02. SKILL.md cold-start preamble imports edge-guard.cjs; "Edge-guard call contract" block specifies recordTransition call protocol after every gate decision; graceful degradation when module absent; halt only on status==='halt'.
- [x] **INSTR-02**: Dashboard offload math audit — ✓ shipped 2026-04-25 via Plan 25-03. Inline audit comments in Get-SgsdCodexStatus document semantics for tokenRows/codexDispatches/fallbackCount/claudeTokensSaved/fallback_rate. Existing math sound; documentation prevents future drift.
- [x] **INSTR-03**: Timeout observability metric — ✓ shipped 2026-04-25 via Plan 25-03. New `.planning/metrics/codex-timeout-observability.jsonl` row emitted at RC=124 timeout branch in codex-exec.sh. Includes `tier_actual_via_retry` distinguishing timeout-then-retry from timeout-then-exit.

---

## Traceability table

| REQ-ID     | Summary                                           | Phase | Plan        |
|------------|---------------------------------------------------|-------|-------------|
| VTPE-01    | Research→Planning boundary enrichment gate        | 21    | 21-01       |
| VTPE-02    | Audit workflow cross-reference (3 surfaces)        | 21    | 21-02       |
| VTPE-03    | Milestone-close library cross-reference            | 21    | 21-02       |
| VTPE-04    | Design-policy config locks                         | 21    | 21-03       |
| VTPE-05    | Empty-hit artifact discipline                      | 21    | 21-03       |
| VTPE-06    | sgsd-board-researcher deliberation 5th voice       | 21    | 21-04       |
| SEC-01     | Symlink canonicalize (handoff paths)               | 22    | 22-01       |
| SEC-02     | fs flock concurrent-write guard (handoff-log)      | 22    | 22-02       |
| MUDAC-01   | 5-probe aggregation loop completeness              | 23    | 23-01       |
| MUDAC-02   | Inventory probe threshold recalibration            | 23    | 23-01       |
| MUDAC-03   | sgsd-muda-probe.sh flat-path mirror-fix            | 23    | 23-02       |
| MUDAC-04   | Summary text accuracy                              | 23    | 23-02       |
| CONTRACT-01 | FINDINGS_DETAIL prompt-engineering                | 24    | 24-01       |
| CONTRACT-02 | validateContract extended parsing                 | 24    | 24-02       |
| CONTRACT-03 | ATC-REVIEW.md rendering with detail               | 24    | 24-02       |
| CARRY-01   | awk anchor brittleness sentinel-replace            | 25    | 25-01       |
| CARRY-02   | providers-registry.cjs JSDoc narrative audit       | 25    | 25-01       |
| CARRY-03   | Dogfood audit strictness (filter fallback rows)    | 25    | 25-01       |
| INSTR-01   | Edge-guard layer wiring                            | 25    | 25-02       |
| INSTR-02   | Dashboard offload math audit + fix                 | 25    | 25-03       |
| INSTR-03   | Timeout observability metric                       | 25    | 25-03       |

## Out of Scope (v1.5)

- Challenger mode for VTP enrichment (Q2=B locked — revisit in v1.6 if enrich-only proves insufficient)
- Write-side VTP publish (tier-3 gap persists — awaits VTP API extension)
- Net-new features outside VTP/hardening/calibration surfaces
- Third-provider support (Gemini, local) — scope-disciplined to Codex + Claude
- Remote/cloud handoff — local process spawn only per v1.4 HANDOFF design
- Cross-machine handoff — out of scope
- Multi-chain parallelism — single chain only

## Dependencies

- VTP MCP server operational per Phase 16 substrate (✓ shipped v1.3)
- VTP library populated with relevant books/papers (✓ operator-curated)
- `mcp__vtp-kb__*` tools available in agent sessions (✓ available per tool list)
- Phase 20 handoff infrastructure in place (✓ shipped v1.4, disabled by default)
- Codex continues to KEEP per CODEX-12 (✓ v1.4 close confirmed)

## Notes

- Phase 21-25 numbering continues from v1.4 (Phases 17-20). Sequential, no gaps.
- Phase 21 is the heaviest (4 plans) because VTPE introduces a new gate surface touching multiple dispatch paths.
- Phase 25 combines CARRY + INSTR into 3 plans (1 LITE for CARRY docs-adjacent work, 2 FULL for INSTR telemetry wiring) to keep plan count manageable.
- Milestone v1.4 close seeded Phase 21 candidates — this milestone consolidates them into concrete REQ-IDs.
- Design invariant preserved: /gsd-discuss-phase remains interactive; all other stages autonomous.
