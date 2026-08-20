'use strict';

const assert = require('assert');
const { randomUUID } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { threadId } = require('worker_threads');

const REASONS = Object.freeze([
  'existing_path_adequate',
  'enrichment_empty_hit',
  'enrichment_off_topic',
  'enrichment_stale',
  'no_enrichment_attempted',
  'other_inadequate',
]);

const ROUTED_SURFACES = Object.freeze([
  'vtp_search_substrate',
  'wiki_search',
  'vtp_route_and_retrieve',
  '/vtp-implementation-pack',
  'vtp_triage',
]);

const ALLOWED_FIELDS = new Set([
  'schema_version',
  'decision_id',
  'query',
  'adequate',
  'reason',
  'note',
  'latency_ms',
  'est_tokens',
  'vtp_call_count',
  'denominator',
  'artefact_kind',
]);

const REQUIRED_FIELDS = Object.freeze([
  'schema_version',
  'decision_id',
  'adequate',
  'reason',
  'latency_ms',
  'est_tokens',
  'vtp_call_count',
]);

const LOCK_TIMEOUT_MS = 2000;
const LOCK_RETRY_MS = 5;
const LOCK_WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function canonicalizeRow(row) {
  const canonical = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.hasOwn(row, field)) canonical[field] = row[field];
  }
  return canonical;
}

function failureResult(error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

function readLockOwner(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    return null;
  }
}

function createLock(lockPath) {
  const handle = fs.openSync(lockPath, 'wx');
  try {
    const token = randomUUID();
    fs.writeFileSync(handle, JSON.stringify({
      pid: process.pid,
      thread_id: threadId,
      token,
      created_at_ms: Date.now(),
    }), 'utf8');
    return { handle, token };
  } catch (error) {
    try { fs.closeSync(handle); } catch {}
    try { fs.unlinkSync(lockPath); } catch {}
    throw error;
  }
}

function acquireLock(lockPath) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      return createLock(lockPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw error;
      Atomics.wait(LOCK_WAIT_ARRAY, 0, 0, LOCK_RETRY_MS);
    }
  }
}

