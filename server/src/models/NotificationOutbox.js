const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationOutbox = sequelize.define('NotificationOutbox', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'pending'
  },
  attempt_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  available_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  locked_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dispatched_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_error: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'notification_outbox',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['status', 'available_at']
    },
    {
      fields: ['event_type', 'created_at']
    }
  ]
});

module.exports = NotificationOutbox;
