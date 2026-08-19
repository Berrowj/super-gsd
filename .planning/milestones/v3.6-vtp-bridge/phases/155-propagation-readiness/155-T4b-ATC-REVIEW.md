FINDINGS: 2
CRITICAL: 1
WARNINGS: 1
PASS_RATE: 8/10
ONE_LINER: Partial or heading-only ROADMAP evidence can confidently select an older phase; devcp tests are mildly refactor-coupled.
FINDINGS_DETAIL: [CRITICAL] [correctness] `phase-name.cjs:277,284-286` accepts heading-only ordering and silently drops discovered phases absent from a partial table; `resolve.cjs:496-546` can therefore emit stale phase-folder evidence and a backwards re-sync instead of abstaining.
FINDINGS_DETAIL: [WARNING] [test-quality] `assert-state-resolver.cjs:171-190` asserts directly against helper exports and intermediate arrays; the required winner/no-backwards outcomes are already covered at lines 192-207, so legitimate internal refactors can fail unnecessarily.
