FINDINGS: 1
CRITICAL: 0
WARNINGS: 1
DELETABLE_LINES: 14
DELTA_COMPLEXITY: positive, prompt safety improves but instruction and test surface grows.
PASS_RATE: 8/10
ONE_LINER: Correct, proportionate contract coverage with one pocket of P166-derived prompt/test residue.
VERDICT: PASS-WITH-FINDINGS
REQUIRED_CHANGES:

1. Remove or rewrite the obsolete positive truncation assertions and collapse
   the duplicated no-cap/no-truncate wording.

The policy test at `assert-vtp-substrate-policy.cjs:894` still positively matches
"truncate...in memory", `16000`, and `original_chars`; it now passes only because
the prompts negate those phrases. That is dead, misleading coverage. Prompt lines
41-46 and 56-61 can then be condensed.

Static duplication across standalone prompts is preferable to a generator; exact
block equality controls drift. Coverage is not thin: 39 assertion sites exercise
four classifications. The two installed surfaces are deliberately models; T4 owns
real propagation falsification. Both CLI command names are shipped and correctly
parameterized. Inventory literals are valid, path-bound, and do not copy the
production tree.

Validation: syntax, command reality, ordering, failure paths, forbidden literals,
inventory classification, and diff hygiene checked.

Checklist: 1 PASS; 2 PASS; 3 PASS; 4 FAIL; 5 PASS; 6 PASS; 7 PASS; 8 FAIL;
9 PASS; 10 PASS.

<!-- Reviewed cumulative T3 diff be6cfa1 to 386d027. Salvaged from
     codex-live-output.txt. 142,377 tokens. Fix deferred until T4 completes,
     because concurrent Codex writers in one workspace are forbidden. -->
