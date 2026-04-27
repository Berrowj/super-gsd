#!/usr/bin/env node
// ============================================================================
// SGSD Codex Rerun Harness
// ============================================================================
// One-shot tool: re-runs the missing Codex ATC reviews for the 8 v1.6 backlog
// rows that were filed under the false "Codex unavailable" cause. Per the
// architectural rule: provider-related backlog clearance requires the actual
// missing review evidence — not just a fix to the probe.
//
// For each missing-review row:
//   1. Construct a code-reviewer-v1 prompt for the artifact (commit diff or phase folder)
//   2. Invoke `codex exec` with --sandbox read-only --ephemeral
//   3. Validate the 5-line contract response
//   4. Append a row to the correct commit-reviews.jsonl
//   5. Append a `kind: cleared` backlog row referencing the original id +
//      pointing to the new evidence
//
// Designed to be deterministic-given-prompts: each artifact gets one Codex
// call with a stable prompt template.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const backlog = require('../../scripts/lib/crit-backlog.cjs');

const PROJECT = process.cwd();
const PLANNING = path.join(PROJECT, '.planning');

// The 8 missing reviews. Each entry references the original backlog id
// so we can cleanly clear it.
const REVIEWS = [
  {
    backlog_id: '2026-04-26T23-13-37-843Z-3584',
    phase: '26', plan: 'phase-level', commit: null,
    target_dir: '.planning/milestones/v1.6/phases/26-cockpit-question-contract',
    target_kind: 'phase_folder',
    out_jsonl: '.planning/milestones/v1.6/phases/26-cockpit-question-contract/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-26T23-44-25-933Z-93f4',
    phase: '27', plan: 'phase-level', commit: null,
    target_dir: '.planning/milestones/v1.6/phases/27-cockpit-data-tree',
    target_kind: 'phase_folder',
    out_jsonl: '.planning/milestones/v1.6/phases/27-cockpit-data-tree/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-27T00-07-22-122Z-589f',
    phase: '28', plan: 'T1', commit: '34eb8c2',
    target_kind: 'commit_diff',
    out_jsonl: '.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-27T00-07-22-123Z-ce2a',
    phase: '28', plan: 'T3', commit: '7e96ab3',
    target_kind: 'commit_diff',
    out_jsonl: '.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-27T00-11-14-177Z-46fe',
    phase: '28', plan: 'T2', commit: '982d781',
    target_kind: 'commit_diff',
    out_jsonl: '.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-27T00-20-09-687Z-9c3c',
    phase: '28', plan: 'phase-level', commit: null,
    target_dir: '.planning/milestones/v1.6/phases/28-mission-control-layout',
    target_kind: 'phase_folder',
    out_jsonl: '.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-27T00-51-47-682Z-cfe0',
    phase: '29', plan: 'phase-level', commit: null,
    target_dir: '.planning/milestones/v1.6/phases/29-agent-codex-lanes',
    target_kind: 'phase_folder',
    out_jsonl: '.planning/milestones/v1.6/phases/29-agent-codex-lanes/commit-reviews.jsonl',
  },
  {
    backlog_id: '2026-04-27T05-08-16-452Z-d1de',
    phase: '30', plan: 'phase-level', commit: null,
    target_dir: '.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance',
    target_kind: 'phase_folder',
    out_jsonl: '.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/commit-reviews.jsonl',
  },
];

const isWin = process.platform === 'win32';

function gitShow(commit) {
  const r = spawnSync('git', ['show', '--stat', '-p', commit], { encoding: 'utf8', shell: isWin });
  return r.stdout || '';
}

function readPhaseFolderArtifacts(dirRel) {
  const dir = path.join(PROJECT, dirRel);
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f === 'commit-reviews.jsonl');
  let out = '';
  for (const f of files) {
    const fp = path.join(dir, f);
    if (!fs.statSync(fp).isFile()) continue;
    const content = fs.readFileSync(fp, 'utf8');
    out += `\n\n=== FILE: ${f} (${content.length} bytes) ===\n`;
    // Truncate large files to keep prompt under control
    out += content.length > 8000 ? content.slice(0, 8000) + '\n... [truncated]' : content;
  }
  return out;
}

function buildPrompt(review) {
  const header = `You are reviewing SGSD Phase ${review.phase} ${review.plan === 'phase-level' ? 'phase-level rollup' : 'task ' + review.plan} for the v1.6 cockpit milestone.

This is a post-hoc review: the original Codex review was skipped due to a false-negative auth probe. Provide your review using the code-reviewer-v1 contract.

Required output: exactly five lines, no preamble, no commentary:
FINDINGS: <bulleted findings or "none">
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <X>/<Y>
ONE_LINER: <single line, <=120 chars>

Be honest. Brief but substantive. Focus on real defects, not nits.

`;
  let body = '';
  if (review.target_kind === 'commit_diff') {
    body = '== COMMIT DIFF ==\n\n' + gitShow(review.commit);
    // Truncate if too large
    if (body.length > 30000) body = body.slice(0, 30000) + '\n... [truncated]';
  } else if (review.target_kind === 'phase_folder') {
    body = '== PHASE FOLDER ARTIFACTS ==\n' + readPhaseFolderArtifacts(review.target_dir);
    if (body.length > 30000) body = body.slice(0, 30000) + '\n... [truncated]';
  }
  return header + body + '\n\nReturn the 5-line code-reviewer-v1 contract now.';
}

