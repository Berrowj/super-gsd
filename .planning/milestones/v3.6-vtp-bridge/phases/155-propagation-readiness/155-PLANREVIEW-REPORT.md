FINDINGS: 9
CRITICAL: 5
WARNINGS: 4
PASS_RATE: 3/12
ONE_LINER: NOGO: boundaries and T4b→T4 ordering are correct, but production seams remain unfalsified.
VERDICT: NOGO
BOUNDARY_COMPLIANCE: PASS — no work-identity registry, alias map, renumbering, archiving, or new taxonomy resurfaces; the VTP service registry is unrelated.
ORDER_SAFE: NO — T4b correctly precedes T4, but T2 removes the legacy-root default before T3 makes consumers safe; merge T2+T3 atomically or execute T3 first.
AC_RISK: SAC-1, SAC-3–SAC-7, SAC-9–SAC-11
SPLIT_ADVICE: split — retain T1+(T2/T3)+T4b+T4 as propagation core; move T4c, T5, and T6 into state-close, VTP-readiness, and routing phases.
REQUIRED_CHANGES: 1) Make T2/T3 one atomic compatibility transition, or reverse their dependency. 2) Test all four T3 consumers against milestone and flat roots, v/decimal/integer names, canonical duplicates, absent roots, and mutation sentinels; `audit.cjs:167` itself excludes v/decimal names and supplies no realpath dedup. 3) Expand SAC-7 across higher-priority checkpoint/pulse/activity/git evidence, not only folder fallback. 4) Make SAC-1 execute the genuine Claude probes through a runnable gate. 5) Make SAC-9 run the real installer into an isolated home and execute the installed hook. 6) Define who creates phase `SUMMARY.md`, its passing shape and pre-close ordering, then test the actual close route. 7) Exercise T5 through automatic Rule 0 and manual readiness, not only its checker. 8) Correct the provenance note.

T4b’s fixture is genuinely devcp-shaped: flat, exactly 146/31, mixed schemes, three CONTEXT forms, inline comment, roadmap ordering, and an explicit ban on backward re-sync. Its weakness is that production’s pulse/activity/git readers remain integer-shaped unless separately covered.

Blast radius: T1 can remove or duplicate live hooks; its falsifier is partial because the command omits genuine Claude transport. T4 can feed stale state into dispatch and SessionStart; testing the repository hook does not prove installation replaced the live hook. T4c can deadlock every future close; atomic/idempotence tests catch write corruption, but not the absent SUMMARY producer or real orchestration wiring.

MUDA: no task is pure padding, but the plan overproduces one release unit. Three serial edits to `sgsd-orchestrate/SKILL.md` add extra processing, while artificial T4c→T5→T6 dependencies create inventory and waiting.

Provenance fails as written: the body claims 20 SACs and no frontmatter alteration; there are 12 SACs, and the quoted top-level `depends_on` values were an orchestrator edit. Nothing else in frontmatter appears orchestrator-authored.
tokens used
157,130
FINDINGS: 9
CRITICAL: 5
WARNINGS: 4
PASS_RATE: 3/12
ONE_LINER: NOGO: boundaries and T4b→T4 ordering are correct, but production seams remain unfalsified.
VERDICT: NOGO
BOUNDARY_COMPLIANCE: PASS — no work-identity registry, alias map, renumbering, archiving, or new taxonomy resurfaces; the VTP service registry is unrelated.
ORDER_SAFE: NO — T4b correctly precedes T4, but T2 removes the legacy-root default before T3 makes consumers safe; merge T2+T3 atomically or execute T3 first.
AC_RISK: SAC-1, SAC-3–SAC-7, SAC-9–SAC-11
