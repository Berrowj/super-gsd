SUCCESS: The process with PID 41608 (child process of PID 33048) has been terminated.
SUCCESS: The process with PID 46132 (child process of PID 33048) has been terminated.
SUCCESS: The process with PID 24208 (child process of PID 33048) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/tools/mesh-memory/run-self-test.cjs b/super-gsd/tools/mesh-memory/run-self-test.cjs
index 0000000..0000000 100644
--- a/super-gsd/tools/mesh-memory/run-self-test.cjs
+++ b/super-gsd/tools/mesh-memory/run-self-test.cjs
@@ -113,7 +113,7 @@ function main() {
     assert(evidenceRows.some((row) => row.body && row.body.evidence_status === 'VERIFIED_CRIT'), 'live ledger includes VERIFIED_CRIT evidence verdict');
     assert(evidenceRows.some((row) => row.body && row.body.evidence_status === 'REFUTED_CRIT'), 'live ledger includes REFUTED_CRIT evidence verdict');
     assert(evidenceRows.some((row) => row.body && row.body.decision_basis === 'fixture_path_in_real_data_check'), 'live ledger includes fixture guard verdict');
-assert(seed[6].lineage.parents.every((parent) => seed.some((row) => row.key === parent)), '7th seed CMB lineage parents exist in ledger');
+    assert(seed[6].lineage.parents.every((parent) => seed.some((row) => row.key === parent)), '7th seed CMB lineage parents exist in ledger');
 
     const passed = results.filter((result) => result.ok).length;
     assert(passed >= 30, 'self-test assertion floor is at least 30');
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/run-self-test.cjs (modified)
VERIFICATION: assertion already checks parents exist anywhere in seed ledger; patch normalizes its indentation inside main()
DEVIATIONS: read-pack already contained the requested relaxed assertion, so no behavior-changing edit was needed
BLOCKERS: <none>
ONE_LINER: Keep the relaxed 7th-CMB lineage assertion and align it with surrounding self-test assertions.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack
