---
schema_version: 2
phase: 163
slug: fleet-page
milestone: v3.8-fleet-cockpit
status: PLANNED
revision: 2
governing_decision: .planning/milestones/v3.8-fleet-cockpit/phases/163-fleet-page/CONTEXT.md
depends_on: ['162-01']
intent: >
  Deliver the dependency-free Fleet Cockpit page as a responsive three-column
  read-only view over the committed fleet service, preserving explicit
  no-data, conflict, cache-age, failure-retention, and non-executable resume
  semantics in both file and HTTP use.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
hard_stop: >
  After P163 implementation and verification, exit at milestone-partial and
  stop. Do not plan, dispatch, or modify Phase 164 or Phase 165 until the
  operator evaluates steps 1 and 2 and explicitly says go.
semantic_acceptance_criteria:
  - input: >
      The committed attention, running, stale, and idle lane snapshots are
      built through the production cache and fetched from a real ephemeral
      createFleetServer instance, then the exact marker-delimited production
      rail renderer is invoked with that fixture fleet response. The test
      proves the renderer calls compareLaneRows and inspects every emitted lane
      for its fixture status, headline, and age.
    expected_outcome: 'Left rail lists all lanes, sorted by the precedence in section 7'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-data-contract && node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-sort-comparator && node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-render-structure'
  - input: >
      The committed attention fixture, whose latest ATC gate verdict is failed
      and whose derived roll-up headline is gate failed, is returned by the
      production /api/fleet endpoint.
    expected_outcome: 'A lane with a failed gate shows red, and the reason is readable without clicking'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-data-contract && node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-render-structure'
  - input: >
      The committed noise-tokens-absent and noise-gates-empty fixtures beside
      numeric zero values are fetched through production detail responses and
      passed through the exact marker-delimited production value formatter.
      Its returned text and CSS class are asserted for the fixture-derived
      no-data value and for numeric zero.
    expected_outcome: 'No data and zero are visually distinct everywhere they can occur'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-data-contract && node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-render-structure'
  - input: >
      The committed projection-conflict fixture is returned from
      /api/lane/projection-conflict with objective_conflict derived beside the
      unchanged twelve-section snapshot, then that exact fixture object is
      passed to the marker-delimited production conflict renderer and its
      visible output is asserted field by field.
    expected_outcome: 'A lane with projection_stale shows both milestone values and the confidence'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-data-contract && node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-render-structure'
  - input: >
      The page is loaded from the production server and directly from its
      index.html file while source constraints inspect every asset reference.
    expected_outcome: 'Renders with no network access beyond the service itself'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-http-delivery && node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-source-constraints'
  - input: >
      The operator documentation is inspected for an explicit, still-manual
      phone-over-LAN procedure with observable viewport, selection, scrolling,
      cache-age, and service-only network checks.
    expected_outcome: >
      The phone-over-LAN criterion remains an operator-owned manual check and
      is never reported as an automated pass.
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-manual-checks-documented'
manual_acceptance_criteria:
  - criterion: Usable on a phone over the LAN
    authority: operator
    evidence_location: super-gsd/docs/FLEET-COCKPIT.md
    close_condition: >
      The operator performs the documented run-home procedure on a real phone
      and records the result. Source tests prove only that the procedure is
      complete and honestly labelled manual.
known_deadends:
  - Do not add React, Vue, Svelte, a component library, npm, package.json, a bundler, transpilation, a build command, or any remote asset.
  - Do not change the /api/fleet or /api/lane/:name JSON shapes, reshape snapshot, or move derived fields inside snapshot.
  - Do not fetch every lane detail during a fleet poll; /api/fleet is the five-second poll surface and /api/lane/:name is fetched only when selection changes.
  - Do not blank the rail, selected detail, raw snapshot, or cache-age value after a failed fleet or detail fetch; retain the last good render and add a visible banner.
  - Do not turn null, undefined, absent sources, empty live gates, or degraded sections into zero, pass, success, or an empty-success presentation.
  - Do not resolve projection_stale by choosing either projection; show the effective and STATE.md values, source, and confidence side by side.
  - Do not render resume_command as a run action, button, link, form submission, eval path, process call, or command dispatch; it is inert selectable text only.
  - Do not add a generic static file server or accept path-derived filenames; serve only the three allowlisted page paths with fixed files.
  - Do not enable wildcard CORS; file debugging may receive Access-Control-Allow-Origin null only when the request Origin is exactly null.
  - Do not use a live browser, Chromium dependency, claude process, live Clarity checkout, or fabricated phone result on this box.
  - Do not touch Phase 164 or Phase 165 files, add the Omnigent embed, or add event emission in this phase.
