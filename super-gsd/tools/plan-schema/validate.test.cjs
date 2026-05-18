const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const validator = path.join(__dirname, 'validate.cjs');
const fixtures = path.join(__dirname, 'fixtures');
const phaseDir = path.join(
  repoRoot,
  '.planning',
  'milestones',
  'v2.9',
  'phases',
  '97.5-semantic-verification-gate'
);

const cases = [
  {
    name: 'missing-semantic-ac.md',
    target: path.join(fixtures, 'missing-semantic-ac.md'),
    exitCode: 1,
    stderrIncludes: 'SCHEMA-09'
  },
  {
    name: 'empty-semantic-ac.md',
    target: path.join(fixtures, 'empty-semantic-ac.md'),
    exitCode: 1,
    stderrIncludes: 'SCHEMA-09'
  },
  {
    name: 'incomplete-semantic-ac.md',
    target: path.join(fixtures, 'incomplete-semantic-ac.md'),
    exitCode: 1,
    stderrIncludes: 'SCHEMA-10'
  },
  {
    name: 'good-semantic-ac.md',
    target: path.join(fixtures, 'good-semantic-ac.md'),
    exitCode: 0,
    stderrIncludes: 'VALID'
  },
  {
    name: '97.5-01-schema-enforcement-PLAN.md',
    target: path.join(phaseDir, '97.5-01-schema-enforcement-PLAN.md'),
    exitCode: 0,
    stderrIncludes: 'VALID'
  }
];

let counter = 0;

function runValidator(command) {
  const stderrPath = path.join(__dirname, `.validate-test-${process.pid}-${counter++}.stderr`);
  const stderrFd = fs.openSync(stderrPath, 'w');
  let exitCode = 0;

  try {
    execFileSync(command.file, command.args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', stderrFd]
    });
  } catch (error) {
    exitCode = typeof error.status === 'number' ? error.status : 1;
  } finally {
    fs.closeSync(stderrFd);
  }

  const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';
  fs.rmSync(stderrPath, { force: true });

  return { exitCode, stderr };
}

function excerpt(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240);
}

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  // Arrange
  const command = {
    file: process.execPath,
    args: [validator, '--plan-file', testCase.target, '--project-dir', repoRoot]
  };

  // Act
  const result = runValidator(command);

  // Assert
  try {
    assert.strictEqual(result.exitCode, testCase.exitCode);
    assert.ok(result.stderr.includes(testCase.stderrIncludes));
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(
      `${testCase.name} failed: actual exit ${result.exitCode}; stderr excerpt: ${excerpt(result.stderr)}`
    );
  }
}

if (failed > 0) {
  console.error(`${passed} passed, ${failed} failed`);
  process.exit(1);
}

console.error('5 passed, 0 failed');
