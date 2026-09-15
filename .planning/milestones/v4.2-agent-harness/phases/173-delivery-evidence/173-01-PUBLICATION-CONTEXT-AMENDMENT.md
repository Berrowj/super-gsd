# 173-01 publication context amendment: upstream profile parity

Status: bounded test-only correction authorized by the publication owner on 2026-09-15; independent focused acceptance required before push/merge. This extends the existing 173 prerequisite test scope. Original RPC implementation, reviewed plan/reports and installed copies remain unchanged.

## Trigger and authority

The isolated master-based publication candidate is 11b1240d770990b9cdcca0360b9e591a60e51999, an exact cherry-pick of accepted f3e89f7677d929387daa261d781122c70a9e3bfb. It preserves upstream a478207d29cedd4c0ce14838ee171460c02e2bfc. Upstream commit 74d5070c72a8eaf0579793e384fc770abe5fdd7f explicitly records Jack's intended executor/review/triage reasoning defaults changing from xhigh to high. The current registry already implements that contract; SHA256 c3573f18eca804b4a733da1662275f88bfd5ca4fc0a46e51a9df519bc25eb223.

Fresh installer verification in this new consumer context caught two stale test expectations: install.test.cjs:193 expects resolver xhigh and:238 expects fake wrapper turn effort xhigh. These are old test assumptions about defaults, not requested explicit overrides. Do not change profiles, routing, models, approvals, sandbox, runtime behavior or installed files to make them pass.

## Exact change

Only super-gsd/tests/codex-worker/install.test.cjs: change the two expected default-effort literals from xhigh to high. Retain strict matching and every model, no-fallback, approval, sandbox, installed-closure and bootstrap assertion. Before hash: a974beeb4ed7e72c4d06d2b952ec95153a85f6228a0ae71533ab8f70b2cf234f. No other source changes are authorized by this amendment. The runtime rpc.cjs remains 032ffd8828a8a8a63e58db1a36636ae8f18088e95b2e4ac8cfce5c460f9545fe.

## Verification and acceptance

Preserve the first MODULE_NOT_FOUND/ENOENT run and the later profile mismatch failure under the external publication evidence directory. Exact-lock npm ci --ignore-scripts --no-audit --no-fund was required only in this fresh worktree's plan-schema dependency directory; lockfile and tracked source remained unchanged.

Use the existing Node 22.22.2 runtime and pinned dependencies. Run node --test super-gsd/tests/codex-worker/install.test.cjs; both tests must pass without skipped cases. Finish the already planned bounded worker cleanup and plan-schema checks. Keep the prior 6/6 RPC proof for byte-identical source; do not rerun RPC/Spec broadly. Run git diff --check and re-hash candidate source, upstream profile and existing evidence.

Request one proportionate independent existing review of only these two test expectation changes and this amendment, using the current registered reviewer profile with its intended high ceiling. Record actual dry-run model/effort, prompt/diff hashes, terminal receipt/report hash/bytes. Do not alter global model settings or active native workers. A changed test hash requires this new evidence; do not claim the old original test proof is equivalent.

After acceptance, commit only the test correction and new scoped publication evidence, preserving all 20 original accepted evidence files. Publish through the isolated branch/normal PR; verify actual checks/conflicts and remote master before recording release. No /opt Git operations, broad installer, direct reset, force/admin merge or paid duplicate review of unchanged RPC design.
