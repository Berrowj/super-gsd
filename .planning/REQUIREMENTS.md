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

- [ ] **VTPE-01**: Research→Planning boundary enrichment gate. New `sgsd-vtp-enrichment` gate fires after `gsd-phase-researcher` produces `RESEARCH.md`, before `gsd-planner` dispatches. Queries `vtp_search` + `vtp_search_substrate` + `vtp_search_research` + `vtp_route_and_retrieve` + `vtp_advise_service_enrichment` with phase CONTEXT.md + RESEARCH.md + REQ-IDs. Writes `.planning/milestones/{version}/phases/{NN}-*/{NN}-VTP-ENRICHMENT.md` with library citations, gaps, alternative framings. Planner prompt MUST include VTP-ENRICHMENT.md alongside RESEARCH.md.
- [ ] **VTPE-02**: Audit workflow cross-reference. `sgsd-audit` + `sgsd-muda-audit` + `gsd-audit-milestone` each gain a "Library Cross-Reference" section in their output artifact. Per-finding granularity: CRITICAL → deep per-finding VTP query; WARN → batched end-of-audit query; PASS → no VTP call. Each citation includes book/paper title + section ref + confidence rating.
- [ ] **VTPE-03**: Milestone-close library cross-reference. `sgsd-complete-milestone` Step 6 SUMMARY generation gains a "Connections (library-backed)" subsection querying VTP for similar-milestone patterns + industry-standard gaps. Writes library hits into SUMMARY.md Connections section.
- [ ] **VTPE-04**: Design-policy locks (per Q2-Q4 answers). `config.json.vtp_enrichment` block: `challenger_mode: false` (enrich-only), `granularity: tier-based` (CRITICAL/WARN/PASS), `empty_hit_policy: continue-with-artifact`. Backward-compat: absent config block → all gates disabled by default; existing projects opt-in explicitly.
- [ ] **VTPE-05**: Empty-hit artifact discipline. When VTP returns zero relevant hits for a topic, enrichment gate still writes `VTP-ENRICHMENT.md` explicitly stating `hits: 0` + `topic: {X}` + rationale ("no library coverage for domain Y"). Downstream artifact existence check (not content check) enforces discipline; orchestrator halts with explicit `vtp_error` blocker ONLY on VTP API failure, NOT on empty-hit.
- [ ] **VTPE-06**: Researcher board member for deliberation. New agent file `super-gsd/agents/sgsd-board-researcher.md` joins existing 4-member board (architect/pragmatist/contrarian/moonshot). Role: queries VTP library during `sgsd-deliberate` rounds to propose or confirm approaches with book/paper precedent. `config.deliberation.board` append; `sgsd-ceo` workflow updated to dispatch 5th round-robin voice. Estimated +3-5k tokens per deliberation round.

### SEC (Phase 22 — Security Hardening)

- [ ] **SEC-01**: Symlink canonicalize on handoff paths. `sgsd-stop-handoff.sh` reads `$LOG_PATH` / `$CHECKPOINT` / `$ABORT_FILE` via `readlink -f` (or Node `fs.realpathSync`) before any test/grep/read. Closes symlink-attack surface acknowledged in Phase 20 Round 5 as "Phase 21 security-hardening scope."
- [ ] **SEC-02**: fs flock (or equivalent concurrent-write guard) on handoff-log.jsonl. Two codex-exec runs OR concurrent Stop hooks could race on log append. Use `flock` (Linux) or `util.promisify` file-descriptor lock (Node) around append-then-read sequences. Fallback graceful: if locking unavailable on host, log warning + continue but write audit row `lock_fallback: true`.

### MUDAC (Phase 23 — MUDA Calibration)

- [ ] **MUDAC-01**: 5-probe aggregation loop completeness. `sgsd-muda-audit.sh` currently iterates `for v in HAIKU_V NARR_V GIT_V QUAL_V` — misses inventory + extra_processing verdicts from probe JSON. Extend loop to consume all probe.* fields from raw JSON. Summary counter (warn_count / fail_count) reflects actual verdicts.
- [ ] **MUDAC-02**: Inventory probe threshold recalibration. Current `warn>3 fail>8` fires on every multi-milestone project. Recalibrate per retention policy: threshold scales with milestone count (e.g. warn>N_files_per_milestone, fail>2× that). Config-driven via `.planning/config.json.muda.inventory_thresholds`.
- [ ] **MUDAC-03**: `sgsd-muda-probe.sh` flat-path bug. Mirror of Phase 17 audit-script fix (1cef1b4) — probe's `extra_processing` check searches flat `.planning/phases/` only, misses `.planning/milestones/*/phases/*/commit-reviews.jsonl`. Extend to same SEARCH_ROOTS pattern.
- [ ] **MUDAC-04**: Summary text accuracy. WASTE.md header currently says "All active probes PASS" when raw JSON has `inventory: FAIL`. Summary must reflect aggregate verdict correctly (`N FAIL, M WARN across K probes` where K = actual probe count).

