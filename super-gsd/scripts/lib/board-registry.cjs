'use strict';

const fs = require('fs');
const path = require('path');
const { evalVotePredicate } = require('./vote-predicate.cjs');

let _cache = null;
const DEFAULT_BOARD_PATH = path.resolve(__dirname, '..', '..', 'registry', 'board-members.yaml');

function loadYaml(boardYamlPath) {
  const yamlLibPath = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
  const yaml = require(yamlLibPath);
  return yaml.load(fs.readFileSync(boardYamlPath, 'utf8'));
}

function loadBoard(boardYamlPath = DEFAULT_BOARD_PATH) {
  if (_cache) return _cache;
  const parsed = loadYaml(boardYamlPath) || {};
  const members = Array.isArray(parsed.board_members) ? parsed.board_members : [];
  _cache = {
    all: members,
    byName: Object.fromEntries(members.map((member) => [member.name, member])),
    escalation_policy: parsed.escalation_policy || {},
    default_minimal: (parsed.escalation_policy && parsed.escalation_policy.default_minimal_board) || [],
    always_present: (parsed.escalation_policy && parsed.escalation_policy.always_present) || [],
  };
  return _cache;
}

function getMember(name, boardYamlPath = DEFAULT_BOARD_PATH) {
  const reg = loadBoard(boardYamlPath);
  const member = reg.byName[name];
  if (!member) throw new Error(`member '${name}' not in registry`);
  return member;
}

function resolveRoster(brief, firstRoundResults = null, boardYamlPath = DEFAULT_BOARD_PATH) {
  const reg = loadBoard(boardYamlPath);
  const roster = new Set([...reg.default_minimal, ...reg.always_present]);
  if (!firstRoundResults) return [...roster];

  const clauses = Array.isArray(reg.escalation_policy.escalate_add) ? reg.escalation_policy.escalate_add : [];
  for (const clause of clauses) {
    const trigger = clause.when || clause.trigger;
    if (evalVotePredicate(trigger, { members: firstRoundResults, board: [...roster] })) {
      roster.add(clause.add);
    }
  }
  return [...roster];
}

function resetCache() {
  _cache = null;
}

module.exports = { loadBoard, getMember, resolveRoster, resetCache };
