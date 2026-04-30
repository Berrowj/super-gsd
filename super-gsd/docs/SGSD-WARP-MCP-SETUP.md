# SGSD Warp MCP Setup

This guide wires the SGSD MCP server (Phase 69-72, v2.3) into Warp so the
Warp Agent can call read-only SGSD state queries directly. The server is
the canonical bridge between Warp and the SGSD planning state on this
machine.

**Status**: v2.3 read-only + v2.9 extension -- **15 tools**, 7-category
redaction, **47/47 self-test assertions**. Write-capable controlled actions
land separately in v2.7 (Phase 89-90) behind their own contract.

**Independent of any VTP MCP** (the VTP knowledge-graph MCP is unrelated;
both can coexist; they have separate config entries and separate audit logs).

## 1. Overview

The SGSD MCP server speaks raw JSON-RPC 2.0 over stdio. It exposes 15
read-only tools that surface live planning state without ever writing to
disk:

| # | Tool | Purpose |
|--:|---|---|
| 1 | sgsd_current_state | active milestone / phase / last_activity |
| 2 | sgsd_current_phase | detailed view of the active phase |
| 3 | sgsd_milestone_status | per-milestone progress summary |
| 4 | sgsd_watchdog_status | autopilot pulse + last-activity age |
| 5 | sgsd_gate_status | latest gate verdicts (FULL / GATE tier ATC) |
| 6 | sgsd_agent_roster | agents dispatched in active phase |
| 7 | sgsd_codex_status | Codex CLI activity + freshness |
| 8 | sgsd_token_spend | token attribution by role / phase / provider |
| 9 | sgsd_context_bench_status | latest Phase 51 context-bench run |
| 10 | sgsd_latest_commits | recent git history (subprocess-bounded) |
| 11 | sgsd_recovery_packet | 4-block recovery packet (resume command) |
| 12 | sgsd_cockpit_snapshot | one-shot composed snapshot for Warp Agent |
| 13 | sgsd_artifact_links | per-phase ATC-REVIEW / VERIFICATION / WASTE |
| 14 | sgsd_warp_doctor | shells out to warp-doctor; returns 18 probes |
| 15 | sgsd_harness_evolution_status | v2.9 extension: AHE run/component status |

> Tools 1-14 are the Phase 68 frozen contract
> (`SGSD-WARP-MCP-CONTRACT.md`). Tool 15 is the v2.9 Agentic Harness
> Evolution extension; all 15 are exposed by the same `server.cjs`.

Every envelope includes `_redactions_applied` listing the closed-vocab
categories that fired (env_secrets / bearer_tokens / redis_urls /
api_keys_inline / private_kb_paths / unc_paths / onedrive_paths). The
redacted output is what the Warp Agent sees; the audit log lists which
categories triggered without ever exposing the underlying values.

The server is READ-ONLY by construction: zero `fs.writeFileSync`,
`fs.appendFileSync`, `fs.unlinkSync`, `fs.mkdirSync`, `fs.rmSync`, or
`fs.rmdirSync` calls anywhere in `server.cjs`. Self-test A10 enforces by
scanning the source for those banned tokens.

## 2. Install

The server is shipped in-tree at:

```
super-gsd/tools/warp-mcp/server.cjs
```

It has zero runtime dependencies (Node.js stdlib only). On this machine
the canonical absolute path is:

```
C:\Users\jack.berrow\GSDedits\super-gsd\tools\warp-mcp\server.cjs
```

If you cloned the repo elsewhere, substitute that path everywhere below.
Node.js 18+ is recommended (the server uses `child_process.spawnSync`
with timeouts and the global URL parser; both are stable on 18+).

## 3. Warp MCP Config Snippet

Warp reads MCP server definitions from `~/.warp/mcp_servers.json`
(layout subject to Warp version drift; the warp-doctor probe tries
several candidate paths). Create the file if missing and add the SGSD
server entry:

```json
{
  "servers": {
    "sgsd": {
      "command": "node",
      "args": [
        "C:\\Users\\jack.berrow\\GSDedits\\super-gsd\\tools\\warp-mcp\\server.cjs"
      ],
      "transport": "stdio",
      "description": "SGSD read-only state bridge (v2.3 + v2.9 extension, 15 tools)"
    }
  }
}
```

