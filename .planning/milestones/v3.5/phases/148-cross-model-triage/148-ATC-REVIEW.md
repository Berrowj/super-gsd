FINDINGS: 2
CRITICAL: 1
WARNINGS: 1
PASS_RATE: FAIL-GATE
ONE_LINER: P148 is mostly coherent, but production `sgsd-triage` invokes the runtime CLI without any MCP/VTP invoker, so AC-148b is harness-only.
FINDINGS_DETAIL: [critical] [production-seam] `SKILL.md` calls `node super-gsd/scripts/sgsd-triage-runtime.cjs` directly, but the runtime only reaches VTP through `options.mcpInvoke` and the CLI has no way to supply it. In real skill use, `callVtp` returns `no_mcp_invoke`, so null-reflection fallback cannot run outside injected tests. See `super-gsd/skills/sgsd-triage/SKILL.md:45`, `:83`, `super-gsd/scripts/sgsd-triage-runtime.cjs:277`, and `super-gsd/scripts/lib/vtp-context-composer.cjs:306-321`.
FINDINGS_DETAIL: [warning] [cost-ledger] The Step 0 runtime call has no `planning-triage` trigger source, so it records `codex_skipped_non_planning` before the later reconciliation call may dispatch Codex. That is not a double Codex dispatch, but it can create misleading skip rows for real planning triage flows. See `super-gsd/scripts/sgsd-triage-runtime.cjs:1099-1101` and `super-gsd/skills/sgsd-triage/SKILL.md:45`.
FINDINGS_DETAIL: [pass] [containment] Generated P148 runtime paths route through `resolveContainedPath`; wrapper report paths are contained by the runtime before handoff. VTP routing-log writes were also moved to contained root resolution.
FINDINGS_DETAIL: [pass] [silent-success] CLI JSON output is now structurally present on normal paths via `console.log(JSON.stringify(serializeCliResult(result)))`; empty/absent Codex reports degrade, not pass clean.
FINDINGS_DETAIL: [pass] [security] Hostile query/verdict content is schema-bounded, closed-vocab A-D, and never auto-executes `recommended_skills`; behavior influence is limited to surfaced route evidence/recommendation text.
FINDINGS_DETAIL: [pass] [delete-simplify] No mass-delete candidate. Runtime/test size is high, but the duplication is buying real fixture isolation; cross-suite helper extraction can wait until a second suite needs the same helper surface.
