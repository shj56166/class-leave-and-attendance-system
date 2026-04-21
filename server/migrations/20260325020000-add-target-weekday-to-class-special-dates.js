'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('class_special_dates', 'target_weekday', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('class_special_dates', 'target_weekday');
  }
};
