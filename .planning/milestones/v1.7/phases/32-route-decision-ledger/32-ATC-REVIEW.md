# Phase 32 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer (sgsd-code-reviewer)
- Provider: codex-cli-reviewer (gpt-5.5, xhigh) -- see `32-codex-review.md` for raw 5-line contract
- Tier: phase-level (dual-provider per v1.7 readiness GO)
- Final verdict: pass (post-fix; both providers' findings cleared in-loop)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Anti-slop pre | Post-fix | Anti-slop post |
|----------|---------|------|------|---------------|----------|----------------|
| Claude   | warn    | 0    | 3    | 8/10          | pass     | 10/10          |
| Codex    | warn    | 2    | 2    | 6/10          | pass     | 9/10 (W deferred design-locked) |

## Findings (deduplicated)

### CRIT (2, fixed in-loop)

**C1 [Codex] -- Step 9.5 wire-in references out-of-scope `dispatchResult`**
- File: `super-gsd/skills/sgsd-orchestrate/SKILL.md`
- The wire-in was placed AFTER the `else if (effective.invocation === 'shell')` block closed (around the original line 1238), but referenced `dispatchResult` declared `const` inside that block (line 1167). Read literally as JavaScript, `dispatchResult` would be a `ReferenceError` at the wire-in. Claude flagged the same issue as a WARN ("scope gap unacknowledged"); Codex correctly escalated to CRIT.
- Fix: moved the entire wire-in INSIDE the shell branch, immediately after the report-assembly logic and before the branch's closing `}`. Now `dispatchResult` is in lexical scope at the call site. Removed the duplicate post-branch wire-in. ROUTE-03 verifier still passes (single `logCodexRoute(` site at SKILL.md:1223).
- Bonus: this is also semantically correct -- a `codex_route` decision only exists when the codex shell-branch ran; the agent-only path has no provider routing event to log.

**C2 [Codex] -- "phase may violate envelope-v1"**
- Tied to C1: when `dispatchResult` was undefined at the wire-in call site, `logCodexRoute` would receive `dispatchResult: undefined`, and the lib would emit a row with `decision.exit = null, decision.timeout_hit = false` -- partially valid but not capturing the actual dispatch outcome. With C1 fixed, every emitted row now has the full dispatch context.
- Belt-and-braces fix added: `_assertEnvelopeV1(enriched)` step in `appendRow` (route-ledger.cjs) now does manual schema validation (13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type, evidence/artifacts inner shape). Closes Codex's WARN-1 ("validation is shallow") at the same time.

### WARN (5, fixed in-loop)

**W1 [Claude] -- plan-vs-impl drift (Fixture D provider name)**
- File: `32-01-route-ledger-PLAN.md:167`
- Plan said `decision.to='claude-sonnet-reviewer'` but the canonical runtime tag is `'claude-via-fallback'` (matches SKILL.md:1186/1204 `report._provider` value). Test was correct; plan spec was outdated.
- Fix: updated plan spec to `'claude-via-fallback'` with explanatory comment naming the SKILL.md source-of-truth lines.

**W2 [Claude] -- wire-in scope undocumented**
- File: SKILL.md (original wire-in)
- Claude flagged that wire-in fires only on shell-branch path; agent-path has no log. Risk: readers might assume the wire-in always fires.
- Fix: SUPERSEDED by C1 fix (move wire-in inside shell branch). Behavior is now structurally enforced, not just documented.

**W3 [Claude] -- self-test cwd dependency**
- File: `super-gsd/scripts/lib/route-ledger.cjs:258` (assertion 12)
- Used `process.cwd()` to find the canonical ledger path; on CI with cwd != repo root, both before/after existence checks would be false (off-root path doesn't exist), trivially passing the comparison and missing potential bugs.
- Fix: anchored to `__dirname` instead. Lib lives at `<repo>/super-gsd/scripts/lib/route-ledger.cjs`; canonical at `<repo>/.planning/metrics/route-decisions.jsonl`; 3-dirs-up + .planning resolves consistently regardless of invocation cwd.

**W4 [Codex] -- "validation is shallow"**
- File: `super-gsd/scripts/lib/route-ledger.cjs` (`_normalize` only enum-checked BOUNDARIES + STATUSES, not full envelope schema)
- Fix: added `_assertEnvelopeV1(enriched)` step in `appendRow`. Manual schema validation without adding ajv dep. Checks: 13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type+range, evidence items have {kind, ref}, artifacts items have {kind, path}. Throws on violation; public-API try/catch still preserves never-throws-upward contract.

**W5 [Codex] -- "catch scope is too broad"**
- File: `super-gsd/scripts/lib/route-ledger.cjs:163-170` (logRouteDecision try/catch wraps the entire function)
- Codex argument: programmer errors (TypeError, ReferenceError) are silently swallowed alongside I/O errors. Hygiene preference: narrow catch scope.
- Resolution: **DEFERRED as design-locked** -- CONTEXT.md and RESEARCH.md §9.3 lock the writer to NEVER throw upward (orchestrator must continue regardless of writer state). Narrow catch would re-throw on programmer error and crash the orchestrator the wire-in protects. The locked decision wins this design tension.
- Mitigation: stderr error message includes `e.message` (visible in CI logs); the canonical ledger row is missed but the orchestrator continues. This is the correct trade-off for a non-load-bearing telemetry helper.

### NIT (0)

None.

## ATC checklist (post-fix)

### 7-Step LITE/FULL (code phase)

| Step | Verdict | Notes |
|------|---------|-------|
| 1 First Principles | PASS | Ledger anchors v1.7 ROUTE lane; lib + caller in same phase satisfies schema-without-consumer rule. |
| 2 Delete | PASS | Deduplicated wire-in (removed orphan post-branch copy after C1 fix). |
| 3 Simplify | PASS | Wire-in moved into branch where dispatchResult is in scope (-1 ReferenceError class); _assertEnvelopeV1 catches violations at write-time (-1 silent-corruption class). Net complexity decreased. |
| 4 Validate | PASS | self-test 12/12 PASS, fallback test 26/26 PASS, ROUTE-01..04 all green, status-consistency milestone v1.7 OK. |
| 5 Anti-slop | 9.5/10 | Combined: Claude 10/10 post-fix, Codex 9/10 with W5 deferred design-locked. |

**Combined anti-slop score: 9.5/10.** W5 deferred is intentional design (writer never throws upward per CONTEXT.md lock) -- not a missing fix.

## Codex provider health (run-time evidence)

- `provider-health/check.cjs --provider codex --behavioral` -> AVAILABLE (oracle `codex_login_status` exit 0; oracle `contract_canary` exit 0).
- 1 invocation; success on first try (post Phase-31 fix to prompt template VERDICT->FINDINGS).
- exit 0, duration 383550ms (~6.4 min), report_bytes 293, JSONL row appended at `2026-04-27T08:23:24Z`.
- NO "Codex unavailable" backlog row required.

## Status-consistency check (gate)

```
node super-gsd/tools/status-consistency/check.cjs --milestone v1.7
-> status-consistency milestone v1.7: OK
```

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN, 1 deferred (W5 design-locked). Anti-slop combined 9.5/10. No backlog row needed.

## One-liner

Phase 32 route-ledger lib + codex_route wire-in + fallback test land cleanly; dual-provider review surfaced 2 CRITs (out-of-scope dispatchResult / linked envelope conformance) + 5 WARNs (plan drift / wire scope / cwd / shallow validation / broad catch); 6 findings fixed in-loop in 1 attempt each, 1 deferred design-locked (W5: writer never throws upward per CONTEXT.md lock). Combined anti-slop 9.5/10.
