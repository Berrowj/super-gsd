# P158 planning task — author 158-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. You CANNOT spawn `claude` (EPERM); node works.

## Read first

1. `.planning/milestones/v3.6-vtp-bridge/phases/158-notification-routing/CONTEXT.md` —
   authoritative scope: origin gating for automated turns, three-direction falsifier
   (operator fires; notification skips with a WRITTEN text-free row; operator quoting
   notification text still fires).
2. `super-gsd/hooks/sgsd-intent-classifier.cjs` — the router: find its payload
   parsing, route evaluation entry, and ledger append sites (no_match row shape).
3. `.planning/metrics/route-decisions.jsonl` — locate the 2026-08-19 false-positive
   rows for the real automated-turn shape (structure only; keep text out of the plan).
4. `super-gsd/templates/plan-schema-v2.json`; P156/P157 plans as house style.

## Plan shape guidance

Likely ONE task (classifier gate + skip row + falsifier extensions to the existing
classifier test). Do not pad to two. The gate must be structural/origin-based at the
payload level, BEFORE route evaluation; a phrase blacklist that fails direction-3 of
the falsifier is a known-rejected approach (record it in known_deadends).
Existing classifier + KB-shadow self-tests must stay green and their commands appear
in verification_cmd. depends_on values are STRINGS.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/158-notification-routing/158-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 120 words.
