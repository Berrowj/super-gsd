# SGSD Codex Executor — Task P152-T2: KB-triage SHADOW classifier (text-free, fires nothing)

You are a serial SDD implementer. One task, bounded. Make ONLY the changes below.
Do not refactor unrelated code. Match existing style. This is SAFETY-CRITICAL:
the feature must inject NOTHING into any prompt and must NEVER write prompt text,
excerpts, or entity strings to disk.

## Progress contract (do this first and at each stage)
Append a line to `.planning/metrics/dispatch-progress.txt` at each stage:
`152-t2|<ISO-UTC>|started` now, then `edits-done`, `verifying`, `reporting`, `done`.

## Files you may touch (allowlist — no others)
1. `super-gsd/hooks/sgsd-intent-classifier.cjs`
2. `super-gsd/registry/session-governance-hooks.yaml`
3. `super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` (new)

## Context you must read first
- `super-gsd/hooks/sgsd-intent-classifier.cjs` in full. Note:
  - `CLASSIFIER_ENFORCEMENT_KINDS = ['directive','suggestion']` (line ~41) — the
    INJECTING kinds. Do NOT add `shadow` to this array.
  - `validateRouteShape` (~220): `directive`/`suggestion` branch, a `report_only`
    branch (classifierUsable:false), then `enforcement_kind_unknown` fallback.
  - `matchesRoute` (~415): shared matcher where an exclusion HIT returns false
    BEFORE triggers — i.e. exclusion beats trigger. This is the OPPOSITE of what
    the shadow route needs. DO NOT reuse `matchesRoute` for shadow evaluation.
  - `parseRegistryYaml` (~144) is GENERIC: any nested key under a route section
    (trigger/predicate/enforcement) passes through. New keys like
    `strong_kb_regexes`, `exclude_start_verbs` need NO parser change.
  - `emitClassification` (~490) is the injection path. `safeStdout` is the only
    thing that reaches the model. Shadow eval must NEVER call safeStdout.

## Change 1 — constants (top of classifier, near line ~42)
Add:
```js
const KB_TRIAGE_SHADOW_SIGNAL = 'kb_triage_shadow';
const KB_TRIAGE_MATCHER_VERSION = 'kb-shadow-v1';
```

## Change 2 — validateRouteShape: add a `shadow` branch
Insert BEFORE the `enforcement_kind_unknown` fallback (after the `report_only`
branch). Contract:
```js
if (kind === 'shadow') {
  const triggerCount = nonEmptyStrings(trigger.phrases).length
    + validRegexStrings(trigger.regexes).length
    + nonEmptyStrings(trigger.strong_kb_phrases).length
    + validRegexStrings(trigger.strong_kb_regexes).length;
  const signal = typeof enforcement.signal === 'string' ? enforcement.signal.trim() : '';
  const directive = typeof enforcement.directive === 'string' ? enforcement.directive.trim() : '';
  if (triggerCount === 0) reasons.push('shadow_trigger_missing');
  if (signal !== KB_TRIAGE_SHADOW_SIGNAL) reasons.push('shadow_signal_invalid');
  if (directive) reasons.push('shadow_directive_forbidden'); // shadow MUST NOT inject
  return { route, id: id || null, usable: reasons.length === 0, classifierUsable: false, reason_codes: reasons };
}
```
Because `classifierUsable:false`, `readCompatibilityRegistry` already excludes it
from the injected `kind==='directive'` set. Good — leave that filter as-is.

## Change 3 — shadow matcher + evaluator (NEW functions, isolated)
Add a tiered, subordinate-exclusion matcher and a fire-and-forget evaluator. The
rule (board + Codex challenge, non-negotiable):
- A STRONG KB positive (`trigger.strong_kb_phrases` / `trigger.strong_kb_regexes`)
  → MATCH, overriding any verb exclusion.
- Otherwise a WEAK positive (`trigger.phrases` / `trigger.regexes`) → MATCH ONLY IF
  no START-ANCHORED verb in `predicate.exclude_start_verbs` opens the prompt.
