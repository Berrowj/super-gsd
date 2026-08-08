# SPEC-COMPLIANCE RE-REVIEW — 148-atcfix + 148-atcfix2 combined diff

You are the SDD spec reviewer. A prior spec review returned fix_required with 3 gaps: (1) SKILL.md not wired to staged transport, (2) staged skip emitted reasonCode instead of reason, (3) consume/finalize not idempotent. A fix dispatch addressed all three. Verify against the raw diff below. Orchestrator host-side verification: full suite [PASS] all (34 scenarios); grep -c 'vtp-plan|vtp-consume|vtp-finalize' SKILL.md = 5.

Report contract — emit ALL of these exact lines:
FINDINGS: <int total findings>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <requirements met>/<total requirements>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
VERIFICATION_MAPPING: <evidence per acceptance criterion>

## Original fix prompt (requirements source)
```
# P148 phase-ATC fix — Claude is the MCP transport; the runtime is the brain

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/sgsd-triage-runtime.cjs`,
`super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`,
`super-gsd/skills/sgsd-triage/SKILL.md`. Nothing else.

## CRIT-1 — the CLI cannot reach VTP in production
`mcp__vtp-kb__*` tools are callable only inside CLAUDE'S SESSION — never by a
spawned node process. The runtime's VTP path exists solely via
`options.mcpInvoke`, which only tests inject. In real skill use `callVtp`
returns `no_mcp_invoke`: AC-148b is harness-only. (This is the milestone's
harness-vs-production seam at its deepest — the previous fix moved the seam
from "module vs CLI" to "CLI vs MCP reality".)

### Fix — file-protocol loop: runtime decides, Claude transports
Add a staged CLI protocol (keep the module API + mcpInvoke for tests):
1. `--stage vtp-plan` → runtime reads STATE/config/tier, emits structured
   JSON: {action:"invoke_mcp", tool:"vtp_route_and_retrieve", args:{...},
   response_file:"<contained path>"} — or {action:"skip", reason} when the
   toggle is off (existing row).
2. Claude (per SKILL prose) calls that MCP tool in-session VERBATIM, writes
   the raw JSON response to response_file, re-invokes:
3. `--stage vtp-consume --response-file <path>` → runtime validates + applies
   the EXACT fallback predicate to the REAL response. No fallback → finalize
   (evidence file + rows) and emit {action:"complete", ...}. Fallback needed →
   emit {action:"invoke_mcp", tool:"vtp_search_substrate", args:{raw query},
   response_file} + the degradation row; Claude calls it and re-invokes:
4. `--stage vtp-finalize --response-file <path>` → finalize with fallback
   evidence.
Rules: response files validated + contained (they are UNTRUSTED external
input — bound sizes, JSON-parse guarded, reason-coded rows on garbage);
every stage idempotent-safe and never-throw; the decision logic (predicate,
validation, rows, evidence composition) stays 100% in the runtime — the SKILL
prose instructs Claude to execute tool calls VERBATIM with zero judgment and
feed results back. Existing single-shot `mcpInvoke` path stays for tests and
programmatic callers.

## WARN-1 — misleading skip rows from stage-blind gating
A Step 0 (VTP-only) invocation currently evaluates the codex gate and logs
`codex_skipped_non_planning`. Gate evaluation must run ONLY at the codex
stage (Step 0.5 / reconciliation invocation) — a VTP-stage call must never
touch codex gating or write its rows.

## SKILL.md
Update Step 0/0.5 prose to the staged loop (concise — bullet the loop, don't
bloat; the file must stay lean). Claude's role stated plainly: "execute the
emitted MCP call verbatim, save the response, re-invoke — no interpretation."

## Tests
- Existing 28 scenarios keep passing (mcpInvoke path preserved).
- NEW: full staged-protocol scenario driving the REAL CLI through
  plan→consume(→finalize) with fixture response FILES: healthy (no fallback),
  null-reflection (fallback instruction emitted, then finalize), garbage
  response file (reason-coded row, exit 0), oversized response file (bounded,
  degraded).
- NEW: VTP-stage call writes NO codex-gate rows.

## Verify (report exact exit codes)
node --check both cjs; full suite (expect ~32; sandbox EPERM caveat → say
so); SKILL grep-invariants (staged loop present, verbatim-transport language,
no direct mcp call in Step 0 prose beyond executing the runtime's emitted
instruction).
SURGICAL CONSTRAINT. <250-word report.
```

## Gap-closure prompt (atcfix2 requirements)
```
# 148-atcfix2 — Close the three spec-review gaps in the staged MCP-transport fix

You are a fresh SDD implementer (Codex GPT-5.5/xhigh). A prior dispatch implemented the staged MCP-transport protocol in sgsd-triage-runtime.cjs + tests (33/33 green) but was killed before finishing. Spec review found EXACTLY three gaps. Fix ONLY these three. Surgical constraint: every changed line must trace to one of the three gaps; no refactors, no style passes.

## Gap 1 (CRIT — production wiring): super-gsd/skills/sgsd-triage/SKILL.md was never updated
Production still invokes the old single-shot CLI, so the staged transport never runs outside the test harness. Update SKILL.md so the skill drives the staged protocol: runtime emits {action:"invoke_mcp", tool, args, response_file} at --stage vtp-plan; Claude executes the MCP call VERBATIM (runtime decides, Claude transports) and re-invokes --stage vtp-consume --response-file <path>; fallback path allows one more loop; finalize stage per runtime implementation. The SKILL prose must contain the literal stage names vtp-plan, vtp-consume, vtp-finalize and the verbatim-transport instruction. Match the original fix prompt's Step 0/0.5/3/4 two-model prose style already in the file.

## Gap 2: staged skip emits 'reasonCode' but the contract requires 'reason'
Locate the staged-skip emission in sgsd-triage-runtime.cjs and align the field name with the required contract. Update tests if they assert the wrong field.

## Gap 3: consume/finalize are not idempotent-safe
Repeated invocations of vtp-consume/vtp-finalize append duplicate routing/degradation rows. Make re-invocation idempotent (guard on already-recorded state) WITHOUT breaking the 33 green scenarios. Add a test assertion for double-invocation if cheap.

## Context — original fix prompt (for protocol fidelity; do NOT re-implement what already landed)
```
# P148 phase-ATC fix — Claude is the MCP transport; the runtime is the brain

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/sgsd-triage-runtime.cjs`,
`super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`,
`super-gsd/skills/sgsd-triage/SKILL.md`. Nothing else.

## CRIT-1 — the CLI cannot reach VTP in production
`mcp__vtp-kb__*` tools are callable only inside CLAUDE'S SESSION — never by a
spawned node process. The runtime's VTP path exists solely via
`options.mcpInvoke`, which only tests inject. In real skill use `callVtp`
returns `no_mcp_invoke`: AC-148b is harness-only. (This is the milestone's
harness-vs-production seam at its deepest — the previous fix moved the seam
from "module vs CLI" to "CLI vs MCP reality".)

