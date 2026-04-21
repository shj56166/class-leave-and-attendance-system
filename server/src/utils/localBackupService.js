const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { execFile } = require('child_process');
const sequelize = require('../config/database');
const { backupRoot, readBackupState, updateBackupState } = require('./backupState');

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const serverRoot = path.resolve(__dirname, '..', '..');
const exportScriptPath = path.join(projectRoot, 'scripts', 'export-local-mysql-backup.ps1');
const importScriptPath = path.join(projectRoot, 'scripts', 'import-local-mysql-backup.ps1');
const rebuildScriptPath = path.join(projectRoot, 'scripts', 'rebuild-leave-history-archives.js');
const tableNames = [
  'classes',
  'students',
  'teachers',
  'leave_requests',
  'leave_records',
  'leave_history_archives',
  'audit_logs',
  'student_login_logs',
  'dormitories',
  'SequelizeMeta'
];

function getDbConfig(overrides = {}) {
  return {
    host: overrides.DB_HOST || process.env.DB_HOST,
    port: String(overrides.DB_PORT || process.env.DB_PORT || 3306),
    user: overrides.DB_USER || process.env.DB_USER,
    password: overrides.DB_PASSWORD || process.env.DB_PASSWORD,
    database: overrides.DB_NAME || process.env.DB_NAME
  };
}

function findMySqlBinary(binaryName) {
  const candidates = [
    path.join('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin', binaryName),
    path.join('C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin', binaryName)
  ];

  const matched = candidates.find((candidate) => fs.existsSync(candidate));
  if (!matched) {
    throw new Error(`Unable to find ${binaryName}`);
  }

  return matched;
}

async function runPowerShell(args) {
  const { stdout, stderr } = await execFileAsync('powershell.exe', args, {
    cwd: projectRoot,
    maxBuffer: 50 * 1024 * 1024
  });

  if (stderr && stderr.trim()) {
    return { stdout, stderr };
  }

  return { stdout, stderr };
}

async function runExportScript(targetDatabase = process.env.DB_NAME) {
  const { stdout } = await runPowerShell([
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    exportScriptPath,
    '-ProjectRoot',
    projectRoot,
    '-TargetDatabase',
    targetDatabase
  ]);

  const outputLines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const backupLine = outputLines.find((line) => line.startsWith('Backup created:'));
  const manifestLine = outputLines.find((line) => line.startsWith('Manifest created:'));

  if (!backupLine || !manifestLine) {
    throw new Error(`Unexpected backup script output: ${stdout}`);
  }

  return {
    backupFile: backupLine.replace('Backup created:', '').trim(),
    manifestFile: manifestLine.replace('Manifest created:', '').trim()
  };
}

async function compressBackupFiles(sqlFile, manifestFile) {
  const zipFile = sqlFile.replace(/\.sql$/i, '.zip');
  await runPowerShell([
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Compress-Archive -Path @('${sqlFile.replace(/'/g, "''")}','${manifestFile.replace(/'/g, "''")}') -DestinationPath '${zipFile.replace(/'/g, "''")}' -Force`
  ]);
  return zipFile;
}

function stripUtf8Bom(content) {
  return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
}

function parseManifest(manifestPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(stripUtf8Bom(raw));
  } catch (error) {
    throw new Error(`Failed to parse backup manifest at ${manifestPath}: ${error.message}`);
  }
}

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex').toUpperCase();
}

function normalizeUploadedBase64(input) {
  return String(input || '').replace(/^data:.*;base64,/, '');
}

async function saveUploadedArchive({ archiveName, archiveBase64 }) {
  const uploadId = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const uploadDir = path.join(backupRoot, 'imports', uploadId);
  fs.mkdirSync(uploadDir, { recursive: true });

  const safeName = archiveName && archiveName.toLowerCase().endsWith('.zip')
    ? archiveName
    : `backup-${uploadId}.zip`;
  const archivePath = path.join(uploadDir, path.basename(safeName));
  fs.writeFileSync(archivePath, Buffer.from(normalizeUploadedBase64(archiveBase64), 'base64'));

  return { uploadId, uploadDir, archivePath };
}

async function expandArchive(archivePath, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  await runPowerShell([
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
  ]);
}

