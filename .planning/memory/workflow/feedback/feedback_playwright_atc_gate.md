---
name: feedback-playwright-atc-gate
description: Any phase that touches a UI file MUST run super-gsd/tools/cockpit-sidecar/atc-playwright-gate.cjs --phase <N>; verdict PASS (or SKIPPED-NO-UI-FILES) must be referenced in PHASE-CAPSULE.json gates.playwright_audit. Real-browser audit catches bugs JSDOM browser-smoke + source-grep SACs miss.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4a157a1d-29d0-4841-943b-2a1902e5d255
---

# Playwright real-browser audit is mandatory at ATC Step 6 (Validate) for any UI phase

**The rule:** No phase that modifies a UI surface — cockpit-sidecar/ · shared/sgsd-design-system.css · any `.css` / `.html` / `.js` / `.tsx` / `.vue` / `.svelte` / sgsd-codex-monitor.ps1 — may close without running
`node super-gsd/tools/cockpit-sidecar/atc-playwright-gate.cjs --phase <N>` and getting
verdict=`PASS` or `SKIPPED-NO-UI-FILES`. The verdict artifact
(`.planning/runtime/cockpit-playwright-audit-<N>-verdict.json`) must be
referenced in the phase capsule's `gates.playwright_audit` block (the gate
script prints a paste-ready JSON block at the end of its run).

**Why:** The browser-smoke gate (JSDOM, [[feedback-browser-smoke-mandatory]])
proved necessary after P136/P137/P138 shipped 79/79 source-grep PASS but were
visually broken. The Playwright gate proves necessary one level deeper.
2026-05-26 audit caught three live bugs that JSDOM browser-smoke had been
missing for the entire v3.4 milestone:

1. **SSE event-name mismatch** — server emitted `event: snapshot\ndata:`,
   client used `es.onmessage` (only fires for default-event frames). Cockpit
   was receiving the initial /snapshot fetch but ignoring every SSE push.
   This was the *actual* root cause of operator's "page goes stale unless
   I refresh" complaint — fs.watch was a red herring.
2. **Broadcast race** — `recomputeSnapshot(shouldBroadcast=true)` was being
   coalesced into in-flight `shouldBroadcast=false` recomputes, dropping
   the broadcast flag. Touches landing mid-compute were silently lost.
3. **Descender clipping** — `.mc-id-block` had `overflow:hidden` +
   `line-height:0.88`, clipping ~11px off the bottom of every phase number
   the operator would see on screen.

JSDOM can't catch these because it doesn't run real CSS layout, doesn't
respect real EventSource event-name dispatch, doesn't model real font
metrics. Only a real headless Chromium can.

**How to apply:**
- `cd $REPO && node super-gsd/tools/cockpit-sidecar/atc-playwright-gate.cjs --phase <N>`
- Default behavior: detects UI-file diff since `HEAD~1` + working tree;
  skips automatically if no UI files changed (`verdict: SKIPPED-NO-UI-FILES`).
- For non-cockpit surfaces: pass `--target http://127.0.0.1:<port>` to point
  at any localhost target.
- For an already-running cockpit at port 7777: pass `--target http://127.0.0.1:7777`.
- Force-run regardless of diff: `--force`.
- Paste the printed JSON block into PHASE-CAPSULE.json under
  `"gates": { ..., "playwright_audit": { ... } }`.
- Exit code 0 on PASS or SKIPPED-NO-UI-FILES; 1 on FAIL.

**What it covers (38 checks at 2026-05-26):** page load · 8 sections present
+ content · mission text · architecture SVG + nodes · milestone SVG + pills ·
handover links + health + path-traversal guard · SSE connection / live-update /
conn-tier indicator · uncaught JS errors · console errors · failed HTTP
responses · 4 responsive viewports (no h-scroll) · phase pill click + 6 detail
tabs + tab switch · fonts loaded · color palette · design-token completeness ·
memory mesh SVG · stream-health rows · dead-man's-banner · text overflow
clipping · ARIA live regions · keyboard focus · multi-client SSE concurrency ·
rapid-touch debounce resilience · page-still-alive after all checks.

**Lineage:**
- Browser-smoke gate (P138.5) — JSDOM, 18 checks; caught the v3.4 boot-broken incident.
- This gate (P143.4) — real Chromium, 38 checks; caught what JSDOM couldn't see.
- Both are mandatory; Playwright supersedes neither because browser-smoke
  exercises the JSDOM-renderable subset programmatically and runs in ~25s,
  whereas Playwright runs in ~50s. Both gates run at phase close.
