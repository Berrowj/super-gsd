FILES_CHANGED

- [schema mirror](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/schemas/vtp-mcp-input-schemas.v1.json)
- [runtime shaper](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/sgsd-triage-runtime.cjs)
- [contract test](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs)
- [regression assertions](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs)

VERIFICATION

Preserved RED, unchanged runtime (exit 1):

```text
node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args
[FAIL] mcp__vtp-kb__vtp_route_and_retrieve
  - /context/recent_turns/0 must be object
[FAIL] mcp__vtp-kb__vtp_search_substrate
  - / must NOT have additional property "raw_query"
  - / must NOT have additional property "context"
  - / must NOT have additional property "fallback_reason"
```

GREEN:

```text
[PASS] emitted-args
[PASS] staged-vtp-healthy
[PASS] staged-vtp-null-reflection-fallback
```

Syntax, JSON parse, and `git diff --check` passed.

DEVIATIONS

Test-only Worker fallback added because nested `spawnSync(node)` returns EPERM; it still executes the real CLI entrypoint.

BLOCKERS

None. No commit made.

ONE_LINER

Versioned schemas and a shared emission shaper now make both MCP packets contract-valid without routing changes.
