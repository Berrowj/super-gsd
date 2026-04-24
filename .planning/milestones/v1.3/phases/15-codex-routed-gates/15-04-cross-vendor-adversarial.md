---
plan_id: 15-04
phase: 15
wave: 3
depends_on: [15-01]
deliverable: sgsd-orchestrate/SKILL.md Step 9.6 adversarial challenger → always-Codex when firing + skip-on-unavailable path (CODEX-11)
estimate_tokens: ~600
estimate_commits: 1
codex_deliverable: CODEX-11
vtp_citations: [doc:70a3d5757b6a]
---

# Plan 15-04: Cross-Vendor Adversarial Challenger

## Scope

Rewires the adversarial verifier challenger (Step 9.6 MACH-04) so that when
`Math.random() < config.atc.verifier_adversarial_rate (0.2)` fires, the challenger
uses Codex instead of the same-vendor Sonnet contrarian. The primary verifier stays
Claude Sonnet; only the challenger changes.

**SKILL.md serialization:** Wave 3. The executor MUST re-read
`super-gsd/skills/sgsd-orchestrate/SKILL.md` fresh at execution time. Plan 15-01
(Wave 2) will have already modified Steps 6.5 and 9.5. This plan touches Step 9.6
only — confirm the current line range of Step 9.6 by searching for `verifier_adversarial_rate`
or `MACH-04` before editing.

**Critical distinction:** Step 9.6 does NOT use `gates.resolveReviewerProvider`.
The adversarial challenger has its own routing rule (always the non-primary vendor).
It dispatches directly via the same `shellDispatch` helper introduced in 15-01,
but the provider selection logic is hardcoded in Step 9.6, not registry-driven.
This distinction must be explicitly documented in the SKILL.md edit.

## Tasks

<tasks>

<task id="T1">
### T1. SKILL.md Step 9.6 adversarial challenger → always-Codex routing

**Files:**
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (modify: Step 9.6, ~line 877-913)

**Action:**
Read `super-gsd/skills/sgsd-orchestrate/SKILL.md` fresh. Locate Step 9.6 by
searching for `verifier_adversarial_rate` or `Math.random()` in the file.
The current dispatch (~line 913) is:
```
Agent(subagent_type: "gsd-verifier", model: "sonnet", mode: "auto", prompt: challengerPrompt)
```

Replace this single call with the cross-vendor challenger dispatch per CONTEXT D-16/D-16a/D-17/D-18:

```javascript
// Step 9.6 MACH-04: adversarial verifier challenger
// Phase 15 CODEX-11: challenger is always the non-primary vendor (cross-vendor signal).
// VTP: doc:70a3d5757b6a (Shift-Up) — dual-vendor workflow at gate granularity.
// NOTE: This does NOT use gates.resolveReviewerProvider. Adversarial challenger
// routing is orthogonal to the gate-reviewer routing — it has its own rule:
// always dispatch to the non-primary vendor. This distinction is intentional.
if (Math.random() < config.atc.verifier_adversarial_rate) {
  const primary = 'claude-sonnet-verifier';  // Phase 15: primary verifier is always Claude
  const challengerProviderName = (primary === 'claude-sonnet-verifier')
    ? 'codex-cli-reviewer'   // Claude primary → Codex challenger
    : 'claude-sonnet-reviewer';  // Future-proofing: Codex primary → Claude challenger

  if (challengerProviderName === 'codex-cli-reviewer' &&
      (!config.review_providers.codex_enabled || codexAuthFailed)) {
    // Per CONTEXT D-17: if Codex unavailable, skip entirely.
    // Do NOT fall back to same-vendor challenger — that was the old behavior
    // and defeats the purpose of cross-vendor signal (D-17a).
    logDeviation('VERIFIER_ADVERSARIAL_SKIP: codex unavailable');
  } else {
    const challengerProvider = gates.getProvider(challengerProviderName);
    let challengerReport;

    if (challengerProvider.invocation === 'shell') {
      const promptFile = writeTempPrompt(challengerPrompt);
      const reportOut = tempReportPath('adversarial-verifier');
      const dispatchResult = shellDispatch(challengerProvider.shell_script, {
        promptFile,
        timeout: challengerProvider.timeout_seconds || config.review_providers.codex_timeout_seconds,
        reportOut,
        phase: currentPhase,
        step: '9.6-adversarial'
      });
      if (dispatchResult.exit === 0) {
        challengerReport = { content: dispatchResult.report, _provider: 'openai-codex' };
      } else {
        // Per D-17: skip on unavailability, no fallback
        logDeviation(`VERIFIER_ADVERSARIAL_SKIP: codex-exec.sh exit=${dispatchResult.exit}`);
      }
    } else {
      // Future: agent-type challenger
      challengerReport = await Agent({
        subagent_type: challengerProvider.agent_subagent_type,
        model: challengerProvider.agent_model || 'sonnet',
        mode: 'auto',
        prompt: challengerPrompt
      });
      challengerReport._provider = 'claude';
    }

    if (challengerReport) {
      // Token log per CONTEXT D-18: role "adversarial_verifier", provider "openai-codex"
      appendTokenLogRow({
        role: 'adversarial_verifier',
        provider: challengerReport._provider,
        model: challengerProvider.invocation === 'shell' ? 'codex' : (challengerProvider.agent_model || 'sonnet')
      });
      // Synthesise challenger verdict with primary verifier verdict
      synthesiseAdversarialVerdicts(primaryVerifierReport, challengerReport);
    }
  }
}
```

