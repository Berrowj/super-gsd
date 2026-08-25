FILES_CHANGED: super-gsd/tools/feature-propagation/audit.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs (modified)  
FILES_CHANGED: super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-vtp-enrichment.md (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-board-researcher.md (modified)

VERIFICATION: `node --check super-gsd/tools/feature-propagation/audit.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0  
VERIFICATION: `node -e "require('./super-gsd/tools/feature-propagation/audit.cjs')"` -> exit 0

DEVIATIONS: none  
BLOCKERS: none  
ONE_LINER: Rollback now fails unless the first of two dirty documents commits, the second write fails, and both originals are byte-restored; restoration errors also throw. Policy coverage now fails on prompt-owned cap instructions or mechanics. Condensed duplicate no-cap/no-truncate wording and removed prompt-owned `16000`, `original_chars`, and `retained_chars` detail.
