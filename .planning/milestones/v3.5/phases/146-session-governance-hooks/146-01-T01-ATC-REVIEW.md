FINDINGS: 5
CRITICAL: 1
WARNINGS: 4
PASS_RATE: 1/6
ONE_LINER: Main blocker is gate-evidence-log writing outside SGSD roots; main deletion win is shared envelope writer extraction.
FINDINGS_DETAIL: [CRITICAL] [security/path/no-op] `gate-evidence-log.cjs` `_planningDir()` falls back to returning any resolved input when no `.planning` exists, so `logGateEvidence()` can create `<arbitrary>/metrics/gate-evidence.jsonl` outside an SGSD repo instead of quietly no-oping.
FINDINGS_DETAIL: [WARN] [delete/simplify] `gate-evidence-log.cjs` duplicates the command-envelope JSONL machinery from `gate-value-log.cjs` (`STATUSES`, `RUN_ID_REGEX`, run id generation, normalize/assert/append/read shape). Verdict: do not wrap `logGateValue()` directly because the ledger semantics differ; extract a shared envelope JSONL writer/reader and have both ledgers supply command name, ledger path, and extension validation.
FINDINGS_DETAIL: [WARN] [never-throw/hang] `readGateEvidenceRows()` reads the full ledger into memory and parses all rows before filtering. A huge evidence ledger can block or OOM despite the public try/catch; add a bounded read/tail/limit option for cockpit/watchdog consumers.
FINDINGS_DETAIL: [WARN] [frontmatter] `sgsd-state.cjs` frontmatter parsing misses BOM-prefixed `STATE.md` files and silently lets duplicate keys last-win, which can resolve the wrong phase/milestone without evidence.
FINDINGS_DETAIL: [WARN] [anti-slop] `sgsd-state.cjs` exports unused/ambiguous surface: `PHASE_SOURCE.STATUS_PROSE` is impossible by implementation, and `resolvePlanLockedFiles` plus `findPlanLockedForPhase` are duplicate aliases unless both already have named downstream callers.
