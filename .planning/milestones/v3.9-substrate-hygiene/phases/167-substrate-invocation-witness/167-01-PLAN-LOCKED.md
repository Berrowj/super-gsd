---
schema_version: 2
phase: 167
slug: substrate-invocation-witness
milestone: v3.9-substrate-hygiene
status: PLANNED
revision: 3
governing_decision: .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/CONTEXT.md
research_path: .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/RESEARCH.md
depends_on: []
intent: >
  Close the drift, forgetfulness, shortcut, and supported broker-deletion cases
  for raw prompt-owned vtp_search_substrate by witnessing the Claude Code tool
  boundary, denying a non-v2 payload before transport, capping a valid MCP
  result before model delivery, correlating the real invocation with P166
  prompt acceptance without an agent-reported identifier, and withdrawing the
  brokered raw tool whenever hook registrations or source are absent. This
  raises an unfiltered call from zero-effort prompt drift to deliberate
  circumvention, but it does not defeat an actor with arbitrary same-user Bash
  and Write execution, who can read the private upstream manifest, register or
  invoke the upstream directly, or replace the broker and its controls.
execution_mode: serial-codex-with-orchestrator-live-gate
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      An installed Claude Code runtime at version 2.1.240 or later, launched in
      bypass-permissions mode against a disposable local MCP server named
      vtp-kb. The live run first asks the real
      mcp__vtp-kb__vtp_search_substrate tool to send an invalid payload missing
      P166 v2 policy fields, then sends a composer-prepared planning payload to
      the same real MCP tool. The local server returns one hit containing 16001
      JavaScript characters and a unique discarded-tail marker.
    expected_outcome: >
      The installed PreToolUse hook fires in the live Claude runtime, returns a
      deny decision before the invalid call reaches the MCP server, and the
      denial still holds under bypass-permissions. The valid call reaches the
      local server exactly once. The installed PostToolUse hook then uses the
      existing capSubstrateResponse and updatedMCPToolOutput contract so the
      transcript seen by the model contains exactly 16000 retained characters,
      contains the P166 degradation note, and does not contain the discarded
      marker. The capture records Claude version, effective hook registrations
      and source hashes, redacted session correlation, MCP server invocation
      rows, hook audit rows, and the post-hook transcript output in
      167-REAL-MCP-HOOK-EVIDENCE.json. A direct invocation of hook functions or
      a staged response is not acceptable evidence for this criterion.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --capture
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json &&
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --verify
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
  - input: >
      A real prepareSubstrateCall planning envelope and matching prompt call
      record, together with a hook-authored PreToolUse/PostToolUse witness for
      the same CLAUDE_CODE_SESSION_ID and substratePayloadDigest. The same
      record is then replayed, a signed row is edited, a row is copied to a
      second session, and records are submitted with no witness or only an
      agent-supplied tool-use identifier.
    expected_outcome: >
      acceptPromptSubstrateCallRecord locates a fresh rewritten witness by the
      runtime session and payload SHA-256, consumes exactly one internally keyed
      row atomically, and returns success without receiving or exposing a
      tool_use_id. Replay, cross-session reuse, HMAC mismatch, missing witness,
      pre-only witness, ambiguous or expired witness, and a caller-provided
      identifier all fail with a named substrate_witness reason. This provides
      keyed tamper-evidence, edit detection, and one-use replay resistance. It
      does not claim resistance to a determined process with arbitrary code
      execution as the same OS user, key access, or authority to replace both
      the hook and acceptance code.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance
  - input: >
      A disposable SGSD project and isolated USERPROFILE whose global legacy
      planner/researcher agents and direct stdio vtp-kb definition exist but
      whose project .claude/settings.json, witness key, guarded MCP capability,
      and P167 prompt markers are absent, followed by feature-propagation audit
      and repair-safe. After repair, each witness registration is removed in
      turn and audit, capability discovery, and prompt acceptance are run again.
    expected_outcome: >
      Initial audit exits 2 with
      project_claude_substrate_witness_missing_or_stale. repair-safe provisions
      the local witness authority, idempotently installs exactly one project
      PreToolUse and one project PostToolUse registration, moves the effective
      direct vtp-kb definition into a private upstream manifest, and makes the
      broker the only Claude-visible vtp-kb server before installing or patching
      any raw-substrate agent. It reports exact commands, matchers, source and
      upstream-config digests, key status, and capability state without secrets.
      All four installed prompt surfaces carry the P167 preflight and
      fail-closed acceptance contract. Removing either registration makes audit
      exit 2, makes the broker withdraw vtp_search_substrate from tools/list and
      deny a stale tools/call before upstream transport, and makes the next
      prompt record fail acceptance with VTP_STATUS unavailable_or_bypassed and
      reason substrate_witness_unavailable. Unrelated settings and agent content
      are byte-preserved, and a second repair is byte-idempotent.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs &&
      node super-gsd/tools/feature-propagation/audit.cjs --self-test &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current
  - input: >
      The repaired disposable profile and real Claude Code runtime from SAC 1,
      after deleting both P167 project hook registrations and deleting the
      project hook source. The guarded vtp-kb broker remains configured against
      the local oversized fixture, and the fresh bypass-permissions session is
      explicitly asked to invoke mcp__vtp-kb__vtp_search_substrate.
    expected_outcome: >
      Before any upstream tools/call, the broker's successful tools/list omits
      vtp_search_substrate because exact registration and source readiness both
      fail. Any stale or forced tools/call is rejected by the broker's second
      readiness check without forwarding. The fixture server's own append-only
      invocation log contains zero tools/call rows, and the Claude transcript
      contains neither a substrate tool result nor the fixture's unique raw
      response and discarded-tail markers. Audit exit 2 and prompt-acceptance
      refusal are recorded only as supporting observations; they are not the
      proof. The independent proof is zero fixture invocations plus no raw
      transcript delivery.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --capture
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json &&
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --verify
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
  - input: >
      The repaired disposable profile, private upstream manifest, real Claude
      Code runtime, and local fixture from SAC 1, exercised as a same-user
      bypass characterisation. A Bash-capable actor reads the private manifest,
      adds an alternate Claude-visible MCP server name that points directly to
      the fixture, and invokes vtp_search_substrate through a fresh real Claude
      process. The actor then starts the same upstream directly and sends a
      second tools/call over Bash/stdio. Distinct fixture payload markers and
      before/after witness-store snapshots identify both attempts.
    expected_outcome: >
      Both bypass attempts intentionally succeed and are recorded, rather than
      being blocked, failed, or skipped. The alternate registration is
      discoverable and forwards one tools/call, the direct Bash/stdio client
      forwards one tools/call, and the fixture server's append-only log contains
      both distinguished rows. Neither attempt creates a matching authenticated
      or mirrored witness row. The capture records redacted commands, source and
      configuration digests, success status, fixture-log digest, invocation
      counts, and witness absence in a same_user_bypass object. This is a
      mandatory positive characterisation proving that a same-user actor with
      Bash can reach the upstream without a witness row; it does not claim to
      close that path.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --capture
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json &&
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --verify
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
  - input: >
      The P166 eight-site caller inventory, a 16001-character top-level and
      evidence.hits response, the P152 shadow proof, frozen P154 real MCP
      evidence, and byte snapshots of vtp-mcp-input-schemas.v1.json and
      154-REAL-MCP-EVIDENCE.json, exercised after every P167 task.
    expected_outcome: >
      P167 adds a witness without weakening the P166 gateway, prompt gateway
      evidence, eight-site closed inventory, 16000 character per-hit cap, or
      acceptPromptSubstrateCallRecord. capSubstrateResponse and
      substratePayloadDigest each retain one production implementation and are
      called by the hook. VTP_RESPONSE_MAX_BYTES is unchanged and still bites.
      The v1 schema and P154 evidence are byte-identical to their pre-P167
      snapshots, and no VTP-host file or wiki/LINT-REPORT.md is changed.
    verification_cmd: >
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence
      --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-oversized-response &&
      node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test
