// mc-app.jsx — comprehension-first vertical cockpit
// Reading order: mission → architecture → milestone → memory → evidence → tape → telemetry

const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "color_mode": "color",
  "show_chrome": true,
  "sim_speed": 1,
  "rationale_open": false
}/*EDITMODE-END*/;

const SECTIONS = [
  { id: 'mission',   num: '§1', label: 'Mission',      blurb: 'Active phase, why it is running, what it unlocks, and the decision the operator owes.' },
  { id: 'telemetry', num: '§2', label: 'Telemetry',    blurb: 'Live counters. Sparklines for fog, dispatch volume, token burn, context use, elapsed time.' },
  { id: 'arch',      num: '§3', label: 'Architecture', blurb: 'Two views of how this phase is wired: the technical dataflow and the agent/gate orchestration.' },
  { id: 'milestone', num: '§4', label: 'Milestone',    blurb: 'Where P135 sits in the v3.3 milestone, what runs before/after it, and what unlocks v3.4.' },
  { id: 'memory',    num: '§5', label: 'Memory',       blurb: 'Typed memory mesh: observations (SGSD-emitted facts), claims (agent assertions, pending/validated/refuted), and decisions (operator/promotion verdicts). Includes an evidence lineage view.' },
  { id: 'evidence',  num: '§6', label: 'Evidence',     blurb: 'What has actually been proven: tests, lint, audit gates, reviewer verdicts, unresolved findings.' },
  { id: 'tape',      num: '§7', label: 'Event tape',   blurb: 'Live stream of dispatches, stage transitions, gate clears. Useful at a glance — never the lead story.' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [now, setNow] = useState(new Date());
  const [activeElapsedSec, setActiveElapsedSec] = useState(252);
  const [timeLeftSec, setTimeLeftSec] = useState(INITIAL_SNAPSHOT.time_left_sec);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(true);
  const [events, setEvents] = useState(() => {
    const baseMs = Date.now();
    return INITIAL_SNAPSHOT.events.map((e, i) => ({
      ...e,
      id: 'init-' + i,
      created_at: baseMs + e.t_off * 1000,
    }));
  });
  const [rationaleOpen, setRationaleOpen] = useState(() => {
    try { return localStorage.getItem('sgsd-rationale') === '1'; } catch { return TWEAK_DEFAULTS.rationale_open; }
  });
  const [archTab, setArchTab] = useState('phase');         // phase | orchestration
  const [memTab, setMemTab] = useState('mesh');            // mesh | lineage
  const [selectedPhase, setSelectedPhase] = useState(null); // phase id for milestone detail
  const [selectedGateStage, setSelectedGateStage] = useState(null);
  const [activeSection, setActiveSection] = useState('mission');

  // Persist rationale state
  useEffect(() => {
    try { localStorage.setItem('sgsd-rationale', rationaleOpen ? '1' : '0'); } catch {}
  }, [rationaleOpen]);

  // Clock
  useEffect(() => {
    if (paused) return;
    const ms = Math.max(150, 1000 / (t.sim_speed || 1));
    const id = setInterval(() => {
      setNow(new Date());
      setActiveElapsedSec((s) => s + 1);
      setTimeLeftSec((s) => Math.max(0, s - 1));
    }, ms);
    return () => clearInterval(id);
  }, [t.sim_speed, paused]);

  // Telemetry jitter + occasional events
  useEffect(() => {
    if (paused) return;
    const ms = Math.max(400, 1800 / (t.sim_speed || 1));
    const id = setInterval(() => {
      setSnapshot((prev) => {
        const tel = prev.telemetry;
        const nudged = (m, scale, bias) => {
          const v = Math.max(0, Math.min(m.max, jitter(m.value, scale, bias)));
          const hist = [...m.history, v].slice(-30);
          return { ...m, value: v, history: hist };
        };
        return {
          ...prev,
          telemetry: {
            ...tel,
            fog: nudged(tel.fog, 4, -0.05),
            dispatches: {
              ...tel.dispatches,
              value: Math.min(tel.dispatches.max, tel.dispatches.value + (Math.random() < 0.10 ? 1 : 0)),
              history: [...tel.dispatches.history, tel.dispatches.value].slice(-30),
            },
            tokens: nudged(tel.tokens, 60_000, 0.25),
            context: nudged(tel.context, 3, 0.10),
            elapsed: {
              ...tel.elapsed,
              value: tel.elapsed.value + (ms / 60000) * (t.sim_speed || 1),
              history: [...tel.elapsed.history, tel.elapsed.value].slice(-30),
            },
          },
        };
      });

      if (Math.random() < 0.55) {
        const kind = pickEventType();
        setEvents((prev) => {
          const lastT = prev.length ? prev[0].t_off : 0;
          const newE = {
            id: 'sim-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            t_off: lastT + Math.ceil(8 + Math.random() * 20),
            created_at: Date.now(),
            type: kind.type, tier: kind.tier, detail: '',
          };
          setSnapshot((s) => { newE.detail = makeEventDetail(kind.type, s); return s; });
          return [newE, ...prev].slice(0, 60);
        });
      }
    }, ms);
    return () => clearInterval(id);
  }, [t.sim_speed, paused]);

  // Pipeline auto-advance
  useEffect(() => {
    setSnapshot((prev) => {
      const stages = prev.pipeline.stages;
      const idx = prev.pipeline.active_index;
      const active = stages[idx];
      if (!active || active.status !== 'active') return prev;
      if (activeElapsedSec < active.sla_min * 60) return prev;
      if (idx >= stages.length - 1) return prev;

      const newStages = stages.map((s, i) => {
        if (i === idx) return { ...s, status: 'done', elapsed_sec: s.sla_min * 60 };
        if (i === idx + 1) return { ...s, status: 'active' };
        return s;
      });
      const nextActive = newStages[idx + 1];
      setActiveElapsedSec(0);
      setTimeLeftSec(nextActive.sla_min * 60);
      setEvents((prev) => [{
        id: 'stage-' + Date.now(),
        t_off: (prev[0]?.t_off ?? 0) + 10,
        created_at: Date.now(),
        type: 'stage', tier: 'live',
        detail: `stage ${active.name} → ${nextActive.name}`,
      }, ...prev].slice(0, 60));
      return { ...prev, pipeline: { ...prev.pipeline, stages: newStages, active_index: idx + 1 } };
    });
  }, [activeElapsedSec]);

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.target.matches('input, textarea, select, button, a')) return;
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Section anchor tracking
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      });
    }, { rootMargin: '-20% 0px -60% 0px' });
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Computed live derived values
  const activeStage = snapshot.pipeline.stages[snapshot.pipeline.active_index];
  const liveSnapshot = {
    ...snapshot,
    risk: {
      ...snapshot.risk,
      tier: snapshot.telemetry.dispatches.value >= 15 ? 'crit'
          : snapshot.telemetry.dispatches.value >= 10 ? 'severe'
          : snapshot.telemetry.dispatches.value >= 7  ? 'attn'
          : 'ok',
      label: snapshot.telemetry.dispatches.value >= 15 ? 'CRIT'
           : snapshot.telemetry.dispatches.value >= 10 ? 'SEVERE'
           : snapshot.telemetry.dispatches.value >= 7  ? 'ATTN'
           : 'OK',
    },
  };

  return (
    <div data-color-mode={t.color_mode}>
      {/* Chrome */}
      {t.show_chrome && (
        <div className="chrome">
          <span className="crumb"><b>localhost:7777</b> / cockpit</span>
          <span className="div">·</span>
          <span>{snapshot.milestone} · P{snapshot.phase} · {snapshot.phase_name}</span>
          <span className="spacer"></span>
          <span className="kbd"><kbd>A</kbd> approve · <kbd>P</kbd> pause · <kbd>O</kbd> open phase</span>
          <span className="div">·</span>
          <span
            className={`sse ${connected ? '' : 'off'}`}
            onClick={() => setConnected(!connected)}
            style={{ cursor: 'pointer' }}
            title="click to toggle (demo)"
          >
            <span className="dot"></span>
            {connected ? 'SSE LIVE' : 'DISCONNECTED'}
          </span>
        </div>
      )}

      {/* Section nav (sticky TOC) */}
      <nav className="sec-nav" aria-label="Cockpit sections">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={activeSection === s.id ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(s.id);
              if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
            }}
          >
            <span className="num">{s.num}</span>
            <span>{s.label}</span>
          </a>
        ))}
      </nav>

      {/* Command strip — slim, focused on action */}
      <div className="stage" style={{ minHeight: 'auto', gridTemplateColumns: '1fr', gridTemplateRows: 'auto', background: 'transparent' }}>
        <CommandStrip
          snapshot={liveSnapshot}
          timeLeft={timeLeftSec}
          paused={paused}
          onPause={() => setPaused(!paused)}
        />
      </div>

      {/* 5-second scan — six canonical questions at a glance */}
      <ScanBar
        snapshot={liveSnapshot}
        activeStage={activeStage}
        activeElapsedSec={activeElapsedSec}
        mostRecentEvent={events[0]}
        now={now}
      />

      <main className="brief">

        {/* ─── §1 Mission ─── */}
        <section id="mission" className="b-sec b-sec-1" aria-labelledby="mission-h">
          <header className="b-sec-head">
            <span className="b-sec-num">§1</span>
            <h2 className="b-sec-title" id="mission-h">Current mission</h2>
            <span className="b-sec-rule"></span>
            <span className="b-sec-meta">phase {snapshot.mission.phase_id} · {activeStage?.name} stage</span>
          </header>
          <p className="b-sec-blurb">{SECTIONS[0].blurb}</p>

          <div className="b-grid">
            <MissionCard mission={snapshot.mission} time_left_sec={timeLeftSec} />
            <div className="runway-host">
              <div className="sec-head">
                <span className="lbl">Phase runway</span>
                <span className="rule"></span>
                <span className="meta">
                  {snapshot.pipeline.active_index + 1}/{snapshot.pipeline.stages.length} · blocker: <code style={{ color: 'var(--attn)' }}>{snapshot.pipeline.blocker || 'none'}</code>
                </span>
              </div>
              <PhaseRunway pipeline={snapshot.pipeline} activeElapsedSec={activeElapsedSec} />
            </div>
          </div>

          <ExplanationBand mission={snapshot.mission} pipeline={snapshot.pipeline} snapshot={snapshot} />

          <div className="agents-host">
            <div className="sec-head">
              <span className="lbl">Agents · handoff</span>
              <span className="rule"></span>
              <span className="meta">claude → codex · {snapshot.agents.last_handoff.kind}</span>
            </div>
            <AgentLanes agents={snapshot.agents} />
          </div>
        </section>

        {/* ─── §2 Telemetry · live instruments (always visible) ─── */}
        <section id="telemetry" className="b-sec b-sec-telemetry b-sec-live" aria-labelledby="telemetry-h">
          <header className="b-sec-head" data-mega="TELEMETRY">
            <span className="b-sec-num">§2</span>
            <h2 className="b-sec-title" id="telemetry-h">Live telemetry</h2>
            <span className="b-sec-rule"></span>
            <span className="b-sec-meta">5 channels · sparkline · normal / attn / severe</span>
          </header>
          <p className="b-sec-blurb">{SECTIONS[1].blurb}</p>
          <div className="telem-host">
            <TelemetryRail telemetry={snapshot.telemetry} />
          </div>
        </section>

        {/* ─── §3 Architecture (collapsed) ─── */}
        <CollapsibleSection
          id="arch" num="§3" title="Architecture map" mega="ARCHITECTURE"
          summary="2 views · phase dataflow + SGSD orchestration"
          blurb={SECTIONS[2].blurb}
        >
          <div className="subtabs" role="tablist">
            <button role="tab" aria-selected={archTab === 'phase'} className={`subtab ${archTab === 'phase' ? 'active' : ''}`}
                    onClick={() => setArchTab('phase')}>Phase dataflow</button>
            <button role="tab" aria-selected={archTab === 'orch'} className={`subtab ${archTab === 'orch' ? 'active' : ''}`}
                    onClick={() => setArchTab('orch')}>SGSD orchestration</button>
          </div>
          {archTab === 'phase' ? <PhaseArchitectureDiagram /> : <OrchestrationDiagram agents={snapshot.agents} />}
        </CollapsibleSection>

        {/* ─── §4 Milestone (collapsed) ─── */}
        <CollapsibleSection
          id="milestone" num="§4" title="Milestone dependency" mega="MILESTONE"
          summary={`${snapshot.milestone_map.current} · 6 done / 1 active / 2 paused`}
          blurb={SECTIONS[3].blurb}
        >
          <div className="milestone-region with-dossier">
            <div className="milestone-region-map">
              <MilestoneDependencyDiagram
                map={snapshot.milestone_map}
                selectedPhase={selectedPhase || 'P135'}
                onSelectPhase={(id) => setSelectedPhase(id === selectedPhase ? null : id)}
              />
            </div>
            <div className="milestone-region-detail">
              <PhaseDetailPanel
                phaseId={selectedPhase || 'P135'}
                detail={snapshot.milestone_map.details[selectedPhase || 'P135']}
                onClose={selectedPhase ? () => setSelectedPhase(null) : null}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ─── §5 Memory (collapsed) ─── */}
        <CollapsibleSection
          id="memory" num="§5" title="Context memory" mega="MEMORY"
          summary={`${snapshot.memory_graph.sources.filter(s=>s.type==='observation').length} obs · ${snapshot.memory_graph.sources.filter(s=>s.type==='claim').length} claims · ${snapshot.memory_graph.sources.filter(s=>s.type==='decision').length} decisions`}
          blurb={SECTIONS[4].blurb}
        >
          <div className="subtabs" role="tablist">
            <button role="tab" aria-selected={memTab === 'mesh'} className={`subtab ${memTab === 'mesh' ? 'active' : ''}`}
                    onClick={() => setMemTab('mesh')}>Memory mesh</button>
            <button role="tab" aria-selected={memTab === 'lineage'} className={`subtab ${memTab === 'lineage' ? 'active' : ''}`}
                    onClick={() => setMemTab('lineage')}>Evidence lineage</button>
          </div>
          {memTab === 'mesh'
            ? <MemoryGraph memory={snapshot.memory_graph} />
            : <LineageChain lineage={snapshot.lineage} />}
        </CollapsibleSection>

        {/* ─── §6 Evidence (collapsed) ─── */}
        <CollapsibleSection
          id="evidence" num="§6" title="Evidence & gates" mega="EVIDENCE"
          summary={`${snapshot.evidence.summary.green} green · ${snapshot.evidence.summary.warn} warn · ${snapshot.evidence.summary.fail} fail · ${snapshot.evidence.summary.pending} pending`}
          blurb={SECTIONS[5].blurb}
        >
          <GateFlowDiagram
            gateFlow={snapshot.gate_flow}
            selectedStage={selectedGateStage}
            onSelectStage={setSelectedGateStage}
          />
          <GateRegistryTable stages={snapshot.gate_flow.stages} selectedStage={selectedGateStage} />
          <div className="gate-companions">
            <ATCHistory history={snapshot.gate_flow.atc_history} />
            <MudaProbes probes={snapshot.gate_flow.muda_probes} />
          </div>
          <EvidencePanel evidence={snapshot.evidence} />
          <LearningsPanel learnings={snapshot.learnings} />
        </CollapsibleSection>

        {/* ─── §7 Event tape (collapsed) ─── */}
        <CollapsibleSection
          id="tape" num="§7" title="Live event tape" mega="EVENT TAPE"
          summary={`${events.length} events · newest first · live`}
          blurb={SECTIONS[6].blurb}
        >
          <div className="tape-host">
            <EventTape events={events} baseTime={now} />
          </div>
        </CollapsibleSection>

      </main>

      {/* Alarms + Rationale (deep dive, below the brief) */}
      <div className="b-bottom">
        <div className="alarm-host">
          <div className="sec-head">
            <span className="lbl">Alarms</span>
            <span className="rule"></span>
            <span className="meta">{snapshot.alarms.length} active · click any row to expand cause / consequence / corrective action</span>
          </div>
          <AlarmList alarms={snapshot.alarms} />
        </div>
        <RationaleLayer
          rationale={snapshot.rationale}
          expanded={rationaleOpen}
          setExpanded={setRationaleOpen}
        />
      </div>

      <TweaksPanel>
        <TweakSection label="Color" />
        <TweakRadio
          label="Mode"
          value={t.color_mode}
          options={[
            { value: 'color', label: 'Full color' },
            { value: 'mono', label: 'Monochrome' },
          ]}
          onChange={(v) => setTweak('color_mode', v)}
        />

        <TweakSection label="Chrome" />
        <TweakToggle
          label="Show top chrome"
          value={t.show_chrome}
          onChange={(v) => setTweak('show_chrome', v)}
        />

        <TweakSection label="Live stream" />
        <TweakSlider
          label="Sim speed"
          value={t.sim_speed}
          min={0.25} max={6} step={0.25} unit="×"
          onChange={(v) => setTweak('sim_speed', v)}
        />

        <TweakSection label="Deep dive" />
        <TweakToggle
          label="Rationale open by default"
          value={t.rationale_open}
          onChange={(v) => setTweak('rationale_open', v)}
        />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
