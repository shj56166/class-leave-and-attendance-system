const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Teacher = sequelize.define('Teacher', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '登录用户名'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码哈希'
  },
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '真实姓名'
  },
  role: {
    type: DataTypes.ENUM('admin', 'teacher'),
    defaultValue: 'teacher',
    comment: '角色：管理员/教师'
  },
  jwt_version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'JWT版本号，用于让旧教师会话失效'
  },
  class_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'classes',
      key: 'id'
    },
    comment: '所属班级'
  }
}, {
  tableName: 'teachers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Teacher;
