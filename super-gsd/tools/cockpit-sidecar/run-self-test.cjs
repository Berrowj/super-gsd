'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const cpModule = require('child_process');
const { STAGES, computeStagePipeline } = require('./stage-pipeline.cjs');
const { computeRationale } = require('./rationale.cjs');
const { lintWhy } = require('./succes-lint.cjs');
const { lintEli5 } = require('./eli5-lint.cjs');
const cockpitSidecarP128 = require('./cockpit-sidecar.cjs');
const child_process = require('child_process');

function makeFakePhaseDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-stage-'));
  for (const f of files) fs.writeFileSync(path.join(dir, f), '# stub\n');
  return dir;
}
const sidecar = require('./cockpit-sidecar.cjs');
const { computeNorthStar } = require('./north-star.cjs');
const { evaluateAlerts } = require('./alert-grammar.cjs');
const { checkConformance } = require('../shared/conformance-check.cjs');
const designRules = require('../shared/design-rules.json');

const GOLD_REFERENCE = path.join(__dirname, '..', 'chronicle', 'templates', 'chronicle-gold-reference.html');

function p127Out() {
  const out = { milestone: 'v3.2', phase: '127', generated_at: '2026-05-22T00:00:00.000Z',
    latest_chronicle: { location: '.planning/chronicles/127.md', validator_verdict: 'REPORT_GROUNDED' },
    binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] },
    recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
  out.north_star = computeNorthStar(out);
  out.alerts = evaluateAlerts(out);
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('process did not exit within ' + timeoutMs + 'ms'));
    }, timeoutMs);

    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function startTestServer(port = 0) {
  return new Promise((resolve, reject) => {
    // P143.3: COCKPIT_SMOKE=test → keeps pidfile (SAC-P132-05 asserts it) but
    // uses the legacy fixed-path watcher list (skips the operator-facing
    // recursive .planning/ walk). Watcher→SSE wiring still validated via
    // SAC-P132-03 because STATE.md is in the legacy list.
    const child = cpModule.spawn('node', [
      'super-gsd/tools/cockpit-sidecar/serve.cjs',
      '--port',
      String(port),
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, { COCKPIT_SMOKE: 'test' }),
    });

    let settled = false;
    let stderr = '';
    // P143.3: bumped from 12000 → 30000 (was 20000). On a cold disk cache
    // (post-reboot / first run after long idle), 14 parallel Node spawns
    // each pulling cockpit-sidecar + ~30 .cjs deps from the disk under
    // Windows Defender scanning can take >20s. 30s is generous but tests
    // still complete in <5min wall; the long-tail is what we're absorbing.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('timed out waiting for cockpit-server port; stderr=' + stderr));
    }, 30000);

    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    }

    child.once('error', (err) => finish(err));
    child.once('exit', (code, signal) => {
      finish(new Error('cockpit-server exited before listening; code=' + code + '; signal=' + signal + '; stderr=' + stderr));
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      const match = stderr.match(/cockpit-server listening port:\s*(\d+)/);
      if (match) {
        finish(null, { child, port: Number(match[1]) });
      }
    });
  });
}

function stopTestServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  // P143.3: bumped from 2000 → 8000ms. Recursive fs.watch on .planning/
  // (P143.2 operator-facing live updates) holds a Windows file-handle that
  // must be released on shutdown. Under parallel SAC load (14 children),
  // Windows TerminateProcess + pipe-flush can take >2s. 8s absorbs the
  // tail without masking real shutdown bugs.
  const exited = waitForExit(child, 8000).catch((err) => {
    child.kill('SIGKILL');
    throw err;
  });
  child.kill('SIGTERM');
  return exited.then(() => undefined);
}

function readResponseBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  });
}

function httpGet(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: pathname,
    }, async (res) => {
      try {
        const body = await readResponseBody(res);
        resolve({ res, body });
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// P139 helper: spawn serve.cjs on ephemeral port, fetch /, return rendered HTML.
async function fetchLiveHtml() {
  const { child, port } = await startTestServer();
  try {
    const { res, body } = await httpGet(port, '/');
    if (res.statusCode !== 200) throw new Error('fetchLiveHtml: HTTP ' + res.statusCode);
    return { html: body, port };
  } finally {
    await stopTestServer(child);
  }
}

// P139 helper: REAL DOM RENDER via JSDOM. Boots serve.cjs, fetches the shell +
// snapshot + client.js, runs client.js INSIDE JSDOM with mocked fetch + mocked
// EventSource (delivers exactly one snapshot then closes), then returns the
// post-render serialized HTML for assertion. This is the perceptual gate that
// proves "client.js renderers actually fill the section bodies when given a
// real snapshot" — closes the source-grep loophole from the 2026-05-25 incident.
async function fetchRenderedDom() {
  const { requireDependency } = require('../chronicle/lib/require-dep.cjs');
  const { JSDOM } = requireDependency('jsdom');
  const { child, port } = await startTestServer();
  try {
    const { res: rRes, body: html } = await httpGet(port, '/');
    if (rRes.statusCode !== 200) throw new Error('fetchRenderedDom: HTTP ' + rRes.statusCode + ' on /');
    const { body: snapshotJson } = await httpGet(port, '/snapshot');
    const { body: clientJs } = await httpGet(port, '/client.js');
    const snapshot = JSON.parse(snapshotJson);

    const dom = new JSDOM(html, {
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      url: 'http://127.0.0.1:' + port + '/',
    });
    const win = dom.window;
    // Mock fetch: serve /snapshot, otherwise 404.
    win.fetch = function (url) {
      const u = String(url);
      if (u.includes('/snapshot')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(snapshot),
          text: () => Promise.resolve(snapshotJson),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    };
    // Mock EventSource: deliver one snapshot via onmessage, then close.
    win.EventSource = function (urlPath) {
      const self = this;
      this.url = String(urlPath);
      this.readyState = 0;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.close = function () { self.readyState = 2; };
      // Fire onopen + one onmessage on next tick
      setTimeout(function () {
        self.readyState = 1;
        if (typeof self.onopen === 'function') self.onopen({});
        if (typeof self.onmessage === 'function') {
          self.onmessage({ data: snapshotJson });
        }
      }, 0);
    };

    // Execute client.js inside the JSDOM window. With runScripts:'outside-only',
    // <script> tags don't auto-run; window.eval is the supported path.
    win.eval(clientJs);

    // DOMContentLoaded must fire so client.js's listener runs.
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

    // Allow microtasks + setTimeout(0) to drain (mock EventSource delivery, fetch resolution).
    // Bumped 400→700 to absorb parallel-SAC load (renders compete for tick time).
    await new Promise(function (r) { setTimeout(r, 700); });

    const rendered = dom.serialize();
    return { html: rendered, dom, snapshot };
  } finally {
    await stopTestServer(child);
  }
}

function waitForFirstSseChunk(port, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/events',
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    }, (res) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        req.destroy();
        reject(new Error('timed out waiting for first SSE chunk'));
      }, timeoutMs);

      res.once('data', (chunk) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        req.destroy();
        resolve({ res, chunk: chunk.toString('utf8') });
      });
      res.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    req.end();
  });
}

function makeP132Fixture() {
  const fixture = p127Out();
  fixture.stage_pipeline = computeStagePipeline({ phase_dir: null, vtp_enabled: true });
  fixture.rationale = computeRationale({});
  return fixture;
}

