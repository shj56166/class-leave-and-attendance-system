'use strict';

function normalizeTableNames(rawTables = []) {
  return rawTables.map((entry) => {
    if (typeof entry === 'string') {
      return entry;
    }

    if (entry && typeof entry === 'object') {
      return entry.tableName || entry.TABLE_NAME || entry.table_name || '';
    }

    return '';
  }).filter(Boolean);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingTables = new Set(normalizeTableNames(await queryInterface.showAllTables()));

    if (!existingTables.has('classes')) {
      await queryInterface.createTable('classes', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        class_code: {
          type: Sequelize.STRING(50),
          allowNull: false,
          unique: true
        },
        class_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }

    if (!existingTables.has('teachers')) {
      await queryInterface.createTable('teachers', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        username: {
          type: Sequelize.STRING(50),
          allowNull: false,
          unique: true
        },
        password_hash: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        real_name: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        role: {
          type: Sequelize.ENUM('admin', 'teacher'),
          allowNull: false,
          defaultValue: 'teacher'
        },
        class_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'classes',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }

    if (!existingTables.has('students')) {
      await queryInterface.createTable('students', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
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
        student_name: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        student_number: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive'),
          allowNull: false,
          defaultValue: 'active'
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }

    if (!existingTables.has('schedules')) {
      await queryInterface.createTable('schedules', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
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
        weekday: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        period: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        subject: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        teacher_name: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }

    if (!existingTables.has('leave_requests')) {
      await queryInterface.createTable('leave_requests', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        student_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'students',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
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
        leave_type: {
          type: Sequelize.ENUM('sick', 'personal', 'other'),
          allowNull: false
        },
        start_time: {
          type: Sequelize.DATE,
          allowNull: false
        },
        end_time: {
          type: Sequelize.DATE,
          allowNull: false
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'rejected'),
          allowNull: false,
          defaultValue: 'pending'
        },
        teacher_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'teachers',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        teacher_comment: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        submitted_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        reviewed_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }

    if (!existingTables.has('leave_records')) {
      await queryInterface.createTable('leave_records', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        leave_request_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'leave_requests',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        schedule_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'schedules',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        leave_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        weekday: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        period: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        subject: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_records');
    await queryInterface.dropTable('leave_requests');
    await queryInterface.dropTable('schedules');
    await queryInterface.dropTable('students');
    await queryInterface.dropTable('teachers');
    await queryInterface.dropTable('classes');
  }
};
