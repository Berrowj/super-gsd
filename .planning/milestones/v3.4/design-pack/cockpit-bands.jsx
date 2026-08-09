// cockpit-bands.jsx
// Band 1 / 2 / 3 visual components. State (snapshot) is owned by the App;
// these are pure-ish renderers with local hover state for tooltips.

const { useState, useRef, useEffect } = React;

// ───── helpers ─────
function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}
function fmtTime(d) {
  return d.toTimeString().slice(0, 8);
}
function fmtDuration(secs) {
  if (secs < 60) return secs + 's';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// ───── Band 1 ─────
function Band1({ snapshot, emph, now, showAlertList, setShowAlertList }) {
  if (!snapshot) {
    return (
      <section data-band="1" className={`band band-1 emph-${emph}`} aria-label="Governing thought">
        <header className="band-header">
          <span className="band-eyebrow">Band 1 · Governing Thought</span>
        </header>
        <div className="band-loading"><span>connecting</span><span className="skel"></span></div>
      </section>
    );
  }
  const ns = snapshot.north_star;
  const alert = snapshot.alerts?.top;
  const others = snapshot.alerts?.others_count || 0;
  const allAlerts = snapshot.alerts?.all || [];

  return (
    <section data-band="1" data-screen-label="Band 1" className={`band band-1 emph-${emph}`} aria-label="Governing thought">
      <header className="band-header">
        <span className="band-eyebrow">Band 1 · Governing Thought</span>
        <time className="band-tick" dateTime={now.toISOString()}>live · {fmtTime(now)}</time>
      </header>

      <p className="northstar" data-rank={ns.rank} data-code={ns.code}>
        <span className="northstar-glyph" aria-hidden="true">★</span>
        <strong className="northstar-message">
          {ns.message_main}
          {ns.message_stage && <span className="stage-tag">· {ns.message_stage}</span>}
        </strong>
      </p>

      <p className="do-next">
        <span className="do-next-arrow" aria-hidden="true">▸</span>
        <span className="do-next-label">DO NEXT</span>
        <span className="do-next-text">{snapshot.do_next}</span>
      </p>

      <aside
        className={`alert palette-tier-${alert.palette_tier}`}
        role="status"
        data-others={others}
        tabIndex={0}
        onClick={() => setShowAlertList(!showAlertList)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAlertList(!showAlertList); } }}
      >
        <span className="alert-icon" aria-hidden="true">⚠</span>
        <span className="alert-signal">{alert.signal}</span>
        <span className="alert-detail">{alert.detail}</span>
        {others > 0 && <span className="alert-more chip">+{others} more</span>}
      </aside>

      {showAlertList && allAlerts.length > 0 && (
        <div className="alert-list" role="region" aria-label="All active alerts">
          {allAlerts.map((a, i) => (
            <div key={i} className="alert-list-row">
              <span className="alr-sig">{a.signal}</span>
              <span className="alr-det">{a.detail}</span>
              <span className={`chip palette-tier-${a.palette_tier}`}>{a.palette_tier}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ───── Stage cell ─────
function StageCell({ stage, step, elapsedSec, onHover, onLeave }) {
  const marker = ({ done: '✓', active: '⏳', pending: '·', blocked: '🛑' })[stage.status] || '';
  return (
    <li
      className={`stage stage-${stage.status}`}
      data-stage={stage.name}
      data-status={stage.status}
      data-step={step}
      onMouseEnter={() => onHover(stage.name)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(stage.name)}
      onBlur={onLeave}
      tabIndex={0}
    >
      <div className="stage-name">
        {stage.name}{stage.status !== 'pending' && <span className="stage-marker" aria-label={stage.status}>{marker}</span>}
      </div>
      <div className="stage-owner">{stage.owner}</div>
      <div className="stage-sla">
        {stage.sla_minutes}m{stage.status === 'active' && ` · ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`}
        {stage.status === 'done' && ' · done'}
      </div>
    </li>
  );
}

// ───── Pipeline ─────
function Pipeline({ pipeline, pipelineStyle, elapsedSec }) {
  const [hovered, setHovered] = useState(null);
  const stages = pipeline.stages;
  const hoveredStage = stages.find((s) => s.name === hovered);
  const hoveredIdx = stages.findIndex((s) => s.name === hovered);

  return (
    <div style={{ position: 'relative' }}>
      <ol className={`pipeline style-${pipelineStyle}`} role="list" aria-label="Phase stages">
        {stages.map((s, i) => (
          <StageCell
            key={s.name}
            stage={s}
            step={i + 1}
            elapsedSec={s.status === 'active' ? elapsedSec : 0}
            onHover={setHovered}
            onLeave={() => setHovered(null)}
          />
        ))}
      </ol>
      {hoveredStage && (
        <StageTooltip
          stage={hoveredStage}
          idx={hoveredIdx}
          total={stages.length}
          elapsedSec={hoveredStage.status === 'active' ? elapsedSec : 0}
        />
      )}
    </div>
  );
}

function StageTooltip({ stage, idx, total, elapsedSec }) {
  // Position over the hovered stage cell.
  const leftPct = ((idx + 0.5) / total) * 100;
  const slaSec = stage.sla_minutes * 60;
  const remainingSec = Math.max(0, slaSec - elapsedSec);
  return (
    <div className="stage-tt" style={{ left: `${leftPct}%` }} role="tooltip">
      <dl style={{ margin: 0 }}>
        <div className="stage-tt-row"><dt>stage</dt><dd>{stage.name}</dd></div>
        <div className="stage-tt-row"><dt>owner</dt><dd>{stage.owner}</dd></div>
        <div className="stage-tt-row"><dt>sla</dt><dd>{stage.sla_minutes}m</dd></div>
        <div className="stage-tt-row">
          <dt>status</dt>
          <dd className={stage.status === 'done' ? 'ok' : (stage.status === 'blocked' ? 'warn' : '')}>
            {stage.status}
          </dd>
        </div>
        {stage.status === 'active' && (
          <>
            <div className="stage-tt-row"><dt>elapsed</dt><dd>{fmtDuration(elapsedSec)}</dd></div>
            <div className="stage-tt-row"><dt>remaining</dt><dd className={remainingSec < 60 ? 'warn' : ''}>~{fmtDuration(remainingSec)}</dd></div>
          </>
        )}
      </dl>
    </div>
  );
}

// ───── Bullet bar ─────
function BulletBar({ value, max, target, ranges, color, label }) {
  // ranges = [{ end: 40, fill: 'good'|'ok'|'bad' }]
  const tone = { good: 'var(--bullet-good)', ok: 'var(--bullet-ok)', bad: 'var(--bullet-bad)' };
  const pct = Math.min(100, (value / max) * 100);
  const targetPct = (target / max) * 100;
  return (
    <svg className="bullet-bar" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
      {ranges.map((r, i) => {
        const prev = i === 0 ? 0 : ranges[i - 1].endPct;
        return <rect key={i} x={prev} width={r.endPct - prev} height="14" fill={tone[r.fill]} opacity="0.85" />;
      })}
      <rect width={pct} height="14" fill={color} opacity="0.95" />
      <rect x={targetPct - 0.4} width="0.8" height="14" fill="#000" />
    </svg>
  );
}

// ───── Trend strip ─────
function TrendStrip({ metrics, chartStyle }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="trend-strip" role="group" aria-label="Live metrics">
      <div className="trend-strip-label">Live · {chartStyle}</div>
      {chartStyle === 'bullet' && (
        <BulletStyle metrics={metrics} hover={hover} setHover={setHover} />
      )}
      {chartStyle === 'gauge' && <GaugeStyle metrics={metrics} />}
      {chartStyle === 'progress' && <ProgressStyle metrics={metrics} />}
    </div>
  );
}

function BulletStyle({ metrics, hover, setHover }) {
  return (
    <>
      {metrics.map((m) => (
        <div
          key={m.key}
          className="bullet-row"
          data-metric={m.key}
          onMouseEnter={() => setHover(m.key)}
          onMouseLeave={() => setHover(null)}
          style={{ position: 'relative' }}
        >
          <span className="bullet-label">{m.label}</span>
          <span className="bullet-value tabular">{m.display}</span>
          <div className="bullet-bar-wrap">
            <BulletBar value={m.value} max={m.max} target={m.target} ranges={m.ranges} color={m.color} />
            {hover === m.key && (
              <div className="bullet-tt" role="tooltip">
                <div className="tt-line"><span>current</span><b>{m.display}</b></div>
                <div className="tt-line"><span>target</span><b>{m.targetDisplay}</b></div>
                <div className="tt-line"><span>range</span><b>0 – {m.maxDisplay}</b></div>
                <div className="tt-line"><span>tier</span><b>{m.tier}</b></div>
              </div>
            )}
          </div>
          <span className={`bullet-tier chip ${m.tierClass || ''}`}>{m.tier}</span>
        </div>
      ))}
    </>
  );
}

function GaugeStyle({ metrics }) {
  return (
    <div className="gauge-row">
      {metrics.map((m) => {
        const pct = Math.min(1, m.value / m.max);
        const angle = pct * 180 - 90; // -90 → 90
        const r = 32;
        const cx = 42, cy = 42;
        const rad = (angle * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        return (
          <div key={m.key} className="gauge-cell">
            <svg className="gauge-svg" viewBox="0 0 84 50" aria-hidden="true">
              <path d="M 10 42 A 32 32 0 0 1 74 42" stroke="rgba(255,255,255,0.10)" strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d={`M 10 42 A 32 32 0 ${pct > 0.5 ? 1 : 0} 1 ${x} ${y}`} stroke={m.color} strokeWidth="6" fill="none" strokeLinecap="round" />
              <circle cx={x} cy={y} r="3" fill={m.color} />
            </svg>
            <span className="gauge-value">{m.display}</span>
            <span className="gauge-label">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressStyle({ metrics }) {
  return (
    <div>
      {metrics.map((m) => {
        const pct = Math.min(100, (m.value / m.max) * 100);
        return (
          <div key={m.key} className="prog-row">
            <span className="bullet-label">{m.label}</span>
            <div className="prog-track">
              <div className="prog-fill" style={{ width: `${pct}%`, background: m.color, opacity: 0.85 }} />
            </div>
            <span className="bullet-value tabular">{m.display}</span>
          </div>
        );
      })}
    </div>
  );
}

// ───── Band 2 ─────
function Band2({ snapshot, pipelineStyle, chartStyle, now, elapsedSec }) {
  if (!snapshot) {
    return (
      <section data-band="2" className="band band-2" aria-label="Supporting state">
        <header className="band-header"><span className="band-eyebrow">Band 2 · Supporting</span></header>
        <div className="band-loading"><span>waiting on snapshot</span><span className="skel"></span></div>
      </section>
    );
  }

  const pipeline = snapshot.stage_pipeline;
  const sig = snapshot.signals;
  const fog = snapshot.fog_score;

  const fogTier = fog.score < 40 ? 'success' : fog.score < 70 ? 'attention' : 'danger';
  const dispTier = sig.dispatch_count < 10 ? null : sig.dispatch_count < 20 ? 'attention' : 'danger';
  const tokTier = sig.token_spend < 2_000_000 ? null : sig.token_spend < 4_000_000 ? 'attention' : 'danger';

  const metrics = [
    {
      key: 'fog', label: 'fog', value: fog.score, max: 100, target: 50,
      display: String(fog.score), targetDisplay: '50', maxDisplay: '100',
      ranges: [{ endPct: 40, fill: 'good' }, { endPct: 70, fill: 'ok' }, { endPct: 100, fill: 'bad' }],
      color: 'var(--cyan)', tier: fog.tier,
      tierClass: 'palette-tier-' + (fogTier === 'success' ? 'success' : fogTier === 'attention' ? 'attention' : 'danger'),
    },
    {
      key: 'dispatches', label: 'dispatches', value: sig.dispatch_count, max: 30, target: 15,
      display: String(sig.dispatch_count), targetDisplay: '15', maxDisplay: '30',
      ranges: [{ endPct: 50, fill: 'good' }, { endPct: 80, fill: 'ok' }, { endPct: 100, fill: 'bad' }],
      color: 'var(--blue)',
      tier: sig.dispatch_count < 10 ? 'steady' : sig.dispatch_count < 20 ? 'rising' : 'climbing',
      tierClass: dispTier ? 'palette-tier-' + dispTier : '',
    },
    {
      key: 'tokens', label: 'tokens', value: sig.token_spend, max: 5_000_000, target: 2_500_000,
      display: fmtNum(sig.token_spend), targetDisplay: '2.5M', maxDisplay: '5M',
      ranges: [{ endPct: 30, fill: 'good' }, { endPct: 70, fill: 'ok' }, { endPct: 100, fill: 'bad' }],
      color: 'var(--violet)',
      tier: sig.token_spend < 2_000_000 ? 'relaxed' : sig.token_spend < 4_000_000 ? 'climbing' : 'hot',
      tierClass: tokTier ? 'palette-tier-' + tokTier : '',
    },
  ];

  const activeStage = pipeline.stages.find((s) => s.status === 'active');
  const remainingTxt = activeStage ? fmtDuration(Math.max(0, activeStage.sla_minutes * 60 - elapsedSec)) : '—';

  return (
    <section data-band="2" data-screen-label="Band 2" className="band band-2" aria-label="Supporting state">
      <header className="band-header">
        <span className="band-eyebrow">Band 2 · Supporting</span>
        {activeStage && <time className="band-tick">{activeStage.name} · ~{remainingTxt} left</time>}
      </header>

      <Pipeline pipeline={pipeline} pipelineStyle={pipelineStyle} elapsedSec={elapsedSec} />

      <div className="band-2-cols">
        <dl className="context-rows">
          <div className="row"><dt>WHY RUNNING</dt><dd>{snapshot.why_running}</dd></div>
          <div className="row"><dt>UNLOCKS</dt><dd>{snapshot.unlocks}</dd></div>
          <div className="row"><dt>BLOCKED-BY</dt>
            {pipeline.blocker
              ? <dd><code>{pipeline.blocker}</code></dd>
              : <dd className="status-ok">nothing</dd>
            }
          </div>
        </dl>

        <TrendStrip metrics={metrics} chartStyle={chartStyle} />
      </div>
    </section>
  );
}

// ───── Band 3 ─────
const RATIONALE_FIELDS = [
  { key: 'why_this_phase', label: 'Why this phase' },
  { key: 'context', label: 'Context' },
  { key: 'eli5', label: 'ELI5' },
  { key: 'what_is', label: 'What is' },
  { key: 'what_could_be', label: 'What could be' },
];

function Band3({ snapshot, disclosure, collapsed, setCollapsed }) {
  const [activeTab, setActiveTab] = useState('why_this_phase');
  if (!snapshot || !snapshot.rationale) return null;
  const r = snapshot.rationale;

  const renderField = (key) => {
    const html = (r[key] || '').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return <p dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <section data-band="3" data-screen-label="Band 3" className="band band-3" aria-label="Rationale (drill-in)">
      <header className="band-header">
        <span className="band-eyebrow">Band 3 · Rationale</span>
        {disclosure === 'collapsible' && (
          <button
            className="band-3-toggle"
            type="button"
            aria-expanded={!collapsed}
            aria-controls="band-3-content"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? 'expand' : 'collapse'}
          </button>
        )}
      </header>

      {!(disclosure === 'collapsible' && collapsed) && (
        <div id="band-3-content">
          {disclosure === 'tabs' ? (
            <>
              <div className="rationale-tabs" role="tablist">
                {RATIONALE_FIELDS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`rationale-tab ${activeTab === f.key ? 'active' : ''}`}
                    role="tab"
                    aria-selected={activeTab === f.key}
                    onClick={() => setActiveTab(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="rationale-tabpanel" role="tabpanel">
                {renderField(activeTab)}
              </div>
              <div className="rationale-card rationale-evidence" data-field="evidence_trail" style={{ marginTop: '1rem' }}>
                <h3>Evidence trail<span className="h3-rule"></span></h3>
                {renderField('evidence_trail')}
              </div>
            </>
          ) : (
            <div className="rationale-grid">
              {RATIONALE_FIELDS.map((f) => (
                <article key={f.key} className="rationale-card" data-field={f.key}>
                  <h3>{f.label}<span className="h3-rule"></span></h3>
                  {renderField(f.key)}
                </article>
              ))}
              <article className="rationale-card rationale-evidence" data-field="evidence_trail">
                <h3>Evidence trail<span className="h3-rule"></span></h3>
                {renderField('evidence_trail')}
              </article>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { Band1, Band2, Band3, fmtTime, fmtNum, fmtDuration });
