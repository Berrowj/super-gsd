Code-side fixes are implemented. No commit was created.

```text
FILES_CHANGED: super-gsd/config/repo-settings-overlay.json (modified)
FILES_CHANGED: super-gsd/hooks/sgsd-substrate-invocation-witness.cjs (modified)
FILES_CHANGED: super-gsd/scripts/lib/substrate-invocation-witness-store.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs (modified)
FILES_CHANGED: .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-T5-FIX14-FILES.txt (modified)
FILES_CHANGED: .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-T5-FIX14-REPORT.md (created)
VERIFICATION: changed CJS `node --check`, overlay JSON parse, and `git diff --check` -> exit 0
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0 (37/37)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1 (12 cases passed, including passthrough rejection; nested CLI spawn blocked)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0 (4/4)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 1 (spawnSync node.exe EPERM)
VERIFICATION: hook-manifest-completeness registration guard -> exit 0
VERIFICATION: bundled-overlay-current, hook-distribution-all-types, brokered-substrate-capability -> exit 1 each (spawnSync bash EPERM)
VERIFICATION: PowerShell ten-suite P166 batch -> exit 0
VERIFICATION: staged-vtp-oversized-response -> exit 0
VERIFICATION: classifier 13/13, KB shadow, feature-propagation self-test -> exit 0
VERIFICATION: PowerShell fixture exact-vs-query-marker assertion -> exit 0
VERIFICATION: frozen v1 schema and P154 evidence diff check -> exit 0
VERIFICATION: hook digest pin assertion -> exit 0 (both refreshed to 242e9c15ebd0849722b217028fdd4b059a5b0c2481a841bfe456c328a291a8fe)
VERIFICATION: independent `--verify` -> exit 1 (expected before recapture: hook_source_hash_drift)
DEVIATIONS: [P167-T5 files_touched] The locked files_touched and stop-rule limit T5 to the fixture, capture harness, and generated evidence. Beyond scope: hook, witness store, hook-contract test, witness-correlation test, and repo-settings overlay. The live capture exposed the production response-shape defect; FIX14 required a signed passthrough terminal state, T2 regressions, and refreshed hook pins. Repair retained per operator direction.
BLOCKERS: The orchestrator must run the real `--capture`, refreshed independent `--verify`, full T2/T4, three spawn-bound registration guards, and executable-emitters. This executor did not invoke Claude.
ONE_LINER: `post_passthrough` records unchanged delivery and its reason without satisfying acceptance; bypass now requires fixture acceptance, a non-error result, and no matching witness row, independent of payload exactness.
```
