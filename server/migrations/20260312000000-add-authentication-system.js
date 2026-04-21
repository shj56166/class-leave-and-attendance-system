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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const studentsTable = await queryInterface.describeTable('students');
    const classesTable = await queryInterface.describeTable('classes');
    const existingTables = new Set(normalizeTableNames(await queryInterface.showAllTables()));

    if (!studentsTable.is_authenticated) {
      await queryInterface.addColumn('students', 'is_authenticated', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: '学生是否已完成首次密码设置'
      });
    }

    if (!studentsTable.jwt_version) {
      await queryInterface.addColumn('students', 'jwt_version', {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: '学生 JWT 版本号'
      });
    }

    if (!studentsTable.password_set_at) {
      await queryInterface.addColumn('students', 'password_set_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '密码设置时间'
      });
    }

    if (!studentsTable.password_fail_count) {
      await queryInterface.addColumn('students', 'password_fail_count', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: '密码错误次数'
      });
    }

    if (!studentsTable.is_locked) {
      await queryInterface.addColumn('students', 'is_locked', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: '学生账号是否锁定'
      });
    }

    if (!studentsTable.locked_at) {
      await queryInterface.addColumn('students', 'locked_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '账号锁定时间'
      });
    }

    if (!classesTable.login_window_open) {
      await queryInterface.addColumn('classes', 'login_window_open', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: '班级登录窗口是否开启'
      });
    }

    if (!existingTables.has('student_login_logs')) {
      await queryInterface.createTable('student_login_logs', {
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
          onDelete: 'CASCADE',
          comment: '学生 ID'
        },
        device_info: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '设备信息'
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: 'IP 地址'
        },
        jwt_version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: '登录时的 JWT 版本号'
        },
        login_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          comment: '登录时间'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      await queryInterface.addIndex('student_login_logs', ['student_id'], {
        name: 'idx_student_login_logs_student_id'
      });

      await queryInterface.addIndex('student_login_logs', ['login_at'], {
        name: 'idx_student_login_logs_login_at'
      });
    }
  },

  async down(queryInterface) {
    const existingTables = new Set(normalizeTableNames(await queryInterface.showAllTables()));
    if (existingTables.has('student_login_logs')) {
      await queryInterface.dropTable('student_login_logs');
    }

    const classesTable = await queryInterface.describeTable('classes');
    if (classesTable.login_window_open) {
      await queryInterface.removeColumn('classes', 'login_window_open');
    }

    const studentsTable = await queryInterface.describeTable('students');
    if (studentsTable.locked_at) {
      await queryInterface.removeColumn('students', 'locked_at');
    }
    if (studentsTable.is_locked) {
      await queryInterface.removeColumn('students', 'is_locked');
    }
    if (studentsTable.password_fail_count) {
      await queryInterface.removeColumn('students', 'password_fail_count');
    }
    if (studentsTable.password_set_at) {
      await queryInterface.removeColumn('students', 'password_set_at');
    }
    if (studentsTable.jwt_version) {
      await queryInterface.removeColumn('students', 'jwt_version');
    }
    if (studentsTable.is_authenticated) {
      await queryInterface.removeColumn('students', 'is_authenticated');
    }
  }
};
