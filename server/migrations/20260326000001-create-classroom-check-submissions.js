module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('classroom_check_submissions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'classes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      submitted_by_student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      submitted_by_name_snapshot: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      check_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      slot_kind: {
        type: Sequelize.ENUM('active_course', 'free_time'),
        allowNull: false,
        defaultValue: 'free_time'
      },
      weekday_snapshot: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      period_snapshot: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      subject_snapshot: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      start_time_snapshot: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      end_time_snapshot: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      slot_label_snapshot: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      selected_students_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      truancy_students_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      question_students_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('classroom_check_submissions', ['class_id', 'check_date', 'submitted_at'], {
      name: 'idx_classroom_check_class_date_submitted'
    });

    await queryInterface.addIndex('classroom_check_submissions', ['submitted_by_student_id', 'submitted_at'], {
      name: 'idx_classroom_check_submitter_time'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('classroom_check_submissions', 'idx_classroom_check_submitter_time');
    await queryInterface.removeIndex('classroom_check_submissions', 'idx_classroom_check_class_date_submitted');
    await queryInterface.dropTable('classroom_check_submissions');
  }
};
