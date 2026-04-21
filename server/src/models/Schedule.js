const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Schedule = sequelize.define('Schedule', {
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
  weekday: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '星期几（1-7）'
  },
  period: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '第几节课'
  },
  subject: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '科目'
  },
  location: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '教室',
    comment: '上课地点'
  },
  teacher_name: {
    type: DataTypes.STRING(50),
    comment: '任课老师'
  }
}, {
  tableName: 'schedules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Schedule;