known_deadends:
  - Do not ask the agent to report tool_use_id, a witness filename, nonce, sequence number, or any other correlation capability. tool_use_id remains hook-only; acceptance correlates by runtime session plus substratePayloadDigest and consumes the internally keyed row.
  - Do not treat a direct call to an exported hook function, a piped stdin fixture, a mocked MCP transport, or a passing Node unit test as proof that production enforcement fired. Phase completion requires the live Claude Code plus real local MCP capture in SAC 1.
  - Do not reuse P147 modeFileDigest or describe an unkeyed hash as protection. P147 expressly is not tamper-proof and does not attest hook presence. P167 uses a separately provisioned random key, HMAC-authenticated rows, hook-only tool-use correlation, freshness, and atomic one-use consumption.
  - Do not call the local HMAC store or broker tamper-proof. A process with arbitrary same-user code execution can potentially read the local key, restore a direct vtp-kb definition, replace the user-owned broker, alter settings, delete evidence, or replace both hook and acceptance code. Admin-managed Claude policy or an external signer under a different security principal is required to resist that actor.
  - Windows Claude Code 2.1.240 can enforce hooks from HKLM\SOFTWARE\Policies\ClaudeCode or C:\Program Files\ClaudeCode\managed-settings.json; lower scopes cannot disable those managed hooks, and allowManagedHooksOnly can exclude non-managed hooks. That authority is not deployed on this machine, the current operator is non-admin, HKCU is explicitly user-writable, and enabling allowManagedHooksOnly here would suppress the existing project/user hook fleet unless all of it migrated. Do not claim that the sgsd_managed JSON marker is managed policy or attempt to write an administrator-owned location. P167 therefore chooses the independent guarded MCP capability broker for the supported local_hmac tier.
  - The broker closes deletion of either/both registrations and the project hook source by removing vtp_search_substrate from tools/list and rechecking before upstream tools/call. It does not close a hostile same-user actor who edits Claude MCP configuration to restore the archived direct server, replaces the broker, or invokes the upstream server through another program. Audit must report trust_level local_hmac, enforcement_scope supported_sgsd_brokered_mcp_grant, and residual same_user_can_restore_direct_mcp_or_replace_broker.
  - Do not rely on SessionStart alone to prove the PreToolUse and PostToolUse hooks are loaded. Exact project registrations, source hashes, key readiness, an actual per-call witness, and the live runtime transcript all remain required.
  - Do not let a missing hook merely add a warning while accepting substrate evidence. The acceptance seam must refuse the record, and all four prompt contracts must discard the result and emit the explicit unavailable_or_bypassed degradation.
  - Do not pass an uncapped PostToolUse result through when capping, witness lookup, parsing, or rewrite output construction fails. An active PostToolUse hook replaces such a result with a bounded substrate_witness_rewrite_failed result.
  - Do not add another v2 schema, payload hash function, or per-hit cap. Reuse vtp-mcp-input-schemas.v2.json, substratePayloadDigest, and capSubstrateResponse from vtp-context-composer.cjs.
  - Do not remove the P166 gateway evidence check after adding the witness. The prepared envelope, self-reported call record, actual-input digest, and consumed hook witness are cumulative controls.
  - Do not register both global and project copies of the witness hook for the same SGSD session. The project registration is authoritative; the hook manifest records the global copy as intentionally unregistered to prevent duplicate witnesses and duplicate rewrites.
  - Do not contact a live VTP host for the real-runtime proof. Use the deterministic local stdio MCP fixture named vtp-kb so the canonical runtime tool name is exercised without mutating or depending on VTP-host state.
  - Do not touch super-gsd/schemas/vtp-mcp-input-schemas.v1.json, .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json, any VTP-host file, or wiki/LINT-REPORT.md. Do not raise or bypass VTP_RESPONSE_MAX_BYTES.
  - Do not run capture-live-runtime.cjs --capture, executable-emitters, staged-vtp-oversized-response, deployed hook smoke cases, or any other spawn-bound suite inside the Codex sandbox. Nested Node and Claude processes return spawnSync EPERM there. These are orchestrator-owned commands, and an executor must report ORCHESTRATOR_REQUIRED rather than claim a pass.
