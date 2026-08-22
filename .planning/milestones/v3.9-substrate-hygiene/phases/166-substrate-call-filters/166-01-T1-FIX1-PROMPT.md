# P166-T1 fix round 1 — caller-coverage red

Your previous T1 run was terminated by the host wrapper before you wrote your
report. Eleven files are on disk and the orchestrator ran the full battery
unsandboxed. Seven of eight cases pass. One is red. Fix only that.

## Current state, measured

```
policy --case caller-coverage                  exit 1 FAIL   <-- fix this
policy --case executable-emitters              exit 0 PASS
arg-contract --case substrate-policy-required  exit 0 PASS
arg-contract --case emitted-args               exit 0 PASS
arg-contract --case real-evidence (frozen)     exit 0 PASS
triage staged-vtp-null-reflection-fallback     exit 0 PASS
triage vtp-fallback-contained-degradation      exit 0 PASS
vtp-bridge classify --self-test                exit 0 PASS
```

## The failure

```
AssertionError: unclassified substrate occurrences:
  super-gsd/tools/vtp-bridge/classify.cjs:770
  super-gsd/tools/vtp-bridge/classify.cjs:805

line 770: // Assertion 1 (F1): architecture_challenge -> vtp_search_substrate, 3 results.
line 805: ok('1. F1 architecture_challenge -> vtp_search_substrate (3 results)');
```

Both are declarations/observations inside classify.cjs: one is a comment, one
is a self-test result label. Neither emits a substrate call. Your caller-coverage
grep is finding the tool name in them and refusing to classify them, which is
the gate behaving as designed against an incomplete allowlist.

## Required properties of the fix

The plan's first SAC and the round-2 review both turn on one thing: the
allowlist must not be able to swallow a genuine new caller. So:

- Allowlist entries must be EXACT, anchored to file plus the specific
  declaration text. A blanket rule such as "ignore comments", "ignore any line
  in classify.cjs", or "ignore lines containing ok(" is NOT acceptable. Those
  would let a real caller hide behind a comment or a rename.
- Adding or moving a genuine substrate call must still fail closed. Prove it:
  the case already injects an unclassified occurrence; confirm that injection
  still fails after your change.
- Do not weaken, broaden, or delete any of the eight site classifications.
- Do not silence the assertion, do not lower it to a warning, do not skip it.

If you judge the better fix is to reword those two strings in classify.cjs so
they no longer contain the bare tool name, that is acceptable too, provided the
self-test still asserts the same thing and its output stays meaningful. Choose
whichever is more honest; say which you chose and why in ONE_LINER.

## Scope

Same eleven-file allowlist as before. Realistically this touches
`super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` and
possibly `super-gsd/tools/vtp-bridge/classify.cjs`. Nothing else.

Frozen, byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` and
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji. No em dashes. Never invoke `claude`.

## Verify before reporting

Run at minimum:
```
node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage
node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters
node super-gsd/tools/vtp-bridge/classify.cjs --self-test
```

Emit `PROGRESS: <line>` as you go. Then report, 200 words max:

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which fix you chose and why
```