### CONTRACT (Phase 24 — Richer Output Contract)

- [ ] **CONTRACT-01**: FINDINGS_DETAIL prompt-engineering pass. Codex emitted file:line detail spontaneously in Phase 20 Round 3 but did not fully adopt the scaffolded optional footer. Iterate prompt instructions: stronger directive ("after the 5 required lines, you SHOULD emit FINDINGS_DETAIL lines... operator needs specifics, not interpretations"), example-driven format, maybe a short in-prompt demonstration.
- [ ] **CONTRACT-02**: `validateContract` extended parsing. When FINDINGS_DETAIL lines present, parse each `[severity] [dimension] <description>` tuple into structured array. Append to `report._findings_detail` field for downstream consumers. Missing FINDINGS_DETAIL still valid (optional); malformed detail line → log warning, treat as missing.
- [ ] **CONTRACT-03**: ATC-REVIEW.md rendering with detail. When per-dispatch or phase-level ATC review artifact is written, if `findings_detail` array non-empty, render as dedicated "Findings Detail" section with per-tuple bullets. Operator reading the artifact sees specifics directly, no more interpretation guesswork.

### CARRY (Phase 25 — Carryover WARNs + Telemetry — plan 1/3)

- [ ] **CARRY-01**: awk anchor brittleness in sgsd-muda-audit.sh qualitative row insert. Current `/^\| git_spawn_pct/` anchor silently drops the row if probe list changes. Replace with sentinel marker (e.g. `<!-- qual-row-insert -->`) in compose_waste_md body + sed/awk against sentinel. Post-insert grep verifies row landed.
- [ ] **CARRY-02**: `super-gsd/scripts/lib/providers-registry.cjs` JSDoc narrative drift. Phase 17 T1 swapped literal `reviewer_agent → reviewer_provider` in 2 docblocks; prose around `reviewer-shaped` semantics elsewhere in file may still describe pre-fix behavior. Full file audit + consistency pass.
- [ ] **CARRY-03**: Dogfood audit strictness (Phase 18 phase-level WARN). `18-DOGFOOD-AUDIT.md` counted ALL openai-codex rows as CXOPS-03 evidence — did not exclude fallback/timeout rows. Tighten audit methodology: only `fallback_triggered: false` + valid FINDINGS contract count as dogfood evidence. Retroactive audit of v1.4 rows to confirm count unchanged.

### INSTR (Phase 25 — Carryover WARNs + Telemetry — plans 2+3)

- [ ] **INSTR-01**: Edge-guard layer wiring. `super-gsd/scripts/lib/edge-guard.cjs` + `.planning/metrics/edge-guard-log.jsonl` are scaffolded (v1.2 Phase 10 work) but never wired into this project. Wire into orchestrator dispatch path so every gate transition records an edge-guard row. Enables `gate-drift-audit.md` at milestone close to have real data.
- [ ] **INSTR-02**: Dashboard offload math audit + fix. Phase 19 19-01 per-dispatch ATC flagged "dashboard offload math is wrong" — specific source not enumerated. Full audit of `Get-CodexStats` in `lib/sgsd-codex-status.ps1`: reconcile `claude_tokens_saved_by_codex` math, `codex_invocations_this_milestone` filter (milestone boundary detection), `fallback_rate` denominator, `avg_codex_duration_ms` (arithmetic vs geometric mean tradeoff).
- [ ] **INSTR-03**: Timeout observability metric. Phase 19 phase-level ATC flagged "timeout unreliability compounding." Add `.planning/metrics/codex-timeout-observability.jsonl` row per timeout event: `{ts, tier_requested, tier_actual_via_retry, duration_ms, exit_code}`. Dashboard tile surfaces "timeout rate by tier" — operator sees whether review tier is chronically under-budgeted.

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
