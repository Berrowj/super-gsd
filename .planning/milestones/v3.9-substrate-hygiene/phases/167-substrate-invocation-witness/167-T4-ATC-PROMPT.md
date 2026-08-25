# P167-T4 per-dispatch ATC, GATE tier

Read only. Spec compliance passed at 7/8 with its CRITICAL closed and its last
warning fixed, so correctness is settled. Judge whether this is the right amount
of code and whether any of it is slop.

## The unit

`.../167-T4-FULL-DIFF.patch` (386d027 to HEAD), covering the T4 build and four
fix rounds. Plan `.../167-01-PLAN-LOCKED.md`, task `P167-T4`. Live tree at HEAD.

Files: `config/repo-settings-overlay.json`, `config/hook-manifest.json`,
`scripts/merge-settings.js`, `install.sh`, `tools/feature-propagation/audit.cjs`,
`tools/substrate-capability-broker.cjs` (authorized eighth file),
`tests/substrate-invocation-witness/assert-propagation.cjs`,
`tests/installer-registration-guard/assert-installer-registration-guard.cjs`.

## Apply the 7 steps and the 10-point checklist

1. First principles. Is each piece needed?
2. Delete. Target 10 percent.
3. Simplify. This task grew through four fix rounds, which is where sediment
   collects. Is the repair path in `audit.cjs` one coherent sequence, or several
   overlapping guards that each solved one review finding?
4. Accelerate. The repair path now provisions a key, refreshes runtime, merges
   and re-audits both hook events, archives upstreams, replaces scopes, and
   derives grants. Any redundant IO or repeated scan?
5. Automate. Only what survived 1 to 4.
6. Validate. 7-point.
7. Checklist, one at a time: 1 callers exist; 2 imports used; 3 parameters read;
   4 could be less code; 5 abstractions justified; 6 existing code does 80
   percent; 7 senior engineer would mass-delete; 8 delta complexity at or below
   zero; 9 just-in-case additions; 10 does ONE thing.

## Specific suspicions

- Four fix rounds landed here: a scoping repair, a sort-order repair, the
  invocation-authority rebind, and a false-pass test repair. Look for two
  mechanisms doing one job, and for comments describing behaviour that the
  rebind made untrue.
- `install.sh` and `merge-settings.js` are shared installer surfaces. Are the
  additions genuinely additive and idempotent, or do they assume a fresh
  install?
- `withdraw all four grants at repair entry, re-derive after audits` was added
  unprompted. Is it correct, and does it leave a window where a legitimate
  install is briefly grantless in a way that matters?
- P166's ATC found dead residue, a malformed literal, and a test copying the
  production tree. Check all three classes.
- The plan under-claims deliberately per an operator ruling. Check no comment or
  error string implies protection against a same-user actor with Bash and Write.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
DELETABLE_LINES: <int estimate>
DELTA_COMPLEXITY: <negative | zero | positive, one line>
PASS_RATE: <n>/10
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

FAIL only for a real defect or genuine slop. Max 250 words after the contract
lines.
