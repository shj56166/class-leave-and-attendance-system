const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  dormitory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'dormitories',
      key: 'id'
    },
    comment: '宿舍分组'
  },
  student_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '学生姓名'
  },
  student_number: {
    type: DataTypes.STRING(50),
    comment: '学号'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '密码哈希（可选，为空表示未设置密码）'
  },
  is_authenticated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '是否已完成首次密码设置'
  },
  jwt_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    comment: 'JWT版本号，用于踢出所有设备'
  },
  password_set_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '密码设置时间'
  },
  password_fail_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '密码错误次数'
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '是否被锁定（密码错误10次）'
  },
  locked_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '锁定时间'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '状态：启用/禁用'
  },
  role: {
    type: DataTypes.ENUM('student', 'cadre'),
    defaultValue: 'student',
    allowNull: false,
    comment: '学生角色：student=普通学生, cadre=班干'
  }
}, {
  tableName: 'students',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Student;
