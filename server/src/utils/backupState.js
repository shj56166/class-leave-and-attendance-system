const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const backupRoot = path.join(projectRoot, 'backups');
const stateFile = path.join(backupRoot, 'backup-state.json');

const defaultState = {
  settings: {
    enabled: false,
    schedule: '0 2 * * *',
    retentionDays: 14,
    destination: 'backups/',
    lastRunAt: null,
    lastRunStatus: 'idle'
  },
  lastExport: null,
  lastPreview: null,
  lastReplace: null,
  previews: []
};

function ensureBackupRoot() {
  fs.mkdirSync(backupRoot, { recursive: true });
}

function readBackupState() {
  ensureBackupRoot();

  if (!fs.existsSync(stateFile)) {
    return { ...defaultState };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return {
      ...defaultState,
      ...parsed,
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {})
      },
      previews: Array.isArray(parsed.previews) ? parsed.previews : []
    };
  } catch (error) {
    return { ...defaultState };
  }
}

function writeBackupState(nextState) {
  ensureBackupRoot();
  fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2), 'utf8');
}

function updateBackupState(mutator) {
  const current = readBackupState();
  const next = mutator({
    ...current,
    previews: Array.isArray(current.previews) ? [...current.previews] : []
  }) || current;
  writeBackupState(next);
  return next;
}

module.exports = {
  backupRoot,
  readBackupState,
  writeBackupState,
  updateBackupState
};
