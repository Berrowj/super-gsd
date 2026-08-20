PATCH_BEGIN
diff --git a/super-gsd/registry/skill-routing.yaml b/super-gsd/registry/skill-routing.yaml
index 9a2e2d1..222927a 100644
--- a/super-gsd/registry/skill-routing.yaml
+++ b/super-gsd/registry/skill-routing.yaml
@@ -352,3 +352,42 @@ routes:
     availability: alias
     notes: Legacy secure-phase requests route to existing SGSD security review and registered edge-guard governance.
+
+  - skill: clarity-engines
+    signatures:
+      regexes:
+        - '^\s*(?:look\s+up|find|query|search)\b(?=[^\r\n]{0,180}\b(?:clarity|rag)\b)(?=[^\r\n]{0,180}\b(?:engines?|retrieval|index|sources?)\b)[^\r\n]{1,180}$'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    notes: Suggest the installed Clarity engine skill only for an anchored engine or RAG lookup.
+
+  - skill: vtp-html-explainer
+    signatures:
+      regexes:
+        - '^\s*(?:create|make|draft|build|write|turn)\b[^\r\n]{0,140}\b(?:html\s+explainer|visual\s+explainer|diagrammed\s+report)\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    notes: Suggest the installed HTML explainer for an explicitly explainer-shaped request.
+
+  - skill: diagram-design
+    signatures:
+      regexes:
+        - '^\s*(?![^\r\n]{0,160}\b(?:html|explainer|diagrammed\s+report)\b)(?:create|make|draft|draw|design)\b[^\r\n]{0,140}\b(?:diagram|architecture\s+map|flowchart)\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    notes: Suggest the installed diagram skill for diagram requests that are not HTML-explainer requests.
diff --git a/super-gsd/registry/session-governance-hooks.yaml b/super-gsd/registry/session-governance-hooks.yaml
index b974c96..791620b 100644
--- a/super-gsd/registry/session-governance-hooks.yaml
+++ b/super-gsd/registry/session-governance-hooks.yaml
@@ -72,3 +72,89 @@ routes:
     enforcement:
       kind: shadow
       signal: kb_triage_shadow
+
+  - id: erp-vtp-create-quote
+    trigger:
+      strong_regexes:
+        - "^\\s*(?:create|draft|prepare|make)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:(?:jcl|sap)\\s+){0,2}(?:quote|quotation)\\b"
+      phrases:
+        - "jcl quote"
+        - "sap quote"
+        - "customer quotation"
+      regexes:
+        - "\\b(?:quote|quotation)\\b[^\\r\\n]{0,80}\\b(?:customer|opportunity|schedule|line items?)\\b"
+    predicate:
+      exclude_start_verbs:
+        - "create"
+        - "draft"
+        - "prepare"
+        - "make"
+        - "build"
+        - "fix"
+        - "test"
+    enforcement:
+      kind: shadow
+      signal: skill_family_shadow
+      target: "/create-quote"
+      action: would_route_create_quote
+
+  - id: erp-vtp-record-resolution
+    trigger:
+      strong_regexes:
+        - "^\\s*(?:resolve|match|identify|find)\\b[^\\r\\n]{0,120}\\b(?:erp|sap)\\b[^\\r\\n]{0,120}\\b(?:record|customer|vendor|opportunity|order|quote)\\b"
+      phrases:
+        - "erp record"
+        - "sap record"
+        - "record resolution"
+      regexes:
+        - "\\b(?:erp|sap)\\b[^\\r\\n]{0,80}\\b(?:record|customer|vendor|opportunity|order)\b"
+    predicate:
+      exclude_start_verbs:
+        - "resolve"
+        - "match"
+        - "identify"
+        - "find"
+        - "build"
+        - "fix"
+        - "test"
+    enforcement:
+      kind: shadow
+      signal: skill_family_shadow
+      target: "/erp-resolve"
+      action: would_route_erp_resolve
+
+  - id: erp-vtp-meeting-import
+    trigger:
+      strong_regexes:
+        - "^\\s*(?:import|ingest|convert|turn)\\b[^\\r\\n]{0,120}\\b(?:meeting|call|transcript|recording)\b[^\\r\\n]{0,120}\\b(?:vtp|implementation\\s+pack)\b"
+        - "^\\s*(?:import|ingest)\\b[^\\r\\n]{0,80}\\b(?:last|latest|recent)\\s+(?:meeting|call|transcript)\b"
+      phrases:
+        - "meeting import"
+        - "implementation pack"
+        - "import the meeting"
+    predicate:
+      exclude_start_verbs:
+        - "import"
+        - "ingest"
+        - "convert"
+        - "turn"
+        - "build"
+        - "fix"
+        - "test"
+    enforcement:
+      kind: shadow
+      signal: skill_family_shadow
+      target: "/vtp-implementation-pack"
+      action: would_route_vtp_implementation_pack
+
+  - id: erp-vtp-procurement-status
+    trigger:
+      strong_regexes:
+        - "^\\s*(?:show|check|get|report|summarize|what(?:'s| is))\\b[^\\r\\n]{0,120}\\b(?:jcl\\s+)?procurement\b[^\\r\\n]{0,80}\\b(?:status|report|progress|position)\b"
+      phrases:
+        - "jcl procurement"
+        - "procurement status"
+        - "procurement report"
+    predicate:
+      exclude_start_verbs:
+        - "show"
+        - "check"
+        - "get"
+        - "report"
+        - "summarize"
+        - "build"
+        - "fix"
+        - "test"
+    enforcement:
+      kind: shadow
+      signal: skill_family_shadow
+      target: "/jcl-procurement-report"
+      action: would_route_jcl_procurement_report
diff --git a/super-gsd/scripts/lib/skill-routing-registry.cjs b/super-gsd/scripts/lib/skill-routing-registry.cjs
index 070012f..bc7b364 100644
--- a/super-gsd/scripts/lib/skill-routing-registry.cjs
+++ b/super-gsd/scripts/lib/skill-routing-registry.cjs
@@ -224,6 +224,21 @@ const COMPILED_FALLBACK_ROWS = Object.freeze([
     phrases: ['gsd-secure-phase', 'secure phase', 'security phase', 'phase security review'],
   }, { aliases: ['gsd-secure-phase'], availability: 'alias' }),
