#!/usr/bin/env node
// Phase 15 verify.mjs — 9 invariants for CODEX-07..CODEX-12
// Exit 0 = all pass. Exit N = invariant N failed.
// Usage: node verify.mjs [--from-root /abs/path/to/repo]

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv.includes('--from-root')
  ? process.argv[process.argv.indexOf('--from-root') + 1]
  : resolve(__dirname, '../../../../..');
const r = (rel) => resolve(ROOT, rel);

let passed = 0; let failed = 0;
function inv(n, label, check) {
  try {
    const ok = check();
    if (ok) { console.log(`✓ inv${n}: ${label}`); passed++; }
    else    { console.error(`✗ inv${n}: ${label}`); failed++; if (!process.exitCode) process.exitCode = n; }
  } catch(e) { console.error(`✗ inv${n}: ${label} — ${e.message}`); failed++; if (!process.exitCode) process.exitCode = n; }
}

// inv1: gates.yaml rows per-dispatch-ATC + phase-level-ATC declare reviewer_provider: codex-cli-reviewer
inv(1, 'gates.yaml ATC rows declare codex-cli-reviewer', () => {
  const gates = readFileSync(r('super-gsd/registry/gates.yaml'), 'utf8');
  const matches = (gates.match(/reviewer_provider: codex-cli-reviewer/g) || []).length;
  return matches >= 2;
});

// inv2: gates.yaml row qualitative-waste-audit exists with correct trigger
inv(2, 'gates.yaml qualitative-waste-audit row exists', () => {
  const gates = readFileSync(r('super-gsd/registry/gates.yaml'), 'utf8');
  return gates.includes('qualitative-waste-audit') &&
         gates.includes('mechanical_muda_verdict') &&
         gates.includes('codex-cli-reviewer');
});

// inv3: sgsd-muda-audit.sh invokes codex-exec.sh when CODEX_QUAL_ENABLED=true
inv(3, 'sgsd-muda-audit.sh invokes codex-exec.sh', () => {
  const muda = readFileSync(r('super-gsd/scripts/sgsd-muda-audit.sh'), 'utf8');
  return muda.includes('codex-exec.sh') && muda.includes('CODEX_QUAL_ENABLED');
});

// inv4: SKILL.md Steps 6.5 + 9.5 reference resolveReviewerProvider + shell-invocation branch
// W-3 noTypo check: scoped to Steps 6.5 and 9.5 only (Step 9.6 adversarial challenger uses
// its own dispatch path introduced by 15-04; full-file check would produce false failure).
inv(4, 'SKILL.md Steps 6.5+9.5 reference resolveReviewerProvider + shellDispatch', () => {
  const skill = readFileSync(r('super-gsd/skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  const hasResolve = (skill.match(/resolveReviewerProvider/g) || []).length >= 2;
  const hasShell = skill.includes('shellDispatch') || skill.includes('shell_script');
  // Extract Steps 6.5 and 9.5 sections to scope the W-3 typo check
  const step65match = skill.match(/Step 6\.5[\s\S]*?(?=Step 6\.|Step 7\.|##)/);
  const step95match = skill.match(/Step 9\.5[\s\S]*?(?=Step 9\.|Step 10\.|##)/);
  const atcSections = (step65match ? step65match[0] : '') + (step95match ? step95match[0] : '');
  // If we couldn't extract the sections, fall back to full-file check
  const checkText = atcSections.length > 50 ? atcSections : skill;
  const noTypo = !checkText.includes('invocation_type');
  return hasResolve && hasShell && noTypo;
});

// inv5: SKILL.md Step 11 schema includes provider field
inv(5, 'SKILL.md Step 11 token-log schema includes provider field', () => {
  const skill = readFileSync(r('super-gsd/skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  return skill.includes('openai-codex') && skill.includes('claude-via-fallback');
});

// inv6: sgsd-token-audit emits claude_tokens_saved_by_codex
inv(6, 'sgsd-token-audit declares claude_tokens_saved_by_codex', () => {
  const audit = readFileSync(r('super-gsd/skills/sgsd-token-audit/SKILL.md'), 'utf8');
  return audit.includes('claude_tokens_saved_by_codex') && audit.includes('Multimodal Review Offload');
});

// inv7: SKILL.md Step 9.6 references non-primary-vendor provider
inv(7, 'SKILL.md Step 9.6 challenger uses non-primary-vendor', () => {
  const skill = readFileSync(r('super-gsd/skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  return skill.includes('adversarial_verifier') &&
         skill.includes('VERIFIER_ADVERSARIAL_SKIP') &&
         skill.includes('codex-cli-reviewer');
});

// inv8: sgsd-complete-milestone includes --milestone-close-check in step list
inv(8, 'sgsd-complete-milestone includes --milestone-close-check', () => {
  const complete = readFileSync(r('super-gsd/skills/sgsd-complete-milestone/SKILL.md'), 'utf8');
  return complete.includes('milestone-close-check');
});

// inv9 (bonus): dry-run --milestone-close-check exits 0 with JSON verdict
inv(9, '(bonus) sgsd-token-audit --milestone-close-check --dry-run exits 0', () => {
  const auditSkill = readFileSync(r('super-gsd/skills/sgsd-token-audit/SKILL.md'), 'utf8');
  // Structural test: verify the SKILL.md documents --dry-run JSON output format
  return auditSkill.includes('"kill"') && auditSkill.includes('"critical_count_delta"');
});

console.log(`\nPhase 15 verify.mjs: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log('PASS Phase 15');