function findExtractedBackupFiles(extractDir) {
  const files = fs.readdirSync(extractDir);
  const sqlFile = files.find((file) => file.toLowerCase().endsWith('.sql'));
  const manifestFile = files.find((file) => file.toLowerCase().endsWith('.manifest.json'));

  if (!sqlFile || !manifestFile) {
    throw new Error('Backup archive must contain one .sql file and one .manifest.json file');
  }

  return {
    sqlPath: path.join(extractDir, sqlFile),
    manifestPath: path.join(extractDir, manifestFile)
  };
}

function validateBackupFiles(sqlPath, manifestPath) {
  const manifest = parseManifest(manifestPath);
  const actualHash = computeSha256(sqlPath);
  const expectedHash = String(manifest?.backup?.sha256 || '').toUpperCase();

  if (!expectedHash || actualHash !== expectedHash) {
    throw new Error('Backup SHA256 does not match manifest');
  }

  return manifest;
}

async function runImportScript(sqlPath, targetDatabase) {
  await runPowerShell([
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    importScriptPath,
    '-BackupFile',
    sqlPath,
    '-ProjectRoot',
    projectRoot,
    '-TargetDatabase',
    targetDatabase
  ]);
}

async function runMigrationsForDatabase(databaseName) {
  await execFileAsync('cmd.exe', ['/c', 'npx', 'sequelize-cli', 'db:migrate'], {
    cwd: serverRoot,
    env: {
      ...process.env,
      DB_NAME: databaseName
    },
    maxBuffer: 20 * 1024 * 1024
  });
}

async function rebuildArchivesForDatabase(databaseName) {
  await execFileAsync('node', [rebuildScriptPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DB_NAME: databaseName
    },
    maxBuffer: 20 * 1024 * 1024
  });
}

async function runMysqlQuery(databaseName, query) {
  const mysqlBinary = findMySqlBinary('mysql.exe');
  const db = getDbConfig({ DB_NAME: databaseName });
  const { stdout } = await execFileAsync(mysqlBinary, [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    `--password=${db.password}`,
    `--database=${databaseName}`,
    '-N',
    '-e',
    query
  ], {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024
  });

  return stdout;
}

async function getTableCounts(databaseName) {
  const countQuery = tableNames
    .map((table) => `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM \`${table}\``)
    .join(' UNION ALL ');
  const raw = await runMysqlQuery(databaseName, `${countQuery};`);

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce((accumulator, line) => {
      const [table, count] = line.trim().split(/\s+/, 2);
      accumulator[table] = Number(count || 0);
      return accumulator;
    }, {});
}

