# P145 Verification — codex-profile-control

provider: openai-codex (gpt-5.5/xhigh) via codex-exec.sh --step phase-verify
dispatch_1: 2026-08-06T00:06Z, timeout-tier custom:420 → exit 5 (timeout) —
verifier burned budget re-running self-test suites inside the Codex sandbox
where subprocess spawn/write is EPERM-restricted (false FAILs 15/21; host-side
runs are 21/21 green). Raw stream not retained (1.3MB); key evidence excerpted
below. Verdict normalized by orchestrator from the verifier's own live probe.

status: passed (post-fix re-verification 2026-08-06; see "GAP-1 resolution")
goal_achieved: yes

## Evidence

- Registry + resolver + shell shim + skill exist; commit c1ebae3.
- Host-side self-tests 2026-08-06 (post-reboot), all exit 0:
  1. codex-executor.sh --self-test → direct+cmd dry-run parity PASS
  2. codex-pro run-self-test.cjs → 21/21
  3. sgsd-codex-control.sh --self-test → PASS
  4. codex-exec.sh --self-test --skip-network → Probes 1–6 PASS
- In-sandbox self-test FAILs (15/21) are sandbox artifacts: `CreateFileMapping
  ... Win32 error 5`, `EPERM ... codex-profile-resolution-log.jsonl`. Not
  code defects.

## Gap found (verifier live probe, reproduced by orchestrator at source)

**GAP-1 (CRITICAL): TTY guard env-var bypass.** `profile-resolver.cjs:506`
treats `SGSD_CODEX_CONTROL_TTY_OK=1` (plain environment variable) as
equivalent to an interactive TTY in `assertCliMutationGuard`. Any
non-interactive process that sets the env var and supplies the predictable
confirm phrase can `--set-cli ... danger-full-access`. Verifier probe:
with env var set + missing registry path, resolver proceeded to registry load
(ENOENT) — guard bypassed; negative control without env var refused with the
guard message. Corroborating: `selfTestCliGuard` deletes the env var before
probing (the bypass is known-avoided in tests, not closed), and
`options.ttyOk` has zero callers. This is CRIT-2 (TTY guard bypass)
incompletely fixed — the guard moved into the resolver but kept an
attacker-controllable escape hatch, violating the phase invariant
"danger-full-access cannot be set non-interactively".

## GAP-1 resolution (commit 92a6096)

Codex executor fix (gpt-5.5/xhigh): guard now passes only on
`confirm === phrase && process.stdin.isTTY && process.stdout.isTTY` — env-var
trust and dead `options.ttyOk` removed; control script drops the env prefix
(legit path inherits the operator's real TTY); `selfTestCliGuard` gains a
regression assertion (env var set + correct phrase + no TTY → refuse,
registry unchanged). Evidence, host-run 2026-08-06:
- Verifier-specified bypass probe → exit 1, refusal message, registry
  byte-identical (was: guard bypassed).
- run-self-test.cjs 21/21 · sgsd-codex-control PASS · codex-executor parity
  PASS · codex-exec Probes 1–6 PASS.
- Spec review (Codex): SPEC_VERDICT pass, no missing reqs, no extra scope.
- Per-dispatch ATC (Codex): 0 CRITICAL, 1 WARNING (test-robustness, deferred).

gaps: none (GAP-1 fixed + regression-guarded)
DEVIATIONS: dispatch_1 codex_timeout (budget spent on in-sandbox self-test
reruns); in-sandbox EPERM false-FAILs recorded as environment, not defect;
spec-review wrapper exit 6 = contract-vocab mismatch (SPEC_VERDICT vs 5-line
ATC contract), report itself valid; DEFERRED-A: tighten selfTestCliGuard to
force non-TTY child + env restore in finally (ATC WARNING, joins DEVIATION-1
finalize-probe simplification follow-up).
ONE_LINER: P145 goal verified — profile registry + control skill live, both
CRIT invariants now hold behaviorally incl. GAP-1 env-var bypass closed with
regression guard; 2 deferred test-robustness follow-ups.