tasks:
  - id: P167-T1
    type: pre-post-hook-guarded-mcp-broker-and-authenticated-witness-store
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/hooks/sgsd-substrate-invocation-witness.cjs
      - super-gsd/tools/substrate-capability-broker.cjs
      - super-gsd/scripts/lib/substrate-invocation-witness-store.cjs
      - super-gsd/scripts/lib/vtp-context-composer.cjs
      - super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs
    input_contract: >
      Work red-first in assert-hook-contract.cjs with in-process calls and an
      isolated project, HOME, and USERPROFILE. The fixture uses the canonical
      mcp__vtp-kb__vtp_search_substrate name, full hook payloads containing
      session_id, tool_use_id, cwd, tool_input, and tool_response, and a response
      with top-level hits and evidence.hits. Cover valid v2 input, missing
      source_types, missing limit, empty source_types, limit 6, malformed stdin,
      missing session/tool-use IDs, missing key, duplicate Pre, missing Pre at
      Post, exact 16000 boundaries, 16001-character hits, and a discarded-tail
      marker. Add a fake upstream stdio server and cover tools/list with current,
      missing, duplicated, or source-drifted registrations, deletion of both
      registrations plus hook source, a stale forced substrate tools/call, a
      non-substrate tools/call, upstream exit, malformed upstream JSON, and
      list_changed after readiness loss. These tests establish deterministic
      behavior but do not satisfy any live-runtime SAC.

      Add only a public export for the existing substratePayloadDigest and a
      helper backed by the already compiled P166 v2 validator to
      vtp-context-composer.cjs. Do not change the hash bytes, schema authority,
      SUBSTRATE_CALL_POLICY, validatePreparedSubstrateCall, per-hit cap, callVtp,
      or P166 acceptance in this task. The new hook must load these production
      functions from the active project super-gsd tree found from payload.cwd;
      it must not copy their implementations.

      In PreToolUse, ignore non-substrate tools. For the substrate tool, require
      the full actual tool_input to pass the existing v2 schema helper and
      require session_id, tool_use_id, project root, key readiness, and exact
      Pre/Post project-registration readiness. Any failure returns JSON with
      hookSpecificOutput.hookEventName PreToolUse,
      permissionDecision deny, and a stable reason beginning
      substrate_witness_denied:. It must make the decision before transport and
      must not rely on the activity logger, whose persisted preview is
      truncated. A valid call computes substratePayloadDigest over the actual
      tool_input and creates the authenticated Pre witness before returning
      allow/no-op output. If the witness cannot be committed, deny the call.

      Implement the authoritative store in
      substrate-invocation-witness-store.cjs under the user configuration root,
      outside the project working tree. Provision a random 32-byte key with
      exclusive create and user-only permissions where the platform supports
      them. Never print or copy key material into project evidence. Key each
      spool record internally from HMAC(session_id,tool_use_id), store only
      hashed session/tool-use identifiers in observable rows, and authenticate
      the canonical record bytes with HMAC-SHA-256. Include schema version,
      project digest, payload digest, state, created/expires timestamps, hook
      source digest, and rewrite metadata. Use exclusive create for Pre and
      temp-file plus atomic rename for state transitions. Keep the authoritative
      spool separate from a redacted project mirror at
      .planning/metrics/substrate-invocation-witness.jsonl. Never persist query
      text, response text, raw session_id, raw tool_use_id, or key bytes.

      In PostToolUse, locate the exact signed Pre row by the hook-only
      session_id/tool_use_id, recompute the actual-input digest, and reject a
      mismatch. Apply the existing capSubstrateResponse to the MCP domain result
      and emit the Claude 2.1.240 MCP replacement contract through
      hookSpecificOutput.hookEventName PostToolUse and updatedMCPToolOutput.
      Preserve the MCP content envelope while replacing only the parsed domain
      payload. Transition the signed row to rewritten only after the replacement
      is constructed, recording counts and a digest but no response body. If the
      result is malformed, the Pre row is absent/invalid, or capping fails,
      replace the tool output with a small substrate_witness_rewrite_failed
      object and never pass the raw result through.

      Implement substrate-capability-broker.cjs as the only supported
      Claude-visible vtp-kb stdio server. It reads a private, user-only upstream
      server manifest provisioned by T4, starts and transparently proxies that
      stdio server, and never persists or logs arguments or results. For
      tools/list, forward upstream discovery but omit vtp_search_substrate unless
      the same exact-registration, source-digest, project, and key-readiness
      check used by PreToolUse is current. Watch those readiness inputs and emit
      a successful MCP list_changed notification when the tool must be added or
      withdrawn. For every substrate tools/call, repeat readiness synchronously
      before forwarding, so a stale client tool list cannot race deletion. On
      failure, return only a bounded substrate_witness_unavailable MCP error and
      do not send the request upstream. Forward non-substrate tools unchanged.
    output_contract: >
      One project-loadable Claude hook denies an invalid actual substrate
      invocation before transport and rewrites a valid result through the
      existing cap before model delivery. Within the supported SGSD brokered
      grant, the guarded MCP broker removes the raw substrate capability when
      hook readiness is absent and refuses stale calls before upstream
      transport. A keyed external spool records unique Pre and rewritten states
      without exposing correlation capabilities or payload/response content,
      and a redacted metrics mirror makes decisions auditable. These controls
      close drift, shortcut, and deletion paths through that grant; they do not
      prevent a same-user Bash/Write actor from reading the upstream manifest,
      invoking it directly, restoring another registration, or replacing the
      broker.
    hypothesis: >
      Binding v2 validation and the existing cap to actual Claude tool events,
      while a separate MCP capability broker withdraws the grant when those
      events cannot fire, closes active and absent-guard paths. A hook-only,
      authenticated state transition gives later acceptance evidence that did
      not originate in the agent's prompt record.
    falsifier: >
      Invalid actual input can reach transport; Pre allows when its witness
      cannot be written; Post passes through an uncapped or malformed result;
      the hook reimplements schema, digest, or cap logic; a persisted row leaks
      raw input/output/session/tool-use/key data; an edited row still verifies;
      duplicate Pre overwrites a row; the broker advertises or forwards
      substrate when either registration or source is absent; a stale call
      reaches upstream; a non-substrate tool changes behavior; raw payload or
      response data is logged; or T1 cannot be reverted without a later task.
    stop_rule: >
      Stop when assert-hook-contract is red before implementation and green
      after it, each denial has a stable reason, exact-boundary and both response
      shapes preserve P166 semantics, HMAC/edit/state-transition checks pass,
      broker discovery/withdrawal and before-forward recheck cases pass, node
      --check passes for all four production files, and the T1 diff is limited
      to the five listed files.
    verification_cmd: >
      node --check super-gsd/hooks/sgsd-substrate-invocation-witness.cjs &&
      node --check super-gsd/tools/substrate-capability-broker.cjs &&
      node --check super-gsd/scripts/lib/substrate-invocation-witness-store.cjs &&
      node --check super-gsd/scripts/lib/vtp-context-composer.cjs &&
      node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs &&
      node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test
    expected_ATC_tier: GATE
    revert_range: >
      One P167-T1 commit containing only the five listed files. Revert that
      single commit after reverting P167-T5 through P167-T2; no registration,
      prompt, propagation, or live-evidence file belongs in this range.
    known_deadends:
      - Do not add witness logic to sgsd-activity-logger.js. It receives full input, but its contract is silent best-effort logging and its persisted previews are deliberately truncated.
      - Do not use exit 0 with a warning for a targeted Pre failure. Return the documented permissionDecision deny contract; keep exit 2 only as a tested compatible denial precedent.
      - Do not write the authoritative spool or key under .planning, where a normal agent file edit can trivially fabricate the record used by acceptance.
      - Do not leave an unbrokered Claude-visible vtp-kb definition at any MCP scope after T4 repair. The private upstream manifest is input to the broker, not a Claude MCP registration.
      - Do not count a bounded broker rejection as the absence proof. The live absence SAC requires the upstream fixture's own zero-invocation log and transcript marker checks.
  - id: P167-T2
    type: witness-correlated-prompt-acceptance
    agent: codex
    model: codex
    depends_on: ['P167-T1']
    files_touched:
      - super-gsd/scripts/lib/vtp-context-composer.cjs
      - super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs
      - super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs
    input_contract: >
      Work red-first with a real prepareSubstrateCall planning envelope and the
      exact matching P166 substrate call record. Seed the authoritative store
      only through the T1 producer API using an isolated key and actual hook
      payload shapes. Exercise a rewritten row, pre-only row, missing row,
      expired row, HMAC-edited row, wrong session, wrong project, wrong digest,
      two identical sequential calls, replay after consumption, and a call
      record carrying invented tool_use_id/witness_id fields. Preserve all P166
      negative cases for missing gateway evidence, invalid payload, mismatched
      prepared call, and limit 6.

      Strengthen acceptPromptSubstrateCallRecord after all existing P166 shape,
      intent, payload, policy, and prepared-call checks pass. Resolve the runtime
      session from CLAUDE_CODE_SESSION_ID by default, with an explicit injected
      context permitted only for tests. Compute the digest with the existing
      substratePayloadDigest and ask the witness store to atomically consume the
      oldest fresh rewritten row for the same project, session, and digest. The
      prompt record must not contain tool_use_id, witness_id, witness path,
      signature, nonce, or sequence. Reject such fields rather than ignoring
      them, so a new self-reporting seam cannot form. Return only ok,
      intent_family, payload_sha256, and witness_status consumed.

      Consumption must verify the row HMAC before selecting it, acquire it with
      an atomic rename, append a redacted consumed audit event, and make a
      second acceptance fail. A pre_allowed row does not prove that PostToolUse
      rewrote a result and cannot satisfy acceptance. If no valid rewritten row
      exists, throw vtp_prompt_substrate_contract_invalid with a specific
      substrate_witness_missing, invalid, expired, session_mismatch,
      digest_mismatch, not_rewritten, ambiguous, or replayed suffix. Do not
      weaken or reorder the P166 validation errors to make a forged record reach
      the witness lookup.

      Keep the existing --accept-substrate-call-record CLI signature. It
      inherits CLAUDE_CODE_SESSION_ID, never asks the agent for a tool-use
      identifier, exits nonzero on witness failure including an ok:false prompt
      path, and emits no accepted JSON before atomic consumption succeeds.
    output_contract: >
      The P166 prompt acceptance seam now requires two independent facts: the
      exact composer-prepared record and one fresh hook-authored rewritten
      witness for the current runtime session and actual payload digest. A
      successful witness is consumed once and no hook-only identifier crosses
      the agent contract. This closes accidental acceptance, self-report,
      editing, copying, and replay within the intact local_hmac implementation;
      it does not authenticate against a same-user actor able to read the key or
      replace the hook, store, or acceptance code.
    hypothesis: >
      Runtime session plus the hook-computed payload digest is sufficient to
      bind prompt evidence to a real invocation when unique tool-use rows remain
      internal and acceptance atomically consumes one rewritten row.
    falsifier: >
      A clean prompt record passes without a rewritten witness; a pre-only,
      edited, expired, cross-session, cross-project, digest-mismatched, or
      replayed row passes; the agent must report an identifier; identical
      sequential actual calls cannot each be consumed once; any P166 forged
      record starts passing; or T2 cannot be reverted independently from T1.
    stop_rule: >
      Stop when every correlation negative is red against T1 and green after
      acceptance is strengthened, a valid row is accepted exactly once, no
      acceptance input or output contains tool_use_id, all P166 prompt-record
      cases stay green, composer self-test passes, and the post-T1 diff is
      limited to the three listed files.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters &&
      node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test
    expected_ATC_tier: GATE
    revert_range: >
      One P167-T2 commit containing only the three listed files. Revert it after
      P167-T5 through P167-T3 and before P167-T1; reverting T2 restores P166
      record-only acceptance while leaving the inert T1 hook/store available.
    known_deadends:
      - Do not choose a witness by an identifier copied from the prompt record, even if the identifier is checked against the ledger.
      - Do not accept a Pre row as proof that PostToolUse completed or that the model received capped output.
      - Do not replace P166 gateway evidence with the witness. Both checks are mandatory and ordered.
  - id: P167-T3
    type: four-surface-fail-closed-prompt-contract
    agent: codex
    model: codex
    depends_on: ['P167-T2']
    files_touched:
      - super-gsd/agents/sgsd-vtp-enrichment.md
      - super-gsd/agents/sgsd-board-researcher.md
      - super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs
    input_contract: >
      Work red-first from the two canonical prompt files and model the installed
      gsd-phase-researcher and gsd-planner P167 marker contract that T4 will
      propagate. Classify the four surfaces separately. Assert each keeps its
      P166 intent family and composer-prepared payload, carries no source_types
      or limit literal of its own, does not ask for tool_use_id, and cannot
      accept a response until readiness and post-call acceptance succeed. Assert
      that both canonical source frontmatter tool lists are raw-substrate-free;
      T4 alone may derive installed grant-bearing copies after the broker and
      hooks are current.

      Add one shared P167 contract wording to the canonical enrichment and board
      agents. Before raw substrate transport, run the production witness
      readiness command against the current project and session. If readiness
      is missing, stale, duplicated, keyless, or cannot prove both project
      registrations, do not call the raw tool. Emit VTP_STATUS
      unavailable_or_bypassed with reason substrate_witness_unavailable and
      continue only through the existing graceful-degradation path.

      After the raw tool returns, write the exact P166 call record and run the
      existing --accept-substrate-call-record command. Acceptance now consumes
      T2's rewritten witness. If it exits nonzero, discard all substrate-derived
      content, do not summarize, quote, persist, or retry it, and emit the same
      explicit degradation reason. Do not instruct the model to cap response
      text itself; T1 PostToolUse is the only raw-prompt pre-model cap and reuses
      capSubstrateResponse. Carry hook-authored degradation_notes through the
      existing normal artifact/output path when acceptance succeeds.

      Remove mcp__vtp-kb__vtp_search_substrate from both canonical source
      frontmatter tool lists. Keep every other P166 tool, query preparation,
      gateway evidence, intent family, artifact behavior, and optional-VTP
      semantic unchanged. The body retains the conditional raw-call contract
      because T4 derives installed copies with the raw tool only after it makes
      the broker the sole vtp-kb definition and verifies both hooks. T3 models
      that installed-agent marker contract in its test but does not modify
      audit.cjs; T4 owns the separately revertible derived grants.
    output_contract: >
      Canonical source prompts are raw-substrate-free. Their broker-granted
      installed variants call raw substrate only after witness readiness and use
      its result only after the exact P166 record and one rewritten runtime
      witness are accepted. Missing enforcement removes the capability and
      produces a named optional-VTP degradation rather than silent success. This
      closes forgetfulness, shortcut, and prompt drift in the generated SGSD
      surfaces, but it does not stop a same-user Bash/Write actor from creating
      a different prompt, registration, or direct upstream invocation.
    hypothesis: >
      Raw-free source templates plus a broker-owned conditional installed grant
      make absence mechanical, while preflight and post-call acceptance remain
      explicit degradation and evidence paths and the hooks keep active denial
      and rewrite out of model prose.
    falsifier: >
      Either canonical source still grants raw substrate; an installed contract
      can call before readiness or use content after acceptance failure; either
      asks for a hook identifier, manually reimplements the cap, retries
      unfiltered, changes an intent/policy field, turns optional VTP absence into
      phase failure, or T3 cannot be reverted without T1/T2.
    stop_rule: >
      Stop when assert-prompt-contracts is red then green for the canonical
      surfaces and declared legacy marker contract, caller-coverage still sees
      the same eight production branches, only the two named raw grants are
      removed from source tool lists, no intent or other tool drifts, no
      agent-supplied identifier appears, and the T3 diff is limited to the three
      listed files.
    verification_cmd: >
      node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes
    expected_ATC_tier: GATE
    revert_range: >
      One P167-T3 commit containing only the two canonical agents and their
      dedicated prompt-contract test. Revert it after P167-T5 and P167-T4 and
      before T2; T3 does not own installed legacy agent mutations.
    known_deadends:
      - Do not treat prompt readiness wording as the enforcement mechanism. It is an early degradation path; T1's broker grant plus hooks and T2 acceptance are authoritative at their respective boundaries.
      - Do not grant raw substrate in canonical source files or only revoke it from some of the four installed prompts. T4 must derive or withdraw the grant for both canonical installs and both legacy surfaces as one capability.
  - id: P167-T4
    type: brokered-tool-grant-propagation-audit-and-absence-gate
    agent: codex
    model: codex
    depends_on: ['P167-T3']
    files_touched:
      - super-gsd/config/repo-settings-overlay.json
      - super-gsd/config/hook-manifest.json
      - super-gsd/scripts/merge-settings.js
      - super-gsd/install.sh
      - super-gsd/tools/feature-propagation/audit.cjs
      - super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs
      - super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs
    input_contract: >
      Work red-first in assert-propagation.cjs using a disposable project and
      isolated HOME and USERPROFILE. Seed unrelated settings entries, old P166
      planner/researcher patches, missing hook registrations, stale commands,
      duplicate hook IDs, a mismatched source file, missing and malformed key
      state, direct vtp-kb definitions at local/project/user MCP scopes, an
      unsupported upstream transport, and both current and absent installed
      agents. Include secret-shaped upstream env values and snapshot the real
      user profile and source project evidence so any test escape fails. Cover
      audit-only, repair-safe, second repair, removal of each hook, deletion of
      both registrations plus hook source without another repair, and a
      simulated broker/merge failure before agent installation.

      Add exactly two sgsd_managed project registrations to
      repo-settings-overlay.json for the same hook script: PreToolUse and
      PostToolUse, each matched only to
      mcp__vtp-kb__vtp_search_substrate and assigned stable distinct hook IDs.
      Point both at the target project's
      super-gsd/hooks/sgsd-substrate-invocation-witness.cjs with the existing
      command plus args form and a bounded timeout justified by T1 tests. Do not
      add a global registration, because simultaneous global and project hooks
      would duplicate witnesses and rewrites. Add the source to
      hook-manifest.json with the project dispositions and an explicit
      intentionally_unregistered global disposition.

      Make merge-settings.js safe to require by guarding main with
      require.main and exporting its existing repo-local merge operation and
      inspection helpers. feature-propagation/audit.cjs must call that same
      implementation in process rather than cloning merge semantics or spawning
      nested Node. Add auditClaudeSubstrateWitness that verifies exactly one of
      each managed hook ID, event, canonical matcher, resolved command, timeout,
      current source digest, and key readiness. Report missing, stale,
      duplicate, source_drift, key_missing/key_invalid, trust_level local_hmac,
      enforcement_scope supported_sgsd_brokered_mcp_grant, and residual
      same_user_can_restore_direct_mcp_or_replace_broker. Add
      auditClaudeSubstrateCapability to inspect Claude's local, project, and user
      MCP scope precedence and require every discovered vtp-kb definition to
      name substrate-capability-broker.cjs, the broker/source hashes to be
      current, and the private upstream manifest to be present, user-only where
      supported, and digest-matched without exposing command args, env values,
      headers, or URLs. Report direct_grant, broker_missing, broker_drift,
      upstream_missing, upstream_drift, unsupported_upstream_transport, and
      grant_with_witness_unready. A failing witness or capability audit adds
      project_claude_substrate_witness_missing_or_stale and exits 2.

      Reorder repair-safe so it first provisions the key without exposing it and
      merges and re-audits both project registrations. For every effective
      stdio vtp-kb definition, atomically move the exact original server object
      into a private scope-keyed upstream manifest outside the project and
      replace the Claude-visible definition at that scope with the same named
      vtp-kb broker command. Never leave a direct vtp-kb fallback at a lower
      scope. The broker manifest is not an MCP configuration, must not be loaded
      by Claude, and must retain secrets byte-for-byte without printing or
      mirroring them. If no VTP server exists, or its transport is unsupported,
      keep all four installed agents raw-substrate-free and follow optional-VTP
      degradation rather than creating a partial grant.

      Only after hook and broker audits are current may repair-safe derive the
      two installed canonical VTP agents from T3's raw-free sources and patch
      legacy gsd-phase-researcher.md and gsd-planner.md with both the raw tool
      grant and versioned P167 contract. The installed contract must match T3:
      readiness before the raw call, acceptance after it, no agent identifier,
      discard/degrade on failure, and no manual response cap. If readiness later
      disappears, the broker immediately withdraws the actual tool and blocks
      stale calls; the next repair-safe also removes the derived raw grant from
      all four installed files. Preserve unrelated settings, agent content, MCP
      servers, and non-VTP repair behavior. Full repair retains its existing
      shadow backup semantics.

      Teach install.sh to provision the same key before repo-local hook merge,
      install the brokered MCP definition before any grant-bearing agent, and
      fail rather than silently expose raw substrate when either mandatory hook,
      broker installation, or private upstream preservation fails. Reuse the
      existing hook distribution and merge preflight. Extend the installer
      registration guard's overlay counts, manifest completeness, source
      distribution, broker-only vtp-kb checks, idempotence, stale/duplicate
      detection, secret non-disclosure, and unrelated-setting preservation. Do
      not add a second Claude hook or agent installer.
    output_contract: >
      Fresh install and feature propagation carry the authoritative project
      Pre/Post registrations, hook source, local signing authority, sole
      brokered vtp-kb definition, private upstream manifest, and four conditional
      installed prompt grants as one audited capability. Audit-only is read-only
      and exits 2 on absence; repair-safe installs enforcement before exposing
      raw substrate, withdraws derived grants when unavailable, and is
      byte-idempotent. This genuinely closes deletion of the supported brokered
      grant and makes an unfiltered call require deliberate circumvention. It
      does not make the same-user-owned configuration, manifest, broker, or
      signing key an authority boundary against arbitrary Bash/Write execution.
    hypothesis: >
      Making the broker the only owner of the actual MCP grant, with hook
      readiness as its discovery and before-forward condition, turns hook
      deletion into capability withdrawal before model-visible transport while
      preserving the existing installer and prompt surfaces.
    falsifier: >
      A fresh profile audits ok without hooks/key/broker; repair writes a raw
      agent before enforcement; a direct vtp-kb fallback remains at any scope;
      secrets enter logs or evidence; one event, wrong matcher, stale source,
      duplicate, missing key, broker drift, or upstream drift audits current;
      deletion leaves the tool discoverable or forwardable; a second repair
      changes bytes; unrelated settings or agents change; global plus project
      registration can both fire; audit claims tamper-proof; tests touch the
      real profile; or T4 is not independently revertible.
    stop_rule: >
      Stop when the fresh-profile case is red then green, all direct MCP scope
      cases become broker-only, removal of either event withdraws the tool,
      deletion of both events plus hook source cannot forward a stale call,
      repair ordering, secret non-disclosure, and byte-idempotence are proven,
      both canonical installs and both legacy agents have the correct
      grant-or-revoke state, both legacy markers carry no identifier, installer
      manifest cases pass, feature-propagation self-test passes, and the
      post-T3 diff is limited to the seven listed files.
    verification_cmd: >
      node --check super-gsd/scripts/merge-settings.js &&
      node --check super-gsd/tools/feature-propagation/audit.cjs &&
      node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs &&
      node super-gsd/tools/feature-propagation/audit.cjs --self-test &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types &&
      node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case brokered-substrate-capability
    expected_ATC_tier: GATE
    revert_range: >
      One P167-T4 commit containing only the seven listed files. Revert it after
      P167-T5 and before P167-T3; the reverse leaves canonical prompt
      raw-free source behavior and hook/broker code in the repo but removes
      derived grants and propagation as one unit.
    known_deadends:
      - Do not make missing Claude hooks non-blocking beside the existing Codex hook report. P167 has its own issue code and nonzero audit result.
      - Do not merge settings by shelling out from audit.cjs. Export and reuse the existing in-process merge so deterministic tests do not depend on nested Node.
      - Do not silently provision administrator-managed policy. Report that Windows machine-managed hooks are technically available but not deployed or writable by the current non-admin operator; managed policy remains the stronger operator authority boundary.
      - Do not leave a direct vtp-kb entry as a fallback for convenience. If the broker cannot preserve and proxy the effective stdio definition, remove the raw grant from all four installed prompts and degrade VTP substrate explicitly.
      - Do not claim the broker resists arbitrary same-user MCP reconfiguration. The bounded claim is deletion-safe for the supported brokered grant, not protection from a user who restores the archived direct config or replaces the broker.
  - id: P167-T5
    type: live-claude-mcp-denial-rewrite-evidence
    agent: codex
    model: codex
    depends_on: ['P167-T4']
    files_touched:
      - super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs
      - super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs
      - .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
    input_contract: >
      Build a deterministic stdio MCP fixture named vtp-kb that declares only
      vtp_search_substrate, validates the expected payload for each scenario,
      appends a redacted row for every received tools/call to a caller-supplied
      append-only log, and returns one ordinary hit plus one hit with 16001
      JavaScript characters and unique raw-response and discarded-tail markers.
      Initialize and tools/list traffic must be distinguishable from tools/call
      and cannot be counted as a substrate invocation. The fixture must never
      contact VTP, read a private corpus, or write outside its supplied temporary
      directory.

      capture-live-runtime.cjs has separate --capture and --verify modes.
      --capture creates a disposable SGSD project/profile, installs the P167
      project hook registrations through the real merge path, provisions an
      isolated witness key, stores the local fixture as the broker's private
      upstream, configures the broker as the only Claude-visible server named
      vtp-kb, derives a grant-bearing test agent, and launches installed Claude
      Code in bypass-permissions mode from a fresh process so settings are
      loaded at session start. The active-path prompt requires exactly two
      canonical MCP attempts: an invalid payload missing the P166 required
      policy fields, then a valid composer-prepared planning payload. Fail
      capture unless the transcript contains a real tool-use event for each
      attempt, the invalid event is denied, the fixture log contains only the
      valid tools/call payload, and the valid tool result in the transcript is
      the PostToolUse replacement rather than the fixture's raw result.

      In a second fresh disposable project/profile, run the same real install,
      then delete both P167 hook registrations and the project hook source
      without running repair again. Start another real bypass-permissions Claude
      process through the still-configured broker and explicitly request the
      canonical raw tool. Require successful broker discovery with
      vtp_search_substrate absent, and also issue a direct stale tools/call to
      the broker outside the model as race falsification. Fail capture unless
      the fixture's own log has zero tools/call rows for this scenario, the stale
      call receives only bounded substrate_witness_unavailable, the Claude
      transcript has no substrate tool result, and neither unique fixture raw
      marker appears anywhere in model-visible transcript content.

      In a third fresh disposable project/profile, run the same real install
      and then act with the same user's Bash and Write authority. Read the
      private upstream manifest, add an alternate Claude-visible MCP server
      named vtp-kb-bypass that points directly to the fixture, and launch a
      fresh real Claude process that sends one deliberately non-v2 substrate
      tools/call through that alternate registration. Then start the same
      upstream command directly and send a second deliberately non-v2
      tools/call over Bash/stdio. Unique scenario markers must distinguish the
      two calls. This positive characterisation is PASS only when both calls
      return fixture success, the append-only log contains exactly one row for
      each bypass, and before/after snapshots show no matching authoritative or
      mirrored witness row. A denied, failed, inferred, or skipped attempt does
      not satisfy the characterisation.

      Write 167-REAL-MCP-HOOK-EVIDENCE.json atomically with schema/version,
      capture time, Claude Code version, bypass-permissions mode, exact hook IDs
      and source/registration hashes, broker source/config/upstream-manifest
      hashes, fixture source hash, prepared and actual-input payload digests,
      redacted session/tool-use hashes, denial reason, active server invocation
      count and payload, original/retained character counts, degradation reason,
      discarded-marker absence, witness state sequence, acceptance consumption
      result, and a separate absent_guard object. That object records deletion
      of both hook IDs and source, broker tools/list names/digest, stale-call
      rejection, fixture-owned zero invocation count/log digest, transcript
      event-type summary, and absence of both raw markers. A separate
      same_user_bypass object records alternate-registration discovery and call
      success, direct Bash/stdio call success, the two fixture invocation counts
      and log digest, witness-store before/after digests and matching-row count,
      redacted commands, and source/configuration digests. Record commands with
      secrets and temp paths redacted and frozen-file before/after hashes. Do
      not persist the witness key, private upstream object, raw identifiers,
      discarded text, or unrelated transcript content. Clean all disposable
      projects/profiles after the evidence file is safely written.

      --verify is spawn-free and reads the captured evidence plus current
      sources. It must reject missing fields, wrong runtime/version, simulated
      hook mode, non-bypass permission mode, zero or multiple valid server
      invocations, an invalid server invocation, absent Pre deny/Post rewrite,
      non-16000 retention, present tail marker, absent degradation note,
      unconsumed witness, source/registration/broker/fixture hash drift, or
      changed frozen files. It must also reject an absent-guard object that does
      not prove both registrations and source deleted, advertises the substrate
      tool, forwards either the model attempt or stale direct call, has any
      fixture tools/call row, contains either raw marker or a substrate result
      in transcript content, or relies only on audit/acceptance refusal. It
      must also require a same_user_bypass object proving that both the alternate
      registration and direct Bash/stdio call succeeded, each produced its
      distinguished fixture row, and neither produced a matching witness row.
      It cannot regenerate or bless evidence.

      The Codex executor may write and run the fixture's in-process checks and
      --verify parser, but it must not run --capture or invoke Claude. The
      orchestrator owns the unsandboxed --capture command for the live SACs because
      nested process creation returns spawnSync EPERM in the Codex sandbox. The
      executor reports ORCHESTRATOR_REQUIRED and leaves T5 incomplete until the
      orchestrator produces the real evidence and --verify exits 0.
    output_contract: >
      A committed, machine-readable real-runtime artifact proves the bounded
      boundary: installed hooks deny an invalid canonical invocation and
      rewrite one real oversized result through the existing cap before
      model delivery; deletion of both registrations and hook source makes the
      broker remove and refuse the raw capability with zero fixture invocations
      and no raw transcript delivery; and alternate registration plus direct
      Bash/stdio invocation both reach the upstream without a witness row. The
      proof is reproducible locally, does not depend on a live VTP host, and
      makes explicit that P167 raises the cost of bypass but does not seal the
      substrate path from arbitrary same-user code execution.
    hypothesis: >
      Fresh Claude processes plus a real brokered stdio fixture and independent
      Claude transcript, fixture log, broker discovery, and signed hook evidence
      can prove active denial/rewrite, absent-guard non-invocation, and the exact
      admitted same-user bypass boundary without conflating those claims.
    falsifier: >
      Evidence comes from direct hook invocation or an injected transport; the
      invalid call enters the server; bypass-permissions avoids denial; raw tail
      text appears in the model transcript; only a report claims rewrite; the
      witness is not consumed; both registrations and source are deleted but the
      tool remains advertised, the fixture receives any absent-path tools/call,
      or a raw marker/result reaches that transcript; absence is inferred only
      from audit or acceptance; capture touches live VTP or real user settings;
      either required same-user bypass is denied, fails, is skipped, is inferred,
      does not create its fixture row, or creates a matching witness row; the
      artifact describes either successful bypass as prevented or sealed;
      sensitive identifiers/key/text/upstream config are persisted; hashes
      drift; Codex claims the spawn-bound run passed; or T5 is not one
      independently revertible commit.
    stop_rule: >
      Stop only after the orchestrator-owned --capture exits 0, spawn-free
      --verify exits 0 against the committed artifact, the evidence records one
      denied and one rewritten real MCP attempt plus the deleted-both-and-source
      scenario with zero fixture invocations and no raw transcript, all with the
      required independent observations, and the same_user_bypass object records
      successful alternate-registration and direct Bash/stdio upstream calls
      with no matching witness row. All earlier task and regression commands
      must pass under their declared owner, and the T5 diff is limited to the
      three listed files.
    verification_cmd: >
      node --check super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs &&
      node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs &&
      node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --verify
      --project-dir . --evidence-file
      .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json
    expected_ATC_tier: GATE
    revert_range: >
      One final P167-T5 commit containing only the local MCP fixture, live
      capture/verifier, and captured evidence. Revert this commit first; it
      removes proof tooling/evidence without changing the production hook,
      acceptance, prompts, or propagation.
    known_deadends:
      - Do not substitute the hook unit suite or a mocked mcpInvoke spy for --capture. They prove code behavior, not that Claude loaded and fired the installed hooks.
      - Do not point the live proof at the operator's VTP server or use wiki/LINT-REPORT.md as the oversized fixture.
      - Do not let the executor translate spawnSync EPERM into PASS, SKIP-PASS, or inferred success. The orchestrator must run and capture the live command.
      - Do not accept audit exit 2, prompt refusal, a broker warning, or the model's statement that a tool was unavailable as the absence proof. Only the fixture-owned zero tools/call log plus transcript raw-marker/result absence satisfies it.
      - Do not treat the successful same-user bypass as a phase failure or expected-failure test. It is a mandatory passing characterisation of the admitted local_hmac limit and must remain visible in committed evidence.