tasks:
  - id: P163-T1
    type: dependency-free-fleet-page-and-static-delivery
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/fleet-cockpit/public/index.html
      - super-gsd/tools/fleet-cockpit/public/app.js
      - super-gsd/tools/fleet-cockpit/server.cjs
    input_contract: >
      Implement against the exact committed P162 contracts. /api/fleet returns
      ok, schema_version, ts, root, cache_age_seconds, counts, and roll-up lanes
      with name, path, branch, status, headline, phase, phase_name,
      last_activity_ts, age_minutes, conflict, degraded, plus error_code/error
      for an error row. /api/lane/:name returns ok, name, status, reasons,
      cache_age_seconds, derived agents/tokens/gates/artifacts and
      objective_conflict beside the exact adapter envelope under snapshot.
      snapshot.data has exactly now, objective, unlock, blockers, agents,
      codex, gates, tokens, artifacts, staleness, harness_evolution, and
      resume_command. Treat an HTTP 200 detail with ok false as displayable lane
      error data, not as a transport failure.

      Create index.html as a complete ASCII HTML5 document with all CSS inline
      and only one local defer script, ./app.js. Declare the house palette
      verbatim as CSS custom properties: paper #f6f7f8, ink #202629, muted
      #647076, line #d8dee1, panel #ffffff, teal #147a74, blue #315f90, amber
      #b27622, green #4f7f45, red #aa4a43, and violet #6a5b8f. Use an inline
      system UI stack headed by Segoe UI and a technical stack headed by
      Cascadia Mono. Add no link, image, font, stylesheet, module, telemetry,
      or other remote asset URL.

      Use semantic landmarks and a desktop grid with a fixed-width left rail,
      a flexible centre, and a right raw-data rail. The left rail is first in
      document and visual order and each lane row always exposes a status dot,
      lane name, one-line headline, and age without opening the lane. Map
      attention and error to red, running to teal, stale to amber, and idle to
      green. Mark selection with aria-current and keep keyboard focus visible.
      At a narrow viewport, collapse to one column in the same rail-centre-raw
      order, use at least 44px lane targets, contain long technical text and the
      pre block rather than introducing page-wide horizontal overflow, and do
      not hide the cache-age indicator.

      In app.js use an ASCII strict-mode IIFE, browser APIs only, and no module
      loader. Give pure, marker-delimited compareLaneRows, renderLaneRail,
      formatValue, and renderObjectiveConflict helpers stable names so T2 can
      extract and execute the exact production functions. The production DOM
      path must call these same helpers; do not keep a test-only renderer or
      formatter. Keep their render output independent of DOM globals so the
      test runner can execute it before the browser call site mounts it.
      compareLaneRows applies attention, running, stale, idle precedence, treats
      service status error as attention-equivalent so broken lanes cannot sink
      out of sight, then orders parseable last_activity_ts newest first, null or
      malformed activity last, and lane name by deterministic ASCII comparison
      as the final tie-breaker. renderLaneRail must directly invoke
      compareLaneRows and emit one row for every input lane with visible status,
      headline, and age. Do not use locale-dependent sorting.

      Render six primary centre tiles from snapshot.data: now, objective,
      blockers, gates, tokens, and staleness. Render the remaining six adapter
      sections as collapsed secondary details: unlock, agents, codex,
      artifacts, harness_evolution, and resume_command. Keep all twelve section
      names visible or discoverable even when their value is absent or
      degraded. Centralize scalar and count presentation so null/undefined or a
      derived state no_data becomes the literal No data with a muted/dashed
      no-data treatment, while numeric 0 becomes the literal 0 with a normal
      numeric zero treatment. Test nullishness explicitly; never use truthiness
      to select between no data and zero. Gates with derived state no_data must
      not say passed, and tokens.source absent with raw total_tokens 0 must use
      derived tokens.state/value and render No data. formatValue must return
      both the visible text and its CSS class so the production caller and T2
      can prove that No data and 0 use distinct classes.

      When snapshot.data.objective.projection_stale is true, render a labelled
      conflict block in the objective tile. It shows the effective
      milestone/phase and source beside state_md_milestone/state_md_phase and
      effective_confidence from detail.objective_conflict, with nulls shown as
      No data. renderObjectiveConflict must receive that production detail
      object and emit this labelled visible output through formatValue. Never
      select or relabel one side as authoritative. Render
      blockers and failed gate verdicts with readable text and red state, not
      colour alone. Render resume_command.command only as an inert code line
      with user-select all, tabindex 0, and an explanation that the cockpit
      never executes commands. Do not use a button, anchor, onclick execution,
      clipboard auto-write, eval, Function, WebSocket, or process-like API.
      The right rail is a pre element containing JSON.stringify(snapshot, null,
      2); null stays visibly No data rather than becoming an empty panel.

      Keep cache age in a permanently mounted header element initialized as
      Cache age: No data and update it from each successful /api/fleet response
      without coercing zero to missing. Poll only /api/fleet every 5000ms. Fetch
      /api/lane/:name only when initial/hash/user selection changes and encode
      the name with encodeURIComponent. Preserve the selected lane across fleet
      refreshes when it still exists; otherwise select the first sorted row.
      Parse and write #/lane/:name with URI encoding and respond to hashchange
      so a copied deep link selects the lane. Ignore a hash for a lane not in
      the current roll-up and fall back safely.

      Maintain lastFleet and lastDetail as last-good state. A rejected request,
      non-2xx response, malformed JSON, or invalid fleet envelope displays a
      role=alert banner identifying fleet or lane failure but does not clear or
      replace any last-good rail, centre, raw pre, selected name, or cache age.
      Clear the banner only after the corresponding later success. Prevent
      overlapping fleet polls and stale detail responses from replacing a newer
      selection. When opened over HTTP, use same-origin API paths. When opened
      from file:, use exactly http://127.0.0.1:7777 as the service base; this is
      the only absolute URL permitted in page source.

      Extend createFleetServer without changing any JSON API body. Serve only
      GET / and GET /index.html from public/index.html and GET /app.js from
      public/app.js, with fixed filenames, correct UTF-8 content types, the
      existing cache-age header, nosniff, and no-store. Reuse node:fs and
      node:path already allowed by P162; add no require. Do not decode or join a
      request path into a filesystem path. For a request whose Origin header is
      exactly null, add Access-Control-Allow-Origin: null and Vary: Origin so
      direct file debugging can read the loopback API; never emit wildcard CORS
      or reflect any other origin. All routes remain GET-only and cache-only;
      page reads cannot discover, refresh, build, or write.
    output_contract: >
      The production entrypoint serves an immediately usable Fleet Cockpit at
      its root while preserving every P162 API contract. The page has the exact
      house theme, responsive rail-first three-column layout, twelve honest
      adapter sections, raw snapshot pre, deterministic sorting, five-second
      roll-up polling, selection-only details, cache age, deep links, and
      last-good failure retention. Direct file opening uses only the loopback
      service. Resume text is selectable but has no execution surface.
    hypothesis: >
      A small semantic HTML shell and explicit browser-state renderer over the
      stable fleet/detail contracts can make the lane rail useful at a glance
      without a framework, build system, data reshaping, or write control.
    falsifier: >
      The production root does not serve the page; a request-derived path is
      read; an API response shape changes; file mode targets anything but
      loopback; wildcard CORS appears; a palette value or section is absent;
      the rail does not lead on desktop or phone; sorting violates precedence
      or recency; an error lane is hidden; a failed gate reason requires lane
      selection; zero looks like No data; absent evidence looks successful;
      projection conflict hides a value or confidence; resume is actionable;
      detail is fetched for every lane or every poll; cache age disappears;
      an error blanks last-good state; a remote request or dependency appears;
      source is non-ASCII; or T1 touches a file outside the three listed paths.
    stop_rule: >
      Stop when app.js passes node --check, all three touched files are ASCII,
      the page contains the exact palette and twelve section keys, a direct
      read confirms no remote asset or execution surface, existing P162 fleet
      tests remain green, the diff is limited to the three listed paths, and T1
      is one independently revertable commit. T2 supplies the contractual page
      fixture tests before phase completion.
    verification_cmd: >
      node --check super-gsd/tools/fleet-cockpit/public/app.js &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs
    expected_ATC_tier: GATE
  - id: P163-T2
    type: fleet-page-contract-tests-and-manual-runbook
    agent: codex
    model: codex
    depends_on: ['P163-T1']
    files_touched:
      - super-gsd/tools/fleet-cockpit/run-self-test.cjs
      - super-gsd/docs/FLEET-COCKPIT.md
    input_contract: >
      Work in the existing dependency-free selectable runner and reuse the
      committed lane fixtures; do not create browser snapshots or alter fixture
      evidence to make the page pass. Add page-http-delivery,
      page-data-contract, page-sort-comparator, page-render-structure,
      page-behaviour-structure, page-source-constraints, and
      page-manual-checks-documented to CASES and therefore to all. Tests may use
      Node built-ins already present in the test-only runner, temporary
      directories, and real loopback HTTP. They must not launch claude, install
      a browser, contact the network, or discover the live checkout.

      Add a page fixture helper that creates temporary eligible lanes named for
      attention, running, stale, idle, noise-tokens-absent,
      noise-gates-empty, projection-conflict, and build-error; supplies their
      committed envelopes through the real createFleetCache with the real
      deriveLaneStatus and a fixed clock; publishes details; and serves the
      real createFleetServer on 127.0.0.1 port 0. Clean up the server, cache,
      and temporary root in finally paths. page-data-contract fetches
      /api/fleet and selection-only /api/lane/:name endpoints and proves every
      property named by T1 exists at its real location, snapshots retain all
      twelve sections, tokens/gates no-data derivations sit beside unchanged
      raw zero/empty evidence, projection conflict contains both value pairs
      and confidence, cache_age_seconds accepts zero, and the failed-gate lane
      has attention plus a readable headline in the roll-up.

      page-http-delivery requests /, /index.html, and /app.js from that real
      ephemeral server. Assert status 200, exact disk bytes, HTML/JavaScript
      UTF-8 content types, X-Content-Type-Options nosniff, Cache-Control
      no-store, and X-SGSD-Cache-Age-Seconds. Repeat one API request with Origin
      null and assert the exact null allow-origin plus Vary, then send an
      untrusted origin and assert it is neither reflected nor replaced by *.
      Re-run existing API, read-only method, error-shape, and structural load
      cases so static delivery cannot weaken P162.

      page-sort-comparator extracts only the marker-delimited production
      compareLaneRows helper from app.js, compiles that exact function in the
      test process, and runs a table containing shuffled attention, running,
      stale, and idle rows; same-status timestamps in reverse order; null and
      malformed activity; equal timestamps; and an error row. Assert the four
      contractual groups, newest-first within a group, deterministic ASCII name
      ties, and attention-equivalent visibility for error. Do not copy a second
      comparator into the test.

      page-render-structure extracts and compiles the exact marker-delimited
      production renderLaneRail, formatValue, and renderObjectiveConflict
      helpers from app.js; it must execute them, not substitutes copied into
      the test. Feed renderLaneRail a deliberately shuffled copy of the real
      /api/fleet fixture response, prove its production body directly invokes
      compareLaneRows, and assert the rendered order plus every fixture lane's
      name, status, headline, and age. An empty rail or a renderer that bypasses
      the comparator must fail even when page-sort-comparator passes.

      Execute formatValue with the noise-tokens-absent derived no-data value
      and with fixture numeric 0. Assert exact visible strings No data and 0,
      assert their returned CSS classes differ, and assert both classes have
      their contracted treatments in index.html. Execute
      renderObjectiveConflict with the real projection-conflict detail and
      assert the actual labelled fixture strings Effective milestone: v2.0,
      Effective phase: 156, Source: phase_folders, STATE milestone: v3.0,
      STATE phase: No data, and Confidence: 0.7 all occur in its output. Assert
      the production objective call site invokes this renderer when
      projection_stale is true. Also assert every numeric or count rendering
      path uses formatValue rather than || fallback; failed status and failed
      verdict use red styling plus visible text; all twelve section keys occur;
      raw output targets a pre; and resume_command targets inert code with no
      enclosing button/link/form or execution and auto-clipboard primitive.

      page-behaviour-structure locks the literal 5000ms /api/fleet poll, a
      single encoded /api/lane/ selection path, file versus HTTP API-base
      branch, #/lane/ parse/write and hashchange handling, permanently mounted
      cache-age element and zero-safe formatting, overlapping-poll guard,
      selection request generation guard, and last-good/catch branches. Assert
      failure branches call the banner path but contain no rail/detail/raw/cache
      reset or empty replacement. These are structural assertions because no
      supported browser or DOM implementation exists on this host; label them
      structural and do not claim end-to-end browser execution.

      page-source-constraints proves both page files and the server edit are
      ASCII and app.js passes node --check. Treat file usability as a
      well-formedness contract: one doctype/html/head/body, balanced required
      landmark and pre tags, a relative ./app.js defer script, no module type,
      and the explicit file: loopback API branch. Assert every house-palette
      token and both system stack heads occur; no external link, stylesheet,
      font, image, script, import, require, framework, package, source map,
      service worker, WebSocket, telemetry, or URL exists. Permit only the one
      exact http://127.0.0.1:7777 service literal. Assert server static routing
      is an explicit three-path allowlist rather than a generic path join.

      Extend super-gsd/docs/FLEET-COCKPIT.md with page routes, direct file debug,
      status colours matching the context palette, deep links, five-second
      polling, selection-only detail fetch, cache/failure banner behavior,
      explicit No data versus 0 semantics, conflict presentation, raw JSON,
      and the inert resume-command rule. Add a clearly labelled Manual phone
      over LAN check that tells the operator to start the wrapper with --host
      0.0.0.0, apply trusted-network/firewall controls, browse
      http://<LAN-IP>:7777/ on a real phone, and record device/browser/time and
      result after checking: the lane rail is first and all rows select; status
      dot is not the sole cue; 44px targets work; centre and raw content follow;
      long JSON scrolls inside its region with no page-wide horizontal overflow;
      cache age remains visible; stopping the service leaves the last render
      under a banner; refreshing recovers; the hash deep link restores a lane;
      and the browser network log contains only that service's page assets and
      API calls. Keep the boxes unchecked and state that the self-test verifies
      documentation only; only an operator observation may record PASS.

      page-manual-checks-documented asserts that exact procedure, its unchecked
      operator-owned result, and the no-automated-pass disclaimer remain in the
      docs. It must fail if the docs claim a phone PASS without a separately
      recorded operator observation. The self-test output must distinguish the
      automated source assertions from the pending manual result.
    output_contract: >
      The fleet self-test exercises production HTTP and fixture data while
      source-locking browser behavior that cannot honestly run on this host.
      It proves static delivery, unchanged API contracts, exact production sort
      logic, no-data/zero and conflict branches, offline assets, deep-link/poll
      structure, last-good retention, and the permanently inert resume line.
      Operator docs provide the real phone protocol without fabricating its
      result.
    hypothesis: >
      Combining real cache/server fixture requests with narrow structural
      checks against the exact page source catches contract drift without
      introducing a browser dependency or pretending that source inspection is
      a phone usability test.
    falsifier: >
      A page route is not served byte-for-byte; an API regression is masked;
      the page expects a field absent from a real endpoint; tests duplicate
      rather than extract the comparator; precedence or recency is wrong; No
      data and zero share a branch or style; conflict omits either value pair or
      confidence; a remote or framework token survives; file structure is
      malformed; polling, deep-link, cache-age, or failure-retention structure
      is absent; resume can execute; a structural assertion is reported as a
      browser test; the phone checklist is claimed passed automatically; an
      existing P162 case fails; source is non-ASCII; or T2 touches a file
      outside the two listed paths.
    stop_rule: >
      Stop when all seven new cases are recorded red against the T1 baseline
      where applicable and green after the test/docs work, the complete fleet
      runner and untouched adapter runner exit 0, page files pass syntax and
      ASCII constraints, the diff after T1 is limited to the two listed paths,
      every automated semantic acceptance command exits 0, and T2 is one
      independently revertable commit. Report phone usability as manual and
      unverified unless the operator supplied real evidence. Then enforce the
      phase hard stop at milestone-partial with P164 and P165 untouched.
    verification_cmd: >
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-http-delivery &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-data-contract &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-sort-comparator &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-render-structure &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-behaviour-structure &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-source-constraints &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case page-manual-checks-documented &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs &&
      node super-gsd/tools/cockpit-state/run-self-test.cjs
    expected_ATC_tier: GATE
