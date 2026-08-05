# ATC gap fix — plan 145-01 (2 CRITICAL + 2 WARNING findings)

Fresh SDD implementer, workspace-write. The per-dispatch ATC review found these
on the uncommitted P145 diff. Fix ALL FOUR. Read the finding locations first.

CRITICAL-1 [fail-open privilege escalation]: registry missing/corrupt falls
back to the WRAPPER default profile, not the REQUESTED one —
`codex-executor.sh --profile review` can resolve to executor/full-auto.
(profile-resolver.cjs:336,373; codex-executor.sh:159)
Required behavior: fail-open resolves the REQUESTED profile's built-in
defaults; if the requested name has no built-in, fail CLOSED to the read-only
`review` built-in (never escalate sandbox/approval on any failure path) and
log the resolution-log row with reason.

CRITICAL-2 [TTY guard bypass]: profile-resolver.cjs exposes `--set-cli`
without the TTY + exact-confirmation guard, so non-interactive callers can set
sandbox=danger-full-access / approval=full-auto directly, bypassing
sgsd-codex-control.sh. (profile-resolver.cjs:61,459,486,697)
Required behavior: enforce the danger guard IN THE RESOLVER for dangerous
field values (danger-full-access, trust/approval escalation): require an
explicit `--confirm "CONFIRM SGSD CODEX PROFILE <profile> <field> <value>"`
argument AND refuse when stdin/stdout are not TTYs unless
SGSD_CODEX_CONTROL_TTY_OK=1 is exported by sgsd-codex-control.sh after ITS
guard passed. Non-dangerous fields unchanged.

WARNING-1 [self-modification]: codex-executor.sh continues post-invocation
logic from its own mutable file after running workspace-write Codex. Mitigate
surgically: at script start, copy $0 to a mktemp path and re-exec from the
temp copy once (guard env var to prevent loop), so mid-run edits to the repo
copy cannot crash the running instance.

WARNING-2 [set-e finalize]: codex-exec.sh restores set -e before
finalize/report/log writes. Wrap the finalize block so any write failure still
reaches the explicit exit-code remapping (set +e around finalize, or || guards
on each write), and extend the self-test with a read-only-report-dir case if
feasible surgically.

Add/extend regression tests in the existing self-test surfaces for CRITICAL-1
(corrupt registry + requested profile → requested built-in, never executor)
and CRITICAL-2 (non-TTY --set-cli danger value → refusal, exit non-zero).
Re-run: profile-resolver self-test CLIs + run-self-test.cjs. Touch only files
already in the plan's allowed_files. No git commit.

End output with EXACTLY:
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED /
STATUS / ONE_LINER sections, then:
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 1/1
ONE_LINER: <repeat>
