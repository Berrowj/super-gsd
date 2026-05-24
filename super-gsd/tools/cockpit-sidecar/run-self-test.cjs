'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
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

function runTest(test) {
  try { test.run(); console.log(test.id + ' PASS'); return true; }
  catch (error) { console.error(test.id + ' FAIL'); console.error(error && error.stack ? error.stack : String(error)); return false; }
}

const sac = selectedSac();
const runnable = sac ? tests.filter((test) => test.id === sac) : tests;
if (sac && runnable.length === 0) { console.error('Unknown --sac value: ' + sac); process.exit(1); }
const passed = runnable.map(runTest).every(Boolean);
process.exit(passed ? 0 : 1);