Notes:

- `transport: "stdio"` is the contract. The server speaks JSON-RPC 2.0
  newline-delimited over stdin/stdout.
- `args` must use absolute paths in JSON (Warp does not interpolate
  `~` or `$HOME`). On Windows escape backslashes as `\\`.
- Replace the path with your actual checkout location if not the default
  shown above. The warp-doctor `mcp_config_present` probe will report
  PASS regardless of which exact candidate path Warp uses, as long as
  the JSON file mentions either `warp-mcp/server.cjs` or `super-gsd`.

After saving the file, restart Warp (Cmd/Ctrl+Q then relaunch). On next
launch the Warp Agent will discover the SGSD MCP server and the 15 tools
become available in Agent calls.

## 4. Verify

There are two verification paths.

### 4a. From Warp Command Palette (recommended)

1. Open Warp Command Palette (`Ctrl+Shift+P` on Windows; `Ctrl+P` is
   paste-last). On macOS use `Cmd+Shift+P`.
2. Type `MCP` -- you should see the workflow `SGSD: MCP Self-Test`.
3. Run it. The workflow expands to:

```
cd "C:\Users\jack.berrow\GSDedits"; node super-gsd/tools/warp-mcp/run-self-test.cjs
```

Expected output ends with:

```
warp_mcp_self_test: 47/47 assertions passed
```

Exit code 0 on full pass. The 47 assertions cover:

- Frozen vocab (TOOL_NAMES len=15, ERROR_CODES len=13, MATCHER_TYPES
  len=4, REDACTION_CATEGORIES len=7).
- Dispatcher Lock-13 (unknown tool, null args, malformed JSON).
- JSON-RPC envelopes (parse error -32700, invalid request -32600,
  method not found -32601).
- READ-ONLY invariant (banned-token scan).
- ASCII-only source.
- Matcher engine (literal / contains / regex / exists).
- 15 live tool dispatches against the real `.planning/` tree (includes
  the v2.9 `sgsd_harness_evolution_status` extension).
- 35 fixture-pair assertions (28 status fixtures + 7 redaction fixtures).
- 7 per-category redaction fires plus Lock-13 on bad input plus negative
  case (no-trigger envelope yields `[]` applied list).
- Recovery-packet specific assertions (under-4kb size, roadmap-complete
  why-stopped, context-warning levels, hard-500k branch).

### 4b. From terminal directly

```
cd C:\Users\jack.berrow\GSDedits
node super-gsd/tools/warp-mcp/run-self-test.cjs
```

Same output. Use this when iterating on the MCP server itself or when
Warp is not running.

## 5. Probe with warp-doctor

The Phase 67 warp-doctor includes probe 15 (`mcp_config_present`) which
was upgraded in Phase 72 from a NOT-APPLICABLE placeholder to a real
check. Run:

```
node super-gsd/tools/warp-doctor/check.cjs --project "C:\Users\jack.berrow\GSDedits"
```

Expected probe 15 status:

- **PASS** -- a file exists under `~/.warp/` (or `~/AppData/Roaming/...`)
  whose body mentions `warp-mcp/server.cjs` or `super-gsd`. Evidence
  field is the matched file path.
- **MISSING** -- no such config found. The evidence field points back to
  this document with an actionable hint:
  `no MCP config found at standard ~/.warp/ paths; see super-gsd/docs/SGSD-WARP-MCP-SETUP.md to configure`.

Use `--json` for the structured envelope (probes[14] is the MCP entry).

## 6. Troubleshooting

### Server doesn't start in Warp

- Symptom: Warp Agent reports "MCP server `sgsd` failed to launch".
- Probable cause: Node.js not on PATH, or path to `server.cjs` is wrong.
- Fix: Test the same `command + args` from a terminal. The server should
  print nothing when invoked without `--self-test` (it waits on stdin).
  If `node` is not found, install Node 18+ and ensure it's on PATH.

### Tools not discoverable from Warp Agent

- Symptom: Agent says "I don't have a tool to query SGSD state".
- Probable cause: MCP config saved but Warp not restarted, OR the JSON
  is malformed.
