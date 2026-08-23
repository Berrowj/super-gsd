'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');

const TARGET_TOOL = ['mcp__vtp-kb__vtp', 'search', 'substrate'].join('_');
const COMPOSER_RELATIVE_PATH = path.join('super-gsd', 'scripts', 'lib', 'vtp-context-composer.cjs');
const STORE_RELATIVE_PATH = path.join('super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');

function findProjectRoot(cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) return null;
  let current = path.resolve(cwd);
  for (;;) {
    const composerPath = path.join(current, COMPOSER_RELATIVE_PATH);
    if (fs.existsSync(path.join(current, '.planning')) && fs.existsSync(composerPath)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadProjectRuntime(projectRoot) {
  return {
    composer: require(path.join(projectRoot, COMPOSER_RELATIVE_PATH)),
    store: require(path.join(projectRoot, STORE_RELATIVE_PATH)),
  };
}

function preDecision(decision, reason) {
  const output = {
    hookEventName: 'PreToolUse',
    permissionDecision: decision,
  };
  if (reason) output.permissionDecisionReason = 'substrate_witness_denied:' + reason;
  return { hookSpecificOutput: output };
}

function deny(reason) {
  return preDecision('deny', reason);
}

function rewriteFailure(reason) {
  const domain = {
    ok: false,
    reason: 'substrate_witness_rewrite_failed:' + reason,
  };
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedMCPToolOutput: {
        content: [{ type: 'text', text: JSON.stringify(domain) }],
        isError: true,
      },
    },
  };
}

function parseMcpDomain(toolResponse) {
  if (!toolResponse || typeof toolResponse !== 'object' || Array.isArray(toolResponse)) {
    throw new Error('malformed_response');
  }
  if (!Array.isArray(toolResponse.content) || toolResponse.content.length !== 1) {
    throw new Error('malformed_response');
  }
  const block = toolResponse.content[0];
  if (!block || block.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('malformed_response');
  }
  let domain;
  try {
    domain = JSON.parse(block.text);
  } catch (_) {
    throw new Error('malformed_response');
  }
  if (!domain || typeof domain !== 'object' || Array.isArray(domain)) {
    throw new Error('malformed_response');
  }
  if (Object.prototype.hasOwnProperty.call(toolResponse, 'structuredContent')) {
    const structured = toolResponse.structuredContent;
    if (!structured
      || typeof structured !== 'object'
      || Array.isArray(structured)
      || !util.isDeepStrictEqual(structured, domain)) {
      throw new Error('malformed_response');
    }
  }
  return { domain, block };
}

function mergeDegradationNotes(domain, generated) {
  const existing = Array.isArray(domain.degradation_notes) ? domain.degradation_notes : [];
  return [...existing, ...generated];
}

function hitCharacterTotal(response) {
  let total = 0;
  const lists = [];
  if (response && Array.isArray(response.hits)) lists.push(response.hits);
  if (response && response.evidence && Array.isArray(response.evidence.hits)) {
    lists.push(response.evidence.hits);
  }
  for (const hits of lists) {
    for (const hit of hits) {
      if (hit && typeof hit.text === 'string') total += hit.text.length;
    }
  }
  return total;
}

function responseDigest(response) {
  return crypto.createHash('sha256')
    .update(Buffer.from(JSON.stringify(response), 'utf8'))
    .digest('hex');
}

function handlePre(payload, projectRoot, runtime, env) {
  if (typeof payload.session_id !== 'string' || !payload.session_id) return deny('missing_session_id');
  if (typeof payload.tool_use_id !== 'string' || !payload.tool_use_id) return deny('missing_tool_use_id');
  if (!runtime.composer.validateSubstrateToolInput(payload.tool_input)) {
    return deny('invalid_v2_payload');
  }
  const readiness = runtime.store.inspectWitnessReadiness(projectRoot, env);
  if (!readiness.ready) {
    return deny(readiness.reason === 'key_unavailable' ? 'key_unavailable' : 'guard_unavailable:' + readiness.reason);
  }
  const payloadDigest = runtime.composer.substratePayloadDigest(payload.tool_input);
  try {
    runtime.store.createPreWitness({
      projectRoot,
      env,
      sessionId: payload.session_id,
      toolUseId: payload.tool_use_id,
      payloadDigest,
      sourceDigest: readiness.source_digest,
    });
  } catch (error) {
    if (error && error.message === 'witness_duplicate_pre') return deny('duplicate_pre');
    if (error && /^witness_key_/.test(error.message)) return deny('key_unavailable');
    return deny('witness_commit_failed');
  }
  return preDecision('allow');
}

function postFailureReason(error) {
  const message = error && error.message ? error.message : '';
  if (message === 'witness_missing_pre') return 'missing_pre';
  if (message === 'witness_record_invalid') return 'invalid_pre';
  if (message === 'witness_pre_mismatch') return 'input_mismatch';
  if (message === 'witness_pre_expired') return 'expired_pre';
  if (/^witness_key_/.test(message)) return 'key_unavailable';
  if (message === 'malformed_response') return 'malformed_response';
  return 'state_transition_failed';
}

