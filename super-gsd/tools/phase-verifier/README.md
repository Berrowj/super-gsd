# @sgsd/phase-verifier

Framework-level phase browser verifier for Super GSD. This is the tool the
orchestrator's **Step 6.6 Frontend Verify Gate** shells out to. It cannot be
fooled by curl-only audits, spinner screenshots, or graceful-404 passes.

## What it does

For the phase you ask about:

1. **Parses `.planning/ROADMAP.md`** to find the phase, its success criteria,
   and the URLs / API endpoints it mentions.
2. **Reads `.planning/config.json`** `browser_verify` block for base_url,
   routes, min_rows_per_route, required_endpoints.
3. **Gate 1 — Tool precondition.** Checks `gsd-browser` is available on PATH.
   If not, looks for `.planning/phases/{NN}-*/TOOL-FALLBACK.md` declaring an
   approved substitute. If neither is found, **HALTS with exit 2**. No silent
   fallback to curl.
4. **Gate 4 — Backend liveness precheck.** `fetch()`s every endpoint in
   `required_endpoints` + every `/api/...` URL found in the ROADMAP phase
   section. Any non-2xx/3xx → writes `BACKEND-NOT-READY.md` and **HALTS with
   exit 2**.
5. **Per-route audit.** For each route in `config.browser_verify.routes`:
   - Navigate via `gsd-browser --session X navigate URL`.
   - Poll for `[data-loaded="true"]` or `[data-empty-reason="..."]` on the
     page root. Times out after `load_timeout_ms` → LOAD_TIMEOUT.
   - Count DOM rows: `[data-row]` first, then `tbody tr` fallback.
   - Capture `screenshots/{slug}.png` via `gsd-browser screenshot`.
   - Capture `evidence/{slug}.har` via `gsd-browser network --format har`.
   - Capture `evidence/{slug}.console.log` via `gsd-browser console --level error`.
   - Fetch the backing API endpoint directly, save `evidence/{slug}.api.json`.
6. **Gate 2 — Evidence artifact verification.** Independently `stat`s every
   file the driver said it created. Screenshot must be > 5 KB. HAR must parse.
   api.json must parse and contain ≥ `min_rows_per_route` rows (unless the
   page explicitly set `data-empty-reason`). Missing or malformed artifacts
   → `UNPROVEN`, no exception.
7. **Per-route verdict:** one of
   - `PROVEN` — every check passed
   - `UNPROVEN` — at least one assertion failed
   - `LOAD_TIMEOUT` — `data-loaded` never appeared
   - `NETWORK_ERROR` — backing API was not 200
   - `CONSOLE_ERROR` — reserved (future)
8. **Report.** Writes `.planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md` with
   a per-route table, the ROADMAP criteria, the evidence manifest, and a
   failure section for every UNPROVEN route with the specific reason.
9. **Deferral ledger.** If the overall verdict is UNPROVEN and the config
   says not to block auto mode, appends an entry to
   `.planning/DEFERRAL-LEDGER.md`.

**Exit codes:**
- `0` — PROVEN. Every route passed every check. Orchestrator marks phase complete.
- `1` — UNPROVEN. At least one route failed. Orchestrator blocks (or bypasses with deferral) per config.
- `2` — BLOCKED. Tool missing, backend unreachable, or config invalid. Orchestrator halts with blocker.

## What projects MUST add

This tool is mechanical by design — it cannot guess. The project must provide
the signals it needs:

### 1. `data-loaded` DOM contract

Every page component's root element must set one of these attributes:

```tsx
// When data has arrived and is rendered:
<div data-loaded="true" data-row-count={items.length}>
  {items.map(row => <Row key={row.id} data-row data={row} />)}
</div>

// When the backend legitimately has no data:
<div data-empty-reason="no-open-orders-for-this-supplier">
  <p>No open orders.</p>
</div>

// While still loading:
<div data-loaded="false">
  <Spinner />
</div>
```

The page is the source of truth for "am I loaded". A page that spins forever
has `data-loaded="false"` and the verifier waits or fails — no clever timer
heuristics.

**`data-empty-reason`** is a contract: if you set it, the verifier accepts zero
rows as intentional. If you set `data-loaded="true"` but render zero rows and
zero `data-empty-reason`, the route FAILS. This is on purpose — it forces
every "empty" state to be explicit.

### 2. `data-row` markers (recommended)

For row counting that survives markup changes, tag every data row:

```tsx
<tr data-row data-row-id={row.id}>
```

The verifier counts `[data-row]` first and falls back to `tbody tr`. Tables
without `data-row` still work but are less robust against layout churn.

### 3. `.planning/config.json` `browser_verify` block

```json
{
  "browser_verify": {
    "enabled": true,
    "base_url": "http://localhost:5173",
    "routes": ["/", "/procurement", "/sales/pipeline"],
    "required_endpoints": ["/api/procurement-data/stock-value"],
    "min_rows_per_route": 1,
    "load_timeout_ms": 15000,
    "approved_fallbacks": ["puppeteer"],
    "frontend_globs": ["src/frontend/**/*.tsx"],
    "fail_on_console_errors": true,
    "fail_on_network_errors": true,
    "block_on_failure_auto_mode": false
  }
}
```

### 4. `gsd-browser` must be installed

- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/gsd-build/gsd-browser/main/install.sh | bash`
- Windows: install in WSL with the same command, then the `gsd-browser.cmd`
  wrapper at `%APPDATA%\npm\gsd-browser.cmd` routes Windows calls to the WSL
  binary. The wrapper is part of this framework.

## Usage

```bash
# Direct invocation (what the orchestrator does)
node super-gsd/tools/phase-verifier/phase-verifier.mjs \
  --project-dir C:/Users/user/project-clarity-erp \
  --phase 89

# Exit codes
echo $?   # 0 = PROVEN, 1 = UNPROVEN, 2 = BLOCKED
```

## TOOL-FALLBACK.md format

When `gsd-browser` is genuinely unavailable and you want the verifier to use
an approved substitute, commit this file to the phase directory:

```markdown
# TOOL-FALLBACK for Phase N

substitute: puppeteer
reason: gsd-browser installation failed on this CI runner (see .planning/logs/browser-install.log)
declared_by: user
declared_at: 2026-04-11
approved_by: user
```

The substitute must be listed in `config.browser_verify.approved_fallbacks`
or the verifier refuses to use it. Silent fallback is the root cause the
tool exists to prevent.

## What this tool will NOT do

- Take a screenshot before `data-loaded` is set. Spinner screenshots are banned.
- Accept an empty JSON array as a pass without an explicit `data-empty-reason`.
- Use `curl` alone to "verify" a page. Curl is only used to save evidence of
  the backing API response, after the browser has already loaded the page.
- Report a verdict without backing artifact files the orchestrator can stat.
- "Gracefully degrade" to a lesser check. It either runs or halts.

## Why the orchestrator calls this, not the `sgsd-browser` skill directly

The skill is a Claude-authored sub-agent — it reasons about pages and writes
prose. This tool is a mechanical verifier — it asserts and fails. Both exist
for different reasons. The orchestrator's Step 6.6 gate uses THIS tool as the
ground truth. The skill is still available for interactive debugging of a
specific UI failure after a gate has blocked.
