'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '操作用户ID'
      },
      user_type: {
        type: Sequelize.ENUM('student', 'teacher'),
        allowNull: false,
        comment: '用户类型'
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: '操作类型：login, approve_leave, create_student, reset_password, update_schedule'
      },
      target_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: '目标类型：leave_request, student, schedule'
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '目标ID'
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '操作详情'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP地址'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '用户代理'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 添加索引
    await queryInterface.addIndex('audit_logs', ['user_id', 'user_type']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('audit_logs');
  }
};
