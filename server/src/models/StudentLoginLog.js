const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StudentLoginLog = sequelize.define('StudentLoginLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'students',
      key: 'id'
    },
    comment: '学生ID'
  },
  device_info: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '设备信息（User-Agent）'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: 'IP地址'
  },
  jwt_version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '登录时的JWT版本号'
  },
  login_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '登录时间'
  }
}, {
  tableName: 'student_login_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = StudentLoginLog;
