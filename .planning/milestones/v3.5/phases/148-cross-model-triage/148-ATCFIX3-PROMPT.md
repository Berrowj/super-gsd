# 148-atcfix3 — Close the two remaining phase-ATC findings (staged evidence clobber + response-content injection)

You are a fresh SDD implementer (Codex GPT-5.5/xhigh). The staged MCP-transport protocol is implemented and green (34/34), but phase-ATC re-review found exactly two remaining defects. Fix ONLY these two. Surgical constraint: every changed line traces to one of the two findings; no refactors.

## Finding 1 (CRITICAL — staged evidence clobbered at Step 3)
FINDINGS_DETAIL: [CRITICAL] [logic] `SKILL.md` stages VTP in Step 0, but Step 3 invokes the normal runtime again without passing staged evidence; that runtime path calls `safeCallVtp(...)` from the CLI with no `mcpInvoke`, hits `no_mcp_invoke`, and rewrites the same VTP evidence before Codex prompt construction. See `super-gsd/skills/sgsd-triage/SKILL.md:47`, `super-gsd/skills/sgsd-triage/SKILL.md:88`, `super-gsd/scripts/sgsd-triage-runtime.cjs:1474`, `super-gsd/scripts/lib/vtp-context-composer.cjs:306`, `super-gsd/scripts/sgsd-triage-runtime.cjs:1564`, `super-gsd/scripts/sgsd-triage-runtime.cjs:1595`.

Required behavior: when staged VTP artifacts exist for the run, the Step 3 reconciliation path MUST consume them and MUST NOT re-enter the non-staged VTP path or rewrite VTP evidence. Fix both sides of the seam: (a) SKILL.md Step 3 must pass the staged evidence/response artifacts into the runtime invocation; (b) the runtime must detect existing staged VTP evidence and skip the safeCallVtp re-entry (no no_mcp_invoke overwrite). Add/extend a scenario proving Step 0 staged evidence survives through Step 3 prompt construction.

## Finding 2 (WARNING — response-content prompt injection surface)
FINDINGS_DETAIL: [WARNING] [security] The new response-file seam bounds path/content size and JSON parsing, and oversized/garbage scenarios exist, but parsed VTP response strings are written raw into Markdown evidence and then fenced into the Codex prompt; a response title/doc_id/selected_query containing fence-breaking prompt text is not escaped and no staged response-content injection scenario covers it. See `super-gsd/scripts/sgsd-triage-runtime.cjs:213`, `super-gsd/scripts/sgsd-triage-runtime.cjs:330`, `super-gsd/scripts/sgsd-triage-runtime.cjs:345`, `super-gsd/scripts/sgsd-triage-runtime.cjs:939`, `super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs:1450`, `super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs:1473`, `super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs:1614`.

Required behavior: sanitize/escape parsed VTP response strings (title/doc_id/selected_query and any free text) before writing them into Markdown evidence and fenced Codex prompt sections — at minimum neutralize code-fence breaks and control sequences, with bounded length already enforced. Add a staged response-content injection scenario (fence-breaking prompt text in a response field) proving the prompt cannot be escaped.

## Verification (run before reporting; if sandbox blocks bash spawn, say so — orchestrator verifies host-side)
node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario all   # must stay green, including new scenarios

## Report contract (exact sections, max 300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none
ONE_LINER: substantive summary
STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED
