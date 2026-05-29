---
name: feedback-browser-smoke-mandatory
description: Any phase that touches super-gsd/tools/cockpit-sidecar/ or super-gsd/tools/shared/sgsd-design-system.css MUST run browser-smoke.cjs and the verdict MUST be PASS before phase-close. Source-grep SACs do not prove a UI works; only a live HTTP fetch + SSE timing does.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4a157a1d-29d0-4841-943b-2a1902e5d255
---

# Browser-smoke gate is mandatory for any UI phase

**The rule:** No phase that modifies the cockpit UI may close without running
`super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase <N>` and getting
verdict=PASS. The verdict artifact (`.planning/runtime/cockpit-smoke-<N>-verdict.json`)
must be referenced in the phase capsule's `gates.browser_smoke` block.

**Why:** 2026-05-24 / 2026-05-25 incident. P136, P137, P138 all shipped with
79/79 self-test PASS via source-grep SACs (`function renderChrome` declared,
`--page: #F6F7F4` string present, `setInterval=15000` matched). Every SAC was
green. The operator opened `http://localhost:7777/` and the cockpit was
unreadable — dark navy gradient body with dark grey text, no chrome styling.
Source-grep proved code references; the rendered experience was broken.

Operator's words: "the irony that what we are building is a harness with constant
audit gates ... and now here we are and you cannot even get a local host to boot
with our new cockpit because you clearly never checked yourself. it's an absolute
embarresment."

And follow-up: "I cannot stress how important it is it ALWAYS verify via webbrowser,
you need to write this into a gate, its so so so so so important this can never
happen again."

**How to apply:**

1. **Trigger condition** — phase touches ANY of:
   - `super-gsd/tools/cockpit-sidecar/*.cjs`
   - `super-gsd/tools/cockpit-sidecar/*.js`
   - `super-gsd/tools/shared/sgsd-design-system.css`
   - `super-gsd/registry/cockpit-sources.yaml`
   - Anything that affects `renderShell`, `renderHtml`, or the SSE delivery path.

2. **Required gate run** before T6 phase-close:
   ```
   node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase <N> --workspace .
   ```
   - Exit 0 = PASS (phase close permitted).
   - Exit 1 = FAIL (phase MUST NOT close; fix and re-run).
   - Exit 2 = infrastructure failure (treat as FAIL).

3. **Artifact path** (mandatory references in the phase capsule):
   - `.planning/runtime/cockpit-smoke-<N>.html` — the actual served HTML (open in
     a browser to verify visually as part of human review).
   - `.planning/runtime/cockpit-smoke-<N>-verdict.json` — machine-readable verdict.

4. **Phase capsule wiring** — add to `PHASE-CAPSULE.json.gates`:
   ```
   "browser_smoke": {
     "verdict": "PASS",
     "ref": ".planning/runtime/cockpit-smoke-<N>-verdict.json",
     "html_artifact": ".planning/runtime/cockpit-smoke-<N>.html"
   }
   ```
   If `browser_smoke.verdict !== "PASS"`, the phase capsule is invalid and the
   verifier must mark the phase BLOCKED, not PASS.

5. **What the gate checks** (18 mechanical assertions, see browser-smoke.cjs):
   - serve.cjs spawns + binds an ephemeral port.
   - `/snapshot` returns HTTP 200 within 25s.
   - `/` returns HTTP 200 + `<!doctype html>` + `class="chrome"` + 7 section IDs
     + 3 Google Fonts links + `--page: #F6F7F4` inline style + NO dark navy
     gradient (`#08101c`).
   - `/client.js` returns HTTP 200 + parses as valid JavaScript + contains
     `connState` + all 4 chrome renderers.
   - `/snapshot` JSON parses with ≥1 key.
   - `/events` SSE stream delivers ≥1 `: keep-alive` line within 16s (proves
     the 15s ping contract from v3.4 INTENT invariant #10).

6. **What this gate CANNOT prove** (still requires human eyeball pass):
   - Visual hierarchy is correct (Tufte data-ink, etc.).
   - Typography renders in the loaded fonts (font load could 404 silently).
   - The page is operator-comprehensible in the 5-second test.
   - Color contrast meets WCAG.
   - A future v3.5 phase can add Puppeteer + visual-regression snapshots, but
     for now the human review of `cockpit-smoke-<N>.html` is the perceptual
     gate; this script is the structural one.

7. **R20 conformance rule** (binding) — any cockpit-html surface verification
   without `browser_smoke.verdict === 'PASS'` in the phase capsule fails R20.
   Pending wire-in to `conformance-check.cjs` as part of P138.5 or P143.

**Anti-pattern this gate prevents:**

- SACs that grep source for `function renderChrome` and call that "renderer
  exists". The function may exist; the CSS for `.chrome` may not; the page may
  render invisibly.
- SACs that check `setInterval(..., 15000)` is in the source. The interval may
  be declared; the SSE writer may throw before reaching it.
- "All 79 SACs PASS" announcements without ever loading the page in a browser.

**Operator standing instruction:** browser-smoke is non-negotiable for UI work.
Skipping it is a release-blocker, not a discretion call.
