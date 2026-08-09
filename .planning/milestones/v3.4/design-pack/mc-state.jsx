// mc-state.jsx — initial snapshot + simulation engines for the mission control cockpit
// Information architecture organized around the 7 cockpit panels:
//   1. Live Runway   2. Active Mission   3. Architecture Map
//   4. Milestone Map 5. Memory Graph     6. Evidence/Gates   7. Event Tape

const INITIAL_SNAPSHOT = {
  milestone: 'v3.3',
  phase: '135',
  phase_name: 'cockpit-visual-polish',
  generated_at: new Date().toISOString(),

  objective: { milestone: 'v3.3', phase: '135', name: 'cockpit-visual-polish' },
  next_action: { verb: 'approve', target: 'codex plan → dispatch P135-T1', hotkey: 'A' },
  owner: { handle: 'codex/xhigh', secondary: 'operator' },
  risk: { tier: 'attn', label: 'ATTN', reason: '7 dispatches in P132 (over 5)' },
  time_left_sec: 1188,

  // ── 2. ACTIVE MISSION ──────────────────────────────────────────
  mission: {
    phase_id: 'P135',
    phase_title: 'Cockpit Visual Polish',
    objective: 'Match the brief HTML quality bar in the live cockpit',
    why_running: "After P132 shipped the cockpit-sidecar server with minimal text rendering, operator review against `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` flagged a quality gap. P135 closes it.",
    unlocks: "v3.3 milestone close — then P134-T3/T4 resume against the new cockpit.",
    risk_tier: 'attn',
    risk_reasons: [
      'dispatch_count = 7 (operator ceiling 5)',
      'plan re-roll pending operator approval',
    ],
    operator_decision_required: true,
    decision_prompt: 'Approve consolidated P135 plan; dispatch P135-T1.',
    success_criteria: [
      { code: 'SC-1', text: 'client.js renders all 3 cockpit bands via design-system CSS',     status: 'pending' },
      { code: 'SC-2', text: 'sparkline strip renders for fog / dispatches / tokens',           status: 'pending' },
      { code: 'SC-3', text: 'stage pipeline shows status, owner, SLA, blocker per stage',      status: 'pending' },
      { code: 'SC-4', text: 'rationale paragraphs render (no placeholder text)',               status: 'pending' },
      { code: 'SC-5', text: 'self-test holds at 53 / 53 after the edits',                      status: 'pending' },
    ],
  },

  // ── 1. LIVE RUNWAY ─────────────────────────────────────────────
  pipeline: {
    active_index: 2,
    stages: [
      { name: 'research',   owner: 'codex/xhigh',  sla_min: 30, elapsed_sec: 30*60, status: 'done',
        blocking_gate: null, next_action: null },
      { name: 'vtp-enrich', owner: 'vtp-enrich',   sla_min:  5, elapsed_sec:  5*60, status: 'done',
        blocking_gate: null, next_action: null },
      { name: 'plan',       owner: 'codex/xhigh',  sla_min: 20, elapsed_sec:  252,  status: 'active',
        blocking_gate: 'gate.plan.operator-approval',
        next_action: 'operator approves consolidated plan' },
      { name: 'execute',    owner: 'codex/xhigh',  sla_min: 90, elapsed_sec:    0,  status: 'pending',
        blocking_gate: 'gate.execute.dispatch-ceiling',
        next_action: 'plan locked → dispatch P135-T1' },
      { name: 'verify',     owner: 'codex/xhigh',  sla_min: 15, elapsed_sec:    0,  status: 'pending',
        blocking_gate: 'gate.verify.self-test',
        next_action: 'self-test 53/53 must hold' },
      { name: 'close',      owner: 'operator',     sla_min:  5, elapsed_sec:    0,  status: 'pending',
        blocking_gate: 'gate.close.operator-promote',
        next_action: 'operator promotes phase → milestone advances' },
    ],
    blocker: 'gate.plan.operator-approval',
    why_running: 'codex/xhigh planning P135 client.js rewrite — drift in band rendering — ETA ~16m',
    unlocks: 'v3.3 milestone close after P134-T3/T4 resume',
  },

  // ── 3. ARCHITECTURE MAP ────────────────────────────────────────
  architecture: {
    title: 'P135 dataflow',
    nodes: [
      { id: 'orch',     kind: 'actor',  layer: 0, label: 'claude orchestrator',  sub: 'design + planning' },
      { id: 'plan',     kind: 'artefact', layer: 1, label: 'P135 plan artefact',   sub: '135-DESIGN-PACKAGE.md' },
      { id: 'exec',     kind: 'actor',  layer: 2, label: 'codex executor',       sub: 'gpt-5.5 · xhigh' },
      { id: 'src-client', kind: 'source',  layer: 3, label: 'client.js',          sub: 'rewrite · target' },
      { id: 'src-shell',  kind: 'source',  layer: 3, label: 'render-html.cjs',    sub: '::renderShell' },
      { id: 'src-sparks', kind: 'source',  layer: 3, label: 'sparkline.cjs',      sub: 'new helper' },
      { id: 'src-serve',  kind: 'source',  layer: 3, label: 'serve.cjs',          sub: '+attachSparklines' },
      { id: 'tests',    kind: 'gate',   layer: 4, label: 'self-test',            sub: '53 cases' },
      { id: 'audit',    kind: 'gate',   layer: 5, label: 'browser/audit gate',   sub: 'localhost:7777' },
      { id: 'cp',       kind: 'sink',   layer: 6, label: 'checkpoint',           sub: 'ledger.append' },
    ],
    edges: [
      { from: 'orch',       to: 'plan',       label: 'writes' },
      { from: 'plan',       to: 'exec',       label: 'handoff' },
      { from: 'exec',       to: 'src-client', label: 'edits' },
      { from: 'exec',       to: 'src-shell',  label: 'edits' },
      { from: 'exec',       to: 'src-sparks', label: 'creates' },
      { from: 'exec',       to: 'src-serve',  label: 'edits' },
      { from: 'src-client', to: 'tests' },
      { from: 'src-shell',  to: 'tests' },
      { from: 'src-sparks', to: 'tests' },
      { from: 'src-serve',  to: 'tests' },
      { from: 'tests',      to: 'audit' },
      { from: 'audit',      to: 'cp',         label: 'on green' },
    ],
  },

  // ── 4. MILESTONE MAP ───────────────────────────────────────────
  milestone_map: {
    milestones: [
      { id: 'v3.2', label: 'v3.2', status: 'done',    focus: 'phase memory + briefs' },
      { id: 'v3.3', label: 'v3.3', status: 'active',  focus: 'operator comprehension system' },
      { id: 'v3.4', label: 'v3.4', status: 'pending', focus: 'agent autonomy + recovery' },
    ],
    current: 'v3.3',
    phases: [
      { id: 'P128', label: 'P128', status: 'done' },
      { id: 'P129', label: 'P129', status: 'done' },
      { id: 'P130', label: 'P130', status: 'done' },
      { id: 'P131', label: 'P131', status: 'done' },
      { id: 'P132', label: 'P132', status: 'done', note: 'cockpit-sidecar server shipped (minimal render)' },
      { id: 'P133', label: 'P133', status: 'done' },
      { id: 'P134', label: 'P134', status: 'split', sub: [
        { id: 'P134-T1', status: 'done' },
        { id: 'P134-T2', status: 'done' },
        { id: 'P134-T3', status: 'paused', note: 'awaits P135 close' },
        { id: 'P134-T4', status: 'paused', note: 'awaits P135 close' },
      ]},
      { id: 'P135', label: 'P135', status: 'active', current: true, note: 'cockpit visual polish — this work' },
      { id: 'CLOSE', label: 'CLOSE', status: 'pending', note: 'depends on P135 + resumed P134-T3/T4' },
    ],
    unlocks: 'v3.4 (agent autonomy + recovery) starts on milestone close',
    // Per-phase context, surfaced by clicking any chip in the milestone diagram.
    details: {
      'P128': {
        title: 'P128 · Cockpit sidecar bootstrap',
        eli5: "We stood up a tiny server next to SGSD that serves a webpage at `localhost:7777`. The page is empty but the routing and SSE plumbing exists — operators have a place to look.",
        why: "Operators were tailing JSONL logs to know what SGSD was doing. That's not viable at velocity. The sidecar is the seed for an operator UI.",
        context: "First phase of v3.3. Coming off a stable agent loop in v3.2.",
        unlocks: "Every subsequent rendering phase. Without a server there's nothing to render to.",
        outcome: "Server boots; routes resolve; SSE channel open. UI is blank but the channel works.",
        files: ['cockpit-sidecar.cjs', 'serve.cjs'],
        duration: '2h 14m',
        owner: 'codex/xhigh',
      },
      'P129': {
        title: 'P129 · Event stream wiring',
        eli5: "We piped ledger events into the SSE channel so the page can update live. Any time SGSD appends to the ledger, the page sees it within ~200ms.",
        why: "Polling is slow and noisy. SSE gives us push semantics with zero infrastructure.",
        context: "Sits on P128's sidecar. Establishes the data contract we use for the rest of the milestone.",
        unlocks: "Live rendering of any state — without this, every later phase would need its own polling loop.",
        outcome: "ledger.append fires → SSE message arrives at client. End-to-end latency under 200ms.",
        files: ['serve.cjs', 'event-bus.cjs'],
        duration: '1h 48m',
        owner: 'codex/xhigh',
      },
      'P130': {
        title: 'P130 · Ledger query layer',
        eli5: "We built a small query helper that lets the cockpit ask 'what's happening right now' in one call, instead of stitching together raw ledger reads.",
        why: "The cockpit needs a stable snapshot shape. Without this layer every panel would re-implement the same scan.",
        context: "Followed P129. Sets up the JSON shape consumed by the rest of v3.3.",
        unlocks: "P131 (phase state snapshot) builds directly on top of this.",
        outcome: "`getCockpitSnapshot()` returns the full state in one call. Cached for 1s.",
        files: ['ledger-query.cjs', 'snapshot.cjs'],
        duration: '3h 02m',
        owner: 'codex/xhigh',
      },
      'P131': {
        title: 'P131 · Phase state snapshot',
        eli5: "We taught the cockpit how to describe the current phase: which stage, who owns it, how long it's been running, what's blocking. The first 'meaningful' data layer.",
        why: "Operators need to know **what** is happening, not just **that** it's happening.",
        context: "Builds the data primitives later UI work renders against.",
        unlocks: "P132 minimal render uses these shapes directly. So does P134 task split.",
        outcome: "snapshot.pipeline carries owner / SLA / blocker / elapsed per stage.",
        files: ['snapshot.cjs', 'pipeline-state.cjs'],
        duration: '2h 38m',
        owner: 'codex/xhigh',
      },
      'P132': {
        title: 'P132 · Minimal cockpit render',
        eli5: "We shipped a working but ugly cockpit: plain text bands, no design system, no sparklines. It rendered the snapshot — that's the win — and exposed the visual gap that P135 closes.",
        why: "Ship value early. A text-only cockpit beats no cockpit. Catch real operator pain before polishing.",
        context: "Operator reviewed against `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` and flagged the quality gap that became P135.",
        unlocks: "P133 design tokens; P134 content tasks; P135 polish (this phase).",
        outcome: "Live cockpit at localhost:7777 with real data. ~5% of brief quality. Operator feedback drove next phase.",
        files: ['client.js', 'render-html.cjs'],
        duration: '4h 11m',
        owner: 'codex/xhigh',
      },
      'P133': {
        title: 'P133 · Design system tokens',
        eli5: "We extracted the cockpit's colors, spacing, type, and component primitives into `sgsd-design-system.css`. Future phases (P135 etc.) pull from this instead of inventing.",
        why: "Without tokens, every phase invents its own palette. Drift kills the cockpit's coherence.",
        context: "Pre-work for P134 + P135. Necessary before any visual polish.",
        unlocks: "P134 content rendering uses the tokens; P135 polish leans on them heavily.",
        outcome: "12 color tokens, 5 spacing, 3 type roles, semantic state tiers (done/live/attn/severe/crit).",
        files: ['shared/sgsd-design-system.css'],
        duration: '1h 22m',
        owner: 'codex/xhigh',
      },
      'P134-T1': {
        title: 'P134-T1 · North star + alert band',
        eli5: "We built band 1 of the cockpit — the big 'governing thought' line and the top alert. The first piece operators actually read.",
        why: "Operators glance, not read. Band 1 has to land the *one thing* in under a second.",
        context: "First content task of P134 split. Coming off P133 tokens.",
        unlocks: "T2 (pipeline band) and the rest of the content stack.",
        outcome: "Band 1 renders: governing thought, do-next action, top alert with overflow chip.",
        files: ['client.js::renderBand1', 'render-html.cjs'],
        duration: '1h 56m',
        owner: 'codex/xhigh',
      },
      'P134-T2': {
        title: 'P134-T2 · Phase pipeline band',
        eli5: "We built band 2 — the 5-cell pipeline (research → enrich → plan → execute → verify) with status, owner, SLA. The middle layer of the cockpit.",
        why: "Operators need to know *where* in the phase SGSD is, not just *that* a phase is running.",
        context: "Second task of P134 split. Builds on T1's band 1 layout.",
        unlocks: "T3 (telemetry sparklines) and T4 (rationale) plug into the same band-2 region.",
        outcome: "Band 2 shows stage cells with status color, owner, SLA. Hover gives elapsed/remaining.",
        files: ['client.js::renderBand2', 'pipeline-render.cjs'],
        duration: '2h 18m',
        owner: 'codex/xhigh',
      },
      'P134-T3': {
        title: 'P134-T3 · Telemetry sparklines',
        eli5: "We paused this — it depends on P135's design system polish to look right. Will resume after P135 closes.",
        why: "Sparklines without the polished design tokens would just be ugly placeholder charts. Better to do them right.",
        context: "Third task of P134 split, paused awaiting P135.",
        unlocks: "T4 follows. Once T3 + T4 ship, P134 closes.",
        outcome: "Not yet — paused.",
        files: ['(pending) sparkline.cjs', 'client.js::renderBand2'],
        duration: 'paused at 0m',
        owner: 'codex/xhigh',
      },
      'P134-T4': {
        title: 'P134-T4 · Rationale + alarm drawer',
        eli5: "We paused this — it's the deep-dive layer (band 3) and the HMI alarm cause/consequence/action drawer. Needs P135 polish first.",
        why: "Rationale rendering benefits hugely from the typographic system P135 ships.",
        context: "Fourth and final task of P134 split, paused awaiting P135.",
        unlocks: "Closing T4 closes P134, which lets v3.3 close.",
        outcome: "Not yet — paused.",
        files: ['(pending) rationale-render.cjs', 'client.js::renderBand3'],
        duration: 'paused at 0m',
        owner: 'codex/xhigh',
      },
      'P135': {
        title: 'P135 · Cockpit visual polish (now)',
        eli5: "We're rewriting `client.js` to bring the live cockpit up to the brief HTML quality bar. Adds sparklines, status-coloured stage cells, rationale paragraphs. Mission Control aesthetic, semantic alarms, comprehension-first IA. **This is the current phase.**",
        why: "P132's minimal cockpit shipped real value but hit ~5% of the brief's quality. Operator review demanded the gap close before v3.3 milestone close.",
        context: "Lifted to milestone-blocking priority. P134-T3 + T4 paused because they depend on P135's polish to look right.",
        unlocks: "v3.3 milestone close. Then P134-T3 + T4 resume against the new cockpit, then CLOSE gate.",
        outcome: "Pending — currently in `plan` stage. Operator approval expected, then 90m execute SLA.",
        files: ['client.js (rewrite)', 'render-html.cjs::renderShell', 'sparkline.cjs (new)', 'serve.cjs::attachSparklines (new)'],
        duration: 'in flight · 4m 12s into plan stage',
        owner: 'codex/xhigh',
      },
      'CLOSE': {
        title: 'CLOSE · v3.3 milestone gate',
        eli5: "The final gate. Once P135 ships AND P134-T3/T4 resume green AND self-test holds 53/53, the operator promotes v3.3 → CLOSE. v3.4 unlocks.",
        why: "Milestone close is the contract: everything inside this milestone has been proven and shipped.",
        context: "Depends on three predecessors: P135 (now), P134-T3, P134-T4.",
        unlocks: "v3.4 — agent autonomy + recovery.",
        outcome: "Pending all dependencies.",
        files: ['(verification only)'],
        duration: 'gate · not yet open',
        owner: 'operator',
      },
    },
  },

  // ── 5. CONTEXT MEMORY GRAPH ────────────────────────────────────
  // Three memory types: observation (SGSD-emitted fact), claim (agent statement
  // requiring validation), decision (operator/promotion verdict).
  // Claims carry a validation_state: pending | validated | refuted.
  memory_graph: {
    sources: [
      // ── Observations (SGSD-emitted facts) ──────────────────────
      { id: 'obs-tests',   type: 'observation', kind: 'tests',     label: 'self-test',       detail: '`53 / 53` passing · last green 2m ago',                   consumed_by: ['codex', 'claude'], active: true },
      { id: 'obs-commits', type: 'observation', kind: 'commits',   label: 'commit log',      detail: 'P134-T1 + T2 closed; P135 WIP',                          consumed_by: ['claude'],          active: true },
      { id: 'obs-files',   type: 'observation', kind: 'files',     label: 'files changed',   detail: '4 in P135: `client.js` · `render-html.cjs` · `sparkline.cjs` · `serve.cjs`', consumed_by: ['codex'], active: true },
      { id: 'obs-browser', type: 'observation', kind: 'browser',   label: 'browser check',   detail: 'localhost:7777 responding · HTTP 200',                   consumed_by: ['operator'],        active: true },
      // ── Claims (statements requiring validation) ───────────────
      { id: 'cl-review',   type: 'claim', validation: 'validated', kind: 'review',   label: 'P134-T2 review verdict', detail: '"approved with notes" — cross-checked by self-test green', consumed_by: ['claude'], active: true },
      { id: 'cl-quality',  type: 'claim', validation: 'pending',   kind: 'quality',  label: 'cockpit ≥ 80% of brief',  detail: 'codex claim · awaits browser-audit + visual-diff',         consumed_by: ['operator'], active: true },
      { id: 'cl-fog',      type: 'claim', validation: 'refuted',   kind: 'forecast', label: 'fog will rise during plan', detail: 'pre-stage forecast — refuted: fog held 35–42 over 22m',  consumed_by: [],          active: false },
      // ── Decisions (operator / promotion / precedent) ───────────
      { id: 'dec-ceiling', type: 'decision', kind: 'precedent',  label: 'dispatch_ceiling = 5', detail: 'operator precedent · binding · 14 phases ago',         consumed_by: ['codex'],           active: true },
      { id: 'dec-order',   type: 'decision', kind: 'order',      label: 'P135 → P134-T3 / T4',  detail: 'phase order decided · paused tasks resume after P135', consumed_by: ['claude', 'codex'], active: true },
      { id: 'dec-promote', type: 'decision', kind: 'promotion',  label: 'promote v3.3 → CLOSE',  detail: 'recommended; awaits operator decision',                consumed_by: ['operator'],        active: true, pending: true },
    ],
    current_consumer: 'codex/xhigh',
    current_action: 'planning P135 client.js rewrite',
  },

  // Mesh Memory Lite lineage:
  //   execution_receipt → review_finding → evidence_verdict
  //                     → decision_recommendation → promotion_decision
  lineage: {
    title: 'P135 evidence chain · receipt → promotion',
    steps: [
      { id: 'l1', stage: 'execution_receipt',       type: 'observation', label: 'codex tool stream',      detail: '4 file edits · 1 self-test run · 8m elapsed', meta: 'SGSD-emitted', icon: '◼' },
      { id: 'l2', stage: 'review_finding',          type: 'claim', validation: 'validated', label: 'reviewer · "matches spec"', detail: 'codex/xhigh asserts P135 spec compliance', meta: 'agent claim', icon: '✓' },
      { id: 'l3', stage: 'evidence_verdict',        type: 'observation', label: 'self-test 53 / 53 green', detail: 'validates the review claim', meta: 'evidence', icon: '◼' },
      { id: 'l4', stage: 'decision_recommendation', type: 'claim', validation: 'pending',   label: 'recommend · promote P135', detail: 'codex drafts; awaits operator decision', meta: 'claim · pending', icon: '·' },
      { id: 'l5', stage: 'promotion_decision',      type: 'decision', label: 'operator promotes P135',  detail: 'milestone advances on confirmation', meta: 'terminal', icon: '★', terminal: true, pending: true },
    ],
  },

  // ── 6. EVIDENCE / GATES ────────────────────────────────────────
  evidence: {
    last_run_at_sec_ago: 132,
    summary: { green: 5, warn: 2, fail: 0, pending: 3 },
    categories: [
      {
        name: 'TESTS',
        items: [
          { code: 'self-test',   status: 'green',   detail: '53 / 53 passing',                    last_run_sec: 132 },
          { code: 'unit',        status: 'green',   detail: '21 / 21 passing',                    last_run_sec: 132 },
          { code: 'integration', status: 'green',   detail: '8 / 8 passing',                      last_run_sec: 132 },
        ],
      },
      {
        name: 'CODE',
        items: [
          { code: 'lint',        status: 'green', detail: '0 errors / 0 warnings',              last_run_sec: 132 },
          { code: 'typecheck',   status: 'green', detail: '0 errors',                           last_run_sec: 132 },
          { code: 'format',      status: 'green', detail: 'all files conform',                  last_run_sec: 132 },
        ],
      },
      {
        name: 'BROWSER / AUDIT',
        items: [
          { code: 'render',      status: 'pending', detail: 'awaits P135 ship to localhost:7777' },
          { code: 'a11y',        status: 'pending', detail: 'will run on browser stage' },
          { code: 'visual-diff', status: 'pending', detail: 'compares to brief HTML reference' },
        ],
      },
      {
        name: 'AUDIT GATES',
        items: [
          { code: 'gate.context.completeness',     status: 'green', detail: 'context complete · 9 sources loaded' },
          { code: 'gate.plan.operator-approval',   status: 'warn',  detail: 'blocking · awaits operator approve' },
          { code: 'gate.execute.dispatch-ceiling', status: 'warn',  detail: '7 dispatches in P132 (ceiling 5)' },
          { code: 'gate.verify.self-test',         status: 'green', detail: '53 / 53 must hold post-edits' },
          { code: 'gate.close.operator-promote',   status: 'pending', detail: 'depends on verify green' },
        ],
      },
      {
        name: 'REVIEWER',
        items: [
          { code: 'P134-T2 review', status: 'green', detail: 'codex/xhigh · approved with notes · 1h ago' },
          { code: 'P133 review',    status: 'green', detail: 'codex/xhigh · approved · 3h ago' },
        ],
      },
    ],
    unresolved: [
      { code: 'dispatch_count', tier: 'attn', detail: '7 dispatches in P132 (operator ceiling 5)', age_sec: 180 },
      { code: 'plan_approval',  tier: 'attn', detail: 'operator approval required at plan→execute', age_sec: 252 },
    ],
  },

  // Gate flow — five stages, each rolling up the registered gates that fire at that stage.
  // Based on `gates.yaml` + the stage-keyed redesign in `135-GATES-EXPLAINER.md`.
  gate_flow: {
    stages: [
      {
        id: 'context', name: 'CONTEXT', verdict: 'green', summary: '9 sources loaded · cascade complete',
        gates: [
          { name: 'gate.context.completeness', mode: 'hard-halt', sampling: 'always',           status: 'green',   detail: 'all 4 cascade tiers resolved · 9 sources', repair: null },
          { name: 'context-selector-haiku',    mode: 'soft-warn', sampling: 'always',           status: 'green',   detail: 'haiku selected ≥1 source per cascade tier', repair: null },
          { name: 'sgsd-recall-queries',       mode: 'soft-warn', sampling: 'sampled-rate-50',  status: 'skipped', detail: 'sampling: not this phase', repair: 'bash super-gsd/scripts/sgsd-recall.sh "<query>"' },
          { name: 'intent-injection',          mode: 'soft-warn', sampling: 'always',           status: 'green',   detail: 'INTENT signature found in dispatch prompt', repair: null },
          { name: 'vtp-enrichment',            mode: 'soft-warn → hard-halt on api_error', sampling: 'low-risk-skip', status: 'green', detail: '1 doc-ID returned · VTP MCP reachable', repair: 'node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --phase 135' },
        ],
      },
      {
        id: 'plan', name: 'PLAN', verdict: 'warn', blocking: true, summary: 'awaits operator approval',
        gates: [
          { name: 'plan-schema-v2 validate',    mode: 'hard-halt', sampling: 'always',           status: 'green', detail: 'schema_version=2 · 4 tasks · 9 SACs', repair: 'node super-gsd/scripts/lib/validate.cjs --schema plan-schema-v2' },
          { name: 'gate.plan.operator-approval', mode: 'hard-halt', sampling: 'always',          status: 'warn',  blocking: true, detail: 'expected_ATC_tier=GATE · operator decision required', repair: 'operator-action · no script' },
          { name: 'classifier-haiku',           mode: 'soft-warn', sampling: 'always',           status: 'green', detail: 'complexity=high · model=gpt-5.5 · tier=GATE', repair: 'derive from plan frontmatter / re-run classify' },
        ],
      },
      {
        id: 'execute', name: 'EXECUTE', verdict: 'warn', summary: 'dispatch_count = 7 > ceiling 5',
        gates: [
          { name: 'per-dispatch-ATC',              mode: 'hard-halt', sampling: 'always', status: 'green', concept: 'ATC', detail: '7 dispatches · 0 critical deviations (see ATC tier breakdown)', repair: 'read commit-reviews.jsonl · address CRIT · re-dispatch' },
          { name: 'gate.execute.dispatch-ceiling', mode: 'soft-warn → hard-halt at 2× ceiling', sampling: 'always', status: 'warn', detail: '7 dispatches in P132 (ceiling 5 · escalates at 10)', repair: 'lock plan to halt further dispatch' },
          { name: 'token-log',                     mode: 'soft-warn', sampling: 'always', status: 'green', detail: '7 rows appended · within token budget', repair: 'append missing rows from dispatch report' },
        ],
      },
      {
        id: 'verify', name: 'VERIFY', verdict: 'pending', summary: '53/53 must hold post-edit',
        gates: [
          { name: 'gate.verify.self-test',          mode: 'hard-halt', sampling: 'always', status: 'pending', detail: 'runs per commit + at phase close · expects ≥53 baseline', repair: 'node {N}-verify.mjs' },
          { name: 'verifier-row-arithmetic',        mode: 'soft-warn', sampling: 'always', status: 'pending', detail: 'cross-checks claimed pass count vs runner output', repair: 'reconcile rows in {N}-verify.mjs' },
          { name: 'verifier-detail-vs-summary',     mode: 'soft-warn', sampling: 'always', status: 'pending', detail: 'detects contradictions between VERIFICATION.md summary + table', repair: 'reconcile detail rows with summary block' },
        ],
      },
      {
        id: 'close', name: 'CLOSE', verdict: 'pending', summary: 'depends on verify green',
        gates: [
          { name: 'phase-level-ATC',         mode: 'amortized', sampling: 'always', status: 'pending', concept: 'ATC', detail: 'fires after VERIFY green · applies 7+10 to full phase diff', repair: 'address WARN/CRIT in {N}-ATC-REVIEW.md · re-run gsd-verifier' },
          { name: 'MUDA-waste-audit',        mode: 'soft-warn', sampling: 'low-risk-skip', status: 'pending', concept: 'MUDA', detail: 'fires when files_changed≥4 OR diff_lines≥100 · 5 waste probes', repair: 'bash super-gsd/scripts/sgsd-muda-audit.sh --phase 135' },
          { name: 'qualitative-waste-audit', mode: 'soft-warn', sampling: 'sampled-rate-50', status: 'skipped', concept: 'MUDA', detail: 'sampling: not this phase', repair: 're-dispatch sgsd-code-reviewer --qualitative-waste' },
          { name: 'sgsd-curate-learnings',   mode: 'soft-warn', sampling: 'sampled-rate-50', status: 'pending', detail: 'curates candidate learnings to .planning/memory/', repair: 'bash super-gsd/scripts/sgsd-curate.sh --dry-run' },
          { name: 'gate.close.operator-promote', mode: 'hard-halt (conditional)', sampling: 'always', status: 'pending', detail: 'required only when operator_close_required=true', repair: 'operator-action · no script' },
        ],
      },
    ],
    // ATC fires per dispatch — Haiku-classified tier
    atc_history: [
      { dispatch: 1, tier: 'LITE',  verdict: 'pass', tokens: 250 },
      { dispatch: 2, tier: 'FULL',  verdict: 'pass', tokens: 550 },
      { dispatch: 3, tier: 'LITE',  verdict: 'pass', tokens: 250 },
      { dispatch: 4, tier: 'SKIP',  verdict: 'pass', tokens:  50 },
      { dispatch: 5, tier: 'FULL',  verdict: 'pass', tokens: 550 },
      { dispatch: 6, tier: 'LITE',  verdict: 'pass', tokens: 250 },
      { dispatch: 7, tier: 'GATE',  verdict: 'pass-with-deviations', tokens: 580, note: 'flagged: dispatch over ceiling' },
    ],
    // MUDA — 5 waste probes (will fire at CLOSE)
    muda_probes: [
      { name: 'classifier-failure-rate', status: 'green',   detail: '0 / 7 dispatches mis-classified',          waste_class: 'defects' },
      { name: 'narrative-staleness',     status: 'green',   detail: 'STATE.md modified 12m ago',                waste_class: 'inventory' },
      { name: 'git-spawn-rate',          status: 'green',   detail: '1.2 commits / task (target ≤ 2)',          waste_class: 'overproduction' },
      { name: 'extra-processing',        status: 'green',   detail: '0 premature-abstraction candidates',       waste_class: 'extra-processing' },
      { name: 'inventory',               status: 'pending', detail: 'will run at phase close',                  waste_class: 'inventory' },
    ],
  },

  // Memory bank — what we caught, what was wrong, what we learned
  learnings: [
    { id: 'l1', kind: 'bug',        age_sec:   600, title: 'fog_score tick rendered as float',          detail: "event tape showed `fog tick: 25.665069865988134 · steady` until rounded.", phase: 'P135', resolved: true, fix: 'wrap value in `Math.round()` at the emit site in `mc-state.jsx::makeEventDetail`.' },
    { id: 'l2', kind: 'bug',        age_sec:  3000, title: 'memory graph nodes overlapped at bottom',    detail: '9 sources around r=130 collided where labels fused.', phase: 'P135', resolved: true, fix: 'elliptical layout (320×150) + smaller 124×36 box per node.' },
    { id: 'l3', kind: 'regression', age_sec:  8400, title: 'mission card render broke after edit',       detail: 'lost the `return (` + opening `<div className="mission-card">` during a refactor; whole page went black.', phase: 'P135', resolved: true, fix: 'restored the JSX function signature; added a future-check to read back the file after structural edits.' },
    { id: 'l4', kind: 'lesson',     age_sec: 14400, title: 'flowchart edges crossed chip boxes',         detail: 'HVH midX routing put vertical segments straight through P131 and T3 in the milestone diagram.', phase: 'P135', resolved: true, fix: 'added explicit `viaY` / `viaX` overrides to `DiagramEdge` for fork edges to route through inter-row gutters.' },
    { id: 'l5', kind: 'gotcha',     age_sec: 28800, title: 'phase detail overlay covered the diagram',    detail: 'opening a phase chip popped a floating panel that obscured P133 + T3/T4.', phase: 'P135', resolved: true, fix: 'replaced overlay with a permanent right-side dossier column and tabbed content.' },
    { id: 'l6', kind: 'precedent',  age_sec: 86400, title: 'dispatch ceiling = 5 per phase',             detail: 'P132 re-rolled dispatch twice during execute when context went stale, triggering token-burn drift.', phase: 'P132', resolved: true, fix: 'operator set binding precedent: `dispatch_count ≤ 5` per phase; alarm raises on breach.' },
    { id: 'l7', kind: 'gotcha',     age_sec: 172800, title: 'SSE channel buffered on idle reconnect',     detail: 'on tab refocus the client missed the first ~200ms after reconnection.', phase: 'P129', resolved: true, fix: 'added an immediate snapshot push on reconnect; client re-syncs on resume.' },
  ],

  // ── Agents ─────────────────────────────────────────────────────
  agents: {
    claude: {
      handle: 'claude', model: 'haiku-4-5', role: 'design + planning',
      status: 'idle', task: 'awaiting operator feedback on cockpit design package',
      since_sec: 240, last_action: 'handed off design pkg → codex',
      inference_state: 'idle', jsonl_age_sec: 1551,
      recent_actions: [
        { kind: 'Write', detail: 'wrote 135-cockpit-visual-polish/135-INTEGRATION-MAP.md', age_sec: 2400 },
        { kind: 'Write', detail: 'wrote 135-cockpit-visual-polish/135-DESIGN-PACKAGE.md',  age_sec: 2520 },
        { kind: 'Bash',  detail: 'node tools/cockpit-sidecar/cockpit-sidecar.cjs --json',  age_sec: 2640 },
        { kind: 'Read',  detail: 'shared/sgsd-design-system.css [1:60]',                   age_sec: 2640 },
      ],
    },
    codex: {
      handle: 'codex/xhigh', model: 'gpt-5.5', effort: 'xhigh', role: 'implementation + verify',
      status: 'active', task: 'planning P135 client.js rewrite',
      since_sec: 252, last_action: 'received design package from claude',
      tool_state: 'running', in_bytes: 2744,
      recent_actions: [
        { kind: 'Plan',  detail: 'reading client.js + render-html.cjs',                     age_sec: 60 },
        { kind: 'Read',  detail: 'tools/cockpit-sidecar/render-html.cjs::renderShell',      age_sec: 120 },
        { kind: 'Read',  detail: 'briefs/2026-05-24-cockpit-v3.3-assessment.html (gold)',   age_sec: 180 },
        { kind: 'Pickup', detail: 'received design pkg from claude',                        age_sec: 252 },
      ],
    },
    last_handoff: {
      from: 'claude', to: 'codex/xhigh',
      payload: '135-DESIGN-PACKAGE.md · 135-DESIGN-SPEC.md · 135-MOCKUP.html',
      t_off: -260, kind: 'design → implementation',
    },
  },

  // ── 7. EVENT TAPE (secondary) ──────────────────────────────────
  events: [
    { t_off: -1320, type: 'fog',      tier: 'done',   detail: 'fog dropped to 38 (low band)' },
    { t_off: -1200, type: 'phase',    tier: 'live',   detail: 'P134-T2 closed · ledger:phase[134.t2]' },
    { t_off: -1080, type: 'dispatch', tier: 'live',   detail: 'codex/xhigh acquired research lane' },
    { t_off:  -960, type: 'gate',     tier: 'done',   detail: 'gate `vtp-enrich` cleared in 4m 22s' },
    { t_off:  -780, type: 'token',    tier: 'live',   detail: '+ 120k tokens · cumulative 2.18M' },
    { t_off:  -540, type: 'stage',    tier: 'done',   detail: 'research → vtp-enrich · 30m elapsed' },
    { t_off:  -360, type: 'stage',    tier: 'live',   detail: 'vtp-enrich → plan · entering planning lane' },
    { t_off:  -240, type: 'dispatch', tier: 'attn',   detail: 'dispatch #7 (operator ceiling 5) — flag raised' },
    { t_off:  -120, type: 'token',    tier: 'live',   detail: '+ 64k tokens · cumulative 2.34M' },
    { t_off:   -60, type: 'fog',      tier: 'done',   detail: 'fog tick: 38 · steady' },
  ],

  // ── Telemetry ──────────────────────────────────────────────────
  telemetry: {
    fog: {
      key: 'fog', label: 'FOG SCORE', unit: '',
      value: 38, target: 50, max: 100,
      normal_max: 40, attn_max: 70, severe_max: 90,
      history: [42, 44, 41, 39, 36, 38, 36, 35, 37, 39, 38, 36, 35, 38],
      tier_for: (v) => v < 40 ? 'ok' : v < 70 ? 'attn' : v < 90 ? 'severe' : 'crit',
    },
    dispatches: {
      key: 'dispatches', label: 'DISPATCHES', unit: '',
      value: 7, target: 5, max: 20,
      normal_max: 5, attn_max: 10, severe_max: 15,
      history: [1,1,2,2,3,4,4,5,5,6,6,7,7,7],
      tier_for: (v) => v <= 5 ? 'ok' : v < 10 ? 'attn' : v < 15 ? 'severe' : 'crit',
    },
    tokens: {
      key: 'tokens', label: 'TOKEN BURN', unit: '',
      value: 2_412_000, target: 2_500_000, max: 5_000_000,
      normal_max: 2_500_000, attn_max: 4_000_000, severe_max: 4_500_000,
      history: [900_000, 1_100_000, 1_300_000, 1_500_000, 1_700_000, 1_900_000, 2_050_000, 2_180_000, 2_280_000, 2_350_000, 2_390_000, 2_412_000],
      tier_for: (v) => v < 2_500_000 ? 'ok' : v < 4_000_000 ? 'attn' : v < 4_500_000 ? 'severe' : 'crit',
    },
    context: {
      key: 'context', label: 'CTX USED', unit: '%',
      value: 62, target: 70, max: 100,
      normal_max: 70, attn_max: 85, severe_max: 95,
      history: [40,42,45,49,52,55,58,60,61,62,62,61,62],
      tier_for: (v) => v < 70 ? 'ok' : v < 85 ? 'attn' : v < 95 ? 'severe' : 'crit',
    },
    elapsed: {
      key: 'elapsed', label: 'ELAPSED', unit: 'm',
      value: 4.2, target: 20, max: 30,
      normal_max: 18, attn_max: 22, severe_max: 28,
      history: [0.5, 1, 1.5, 2, 2.5, 3, 3.4, 3.8, 4.0, 4.2],
      tier_for: (v) => v < 18 ? 'ok' : v < 22 ? 'attn' : v < 28 ? 'severe' : 'crit',
      formatter: (v) => v.toFixed(1) + 'm',
    },
  },

  // ── Alarms ─────────────────────────────────────────────────────
  alarms: [
    {
      id: 'a-disp-1', signal: 'dispatch_count', tier: 'attn', severity_label: 'ATTN',
      since_sec: 180, detail: '7 dispatches in P132 — operator-defined ceiling is 5',
      threshold: 'dispatch_count ≤ 5 per phase (operator precedent)',
      cause: 'Phase plan was re-dispatched twice during execute after `vtp-enrich` flagged stale context.',
      consequence: 'Token spend trending toward 3M; risk of context-window churn on the next plan re-roll.',
      action: 'Approve the consolidated P135 plan to lock dispatch and resume execute. Hotkey: A.',
      evidence: [{ kind: 'phase', ref: 'P132' }, { kind: 'log', ref: 'ledger:dispatch[7]' }, { kind: 'file', ref: 'plan/P135.md' }],
    },
    {
      id: 'a-tok-1', signal: 'token_spend', tier: 'live', severity_label: 'INFO',
      since_sec: 720, detail: '2.4M session tokens · normal ≤ 2.5M',
      threshold: 'token_spend ≤ 2.5M normal · attn at 4M · severe at 4.5M',
      cause: 'Extended research stage on `client.js` rewrite (deep read of cockpit-sidecar tree).',
      consequence: 'Within envelope. Will breach attention band if execute re-rolls more than once.',
      action: 'Watch only — no operator action required until 3.5M.',
      evidence: [{ kind: 'phase', ref: 'P135' }, { kind: 'file', ref: 'cockpit-sidecar/client.js' }],
    },
    {
      id: 'a-fog-1', signal: 'fog_score', tier: 'done', severity_label: 'OK',
      since_sec: 1320, detail: 'fog steady at 38 (low band) for 22m',
      threshold: 'fog_score ≤ 40 normal · attn at 70 · severe at 90',
      cause: 'P134-T1/T2 resolved the cockpit assessment ambiguity; plan path is well-defined.',
      consequence: 'Operator decision latency low. Phase can run unsupervised.',
      action: 'No action — clear to dispatch.',
      evidence: [{ kind: 'phase', ref: 'P134-T1' }, { kind: 'phase', ref: 'P134-T2' }],
    },
  ],

  rationale: {
    why_this_phase: "P135 brings the live cockpit up to the brief HTML quality bar. After P132 shipped the localhost server with minimal text rendering, operator review against `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` flagged a quality gap. P135 closes it.",
    what_changed: "P134-T2 closed 20m ago (codex/xhigh, approved with notes). Stage moved `vtp-enrich → plan` ~6m ago. dispatch_count crossed the operator ceiling (5 → 7) during the prior phase. Self-test held at 53/53.",
    what_could_go_wrong: "**Plan re-roll** if the consolidated plan doesn't pass operator approval — would breach token envelope (~3M projected). **Dispatch overshoot** — already at 7/5; another retry would amplify churn. **Visual regression** in band 1/2 if `client.js` rewrite misses design-system tokens. **P134-T3/T4 stale** — paused tasks accumulate context drift the longer they sit.",
    what_evidence_supports: "Self-test green 53/53 (2m ago) · lint + typecheck clean · P134-T2 reviewer verdict approved · fog held in low band (38–42) over 22m · gate.context.completeness green (9 sources loaded).",
    what_happens_next: "Operator approves the consolidated plan (hotkey A) → Codex dispatches `execute` stage (90m SLA) → self-test must hold post-edit → browser/audit gate runs at localhost:7777 → checkpoint writes to ledger → P135 closes → P134-T3 + T4 resume → CLOSE gate opens → v3.3 milestone closes → v3.4 (agent autonomy + recovery) starts.",
    eli5: "Claude finished the cockpit design package and handed it to Codex. Right now Codex is doing the planning work to turn that spec into a `client.js` rewrite, so the cockpit can render the live phase state instead of placeholder text.\n\n• **What:** Claude wrote `135-DESIGN-PACKAGE.md` + `135-DESIGN-SPEC.md` + `135-MOCKUP.html`, then went idle. Codex picked them up and is now in the `plan` stage on the runway.\n• **Why:** P135 has to ship before v3.3 can close — it's the visual gap that's blocking milestone close.\n• **Context:** This belongs to v3.3. P134-T3/T4 are paused waiting on this phase. Final order: **P135 → resume P134-T3/T4 → milestone close**.\n• **Nearby action:** Operator approves Codex's plan → Codex dispatches `execute` stage → 90m SLA on the rewrite itself.",
    evidence_trail: "`.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` (gold reference) · `super-gsd/tools/cockpit-sidecar/client.js` (target) · `super-gsd/tools/cockpit-sidecar/render-html.cjs::renderShell` · `super-gsd/tools/cockpit-sidecar/serve.cjs::attachSparklines` (new) · `super-gsd/tools/shared/sgsd-design-system.css` (tokens) · commits pending P135-T1..T7",
  },
};

