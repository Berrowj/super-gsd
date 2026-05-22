---
phase: 67
artifact: research
created: 2026-04-29
operator: user
authored_by: orchestrator (Opus, in-session -- see DEVIATIONS in 67-VERIFICATION.md)
---

# Phase 67 -- Research: Warp Doctor Probe Design

## Pattern Source

`super-gsd/tools/upgrade-drift/check.cjs` (Phase 62) is the canonical shape
adopted by Phase 67. Identical structural commitments:

- 4 public APIs Lock-13-wrapped (`runDrift` / `getProbe` / `selfTest` / `_internals` -> `runWarpDoctor` / `getProbe` / `selfTest` / `_internals`)
- Frozen probe-name array + frozen reason-notes + schema versioning
- `run-self-test.cjs` thin spawnSync shell delegating to `--self-test`
- READ-ONLY invariant enforced by selfTest scanning for fs-write tokens
- ASCII-only enforced by selfTest first-non-ascii scan
- Lock-11 indexOf membership on closed enums; no regex/fuzzy matching

This minimises reviewer cognitive load and reuses an already-shipped
pattern. All deviations from the upgrade-drift shape are functional
(different probe set, different domain), not structural.

## Probe Set Provenance

Each of the 16 probes maps directly to a Phase 63 audit finding or a
Warp/SGSD truth file the doctor must verify exists.

| Probe | Source | Phase 63 section / origin |
|---|---|---|
| warp_env_present | env scan | 63-RESEARCH.md B.1 (TERM_PROGRAM=WarpTerminal observed) |
| sg_command_defined_in_profile | profile grep | 63-RESEARCH.md A.1 (sg defined in profile lines 86-122) |
| sgsd_command_defined_in_profile | profile grep | 63-RESEARCH.md A.1 (sgsd defined in profile lines 15-66) |
| sgsd_setup_command_defined_in_profile | profile grep | 63-RESEARCH.md A.1 (sgsd-setup at lines 124-167) |
| warp_workflows_dir_present | filesystem | 63-RESEARCH.md D.1 (5 yaml files present) |
| warp_workflows_yaml_shape | yaml lite-parse | 63-RESEARCH.md D.2 (4/5 OK; sgsd-token-current.yaml has the structural keys, just lacks `arguments:` block which is a different shape concern -- doctor checks the structural keys name+command+tags) |
| warp_md_present | filesystem | 63-RESEARCH.md A.1 (referenced) |
| agents_md_present | filesystem | Phase 65 deliverable c0201af |
| claude_md_present | filesystem | repo invariant |
| launch_config_dir_present | filesystem | 63-RESEARCH.md C.1 (~/.warp/launch_configurations/ exists empty) |
| warpindexingignore_present | filesystem | 63-RESEARCH.md E.1 (currently MISSING; doctor confirms) |
| warp_install_present | filesystem | 63-RESEARCH.md B.3 (~/AppData/Local/Programs/Warp/Warp.exe) |
| claude_cli_resolvable | which/where | 63-RESEARCH.md A.3 |
| codex_cli_resolvable | which/where | 63-RESEARCH.md A.3 |
| mcp_config_present | placeholder | v2.3 Phase 68+ forward-reference |
| codebase_context_state | manual-check sentinel | 63-RESEARCH.md E.2 / WARP-SMOKE row Q10 |

## Key Design Decisions

### D1 -- Profile-grep instead of PowerShell-spawn for sg/sgsd/sgsd-setup

**Why**: The doctor must run from any context (Node CLI, future MCP server,
cockpit polling). Spawning PowerShell to evaluate `Get-Command sg` adds
~500ms per call and would fail in non-interactive contexts (where the
profile isn't loaded -- exactly the false-NOTFOUND case Phase 63 documented
in section A.1).

**How**: Read `$PROFILE` directly via `fs.readFileSync` and grep for
`function sg {` / `function sgsd {` / `function sgsd-setup {`. Standard
PowerShell 5.1 profile location candidates (including the OneDrive-redirected
path actually in use on this machine) are checked in order. Cross-platform:
returns NOT-APPLICABLE on non-Windows hosts (`process.platform !== 'win32'`).

**Trade-off**: doesn't catch the case where `function sg {` is commented
out but the file otherwise loads. Mitigation: regex anchors require
beginning-of-line; commented lines start with `#`. Acceptable false-pass
risk.

### D2 -- Lite YAML shape check instead of full YAML parser

**Why**: SGSD has no `js-yaml` dependency. Adding one for shape-checking
5 small yaml files is overkill. The doctor needs to verify name/command/tags
exist, not validate against a full Warp workflow schema.

