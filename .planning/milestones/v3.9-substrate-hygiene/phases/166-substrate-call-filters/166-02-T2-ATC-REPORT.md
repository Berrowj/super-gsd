FINDINGS: 1
CRITICAL: 0
WARNINGS: 1
DELETABLE_LINES: 5
DELTA_COMPLEXITY: positive. Cap traversal, note merging/rendering, and propagation add branches without removing brownfield complexity.
PASS_RATE: 7/10
ONE_LINER: All four boundaries are earned, but Phase-48 contains speculative note-matching logic that can over-attach degradation notes.
VERDICT: FAIL
REQUIRED_CHANGES:

1. In `classify.cjs:446-453`, match notes solely by guaranteed
   `hit_index === _substrate_hit_index`; remove the identity/doc/path/chunk
   alternatives.

The composer owns capping; the gate earns defensive recapping because injected
results bypass `callVtp`; triage and Phase-48 earn propagation because both
reshape results and would otherwise discard wrapper notes.

The Phase-48 OR-chain is genuine just-in-case code. Composer-generated notes
always contain a raw hit index, already preserved by `_substrate_hit_index`.
Matching by shared `doc_id`, `rel_path`, or `chunk_id` can incorrectly attach
one note to multiple results.

No 10 percent deletion is defensible. New test cases falsify distinct
integration, shape, prompt-repair, triage, and bridge boundaries. No
production-tree copy, dead import/parameter, or malformed prompt literal was
found. All seven changed CJS files parse; diff-check and prompt JS/YAML parsing
pass. Runtime reruns were blocked by read-only temp permissions; the execution
report records all named suites green. No meaningful bottleneck exists at the
five-hit maximum.

<!-- Reviewed cumulative T2 diff a35dc49 to dc8e40e. Salvaged from
     codex-live-output.txt after report truncation. 260,034 tokens.
     Caveat: this reviewer could not re-run suites (read-only temp); the
     orchestrator ran all 17 unsandboxed at dc8e40e, all exit 0. -->
