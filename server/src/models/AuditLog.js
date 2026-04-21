const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_type: {
    type: DataTypes.ENUM('student', 'teacher'),
    allowNull: false
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  target_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  target_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = AuditLog;
