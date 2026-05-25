(function () {
  'use strict';

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

    // Band 1 + Band 2 are now owned by renderMission / renderTelemetry (P139).
    // Band 3 (sec-architecture) keeps legacy renderBand(3) until P140 lands the
    // architecture diagram.
    const band3Html = renderBand(3, snap);
    const band3Element = document.querySelector('[data-band="3"]');
    if (band3Element) {
      band3Element.style.display = snap.rationale ? '' : 'none';
      if (band3Html !== lastHtml[3]) {
        band3Element.innerHTML = band3Html;
        lastHtml[3] = band3Html;
      }
    }
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
    const html =
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
    const html = '<div class="telem">' +
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

  function renderArchitecture(snapshot) {
    const section = document.getElementById('sec-architecture');
    if (!section) return;
    section.style.display = '';
    const arch = snapshot.architecture || { nodes: [], edges: [] };
    const nodes = Array.isArray(arch.nodes) ? arch.nodes : [];
    const edges = Array.isArray(arch.edges) ? arch.edges : [];
    if (!nodes.length) {
      const empty = '<div class="arch-empty mono">no architecture data</div>';
      if (section.innerHTML !== empty) section.innerHTML = empty;
      return;
    }
    const nodesHtml = nodes.map(function (n) {
      const kind = escape(n.kind || 'artefact');
      return '' +
        '<div class="arch-node arch-kind-' + kind + '" data-id="' + escape(n.id) + '">' +
          '<span class="arch-kind">' + kind + '</span>' +
          '<span class="arch-label">' + escape(n.label || n.id) + '</span>' +
        '</div>';
    }).join('');
    const edgesHtml = edges.map(function (e) {
      return '<div class="arch-edge"><span class="arch-edge-from mono">' + escape(e.from) + '</span><span class="arch-edge-arrow">→</span><span class="arch-edge-to mono">' + escape(e.to) + '</span><span class="arch-edge-kind">' + escape(e.kind || 'flow') + '</span></div>';
    }).join('');
    const html =
      '<div class="arch-pane">' +
        '<div class="arch-nodes">' + nodesHtml + '</div>' +
        '<div class="arch-edges">' + edgesHtml + '</div>' +
      '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
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
    const html =
      '<div class="milestone-strip">' + stripHtml + '</div>' +
      '<div class="milestone-phases">' + phasesHtml + '</div>' +
      detailHtml;
    if (section.innerHTML !== html) section.innerHTML = html;
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
    const html =
      '<div class="memory-pane">' +
        '<div class="memory-mesh">' + cardsHtml + '</div>' +
        '<div class="lineage-chain"><span class="lin-title lbl">' + escape(lineage.title || 'Lineage') + '</span>' + lineageHtml + '</div>' +
      '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderEvidence(snapshot) {
    const section = document.getElementById('sec-evidence');
    if (!section) return;
    const gf = snapshot.gate_flow || { stages: [], atc_history: [], muda_probes: [] };
    const ev = snapshot.evidence || { summary: {}, categories: [], unresolved: [] };
    const stagesHtml = (gf.stages || []).map(function (s) {
      const gates = (s.gates || []).map(function (g) {
        const concept = g.concept ? '<span class="gate-concept gate-concept-' + escape(g.concept.toLowerCase()) + '">' + escape(g.concept) + '</span>' : '';
        return '<div class="gate-row gate-' + escape(g.status) + '">' +
          '<span class="gate-name mono">' + escape(g.name) + '</span>' +
          concept +
          '<span class="gate-detail">' + escape(g.detail || '') + '</span>' +
        '</div>';
      }).join('');
      return '<div class="gate-stage gate-stage-' + escape(s.verdict) + '">' +
        '<header class="gate-stage-head"><span class="gate-stage-name">' + escape(s.name) + '</span><span class="gate-stage-verdict">' + escape(s.verdict) + '</span></header>' +
        '<div class="gate-stage-gates">' + gates + '</div>' +
      '</div>';
    }).join('');
    const summary = ev.summary || { green: 0, warn: 0, fail: 0 };
    const summaryHtml = '<div class="evidence-summary">' +
      '<span class="es-green">' + (summary.green || 0) + ' green</span>' +
      '<span class="es-warn">' + (summary.warn || 0) + ' warn</span>' +
      '<span class="es-fail">' + (summary.fail || 0) + ' fail</span>' +
    '</div>';
    const cardsHtml = (ev.categories || []).map(function (c) {
      const itemsHtml = (c.items || []).slice(0, 6).map(function (it) {
        return '<li class="ec-item ec-' + escape(it.status) + '"><span class="ec-code mono">' + escape(it.code) + '</span><span class="ec-detail">' + escape(it.detail) + '</span></li>';
      }).join('');
      return '<div class="evidence-card">' +
        '<header class="ec-head">' + escape(c.name) + '</header>' +
        '<ul class="ec-list">' + itemsHtml + '</ul>' +
      '</div>';
    }).join('');
    const mudaHtml = '<div class="muda-probes">' +
      '<span class="lbl">MUDA waste audit</span>' +
      (gf.muda_probes || []).map(function (p) {
        return '<span class="muda-probe muda-' + escape(p.status) + '" title="' + escape(p.detail || '') + '">' + escape(p.name) + '</span>';
      }).join('') +
    '</div>';
    const html =
      '<div class="evidence-pane">' +
        '<div class="gate-flow">' + stagesHtml + '</div>' +
        summaryHtml +
        '<div class="evidence-cards">' + cardsHtml + '</div>' +
        mudaHtml +
      '</div>';
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function renderEvents(snapshot) {
    const section = document.getElementById('sec-events');
    if (!section) return;
    const events = Array.isArray(snapshot.events) ? snapshot.events.slice(0, 12) : [];
    if (!events.length) {
      const empty = '<div class="event-tape-empty mono">no events yet</div>';
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
    const html = '<div class="event-tape">' + rows + '</div>';
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
