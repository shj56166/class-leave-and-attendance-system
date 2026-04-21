const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClassroomCheckSubmission = sequelize.define('ClassroomCheckSubmission', {
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
  submitted_by_student_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'students',
      key: 'id'
    }
  },
  submitted_by_name_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '????????????'
  },
  check_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '????'
  },
  slot_kind: {
    type: DataTypes.ENUM('active_course', 'free_time'),
    allowNull: false,
    defaultValue: 'free_time',
    comment: '???????????'
  },
  weekday_snapshot: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '????????????'
  },
  period_snapshot: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '??????????'
  },
  subject_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '??????????'
  },
  start_time_snapshot: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '??????????????'
  },
  end_time_snapshot: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '??????????????'
  },
  slot_label_snapshot: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '?????????????'
  },
  selected_students_json: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: '??????????'
  },
  truancy_students_json: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: '??????????'
  },
  question_students_json: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: '??????????????'
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '????'
  }
}, {
  tableName: 'classroom_check_submissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ClassroomCheckSubmission;