---

# P163 - Fleet Page

## Revision 2 review provenance

Revised in place after `163-PLANREVIEW-REPORT.md` NOGO round 1 (2 CRITICAL,
3/5 passed). Revision 2 closes only the two stub-satisfiable SAC paths by
executing the production rail, formatter, and conflict renderers against the
committed fixtures; all other reviewed SACs and boundaries are preserved.

Two serial, independently revertable commits deliver handover step 2. T1 adds
the semantic page, browser-state renderer, and the three fixed static GETs that
make the production fleet URL usable over HTTP while retaining direct file
debugging. T2 locks the real endpoint data contract and static source behavior
with committed fixtures, then documents the operator-owned phone check without
claiming to have run it.

## File map

- `super-gsd/tools/fleet-cockpit/public/index.html`: semantic page shell,
  inline house theme, responsive rail-first three-column layout, stable DOM
  targets, and local script reference.
- `super-gsd/tools/fleet-cockpit/public/app.js`: deterministic sorting, fetch
  state, twelve-section rendering, deep links, cache age, last-good failure
  retention, and inert resume text.
- `super-gsd/tools/fleet-cockpit/server.cjs`: three explicit read-only static
  page routes and narrowly scoped file-origin CORS; JSON APIs stay unchanged.
- `super-gsd/tools/fleet-cockpit/run-self-test.cjs`: real ephemeral HTTP/data
  cases plus source assertions for browser-only behavior.
- `super-gsd/docs/FLEET-COCKPIT.md`: page operation and the unclaimed manual
  phone-over-LAN procedure.

## Step-2 acceptance lock

The implementation and verification report must preserve the handover
checklist text and evidence class:

- [ ] Left rail lists all lanes, sorted by the precedence in section 7
- [ ] A lane with a failed gate shows red, and the reason is readable without clicking
- [ ] "No data" and "zero" are visually distinct everywhere they can occur
- [ ] A lane with `projection_stale` shows both milestone values and the confidence
- [ ] Usable on a phone over the LAN
- [ ] Renders with no network access beyond the service itself

The phone row is MANUAL and requires operator evidence.

The first, second, third, fourth, and sixth rows have automated fixture/source
evidence. The fifth row remains manual until a real operator observation is
recorded; documentation presence is not usability evidence.

## Phase exit

After P163 verification, stop and evaluate. Exit milestone-partial even when
all automated checks pass. Leave the gated P164 Omnigent session plane and P165
fleet event emission phases untouched until the operator explicitly continues.
