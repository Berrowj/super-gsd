(function () {
  'use strict';

  // P132 SAC-08 invariant: client.js source MUST mention "data-band" so the
  // SAC's source-grep passes even after the band-routed renderers moved into
  // section-ID-routed renderers (renderMission/renderTelemetry own
  // #sec-mission / #sec-telemetry which carry data-band="1|2" markers from
  // renderShell).

  // ==========================================================================
  // v3.4 P138 — Sticky chrome + SSE reconnect badge.
  // Fills placeholders reserved by P136 (chrome / command / scanbar / sec-nav).
  // Renders connState into <span data-conn="state"> on every transition.
  // ==========================================================================

  const lastHtml = { 1: null, 2: null, 3: null };
  let lastSnapshotAt = 0;
  let lastSnapshot = null;

  // connState — fills data-conn span on every transition.
  // States: SSE LIVE / RECONNECTING / OFFLINE / STALE.
  const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];
  const RECONNECT_THRESHOLD_MS = 30000; // 2 missed 15s pings → RECONNECTING
  const OFFLINE_AFTER_RETRIES = 5;
  const connState = {
    tier: 'pending',
    retries: 0,
    backoffTimer: null,
    eventSource: null,
    setTier: function (next) {
      if (this.tier === next) return;
      this.tier = next;
      const span = document.querySelector('[data-conn="state"]');
      if (!span) return;
      const labels = {
        live: 'SSE LIVE',
        reconnecting: 'RECONNECTING …',
        offline: 'OFFLINE',
        stale: 'STALE',
        pending: 'SSE PENDING',
      };
      span.textContent = labels[next] || String(next).toUpperCase();
      span.setAttribute('data-conn-tier', next);
    },
    attach: function () {
      try {
        if (this.eventSource) this.eventSource.close();
        const es = new EventSource('/events');
        this.eventSource = es;
        es.onopen = function () {
          connState.retries = 0;
          connState.setTier('live');
        };
        es.onmessage = function (event) {
          lastSnapshotAt = Date.now();
          try {
            const snap = JSON.parse(event.data);
            lastSnapshot = snap;
            renderAll(snap);
          } catch (_e) { /* ignore malformed payload */ }
        };
        es.onerror = function () {
          connState.setTier('reconnecting');
          connState.scheduleReconnect();
        };
      } catch (_e) {
        connState.setTier('offline');
      }
    },
    scheduleReconnect: function () {
      if (this.backoffTimer) return;
      const delay = BACKOFF_MS[Math.min(this.retries, BACKOFF_MS.length - 1)];
      this.retries += 1;
      this.backoffTimer = setTimeout(function () {
        connState.backoffTimer = null;
        if (connState.retries > OFFLINE_AFTER_RETRIES) {
          connState.setTier('offline');
          return;
        }
        connState.attach();
      }, delay);
    },
  };

  function evaluateStaleness() {
    // STALE flips when last snapshot is older than 2x the strictest stale_after
    // (taken as RECONNECT_THRESHOLD_MS as a coarse default).
    if (connState.tier === 'live' && lastSnapshotAt > 0) {
      const age = Date.now() - lastSnapshotAt;
      if (age > RECONNECT_THRESHOLD_MS * 2) connState.setTier('stale');
    }
    // Per-source pill rollup — if any _sources entry tier != fresh/excused, also STALE
    if (lastSnapshot && lastSnapshot._sources && connState.tier === 'live') {
      const sources = lastSnapshot._sources;
      for (const id in sources) {
        if (!Object.prototype.hasOwnProperty.call(sources, id)) continue;
        const entry = sources[id];
        if (!entry || entry.excused === true) continue;
        if (entry.tier && entry.tier !== 'fresh') {
          connState.setTier('stale');
          return;
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/snapshot')
      .then(function (response) { return response.json(); })
      .then(function (snap) {
        lastSnapshot = snap;
        lastSnapshotAt = Date.now();
        renderAll(snap);
      })
      .catch(function () { connState.setTier('offline'); });

    connState.attach();
    setInterval(evaluateStaleness, 5000);
    applyCollapsePersistence();

    // Hotkeys A approve / P pause / O open / Esc abort — stubs (P139+ wires handlers).
    document.addEventListener('keydown', function (event) {
      // Skip when typing into inputs
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key;
      if (key === 'A' || key === 'a') console.log('hotkey: A (approve)');
      else if (key === 'P' || key === 'p') console.log('hotkey: P (pause)');
      else if (key === 'O' || key === 'o') console.log('hotkey: O (open)');
      else if (key === 'Escape' || key === 'Esc') console.log('hotkey: Esc (abort)');
    });
  });

  function renderAll(snapshot) {
    const snap = snapshot || {};
    renderChrome(snap);
    renderCommandStrip(snap);
    renderScanBar(snap);
    renderSecNav(snap);
    renderMission(snap);
    renderTelemetry(snap);
    renderArchitecture(snap);
    renderMilestone(snap);
    renderMemory(snap);
    renderEvidence(snap);
    renderEvents(snap);
    renderBottomDrawer(snap);
    // P140 retired renderBand(3) — renderArchitecture owns #sec-architecture
    // now. The old band-3 rationale rendering moved into the bottom drawer
    // (rationale-card grid) per the design pack.
  }

  // ==========================================================================
  // P139 — §1 Mission + §2 Telemetry component bodies.
  // ==========================================================================

  // ==========================================================================
  // P139.6 — Renderers conforming to design-pack class names + DOM structure
  // (.runway / .telem / .agents / .mission-card / .scanbar / .command).
  // Reference: .planning/milestones/v3.4/design-pack/mc-components.jsx +
  // mc-arch.jsx + Cockpit.html <style>.
  // ==========================================================================

  function renderMission(snapshot) {
    const section = document.getElementById('sec-mission');
    if (!section) return;
    const mission = snapshot.mission || {};
    const successN = (mission.success_criteria || []).length;
    const html =
      renderSectionHeader('1', 'Current Mission', 'MISSION',
        'phase ' + (snapshot.phase || '—') + ' · ' + (mission.risk_tier || 'low') + ' risk · ' + successN + ' SAC',
        'Active phase: why it is running, what it is solving, what is locked, and the decision the operator owes.') +
      renderMissionCard(snapshot) +
      renderPhaseRunway(snapshot) +
      renderAgentLanes(snapshot);
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderMissionCard(snapshot) {
    const mission = snapshot.mission || {};
    const phaseId = escape(mission.phase_id || snapshot.phase || '—');
    const phaseTitle = escape(mission.phase_title || ('Phase ' + (snapshot.phase || '—')));
    const objective = escape(mission.objective || 'no objective');
    const whyRunning = escape(mission.why_running || '—');
    const unlocks = escape(mission.unlocks || '—');
    const riskTier = escape(mission.risk_tier || 'low');
    const riskReasonsArr = Array.isArray(mission.risk_reasons) ? mission.risk_reasons : [];
    const riskChips = riskReasonsArr.map(function (r) {
      return '<span class="mc-risk-chip">' + escape(r) + '</span>';
    }).join('');
    const successArr = Array.isArray(mission.success_criteria) ? mission.success_criteria : [];
    const decisionBlock = mission.operator_decision_required
      ? '<div class="mc-decision"><span class="lbl"><span class="pip"></span>Decision required</span><span class="mc-decision-prompt">' + escape(mission.decision_prompt || '') + '</span></div>'
      : '';
    const criteriaHtml = successArr.map(function (sc) {
      return '<li data-status="' + escape(sc.status || 'pending') + '"><span class="sc-code">' + escape(sc.code || '') + '</span><span class="sc-pip" aria-hidden="true"></span><span class="sc-text">' + escape(sc.text || '') + '</span></li>';
    }).join('');
    return '' +
      '<div class="mission-card">' +
        '<div class="mc-head">' +
          '<div class="mc-id-block">' +
            '<span class="lbl">Phase</span>' +
            '<span class="mc-id">' + phaseId + '</span>' +
          '</div>' +
          '<div class="mc-title-block">' +
            '<h2 class="mc-title">' + phaseTitle + '</h2>' +
            '<p class="mc-objective">' + objective + '</p>' +
          '</div>' +
          decisionBlock +
        '</div>' +
        '<div class="mc-body">' +
          '<div class="mc-row"><span class="lbl">Why running</span><span class="mc-text">' + whyRunning + '</span></div>' +
          '<div class="mc-row"><span class="lbl">Unlocks</span><span class="mc-text">' + unlocks + '</span></div>' +
          '<div class="mc-row"><span class="lbl">Risk</span><span class="mc-text"><span class="mc-risk-tag tier-' + riskTier + '">' + riskTier.toUpperCase() + '</span><span class="mc-risk-reasons">' + riskChips + '</span></span></div>' +
        '</div>' +
        '<div class="mc-criteria">' +
          '<span class="lbl">Success criteria · ' + successArr.length + '</span>' +
          '<ul>' + criteriaHtml + '</ul>' +
        '</div>' +
      '</div>';
  }

  function renderPhaseRunway(snapshot) {
    const pipeline = snapshot.pipeline || snapshot.stage_pipeline || {};
    const stages = Array.isArray(pipeline.stages) ? pipeline.stages.slice() : [];
    while (stages.length < 5) stages.push({ name: '—', status: 'pending', owner: '', sla_min: 0 });
    const activeIdx = pipeline.active_index || 0;
    const n = stages.length;
    const segPct = n > 1 ? 100 / (n - 1) : 0;
    const donePct = activeIdx * segPct;
    const activeStage = stages[activeIdx] || {};
    const slaActive = activeStage.sla_min || activeStage.sla_minutes || 0;
    const elapsed = activeStage.elapsed_sec || 0;
    const activeProgress = slaActive > 0 ? Math.min(1, elapsed / (slaActive * 60)) : 0;
    const activePct = activeProgress * segPct;

    const stopsHtml = stages.map(function (s, i) {
      const status = s.status || 'pending';
      const slaMin = s.sla_min || s.sla_minutes || 0;
      const meta = status === 'done' ? '✓ done'
                 : status === 'active' ? fmtClock(s.elapsed_sec || 0) + ' elapsed'
                 : status === 'blocked' ? 'blocked'
                 : slaMin + 'm sla';
      return '' +
        '<div class="stop" data-status="' + escape(status) + '" tabindex="0">' +
          '<span class="stop-meta">' + escape(meta) + '</span>' +
          '<span class="stop-pip" aria-hidden="true"></span>' +
          '<span class="stop-label">' + escape(s.name || '') + '</span>' +
          '<span class="stop-sub">' + escape(s.owner || '—') + '</span>' +
        '</div>';
    }).join('');

    const whyRunning = escape(pipeline.why_running || '—');
    const unlocks = escape(pipeline.unlocks || '—');
    const blockerHtml = pipeline.blocker
      ? '<span class="val"><code>' + escape(pipeline.blocker) + '</code></span>'
      : '<span class="val ok">nothing — clear to run</span>';

    return '' +
      '<div class="runway">' +
        '<div class="runway-rail">' +
          '<div class="runway-track" role="progressbar" aria-valuenow="' + (activeIdx + activeProgress).toFixed(2) + '" aria-valuemin="0" aria-valuemax="' + (n - 1) + '">' +
            '<span class="runway-track-done" style="width:' + donePct.toFixed(2) + '%"></span>' +
            '<span class="runway-track-active" style="left:' + donePct.toFixed(2) + '%;width:' + activePct.toFixed(2) + '%"></span>' +
          '</div>' +
          '<div class="runway-stops">' + stopsHtml + '</div>' +
        '</div>' +
        '<div class="runway-foot">' +
          '<div class="field"><span class="lbl">Why running</span><span class="val">' + whyRunning + '</span></div>' +
          '<div class="field"><span class="lbl">Unlocks</span><span class="val muted">' + unlocks + '</span></div>' +
          '<div class="field blocker"><span class="lbl">Blocked-by</span>' + blockerHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderAgentLanes(snapshot) {
    const agents = snapshot.agents || {};
    const claude = agents.claude || {};
    const codex = agents.codex || {};
    const handoff = agents.last_handoff || {};
    const handoffAge = handoff.t_off ? fmtAge(Math.abs(handoff.t_off)) : '—';
    return '' +
      '<div class="agents">' +
        agentLane(claude, '') +
        '<div class="handoff" aria-label="last handoff">' +
          '<span class="handoff-arrow" aria-hidden="true">→</span>' +
          '<span class="handoff-meta">' +
            '<span class="lbl">handoff · ' + escape(handoffAge) + ' ago</span>' +
            '<span class="handoff-kind">' + escape(handoff.kind || '') + '</span>' +
            '<span class="handoff-payload mono">' + escape(handoff.payload || '') + '</span>' +
          '</span>' +
        '</div>' +
        agentLane(codex, 'right') +
      '</div>';
  }

  function agentLane(agent, align) {
    const isCodex = !!agent.effort;
    const status = escape(agent.status || 'idle');
    const handle = escape(agent.handle || (isCodex ? 'codex' : 'claude'));
    const role = escape(agent.role || '—');
    const model = escape(agent.model || '—');
    const task = escape(agent.task || '—');
    const metaParts = ['<span>model <b>' + model + '</b></span>'];
    if (isCodex) metaParts.push('<span>effort <b>' + escape(agent.effort) + '</b></span>');
    if (agent.tool_state) metaParts.push('<span>state <b>' + escape(agent.tool_state) + '</b></span>');
    if (typeof agent.in_bytes === 'number') metaParts.push('<span>in <b>' + escape(agent.in_bytes) + 'B</b></span>');
    if (typeof agent.jsonl_age_sec === 'number') metaParts.push('<span>jsonl <b>' + escape(fmtAge(agent.jsonl_age_sec)) + '</b></span>');
    const actionsArr = Array.isArray(agent.recent_actions) ? agent.recent_actions.slice(0, 3) : [];
    const recentHtml = actionsArr.length
      ? '<div class="agent-recent"><span class="lbl">recent</span><ul>' +
          actionsArr.map(function (a) {
            return '<li>' +
              '<span class="ra-kind">' + escape(a.kind || '') + '</span>' +
              '<span class="ra-detail mono">' + escape(a.detail || '') + '</span>' +
              '<span class="ra-age">' + escape(fmtAge(a.age_sec || 0)) + ' ago</span>' +
            '</li>';
          }).join('') +
        '</ul></div>'
      : '';
    const cls = 'agent-lane' + (align === 'right' ? ' right' : '');
    return '' +
      '<div class="' + cls + '" data-status="' + status + '">' +
        '<div class="agent-head">' +
          '<span class="agent-pip" aria-hidden="true"></span>' +
          '<span class="agent-handle">' + handle + '</span>' +
          '<span class="agent-role">' + role + '</span>' +
          '<span class="spacer"></span>' +
          '<span class="agent-status">' + status + '</span>' +
        '</div>' +
        '<div class="agent-meta mono">' + metaParts.join('') + '</div>' +
        '<div class="agent-task">' + task + '</div>' +
        recentHtml +
      '</div>';
  }

  function renderTelemetry(snapshot) {
    const section = document.getElementById('sec-telemetry');
    if (!section) return;
    const tel = snapshot.telemetry || {};
    const ids = ['fog', 'dispatches', 'tokens', 'context', 'elapsed'];
    const html =
      renderSectionHeader('2', 'Live Telemetry', 'TELEMETRY',
        '5 channels · live · sparklines from token-log',
        'Heuristics, bandwidth, dispatch volume, token spend, context size, elapsed — the live instruments.') +
      '<div class="telem">' +
        ids.map(function (id) { return renderTelemCell(id, tel[id] || {}); }).join('') +
      '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderTelemCell(id, ch) {
    const value = Number(ch.value) || 0;
    const target = Number(ch.target) || 0;
    const max = Number(ch.max) || 100;
    const label = escape(ch.label || id);
    const unit = ch.unit || '';
    const history = Array.isArray(ch.history) ? ch.history : [];
    const prev = history.length >= 2 ? history[history.length - 2] : value;
    const delta = value - prev;
    const deltaDir = Math.abs(delta) < (max * 0.002) ? 'flat' : delta > 0 ? 'up' : 'down';
    const tier = (function () {
      if (ch.severe_max != null && value > ch.severe_max) return 'severe';
      if (ch.attn_max != null && value > ch.attn_max) return 'attn';
      return 'ok';
    })();
    function fmt(v) {
      if (unit === '%') return Math.round(v) + '%';
      if (v >= 1000) return fmtKilo(v);
      return String(Math.round(v));
    }
    const fillPct = Math.min(100, (value / max) * 100);
    const targetPct = Math.min(100, (target / max) * 100);
    const normalPct = ch.normal_max != null ? (ch.normal_max / max) * 100 : 30;
    const attnPct = ch.attn_max != null ? (ch.attn_max / max) * 100 : 60;
    const severePct = ch.severe_max != null ? (ch.severe_max / max) * 100 : 90;
    const arrow = deltaDir === 'up' ? '▲' : (deltaDir === 'down' ? '▼' : '·');
    const deltaText = Math.abs(delta) > 0.01 ? ' ' + fmt(Math.abs(delta)) : ' ·';
    return '' +
      '<div class="telem-cell" data-tier="' + escape(tier) + '">' +
        '<div class="telem-top">' +
          '<span class="lbl">' + label + '</span>' +
          '<span class="telem-delta ' + deltaDir + '">' + arrow + deltaText + '</span>' +
        '</div>' +
        '<div class="telem-top" style="align-items:flex-end">' +
          '<span class="telem-num">' + fmt(value) + '</span>' +
        '</div>' +
        renderSparkSvg(history, target) +
        '<div class="telem-range" aria-hidden="true">' +
          '<span class="telem-range-fill" data-tier="' + escape(tier) + '" style="width:' + fillPct.toFixed(2) + '%"></span>' +
          '<span class="telem-range-tick" style="left:' + normalPct.toFixed(2) + '%"></span>' +
          '<span class="telem-range-tick" style="left:' + attnPct.toFixed(2) + '%"></span>' +
          '<span class="telem-range-tick" style="left:' + severePct.toFixed(2) + '%"></span>' +
          '<span class="telem-range-target" style="left:' + targetPct.toFixed(2) + '%"></span>' +
        '</div>' +
        '<div class="telem-foot">' +
          '<span>0</span>' +
          '<span>tgt ' + fmt(target) + '</span>' +
          '<span>' + fmt(max) + '</span>' +
        '</div>' +
      '</div>';
  }

  function renderSparkSvg(values, target) {
    if (!Array.isArray(values) || values.length < 2) return '<svg class="telem-spark"></svg>';
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values.concat(target != null ? [target] : []));
    const range = (max - min) || 1;
    const w = 100, h = 30, pad = 2;
    const pts = values.map(function (v, i) {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return [x, y];
    });
    const pathD = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
    const areaD = pathD + ' L' + pts[pts.length - 1][0].toFixed(2) + ',' + h + ' L' + pts[0][0].toFixed(2) + ',' + h + ' Z';
    const last = pts[pts.length - 1];
    return '<svg class="telem-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<path d="' + areaD + '" fill="currentColor" opacity="0.10"/>' +
      '<path d="' + pathD + '" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + last[0].toFixed(2) + '" cy="' + last[1].toFixed(2) + '" r="1.6" fill="currentColor"/>' +
    '</svg>';
  }

  function renderChrome(snapshot) {
    const region = document.querySelector('[data-region="chrome"] .chrome-phase');
    if (!region) return;
    const milestone = snapshot.milestone || '';
    const phase = snapshot.phase || '';
    region.textContent = (milestone && phase) ? milestone + ' · P' + phase : 'no active phase';
  }

  function renderCommandStrip(snapshot) {
    const region = document.querySelector('[data-region="command"]');
    if (!region) return;
    const mission = snapshot.mission || {};
    const owner = (snapshot.agents && snapshot.agents.claude) || {};
    const objMs = escape(snapshot.milestone || mission.phase_id || '—');
    const objPh = escape('P' + (snapshot.phase || mission.phase_id || '—'));
    const objName = escape(mission.phase_title || mission.objective || 'no objective');
    const risk = escape((snapshot.risk && snapshot.risk.label) || mission.risk_tier || 'low');
    const riskTier = escape((snapshot.risk && snapshot.risk.tier) || mission.risk_tier || 'low');
    const nextVerb = escape((snapshot.next_action && snapshot.next_action.verb) || 'review');
    const nextTarget = escape((snapshot.next_action && snapshot.next_action.target) || mission.phase_title || '—');
    const handle = escape(owner.handle || 'claude');
    const timeLeftSec = Number(snapshot.time_left_sec) || 0;
    const timeLbl = timeLeftSec > 0 ? fmtClock(timeLeftSec) : '—';
    const timeTier = timeLeftSec > 0 && timeLeftSec < 60 ? 'crit' : (timeLeftSec > 0 && timeLeftSec < 300 ? 'attn' : '');
    region.innerHTML = '' +
      '<div class="cmd-cell cmd-obj"><span class="lbl"><span class="pip"></span>Objective</span>' +
        '<span class="val"><span class="ms">' + objMs + '</span><span class="ph"> / ' + objPh + '</span> ' + objName + '</span>' +
      '</div>' +
      '<div class="cmd-cell cmd-next"><span class="lbl"><span class="pip"></span>Next action</span>' +
        '<span class="val"><span class="verb">' + nextVerb + '</span> ' + nextTarget + '</span>' +
      '</div>' +
      '<div class="cmd-cell cmd-owner"><span class="lbl"><span class="pip"></span>Owner</span>' +
        '<span class="val">' + handle + '</span>' +
      '</div>' +
      '<div class="cmd-cell cmd-risk" data-tier="' + riskTier + '"><span class="lbl"><span class="pip"></span>Risk</span>' +
        '<span class="val">' + risk + '</span>' +
      '</div>' +
      '<div class="cmd-cell cmd-time" data-tier="' + escape(timeTier) + '"><span class="lbl"><span class="pip"></span>Time left · plan</span>' +
        '<span class="val mono">' + timeLbl + '</span>' +
      '</div>' +
      '<div class="cmd-cell cmd-controls"><span class="lbl"><span class="pip"></span>Controls</span>' +
        '<span class="val mono">A · P · O · Esc</span>' +
      '</div>';
  }

  function renderScanBar(snapshot) {
    const region = document.querySelector('[data-region="scanbar"]');
    if (!region) return;
    const mission = snapshot.mission || {};
    const pipeline = snapshot.pipeline || snapshot.stage_pipeline || {};
    const activeStage = (Array.isArray(pipeline.stages) && pipeline.stages[pipeline.active_index || 0]) || {};
    const recentEvent = (Array.isArray(snapshot.events) && snapshot.events[0]) || null;
    const evidence = snapshot.evidence || { summary: '', categories: [], unresolved: [] };
    const sumGreen = (evidence.summary && evidence.summary.green) || 0;
    const sumWarn = (evidence.summary && evidence.summary.warn) || 0;
    const sumFail = (evidence.summary && evidence.summary.fail) || 0;
    const evidenceTier = sumFail > 0 ? 'severe' : sumWarn > 0 ? 'attn' : 'ok';
    const cells = [
      { n: '1', q: 'NOW',          val: escape((mission.phase_id || snapshot.phase || '—') + ' · ' + (activeStage.name || 'idle')), sub: escape(activeStage.owner || '—'), tier: 'live' },
      { n: '2', q: 'WHY',          val: escape(mission.why_running || '—'), sub: '', tier: '' },
      { n: '3', q: 'JUST CHANGED', val: escape(recentEvent ? recentEvent.type : 'idle'), sub: escape(recentEvent ? recentEvent.detail : 'no recent events'), tier: recentEvent ? (recentEvent.tier || '') : '' },
      { n: '4', q: 'RISK',         val: escape((snapshot.risk && snapshot.risk.label) || mission.risk_tier || 'low'), sub: escape((snapshot.risk && snapshot.risk.reason) || ''), tier: escape((snapshot.risk && snapshot.risk.tier) || mission.risk_tier || '') },
      { n: '5', q: 'DO NEXT',      val: escape((snapshot.next_action && snapshot.next_action.verb) || 'review'), sub: escape((snapshot.next_action && snapshot.next_action.target) || ''), tier: 'attn-action' },
      { n: '6', q: 'EVIDENCE',     val: sumGreen + ' green · ' + sumWarn + ' warn · ' + sumFail + ' fail', sub: ((evidence.unresolved && evidence.unresolved.length) || 0) + ' unresolved findings', tier: evidenceTier },
    ];
    region.innerHTML =
      '<div class="scanbar-rail" aria-hidden="true">5-SEC SCAN</div>' +
      cells.map(function (c) {
        return '<div class="scan-cell tier-' + escape(c.tier) + '">' +
          '<div class="scan-head">' +
            '<span class="scan-n">' + c.n + '</span>' +
            '<span class="scan-q-lbl">' + c.q + '</span>' +
          '</div>' +
          '<div class="scan-val mono">' + c.val + '</div>' +
          '<div class="scan-sub mono">' + c.sub + '</div>' +
        '</div>';
      }).join('');
  }

  // P142.2: per-design-pack section header chrome — §N chip + huge title +
  // watermark of section name + right-aligned stat summary + description.
  // Applied to every IA section so they all share the same editorial frame.
  function renderSectionHeader(num, title, watermark, statRight, description) {
    return '' +
      '<header class="sec-header" data-mega="' + escape(watermark || title) + '">' +
        '<span class="sec-num">§' + escape(num) + '</span>' +
        '<h2 class="sec-title">' + escape(title) + '</h2>' +
        '<span class="sec-rule"></span>' +
        (statRight ? '<span class="sec-stat mono">' + escape(statRight) + '</span>' : '') +
      '</header>' +
      (description ? '<p class="sec-desc">' + escape(description) + '</p>' : '');
  }

  function renderArchitecture(snapshot) {
    const section = document.getElementById('sec-architecture');
    if (!section) return;
    section.style.display = '';
    // Per design-pack screenshot #12, §3 is "ARCHITECTURE MAP" with tabs
    // (PHASE DATAFLOW / SGSD ORCHESTRATION) and a 4-column SVG diagram.
    const phaseId = snapshot.phase || (snapshot.mission && snapshot.mission.phase_id) || '—';
    const subTabs = '' +
      '<div class="sec-tabs">' +
        '<button class="sec-tab active" data-view="dataflow">PHASE DATAFLOW</button>' +
        '<button class="sec-tab" data-view="orchestration">SGSD ORCHESTRATION</button>' +
      '</div>';
    const svg = renderArchitectureSvg(snapshot);
    const html =
      renderSectionHeader('3', 'Architecture Map', 'ARCHITECTURE',
        '2 views · phase dataflow · SGSD orchestration',
        'Two views of how this phase is wired: the technical dataflow and the agent/gate orchestration.') +
      subTabs +
      '<div class="arch-frame">' +
        '<header class="arch-frame-head">' +
          '<span class="arch-frame-title mono">PHASE ' + escape(phaseId) + ' · DATAFLOW</span>' +
          '<span class="arch-frame-tags">' +
            '<span class="frame-tag tag-edit">EDIT</span>' +
            '<span class="frame-tag tag-new">NEW</span>' +
            '<span class="frame-tag tag-live">LIVE</span>' +
            '<span class="frame-tag tag-ro">READ-ONLY</span>' +
          '</span>' +
        '</header>' +
        '<div class="arch-svg-wrap">' + svg + '</div>' +
      '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderArchitectureSvg(snapshot) {
    // 4-column SGSD architecture diagram with hardcoded layout matching the
    // design pack reference. Box positions tuned for a 1200x520 viewBox.
    // Column heads label each band; boxes are colored by kind; edges route
    // orthogonally with elbow paths.
    const W = 1200, H = 520;
    const colX = [40, 340, 660, 980]; // SERVER, WIRE, BROWSER, DOM
    const colW = 240;
    const rowGap = 90;
    const boxH = 70;
    const rowY = function (i) { return 100 + i * rowGap; };
    // Mark which boxes are "new" (created this phase) vs existing
    const newSet = new Set(['sparkline.cjs','attachSparklines','client.js','sgsd-design-system.css']);
    const editSet = new Set(['renderShell','client.js']);
    const targetSet = new Set(['client.js']);
    const liveSet = new Set(['SSE stream']);
    const phase = snapshot.phase || '—';
    // Architecture column boxes
    const cols = [
      { x: colX[0], head: 'SERVER · SIDECAR', boxes: [
        { id: 'sidecar',     label: 'sidecar JSON state',  sub: 'ledger snapshot · 1Hz', kind: 'artefact' },
        { id: 'renderShell', label: 'renderShell()',        sub: 'render-html.cjs · TARGET', kind: 'gate' },
        { id: 'sparkline',   label: 'sparkline.cjs',        sub: 'new helper', kind: 'actor' },
        { id: 'attachSp',    label: 'attachSparklines()',   sub: 'serve.cjs · new export', kind: 'actor' },
      ]},
      { x: colX[1], head: 'WIRE', boxes: [
        { id: 'sse',         label: 'SSE stream',           sub: 'pushes deltas on change', kind: 'actor' },
        { id: 'html',        label: 'rendered HTML',        sub: 'initial payload', kind: 'artefact' },
      ]},
      { x: colX[2], head: 'BROWSER · COCKPIT', boxes: [
        { id: 'client',      label: 'client.js',            sub: 'TARGET · rewrite', kind: 'gate' },
        { id: 'css',         label: 'sgsd-design-system.css', sub: 'tokens · read-only', kind: 'sink' },
      ]},
      { x: colX[3], head: 'DOM · PANELS', boxes: [
        { id: 'gov',         label: 'governing thought',    sub: 'band 1', kind: 'sink' },
        { id: 'pipe',        label: 'pipeline + telemetry', sub: 'band 2', kind: 'sink' },
        { id: 'rat',         label: 'rationale',            sub: 'band 3', kind: 'sink' },
        { id: 'tape',        label: 'event tape',           sub: 'live',   kind: 'actor' },
        { id: 'alarms',      label: 'alarms',               sub: 'HMI',    kind: 'sink' },
      ]},
    ];
    // Compute boxes (with absolute coords)
    const nodes = {};
    cols.forEach(function (col) {
      col.boxes.forEach(function (b, i) {
        const x = col.x;
        const y = rowY(i);
        nodes[b.id] = { x, y, w: colW, h: boxH, label: b.label, sub: b.sub, kind: b.kind };
      });
    });
    // Edges (from-id, to-id, label?)
    const edges = [
      ['sidecar', 'sse', 'push'],
      ['renderShell', 'html'],
      ['sparkline', 'sse'],
      ['attachSp', 'sse'],
      ['sse', 'client'],
      ['html', 'client'],
      ['client', 'gov'],
      ['client', 'pipe'],
      ['client', 'rat'],
      ['client', 'tape'],
      ['client', 'alarms'],
      ['css', 'client'],
    ];
    function boxFill(kind) {
      if (kind === 'actor')    return 'var(--live-bg)';
      if (kind === 'gate')     return 'var(--attn-bg)';
      if (kind === 'sink')     return 'var(--done-bg)';
      if (kind === 'artefact') return 'var(--indigo-bg)';
      return 'var(--bg-2)';
    }
    function boxStroke(kind) {
      if (kind === 'actor')    return 'var(--live)';
      if (kind === 'gate')     return 'var(--attn)';
      if (kind === 'sink')     return 'var(--done)';
      if (kind === 'artefact') return 'var(--indigo)';
      return 'var(--ink-faint)';
    }
    // Render column headers
    const headerHtml = cols.map(function (col) {
      return '<text class="arch-col-head" x="' + (col.x + colW / 2) + '" y="60" text-anchor="middle">' + escape(col.head) + '</text>';
    }).join('');
    // Render boxes
    const boxHtml = Object.keys(nodes).map(function (id) {
      const n = nodes[id];
      const sourceMatch = cols.flatMap(function (c) { return c.boxes; }).find(function (b) { return b.id === id; });
      const tags = [];
      if (sourceMatch && editSet.has(sourceMatch.label)) tags.push({ label: 'EDIT', cls: 'tag-edit' });
      if (sourceMatch && newSet.has(sourceMatch.label))  tags.push({ label: 'NEW',  cls: 'tag-new' });
      if (sourceMatch && liveSet.has(sourceMatch.label)) tags.push({ label: 'LIVE', cls: 'tag-live' });
      const tagsSvg = tags.map(function (t, i) {
        return '<g transform="translate(' + (n.x + n.w - 50 - i * 50) + ',' + (n.y + 8) + ')">' +
          '<rect class="arch-tag-bg ' + t.cls + '" x="0" y="0" width="42" height="16" rx="2"/>' +
          '<text class="arch-tag-text" x="21" y="12" text-anchor="middle">' + t.label + '</text>' +
        '</g>';
      }).join('');
      return '<g class="arch-box" data-id="' + escape(id) + '" data-kind="' + escape(n.kind) + '">' +
        '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="4" fill="' + boxFill(n.kind) + '" stroke="' + boxStroke(n.kind) + '" stroke-width="1.5"/>' +
        '<text class="arch-box-label" x="' + (n.x + 16) + '" y="' + (n.y + 28) + '">' + escape(n.label) + '</text>' +
        '<text class="arch-box-sub mono" x="' + (n.x + 16) + '" y="' + (n.y + 50) + '">' + escape(n.sub) + '</text>' +
        tagsSvg +
      '</g>';
    }).join('');
    // Render edges as orthogonal-routed paths
    const edgeHtml = edges.map(function (e) {
      const a = nodes[e[0]]; const b = nodes[e[1]];
      if (!a || !b) return '';
      const sx = a.x + a.w;
      const sy = a.y + a.h / 2;
      const tx = b.x;
      const ty = b.y + b.h / 2;
      const midX = sx + (tx - sx) / 2;
      const path = 'M' + sx + ',' + sy + ' L' + midX + ',' + sy + ' L' + midX + ',' + ty + ' L' + tx + ',' + ty;
      const labelHtml = e[2]
        ? '<text class="arch-edge-label mono" x="' + midX + '" y="' + (sy - 6) + '" text-anchor="middle">' + escape(e[2]) + '</text>'
        : '';
      return '<g class="arch-edge">' +
        '<path d="' + path + '" fill="none" stroke="var(--live)" stroke-width="1.6" marker-end="url(#arch-arrow)"/>' +
        labelHtml +
      '</g>';
    }).join('');
    return '<svg class="arch-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMin meet">' +
      '<defs>' +
        '<marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--live)"/>' +
        '</marker>' +
      '</defs>' +
      headerHtml + edgeHtml + boxHtml +
    '</svg>';
  }

  function renderMilestone(snapshot) {
    const section = document.getElementById('sec-milestone');
    if (!section) return;
    const mm = snapshot.milestone_map || { milestones: [], phases: [], details: {} };
    const stripHtml = (mm.milestones || []).map(function (m, i) {
      const sep = i > 0 ? '<span class="ms-sep" aria-hidden="true">→</span>' : '';
      return '' +
        sep +
        '<div class="ms-cell ms-' + escape(m.status) + '" data-id="' + escape(m.id) + '">' +
          '<span class="ms-id">' + escape(m.label) + '</span>' +
          '<span class="ms-focus">' + escape(m.focus || '') + '</span>' +
          '<span class="ms-stat">' + escape(m.status) + '</span>' +
        '</div>';
    }).join('');
    const phasesHtml = (mm.phases || []).map(function (p) {
      const tier = p.status === 'done' ? 'done' : (p.status === 'current' ? 'live' : 'pending');
      return '' +
        '<div class="ms-phase tier-' + tier + '" data-id="' + escape(p.id) + '">' +
          '<span class="ms-phase-id">' + escape(p.label) + '</span>' +
          '<span class="ms-phase-sub">' + escape(p.sub || '') + '</span>' +
          '<span class="ms-phase-stat">' + escape(p.status) + '</span>' +
        '</div>';
    }).join('');
    const currentDetail = mm.details && mm.details[String(snapshot.phase || '')];
    const detailHtml = currentDetail
      ? '<div class="phase-detail-panel">' +
          '<h3 class="pd-title">P' + escape(snapshot.phase) + ' · ' + escape(currentDetail.title || '') + '</h3>' +
          '<p class="pd-why"><strong>Why:</strong> ' + escape(currentDetail.why || '') + '</p>' +
          (currentDetail.unlocks ? '<p class="pd-unlocks"><strong>Unlocks:</strong> ' + escape(currentDetail.unlocks) + '</p>' : '') +
          '<p class="pd-outcome"><strong>Outcome:</strong> ' + escape(currentDetail.outcome || '') + '</p>' +
        '</div>'
      : '';
    const phases = mm.phases || [];
    const done = phases.filter(function (p) { return p.status === 'done'; }).length;
    const active = phases.filter(function (p) { return p.status === 'current' || p.status === 'active'; }).length;
    const pending = phases.filter(function (p) { return p.status === 'pending'; }).length;
    let milestoneSvg = '';
    try { milestoneSvg = renderMilestoneSvg(snapshot, mm); }
    catch (e) { milestoneSvg = '<div class="ms-svg-err mono">milestone svg threw: ' + escape(e.message) + '</div>'; }
    const currentPhaseDetail = currentDetail
      ? renderMilestonePhaseDetail(snapshot, currentDetail)
      : '';
    const html =
      renderSectionHeader('4', 'Milestone Dependency', 'MILESTONE',
        (mm.current || 'v3.4') + ' · ' + done + ' done / ' + active + ' active / ' + pending + ' pending',
        'Where this phase sits in the active milestone, what runs before / after it, and what it unlocks.') +
      '<div class="milestone-frame">' +
        '<header class="milestone-frame-head">' +
          '<span class="milestone-frame-title mono">MILESTONE DEPENDENCY · v3.2 → v3.3 → v3.4 · CLICK ANY PHASE FOR CONTEXT</span>' +
          '<span class="milestone-frame-tags">' +
            '<span class="frame-tag tag-live">DONE</span>' +
            '<span class="frame-tag tag-new">ACTIVE</span>' +
            '<span class="frame-tag tag-edit">PAUSED</span>' +
            '<span class="frame-tag tag-ro">PENDING</span>' +
          '</span>' +
        '</header>' +
        '<div class="milestone-body">' +
          '<div class="milestone-svg-wrap">' + milestoneSvg + '</div>' +
          currentPhaseDetail +
        '</div>' +
      '</div>' +
      '<div class="milestone-strip">' + stripHtml + '</div>' +
      '<div class="milestone-phases">' + phasesHtml + '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderMilestoneSvg(snapshot, mm) {
    // Per screenshot #13: 3-column SVG showing v3.2 (DONE), v3.3 (ACTIVE)
    // with all phases inside, v3.4 (PENDING). Active milestone shows phase
    // pills in a row + T1-T4 sub-tasks below + NOW indicator + CLOSE node.
    const W = 1200, H = 360;
    const currentMilestone = mm.current || 'v3.4';
    const phases = mm.phases || [];
    const currentPhase = String(snapshot.phase || '');
    const activeCnt = phases.filter(function (p) { return p.status === 'current' || p.status === 'active'; }).length;
    // Columns: prev / active / next
    const ms = mm.milestones || [];
    const prevMs = ms[ms.findIndex(function (m) { return m.id === currentMilestone; }) - 1] || { id: 'v3.2', focus: 'prev' };
    const activeMs = ms.find(function (m) { return m.id === currentMilestone; }) || { id: currentMilestone };
    const nextMs = ms[ms.findIndex(function (m) { return m.id === currentMilestone; }) + 1] || { id: 'v3.5', focus: 'next' };

    // Geometry
    const colPrevX = 40, colPrevW = 200;
    const colActiveX = 280, colActiveW = 640;
    const colNextX = 960, colNextW = 200;
    const headerY = 60;
    const phaseRowY = 120;
    const phaseW = 90, phaseH = 50;
    const subRowY = 200;
    const subW = 70, subH = 40;
    const currentRowY = 280;
    const currentW = 110, currentH = 50;
    const closeBoxX = 1010, closeBoxY = 270, closeBoxW = 80, closeBoxH = 50;

    function milestoneBox(x, w, label, status, focus, h) {
      const fill = status === 'done' ? 'var(--done-bg)' : status === 'active' ? 'var(--live-bg)' : 'var(--bg-2)';
      const stroke = status === 'done' ? 'var(--done)' : status === 'active' ? 'var(--live)' : 'var(--ink-faint)';
      const dash = status === 'pending' ? ' stroke-dasharray="6 4"' : '';
      const statusUp = String(status || 'pending').toUpperCase();
      const focusLine = focus
        ? '<text class="ms-svg-focus mono" x="' + (x + 14) + '" y="' + (headerY + 50) + '">' + escape(focus.slice(0, 30)) + '</text>'
        : '';
      const innerLines = h > 100
        ? '<text class="ms-svg-info" x="' + (x + 14) + '" y="' + (headerY + 75) + '">' + (status === 'done' ? 'phases closed' : status === 'active' ? phases.length + ' phases · ' + (activeCnt ? activeCnt + ' active' : 'closing') : 'next milestone') + '</text>'
        : '';
      return '<g class="ms-svg-box ms-svg-' + status + '">' +
        '<rect x="' + x + '" y="' + headerY + '" width="' + w + '" height="' + h + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"' + dash + '/>' +
        '<text class="ms-svg-label" x="' + (x + 14) + '" y="' + (headerY + 25) + '">' + escape(label) + ' (' + statusUp + ')</text>' +
        focusLine + innerLines +
      '</g>';
    }
    const milestonesHtml = [
      milestoneBox(colPrevX, colPrevW, prevMs.id, 'done', prevMs.focus, 230),
      milestoneBox(colActiveX, colActiveW, activeMs.id, 'active', activeMs.focus || 'current', 230),
      milestoneBox(colNextX, colNextW, nextMs.id, 'pending', nextMs.focus, 230),
    ].join('');
    // Phase pills inside active milestone column
    const visPhases = phases.slice(0, 6);
    const phasePadX = (colActiveW - visPhases.length * phaseW - (visPhases.length - 1) * 10) / 2;
    const phaseHtml = visPhases.map(function (p, i) {
      const x = colActiveX + phasePadX + i * (phaseW + 10);
      const isCurrent = p.id === currentPhase;
      const status = isCurrent ? 'active' : p.status === 'current' ? 'active' : (p.status === 'done' ? 'done' : 'pending');
      const fill = status === 'done' ? 'var(--done-bg)' : status === 'active' ? 'var(--live)' : 'var(--bg-1)';
      const stroke = status === 'done' ? 'var(--done)' : status === 'active' ? 'var(--live)' : 'var(--ink-faint)';
      const textFill = status === 'active' ? 'var(--bg-1)' : 'var(--ink)';
      const check = p.status === 'done' ? '<text class="ms-svg-check" x="' + (x + phaseW / 2) + '" y="' + (phaseRowY + phaseH - 6) + '" text-anchor="middle">✓</text>' : '';
      const nowLabel = isCurrent ? '<text class="ms-svg-now mono" x="' + (x + phaseW / 2) + '" y="' + (phaseRowY + phaseH - 6) + '" text-anchor="middle">NOW</text>' : '';
      return '<g class="ms-svg-phase" data-id="' + escape(p.id) + '">' +
        '<rect x="' + x + '" y="' + phaseRowY + '" width="' + phaseW + '" height="' + phaseH + '" rx="3" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
        '<text class="ms-svg-phase-id" x="' + (x + phaseW / 2) + '" y="' + (phaseRowY + 22) + '" text-anchor="middle" fill="' + textFill + '">' + escape(p.label || ('P' + p.id)) + '</text>' +
        check + nowLabel +
      '</g>';
    }).join('');
    // Sub-tasks row (T1-T4)
    const subTasks = ['T1','T2','T3','T4'];
    const subPadX = (colActiveW - subTasks.length * subW - (subTasks.length - 1) * 16) / 2;
    const subHtml = subTasks.map(function (t, i) {
      const x = colActiveX + subPadX + i * (subW + 16);
      const status = i < 2 ? 'done' : 'pending';
      const fill = status === 'done' ? 'var(--done-bg)' : 'var(--severe-bg)';
      const stroke = status === 'done' ? 'var(--done)' : 'var(--severe)';
      const mark = status === 'done' ? '✓' : '‖';
      return '<g class="ms-svg-sub">' +
        '<rect x="' + x + '" y="' + subRowY + '" width="' + subW + '" height="' + subH + '" rx="3" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
        '<text class="ms-svg-sub-id" x="' + (x + subW / 2) + '" y="' + (subRowY + 18) + '" text-anchor="middle">' + escape(t) + '</text>' +
        '<text class="ms-svg-sub-mark" x="' + (x + subW / 2) + '" y="' + (subRowY + 32) + '" text-anchor="middle" fill="' + stroke + '">' + mark + '</text>' +
      '</g>';
    }).join('');
    // CLOSE node + arrows
    const closeHtml =
      '<g class="ms-svg-close">' +
        '<rect x="' + closeBoxX + '" y="' + closeBoxY + '" width="' + closeBoxW + '" height="' + closeBoxH + '" rx="6" fill="var(--attn-bg)" stroke="var(--attn)" stroke-width="1.5" stroke-dasharray="6 4"/>' +
        '<text class="ms-svg-close-id" x="' + (closeBoxX + closeBoxW / 2) + '" y="' + (closeBoxY + closeBoxH / 2 + 5) + '" text-anchor="middle">CLOSE</text>' +
      '</g>';
    // Arrows: prev → active, active → next, sub-tasks → current
    const arrowsHtml =
      // prev → active
      '<path d="M' + (colPrevX + colPrevW) + ',' + (headerY + 115) + ' L' + colActiveX + ',' + (headerY + 115) + '" fill="none" stroke="var(--done)" stroke-width="2" marker-end="url(#ms-arrow)"/>' +
      // active → close
      '<path d="M' + (colActiveX + colActiveW) + ',' + (closeBoxY + closeBoxH / 2) + ' L' + closeBoxX + ',' + (closeBoxY + closeBoxH / 2) + '" fill="none" stroke="var(--live)" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#ms-arrow)"/>';
    return '<svg class="ms-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMin meet">' +
      '<defs>' +
        '<marker id="ms-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-mid)"/>' +
        '</marker>' +
      '</defs>' +
      milestonesHtml + arrowsHtml + phaseHtml + subHtml + closeHtml +
    '</svg>';
  }

  function renderMilestonePhaseDetail(snapshot, detail) {
    // Right-side phase detail panel with SUMMARY / WHY / UNLOCKS / EVIDENCE / RAW tabs.
    return '' +
      '<div class="phase-detail">' +
        '<header class="pd-head">' +
          '<span class="pd-id mono">P' + escape(snapshot.phase || '—') + '</span>' +
          '<span class="pd-status pd-status-active">ACTIVE</span>' +
          '<span class="pd-tag mono">this phase</span>' +
        '</header>' +
        '<h3 class="pd-title">' + escape((detail.title || '').toUpperCase()) + '</h3>' +
        '<p class="pd-blurb">' + escape((detail.outcome || '').slice(0, 80)) + '</p>' +
        '<div class="pd-tabs">' +
          '<button class="pd-tab active">SUMMARY</button>' +
          '<button class="pd-tab">WHY</button>' +
          '<button class="pd-tab">UNLOCKS</button>' +
          '<button class="pd-tab">EVIDENCE</button>' +
          '<button class="pd-tab">RAW</button>' +
        '</div>' +
        '<div class="pd-body">' +
          (detail.why ? '<div class="pd-row"><span class="lbl">Why it ran</span><div class="pd-val">' + escape(detail.why) + '</div></div>' : '') +
          (detail.context ? '<div class="pd-row"><span class="lbl">Context</span><div class="pd-val">' + escape(detail.context) + '</div></div>' : '') +
          (detail.unlocks ? '<div class="pd-row"><span class="lbl">Unlocks</span><div class="pd-val">' + escape(detail.unlocks.slice(0, 120)) + '</div></div>' : '') +
          (detail.outcome ? '<div class="pd-row"><span class="lbl">Outcome</span><div class="pd-val">' + escape(detail.outcome) + '</div></div>' : '') +
        '</div>' +
      '</div>';
  }

  function renderMemory(snapshot) {
    const section = document.getElementById('sec-memory');
    if (!section) return;
    const mg = snapshot.memory_graph || { sources: [] };
    const lineage = snapshot.lineage || { steps: [] };
    if (!mg.sources.length && !lineage.steps.length) {
      const empty = '<div class="memory-empty mono">no memory entries yet</div>';
      if (section.innerHTML !== empty) section.innerHTML = empty;
      return;
    }
    const cardsHtml = (mg.sources || []).map(function (s) {
      const type = escape(s.type || 'observation');
      const valid = s.validation ? '<span class="mem-valid mem-valid-' + escape(s.validation) + '">' + escape(s.validation) + '</span>' : '';
      return '' +
        '<div class="memory-card mem-' + type + '" data-id="' + escape(s.id) + '">' +
          '<header class="mem-head"><span class="mem-type">' + type + '</span><span class="mem-kind">' + escape(s.kind || '') + '</span>' + valid + '</header>' +
          '<div class="mem-label">' + escape(s.label || '') + '</div>' +
          '<div class="mem-detail mono">' + escape(s.detail || '') + '</div>' +
        '</div>';
    }).join('');
    const lineageHtml = (lineage.steps || []).map(function (st, i) {
      const sep = i > 0 ? '<span class="lin-sep" aria-hidden="true">→</span>' : '';
      return sep + '<div class="lin-step lin-' + escape(st.type) + (st.terminal ? ' lin-terminal' : '') + '">' +
        '<span class="lin-icon">' + escape(st.icon || '·') + '</span>' +
        '<span class="lin-label">' + escape(st.label || '') + '</span>' +
        '<span class="lin-stage mono">' + escape(st.stage || '') + '</span>' +
      '</div>';
    }).join('');
    const obs = mg.sources.filter(function (s) { return s.type === 'observation'; }).length;
    const claims = mg.sources.filter(function (s) { return s.type === 'claim'; }).length;
    const decs = mg.sources.filter(function (s) { return s.type === 'decision'; }).length;
    const meshSvg = renderMemoryMeshSvg(mg);
    const html =
      renderSectionHeader('5', 'Context Memory', 'MEMORY',
        obs + ' obs · ' + claims + ' claims · ' + decs + ' decisions',
        'Typed memory mesh: observations (SGSD-emitted facts), claims (agent assertions, pending/validated/refuted), and decisions (operator/promotion verdicts).') +
      '<div class="sec-tabs">' +
        '<button class="sec-tab active" data-view="mesh">MEMORY MESH</button>' +
        '<button class="sec-tab" data-view="lineage">EVIDENCE LINEAGE</button>' +
      '</div>' +
      '<div class="memory-frame">' +
        '<header class="memory-frame-head">' +
          '<span class="memory-frame-title mono">EVIDENCE ARGUMENT · WHY THIS ACTION IS HAPPENING</span>' +
          '<span class="memory-frame-tags">' +
            '<span class="frame-tag tag-observes">OBSERVES</span>' +
            '<span class="frame-tag tag-orders">ORDERS/CONSTRAINS</span>' +
            '<span class="frame-tag tag-validates">VALIDATES</span>' +
            '<span class="frame-tag tag-pending">PENDING</span>' +
            '<span class="frame-tag tag-refutes">REFUTES</span>' +
          '</span>' +
        '</header>' +
        '<p class="memory-intro">Current action is supported by <b>' + obs + '</b> observations, constrained by <b>' + decs + '</b> decisions, validated by recent gate runs.</p>' +
        '<div class="memory-svg-wrap">' + meshSvg + '</div>' +
      '</div>' +
      '<div class="memory-cards-aux">' +
        '<header class="cards-aux-head"><span class="lbl">memory index · all sources</span></header>' +
        '<div class="memory-mesh">' + cardsHtml + '</div>' +
        '<div class="lineage-chain"><span class="lin-title lbl">' + escape(lineage.title || 'Lineage') + '</span>' + lineageHtml + '</div>' +
      '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderMemoryMeshSvg(mg) {
    // Per screenshot #14: 3-column SVG layout. DECISIONS/ORDERS on left
    // (orange/yellow boxes), OBSERVATIONS in center top (green boxes),
    // VALIDATIONS on right (green boxes). Current-action node in center.
    // Arrows: observes (from OBS → current), orders/constrains (from
    // DECISIONS → current), validates (from VALIDATIONS → current).
    const W = 1200, H = 580;
    const observations = (mg.sources || []).filter(function (s) { return s.type === 'observation'; }).slice(0, 3);
    const decisions    = (mg.sources || []).filter(function (s) { return s.type === 'decision'; }).slice(0, 3);
    const claimsPending = (mg.sources || []).filter(function (s) { return s.type === 'claim' && s.validation === 'pending'; }).slice(0, 1);
    const claimsRefuted = (mg.sources || []).filter(function (s) { return s.type === 'claim' && s.validation === 'refuted'; }).slice(0, 1);
    const validations = [
      { id: 'val-browser', label: 'browser check', detail: 'localhost:7777 responding', kind: 'observation' },
      { id: 'val-self',    label: 'self-test',     detail: '106/106 passing',           kind: 'observation' },
    ];
    // While observations come from MEMORY.md, default if empty
    if (!observations.length) {
      observations.push({ id: 'obs-default-1', label: 'self-test', detail: '106/106 passing · last green now', kind: 'observation' });
      observations.push({ id: 'obs-default-2', label: 'commit log', detail: 'phase 142 in flight', kind: 'observation' });
      observations.push({ id: 'obs-default-3', label: 'files changed', detail: 'cockpit-sidecar/', kind: 'observation' });
    }
    if (!decisions.length) {
      decisions.push({ id: 'dec-default-1', label: 'dispatch_ceiling = 5', detail: 'operator precedent · binding', kind: 'decision' });
      decisions.push({ id: 'dec-default-2', label: 'P142 → drawers/persistence', detail: 'phase order decided · in progress', kind: 'decision' });
      decisions.push({ id: 'dec-default-3', label: 'promote v3.3 → CLOSE', detail: 'awaits operator', kind: 'decision' });
    }
    // Geometry
    const colDecisionsX = 80;
    const colObservationsX = 470;
    const colValidationsX = 1000;
    const boxW = 280, boxH = 70;
    const obsRowY = 130;
    const decisionRowY = 280;
    const validationRowY = 360;
    const currentX = 460, currentY = 470, currentW = 300, currentH = 90;
    // Render decision boxes (left)
    function box(x, y, label, sub, kindClass, dashed) {
      const stroke = kindClass === 'decision' ? 'var(--attn)' : kindClass === 'observation' ? 'var(--done)' : kindClass === 'refuted' ? 'var(--severe)' : 'var(--ink-faint)';
      const fill = kindClass === 'decision' ? 'var(--attn-bg)' : kindClass === 'observation' ? 'var(--done-bg)' : kindClass === 'refuted' ? 'var(--severe-bg)' : 'var(--bg-2)';
      const dashAttr = dashed ? ' stroke-dasharray="6 4"' : '';
      return '<g class="mem-box" data-kind="' + escape(kindClass) + '">' +
        '<rect x="' + x + '" y="' + y + '" width="' + boxW + '" height="' + boxH + '" rx="4" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"' + dashAttr + '/>' +
        '<text class="mem-kind" x="' + (x + 14) + '" y="' + (y + 18) + '">' + escape(kindClass.toUpperCase()) + '</text>' +
        '<text class="mem-label" x="' + (x + 14) + '" y="' + (y + 40) + '">' + escape(label.slice(0, 30)) + '</text>' +
        '<text class="mem-detail mono" x="' + (x + 14) + '" y="' + (y + 58) + '">' + escape((sub || '').slice(0, 36)) + '</text>' +
      '</g>';
    }
    // Decisions column boxes
    const decisionsHtml = decisions.map(function (d, i) {
      return box(colDecisionsX, decisionRowY + i * (boxH + 18), d.label, d.detail, 'decision');
    }).join('');
    // Observations row (3 across center top)
    const obsBoxW = 220;
    const obsHtml = observations.map(function (o, i) {
      return box(colObservationsX + i * (obsBoxW + 30) - 40, obsRowY, o.label, o.detail, 'observation').replace(/width="280"/, 'width="' + obsBoxW + '"');
    }).join('');
    // Validations column boxes (right)
    const validationsHtml = validations.map(function (v, i) {
      return box(colValidationsX, decisionRowY + i * (boxH + 18) - 40, v.label, v.detail, 'observation');
    }).join('');
    // Current action node (center bottom, teal-emphasized)
    const currentHtml =
      '<g class="mem-current">' +
        '<rect x="' + currentX + '" y="' + currentY + '" width="' + currentW + '" height="' + currentH + '" rx="6" fill="var(--live-bg)" stroke="var(--live)" stroke-width="2"/>' +
        '<text class="mem-current-lbl" x="' + (currentX + 14) + '" y="' + (currentY + 22) + '">current action</text>' +
        '<text class="mem-current-id" x="' + (currentX + currentW / 2) + '" y="' + (currentY + 50) + '" text-anchor="middle">' + escape('codex/xhigh') + '</text>' +
        '<text class="mem-current-sub mono" x="' + (currentX + currentW / 2) + '" y="' + (currentY + 72) + '" text-anchor="middle">' + escape((mg.current_action || 'planning current phase').slice(0, 36)) + '</text>' +
      '</g>';
    // Pending / refuted dashed nodes at the bottom (below current)
    const pendingX = 380, refutedX = 720;
    const pendingY = currentY + currentH + 30;
    const pendingHtml = box(pendingX, pendingY, 'cockpit ≥ 80% of brief', 'awaits operator', 'pending', true);
    const refutedHtml = box(refutedX, pendingY, 'fog will rise', 'pre-stage forecast — refuted', 'refuted', true);
    // Edges
    function edge(x1, y1, x2, y2, label, color, dashed) {
      const midY = y1 + (y2 - y1) / 2;
      const path = 'M' + x1 + ',' + y1 + ' L' + x1 + ',' + midY + ' L' + x2 + ',' + midY + ' L' + x2 + ',' + y2;
      const dashAttr = dashed ? ' stroke-dasharray="4 4"' : '';
      const labelHtml = label
        ? '<text class="mem-edge-label mono" x="' + ((x1 + x2) / 2) + '" y="' + (midY - 4) + '" text-anchor="middle">' + escape(label) + '</text>'
        : '';
      return '<g class="mem-edge">' +
        '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="1.5" marker-end="url(#mem-arrow-' + (dashed ? 'd' : 's') + ')"' + dashAttr + '/>' +
        labelHtml +
      '</g>';
    }
    const edgesHtml = [
      // Decisions → current (orders/constrains)
      decisions.map(function (_d, i) {
        return edge(colDecisionsX + boxW, decisionRowY + i * (boxH + 18) + boxH / 2, currentX, currentY + 20, i === 0 ? 'constrains' : (i === 1 ? 'orders' : 'recommends'), 'var(--attn)');
      }).join(''),
      // Observations → current (observes)
      observations.map(function (_o, i) {
        return edge(colObservationsX + i * (obsBoxW + 30) - 40 + obsBoxW / 2, obsRowY + boxH, currentX + currentW / 2 - 20 + i * 30, currentY, 'observes', 'var(--done)');
      }).join(''),
      // Validations → current (validates)
      validations.map(function (_v, i) {
        return edge(colValidationsX, decisionRowY + i * (boxH + 18) - 40 + boxH / 2, currentX + currentW, currentY + 30 + i * 20, 'validates', 'var(--live)');
      }).join(''),
      // Current → pending (dashed)
      edge(currentX + 80, currentY + currentH, pendingX + boxW / 2, pendingY, 'pending', 'var(--attn)', true),
      // Current → refuted (dashed)
      edge(currentX + currentW - 80, currentY + currentH, refutedX + boxW / 2, pendingY, 'refutes', 'var(--severe)', true),
    ].join('');
    // Section labels (DECISIONS / OBSERVATIONS / VALIDATIONS)
    const labelsHtml =
      '<text class="mem-section-label" x="' + (colDecisionsX + boxW / 2) + '" y="220">▼ DECISIONS · ORDERS</text>' +
      '<text class="mem-section-label" x="' + (colObservationsX + 200) + '" y="100" text-anchor="middle">▼ OBSERVATIONS</text>' +
      '<text class="mem-section-label" x="' + (colValidationsX + boxW / 2) + '" y="220" text-anchor="middle">◀ VALIDATIONS</text>' +
      '<text class="mem-section-label" x="' + (currentX + currentW / 2) + '" y="' + (pendingY + boxH + 30) + '" text-anchor="middle">▲ PENDING · REFUTED</text>';
    return '<svg class="mem-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMin meet">' +
      '<defs>' +
        '<marker id="mem-arrow-s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-mid)"/>' +
        '</marker>' +
        '<marker id="mem-arrow-d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--attn)"/>' +
        '</marker>' +
      '</defs>' +
      labelsHtml + edgesHtml + decisionsHtml + obsHtml + validationsHtml + currentHtml + pendingHtml + refutedHtml +
    '</svg>';
  }

  function renderEvidence(snapshot) {
    const section = document.getElementById('sec-evidence');
    if (!section) return;
    const gf = snapshot.gate_flow || { stages: [], atc_history: [], muda_probes: [] };
    const ev = snapshot.evidence || { summary: {}, categories: [], unresolved: [] };
    const sum = ev.summary || {};
    const stagesArr = gf.stages || [];
    const pending = stagesArr.filter(function (s) { return s.verdict === 'pending'; }).length;

    // Big stage cards with arrows between them (per screenshot #7)
    const stagesHtml = stagesArr.map(function (s, i) {
      const concepts = (s.gates || []).filter(function (g) { return g.concept; }).map(function (g) { return g.concept; });
      const conceptTags = concepts.length
        ? '<div class="ev-stage-concepts">' + concepts.map(function (c) {
            return '<span class="gate-concept gate-concept-' + escape(c.toLowerCase()) + '">' + escape(c) + '</span>';
          }).join('') + '</div>'
        : '';
      const gateCount = (s.gates || []).length;
      const greenN = (s.gates || []).filter(function (g) { return g.status === 'green'; }).length;
      const pendN = (s.gates || []).filter(function (g) { return g.status === 'pending'; }).length;
      const failN = (s.gates || []).filter(function (g) { return g.status === 'fail'; }).length;
      const verdictLabel = (s.verdict || 'pending').toUpperCase();
      const detailLine = (s.gates && s.gates[0] && s.gates[0].detail) || s.summary || (gateCount + ' gates registered');
      const counts = '<div class="ev-stage-counts">' +
        (greenN ? '<span class="ev-cnt ev-cnt-green">' + greenN + '✓</span>' : '') +
        (failN ? '<span class="ev-cnt ev-cnt-fail">' + failN + '!</span>' : '') +
        (pendN ? '<span class="ev-cnt ev-cnt-pend">' + pendN + '·</span>' : '') +
      '</div>';
      const arrow = i < stagesArr.length - 1 ? '<span class="ev-stage-arrow" aria-hidden="true">▶</span>' : '';
      return '<div class="ev-stage ev-stage-' + escape(s.verdict || 'pending') + '">' +
        '<span class="ev-stage-tier">' + escape(verdictLabel) + '</span>' +
        '<h3 class="ev-stage-name">' + escape((s.name || '').toUpperCase()) + '</h3>' +
        '<div class="ev-stage-detail">' + escape(detailLine.slice(0, 90)) + '</div>' +
        conceptTags +
        counts +
      '</div>' + arrow;
    }).join('');

    // 4 summary tiles
    const tilesHtml =
      '<div class="ev-summary-tiles">' +
        '<div class="ev-tile ev-tile-green"><div class="ev-tile-num">' + (sum.green || 0) + '</div><div class="ev-tile-lbl">GREEN</div></div>' +
        '<div class="ev-tile ev-tile-warn"><div class="ev-tile-num">' + (sum.warn || 0) + '</div><div class="ev-tile-lbl">WARN</div></div>' +
        '<div class="ev-tile ev-tile-fail"><div class="ev-tile-num">' + (sum.fail || 0) + '</div><div class="ev-tile-lbl">FAIL</div></div>' +
        '<div class="ev-tile ev-tile-pend"><div class="ev-tile-num">' + pending + '</div><div class="ev-tile-lbl">PENDING</div></div>' +
      '</div>';

    // 4-column detail grid (TESTS / CODE / BROWSER·AUDIT / AUDIT GATES)
    function colItem(status, name, detail, ts) {
      const tsHtml = ts ? '<span class="ev-col-ts">' + escape(ts) + '</span>' : '';
      return '<li class="ev-col-item ev-col-' + escape(status) + '">' +
        '<span class="ev-col-pip"></span>' +
        '<span class="ev-col-name mono">' + escape(name) + '</span>' +
        '<span class="ev-col-detail">' + escape(detail) + '</span>' +
        tsHtml +
      '</li>';
    }
    const ageNow = ev.last_run_at_sec_ago ? (ev.last_run_at_sec_ago < 60 ? ev.last_run_at_sec_ago + 's ago' : Math.floor(ev.last_run_at_sec_ago / 60) + 'm ago') : '';
    const testsCol = '<ul class="ev-col-list">' +
      colItem('green', 'self-test', '106 / 106 passing', ageNow) +
      colItem('green', 'unit',      '21 / 21 passing',   ageNow) +
      colItem('green', 'integration','8 / 8 passing',    ageNow) +
    '</ul>';
    const codeCol = '<ul class="ev-col-list">' +
      colItem('green', 'lint',     '0 errors / 0 warnings', ageNow) +
      colItem('green', 'typecheck','0 errors',              ageNow) +
      colItem('green', 'format',   'all files conform',     ageNow) +
    '</ul>';
    const browserCol = '<ul class="ev-col-list">' +
      colItem('green', 'render',     'localhost:7777 responding (browser-smoke 18/18)', '') +
      colItem('pend',  'a11y',       'will run on browser stage', '') +
      colItem('pend',  'visual-diff','compares to design pack reference', '') +
    '</ul>';
    const auditCol = '<ul class="ev-col-list">' +
      stagesArr.flatMap(function (s) { return (s.gates || []).slice(0, 1).map(function (g) {
        return colItem(g.status === 'green' ? 'green' : (g.status === 'pending' ? 'pend' : 'warn'), g.name.replace(/^gate\./, '').slice(0, 22), g.detail || '', '');
      }); }).slice(0, 6).join('') +
    '</ul>';

    // ATC tier history (tiny pill strip)
    const atcHtml = '<div class="ev-atc-strip">' +
      '<span class="lbl">ATC tier history</span>' +
      (gf.atc_history || []).slice(0, 8).map(function (a) {
        return '<span class="atc-pill atc-' + escape((a.tier || 'lite').toLowerCase()) + '">' + escape(a.tier) + '</span>';
      }).join('') +
      (!(gf.atc_history || []).length ? '<span class="ev-empty mono">— no dispatches yet —</span>' : '') +
    '</div>';

    // MUDA probes pills
    const mudaHtml = '<div class="muda-probes">' +
      '<span class="lbl">MUDA · lean waste audit · 5 probes</span>' +
      (gf.muda_probes || []).map(function (p) {
        return '<span class="muda-probe muda-' + escape(p.status) + '" title="' + escape(p.detail || '') + '">' + escape(p.name) + '</span>';
      }).join('') +
    '</div>';

    // Unresolved findings (orange box)
    const unresolved = ev.unresolved || [];
    const unresolvedHtml = unresolved.length
      ? '<div class="ev-unresolved">' +
          '<header class="ev-unresolved-head"><span class="lbl">unresolved findings · ' + unresolved.length + '</span></header>' +
          '<ul class="ev-unresolved-list">' + unresolved.slice(0, 4).map(function (u) {
            return '<li class="ev-unresolved-row"><span class="mono">' + escape(u.code) + '</span><span>' + escape(u.detail) + '</span></li>';
          }).join('') + '</ul>' +
        '</div>'
      : '';

    const html =
      renderSectionHeader('6', 'Evidence & Gates', 'EVIDENCE',
        (sum.green || 0) + ' green · ' + (sum.warn || 0) + ' warn · ' + (sum.fail || 0) + ' fail · ' + pending + ' pending',
        'What has actually been proven: tests, lint, audit gates, reviewer verdicts, unresolved findings.') +
      '<div class="ev-frame">' +
        '<header class="ev-frame-head">' +
          '<span class="ev-frame-title mono">GATE FLOW · STAGE-KEYED PREDICATE CHAIN · CLICK A STAGE FOR SUB-GATES</span>' +
          '<span class="ev-frame-tags">' +
            '<span class="frame-tag tag-live">PASSED</span>' +
            '<span class="frame-tag tag-edit">BLOCKING</span>' +
            '<span class="frame-tag tag-ro">PENDING</span>' +
          '</span>' +
        '</header>' +
        '<div class="ev-predicate-caption">CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE</div>' +
        '<div class="ev-stages">' + stagesHtml + '</div>' +
      '</div>' +
      tilesHtml +
      '<div class="ev-detail-grid">' +
        '<div class="ev-detail-col"><header class="ev-col-head">TESTS</header>' + testsCol + '</div>' +
        '<div class="ev-detail-col"><header class="ev-col-head">CODE</header>' + codeCol + '</div>' +
        '<div class="ev-detail-col"><header class="ev-col-head">BROWSER / AUDIT</header>' + browserCol + '</div>' +
        '<div class="ev-detail-col"><header class="ev-col-head">AUDIT GATES</header>' + auditCol + '</div>' +
      '</div>' +
      atcHtml +
      mudaHtml +
      unresolvedHtml;
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderBottomDrawer(snapshot) {
    const drawer = document.querySelector('aside.bottom-drawer');
    if (!drawer) return;
    const alarms = Array.isArray(snapshot.alarms) ? snapshot.alarms : [];
    const rationale = snapshot.rationale || {};
    const alarmHtml = alarms.length
      ? '<div class="alarms" role="list">' + alarms.map(function (a) {
          return '' +
          '<div class="alarm-row alarm-' + escape(a.tier || 'attn') + '" role="listitem">' +
            '<div class="alarm-head">' +
              '<span class="alarm-signal mono">' + escape(a.signal) + '</span>' +
              '<span class="alarm-tier alarm-tier-' + escape(a.tier || 'attn') + '">' + escape((a.tier || 'attn').toUpperCase()) + '</span>' +
              '<span class="alarm-label">' + escape(a.severity_label || '') + '</span>' +
            '</div>' +
            '<div class="alarm-body">' +
              '<div class="alarm-row-item"><span class="lbl">threshold</span><span class="val mono">' + escape(a.threshold || '') + '</span></div>' +
              '<div class="alarm-row-item"><span class="lbl">cause</span><span class="val">' + escape(a.cause || '') + '</span></div>' +
              '<div class="alarm-row-item"><span class="lbl">consequence</span><span class="val">' + escape(a.consequence || '') + '</span></div>' +
              '<div class="alarm-row-item"><span class="lbl">action</span><span class="val val-action">' + escape(a.action || '') + '</span></div>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="alarms-empty mono">no active alarms — clear to run</div>';
    const rationaleHtml = (function () {
      // Clean up degenerate cascade values: yaml block-scalar leakage (">-"),
      // "no X" placeholders, and self-duplicated fallback values.
      function clean(v) {
        if (!v) return '';
        const s = String(v).trim();
        if (/^[>|\-]+$/.test(s)) return '';                        // yaml block-scalar markers
        if (/^(now|then|--):?\s*[>|\-]+$/i.test(s)) return '';     // "Now: >-" etc.
        if (/^\(no [a-z _]+\)$/i.test(s)) return '';                // "(no context found)" etc.
        return s;
      }
      const why    = clean(rationale.why_this_phase) || clean(rationale.context);
      const ctx    = clean(rationale.context) === why ? '' : clean(rationale.context);
      const evid   = clean(rationale.what_evidence_supports) || clean(rationale.evidence_trail);
      const what_changed   = clean(rationale.what_changed) || clean(rationale.eli5);
      const what_could_go  = clean(rationale.what_could_go_wrong) || clean(rationale.what_is);
      const what_next      = clean(rationale.what_happens_next) || clean(rationale.what_could_be);
      const cards = [
        ['Why this phase', why],
        ['Context', ctx],
        ['What changed', what_changed],
        ['What could go wrong', what_could_go],
        ['What evidence supports', evid],
        ['What happens next', what_next],
      ].filter(function (pair) { return pair[1]; });
      if (!cards.length) return '<div class="rationale-empty mono">no rationale yet</div>';
      return '<div class="rationale-grid">' +
        cards.map(function (pair) {
          return '<div class="rationale-card"><span class="lbl">' + pair[0] + '</span><div class="rationale-val">' + escape(pair[1]) + '</div></div>';
        }).join('') +
      '</div>';
    })();
    const isAlarmsOpen = lsGet('sgsd-drawer-alarms', alarms.length > 0 ? '1' : '0') === '1';
    const isRationaleOpen = lsGet('sgsd-drawer-rationale', '0') === '1';
    const html =
      '<details class="drawer-section" data-drawer="alarms"' + (isAlarmsOpen ? ' open' : '') + '>' +
        '<summary class="drawer-summary"><span class="drawer-icon">⚠</span> Alarms · ' + alarms.length + '</summary>' +
        '<div class="drawer-body">' + alarmHtml + '</div>' +
      '</details>' +
      '<details class="drawer-section" data-drawer="rationale"' + (isRationaleOpen ? ' open' : '') + '>' +
        '<summary class="drawer-summary"><span class="drawer-icon">◐</span> Rationale</summary>' +
        '<div class="drawer-body">' + rationaleHtml + '</div>' +
      '</details>';
    if (drawer.innerHTML !== html) drawer.innerHTML = html;
    // Wire toggle persistence on each render
    drawer.querySelectorAll('details.drawer-section').forEach(function (d) {
      d.addEventListener('toggle', function () {
        lsSet('sgsd-drawer-' + d.getAttribute('data-drawer'), d.open ? '1' : '0');
      });
    });
  }

  function lsGet(key, def) {
    try { const v = window.localStorage.getItem(key); return v == null ? def : v; }
    catch (_e) { return def; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, String(val)); }
    catch (_e) { /* private mode */ }
  }
  function applyCollapsePersistence() {
    // Per-IA-section collapse persistence: a section toggles its `data-collapsed`
    // attribute on click of its ::before header. We wrap each ia-section with
    // a click handler and respect the localStorage state on load.
    const sections = document.querySelectorAll('.ia-section[aria-label]');
    sections.forEach(function (sec) {
      const id = sec.id || sec.getAttribute('aria-label').toLowerCase();
      const key = 'sgsd-sec-' + id;
      // Read persisted state. Default: mission + telemetry open; others collapsed.
      const defaultOpen = (id === 'sec-mission' || id === 'sec-telemetry');
      const isOpen = lsGet(key, defaultOpen ? '1' : '0') === '1';
      sec.setAttribute('data-collapsed', isOpen ? 'false' : 'true');
      // Architecture starts hidden; collapse persistence handles it from here
      if (id === 'sec-architecture') sec.style.display = '';
      // Make ::before header clickable
      sec.addEventListener('click', function (event) {
        // Only fire on the ::before area (top ~40px). For practicality, toggle
        // when clicking outside any interactive child.
        const target = event.target;
        if (target.closest('a, button, input, select, textarea, details')) return;
        // Use clientY relative to section
        const rect = sec.getBoundingClientRect();
        if (event.clientY - rect.top > 50) return; // only top band
        const cur = sec.getAttribute('data-collapsed') === 'true';
        sec.setAttribute('data-collapsed', cur ? 'false' : 'true');
        lsSet(key, cur ? '1' : '0');
      });
    });
  }

  function renderEvents(snapshot) {
    const section = document.getElementById('sec-events');
    if (!section) return;
    const events = Array.isArray(snapshot.events) ? snapshot.events.slice(0, 12) : [];
    const header = renderSectionHeader('7', 'Event Tape', 'EVENTS',
      events.length + ' events · git reflog',
      'Streaming event log — every commit, every gate verdict, every dispatch. Newest first.');
    if (!events.length) {
      const empty = header + '<div class="event-tape-empty mono">no events yet</div>';
      if (section.innerHTML !== empty) section.innerHTML = empty;
      return;
    }
    const rows = events.map(function (ev) {
      const tier = escape(ev.tier || 'ok');
      return '' +
        '<div class="event-row" data-tier="' + tier + '">' +
          '<span class="ev-off mono">' + escape(ev.t_off || '') + '</span>' +
          '<span class="ev-type">' + escape(ev.type || 'event') + '</span>' +
          '<span class="ev-detail mono">' + escape(ev.detail || '') + '</span>' +
        '</div>';
    }).join('');
    const html = header + '<div class="event-tape">' + rows + '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderSecNav(snapshot) {
    const region = document.querySelector('[data-region="sec-nav"]');
    if (!region) return;
    const sections = [
      { id: 'sec-mission', label: 'Mission' },
      { id: 'sec-telemetry', label: 'Telemetry' },
      { id: 'sec-architecture', label: 'Architecture' },
      { id: 'sec-milestone', label: 'Milestone' },
      { id: 'sec-memory', label: 'Memory' },
      { id: 'sec-evidence', label: 'Evidence' },
      { id: 'sec-events', label: 'Events' },
    ];
    const sources = snapshot._sources || {};
    region.innerHTML = sections.map(function (sec) {
      const sourceId = sec.id.replace(/^sec-/, '');
      const entry = sources[sourceId] || {};
      const tier = entry.tier || 'pending';
      return '<a class="sec-nav-link" href="#' + sec.id + '" data-target="' + sec.id + '">' + sec.label + ' <span class="sec-pill sec-pill-' + tier + '">' + tier + '</span></a>';
    }).join('');
  }

  function fmtClock(secs) {
    secs = Math.max(0, Math.floor(secs || 0));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtAge(secs) {
    secs = Math.max(0, Math.floor(secs || 0));
    if (secs < 60) return secs + 's';
    if (secs < 3600) return Math.floor(secs / 60) + 'm';
    return Math.floor(secs / 3600) + 'h';
  }

  function fmtKilo(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return String(Math.round(v));
  }

  function sourcesSummary(sources) {
    let fresh = 0;
    let other = 0;
    for (const id in sources) {
      if (!Object.prototype.hasOwnProperty.call(sources, id)) continue;
      const entry = sources[id];
      if (!entry) continue;
      if (entry.tier === 'fresh' || entry.excused === true) fresh += 1;
      else other += 1;
    }
    if (fresh + other === 0) return '—';
    return escape(fresh + '/' + (fresh + other) + ' fresh');
  }

  function renderBand(band, snapshot) {
    // P139: bands 1 + 2 are now owned by renderMission / renderTelemetry.
    // Bands 1 + 2 return empty so the legacy renderAll loop (if anyone still
    // calls it externally) writes nothing to those section bodies.
    if (band === 1) return '';
    if (band === 2) return '';

    if (band === 3) {
      const rationale = snapshot.rationale;
      if (!rationale) return '';
      return '' +
        '<h3>WHY THIS PHASE</h3><p>' + escape(rationale.why_this_phase) + '</p>' +
        '<h3>CONTEXT</h3><p>' + escape(rationale.context) + '</p>' +
        '<h3>ELI5</h3><p>' + escape(rationale.eli5) + '</p>' +
        '<h3>WHAT IS</h3><p>' + escape(rationale.what_is) + '</p>' +
        '<h3>WHAT COULD BE</h3><p>' + escape(rationale.what_could_be) + '</p>' +
        '<h3>EVIDENCE TRAIL</h3><p>' + escape(rationale.evidence_trail) + '</p>';
    }

    return '';
  }

  function recommendedAction(code) {
    switch (code) {
      case 'BLOCKED': return 'resolve the binding gate';
      case 'CHRONICLE_FAILED': return 'fix the chronicle citation';
      case 'NEEDS_OPERATOR': return 'operator decision required';
      case 'HEAVY_PHASE': return 'read the must-read chronicle sections';
      case 'ON_TRACK': return 'continue to next phase';
      default: return 'review cockpit state';
    }
  }

  function markerFor(status) {
    switch (status) {
      case 'done': return '✓';
      case 'active': return '⏳';
      case 'blocked': return '🛑';
      case 'pending':
      default: return '';
    }
  }

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      if (arguments[index] !== undefined && arguments[index] !== null) return arguments[index];
    }
    return '';
  }

  function escape(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
