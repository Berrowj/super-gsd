# Phase-level ATC — P168 Install Contract. Read-only, do not edit.

Apply the ATC 7 steps and the 10-point anti-slop checklist to the WHOLE phase.
Scope: commits `c01baa7`..HEAD on branch luminaria-hogback.

Read the locked plan (revision 2) and check delivery against it.

## Given results, do not re-run

install-contract 5/5, installer-registration-guard 13/13, real install exits 0 delivering
17 hooks and 9 modules, doctor reports real HEAD and freshness, P167 38/38 and 4/4,
T2 13/13, T4 pass, P166 6/6, P154, composer, enrichment-gate, kb-triage-shadow,
feature-propagation 15/15, bash -n clean. Spec-compliance PASS for both T1 and T2.

## This phase has a difficult history. Judge it.

- One executor dispatch built a 1,458-line transactional installer sandbox
  (`*-installer-stage` modes, self re-execution, whole-user-root snapshots) that ended with
  `install.sh` exiting 0 while delivering nothing. It was reverted wholesale and is
  retained as `168-ABANDONED-STAGED-INSTALLER.patch`.
- Three dispatches were killed mid-implementation.
- Four defects reached committed production code and were repaired in-phase.

Judge specifically:

1. Is the delivered design SIMPLER than what was reverted, and is it the minimum that
   solves the problem? Point at anything that is still more machinery than needed.
2. Orphans and dead code: does every new export have a caller? Is anything left over from
   the reverted branch? Check `hook-install-contract.cjs` exports in particular.
3. Is the dependency closure genuinely computed from source with no hand-maintained module
   or package list anywhere, production or test?
4. Refuse-before-write: confirm no rejection-capable step runs after the first destination
   write, on any entry point. This class has appeared four times in this codebase.
5. Are the two retained patches (`168-ABANDONED-STAGED-INSTALLER.patch`,
   `168-SPECFIX-WIP.patch`) justified evidence, or clutter that should be deleted?
6. Guard assertions: were any weakened across the phase without a stated replacement?

Score /10 on the anti-slop checklist. List findings by severity (CRITICAL / MAJOR / MINOR)
with file:line. End with exactly `ATC VERDICT: PASS` or `ATC VERDICT: FAIL`.
A CRITICAL forces FAIL. Bound yourself to about 18 shell commands and emit the verdict even
if incomplete. Max 500 words.

## ROUND 2 — confirm the round-1 findings are closed. HEAD has moved.

Round 1 returned FAIL 5/10 with one CRITICAL and two MINORs. Three commits since:

- `4bd7eb3`: capability precheck mirrors repair flags on every entry point; Codex precheck
  covers init/update/global-with-project, all before publish_project_install_contract;
  runAudit runs shared read-only capability detection before publishProjectHookInstall;
  the guard now INVENTORIES rejection-capable calls explicitly and fails if any, or a new
  one, is reachable after the first destination write.
- `88207e0`: the two orphan exports removed; the refusal case now proves the criterion as
  written (preinstall sentinel absent, actions empty, bytes identical).
- `168-SPECFIX-WIP.patch` deleted per your MINOR; `168-ABANDONED-STAGED-INSTALLER.patch`
  retained as you judged defensible.

Confirm each:

1. CRITICAL: no rejection-capable step reachable after the first destination write, on
   install.sh entry points AND the audit.cjs direct path. Judge the new guard inventory:
   is it behaviour-based enough that a future rejecting function added after publication
   fails the guard, or can it be evaded the way the name matching was?
2. MINOR orphan exports: removed, nothing re-widened.
3. MINOR patches: WIP deleted, abandoned retained.

Also re-score the anti-slop checklist. Round 1 scored 5/10 citing orphan exports, the
dual workflow, WIP clutter, complexity and YAGNI. The dual in-process/CLI workflow remains
by design; judge whether it is now justified or still excess.

Orchestrator-run at HEAD, take as given: real install exits 0 delivering 17 hooks and
9 modules; install-contract 5/5; guard 13/13; audit self-test 15/15; bash -n clean.

Verdict line unchanged. Bound to ~15 shell commands. Max 400 words.
