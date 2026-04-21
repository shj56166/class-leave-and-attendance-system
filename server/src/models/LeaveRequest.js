const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeaveRequest = sequelize.define('LeaveRequest', {
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
    }
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  leave_type: {
    type: DataTypes.ENUM('sick', 'personal', 'other'),
    allowNull: false,
    comment: '请假类型'
  },
  request_mode: {
    type: DataTypes.ENUM('today', 'custom', 'weekend'),
    allowNull: false,
    defaultValue: 'custom',
    comment: '申请模式'
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '开始时间'
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '结束时间'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '请假原因'
  },
  student_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '请假提交时的学生姓名快照'
  },
  student_number_snapshot: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '请假提交时的学号快照'
  },
  class_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '请假提交时的班级名称快照'
  },
  reviewer_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '审批时的审批人姓名快照'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'recorded'),
    allowNull: false,
    defaultValue: 'pending',
    comment: '处理状态'
  },
  current_location: {
    type: DataTypes.ENUM('dormitory', 'classroom', 'home', 'other'),
    allowNull: true,
    comment: '提交时识别出的当前位置'
  },
  go_home: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否回家'
  },
  teacher_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'teachers',
      key: 'id'
    },
    comment: '审批教师'
  },
  teacher_comment: {
    type: DataTypes.TEXT,
    comment: '审批意见'
  },
  submitted_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '提交时间'
  },
  reviewed_at: {
    type: DataTypes.DATE,
    comment: '审批时间'
  }
}, {
  tableName: 'leave_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = LeaveRequest;
