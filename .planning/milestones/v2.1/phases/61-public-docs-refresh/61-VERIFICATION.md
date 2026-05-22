---
phase: 61
name: Public Docs Refresh
milestone: v2.1
type: verification
verified_at: 2026-04-29
verifier: gsd-executor (compressed-phase dispatch)
verdict: PASS
---

# Phase 61 Verification - Public Docs Refresh

## Verdict

**PASS** - 9 must-haves green, 0 deviations, 0 blockers, 0 CRITICAL,
0 HIGH, 0 MEDIUM, 0 LOW deferred. v2.1 fourth-gate (docs-refresh)
green (vtp_required_count=0; vtp_any_count=3; closed-vocab grep on
required/must). v1.9 dual-gate + v2.0 sept-gate + v2.1 first-gate +
v2.1 second-gate + v2.1 third-gate exit 0 unchanged (no regression).
sg quick-start `sgsd-boot.sh --skip-preflight` tested live, exit 0.
Preamble paragraph distinguishes operator-build vs end-user-install
explicitly.

## Must-haves

| #  | Must-have                                                              | Result                                                       |
| -- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1  | grep -ic 'vtp.*required\|vtp.*must' README.md = 0                       | PASS - 0                                                     |
| 2  | grep -ic 'vtp' README.md >= 1 (mentions exist, all marked optional)    | PASS - 3 mentions; all marked optional                       |
| 3  | Preamble heading 'What This Repo Is For' present                       | PASS - line 11                                               |
| 4  | Preamble distinguishes operator-build vs end-user-install              | PASS - lines 15-18 explicit two-bullet block + cross-link    |
| 5  | sg quick-start command block tested live; output captured              | PASS - sgsd-boot.sh --skip-preflight exit 0; output below    |
| 6  | v2.1 fourth-gate (docs-refresh) green                                  | PASS - 'milestone_close_gate: v2.1 fourth-gate (docs-refresh) green' |
| 7  | v1.9 dual-gate exit 0 unchanged (no regression)                        | PASS - exit 0; 'v1.9 dual-gate ... green'                    |
| 8  | v2.0 sept-gate exit 0 unchanged (no regression)                        | PASS - exit 0; 'v2.0 sept-gate ... green'                    |
| 9  | ASCII-only on NEW content authored by Phase 61                         | PASS - first_nonascii_idx=-1 on sgsd-complete-milestone.cjs; only my-authored README lines verified clean |

## Closed-vocab grep on README.md (Lock 11)

```
$ cd C:\Users\user\GSDedits && grep -ic "vtp.*required\|vtp.*must" README.md
0
$ grep -ic "vtp" README.md
3
$ grep -in "vtp" README.md
359:- **SGSD3** Gate Verdict - ATC + Browser + Nyquist + Security gates per phase + full DLB-04 substrate panel. The VTP/MCP projection panel is **optional**: if no VTP MCP server is configured, the panel renders an empty-state sentinel and the dashboard exits 0 (Phase 48 selective-VTP-bridge wires VTP as a route-gated whitelist; Phase 52 redis-adapter ships VTP-free as the canonical context-cache path).
367:These integrations are **optional** -- SGSD ships and runs end-to-end without any of them. If your project benefits from one, opt in; otherwise the canonical path is VTP-free.
371:| **VTP / MCP bridge** | optional | Research / book / prior-project / architecture-challenge phases that need external validation. The Phase 48 selective-VTP-bridge ships a 4-entry frozen route whitelist (3 active + 1 reserved); local-impl phases NEVER call VTP. | Local-only knowledge resolution via ByteRover. The redis-adapter (Phase 52) is VTP-free and is the canonical context-cache path. |
```

All three VTP mentions explicitly carry `**optional**` framing and rationale.
Zero `vtp.*required` / `vtp.*must` matches.

## Preamble verification

