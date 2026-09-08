'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../..');

test('worker supervision skill defines a bounded exact-target background loop', () => {
  const file = path.join(base, 'skills/sgsd-workers/SKILL.md');
  assert.ok(fs.existsSync(file), 'worker supervisor skill must be shipped');
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of [/name: sgsd-workers/, /<objective>/, /<quick_start>/, /<success_criteria>/,
    /run_in_background/, /--owner/, /--worker/, /--request/, /receipt/, /--answers-json/,
    /SGSD_WORKER_RESUME_ID/, /operator-only/, /Never.*--last/, /Atlas/, /danger-full-access/,
    /wrapper-result\.json/, /wrapper_attempt_id/, /sha256/, /explicit exception/]) assert.ok(pattern.test(text), `missing worker contract: ${pattern}`);
  assert.ok(text.split('\n').length < 200);
  assert.doesNotMatch(text, /^#{1,6}\s/m);
});

test('every current orchestration entrypoint requires worker inbox supervision', () => {
  for (const relative of ['skills/sgsd-orchestrate/SKILL.md', 'skills/sgsd-deliberate/SKILL.md', 'skills/sgsd-codex-control/SKILL.md',
    'CLAUDE-OVERLAY.md', '../CLAUDE.md']) {
    const text = fs.readFileSync(path.join(base, relative), 'utf8');
    assert.ok(/sgsd-workers/.test(text), `${relative}: missing worker skill`);
    assert.ok(/run_in_background/.test(text), `${relative}: missing background supervision`);
  }
});

test('current consumer instructions do not force the retired models or ephemeral sessions', () => {
  const orchestrate = fs.readFileSync(path.join(base, 'skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  assert.ok(!/executor model is always|executor reasoning effort is always|Orchestration is Claude\/Opus 4\.7/.test(orchestrate), 'retired model hard lock');
  assert.match(orchestrate, /Fable/);
  const control = fs.readFileSync(path.join(base, 'skills/sgsd-codex-control/SKILL.md'), 'utf8');
  assert.doesNotMatch(control, /set triage ephemeral true/);
  assert.match(control, /retained/);
});

test('board descriptors bind the supervising unit during preparation, including new rounds and retries', () => {
  const text = fs.readFileSync(path.join(base, 'skills/sgsd-deliberate/SKILL.md'), 'utf8');
  const example = text.match(/```bash\r?\n(node super-gsd\/scripts\/lib\/board-dispatch\.cjs[\s\S]*?)```/);
  assert.ok(example, 'board preparation command must be documented');
  assert.ok(/--owner "\$UNIT"/.test(example[1]), 'owner must be embedded when preparing the descriptor, not only in launch env');
  assert.ok(/worker_owner/.test(text), 'returned owner must be checked');
  assert.ok(/every.*(?:round|retry)|(?:round|retry).*every/i.test(text), 'all rounds and attempts must retain ownership');
});
