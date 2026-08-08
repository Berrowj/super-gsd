# P149-T1-fix — alias gsd-secure-phase instead of omitting

ONE fix in super-gsd/registry/skill-routing.yaml only. Review CRIT: the gsd-secure-phase row (~line 389) marks availability: omitted with reason legacy_security_governance_unregistered, but edge-guard governance IS registered (super-gsd/registry/command-envelope-v1.yaml:63). Per the Registry Content Contract, convert the row to an alias to the registered edge-guard/security governance path, matching the shape of the other alias rows in the same file. Change nothing else. Then re-run the field-check verification command and report.

## Report contract
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
