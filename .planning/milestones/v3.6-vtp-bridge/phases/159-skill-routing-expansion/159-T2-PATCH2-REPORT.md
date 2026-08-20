PATCH_BEGIN
diff --git a/super-gsd/registry/skill-routing.yaml b/super-gsd/registry/skill-routing.yaml
--- a/super-gsd/registry/skill-routing.yaml
+++ b/super-gsd/registry/skill-routing.yaml
@@ -489,6 +489,125 @@ routes:
     gate_ref: phase-level-ATC
     notes: Legacy verify-work requests route to existing SGSD verification and ATC flow.
 
+  - skill: create-quote-codex
+    id: create-quote-codex:quote-authoring
+    signatures:
+      phrases:
+        - draft a sap quote
+        - prepare a sap quote
+      regexes:
+        - '\b(?:draft|prepare|create)\b.{0,120}\b(?:sap\s+)?quote\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: suggestion
+    notes: Suggest the quote skill for explicit SAP quote authoring requests.
+
+  - skill: create-quote-codex
+    id: create-quote-codex:source-to-quote
+    signatures:
+      phrases:
+        - quote from schedule
+        - quote from email
+      regexes:
+        - '\bquote\b.{0,120}\b(?:schedule|email|pdf|customer|opportunity|product\s+lines?)\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: suggestion
+    notes: Suggest the quote skill when supplied business material must become a quote.
+
+  - skill: create-quote-codex
+    id: create-quote-codex:sap-commercial-context
+    signatures:
+      phrases:
+        - jcl commercial context
+        - sap commercial proposal
+      regexes:
+        - '\b(?:jcl|sap)\b.{0,120}\bcommercial\b.{0,120}\b(?:quote|proposal|pricing)\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: shadow
+    notes: Observe broader ERP commercial intent without injecting a suggestion.
+
+  - skill: vtp-html-explainer
+    id: vtp-html-explainer:html-request
+    signatures:
+      phrases:
+        - html explainer
+        - put this into html
+      regexes:
+        - '\b(?:create|make|build|produce)\b.{0,120}\bhtml\b.{0,120}\b(?:explainer|report|walkthrough)\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: suggestion
+    notes: Suggest the HTML explainer for an explicit HTML explanation deliverable.
+
+  - skill: vtp-html-explainer
+    id: vtp-html-explainer:visual-explanation
+    signatures:
+      phrases:
+        - visual explanation
+        - diagrammed report
+      regexes:
+        - '\b(?:visual|diagrammed)\b.{0,120}\b(?:explanation|explainer|report)\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: suggestion
+    notes: Suggest the HTML explainer for explicit visual or diagrammed reports.
+
+  - skill: vtp-html-explainer
+    id: vtp-html-explainer:architecture-walkthrough
+    signatures:
+      phrases:
+        - architecture walkthrough
+        - milestone walkthrough
+      regexes:
+        - '\b(?:architecture|milestone)\b.{0,120}\bwalkthrough\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: shadow
+    notes: Observe walkthrough-shaped intent without interrupting ordinary planning prompts.
+
+  - skill: vtp-html-explainer
+    id: vtp-html-explainer:domain-explanation
+    signatures:
+      phrases:
+        - explain sgsd visually
+        - explain vtp visually
+      regexes:
+        - '\bexplain\b.{0,120}\b(?:sgsd|clarity|sap|vtp)\b.{0,120}\bvisually\b'
+    moment: prompt-time
+    modes:
+      - manual
+      - semi
+      - auto
+    availability: external-if-installed
+    tier: shadow
+    notes: Observe domain-specific visual explanation intent without automatic injection.
+
   - skill: sgsd-audit
     aliases:
       - gsd-secure-phase
diff --git a/super-gsd/registry/session-governance-hooks.yaml b/super-gsd/registry/session-governance-hooks.yaml
--- a/super-gsd/registry/session-governance-hooks.yaml
+++ b/super-gsd/registry/session-governance-hooks.yaml
@@ -3,7 +3,7 @@
 # ============================================================================
 
 # Compatibility registry for P146 enforcement and quality-hook metadata.
