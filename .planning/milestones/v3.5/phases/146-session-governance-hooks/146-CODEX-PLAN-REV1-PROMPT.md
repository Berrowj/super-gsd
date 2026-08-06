# P146 Plan REVISION 1 — resolve NOGO (3 CRITICAL, 2 WARNING)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Your prior draft is at
`.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`
(schema-v2 VALID). The combined plan-check + ATC/MUDA gate returned **NOGO**.
Produce a REVISED plan that resolves every finding. Output the COMPLETE revised
plan file inside ONE fenced ```markdown block (the sandbox cannot write files).
Do not output anything else. Do NOT run commands. Do NOT re-derive research.

## Findings you must resolve

**CRIT-1 (stub-satisfiable ACs).** AC-146a/b/c can pass with stubs: hardcoded
SessionStart text, hardcoded `/sgsd-triage`, and `--self-test` gate/adapter
success prove nothing about real sg hook wiring, first-response injection,
route-only behavior, real PostToolUse evidence, or cockpit refresh.
→ Rewrite those semantic_acceptance_criteria so a stub CANNOT pass. Techniques
  available to you (pick what fits, justify inline):
  - Assert content that only real STATE/registry reads could produce — e.g.
    the contract must contain the phase number parsed from a TEMP repo whose
    STATE says a value no stub would guess (e.g. 873), proving a real read.
  - For the classifier, assert BOTH a positive (planning prompt → directive)
    and a NEGATIVE control (execution/trivial prompt → NO directive) in the
    same criterion, so a hardcoded emitter fails the negative.
  - For the quality gate, drive it with a REAL PostToolUse payload through the
    real hook entrypoint (not a `--self-test` flag), then assert the appended
    JSONL row's field values match the temp repo's phase/file, and have the
    cockpit reader consume THAT row (not a fixture).
  - Prefer "run the real entrypoint against a constructed temp fixture and
    assert derived values" over "call a self-test flag and trust exit 0".
  Self-test flags may still exist as developer conveniences, but they must not
  be the proof surface for an AC.

**CRIT-2 (punted decision).** The real PostToolUse mutation tool names are not
decided — the plan tells the executor to confirm them during T146-05.
→ DECIDE now. The live harness tool set for file mutation in this Claude Code
  version is: `Edit`, `Write`, `NotebookEdit` (there is NO `MultiEdit` in this
  harness). State the matcher explicitly in the plan and state the degradation
  rule if an unknown tool name appears (match-miss → no row, exit 0, never
  block). If you believe additional names apply, name them and say why.

**CRIT-3 (DAG/file collision).** T146-03/04/05 overlap on
`gate-evidence-log.cjs`, `.planning/metrics/gate-evidence.jsonl`, and
`session-governance-hooks.yaml`; T146-03/05 also overlap shared state helpers.
Codex executor dispatches are SERIAL with exclusive workspace write access, so
this must be an explicit total order, not an implied one.
→ Give every task an explicit `depends_on` chain producing a single valid
  serial order, and make `files_touched` disjoint per task where possible. Any
  file legitimately touched by two tasks must be created in the EARLIER task
  and only appended-to/registered-in the later one — say which task OWNS each
  shared file.

**WARN-1 (latency not actually asserted).** The bench criterion only trusts
`--bench` exit 0.
→ Make the verification parse the recorded `p95_ms` from the JSONL row and
  fail if it is absent or >= 1000. Assert the row exists with the iteration
  count too.

**WARN-2 (T146-05 oversized).** It bundles PostToolUse producer logic, registry
work, cockpit adapter, MCP reader, shared helpers, and evidence-stream
behavior.
→ Split into producer and reader tasks, both remaining inside P146 (VTP
  directive: AC-146c is incomplete without a reader — do NOT defer the reader).

## Preserve from the current draft
schema-v2 validity (SCHEMA-09/-10: real-data semantic_acceptance_criteria and
rollback_plan required), the board-binding constraints, the VTP directives, the
Source Audit section, the deferred-items list (DEFERRED-A/B/C, DEVIATION-1,
DEVIATION-W), and `expected_ATC_tier: GATE`.

Task count may grow (7–8 is fine). Every task still needs a deterministic,
Windows-safe, network-free verification command and an AC-146 letter trace.
