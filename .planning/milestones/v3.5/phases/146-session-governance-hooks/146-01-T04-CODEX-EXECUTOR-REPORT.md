DONE

FILES_CHANGED: `super-gsd/hooks/sgsd-intent-classifier.cjs` (created); `super-gsd/registry/session-governance-hooks.yaml` (created); `.planning/metrics/gate-evidence.jsonl` (created, append-only)

VERIFICATION: `node --check super-gsd/hooks/sgsd-intent-classifier.cjs` → exit 0 ✓  
`positive/negative UserPromptSubmit matrix` → exit 0 ✓  
`neglected skill signature matrix` → exit 0 ✓  
`--bench --iterations 200 ... --record .planning/metrics/gate-evidence.jsonl` → exit 0 ✓ (`p95_ms=0.041`)  
`non-SGSD cwd silence probe` → exit 0 ✓  
`empty/garbage/null stdin probe` → exit 0 ✓  
`Select-String ... REGISTRY_RELATIVE_PATH` → exit 0 ✓  
`git diff --check -- ...` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: `super-gsd/hooks/sgsd-intent-classifier.cjs` | local lexical UserPromptSubmit classifier plus bench mode | stdin hook JSON or `--bench --iterations N --prompt TEXT --record .planning/metrics/gate-evidence.jsonl`

ONE_LINER: Added a registry-backed, no-LLM intent classifier that routes planning prompts to `/sgsd-triage`, suggests neglected SGSD skills, stays silent outside SGSD roots, and records canonical bench evidence via the T146-01 writer.

Registry swap line: `super-gsd/hooks/sgsd-intent-classifier.cjs:20 const REGISTRY_RELATIVE_PATH = 'super-gsd/registry/session-governance-hooks.yaml';`
