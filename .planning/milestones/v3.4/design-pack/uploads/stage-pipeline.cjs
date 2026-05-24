const fs = require('fs');

const STAGES = Object.freeze([
  Object.freeze({
    name: 'research',
    owner: 'codex/xhigh',
    sla_minutes: 30,
    artifact_glob: 'RESEARCH.md',
  }),
  Object.freeze({
    name: 'vtp-enrich',
    owner: 'vtp-enrich',
    sla_minutes: 5,
    artifact_glob: 'VTP-ENRICHMENT.md',
  }),
  Object.freeze({
    name: 'plan',
    owner: 'codex/xhigh',
    sla_minutes: 20,
    artifact_glob: '*PLAN-LOCKED.md',
  }),
  Object.freeze({
    name: 'execute',
    owner: 'codex/xhigh',
    sla_minutes: 90,
    artifact_glob: '*executor*',
  }),
  Object.freeze({
    name: 'verify',
    owner: 'codex/xhigh',
    sla_minutes: 15,
    artifact_glob: 'VERIFICATION.md',
  }),
]);

function readPhaseDir(phaseDir) {
  if (!phaseDir) {
    return null;
  }

  try {
    return fs.readdirSync(phaseDir);
  } catch (_error) {
    return null;
  }
}

function escapeRegexLiteral(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function artifactMatches(pattern, entry) {
  if (!pattern.includes('*')) {
    return entry === pattern;
  }

  const regex = new RegExp(`^${pattern.split('*').map(escapeRegexLiteral).join('.*')}$`);
  return regex.test(entry);
}

function stageArtifactPresent(phaseDir, stage) {
  const entries = readPhaseDir(phaseDir);
  if (!entries || !stage || !stage.artifact_glob) {
    return false;
  }

  return entries.some((entry) => artifactMatches(stage.artifact_glob, entry));
}

function pendingStages() {
  return STAGES.map(({ name, owner, sla_minutes }) => ({
    name,
    owner,
    sla_minutes,
    status: 'pending',
  }));
}

function computeStagePipeline({ phase_dir, vtp_enabled, blocker } = {}) {
  const entries = readPhaseDir(phase_dir);
  if (!entries) {
    return {
      stages: pendingStages(),
      active_index: 0,
      blocker,
    };
  }

  const doneStates = STAGES.map((stage) => {
    if (stage.name === 'vtp-enrich' && vtp_enabled === false) {
      return true;
    }

    return stageArtifactPresent(phase_dir, stage);
  });

  const activeIndex = doneStates.findIndex((done) => !done);

  const stages = STAGES.map(({ name, owner, sla_minutes }, index) => {
    let status = 'pending';
    if (doneStates[index]) {
      status = 'done';
    } else if (index === activeIndex) {
      status = blocker ? 'blocked' : 'active';
    }

    return {
      name,
      owner,
      sla_minutes,
      status,
    };
  });

  return {
    stages,
    active_index: activeIndex,
    blocker,
  };
}

module.exports = {
  STAGES,
  computeStagePipeline,
  stageArtifactPresent,
};