---

# P167 - Substrate Invocation Witness

Revision 3 provenance: revised in place on 2026-08-22 after the round-2 NOGO
and the operator's bounded-scope ruling. Round 2 accepted six of seven checks,
including the broker deletion proof, and found one remaining critical limit:
the broker, configuration, private upstream manifest, and grant-bearing agents
remain under the same user's Bash and Write authority. This revision preserves
the accepted controls, records that limit as an intended boundary, and adds a
passing live characterisation that demonstrates it.

Five serial, independently revertible tasks close the drift, forgetfulness,
shortcut, and supported broker-deletion cases without weakening the P166
gateway or response limits. T1 adds the real PreToolUse denial, PostToolUse
rewrite through the existing cap, authenticated witness state, and guarded MCP
broker. T2 requires one rewritten
witness at P166 prompt acceptance. T3 makes the two canonical sources
raw-substrate-free while retaining their conditional installed contract. T4
makes the broker the only supported vtp-kb grant and derives or withdraws all
four installed prompt grants. T5 captures mandatory active-path and
absent-guard production proofs, then positively demonstrates alternate
registration and direct Bash/stdio bypass. The phase raises an unfiltered call
from zero-effort drift to deliberate circumvention; it does not seal the
substrate path against arbitrary same-user code execution. The build remains
five tasks and creates neither a sixth task nor a duplicate installer.