function validateRow(row) {
  const errors = [];
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { valid: false, errors: ['row must be an object'] };
  }

  for (const field of Object.keys(row)) {
    if (!ALLOWED_FIELDS.has(field)) errors.push(`unexpected field: ${field}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(row, field)) errors.push(`${field} is required`);
  }
  if (!Number.isInteger(row.schema_version)) errors.push('schema_version must be an integer');
  if (!isNonEmptyString(row.decision_id)) errors.push('decision_id must be a non-empty string');
  if (Object.hasOwn(row, 'query') && !isNonEmptyString(row.query)) {
    errors.push('query must be a non-empty string when provided');
  }
  if (typeof row.adequate !== 'boolean') errors.push('adequate must be a boolean');
  if (!REASONS.includes(row.reason)) errors.push(`reason must be one of: ${REASONS.join(', ')}`);
  if (row.reason === 'other_inadequate' && (
    !Object.hasOwn(row, 'note') || !isNonEmptyString(row.note)
  )) {
    errors.push('note must be a non-empty string when reason is other_inadequate');
  }
  if (row.note !== undefined && !isNonEmptyString(row.note)) {
    errors.push('note must be a non-empty string when provided');
  }
  if (!isNonNegativeNumber(row.latency_ms)) errors.push('latency_ms must be a non-negative number');
  if (!isNonNegativeNumber(row.est_tokens)) errors.push('est_tokens must be a non-negative number');
  if (!isNonNegativeNumber(row.vtp_call_count)) errors.push('vtp_call_count must be a non-negative number');
  if (Object.hasOwn(row, 'denominator') && (
    !Number.isInteger(row.denominator) || row.denominator < 1
  )) {
    errors.push('denominator must be a positive integer when provided');
  }
  if (row.artefact_kind !== undefined && row.artefact_kind !== null && !isNonEmptyString(row.artefact_kind)) {
    errors.push('artefact_kind must be null or a non-empty string when provided');
  }

  return { valid: errors.length === 0, errors };
}

function appendRow(planningDir, row) {
  let lock;
  let lockPath;
  let result;
  try {
    if (!isNonEmptyString(planningDir)) throw new Error('planningDir must be a non-empty string');
    const validation = validateRow(row);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const canonicalRow = canonicalizeRow(row);
    const canonicalValidation = validateRow(canonicalRow);
    if (!canonicalValidation.valid) throw new Error(canonicalValidation.errors.join('; '));

    const ledgerPath = path.join(
      planningDir,
      'metrics',
      'triage-advisory',
      'demand-baseline.jsonl'
    );
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    lockPath = `${ledgerPath}.lock`;
    lock = acquireLock(lockPath);

    if (fs.existsSync(ledgerPath)) {
      const duplicate = fs.readFileSync(ledgerPath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .some((line) => {
          try {
            return JSON.parse(line).decision_id === canonicalRow.decision_id;
          } catch {
            return false;
          }
        });
      if (duplicate) result = { ok: true, deduped: true };
    }

    if (!result) {
      fs.appendFileSync(ledgerPath, `${JSON.stringify(canonicalRow)}\n`, 'utf8');
      result = { ok: true, deduped: false };
    }
  } catch (error) {
    result = failureResult(error);
  } finally {
    if (lock !== undefined) {
      try {
        fs.closeSync(lock.handle);
      } catch (error) {
        if (result?.ok) result = failureResult(error);
      }
      try {
        const owner = readLockOwner(lockPath);
        if (owner?.token !== lock.token) {
          throw new Error('lock ownership changed before release');
        }
        fs.unlinkSync(lockPath);
      } catch (error) {
        if (result?.ok) result = failureResult(error);
      }
    }
  }
  return result;
}

function eligibleQueryRow(input, denominator) {
  const row = {
    schema_version: 1,
    decision_id: input.decision_id,
    adequate: input.adequate,
    reason: input.reason,
    latency_ms: input.latency_ms,
    est_tokens: input.est_tokens,
    vtp_call_count: input.vtp_call_count,
    denominator,
    artefact_kind: input.artefact_kind ?? null,
  };
  if (Object.hasOwn(input, 'query')) row.query = input.query;
  if (Object.hasOwn(input, 'note')) row.note = input.note;
  return row;
}

function readDenominatorState(denominatorPath) {
  if (!fs.existsSync(denominatorPath)) {
    return { schema_version: 1, denominator: 0, decision_ids: [] };
  }

  const state = JSON.parse(fs.readFileSync(denominatorPath, 'utf8'));
  const idsAreValid = Array.isArray(state?.decision_ids)
    && state.decision_ids.every(isNonEmptyString)
    && new Set(state.decision_ids).size === state.decision_ids.length;
  if (
    state?.schema_version !== 1
    || !Number.isInteger(state.denominator)
    || state.denominator < 0
    || !idsAreValid
    || state.denominator !== state.decision_ids.length
  ) {
    throw new Error('denominator state is invalid');
  }
  return state;
}

function recordDemand(planningDir, input, allowQueryless) {
  let lock;
  let lockPath;
  let result;
  try {
    if (!isNonEmptyString(planningDir)) throw new Error('planningDir must be a non-empty string');
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('eligible query must be an object');
    }
    if (!allowQueryless && !Object.hasOwn(input, 'query')) {
      throw new Error('eligible query must include query');
    }

    const preliminaryRow = eligibleQueryRow(input, 1);
    const preliminaryValidation = validateRow(preliminaryRow);
    if (!preliminaryValidation.valid) throw new Error(preliminaryValidation.errors.join('; '));

    const ledgerDir = path.join(planningDir, 'metrics', 'triage-advisory');
    const denominatorPath = path.join(ledgerDir, 'denominator.json');
    fs.mkdirSync(ledgerDir, { recursive: true });
    lockPath = `${denominatorPath}.lock`;
    lock = acquireLock(lockPath);

    const state = readDenominatorState(denominatorPath);
    if (state.decision_ids.includes(preliminaryRow.decision_id)) {
      result = { ok: true, deduped: true, denominator: state.denominator };
    } else {
      const denominator = state.denominator + 1;
      const row = eligibleQueryRow(input, denominator);
      const validation = validateRow(row);
      if (!validation.valid) throw new Error(validation.errors.join('; '));

      const appendResult = appendRow(planningDir, row);
      if (!appendResult.ok) {
        result = appendResult;
      } else {
        const nextState = {
          schema_version: 1,
          denominator,
          decision_ids: [...state.decision_ids, row.decision_id],
        };
        fs.writeFileSync(denominatorPath, `${JSON.stringify(nextState)}\n`, 'utf8');
        result = { ...appendResult, denominator };
      }
    }
  } catch (error) {
    result = failureResult(error);
  } finally {
    if (lock !== undefined) {
      try {
        fs.closeSync(lock.handle);
      } catch (error) {
        if (result?.ok) result = failureResult(error);
      }
      try {
        const owner = readLockOwner(lockPath);
        if (owner?.token !== lock.token) {
          throw new Error('lock ownership changed before release');
        }
        fs.unlinkSync(lockPath);
      } catch (error) {
        if (result?.ok) result = failureResult(error);
      }
    }
  }
  return result;
}

function recordEligibleQuery(planningDir, input) {
  return recordDemand(planningDir, input, false);
}

function recordRoutedDemand(planningDir, input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('routed demand must be an object');
    }
    if (!ROUTED_SURFACES.includes(input.surface)) {
      throw new Error('routed demand surface is invalid');
    }
    return recordDemand(planningDir, {
      decision_id: input.decision_id,
      adequate: false,
      reason: 'no_enrichment_attempted',
      latency_ms: input.latency_ms,
      est_tokens: 0,
      vtp_call_count: 0,
      artefact_kind: input.surface,
    }, true);
  } catch (error) {
    return failureResult(error);
  }
}

function selfTest() {
  let passed = 0;
  let failed = 0;
  const failures = [];
  const check = (name, assertion) => {
    try {
      assertion();
      passed += 1;
    } catch (error) {
      failed += 1;
      failures.push(`${name}: ${error.message}`);
    }
  };
  const validRow = (overrides = {}) => ({
    schema_version: 1,
    decision_id: 'self-test-decision',
    adequate: true,
    reason: 'existing_path_adequate',
    latency_ms: 1,
    est_tokens: 2,
    vtp_call_count: 0,
    artefact_kind: null,
    ...overrides,
  });
  const validEligibleQuery = (overrides = {}) => ({
    decision_id: 'self-test-eligible',
    query: 'What existing evidence answers this query?',
    adequate: true,
    reason: 'existing_path_adequate',
    latency_ms: 1,
    est_tokens: 2,
    vtp_call_count: 0,
    ...overrides,
  });
  const validRoutedDemand = (overrides = {}) => ({
    decision_id: 'self-test-routed',
    surface: 'vtp_search_substrate',
    latency_ms: 1,
    ...overrides,
  });
  const without = (row, key) => {
    const copy = { ...row };
    delete copy[key];
    return copy;
  };

  check('valid row accepted', () => assert.strictEqual(validateRow(validRow()).valid, true));
  check('missing schema_version rejected', () => {
    assert.strictEqual(validateRow(without(validRow(), 'schema_version')).valid, false);
  });
  check('inherited required fields rejected', () => {
    assert.strictEqual(validateRow(Object.create(validRow())).valid, false);
  });
  check('missing reason rejected', () => {
    assert.strictEqual(validateRow(without(validRow(), 'reason')).valid, false);
  });
  check('blank reason rejected', () => {
    assert.strictEqual(validateRow(validRow({ reason: '  ' })).valid, false);
  });
  check('out-of-enum reason rejected', () => {
    assert.strictEqual(validateRow(validRow({ reason: 'unknown' })).valid, false);
  });
  check('other_inadequate without note rejected', () => {
    assert.strictEqual(validateRow(validRow({ reason: 'other_inadequate' })).valid, false);
  });
  check('other_inadequate with inherited note rejected', () => {
    const row = validRow({ reason: 'other_inadequate' });
    Object.setPrototypeOf(row, { note: 'inherited note' });
    assert.strictEqual(validateRow(row).valid, false);
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demand-baseline-self-test-'));
  try {
    check('duplicate decision_id deduped', () => {
      assert.deepStrictEqual(appendRow(tmp, validRow()), { ok: true, deduped: false });
      assert.deepStrictEqual(appendRow(tmp, validRow({ latency_ms: 3 })), { ok: true, deduped: true });
      const written = fs.readFileSync(
        path.join(tmp, 'metrics', 'triage-advisory', 'demand-baseline.jsonl'),
        'utf8'
      ).trim().split(/\r?\n/);
      assert.strictEqual(written.length, 1);
      assert.strictEqual(fs.existsSync(
        path.join(tmp, 'metrics', 'triage-advisory', 'demand-baseline.jsonl.lock')
      ), false);
    });
    check('canonical row serialized', () => {
      const hookedRow = validRow({ decision_id: 'hooked-row' });
      Object.setPrototypeOf(hookedRow, { toJSON: () => ({}) });
      assert.deepStrictEqual(appendRow(tmp, hookedRow), { ok: true, deduped: false });
      const written = fs.readFileSync(
        path.join(tmp, 'metrics', 'triage-advisory', 'demand-baseline.jsonl'),
        'utf8'
      ).trim().split(/\r?\n/).map(JSON.parse);
      assert.strictEqual(written.at(-1).decision_id, 'hooked-row');
    });
    check('write failure returned', () => {
      const blockedPlanningDir = path.join(tmp, 'not-a-directory');
      fs.writeFileSync(blockedPlanningDir, 'blocking file', 'utf8');
      let result;
      assert.doesNotThrow(() => {
        result = appendRow(blockedPlanningDir, validRow({ decision_id: 'write-failure' }));
      });
      assert.strictEqual(result.ok, false);
    });

    const instrumentDir = path.join(tmp, 'instrument');
    const instrumentLedgerPath = path.join(
      instrumentDir,
      'metrics',
      'triage-advisory',
      'demand-baseline.jsonl'
    );
    const denominatorPath = path.join(
      instrumentDir,
      'metrics',
      'triage-advisory',
      'denominator.json'
    );
    check('eligible query recording increments once and dedupes replay', () => {
      assert.deepStrictEqual(
        recordEligibleQuery(instrumentDir, validEligibleQuery()),
        { ok: true, deduped: false, denominator: 1 }
      );
      assert.deepStrictEqual(
        recordEligibleQuery(instrumentDir, validEligibleQuery({ latency_ms: 9 })),
        { ok: true, deduped: true, denominator: 1 }
      );
      assert.deepStrictEqual(
        recordEligibleQuery(instrumentDir, validEligibleQuery({
          decision_id: 'self-test-eligible-2',
          query: 'What existing evidence answers the second query?',
        })),
        { ok: true, deduped: false, denominator: 2 }
      );
      const rows = fs.readFileSync(instrumentLedgerPath, 'utf8')
        .trim().split(/\r?\n/).map(JSON.parse);
      const state = JSON.parse(fs.readFileSync(denominatorPath, 'utf8'));
      assert.deepStrictEqual(rows.map((row) => row.denominator), [1, 2]);
      assert.strictEqual(state.denominator, 2);
    });
    check('invalid eligible query is rejected before denominator mutation', () => {
      const before = fs.readFileSync(denominatorPath, 'utf8');
      const result = recordEligibleQuery(instrumentDir, validEligibleQuery({
        decision_id: 'invalid-eligible',
        reason: 'unknown',
      }));
      assert.strictEqual(result.ok, false);
      assert.strictEqual(fs.readFileSync(denominatorPath, 'utf8'), before);
    });
    check('routed demand is text-free and replay-safe', () => {
      assert.deepStrictEqual(recordRoutedDemand(instrumentDir, validRoutedDemand()), {
        ok: true, deduped: false, denominator: 3,
      });
      assert.deepStrictEqual(recordRoutedDemand(
        instrumentDir, validRoutedDemand({ latency_ms: 9 }),
      ), { ok: true, deduped: true, denominator: 3 });
      const rows = fs.readFileSync(instrumentLedgerPath, 'utf8')
        .trim().split(/\r?\n/).map(JSON.parse);
      const row = rows.at(-1);
      assert.strictEqual(row.artefact_kind, 'vtp_search_substrate');
      assert.strictEqual(row.reason, 'no_enrichment_attempted');
      assert.strictEqual(row.vtp_call_count, 0);
      assert.strictEqual(Object.hasOwn(row, 'query'), false);
      assert.strictEqual(Object.hasOwn(row, 'note'), false);
    });
    check('unknown routed surface is rejected without denominator mutation', () => {
      const before = fs.readFileSync(denominatorPath, 'utf8');
      const result = recordRoutedDemand(instrumentDir, validRoutedDemand({
        decision_id: 'invalid-routed',
        surface: 'unknown_surface',
      }));
      assert.strictEqual(result.ok, false);
      assert.strictEqual(fs.readFileSync(denominatorPath, 'utf8'), before);
    });
    check('eligible query write failure returned', () => {
      const blockedPlanningDir = path.join(tmp, 'instrument-not-a-directory');
      fs.writeFileSync(blockedPlanningDir, 'blocking file', 'utf8');
      let result;
      assert.doesNotThrow(() => {
        result = recordEligibleQuery(blockedPlanningDir, validEligibleQuery({
          decision_id: 'instrument-write-failure',
        }));
      });
      assert.strictEqual(result.ok, false);
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.stdout.write(`${passed} pass, ${failed} fail\n`);
  return failed === 0 ? 0 : 1;
}

if (require.main === module && process.argv.includes('--self-test')) {
  process.exitCode = selfTest();
}

module.exports = {
  appendRow,
  recordEligibleQuery,
  recordRoutedDemand,
  validateRow,
  ROUTED_SURFACES,
};