- No positive at all → NO match.
```js
function startAnchoredVerbHit(prompt, verbs) {
  const vs = nonEmptyStrings(verbs);
  if (vs.length === 0) return false;
  const re = new RegExp('^\\s*(?:' + vs.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
  return re.test(prompt);
}
function matchesShadowRoute(route, prompt, root, payload) {
  if (!route || !prompt.trim()) return false;
  const trigger = route.trigger || {};
  const predicate = route.predicate || {};
  const strong = phraseHit(prompt, trigger.strong_kb_phrases)
    || regexHit(prompt, trigger.strong_kb_regexes, root, payload);
  if (strong) return true; // strong KB positive OVERRIDES verb exclusion
  const weak = phraseHit(prompt, trigger.phrases)
    || regexHit(prompt, trigger.regexes, root, payload);
  if (!weak) return false;
  if (startAnchoredVerbHit(prompt, predicate.exclude_start_verbs)) return false;
  return true;
}
```
Evaluator — reads the yaml registry directly, filters USABLE shadow routes, and
for each match appends ONE text-free row. TEXT-FREE means: the row contains ONLY
the fields below; it must NEVER contain the prompt, any substring/`.match()`
capture, or any entity name. Use `crypto.randomUUID()` for the opaque decision_id.
`matched_signature_ids` are ROUTE IDS ONLY (e.g. `route.id`) — never captured text.
```js
function kbTriageShadowLedgerPath(root) {
  return path.resolve(root, '.planning', 'metrics', 'kb-triage-shadow.jsonl');
}
function evaluateShadowRoutes(root, payload, prompt) {
  try {
    const started = performance.now();
    const registry = parseRegistryYaml(fs.readFileSync(REGISTRY_SOURCE_PATH, 'utf8'));
    const all = Array.isArray(registry.routes) ? registry.routes : [];
    const shadowRoutes = all.filter((r) => {
      const v = validateRouteShape(r);
      return v.usable && r.enforcement && r.enforcement.kind === 'shadow';
    });
    const matched = shadowRoutes.filter((r) => matchesShadowRoute(r, prompt, root, payload));
    if (matched.length === 0) return;
    const latency_ms = Number((performance.now() - started).toFixed(3));
    const crypto = require('crypto');
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      decision_id: crypto.randomUUID(),
      matcher_version: KB_TRIAGE_MATCHER_VERSION,
      matched_signature_ids: matched.map((r) => r.id).filter(Boolean),
      soft_path_action: 'would_route_vtp_query_triage',
      latency_ms,
      operator_label: null,
    }) + '\n';
    fs.appendFileSync(kbTriageShadowLedgerPath(root), line);
  } catch {
    // fire-and-forget: shadow eval must NEVER throw or affect the injection path
  }
}
```

## Change 4 — wire into emitClassification (fire-and-forget)
Inside `emitClassification`, AFTER the prompt-empty guard and registry/route
computation, add a call that can never affect stdout or the return value:
```js
try { evaluateShadowRoutes(root, payload, prompt); } catch { /* never blocks */ }
```
Place it so it runs even when `mandatory`/`suggestions` are empty. It must NOT
change what `safeStdout` emits.

## Change 5 — the yaml route (session-governance-hooks.yaml)
Append a new route (2-space indent for `- id:`, 4 for sections, 6 for keys, 8 for
list items — match the file's existing style exactly):
```yaml
  - id: kb-lookup-triage
    trigger:
      strong_kb_phrases:
        - "last meeting with"
        - "knowledge base"
      strong_kb_regexes:
        - "what did .+ (say|think|mean|decide)"
        - "(the|my|our|last|latest|recent) meeting (with|about|on)"
        - "look at .*(meeting|call|corpus|transcript|knowledge base|kb)\\b"
        - "import .*(meeting|transcript|recording|brief)"
        - "\\b(jcl|clarity)\\b .*(meeting|note|record|corpus)"
      phrases:
        - "meeting"
        - "corpus"
      regexes:
        - "\\bmeetings?\\b"
    predicate:
      exclude_start_verbs:
        - "build"
        - "fix"
        - "run"
        - "test"
        - "file"
    enforcement:
      kind: shadow
      signal: kb_triage_shadow
```

## Change 6 — self-test file + extend classifier --self-test
Create `super-gsd/tests/kb-triage-shadow/assert-shadow.cjs`. It must
`require` the classifier module and assert, using a temp planningDir (mkdtemp):
1. `matchesShadowRoute` on "what did ada say about fixing the customs flow" → true
   (strong KB positive beats the 'fix' verb).
2. On "fix the failing test" → false (no KB positive; start-verb 'fix').
3. On "last meeting with Ada Lovelace" → true.
4. On "build the auth module" → false.
5. On "import the last meeting i had with ada" → true.
6. Run the FULL classifier on a matching prompt (via emitClassification with a
   captured stdout) and assert ZERO bytes were emitted to stdout by shadow eval
   (shadow injects nothing). If emitClassification is hard to intercept, assert
   that `evaluateShadowRoutes` wrote a row AND that the row JSON, when
   `JSON.stringify`'d, contains NONE of: the word "ada", "customs", "flow", or
   any prompt substring — i.e. grep the row for prompt text and assert absent.
7. Assert the written ledger row has EXACTLY the keys
   {ts, decision_id, matcher_version, matched_signature_ids, soft_path_action,
   latency_ms, operator_label} and no others; operator_label === null.
Export the new functions from the classifier module
(`matchesShadowRoute`, `evaluateShadowRoutes`, `kbTriageShadowLedgerPath`,
`KB_TRIAGE_MATCHER_VERSION`) so the test can import them.

Also extend the classifier's internal `selfTest()` with at least one assertion
that the kb-lookup-triage route is present and validates as kind `shadow`
(classifierUsable === false), and that "fix the failing test" does not match it.

## Verification (must pass; run before reporting)
- `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` → exit 0
- `node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test` → exit 0, 0 fail
- `node -e "require('./super-gsd/hooks/sgsd-intent-classifier.cjs')"` → no throw
- Confirm the global VTP skill is NOT touched (you may not edit outside the allowlist).

## Report (SGSD contract, <300 words)
FILES_CHANGED, VERIFICATION (each cmd → exit), DEVIATIONS, BLOCKERS,
SCRIPTS_CREATED, ONE_LINER.
