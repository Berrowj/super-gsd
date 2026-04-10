---
name: sgsd-overwatcher
description: "Signal map visualization. Scans .planning/ architecture, detects collisions/dead-ends/overlaps, renders interactive HTML dashboard."
argument-hint: "[start | scan | status | open]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
Project architecture visualization using the railway signal metaphor.
Scans .planning/ directory, builds dependency graph, detects issues,
renders interactive HTML signal map.

Commands:
- `start` — Scan, render, and start HTTP server (live view)
- `scan` — Scan and render to file only (no server)
- `status` — Show last scan stats
- `open` — Open the last generated signal map in browser
</objective>

<process>

## scan (default) — Generate Signal Map

```bash
# Run the overwatcher launcher
node ~/.claude/get-shit-done/templates/super-gsd/overwatcher-launcher.js
```

This will:
1. Read `.planning/` directory → GraphModel (phases, plans, files, dependencies)
2. Run analysis detectors (collision, dead-end, overlap, parallelism)
3. Render interactive HTML signal map
4. Write to `.planning/overwatcher/signal-map.html`

Report the results:
```
Signal Map Generated
  Nodes: {N} | Edges: {N}
  Phases: {complete}/{total}
  Plans: {complete}/{total}
  Collisions: {N}
  Dead Ends: {N}
  File: .planning/overwatcher/signal-map.html
```

## start — Scan + Serve

```bash
node ~/.claude/get-shit-done/templates/super-gsd/overwatcher-launcher.js --serve --open
```

Starts HTTP server on localhost:3333 and opens in browser.
Server re-reads the HTML file on each request for live updates.

## status — Last Scan Stats

```bash
cat .planning/overwatcher/signal-map.html 2>/dev/null | grep -o 'Generated: [^<]*' | head -1
```

If file exists: report generation time and stats.
If not: "No signal map generated yet. Run /gsd-overwatcher scan"

## open — Open in Browser

```bash
# Windows
start .planning/overwatcher/signal-map.html

# macOS
open .planning/overwatcher/signal-map.html

# Linux
xdg-open .planning/overwatcher/signal-map.html
```

</process>

<integration>
## Auto-Scan After Phase Completion

The orchestrate loop can auto-trigger a re-scan after each phase completion.
Add to `.planning/config.json`:

```json
{
  "overwatcher": {
    "auto_scan": true,
    "serve": false
  }
}
```

When `auto_scan` is true, the orchestrator runs the scanner after Step 10
(Update State) in the loop. Token cost: ~50 tokens (one bash command).
</integration>
