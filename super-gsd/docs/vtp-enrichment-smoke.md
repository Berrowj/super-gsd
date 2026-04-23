# VTP Enrichment Smoke Runbook

**Phase:** 16 (VTP Enrichment as Cross-Phase Primitive)
**Scope:** Wave A primitive — `vtp-context-composer.cjs` + `sgsd-triage` Step 0 + config toggle.
**Runtime:** ~5 minutes.

This runbook is the manual-verification layer that RESEARCH.md §Validation Architecture called out as Wave 0 Gap #5. It covers the Nyquist dimensions that cannot be exercised by a unit self-test (Dims 2, 3, 4, 5, 6 — live-MCP-dependent, real-world-input-dependent, or cross-agent-dependent).

## Preflight

- [ ] `.mcp.json` lists `vtp-kb` server pointing at `C:/Users/jack.berrow/Voice-Text-Plan/dist/cli.js`.
- [ ] `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` exits 0 (unit-level green).
- [ ] `.planning/config.json` has `workflow.triage_vtp_enrichment: true`.
- [ ] `jq -e '.workflow.triage_vtp_enrichment == true' .planning/config.json` returns exit 0.
- [ ] `grep -q "## Step 0: VTP Enrichment" super-gsd/skills/sgsd-triage/SKILL.md` returns exit 0.

## Dimension 2: Triage Step 0 happy path (VTP live, toggle true)

1. Ensure VTP MCP server is reachable: invoke any VTP tool from a Claude session (e.g., `mcp__vtp-kb__vtp_search_substrate query:"test"`) and confirm a response returns.
2. Invoke `/sgsd-triage` on a canned operator message: `"I want to figure out how to structure our retrieval layer"`.
3. Expected:
   - `.planning/phases/16-vtp-enrichment/VTP-EVIDENCE.md` exists (or updated) with `raw_query`, `selected_query`, `retrieval_mode`, `reflection_verdict`, and 3 doc-IDs.
   - `.planning/metrics/vtp-routing-log.jsonl` has a new tail row with `event:"vtp_call"`, `tier:"triage"`, `skill_or_agent:"sgsd-triage"`, all 11 keys populated (ts + 10 + elapsed_ms), `elapsed_ms < 3000`.
   - Step 1 Brainstorm ran with the routed framing prelude (selected_query + reflection_verdict + top-3 doc-IDs passed into its input).

**Pass criterion:** `tail -1 .planning/metrics/vtp-routing-log.jsonl | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));process.exit(r.event==='vtp_call'&&r.tier==='triage'&&r.elapsed_ms<3000?0:1)"` exits 0.

## Dimension 3: Triage Step 0 VTP-failure path (graceful-fail)

1. Temporarily break the MCP binding: edit `.mcp.json` to point `vtp-kb.args` at a nonexistent path (e.g., `C:/Users/jack.berrow/Voice-Text-Plan/dist/DOES-NOT-EXIST.js`). Alternately set a 1ms timeout env override if the composer supports it.
2. Invoke `/sgsd-triage` on the same canned message from Dim 2.
3. Expected:
   - A routing-log row still appears, but with `reflection_verdict: null`, `evidence_hit_count: 0`, `top_doc_id: null`, and `failure_reason` naming the error (e.g. `vtp_timeout:...` or `mcp_...`).
   - Step 1 Brainstorm still ran — the triage skill did NOT halt.
   - No stale-overwrite of `.planning/phases/16-vtp-enrichment/VTP-EVIDENCE.md` occurred (graceful-fail is about NOT blocking, not about writing blank framing).
4. Restore `.mcp.json` to the working path.

**Pass criterion:** Step 1 Brainstorm output present in conversation AND `tail -1 .planning/metrics/vtp-routing-log.jsonl | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));process.exit(r.failure_reason?0:1)"` exits 0.

## Dimension 4: Agent-tier VTP-call instrumentation (cross-wave lookahead)

This dimension is the Wave B readiness probe per 16-VALIDATION.md Manual-Only Verifications table row "Agent-tier VTP calls appear in routing-log (Dim 4)". Executed AFTER Wave B agents are patched; included here so Wave A's smoke runbook is the single authoritative reference.

