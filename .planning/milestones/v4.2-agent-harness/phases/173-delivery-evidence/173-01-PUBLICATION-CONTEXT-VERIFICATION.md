# 173-01 publication-context verification

The only new source change beyond accepted f3e89f7677d929387daa261d781122c70a9e3bfb is two strict installer-test default-effort literals (`xhigh` to `high`). Upstream 74d5070c72a8eaf0579793e384fc770abe5fdd7f and unchanged `cli_profiles` define those defaults. No profiles, model selection, approvals, sandbox or runtime behavior changed.

Publication starts at upstream a478207d29cedd4c0ce14838ee171460c02e2bfc. Exact cherry-pick 11b1240d770990b9cdcca0360b9e591a60e51999 preserves all 23 accepted changed paths; it excludes the unrelated unpublished milestone-seeding parent 3718b109cee8d4604b8602aa6a2b9e84e226c1f3. All 20 original evidence files, runtime RPC and RPC tests remain byte-identical to the accepted commit. The four upstream-only profile/VTP files remain byte-identical to upstream.

Current hashes:
- RPC source: `032ffd8828a8a8a63e58db1a36636ae8f18088e95b2e4ac8cfce5c460f9545fe`
- RPC tests: `a6326111742bfe0c91ba3e9906dc2a9ecde820bd14d69f066e831deefe455a52`
- Amended installer test: `614e2816443e841b1d0cabb362df29692653e39aff8ec60059ef5e9db2a4fa54`
- Unchanged profile registry: `c3573f18eca804b4a733da1662275f88bfd5ca4fc0a46e51a9df519bc25eb223`

## Verification in the publication worktree

Node v22.22.2, npm10.9.7. The fresh worktree required `npm ci --ignore-scripts --no-audit --no-fund --loglevel=error` in `super-gsd/tools/plan-schema`; package-lock SHA256 `e64491257bf2df2c24f1ab593fc8f5ca971456ae8ffd5867b101841f3cfbeafe` remained unchanged. Dependencies and npm cache are isolated; no shared runtime installation occurred.

1. `node --test super-gsd/tools/codex-worker/rpc.test.cjs super-gsd/tests/codex-worker/install.test.cjs`: RPC6/6 passed; combined command failed because fresh dependencies were absent. This failure is retained and is not called a passing suite.
2. After exact-lock dependency setup, installer rerun failed on stale xhigh expectation against actual high. Narrow same-family inspection identified the second stale literal. Both failures remain in the evidence directory.
3. After the planned two-literal correction, `node --test super-gsd/tests/codex-worker/install.test.cjs`:2/2, exit0, zero skipped; finished2026-09-15T19:04:59.863525Z.
4. `node --test --test-name-pattern='stopping an adapter cleans up its owned App Server process tree|unacknowledged responses never count and timeout cleanup retains an earlier real failure' super-gsd/tools/codex-worker/worker.test.cjs`:3/3, exit0, zero skipped.
5. `node super-gsd/tools/plan-schema/validate.test.cjs`:5 passed,0 failed, exit0.
6. `git diff --check`:exit0. Exact hashes rechecked after review; original source/evidence and upstream-only files unchanged.

These are scoped no-provider regression checks. Original RPC/Spec/ATC evidence is reused only for byte-identical source. The changed installer test uses the new proof above; no equivalence to its original test proof is claimed.

## Independent acceptance

The existing source `codex-exec.sh --profile review` dry-run resolved `gpt-5.6-sol/high`. The dispatch used no explicit model or reasoning override. Inherited config and a second diagnostic dry-run are retained; actual launch/native state are authoritative. No global setting or active native worker was changed.

