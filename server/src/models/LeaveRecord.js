const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeaveRecord = sequelize.define('LeaveRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  leave_request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'leave_requests',
      key: 'id'
    }
  },
  schedule_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'schedules',
      key: 'id'
    }
  },
  leave_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '请假日期'
  },
  weekday: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '星期几'
  },
  period: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '第几节课'
  },
  subject: {
    type: DataTypes.STRING(50),
    comment: '科目'
  },
  subject_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '请假发生时的课程名称快照'
  },
  weekday_snapshot: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '请假发生时的星期快照'
  },
  period_snapshot: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '请假发生时的节次快照'
  },
  start_time_snapshot: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: '请假发生时的开始时间快照'
  },
  end_time_snapshot: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: '请假发生时的结束时间快照'
  }
}, {
  tableName: 'leave_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = LeaveRecord;
