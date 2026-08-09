// mc-components.jsx — mission control building blocks
// CommandStrip, PhaseRunway, TelemetryRail, AlarmList, EventTape, RationaleLayer

const { useState, useEffect, useRef, useMemo } = React;

// ── format helpers ──
function fmtClock(secs) {
  const sign = secs < 0 ? '-' : '';
  const s = Math.abs(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${sign}${m}:${String(r).padStart(2, '0')}`;
}
function fmtAge(secs) {
  if (secs < 60) return secs + 's';
  if (secs < 3600) return Math.floor(secs / 60) + 'm';
  return Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
}
function fmtKilo(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}
function inlineMD(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

// ── AgentLanes ──
function AgentLanes({ agents }) {
  const handoff = agents.last_handoff;
  return (
    <div className="agents">
      <AgentLane agent={agents.claude} />
      <div className="handoff" aria-label="last handoff">
        <span className="handoff-arrow" aria-hidden="true">→</span>
        <span className="handoff-meta">
          <span className="lbl">handoff · {fmtAge(Math.abs(handoff.t_off))} ago</span>
          <span className="handoff-kind">{handoff.kind}</span>
          <span className="handoff-payload mono">{handoff.payload}</span>
        </span>
      </div>
      <AgentLane agent={agents.codex} align="right" />
    </div>
  );
}

function AgentLane({ agent, align }) {
  const isCodex = !!agent.effort;
  return (
    <div className={`agent-lane ${align === 'right' ? 'right' : ''}`} data-status={agent.status}>
      <div className="agent-head">
        <span className="agent-pip" aria-hidden="true"></span>
        <span className="agent-handle">{agent.handle}</span>
        <span className="agent-role">{agent.role}</span>
        <span className="spacer"></span>
        <span className="agent-status">{agent.status}</span>
      </div>
      <div className="agent-meta mono">
        <span>model <b>{agent.model}</b></span>
        {isCodex && <span>effort <b>{agent.effort}</b></span>}
        {agent.tool_state && <span>state <b>{agent.tool_state}</b></span>}
        {agent.inference_state && agent.inference_state !== 'idle' && (
          <span className="warn">inference <b>{agent.inference_state}</b></span>
        )}
        {typeof agent.in_bytes === 'number' && <span>in <b>{agent.in_bytes}B</b></span>}
        {typeof agent.jsonl_age_sec === 'number' && (
          <span>jsonl <b>{fmtAge(agent.jsonl_age_sec)}</b></span>
        )}
      </div>
      <div className="agent-task">{agent.task}</div>
      {agent.recent_actions && agent.recent_actions.length > 0 && (
        <div className="agent-recent">
          <span className="lbl">recent</span>
          <ul>
            {agent.recent_actions.slice(0, 3).map((a, i) => (
              <li key={i}>
                <span className="ra-kind">{a.kind}</span>
                <span className="ra-detail mono">{a.detail}</span>
                <span className="ra-age">{fmtAge(a.age_sec)} ago</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── CommandStrip ──
function CommandStrip({ snapshot, timeLeft, onPause, paused }) {
  const timeTier = timeLeft < 60 ? 'crit' : timeLeft < 300 ? 'warn' : '';

  return (
    <section className="command" aria-label="Command strip">
      <div className="cmd-cell cmd-obj">
        <span className="lbl"><span className="pip"></span>Objective</span>
        <span className="val">
          <span className="ms">{snapshot.objective.milestone}</span>
          <span className="ph"> / P{snapshot.objective.phase}</span>{' '}
          {snapshot.objective.name}
        </span>
      </div>

      <div className="cmd-cell cmd-next">
        <span className="lbl"><span className="pip"></span>Next action</span>
        <span className="val">
          <span className="verb">{snapshot.next_action.verb}</span>{' '}
          {snapshot.next_action.target}
        </span>
      </div>

      <div className="cmd-cell cmd-owner">
        <span className="lbl"><span className="pip"></span>Owner</span>
        <span className="val">{snapshot.owner.handle}</span>
      </div>

      <div className="cmd-cell cmd-risk" data-tier={snapshot.risk.tier}>
        <span className="lbl"><span className="pip"></span>Risk</span>
        <span className="val">{snapshot.risk.label}</span>
      </div>

      <div className="cmd-cell cmd-time">
        <span className="lbl"><span className="pip"></span>Time left · plan</span>
        <span className={`val ${timeTier}`}>
          {fmtClock(timeLeft)}<span className="unit">m:ss</span>
        </span>
      </div>

      <div className="cmd-ctrls">
        <button className="ctrl primary" title="Approve · A">
          Approve <kbd>A</kbd>
        </button>
        <button className="ctrl" onClick={onPause} title="Pause · P">
          {paused ? 'Resume' : 'Pause'} <kbd>P</kbd>
        </button>
        <button className="ctrl" title="Open phase · O">
          Open <kbd>O</kbd>
        </button>
        <button className="ctrl danger" title="Abort · Esc">
          Abort
        </button>
      </div>
    </section>
  );
}

// ── PhaseRunway ──
function PhaseRunway({ pipeline, activeElapsedSec, variant = 'lane' }) {
  const [hover, setHover] = useState(null);
  const stages = pipeline.stages;
  const n = stages.length;
  const activeIdx = pipeline.active_index;

  // Track fill: 0..activeIdx fully done, plus partial progress through active.
  const activeStage = stages[activeIdx];
  const activeProgress = activeStage ? Math.min(1, activeElapsedSec / (activeStage.sla_min * 60)) : 0;
  const segPct = 100 / (n - 1);
  const donePct = activeIdx * segPct;
  const activePct = activeProgress * segPct;

  return (
    <div className="runway">
      <div className="runway-rail">
        <div className="runway-track" role="progressbar"
             aria-valuenow={activeIdx + activeProgress} aria-valuemin={0} aria-valuemax={n - 1}>
          <span className="runway-track-done" style={{ width: `${donePct}%` }} />
          <span className="runway-track-active" style={{ left: `${donePct}%`, width: `${activePct}%` }} />
        </div>
        <div className="runway-stops">
          {stages.map((s, i) => {
            const elapsedSec = s.status === 'active' ? activeElapsedSec : s.elapsed_sec;
            const remainingSec = Math.max(0, s.sla_min * 60 - elapsedSec);
            const etaTier = s.status === 'active' && remainingSec < 60 ? 'crit'
                          : s.status === 'active' && remainingSec < 300 ? 'warn'
                          : '';
            return (
              <div
                key={s.name}
                className="stop"
                data-status={s.status}
                onMouseEnter={() => setHover(s.name)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.name)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${s.name} stage, ${s.status}`}
              >
                <span className="stop-meta">
                  {s.status === 'done' && '✓ done'}
                  {s.status === 'active' && `${fmtClock(elapsedSec)} elapsed`}
                  {s.status === 'pending' && `${s.sla_min}m sla`}
                  {s.status === 'blocked' && 'blocked'}
                </span>
                <span className="stop-pip" aria-hidden="true"></span>
                <span className="stop-label">{s.name}</span>
                <span className="stop-sub">{s.owner}</span>
                {hover === s.name && (
                  <div className="stop-tt" role="tooltip">
                    <dl style={{ margin: 0 }}>
                      <div className="stop-tt-row"><dt>stage</dt><dd>{s.name}</dd></div>
                      <div className="stop-tt-row"><dt>owner</dt><dd>{s.owner}</dd></div>
                      <div className="stop-tt-row"><dt>sla</dt><dd>{s.sla_min}m</dd></div>
                      <div className="stop-tt-row">
                        <dt>status</dt>
                        <dd className={s.status === 'active' ? 'live' : s.status === 'done' ? 'ok' : ''}>{s.status}</dd>
                      </div>
                      {s.status === 'active' && (
                        <>
                          <div className="stop-tt-row"><dt>elapsed</dt><dd>{fmtClock(elapsedSec)}</dd></div>
                          <div className="stop-tt-row"><dt>remaining</dt><dd className={etaTier}>~ {fmtClock(remainingSec)}</dd></div>
                        </>
                      )}
                      {s.status === 'pending' && (
                        <div className="stop-tt-row"><dt>eta</dt><dd>{s.eta_label}</dd></div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="runway-foot">
        <div className="field">
          <span className="lbl">Why running</span>
          <span className="val">{pipeline.why_running}</span>
        </div>
        <div className="field">
          <span className="lbl">Unlocks</span>
          <span className="val muted">{pipeline.unlocks}</span>
        </div>
        <div className="field blocker">
          <span className="lbl">Blocked-by</span>
          <span className={`val ${pipeline.blocker ? '' : 'ok'}`}>
            {pipeline.blocker ? <code>{pipeline.blocker}</code> : 'nothing — clear to run'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Sparkline ──
function Sparkline({ values, color = 'var(--ink-mid)', target }) {
  if (!values || values.length < 2) return <svg className="telem-spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values, target ?? -Infinity);
  const range = (max - min) || 1;
  const w = 100, h = 30, pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const pathD = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const areaD = pathD + ` L${pts[pts.length - 1][0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`;
  const lastPt = pts[pts.length - 1];
  return (
    <svg className="telem-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={areaD} fill={color} opacity="0.10" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="1.6" fill={color} />
    </svg>
  );
}

// ── TelemetryRail ──
function TelemetryRail({ telemetry }) {
  const cells = [telemetry.fog, telemetry.dispatches, telemetry.tokens, telemetry.context, telemetry.elapsed];
  return (
    <div className="telem">
      {cells.map((m) => (
        <TelemetryCell key={m.key} metric={m} />
      ))}
    </div>
  );
}

const TIER_COLORS = {
  ok: 'var(--done)',
  attn: 'var(--attn)',
  severe: 'var(--severe)',
  crit: 'var(--crit)',
};

function TelemetryCell({ metric }) {
  const tier = metric.tier_for(metric.value);
  const color = TIER_COLORS[tier] || 'var(--ink-mid)';
  const fmt = metric.formatter || ((v) => metric.unit === '%' ? `${Math.round(v)}%` : (v >= 1000 ? fmtKilo(v) : String(Math.round(v))));
  const prev = metric.history[metric.history.length - 2] ?? metric.value;
  const delta = metric.value - prev;
  const deltaDir = Math.abs(delta) < (metric.max * 0.002) ? 'flat' : delta > 0 ? 'up' : 'down';
  const fillPct = Math.min(100, (metric.value / metric.max) * 100);
  const targetPct = Math.min(100, (metric.target / metric.max) * 100);
  const normalPct = (metric.normal_max / metric.max) * 100;
  const attnPct = (metric.attn_max / metric.max) * 100;
  const severePct = (metric.severe_max / metric.max) * 100;

  return (
    <div className="telem-cell" data-tier={tier}>
      <div className="telem-top">
        <span className="lbl">{metric.label}</span>
        <span className={`telem-delta ${deltaDir}`}>
          {deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '·'}
          {Math.abs(delta) > 0.01 ? ` ${fmt(Math.abs(delta))}` : ' ·'}
        </span>
      </div>
      <div className="telem-top" style={{ alignItems: 'flex-end' }}>
        <span className="telem-num">{fmt(metric.value)}</span>
      </div>
      <Sparkline values={metric.history} color={color} target={metric.target} />
      <div className="telem-range" aria-hidden="true">
        <span className="telem-range-fill" data-tier={tier} style={{ width: `${fillPct}%` }} />
        <span className="telem-range-tick" style={{ left: `${normalPct}%` }} />
        <span className="telem-range-tick" style={{ left: `${attnPct}%` }} />
        <span className="telem-range-tick" style={{ left: `${severePct}%` }} />
        <span className="telem-range-target" style={{ left: `${targetPct}%` }} />
      </div>
      <div className="telem-foot">
        <span>0</span>
        <span>tgt {fmt(metric.target)}</span>
        <span>{fmt(metric.max)}</span>
      </div>
    </div>
  );
}

// ── AlarmList ──
function AlarmList({ alarms }) {
  const [openId, setOpenId] = useState(null);

  if (!alarms.length) {
    return (
      <div style={{ padding: '1rem', color: 'var(--ink-mid)', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
        no active alarms — clear to run
      </div>
    );
  }

  return (
    <div className="alarms" role="list">
      {alarms.map((a) => (
        <div
          key={a.id}
          className="alarm"
          data-tier={a.tier}
          role="listitem"
          onClick={() => setOpenId(openId === a.id ? null : a.id)}
        >
          <span className="alarm-sev" aria-hidden="true">{a.severity_label}</span>
          <div className="alarm-body">
            <span className="alarm-signal">
              <code>{a.signal}</code>
              <span style={{ color: 'var(--ink-mid)', fontWeight: 500, fontSize: '0.78rem' }}>{a.detail}</span>
            </span>
          </div>
          <span className="alarm-since">{fmtAge(a.since_sec)} ago</span>
          <button className="alarm-toggle" aria-expanded={openId === a.id} aria-label="Expand details">
            {openId === a.id ? '▾' : '▸'}
          </button>

          {openId === a.id && (
            <div className="alarm-detail-panel" onClick={(e) => e.stopPropagation()}>
              {a.threshold && (
                <div className="alarm-threshold">
                  <span className="lbl">Threshold breached</span>
                  <code>{a.threshold}</code>
                </div>
              )}
              <div className="alarm-detail-cell" data-kind="cause">
                <span className="lbl"><span className="pip"></span>Cause</span>
                <p dangerouslySetInnerHTML={{ __html: inlineMD(a.cause) }} />
              </div>
              <div className="alarm-detail-cell" data-kind="consq">
                <span className="lbl"><span className="pip"></span>Consequence</span>
                <p dangerouslySetInnerHTML={{ __html: inlineMD(a.consequence) }} />
              </div>
              <div className="alarm-detail-cell" data-kind="action">
                <span className="lbl"><span className="pip"></span>Corrective action</span>
                <p dangerouslySetInnerHTML={{ __html: inlineMD(a.action) }} />
              </div>
              <div className="alarm-evidence">
                <span className="lbl">Linked</span>
                {a.evidence.map((e, i) => (
                  <span key={i}>
                    <span className="lbl">{e.kind}</span>
                    <code>{e.ref}</code>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── EventTape ──
function EventTape({ events, baseTime }) {
  const [filter, setFilter] = useState('all');
  const bodyRef = useRef(null);
  const prevLenRef = useRef(events.length);

  const filtered = useMemo(
    () => filter === 'all' ? events : events.filter((e) => e.type === filter),
    [events, filter]
  );

  useEffect(() => {
    if (events.length > prevLenRef.current && bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
    prevLenRef.current = events.length;
  }, [events.length]);

  return (
    <>
      <div className="tape-head">
        <span className="lbl"><span className="live-dot"></span>Event tape</span>
        <span className="count">{events.length} events · live</span>
      </div>
      <div className="tape-filter" role="tablist">
        {['all', 'dispatch', 'token', 'fog', 'gate', 'stage'].map((f) => (
          <button
            key={f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
            role="tab"
            aria-selected={filter === f}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="tape-body" ref={bodyRef}>
        {filtered.map((e, i) => {
          const ts = new Date(baseTime.getTime() + e.t_off * 1000);
          const timeStr = ts.toTimeString().slice(0, 8);
          let ageStr = '';
          if (e.created_at) {
            const secs = Math.max(0, Math.floor((baseTime.getTime() - e.created_at) / 1000));
            if (secs < 60) ageStr = secs + 's';
            else if (secs < 3600) ageStr = Math.floor(secs / 60) + 'm';
            else ageStr = Math.floor(secs / 3600) + 'h';
          }
          return (
            <div key={e.id || (e.t_off + '-' + i)} className="tape-row" data-tier={e.tier}>
              <span className="tape-time">{timeStr}</span>
              <span className="tape-type">{e.type}</span>
              <span className="tape-detail" dangerouslySetInnerHTML={{ __html: inlineMD(e.detail) }} />
              {ageStr && <span className="tape-age mono">{ageStr} ago</span>}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '1rem', color: 'var(--ink-dim)', fontSize: '0.74rem', fontFamily: 'var(--mono)' }}>
            no events match filter <code>{filter}</code>
          </div>
        )}
      </div>
    </>
  );
}

// ── RationaleLayer ──
// Structured operational reasoning — five compact sections, not prose dumped into boxes.
const RATIONALE_FIELDS = [
  { key: 'why_this_phase',       label: 'Why this phase' },
  { key: 'what_changed',         label: 'What changed' },
  { key: 'what_could_go_wrong',  label: 'What could go wrong' },
  { key: 'what_evidence_supports', label: 'What evidence supports this' },
  { key: 'what_happens_next',    label: 'What happens next' },
];

function RationaleLayer({ rationale, expanded, setExpanded }) {
  return (
    <section className={`rationale ${expanded ? 'expanded' : ''}`} aria-label="Rationale layer">
      <div
        className="rationale-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <span className="caret" aria-hidden="true">▸</span>
        <span className="lbl">Rationale · why this matters</span>
        <span className="rule"></span>
        <span className="meta">{expanded ? 'tap to collapse' : '6 sections'}</span>
      </div>
      {expanded && (
        <div className="rationale-body">
          {RATIONALE_FIELDS.map((f) => (
            <article key={f.key} className="rationale-card">
              <h3>{f.label}</h3>
              <p dangerouslySetInnerHTML={{ __html: inlineMD(rationale[f.key] || '') }} />
            </article>
          ))}
          <article className="rationale-card wide evidence">
            <h3>Evidence trail</h3>
            <p dangerouslySetInnerHTML={{ __html: inlineMD(rationale.evidence_trail || '') }} />
          </article>
        </div>
      )}
    </section>
  );
}

Object.assign(window, {
  CommandStrip, PhaseRunway, TelemetryRail, AlarmList, EventTape, RationaleLayer, AgentLanes,
  fmtClock, fmtAge, fmtKilo, inlineMD,
});
