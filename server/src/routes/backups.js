const fs = require('fs');
const express = require('express');
const { authMiddleware, requireTeacher, requireAdmin } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');
const { readBackupState, updateBackupState } = require('../utils/backupState');
const {
  exportCurrentDatabaseZip,
  previewBackupImport,
  replaceDatabaseFromPreview,
  deletePreviewDatabase
} = require('../utils/localBackupService');

const router = express.Router();

router.use(authMiddleware, requireTeacher, requireAdmin);

router.get('/export', async (req, res) => {
  try {
    const exportState = await exportCurrentDatabaseZip();

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'export_database',
      targetType: 'backup',
      targetId: null,
      details: {
        fileName: exportState.zipFile.split(/[\\/]/).pop(),
        createdAt: exportState.createdAt
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.setHeader('Content-Disposition', `attachment; filename=${exportState.zipFile.split(/[\\/]/).pop()}`);
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(exportState.zipFile).pipe(res);
  } catch (error) {
    console.error('导出数据库失败:', error);
    res.status(500).json({ error: '导出数据库失败' });
  }
});

router.post('/import/preview', async (req, res) => {
  try {
    const { archiveName, archiveBase64 } = req.body || {};
    if (!archiveBase64) {
      return res.status(400).json({ error: '缺少备份压缩包内容' });
    }

    const previewState = await previewBackupImport({ archiveName, archiveBase64 });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'preview_restore_database',
      targetType: 'backup',
      targetId: null,
      details: {
        previewId: previewState.previewId,
        previewDatabase: previewState.previewDatabase,
        archiveName: previewState.archiveName
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(previewState);
  } catch (error) {
    console.error('预览恢复失败:', error);
    res.status(500).json({ error: error.message || '预览恢复失败' });
  }
});

router.post('/import/replace', async (req, res) => {
  try {
    const { previewId } = req.body || {};
    if (!previewId) {
      return res.status(400).json({ error: '缺少 previewId' });
    }

    const replaceState = await replaceDatabaseFromPreview(previewId);

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'replace_database',
      targetType: 'backup',
      targetId: null,
      details: replaceState,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(replaceState);
  } catch (error) {
    console.error('覆盖恢复失败:', error);
    res.status(500).json({ error: error.message || '覆盖恢复失败' });
  }
});

router.delete('/import/preview/:previewId', async (req, res) => {
  try {
    await deletePreviewDatabase(req.params.previewId);

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'clear_preview_database',
      targetType: 'backup',
      targetId: null,
      details: {
        previewId: req.params.previewId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: '预览库已清理' });
  } catch (error) {
    console.error('清理预览库失败:', error);
    res.status(500).json({ error: error.message || '清理预览库失败' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const state = readBackupState();
    res.json({
      lastExport: state.lastExport,
      lastPreview: state.lastPreview,
      lastReplace: state.lastReplace,
      previews: (state.previews || []).map((item) => ({
        previewId: item.previewId,
        previewDatabase: item.previewDatabase,
        archiveName: item.archiveName,
        createdAt: item.createdAt,
        comparison: item.comparison
      })),
      settings: state.settings
    });
  } catch (error) {
    console.error('获取备份状态失败:', error);
    res.status(500).json({ error: '获取备份状态失败' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const state = readBackupState();
    res.json(state.settings);
  } catch (error) {
    console.error('获取备份设置失败:', error);
    res.status(500).json({ error: '获取备份设置失败' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const nextSettings = {
      enabled: Boolean(req.body?.enabled),
      schedule: String(req.body?.schedule || '0 2 * * *'),
      retentionDays: Math.max(1, Number(req.body?.retentionDays || 14)),
      destination: String(req.body?.destination || 'backups/'),
      lastRunAt: req.body?.lastRunAt || null,
      lastRunStatus: req.body?.lastRunStatus || 'idle'
    };

    updateBackupState((state) => ({
      ...state,
      settings: nextSettings
    }));

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'update_backup_settings',
      targetType: 'backup',
      targetId: null,
      details: nextSettings,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(nextSettings);
  } catch (error) {
    console.error('更新备份设置失败:', error);
    res.status(500).json({ error: '更新备份设置失败' });
  }
});

module.exports = router;
