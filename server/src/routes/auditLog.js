const express = require('express');
const { Op } = require('sequelize');
const { AuditLog, Teacher, Student } = require('../models');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authMiddleware, requireAdmin);

// 获取审计日志列表
router.get('/', async (req, res) => {
  try {
    const {
      action,
      userType,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (userType && ['student', 'teacher'].includes(userType)) {
      where.user_type = userType;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // 补充用户信息
    const logs = await Promise.all(rows.map(async (log) => {
      const logData = log.toJSON();

      if (log.user_type === 'teacher') {
        const teacher = await Teacher.findByPk(log.user_id, {
          attributes: ['username', 'real_name']
        });
        logData.user = teacher ? {
          username: teacher.username,
          realName: teacher.real_name
        } : null;
      } else if (log.user_type === 'student') {
        const student = await Student.findByPk(log.user_id, {
          attributes: ['student_name', 'student_number']
        });
        logData.user = student ? {
          name: student.student_name,
          number: student.student_number
        } : null;
      }

      return logData;
    }));

    res.json({
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      logs
    });
  } catch (error) {
    console.error('获取审计日志错误:', error);
    res.status(500).json({ error: '获取审计日志失败' });
  }
});

// 获取操作类型列表（用于筛选）
router.get('/actions', async (req, res) => {
  try {
    const actions = await AuditLog.findAll({
      attributes: [[AuditLog.sequelize.fn('DISTINCT', AuditLog.sequelize.col('action')), 'action']],
      raw: true
    });

    res.json(actions.map(a => a.action));
  } catch (error) {
    console.error('获取操作类型错误:', error);
    res.status(500).json({ error: '获取操作类型失败' });
  }
});

module.exports = router;
