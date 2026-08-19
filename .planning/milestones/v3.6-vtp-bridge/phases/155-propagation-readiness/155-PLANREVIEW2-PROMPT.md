# P155 plan re-review, round 2 — verify the NOGO changes landed. NARROW scope.

Read only. You returned NOGO on rev 1 with REQUIRED_CHANGES 1-8. Changes 6 and 7
moved to carved-out phases 156/157 by operator decision; change 8 was fixed by the
orchestrator. Verify ONLY the surviving changes (1,2,3,4,5) against rev 2 of
`.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md`.

For each: ADDRESSED / PARTIAL / NOT, with the specific task/AC text you relied on.
1. T2/T3 one atomic transition, AC runs consumers against no-legacy-root AND both-roots projects.
2. Full consumer test matrix + ONE shared name-parsing helper across resolver, four consumers, audit.cjs (its /^\d{2}-/ at line 167 is the verified bug).
3. T4 SACs cover checkpoint/pulse/activity/git tiers (v-scheme fixtures or explicit abstention).
4. Overlay SAC executes genuine Claude transport via assert-live-dispatch.cjs modes.
5. Installer SAC runs real install.sh into an isolated HOME and executes the installed hook.

Do not re-litigate settled points (boundaries, T4b-before-T4, the split). Fresh CRITICALs
only if rev 2 INTRODUCED a defect.

Output, contract lines first, then max 250 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
CHANGE_1: ADDRESSED|PARTIAL|NOT — <evidence>
CHANGE_2: ADDRESSED|PARTIAL|NOT — <evidence>
CHANGE_3: ADDRESSED|PARTIAL|NOT — <evidence>
CHANGE_4: ADDRESSED|PARTIAL|NOT — <evidence>
CHANGE_5: ADDRESSED|PARTIAL|NOT — <evidence>
NEW_DEFECTS: none | <list>
```
