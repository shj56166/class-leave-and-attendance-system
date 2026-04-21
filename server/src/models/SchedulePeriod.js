const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SchedulePeriod = sequelize.define('SchedulePeriod', {
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
  period: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false
  }
}, {
  tableName: 'schedule_periods',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SchedulePeriod;
