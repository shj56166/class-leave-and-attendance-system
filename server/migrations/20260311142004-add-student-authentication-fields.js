'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. students表增加认证相关字段
    await queryInterface.addColumn('students', 'is_authenticated', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: '是否已完成首次密码设置'
    });

    await queryInterface.addColumn('students', 'jwt_version', {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      allowNull: false,
      comment: 'JWT版本号，用于踢出所有设备'
    });

    await queryInterface.addColumn('students', 'password_set_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: '密码设置时间'
    });

    await queryInterface.addColumn('students', 'password_fail_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '密码错误次数'
    });

    await queryInterface.addColumn('students', 'is_locked', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: '是否被锁定（密码错误10次）'
    });

    await queryInterface.addColumn('students', 'locked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: '锁定时间'
    });

    // 2. classes表增加登录窗口控制字段
    await queryInterface.addColumn('classes', 'login_window_open', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: '登录窗口是否开启（默认开启）'
    });

    // 3. 创建学生登录日志表
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
        comment: '学生ID'
      },
      device_info: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '设备信息（User-Agent）'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP地址'
      },
      jwt_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '登录时的JWT版本号'
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

    // 4. 添加索引
    await queryInterface.addIndex('student_login_logs', ['student_id'], {
      name: 'idx_student_login_logs_student_id'
    });

    await queryInterface.addIndex('student_login_logs', ['login_at'], {
      name: 'idx_student_login_logs_login_at'
    });
  },

  async down (queryInterface, Sequelize) {
    // 删除student_login_logs表
    await queryInterface.dropTable('student_login_logs');

    // 删除classes表字段
    await queryInterface.removeColumn('classes', 'login_window_open');

    // 删除students表字段
    await queryInterface.removeColumn('students', 'locked_at');
    await queryInterface.removeColumn('students', 'is_locked');
    await queryInterface.removeColumn('students', 'password_fail_count');
    await queryInterface.removeColumn('students', 'password_set_at');
    await queryInterface.removeColumn('students', 'jwt_version');
    await queryInterface.removeColumn('students', 'is_authenticated');
  }
};
