GOAL_MET: NO
SAC_1: PARTIAL
SAC_2: PARTIAL
SAC_3: MET
SAC_4: MET
REMAINING_BYPASS: Raw MCP tools remain exposed to enrichment, board, and installed researcher/planner prompts; validation is post-transport and self-reported, not bound to the actual invocation.
REGRESSIONS: none
UNVERIFIED: Live VTP end-to-end behavior, actual user-profile agent installations, and an independent rerun of write/temp-dependent suites under this read-only verifier.
ONE_LINER: Mediated Node paths are protected, but prompt transports can still emit unfiltered calls and receive megachunks before enforcement.
VERDICT: FAIL

SAC 1’s literal-string inventory catches new ordinary occurrences, including additions inside known files, but explicitly allowlists prompt surfaces that retain direct transport. A dynamically constructed name also evades its grep model.

SAC 2 is fail-closed for `callVtp`: fresh probes confirmed invalid/raw payloads never reached the transport spy. Prompt acceptance, however, receives only prepared and self-reported records; it has no transport transcript or invocation witness. An agent can call unfiltered, then submit the prepared record.

SAC 3 is true for its scoped composer-to-enrichment-writer path: 900,001+ characters become exactly 16,000, the second hit remains unchanged, input is unmutated, discarded text is absent, and the named note survives.

Oversized responses are guaranteed to survive with names through mediated composer/enrichment injection, direct triage, and Phase-48 bridge. They are not guaranteed through raw prompt transports, the response reaches agent context before instructed truncation. Staged triage also preserves its 128 KiB refusal, producing generic degradation rather than a document-named note.

No P152/P154 or pre-existing triage/bridge regression was found; P154 v1 schema and evidence remain byte-unchanged.


<!-- Verifier run at HEAD after T1 and T2 closed. The codex-exec wrapper
     reported a report contract violation and dumped 436 KB of combined
     stdout and stderr; this file is the codex stdout section extracted
     verbatim. Adjudication of REMAINING_BYPASS is in
     166-ADJUDICATION-REPORT.md. -->
