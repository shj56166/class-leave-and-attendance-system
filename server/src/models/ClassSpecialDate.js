const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClassSpecialDate = sequelize.define('ClassSpecialDate', {
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('holiday', 'workday_override'),
    allowNull: false
  },
  target_weekday: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'class_special_dates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ClassSpecialDate;
