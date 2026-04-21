'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('students');

    if (table.password_hash) {
      return;
    }

    await queryInterface.addColumn('students', 'password_hash', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: '学生密码哈希，可为空表示未设置密码'
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('students');

    if (!table.password_hash) {
      return;
    }

    await queryInterface.removeColumn('students', 'password_hash');
  }
};
