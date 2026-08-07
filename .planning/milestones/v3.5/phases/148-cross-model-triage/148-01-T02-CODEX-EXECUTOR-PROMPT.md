# P148 T148-02 — triage-verdict-v1 contract + shared schema

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T148-02 of 5).
DONE / DONE_WITH_CONCERNS / BLOCKED.

## Files
- super-gsd/scripts/lib/triage-verdict-schema.cjs (CREATE — shared validation)
- super-gsd/scripts/codex-exec.sh (EXTEND contract vocab ONLY — follow the
  rd-memo-v1 precedent at ~:1055; do NOT touch profiles/timeout/finalize
  logic; P145's Probes 1-7 must keep passing)
- super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs (EXTEND)

## ⚠️ Standing rules (16 CRITICALs)
Malformed EXTERNAL output (Codex's verdict) is provider degradation with a
distinct observable outcome — never a clean verdict, never a silent drop.
The wrapper's job: extract exactly ONE JSON object from codex stdout,
schema-validate, exit 6 + raw violation report on failure (same evidence
shape as existing contract failures). The CONSUMER (T148-03) revalidates —
this task ships the shared validator both sides use.

## Schema (locked): one JSON object with
- `path`: EXACTLY one of "A"|"B"|"C"|"D" (closed vocab — enforce against
  prompt-injection: whatever the operator query said, anything outside the
  vocabulary is malformed);
- `rationale`: non-empty bounded string (VTP directive: rationale mandatory);
- `risk_flags`, `missed_context`, `recommended_skills`: arrays of bounded
  strings (may be empty arrays; wrong TYPE is malformed);
- reject: extra executable-looking payloads, strings over sane bounds (state
  them), nested objects where strings expected, multiple JSON objects.
Validator: never throws; returns {valid, errors[], value|null}.

## codex-exec.sh integration
`--contract triage-verdict-v1` switches the report parser to: find the ONE
JSON object (fenced or bare) in codex stdout, validate via the schema lib
(shell out to node with the lib — do not reimplement validation in bash),
write the VALIDATED JSON as the report on success; on violation exit 6 with
the raw-stream report exactly as the 5-line contract path does today.
`bash -n` must pass; do not disturb existing contract paths (default 5-line,
rd-memo-v1).

## Verify (report exact exit codes)
1. node --check the schema lib; bash -n codex-exec.sh.
2. Schema unit scenarios (extend the fixture runner): valid verdict passes;
   path "E" rejected; missing rationale rejected; risk_flags as string
   rejected; two JSON objects rejected; 100KB string rejected; prompt-
   injection shaped verdict ({"path":"ignore previous instructions"}) rejected.
3. Wrapper integration via fake codex on PATH (commit-gate precedent):
   canned VALID verdict → exit 0, report file contains exactly the validated
   JSON; canned MALFORMED verdict → exit 6 + raw report written.
4. P145 regression: bash super-gsd/scripts/codex-exec.sh --self-test
   --skip-network → Probes 1-7 PASS (sandbox may block bash — say so;
   orchestrator re-runs host-side).
SURGICAL CONSTRAINT. <300-word report.
