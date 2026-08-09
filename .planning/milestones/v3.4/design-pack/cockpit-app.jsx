// cockpit-app.jsx — owns snapshot state + simulated SSE updates + Tweaks panel

const { useState, useEffect, useRef } = React;

// ── Initial snapshot (matches the schema in 135-DESIGN-PACKAGE.md) ──
const INITIAL_SNAPSHOT = {
  milestone: 'v3.3',
  phase: '135',
  generated_at: new Date().toISOString(),
  north_star: {
    rank: 5,
    code: 'ON_TRACK',
    message_main: 'ON TRACK — v3.3 / P135 cockpit-visual-polish',
    message_stage: 'plan ⏳',
  },
  do_next: 'approve the design spec, then dispatch P135 implementation',
  alerts: {
    top: { signal: 'dispatch_count', channel: 'terminal', detail: '7 dispatches in P132 (over 5)', palette_tier: 'attention' },
    others_count: 2,
    all: [
      { signal: 'dispatch_count', detail: '7 dispatches in P132 (over 5)', palette_tier: 'attention' },
      { signal: 'token_spend', detail: '2.4M tokens this session', palette_tier: 'accent' },
      { signal: 'fog_score', detail: 'fog steady at 38 (low band)', palette_tier: 'success' },
    ],
  },
  stage_pipeline: {
    stages: [
      { name: 'research', owner: 'codex/xhigh', sla_minutes: 30, status: 'done' },
      { name: 'vtp-enrich', owner: 'vtp-enrich', sla_minutes: 5, status: 'done' },
      { name: 'plan', owner: 'codex/xhigh', sla_minutes: 20, status: 'active' },
      { name: 'execute', owner: 'codex/xhigh', sla_minutes: 90, status: 'pending' },
      { name: 'verify', owner: 'codex/xhigh', sla_minutes: 15, status: 'pending' },
    ],
    active_index: 2,
    blocker: null,
  },
  fog_score: { score: 38, tier: 'low' },
  signals: {
    dispatch_count: 7,
    token_spend: 2_400_000,
    files_changed: 4,
    review_loops: 0,
    minutes_since_operator_decision: 12,
  },
  why_running: 'codex planning P135 client.js rewrite · cause: SAC drift in band rendering · ETA ~3m',
  unlocks: 'v3.3 milestone close after P134-T3/T4 resume',
  rationale: {
    why_this_phase: "P135 ships visual polish to bring the live cockpit up to the brief HTML quality. After P132 shipped the localhost server with minimal text rendering, operator feedback identified the gap. `client.js` rewrite + `renderShell` styling + bullet-chart trend strip + status-coloured stage cells.",
    context: "v3.3 has 6 phases closed (P128–P133). P134-T1 + T2 done; T3 + T4 paused for P135 to land first. Self-test 53/53 prior to this phase. Final v3.3 phase order will be P135 → resume P134-T3/T4 → milestone close.",
    eli5: "**What is now:** the live page shows almost nothing. **What could be:** it shows everything at a glance — stage progress, what's blocked, why it matters. **S.T.A.R.:** a bento layout with one loud line, a 5-cell pipeline strip, three little bullet bars for fog/dispatches/tokens, and a rich rationale layer. **Call to action:** open localhost:7777 after P135 closes.",
    what_is: "Minimal `client.js`. Plain text bands. No sparklines. Placeholder rationale ('no context found'). 5% of the brief HTML quality.",
    what_could_be: "Bento grid with bullet charts, status-coloured pipeline cells, real rationale paragraphs, and SSE-pushed updates within 200ms of any ledger change. 80%+ of the brief HTML quality.",
    evidence_trail: "`.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` (gold reference) · `super-gsd/tools/cockpit-sidecar/client.js` (target) · `super-gsd/tools/cockpit-sidecar/render-html.cjs::renderShell` · `super-gsd/tools/cockpit-sidecar/serve.cjs::attachSparklines` (new) · `super-gsd/tools/shared/sgsd-design-system.css` (tokens) · commits pending P135-T1..T7",
  },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "band1_emph": "gold-bar",
  "pipeline_style": "cells",
  "chart_style": "bullet",
  "band3_disclosure": "collapsible",
  "show_connection": true,
  "sim_speed": 1
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [now, setNow] = useState(new Date());
  const [elapsedSec, setElapsedSec] = useState(4 * 60 + 12); // start at 4m 12s into "plan"
  const [showAlertList, setShowAlertList] = useState(false);
  const [band3Collapsed, setBand3Collapsed] = useState(() => {
    try { return localStorage.getItem('sgsd-band3-collapsed') === '1'; } catch { return false; }
  });
  const [connected, setConnected] = useState(true);

  // Persist Band 3 collapse
  useEffect(() => {
    try { localStorage.setItem('sgsd-band3-collapsed', band3Collapsed ? '1' : '0'); } catch {}
  }, [band3Collapsed]);

  // Clock tick — runs at sim_speed
  useEffect(() => {
    const interval = Math.max(200, 1000 / (t.sim_speed || 1));
    const id = setInterval(() => {
      setNow(new Date());
      setElapsedSec((s) => s + 1);
    }, interval);
    return () => clearInterval(id);
  }, [t.sim_speed]);

  // Simulated SSE updates — small jitter on metrics, pipeline auto-advance
  useEffect(() => {
    const interval = Math.max(800, 2500 / (t.sim_speed || 1));
    const id = setInterval(() => {
      setSnapshot((prev) => {
        // small jitter on signals
        const sig = prev.signals;
        const newSig = {
          ...sig,
          dispatch_count: Math.max(0, sig.dispatch_count + (Math.random() < 0.3 ? 1 : 0)),
          token_spend: Math.max(0, sig.token_spend + Math.round((Math.random() - 0.2) * 80_000)),
          files_changed: sig.files_changed + (Math.random() < 0.15 ? 1 : 0),
        };
        const newFog = {
          score: Math.max(0, Math.min(100, prev.fog_score.score + Math.round((Math.random() - 0.5) * 6))),
          tier: prev.fog_score.tier,
        };
        newFog.tier = newFog.score < 40 ? 'low' : newFog.score < 70 ? 'mid' : 'high';

        return { ...prev, signals: newSig, fog_score: newFog, generated_at: new Date().toISOString() };
      });
    }, interval);
    return () => clearInterval(id);
  }, [t.sim_speed]);

  // Pipeline auto-advance: when elapsedSec exceeds active SLA, advance
  useEffect(() => {
    setSnapshot((prev) => {
      const stages = prev.stage_pipeline.stages;
      const activeIdx = stages.findIndex((s) => s.status === 'active');
      if (activeIdx < 0) return prev;
      const active = stages[activeIdx];
      if (elapsedSec >= active.sla_minutes * 60 && activeIdx < stages.length - 1) {
        const newStages = stages.map((s, i) => {
          if (i === activeIdx) return { ...s, status: 'done' };
          if (i === activeIdx + 1) return { ...s, status: 'active' };
          return s;
        });
        setElapsedSec(0);
        // Update north star stage tag
        const nextActive = newStages[activeIdx + 1];
        return {
          ...prev,
          stage_pipeline: { ...prev.stage_pipeline, stages: newStages, active_index: activeIdx + 1 },
          north_star: { ...prev.north_star, message_stage: `${nextActive.name} ⏳` },
        };
      }
      return prev;
    });
  }, [elapsedSec]);

  return (
    <>
      <div className="top-chrome">
        <span style={{ fontWeight: 600, color: 'var(--cyan)' }}>●</span>
        <span className="url"><b>localhost:7777</b> / cockpit</span>
        <span>·</span>
        <span>v{snapshot.milestone} · P{snapshot.phase}</span>
        <span className="spacer" />
        {t.show_connection && (
          <span
            className={`ev-pill ${connected ? '' : 'disconnected'}`}
            onClick={() => setConnected(!connected)}
            style={{ cursor: 'pointer' }}
            title="click to toggle (demo)"
          >
            <span className="dot" />
            {connected ? 'SSE live' : 'disconnected'}
          </span>
        )}
      </div>

      <main className="cockpit-bento" role="main" aria-label="SGSD live cockpit">
        <Band1
          snapshot={snapshot}
          emph={t.band1_emph}
          now={now}
          showAlertList={showAlertList}
          setShowAlertList={setShowAlertList}
        />
        <Band2
          snapshot={snapshot}
          pipelineStyle={t.pipeline_style}
          chartStyle={t.chart_style}
          now={now}
          elapsedSec={elapsedSec}
        />
        <Band3
          snapshot={snapshot}
          disclosure={t.band3_disclosure}
          collapsed={band3Collapsed}
          setCollapsed={setBand3Collapsed}
        />
      </main>

      <TweaksPanel>
        <TweakSection label="Band 1 · governing thought" />
        <TweakRadio
          label="Emphasis"
          value={t.band1_emph}
          options={[
            { value: 'gold-bar', label: 'Gold bar' },
            { value: 'cyan-glow', label: 'Cyan glow' },
            { value: 'gradient', label: 'Gradient' },
          ]}
          onChange={(v) => setTweak('band1_emph', v)}
        />

        <TweakSection label="Band 2 · pipeline" />
        <TweakRadio
          label="Stage shape"
          value={t.pipeline_style}
          options={[
            { value: 'cells', label: 'Cells' },
            { value: 'arrows', label: 'Arrows' },
            { value: 'stepper', label: 'Stepper' },
          ]}
          onChange={(v) => setTweak('pipeline_style', v)}
        />

        <TweakSection label="Band 2 · trend strip" />
        <TweakRadio
          label="Chart"
          value={t.chart_style}
          options={[
            { value: 'bullet', label: 'Bullet' },
            { value: 'gauge', label: 'Gauge' },
            { value: 'progress', label: 'Bars' },
          ]}
          onChange={(v) => setTweak('chart_style', v)}
        />

        <TweakSection label="Band 3 · rationale" />
        <TweakRadio
          label="Disclosure"
          value={t.band3_disclosure}
          options={[
            { value: 'collapsible', label: 'Collapse' },
            { value: 'tabs', label: 'Tabs' },
            { value: 'persistent', label: 'Always' },
          ]}
          onChange={(v) => setTweak('band3_disclosure', v)}
        />

        <TweakSection label="Live stream" />
        <TweakToggle
          label="Show SSE indicator"
          value={t.show_connection}
          onChange={(v) => setTweak('show_connection', v)}
        />
        <TweakSlider
          label="Sim speed"
          value={t.sim_speed}
          min={0.25} max={4} step={0.25} unit="×"
          onChange={(v) => setTweak('sim_speed', v)}
        />
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
