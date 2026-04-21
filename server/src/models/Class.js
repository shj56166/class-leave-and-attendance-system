const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Class = sequelize.define('Class', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  class_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '教室组代号'
  },
  class_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '班级名称'
  },
  login_window_open: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: '登录窗口是否开启（默认开启）'
  }
}, {
  tableName: 'classes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Class;
