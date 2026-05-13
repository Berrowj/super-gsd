'use strict';

const fs = require('fs');
const path = require('path');
const { evalVotePredicate } = require('./vote-predicate.cjs');

const _cache = new Map();
const DEFAULT_BOARD_PATH = path.resolve(__dirname, '..', '..', 'registry', 'board-members.yaml');

function loadYaml(boardYamlPath) {
  const yamlLibPath = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
  const yaml = require(yamlLibPath);
  return yaml.load(fs.readFileSync(boardYamlPath, 'utf8'));
}

function loadBoard(boardYamlPath = DEFAULT_BOARD_PATH) {
  const resolvedPath = path.resolve(boardYamlPath);
  if (_cache.has(resolvedPath)) return _cache.get(resolvedPath);
  const parsed = loadYaml(resolvedPath) || {};
  const members = Array.isArray(parsed.board_members) ? parsed.board_members : [];
  const board = {
    all: members,
    byName: Object.fromEntries(members.map((member) => [member.name, member])),
    escalation_policy: parsed.escalation_policy || {},
    default_minimal: (parsed.escalation_policy && parsed.escalation_policy.default_minimal_board) || [],
    always_present: (parsed.escalation_policy && parsed.escalation_policy.always_present) || [],
  };
  _cache.set(resolvedPath, board);
  return board;
}

function getMember(name, boardYamlPath = DEFAULT_BOARD_PATH) {
  const reg = loadBoard(boardYamlPath);
  const member = reg.byName[name];
  if (!member) throw new Error(`member '${name}' not in registry`);
  return member;
}

function isDispatchableMember(member) {
  if (!member) return false;
  const state = member.state || 'active';
  const model = String(member.model_default || member.model || '').toLowerCase();
  return state === 'active' && !['disabled', 'sonnet', 'haiku'].includes(model);
}

function addDispatchable(roster, reg, name) {
  const member = reg.byName[name];
  if (!member) throw new Error(`member '${name}' not in registry`);
  if (isDispatchableMember(member)) roster.add(name);
}

function resolveRoster(brief, firstRoundResults = null, boardYamlPath = DEFAULT_BOARD_PATH) {
  const reg = loadBoard(boardYamlPath);
  const roster = new Set();
  for (const name of [...reg.default_minimal, ...reg.always_present]) {
    addDispatchable(roster, reg, name);
  }
  if (!firstRoundResults) return [...roster];

  const clauses = Array.isArray(reg.escalation_policy.escalate_add) ? reg.escalation_policy.escalate_add : [];
  for (const clause of clauses) {
    const trigger = clause.when || clause.trigger;
    if (evalVotePredicate(trigger, { members: firstRoundResults, board: [...roster] })) {
      addDispatchable(roster, reg, clause.add);
    }
  }
  return [...roster];
}

function resetCache() {
  _cache.clear();
}

module.exports = { loadBoard, getMember, resolveRoster, resetCache, isDispatchableMember };
