# Adversarial review: does the deferred install refusal weaken production?

Review ONE change for safety. Do not review anything else. Do not edit files.

## The change (super-gsd/install.sh)

In `distribute_project_hooks`, when Codex hook entries are missing, the immediate
`exit 1` was replaced with `CODEX_HOOK_DISTRIBUTION_INCOMPLETE=true`. The exit now
happens at the top of `register_codex_hooks`.

Call order in BOTH `init_local_project` (lines ~895-897) and `update_existing`
(lines ~993-995) is:

    distribute_project_hooks      <- refusal is now only recorded, not acted on
    repair_substrate_capability   <- RUNS `node <audit> --repair ...`, mutating state
    register_codex_hooks          <- refusal finally fires here

Before this change, an incomplete Codex hook distribution aborted the install BEFORE
`repair_substrate_capability` executed. After it, the repair runs first.

## The question you must answer with evidence from the code

1. Does `repair_substrate_capability` (install.sh ~line 432) plus the audit script it
   invokes (`super-gsd/tools/feature-propagation/audit.cjs`, `runAudit` with
   `repair: true`) perform ANY persistent mutation: writing settings.json, copying
   hooks, granting agent capability, editing overlays, touching ~/.claude or the
   project's .claude? Cite the exact functions and line numbers that write.
2. If yes, the change leaves a half-installed project on a path that previously
   refused cleanly: substrate repair applied, Codex hooks unregistered, exit 1.
   Say plainly whether that is a real safety regression or benign, and why.
3. Is there any path where `CODEX_HOOK_DISTRIBUTION_INCOMPLETE` is set but
   `register_codex_hooks` is never reached, so the install exits 0 despite an
   incomplete hook distribution? Check every caller and every early return between
   the two points, including `repair_substrate_capability` returning 1 and how that
   return is handled at the call sites (there is no `||` guard on lines 896 / 994).
4. Is the variable safe against a stale value leaking across the two call sites when
   both `--init-project` and `--update` run in one invocation?

## Constraint on your verdict

The motivation for the change was legitimate: guard case `vendored-nine-hook` requires
the installer to name EVERY missing registration, not just the first. Collecting all
refusals is the right behaviour. The question is only whether collecting them by
deferring past a mutating repair step is a safe way to achieve it.

If it is unsafe, state the minimal safer alternative in two or three sentences
(for example: collect refusals but exit before `repair_substrate_capability`, having
the witness-hook refusal emitted by a non-mutating check). Do not write the patch.

Verdict must be exactly one of: SAFE, UNSAFE, or SAFE-WITH-CAVEAT, on its own line.
Max 400 words.