## Runtime and evidence flow

1. T4 archives the effective direct stdio vtp-kb definition outside Claude MCP
   scope and registers the T1 broker as the only server retaining that name.
2. On tools/list and immediately before each substrate tools/call, the broker
   checks exact Pre/Post registration, hook source digest, project, and key
   readiness. It omits or refuses the tool before upstream transport on any
   failure.
3. P166 `prepareSubstrateCall` builds the policy-owned v2 payload and digest.
4. Claude Code PreToolUse supplies the full actual `tool_input`. The P167 hook
   validates it with P166's compiled v2 authority, denies invalid input, and
   creates a signed row keyed internally by `session_id` and `tool_use_id`.
5. The upstream MCP server sees only a valid call. On success, PostToolUse finds the
   exact internal row, calls P166 `capSubstrateResponse`, returns
   `updatedMCPToolOutput`, and advances the signed row to `rewritten`.
6. The prompt submits its existing P166 prepared/recorded call to
   `acceptPromptSubstrateCallRecord`. Acceptance uses
   `CLAUDE_CODE_SESSION_ID` plus the hook-computed payload digest, consumes one
   rewritten row, and never receives `tool_use_id` from the agent.
7. If registration, source, key, Pre, Post, witness verification, or consumption
   is absent, the broker first withdraws or refuses the raw capability. Prompt
   readiness and acceptance then report `VTP_STATUS: unavailable_or_bypassed`
   with `substrate_witness_unavailable` as explicit degradation and supporting
   evidence. They are not substitutes for broker enforcement.
