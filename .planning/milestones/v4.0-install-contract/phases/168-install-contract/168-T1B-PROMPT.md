# Finish P168-T1. Your dispatch was killed at timeout; the code is written and parses.

Do NOT restart the task or redesign it. Two specific defects remain, both diagnosed by
the orchestrator with reproduction. Fix exactly these.

State of play, verified:
- All 7 files parse; `bash -n install.sh` clean; manifest is valid JSON.
- `computeHookDependencyGraph` WORKS. It finds sgsd-state, gate-evidence-log,
  skill-routing-registry, demand-baseline-ledger, sgsd-intent-classifier, and both the
  witness composer and store. Do not touch the closure computation.
- `assert-install-contract.cjs` case `generated-transitive-manifest` PASSES.
- Case `empty-module-tree-real-install` FAILS.

## Defect 1 — the smoke asserts approval, when it must assert loadability

Reproduced. The candidate smoke fails on this hook:

    super-gsd/tools/codex-hooks/validate-stop-contract.cjs   [Stop/Stop-validate-stop-contract.cjs]

Run by hand with a smoke-style Stop payload it prints:

    [validate-stop-contract] blocked: missing_report      exit 1

That is the hook WORKING. It is a gate: given a Stop payload with no report it blocks, by
design (`process.exitCode = main()` at line 87). T1 widened the smoke from the four-hook
repo overlay to every installed manifest entry, which swept in gate hooks whose purpose is
to exit non-zero on a payload they reject.

The install does not care whether a hook approves a synthetic payload. It cares whether
the hook and its dependencies RESOLVE AND LOAD. That is the whole point of this phase.

Fix: classify the smoke outcome instead of treating every non-zero exit as failure.

- Output matching a module-resolution failure (`MODULE_NOT_FOUND`,
  `ERR_MODULE_NOT_FOUND`, `Cannot find module`) => the install FAILS. This is the class
  P168 exists to catch. Carry request and resolved path as already implemented.
- A non-zero exit that is a clean policy or gate decision => the hook loaded. NOT a smoke
  failure.
- Any other non-zero exit => still a failure, but you MUST surface the real output; see
  defect 2.

Do not hand-maintain a list of which hooks are gates. Classify from the observed failure
signature, not from a list of hook names. A name list is the same staleness trap this
phase exists to remove.

## Defect 2 — the generic branch throws the real message away

`hook-registration-preflight.cjs`, `moduleFailureDetail`:

    if (!/MODULE_NOT_FOUND|Cannot find module/.test(message)) return {
      code: 'HOOK_PROCESS_FAILED',
      request: null,
      path: null,
      message: 'hook process exited non-zero',      // <- the real output is discarded
    };

`message` already holds the bounded real output and is dropped on the floor. That is
exactly the laundering this phase's plan forbids, and it is the third occurrence of this
pattern in this codebase: P167's `safeFailureReason` admitted only
`/^[a-z0-9_:.-]+$/i` and masked real exceptions behind `harness_internal_error`, and the
same shape appeared in the installer refusal path. It cost the operator a full diagnosis
cycle on a live Linux box, and it cost me one just now.

Fix: always carry the bounded real output in `message`. Keep `code` as
`HOOK_PROCESS_FAILED` when the signature is unrecognised, keep `request`/`path` null when
genuinely unknown, but never replace an observed message with a constant.

## Verify

Run and report exit codes verbatim:
- node super-gsd/tests/install-contract/assert-install-contract.cjs  (BOTH cases green)
- node --check on every file you modify

Note that a real end-to-end install spawns bash; if your sandbox denies spawnSync/mkdtemp,
mark it DENIED and say so. The orchestrator re-runs everything unsandboxed and rejects the
change if anything is red. Do not weaken or delete a test case to make it pass. Do not ask
for approval.

Standard block format, max 300 words.
