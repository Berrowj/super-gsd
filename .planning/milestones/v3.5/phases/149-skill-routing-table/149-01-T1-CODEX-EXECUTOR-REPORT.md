FILES_CHANGED: `super-gsd/registry/skill-routing.yaml` (created)

VERIFICATION: `node -e "<js-yaml schema/field check>"` -> exit 0 (`skill-routing rows=24`); `node -e "<inventory coverage check>"` -> exit 0 (`inventory coverage ok`)

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Created the single top-level `routes` registry covering required canonical, alias, omitted, scheduled, cooldown, and gate-ref skill-routing decisions without duplicating gate predicates.

STATUS: DONE
