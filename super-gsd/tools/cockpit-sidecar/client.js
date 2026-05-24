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

    [1, 2, 3].forEach(function (band) {
      const newHtml = renderBand(band, snap);
      const element = document.querySelector('[data-band="' + band + '"]');
      if (!element) return;
      if (band === 3) {
        element.style.display = snap.rationale ? '' : 'none';
      }
      if (newHtml !== lastHtml[band]) {
        element.innerHTML = newHtml;
        lastHtml[band] = newHtml;
      }
    });
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
    const objective = escape(mission.objective || 'no objective');
    const risk = escape((snapshot.risk && snapshot.risk.label) || mission.risk_tier || 'low');
    const nextAction = escape((snapshot.next_action && snapshot.next_action.verb) || 'review');
    const handle = escape(owner.handle || 'claude');
    region.innerHTML = '' +
      '<span class="cmd-objective"><strong>OBJECTIVE:</strong> ' + objective + '</span>' +
      '<span class="cmd-next"><strong>NEXT:</strong> ' + nextAction + '</span>' +
      '<span class="cmd-owner"><strong>OWNER:</strong> ' + handle + '</span>' +
      '<span class="cmd-risk"><strong>RISK:</strong> ' + risk + '</span>';
  }

  function renderScanBar(snapshot) {
    const region = document.querySelector('[data-region="scanbar"]');
    if (!region) return;
    const northStar = snapshot.north_star || {};
    const alerts = snapshot.alerts || {};
    const mission = snapshot.mission || {};
    const sources = snapshot._sources || {};
    const recentEvent = (snapshot.events && snapshot.events[0]) || {};
    const cells = [
      ['NOW', escape(northStar.code || mission.phase_id || 'pending')],
      ['WHY', escape(mission.why_running || northStar.message || '—')],
      ['JUST CHANGED', escape(recentEvent.detail || '—') + (recentEvent.t_off ? ' (' + escape(recentEvent.t_off) + ')' : '')],
      ['RISK', escape((alerts.top && alerts.top.signal) || mission.risk_tier || 'low')],
      ['DO NEXT', escape((snapshot.next_action && snapshot.next_action.verb) || northStar.code || '—')],
      ['EVIDENCE', sourcesSummary(sources)],
    ];
    region.innerHTML = cells.map(function (cell) {
      return '<div class="scan-cell"><div class="scan-label">' + cell[0] + '</div><div class="scan-value">' + cell[1] + '</div></div>';
    }).join('');
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
      const pill = '<span class="sec-pill sec-pill-' + tier + '">' + tier + '</span>';
      return '<a class="sec-nav-link" href="#' + sec.id + '" data-target="' + sec.id + '">' + sec.label + ' ' + pill + '</a>';
    }).join('');
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
    if (band === 1) {
      const northStar = snapshot.north_star || {};
      const alerts = snapshot.alerts || {};
      const topAlert = alerts.top;
      const action = recommendedAction(northStar.code);
      const alertHtml = topAlert
        ? '<p class="alert"><span>⚠ ' + escape(topAlert.signal) + '</span>' + (alerts.others_count > 0 ? '<span> (+' + escape(alerts.others_count) + ' more)</span>' : '') + '</p>'
        : '';
      return '' +
        '<p class="northstar"><strong>' + escape(northStar.code) + '</strong>: ' + escape(northStar.message) + '</p>' +
        '<p class="do-next"><strong>DO NEXT:</strong> ' + escape(action) + '</p>' +
        alertHtml;
    }

    if (band === 2) {
      const pipeline = snapshot.stage_pipeline || {};
      const stages = Array.isArray(pipeline.stages) ? pipeline.stages.slice(0, 5) : [];
      const active = stages[pipeline.active_index] || {};
      const stageHtml = stages.map(function (stage) {
        const status = stage.status || 'pending';
        return '<span class="stage stage-' + escape(status) + '">' + escape(stage.name) + ' ' + markerFor(status) + '</span>';
      }).join('');
      const trends = snapshot.trends || {};
      const fog = firstDefined(trends.fog, snapshot.fog, 'n/a');
      const dispatches = firstDefined(trends.dispatches, snapshot.dispatches, 'n/a');
      const tokens = firstDefined(trends.tokens, snapshot.tokens, 'n/a');
      return '' +
        '<div class="stage-pipeline">' + stageHtml + '</div>' +
        '<p><strong>WHY-RUNNING:</strong> phase ' + escape(active.owner || active.name || 'unknown') + '; cause ' + escape(pipeline.cause || 'unavailable') + '; ETA ' + escape(pipeline.eta || 'unavailable') + '</p>' +
        '<p><strong>UNLOCKS:</strong> (derived from roadmap)</p>' +
        '<p><strong>BLOCKED-BY:</strong> ' + escape(pipeline.blocker || 'nothing') + '</p>' +
        '<div class="trend-strip">' +
          '<p><strong>fog:</strong> ' + escape(fog) + ' <span class="trend-bar">|</span></p>' +
          '<p><strong>dispatches:</strong> ' + escape(dispatches) + ' <span class="trend-bar">|</span></p>' +
          '<p><strong>tokens:</strong> ' + escape(tokens) + ' <span class="trend-bar">|</span></p>' +
        '</div>';
    }

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