Worker `ca6f4b0d-1d86-4069-b920-41e35388e5f3`, attempt `adf61a02-1a06-4234-9c90-c20be0353597`, completed2026-09-15T19:12:43.102Z. The adjacent `173-01-PUBLICATION-TEST-REVIEW-REPORT.md` is PASS3/3, zero findings/critical/warnings. Valid wrapper exit0;232 bytes; SHA256 `c7a0f0df01ed92df9491af6ad7b1f69874e2b277dd593a4b5050e8829900aafa`. Receipt identity, exact report path, hash and byte count were verified. The reviewer requested the precise amendment path; the exact-owned reply was applied, with no source or scope change. Original review history remains intact.

## Evidence and release boundary

External evidence directory: `/home/jackberrow/.local/state/clarity-orchestration/2026-09-15/orchestration-efficiency/publication/20260915T185601Z`. Files and hashes:
- `RPC-INSTALL-TEST-RESULT.json` SHA256 `aa5e249ec31f8e8caa48c107eb4e5ebee945f432098a30dddab2630967bca127`
- `rpc-install-focused.txt` SHA256 `ca010e3bc54bbfd9720d98808e7f103fca3e2e59705c2285e231d7802876e76f`
- `ISOLATED-DEPENDENCY-SETUP.json` SHA256 `0b6f01ec95d3d3e8b0c61eb1b5d7d178f574fba4724987f949e2304b7030c3c8`
- `isolated-dependency-setup.txt` SHA256 `da76d5e1239de6a3d751167714402facfa946117a4e48287a4baec7ba5b0dc82`
- `AFFECTED-REGRESSION-RESULTS.json` SHA256 `a95e246ca27e3325274cceda4bdecf1118030e276f4f2d522a29882d80458d94`
- `installer-r2.txt` SHA256 `e1b744c269707fed37d1aaa1216f63c7724e5b517780d9f07a0f20cac5d37587`
- `FINAL-REGRESSION-RESULTS.json` SHA256 `5a39ec7e118b17f4eed270eb8377cacf27d27e4dd40b46acdc910a6dc8dadaaa`
- `installer-r3.txt` SHA256 `0107d77c2f99d78cc82b94bf7f8dc4ad62c3632df6fcfa1ad54b271c95a0a7c9`
- `cleanup-focused.txt` SHA256 `6cff31bf629da20721aa28bf97c46a604597916012e84cb2cc255b22c07c420f`
- `plan-schema.txt` SHA256 `dc18918341e3d8ec88ab57d464c38fb287717b3dfe95b1f2472ee29295b0dca1`
- `TEST-ONLY-AMENDMENT.json` SHA256 `943f40ca4360eba4e73f0c98f3b094dbd508dacd458fb1a85aecb9dba5af5c8a`
- `TEST-REVIEW-PREFLIGHT.json` SHA256 `2d34ad7d783b4cd410c3b5360a0c6398f85b0af5d6258953d4cbe45fb139fac0`
- `TEST-REVIEW-PATH-REPLY.json` SHA256 `7bb5b390e8cec4b4215f061e01163f4c55b042114636b0fd0b9e9580d449007f`
- `TEST-REVIEW-ACCEPTANCE.json` SHA256 `e6d602c1c12024d84e77fbd8d2e67e50aab0563cf15bf08b2613e8aa464eadd3`
- `FINAL-SOURCE-BINDING.json` SHA256 `c4b2650583dacaa3098715a7773401e45c28f19dae4102eaa7ff68e39aa1e069`

The release owner independently installed the identical RPC source into both runtime copies and verified6/6 each. Installation proof: `/home/jackberrow/.local/state/clarity-orchestration/2026-09-15/orchestration-efficiency/runtime-install/20260915T183009Z/INSTALL-RESULT.json`, SHA256 `6cb1c91a6b210216cdfb42b639f6c2ae028c107a1d4b7167b237814fe555ace8`. This publication makes no runtime installation or active-worker mutation. Normal PR/check/conflict verification and authorized merge remain the publication step; record the resulting remote commit in the external publication receipt. No force/admin merge, broad installer, new gate or policy waiver is part of this work.