**How**: Regex match `^name:\s` / `^command:\s` / `^tags:\s` at column 0
on each `.warp/workflows/*.yaml`. Full structural conformance (arguments
block presence, tag content validity, command parameterisation) is a Phase
64 concern, not a doctor concern. The doctor reports shape, not semantics.

**Trade-off**: would pass yaml that's syntactically broken in non-trivial
ways (e.g., bad indentation). Acceptable: that's a workflow author's bug
to find via Warp itself, not the doctor's job.

### D3 -- Codebase Context as MANUAL-CHECK-REQUIRED sentinel (no false PASS)

**Why**: Operator brief Rule 14 -- "If a Warp UI fact cannot be proven
from terminal, record it as MANUAL-CHECK-REQUIRED rather than pretending
it passed." Codebase Context indexing state is exposed only via Warp UI
(agent context settings panel). The doctor must NOT pretend to verify it.

**How**: probe always returns
`{status:'MANUAL-CHECK-REQUIRED', reason:'manual_check_ui_bound'}` with
evidence pointing at MANUAL-CHECKS.md M5. Operator records the result there.

### D4 -- MCP config probe as NOT-APPLICABLE placeholder

**Why**: v2.3 Phase 68+ ships the MCP server. Probe must exist now to
document the forward-reference, but cannot test something that doesn't
exist yet.

**How**: probe always returns
`{status:'NOT-APPLICABLE', reason:'not_applicable_v2_3_not_shipped'}`.
Phase 72 (the MCP setup phase per roadmap) will need a follow-up edit
to upgrade this probe to a real check.

### D5 -- Banned-token list constructed via concatenation (avoids self-match)

**Why**: First draft of selfTest A8 had a literal `const banned = ['fs.writeFileSync', ...]` — but the source file scanning for those tokens then matched its own banned-list definition. Caught immediately by self-test FAIL.

**How**: A8 builds banned strings via concatenation:
```javascript
const FS = 'fs.';
const banned = [
  FS + 'write' + 'FileSync',
  FS + 'append' + 'FileSync',
  ...
];
```
The literal tokens never appear in this file's bytes; the scan correctly
finds zero hits when source is clean. Documented as a deliberate trick
in the file's PURPOSE comment block.

### D6 -- Exit code semantics

**Why**: The doctor diagnoses; humans fix. It must not abort the calling
process when probes fail. But it should signal "something is wrong" so
CI / cockpit pollers can react.

**How**:
- Exit 0 if no MISSING probes (PASS / NOT-APPLICABLE / MANUAL-CHECK only)
- Exit 1 if any MISSING (actionable, but doctor still completes its run)
- Exit 2 only if Lock-13 catches an envelope-level error

This mirrors upgrade-drift's exit semantics.

## Findings From Live --Run On This Checkout

```
PASS: 13/16 probes
MISSING: 1 (warpindexingignore_present)
MANUAL-CHECK: 1 (codebase_context_state)
NOT-APPLICABLE: 1 (mcp_config_present)
DEGRADED: 0
exit=1
```

The single MISSING (`warpindexingignore_present`) is the canonical Phase 63
finding E.1 -- this confirms the audit. Once a `.warpindexingignore` is
authored (deferred to a follow-up phase), this probe will return PASS and
the doctor will exit 0 (or only the MANUAL-CHECK row will keep it at 1).

The yaml shape probe returned PASS for all 5 workflow files -- this is
correct because the structural keys (name/command/tags) are present in
all 5. The `sgsd-token-current.yaml` `arguments:`-block defect from Phase
63 is a Phase 64 concern, not a doctor probe.

## Forward References

- Phase 64: `arguments:`-block validation (deeper YAML shape than the
  doctor performs).
- Phase 65 follow-up or new ignore-pack phase: author `.warpindexingignore`,
  flipping probe 11 to PASS.
- Phase 72 (v2.3): upgrade probe 15 (`mcp_config_present`) from
  NOT-APPLICABLE placeholder to a real check once MCP server ships.
- Phase 96: if M2/M3 fail -- direct claude detected, sg-launched not --
  the upstream Warp issue is a wrapper-command-detection request,
  reproducible via this doctor's probe table as evidence.

## Implementation Note

Phase 67 was orchestrator-authored at Opus rather than dispatched to a
gsd-executor sub-agent at Sonnet. Reason identical to Phase 65 D1: source
pattern (upgrade-drift) and probe set (Phase 63) were already loaded in
orchestrator context this session. The check.cjs file mirrors Phase 62's
structure verbatim where applicable. Logged as DEVIATION in 67-VERIFICATION.md.
This is the second instance of this deviation in the auto-run; per
67-CONTEXT.md D67.9 a third would warrant operator review.
