// mc-arch.jsx — first-class architecture components for the cockpit:
//   MissionCard, MilestoneStrip,
//   PhaseArchitectureDiagram, OrchestrationDiagram, MilestoneDependencyDiagram,
//   MemoryGraph, EvidencePanel, Tabs.

const { useState: useStateA, useMemo: useMemoA, useRef: useRefA, useEffect: useEffectA } = React;

// ── small helpers ────────────────────────────────────────────────
function archInlineMD(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}
function statusColorVar(s) {
  return s === 'done'    ? 'var(--done)'
       : s === 'active'  ? 'var(--live)'
       : s === 'green'   ? 'var(--done)'
       : s === 'warn'    ? 'var(--attn)'
       : s === 'severe'  ? 'var(--severe)'
       : s === 'fail'    ? 'var(--crit)'
       : s === 'paused'  ? 'var(--severe)'
       : s === 'blocked' ? 'var(--crit)'
       : 'var(--ink-dim)';
}

// ── Explanation Band (Why active · Unlocked by · Blocked by · Done means) ──
function ExplanationBand({ mission, pipeline, snapshot }) {
  const blocker = pipeline.blocker;
  const blockerStage = pipeline.stages.find((s) => s.blocking_gate === blocker);
  const cells = [
    {
      lbl: 'Why active',
      val: mission.why_running.split('.')[0] + '.',
      tier: '',
    },
    {
      lbl: 'Unlocked by',
      val: 'P132 minimal render flagged the brief-quality gap; P134-T1/T2 closed without dependent edits.',
      tier: '',
    },
    {
      lbl: 'Blocked by',
      val: blocker || 'nothing — clear to run',
      sub: blockerStage ? `${blockerStage.next_action}` : null,
      tier: blocker ? 'attn' : 'ok',
      isCode: !!blocker,
    },
    {
      lbl: 'Done means',
      val: mission.unlocks,
      tier: '',
    },
  ];
  return (
    <div className="exp-band" role="region" aria-label="Phase explanation">
      {cells.map((c, i) => (
        <div key={i} className={`exp-cell ${c.tier ? 'tier-' + c.tier : ''}`}>
          <span className="lbl">{c.lbl}</span>
          <p className="exp-val">
            {c.isCode ? <code className="mono">{c.val}</code> : c.val}
          </p>
          {c.sub && <p className="exp-sub mono">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Collapsible section wrapper with localStorage persistence ─────
function CollapsibleSection({ id, num, title, blurb, mega, summary, defaultOpen, children }) {
  const [open, setOpen] = useStateA(() => {
    try {
      const v = localStorage.getItem(`sgsd-sec-${id}`);
      if (v !== null) return v === '1';
    } catch {}
    return !!defaultOpen;
  });
  useEffectA(() => {
    try { localStorage.setItem(`sgsd-sec-${id}`, open ? '1' : '0'); } catch {}
  }, [open]);

  return (
    <section id={id} className={`b-sec b-sec-${id} ${open ? 'is-open' : 'is-closed'}`} aria-labelledby={`${id}-h`}>
      <header className="b-sec-head" data-mega={mega || title.toUpperCase()}
              onClick={() => setOpen(!open)}
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); }}}>
        <button className="b-sec-toggle" aria-label={open ? 'collapse section' : 'expand section'}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <span className="b-sec-num">{num}</span>
        <h2 className="b-sec-title" id={`${id}-h`}>{title}</h2>
        <span className="b-sec-rule"></span>
        <span className="b-sec-meta">{summary}</span>
      </header>
      {open && (
        <div className="b-sec-body">
          {blurb && <p className="b-sec-blurb">{blurb}</p>}
          {children}
        </div>
      )}
    </section>
  );
}
function ScanBar({ snapshot, activeStage, activeElapsedSec, mostRecentEvent, now }) {
  const ev = snapshot.evidence;
  const sumGreen = ev.summary.green;
  const sumWarn  = ev.summary.warn;
  const sumFail  = ev.summary.fail;

  // Compact verb·target pair for the action cell
  const next = snapshot.next_action;
  const actionShort = `${next.verb} ${next.target.split('→')[0].trim()}`;

  // "Just changed" → compute live age from event's created_at
  let changedAge = '';
  if (mostRecentEvent && mostRecentEvent.created_at && now) {
    const secs = Math.max(0, Math.floor((now.getTime() - mostRecentEvent.created_at) / 1000));
    if (secs < 60) changedAge = secs + 's ago';
    else if (secs < 3600) changedAge = Math.floor(secs / 60) + 'm ago';
    else changedAge = Math.floor(secs / 3600) + 'h ago';
  }

  const cells = [
    {
      n: '1', q: 'NOW',
      val: `${snapshot.mission.phase_id} · ${activeStage?.name}`,
      sub: `${snapshot.agents.codex.handle} · ${fmtClock(activeElapsedSec)} in stage`,
      tier: 'live',
    },
    {
      n: '2', q: 'WHY',
      val: 'close visual gap',
      sub: 'P132 minimal render ≈ 5% of brief',
      tier: '',
    },
    {
      n: '3', q: 'JUST CHANGED',
      val: mostRecentEvent ? mostRecentEvent.type : 'idle',
      sub: mostRecentEvent ? mostRecentEvent.detail : 'no recent events',
      age: changedAge,
      tier: mostRecentEvent ? mostRecentEvent.tier : '',
    },
    {
      n: '4', q: 'RISK',
      val: snapshot.risk.label,
      sub: snapshot.risk.reason,
      tier: snapshot.risk.tier,
    },
    {
      n: '5', q: 'DO NEXT',
      val: actionShort,
      sub: `hotkey ${next.hotkey || 'A'} · then 90m execute`,
      tier: 'attn-action',
    },
    {
      n: '6', q: 'EVIDENCE',
      val: `${sumGreen} green · ${sumWarn} warn · ${sumFail} fail`,
      sub: `${ev.unresolved.length} unresolved findings`,
      tier: sumFail > 0 ? 'severe' : sumWarn > 0 ? 'attn' : 'ok',
    },
  ];

  return (
    <div className="scanbar" role="region" aria-label="5-second scan">
      <div className="scanbar-rail" aria-hidden="true">5-SEC SCAN</div>
      {cells.map((c, i) => (
        <div key={i} className={`scan-cell tier-${c.tier}`}>
          <div className="scan-head">
            <span className="scan-n">{c.n}</span>
            <span className="scan-q-lbl">{c.q}</span>
            {c.age && <span className="scan-age mono">{c.age}</span>}
          </div>
          <div className="scan-val mono">{c.val}</div>
          <div className="scan-sub mono">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Mission Card (Q2 of the four questions) ──────────────────────
function MissionCard({ mission, time_left_sec }) {
  return (
    <div className="mission-card">
      <div className="mc-head">
        <div className="mc-id-block">
          <span className="lbl">Phase</span>
          <span className="mc-id">{mission.phase_id}</span>
        </div>
        <div className="mc-title-block">
          <h2 className="mc-title">{mission.phase_title}</h2>
          <p className="mc-objective">{mission.objective}</p>
        </div>
        {mission.operator_decision_required && (
          <div className="mc-decision">
            <span className="lbl"><span className="pip"></span>Decision required</span>
            <span className="mc-decision-prompt">{mission.decision_prompt}</span>
          </div>
        )}
      </div>

      <div className="mc-body">
        <div className="mc-row">
          <span className="lbl">Why running</span>
          <span className="mc-text" dangerouslySetInnerHTML={{ __html: archInlineMD(mission.why_running) }} />
        </div>
        <div className="mc-row">
          <span className="lbl">Unlocks</span>
          <span className="mc-text" dangerouslySetInnerHTML={{ __html: archInlineMD(mission.unlocks) }} />
        </div>
        <div className="mc-row">
          <span className="lbl">Risk</span>
          <span className="mc-text">
            <span className={`mc-risk-tag tier-${mission.risk_tier}`}>{mission.risk_tier.toUpperCase()}</span>
            <span className="mc-risk-reasons">
              {mission.risk_reasons.map((r, i) => <span key={i} className="mc-risk-chip">{r}</span>)}
            </span>
          </span>
        </div>
      </div>

      <div className="mc-criteria">
        <span className="lbl">Success criteria · {mission.success_criteria.length}</span>
        <ul>
          {mission.success_criteria.map((sc) => (
            <li key={sc.code} data-status={sc.status}>
              <span className="sc-code">{sc.code}</span>
              <span className="sc-pip" aria-hidden="true"></span>
              <span className="sc-text">{sc.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Milestone strip (compact, persistent at top) ─────────────────
function MilestoneStrip({ map }) {
  return (
    <div className="milestone-strip">
      {map.milestones.map((m, i) => (
        <React.Fragment key={m.id}>
          {i > 0 && <span className="ms-sep" aria-hidden="true">→</span>}
          <div className={`ms-cell ms-${m.status}`}>
            <span className="ms-id">{m.label}</span>
            <span className="ms-focus">{m.focus}</span>
            <span className="ms-stat">{m.status}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Diagram primitives: Node + Edge ──────────────────────────────
function DiagramNode({ x, y, w, h, label, sub, kind, status, badge }) {
  const stroke = statusColorVar(status);
  const fill = `${kind === 'actor' ? 'var(--live-bg)'
              : kind === 'gate'  ? 'var(--attn-bg)'
              : kind === 'sink'  ? 'var(--done-bg)'
              : kind === 'artefact' ? 'var(--indigo-bg)'
              : 'var(--bg-2)'}`;
  return (
    <g className={`dg-node dg-${kind || ''} dg-status-${status || ''}`} transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={h} rx="4" ry="4" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <text x={10} y={18} className="dg-label">{label}</text>
      {sub && <text x={10} y={34} className="dg-sub">{sub}</text>}
      {badge && (
        <g transform={`translate(${w - 6 - 36}, 6)`}>
          <rect width="36" height="14" rx="2" fill={stroke} opacity="0.18" />
          <text x="18" y="10.5" className="dg-badge">{badge}</text>
        </g>
      )}
    </g>
  );
}

function DiagramEdge({ x1, y1, x2, y2, label, status, dashed, route, viaX, viaY }) {
  const stroke = statusColorVar(status) || 'var(--line-strong)';
  const horizontalAligned = Math.abs(y2 - y1) < 4;
  const verticalAligned = Math.abs(x2 - x1) < 4;
  let d, labelX, labelY;

  if (route === 'straight' || horizontalAligned || verticalAligned) {
    d = `M ${x1} ${y1} L ${x2} ${y2}`;
    labelX = (x1 + x2) / 2;
    labelY = (y1 + y2) / 2 - 6;
  } else if (viaY !== undefined) {
    // VHV with explicit horizontal-segment y (caller knows the safe gutter)
    d = `M ${x1} ${y1} L ${x1} ${viaY} L ${x2} ${viaY} L ${x2} ${y2}`;
    labelX = (x1 + x2) / 2;
    labelY = viaY - 6;
  } else if (viaX !== undefined) {
    // HVH with explicit vertical-segment x (caller knows the safe gutter)
    d = `M ${x1} ${y1} L ${viaX} ${y1} L ${viaX} ${y2} L ${x2} ${y2}`;
    labelX = viaX;
    labelY = (y1 + y2) / 2 - 6;
  } else if (route === 'vhv') {
    const midY = (y1 + y2) / 2;
    d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    labelX = (x1 + x2) / 2;
    labelY = midY - 6;
  } else {
    // default elbow: HVH at midpoint (works for most short hops)
    const midX = (x1 + x2) / 2;
    d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    labelX = midX;
    labelY = (y1 + y2) / 2 - 6;
  }

  return (
    <g className={`dg-edge dg-status-${status || ''}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.3"
            strokeDasharray={dashed ? '4 3' : '0'}
            strokeLinejoin="round" strokeLinecap="round"
            markerEnd="url(#arrowhead)" opacity="0.9" />
      {label && (
        <text x={labelX} y={labelY} className="dg-edge-label" textAnchor="middle">{label}</text>
      )}
    </g>
  );
}

function ArrowDef() {
  return (
    <defs>
      <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
      </marker>
      <marker id="arrowhead-live" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--live)" />
      </marker>
    </defs>
  );
}

// ── Diagram 1: Phase Architecture (technical components) ─────────
function PhaseArchitectureDiagram() {
  // Layout: 4 columns × variable rows. Width 820, height 380 (scales via viewBox).
  // Server side (left) → wire → Browser side (right).
  const W = 880, H = 400;
  const cols = [
    { x: 30,  w: 180, title: 'SERVER · sidecar' },
    { x: 250, w: 180, title: 'WIRE' },
    { x: 470, w: 180, title: 'BROWSER · cockpit' },
    { x: 690, w: 180, title: 'DOM · panels' },
  ];
  const nodes = [
    // Server side
    { id: 'state',  x: 30,  y: 60,  w: 180, h: 50, label: 'sidecar JSON state', sub: 'ledger snapshot · 1Hz', kind: 'source', status: '' },
    { id: 'shell',  x: 30,  y: 140, w: 180, h: 50, label: 'renderShell()', sub: 'render-html.cjs · TARGET', kind: 'source', status: 'warn', badge: 'edit' },
    { id: 'sparkS', x: 30,  y: 220, w: 180, h: 50, label: 'sparkline.cjs', sub: 'new helper', kind: 'source', status: 'green', badge: 'new' },
    { id: 'attach', x: 30,  y: 300, w: 180, h: 50, label: 'attachSparklines()', sub: 'serve.cjs · new export', kind: 'source', status: 'green', badge: 'new' },
    // Wire
    { id: 'html',   x: 250, y: 140, w: 180, h: 50, label: 'rendered HTML', sub: 'initial payload', kind: 'artefact', status: '' },
    { id: 'sse',    x: 250, y: 60,  w: 180, h: 50, label: 'SSE stream', sub: 'pushes deltas on change', kind: 'artefact', status: 'active' },
    // Browser
    { id: 'client', x: 470, y: 140, w: 180, h: 50, label: 'client.js', sub: 'TARGET · rewrite', kind: 'actor', status: 'warn', badge: 'edit' },
    { id: 'css',    x: 470, y: 220, w: 180, h: 50, label: 'sgsd-design-system.css', sub: 'tokens · read-only', kind: 'source', status: 'done' },
    // DOM panels
    { id: 'p1',     x: 690, y: 50,  w: 180, h: 40, label: 'governing thought', sub: 'band 1', kind: 'sink', status: '' },
    { id: 'p2',     x: 690, y: 100, w: 180, h: 40, label: 'pipeline + telemetry', sub: 'band 2', kind: 'sink', status: '' },
    { id: 'p3',     x: 690, y: 150, w: 180, h: 40, label: 'rationale', sub: 'band 3', kind: 'sink', status: '' },
    { id: 'p4',     x: 690, y: 200, w: 180, h: 40, label: 'event tape', sub: 'live', kind: 'sink', status: 'active' },
    { id: 'p5',     x: 690, y: 250, w: 180, h: 40, label: 'alarms', sub: 'HMI', kind: 'sink', status: '' },
  ];
  const edges = [
    { x1: 210, y1: 85,  x2: 250, y2: 85,  status: 'active', label: 'push' },           // state → sse
    { x1: 210, y1: 165, x2: 250, y2: 165 },                                            // shell → html
    { x1: 210, y1: 245, x2: 470, y2: 245, dashed: true, curve: 'bezier' },             // sparkline.cjs → client (helper)
    { x1: 210, y1: 325, x2: 250, y2: 85, dashed: true, curve: 'bezier' },              // attach → sse
    { x1: 430, y1: 165, x2: 470, y2: 165 },                                            // html → client
    { x1: 430, y1: 85,  x2: 470, y2: 145, status: 'active', curve: 'bezier' },         // sse → client
    { x1: 470, y1: 245, x2: 470, y2: 200, dashed: true },                              // css → client (visual)
    { x1: 650, y1: 150, x2: 690, y2: 70,  curve: 'bezier' },                           // client → p1
    { x1: 650, y1: 160, x2: 690, y2: 120, curve: 'bezier' },                           // client → p2
    { x1: 650, y1: 170, x2: 690, y2: 170, curve: 'bezier' },                           // client → p3
    { x1: 650, y1: 180, x2: 690, y2: 220, status: 'active', curve: 'bezier' },         // client → p4 (tape)
    { x1: 650, y1: 190, x2: 690, y2: 270, curve: 'bezier' },                           // client → p5
  ];
  return (
    <div className="diagram-wrap">
      <div className="diagram-head">
        <span className="lbl">Phase 135 · dataflow</span>
        <span className="diagram-legend">
          <span className="dg-leg edit">edit</span>
          <span className="dg-leg new">new</span>
          <span className="dg-leg live">live</span>
          <span className="dg-leg readonly">read-only</span>
        </span>
      </div>
      <svg className="diagram" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="P135 architecture">
        <ArrowDef />
        {cols.map((c, i) => (
          <g key={i} className="dg-col">
            <line x1={c.x - 8} y1="34" x2={c.x + c.w + 8} y2="34" stroke="var(--line-dim)" strokeWidth="1" />
            <text x={c.x + c.w / 2} y="22" className="dg-col-title" textAnchor="middle">{c.title}</text>
          </g>
        ))}
        {edges.map((e, i) => <DiagramEdge key={i} {...e} />)}
        {nodes.map((n) => <DiagramNode key={n.id} {...n} />)}
      </svg>
    </div>
  );
}

// ── Diagram 2: SGSD Orchestration (agent flow) ───────────────────
function OrchestrationDiagram({ agents }) {
  const W = 880, H = 280;
  const nodes = [
    { id: 'orch',  x: 20,  y: 100, w: 130, h: 70, label: 'claude',         sub: 'design + planning',  kind: 'actor',  status: 'done',   badge: 'idle' },
    { id: 'exec',  x: 180, y: 100, w: 130, h: 70, label: 'codex/xhigh',    sub: 'implementation',     kind: 'actor',  status: 'active', badge: 'live' },
    { id: 'rev',   x: 340, y: 100, w: 130, h: 70, label: 'review/check',   sub: 'lint + typecheck',   kind: 'actor',  status: '',       badge: 'next' },
    { id: 'val',   x: 500, y: 100, w: 130, h: 70, label: 'evidence-validator', sub: 'self-test 53/53', kind: 'gate',  status: '' },
    { id: 'cp',    x: 660, y: 100, w: 130, h: 70, label: 'checkpoint',     sub: 'ledger.append',      kind: 'sink',   status: '' },
    { id: 'gate',  x: 660, y: 200, w: 130, h: 60, label: 'operator approval', sub: 'plan → execute',  kind: 'gate',   status: 'warn',   badge: 'open' },
    { id: 'me',    x: 340, y: 30,  w: 130, h: 50, label: 'milestone close', sub: 'v3.3 · CLOSE',      kind: 'sink',   status: '' },
  ];
  const e = (a, b, opts = {}) => ({
    x1: a.x + a.w, y1: a.y + a.h / 2,
    x2: b.x,       y2: b.y + b.h / 2,
    ...opts,
  });
  const n = (id) => nodes.find((x) => x.id === id);
  const edges = [
    e(n('orch'), n('exec'), { label: 'handoff · design pkg', status: 'done' }),
    e(n('exec'), n('rev'),  { label: 'next', dashed: true }),
    e(n('rev'),  n('val')),
    e(n('val'),  n('cp'),   { label: 'on green' }),
    { x1: n('exec').x + n('exec').w / 2, y1: n('exec').y + n('exec').h,
      x2: n('gate').x + n('gate').w / 2, y2: n('gate').y, status: 'warn', curve: 'bezier', label: 'awaits' },
    { x1: n('gate').x, y1: n('gate').y + n('gate').h / 2,
      x2: n('exec').x + n('exec').w, y2: n('exec').y + n('exec').h - 10, status: 'warn', curve: 'bezier', dashed: true, label: 'approve →' },
    { x1: n('cp').x + n('cp').w / 2, y1: n('cp').y,
      x2: n('me').x + n('me').w, y2: n('me').y + n('me').h / 2, curve: 'bezier' },
  ];
  return (
    <div className="diagram-wrap">
      <div className="diagram-head">
        <span className="lbl">SGSD orchestration · agent + gate flow</span>
        <span className="diagram-legend">
          <span className="dg-leg idle">idle</span>
          <span className="dg-leg live">live</span>
          <span className="dg-leg next">next</span>
          <span className="dg-leg gate">gate</span>
        </span>
      </div>
      <svg className="diagram" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Orchestration architecture">
        <ArrowDef />
        {edges.map((edge, i) => <DiagramEdge key={i} {...edge} />)}
        {nodes.map((node) => <DiagramNode key={node.id} {...node} />)}
      </svg>
    </div>
  );
}

// ── Diagram 3: Milestone Dependency ──────────────────────────────
function MilestoneDependencyDiagram({ map, selectedPhase, onSelectPhase }) {
  const W = 920, H = 360;
  // 3 milestone columns. Middle (current) is wide and contains phases inside.
  const cols = [
    { id: 'prev',    x: 20,  w: 160, label: 'v3.2 (done)',     focus: 'phase memory + briefs', status: 'done'  },
    { id: 'current', x: 200, w: 540, label: 'v3.3 (active)',   focus: 'operator comprehension system', status: 'active' },
    { id: 'next',    x: 760, w: 140, label: 'v3.4 (pending)',  focus: 'agent autonomy + recovery', status: '' },
  ];
  const phases = map.phases;
  const mainLane = phases.filter((p) => /^P12[89]|^P13[0-3]/.test(p.id));
  const p134 = phases.find((p) => p.id === 'P134');
  const p135 = phases.find((p) => p.id === 'P135');
  const close = phases.find((p) => p.id === 'CLOSE');

  const innerLeft = 220;
  const innerTop = 70;
  const chipW = 60, chipH = 30, gap = 8;

  const mainLaneNodes = mainLane.map((p, i) => ({
    ...p, x: innerLeft + i * (chipW + gap), y: innerTop, w: chipW, h: chipH,
  }));
  const t134Top = innerTop + 70;
  const t134Nodes = p134.sub.map((s, i) => ({
    ...s, x: innerLeft + 60 + i * (chipW + gap), y: t134Top, w: chipW, h: chipH,
  }));
  const p135Node = { ...p135, x: innerLeft + 60, y: t134Top + 70, w: chipW + 30, h: chipH };
  const closeNode = { ...close, x: innerLeft + 380, y: t134Top + 70, w: chipW + 20, h: chipH };

  const labelFor = (n) => {
    if (n.status === 'done') return '✓';
    if (n.status === 'paused') return '⏸';
    if (n.status === 'active') return 'NOW';
    return '';
  };

  const Chip = ({ node, displayLabel, fill, stroke, strokeWidth, dashed }) => {
    const isSelected = selectedPhase === node.id;
    return (
      <g
        className="ms-chip"
        data-selected={isSelected ? '1' : '0'}
        onClick={() => onSelectPhase(node.id)}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPhase(node.id); }}}
      >
        <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="3"
              fill={fill}
              stroke={isSelected ? 'var(--live)' : stroke}
              strokeWidth={isSelected ? 2.2 : (strokeWidth ?? 1)}
              strokeDasharray={dashed ? '3 2' : '0'} />
        {isSelected && (
          <rect x={node.x - 3} y={node.y - 3} width={node.w + 6} height={node.h + 6} rx="5"
                fill="none" stroke="var(--live)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        )}
        <text x={node.x + node.w / 2} y={node.y + 14} className="dg-label" textAnchor="middle">{displayLabel}</text>
        <text x={node.x + node.w / 2} y={node.y + 25} className="dg-sub" textAnchor="middle">{labelFor(node)}</text>
      </g>
    );
  };

  return (
    <div className="diagram-wrap">
      <div className="diagram-head">
        <span className="lbl">Milestone dependency · v3.2 → v3.3 → v3.4 · <em style={{fontStyle:'normal',color:'var(--ink)'}}>click any phase for context</em></span>
        <span className="diagram-legend">
          <span className="dg-leg done">done</span>
          <span className="dg-leg live">active</span>
          <span className="dg-leg paused">paused</span>
          <span className="dg-leg pending">pending</span>
        </span>
      </div>
      <svg className="diagram diagram-clickable" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Milestone dependency architecture">
        <ArrowDef />
        {/* milestone column frames */}
        {cols.map((c) => (
          <g key={c.id} className={`dg-col-frame dg-status-${c.status || 'pending'}`}>
            <rect x={c.x} y={20} width={c.w} height={H - 40} rx="4" ry="4"
                  fill="var(--bg-2)"
                  stroke={statusColorVar(c.status === 'active' ? 'active' : c.status === 'done' ? 'done' : '')}
                  strokeWidth="1.2"
                  strokeDasharray={c.status === '' ? '4 4' : '0'} />
            <text x={c.x + 12} y={42} className="dg-col-title">{c.label}</text>
            <text x={c.x + 12} y={58} className="dg-sub">{c.focus}</text>
          </g>
        ))}

        <g transform="translate(36, 100)">
          <text className="dg-sub" y="0">6 phases closed</text>
          <text className="dg-sub" y="20">memory + briefs landed</text>
          <text className="dg-sub" y="40">→ feeds v3.3</text>
        </g>
        <DiagramEdge x1={180} y1={H/2} x2={200} y2={H/2} status="done" />

        {/* main lane chips */}
        {mainLaneNodes.map((p) => (
          <Chip key={p.id} node={p} displayLabel={p.id}
                fill="var(--done-bg)" stroke={statusColorVar(p.status)} />
        ))}
        {mainLaneNodes.slice(0, -1).map((p, i) => (
          <DiagramEdge key={'mle-' + i} x1={p.x + p.w} y1={p.y + p.h / 2}
                       x2={mainLaneNodes[i + 1].x} y2={mainLaneNodes[i + 1].y + p.h / 2}
                       status="done" />
        ))}
        <DiagramEdge
          x1={mainLaneNodes[mainLaneNodes.length - 1].x + mainLaneNodes[mainLaneNodes.length - 1].w}
          y1={mainLaneNodes[mainLaneNodes.length - 1].y + chipH / 2}
          x2={t134Nodes[0].x}
          y2={t134Nodes[0].y + chipH / 2}
          viaY={(mainLaneNodes[0].y + chipH + t134Nodes[0].y) / 2}
          status="done"
          label="P134 · split"
        />
        {/* P134 sub-task chips (clickable) */}
        {t134Nodes.map((s) => (
          <Chip key={s.id} node={{...s, x: s.x, y: s.y, w: chipW, h: chipH}}
                displayLabel={s.id.replace('P134-','')}
                fill="var(--indigo-bg)"
                stroke={statusColorVar(s.status === 'paused' ? 'paused' : s.status)} />
        ))}
        {/* P135 highlight chip */}
        <Chip node={p135Node} displayLabel="P135"
              fill={selectedPhase === 'P135' ? 'var(--live-line)' : 'var(--live-bg)'}
              stroke="var(--live)" strokeWidth={1.8} />
        <DiagramEdge
          x1={mainLaneNodes[mainLaneNodes.length - 1].x + mainLaneNodes[mainLaneNodes.length - 1].w}
          y1={mainLaneNodes[mainLaneNodes.length - 1].y + chipH / 2}
          x2={p135Node.x}
          y2={p135Node.y + chipH / 2}
          viaY={(t134Nodes[0].y + chipH + p135Node.y) / 2}
          status="active"
        />
        <DiagramEdge x1={p135Node.x + p135Node.w} y1={p135Node.y + chipH / 2}
                     x2={closeNode.x} y2={closeNode.y + chipH / 2}
                     status="active" dashed />
        <DiagramEdge x1={t134Nodes[t134Nodes.length - 1].x + chipW} y1={t134Nodes[t134Nodes.length - 1].y + chipH / 2}
                     x2={closeNode.x} y2={closeNode.y + chipH / 2 - 6}
                     viaY={(t134Nodes[0].y + chipH + p135Node.y) / 2}
                     status="paused" dashed
                     label="resume after P135" />
        {/* CLOSE (clickable) */}
        <Chip node={closeNode} displayLabel="CLOSE"
              fill="var(--attn-bg)" stroke="var(--attn)" strokeWidth={1.2} dashed />

        <DiagramEdge x1={closeNode.x + closeNode.w} y1={closeNode.y + chipH / 2}
                     x2={760} y2={H / 2}
                     curve="bezier" />
        <g transform="translate(775, 100)">
          <text className="dg-sub" y="0">unlocked when</text>
          <text className="dg-sub" y="20">v3.3 CLOSE green</text>
          <text className="dg-sub" y="40">→ agent autonomy</text>
        </g>
      </svg>
    </div>
  );
}

// ── Phase detail panel — compact dossier with tabs (default: Summary)
function PhaseDetailPanel({ phaseId, detail, onClose }) {
  const [tab, setTab] = useStateA('summary');
  if (!detail) return null;
  const tabs = [
    { id: 'summary',  label: 'Summary' },
    { id: 'why',      label: 'Why' },
    { id: 'unlocks',  label: 'Unlocks' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'raw',      label: 'Raw' },
  ];
  const role = phaseId === 'CLOSE' ? 'gate' : phaseId.startsWith('P134') ? 'sub-task' : phaseId.startsWith('P135') ? 'this phase' : 'phase';
  const statusLabel =
    detail.duration?.includes('paused') ? 'paused' :
    detail.duration?.includes('flight') ? 'active' :
    detail.duration?.includes('not yet') ? 'pending' :
    'done';
  const statusTier =
    statusLabel === 'active'  ? 'live' :
    statusLabel === 'paused'  ? 'severe' :
    statusLabel === 'pending' ? 'attn' :
    'done';

  return (
    <div className="phase-dossier" role="region" aria-label={`Phase ${phaseId} dossier`}>
      <header className="pd-head">
        <span className="pd-id mono">{phaseId}</span>
        <span className={`pd-stat pd-stat-${statusTier}`}>{statusLabel}</span>
        <span className="pd-role">{role}</span>
        {onClose && (
          <button className="pd-close" onClick={onClose} aria-label="close dossier">×</button>
        )}
      </header>
      <h3 className="pd-title">{detail.title.replace(/^P\d+(-T\d+)?\s*·\s*/, '').replace(/\s*\(now\)$/, '')}</h3>
      <div className="pd-takeaway">{detail.eli5.split('.')[0]}.</div>
      <div className="pd-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
                  className={`pd-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="pd-tab-body">
        {tab === 'summary' && (
          <dl className="pd-dl">
            <div className="pd-dl-row"><dt>Why it ran</dt><dd dangerouslySetInnerHTML={{__html: archInlineMD(detail.why)}} /></div>
            <div className="pd-dl-row"><dt>Context</dt><dd dangerouslySetInnerHTML={{__html: archInlineMD(detail.context)}} /></div>
            <div className="pd-dl-row"><dt>Unlocks</dt><dd dangerouslySetInnerHTML={{__html: archInlineMD(detail.unlocks)}} /></div>
            <div className="pd-dl-row"><dt>Outcome</dt><dd dangerouslySetInnerHTML={{__html: archInlineMD(detail.outcome)}} /></div>
          </dl>
        )}
        {tab === 'why' && (
          <div className="pd-prose">
            <p dangerouslySetInnerHTML={{__html: archInlineMD(detail.why)}} />
            <p className="pd-aside" dangerouslySetInnerHTML={{__html: archInlineMD(detail.context)}} />
          </div>
        )}
        {tab === 'unlocks' && (
          <div className="pd-prose">
            <p dangerouslySetInnerHTML={{__html: archInlineMD(detail.unlocks)}} />
            <p className="pd-aside" dangerouslySetInnerHTML={{__html: archInlineMD(detail.outcome)}} />
          </div>
        )}
        {tab === 'evidence' && (
          <div className="pd-evidence">
            <span className="lbl">Files touched</span>
            <ul className="pd-files-list">
              {detail.files.map((f, i) => <li key={i} className="mono">{f}</li>)}
            </ul>
            <span className="lbl">Owner · duration</span>
            <p className="mono">{detail.owner} · {detail.duration}</p>
          </div>
        )}
        {tab === 'raw' && (
          <div className="pd-raw">
            <pre className="mono">{JSON.stringify({ id: phaseId, ...detail }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Memory typing helpers (Mesh Memory Lite) ─────────────────────
// Three types: observation · claim · decision.
// Claims carry validation: pending | validated | refuted.
function memNodeStyle(s) {
  // returns { fill, stroke, dashed, accent, badge, glyph }
  if (s.type === 'observation') {
    return { fill: 'var(--done-bg)', stroke: 'var(--done)', dashed: false, badge: 'obs', glyph: '◼' };
  }
  if (s.type === 'claim') {
    if (s.validation === 'validated') return { fill: 'var(--live-bg)', stroke: 'var(--live)',   dashed: false, badge: 'claim✓', glyph: '✓' };
    if (s.validation === 'refuted')   return { fill: 'var(--crit-bg)', stroke: 'var(--crit)',   dashed: true,  badge: 'claim✗', glyph: '✗' };
    return { fill: 'transparent', stroke: 'var(--attn)', dashed: true, badge: 'claim?', glyph: '·' };
  }
  if (s.type === 'decision') {
    return { fill: 'var(--attn-bg)', stroke: 'var(--attn)', dashed: false, accent: 'var(--attn)', badge: 'decn', glyph: '★', terminal: true };
  }
  return { fill: 'var(--bg-2)', stroke: 'var(--line-strong)', dashed: false };
}

// ── Memory Argument Map (Mesh Memory Lite) ───────────────────────
// Semantic quadrant layout:
//   top: OBSERVATIONS (observes)
//   right: VALIDATIONS (validates)
//   bottom: PENDING / REFUTED (pending / refutes)
//   left: DECISIONS / ORDERS (orders / constrains / recommends)
// Each connector enters the current-action center at a fixed port on its side
// and carries a readable relationship label. Click any source to inspect.
function MemoryGraph({ memory }) {
  const [selected, setSelected] = useStateA(null);
  const sources = memory.sources;

  // Derive relationship + zone from type/validation/kind
  const relFor = (s) => {
    if (s.type === 'observation' && s.kind === 'browser') return 'validates';
    if (s.type === 'observation') return 'observes';
    if (s.type === 'claim' && s.validation === 'validated') return 'validates';
    if (s.type === 'claim' && s.validation === 'pending')   return 'pending';
    if (s.type === 'claim' && s.validation === 'refuted')   return 'refutes';
    if (s.type === 'decision' && s.kind === 'precedent')    return 'constrains';
    if (s.type === 'decision' && s.kind === 'order')        return 'orders';
    if (s.type === 'decision' && s.kind === 'promotion')    return 'recommends';
    return '';
  };
  const zoneFor = (s) => {
    if (s.type === 'decision') return 'left';
    if (s.type === 'claim' && s.validation === 'validated') return 'right';
    if (s.type === 'claim')    return 'bottom';
    if (s.type === 'observation' && s.kind === 'browser') return 'right';
    return 'top';
  };
  const positioned = sources.map((s) => ({ ...s, relationship: relFor(s), zone: zoneFor(s) }));

  const top    = positioned.filter((s) => s.zone === 'top');
  const right  = positioned.filter((s) => s.zone === 'right');
  const bottom = positioned.filter((s) => s.zone === 'bottom');
  const left   = positioned.filter((s) => s.zone === 'left');

  // Summary counts
  const counts = {
    observes:    positioned.filter((s) => s.relationship === 'observes').length,
    validates:   positioned.filter((s) => s.relationship === 'validates').length,
    constrains:  positioned.filter((s) => ['orders','constrains','recommends'].includes(s.relationship)).length,
    pending:     positioned.filter((s) => s.relationship === 'pending').length,
    refutes:     positioned.filter((s) => s.relationship === 'refutes').length,
  };

  // Layout
  const W = 960, H = 540;
  const cx = W / 2, cy = H / 2;
  const centerW = 260, centerH = 92;
  const centerLeft = cx - centerW / 2, centerTop = cy - centerH / 2;
  const centerRight = cx + centerW / 2, centerBottom = cy + centerH / 2;

  const cardW = 168, cardH = 60;
  const padOuter = 32;
  const zoneTopY    = padOuter + 20;
  const zoneBotY    = H - padOuter - 20 - cardH;
  const zoneLeftX   = padOuter;
  const zoneRightX  = W - padOuter - cardW;

  const topGutterMid    = (zoneTopY + cardH + centerTop) / 2;
  const bottomGutterMid = (centerBottom + zoneBotY) / 2;
  const leftGutterMid   = (zoneLeftX + cardW + centerLeft) / 2;
  const rightGutterMid  = (centerRight + zoneRightX) / 2;

  // Place cards within zones
  const spread = (n, total, edge0, edge1) => {
    const usable = edge1 - edge0;
    const slot = usable / (n + 1);
    return Array.from({ length: n }, (_, i) => edge0 + slot * (i + 1));
  };
  const topXs    = spread(top.length, top.length, padOuter, W - padOuter).map((x) => x - cardW / 2);
  const bottomXs = spread(bottom.length, bottom.length, padOuter, W - padOuter).map((x) => x - cardW / 2);
  const leftYs   = spread(left.length, left.length, padOuter, H - padOuter).map((y) => y - cardH / 2);
  const rightYs  = spread(right.length, right.length, padOuter, H - padOuter).map((y) => y - cardH / 2);

  const topCards    = top.map((s, i)    => ({ ...s, x: topXs[i],    y: zoneTopY,         w: cardW, h: cardH }));
  const bottomCards = bottom.map((s, i) => ({ ...s, x: bottomXs[i], y: zoneBotY,         w: cardW, h: cardH }));
  const leftCards   = left.map((s, i)   => ({ ...s, x: zoneLeftX,   y: leftYs[i],        w: cardW, h: cardH }));
  const rightCards  = right.map((s, i)  => ({ ...s, x: zoneRightX,  y: rightYs[i],       w: cardW, h: cardH }));

  // Ports on center: distribute along each edge
  const portsTop    = spread(topCards.length,    topCards.length,    centerLeft + 6, centerRight - 6);
  const portsBottom = spread(bottomCards.length, bottomCards.length, centerLeft + 6, centerRight - 6);
  const portsLeft   = spread(leftCards.length,   leftCards.length,   centerTop  + 6, centerBottom - 6);
  const portsRight  = spread(rightCards.length,  rightCards.length,  centerTop  + 6, centerBottom - 6);

  // Card styling by type/validation
  const cardStyle = (c) => {
    if (c.type === 'observation')                                     return { fill: 'var(--done-bg)', stroke: 'var(--done)',  dashed: false };
    if (c.type === 'claim'  && c.validation === 'validated')          return { fill: 'var(--live-bg)', stroke: 'var(--live)',  dashed: false };
    if (c.type === 'claim'  && c.validation === 'refuted')            return { fill: 'var(--crit-bg)', stroke: 'var(--crit)',  dashed: true  };
    if (c.type === 'claim')                                           return { fill: 'transparent',    stroke: 'var(--attn)',  dashed: true  };
    if (c.type === 'decision')                                        return { fill: 'var(--attn-bg)', stroke: 'var(--attn)',  dashed: false };
    return { fill: 'var(--bg-2)', stroke: 'var(--line-strong)', dashed: false };
  };

  const Card = ({ c, anchor }) => {
    const st = cardStyle(c);
    const isSelected = selected === c.id;
    const refLabelColor = st.stroke;
    return (
      <g className="mem-arg-card" onClick={() => setSelected(isSelected ? null : c.id)} role="button" tabIndex={0} aria-label={c.label}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="3"
              fill={st.fill} stroke={isSelected ? 'var(--ink)' : st.stroke}
              strokeWidth={isSelected ? 2 : 1.3}
              strokeDasharray={st.dashed ? '4 3' : '0'} />
        <text x={c.x + 10} y={c.y + 16} className="dg-sub" style={{ fontWeight: 700, fill: refLabelColor, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.58rem' }}>
          {c.relationship}
        </text>
        <text x={c.x + 10} y={c.y + 34} className="dg-label">{c.label}</text>
        <text x={c.x + 10} y={c.y + 50} className="dg-sub" style={{ fontSize: '0.62rem' }}>
          {(c.detail || '').replace(/[`*]/g, '').slice(0, 28) + ((c.detail || '').length > 28 ? '…' : '')}
        </text>
      </g>
    );
  };

  return (
    <div className="diagram-wrap memory-arg">
      <div className="diagram-head">
        <span className="lbl">Evidence argument · why this action is happening</span>
        <span className="diagram-legend">
          <span className="dg-leg mem-obs">observes</span>
          <span className="dg-leg mem-decision">orders/constrains</span>
          <span className="dg-leg mem-claim-ok">validates</span>
          <span className="dg-leg mem-claim">pending</span>
          <span className="dg-leg mem-claim-bad">refutes</span>
        </span>
      </div>
      <p className="mem-arg-summary">
        Current action is supported by <strong className="ma-ct-obs">{counts.observes}</strong> observation{counts.observes === 1 ? '' : 's'},
        {' '}constrained by <strong className="ma-ct-dec">{counts.constrains}</strong> decision{counts.constrains === 1 ? '' : 's'},
        {' '}validated by <strong className="ma-ct-val">{counts.validates}</strong> check{counts.validates === 1 ? '' : 's'},
        {' '}with <strong className="ma-ct-pen">{counts.pending}</strong> pending and <strong className="ma-ct-ref">{counts.refutes}</strong> refuted claim{counts.refutes === 1 ? '' : 's'}.
      </p>
      <svg className="diagram diagram-clickable" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evidence argument map">
        <ArrowDef />

        {/* Zone headings */}
        <text x={cx} y={zoneTopY - 6} textAnchor="middle" className="mem-zone-lbl">▼ OBSERVATIONS</text>
        <text x={cx} y={H - 16} textAnchor="middle" className="mem-zone-lbl">▲ PENDING · REFUTED</text>
        <text x={zoneLeftX + cardW / 2} y={zoneLeftX} textAnchor="middle" className="mem-zone-lbl">DECISIONS · ORDERS ▶</text>
        <text x={zoneRightX + cardW / 2} y={zoneLeftX} textAnchor="middle" className="mem-zone-lbl">◀ VALIDATIONS</text>

        {/* Center current-action box */}
        <g>
          <rect x={centerLeft} y={centerTop} width={centerW} height={centerH} rx="4"
                fill="var(--live-bg)" stroke="var(--live)" strokeWidth="1.8" />
          <text x={cx} y={centerTop + 22} textAnchor="middle" className="dg-sub" style={{ fill: 'var(--live)' }}>current action</text>
          <text x={cx} y={centerTop + 46} textAnchor="middle" className="dg-label" style={{ fill: 'var(--live)', fontWeight: 700, fontSize: '0.95rem' }}>
            {memory.current_consumer}
          </text>
          <text x={cx} y={centerTop + 68} textAnchor="middle" className="dg-sub" style={{ fill: 'var(--live)' }}>
            {memory.current_action}
          </text>
        </g>

        {/* Connectors with relationship labels */}
        {topCards.map((c, i) => (
          <DiagramEdge key={c.id + '-edge'} x1={c.x + c.w / 2} y1={c.y + c.h} x2={portsTop[i]} y2={centerTop}
                       viaY={topGutterMid} status="done" label={c.relationship} />
        ))}
        {bottomCards.map((c, i) => (
          <DiagramEdge key={c.id + '-edge'} x1={c.x + c.w / 2} y1={c.y} x2={portsBottom[i]} y2={centerBottom}
                       viaY={bottomGutterMid}
                       status={c.relationship === 'refutes' ? 'severe' : 'warn'}
                       dashed label={c.relationship} />
        ))}
        {leftCards.map((c, i) => (
          <DiagramEdge key={c.id + '-edge'} x1={c.x + c.w} y1={c.y + c.h / 2} x2={centerLeft} y2={portsLeft[i]}
                       viaX={leftGutterMid} status="warn" label={c.relationship} />
        ))}
        {rightCards.map((c, i) => (
          <DiagramEdge key={c.id + '-edge'} x1={c.x} y1={c.y + c.h / 2} x2={centerRight} y2={portsRight[i]}
                       viaX={rightGutterMid} status="active" label={c.relationship} />
        ))}

        {/* Cards */}
        {topCards.map((c) => <Card key={c.id} c={c} anchor="top" />)}
        {bottomCards.map((c) => <Card key={c.id} c={c} anchor="bottom" />)}
        {leftCards.map((c) => <Card key={c.id} c={c} anchor="left" />)}
        {rightCards.map((c) => <Card key={c.id} c={c} anchor="right" />)}
      </svg>

      {/* Inspector */}
      {selected && (() => {
        const s = positioned.find((x) => x.id === selected);
        if (!s) return null;
        const st = cardStyle(s);
        return (
          <div className="mem-inspector" data-rel={s.relationship}>
            <div className="mai-head">
              <span className="mai-rel" style={{ color: st.stroke, borderColor: st.stroke }}>{s.relationship}</span>
              <h3 className="mai-title">{s.label}</h3>
              <button className="mai-close" onClick={() => setSelected(null)} aria-label="close inspector">×</button>
            </div>
            <div className="mai-body">
              <div className="mai-row">
                <span className="lbl">Type</span>
                <span>{s.type}{s.validation ? ' · ' + s.validation : ''}{s.kind ? ` · ${s.kind}` : ''}</span>
              </div>
              <div className="mai-row">
                <span className="lbl">Why it matters</span>
                <span dangerouslySetInnerHTML={{ __html: archInlineMD(s.detail) }} />
              </div>
              <div className="mai-row">
                <span className="lbl">Consumed by</span>
                <span>{s.consumed_by.length ? s.consumed_by.join(', ') : '— not currently consumed'}</span>
              </div>
              {s.pending && (
                <div className="mai-row">
                  <span className="lbl">Status</span>
                  <span style={{ color: 'var(--attn)' }}>awaiting operator decision</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Fallback list view */}
      <ul className="memory-list">
        {memory.sources.map((s) => {
          const st = memNodeStyle(s);
          return (
            <li key={s.id}
                data-active={s.consumed_by.includes('codex') ? 'codex' : (s.consumed_by.includes('claude') ? 'claude' : 'none')}
                data-mem-type={s.type}
                data-validation={s.validation || ''}
                onClick={() => setSelected(s.id)}
                style={{ cursor: 'pointer' }}>
              <span className={`mem-kind mem-type-${s.type}`}>{s.type}{s.validation ? ' · ' + s.validation : ''}</span>
              <span className="mem-label">{st.glyph} {s.label}</span>
              <span className="mem-detail" dangerouslySetInnerHTML={{ __html: archInlineMD(s.detail) }} />
              <span className="mem-consumed">{s.consumed_by.length ? '→ ' + s.consumed_by.join(', ') : '— not currently consumed'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Lineage Chain (receipt → review → evidence → recommendation → promotion) ─
function LineageChain({ lineage }) {
  return (
    <div className="lineage-wrap">
      <div className="diagram-head">
        <span className="lbl">{lineage.title}</span>
        <span className="diagram-legend">
          <span className="dg-leg mem-obs">obs</span>
          <span className="dg-leg mem-claim-ok">claim ✓</span>
          <span className="dg-leg mem-claim">claim ?</span>
          <span className="dg-leg mem-decision">decision</span>
        </span>
      </div>
      <ol className="lineage" role="list">
        {lineage.steps.map((step, i) => {
          const st = memNodeStyle(step);
          const isLast = i === lineage.steps.length - 1;
          return (
            <li key={step.id} className="lineage-step"
                data-mem-type={step.type}
                data-validation={step.validation || ''}
                data-terminal={step.terminal ? '1' : '0'}>
              <div className="ls-rail">
                <span className="ls-node" style={{ borderColor: st.stroke, background: st.fill, borderStyle: st.dashed ? 'dashed' : 'solid' }}>
                  <span className="ls-glyph" style={{ color: st.stroke }}>{step.icon || st.glyph}</span>
                </span>
                {!isLast && <span className="ls-link" />}
              </div>
              <div className="ls-body">
                <div className="ls-head">
                  <span className="ls-stage mono">{step.stage}</span>
                  <span className={`ls-type-badge mem-type-${step.type}`}>
                    {step.type}{step.validation ? ` · ${step.validation}` : ''}
                  </span>
                  {step.pending && <span className="ls-pending">pending</span>}
                </div>
                <div className="ls-title">{step.label}</div>
                <div className="ls-detail">{step.detail}</div>
                <div className="ls-meta">{step.meta}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Gate Flow Diagram (predicate chain — like runway, but for gates) ──
function GateFlowDiagram({ gateFlow, onSelectStage, selectedStage }) {
  const stages = gateFlow.stages;
  const W = 920, H = 220;
  const padX = 24;
  const gateW = (W - padX * 2 - (stages.length - 1) * 14) / stages.length;
  const gateH = 124;
  const gateY = 56;
  const colorFor = (v) =>
    v === 'green'   ? 'var(--done)' :
    v === 'warn'    ? 'var(--attn)' :
    v === 'severe'  ? 'var(--severe)' :
    v === 'fail'    ? 'var(--crit)' :
                      'var(--ink-faint)';
  const bgFor = (v) =>
    v === 'green'   ? 'var(--done-bg)' :
    v === 'warn'    ? 'var(--attn-bg)' :
    v === 'severe'  ? 'var(--severe-bg)' :
    v === 'fail'    ? 'var(--crit-bg)' :
                      'var(--bg-2)';
  const positions = stages.map((s, i) => ({
    ...s, x: padX + i * (gateW + 14), y: gateY, w: gateW, h: gateH,
  }));
  const conceptsAt = (s) => [...new Set(s.gates.filter((x) => x.concept).map((x) => x.concept))];
  return (
    <div className="diagram-wrap">
      <div className="diagram-head">
        <span className="lbl">Gate flow · stage-keyed predicate chain · click a stage for sub-gates</span>
        <span className="diagram-legend">
          <span className="dg-leg done">passed</span>
          <span className="dg-leg gate">blocking</span>
          <span className="dg-leg pending">pending</span>
        </span>
      </div>
      <svg className="diagram diagram-clickable" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gate stage chain">
        <ArrowDef />
        <text x={W / 2} y={32} textAnchor="middle" className="mem-zone-lbl">
          CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE
        </text>
        {positions.slice(0, -1).map((g, i) => (
          <DiagramEdge key={'gf-' + i} x1={g.x + g.w} y1={g.y + g.h / 2}
            x2={positions[i + 1].x} y2={positions[i + 1].y + g.h / 2}
            status={g.verdict === 'green' ? 'done' : g.verdict === 'warn' ? 'warn' : ''} />
        ))}
        {positions.map((g) => {
          const isSelected = selectedStage === g.id;
          const greens = g.gates.filter((x) => x.status === 'green').length;
          const warns  = g.gates.filter((x) => x.status === 'warn').length;
          const pends  = g.gates.filter((x) => x.status === 'pending').length;
          const skips  = g.gates.filter((x) => x.status === 'skipped').length;
          return (
            <g key={g.id} className="gate-cell" style={{ cursor: 'pointer' }}
               onClick={() => onSelectStage && onSelectStage(isSelected ? null : g.id)}
               role="button" tabIndex={0}>
              <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="4"
                    fill={bgFor(g.verdict)}
                    stroke={isSelected ? 'var(--ink)' : colorFor(g.verdict)}
                    strokeWidth={isSelected ? 2.2 : (g.blocking ? 2 : 1.3)}
                    strokeDasharray={g.verdict === 'pending' ? '4 3' : '0'} />
              {g.blocking && <rect x={g.x} y={g.y} width={g.w} height={3} fill={colorFor(g.verdict)} />}
              <text x={g.x + g.w / 2} y={g.y + 22} className="dg-sub" textAnchor="middle"
                    style={{ fontWeight: 700, fill: colorFor(g.verdict), letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                {g.verdict}{g.blocking ? ' · BLOCKING' : ''}
              </text>
              <text x={g.x + g.w / 2} y={g.y + 46} className="dg-label" textAnchor="middle"
                    style={{ fontWeight: 700, fontSize: '0.95rem' }}>{g.name}</text>
              <foreignObject x={g.x + 6} y={g.y + 52} width={g.w - 12} height={28}>
                <div style={{font:'500 0.66rem/1.35 var(--mono)',color:'var(--ink-mid)',textAlign:'center',paddingTop:'0.3rem'}}>{g.summary}</div>
              </foreignObject>
              {/* Concept gates (ATC / MUDA) firing at this stage */}
              {conceptsAt(g).length > 0 && (
                <foreignObject x={g.x + 6} y={g.y + g.h - 50} width={g.w - 12} height={20}>
                  <div style={{display:'flex',justifyContent:'center',gap:'4px',font:'700 0.56rem/1 var(--sans)',letterSpacing:'0.08em'}}>
                    {conceptsAt(g).map((c) => (
                      <span key={c} style={{
                        color: c === 'ATC' ? 'var(--live)' : 'var(--severe)',
                        background: c === 'ATC' ? 'var(--live-bg)' : 'var(--severe-bg)',
                        border: `1px solid ${c === 'ATC' ? 'var(--live-line)' : 'var(--severe-line)'}`,
                        padding: '0.18rem 0.42rem', borderRadius: '2px',
                      }}>{c}</span>
                    ))}
                  </div>
                </foreignObject>
              )}
              <foreignObject x={g.x + 6} y={g.y + g.h - 28} width={g.w - 12} height={22}>
                <div style={{display:'flex',justifyContent:'center',gap:'4px',font:'600 0.6rem/1 var(--mono)',letterSpacing:'0.04em'}}>
                  <span style={{color:'var(--done)',padding:'0.16rem 0.36rem',background:'var(--done-bg)',borderRadius:'2px'}}>{greens}✓</span>
                  {warns > 0 && <span style={{color:'var(--attn)',padding:'0.16rem 0.36rem',background:'var(--attn-bg)',borderRadius:'2px'}}>{warns}!</span>}
                  {pends > 0 && <span style={{color:'var(--ink-mid)',padding:'0.16rem 0.36rem',background:'var(--bg-2)',borderRadius:'2px',border:'1px solid var(--line)'}}>{pends}·</span>}
                  {skips > 0 && <span style={{color:'var(--ink-dim)',padding:'0.16rem 0.36rem',background:'var(--bg-2)',borderRadius:'2px'}}>{skips}~</span>}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GateRegistryTable({ stages, selectedStage }) {
  const focus = selectedStage ? stages.filter((s) => s.id === selectedStage) : stages;
  return (
    <div className="gate-reg">
      <div className="gate-reg-head">
        <span className="lbl">Registered gates · {selectedStage ? `${selectedStage} stage` : 'all stages'}</span>
        <span className="meta">{focus.reduce((n, s) => n + s.gates.length, 0)} gates · click stage above to filter</span>
      </div>
      {focus.map((stage) => (
        <div key={stage.id} className="gate-reg-stage">
          <div className="grs-head">
            <span className={`grs-name stage-${stage.verdict}`}>{stage.name}</span>
            <span className="grs-summary">{stage.summary}</span>
          </div>
          <ul className="gate-reg-list">
            {stage.gates.map((g) => (
              <li key={g.name} data-status={g.status}>
                <span className={`gr-status gs-${g.status}`}>{g.status}</span>
                <span className="gr-name mono">
                  {g.name}
                  {g.concept && <span className={`gr-concept gc-${g.concept.toLowerCase()}`}>{g.concept}</span>}
                </span>
                <span className="gr-detail">{g.detail}</span>
                <span className="gr-mode mono" title="enforcement mode">{g.mode}</span>
                <span className="gr-sampling mono" title="sampling tier">{g.sampling}</span>
                {g.repair && <div className="gr-repair"><span className="lbl">repair</span><code className="mono">{g.repair}</code></div>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ATCHistory({ history }) {
  const tierColor = { SKIP: 'var(--ink-dim)', LITE: 'var(--done)', FULL: 'var(--live)', GATE: 'var(--attn)' };
  const tierChecks = {
    SKIP: 'no check · skipped',
    LITE: 'delete · simplify',
    FULL: '7-step · 10-pt anti-slop',
    GATE: '7-step · 10-pt · deliberate',
  };
  return (
    <div className="atc-history">
      <div className="atc-head">
        <span className="lbl">ATC tier history · per-dispatch quality discipline</span>
        <span className="meta">{history.length} dispatches · {history.reduce((n, h) => n + h.tokens, 0)} tokens</span>
      </div>
      <div className="atc-legend">
        <span className="atc-leg-cell"><span className="atc-leg-tag" style={{color:'var(--ink-dim)',borderColor:'var(--line-strong)'}}>SKIP</span>&lt; 10 lines · 1 file</span>
        <span className="atc-leg-cell"><span className="atc-leg-tag" style={{color:'var(--done)',borderColor:'var(--done-line)'}}>LITE</span>10–50 lines · ≤ 3 files</span>
        <span className="atc-leg-cell"><span className="atc-leg-tag" style={{color:'var(--live)',borderColor:'var(--live-line)'}}>FULL</span>50+ lines · 4+ files</span>
        <span className="atc-leg-cell"><span className="atc-leg-tag" style={{color:'var(--attn)',borderColor:'var(--attn-line)'}}>GATE</span>new system / API / arch</span>
      </div>
      <ul className="atc-list">
        {history.map((h) => (
          <li key={h.dispatch} data-tier={h.tier} data-verdict={h.verdict.startsWith('pass') ? 'pass' : 'fail'}>
            <span className="atc-disp mono">#{h.dispatch}</span>
            <span className="atc-tier" style={{ color: tierColor[h.tier], borderColor: tierColor[h.tier], background: 'var(--bg-2)' }}>{h.tier}</span>
            <span className="atc-checks mono">{tierChecks[h.tier]}</span>
            <span className="atc-verdict">{h.verdict}</span>
            <span className="atc-tokens mono">{h.tokens}t</span>
            {h.note && <span className="atc-note">{h.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MudaProbes({ probes }) {
  return (
    <div className="muda-probes">
      <div className="muda-head">
        <span className="lbl">MUDA · lean waste audit · 5 probes</span>
        <span className="meta">fires at phase close when files_changed ≥ 4 OR diff_lines ≥ 100</span>
      </div>
      <ul className="muda-list">
        {probes.map((p, i) => (
          <li key={i} data-status={p.status}>
            <span className={`muda-status ms-${p.status}`}>{p.status}</span>
            <span className="muda-name mono">{p.name}</span>
            <span className="muda-class">{p.waste_class}</span>
            <span className="muda-detail">{p.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Learnings Panel (memory bank · caught bugs · lessons · precedents) ──
function LearningsPanel({ learnings }) {
  const [filter, setFilter] = useStateA('all');
  const kinds = ['all', 'bug', 'regression', 'gotcha', 'lesson', 'precedent'];
  const counts = kinds.reduce((acc, k) => {
    acc[k] = k === 'all' ? learnings.length : learnings.filter((l) => l.kind === k).length;
    return acc;
  }, {});

  const filtered = filter === 'all' ? learnings : learnings.filter((l) => l.kind === filter);

  const ageStr = (secs) => {
    if (secs < 3600) return Math.floor(secs / 60) + 'm';
    if (secs < 86400) return Math.floor(secs / 3600) + 'h';
    return Math.floor(secs / 86400) + 'd';
  };

  return (
    <div className="learnings">
      <div className="learnings-head">
        <span className="lbl">Memory bank · caught bugs · lessons · precedents</span>
        <span className="meta">{learnings.length} entries</span>
      </div>
      <div className="learnings-filter" role="tablist">
        {kinds.map((k) => (
          <button
            key={k} role="tab" aria-selected={filter === k}
            className={`lf-tab ${filter === k ? 'active' : ''} kind-${k}`}
            onClick={() => setFilter(k)}>
            {k} <span className="lf-count">{counts[k]}</span>
          </button>
        ))}
      </div>
      <ul className="learnings-list">
        {filtered.map((l) => (
          <li key={l.id} data-kind={l.kind}>
            <div className="ll-head">
              <span className={`ll-kind kind-${l.kind}`}>{l.kind}</span>
              <span className="ll-phase mono">{l.phase}</span>
              <span className="ll-title">{l.title}</span>
              <span className="ll-age mono">{ageStr(l.age_sec)} ago</span>
              {l.resolved && <span className="ll-resolved">✓ resolved</span>}
            </div>
            <div className="ll-detail" dangerouslySetInnerHTML={{ __html: archInlineMD(l.detail) }} />
            <div className="ll-fix">
              <span className="lbl">fix</span>
              <span dangerouslySetInnerHTML={{ __html: archInlineMD(l.fix) }} />
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="ll-empty">no entries match filter <code>{filter}</code></li>
        )}
      </ul>
    </div>
  );
}
function EvidencePanel({ evidence }) {
  return (
    <div className="evidence">
      <div className="ev-summary">
        <div className="ev-summary-cell" data-tier="green">
          <span className="num">{evidence.summary.green}</span>
          <span className="lbl">green</span>
        </div>
        <div className="ev-summary-cell" data-tier="warn">
          <span className="num">{evidence.summary.warn}</span>
          <span className="lbl">warn</span>
        </div>
        <div className="ev-summary-cell" data-tier="fail">
          <span className="num">{evidence.summary.fail}</span>
          <span className="lbl">fail</span>
        </div>
        <div className="ev-summary-cell" data-tier="pending">
          <span className="num">{evidence.summary.pending}</span>
          <span className="lbl">pending</span>
        </div>
      </div>

      <div className="ev-grid">
        {evidence.categories.map((cat) => (
          <div key={cat.name} className="ev-cat">
            <h4>{cat.name}</h4>
            <ul>
              {cat.items.map((it) => (
                <li key={it.code} data-status={it.status}>
                  <span className="ev-pip" aria-hidden="true"></span>
                  <span className="ev-code mono">{it.code}</span>
                  <span className="ev-detail">{it.detail}</span>
                  {typeof it.last_run_sec === 'number' && <span className="ev-age">{Math.round(it.last_run_sec / 60)}m ago</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {evidence.unresolved.length > 0 && (
        <div className="ev-unresolved">
          <h4 className="lbl">Unresolved findings · {evidence.unresolved.length}</h4>
          <ul>
            {evidence.unresolved.map((u, i) => (
              <li key={i} data-tier={u.tier}>
                <span className="ev-code mono">{u.code}</span>
                <span>{u.detail}</span>
                <span className="ev-age">{Math.round(u.age_sec / 60)}m ago</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          className={`tab ${t.id === active ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-glyph" aria-hidden="true">{t.glyph}</span>
          <span className="tab-label">{t.label}</span>
          {typeof t.count === 'number' && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, {
  MissionCard, MilestoneStrip, ScanBar, ExplanationBand, CollapsibleSection,
  PhaseArchitectureDiagram, OrchestrationDiagram, MilestoneDependencyDiagram, PhaseDetailPanel,
  MemoryGraph, LineageChain, EvidencePanel, GateFlowDiagram, GateRegistryTable, ATCHistory, MudaProbes, LearningsPanel, Tabs,
  archInlineMD, memNodeStyle,
});
