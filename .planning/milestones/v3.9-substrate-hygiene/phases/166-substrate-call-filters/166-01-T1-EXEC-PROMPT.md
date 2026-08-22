# P166-T1 executor — shared substrate call policy and conformance

You are the implementer for ONE task: P166-T1. Work only on T1. Do not start T2.

## Authority

`.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md`
is PLAN-LOCKED at revision 2 and reviewed GO. Read it in full. Its `P166-T1`
`input_contract` is your specification, its `falsifier` lists what makes this
task fail, and its `stop_rule` tells you when to stop. The plan wins over
anything in this prompt. Do not renegotiate scope, do not "improve" adjacent
code, do not widen the diff.

Read also the plan's `known_deadends` block before writing anything. Each entry
is a decision already made against a tempting alternative.

## Division of labour — read this carefully

You WRITE files. The orchestrator RUNS the spawn-bound verification suites
afterwards, unsandboxed, and reports results back to you if a fix round is
needed.

You may run cheap read-only checks to steer yourself (`node -e`, a single test
file, reading source). Do not attempt to run the full battery as proof of
completion, and do not report a suite as passing unless you actually ran that
exact command and saw its exit code.

## Scope — exactly eleven files

```
super-gsd/scripts/lib/vtp-context-composer.cjs
super-gsd/scripts/lib/vtp-enrichment-gate.cjs
super-gsd/scripts/sgsd-triage-runtime.cjs
super-gsd/schemas/vtp-mcp-input-schemas.v2.json          (new)
super-gsd/agents/sgsd-vtp-enrichment.md
super-gsd/agents/sgsd-board-researcher.md
super-gsd/tools/feature-propagation/audit.cjs
super-gsd/tools/vtp-bridge/classify.cjs
super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs  (new)
super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs
super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
```

Touching a twelfth file fails the task. In particular:
`vtp-mcp-input-schemas.v1.json` and `154-REAL-MCP-EVIDENCE.json` are FROZEN —
byte-unchanged, no exceptions.

## Method — red first

1. Build `assert-vtp-substrate-policy.cjs` as a selectable runner
   (`--case <name>`) and get `caller-coverage`, `executable-emitters`, and
   `substrate-policy-required` FAILING against unchanged production first.
   A test that passes before the fix proves nothing.
2. Then implement the composer gateway, the v2 schema, and the caller changes
   until those three go green.
3. Keep the eight site classifications separate and individually exercised.

## Baseline already captured

The orchestrator ran these before you started; all nine were exit 0. If your
change turns any of them red, that is your regression, not pre-existing drift:

```
assert-mcp-arg-contract --case emitted-args
assert-mcp-arg-contract --case real-evidence (frozen P154 evidence file)
assert-real-triage-runtime --scenario staged-vtp-null-reflection-fallback
assert-real-triage-runtime --scenario vtp-fallback-contained-degradation
assert-real-triage-runtime --scenario staged-vtp-oversized-response
vtp-bridge/classify.cjs --self-test
vtp-context-composer.cjs --self-test
vtp-enrichment-gate.cjs --self-test
kb-triage-shadow/assert-shadow.cjs
```

## Hard constraints

- No new package. No network. No live VTP contact. Never invoke `claude`.
- Tests must use an isolated USERPROFILE/HOME, never the operator's real one.
- Do not raise or bypass `VTP_RESPONSE_MAX_BYTES` in sgsd-triage-runtime.cjs.
- Do not commit. The orchestrator owns the commit seam.
- No emoji anywhere: not in code, comments, test names, or your report.
- No em dashes in anything you write.

## Progress contract

You are being watched by a poller. Emit a single short line to stdout whenever
you finish a meaningful unit, in the form `PROGRESS: <what just landed>`.
Silence for many minutes reads as a hang and gets you killed.

## Report

End with exactly these blocks, nothing before them, 300 words max:

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N (only commands you actually ran)
DEVIATIONS: [plan rule] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
```
