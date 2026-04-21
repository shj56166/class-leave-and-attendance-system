const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeaveHistoryArchive = sequelize.define('LeaveHistoryArchive', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  student_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: ''
  },
  student_number_snapshot: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  class_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  leave_type: {
    type: DataTypes.ENUM('sick', 'personal', 'other'),
    allowNull: false
  },
  request_mode: {
    type: DataTypes.ENUM('today', 'custom', 'weekend'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'recorded'),
    allowNull: false
  },
  reviewer_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  teacher_comment_snapshot: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  current_location: {
    type: DataTypes.ENUM('dormitory', 'classroom', 'home', 'other'),
    allowNull: true
  },
  go_home: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  records_snapshot: {
    type: DataTypes.JSON,
    allowNull: true
  },
  source_type: {
    type: DataTypes.ENUM('request', 'audit_fallback', 'restore_preview'),
    allowNull: false,
    defaultValue: 'request'
  },
  history_notice: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  original_leave_request_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  original_audit_log_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'leave_history_archives',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = LeaveHistoryArchive;
