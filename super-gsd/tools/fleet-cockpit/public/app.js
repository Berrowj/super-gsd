'use strict';

(function () {
  // All exported helpers are DOM-independent and are used by the browser path.

  /* SGSD_FLEET_HELPER_BEGIN compareLaneRows */
  function compareLaneRows(left, right) {
    var precedence = { attention: 0, error: 0, running: 1, stale: 2, idle: 3 };
    var leftStatus = left && typeof left.status === 'string' ? left.status : 'error';
    var rightStatus = right && typeof right.status === 'string' ? right.status : 'error';
    var leftRank = Object.prototype.hasOwnProperty.call(precedence, leftStatus)
      ? precedence[leftStatus] : precedence.error;
    var rightRank = Object.prototype.hasOwnProperty.call(precedence, rightStatus)
      ? precedence[rightStatus] : precedence.error;
    if (leftRank !== rightRank) return leftRank - rightRank;

    function parseActivity(row) {
      var value = row && row.last_activity_ts;
      if (typeof value !== 'string' || value.trim() === '') return null;
      var parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    var leftTime = parseActivity(left);
    var rightTime = parseActivity(right);
    if (leftTime !== null && rightTime === null) return -1;
    if (leftTime === null && rightTime !== null) return 1;
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    var leftName = left && typeof left.name === 'string' ? left.name : '';
    var rightName = right && typeof right.name === 'string' ? right.name : '';
    if (leftName < rightName) return -1;
    if (leftName > rightName) return 1;
    return 0;
  }
  /* SGSD_FLEET_HELPER_END compareLaneRows */

  /* SGSD_FLEET_HELPER_BEGIN formatValue */
  function formatValue(value) {
    if (value === null || value === undefined
        || (value && typeof value === 'object' && value.state === 'no_data')) {
      return { text: 'No data', className: 'value-no-data' };
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return { text: 'No data', className: 'value-no-data' };
      }
      return {
        text: String(value),
        className: value === 0 ? 'value-zero' : 'value-number'
      };
    }
    if (typeof value === 'boolean') {
      return { text: value ? 'true' : 'false', className: 'value-boolean' };
    }
    return { text: String(value), className: 'value-text' };
  }
  /* SGSD_FLEET_HELPER_END formatValue */

  /* SGSD_FLEET_HELPER_BEGIN formatAge */
  function formatAge(ageMinutes) {
    var formatted = formatValue(ageMinutes);
    if (formatted.className === 'value-no-data') return formatted;
    return {
      text: formatted.text + ' min',
      className: formatted.className
    };
  }
  /* SGSD_FLEET_HELPER_END formatAge */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeStatus(value) {
    var allowed = { attention: true, error: true, running: true, stale: true, idle: true };
    return typeof value === 'string' && allowed[value] ? value : 'error';
  }

  /* SGSD_FLEET_HELPER_BEGIN renderLaneRail */
  function renderLaneRail(fleet, selectedName) {
    var lanes = Array.isArray(fleet)
      ? fleet : (fleet && Array.isArray(fleet.lanes) ? fleet.lanes : []);
    if (lanes.length === 0) {
      return '<p class="rail-empty value-no-data">No data: no lanes available</p>';
    }

    return lanes.slice().sort(compareLaneRows).map(function (row) {
      var name = row && typeof row.name === 'string' ? row.name : 'unnamed lane';
      var status = safeStatus(row && row.status);
      var headlineValue = row && typeof row.headline === 'string'
        ? row.headline : 'No data';
      var headlineClass = headlineValue === 'No data' ? ' value-no-data' : '';
      var age = formatAge(row ? row.age_minutes : null);
      var current = name === selectedName ? 'true' : 'false';
      return '<button type="button" class="lane-row status-' + status
        + '" data-lane-name="' + escapeHtml(name) + '" aria-current="' + current + '">'
        + '<span class="status-dot" aria-hidden="true"></span>'
        + '<span class="lane-name">' + escapeHtml(name) + '</span>'
        + '<span class="lane-age ' + age.className + '">' + escapeHtml(age.text) + '</span>'
        + '<span class="lane-headline' + headlineClass + '">' + escapeHtml(headlineValue) + '</span>'
        + '<span class="lane-status">' + escapeHtml(status) + '</span>'
        + '</button>';
    }).join('');
  }
  /* SGSD_FLEET_HELPER_END renderLaneRail */

  /* SGSD_FLEET_HELPER_BEGIN renderObjectiveConflict */
  function renderObjectiveConflict(detail) {
    var conflict = detail && detail.objective_conflict;
    if (!conflict || typeof conflict !== 'object') return '';

    function line(label, value) {
      var formatted = formatValue(value);
      return '<p class="conflict-line ' + formatted.className + '">'
        + escapeHtml(label + ': ' + formatted.text) + '</p>';
    }

    return '<div class="conflict-block">'
      + '<p class="conflict-title">Projection conflict</p>'
      + line('Effective milestone', conflict.milestone)
      + line('Effective phase', conflict.phase)
      + line('Source', conflict.source)
      + line('STATE milestone', conflict.state_md_milestone)
      + line('STATE phase', conflict.state_md_phase)
      + line('Confidence', conflict.effective_confidence)
      + '</div>';
  }
  /* SGSD_FLEET_HELPER_END renderObjectiveConflict */

  function scalarMarkup(value) {
    var formatted = formatValue(value);
    return '<span class="' + formatted.className + '">'
      + escapeHtml(formatted.text) + '</span>';
  }

  function renderStructuredValue(value, depth) {
    var level = typeof depth === 'number' ? depth : 0;
    if (value === null || value === undefined
        || (value && typeof value === 'object' && value.state === 'no_data')) {
      return scalarMarkup(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        var emptyCount = formatValue(0);
        return '<span class="' + emptyCount.className + '">0 items</span>';
      }
      return '<ul class="data-array">' + value.map(function (item) {
        return '<li>' + renderStructuredValue(item, level + 1) + '</li>';
      }).join('') + '</ul>';
    }
    if (typeof value === 'object') {
      var keys = Object.keys(value);
      if (keys.length === 0) return scalarMarkup(null);
      if (level > 3) return scalarMarkup(JSON.stringify(value));
      return '<dl class="data-list">' + keys.map(function (key) {
        return '<dt>' + escapeHtml(key) + '</dt><dd>'
          + renderStructuredValue(value[key], level + 1) + '</dd>';
      }).join('') + '</dl>';
    }
    return scalarMarkup(value);
  }

  function renderBlockers(blockers) {
    if (!blockers || typeof blockers !== 'object') return scalarMarkup(null);
    var count = formatValue(blockers.count);
    var items = Array.isArray(blockers.items) ? blockers.items : [];
    var output = '<p>Count: <span class="' + count.className + '">'
      + escapeHtml(count.text) + '</span></p>';
    if (items.length === 0) return output;
    return output + '<ul class="blocker-list">' + items.map(function (item) {
      var text = item && item.detail !== null && item.detail !== undefined
        ? item.detail : (item && item.code !== null && item.code !== undefined ? item.code : null);
      return '<li>Blocker: ' + scalarMarkup(text) + '</li>';
    }).join('') + '</ul>';
  }

  function renderGates(gates) {
    if (!gates || typeof gates !== 'object' || gates.state === 'no_data') {
      return scalarMarkup(gates);
    }
    var count = formatValue(gates.live_event_count);
    var latest = gates.latest_per_gate && typeof gates.latest_per_gate === 'object'
      ? gates.latest_per_gate : {};
    var names = Object.keys(latest);
    var output = '<p>Live events: <span class="' + count.className + '">'
      + escapeHtml(count.text) + '</span></p>';
    if (names.length === 0) return output + renderStructuredValue(gates.gates);
    return output + '<ul class="gate-list">' + names.map(function (name) {
      var row = latest[name] && typeof latest[name] === 'object' ? latest[name] : {};
      var verdict = formatValue(row.verdict);
      var normalized = verdict.text.toLowerCase();
      var stateClass = normalized === 'fail' || normalized === 'failed'
        ? 'state-failed' : ((normalized === 'pass' || normalized === 'passed') ? 'state-passed' : '');
      return '<li class="' + stateClass + '">' + escapeHtml(name)
        + ': <strong>' + escapeHtml(verdict.text) + '</strong></li>';
    }).join('') + '</ul>';
  }

  function renderTokens(tokens) {
    if (!tokens || typeof tokens !== 'object' || tokens.state === 'no_data') {
      return scalarMarkup(tokens);
    }
    var value = formatValue(tokens.value);
    var source = formatValue(tokens.source);
    return '<dl class="data-list"><dt>Total tokens</dt><dd class="'
      + value.className + '">' + escapeHtml(value.text)
      + '</dd><dt>Source</dt><dd class="' + source.className + '">'
      + escapeHtml(source.text) + '</dd></dl>';
  }

  function renderResumeCommand(section) {
    var command = formatValue(section && section.command);
    var commandMarkup = command.className === 'value-no-data'
      ? '<span class="value-no-data">No data</span>'
      : '<code class="resume-code" tabindex="0">' + escapeHtml(command.text) + '</code>';
    return '<p class="resume-note">Selectable text only. The cockpit never executes commands.</p>'
      + commandMarkup;
  }

  var publicHelpers = {
    compareLaneRows: compareLaneRows,
    formatValue: formatValue,
    formatAge: formatAge,
    escapeHtml: escapeHtml,
    renderLaneRail: renderLaneRail,
    renderObjectiveConflict: renderObjectiveConflict,
    renderStructuredValue: renderStructuredValue,
    renderBlockers: renderBlockers,
    renderGates: renderGates,
    renderTokens: renderTokens,
    renderResumeCommand: renderResumeCommand
  };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = publicHelpers;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var API_BASE = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:7777' : '';
  var lastFleet = null;
  var lastDetail = null;
  var selectedName = null;
  var fleetRequestInFlight = false;
  var detailRequestGeneration = 0;
  var failures = { fleet: null, lane: null };

  var elements = {
    banner: document.getElementById('failure-banner'),
    cacheAge: document.getElementById('cache-age-value'),
    fleetSummary: document.getElementById('fleet-summary'),
    laneList: document.getElementById('lane-list'),
    laneName: document.getElementById('selected-lane-name'),
    detailReasons: document.getElementById('detail-reasons'),
    detailStatus: document.getElementById('detail-status'),
    laneError: document.getElementById('lane-error'),
    now: document.getElementById('section-now'),
    objective: document.getElementById('section-objective'),
    blockers: document.getElementById('section-blockers'),
    gates: document.getElementById('section-gates'),
    tokens: document.getElementById('section-tokens'),
    staleness: document.getElementById('section-staleness'),
    unlock: document.getElementById('section-unlock'),
    agents: document.getElementById('section-agents'),
    codex: document.getElementById('section-codex'),
    artifacts: document.getElementById('section-artifacts'),
    harnessEvolution: document.getElementById('section-harness-evolution'),
    resumeCommand: document.getElementById('section-resume-command'),
    rawSnapshot: document.getElementById('raw-snapshot')
  };

  function own(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function firstText(values) {
    for (var index = 0; index < values.length; index++) {
      if (typeof values[index] === 'string' && values[index].trim() !== '') {
        return values[index];
      }
    }
    return null;
  }

  function errorMessage(error) {
    return error && typeof error.message === 'string' && error.message.trim() !== ''
      ? error.message : 'request failed';
  }

  function renderBanner() {
    var messages = [];
    if (failures.fleet !== null) messages.push(failures.fleet);
    if (failures.lane !== null) messages.push(failures.lane);
    if (messages.length === 0) {
      elements.banner.hidden = true;
      elements.banner.textContent = '';
      return;
    }
    elements.banner.textContent = messages.join(' ');
    elements.banner.hidden = false;
  }

  function setFailure(kind, message) {
    failures[kind] = message;
    renderBanner();
  }

  function clearFailure(kind) {
    failures[kind] = null;
    renderBanner();
  }

  function requestJson(pathname) {
    return window.fetch(API_BASE + pathname, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    }).then(function (value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('malformed JSON envelope');
      }
      return value;
    });
  }

  function isValidFleetEnvelope(value) {
    if (!value || value.ok !== true || !Array.isArray(value.lanes)
        || !own(value, 'cache_age_seconds')) return false;
    return value.lanes.every(function (lane) {
      return !!lane && typeof lane === 'object'
        && typeof lane.name === 'string' && lane.name.trim() !== ''
        && typeof lane.status === 'string'
        && typeof lane.headline === 'string'
        && own(lane, 'age_minutes') && own(lane, 'last_activity_ts');
    });
  }

  function isValidLaneEnvelope(value, expectedName) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
      && value.name === expectedName && typeof value.status === 'string'
      && own(value, 'snapshot') && own(value, 'cache_age_seconds');
  }

  function sortedLanes(fleet) {
    return fleet && Array.isArray(fleet.lanes)
      ? fleet.lanes.slice().sort(compareLaneRows) : [];
  }

  function fleetHasLane(name) {
    return !!lastFleet && lastFleet.lanes.some(function (lane) {
      return lane.name === name;
    });
  }

  function readLaneHash() {
    var match = /^#\/lane\/(.+)$/.exec(window.location.hash);
    if (!match) return null;
    try {
      var decoded = decodeURIComponent(match[1]);
      return decoded.trim() === '' ? null : decoded;
    } catch (_error) {
      return null;
    }
  }

  function writeLaneHash(name) {
    var nextHash = '#/lane/' + encodeURIComponent(name);
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, '', window.location.pathname
      + window.location.search + nextHash);
  }

  function renderFleet() {
    if (!lastFleet) return;
    elements.laneList.innerHTML = renderLaneRail(lastFleet, selectedName);
    var laneCount = formatValue(lastFleet.lanes.length);
    elements.fleetSummary.className = 'rail-summary ' + laneCount.className;
    elements.fleetSummary.textContent = laneCount.text + ' lanes';
  }

  function updateCacheAge(value) {
    var age = formatValue(value);
    elements.cacheAge.className = age.className;
    elements.cacheAge.textContent = age.text === 'No data'
      ? age.text : age.text + ' sec';
  }

  function setSection(element, value) {
    element.innerHTML = renderStructuredValue(value);
  }

  function renderNoDetail() {
    elements.laneName.textContent = 'Select a lane';
    elements.detailReasons.textContent = 'No lane detail loaded';
    elements.detailStatus.className = 'detail-status value-no-data';
    elements.detailStatus.textContent = 'No data';
    elements.laneError.hidden = true;
    elements.laneError.textContent = '';
    setSection(elements.now, null);
    setSection(elements.objective, null);
    setSection(elements.blockers, null);
    setSection(elements.gates, null);
    setSection(elements.tokens, null);
    setSection(elements.staleness, null);
    setSection(elements.unlock, null);
    setSection(elements.agents, null);
    setSection(elements.codex, null);
    setSection(elements.artifacts, null);
    setSection(elements.harnessEvolution, null);
    elements.resumeCommand.innerHTML = renderResumeCommand(null);
    elements.rawSnapshot.className = 'value-no-data';
    elements.rawSnapshot.textContent = 'No data';
  }

  function renderDetail(detail) {
    if (!detail) {
      renderNoDetail();
      return;
    }

    var status = safeStatus(detail.status);
    var reasons = Array.isArray(detail.reasons) ? detail.reasons : [];
    var snapshot = detail.snapshot && typeof detail.snapshot === 'object'
      ? detail.snapshot : null;
    var data = snapshot && snapshot.data && typeof snapshot.data === 'object'
      ? snapshot.data : {};

    elements.laneName.textContent = detail.name;
    elements.detailStatus.className = 'detail-status status-' + status;
    elements.detailStatus.textContent = status;
    elements.detailReasons.textContent = reasons.length > 0
      ? reasons.join(' / ') : 'No data';

    if (status === 'error' || detail.ok === false) {
      var errorText = firstText([detail.error, detail.headline, detail.error_code]);
      elements.laneError.textContent = errorText === null ? 'Lane data unavailable' : errorText;
      elements.laneError.hidden = false;
    } else {
      elements.laneError.textContent = '';
      elements.laneError.hidden = true;
    }

    setSection(elements.now, data.now);
    elements.objective.innerHTML = renderStructuredValue(data.objective);
    if (data.objective && data.objective.projection_stale === true) {
      elements.objective.innerHTML += renderObjectiveConflict(detail);
    }
    elements.blockers.innerHTML = renderBlockers(data.blockers);
    elements.gates.innerHTML = renderGates(detail.gates);
    elements.tokens.innerHTML = renderTokens(detail.tokens);
    setSection(elements.staleness, data.staleness);
    setSection(elements.unlock, data.unlock);
    setSection(elements.agents, own(detail, 'agents') ? detail.agents : data.agents);
    setSection(elements.codex, data.codex);
    setSection(elements.artifacts, own(detail, 'artifacts') ? detail.artifacts : data.artifacts);
    setSection(elements.harnessEvolution, data.harness_evolution);
    elements.resumeCommand.innerHTML = renderResumeCommand(data.resume_command);

    if (snapshot === null) {
      elements.rawSnapshot.className = 'value-no-data';
      elements.rawSnapshot.textContent = 'No data';
    } else {
      elements.rawSnapshot.className = '';
      elements.rawSnapshot.textContent = JSON.stringify(snapshot, null, 2);
    }
  }

  function loadLane(name) {
    var requestGeneration = ++detailRequestGeneration;
    requestJson('/api/lane/' + encodeURIComponent(name)).then(function (detail) {
      if (!isValidLaneEnvelope(detail, name)) {
        throw new Error('invalid lane envelope');
      }
      if (requestGeneration !== detailRequestGeneration || selectedName !== name) return;
      lastDetail = detail;
      clearFailure('lane');
      renderDetail(lastDetail);
    }).catch(function (error) {
      if (requestGeneration !== detailRequestGeneration || selectedName !== name) return;
      setFailure('lane', 'Lane fetch failed for ' + name + ': ' + errorMessage(error));
      // Keep lastDetail and every last-good detail surface mounted.
    });
  }

  function selectLane(name, updateHash) {
    if (!fleetHasLane(name) || selectedName === name) return;
    selectedName = name;
    renderFleet();
    if (updateHash) writeLaneHash(name);
    loadLane(name);
  }

  function acceptFleet(fleet) {
    lastFleet = fleet;
    clearFailure('fleet');
    updateCacheAge(fleet.cache_age_seconds);

    var rows = sortedLanes(fleet);
    var hashName = readLaneHash();
    var nextName = null;
    if (hashName !== null && fleetHasLane(hashName)) {
      nextName = hashName;
    } else if (selectedName !== null && fleetHasLane(selectedName)) {
      nextName = selectedName;
    } else if (rows.length > 0) {
      nextName = rows[0].name;
    }

    if (nextName === null) {
      selectedName = null;
      lastDetail = null;
      detailRequestGeneration++;
      renderFleet();
      renderNoDetail();
      return;
    }

    var selectionChanged = selectedName !== nextName;
    selectedName = nextName;
    renderFleet();
    writeLaneHash(nextName);
    if (selectionChanged) loadLane(nextName);
  }

  function refreshFleet() {
    if (fleetRequestInFlight) return;
    fleetRequestInFlight = true;
    requestJson('/api/fleet').then(function (fleet) {
      if (!isValidFleetEnvelope(fleet)) {
        throw new Error('invalid fleet envelope');
      }
      acceptFleet(fleet);
    }).catch(function (error) {
      setFailure('fleet', 'Fleet fetch failed: ' + errorMessage(error));
      // Keep lastFleet, selectedName, cache age, rail, centre, and raw detail.
    }).then(function () {
      fleetRequestInFlight = false;
    }, function () {
      fleetRequestInFlight = false;
    });
  }

  elements.laneList.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('.lane-row[data-lane-name]') : null;
    if (!target) return;
    selectLane(target.getAttribute('data-lane-name'), true);
  });

  window.addEventListener('hashchange', function () {
    if (!lastFleet) return;
    var hashName = readLaneHash();
    if (hashName !== null && fleetHasLane(hashName)) {
      selectLane(hashName, false);
      return;
    }
    if (selectedName !== null && fleetHasLane(selectedName)) {
      writeLaneHash(selectedName);
      return;
    }
    var rows = sortedLanes(lastFleet);
    if (rows.length > 0) selectLane(rows[0].name, true);
  });

  refreshFleet();
  window.setInterval(refreshFleet, 5000);
}());
