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
  const bareContent = Array.isArray(toolResponse);
  if (!bareContent && (!toolResponse || typeof toolResponse !== 'object')) {
    throw new Error('malformed_response');
  }
  const content = bareContent ? toolResponse : toolResponse.content;
  if (!Array.isArray(content)) {
    throw new Error('malformed_response');
  }

  const candidates = [];
  for (let blockIndex = 0; blockIndex < content.length; blockIndex += 1) {
    const block = content[blockIndex];
    if (!block || block.type !== 'text' || typeof block.text !== 'string') continue;
    try {
      const domain = JSON.parse(block.text);
      if (domain && typeof domain === 'object' && !Array.isArray(domain)) {
        candidates.push({ domain, block, blockIndex });
      }
    } catch (_) {
      // Text blocks may carry non-JSON status output. Keep looking.
    }
  }

  let parsed;
  const hasStructuredContent = !bareContent
    && Object.prototype.hasOwnProperty.call(toolResponse, 'structuredContent');
  if (hasStructuredContent) {
    const structured = toolResponse.structuredContent;
    if (!structured
      || typeof structured !== 'object'
      || Array.isArray(structured)) {
      throw new Error('inconsistent_response');
    }
    parsed = candidates.find((candidate) => util.isDeepStrictEqual(structured, candidate.domain));
  } else {
    parsed = candidates.find((candidate) => Array.isArray(candidate.domain.hits)
      || (candidate.domain.evidence
        && typeof candidate.domain.evidence === 'object'
        && Array.isArray(candidate.domain.evidence.hits)));
    if (!parsed && candidates.length === 1) [parsed] = candidates;
  }
  if (!parsed) {
    throw new Error(hasStructuredContent ? 'inconsistent_response' : 'malformed_response');
  }
  return { ...parsed, bareContent, content };
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
  const serialized = JSON.stringify(response);
  return crypto.createHash('sha256')
    .update(Buffer.from(serialized === undefined ? 'undefined' : serialized, 'utf8'))
    .digest('hex');
}

function transitionWitnessAfterPost(payload, projectRoot, runtime, env, response, metrics = {}) {
  runtime.store.transitionWitnessToRewritten({
    projectRoot,
    env,
    sessionId: payload.session_id,
    toolUseId: payload.tool_use_id,
    payloadDigest: runtime.composer.substratePayloadDigest(payload.tool_input),
    responseDigest: responseDigest(response),
    degradationCount: metrics.degradationCount,
    originalChars: metrics.originalChars,
    retainedChars: metrics.retainedChars,
    topLevelHitCount: metrics.topLevelHitCount,
    evidenceHitCount: metrics.evidenceHitCount,
  });
}

function transitionWitnessAfterPassthrough(payload, projectRoot, runtime, env, response, reason) {
  runtime.store.transitionWitnessToPostPassthrough({
    projectRoot,
    env,
    sessionId: payload.session_id,
    toolUseId: payload.tool_use_id,
    payloadDigest: runtime.composer.substratePayloadDigest(payload.tool_input),
    responseDigest: responseDigest(response),
    reason,
  });
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
  if (message === 'inconsistent_response') return 'malformed_response';
  if (message === 'malformed_response') return 'malformed_response';
  return 'state_transition_failed';
}

function handlePost(payload, projectRoot, runtime, env) {
  if (typeof payload.session_id !== 'string' || !payload.session_id) return rewriteFailure('missing_session_id');
  if (typeof payload.tool_use_id !== 'string' || !payload.tool_use_id) return rewriteFailure('missing_tool_use_id');
  if (!runtime.composer.validateSubstrateToolInput(payload.tool_input)) {
    return rewriteFailure('invalid_v2_payload');
  }

  let parsed;
  try {
    parsed = parseMcpDomain(payload.tool_response);
  } catch (error) {
    if (error && error.message === 'malformed_response') {
      try {
        transitionWitnessAfterPassthrough(
          payload,
          projectRoot,
          runtime,
          env,
          payload.tool_response,
          'malformed_response',
        );
      } catch (_) {
        // An unparseable response must remain an unchanged fail-safe passthrough.
      }
      return null;
    }
    return rewriteFailure(postFailureReason(error));
  }

  try {
    const capped = runtime.composer.capSubstrateResponse(parsed.domain);
    if (!capped.response || typeof capped.response !== 'object' || Array.isArray(capped.response)) {
      return rewriteFailure('malformed_response');
    }
    const degradationNotes = mergeDegradationNotes(parsed.domain, capped.degradation_notes);
    const rewrittenDomain = degradationNotes.length > 0
      || Object.prototype.hasOwnProperty.call(parsed.domain, 'degradation_notes')
      ? { ...capped.response, degradation_notes: degradationNotes }
      : capped.response;
    const replacementContent = parsed.content.map((block, index) => index === parsed.blockIndex
      ? { ...parsed.block, text: JSON.stringify(rewrittenDomain) }
      : block);
    const replacement = parsed.bareContent
      ? replacementContent
      : {
        ...payload.tool_response,
        content: replacementContent,
        ...(Object.prototype.hasOwnProperty.call(payload.tool_response, 'structuredContent')
          ? { structuredContent: rewrittenDomain }
          : {}),
      };
    transitionWitnessAfterPost(payload, projectRoot, runtime, env, rewrittenDomain, {
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
  if (payload.tool_name !== TARGET_TOOL) return null;
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