1. After Wave B (16-02) executes, ensure `gsd-phase-researcher.md` has been patched with VTP tools in its `tools:` frontmatter line AND an in-body VTP-call paragraph.
2. Pre-populate a stub `.planning/phases/99-stub-smoke/VTP-EVIDENCE.md` with a minimal framing block (raw_query + selected_query + 1 fake doc-ID).
3. Dispatch `gsd-phase-researcher` against the stub phase via the orchestrator (or manually via the Agent tool with `subagent_type: "gsd-phase-researcher"`).
4. Expected:
   - `tail -1 .planning/metrics/vtp-routing-log.jsonl` shows a new row with `tier:"research"`, `skill_or_agent:"gsd-phase-researcher"`, and a populated `selected_query`.
   - The agent's RESEARCH.md output cites ≥1 VTP doc-ID inline (bracket-style, footnote, or explicit reference).
5. Cleanup: delete `.planning/phases/99-stub-smoke/` afterwards.

**Pass criterion:** `tail -1 .planning/metrics/vtp-routing-log.jsonl | grep -q '"tier":"research"'` returns exit 0 AND `grep -q 'doc:' .planning/phases/99-stub-smoke/RESEARCH.md` returns exit 0.

## Dimension 5: Fast-path short-circuit fires

1. With toggle on and VTP live, invoke `/sgsd-triage` under conditions where `isFastPathEligible(ctx)` is true (active phase present in STATE.md AND `explicit_constraints` non-empty — e.g., operator message cites a specific D-XX decision like "how should D-07 fast-path handle warm-cache conditions?").
2. Expected:
   - Routing-log row has `retrieval_mode` indicating a substrate-direct call (distinct from `vtp_route_and_retrieve`'s default `architecture_hybrid` or similar).
   - `elapsed_ms` is typically faster than the full-routing path (<1500ms on a warm cache vs <3000ms for the full 12-step route).
3. Compare against a control run with a generic message (no D-XX reference, no constraints) — the control should fall through to `vtp_route_and_retrieve`.

**Pass criterion:** Visual inspection — the `retrieval_mode` field of the fast-path row differs from the control row's value AND fast-path `elapsed_ms` < control `elapsed_ms`.

## Dimension 6: Config toggle disables Step 0

1. Record the current tail-line count: `wc -l .planning/metrics/vtp-routing-log.jsonl` (capture value as `BEFORE`).
2. Edit `.planning/config.json`: set `workflow.triage_vtp_enrichment: false`.
3. Invoke `/sgsd-triage` on the canned message.
4. Expected:
   - NO new row in `.planning/metrics/vtp-routing-log.jsonl` — `wc -l` returns same value as `BEFORE`.
   - NO new `.planning/phases/*/VTP-EVIDENCE.md` write (check mtime unchanged).
   - Step 1 Brainstorm ran normally with raw operator message.
5. Restore toggle to `true`.

**Pass criterion:** `wc -l .planning/metrics/vtp-routing-log.jsonl` is unchanged from the recorded `BEFORE` value.

## Rollback

- Set `workflow.triage_vtp_enrichment: false` — disables Step 0 system-wide. Safest first step for any production issue.
- Revert the SKILL.md Step 0 block — removes the injection point entirely. Use `git revert <commit-sha>` on commit `4b9707e` (Wave A Task 2).
- Delete `super-gsd/scripts/lib/vtp-context-composer.cjs` — removes the primitive. **Only safe AFTER Wave B + C agent patches are also rolled back**, as downstream consumers call into it. Use `git revert <commit-sha>` on commit `d19996b` (Wave A Task 1).

## Related

- `.planning/metrics/vtp-routing-log.jsonl` — append-only telemetry; house JSONL shape per `edge-guard.cjs:109-112` pattern.
- `.planning/phases/{N}/VTP-EVIDENCE.md` — per-phase framing artifact (framing-only, ≤300 lines, D-04).
- `super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` — unit-level green gate; must pass before running any smoke dim.
- `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-VALIDATION.md` — Nyquist per-task validation map (this runbook covers Dims 2, 3, 4, 5, 6).