+  fb('clarity-engines', 'prompt-time', ['manual', 'semi', 'auto'], {
+    regexes: ['^\\s*(?:look\\s+up|find|query|search)\\b(?=[^\\r\\n]{0,180}\\b(?:clarity|rag)\\b)(?=[^\\r\\n]{0,180}\\b(?:engines?|retrieval|index|sources?)\\b)[^\\r\\n]{1,180}$'],
+  }, { availability: 'external-if-installed' }),
+  fb('vtp-html-explainer', 'prompt-time', ['manual', 'semi', 'auto'], {
+    regexes: ['^\\s*(?:create|make|draft|build|write|turn)\\b[^\\r\\n]{0,140}\\b(?:html\\s+explainer|visual\\s+explainer|diagrammed\\s+report)\\b'],
+  }, { availability: 'external-if-installed' }),
+  fb('diagram-design', 'prompt-time', ['manual', 'semi', 'auto'], {
+    regexes: [
+      '^\\s*(?![^\\r\\n]{0,160}\\b(?:html|explainer|diagrammed\\s+report)\\b)'
+        + '(?:create|make|draft|draw|design)\\b[^\\r\\n]{0,140}\\b'
+        + '(?:diagram|architecture\\s+map|flowchart)\\b',
+    ],
+  }, { availability: 'external-if-installed' }),
 ]);
 
 function _clone(value) {
@@ -765,10 +780,10 @@ function selfTest(opts) {
       && unavailable.some((item) => item.skill === 'gsd-code-review-fix'
         && item.reason === 'manual_only_entrypoint_absent');
   })(), 'availability metadata did not suppress a nonexistent prompt entry point');
-
+ 
   let malformedFixtureError = null;
   try {
     _loadStrict(path.resolve(__dirname, '..', '..', 'tools', 'self-test', 'fixtures', 'skill-routing-malformed.yaml'));
@@ -846,10 +861,10 @@ function selfTest(opts) {
       && !phaseManual.some((route) => route.skill === 'sgsd-overwatcher');
   })());