### Fix — file-protocol loop: runtime decides, Claude transports
Add a staged CLI protocol (keep the module API + mcpInvoke for tests):
1. `--stage vtp-plan` → runtime reads STATE/config/tier, emits structured
   JSON: {action:"invoke_mcp", tool:"vtp_route_and_retrieve", args:{...},
   response_file:"<contained path>"} — or {action:"skip", reason} when the
   toggle is off (existing row).
2. Claude (per SKILL prose) calls that MCP tool in-session VERBATIM, writes
   the raw JSON response to response_file, re-invokes:
3. `--stage vtp-consume --response-file <path>` → runtime validates + applies
   the EXACT fallback predicate to the REAL response. No fallback → finalize
   (evidence file + rows) and emit {action:"complete", ...}. Fallback needed →
   emit {action:"invoke_mcp", tool:"vtp_search_substrate", args:{raw query},
   response_file} + the degradation row; Claude calls it and re-invokes:
4. `--stage vtp-finalize --response-file <path>` → finalize with fallback
   evidence.
Rules: response files validated + contained (they are UNTRUSTED external
input — bound sizes, JSON-parse guarded, reason-coded rows on garbage);
every stage idempotent-safe and never-throw; the decision logic (predicate,
validation, rows, evidence composition) stays 100% in the runtime — the SKILL
prose instructs Claude to execute tool calls VERBATIM with zero judgment and
feed results back. Existing single-shot `mcpInvoke` path stays for tests and
programmatic callers.

## WARN-1 — misleading skip rows from stage-blind gating
A Step 0 (VTP-only) invocation currently evaluates the codex gate and logs
`codex_skipped_non_planning`. Gate evaluation must run ONLY at the codex
stage (Step 0.5 / reconciliation invocation) — a VTP-stage call must never
touch codex gating or write its rows.

## SKILL.md
Update Step 0/0.5 prose to the staged loop (concise — bullet the loop, don't
bloat; the file must stay lean). Claude's role stated plainly: "execute the
emitted MCP call verbatim, save the response, re-invoke — no interpretation."

## Tests
- Existing 28 scenarios keep passing (mcpInvoke path preserved).
- NEW: full staged-protocol scenario driving the REAL CLI through
  plan→consume(→finalize) with fixture response FILES: healthy (no fallback),
  null-reflection (fallback instruction emitted, then finalize), garbage
  response file (reason-coded row, exit 0), oversized response file (bounded,
  degraded).
- NEW: VTP-stage call writes NO codex-gate rows.

## Verify (report exact exit codes)
node --check both cjs; full suite (expect ~32; sandbox EPERM caveat → say
so); SKILL grep-invariants (staged loop present, verbatim-transport language,
no direct mcp call in Step 0 prose beyond executing the runtime's emitted
instruction).
SURGICAL CONSTRAINT. <250-word report.
```

## Verification (run before reporting)
node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario all   # must stay green
grep -c 'vtp-plan\|vtp-consume\|vtp-finalize' super-gsd/skills/sgsd-triage/SKILL.md   # must be > 0

## Report contract (exact sections, max 300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none
ONE_LINER: substantive summary
STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED
```

