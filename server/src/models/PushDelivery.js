const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushDelivery = sequelize.define('PushDelivery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  leave_request_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  teacher_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'teachers',
      key: 'id'
    }
  },
  provider: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'pending'
  },
  response_payload: {
    type: DataTypes.JSON,
    allowNull: true
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'push_deliveries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['event_type', 'sent_at']
    },
    {
      fields: ['teacher_id', 'provider']
    }
  ]
});

module.exports = PushDelivery;
