# SGSD Codex Executor — Task P152-T2-FIX: address spec-review NOGO (measurement-instrument findings)

Serial SDD implementer. One task, bounded, surgical. The shadow classifier is
SAFE and correct (spec checks 1–5 passed: no injection, text-free, correct
tiering, correct scope). Do NOT change that behavior. Fix only the three
measurement/ATC findings below. Do NOT add a hard gate, alias, or any prompt text
to telemetry. Do NOT weaken any existing assertion.

## Progress contract (first + each stage)
Append to `.planning/metrics/dispatch-progress.txt`:
`152-t2fix|<ISO-UTC>|started` then `edits-done`, `verifying`, `reporting`, `done`.

## Files you may touch (allowlist)
1. `super-gsd/hooks/sgsd-intent-classifier.cjs`
2. `super-gsd/tests/kb-triage-shadow/assert-shadow.cjs`

## FIX 1 — remove the double parse of the governance yaml (hot path) + valid latency
Today `readCompatibilityRegistry` parses `SESSION_GOVERNANCE_REGISTRY_PATH` and then
`evaluateShadowRoutes` parses the SAME file AGAIN in the same process — overhead on
EVERY prompt (the hook runs on every UserPromptSubmit).
- Add a tiny process-level cache that parses the governance yaml at most once per
  (path, mtimeMs). Example:
  ```js
  let _govRegistryCache = null; // { key, parsed }
  function readGovernanceRegistryCached() {
    const p = REGISTRY_SOURCE_PATH;
    let key;
    try { key = p + ':' + fs.statSync(p).mtimeMs; } catch { key = p + ':nostat'; }
    if (_govRegistryCache && _govRegistryCache.key === key) return _govRegistryCache.parsed;
    const parsed = parseRegistryYaml(fs.readFileSync(p, 'utf8'));
    _govRegistryCache = { key, parsed };
    return parsed;
  }
  ```
- Use `readGovernanceRegistryCached()` in BOTH `readCompatibilityRegistry` (replace its
  `parseRegistryYaml(fs.readFileSync(file,...))`) and `evaluateShadowRoutes`. Preserve
  existing failure-row behavior (registry_unparsed/registry_empty/registry_unavailable):
  keep those code paths working against the cached parse.
- Make `latency_ms` honest: set the start timestamp at the VERY FIRST line of
  `evaluateShadowRoutes`, and compute `latency_ms` immediately BEFORE the
  `fs.appendFileSync` call (so it includes the cached-parse lookup, match, uuid
  creation, and JSON.stringify — the reviewer's gap). The append syscall itself
  cannot be inside its own row; that is acceptable and intended.

## FIX 2 — collapse the redundant double try/catch
`evaluateShadowRoutes` already wraps its whole body in try/catch (fire-and-forget),
yet the call site in `emitClassification` wraps it in ANOTHER try/catch. Ensure the
ENTIRE body of `evaluateShadowRoutes` (including the start timestamp) is inside its
own try so it can never throw, then remove the redundant outer wrapper at the call
site — call `evaluateShadowRoutes(root, payload, prompt);` directly (still positioned
so it runs even when mandatory/suggestions are empty and can never alter stdout/return).

## FIX 3 — stronger precedence tests (assert-shadow.cjs)
Add assertions proving the tiering's precedence explicitly:
- "fix - what did ada say about the last meeting" → MATCHES (starts with the `fix`
  verb BUT a STRONG KB positive overrides the start-anchored exclusion).
- "fix the meeting notes" → does NOT match (starts with `fix`, only a WEAK positive
  `meeting`; the start-anchored verb suppresses it).
Keep ALL existing assertions. Do NOT remove `evaluateShadowRoutes` (or any symbol)
from `module.exports` — the test imports it; the earlier review's "unnecessarily
exported" note was incorrect.

## Verification (must pass before reporting)
- `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` → exit 0
- `node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test` → exit 0, 0 fail
- `node -e "require('./super-gsd/hooks/sgsd-intent-classifier.cjs')"` → no throw
- Confirm the governance yaml is parsed at most once per prompt (grep that
  `evaluateShadowRoutes` no longer calls `parseRegistryYaml`/`readFileSync` directly
  but goes through `readGovernanceRegistryCached`).

## Report (SGSD contract, <250 words)
FILES_CHANGED, VERIFICATION (each cmd → exit), DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER.