The challenger prompt (the contrarian header + primary verifier output) is UNCHANGED
per CONTEXT D-16 — only the dispatch mechanism changes. The existing prompt construction
at SKILL.md lines ~872-873 stays as-is.

**Verification:**
```bash
grep -n 'VERIFIER_ADVERSARIAL_SKIP' super-gsd/skills/sgsd-orchestrate/SKILL.md
grep -n 'codex-cli-reviewer' super-gsd/skills/sgsd-orchestrate/SKILL.md | grep -i 'step 9'
grep -n 'non-primary.vendor\|does NOT use gates.resolve' super-gsd/skills/sgsd-orchestrate/SKILL.md
# All must return hits
```

**Done:**
- `grep -c 'VERIFIER_ADVERSARIAL_SKIP' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 1.
- `grep -c 'adversarial_verifier' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 1. **(D-26 inv7)**
- The Step 9.6 block contains the comment `does NOT use gates.resolveReviewerProvider` or equivalent.
- The skip-on-unavailable path does NOT fall back to same-vendor challenger. **(CONTEXT D-17a)**

**Commit message:** `feat(15-04/T1): SKILL.md Step 9.6 cross-vendor adversarial challenger (CODEX-11)`
</task>

</tasks>

## Acceptance criteria

A1. `sgsd-orchestrate/SKILL.md` Step 9.6 dispatches via `shellDispatch` to `codex-cli-reviewer` when Codex is enabled. **(D-26 inv7)**
A2. Skip-on-unavailable path logs `VERIFIER_ADVERSARIAL_SKIP` and does NOT fall back to same-vendor Sonnet. **(CONTEXT D-17, D-17a)**
A3. Step 9.6 routing does NOT use `gates.resolveReviewerProvider` — it uses direct `gates.getProvider` with hardcoded challenger name. **(CONTEXT D-16a)**
A4. Token-log row for adversarial challenger uses `role: "adversarial_verifier"` and `provider: "openai-codex"`. **(CONTEXT D-18)**
A5. The adversarial rate `config.atc.verifier_adversarial_rate` is NOT modified (stays 0.2). **(CONTEXT D-16)**
A6. The contrarian prompt at lines ~872-873 is NOT modified. **(CONTEXT D-16)**

## Non-goals

- **No change to adversarial sampling rate** — 0.2 stays unchanged per CONTEXT D-16.
- **No Step 6.5/9.5 changes** — plan 15-01 owns those.
- **No sgsd-complete-milestone changes** — plan 15-05 owns that.
- **No --milestone-close-check subcommand** — plan 15-05 owns that.

## Evidence lineage

- CONTEXT decisions covered: **D-16, D-16a, D-17, D-17a, D-18**
- RESEARCH consumed: RQ5 (Step 9.6 current dispatch, routing rule, skip-on-unavailable, token-log entry)
- VTP cited: **doc:70a3d5757b6a (Shift-Up)** — dual-vendor workflow at gate granularity; the cross-vendor challenger applies the same principle Phase 15 tightens to per-gate level rather than per-phase level.
