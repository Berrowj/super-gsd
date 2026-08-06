
## Deferred into T146-07 (cheap-fixes cleanup) — added 2026-08-06

- **DEFERRED-D (from T146-03 re-review WARN):** the SessionStart hook's outer
  fail-open guard swallows any error raised BEFORE context resolution
  (`resolveContext`/`readState`, ~lines 240-243) with no stderr breadcrumb and
  no evidence row — the catch at ~255-257 only comments and returns. The
  distinct failure rows added by the fix exist only AFTER state is read
  (~247, ~253). Consequence: a hook broken at startup looks healthy forever.
  This is the phase's recurring "silent success" hazard (cf. P145's
  `codex-exec` reporting `OK — written (0B)` on a failed write). Fix in T146-07:
  emit a non-stack stderr breadcrumb (and an evidence row once a root is known)
  from the outer guard. Must NOT print a stack trace and must NOT exit nonzero.