- Fix: `node -e "JSON.parse(require('fs').readFileSync('<config-path>','utf8'))"`
  to validate the JSON. Then fully quit Warp and relaunch.

### Self-test fails "READ-ONLY invariant"

- Symptom: A10 reports a banned `fs.*Sync` token in `server.cjs`.
- Fix: This means a write operation was introduced into the server.
  Revert the offending change. The server must remain read-only; write
  paths land in the v2.7 controlled-action contract, never here.

### Self-test fails a redaction fixture

- Symptom: A33-A39 fail, or a fixture under `_redaction/` mismatches.
- Fix: A pattern in `REDACTION_RULES` was edited and no longer matches
  the synthetic STATE.md trigger in the corresponding fixture's
  `_synthetic_planning_*` dir. Either fix the regex or update the
  fixture trigger to match the new vocabulary. The 7 categories
  themselves are frozen by contract; do not add or remove categories
  without a separate plan.

### VTP MCP confused with this MCP

- Symptom: Agent calls `sgsd_*` but sees `vtp_*` errors, or vice versa.
- Fix: The two are independent. Both can be configured side-by-side in
  `mcp_servers.json` under different server keys. The SGSD entry should
  always have key `sgsd` and `args` pointing at this repo's
  `warp-mcp/server.cjs`. The VTP entry has a different command path.

### subprocess_failed / subprocess_timeout from tool 14

- Tool 14 (`sgsd_warp_doctor`) shells out to `check.cjs` with a 10s
  timeout. If the doctor probe takes longer (slow disk, antivirus
  scanning), tool 14 returns a degraded envelope with
  `error_code: subprocess_timeout`. The 13-entry ERROR_CODES vocab now
  includes both `subprocess_failed` (spawn error / non-zero exit) and
  `subprocess_timeout` (deadline) so the operator can distinguish.
- Run `node super-gsd/tools/warp-doctor/check.cjs` directly to bypass
  the timeout and inspect the underlying issue.

## 7. VTP-Optional Disclaimer

This MCP is independent of any VTP (knowledge-graph) MCP server. The
SGSD MCP only reads `.planning/`, `.warp/workflows/`, and the local git
log. It never queries `.brv/`, `.brv/private/`, or any external VTP
substrate.

If you have a VTP MCP configured separately, both servers can coexist.
The redaction layer in this MCP includes a `private_kb_paths` category
that scrubs any incidental `.brv/private/...` references from string
output (e.g. paths embedded in commit messages or STATE.md last_activity
fields). The categories are listed in
`super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` Section "Redaction Rules".

If you do not run a VTP MCP, you do not need to do anything else --
SGSD MCP is self-contained.

## 8. Forward to v2.4

v2.4 Phase 76 ships the cockpit-state adapter, which consumes redacted
SGSD MCP outputs (specifically `sgsd_cockpit_snapshot`) and renders the
operator cockpit from the live MCP envelope rather than scraping
`.planning/STATE.md` directly. The contract this MCP ships in v2.3 is
the input contract for that adapter.

The redaction layer carries forward unchanged: any string that
`_redactObject` walked in v2.3 will be redacted identically when the
v2.4 cockpit reads it. New redaction categories require a separate
contract amendment phase (the closed-vocab `REDACTION_CATEGORIES`
frozen array is the unit-of-truth).

v2.7 Phase 89-90 will introduce a SEPARATE write-capable MCP contract
with its own permission tiers, audit log, and operator-confirmation
gates. That contract MUST NOT extend this read-only contract; it ships
as a new MCP entry under a different server key.

## 9. References

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` -- frozen contract (Phase 68).
- `super-gsd/tools/warp-mcp/server.cjs` -- implementation.
- `super-gsd/tools/warp-mcp/run-self-test.cjs` -- self-test entry.
- `super-gsd/tools/warp-mcp/fixtures/_redaction/` -- 7 redaction fixture pairs.
- `super-gsd/tools/warp-doctor/check.cjs` -- 16 probes including probe 15
  (mcp_config_present).
- `.warp/workflows/sgsd-mcp-self-test.yaml` -- Warp Command Search entry.
