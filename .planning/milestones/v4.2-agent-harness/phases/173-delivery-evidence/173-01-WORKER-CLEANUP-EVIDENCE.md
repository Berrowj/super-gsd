# 173-01 focused worker-cleanup evidence

Owner: `pm-automation.harness.20260915`
Status: **VERIFIED — focused candidate-backed cleanup proof.**

## Immutable source binding

The three candidate files were SHA-256 checked immediately before and after the
focused command; values are identical:

| Path | Before | After |
| --- | --- | --- |
| `super-gsd/tools/codex-worker/rpc.cjs` | `032ffd8828a8a8a63e58db1a36636ae8f18088e95b2e4ac8cfce5c460f9545fe` | same |
| `super-gsd/tools/codex-worker/rpc.test.cjs` | `a6326111742bfe0c91ba3e9906dc2a9ecde820bd14d69f066e831deefe455a52` | same |
| `super-gsd/tests/codex-worker/install.test.cjs` | `a974beeb4ed7e72c4d06d2b952ec95153a85f6228a0ae71533ab8f70b2cf234f` | same |

Relevant unchanged harness inputs: `worker.test.cjs`
`c1a6affe9b4d3fd19e86e95190e26c672e6edd8a1bd4318c75a87dd99d222a14`,
`run.cjs` `0ab821c1245213559fce812ee098e69c96984d085a00cab7b02ece29bcfe0f59`,
and fake App Server fixture `8b0c983c3ba2697a58dc881bfbe08d99e6bd11a7f17179d6f993e81b39b6ec69`.

## Focused execution

Command, from `/home/jackberrow/.config/superpowers/worktrees/super-gsd/harness`:

```text
node --test --test-name-pattern='stopping an adapter cleans up its owned App Server process tree|unacknowledged responses never count and timeout cleanup retains an earlier real failure' super-gsd/tools/codex-worker/worker.test.cjs
```

Toolchain: Node `v24.15.0`; npm `11.12.1`; no model or network request.
Exit 0; Node TAP reports 3 tests, 3 pass, 0 fail, 0 skipped, 0 cancelled,
duration 7,310.763543 ms. The selected concrete cases are:

1. `stopping an adapter cleans up its owned App Server process tree (child)`;
2. `stopping an adapter cleans up its owned App Server process tree (delayed-child)`;
3. `unacknowledged responses never count and timeout cleanup retains an earlier real failure`.

The source contains 16 explicit assertions across these cases: four liveness
assertions over the two process-tree variants and four assertions for each of
three timeout/failure modes. The first two cases wait for the fixture PID file,
assert `mailbox.alive(pid)` before stop, issue the exact worker stop control,
wait 200 ms, then assert the owned child PID is no longer alive. Thus both the
immediate and delayed-child App Server process trees are proven absent after
adapter cleanup. The third case preserves the negative cleanup boundary:
three modes exit nonzero, retain their original failure classification, and
write no native usage observation.

Bounded raw TAP output is
[`173-01-WORKER-CLEANUP-FOCUSED-STDOUT.txt`](173-01-WORKER-CLEANUP-FOCUSED-STDOUT.txt):
SHA-256 `daa9590e8c2918948da6c48e7ff67d4ddee84f632cdd397591ef42b2a659d030`,
416 bytes. No broader worker suite was rerun because these exact existing cases
fully bind the R1 cleanup finding to the unchanged candidate.
