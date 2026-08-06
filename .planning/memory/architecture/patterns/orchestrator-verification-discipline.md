---
title: orchestrator verification discipline
tags: [verification, testing, orchestration, p146]
importance: 70
maturity: raw
created: 2026-08-06T23:29:55Z
---

# Pattern: Orchestrator Verification Discipline (learned the hard way in P146)

The orchestrator's own host-side checks were the weak link across v3.5 P146.
Independent Codex review caught a real defect in EVERY task; the orchestrator's
probes mostly confirmed shapes it had already been told about. Five
test-construction errors produced confident FAILs against working code.

## The five errors, and what each teaches

1. **Unescaped Windows paths in hand-written JSON.** `{"cwd":"C:\Users\..."}`
   fails `JSON.parse`; the hook received an empty payload and correctly returned
   silently. Diagnosed as a broken hook.
   → **Always build payloads with `JSON.stringify`.**

2. **Fixture missing `super-gsd/`.** A temp repo with only `.planning/` cannot
   load a registry that ships inside `super-gsd/`.
   → **Model the real deployment, not the minimum that compiles.**
   (This one did surface a genuine bug — the wrong-root resolution — so a wrong
   fixture is not always worthless, but it was luck, not method.)

3. **Bench `--record` pointing at a temp path while cwd was the repo.** The
   refusal was the bounded-write guard working correctly. Nearly filed a defect
   against a guard requested two tasks earlier.
   → **Before filing, ask whether the "failure" is a rule being enforced.**

4. **Substring-matching a JSON blob.** Grepping for `missing_plan` matched the
   schema KEY name, not a claim.
   → **Assert on parsed semantics, not on text presence.**

5. **Home-directory guard tested with a temp fixture.** `os.homedir()` does not
   point at the fixture, so the guard correctly did not fire.
   → **To test an environment-derived guard, redirect the environment**
   (`HOME`/`USERPROFILE` in the child process env).

## Systematic bias
The orchestrator tests the path it was just told about. Reviewers read the code
and probe the paths nobody mentioned. That is why review gates earn their cost
rather than duplicating orchestrator work — and why the orchestrator should
default to "is my fixture realistic?" before "is the code broken?"

## Practices that worked
- **Labelled corpus as acceptance bar.** For the classifier: 13 must-route and
  11 must-not-route prompts, with an explicit instruction that widening recall
  by lowering precision fails. Both halves graded.
- **Anti-stub fixtures.** Use values the code cannot guess (`v9.9`, phase `873`)
  and assert the REAL repo's values are ABSENT from the output. A fixture reusing
  the live milestone would pass against a hardcoded string.
- **Environment-failure matrix**, not just malformed input (see
  [[silent-success-reports-health]]).
- **Verify claimed blockers by stashing.** An executor reported adapter
  self-test failures as pre-existing; `git stash` + re-run showed 19/19 both
  with and without the change — the failures were sandbox artifacts.
