const { AuditLog } = require('../models');

/**
 * 记录审计日志
 * @param {Object} params
 * @param {number} params.userId - 用户ID
 * @param {string} params.userType - 用户类型 ('student' | 'teacher')
 * @param {string} params.action - 操作类型
 * @param {string} params.targetType - 目标类型
 * @param {number} params.targetId - 目标ID
 * @param {Object} params.details - 操作详情
 * @param {string} params.ipAddress - IP地址
 * @param {string} params.userAgent - User Agent
 */
async function writeAuditLog({
  userId,
  userType,
  action,
  targetType,
  targetId,
  details = {},
  ipAddress,
  userAgent,
  transaction,
  throwOnError = false
}) {
  try {
    await AuditLog.create({
      user_id: userId,
      user_type: userType,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date()
    }, transaction ? { transaction } : undefined);
  } catch (error) {
    console.error('写入审计日志失败:', error);
    if (throwOnError) {
      throw error;
    }
  }
}

module.exports = { writeAuditLog };
