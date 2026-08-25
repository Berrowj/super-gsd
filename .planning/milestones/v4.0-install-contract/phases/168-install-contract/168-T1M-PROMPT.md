# Three spec-review fixes. MINIMAL scope. A previous attempt was reverted for over-reach.

## Read this first: what was reverted and why

A previous attempt at these same three findings built an entire transactional installer
sandbox: `--prepare-installer-stage`, `--seal-installer-stage`, `--apply-installer-stage`,
`--discard-installer-stage`, with the installer re-executing itself inside a staged copy.
It was 1,458 lines, was cut short three times, and ended with `install.sh` exiting 0 while
delivering nothing at all. It has been reverted.

DO NOT rebuild that. No installer-wide staging. No self re-execution. No new
`--*-installer-stage` CLI modes. If you find yourself adding a stage lifecycle to
install.sh, stop: that is the reverted design.

The current tree is the known-good baseline, verified by the orchestrator just now:
a real `install.sh --init-project` from a different cwd into an empty project exits 0 and
delivers 17 hooks and 9 `scripts/lib` modules. Guard 13/13 and install-contract 3/3 both
pass here. Your job is to keep all of that true while fixing three findings.

## Finding 1, CRITICAL — rejection-capable steps run after the first write

Spec review, with citations it verified:

> The dispatcher publishes project bytes before global/init/update dispatch
> (install.sh:1195). Rejection-capable work follows: `ensure_gsd_base` can reject after
> publication (install.sh:479); update preflights existing hooks afterwards
> (install.sh:1018); settings, npm, repair and Codex registration then perform unjournaled
> writes and may fail (install.sh:1021, install.sh:1048).
> The guard now explicitly asserts this incorrect `publication < global dispatch` ordering
> (guard:1460).

Fix by MOVING CHECKS EARLIER, not by staging writes. Concretely: run the
rejection-capable checks that currently sit after publication before the first
destination write instead, so that by the time anything is written the install has already
decided it will proceed. Keep it to reordering plus, where genuinely necessary, splitting
one existing function into a check half and a write half.

If some check truly cannot run before the first write, do not invent machinery: say so
explicitly in your report, name the check, and explain why. A short honest limitation is
a better outcome than the reverted design.

Then correct the guard assertion at :1460 so it requires the CORRECT order and fails if a
rejection-capable step is reintroduced after the first write. Do not delete it.

## Finding 2, HIGH — the loadability classifier can accept a load failure

> `boundedLine` flattens stdout/stderr (preflight:43) and the anchored classifier's final
> `.*` accepts arbitrary trailing diagnostics (preflight:75), so
> `[id] blocked: reason\nError: failed to load` is ACCEPTED.

Fix: a clean policy decision must be the WHOLE of the output, not a prefix followed by
error-shaped trailing content. Keep one shared classifier; fix it once.

## Finding 3, MEDIUM — laundering in both directions

> The module branch DISCARDS the real output and synthesizes `Cannot find module
> '<request>'` (preflight:50). Non-module output is flattened and disclosed up to 2048
> bytes with no stack-frame sanitisation.

Fix: preserve the real bounded message in every branch, and sanitise stack frames rather
than dumping them.

## Hard limits on this dispatch

- Touch only the three allowlisted files.
- Do not add new CLI modes.
- Do not change the closure computation, the manifest generation, or the
  prepare/apply candidate flow. They work.
- Never weaken or delete a test assertion.
- The P167 witness contract is untouchable.
- Fixture paths contain SPACES.

## Verify, and all four must hold

- Real install from a different cwd into an empty project: exit 0, 17 hooks and 9
  `scripts/lib` modules present afterwards. This is the regression that the reverted work
  broke; check it FIRST and check it LAST.
- `node super-gsd/tests/install-contract/assert-install-contract.cjs` 3/3
- installer-registration-guard `--all` 13/13
- `bash -n super-gsd/install.sh`, `node --check` on every file modified

Sandbox denials: mark DENIED, never report as passing. The orchestrator re-runs
unsandboxed. Do not ask for approval.

Standard block format, max 300 words.
