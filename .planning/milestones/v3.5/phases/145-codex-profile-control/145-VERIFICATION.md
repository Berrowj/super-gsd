# P145 Verification — codex-profile-control

provider: openai-codex (gpt-5.5/xhigh) via codex-exec.sh --step phase-verify
dispatch_1: 2026-08-06T00:06Z, timeout-tier custom:420 → exit 5 (timeout) —
verifier burned budget re-running self-test suites inside the Codex sandbox
where subprocess spawn/write is EPERM-restricted (false FAILs 15/21; host-side
runs are 21/21 green). Raw stream not retained (1.3MB); key evidence excerpted
below. Verdict normalized by orchestrator from the verifier's own live probe.

status: gaps_found
goal_achieved: partial

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

gaps: GAP-1 (above)
DEVIATIONS: dispatch_1 codex_timeout (budget spent on in-sandbox self-test
reruns); in-sandbox EPERM false-FAILs recorded as environment, not defect.
ONE_LINER: Core delivery verified structurally + 4/4 host self-tests, but
TTY guard env-var bypass (GAP-1 CRITICAL) blocks close until fixed.
