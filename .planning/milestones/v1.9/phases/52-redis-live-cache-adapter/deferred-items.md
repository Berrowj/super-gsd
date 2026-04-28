
## T4 deferred: redis-adapter.cjs file size (2364 lines vs PLAN T4 stop_rule target <= 750)
- Inherited from T1+T2+T3 baseline (1870 lines pre-T4) - bootstrap selfTest harness inlined per original T1 contract.
- T7 contract explicitly resolves this: "replace selfTest body with require() of redis-adapter.test.cjs" - moves all A/B/C/D/E/F group assertions into a sibling test file.
- T4 increment alone is +494 lines (helpers + 2 public API bodies + 4 F-group self-tests). Within scope; deferred to T7 for the file-size unwind.
- Date: 2026-04-28; Lock 4 + Lock 11 + Lock 13 + REDIS-LOCK-04 all hold.