function invokeCodex(prompt, timeoutMs = 240000) {
  // Up to 2 attempts; transient FAIL on first attempt (likely MCP transport
  // glitch in Codex CLI 0.125.0 with concurrent calls) is retried after 2s.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = spawnSync('codex', [
      'exec', '--model', 'gpt-5.5', '-c', 'model_reasoning_effort="xhigh"',
      '--sandbox', 'read-only', '--ephemeral', '--skip-git-repo-check', '-',
    ], {
      input: prompt,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      encoding: 'utf8',
      shell: isWin,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (r.status === 0) return { exit: 0, stdout: r.stdout || '', stderr: r.stderr || '', attempt };
    if (attempt === 1) {
      // Sleep 2s then retry
      const start = Date.now();
      while (Date.now() - start < 2000) {}
    }
    if (attempt === 2) return { exit: r.status ?? -1, stdout: r.stdout || '', stderr: r.stderr || '', attempt };
  }
}

function parseContract(stdout) {
  // Extract the last block that contains all 5 fields
  const lines = stdout.split(/\r?\n/);
  const fields = { FINDINGS: null, CRITICAL: null, WARNINGS: null, PASS_RATE: null, ONE_LINER: null };
  for (const line of lines) {
    for (const k of Object.keys(fields)) {
      const m = line.match(new RegExp('^' + k + ':\\s*(.+?)\\s*$'));
      if (m) fields[k] = m[1];
    }
  }
  const allPresent = Object.values(fields).every((v) => v !== null);
  return { ok: allPresent, fields };
}

function appendReviewRow(outJsonl, review, parsed, raw) {
  const out = path.join(PROJECT, outJsonl);
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const row = {
    ts: new Date().toISOString(),
    plan: review.plan,
    commit: review.commit,
    tier: review.plan === 'phase-level' ? 'phase-level' : 'per-dispatch',
    verdict: parseInt(parsed.fields.CRITICAL) > 0 ? 'block' :
             parseInt(parsed.fields.WARNINGS) > 0 ? 'warn' : 'pass',
    critical: parseInt(parsed.fields.CRITICAL) || 0,
    warning: parseInt(parsed.fields.WARNINGS) || 0,
    pass_rate: parsed.fields.PASS_RATE,
    one_liner: parsed.fields.ONE_LINER,
    findings: parsed.fields.FINDINGS,
    provider: 'codex-cli-reviewer',
    model: 'gpt-5.5',
    rerun: true,
    rerun_reason: 'self-test auth false-negative; original review skipped (architecture rule: provider-related backlog clearance requires actual evidence)',
  };
  fs.appendFileSync(out, JSON.stringify(row) + '\n', 'utf8');
  return row;
}

function appendClearance(review, evidenceRow) {
  const planning = PLANNING;
  return backlog.appendRow(planning, {
    id: review.backlog_id,  // same id supersedes
    kind: 'cleared',
    summary: `Cleared via post-hoc Codex review at ${review.out_jsonl} (rerun harness)`,
    resolved_at: new Date().toISOString(),
    resolved_by: 'super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs',
    evidence_path: review.out_jsonl,
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filter = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : null;

  const todo = filter ? REVIEWS.filter((r) => r.backlog_id === filter) : REVIEWS;
  console.log(`Rerunning ${todo.length} Codex reviews (dryRun=${dryRun}):`);

  let pass = 0, fail = 0;
  for (const review of todo) {
    const tag = `phase ${review.phase} ${review.plan}${review.commit ? ' (' + review.commit + ')' : ''}`;
    process.stdout.write(`  [${tag}] ... `);
    const prompt = buildPrompt(review);
    if (dryRun) { console.log(`would invoke codex (prompt ${prompt.length} bytes)`); continue; }
    const r = invokeCodex(prompt);
    if (r.exit !== 0) {
      console.log(`FAIL (exit ${r.exit})`);
      fail++; continue;
    }
    const parsed = parseContract(r.stdout);
    if (!parsed.ok) {
      console.log(`FAIL (contract parse — fields ${Object.entries(parsed.fields).filter(([k,v]) => v).map(([k]) => k).join(',')})`);
      fail++; continue;
    }
    const reviewRow = appendReviewRow(review.out_jsonl, review, parsed, r.stdout);
    const clearance = appendClearance(review, reviewRow);
    console.log(`PASS — verdict=${reviewRow.verdict} crits=${reviewRow.critical} warns=${reviewRow.warning} cleared=${clearance.id}`);
    pass++;
  }
  // Re-render markdown
  if (!dryRun && pass > 0) {
    backlog.writeRender(PLANNING);
    console.log(`\nRendered CRIT-BACKLOG.md. ${pass}/${todo.length} reviews completed.`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

if (require.main === module) main();
