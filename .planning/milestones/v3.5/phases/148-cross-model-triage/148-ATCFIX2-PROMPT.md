# 148-atcfix2 — Close the three spec-review gaps in the staged MCP-transport fix

You are a fresh SDD implementer (Codex GPT-5.5/xhigh). A prior dispatch implemented the staged MCP-transport protocol in sgsd-triage-runtime.cjs + tests (33/33 green) but was killed before finishing. Spec review found EXACTLY three gaps. Fix ONLY these three. Surgical constraint: every changed line must trace to one of the three gaps; no refactors, no style passes.

## Gap 1 (CRIT — production wiring): super-gsd/skills/sgsd-triage/SKILL.md was never updated
Production still invokes the old single-shot CLI, so the staged transport never runs outside the test harness. Update SKILL.md so the skill drives the staged protocol: runtime emits {action:"invoke_mcp", tool, args, response_file} at --stage vtp-plan; Claude executes the MCP call VERBATIM (runtime decides, Claude transports) and re-invokes --stage vtp-consume --response-file <path>; fallback path allows one more loop; finalize stage per runtime implementation. The SKILL prose must contain the literal stage names vtp-plan, vtp-consume, vtp-finalize and the verbatim-transport instruction. Match the original fix prompt's Step 0/0.5/3/4 two-model prose style already in the file.

## Gap 2: staged skip emits 'reasonCode' but the contract requires 'reason'
Locate the staged-skip emission in sgsd-triage-runtime.cjs and align the field name with the required contract. Update tests if they assert the wrong field.

## Gap 3: consume/finalize are not idempotent-safe
Repeated invocations of vtp-consume/vtp-finalize append duplicate routing/degradation rows. Make re-invocation idempotent (guard on already-recorded state) WITHOUT breaking the 33 green scenarios. Add a test assertion for double-invocation if cheap.

## Context — original fix prompt (for protocol fidelity; do NOT re-implement what already landed)
```
# P148 phase-ATC fix — Claude is the MCP transport; the runtime is the brain

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/sgsd-triage-runtime.cjs`,
`super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`,
`super-gsd/skills/sgsd-triage/SKILL.md`. Nothing else.

## CRIT-1 — the CLI cannot reach VTP in production
`mcp__vtp-kb__*` tools are callable only inside CLAUDE'S SESSION — never by a
spawned node process. The runtime's VTP path exists solely via
`options.mcpInvoke`, which only tests inject. In real skill use `callVtp`
returns `no_mcp_invoke`: AC-148b is harness-only. (This is the milestone's
harness-vs-production seam at its deepest — the previous fix moved the seam
from "module vs CLI" to "CLI vs MCP reality".)

### Fix — file-protocol loop: runtime decides, Claude transports
Add a staged CLI protocol (keep the module API + mcpInvoke for tests):
1. `--stage vtp-plan` → runtime reads STATE/config/tier, emits structured
   JSON: {action:"invoke_mcp", tool:"vtp_route_and_retrieve", args:{...},
   response_file:"<contained path>"} — or {action:"skip", reason} when the
   toggle is off (existing row).
2. Claude (per SKILL prose) calls that MCP tool in-session VERBATIM, writes
   the raw JSON response to response_file, re-invokes:
3. `--stage vtp-consume --response-file <path>` → runtime validates + applies
   the EXACT fallback predicate to the REAL response. No fallback → finalize
   (evidence file + rows) and emit {action:"complete", ...}. Fallback needed →
   emit {action:"invoke_mcp", tool:"vtp_search_substrate", args:{raw query},
   response_file} + the degradation row; Claude calls it and re-invokes:
4. `--stage vtp-finalize --response-file <path>` → finalize with fallback
   evidence.
Rules: response files validated + contained (they are UNTRUSTED external
input — bound sizes, JSON-parse guarded, reason-coded rows on garbage);
every stage idempotent-safe and never-throw; the decision logic (predicate,
validation, rows, evidence composition) stays 100% in the runtime — the SKILL
prose instructs Claude to execute tool calls VERBATIM with zero judgment and
feed results back. Existing single-shot `mcpInvoke` path stays for tests and
programmatic callers.

## WARN-1 — misleading skip rows from stage-blind gating
A Step 0 (VTP-only) invocation currently evaluates the codex gate and logs
`codex_skipped_non_planning`. Gate evaluation must run ONLY at the codex
stage (Step 0.5 / reconciliation invocation) — a VTP-stage call must never
touch codex gating or write its rows.

## SKILL.md
Update Step 0/0.5 prose to the staged loop (concise — bullet the loop, don't
bloat; the file must stay lean). Claude's role stated plainly: "execute the
emitted MCP call verbatim, save the response, re-invoke — no interpretation."

## Tests
- Existing 28 scenarios keep passing (mcpInvoke path preserved).
- NEW: full staged-protocol scenario driving the REAL CLI through
  plan→consume(→finalize) with fixture response FILES: healthy (no fallback),
  null-reflection (fallback instruction emitted, then finalize), garbage
  response file (reason-coded row, exit 0), oversized response file (bounded,
  degraded).
- NEW: VTP-stage call writes NO codex-gate rows.

## Verify (report exact exit codes)
node --check both cjs; full suite (expect ~32; sandbox EPERM caveat → say
so); SKILL grep-invariants (staged loop present, verbatim-transport language,
no direct mcp call in Step 0 prose beyond executing the runtime's emitted
instruction).
SURGICAL CONSTRAINT. <250-word report.
```

## Verification (run before reporting)
node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario all   # must stay green
grep -c 'vtp-plan\|vtp-consume\|vtp-finalize' super-gsd/skills/sgsd-triage/SKILL.md   # must be > 0

## Report contract (exact sections, max 300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none
ONE_LINER: substantive summary
STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED
