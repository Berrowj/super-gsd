# P157-T1 spec-compliance review — raw artifacts, not executor claims

Read only. T1 changes UNCOMMITTED: new files `super-gsd/registry/vtp-services.yaml`,
`super-gsd/tools/vtp-readiness/registry.cjs`,
`super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs`. Use `git status` to confirm
the three-file scope.

Raw artifacts: task P157-T1 in `157-01-PLAN-LOCKED.md` (rev 2); report
`157-T1-REPORT.md`; orchestrator verification: registry-contract 39/39 exit 0.

Check against the contract, in order:
1. SECRETS ABSOLUTE: the registry must carry env NAMES only — scan vtp-services.yaml
   for any value/default/url/uri/host/endpoint/credential content or embedded host
   scalars. Any real-looking value is CRITICAL. Loader reason codes must never echo
   rejected values — check the code paths, not just the tests.
2. Facts exact per contract: six env names; vtp-kb + jcl-internal/jcl-products/qmd;
   ~/.vtp/ canonical vs kb-data mirror; pending-ledger.jsonl; ingest.lock
   single-writer; Qdrant JS 1.18.0; bge-base-en-v1.5; sentence-transformers/torch
   never-upgrade; dist/cli.js + src/ under ~/Voice-Text-Plan/.
3. Red honest: does the test actually generate bad-sentinel registries in temp and
   assert stable reason codes? Any sentinel value echoed anywhere is a finding.
4. Loader: pinned js-yaml, duplicate-key rejection, home-expanded paths, no logging
   of values.
5. Scope: exactly three files; nothing else touched.

Output, contract lines first, then max 120 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass | fix_required | blocked
REQUIRED_FIXES: none | <numbered>
```
