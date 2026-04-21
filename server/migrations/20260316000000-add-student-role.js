'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('students');

    if (table.role) {
      return;
    }

    await queryInterface.addColumn('students', 'role', {
      type: Sequelize.ENUM('student', 'cadre'),
      allowNull: false,
      defaultValue: 'student',
      comment: '学生角色：student=普通学生, cadre=班干'
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('students');

    if (!table.role) {
      return;
    }

    await queryInterface.removeColumn('students', 'role');
  }
};
