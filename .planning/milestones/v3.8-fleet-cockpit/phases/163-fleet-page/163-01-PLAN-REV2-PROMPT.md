# P163 planning revision — NOGO round 1, two required changes

You are the planner revising your own 163-01-PLAN-LOCKED.md IN PLACE (bump
revision to 2, note the review provenance in the body). No source changes.

Review verdict (163-PLANREVIEW-REPORT.md): NOGO. Everything else passed;
exactly two SAC paths are stub-satisfiable and must become
production-invoking:

1. The rail-render SAC must prove the PRODUCTION rail renderer calls
   compareLaneRows and emits every lane with status, headline, and age — the
   current split lets the comparator pass unit tests while the renderer
   ignores it and renders an empty rail. Require extracting/invoking the real
   render function against fixture fleet data and asserting per-lane output.
2. The formatter/conflict SACs must EXECUTE the production formatter and
   conflict renderer and assert actual fixture-specific strings: the No-data
   rendering distinct from 0 with distinct classes; the conflict branch
   emitting BOTH effective and STATE milestone/phase values plus source and
   confidence.

Keep every other SAC, the 2-task split, hard constraints, manual-check
classification, and the hard stop exactly as reviewed.

Validate before finishing:
    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.8-fleet-cockpit/phases/163-fleet-page/163-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 100 words.