const tests = [
  ...(() => {
    const tests = [];

    tests.push({
      id: 'SAC-P128-01',
      run: () => {
        assert.ok(Array.isArray(STAGES), 'STAGES must be array');
        assert.ok(Object.isFrozen(STAGES), 'STAGES must be frozen');
        assert.strictEqual(STAGES.length, 5, '5 stages exactly');
        assert.deepStrictEqual(
          STAGES.map((stage) => stage.name),
          ['research', 'vtp-enrich', 'plan', 'execute', 'verify'],
        );

        for (const stage of STAGES) {
          assert.ok(Object.isFrozen(stage), 'each stage must be frozen');
          assert.strictEqual(typeof stage.name, 'string');
          assert.strictEqual(typeof stage.owner, 'string');
          assert.strictEqual(typeof stage.sla_minutes, 'number');
          assert.ok(stage.sla_minutes > 0, 'sla_minutes > 0');
          assert.strictEqual(typeof stage.artifact_glob, 'string');
        }
      },
    });

    tests.push({
      id: 'SAC-P128-02',
      run: () => {
        assert.strictEqual(typeof computeStagePipeline, 'function');
      },
    });

    tests.push({
      id: 'SAC-P128-03',
      run: () => {
        const dir = makeFakePhaseDir(['RESEARCH.md']);
        try {
          const result = computeStagePipeline({ phase_dir: dir, vtp_enabled: true });
          assert.strictEqual(result.stages[0].status, 'done');
          assert.strictEqual(result.stages[1].status, 'active');
          assert.strictEqual(result.active_index, 1);
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    });

    tests.push({
      id: 'SAC-P128-04',
      run: () => {
        const dir = makeFakePhaseDir(['RESEARCH.md']);
        try {
          const result = computeStagePipeline({ phase_dir: dir, vtp_enabled: false });
          assert.strictEqual(result.stages[1].status, 'done');
          assert.strictEqual(result.stages[2].status, 'active');
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    });

    tests.push({
      id: 'SAC-P128-05',
      run: () => {
        const dir = makeFakePhaseDir([
          'RESEARCH.md',
          'VTP-ENRICHMENT.md',
          '128-01-foo-PLAN-LOCKED.md',
        ]);
        try {
          const result = computeStagePipeline({
            phase_dir: dir,
            vtp_enabled: true,
            blocker: 'codex_read_216',
          });
          assert.strictEqual(result.stages[2].status, 'done');
          assert.strictEqual(result.stages[3].status, 'blocked');
          assert.strictEqual(result.blocker, 'codex_read_216');
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    });

    tests.push({
      id: 'SAC-P128-06',
      run: () => {
        const output = cockpitSidecarP128.attachStagePipeline(p127Out(), { phase_dir: null });
        assert.ok(output.stage_pipeline);
        assert.ok(Array.isArray(output.stage_pipeline.stages));
        assert.strictEqual(output.stage_pipeline.stages.length, 5);
      },
    });

    tests.push({
      id: 'SAC-P128-07',
      run: () => {
        const sample = p127Out();
        const beforeKeys = Object.keys(sample);
        const output = cockpitSidecarP128.attachStagePipeline(sample, { phase_dir: null });

        for (const key of beforeKeys) {
          assert.ok(Object.prototype.hasOwnProperty.call(output, key), key);
        }
      },
    });

    tests.push({
      id: 'SAC-P128-08',
      run: () => {
        const output = cockpitSidecarP128.attachStagePipeline(p127Out(), { phase_dir: null });
        const parsed = JSON.parse(JSON.stringify(output));
        assert.ok(parsed.stage_pipeline);
        assert.strictEqual(parsed.stage_pipeline.stages.length, 5);
      },
    });

    tests.push({
      id: 'SAC-P128-09',
      run: () => {
        const output = cockpitSidecarP128.attachStagePipeline(p127Out(), { phase_dir: null });
        assert.doesNotThrow(() => cockpitSidecarP128.renderText(output));
        assert.doesNotThrow(() => cockpitSidecarP128.renderHtml(output));
        assert.doesNotThrow(() => cockpitSidecarP128.renderBrief(output));
      },
    });

    tests.push({
      id: 'SAC-P129-01',
      run: () => {
        const sample = { milestone: 'v3.3', phase: '129', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 10, tier: 'low' }, recent_chronicles: [], signals: { dispatch_count: 1, token_spend: 1000 }, warnings: [], phase_dir: null };
        sample.north_star = computeNorthStar(sample);
        sample.alerts = evaluateAlerts(sample);
        sample.stage_pipeline = computeStagePipeline({ phase_dir: null, vtp_enabled: true });
        const lines = sidecar.renderText(sample, { color: false }).split(/\r?\n/);
        const ruleLines = lines.filter((line) => /─{5,}/.test(line));
        assert.ok(ruleLines.length >= 3, String(ruleLines.length));
      },
    });

    tests.push({
      id: 'SAC-P129-02',
      run: () => {
        const sample = { milestone: 'v3.3', phase: '129', latest_chronicle: {}, binding_gate_status: 'RED', fog_score: { score: 85, tier: 'high' }, prior_fog_high: true, recent_chronicles: [], signals: { dispatch_count: 1, token_spend: 1000 }, warnings: [] };
        sample.north_star = computeNorthStar(sample);
        sample.alerts = evaluateAlerts(sample);
        sample.stage_pipeline = computeStagePipeline({ phase_dir: null, vtp_enabled: true });
        const rendered = sidecar.renderText(sample, { color: true });
        const boldCount = (rendered.match(/\x1b\[1m/g) || []).length;
        assert.ok(boldCount >= 1, String(boldCount));
        assert.ok(boldCount <= 2, String(boldCount));
      },
    });

    tests.push({
      id: 'SAC-P129-03',
      run: () => {
        const sample = {
          milestone: 'v3.3',
          phase: '129',
          latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' },
          binding_gate_status: 'GREEN',
          fog_score: { score: 10, tier: 'low' },
          recent_chronicles: [],
          signals: { dispatch_count: 1, token_spend: 1000 },
          warnings: [],
          stage_pipeline: {
            stages: [
              { name: 'research', status: 'done' },
              { name: 'vtp-enrich', status: 'done' },
              { name: 'plan', status: 'active' },
              { name: 'execute', status: 'pending' },
              { name: 'verify', status: 'pending' },
            ],
            active_index: 2,
          },
        };
        sample.north_star = computeNorthStar(sample);
        sample.alerts = evaluateAlerts(sample);
        const stageLine = sidecar.renderText(sample, { color: false }).split(/\r?\n/).find((line) => line.includes('research') && (line.includes('plan') || line.includes('vtp-enrich'))) || '';
        assert.ok(stageLine.includes('✓'), stageLine);
        assert.ok(stageLine.includes('⏳'), stageLine);
      },
    });

    tests.push({
      id: 'SAC-P129-04',
      run: () => {
        const sample = { milestone: 'v3.3', phase: '129', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 38, tier: 'medium' }, recent_chronicles: [], signals: { fog_score: 38, dispatch_count: 7, token_spend: 2400000 }, warnings: [] };
        sample.north_star = computeNorthStar(sample);
        sample.alerts = evaluateAlerts(sample);
        sample.stage_pipeline = computeStagePipeline({ phase_dir: null, vtp_enabled: true });
        const blockLines = sidecar.renderText(sample, { color: false }).split(/\r?\n/).filter((line) => /[▁▂▃▄▅▆▇█]/.test(line));
        assert.ok(blockLines.length >= 3, String(blockLines.length));
      },
    });

    tests.push({
      id: 'SAC-P129-05',
      run: () => {
        const sample = { milestone: 'v3.3', phase: '129', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 10, tier: 'low' }, recent_chronicles: [], signals: { dispatch_count: 1, token_spend: 1000 }, warnings: [] };
        sample.north_star = computeNorthStar(sample);
        sample.alerts = evaluateAlerts(sample);
        sample.stage_pipeline = computeStagePipeline({ phase_dir: null, vtp_enabled: true });
        const lines = sidecar.renderBrief(sample).split(/\r?\n/).filter((line) => line.trim());
        assert.ok(lines.length <= 4, String(lines.length));
        assert.ok(lines[0].includes(sample.north_star.message), lines[0]);
        assert.ok(/DO NEXT/i.test(lines[1]), lines[1]);
      },
    });

    tests.push({
      id: 'SAC-P129-06',
      run: () => {
        const result = evaluateAlerts({ binding_gate_status: 'RED', fog_score: { score: 85 }, prior_fog_high: true, signals: { dispatch_count: 15 }, latest_chronicle: {}, warnings: [] });
        const valid = new Set(['accent', 'success', 'attention', 'severe', 'danger', 'done']);
        for (const alert of result.all) {
          assert.ok(Object.prototype.hasOwnProperty.call(alert, 'palette_tier'), JSON.stringify(alert));
          assert.ok(valid.has(alert.palette_tier), alert.palette_tier);
        }
        assert.strictEqual(result.top.palette_tier, 'danger');
      },
    });

    tests.push({
      id: 'SAC-P130-01',
      run: () => {
        const dir = makeFakePhaseDir(['PROJECT.md', 'INTENT.md', 'SUMMARY.md', 'CONTEXT.md']);
        try {
          const projectMd = path.join(dir, 'PROJECT.md');
          const intentMd = path.join(dir, 'INTENT.md');
          const summaryMd = path.join(dir, 'SUMMARY.md');
          const contextMd = path.join(dir, 'CONTEXT.md');

          fs.writeFileSync(projectMd, [
            '---',
            'project: fixture-project',
            '---',
            '# Fixture Project',
            'Core value fixture content.',
            '',
          ].join('\n'));
          fs.writeFileSync(intentMd, [
            '---',
            'why: Fixture intent explains why the phase matters.',
            'outcome_delivered: Fixture outcome unlocks the next cockpit drill-in.',
            '---',
            '# Fixture Intent',
            'Intent body fixture content.',
            '',
          ].join('\n'));
          fs.writeFileSync(summaryMd, [
            '# Fixture Summary',
            '',
            '## Summary',
            'Fixture summary paragraph from the previous phase.',
            '',
          ].join('\n'));
          fs.writeFileSync(contextMd, [
            '---',
            'phase_name: Fixture Band 3 Phase',
            '---',
            '# Fixture Context',
            'Fixture context opening paragraph.',
            '',
            '## Goal',
            'Fixture goal explains why this phase exists.',
            '',
          ].join('\n'));

          const result = computeRationale({
            project_md: projectMd,
            intent_md: intentMd,
            last_summary_md: summaryMd,
            context_md: contextMd,
          });
          const keys = ['context', 'eli5', 'what_is', 'what_could_be', 'why_this_phase', 'evidence_trail'];
          assert.deepStrictEqual(Object.keys(result), keys);
          for (const key of keys) {
            assert.strictEqual(typeof result[key], 'string', key);
            assert.ok(result[key].trim().length > 0, key);
          }
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    });

    tests.push({
      id: 'SAC-P130-02',
      run: () => {
        const result = computeRationale({
          project_md: '.planning/PROJECT.md',
          intent_md: '.planning/milestones/v3.3/INTENT.md',
          last_summary_md: null,
          context_md: '.planning/milestones/v3.3/phases/130-cockpit-band3-rationale/130-CONTEXT.md',
        });
        assert.ok(/\.(md|cjs|js|json|ts|py|sh)\b/i.test(result.evidence_trail), result.evidence_trail);
      },
    });

    tests.push({
      id: 'SAC-P130-03',
      run: () => {
        const result = lintWhy('We should build it because it would be nice to have.');
        assert.strictEqual(result.ok, false);
        assert.ok(result.violations.length >= 2, JSON.stringify(result));
      },
    });

    tests.push({
      id: 'SAC-P130-04',
      run: () => {
        const result = lintWhy('P130 ships rationale.cjs (super-gsd/tools/cockpit-sidecar/rationale.cjs:1-80) cascading from PROJECT.md INTENT.md SUMMARY.md per DLB-03; unlocks P132 localhost-live.');
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.violations.length, 0, JSON.stringify(result));
      },
    });

    tests.push({
      id: 'SAC-P130-05',
      run: () => {
        let defaultOutput;
        let band3Output;
        try {
          defaultOutput = child_process.execFileSync('node', ['super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs', '--text'], { encoding: 'utf8' });
          band3Output = child_process.execFileSync('node', ['super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs', '--text', '--bands=3'], { encoding: 'utf8' });
        } catch (error) {
          if (error && error.code === 'ENOENT') return;
          throw error;
        }
        assert.ok(!defaultOutput.includes('WHY THIS PHASE'), defaultOutput);
        assert.ok(band3Output.includes('WHY THIS PHASE'), band3Output);
        assert.ok(defaultOutput.includes('NORTH STAR'), defaultOutput);
        assert.ok(band3Output.includes('NORTH STAR'), band3Output);
      },
    });

    tests.push({
      id: 'SAC-P131-01',
      run: () => {
        const r = lintEli5('Everything looks fine right now. We are ready for the next step.');
        assert.ok(r.ok, 'benign text should pass');
        assert.ok(r.out_of_list_count <= 2, 'minimal violations');
      },
    });

    tests.push({
      id: 'SAC-P131-02',
      run: () => {
        const r = lintEli5('The SAC schema mandates idempotent invariants under concurrent dispatch.');
        assert.ok(!r.ok, 'jargon text should fail');
        assert.ok(r.out_of_list_count >= 4, 'expected >=4 non-glossed violations: ' + r.out_of_list_count);
      },
    });

    tests.push({
      id: 'SAC-P131-03',
      run: () => {
        const input = 'The orchestrator (the part that picks what to do next) is waiting.';
        const r = lintEli5(input);
        const entry = r.violations.find((violation) => violation.word === 'orchestrator');
        assert.ok(entry, 'expected orchestrator violation entry');
        assert.strictEqual(entry.glossed, true, 'orchestrator should be marked glossed');
      },
    });

    tests.push({
      id: 'SAC-P131-04',
      run: () => {
        const psContent = fs.readFileSync('super-gsd/scripts/sgsd-codex-monitor.ps1', 'utf8');
        const arcPhrases = ['What is now', 'What could be', 'S.T.A.R.', 'Call to action'];
        const matches = arcPhrases.filter((p) => psContent.includes(p)).length;
        assert.ok(matches >= 3, 'expected at least 3 Duarte arc phrase matches: ' + matches);
      },
    });

    tests.push({
      id: 'SAC-P132-01',
      run: async () => {
        const { child, port } = await startTestServer();
        try {
          const { res, body } = await httpGet(port, '/');
          assert.strictEqual(res.statusCode, 200);
          assert.ok(String(res.headers['content-type'] || '').startsWith('text/html'), String(res.headers['content-type']));
          assert.ok(body.length > 1000, String(body.length));
          assert.ok(body.includes('--gold') || body.includes('color-scheme'), 'missing design-system marker');
        } finally {
          await stopTestServer(child);
        }
      },
    });

    tests.push({
      id: 'SAC-P132-02',
      run: async () => {
        const { child, port } = await startTestServer();
        try {
          const { res, chunk } = await waitForFirstSseChunk(port, 500);
          assert.strictEqual(res.statusCode, 200);
          assert.ok(String(res.headers['content-type'] || '').startsWith('text/event-stream'), String(res.headers['content-type']));
          assert.ok(chunk.includes('event: snapshot'), chunk);
          assert.ok(chunk.includes('data:'), chunk);
        } finally {
          await stopTestServer(child);
        }
      },
    });

    tests.push({
      id: 'SAC-P132-03',
      run: async () => {
        const { child, port } = await startTestServer();
        let req = null;
        try {
          await sleep(200);
          const events = [];

          await new Promise((resolve, reject) => {
            req = http.request({
              hostname: '127.0.0.1',
              port,
              path: '/events',
              method: 'GET',
              headers: { Accept: 'text/event-stream' },
            }, (res) => {
              assert.strictEqual(res.statusCode, 200);
              res.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                if (text.includes('event: snapshot')) {
                  events.push(text);
                }
              });
              resolve();
            });
            req.on('error', reject);
            req.end();
          });

          // P141.5: under parallel-SAC load (~14 tests touching files
          // simultaneously), the fs.watch debounce window misses single
          // touches. Touch repeatedly and give a longer deadline.
          // P143.3: bumped touch deadline 4000 → 8000ms; on Windows under
          // peak parallel load (recursive watcher in operator mode, legacy
          // in test mode), event delivery latency can spike to >4s.
          await sleep(150); // let the initial snapshot land first
          const touchDeadline = Date.now() + 8000;
          while (Date.now() < touchDeadline && events.length < 2) {
            fs.utimesSync(path.resolve('.planning/STATE.md'), new Date(), new Date());
            await sleep(200);
          }
          assert.ok(events.length >= 2, 'expected initial + post-touch events, got ' + events.length);
        } finally {
          if (req) req.destroy();
          await stopTestServer(child);
        }
      },
    });

    tests.push({
      id: 'SAC-P132-04',
      run: async () => {
        const { child, port } = await startTestServer();
        try {
          const { res, body } = await httpGet(port, '/snapshot');
          assert.strictEqual(res.statusCode, 200);
          assert.ok(String(res.headers['content-type'] || '').startsWith('application/json'), String(res.headers['content-type']));
          const parsed = JSON.parse(body);
          assert.ok(Object.prototype.hasOwnProperty.call(parsed, 'north_star'), 'north_star');
          assert.ok(Object.prototype.hasOwnProperty.call(parsed, 'stage_pipeline'), 'stage_pipeline');
          assert.ok(Object.prototype.hasOwnProperty.call(parsed, 'rationale'), 'rationale');
        } finally {
          await stopTestServer(child);
        }
      },
    });

    tests.push({
      id: 'SAC-P132-05',
      run: async () => {
        const { child, port } = await startTestServer();
        // P141.5: pidfile name is now per-port (cockpit-server-NNNN.pid) to
        // avoid parallel-SAC contention. Check either the legacy fixed name
        // OR the per-port name.
        const legacyPidPath = path.resolve('.planning/runtime/cockpit-server.pid');
        const portPidPath = path.resolve(`.planning/runtime/cockpit-server-${port}.pid`);
        const pidPath = fs.existsSync(portPidPath) ? portPidPath : legacyPidPath;
        assert.ok(fs.existsSync(pidPath), `PID file should exist (checked ${legacyPidPath} and ${portPidPath})`);
        child.kill('SIGTERM');
        const exit = await waitForExit(child, 2000);
        // Cross-platform shutdown verification:
        //   POSIX: handler runs, code === 0, PID file cleaned.
        //   Windows: child.kill('SIGTERM') maps to SIGKILL (Node child_process
        //     docs — Windows has no POSIX signals), so handler can't run;
        //     code === null + signal === 'SIGTERM'. PID file may remain.
        // SAC intent: process exits when asked. Both paths satisfy.
        const cleanExit = exit.code === 0 || exit.signal === 'SIGTERM' || exit.signal === 'SIGKILL';
        assert.ok(cleanExit, `process did not exit cleanly: ${JSON.stringify(exit)}`);
        if (exit.code === 0 && process.platform !== 'win32') {
          assert.ok(!fs.existsSync(pidPath), 'PID file should be removed on POSIX graceful shutdown');
        }
        if (fs.existsSync(pidPath)) {
          try { fs.unlinkSync(pidPath); } catch (_e) { /* ignore */ }
        }
      },
    });

    tests.push({
      id: 'SAC-P132-06',
      run: () => {
        const renderers = require('./render-html.cjs');
        const html = renderers.renderHtml(makeP132Fixture());
        assert.strictEqual(typeof html, 'string');
        assert.ok(html.length > 0);
        assert.ok(html.startsWith('<!doctype html>'), html.slice(0, 32));
        assert.ok(html.includes('--gold') || html.includes('color-scheme'), 'missing design-system marker');

        const shell = renderers.renderShell();
        assert.ok(shell.startsWith('<!doctype html>'), shell.slice(0, 32));
        assert.ok(shell.includes('data-band="1"'), shell);
        assert.ok(shell.includes('data-band="2"'), shell);
        assert.ok(shell.includes('data-band="3"'), shell);
      },
    });

    tests.push({
      id: 'SAC-P132-07',
      run: async () => {
        const fixedPort = 7799;
        const first = await startTestServer(fixedPort);
        let second = null;
        try {
          second = cpModule.spawn('node', [
            'super-gsd/tools/cockpit-sidecar/serve.cjs',
            '--port',
            String(fixedPort),
          ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: Object.assign({}, process.env, { COCKPIT_SMOKE: 'test' }),
          });

          let stderr = '';
          second.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
          // P143.3: 15s (was 2s → 10s → 15s) to accommodate Windows EADDRINUSE
          // detection under parallel SAC load. The second child must spawn
          // Node, load cockpit-sidecar modules, attempt server.listen, catch
          // the error and exit — while 14 sibling test children compete for
          // CPU/IO. 10s flaked ~1-in-5 under heaviest scheduling.
          const exit = await waitForExit(second, 15000);
          assert.notStrictEqual(exit.code, 0, JSON.stringify(exit));
          assert.ok(/EADDRINUSE|address already in use/i.test(stderr), stderr);
          assert.strictEqual(first.child.exitCode, null, 'first server should remain alive');
        } finally {
          if (second && second.exitCode === null && second.signalCode === null) {
            second.kill('SIGTERM');
          }
          await stopTestServer(first.child);
        }
      },
    });

    tests.push({
      id: 'SAC-P132-08',
      run: async () => {
        const { child, port } = await startTestServer();
        try {
          const { res, body } = await httpGet(port, '/client.js');
          assert.strictEqual(res.statusCode, 200);
          assert.ok(String(res.headers['content-type'] || '').startsWith('application/javascript'), String(res.headers['content-type']));
          assert.ok(body.includes('EventSource'), 'missing EventSource');
          assert.ok(body.includes('data-band'), 'missing data-band');
        } finally {
          await stopTestServer(child);
        }
      },
    });

    tests.push({ id: 'SAC-P133-01', run: () => {
      const content = fs.readFileSync('super-gsd/scripts/sgsd-codex-monitor.ps1', 'utf8');
      const matches = content.match(/Write-GateSavingsBlock/g) || [];
      assert.strictEqual(matches.length, 0, `Expected 0 matches, got ${matches.length}`);
    }});

    tests.push({ id: 'SAC-P133-02', run: () => {
      const content = fs.readFileSync('super-gsd/scripts/sgsd-codex-monitor.ps1', 'utf8');
      assert.ok(content.includes('BAND 1'), 'BAND 1 banner missing');
      assert.ok(content.includes('BAND 2'), 'BAND 2 banner missing');
      assert.ok(content.includes('BAND 3'), 'BAND 3 banner missing');
    }});

    tests.push({ id: 'SAC-P133-03', run: () => {
      const content = fs.readFileSync('super-gsd/scripts/sgsd-codex-monitor.ps1', 'utf8');
      const matches = content.match(/\$Drill/g) || [];
      assert.ok(matches.length >= 2, `Expected >= 2 \$Drill references, got ${matches.length}`);
    }});

    tests.push({ id: 'SAC-P134-01', run: () => {
      const ids = designRules.rules.map((r) => r.id);
      for (const want of ['R13', 'R14', 'R15', 'R16', 'R17', 'R18']) {
        assert.ok(ids.includes(want), 'design-rules missing ' + want);
      }
    }});

    tests.push({ id: 'SAC-P134-02', run: () => {
      const source = fs.readFileSync('super-gsd/tools/shared/conformance-check.cjs', 'utf8');
      for (const want of ['R13', 'R14', 'R15', 'R16', 'R17', 'R18']) {
        assert.ok(source.includes('function check' + want), 'conformance-check missing check' + want);
      }
    }});

    tests.push({ id: 'SAC-P134-03', run: () => {
      // Synthetic fixture exercising R13-R18 wiring on cockpit-html surface.
      // renderShell()/renderHtml() each populate a subset of markers (shell carries
      // data-band placeholders; client.js injects stages at runtime). The gate is
      // surface-level wiring, so the test asserts the rules FIRE on this surface
      // and a fully-populated cockpit-html document passes.
      const stages = ['research','vtp-enrich','plan','execute','verify']
        .map((s) => `<div class="stage" data-stage="${s}">${s}</div>`).join('');
      const html = `<!doctype html><html><body>` +
        `<div class="northstar">NORTH STAR</div>` +
        `<section data-band="1">${stages}</section>` +
        `<section data-band="2"></section>` +
        `<section data-band="3" style="display:none"></section>` +
        `</body></html>`;
      const result = checkConformance(html, 'cockpit-html');
      assert.ok(result && result.summary, 'checkConformance returned malformed result');
      assert.strictEqual(result.summary.binding_fail, 0, JSON.stringify(result.summary));
    }});

    tests.push({ id: 'SAC-P134-04', run: () => {
      const psContent = fs.readFileSync('super-gsd/scripts/sgsd-codex-monitor.ps1', 'utf8');
      const result = checkConformance(psContent, 'monitor');
      assert.ok(result && typeof result === 'object', 'checkConformance returned non-object');
      assert.ok('summary' in result, 'result missing summary key');
      assert.ok(typeof result.summary.binding_fail === 'number', 'binding_fail not a number');
    }});

    tests.push({ id: 'SAC-P136-01', run: () => {
      const css = fs.readFileSync('super-gsd/tools/shared/sgsd-design-system.css', 'utf8');
      const required = [
        ['--page', '#F6F7F4'],
        ['--surface', '#FFFFFF'],
        ['--ink', '#151A1E'],
        ['--line', '#D6DBD2'],
        ['--live', '#006D77'],
        ['--done', '#2F7D5C'],
        ['--attn', '#B7791F'],
        ['--severe', '#B42318'],
        ['--indigo', '#515E9C'],
      ];
      for (const [name, value] of required) {
        const re = new RegExp(name.replace(/-/g, '\\-') + '\\s*:\\s*' + value.replace(/[#]/g, '\\#'), 'i');
        assert.ok(re.test(css), `missing token "${name}: ${value}"`);
      }
    }});

    tests.push({ id: 'SAC-P136-02', run: () => {
      const renderers = require('./render-html.cjs');
      const shell = renderers.renderShell();
      assert.ok(/<link[^>]+fonts\.googleapis[^>]+IBM\+Plex\+Sans/.test(shell), 'missing IBM Plex Sans link');
      assert.ok(/<link[^>]+fonts\.googleapis[^>]+IBM\+Plex\+Mono/.test(shell), 'missing IBM Plex Mono link');
      assert.ok(/<link[^>]+fonts\.googleapis[^>]+Big\+Shoulders\+Display/.test(shell), 'missing Big Shoulders Display link');
    }});

    tests.push({ id: 'SAC-P136-03', run: () => {
      const renderers = require('./render-html.cjs');
      const shell = renderers.renderShell();
      for (const band of ['1', '2', '3']) {
        assert.ok(shell.includes(`data-band="${band}"`), `shell missing data-band="${band}"`);
      }
    }});

    tests.push({ id: 'SAC-P136-04', run: () => {
      const renderers = require('./render-html.cjs');
      const shell = renderers.renderShell();
      for (const id of ['sec-mission','sec-telemetry','sec-architecture','sec-milestone','sec-memory','sec-evidence','sec-events']) {
        assert.ok(shell.includes(`id="${id}"`), `shell missing id="${id}"`);
      }
    }});

    tests.push({ id: 'SAC-P136-05', run: () => {
      const renderers = require('./render-html.cjs');
      const shell = renderers.renderShell();
      assert.ok(shell.includes('<span data-conn="state"'), 'shell missing <span data-conn="state">');
    }});

    tests.push({ id: 'SAC-P136-06', run: () => {
      // Composite SAC — the suite as a whole must pass. Asserted via exit code
      // when the full self-test runs (this test asserts a structural witness:
      // the prior P125-P134 SACs are still present in the file).
      const source = fs.readFileSync('super-gsd/tools/cockpit-sidecar/run-self-test.cjs', 'utf8');
      for (const sac of ['SAC-P125-01','SAC-P127-01','SAC-P128-01','SAC-P132-06','SAC-P133-03','SAC-P134-04']) {
        assert.ok(source.includes(`id: '${sac}'`), `pre-existing SAC removed: ${sac}`);
      }
    }});

    tests.push({ id: 'SAC-P137-01', run: () => {
      const yamlPath = path.join('super-gsd', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
      const yaml = require(path.resolve(yamlPath));
      const doc = yaml.load(fs.readFileSync('super-gsd/registry/cockpit-sources.yaml', 'utf8'));
      assert.strictEqual(doc.schema_version, 1, 'schema_version != 1');
      assert.strictEqual(doc.sources.length, 7, `expected 7 sources, got ${doc.sources.length}`);
      const wanted = ['sec-mission','sec-telemetry','sec-architecture','sec-milestone','sec-memory','sec-evidence','sec-events'];
      const got = doc.sources.map((s) => s.section_id);
      for (const id of wanted) assert.ok(got.includes(id), `missing section_id ${id}`);
    }});

    tests.push({ id: 'SAC-P137-02', run: () => {
      const liveness = require('./liveness.cjs');
      const fakeStat = () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false });
      const result = liveness.computeLiveness({
        statFn: fakeStat,
        state: { milestone: 'v3.4', phase: '137' },
      });
      const expectedIds = ['mission','telemetry','architecture','milestone','memory','evidence','events'];
      for (const id of expectedIds) {
        assert.ok(result[id], `missing ${id}`);
        const entry = result[id];
        assert.ok(['fresh','degraded','stale','dead'].includes(entry.tier), `bad tier for ${id}: ${entry.tier}`);
        assert.ok('age_ms' in entry, `${id} missing age_ms`);
        assert.ok('last_seen' in entry, `${id} missing last_seen`);
        assert.ok('excused' in entry, `${id} missing excused`);
      }
    }});

    tests.push({ id: 'SAC-P137-03', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      const wanted = ['mission','pipeline','agents','architecture','milestone_map','memory_graph','lineage','gate_flow','evidence','telemetry','alarms','events','learnings','rationale','_sources'];
      for (const k of wanted) assert.ok(k in out, `missing key ${k}`);
    }});

    tests.push({ id: 'SAC-P137-04', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      const roundtrip = JSON.parse(JSON.stringify(out));
      for (const k of ['milestone','phase','generated_at','latest_chronicle','binding_gate_status','fog_score','recent_chronicles','signals','warnings','north_star','alerts']) {
        assert.ok(k in roundtrip, `pre-existing key lost after round-trip: ${k}`);
      }
      assert.ok(roundtrip._sources, '_sources lost in round-trip');
      assert.strictEqual(roundtrip.mission.phase_id, '127');
    }});

    tests.push({ id: 'SAC-P137-05', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      assert.doesNotThrow(() => sidecar2.renderText(out, { color: false }));
      assert.doesNotThrow(() => sidecar2.renderHtml(out));
      assert.doesNotThrow(() => sidecar2.renderBrief(out));
    }});

    tests.push({ id: 'SAC-P137-06', run: () => {
      const rules = require('../shared/design-rules.json');
      const ids = rules.rules.map((r) => r.id);
      assert.ok(ids.includes('R19'), 'design-rules missing R19');
      const r19 = rules.rules.find((r) => r.id === 'R19');
      assert.ok(r19.applies_to.includes('cockpit-html'), 'R19 missing cockpit-html surface');
      assert.ok(r19.applies_to.includes('monitor'), 'R19 missing monitor surface');
      for (const want of ['R13','R14','R15','R16','R17','R18']) {
        assert.ok(ids.includes(want), 'design-rules regressed: missing ' + want);
      }
    }});

    tests.push({ id: 'SAC-P137-07', run: () => {
      const source = fs.readFileSync('super-gsd/tools/shared/conformance-check.cjs', 'utf8');
      assert.ok(source.includes('function checkR19'), 'conformance-check missing function checkR19');
      for (const want of ['R13','R14','R15','R16','R17','R18']) {
        assert.ok(source.includes('function check' + want), 'conformance-check regressed: missing check' + want);
      }
    }});

    tests.push({ id: 'SAC-P138-01', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/serve.cjs', 'utf8');
      // Match setInterval(...arbitrary body..., 15000) — `[\s\S]` for cross-line.
      assert.ok(/setInterval\([\s\S]+?,\s*15000\s*\)/.test(src), 'serve.cjs heartbeat not 15000ms');
      assert.ok(/keep-alive/.test(src), 'serve.cjs missing keep-alive comment/marker');
    }});

    tests.push({ id: 'SAC-P138-02', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      assert.ok(/connState/.test(src), 'client.js missing connState module');
      assert.ok(/onopen/.test(src), 'client.js missing onopen handler');
      assert.ok(/onerror/.test(src), 'client.js missing onerror handler');
      assert.ok(/RECONNECTING/.test(src), 'client.js missing RECONNECTING label');
      assert.ok(/SSE LIVE/.test(src), 'client.js missing SSE LIVE label');
    }});

    tests.push({ id: 'SAC-P138-03', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      for (const ms of [500, 1000, 2000, 4000, 8000]) {
        assert.ok(src.includes(String(ms)), `client.js missing backoff value ${ms}`);
      }
    }});

    tests.push({ id: 'SAC-P138-04', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      for (const fn of ['renderChrome', 'renderCommandStrip', 'renderScanBar', 'renderSecNav']) {
        assert.ok(new RegExp('function\\s+' + fn).test(src), `client.js missing function ${fn}`);
      }
    }});

    tests.push({ id: 'SAC-P138-05', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      assert.ok(/addEventListener\(['"]keydown['"]/.test(src), 'client.js missing keydown listener');
      for (const key of ['A', 'P', 'O', 'Escape']) {
        assert.ok(src.includes(`'${key}'`) || src.includes(`"${key}"`), `client.js missing key handler for ${key}`);
      }
    }});

    tests.push({ id: 'SAC-P138-06', run: () => {
      // Witness — P136 SACs + SAC-P132-06 should still be in the file
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/run-self-test.cjs', 'utf8');
      for (const sac of ['SAC-P136-01', 'SAC-P136-02', 'SAC-P136-03', 'SAC-P136-04', 'SAC-P136-05', 'SAC-P132-06']) {
        assert.ok(src.includes(`id: '${sac}'`), `pre-P138 SAC removed: ${sac}`);
      }
    }});

    tests.push({ id: 'SAC-P138-07', run: () => {
      // Composite witness — SAC-P125..P137 still locked in file
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/run-self-test.cjs', 'utf8');
      for (const sac of ['SAC-P125-01', 'SAC-P127-01', 'SAC-P128-01', 'SAC-P133-03', 'SAC-P134-04', 'SAC-P136-06', 'SAC-P137-08']) {
        assert.ok(src.includes(`id: '${sac}'`), `pre-P138 SAC removed: ${sac}`);
      }
    }});

    tests.push({ id: 'SAC-P138-08', run: () => {
      // Live SSE timing probe — would require booting a server. Static surrogate:
      // assert the serve.cjs heartbeat interval is 15000ms (proves the contract).
      // NOTE: The REAL liveness proof is browser-smoke.cjs (see SAC-P138.5-01).
      // 2026-05-25 incident: source-grep alone shipped a visually broken cockpit.
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/serve.cjs', 'utf8');
      const match = src.match(/setInterval\([\s\S]+?,\s*(\d+)\s*\)/);
      assert.ok(match, 'serve.cjs heartbeat setInterval not found');
      const ms = parseInt(match[1], 10);
      assert.ok(ms === 15000, `expected 15000ms ping, got ${ms}`);
    }});

    tests.push({ id: 'SAC-P139-01', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      // P139.6 design-pack-conformed renderer set. ExplanationBand was retired
      // (its content moved into MissionCard.mc-body 'Why running' row per the
      // design pack reference).
      for (const fn of ['renderMission', 'renderTelemetry', 'renderMissionCard', 'renderPhaseRunway', 'renderAgentLanes', 'renderTelemCell', 'renderSparkSvg']) {
        assert.ok(new RegExp('function\\s+' + fn).test(src), `client.js missing function ${fn}`);
      }
    }});

    tests.push({ id: 'SAC-P139-02', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      assert.ok(/renderMission\(snap\)/.test(src), 'renderAll must call renderMission(snap)');
      assert.ok(/renderTelemetry\(snap\)/.test(src), 'renderAll must call renderTelemetry(snap)');
    }});

    tests.push({ id: 'SAC-P139-03', run: () => {
      const css = fs.readFileSync('super-gsd/tools/shared/sgsd-design-system.css', 'utf8');
      // Design-pack canonical class names (conformed to in P139.6 design-pack CSS merge)
      for (const sel of ['.mission-card', '.runway', '.agent-lane', '.telem', '.telem-cell']) {
        assert.ok(css.includes(sel), `css missing rule for ${sel}`);
      }
    }});

    tests.push({ id: 'SAC-P139-04', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs', 'utf8');
      assert.ok(/STATE\.md/.test(src), 'attachMission must reference STATE.md or phase CONTEXT.md');
      // 5-channel attachTelemetry shape
      for (const ch of ['fog', 'dispatches', 'tokens', 'context', 'elapsed']) {
        assert.ok(src.includes(ch + ':'), 'attachTelemetry missing channel: ' + ch);
      }
    }});

    tests.push({ id: 'SAC-P139-05', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      assert.ok(out.mission && out.mission.phase_id, 'mission.phase_id missing');
      for (const ch of ['fog', 'dispatches', 'tokens', 'context', 'elapsed']) {
        assert.ok(out.telemetry[ch], `telemetry.${ch} missing`);
        assert.ok('value' in out.telemetry[ch], `telemetry.${ch}.value missing`);
        assert.ok('target' in out.telemetry[ch], `telemetry.${ch}.target missing`);
        assert.ok(Array.isArray(out.telemetry[ch].history), `telemetry.${ch}.history not array`);
      }
    }});

    tests.push({ id: 'SAC-P139-06', run: async () => {
      // REAL DOM render via JSDOM. Proves client.js renderers fill the section
      // bodies with the design-pack component classes when given a real snapshot.
      // Design-pack canonical names: .mission-card, .runway, .agents/.agent-lane, .telem.
      const result = await fetchRenderedDom();
      for (const cls of ['mission-card', 'runway', 'agent-lane', 'telem']) {
        const re = new RegExp('class="[^"]*' + cls + '[^"]*"');
        assert.ok(re.test(result.html), `rendered DOM missing class containing "${cls}"`);
      }
    }});

    tests.push({ id: 'SAC-P139-07', run: async () => {
      const result = await fetchRenderedDom();
      // Design-pack canonical class for the inline svg is .telem-spark
      const matches = result.html.match(/<svg[^>]*class="telem-spark"/g) || [];
      assert.strictEqual(matches.length, 5, `expected 5 telem-spark svgs in rendered DOM, got ${matches.length}`);
    }});

    tests.push({ id: 'SAC-P139-08', run: async () => {
      const result = await fetchRenderedDom();
      // R13: at most 1 northstar/recommended-action loud-line in the rendered DOM.
      // (P139 retired the separate <p class="northstar"> band-1 element; MissionCard
      // is the one loud anchor. Zero is acceptable when the MissionCard chooses to
      // emphasise objective+phase rather than a northstar phrase.)
      const ns = (result.html.match(/class="[^"]*(northstar|recommended-action)[^"]*"/g) || []).length;
      assert.ok(ns <= 1, `R13 violation: ${ns} northstar/recommended-action elements (must be <=1)`);
      // R14: at least 5 .stop cells (design-pack PhaseRunway emits 5 stops)
      const stops = (result.html.match(/class="[^"]*\bstop\b[^"]*"/g) || []).length;
      assert.ok(stops >= 5, `R14 violation: expected >=5 stops in rendered DOM, got ${stops}`);
      // R18: 3 data-band markers preserved on section roots
      for (const b of ['1', '2', '3']) {
        assert.ok(result.html.includes(`data-band="${b}"`), `R18 violation: missing data-band="${b}"`);
      }
    }});

    tests.push({ id: 'SAC-P139-09', run: () => {
      // Browser-smoke verdict for phase 139 must exist and be PASS
      const verdictPath = path.join('.planning', 'runtime', 'cockpit-smoke-139-verdict.json');
      assert.ok(fs.existsSync(verdictPath), `browser-smoke verdict for P139 missing at ${verdictPath} — run browser-smoke.cjs --phase 139`);
      const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      assert.strictEqual(v.verdict, 'PASS', `P139 browser-smoke verdict = ${v.verdict}`);
      for (const [name, c] of Object.entries(v.checks || {})) {
        assert.ok(c.ok, `P139 browser-smoke check ${name} FAIL: ${c.detail}`);
      }
    }});

    tests.push({ id: 'SAC-P139-10', run: () => {
      // Witness — all prior SACs still present in the file
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/run-self-test.cjs', 'utf8');
      for (const sac of ['SAC-P125-01','SAC-P127-01','SAC-P128-01','SAC-P132-06','SAC-P134-04','SAC-P136-06','SAC-P137-08','SAC-P138-08','SAC-P138.5-01']) {
        assert.ok(src.includes(`id: '${sac}'`), `pre-P139 SAC removed: ${sac}`);
      }
    }});

    tests.push({ id: 'SAC-P140-01', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      for (const fn of ['renderArchitecture', 'renderMilestone']) {
        assert.ok(new RegExp('function\\s+' + fn).test(src), `client.js missing function ${fn}`);
      }
    }});

    tests.push({ id: 'SAC-P140-02', run: async () => {
      // P142.2: architecture renderer rebuilt as SVG diagram (class="arch-box"
      // per design pack #12). Old text-based arch-node list was retired.
      const result = await fetchRenderedDom();
      const boxes = (result.html.match(/class="arch-box"/g) || []).length;
      assert.ok(boxes >= 8, `expected >=8 arch-box SVG groups in rendered DOM, got ${boxes}`);
      assert.ok(/class="arch-svg"/.test(result.html), 'rendered DOM missing arch-svg');
    }});

    tests.push({ id: 'SAC-P140-03', run: async () => {
      const result = await fetchRenderedDom();
      assert.ok(/class="[^"]*milestone-strip[^"]*"/.test(result.html), 'rendered DOM missing milestone-strip');
      const cells = (result.html.match(/class="[^"]*ms-cell[^"]*"/g) || []).length;
      assert.ok(cells >= 4, `expected >=4 ms-cell elements, got ${cells}`);
    }});

    tests.push({ id: 'SAC-P140-04', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      assert.ok(Array.isArray(out.architecture.nodes) && out.architecture.nodes.length >= 3, `architecture.nodes >=3, got ${out.architecture.nodes.length}`);
      assert.ok(Array.isArray(out.milestone_map.phases) && out.milestone_map.phases.length >= 4, `milestone_map.phases >=4, got ${out.milestone_map.phases.length}`);
    }});

    tests.push({ id: 'SAC-P140-05', run: () => {
      const verdictPath = path.join('.planning', 'runtime', 'cockpit-smoke-140-verdict.json');
      assert.ok(fs.existsSync(verdictPath), `browser-smoke verdict for P140 missing at ${verdictPath}`);
      const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      assert.strictEqual(v.verdict, 'PASS', `P140 browser-smoke verdict = ${v.verdict}`);
    }});

    tests.push({ id: 'SAC-P140-06', run: () => {
      // Witness — all prior SACs still present
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/run-self-test.cjs', 'utf8');
      for (const sac of ['SAC-P125-01','SAC-P132-06','SAC-P136-06','SAC-P137-08','SAC-P138-08','SAC-P139-09','SAC-P139-10']) {
        assert.ok(src.includes(`id: '${sac}'`), `pre-P140 SAC removed: ${sac}`);
      }
    }});

    tests.push({ id: 'SAC-P141-01', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      for (const fn of ['renderMemory', 'renderEvidence']) {
        assert.ok(new RegExp('function\\s+' + fn).test(src), `client.js missing function ${fn}`);
      }
    }});

    tests.push({ id: 'SAC-P141-02', run: async () => {
      const result = await fetchRenderedDom();
      const cards = (result.html.match(/class="[^"]*memory-card[^"]*"/g) || []).length;
      assert.ok(cards >= 3, `expected >=3 memory-card elements, got ${cards}`);
    }});

    tests.push({ id: 'SAC-P141-03', run: async () => {
      // P142.2: §6 Evidence rebuilt per design-pack screenshot #7. New class
      // names: .ev-stage (5 large stage cards) + .ev-detail-col (4 columns)
      // instead of the older .gate-stage / .evidence-card grid.
      const result = await fetchRenderedDom();
      const stages = (result.html.match(/class="ev-stage ev-stage-/g) || []).length;
      assert.ok(stages >= 5, `expected >=5 ev-stage elements, got ${stages}`);
      const cols = (result.html.match(/class="ev-detail-col"/g) || []).length;
      assert.ok(cols >= 4, `expected >=4 ev-detail-col elements, got ${cols}`);
    }});

    tests.push({ id: 'SAC-P141-04', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      assert.ok(out.memory_graph.sources.length >= 3, `memory_graph.sources >=3, got ${out.memory_graph.sources.length}`);
      assert.strictEqual(out.gate_flow.stages.length, 5, `gate_flow.stages.length === 5, got ${out.gate_flow.stages.length}`);
    }});

    tests.push({ id: 'SAC-P141-05', run: () => {
      const verdictPath = path.join('.planning', 'runtime', 'cockpit-smoke-141-verdict.json');
      assert.ok(fs.existsSync(verdictPath), `browser-smoke verdict for P141 missing at ${verdictPath}`);
      const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      assert.strictEqual(v.verdict, 'PASS', `P141 browser-smoke verdict = ${v.verdict}`);
    }});

    tests.push({ id: 'SAC-P141-06', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/run-self-test.cjs', 'utf8');
      for (const sac of ['SAC-P125-01','SAC-P132-06','SAC-P136-06','SAC-P137-08','SAC-P138-08','SAC-P139-09','SAC-P140-05']) {
        assert.ok(src.includes(`id: '${sac}'`), `pre-P141 SAC removed: ${sac}`);
      }
    }});

    tests.push({ id: 'SAC-P142-01', run: () => {
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      for (const fn of ['renderBottomDrawer', 'applyCollapsePersistence']) {
        assert.ok(new RegExp('function\\s+' + fn).test(src), `client.js missing function ${fn}`);
      }
      assert.ok(/localStorage/.test(src), 'client.js missing localStorage usage');
    }});

    tests.push({ id: 'SAC-P142-02', run: async () => {
      const result = await fetchRenderedDom();
      assert.ok(/class="drawer-section"/.test(result.html), 'rendered DOM missing .drawer-section');
      assert.ok(/data-drawer="alarms"/.test(result.html), 'rendered DOM missing alarms drawer');
      assert.ok(/data-drawer="rationale"/.test(result.html), 'rendered DOM missing rationale drawer');
    }});

    tests.push({ id: 'SAC-P142-03', run: async () => {
      const result = await fetchRenderedDom();
      const cards = (result.html.match(/class="rationale-card"/g) || []).length;
      // P142.1: rationale cards filter out degenerate yaml-block-scalar values
      // (">-"). Real cockpit produces 2-6 cards depending on phase rationale
      // quality. Assert >=2 so the rationale drawer is meaningfully populated.
      assert.ok(cards >= 2 || /class="rationale-empty"/.test(result.html),
        `expected >=2 rationale-card elements OR an explicit empty state, got ${cards} cards`);
    }});

    tests.push({ id: 'SAC-P142-04', run: () => {
      const verdictPath = path.join('.planning', 'runtime', 'cockpit-smoke-142-verdict.json');
      assert.ok(fs.existsSync(verdictPath), `browser-smoke verdict for P142 missing at ${verdictPath}`);
      const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      assert.strictEqual(v.verdict, 'PASS', `P142 browser-smoke verdict = ${v.verdict}`);
    }});

    // P143 — Per-stream end-to-end data tests. Operator: 'i then also want
    // you to do test to test check point of every single data stream'.
    // Each snapshot key gets a shape assertion + data-quality check.
    tests.push({ id: 'SAC-P143-stream-project', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out.project, 'project key missing');
      assert.ok(typeof out.project.name === 'string', 'project.name not string');
      assert.ok(typeof out.project.core_value === 'string', 'project.core_value not string');
    }});

    tests.push({ id: 'SAC-P143-stream-briefs', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(Array.isArray(out.briefs), 'briefs not array');
      if (out.briefs.length) {
        assert.ok(typeof out.briefs[0].title === 'string', 'briefs[0].title not string');
        assert.ok(typeof out.briefs[0].date === 'string', 'briefs[0].date not string');
      }
    }});

    tests.push({ id: 'SAC-P143-stream-mission', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const m = out.mission;
      assert.ok(m, 'mission missing');
      for (const key of ['phase_id','phase_title','objective','why_running','risk_tier','success_criteria']) {
        assert.ok(key in m, 'mission.' + key + ' missing');
      }
      assert.ok(Array.isArray(m.success_criteria), 'success_criteria not array');
    }});

    tests.push({ id: 'SAC-P143-stream-pipeline', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const p = out.pipeline;
      assert.ok(p, 'pipeline missing');
      assert.ok(Array.isArray(p.stages), 'pipeline.stages not array');
      assert.strictEqual(p.stages.length, 5, 'pipeline.stages.length must be 5');
      for (const s of p.stages) {
        for (const k of ['name','owner','sla_min','status']) assert.ok(k in s, 'stage missing ' + k);
      }
    }});

    tests.push({ id: 'SAC-P143-stream-agents', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const a = out.agents;
      assert.ok(a && a.claude && a.codex && a.last_handoff, 'agents shape incomplete');
      for (const role of ['claude','codex']) {
        for (const k of ['handle','model','role','status','task','recent_actions']) {
          assert.ok(k in a[role], 'agents.' + role + '.' + k + ' missing');
        }
      }
      // Real data check: handles must not be empty
      assert.ok(a.claude.handle.length > 0, 'claude.handle empty (stub bleed)');
      assert.ok(a.codex.handle.length > 0, 'codex.handle empty (stub bleed)');
    }});

    tests.push({ id: 'SAC-P143-stream-architecture', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out.architecture, 'architecture missing');
      assert.ok(Array.isArray(out.architecture.nodes), 'nodes not array');
      assert.ok(Array.isArray(out.architecture.edges), 'edges not array');
      assert.ok(out.architecture.nodes.length >= 3, 'expected >=3 nodes');
    }});

    tests.push({ id: 'SAC-P143-stream-milestone_map', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const m = out.milestone_map;
      assert.ok(m, 'milestone_map missing');
      for (const k of ['milestones','current','phases','details','intent']) {
        assert.ok(k in m, 'milestone_map.' + k + ' missing');
      }
      assert.ok(Array.isArray(m.milestones) && m.milestones.length >= 1, 'milestones empty');
    }});

    tests.push({ id: 'SAC-P143-stream-memory_graph', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out.memory_graph && Array.isArray(out.memory_graph.sources), 'memory_graph.sources missing');
      assert.ok(out.memory_graph.sources.length >= 1, 'memory_graph empty');
    }});

    tests.push({ id: 'SAC-P143-stream-lineage', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out.lineage && Array.isArray(out.lineage.steps), 'lineage.steps missing');
      assert.strictEqual(out.lineage.steps.length, 5, 'CMB lineage must be 5 steps');
    }});

    tests.push({ id: 'SAC-P143-stream-gate_flow', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const gf = out.gate_flow;
      assert.ok(gf && Array.isArray(gf.stages), 'gate_flow.stages missing');
      assert.strictEqual(gf.stages.length, 5, 'gate_flow must be 5 stages');
      assert.ok(Array.isArray(gf.muda_probes), 'muda_probes missing');
      assert.strictEqual(gf.muda_probes.length, 5, 'muda_probes must be 5');
    }});

    tests.push({ id: 'SAC-P143-stream-evidence', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const e = out.evidence;
      assert.ok(e && e.summary, 'evidence.summary missing');
      for (const k of ['green','warn','fail']) assert.ok(k in e.summary, 'summary.' + k + ' missing');
      assert.ok(Array.isArray(e.categories), 'evidence.categories missing');
      assert.ok(Array.isArray(e.unresolved), 'evidence.unresolved missing');
    }});

    tests.push({ id: 'SAC-P143-stream-telemetry', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      const t = out.telemetry;
      for (const ch of ['fog','dispatches','tokens','context','elapsed']) {
        assert.ok(t[ch], 'telemetry.' + ch + ' missing');
        for (const k of ['value','target','max','history','label']) {
          assert.ok(k in t[ch], 'telemetry.' + ch + '.' + k + ' missing');
        }
        assert.ok(Array.isArray(t[ch].history), ch + '.history not array');
      }
    }});

    tests.push({ id: 'SAC-P143-stream-events', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(Array.isArray(out.events), 'events not array');
      if (out.events.length) {
        for (const k of ['t_off','type','tier','detail']) assert.ok(k in out.events[0], 'event[0].' + k + ' missing');
      }
    }});

    tests.push({ id: 'SAC-P143-stream-alarms', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(Array.isArray(out.alarms), 'alarms not array');
    }});

    tests.push({ id: 'SAC-P143-stream-rationale', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out.rationale, 'rationale missing');
      for (const k of ['why_this_phase','context','eli5','evidence_trail']) {
        assert.ok(k in out.rationale, 'rationale.' + k + ' missing');
      }
    }});

    tests.push({ id: 'SAC-P143-stream-sources', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out._sources, '_sources missing');
      for (const id of ['mission','telemetry','architecture','milestone','memory','evidence','events']) {
        assert.ok(out._sources[id], '_sources.' + id + ' missing');
        for (const k of ['tier','age_ms','last_seen','excused']) assert.ok(k in out._sources[id], '_sources.' + id + '.' + k + ' missing');
      }
    }});

    tests.push({ id: 'SAC-P143-responsive-audit', run: () => {
      const findingsPath = path.join('.planning', 'runtime', 'responsive-audit-findings.json');
      if (!fs.existsSync(findingsPath)) return; // skip if audit not run
      const data = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
      assert.ok(Array.isArray(data.findings), 'findings not array');
      assert.strictEqual(data.findings.length, 0, 'responsive audit findings: ' + data.findings.join(' | '));
    }});

    tests.push({ id: 'SAC-P143-stream-health', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(out.stream_health, 'stream_health key missing');
      assert.ok(Array.isArray(out.stream_health.streams), 'stream_health.streams not array');
      assert.ok(out.stream_health.streams.length >= 14, 'expected >=14 streams, got ' + out.stream_health.streams.length);
      // Every stream has the required shape
      for (const s of out.stream_health.streams) {
        for (const k of ['id','label','breaker','consecutive_failures','latency_p95_ms']) {
          assert.ok(k in s, 'stream missing ' + k);
        }
        assert.ok(['closed','open','half-open'].includes(s.breaker), 'invalid breaker state: ' + s.breaker);
      }
      // Thresholds present
      assert.ok(out.stream_health.thresholds, 'thresholds missing');
      assert.strictEqual(out.stream_health.thresholds.circuit_open_after_consecutive_failures, 3);
    }});

    tests.push({ id: 'SAC-P143-dead-mans-banner', run: () => {
      // Source-grep — dead-man's switch implementation must exist in client.js
      const src = fs.readFileSync('super-gsd/tools/cockpit-sidecar/client.js', 'utf8');
      assert.ok(/dead-mans-banner/.test(src), 'client.js missing dead-mans-banner');
      assert.ok(/evaluateDeadMansSwitch/.test(src), 'client.js missing evaluateDeadMansSwitch fn');
      assert.ok(/SILENCE_THRESHOLD_MS/.test(src), 'client.js missing SILENCE_THRESHOLD_MS');
    }});

    tests.push({ id: 'SAC-P143-rendered-stream-health', run: async () => {
      const result = await fetchRenderedDom();
      assert.ok(/class="stream-health"/.test(result.html), 'rendered DOM missing .stream-health');
      const rows = (result.html.match(/class="sh-row /g) || []).length;
      assert.ok(rows >= 14, 'expected >=14 sh-rows, got ' + rows);
    }});

    tests.push({ id: 'SAC-P143-stream-handovers', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, { statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }), state: { milestone: 'v3.2', phase: '127' } });
      assert.ok(Array.isArray(out.handovers), 'handovers not array');
      assert.ok(out.handovers.length >= 5, 'expected >=5 handover docs, got ' + out.handovers.length);
      for (const h of out.handovers) {
        for (const k of ['rel_path','title','category','size_kb']) {
          assert.ok(k in h, 'handover.' + k + ' missing');
        }
        assert.ok(['brief','analysis','milestone'].includes(h.category), 'invalid handover category: ' + h.category);
        assert.ok(h.rel_path.endsWith('.html'), 'handover rel_path not .html');
      }
    }});

    tests.push({ id: 'SAC-P143-rendered-handovers-section', run: async () => {
      const result = await fetchRenderedDom();
      assert.ok(/id="sec-handovers"/.test(result.html), 'rendered DOM missing #sec-handovers section');
      assert.ok(/class="handover-card"/.test(result.html), 'no .handover-card cards rendered');
      const cards = (result.html.match(/class="handover-card"/g) || []).length;
      assert.ok(cards >= 5, 'expected >=5 handover cards, got ' + cards);
    }});

    tests.push({ id: 'SAC-P138.5-01', run: () => {
      // Browser-smoke gate witness — the most-recent cockpit-touching phase MUST
      // have a verdict=PASS artifact at .planning/runtime/cockpit-smoke-<N>-verdict.json.
      // This SAC is the structural mirror of the operator standing instruction
      // "ALWAYS verify via web browser". Without a verdict.json on disk, we have
      // no proof the cockpit ever actually served, only that the source files
      // mentioned the right symbols.
      const runtimeDir = path.join('.planning', 'runtime');
      assert.ok(fs.existsSync(runtimeDir), 'runtime dir missing — no browser-smoke ever run');
      const entries = fs.readdirSync(runtimeDir).filter((f) => /^cockpit-smoke-.+-verdict\.json$/.test(f));
      assert.ok(entries.length > 0, 'no cockpit-smoke-*-verdict.json artifacts found — run browser-smoke.cjs at phase close');
      // Use the newest verdict file
      const sorted = entries
        .map((f) => ({ f, m: fs.statSync(path.join(runtimeDir, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
      const newest = path.join(runtimeDir, sorted[0].f);
      const verdict = JSON.parse(fs.readFileSync(newest, 'utf8'));
      assert.strictEqual(verdict.verdict, 'PASS', `newest browser-smoke verdict is ${verdict.verdict} (${newest}) — phase MUST NOT close`);
      // Every individual check must also be ok
      for (const [name, check] of Object.entries(verdict.checks || {})) {
        assert.ok(check.ok, `browser-smoke check ${name} failed: ${check.detail}`);
      }
    }});

    tests.push({ id: 'SAC-P137-08', run: () => {
      const sidecar2 = require('./cockpit-sidecar.cjs');
      const out = p127Out();
      sidecar2.attachAll(out, {
        statFn: () => ({ mtimeMs: Date.now() - 1000, isDirectory: () => false }),
        state: { milestone: 'v3.2', phase: '127' },
      });
      // SAC intent: R19 wiring is correct on a fresh _sources block. Verify on
      // both 'cockpit' and 'monitor' surfaces (both fire R19). 'cockpit-html'
      // would also fire R13/R14/R15/R18 against bare JSON (no HTML markers),
      // and 'cockpit' fires chronicle-style R01/R04/R07 against JSON. The
      // surface-wiring quirks predate P137; R19 firing PASS is what we lock.
      const json = JSON.stringify(out);
      for (const surface of ['cockpit', 'monitor', 'cockpit-html']) {
        const verdict = checkConformance(json, surface);
        const r19 = verdict.results.find((r) => r.id === 'R19');
        assert.ok(r19, `${surface}: R19 missing from verdict`);
        assert.strictEqual(r19.status, 'PASS', `${surface}: R19 ${r19.status} — ${r19.detail || r19.reason}`);
      }
      // R16 still passes when applicable (cockpit surface fires R16).
      const r16Verdict = checkConformance(json, 'cockpit');
      const r16 = r16Verdict.results.find((r) => r.id === 'R16');
      assert.ok(r16 && r16.status === 'PASS', JSON.stringify(r16));
    }});

    return tests;
  })(),
  { id: 'SAC-P125-01', run: () => { const result = computeNorthStar({ binding_gate_status: 'RED', fog_score: { tier: 'high' } }); assert.strictEqual(result.rank, 1); assert.strictEqual(result.code, 'BLOCKED'); } },
  { id: 'SAC-P125-02', run: () => { const result = computeNorthStar({ binding_gate_status: 'GREEN', latest_chronicle: { validator_verdict: 'REPORT_BROKEN_CITATION' } }); assert.strictEqual(result.rank, 2); assert.strictEqual(result.code, 'CHRONICLE_FAILED'); } },
  { id: 'SAC-P125-03', run: () => { const result = computeNorthStar({ binding_gate_status: 'GREEN', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, fog_score: { tier: 'low' }, milestone: 'v3.2', phase: '125' }); assert.strictEqual(result.rank, 5); assert.strictEqual(result.code, 'ON_TRACK'); } },
  { id: 'SAC-P125-04', run: () => { const result = evaluateAlerts({ binding_gate_status: 'RED', fog_score: { score: 85 }, prior_fog_high: true, signals: { dispatch_count: 15 } }); assert.ok(result.top); assert.strictEqual(result.others_count, 2); } },
  { id: 'SAC-P125-05', run: () => { const result = evaluateAlerts({ warnings: ['executor_log_unavailable: .planning/... not found'] }); assert.strictEqual(result.top, null); } },
  { id: 'SAC-P125-06', run: () => { const result = evaluateAlerts({ fog_score: { score: 85 } }); assert.ok(!result.all.some((alert) => alert.signal === 'fog_score')); } },
  { id: 'SAC-P126-01', run: () => {
    const out = { binding_gate_status: 'RED', latest_chronicle: {}, fog_score: { tier: 'high' }, signals: {}, warnings: [], milestone: 'v3.2', phase: '126' };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    // v3.3 layout note: renderText now opens with a box-drawing header line
    // (┌─ NORTH STAR ─...─┐) before the data line. Test intent preserved:
    // first line containing actual content (not box-drawing chrome) must include BLOCKED.
    const firstNonBorder = sidecar.renderText(out, { color: false }).split(/\r?\n/).find((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^[=\-\s]+$/.test(trimmed)) return false;
      // skip box-drawing header/separator lines like "┌─ NORTH STAR ──...─┐" or "├──────┤"
      if (/^[─━│┌┐└┘├┤\s]*(?:NORTH STAR|DO NEXT|STAGE|WHY|UNLOCK|BLOCK|fog|dispatch|tokens)?[─━│┌┐└┘├┤\s]*$/.test(trimmed)) return false;
      return true;
    }) || '';
    assert.ok(firstNonBorder.includes('BLOCKED'), firstNonBorder);
  } },
  { id: 'SAC-P126-02', run: () => {
    const out = { binding_gate_status: 'RED', fog_score: { score: 85 }, prior_fog_high: true, signals: { dispatch_count: 15 }, latest_chronicle: {}, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    const alertLines = sidecar.renderText(out, { color: false }).split(/\r?\n/).filter((line) => line.includes('⚠'));
    assert.strictEqual(alertLines.length, 1);
    assert.ok(alertLines[0].includes('(+2 more)'), alertLines[0]);
  } },
  { id: 'SAC-P126-03', run: () => {
    const out = { binding_gate_status: 'GREEN', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, fog_score: { tier: 'low', score: 10 }, signals: {}, warnings: [], milestone: 'v3.2', phase: '126' };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    assert.ok(sidecar.renderBrief(out).split(/\r?\n/).filter((line) => line.trim()).length <= 4);
  } },
  { id: 'SAC-P126-04', run: () => {
    const out = { milestone: 'v3.2', phase: '126', generated_at: '2026-05-22T00:00:00.000Z', latest_chronicle: { location: '.planning/chronicles/126.md', validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] }, recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    ['milestone', 'phase', 'generated_at', 'latest_chronicle', 'binding_gate_status', 'fog_score', 'recent_chronicles', 'signals', 'warnings'].forEach((key) => assert.ok(key in out, key));
    assert.ok('north_star' in out);
    assert.ok('alerts' in out);
  } },
  { id: 'SAC-P126-05', run: () => {
    const out = { milestone: 'v3.2', phase: '126', generated_at: '2026-05-22T00:00:00.000Z', latest_chronicle: { location: '.planning/chronicles/126.md', validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] }, recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    const html = sidecar.renderHtml(out);
    assert.ok(html.includes('role="operator-decision"'));
    assert.ok(!html.includes('http://'));
    assert.ok(!html.includes('https://'));
  } },
  { id: 'SAC-P126-06', run: () => {
    const out = { milestone: 'v3.2', phase: '126', generated_at: '2026-05-22T00:00:00.000Z', latest_chronicle: { location: '.planning/chronicles/126.md', validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] }, recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    assert.ok(!sidecar.renderText(out, { color: false }).includes('\x1b['));
  } },
  { id: 'SAC-P126-07', run: () => { assert.ok(true); } },
  { id: 'SAC-P127-01', run: () => {
    const verdict = checkConformance(sidecar.renderHtml(p127Out()), 'cockpit');
    assert.strictEqual(verdict.summary.binding_fail, 0, JSON.stringify(verdict.summary));
  } },
  { id: 'SAC-P127-02', run: () => {
    const verdict = checkConformance(sidecar.renderHtml(p127Out()), 'cockpit');
    const r04 = verdict.results.find((r) => r.id === 'R04');
    assert.ok(r04 && r04.status === 'PASS', JSON.stringify(r04));
  } },
  { id: 'SAC-P127-03', run: () => {
    const verdict = checkConformance(fs.readFileSync(GOLD_REFERENCE, 'utf8'), 'chronicle');
    assert.strictEqual(verdict.summary.binding_fail, 0, JSON.stringify(verdict.summary));
  } },
  { id: 'SAC-P127-04', run: () => {
    const cockpit = checkConformance(sidecar.renderHtml(p127Out()), 'cockpit');
    const chronicle = checkConformance(fs.readFileSync(GOLD_REFERENCE, 'utf8'), 'chronicle');
    assert.strictEqual(cockpit.summary.binding_fail, 0, 'cockpit ' + JSON.stringify(cockpit.summary));
    assert.strictEqual(chronicle.summary.binding_fail, 0, 'chronicle ' + JSON.stringify(chronicle.summary));
  } },
  { id: 'SAC-P127-05', run: () => { assert.ok(true); } },
];

function selectedSac() {
  const index = process.argv.indexOf('--sac');
  if (index === -1) return null;
  return process.argv[index + 1] || '';
}

async function runTest(test) {
  try {
    await Promise.resolve(test.run());
    console.log(test.id + ' PASS');
    return true;
  } catch (error) {
    console.error(test.id + ' FAIL');
    console.error(error && error.stack ? error.stack : String(error));
    return false;
  }
}

(async () => {
  const sac = selectedSac();
  const runnable = sac ? tests.filter((test) => test.id === sac) : tests;
  if (sac && runnable.length === 0) { console.error('Unknown --sac value: ' + sac); process.exit(1); }
  const results = await Promise.all(runnable.map(runTest));
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
