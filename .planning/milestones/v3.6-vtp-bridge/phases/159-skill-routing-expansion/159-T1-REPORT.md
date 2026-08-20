**FILES_CHANGED**

- [sgsd-intent-classifier.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/hooks/sgsd-intent-classifier.cjs)
- [skill-routing-registry.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/skill-routing-registry.cjs)
- [assert-skill-routing-expansion.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs)

**VERIFICATION (RED preserved)**

- Test written before source changes.
- Initial and final focused runs failed loudly: `spawnSync node.exe EPERM`; behavioral RED/GREEN requires unsandboxed rerun.
- Registry self-test: 18 pass, 0 fail.
- Syntax, diff check, KB-shadow, direct copied-instance stdin, and P158 origin-gate probes passed.
- Independent review: no remaining Critical/Important findings.

**DEVIATIONS**

- No commit created, per instruction; otherwise none.

**BLOCKERS**

- Focused test and classifier self-test require orchestrator unsandboxed execution.

**ONE_LINER**

Matched routes emit only for locally resolved safe targets; unavailable matches stay silent and record one text-free decision.
