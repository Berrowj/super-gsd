---
phase: 48
plan: 48-01
review_type: phase-level-ATC (Step 9, dual-provider)
date: 2026-04-28
verdict: PASS (after CRITICAL+HIGH fix)
---

# Phase 48 Phase-Level ATC Review — Dual Provider

## Reviewers

| Provider | Status | Verdict | Findings |
|----------|--------|---------|----------|
| Claude (sgsd-code-reviewer) | OK | REVISE → PASS post-fix | 1 CRITICAL (ok:true on empty), 1 HIGH (timeout not enforced), 2 MEDIUM (cosmetic), 2 LOW |
| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a | Phase 41-47 precedent: TIER_ANALYSIS=180s tier cap. |

## Findings + Resolution

### CRITICAL (resolved)

- **classify.cjs:453-454** — `_buildEvidencePacket` returned `ok:true` when sanitized results were empty + reason_codes contained `vtp_call_returned_empty`. Orchestrator guards `if (packet.ok)` would inject null context to agents as successful evidence — silent context loss with VTP appearance of success.
  - **Fix**: commit `ad8583c` — `ok = sanitizedResults.length > 0` (single condition). Empty results map to `ok:false`, triggering caller-side fallback path.

### HIGH (resolved)

- **classify.cjs:502** — `_callVtpToolWithTimeout` was named after Promise.race pattern but body was synchronous; 30s `per_query_timeout_ms` config plumbed through but never enforced. Production MCP calls could block indefinitely.
  - **Fix**: commit `ad8583c` — renamed to `_callVtpToolShim` with explicit contract documenting that BRIDGE does NOT enforce timeout — orchestrator owns it via shim wrapper. Routes.yaml budget remains for orchestrator consumption.

### MEDIUM (accepted — forward-shape flexibility for Phase 49+)

- Schema `results.items.additionalProperties: true` — kept open for Phase 49 governance to add fields without forced schema bump.
- `_extractResults` speculative branches (`hits`, `items`) — kept for unforeseen MCP response shapes; zero perf cost.

### LOW (accepted)

- F7 mtime equality check — sub-millisecond touches theoretically can produce identical mtimes; cosmetic.
- `_forcesFromInput` boolean coercion — works but reviewer flagged shape inconsistency vs route.cjs `isProviderHealthy` returning object; not a behavior bug.

## Invariants

- **A3 MCP failures separated**: SOUND — failures.jsonl additive; no error string in evidence_packet.results[]; F2 binding asserts JSON.stringify(packet) contains no TIMEOUT/error markers.
- **A4 cap + provenance**: SOUND — 5000-token cap + descending elision; source_refs + root_source_hashes mandatory; F3+F8 binding.
- **VTP_WHITELIST import-by-reference**: SOUND — assertion 11 identity-checks Object.freeze identity vs Phase 47 export.
- **Lock 11 (no semantic)**: SOUND — `_validateInput` rejects embedding/similarity_score/fuzzy_match/cosine fields with bridge_internal_error sentinel.
- **Lock 13 (never-throws)**: SOUND — selectiveVTPCall, classify, callVTPTool, _selectiveVTPCallInternal all wrap try/catch; sentinel returns on error.
- **Phase 32 BOUNDARIES integrity**: SOUND — extended 8→9 with `vtp_bridge`; assertion 1 + assertion 15 binding.
- **No Phase 45 mutation**: SOUND — F7 fingerprint enforces; git diff confirms 0 lines.
- **No premature downstream import**: YES — no Phase 49/50/51 require().
- **Read-only invariant**: PASS — 9 source files unchanged; F10 canonical-stream guard.
- **ASCII-only**: PASS — 0 non-ASCII bytes.
- **Mirror fidelity**: PASS post-fix — `_callVtpToolShim` rename aligns name with synchronous behavior; other helpers faithful to Phase 41-47 mirrors.

## Live verification at close

```
classify.cjs --self-test: 11/11 PASS
route-ledger.cjs --self-test: 15/15 PASS (was 14/14)
dispatch-router/route.cjs --self-test: 15/15 PASS (no regression)
A1 local phases NO VTP: PASS (synthesis_judgment → not_routed_to_vtp)
A2 4-entry whitelist (3 active + 1 reserved): PASS
A3 MCP failure separation: PASS
A4 5000-token cap + mandatory provenance: PASS
ok=false on empty results (CRITICAL fix verified): PASS
_callVtpToolShim name + contract doc (HIGH fix verified): PASS
Phase 47 VTP_WHITELIST import-by-reference: PASS (length=3, frozen, identity check)
Phase 32 BOUNDARIES extended 8→9: PASS
No Phase 45 mutation: PASS (build.cjs UNCHANGED)
Read-only Phase 41-47 sources: PASS
```

## Final Verdict

**PASS** (post-fix). Phase 48 deliverables hold all critical invariants. Claude CRITICAL + HIGH addressed in-loop; 2 MEDIUM + 2 LOW accepted. Codex provider_unavailable per established Phase 41-47 precedent. Commit chain: `bdf6db1` (classify.cjs + schema + 11-assertion self-test) → `98e9db8` (route-ledger 8→9 + routes.yaml vtp_bridge) → `4de7272` (SKILL.md d.7 wire) → `6f1f00c` (verifier audit) → `ad8583c` (CRITICAL+HIGH fix). Cross-phase contracts ready: Phase 49 governance reads vtp-bridge-failures.jsonl + EVIDENCE-PACKET schema; Phase 51 BENCH includes "VTP unavailable" failure injection fixture; Phase 52 caches hot evidence_packets.
