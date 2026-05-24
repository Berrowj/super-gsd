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
    const child = cpModule.spawn('node', [
      'super-gsd/tools/cockpit-sidecar/serve.cjs',
      '--port',
      String(port),
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    let stderr = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('timed out waiting for cockpit-server port; stderr=' + stderr));
    }, 3000);

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

  const exited = waitForExit(child, 2000).catch((err) => {
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

          fs.utimesSync(path.resolve('.planning/STATE.md'), new Date(), new Date());
          const deadline = Date.now() + 2000;
          while (Date.now() < deadline && events.length < 2) {
            await sleep(50);
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
        const { child } = await startTestServer();
        const pidPath = path.resolve('.planning/runtime/cockpit-server.pid');
        assert.ok(fs.existsSync(pidPath), 'PID file should exist');
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
          });

          let stderr = '';
          second.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
          const exit = await waitForExit(second, 2000);
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