8. T5 then deliberately steps outside that supported path by restoring an
   alternate direct registration and invoking the upstream over Bash/stdio.
   Both calls reach the fixture without a witness row, pinning the same-user
   limit as evidence rather than leaving it as an assumption.

## Ownership map

- `super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` owns Claude hook
  input/output adaptation and target-tool decisions.
- `super-gsd/tools/substrate-capability-broker.cjs` owns the Claude-visible
  vtp-kb stdio boundary, upstream proxying, conditional tools/list, list_changed,
  and the synchronous before-forward readiness recheck.
- `super-gsd/scripts/lib/substrate-invocation-witness-store.cjs` owns key
  provisioning, HMAC rows, state transitions, freshness, atomic consumption,
  registration inspection, and redacted audit mirroring.
- `super-gsd/scripts/lib/vtp-context-composer.cjs` remains the only owner of v2
  schema validation, `substratePayloadDigest`, `capSubstrateResponse`, prepared
  call validation, and prompt-record acceptance.
- `super-gsd/agents/sgsd-vtp-enrichment.md` and
  `super-gsd/agents/sgsd-board-researcher.md` own the canonical prompt
  degradation contract.
- `super-gsd/tools/feature-propagation/audit.cjs` owns installation order,
  private upstream-config preservation, broker-only MCP scope audit, derived
  prompt grants, installed planner/researcher P167 markers, and the fresh-machine
  audit result.
