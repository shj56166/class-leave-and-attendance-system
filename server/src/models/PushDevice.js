const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushDevice = sequelize.define('PushDevice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  teacher_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'teachers',
      key: 'id'
    }
  },
  platform: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'android'
  },
  provider: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'local_notifications'
  },
  registration_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  binding_id: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: ''
  },
  device_fingerprint: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  manufacturer: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: ''
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: ''
  },
  app_version: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: ''
  },
  permission_snapshot: {
    type: DataTypes.JSON,
    allowNull: true
  },
  auth_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  last_register_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  last_jpush_sync_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'push_devices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['teacher_id', 'device_fingerprint']
    },
    {
      fields: ['teacher_id', 'is_active']
    },
    {
      fields: ['teacher_id', 'binding_id']
    },
    {
      fields: ['registration_id']
    },
    {
      fields: ['provider', 'is_active', 'auth_expires_at']
    }
  ]
});

module.exports = PushDevice;
