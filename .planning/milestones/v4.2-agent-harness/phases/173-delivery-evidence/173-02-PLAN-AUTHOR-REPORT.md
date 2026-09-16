FILES_CHANGED: .planning/milestones/v4.2-agent-harness/phases/173-delivery-evidence/173-02-DELIVERY-EVIDENCE-PLAN.md (created)  
FILES_CHANGED: .planning/milestones/v4.2-agent-harness/phases/173-delivery-evidence/173-02-PLAN-SCHEMA-ISOLATED-STDOUT.txt (created)  
FILES_CHANGED: .planning/milestones/v4.2-agent-harness/phases/173-delivery-evidence/173-02-PLAN-AUTHOR-REPORT.md (created)  
VERIFICATION: `node --test --test-name-pattern='failures, disconnects, oversized frames and permission requests never return successful reports' super-gsd/tools/codex-worker/worker.test.cjs` -> exit 0  
VERIFICATION: `node --test --test-name-pattern='failed and timed-out workers keep wrapper failure codes without reporting success' super-gsd/tests/codex-worker/launch.test.cjs` -> exit 0  
VERIFICATION: `private 0700 plan-schema copy: npm ci; node validate.cjs --plan-file .planning/milestones/v4.2-agent-harness/phases/173-delivery-evidence/173-02-DELIVERY-EVIDENCE-PLAN.md --project-dir "$PWD" --mode write` -> exit 0  
COVERAGE_MAP: 1 missing — worker.test.cjs:141-154 covers cleanup, not dead/no-exit, unrelated-live, or PID reuse.  
COVERAGE_MAP: 2 partial — worker.test.cjs:111-117 rejects failures; :294-300 retains native responses, without joined delivery observation.  
COVERAGE_MAP: 3 partial — worker.test.cjs:101-109, :185-191, :320-326 cover stop/deadlines, not no-change activity, owner scope, or fan-out.  
COVERAGE_MAP: 4 partial — worker.test.cjs:119-139 and :302-310 bind thread/usage, not a new instance observation.  
COVERAGE_MAP: 5 missing — worker.test.cjs:402-409 rejects unacknowledged usage but has no four-field observation.  
COVERAGE_MAP: 6 partial — worker.test.cjs:141-154 proves cleanup only; real-wrapper consumption is untested.  
COVERAGE_MAP: 7 partial — worker.test.cjs:156-167 proves linked workspace identity; Linux fixture portability/Windows gap are not explicit.  
DEVIATIONS: none  
QUESTIONS: none  
ONE_LINER: 173-02 serializes exact Linux worker identity, delivery evidence, adapter-level scope/fan-out, and real-wrapper consumption with an honest Windows gap.