-# Prompt-time skill suggestions are maintained only in skill-routing.yaml and
+# Prompt-time skill suggestion/shadow tiers are maintained only in skill-routing.yaml and
 # adapted by scripts/lib/skill-routing-registry.cjs::toPromptGovernanceRoutes.
 # Shape: trigger / predicate / enforcement.
 # ============================================================================
diff --git a/super-gsd/scripts/lib/skill-routing-registry.cjs b/super-gsd/scripts/lib/skill-routing-registry.cjs
--- a/super-gsd/scripts/lib/skill-routing-registry.cjs
+++ b/super-gsd/scripts/lib/skill-routing-registry.cjs
@@ -21,7 +21,8 @@ const YAML_LIB_PATH = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema',
 const GATES_YAML_PATH = path.join(DEFAULT_SGSD_ROOT, 'registry', 'gates.yaml');
 
 const VALID_MOMENTS = Object.freeze(['prompt-time', 'phase-close', 'milestone-close', 'weekly', 'on-demand']);
 const VALID_MODES = Object.freeze(['manual', 'semi', 'auto']);
+const VALID_TIERS = Object.freeze(['suggestion', 'shadow']);
 const VALID_AVAILABILITY = Object.freeze([
   'canonical',
   'alias',
@@ -226,6 +227,55 @@ const COMPILED_FALLBACK_ROWS = Object.freeze([
     phrases: ['gsd-verify-work', 'verify work', 'verify this work', 'run verification', 'atc flow'],
     regexes: ['\\bverify\\b.{0,120}\\b(?:work|change|phase|implementation)\\b'],
   }, { aliases: ['gsd-verify-work'], availability: 'alias', gate_ref: 'phase-level-ATC' }),
+  fb('create-quote-codex', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['draft a sap quote', 'prepare a sap quote'],
+    regexes: ['\\b(?:draft|prepare|create)\\b.{0,120}\\b(?:sap\\s+)?quote\\b'],
+  }, {
+    id: 'create-quote-codex:quote-authoring',
+    availability: 'external-if-installed', tier: 'suggestion',
+  }),
+  fb('create-quote-codex', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['quote from schedule', 'quote from email'],
+    regexes: ['\\bquote\\b.{0,120}\\b(?:schedule|email|pdf|customer|opportunity|product\\s+lines?)\\b'],
+  }, {
+    id: 'create-quote-codex:source-to-quote',
+    availability: 'external-if-installed', tier: 'suggestion',
+  }),
+  fb('create-quote-codex', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['jcl commercial context', 'sap commercial proposal'],
+    regexes: ['\\b(?:jcl|sap)\\b.{0,120}\\bcommercial\\b.{0,120}\\b(?:quote|proposal|pricing)\\b'],
+  }, {
+    id: 'create-quote-codex:sap-commercial-context',
+    availability: 'external-if-installed', tier: 'shadow',
+  }),
+  fb('vtp-html-explainer', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['html explainer', 'put this into html'],
+    regexes: ['\\b(?:create|make|build|produce)\\b.{0,120}\\bhtml\\b.{0,120}\\b(?:explainer|report|walkthrough)\\b'],
+  }, {
+    id: 'vtp-html-explainer:html-request',
+    availability: 'external-if-installed', tier: 'suggestion',
+  }),
+  fb('vtp-html-explainer', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['visual explanation', 'diagrammed report'],
+    regexes: ['\\b(?:visual|diagrammed)\\b.{0,120}\\b(?:explanation|explainer|report)\\b'],
+  }, {
+    id: 'vtp-html-explainer:visual-explanation',
+    availability: 'external-if-installed', tier: 'suggestion',
+  }),
+  fb('vtp-html-explainer', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['architecture walkthrough', 'milestone walkthrough'],
+    regexes: ['\\b(?:architecture|milestone)\\b.{0,120}\\bwalkthrough\\b'],
+  }, {
+    id: 'vtp-html-explainer:architecture-walkthrough',
+    availability: 'external-if-installed', tier: 'shadow',
+  }),
+  fb('vtp-html-explainer', 'prompt-time', ['manual', 'semi', 'auto'], {
+    phrases: ['explain sgsd visually', 'explain vtp visually'],
+    regexes: ['\\bexplain\\b.{0,120}\\b(?:sgsd|clarity|sap|vtp)\\b.{0,120}\\bvisually\\b'],
+  }, {
+    id: 'vtp-html-explainer:domain-explanation',
+    availability: 'external-if-installed', tier: 'shadow',
+  }),
   fb('sgsd-audit', 'on-demand', ['manual'], {
     phrases: ['gsd-secure-phase', 'secure phase', 'security phase', 'phase security review'],
   }, { aliases: ['gsd-secure-phase'], availability: 'alias' }),