-  assert('10. prompt adapter emits only existing P146-compatible /sgsd-* directives', (() => {
+  assert('10. prompt adapter emits only existing safe P146-compatible directives', (() => {
     const routes = toPromptGovernanceRoutes(registry, { mode: 'manual', root });
     const directiveBySkill = Object.fromEntries(routes.map((route) => [route.skill, route.enforcement.directive]));
-    return routes.every((route) => route.enforcement.directive.startsWith('/sgsd-'))
+    return routes.every((route) => isSafeSkillTarget(route.enforcement.directive))
       && directiveBySkill['gsd-code-review'] === undefined
       && directiveBySkill['gsd-code-review-fix'] === undefined;
   })());
diff --git a/super-gsd/hooks/sgsd-intent-classifier.cjs b/super-gsd/hooks/sgsd-intent-classifier.cjs
index f94a3cf..35def1f 100755
--- a/super-gsd/hooks/sgsd-intent-classifier.cjs
+++ b/super-gsd/hooks/sgsd-intent-classifier.cjs
@@ -43,6 +43,7 @@ const CLASSIFIER_ENFORCEMENT_KINDS = Object.freeze(['directive', 'suggestion']);
 const KB_TRIAGE_SHADOW_SIGNAL = 'kb_triage_shadow';
+const SKILL_FAMILY_SHADOW_SIGNAL = 'skill_family_shadow';
 const KB_TRIAGE_MATCHER_VERSION = 'kb-shadow-v1';
 const REPORT_ONLY_SIGNALS = Object.freeze(['missing_plan']);
 
@@ -253,16 +254,23 @@ function validateRouteShape(route) {
   }
 
   if (kind === 'shadow') {
-    const triggerCount = nonEmptyStrings(trigger.phrases).length
+    const triggerCount = nonEmptyStrings(trigger.phrases).length
       + validRegexStrings(trigger.regexes).length
+      + nonEmptyStrings(trigger.strong_phrases).length
+      + validRegexStrings(trigger.strong_regexes).length
       + nonEmptyStrings(trigger.strong_kb_phrases).length
       + validRegexStrings(trigger.strong_kb_regexes).length;
     const signal = typeof enforcement.signal === 'string' ? enforcement.signal.trim() : '';
     const directive = typeof enforcement.directive === 'string' ? enforcement.directive.trim() : '';
+    const target = typeof enforcement.target === 'string' ? enforcement.target.trim() : '';
     if (triggerCount === 0) reasons.push('shadow_trigger_missing');
-    if (signal !== KB_TRIAGE_SHADOW_SIGNAL) reasons.push('shadow_signal_invalid');
+    if (![KB_TRIAGE_SHADOW_SIGNAL, SKILL_FAMILY_SHADOW_SIGNAL].includes(signal)) {
+      reasons.push('shadow_signal_invalid');
+    }
     if (directive) reasons.push('shadow_directive_forbidden');
+    if (signal === SKILL_FAMILY_SHADOW_SIGNAL && !isSafeSkillTarget(target)) {
+      reasons.push('shadow_target_invalid');
+    } else if (target && !isSafeSkillTarget(target)) {
+      reasons.push('shadow_target_invalid');
+    }
     return {
       route,
       id: id || null,
@@ -453,7 +461,9 @@ function matchesShadowRoute(route, prompt, root, payload) {
   if (!route || !prompt.trim()) return false;
   const trigger = route.trigger || {};
   const predicate = route.predicate || {};
-  const strong = phraseHit(prompt, trigger.strong_kb_phrases)
+  const strong = phraseHit(prompt, trigger.strong_phrases)
+    || regexHit(prompt, trigger.strong_regexes, root, payload)
+    || phraseHit(prompt, trigger.strong_kb_phrases)
     || regexHit(prompt, trigger.strong_kb_regexes, root, payload);
   if (strong) return true;
   const weak = phraseHit(prompt, trigger.phrases)
@@ -475,7 +485,14 @@ function evaluateShadowRoutes(root, payload, prompt) {
         && route.enforcement
         && route.enforcement.kind === 'shadow';
     });
-    const matched = shadowRoutes.filter((route) => matchesShadowRoute(route, prompt, root, payload));
+    const lexicalMatches = shadowRoutes
+      .filter((route) => matchesShadowRoute(route, prompt, root, payload));
+    const matched = lexicalMatches.filter((route) => {
+      const enforcement = route.enforcement || {};
+      if (!enforcement.target) return true;
+      return resolveSkillTarget(enforcement.target, { root }).available;
+    });
     if (matched.length === 0) return;
     const crypto = require('crypto');
     const ledgerPathValue = kbTriageShadowLedgerPath(root);
+    const actions = Array.from(new Set(matched
+      .map((route) => route.enforcement && route.enforcement.action)
+      .filter(Boolean)));
+    const targets = Array.from(new Set(matched
+      .map((route) => route.enforcement && route.enforcement.target)
+      .filter(Boolean)
+      .map((target) => target.slice(1))));
     const line = JSON.stringify({
       ts: new Date().toISOString(),
       decision_id: crypto.randomUUID(),
       matcher_version: KB_TRIAGE_MATCHER_VERSION,
       matched_signature_ids: matched.map((route) => route.id).filter(Boolean),
-      soft_path_action: 'would_route_vtp_query_triage',
+      soft_path_action: actions.length === 1
+        ? actions[0]
+        : (matched.some((route) => route.enforcement.signal === KB_TRIAGE_SHADOW_SIGNAL)
+          ? 'would_route_vtp_query_triage'
+          : 'would_route_skill_family'),
+      soft_path_actions: actions,
+      target_skills: targets,
       latency_ms: null,
       operator_label: null,
     }) + '\n';
diff --git a/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs b/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
index aaf043a..eef69b0 100755
--- a/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
+++ b/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
@@ -71,11 +71,14 @@ function runClassifier(value, payload, args, classifierPath) {
   });
   const evidenceFile = path.join(value.project, '.planning', 'metrics', 'gate-evidence.jsonl');
+  const shadowFile = path.join(value.project, '.planning', 'metrics', 'kb-triage-shadow.jsonl');
   return {
     status: child.status,
     stdout: child.stdout || '',
     evidence: readJsonl(evidenceFile),
     evidenceText: fs.existsSync(evidenceFile) ? fs.readFileSync(evidenceFile, 'utf8') : '',
+    shadow: readJsonl(shadowFile),
+    shadowText: fs.existsSync(shadowFile) ? fs.readFileSync(shadowFile, 'utf8') : '',
   };
 }
 
@@ -300,10 +303,141 @@ function availabilityGuardCase() {
   return fail === 0 ? 0 : 1;
 }
 
+function erpVtpSkillFamilyCase() {
+  let pass = 0;
+  let fail = 0;
+  const failures = [];
+  const check = (name, condition, detail) => {
+    if (condition) pass += 1;
+    else {
+      fail += 1;
+      failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
+    }
+  };
+  const install = (value, target) => writeFile(
+    path.join(value.project, '.claude', 'skills', target, 'SKILL.md'),
+    `---\nname: ${target}\n---\n`,
+  );
+
+  const suggestionFixtures = [
+    [
+      'Clarity engine lookup',
+      'clarity-engines',
+      'look up the Clarity RAG retrieval engine sentinel-p159-family',
+    ],
+    [
+      'HTML explainer',
+      'vtp-html-explainer',
+      'create an HTML explainer for this architecture sentinel-p159-family',
+    ],
+    [
+      'diagram',
+      'diagram-design',
+      'draw an architecture diagram for this flow sentinel-p159-family',
+    ],
+  ];
+  for (const [label, target, prompt] of suggestionFixtures) {
+    withFixture((value) => {
+      install(value, target);
+      const result = runClassifier(value, humanPayload(prompt));
+      check(`${label} installed target exits zero`, result.status === 0, `status=${result.status}`);
+      check(
+        `${label} emits only its suggestion`,
+        result.stdout === `SGSD skill suggestion: /${target}\n`,
+        JSON.stringify(result.stdout),
+      );
+      const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
+      check(
+        `${label} records a matched suggestion`,
+        rows.length === 1 && rows[0].decision === 'matched'
+          && JSON.stringify(rows[0].suggestions) === JSON.stringify([`/${target}`]),
+        JSON.stringify(rows),
+      );
+    });
+  }
+
+  withFixture((value) => {
+    install(value, 'vtp-html-explainer');
+    install(value, 'diagram-design');
+    const result = runClassifier(
+      value,
+      humanPayload('create an HTML explainer with supporting visuals sentinel-p159-boundary'),
+    );
+    check(
+      'explainer boundary does not also suggest diagram-design',
+      result.stdout === 'SGSD skill suggestion: /vtp-html-explainer\n'
+        && !result.stdout.includes('/diagram-design'),
+      JSON.stringify(result.stdout),
+    );
+  });
+
+  const shadowFixtures = [
+    [
+      'quote-shaped intent',
+      'create-quote',
+      'erp-vtp-create-quote',
+      'prepare a JCL SAP quote from this schedule sentinel-p159-family',
+    ],
+    [
+      'ERP record resolution',
+      'erp-resolve',
+      'erp-vtp-record-resolution',
+      'resolve this ERP customer record sentinel-p159-family',
+    ],
+    [
+      'meeting import',
+      'vtp-implementation-pack',
+      'erp-vtp-meeting-import',
+      'import the last meeting into the VTP implementation pack sentinel-p159-family',
+    ],
+    [
+      'procurement status',
+      'jcl-procurement-report',
+      'erp-vtp-procurement-status',
+      'show the JCL procurement status sentinel-p159-family',
+    ],
+  ];
+  for (const [label, target, routeId, prompt] of shadowFixtures) {
+    withFixture((value) => {
+      install(value, target);
+      const result = runClassifier(value, humanPayload(prompt));
+      const row = result.shadow[0] || {};
+      check(`${label} installed target exits zero`, result.status === 0, `status=${result.status}`);
+      check(`${label} remains shadow-only`, result.stdout === '', JSON.stringify(result.stdout));
+      check(
+        `${label} records the names-only shadow decision`,
+        result.shadow.length === 1
+          && row.matched_signature_ids.includes(routeId)
+          && row.target_skills.includes(target),
+        JSON.stringify(result.shadow),
+      );
+      check(
+        `${label} shadow ledger is text-free`,
+        !result.shadowText.includes(prompt)
+          && !result.shadowText.includes('sentinel-p159-family')
+          && !hasForbiddenKey(row, new Set([
+            'prompt', 'text', 'excerpt', 'path', 'query', 'entities', 'checked_paths',
+          ])),
+        result.shadowText,
+      );
+    });
+  }
+
+  for (const [label, , , prompt] of shadowFixtures) {
+    withFixture((value) => {
+      const result = runClassifier(value, humanPayload(prompt));
+      check(
+        `${label} unavailable target suppresses shadow routing`,
+        result.status === 0 && result.stdout === '' && result.shadow.length === 0,
+        JSON.stringify({ status: result.status, stdout: result.stdout, shadow: result.shadow }),
+      );
+    });
+  }
+
+  for (const [label, , prompt] of suggestionFixtures) {
+    withFixture((value) => {
+      const result = runClassifier(value, humanPayload(prompt));
+      const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
+      check(
+        `${label} unavailable target suppresses suggestion`,
+        result.status === 0 && result.stdout === ''
+          && rows.length === 1 && rows[0].decision === 'skill_unavailable',
+        JSON.stringify({ status: result.status, stdout: result.stdout, rows }),
+      );
+    });
+  }
+
+  withFixture((value) => {
+    install(value, 'jcl-procurement-report');
+    const result = runClassifier(
+      value,
+      humanPayload('build a procurement status dashboard sentinel-p159-negative'),
+    );
+    check(
+      'weak procurement words lose to an excluded implementation verb',
+      result.status === 0 && result.stdout === '' && result.shadow.length === 0,
+      JSON.stringify(result),
+    );
+  });
+
+  console.log(`skill-routing-expansion erp-vtp-skill-family: ${pass} pass, ${fail} fail`);
+  for (const failure of failures) console.error(`  FAIL: ${failure}`);
+  return fail === 0 ? 0 : 1;
+}
+
 function main() {
-  if (argument('--case') !== 'availability-guard') {
-    console.error('Usage: node assert-skill-routing-expansion.cjs --case availability-guard');
+  const requestedCase = argument('--case');
+  if (!['availability-guard', 'erp-vtp-skill-family'].includes(requestedCase)) {
+    console.error(
+      'Usage: node assert-skill-routing-expansion.cjs '
+        + '--case <availability-guard|erp-vtp-skill-family>',
+    );
     process.exit(2);
   }
   try {
-    process.exit(availabilityGuardCase());
+    process.exit(requestedCase === 'availability-guard'
+      ? availabilityGuardCase()
+      : erpVtpSkillFamilyCase());
   } catch (error) {
-    console.error(`skill-routing-expansion availability-guard: unexpected error -- ${error.message}`);
+    console.error(`skill-routing-expansion ${requestedCase}: unexpected error -- ${error.message}`);
     process.exit(1);
   }
 }
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
super-gsd/registry/skill-routing.yaml; super-gsd/registry/session-governance-hooks.yaml; super-gsd/scripts/lib/skill-routing-registry.cjs; super-gsd/hooks/sgsd-intent-classifier.cjs; super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
VERIFICATION:
RED is preserved by the new erp-vtp-skill-family case. Commands were not executed because the bounded executor contract forbids tools.
DEVIATIONS:
None. High-consequence ERP/VTP matches remain shadow-only; low-risk lookup and visual-generation matches are suggestions.
BLOCKERS:
None.
ONE_LINER:
Adds availability-guarded anchored routing for seven ERP/VTP skills, strong-positive shadow tiering, explainer/diagram separation, and text-free shadow evidence.
REPORT_END