- `super-gsd/config/repo-settings-overlay.json`, `hook-manifest.json`, and the
  existing merge/install path own distribution and registration. No second
  installer is created.
- `super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` owns
  the orchestrator-run real MCP capture and spawn-free evidence verifier.

## Operator ruling and authority choice

Round 2 identified three ways to close the hostile same-user case:
machine-managed policy, a proxy under a different security principal, or
removal of raw upstream access. On 2026-08-22 the operator ruled those closures
out of P167 because they require authority the current non-admin operator does
not hold or cost more than this phase is worth. An agent with Bash and Write on
this machine can already exercise the user's authority. The observed failure
that caused the milestone is agents forgetting to filter, taking shortcuts, or
drifting, not agents deliberately smuggling searches around a broker. P167 is
therefore an operational guardrail with a measured same-user limit, not a
hostile-code security boundary.

The machine-managed option is real on this Windows runtime: an administrator
can place managed hooks and their source under
`HKLM\SOFTWARE\Policies\ClaudeCode` or `C:\Program Files\ClaudeCode`,
combine them with managed MCP policy, and set `allowManagedHooksOnly` so a
standard user cannot remove or disable the guard. It is not the selected phase
baseline because no machine-managed source is deployed here, the current
operator token is non-admin, HKCU is a user-writable fallback rather than an
authority boundary, and the hook-only lock would suppress the existing
project/user SGSD hooks unless that entire fleet migrated. SGSD must not
silently write or simulate administrator policy. A different-principal proxy
would require separately operated credentials and lifecycle, while removal of
raw upstream access would remove the capability the phase is meant to retain.