## Combined raw diff (working tree vs 98ce67e)
```diff
diff --git a/super-gsd/scripts/sgsd-triage-runtime.cjs b/super-gsd/scripts/sgsd-triage-runtime.cjs
index 18ff969..02fde04 100644
--- a/super-gsd/scripts/sgsd-triage-runtime.cjs
+++ b/super-gsd/scripts/sgsd-triage-runtime.cjs
@@ -25,6 +25,12 @@ const triageVerdictSchema = require('./lib/triage-verdict-schema.cjs');
 
 const ROUTE_TOOL = 'mcp__vtp-kb__vtp_route_and_retrieve';
 const SEARCH_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
+const ROUTE_STAGE_TOOL = 'vtp_route_and_retrieve';
+const SEARCH_STAGE_TOOL = 'vtp_search_substrate';
+const VTP_STAGE_PLAN = 'vtp-plan';
+const VTP_STAGE_CONSUME = 'vtp-consume';
+const VTP_STAGE_FINALIZE = 'vtp-finalize';
+const VTP_RESPONSE_MAX_BYTES = 128 * 1024;
 const DEFAULT_SKILL_OR_AGENT = 'sgsd-triage-runtime';
 const TRIAGE_DEGRADED_SIGNAL = 'triage_vtp_degraded';
 const TRIAGE_CODEX_DEGRADED_SIGNAL = 'triage_codex_degraded';
@@ -34,6 +40,7 @@ const TRIAGE_CLAUDE_INVALID_SIGNAL = 'triage_claude_invalid';
 const TRIAGE_VERDICT_EVENT = 'triage_codex_verdict';
 const TRIAGE_RECONCILIATION_EVENT = 'triage_reconciliation';
 const ROUTING_LOG_REL = path.join('.planning', 'metrics', 'vtp-routing-log.jsonl');
+const GATE_LOG_REL = path.join('.planning', 'metrics', 'gate-evidence.jsonl');
 const CODEX_EXEC_PATH = path.join(__dirname, 'codex-exec.sh');
 const CODEX_CONTRACT = 'triage-verdict-v1';
 const CODEX_PROFILE = 'triage';
@@ -48,12 +55,17 @@ function usage() {
     'Usage:',
     '  node super-gsd/scripts/sgsd-triage-runtime.cjs --query <text> [--cwd <dir>]',
     '  node super-gsd/scripts/sgsd-triage-runtime.cjs --query-file <relpath> [--cwd <dir>]',
+    '  node super-gsd/scripts/sgsd-triage-runtime.cjs --stage vtp-plan --query-file <relpath> [--cwd <dir>]',
+    '  node super-gsd/scripts/sgsd-triage-runtime.cjs --stage vtp-consume --response-file <relpath> --query-file <relpath> [--cwd <dir>]',
+    '  node super-gsd/scripts/sgsd-triage-runtime.cjs --stage vtp-finalize --response-file <relpath> --query-file <relpath> [--cwd <dir>]',
     '',
     'Options:',
     '  --query <text>        Operator triage query.',
     '  --query-file <path>   Repo-contained file containing the query.',
     '  --cwd <dir>           Start directory for SGSD root discovery.',
     '  --active-file <path>  Optional active file hint for VTP context.',
+    '  --stage <name>        VTP file protocol stage: vtp-plan, vtp-consume, or vtp-finalize.',
+    '  --response-file <path> Repo-contained raw MCP response file for staged VTP consume/finalize.',
     '  --trigger-source <s>  Planning gate source; only planning-triage dispatches Codex.',
     '  --claude-path <A-D>   Claude-side proposed triage path.',
     '  --claude-rationale <text> Claude-side rationale; required with --claude-path.',
@@ -71,6 +83,8 @@ function parseArgs(argv) {
     claudePath: null,
     claudeRationale: null,
     claudeVerdictFile: null,
+    stage: null,
+    responseFile: null,
   };
   for (let index = 0; index < argv.length; index += 1) {
     const arg = argv[index];
@@ -88,6 +102,12 @@ function parseArgs(argv) {
     } else if (arg === '--active-file') {
       out.activeFile = argv[index + 1] || '';
       index += 1;
+    } else if (arg === '--stage') {
+      out.stage = argv[index + 1] || '';
+      index += 1;
+    } else if (arg === '--response-file') {
+      out.responseFile = argv[index + 1] || '';
+      index += 1;
     } else if (arg === '--trigger-source') {
       out.triggerSource = argv[index + 1] || '';
       index += 1;
@@ -369,6 +389,471 @@ function buildContext(root, state, rawQuery, options) {
   return { ctx, triageSlice: project(ctx, 'triage') };
 }
 
+function vtpStageResponseRel(state, kind) {
+  const phase = normalizePhase(state && state.phase) || 'unknown';
+  const safeKind = safeSegment(kind) || 'response';
+  const stamp = new Date().toISOString().replace(/[^0-9A-Za-z]/g, '-');
+  return path.join('.planning', 'tmp', `sgsd-triage-vtp-${phase}-${process.pid}-${stamp}-${safeKind}-response.json`);
+}
+
+function vtpStageMetaRel(responseRel) {
+  const rel = String(responseRel || '').trim();
+  return rel ? `${rel}.meta.json` : null;
+}
+
+function ensureStageWriteTarget(root, rel) {
+  const target = resolveContainedPath(root, String(rel || ''));
+  if (!target) return null;
+  try {
+    fs.mkdirSync(path.dirname(target), { recursive: true });
+    return target;
+  } catch {
+    return null;
+  }
+}
+
+function shortStageTool(tool) {
+  if (tool === ROUTE_TOOL) return ROUTE_STAGE_TOOL;
+  if (tool === SEARCH_TOOL) return SEARCH_STAGE_TOOL;
+  return String(tool || '');
+}
+
+function stageInvokeResult(tool, args, responseRel, extras = {}) {
+  return {
+    stageProtocol: true,
+    exitCode: 0,
+    action: 'invoke_mcp',
+    tool: shortStageTool(tool),
+    mcp_tool: tool,
+    args,
+    response_file: responseRel.replace(/\\/g, '/'),
+    ...extras,
+  };
+}
+
+function stageEvidencePath(root, evidencePath, evidenceRel) {
+  if (evidenceRel) return evidenceRel.replace(/\\/g, '/');
+  return evidencePath ? relForRow(root, evidencePath) : null;
+}
+
+function readStagedLedgerRows(root, rel) {
+  try {
+    const target = resolveContainedPath(root, rel);
+    if (!target || !fs.existsSync(target)) return [];
+    return fs.readFileSync(target, 'utf8')
+      .split(/\r?\n/)
+      .filter(Boolean)
+      .map((line) => {
+        try { return JSON.parse(line); } catch { return null; }
+      })
+      .filter((row) => row && typeof row === 'object' && !Array.isArray(row));
+  } catch {
+    return [];
+  }
+}
+
+function stagedField(value) {
+  return value === undefined ? null : value;
+}
+
+function sameStagedField(left, right) {
+  return stagedField(left) === stagedField(right);
+}
+
+function findStagedDegradationRow(root, params = {}) {
+  return readStagedLedgerRows(root, GATE_LOG_REL).find((row) => (
+    row.signal === TRIAGE_DEGRADED_SIGNAL &&
+    Array.isArray(row.reason_codes) &&
+    row.reason_codes.includes(params.reasonCode) &&
+    sameStagedField(row.raw_query, params.rawQuery || '') &&
+    sameStagedField(row.fallback_predicate, params.fallbackPredicate || null) &&
+    sameStagedField(row.route_failure_reason, params.routeFailureReason || null) &&
+    sameStagedField(row.fallback_failure_reason, params.fallbackFailureReason || null)
+  ));
+}
+
+function logStagedDegradation(root, state, params) {
+  const existing = findStagedDegradationRow(root, params || {});
+  if (existing) return existing;
+  return logDegradation(root, state, params);
+}
+
+function stageCompleteResult(root, params = {}) {
+  return {
+    stageProtocol: true,
+    exitCode: 0,
+    action: params.action || 'complete',
+    reasonCode: params.reasonCode || null,
+    vtpMode: params.mode || null,
+    routeOk: params.routeOk === true,
+    fallbackAttempted: params.fallbackAttempted === true,
+    fallbackPredicate: params.fallbackPredicate || null,
+    degradationNotes: Array.isArray(params.degradationRows) ? params.degradationRows.map(summarizeDegradationRow) : [],
+    evidencePath: stageEvidencePath(root, params.evidencePath, params.evidenceRel),
+  };
+}
+
+function appendStagedVtpRoutingRow(root, params = {}) {
+  const fields = extractRouteFields(params.response || null);
+  const topDoc = fields.documents[0] && fields.documents[0].doc_id ? fields.documents[0].doc_id : null;
+  const row = {
+    event: 'vtp_call',
+    status: params.status || (params.failureReason ? 'failure' : (fields.evidence_hit_count === 0 ? 'zero_hits' : 'success')),
+    tier: 'triage',
+    skill_or_agent: params.skillOrAgent || DEFAULT_SKILL_OR_AGENT,
+    raw_query: params.rawQuery || '',
+    selected_query: fields.selected_query,
+    retrieval_mode: fields.retrieval_mode,
+    reflection_verdict: fields.reflection_verdict,
+    evidence_hit_count: fields.evidence_hit_count,
+    top_doc_id: topDoc,
+    elapsed_ms: 0,
+    transport: 'claude_file_protocol',
+    tool: shortStageTool(params.tool),
+    response_file: params.responseFile ? String(params.responseFile).replace(/\\/g, '/') : undefined,
+    failure_reason: params.failureReason || undefined,
+  };
+  const existing = readStagedLedgerRows(root, ROUTING_LOG_REL).find((candidate) => (
+    candidate.event === row.event &&
+    candidate.transport === row.transport &&
+    candidate.tool === row.tool &&
+    candidate.raw_query === row.raw_query &&
+    sameStagedField(candidate.response_file, row.response_file) &&
+    sameStagedField(candidate.top_doc_id, row.top_doc_id) &&
+    sameStagedField(candidate.failure_reason, row.failure_reason)
+  ));
+  if (existing) return existing;
+  return appendRoutingRow(root, row);
+}
+
+function readStageResponseFile(root, responseFile) {
+  const rel = String(responseFile || '').trim();
+  const target = resolveContainedPath(root, rel);
+  if (!target) return { ok: false, reasonCode: 'vtp_response_file_uncontained', reason: 'response_file_not_contained' };
+  try {
+    const stat = fs.statSync(target);
+    if (!stat.isFile()) return { ok: false, reasonCode: 'vtp_response_file_missing', reason: 'response_file_not_regular' };
+    if (stat.size > VTP_RESPONSE_MAX_BYTES) {
+      return { ok: false, reasonCode: 'vtp_response_file_oversized', reason: `response_file_oversized:${stat.size}` };
+    }
+    const text = fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, '');
+    const parsed = JSON.parse(text);
+    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
+      return { ok: false, reasonCode: 'vtp_response_file_invalid_shape', reason: 'response_json_not_object' };
+    }
+    return { ok: true, response: parsed, rel: rel.replace(/\\/g, '/'), target };
+  } catch (error) {
+    if (error && error.code === 'ENOENT') return { ok: false, reasonCode: 'vtp_response_file_missing', reason: 'response_file_missing' };
+    if (error instanceof SyntaxError) return { ok: false, reasonCode: 'vtp_response_file_invalid_json', reason: 'response_json_parse_failed' };
+    return { ok: false, reasonCode: 'vtp_response_file_unreadable', reason: reasonFromError(error, 'response_file_unreadable') };
+  }
+}
+
+function writeStageMeta(root, responseRel, meta) {
+  const rel = vtpStageMetaRel(responseRel);
+  const target = rel ? ensureStageWriteTarget(root, rel) : null;
+  if (!target) return null;
+  try {
+    fs.writeFileSync(target, `${JSON.stringify(meta)}\n`, 'utf8');
+    return rel;
+  } catch {
+    return null;
+  }
+}
+
+function readStageMeta(root, responseRel) {
+  const rel = vtpStageMetaRel(responseRel);
+  if (!rel) return null;
+  const result = readStageResponseFile(root, rel);
+  return result.ok ? result.response : null;
+}
+
+function completeStageDegraded(root, state, rawQuery, params = {}) {
+  const evidenceRel = params.evidenceRel || evidenceRelPath(root, state);
+  const degradationRows = [];
+  degradationRows.push(logStagedDegradation(root, state, {
+    reasonCode: params.reasonCode,
+    rawQuery,
+    routeOk: params.routeOk === true,
+    fallbackPredicate: params.fallbackPredicate || null,
+    evidenceRel,
+    routeFailureReason: params.routeFailureReason || params.reasonCode,
+    fallbackFailureReason: params.fallbackFailureReason || null,
+    skillOrAgent: params.skillOrAgent,
+    silent: params.silent,
+    nextActionPayload: params.nextActionPayload || {
+      continue_evidence_less: true,
+      reason: params.reasonCode,
+    },
+  }));
+  const evidencePath = writeVtpEvidence(root, state, {
+    evidenceRel,
+    rawQuery,
+    mode: 'evidence_less',
+    selectedResponse: null,
+    routePayload: params.routePayload || null,
+    fallbackPayload: params.fallbackPayload || null,
+    routeResult: params.routeResult || { ok: false, reason: params.reasonCode, elapsed_ms: null },
+    fallbackResult: params.fallbackResult || null,
+    fallbackPredicate: params.fallbackPredicate || null,
+  });
+  return stageCompleteResult(root, {
+    reasonCode: params.reasonCode,
+    mode: 'evidence_less',
+    routeOk: params.routeOk === true,
+    fallbackAttempted: params.fallbackAttempted === true,
+    fallbackPredicate: params.fallbackPredicate || null,
+    evidencePath,
+    evidenceRel,
+    degradationRows: degradationRows.filter(Boolean),
+  });
+}
+
+async function runVtpStage(root, state, rawQuery, triageSlice, evidenceRel, options = {}) {
+  try {
+    const stage = String(options.stage || '').trim();
+    const routePayload = { raw_query: rawQuery, context: triageSlice };
+
+    if (stage === VTP_STAGE_PLAN) {
+      if (!readTriageVtpEnrichmentEnabled(root)) {
+        const degraded = completeStageDegraded(root, state, rawQuery, {
+          reasonCode: 'vtp_enrichment_disabled',
+          evidenceRel,
+          routePayload: null,
+          skillOrAgent: options.skillOrAgent,
+          silent: options.silent,
+          nextActionPayload: {
+            continue_evidence_less: true,
+            vtp_enrichment_disabled: true,
+          },
+        });
+        return { ...degraded, action: 'skip' };
+      }
+      const responseRel = vtpStageResponseRel(state, 'route');
+      if (!ensureStageWriteTarget(root, responseRel)) {
+        return completeStageDegraded(root, state, rawQuery, {
+          reasonCode: 'vtp_response_file_uncontained',
+          evidenceRel,
+          routePayload,
+          skillOrAgent: options.skillOrAgent,
+          silent: options.silent,
+        });
+      }
+      return stageInvokeResult(ROUTE_TOOL, routePayload, responseRel, { stage });
+    }
+
+    if (stage === VTP_STAGE_CONSUME) {
+      const loaded = readStageResponseFile(root, options.responseFile);
+      if (!loaded.ok) {
+        return completeStageDegraded(root, state, rawQuery, {
+          reasonCode: loaded.reasonCode,
+          routeFailureReason: loaded.reason,
+          evidenceRel,
+          routePayload,
+          skillOrAgent: options.skillOrAgent,
+          silent: options.silent,
+          nextActionPayload: {
+            continue_evidence_less: true,
+            response_file: String(options.responseFile || '').replace(/\\/g, '/'),
+            reason: loaded.reasonCode,
+          },
+        });
+      }
+
+      const routeResult = { ok: true, response: loaded.response, elapsed_ms: 0 };
+      appendStagedVtpRoutingRow(root, {
+        tool: ROUTE_TOOL,
+        response: loaded.response,
+        rawQuery,
+        skillOrAgent: options.skillOrAgent,
+        responseFile: loaded.rel,
+      });
+      const predicate = fallbackPredicate(loaded.response);
+      if (predicate) {
+        const degradationRows = [];
+        degradationRows.push(logStagedDegradation(root, state, {
+          reasonCode: predicate.reasonCode,
+          rawQuery,
+          routeOk: true,
+          fallbackPredicate: predicate.predicate,
+          evidenceHitCount: predicate.evidenceHitCount,
+          evidenceRel,
+          skillOrAgent: options.skillOrAgent,
+          silent: options.silent,
+          nextActionPayload: {
+            direct_search_attempted: true,
+            fallback_predicate: predicate.predicate,
+          },
+        }));
+        const fallbackPayload = {
+          raw_query: rawQuery,
+          query: rawQuery,
+          context: triageSlice,
+          fallback_reason: predicate.predicate,
+        };
+        const responseRel = vtpStageResponseRel(state, `fallback-${predicate.predicate}`);
+        if (!ensureStageWriteTarget(root, responseRel)) {
+          return completeStageDegraded(root, state, rawQuery, {
+            reasonCode: 'vtp_response_file_uncontained',
+            evidenceRel,
+            routeOk: true,
+            fallbackAttempted: true,
+            fallbackPredicate: predicate.predicate,
+            routePayload,
+            routeResult,
+            fallbackPayload,
+            degradationRows,
+            skillOrAgent: options.skillOrAgent,
+            silent: options.silent,
+          });
+        }
+        writeStageMeta(root, responseRel, {
+          routePayload,
+          routeResponse: loaded.response,
+          fallbackPayload,
+          fallbackPredicate: predicate.predicate,
+          evidenceRel,
+        });
+        return stageInvokeResult(SEARCH_TOOL, fallbackPayload, responseRel, {
+          stage,
+          fallbackAttempted: true,
+          fallbackPredicate: predicate.predicate,
+          degradationNotes: degradationRows.filter(Boolean).map(summarizeDegradationRow),
+        });
+      }
+
+      const evidencePath = writeVtpEvidence(root, state, {
+        evidenceRel,
+        rawQuery,
+        mode: 'route',
+        selectedResponse: loaded.response,
+        routePayload,
+        fallbackPayload: null,
+        routeResult,
+        fallbackResult: null,
+        fallbackPredicate: null,
+      });
+      return stageCompleteResult(root, {
+        mode: 'route',
+        routeOk: true,
+        fallbackAttempted: false,
+        evidencePath,
+        evidenceRel,
+        degradationRows: [],
+      });
+    }
+
+    if (stage === VTP_STAGE_FINALIZE) {
+      const meta = readStageMeta(root, options.responseFile) || {};
+      const fallbackPayload = meta.fallbackPayload || {
+        raw_query: rawQuery,
+        query: rawQuery,
+        context: triageSlice,
+        fallback_reason: meta.fallbackPredicate || null,
+      };
+      const loaded = readStageResponseFile(root, options.responseFile);
+      if (!loaded.ok) {
+        return completeStageDegraded(root, state, rawQuery, {
+          reasonCode: loaded.reasonCode,
+          routeFailureReason: null,
+          fallbackFailureReason: loaded.reason,
+          evidenceRel,
+          routeOk: Boolean(meta.routeResponse),
+          fallbackAttempted: true,
+          fallbackPredicate: meta.fallbackPredicate || null,
+          routePayload: meta.routePayload || routePayload,
+          routeResult: meta.routeResponse ? { ok: true, response: meta.routeResponse, elapsed_ms: 0 } : null,
+          fallbackPayload,
+          fallbackResult: { ok: false, reason: loaded.reasonCode, elapsed_ms: null },
+          skillOrAgent: options.skillOrAgent,
+          silent: options.silent,
+          nextActionPayload: {
+            continue_evidence_less: true,
+            response_file: String(options.responseFile || '').replace(/\\/g, '/'),
+            reason: loaded.reasonCode,
+          },
+        });
+      }
+
+      appendStagedVtpRoutingRow(root, {
+        tool: SEARCH_TOOL,
+        response: loaded.response,
+        rawQuery,
+        skillOrAgent: options.skillOrAgent,
+        responseFile: loaded.rel,
+      });
+      const fallbackResult = { ok: true, response: loaded.response, elapsed_ms: 0 };
+      const evidencePath = writeVtpEvidence(root, state, {
+        evidenceRel,
+        rawQuery,
+        mode: 'fallback',
+        selectedResponse: loaded.response,
+        routePayload: meta.routePayload || routePayload,
+        fallbackPayload,
+        routeResult: meta.routeResponse ? { ok: true, response: meta.routeResponse, elapsed_ms: 0 } : null,
+        fallbackResult,
+        fallbackPredicate: meta.fallbackPredicate || null,
+      });
+      return stageCompleteResult(root, {
+        mode: 'fallback',
+        routeOk: Boolean(meta.routeResponse),
+        fallbackAttempted: true,
+        fallbackPredicate: meta.fallbackPredicate || null,
+        evidencePath,
+        evidenceRel,
+        degradationRows: [],
+      });
+    }
+
+    return { stageProtocol: true, exitCode: 0, action: 'skip', reasonCode: 'vtp_stage_unknown', vtpMode: null };
+  } catch (error) {
+    return completeStageDegraded(root, state, rawQuery, {
+      reasonCode: 'vtp_stage_exception',
+      routeFailureReason: reasonFromError(error, 'vtp_stage_exception'),
+      evidenceRel,
+      skillOrAgent: options.skillOrAgent,
+      silent: options.silent,
+    });
+  }
+}
+
+function serializeStageResult(result) {
+  const r = result && typeof result === 'object' ? result : {};
+  if (r.action === 'invoke_mcp') {
+    return {
+      action: 'invoke_mcp',
+      tool: boundedString(r.tool, 100),
+      mcp_tool: boundedString(r.mcp_tool, 150),
+      args: boundedValue(r.args || {}),
+      response_file: boundedString(r.response_file, 500),
+      fallbackAttempted: r.fallbackAttempted === true,
+      fallbackPredicate: boundedString(r.fallbackPredicate, 100),
+      degradationNotes: Array.isArray(r.degradationNotes) ? r.degradationNotes : [],
+    };
+  }
+  if (r.action === 'skip') {
+    return {
+      action: 'skip',
+      reason: boundedString(r.reason || r.reasonCode, 100),
+      vtpMode: boundedString(r.vtpMode || r.mode, 50),
+      routeOk: r.routeOk === true,
+      fallbackAttempted: r.fallbackAttempted === true,
+      fallbackPredicate: boundedString(r.fallbackPredicate, 100),
+      degradationNotes: Array.isArray(r.degradationNotes) ? r.degradationNotes : [],
+      evidencePath: boundedString(r.evidencePath, 500),
+    };
+  }
+  return {
+    action: boundedString(r.action || 'complete', 50),
+    reasonCode: boundedString(r.reasonCode || r.reason, 100),
+    vtpMode: boundedString(r.vtpMode || r.mode, 50),
+    routeOk: r.routeOk === true,
+    fallbackAttempted: r.fallbackAttempted === true,
+    fallbackPredicate: boundedString(r.fallbackPredicate, 100),
+    degradationNotes: Array.isArray(r.degradationNotes) ? r.degradationNotes : [],
+    evidencePath: boundedString(r.evidencePath, 500),
+  };
+}
 function readTriageVtpEnrichmentEnabled(root) {
   const reader = vtpContextComposer && vtpContextComposer._internal && vtpContextComposer._internal.readConfigToggle;
   if (typeof reader !== 'function') return true;
@@ -939,6 +1424,12 @@ async function runTriageRuntime(options = {}) {
   if (!rawQuery && options.queryFile) rawQuery = readQueryFile(root, options.queryFile);
   rawQuery = String(rawQuery || '').trim();
 
+  if (options.stage) {
+    const evidenceRel = evidenceRelPath(root, state);
+    const { triageSlice } = buildContext(root, state, rawQuery, options);
+    return runVtpStage(root, state, rawQuery, triageSlice, evidenceRel, options);
+  }
+
   const triggerSource = String(options.triggerSource || '').trim();
   const claudeCandidate = loadClaudeVerdict(root, options);
   const claudeValidation = validateClaudeVerdict(claudeCandidate);
@@ -1148,7 +1639,7 @@ async function main(argv = process.argv.slice(2)) {
     return 0;
   }
   const result = await runTriageRuntime(args);
-  console.log(JSON.stringify(serializeCliResult(result)));
+  console.log(JSON.stringify(result && result.stageProtocol ? serializeStageResult(result) : serializeCliResult(result)));
   return result.exitCode;
 }
 
@@ -1170,6 +1661,7 @@ module.exports = {
   parseArgs,
   runTriageRuntime,
   serializeCliResult,
+  serializeStageResult,
   TRIAGE_CODEX_DEGRADED_SIGNAL,
   TRIAGE_CODEX_SKIPPED_SIGNAL,
   TRIAGE_RECONCILIATION_SIGNAL,
diff --git a/super-gsd/skills/sgsd-triage/SKILL.md b/super-gsd/skills/sgsd-triage/SKILL.md
index 3b6e564..dfdc77e 100644
--- a/super-gsd/skills/sgsd-triage/SKILL.md
+++ b/super-gsd/skills/sgsd-triage/SKILL.md
@@ -38,13 +38,18 @@ Eliminates the *"ad-hoc planning, then realise I should have briefed the board /
 
 ## Step 0: Runtime VTP enrichment
 
-Before brainstorming, hand the raw operator query to the runtime. Never pass the query inline through shell quoting.
+Before brainstorming, hand the raw operator query to the runtime through the staged file protocol. Never pass the query inline through shell quoting. The runtime decides; Claude transports.
 
 1. Write the raw query verbatim to a repo-contained temp file: `.planning/tmp/sgsd-triage-query-{YYYYMMDDTHHMMSSZ}-{pid}.txt`.
-2. Invoke the runtime with the relative file path:
-   `node super-gsd/scripts/sgsd-triage-runtime.cjs --query-file .planning/tmp/sgsd-triage-query-{stamp}-{pid}.txt --cwd . [--active-file <relpath>]`
-3. Read the one JSON object printed to stdout. It contains `mode`, `vtpMode`, `singleModel`, `codex`, `reconciliation`, `degradationNotes`, and `evidencePath`; do not infer from in-process objects.
-4. The runtime reads STATE, applies `workflow.triage_vtp_enrichment`, and writes contained evidence/log rows. When `.planning/config.json` sets `workflow.triage_vtp_enrichment: false`, it skips VTP calls, emits `vtp_enrichment_disabled`, and continues evidence-less. Route failure emits `vtp_route_failed` and continues evidence-less; fallback is only for low-yield route predicates.
+2. Invoke the plan stage with the relative file path:
+   `node super-gsd/scripts/sgsd-triage-runtime.cjs --stage vtp-plan --query-file .planning/tmp/sgsd-triage-query-{stamp}-{pid}.txt --cwd . [--active-file <relpath>]`
+3. Read the one JSON object printed to stdout. If it is `{action:"skip", reason}`, call no MCP tool and continue evidence-less with that reason.
+4. If it is `{action:"invoke_mcp", tool, args, response_file}`, execute the emitted MCP call VERBATIM: call exactly `tool` with exactly `args`, save the raw JSON response to `response_file`, then re-invoke:
+   `node super-gsd/scripts/sgsd-triage-runtime.cjs --stage vtp-consume --query-file .planning/tmp/sgsd-triage-query-{stamp}-{pid}.txt --cwd . --response-file <response_file>`
+5. Read the `vtp-consume` stdout. If it is complete, keep that runtime result. If it emits one fallback `{action:"invoke_mcp", tool, args, response_file}`, execute the emitted MCP call VERBATIM, save the raw JSON response, then re-invoke exactly once:
+   `node super-gsd/scripts/sgsd-triage-runtime.cjs --stage vtp-finalize --query-file .planning/tmp/sgsd-triage-query-{stamp}-{pid}.txt --cwd . --response-file <response_file>`
+6. Read the final `vtp-consume` or `vtp-finalize` JSON. It contains `vtpMode`, `degradationNotes`, and `evidencePath`; do not infer from in-process objects. No interpretation: execute emitted MCP calls verbatim, save the response, re-invoke.
+7. The runtime reads STATE, applies `workflow.triage_vtp_enrichment`, validates untrusted response files, and writes contained evidence/log rows. System-wide disable via `workflow.triage_vtp_enrichment: false` returns `action:"skip"` with `reason:"vtp_enrichment_disabled"`; fallback is only for runtime-selected low-yield route predicates and allows one more loop.
 
 **Trigger exclusion (D-06):** Step 0 still relies on the existing `<trigger>` block's "Do NOT invoke when..." list (trivial questions, execution requests, mid-build fixes) to handle Path D style queries. No per-call flag - see D-06 rationale. System-wide disable via `workflow.triage_vtp_enrichment: false`.
 
diff --git a/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs b/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
index f07af52..490483c 100644
--- a/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
+++ b/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
@@ -67,6 +67,12 @@ function usage() {
     '  prompt-injection-closed-vocabulary',
     '  claude-invalid-refused',
     '  runtime-dispatch-reconciliation',
+    '  staged-vtp-healthy',
+    '  staged-vtp-null-reflection-fallback',
+    '  staged-vtp-garbage-response',
+    '  staged-vtp-oversized-response',
+    '  staged-vtp-skip-reason-contract',
+    '  vtp-stage-no-codex-gate',
     '  all',
     '',
     'Plan aliases:',
@@ -246,6 +252,58 @@ function readJsonl(root, subpath) {
     .map((line) => JSON.parse(line));
 }
 
+function runRuntimeCli(args, options = {}) {
+  return childProcess.spawnSync(process.execPath, [runtimePath, ...args], {
+    cwd: repoRoot,
+    env: options.env || process.env,
+    encoding: 'utf8',
+    windowsHide: true,
+    maxBuffer: 1024 * 1024,
+  });
+}
+
+function parseRuntimeCliJson(cli, label) {
+  assert.strictEqual(cli.status, 0, `${label} should exit 0; stderr=${cli.stderr || cli.error || ''}`);
+  const stdout = String(cli.stdout || '').trim();
+  assert(stdout, `${label} must emit one JSON object`);
+  return JSON.parse(stdout);
+}
+
+function writeStageQuery(fixture, slug, rawQuery) {
+  const queryRel = path.join('.planning', 'tmp', `${slug}-query.txt`);
+  writeContainedFile(fixture.repoDir, queryRel, rawQuery);
+  return queryRel;
+}
+
+function invokeVtpPlanStage(fixture, queryRel, label) {
+  return parseRuntimeCliJson(runRuntimeCli([
+    '--stage', 'vtp-plan',
+    '--query-file', queryRel,
+    '--cwd', fixture.repoDir,
+  ]), label);
+}
+
+function invokeVtpConsumeStage(fixture, queryRel, responseFile, label) {
+  return parseRuntimeCliJson(runRuntimeCli([
+    '--stage', 'vtp-consume',
+    '--query-file', queryRel,
+    '--cwd', fixture.repoDir,
+    '--response-file', responseFile,
+  ]), label);
+}
+
+function invokeVtpFinalizeStage(fixture, queryRel, responseFile, label) {
+  return parseRuntimeCliJson(runRuntimeCli([
+    '--stage', 'vtp-finalize',
+    '--query-file', queryRel,
+    '--cwd', fixture.repoDir,
+    '--response-file', responseFile,
+  ]), label);
+}
+
+function writeStageResponse(fixture, responseFile, value) {
+  writeContainedFile(fixture.repoDir, responseFile, `${JSON.stringify(value)}\n`);
+}
 function assertContainedExistingFile(root, subpath) {
   const target = contained(root, subpath);
   assert.strictEqual(fs.existsSync(target), true, `${subpath} should exist`);
@@ -1310,6 +1368,153 @@ async function assertRuntimeDispatchReconciliation() {
   await assertPromptInjectionClosedVocabulary();
   await assertClaudeInvalidRefused();
 }
+async function assertStagedVtpHealthy() {
+  const fixture = createSgsdFixture({ repoId: 'staged-vtp-healthy' });
+  try {
+    const rawQuery = 'fixture staged healthy route 148';
+    const queryRel = writeStageQuery(fixture, 'staged-healthy', rawQuery);
+    const plan = invokeVtpPlanStage(fixture, queryRel, 'vtp-plan healthy');
+    assert.strictEqual(plan.action, 'invoke_mcp');
+    assert.strictEqual(plan.tool, 'vtp_route_and_retrieve');
+    assert.strictEqual(plan.args.raw_query, rawQuery);
+    assert(plan.args.context && typeof plan.args.context === 'object', 'plan must include runtime-built VTP context');
+    contained(fixture.repoDir, plan.response_file);
+
+    writeStageResponse(fixture, plan.response_file, routeResponse({ reflection: { verdict: 'sufficient' }, hits: 2, docPrefix: 'fixture-staged-route-doc' }));
+    const complete = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume healthy');
+    assert.strictEqual(complete.action, 'complete');
+    assert.strictEqual(complete.vtpMode, 'route');
+    assert.strictEqual(complete.fallbackAttempted, false);
+    assert.strictEqual(complete.evidencePath, VTP_EVIDENCE_REL.replace(/\\/g, '/'));
+    const completeAgain = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume healthy replay');
+    assert.strictEqual(completeAgain.action, 'complete');
+    assert.strictEqual(completeAgain.vtpMode, 'route');
+
+    const routingRows = readJsonl(fixture.repoDir, ROUTING_LOG_REL);
+    assert.strictEqual(routingRows.length, 1, 'healthy staged route should write one VTP routing row');
+    assert.strictEqual(routingRows[0].top_doc_id, 'fixture-staged-route-doc-1');
+    assert.strictEqual(gateRowsBySignal(fixture, 'triage_codex_skipped_gate').length, 0);
+    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
+    assert.match(evidence, /fixture-staged-route-doc-1/);
+    assert.match(evidence, /Mode: route/);
+  } finally {
+    fixture.cleanup();
+  }
+}
+
+async function assertStagedVtpNullReflectionFallback() {
+  const fixture = createSgsdFixture({ repoId: 'staged-vtp-null-reflection' });
+  try {
+    const rawQuery = 'fixture staged null reflection route 148';
+    const queryRel = writeStageQuery(fixture, 'staged-null-reflection', rawQuery);
+    const plan = invokeVtpPlanStage(fixture, queryRel, 'vtp-plan null-reflection');
+    writeStageResponse(fixture, plan.response_file, routeResponse({ reflection: null, hits: 2, docPrefix: 'fixture-staged-route-null' }));
+
+    const fallbackInstruction = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume null-reflection');
+    assert.strictEqual(fallbackInstruction.action, 'invoke_mcp');
+    assert.strictEqual(fallbackInstruction.tool, 'vtp_search_substrate');
+    assert.strictEqual(fallbackInstruction.args.raw_query, rawQuery);
+    assert.strictEqual(fallbackInstruction.args.query, rawQuery);
+    assert.strictEqual(fallbackInstruction.args.fallback_reason, 'reflection_null');
+    contained(fixture.repoDir, fallbackInstruction.response_file);
+
+    const rows = gateRowsWithReason(fixture, 'vtp_fallback_reflection_null');
+    assert.strictEqual(rows.length, 1, 'staged null reflection must append predicate degradation row during consume');
+    assert.strictEqual(rows[0].fallback_predicate, 'reflection_null');
+    const fallbackInstructionAgain = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume null-reflection replay');
+    assert.strictEqual(fallbackInstructionAgain.action, 'invoke_mcp');
+    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_fallback_reflection_null').length, 1, 'staged consume replay must not duplicate predicate degradation rows');
+    assert.strictEqual(readJsonl(fixture.repoDir, ROUTING_LOG_REL).length, 1, 'staged consume replay must not duplicate route rows');
+
+    writeStageResponse(fixture, fallbackInstruction.response_file, searchResponse({ hits: 2, docPrefix: 'fixture-staged-fallback-doc' }));
+    const complete = invokeVtpFinalizeStage(fixture, queryRel, fallbackInstruction.response_file, 'vtp-finalize null-reflection');
+    assert.strictEqual(complete.action, 'complete');
+    assert.strictEqual(complete.vtpMode, 'fallback');
+    assert.strictEqual(complete.fallbackAttempted, true);
+    const completeAgain = invokeVtpFinalizeStage(fixture, queryRel, fallbackInstruction.response_file, 'vtp-finalize null-reflection replay');
+    assert.strictEqual(completeAgain.action, 'complete');
+    assert.strictEqual(completeAgain.vtpMode, 'fallback');
+    assert.strictEqual(gateRowsBySignal(fixture, 'triage_codex_skipped_gate').length, 0);
+
+    const routingRows = readJsonl(fixture.repoDir, ROUTING_LOG_REL);
+    assert.strictEqual(routingRows.length, 2, 'staged fallback should write route and search routing rows');
+    assert.strictEqual(routingRows[1].top_doc_id, 'fixture-staged-fallback-doc-1');
+    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
+    assert.match(evidence, /fixture-staged-fallback-doc-1/);
+    assert.match(evidence, /Mode: fallback/);
+  } finally {
+    fixture.cleanup();
+  }
+}
+
+async function assertStagedVtpGarbageResponse() {
+  const fixture = createSgsdFixture({ repoId: 'staged-vtp-garbage' });
+  try {
+    const queryRel = writeStageQuery(fixture, 'staged-garbage', 'fixture staged garbage response 148');
+    const plan = invokeVtpPlanStage(fixture, queryRel, 'vtp-plan garbage');
+    writeContainedFile(fixture.repoDir, plan.response_file, '{ definitely not json');
+
+    const complete = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume garbage');
+    assert.strictEqual(complete.action, 'complete');
+    assert.strictEqual(complete.vtpMode, 'evidence_less');
+    assert.strictEqual(complete.reasonCode, 'vtp_response_file_invalid_json');
+    const completeAgain = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume garbage replay');
+    assert.strictEqual(completeAgain.action, 'complete');
+    assert.strictEqual(completeAgain.reasonCode, 'vtp_response_file_invalid_json');
+    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_response_file_invalid_json').length, 1);
+    assert.strictEqual(gateRowsBySignal(fixture, 'triage_codex_skipped_gate').length, 0);
+    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
+    assert.match(evidence, /Mode: evidence_less/);
+  } finally {
+    fixture.cleanup();
+  }
+}
+
+async function assertStagedVtpOversizedResponse() {
+  const fixture = createSgsdFixture({ repoId: 'staged-vtp-oversized' });
+  try {
+    const queryRel = writeStageQuery(fixture, 'staged-oversized', 'fixture staged oversized response 148');
+    const plan = invokeVtpPlanStage(fixture, queryRel, 'vtp-plan oversized');
+    writeContainedFile(fixture.repoDir, plan.response_file, JSON.stringify({ payload: 'x'.repeat(300 * 1024) }));
+
+    const complete = invokeVtpConsumeStage(fixture, queryRel, plan.response_file, 'vtp-consume oversized');
+    assert.strictEqual(complete.action, 'complete');
+    assert.strictEqual(complete.vtpMode, 'evidence_less');
+    assert.strictEqual(complete.reasonCode, 'vtp_response_file_oversized');
+    assert.strictEqual(gateRowsWithReason(fixture, 'vtp_response_file_oversized').length, 1);
+    assert.strictEqual(gateRowsBySignal(fixture, 'triage_codex_skipped_gate').length, 0);
+    const evidence = readContainedFile(fixture.repoDir, VTP_EVIDENCE_REL);
+    assert.match(evidence, /No VTP documents available/);
+  } finally {
+    fixture.cleanup();
+  }
+}
+
+async function assertStagedVtpSkipReasonContract() {
+  const fixture = createSgsdFixture({ repoId: 'staged-vtp-skip-reason', triageVtpEnrichment: false });
+  try {
+    const queryRel = writeStageQuery(fixture, 'staged-skip-reason', 'fixture staged skip reason 148');
+    const skip = invokeVtpPlanStage(fixture, queryRel, 'vtp-plan skip reason');
+    assert.strictEqual(skip.action, 'skip');
+    assert.strictEqual(skip.reason, 'vtp_enrichment_disabled');
+    assert.strictEqual(Object.prototype.hasOwnProperty.call(skip, 'reasonCode'), false, 'staged skip contract must emit reason, not reasonCode');
+  } finally {
+    fixture.cleanup();
+  }
+}
+
+async function assertVtpStageNoCodexGate() {
+  const fixture = createSgsdFixture({ repoId: 'vtp-stage-no-codex-gate' });
+  try {
+    const queryRel = writeStageQuery(fixture, 'vtp-stage-no-codex-gate', 'fixture stage no codex gate 148');
+    const plan = invokeVtpPlanStage(fixture, queryRel, 'vtp-plan no-codex-gate');
+    assert.strictEqual(plan.action, 'invoke_mcp');
+    assert.strictEqual(gateRowsBySignal(fixture, 'triage_codex_skipped_gate').length, 0, 'VTP-only stage must not write Codex skip rows');
+    assert.strictEqual(gateRowsBySignal(fixture, 'triage_codex_degraded').length, 0, 'VTP-only stage must not write Codex degraded rows');
+  } finally {
+    fixture.cleanup();
+  }
+}
 async function assertCodexContractJsonSchema() {
   delete require.cache[require.resolve(triageVerdictSchemaPath)];
   const schema = require(triageVerdictSchemaPath);
@@ -1406,8 +1611,13 @@ const scenarios = Object.freeze({
   'prompt-injection-closed-vocabulary': assertPromptInjectionClosedVocabulary,
   'claude-invalid-refused': assertClaudeInvalidRefused,
   'runtime-dispatch-reconciliation': assertRuntimeDispatchReconciliation,
-  all: assertAllScenarioMatrix,
-});
+  'staged-vtp-healthy': assertStagedVtpHealthy,
+  'staged-vtp-null-reflection-fallback': assertStagedVtpNullReflectionFallback,
+  'staged-vtp-garbage-response': assertStagedVtpGarbageResponse,
+  'staged-vtp-oversized-response': assertStagedVtpOversizedResponse,
+  'staged-vtp-skip-reason-contract': assertStagedVtpSkipReasonContract,
+  'vtp-stage-no-codex-gate': assertVtpStageNoCodexGate,
+  all: assertAllScenarioMatrix,});
 
 const scenarioAliases = Object.freeze({
   'ac-planning-codex-row': assertPlanningCodexVerdictRow,
@@ -1464,8 +1674,12 @@ module.exports = {
   assertPromptInjectionClosedVocabulary,
   assertClaudeInvalidRefused,
   assertRuntimeDispatchReconciliation,
-  assertAllScenarioMatrix,
-  assertLowHitFallback,
+  assertStagedVtpHealthy,
+  assertStagedVtpNullReflectionFallback,
+  assertStagedVtpGarbageResponse,
+  assertStagedVtpOversizedResponse,
+  assertVtpStageNoCodexGate,
+  assertAllScenarioMatrix,  assertLowHitFallback,
   assertNonSgsdNoWrite,
   assertVtpEnrichmentDisabled,
   assertVtpEnrichmentEnabled,
```
