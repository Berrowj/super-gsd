# v3.7-upstream-hardening — Roadmap (seeded 2026-08-20)

Seeded from three operator-instance defect reports (Clarity/sku-master-engine and
devcp, 2026-08-20). Not yet active; awaits operator go.

## Phases

| Phase | Slug | Status | Depends on |
|-------|------|--------|------------|
| 160 | installer-registration-guard | [ ] seeded | — |

## Success criteria

1. install.sh can never register a hook path that does not exist at merge time.
2. Fresh clones ship current overlay text, not ByteRover-era instructions.
3. Vendored-older-super-gsd projects fail loud at install, not at first prompt.