async function getMigrationList(databaseName) {
  const raw = await runMysqlQuery(databaseName, 'SELECT name FROM `SequelizeMeta` ORDER BY name;');
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function buildComparisonSummary(currentCounts, previewCounts, currentMigrations, previewMigrations) {
  return {
    tables: tableNames.map((table) => ({
      table,
      currentCount: Number(currentCounts[table] || 0),
      previewCount: Number(previewCounts[table] || 0),
      diff: Number(previewCounts[table] || 0) - Number(currentCounts[table] || 0)
    })),
    migrations: {
      currentOnly: currentMigrations.filter((item) => !previewMigrations.includes(item)),
      previewOnly: previewMigrations.filter((item) => !currentMigrations.includes(item)),
      sharedCount: currentMigrations.filter((item) => previewMigrations.includes(item)).length
    }
  };
}

function sanitizePreviewState(preview) {
  if (!preview) {
    return null;
  }

  return {
    previewId: preview.previewId,
    previewDatabase: preview.previewDatabase,
    archiveName: preview.archiveName,
    createdAt: preview.createdAt,
    manifest: preview.manifest,
    comparison: preview.comparison,
    importedFrom: preview.importedFrom
  };
}

async function previewBackupImport({ archiveName, archiveBase64 }) {
  const { uploadId, uploadDir, archivePath } = await saveUploadedArchive({ archiveName, archiveBase64 });
  const extractDir = path.join(uploadDir, 'extracted');
  await expandArchive(archivePath, extractDir);

  const { sqlPath, manifestPath } = findExtractedBackupFiles(extractDir);
  const manifest = validateBackupFiles(sqlPath, manifestPath);
  const previewDatabase = `${process.env.DB_NAME}_preview_${uploadId.slice(0, 14)}`;

  await runImportScript(sqlPath, previewDatabase);
  await runMigrationsForDatabase(previewDatabase);
  await rebuildArchivesForDatabase(previewDatabase);

  const [currentCounts, previewCounts, currentMigrations, previewMigrations] = await Promise.all([
    getTableCounts(process.env.DB_NAME),
    getTableCounts(previewDatabase),
    getMigrationList(process.env.DB_NAME),
    getMigrationList(previewDatabase)
  ]);

  const previewState = {
    previewId: uploadId,
    previewDatabase,
    archiveName: path.basename(archivePath),
    archivePath,
    uploadDir,
    extractDir,
    sqlPath,
    manifestPath,
    manifest: {
      createdAt: manifest.createdAt || null,
      backup: manifest.backup || null,
      tableCounts: manifest.tableCounts || [],
      migrations: manifest.migrations || []
    },
    comparison: buildComparisonSummary(currentCounts, previewCounts, currentMigrations, previewMigrations),
    importedFrom: {
      sqlFile: path.basename(sqlPath),
      manifestFile: path.basename(manifestPath)
    },
    createdAt: new Date().toISOString()
  };

  updateBackupState((state) => ({
    ...state,
    lastPreview: sanitizePreviewState(previewState),
    previews: [
      ...state.previews.filter((item) => item.previewId !== uploadId),
      previewState
    ]
  }));

  return sanitizePreviewState(previewState);
}

async function exportCurrentDatabaseZip() {
  const { backupFile, manifestFile } = await runExportScript(process.env.DB_NAME);
  const zipFile = await compressBackupFiles(backupFile, manifestFile);
  const manifest = parseManifest(manifestFile);

  const exportState = {
    createdAt: new Date().toISOString(),
    zipFile,
    backupFile,
    manifestFile,
    manifest: {
      createdAt: manifest.createdAt || null,
      backup: manifest.backup || null,
      tableCounts: manifest.tableCounts || [],
      migrations: manifest.migrations || []
    }
  };

  updateBackupState((state) => ({
    ...state,
    lastExport: {
      createdAt: exportState.createdAt,
      fileName: path.basename(zipFile),
      manifest: exportState.manifest
    }
  }));

  return exportState;
}

async function replaceDatabaseFromPreview(previewId) {
  const state = readBackupState();
  const preview = state.previews.find((item) => item.previewId === previewId);
  if (!preview) {
    throw new Error('Preview import not found');
  }

  const safetyBackup = await exportCurrentDatabaseZip();
  await runImportScript(preview.sqlPath, process.env.DB_NAME);
  await runMigrationsForDatabase(process.env.DB_NAME);
  await rebuildArchivesForDatabase(process.env.DB_NAME);
  await sequelize.authenticate();

  const [currentCounts, currentMigrations] = await Promise.all([
    getTableCounts(process.env.DB_NAME),
    getMigrationList(process.env.DB_NAME)
  ]);

  const replaceState = {
    createdAt: new Date().toISOString(),
    previewId,
    previewDatabase: preview.previewDatabase,
    safetyBackup: {
      fileName: path.basename(safetyBackup.zipFile),
      createdAt: safetyBackup.createdAt
    },
    validation: {
      tables: currentCounts,
      migrations: currentMigrations
    }
  };

  updateBackupState((currentState) => ({
    ...currentState,
    lastReplace: replaceState
  }));

  return replaceState;
}

async function deletePreviewDatabase(previewId) {
  const state = readBackupState();
  const preview = state.previews.find((item) => item.previewId === previewId);
  if (!preview) {
    throw new Error('Preview import not found');
  }

  const mysqlBinary = findMySqlBinary('mysql.exe');
  const db = getDbConfig();
  await execFileAsync(mysqlBinary, [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    `--password=${db.password}`,
    '-e',
    `DROP DATABASE IF EXISTS \`${preview.previewDatabase}\`;`
  ], {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024
  });

  fs.rmSync(preview.uploadDir, { recursive: true, force: true });

  updateBackupState((currentState) => ({
    ...currentState,
    lastPreview: currentState.lastPreview?.previewId === previewId ? null : currentState.lastPreview,
    previews: currentState.previews.filter((item) => item.previewId !== previewId)
  }));
}

module.exports = {
  exportCurrentDatabaseZip,
  previewBackupImport,
  replaceDatabaseFromPreview,
  deletePreviewDatabase,
  sanitizePreviewState
};