The selected mechanism is the independent guarded MCP capability broker. It is
deployable through the existing installer, becomes the only definition named
vtp-kb, removes vtp_search_substrate from successful discovery when either hook
registration or source is absent, and rechecks before forwarding a stale call.
For the supported SGSD path, this directly controls the tool grant before
upstream transport. It preserves the active deny/rewrite design when ready,
gives a deterministic optional-VTP degradation when not ready, and raises
unfiltered use from accidental drift to deliberate circumvention. It does not
prevent the same user from reading the private manifest, restoring another
server definition, invoking upstream through Bash/stdio, or replacing the
broker.

## Bounded enforcement and trust statement

For calls through the supported brokered grant, active PreToolUse blocks invalid
transport and active PostToolUse blocks raw output delivery by replacing it
with the existing capped result. If either registration or the hook source is
absent, the independent broker omits the substrate tool from successful
discovery and refuses any stale tools/call before upstream transport. This is
the genuinely closed deletion case. Canonical source agents carry no raw grant.
Only T4 may derive grant-bearing installed copies after hook and broker audits
are current, and the broker remains the owner of availability on that supported
path. Separately, `acceptPromptSubstrateCallRecord` refuses a result without a
fresh rewritten witness, the four prompts degrade explicitly, and
feature-propagation audit returns exit 2. Those later refusals are supporting
controls, not the non-invocation boundary.

The authoritative rows live outside the working tree, are HMAC-authenticated
with a separately provisioned random key, are keyed by a hook-only tool-use
capability, expire, and are consumed atomically. This prevents trivial prompt
self-report, casual row editing, cross-session copying, and replay. It does not
make a same-user local process a security boundary. Windows Claude Code can
protect hooks through HKLM or `C:\Program Files\ClaudeCode` managed settings,
and `allowManagedHooksOnly` can exclude lower-scope hooks. This machine has no
such deployed source, the operator is non-admin, HKCU is user-writable, and
turning that lock on without migrating the existing hook fleet would disable
required SGSD hooks. The plan therefore chooses the brokered grant for the
deployable local tier and says exactly what remains: a determined same-user actor
can restore the archived direct MCP config, replace the broker, read the key,
replace hook/verifier code, or use another program to invoke upstream. P167
closes missing registration/source for the supported SGSD brokered grant, not
arbitrary same-user reconfiguration.

## Orchestrator-owned verification

The Codex sandbox cannot create nested Node or Claude processes and reports
`spawnSync EPERM`. The following commands are owned by the orchestrator outside
that sandbox:

- `capture-live-runtime.cjs --capture`, including the fresh Claude Code process
  and local stdio MCP fixture.
- P166 `assert-vtp-substrate-policy.cjs --case executable-emitters`.
- P166 `assert-real-triage-runtime.cjs --scenario staged-vtp-oversized-response`.
- Any installer guard case that invokes deployed hooks or nested Node, including
  `deployed-hook-smoke` when the phase verifier elects to run it.

The executor runs all spawn-free checks it can, names each EPERM-limited command
as `ORCHESTRATOR_REQUIRED`, and never reports a derived or historical pass.
Phase completion is blocked until the live evidence artifact exists and its
spawn-free verifier exits 0.

## Order and revertability

Each task is one commit. Revert in reverse order: T5 evidence, T4 propagation
and grants, T3 canonical prompts, T2 acceptance, then T1 hook/broker/store. T1
alone is inert until registered. T2 can be reverted without changing P166
payload validation. T3 and T4 divide raw-free sources from derived installed
grants. T5 contains only the fixture, capture code, and real evidence. No task
changes a VTP host, the frozen v1 schema/evidence, the eight-site inventory, the
16000 character cap, or `VTP_RESPONSE_MAX_BYTES`.
