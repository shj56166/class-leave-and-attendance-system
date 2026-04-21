'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leave_history_archives', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      class_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      student_name_snapshot: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: ''
      },
      student_number_snapshot: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      class_name_snapshot: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      leave_type: {
        type: Sequelize.ENUM('sick', 'personal', 'other'),
        allowNull: false
      },
      request_mode: {
        type: Sequelize.ENUM('today', 'custom', 'weekend'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'recorded'),
        allowNull: false
      },
      reviewer_name_snapshot: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      teacher_comment_snapshot: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      current_location: {
        type: Sequelize.ENUM('dormitory', 'classroom', 'home', 'other'),
        allowNull: true
      },
      go_home: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      records_snapshot: {
        type: Sequelize.JSON,
        allowNull: true
      },
      source_type: {
        type: Sequelize.ENUM('request', 'audit_fallback', 'restore_preview'),
        allowNull: false,
        defaultValue: 'request'
      },
      history_notice: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      original_leave_request_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      original_audit_log_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('leave_history_archives', ['class_id', 'submitted_at'], {
      name: 'idx_leave_history_class_submitted'
    });
    await queryInterface.addIndex('leave_history_archives', ['student_id', 'submitted_at'], {
      name: 'idx_leave_history_student_submitted'
    });
    await queryInterface.addIndex('leave_history_archives', ['source_type'], {
      name: 'idx_leave_history_source_type'
    });
    await queryInterface.addIndex('leave_history_archives', ['original_leave_request_id'], {
      unique: true,
      name: 'uniq_leave_history_request_id'
    });
    await queryInterface.addIndex('leave_history_archives', ['original_audit_log_id'], {
      unique: true,
      name: 'uniq_leave_history_audit_id'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('leave_history_archives', 'uniq_leave_history_audit_id');
    await queryInterface.removeIndex('leave_history_archives', 'uniq_leave_history_request_id');
    await queryInterface.removeIndex('leave_history_archives', 'idx_leave_history_source_type');
    await queryInterface.removeIndex('leave_history_archives', 'idx_leave_history_student_submitted');
    await queryInterface.removeIndex('leave_history_archives', 'idx_leave_history_class_submitted');
    await queryInterface.dropTable('leave_history_archives');
  }
};
