You are the independent existing SGSD reviewer for the bounded Phase173 publication-context test amendment. Review only the two current uncommitted expectation changes in super-gsd/tests/codex-worker/install.test.cjs (lines193 and238), against committed HEAD11b1240d770990b9cdcca0360b9e591a60e51999. Do not write source, planning, report files, state or controls; return the report as final text. No external providers, broad audits or test reruns.

Read 173-01-PUBLICATION-CONTEXT-AMENDMENT.md beside this prompt (23lines). Verify git diff -- super-gsd/tests/codex-worker/install.test.cjs is exactly xhigh->high in two strict expectations. Inspect that file lines187-194 and234-245, and its isolated environment setup only if necessary. Compare current super-gsd/registry/codex-profiles.yaml cli_profiles lines113-131 with upstream commit74d5070c72a8eaf0579793e384fc770abe5fdd7f (git show -s --format=fuller); it explicitly records Jack's high ceiling. Profiles, model, sandbox and runtime source must remain unchanged. The reviewed test candidate SHA256 is614e2816443e841b1d0cabb362df29692653e39aff8ec60059ef5e9db2a4fa54; original accepted test SHA256a974beeb4ed7e72c4d06d2b952ec95153a85f6228a0ae71533ab8f70b2cf234f. Registry SHA256c3573f18eca804b4a733da1662275f88bfd5ca4fc0a46e51a9df519bc25eb223.

Inspect /home/jackberrow/.local/state/clarity-orchestration/2026-09-15/orchestration-efficiency/publication/20260915T185601Z/FINAL-REGRESSION-RESULTS.json and installer-r3.txt (2/2, exit0 on Node22.22.2), and preserved installer-r2.txt failure (old xhigh expected/current high actual). Inspect TEST-ONLY-AMENDMENT.json for scope/hash binding. Cleanup focused3/3 and schema5/5 are completed regression evidence. Original RPC source032ffd8828a8a8a63e58db1a36636ae8f18088e95b2e4ac8cfce5c460f9545fe and RPC testsa6326111742bfe0c91ba3e9906dc2a9ecde820bd14d69f066e831deefe455a52 are unchanged from original acceptedf3e89f and already have fresh6/6 proof. Do not repeat RPC/Spec review; this acceptance covers only the newly changed test expectations in the current upstream composition. There is no new gate or waiver.

Assess three obligations: (1) verified upstream intended defaults justify both strict new expectations; (2) exactly the authorized two literals changed, with all existing model/no-fallback/closure/bootstrap/approval assertions retained; (3) new test bytes are bound to passing current consumer-context installer proof without claiming old test proof equivalence. Flag concrete defects only within that scope. Reads must be narrow: at most80lines per window,500characters per line,20KiB total output; no recursive scans or giant JSON/event output.

Return five separate physical lines, followed only by optional FINDINGS_DETAIL lines for actionable findings:
FINDINGS: <integer>
CRITICAL: <integer>
WARNINGS: <integer>
PASS_RATE: <n>/3
ONE_LINER: <PASS or FAIL with concise reason>
FINDINGS_DETAIL: <ID severity path:line evidence and required repair>