const EVENT_TYPES = ['all', 'phase', 'stage', 'dispatch', 'token', 'fog', 'gate', 'alarm'];

function jitter(prev, scale, bias = 0) {
  return Math.max(0, prev + (Math.random() - 0.5 + bias) * scale);
}

function pickEventType() {
  const r = Math.random();
  if (r < 0.45) return { type: 'token',    tier: 'live' };
  if (r < 0.65) return { type: 'fog',      tier: 'done' };
  if (r < 0.78) return { type: 'dispatch', tier: 'attn' };
  if (r < 0.88) return { type: 'gate',     tier: 'done' };
  if (r < 0.95) return { type: 'stage',    tier: 'live' };
  return { type: 'alarm', tier: 'severe' };
}

function makeEventDetail(type, snapshot) {
  const t = snapshot.telemetry;
  switch (type) {
    case 'token':    return `+ ${Math.round(20 + Math.random() * 80)}k tokens · cumulative ${(t.tokens.value/1_000_000).toFixed(2)}M`;
    case 'fog':      return `fog tick: ${Math.round(t.fog.value)} · ${t.fog.value < 40 ? 'steady' : t.fog.value < 70 ? 'rising' : 'climbing'}`;
    case 'dispatch': return `dispatch #${t.dispatches.value + 1} · queued by codex/xhigh`;
    case 'gate':     return `gate \`${['vtp-enrich','self-test','lint','succes'][Math.floor(Math.random()*4)]}\` cleared in ${Math.floor(20 + Math.random() * 200)}s`;
    case 'stage':    return `stage tick · ${snapshot.pipeline.stages[snapshot.pipeline.active_index].name}`;
    case 'alarm':    return `alarm raised · token spend volatility`;
    case 'phase':    return `phase tick`;
  }
  return type;
}

Object.assign(window, { INITIAL_SNAPSHOT, EVENT_TYPES, jitter, pickEventType, makeEventDetail });
