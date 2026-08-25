Implemented the CRITICAL and both warnings. No commit made; frozen artifacts were untouched.

```text
FILES_CHANGED: super-gsd/tools/substrate-capability-broker.cjs (modified)
FILES_CHANGED: super-gsd/tools/feature-propagation/audit.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs (modified)
VERIFICATION: `node --check super-gsd/tools/substrate-capability-broker.cjs` -> exit 0
VERIFICATION: `node --check super-gsd/tools/feature-propagation/audit.cjs` -> exit 0
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 0
VERIFICATION: `node -e "require('./super-gsd/tools/substrate-capability-broker.cjs')"` -> exit 0
VERIFICATION: `node -e "require('./super-gsd/tools/feature-propagation/audit.cjs')"` -> exit 0
DEVIATIONS: [P167-T4 files_touched] eighth file: super-gsd/tools/substrate-capability-broker.cjs, because invocation-project authority can only be resolved inside the broker runtime, and the plan assigned that file to T1.
BLOCKERS: none
ONE_LINER: Readiness uses the absolute runtime `process.env.CLAUDE_PROJECT_DIR` as its sole invocation-project authority; when absent or invalid, substrate is omitted from `tools/list` and forced `tools/call` requests are denied without upstream transport.
```