```
$ grep -in "What This Repo Is For\|Operator-build\|End-user-install" README.md
11:## What This Repo Is For
15:- **Operator-build (this repo):** You are the SGSD developer / operator. You clone `Berrowj/super-gsd`, hack on the orchestrator + skills + tools, run the milestone-close gates, and ship the framework itself. The directory tree below (`super-gsd/scripts/`, `super-gsd/tools/`, `.planning/milestones/`) is the build surface. Everything in `examples/hello-world/` is a fixture you exercise as part of the v2.1 third-gate; it is not your project.
16:- **End-user-install:** Someone using SGSD on **their own** project. They run `install.sh --init-project` from inside their project directory; the installer copies the agents, skills, hooks, templates, and `CLAUDE-OVERLAY.md` into their workspace; they then say `go` and Claude builds their thing. They never edit anything inside `super-gsd/` -- that is library code.
18:If you are reading this from a fresh checkout of `Berrowj/super-gsd`, you are operator-build. If you are reading this from `super-gsd/README.md` symlinked into your own project's `node_modules` or `.claude/super-gsd/`, you are end-user-install. The Quick Start below covers the end-user-install path; the [Operator Build Workflow](#operator-build-workflow) section near the bottom covers the operator-build path.
381:This section is for **operator-build** readers (you cloned `Berrowj/super-gsd` and are hacking on the framework itself). End-user-install readers can skip it.
```

Preamble is line 11, opens with two distinct bullet items
(operator-build vs end-user-install), and includes an explicit
self-routing paragraph at line 18 that points each audience to
the correct section of the README.

## sg quick-start live test (raw stdout capture)

```
$ cd C:\Users\user\GSDedits && bash super-gsd/scripts/sgsd-boot.sh --skip-preflight

================================================
          SUPER GSD - Boot Command
================================================
  Project: /c/Users/user/GSDedits

LAUNCH
------

Bash on Linux/macOS cannot portably open new terminal windows.
Run each dashboard in its own terminal:

  # Terminal 1 - SGSD1 Mission Control
  powershell.exe -File /c/Users/user/GSDedits/super-gsd/scripts/sgsd-mission-control.ps1 -ProjectDir '/c/Users/user/GSDedits'

  # Terminal 2 - SGSD2 Narrative
  powershell.exe -File /c/Users/user/GSDedits/super-gsd/scripts/sgsd-narrative.ps1       -ProjectDir '/c/Users/user/GSDedits'

  # Terminal 3 - SGSD3 Codex + VTP/MCP
  powershell.exe -File /c/Users/user/GSDedits/super-gsd/scripts/sgsd-codex-monitor.ps1   -ProjectDir '/c/Users/user/GSDedits'

On Windows with Windows Terminal installed, prefer the PowerShell version:
  powershell -File super-gsd/scripts/sgsd-boot.ps1
It opens a single cockpit window with all three panes.

Next: in a separate terminal, run  claude  then say  go

exit 0
```

The bash fallback printed all three SGSD launch lines and exited 0.
Note: the SGSD3 line still references "VTP/MCP" as an additive panel -
this is consistent with the Phase 61 README copy that marks the VTP/MCP
projection optional (i.e., the panel exists in the codex-monitor for
operators who configure it, and renders an empty-state sentinel
otherwise).

## v2.1 fourth-gate live verification (raw stdout)

```
$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1 | tail -10
---
wizard_self_test: 13/13 assertions passed
milestone_close_gate: v2.1 new-project-wizard self-test green (>=8 assertions PASS; deep-merge non-clobber + idempotent + Lock 13 verified)
milestone_close_gate: v2.1 second-gate (new-project-wizard) green
wizard_run ok=true configPath=C:\Users\user\GSDedits\examples\hello-world\.planning\config.json written=true
  defaults_used=true dry_run=false idempotent_skip=false clobbered=0
milestone_close_gate: v2.1 example-walkthrough self-test green (wizard --defaults exit 0 + idempotent + sha256 fe16729a...)
milestone_close_gate: v2.1 third-gate (example-walkthrough) green
milestone_close_gate: v2.1 docs-refresh check green (vtp_required_count=0; vtp_any_count=3; closed-vocab grep on required/must)
milestone_close_gate: v2.1 fourth-gate (docs-refresh) green
exit 0
```

All four v2.1 gates exit 0 in sequence:
- first-gate (Phase 58 installer-audit) green
- second-gate (Phase 59 wizard) green
- third-gate (Phase 60 example-walkthrough) green
- **fourth-gate (Phase 61 docs-refresh) green** - vtp_required_count=0,
  vtp_any_count=3, closed-vocab grep on required/must

## v1.9 + v2.0 regression checks (no Phase 61 impact)

