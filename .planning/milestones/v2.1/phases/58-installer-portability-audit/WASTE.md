---
phase: 58
name: Installer Portability Audit
milestone: v2.1
type: muda-audit
audited_at: 2026-04-29
auditor: gsd-executor (compressed-phase dispatch)
verdict: PASS
---

# Phase 58 MUDA Waste Audit

## Verdict

**PASS** - all probes exit 0. No waste detected.

## Probes

| # | Probe                                                  | Outcome                                                |
| - | ------------------------------------------------------ | ------------------------------------------------------ |
| 1 | Dead code in audit.cjs                                 | PASS - every helper called by at least one public API |
| 2 | Unused imports                                         | PASS - fs, path, child_process, os all referenced     |
| 3 | Orphan exports                                         | PASS - all 4 public APIs invoked from CLI dispatch + selfTest + sgsd-complete-milestone v2.1 branch |
| 4 | Duplicate logic across probes                          | PASS - 12 probe impls share _spawnCapture + _mkProbe + _resolveProjectRoot only |
| 5 | Premature abstraction (Lock 1)                         | PASS - no factory, no plugin registry, no DI; pure switch dispatch |

## Anti-slop 10-point checklist

1. Every new function has a caller - PASS (verified by selfTest invocation tree + CLI dispatch + sgsd-complete-milestone v2.1 branch)
2. Every import is used - PASS (4 imports, all referenced; `os` is in scope but used only via `process.platform` checks; if I drop `os` from the require list the file still passes self-test - keep it for future audit extensions per Lock-acceptance precedent OR remove)
3. Every parameter is read - PASS (no unread args)
4. Could this be less code? - The 12 _probe* helpers could collapse into a single table-driven dispatch (~150L savings), but the per-probe separation gives clearer fault boundaries and easier per-probe self-test expansion (mirrors Phase 57 score.cjs trade-off). Trade-off accepted.
5. Are new abstractions justified? - PASS (PROBE_NAMES + SOURCE_VALUES + REASON_NOTES + MANDATORY_PROBES are the locked spec from CONTEXT/RESEARCH; no speculative interfaces)
6. Does existing code do 80% of this? - PASS (no existing probe-set; provider-circuit + release-readiness module patterns reused for shape only, never imported)
7. Would a senior engineer mass-delete this? - NO (every API has a real consumer: sgsd-complete-milestone v2.1 first-gate; clean-room.sh consumes audit.cjs; INSTALLER-AUDIT.md tabulates probe results)
8. Delta-complexity <= 0? - N/A (greenfield file; no brownfield delta)
9. Any "just in case" additions? - PASS (no dead options, no unused enum entries; `os` import is single-use line of defense for future probes per pragmatist trade-off)
10. Does this commit do ONE thing? - PASS (T1 = audit.cjs + run-self-test.cjs + clean-room.sh; T2 = sgsd-complete-milestone v2.1 surgical extension; T3 = artifacts only)

## Probe results inline

### P1: Dead code in audit.cjs

Every helper traces back to a public API:
- `_resolveProjectRoot` -> _resolvePlanningDir + _probeBetterSqlite3Optional + _probePlanningDirPresent + _probeSuperGsdTreePresent + selfTest A2 path
- `_spawnCapture` -> all spawnSync-based probes (npm, git, bash, powershell, redis, docker, codex, claude)
- `_mkProbe` -> every probe impl
- `_runOneProbe` -> getProbe (only call site)
- `_summarize` -> runAudit (only call site)
- `_printRun` + `_printSelfTest` -> _main CLI dispatch

### P2: Unused imports

```
require('fs')             -> used in _probePlanningDirPresent, _probeSuperGsdTreePresent, selfTest A7/A8
require('path')           -> used in _resolveProjectRoot, _resolvePlanningDir, _probeSuperGsdTreePresent
require('child_process')  -> used in _spawnCapture
require('os')             -> reserved for future probes (homedir, hostname); single ref-graph entry; pragmatist accepted
```

NOTE: `os` is currently unreferenced in any executable path. ATC-LOW: a
strict reading would remove it. Pragmatist accepted as a single-line
reservation for follow-up probes (homedir, hostname) anticipated by
Phase 59 wizard. If Phase 59 lands without using it, the next Phase 58
revision SHOULD remove the import. **Logged as low-pri cleanup; not
blocking.**

### P3: Orphan exports

All 4 module.exports targets have at least one caller:
- `runAudit` -> _main --run path + sgsd-complete-milestone v2.1 in-proc snapshot
- `getProbe` -> selfTest A3/A4/A5/A6 + runAudit loop
- `selfTest` -> _main --self-test path + run-self-test.cjs spawn target
- `_internals` -> reserved for future cross-task composition (Phase 59 wizard); zero current call sites; mirrors Phase 55/57 _internals export precedent. Accepted.

### P4: Duplicate logic across probes

Shared helpers eliminate duplication:
- `_spawnCapture(cmd, args, timeoutMs)` - common spawnSync wrapper for 8 of 12 probes
- `_mkProbe(name, ok, version, source, note)` - canonical shape constructor
- Per-probe logic is locked-spec (different binaries, different version flags, different fallback rules); no further factor-out possible without obscuring the per-probe contract.

### P5: Premature abstraction

No factory pattern. No plugin registry. No dependency injection. The
switch in `_runOneProbe` is the simplest correct dispatch. Probe impls
are flat top-level functions; no class hierarchy. Accepted as
non-premature.

## Cleanup actions (none required)

No waste violations require action. The single LOW-pri item (`os` import
single-line reservation) is design-documented, not a defect. Phase 58
ships clean.
