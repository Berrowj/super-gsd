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
