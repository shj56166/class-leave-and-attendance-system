'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dormitories', {
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
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(50),
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

    await queryInterface.addIndex('dormitories', ['class_id', 'name'], {
      unique: true,
      name: 'unique_class_dormitory_name'
    });

    await queryInterface.addColumn('students', 'dormitory_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'dormitories',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('students', ['class_id', 'dormitory_id'], {
      name: 'idx_students_class_dormitory'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('students', 'idx_students_class_dormitory');
    await queryInterface.removeColumn('students', 'dormitory_id');

    await queryInterface.removeIndex('dormitories', 'unique_class_dormitory_name');
    await queryInterface.dropTable('dormitories');
  }
};