function handlePost(payload, projectRoot, runtime, env) {
  if (typeof payload.session_id !== 'string' || !payload.session_id) return rewriteFailure('missing_session_id');
  if (typeof payload.tool_use_id !== 'string' || !payload.tool_use_id) return rewriteFailure('missing_tool_use_id');
  if (!runtime.composer.validateSubstrateToolInput(payload.tool_input)) {
    return rewriteFailure('invalid_v2_payload');
  }

  try {
    const parsed = parseMcpDomain(payload.tool_response);
    const capped = runtime.composer.capSubstrateResponse(parsed.domain);
    if (!capped.response || typeof capped.response !== 'object' || Array.isArray(capped.response)) {
      return rewriteFailure('malformed_response');
    }
    const degradationNotes = mergeDegradationNotes(parsed.domain, capped.degradation_notes);
    const rewrittenDomain = degradationNotes.length > 0
      || Object.prototype.hasOwnProperty.call(parsed.domain, 'degradation_notes')
      ? { ...capped.response, degradation_notes: degradationNotes }
      : capped.response;
    const replacement = {
      ...payload.tool_response,
      content: [{ ...parsed.block, text: JSON.stringify(rewrittenDomain) }],
      ...(Object.prototype.hasOwnProperty.call(payload.tool_response, 'structuredContent')
        ? { structuredContent: rewrittenDomain }
        : {}),
    };
    const payloadDigest = runtime.composer.substratePayloadDigest(payload.tool_input);
    runtime.store.transitionWitnessToRewritten({
      projectRoot,
      env,
      sessionId: payload.session_id,
      toolUseId: payload.tool_use_id,
      payloadDigest,
      responseDigest: responseDigest(rewrittenDomain),
      degradationCount: capped.degradation_notes.length,
      originalChars: hitCharacterTotal(parsed.domain),
      retainedChars: hitCharacterTotal(capped.response),
      topLevelHitCount: Array.isArray(capped.response.hits) ? capped.response.hits.length : 0,
      evidenceHitCount: capped.response.evidence && Array.isArray(capped.response.evidence.hits)
        ? capped.response.evidence.hits.length
        : 0,
    });
    return {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedMCPToolOutput: replacement,
      },
    };
  } catch (error) {
    return rewriteFailure(postFailureReason(error));
  }
}

function processHookPayload(payload, options = {}) {
  const expectedEvent = options.expectedEvent || null;
  const expectedPost = expectedEvent === 'PostToolUse';
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return expectedPost ? rewriteFailure('malformed_stdin') : deny('malformed_stdin');
  }
  if (expectedEvent && payload.hook_event_name !== expectedEvent) {
    return expectedPost ? rewriteFailure('unexpected_hook_event') : deny('unexpected_hook_event');
  }
  if (payload.tool_name !== TARGET_TOOL) {
    if (!expectedEvent) return null;
    return expectedPost ? rewriteFailure('unexpected_tool') : deny('unexpected_tool');
  }
  const projectRoot = findProjectRoot(payload.cwd);
  if (!projectRoot) {
    return payload.hook_event_name === 'PostToolUse'
      ? rewriteFailure('project_unavailable')
      : deny('project_unavailable');
  }
  let runtime;
  try {
    runtime = loadProjectRuntime(projectRoot);
  } catch (_) {
    return payload.hook_event_name === 'PostToolUse'
      ? rewriteFailure('project_runtime_unavailable')
      : deny('project_runtime_unavailable');
  }
  const env = options.env || process.env;
  if (payload.hook_event_name === 'PreToolUse') return handlePre(payload, projectRoot, runtime, env);
  if (payload.hook_event_name === 'PostToolUse') return handlePost(payload, projectRoot, runtime, env);
  return null;
}

function processHookStdin(source, options = {}) {
  let payload;
  try {
    payload = JSON.parse(source);
  } catch (_) {
    return options.expectedEvent === 'PostToolUse'
      ? rewriteFailure('malformed_stdin')
      : deny('malformed_stdin');
  }
  return processHookPayload(payload, options);
}

function cliValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] || null;
}

function runCli(argv) {
  const expectedEvent = cliValue(argv, '--event');
  let source = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { source += chunk; });
  process.stdin.on('end', () => {
    const result = processHookStdin(source, { expectedEvent });
    if (result) process.stdout.write(JSON.stringify(result) + '\n');
  });
  process.stdin.on('error', () => {
    const result = expectedEvent === 'PostToolUse'
      ? rewriteFailure('malformed_stdin')
      : deny('malformed_stdin');
    process.stdout.write(JSON.stringify(result) + '\n');
  });
}

module.exports = {
  processHookPayload,
  processHookStdin,
};

if (require.main === module) runCli(process.argv.slice(2));
