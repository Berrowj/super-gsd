(function () {
  'use strict';

  const lastHtml = { 1: null, 2: null, 3: null };

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/snapshot')
      .then(function (response) { return response.json(); })
      .then(renderAll);

    const events = new EventSource('/events');
    events.onmessage = function (event) { renderAll(JSON.parse(event.data)); };
  });

  function renderAll(snapshot) {
    [1, 2, 3].forEach(function (band) {
      const newHtml = renderBand(band, snapshot || {});
      const element = document.querySelector('[data-band="' + band + '"]');

      if (!element) {
        return;
      }

      if (band === 3) {
        element.style.display = snapshot && snapshot.rationale ? '' : 'none';
      }

      if (newHtml !== lastHtml[band]) {
        element.innerHTML = newHtml;
        lastHtml[band] = newHtml;
      }
    });
  }

  function renderBand(band, snapshot) {
    if (band === 1) {
      // Band 1 - Governing Thought
      const northStar = snapshot.north_star || {};
      const alerts = snapshot.alerts || {};
      const topAlert = alerts.top;
      const action = recommendedAction(northStar.code);
      const alertHtml = topAlert
        ? `<p class="alert"><span>⚠ ${escape(topAlert.signal)}</span>${alerts.others_count > 0 ? '<span> (+' + escape(alerts.others_count) + ' more)</span>' : ''}</p>`
        : '';

      return `
        <p class="northstar"><strong>${escape(northStar.code)}</strong>: ${escape(northStar.message)}</p>
        <p class="do-next"><strong>DO NEXT:</strong> ${escape(action)}</p>
        ${alertHtml}
      `;
    }

    if (band === 2) {
      // Band 2 - MECE Supporting
      const pipeline = snapshot.stage_pipeline || {};
      const stages = Array.isArray(pipeline.stages) ? pipeline.stages.slice(0, 5) : [];
      const active = stages[pipeline.active_index] || {};
      const stageHtml = stages
        .map(function (stage) {
          const status = stage.status || 'pending';
          return `<span class="stage stage-${escape(status)}">${escape(stage.name)} ${markerFor(status)}</span>`;
        })
        .join('');
      const trends = snapshot.trends || {};
      const fog = firstDefined(trends.fog, snapshot.fog, 'n/a');
      const dispatches = firstDefined(trends.dispatches, snapshot.dispatches, 'n/a');
      const tokens = firstDefined(trends.tokens, snapshot.tokens, 'n/a');

      return `
        <div class="stage-pipeline">${stageHtml}</div>
        <p><strong>WHY-RUNNING:</strong> phase ${escape(active.owner || active.name || 'unknown')}; cause ${escape(pipeline.cause || 'unavailable')}; ETA ${escape(pipeline.eta || 'unavailable')}</p>
        <p><strong>UNLOCKS:</strong> (derived from roadmap)</p>
        <p><strong>BLOCKED-BY:</strong> ${escape(pipeline.blocker || 'nothing')}</p>
        <div class="trend-strip">
          <p><strong>fog:</strong> ${escape(fog)} <span class="trend-bar">|</span></p>
          <p><strong>dispatches:</strong> ${escape(dispatches)} <span class="trend-bar">|</span></p>
          <p><strong>tokens:</strong> ${escape(tokens)} <span class="trend-bar">|</span></p>
        </div>
      `;
    }

    if (band === 3) {
      // Band 3 - Rationale
      const rationale = snapshot.rationale;
      if (!rationale) {
        return '';
      }

      return `
        <h3>WHY THIS PHASE</h3>
        <p>${escape(rationale.why_this_phase)}</p>
        <h3>CONTEXT</h3>
        <p>${escape(rationale.context)}</p>
        <h3>ELI5</h3>
        <p>${escape(rationale.eli5)}</p>
        <h3>WHAT IS</h3>
        <p>${escape(rationale.what_is)}</p>
        <h3>WHAT COULD BE</h3>
        <p>${escape(rationale.what_could_be)}</p>
        <h3>EVIDENCE TRAIL</h3>
        <p>${escape(rationale.evidence_trail)}</p>
      `;
    }

    return '';
  }

  function recommendedAction(code) {
    switch (code) {
      case 'BLOCKED':
        return 'resolve the binding gate';
      case 'CHRONICLE_FAILED':
        return 'fix the chronicle citation';
      case 'NEEDS_OPERATOR':
        return 'operator decision required';
      case 'HEAVY_PHASE':
        return 'read the must-read chronicle sections';
      case 'ON_TRACK':
        return 'continue to next phase';
      default:
        return 'review cockpit state';
    }
  }

  function markerFor(status) {
    switch (status) {
      case 'done':
        return '✓';
      case 'active':
        return '⏳';
      case 'blocked':
        return '🛑';
      case 'pending':
      default:
        return '';
    }
  }

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      if (arguments[index] !== undefined && arguments[index] !== null) return arguments[index];
    }
    return '';
  }

  function escape(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