@@ -558,6 +608,12 @@ function _normalizeRoute(row, index, sourceTag) {
   if (availability && !VALID_AVAILABILITY.includes(availability)) {
     issues.push(label + '.availability invalid: ' + availability);
   }
+  const tier = row.tier === undefined || row.tier === null
+    ? 'suggestion'
+    : _optionalString(row.tier, label + '.tier', issues);
+  if (tier && !VALID_TIERS.includes(tier)) {
+    issues.push(label + '.tier invalid: ' + tier);
+  }
   const gateRef = _optionalString(row.gate_ref, label + '.gate_ref', issues);
   const skipReason = _optionalString(row.skip_reason, label + '.skip_reason', issues);
   const notes = _optionalString(row.notes, label + '.notes', issues);
@@ -591,6 +647,7 @@ function _normalizeRoute(row, index, sourceTag) {
       signatures,
       moment,
       modes,
+      tier,
       availability,
       gate_ref: gateRef,
       cooldown,
@@ -810,7 +867,7 @@ function toPromptGovernanceRoutes(input, opts) {
       },
       predicate: {},
       enforcement: {
-        kind: 'suggestion',
+        kind: route.tier === 'shadow' ? 'shadow' : 'suggestion',
         directive: _directiveFor(route, availability.target),
       },
       skill: route.skill,
@@ -818,6 +875,7 @@ function toPromptGovernanceRoutes(input, opts) {
       aliases: route.aliases.slice(),
       availability: route.availability,
+      tier: route.tier || 'suggestion',
       gate_ref: route.gate_ref,
       source: route.source,
     });
@@ -849,6 +907,7 @@ function _routingParityProjection(routes) {
     skill: route.skill,
     moment: route.moment,
     modes: route.modes,
+    tier: route.tier,
     cooldown: route.cooldown,
     gate_ref: route.gate_ref,
     dispatch: route.dispatch,
@@ -1086,6 +1145,7 @@ module.exports = {
   DEFAULT_REGISTRY_PATH,
   VALID_MOMENTS,
   VALID_MODES,
+  VALID_TIERS,
   VALID_AVAILABILITY,
   DEGRADED_SIGNAL,
   SKILL_ROUTING_EVENT,
diff --git a/super-gsd/hooks/sgsd-intent-classifier.cjs b/super-gsd/hooks/sgsd-intent-classifier.cjs
--- a/super-gsd/hooks/sgsd-intent-classifier.cjs
+++ b/super-gsd/hooks/sgsd-intent-classifier.cjs
@@ -562,6 +562,8 @@ function appendRoutingDecision(root, payload, routes, mandatory, suggestions, du
       phase: state.phase || null,
       milestone: state.milestone || null,
       route_ids: routes.map((route) => route.id).filter(Boolean),
+      suggestion_route_ids: routes.filter((route) => route.enforcement && route.enforcement.kind === 'suggestion').map((route) => route.id).filter(Boolean),
+      shadow_route_ids: routes.filter((route) => route.enforcement && route.enforcement.kind === 'shadow').map((route) => route.id).filter(Boolean),
       directives: Array.isArray(mandatory) ? mandatory.slice() : [],
       suggestions: Array.isArray(suggestions) ? suggestions.slice() : [],
       ...(!skillUnavailable ? {
diff --git a/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs b/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
--- a/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
+++ b/super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
@@ -10,6 +10,15 @@ const REGISTRY = path.join(ROOT, 'super-gsd', 'scripts', 'lib', 'skill-routing-r
 const TARGET = 'sgsd-code-review';
 const PROMPT = 'review my code sentinel-p159-availability';
 const UNAVAILABLE_REASON = 'skill_entrypoint_not_found';
+const EXPECTED_ERP_VTP_ROUTES = Object.freeze({
+  'create-quote-codex:quote-authoring': 'suggestion',
+  'create-quote-codex:source-to-quote': 'suggestion',
+  'create-quote-codex:sap-commercial-context': 'shadow',
+  'vtp-html-explainer:html-request': 'suggestion',
+  'vtp-html-explainer:visual-explanation': 'suggestion',
+  'vtp-html-explainer:architecture-walkthrough': 'shadow',
+  'vtp-html-explainer:domain-explanation': 'shadow',
+});
 
 function argument(name) {
   const index = process.argv.indexOf(name);
@@ -70,6 +79,146 @@ function humanPayload(prompt) {
   };
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
+
+  const routingRegistry = require(REGISTRY);
+  const registry = routingRegistry.loadSkillRoutingRegistry({ noCache: true });
+  const familyRows = registry.routes.filter((route) => (
+    Object.prototype.hasOwnProperty.call(EXPECTED_ERP_VTP_ROUTES, route.id)
+  ));
+  const redFixtureRoutes = routingRegistry.toPromptGovernanceRoutes({ routes: [] }, {
+    mode: 'manual',
+    root: ROOT,
+    deferAvailability: true,
+  });
+  check(
+    'red fixture without ERP/VTP rows fails the seven-route contract',
+    redFixtureRoutes.length === 0
+      && Object.keys(EXPECTED_ERP_VTP_ROUTES).some(
+        (id) => !redFixtureRoutes.some((route) => route.id === id),
+      ),
+    JSON.stringify(redFixtureRoutes),
+  );
+  check(
+    'yaml registry contains exactly the seven ERP/VTP family routes',
+    familyRows.length === 7
+      && Object.keys(EXPECTED_ERP_VTP_ROUTES).every(
+        (id) => familyRows.some((route) => route.id === id),
+      ),
+    JSON.stringify(familyRows.map((route) => route.id)),
+  );
+  check(
+    'ERP/VTP family rows are availability guarded',
+    familyRows.every((route) => route.availability === 'external-if-installed'),
+    JSON.stringify(familyRows.map((route) => [route.id, route.availability])),
+  );
+
+  const adapted = routingRegistry.toPromptGovernanceRoutes(registry, {
+    mode: 'manual',
+    root: ROOT,
+    deferAvailability: true,
+  });
+  const kindById = Object.fromEntries(adapted.map((route) => [route.id, route.enforcement.kind]));
+  check(
+    'ERP/VTP family preserves suggestion and shadow tiering',
+    Object.entries(EXPECTED_ERP_VTP_ROUTES).every(([id, tier]) => kindById[id] === tier),
+    JSON.stringify(kindById),
+  );
+
+  const probes = [
+    ['draft a sap quote sentinel-p159-erp-1', 'create-quote-codex', 'create-quote-codex:quote-authoring'],
+    ['quote from email sentinel-p159-erp-2', 'create-quote-codex', 'create-quote-codex:source-to-quote'],
+    ['sap commercial proposal sentinel-p159-erp-3', 'create-quote-codex', 'create-quote-codex:sap-commercial-context'],
+    ['put this into html sentinel-p159-vtp-1', 'vtp-html-explainer', 'vtp-html-explainer:html-request'],
+    ['diagrammed report sentinel-p159-vtp-2', 'vtp-html-explainer', 'vtp-html-explainer:visual-explanation'],
+    ['architecture walkthrough sentinel-p159-vtp-3', 'vtp-html-explainer', 'vtp-html-explainer:architecture-walkthrough'],
+    ['explain vtp visually sentinel-p159-vtp-4', 'vtp-html-explainer', 'vtp-html-explainer:domain-explanation'],
+  ];
+  for (const [prompt, target, routeId] of probes) {
+    withFixture((value) => {
+      writeFile(
+        path.join(value.project, '.claude', 'skills', target, 'SKILL.md'),
+        '---\nname: fixture\n---\n',
+      );
+      const result = runClassifier(value, humanPayload(prompt));
+      const rows = result.evidence
+        .filter((row) => row.signal === 'intent_routing_decision');
+      const row = rows[0] || {};
+      const tier = EXPECTED_ERP_VTP_ROUTES[routeId];
+      const expectedStdout = tier === 'suggestion'
+        ? `SGSD skill suggestion: /${target}\n`
+        : '';
+      check(`${routeId} exits zero`, result.status === 0, `status=${result.status}`);
+      check(
+        `${routeId} respects its output tier`,
+        result.stdout === expectedStdout,
+        JSON.stringify(result.stdout),
+      );
+      check(
+        `${routeId} records the tiered match`,
+        rows.length === 1 && row.decision === 'matched'
+          && row.route_ids.includes(routeId)
+          && (tier === 'suggestion'
+            ? row.suggestion_route_ids.includes(routeId)
+            : row.shadow_route_ids.includes(routeId)),
+        JSON.stringify(rows),
+      );
+      const forbiddenKeys = new Set(['prompt', 'text', 'excerpt', 'query', 'entities']);
+      check(
+        `${routeId} evidence is text-free`,
+        !result.evidenceText.includes('sentinel-p159-')
+          && !hasForbiddenKey(row, forbiddenKeys),
+        result.evidenceText,
+      );
+    });
+  }
+
+  const unavailableProbes = [
+    ['draft a sap quote sentinel-p159-unavailable-erp', 'create-quote-codex', 'create-quote-codex:quote-authoring'],
+    ['architecture walkthrough sentinel-p159-unavailable-vtp', 'vtp-html-explainer', 'vtp-html-explainer:architecture-walkthrough'],
+  ];
+  for (const [prompt, target, routeId] of unavailableProbes) {
+    withFixture((value) => {
+      const result = runClassifier(value, humanPayload(prompt));
+      const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
+      const row = rows[0] || {};
+      check(
+        `${routeId} absent entrypoint emits nothing`,
+        result.status === 0 && result.stdout === '',
+        JSON.stringify({ status: result.status, stdout: result.stdout }),
+      );
+      check(
+        `${routeId} absent entrypoint records only unavailability`,
+        rows.length === 1 && row.decision === 'skill_unavailable'
+          && row.target_skill === target
+          && row.route_id === routeId,
+        JSON.stringify(rows),
+      );
+      const forbiddenKeys = new Set(['prompt', 'text', 'excerpt', 'query', 'entities']);
+      check(
+        `${routeId} unavailable evidence is text-free`,
+        !result.evidenceText.includes('sentinel-p159-')
+          && !hasForbiddenKey(row, forbiddenKeys),
+        result.evidenceText,
+      );
+    });
+  }
+
+  console.log(`skill-routing-expansion erp-vtp-skill-family: ${pass} pass, ${fail} fail`);
+  for (const failure of failures) console.error(`  FAIL: ${failure}`);
+  return fail === 0 ? 0 : 1;
+}
+
 function availabilityGuardCase() {
   let pass = 0;
   let fail = 0;
@@ -340,7 +489,8 @@ function availabilityGuardCase() {
 }
 
 function main() {
-  if (argument('--case') !== 'availability-guard') {
-    console.error('Usage: node assert-skill-routing-expansion.cjs --case availability-guard');
+  const requestedCase = argument('--case');
+  if (requestedCase !== 'availability-guard' && requestedCase !== 'erp-vtp-skill-family') {
+    console.error('Usage: node assert-skill-routing-expansion.cjs --case <availability-guard|erp-vtp-skill-family>');
     process.exit(2);
   }
   try {
@@ -348,7 +498,9 @@ function main() {
     process.exit(2);
   }
   try {
-    process.exit(availabilityGuardCase());
+    process.exit(requestedCase === 'availability-guard'
+      ? availabilityGuardCase()
+      : erpVtpSkillFamilyCase());
   } catch (error) {
     console.error(`skill-routing-expansion availability-guard: unexpected error -- ${error.message}`);
     process.exit(1);
PATCH_END
REPORT_BEGIN
FILES_CHANGED: super-gsd/registry/skill-routing.yaml; super-gsd/registry/session-governance-hooks.yaml; super-gsd/scripts/lib/skill-routing-registry.cjs; super-gsd/hooks/sgsd-intent-classifier.cjs; super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs
VERIFICATION: Not run; executor contract prohibited tool calls. Patch includes an in-case empty-registry red path and production-stdin coverage for all seven routes.
DEVIATIONS: None.
BLOCKERS: None.
ONE_LINER: Adds seven availability-guarded ERP/VTP prompt routes with suggestion/shadow tiering and text-free routing evidence.
REPORT_END