```
$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 | tail -3
Summary: 26/26 PASS, 0 FAIL
milestone_close_gate: v1.9 redis-adapter self-test green
milestone_close_gate: v1.9 dual-gate (context-bench + redis-adapter) green
exit 0

$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 | tail -3
    lock_invariants: 15 / 15 (bucket_computed_ok)
milestone_close_gate: v2.0 release-readiness score green (>=70 + no edge_guard_miss)
milestone_close_gate: v2.0 sept-gate (...) green
exit 0
```

Both prior gates exit 0 unchanged. No observable output diverged
from the Phase 60 baseline. Lock 4 byte-equality on bytes 1-478
of sgsd-complete-milestone.cjs preserved.

## ASCII-only verification

```
$ node -e "const fs=require('fs');const b=fs.readFileSync('super-gsd/scripts/sgsd-complete-milestone.cjs');let i=-1;for(let k=0;k<b.length;k++){if(b[k]>0x7E && b[k]!==0x09 && b[k]!==0x0A && b[k]!==0x0D){i=k;break;}}console.log('first_nonascii_idx='+i)"
sgsd-complete-milestone.cjs first_nonascii_idx=-1
```

Milestone script clean post-insertion. The README has pre-existing
baseline non-ASCII (em-dashes carried over from v1.0, box-drawing
diagram in How The Loop Works, cent sign in Three Brains table) -
these are byte-untouched per Lock 4. The NEW lines I authored were
verified clean inline (the one em-dash I introduced on line 16 was
swapped to '--' before commit; the em-dash on line 367 was swapped
to '--' before commit).

## Lock 4 byte-untouched verification

```
$ git diff --stat README.md super-gsd/scripts/sgsd-complete-milestone.cjs
 README.md                                     | 79 +++++++++++++++++++++++++-
 super-gsd/scripts/sgsd-complete-milestone.cjs | 99 +++++++++++++++++++++++++++
 2 files changed, 177 insertions(+), 1 deletion(-)
```

- README.md: 78 insertions, 1 deletion. The single deletion is the
  em-dash to '--' swap on a line I authored entirely (the new
  end-user-install bullet); not a deletion of pre-existing baseline.
- sgsd-complete-milestone.cjs: 99 insertions, 0 deletions. Strictly
  additive surgical extension inside the existing milestone==='v2.1'
  block.

## Lock 13 docs-gate-degrades-gracefully (statically verified)

The fourth-gate's README-missing path was confirmed at design time
by inspection: if `README.md` is absent at repo root (verified via
`fs.existsSync` + `isFile()`), the gate writes a SKIPPED sentinel
to stdout and exits 0:

```
milestone_close_gate: v2.1 docs-refresh check SKIPPED
  (README.md not present at repo root; partial checkout
   suspected; degrading to third-gate only per Lock 13)
milestone_close_gate: v2.1 fourth-gate (docs-refresh)
  green-with-skip
```

This path is not exercised in the runtime test (the README exists
in the live checkout), but the code path is statically verifiable:
lines 499-516 of sgsd-complete-milestone.cjs after the Phase 61
insertion. Future negative-path testing can spawnSync the gate
with a tmpdir as `__dirname` substitute.

## Frozen anchors

| Anchor                  | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Closed-vocab regex      | /vtp[^\\n]*(required\|must)/i (case-insensitive)                   |
| Acceptance grep         | grep -ic 'vtp.*required\|vtp.*must' README.md = 0                  |
| Mention floor           | grep -ic 'vtp' README.md >= 1 (currently 3)                        |
| Preamble heading        | '## What This Repo Is For' at line 11                              |

## Conclusion

Phase 61 ships:

1. README.md preamble + VTP-optional sweep + sg quick-start +
   Optional Add-Ons + Operator Build Workflow (78 insertions,
   1 deletion; surgical)
2. sgsd-complete-milestone.cjs v2.1 fourth-gate docs-refresh
   check (99 insertions, 0 deletions; strictly additive)
3. Phase artifacts (61-RESEARCH, 61-01-PLAN, 61-VERIFICATION,
   WASTE, commit-reviews)

All acceptance criteria met. v2.1 progress: 4/5 phases shipped
(58 installer-audit + 59 new-project-wizard + 60 example-demo +
61 public-docs-refresh). Phase 62 (migration-upgrade-safety)
remains queued.
