'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const boardRegistry = require('./board-registry.cjs');

function writeTempBoardYaml(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-board-registry-'));
  const file = path.join(dir, 'board-members.yaml');
  fs.writeFileSync(file, body);
  return { dir, file };
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } finally {
    boardRegistry.resetCache();
  }
}

run('resolveRoster excludes disabled default and escalation members', () => {
  const { dir, file } = writeTempBoardYaml(`
board_members:
  - name: disabled-architect
    model_default: disabled
    state: legacy-disabled
  - name: active-architect
    model_default: opus
    state: active
  - name: disabled-ceo
    model_default: sonnet
    state: active
  - name: active-ceo
    model_default: opus
    state: active
  - name: disabled-pragmatist
    model_default: disabled
    state: legacy-disabled
escalation_policy:
  default_minimal_board:
    - disabled-architect
    - active-architect
  always_present:
    - disabled-ceo
    - active-ceo
  escalate_add:
    - add: disabled-pragmatist
      when:
        any:
          - over: members
            where:
              role: Contrarian
              position: OPPOSE
              confidence: { gte: 4 }
`);

  try {
    assert.deepStrictEqual(
      boardRegistry.resolveRoster({}, null, file),
      ['active-architect', 'active-ceo']
    );

    assert.deepStrictEqual(
      boardRegistry.resolveRoster({}, [{ role: 'Contrarian', position: 'OPPOSE', confidence: 5 }], file),
      ['active-architect', 'active-ceo']
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

run('production board defaults to Opus architect, Opus contrarian, and Opus CEO only', () => {
  const board = boardRegistry.loadBoard();
  const roster = boardRegistry.resolveRoster({});
  assert.deepStrictEqual(roster, ['sgsd-board-architect', 'sgsd-board-contrarian', 'sgsd-ceo']);

  for (const name of roster) {
    const member = board.byName[name];
    assert(member, `${name} missing from board registry`);
    assert.strictEqual(member.state, 'active', `${name} must be active`);
    assert.notStrictEqual(member.model_default, 'sonnet', `${name} must not use Sonnet`);
    assert.notStrictEqual(member.model_default, 'haiku', `${name} must not use Haiku`);
    assert.notStrictEqual(member.model_default, 'disabled', `${name} must not be disabled`);
  }

  assert.match(board.byName['sgsd-board-architect'].model_default, /^opus/i);
assert.match(board.byName['sgsd-board-contrarian'].model_default, /^opus/i);
assert.match(board.byName['sgsd-ceo'].model_default, /^opus/i);
});
