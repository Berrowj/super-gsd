'use strict';

const fs = require('fs');
const path = require('path');

const LOCAL_ROUTING_PATH = path.resolve(__dirname, '..', '..', 'config', 'model-routing.json');
const GLOBAL_ROUTING_PATH = path.resolve(__dirname, '..', '..', '..', 'get-shit-done', 'config', 'model-routing.json');
const DEFAULT_ROUTING_PATH = fs.existsSync(LOCAL_ROUTING_PATH) ? LOCAL_ROUTING_PATH : GLOBAL_ROUTING_PATH;

function loadRouting(filePath = DEFAULT_ROUTING_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRoleConfig(routing, role) {
  let value = role.split('.').reduce((node, key) => node && node[key], routing);
  if (value === undefined && role.includes('.')) value = routing[role.split('.').pop()];
  if (typeof value === 'string') return { default: value, allowed: [value] };
  if (!value || typeof value !== 'object') throw new Error(`unknown routing role '${role}'`);
  const allowed = Array.isArray(value.allowed) ? value.allowed : (value.default ? [value.default] : []);
  if (!value.default || !allowed.length) throw new Error(`routing role '${role}' must define default and allowed`);
  return { ...value, allowed };
}

function validateRouting(config) {
  const routing = config.model_routing || config;
  const catalog = routing.models || config.models || {};
  if (!catalog || typeof catalog !== 'object' || !Object.keys(catalog).length) {
    throw new Error('model routing catalog is empty');
  }
  function visit(node, prefix) {
    for (const [role, raw] of Object.entries(node)) {
      if (role === 'schema_version' || role === 'models') continue;
      const fullRole = prefix ? `${prefix}.${role}` : role;
      if (typeof raw === 'object' && raw && !raw.default && !raw.allowed && !Array.isArray(raw)) {
        visit(raw, fullRole);
        continue;
      }
      const roleConfig = normalizeRoleConfig(routing, fullRole);
      if (!Object.hasOwn(catalog, roleConfig.default)) throw new Error(`role '${fullRole}' default '${roleConfig.default}' is not in model catalog`);
      for (const model of roleConfig.allowed) {
        if (!Object.hasOwn(catalog, model)) throw new Error(`role '${fullRole}' allowed model '${model}' is not in model catalog`);
      }
    }
  }
  visit(routing, '');
  return true;
}

function resolveModel({ config, role, override, classifierModel } = {}) {
  if (!config) throw new Error('model routing config is required');
  validateRouting(config);
  const routing = config.model_routing || config;
  const catalog = routing.models || config.models;
  const roleConfig = normalizeRoleConfig(routing, role);
  const selected = override || classifierModel || roleConfig.default;
  if (!roleConfig.allowed.includes(selected)) throw new Error(`model '${selected}' is not allowed for role '${role}'`);
  return { id: selected, ...catalog[selected], role, source: override ? 'override' : classifierModel ? 'classifier' : 'default' };
}

module.exports = { loadRouting, validateRouting, resolveModel };

if (require.main === module) {
  const role = process.env.AGENT_ROLE || process.argv[2] || 'execution.executor';
  const override = process.env.SGSD_MODEL_OVERRIDE || process.env[`SGSD_MODEL_${role.replace(/\./g, '_').toUpperCase()}`];
  const classifierModel = process.env.CLASSIFIER_MODEL || '';
  const filePath = process.env.SGSD_MODEL_ROUTING_FILE || DEFAULT_ROUTING_PATH;
  const config = loadRouting(filePath);
  process.stdout.write(`${resolveModel({ config, role, override, classifierModel }).id}\n`);
}
