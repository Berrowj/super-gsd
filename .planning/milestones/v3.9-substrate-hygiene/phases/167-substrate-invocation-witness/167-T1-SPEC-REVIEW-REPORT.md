FINDINGS: 1
CRITICAL: 0
WARNINGS: 1
PASS_RATE: 7/7
ONE_LINER: All seven highlighted controls hold; one noncritical hook test passes through a non-production branch.
VERDICT: PASS-WITH-FINDINGS
REQUIRED_CHANGES:

1. Make non-substrate events return `null` even when `expectedEvent` is set, and
   test that installed CLI path.

At hook lines 218-220, the installed CLI supplies `expectedEvent`, causing
unexpected non-substrate tools to be denied or rewritten rather than ignored.
The test omits `expectedEvent`, so it passes for the wrong reason. The exact
matcher prevents impact under correct registration, hence WARNING rather than
CRITICAL.

Pre denies before transport; Post emits capped `updatedMCPToolOutput`;
correlation consumes by runtime session plus hook-computed payload digest
without accepting tool-use IDs; broker withdraws discovery and rechecks forced
calls; cap/digest implementations are reused; P166 and frozen artifacts are
unchanged; residual same-user bypass is explicitly under-claimed.

Fresh syntax and direct enforcement probes passed. Full suite rerun was blocked
by the read-only environment at fixture `mkdtemp` (`EPERM`); the supplied
unsandboxed 34/34 evidence remains consistent with the audited code.

<!-- Reviewed commit 6aa2f01. Salvaged from codex-live-output.txt after report
     truncation to 165 B. 166,164 tokens. -->
