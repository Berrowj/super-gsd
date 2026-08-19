// SGSD - PHASE-FOLDER AUDIT TEST FIXTURES (Phase 40 -- A3 deliverable)
// Deterministic local fallback test. Exercises production library
// (super-gsd/tools/phase-folder-audit/audit.cjs) against 4 fixtures.
// Mirrors the per-tool test pattern established in Phase 35/39.
// All file writes scoped to the os-tmpdir prefix output. Read-only
// against any real phase folder (AUDIT-04 invariant).

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { auditFolder, auditAllPhases, renderTable, VERDICTS } =
  require(path.join(__dirname, 'audit.cjs'));
const { parsePhaseName, comparePhases, discoverPhases } =
  require(path.join(__dirname, '..', '..', 'scripts', 'lib', 'phase-name.cjs'));

let pass = 0, fail = 0;
const failures = [];
const assert = function (name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ name: name, detail: detail || '' }); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fixtures-'));
try {
  // Helper: build a fixture phase folder under tmp/<milestoneDir>/<phaseDir>.
  function buildFixture(milestone, phaseFolderName, files) {
    const phaseDir = path.join(tmp, 'milestones', milestone, 'phases', phaseFolderName);
    fs.mkdirSync(phaseDir, { recursive: true });
    for (const f of files) {
      fs.writeFileSync(path.join(phaseDir, f), '', 'utf8');
    }
    return phaseDir;
  }

  // Fixture A: compliant (4 required + 4 recommended).
  const dirA = buildFixture('v1.9', '50-fixture-a', [
    '50-CONTEXT.md', '50-RESEARCH.md', '50-01-fixture-a-PLAN.md', '50-VERIFICATION.md',
    '50-ATC-REVIEW.md', 'commit-reviews.jsonl', '50-codex-review.md', 'WASTE.md',
  ]);
  const resA = auditFolder(dirA);
  assert('A. compliant fixture -> verdict=compliant',
    resA && resA.verdict === 'compliant'
      && resA.required_missing.length === 0
      && resA.recommended_missing.length === 0);

  // Fixture B: partial (4 required, 0 recommended).
  const dirB = buildFixture('v1.9', '51-fixture-b', [
    '51-CONTEXT.md', '51-RESEARCH.md', '51-01-fixture-b-PLAN.md', '51-VERIFICATION.md',
  ]);
  const resB = auditFolder(dirB);
  assert('B. partial fixture -> verdict=partial; recommended_missing has 4',
    resB && resB.verdict === 'partial'
      && resB.required_missing.length === 0
      && resB.recommended_missing.length === 4);

  // Fixture C: non-compliant (missing 52-CONTEXT.md).
  const dirC = buildFixture('v1.9', '52-fixture-c', [
    '52-RESEARCH.md', '52-01-fixture-c-PLAN.md', '52-VERIFICATION.md',
    '52-ATC-REVIEW.md', 'commit-reviews.jsonl', '52-codex-review.md', 'WASTE.md',
  ]);
  const resC = auditFolder(dirC);
  assert('C. non-compliant fixture -> verdict=non-compliant; CONTEXT in missing',
    resC && resC.verdict === 'non-compliant'
      && resC.required_missing.indexOf('52-CONTEXT.md') >= 0);

  // Fixture D: empty (folder exists, zero files inside).
  const dirD = buildFixture('v1.9', '53-fixture-d', []);
  const resD = auditFolder(dirD);
  assert('D. empty fixture -> verdict=non-compliant; required_missing.length=4',
    resD && resD.verdict === 'non-compliant'
      && resD.required_missing.length === 4);

  // Discovery: auditAllPhases over tmp's planning dir returns 4 audits
  // (one per fixture; sorted by codepoint).
  const all = auditAllPhases(tmp, { milestone: 'v1.9', includeUnarchived: false });
  assert('E. auditAllPhases discovery -> 4 audits returned',
    Array.isArray(all) && all.length === 4);

  // Render: renderTable on the 4-row result returns a markdown string
  // including the soft-warn footer literal.
  const md = renderTable(all);
  assert('F. renderTable on 4-fixture set -> contains soft-warn footer',
    typeof md === 'string' && md.indexOf('Soft-warn only.') >= 0);

  // Verdict closed-enum: every verdict produced is in VERDICTS.
  assert('G. all verdicts in closed enum',
    all.every(function (r) { return VERDICTS.indexOf(r.verdict) >= 0; }));

  // Empty render literal:
  assert('H. renderTable([]) returns the no-folders-found literal',
    renderTable([]).indexOf('(no phase folders found for this milestone)') >= 0);

  const parsed = [
    parsePhaseName('40-phase'),
    parsePhaseName('40.5-phase'),
    parsePhaseName('v30-07-phase'),
    parsePhaseName('v30-06.8'),
  ];
  assert('I. shared parser accepts integer, decimal, and versioned phase names',
    parsed[0] && parsed[0].token === '40' && parsed[0].scheme === 'integer'
      && parsed[1] && parsed[1].token === '40.5' && parsed[1].scheme === 'decimal'
      && parsed[2] && parsed[2].token === 'v30-07' && parsed[2].scheme === 'v'
      && parsed[3] && parsed[3].token === 'v30-06.8' && parsed[3].slug === null);
  const bare = [parsePhaseName('40'), parsePhaseName('40.5'), parsePhaseName('v30-07')];
  assert('I2. shared parser accepts every scheme without a slug suffix',
    bare.every((entry) => entry && entry.slug === null));
  assert('J. shared parser rejects non-phase names',
    parsePhaseName('README') === null && parsePhaseName('v30-x') === null);

  const sortedTokens = parsed.slice(0, 3).reverse().sort(comparePhases).map((entry) => entry.token);
  assert('K. shared comparator is deterministic across schemes',
    sortedTokens.join(',') === '40,40.5,v30-07', sortedTokens.join(','));
  const integerOrder = [parsePhaseName('10-ten'), parsePhaseName('9-nine')]
    .sort(comparePhases).map((entry) => entry.token);
  assert('K2. shared comparator preserves integer lexical-width ordering without arithmetic',
    integerOrder.join(',') === '9,10', integerOrder.join(','));
  const numericAwarePairs = [
    ['14.2', '14.10'],
    ['v30-06.8', 'v30-06.10'],
    ['v30-6', 'v30-10'],
  ];
  for (const [lower, higher] of numericAwarePairs) {
    assert(`K3. shared comparator orders numeric segments: ${lower} < ${higher}`,
      comparePhases(parsePhaseName(lower), parsePhaseName(higher)) < 0);
  }

  const dualPlanning = path.join(tmp, 'dual-parser');
  const milestonePhase = path.join(dualPlanning, 'milestones', 'v9.9', 'phases', 'v30-07-shared');
  fs.mkdirSync(milestonePhase, { recursive: true });
  const flatRoot = path.join(dualPlanning, 'phases');
  fs.symlinkSync(path.dirname(milestonePhase), flatRoot,
    process.platform === 'win32' ? 'junction' : 'dir');
  const discovered = discoverPhases(path.dirname(dualPlanning), {
    planningDir: dualPlanning,
    milestone: 'v9.9',
  });
  assert('L. shared discovery realpath-deduplicates milestone and flat roots',
    discovered.length === 1 && discovered[0].token === 'v30-07',
    `count=${discovered.length}`);

  const faultPlanning = path.join(tmp, 'fault-parser');
  const faultRoot = path.join(faultPlanning, 'milestones', 'v9.8', 'phases');
  fs.mkdirSync(faultRoot, { recursive: true });
  const originalReaddirSync = fs.readdirSync;
  let discoveryFault;
  try {
    fs.readdirSync = function (target, options) {
      if (path.resolve(target) === path.resolve(faultRoot)) {
        const error = new Error(`EACCES: permission denied, scandir '${target}'`);
        error.code = 'EACCES';
        throw error;
      }
      return originalReaddirSync.call(fs, target, options);
    };
    discoveryFault = discoverPhases(path.dirname(faultPlanning), {
      planningDir: faultPlanning,
      milestone: 'v9.8',
      includeFlat: false,
    });
  } finally {
    fs.readdirSync = originalReaddirSync;
  }
  assert('L2. shared discovery returns a structured unreadable-root fault',
    discoveryFault && discoveryFault.ok === false
      && discoveryFault.operation === 'readdir'
      && discoveryFault.error_code === 'EACCES'
      && discoveryFault.path === path.resolve(faultRoot),
    JSON.stringify(discoveryFault));

  const decimalDir = buildFixture('v1.9', '54.5-decimal', [
    '54.5-CONTEXT.md', '54.5-RESEARCH.md', '54.5-01-decimal-PLAN.md', '54.5-VERIFICATION.md',
  ]);
  const versionedDir = buildFixture('v1.9', 'v30-07-versioned', [
    'v30-07-CONTEXT.md', 'v30-07-RESEARCH.md', 'v30-07-01-versioned-PLAN.md', 'v30-07-VERIFICATION.md',
  ]);
  assert('M. auditFolder uses shared parser for decimal names',
    auditFolder(decimalDir).phase_num === '54.5');
  assert('N. auditFolder uses shared parser for versioned names',
    auditFolder(versionedDir).phase_num === 'v30-07');

} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('audit fixture suite: ' + pass + ' pass, ' + fail + ' fail');
if (fail > 0) {
  for (const f of failures) {
    console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
  }
  process.exit(1);
}
process.exit(0);
