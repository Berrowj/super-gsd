'use strict';

function assertCtxArray(ctx, name) {
  if (!Object.prototype.hasOwnProperty.call(ctx, name)) {
    throw new Error(`missing context array '${name}'`);
  }
  if (!Array.isArray(ctx[name])) {
    throw new Error(`context field '${name}' must be an array`);
  }
  return ctx[name];
}

function compareOp(op, actual, expected) {
  switch (op) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return actual > expected;
    case 'gte': return actual >= expected;
    case 'lt': return actual < expected;
    case 'lte': return actual <= expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
    default: throw new Error(`unknown op '${op}'`);
  }
}

function matchField(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    const entries = Object.entries(expected);
    if (entries.length !== 1) throw new Error('where-op object must have exactly one key');
    const [op, value] = entries[0];
    return compareOp(op, actual, value);
  }
  return actual === expected;
}

function matchWhere(item, where) {
  if (!where || typeof where !== 'object' || Array.isArray(where)) {
    throw new Error('where must be an object');
  }
  for (const [field, expected] of Object.entries(where)) {
    if (!Object.prototype.hasOwnProperty.call(item, field)) {
      throw new Error(`missing field '${field}' in iterated item`);
    }
    if (!matchField(item[field], expected)) return false;
  }
  return true;
}

function evalVotePredicate(clause, ctx) {
  if (!clause || typeof clause !== 'object' || Array.isArray(clause)) {
    throw new Error('predicate clause must be an object');
  }

  if (Array.isArray(clause.any)) {
    return clause.any.some((child) => evalVotePredicate(child, ctx));
  }
  if (Array.isArray(clause.all)) {
    return clause.all.every((child) => evalVotePredicate(child, ctx));
  }
  if (clause.over) {
    const arr = assertCtxArray(ctx, clause.over);
    return arr.some((item) => matchWhere(item, clause.where || {}));
  }
  if (clause.count_unique) {
    const spec = clause.count_unique;
    const arr = assertCtxArray(ctx, spec.over);
    const values = new Set(arr.map((item) => item[spec.field]));
    const compare = Object.entries(spec).filter(([k]) => !['over', 'field'].includes(k));
    if (compare.length !== 1) throw new Error('count_unique must have exactly one comparator');
    const [op, expected] = compare[0];
    return compareOp(op, values.size, expected);
  }
  if (clause.size) {
    const spec = clause.size;
    const arr = assertCtxArray(ctx, spec.over);
    const compare = Object.entries(spec).filter(([k]) => k !== 'over');
    if (compare.length !== 1) throw new Error('size must have exactly one comparator');
    const [op, expected] = compare[0];
    return compareOp(op, arr.length, expected);
  }

  const keys = Object.keys(clause);
  throw new Error(`unknown op '${keys[0] || 'unknown'}'`);
}

module.exports = { evalVotePredicate };
