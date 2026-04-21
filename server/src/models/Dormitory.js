const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dormitory = sequelize.define('Dormitory', {
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
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '宿舍名称'
  }
}, {
  tableName: 'dormitories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Dormitory;
