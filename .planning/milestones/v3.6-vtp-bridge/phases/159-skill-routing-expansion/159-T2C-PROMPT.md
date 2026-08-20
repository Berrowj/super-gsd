# P159-T2 (dispatch 4) — WRITE THE EDITS; the orchestrator owns every spawn

Prior dispatches stalled on a misreading: the sandbox denies nested Node spawns,
so RUNNING the test harness is NOT your job. T1 (already committed) faced the same
constraint and correctly wrote all edits, verifying with node --check and static
assertions only; the orchestrator ran the spawn-bound suites unsandboxed after.
Do exactly that.

Your job in THIS run, in order:
1. Edit the four T2 files per task P159-T2 in `159-01-PLAN-LOCKED.md` (revision 2):
   - super-gsd/registry/skill-routing.yaml + session-governance-hooks.yaml: the
     seven availability-guarded anchored-lexical routes (/create-quote,
     /erp-resolve, /clarity-engines, /vtp-implementation-pack,
     /jcl-procurement-report, /vtp-html-explainer vs /diagram-design boundary),
     suggestion-tier low-risk, shadow-tier where wrong fires mislead,
     strong-positive-beats-verb tiering.
   - super-gsd/scripts/lib/skill-routing-registry.cjs: whatever loader/validation
     support the new rows need (compiled fallback updated equivalently).
   - super-gsd/hooks/sgsd-intent-classifier.cjs: wiring only if the rows need it.
2. Extend super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
   with the erp-vtp-skill-family case, INCLUDING an internal red path: a fixture
   registry WITHOUT the new rows must produce zero fires (this encodes the red
   permanently since the orchestrator applies your edits atomically).
3. Verify what the sandbox allows: node --check on every edited .cjs, YAML parse
   of both registries via the repo js-yaml, registry loader load (no spawns).
4. Report. Do NOT stop because spawnSync fails — that is expected and out of scope.

Report: FILES_CHANGED / VERIFICATION (static only, name each check) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 200 words.
