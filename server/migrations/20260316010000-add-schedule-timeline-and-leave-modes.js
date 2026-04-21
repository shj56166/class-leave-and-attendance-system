'use strict';

const DEFAULT_PERIODS = [
  { period: 1, start_time: '08:00:00', end_time: '08:45:00' },
  { period: 2, start_time: '08:55:00', end_time: '09:40:00' },
  { period: 3, start_time: '10:00:00', end_time: '10:45:00' },
  { period: 4, start_time: '10:55:00', end_time: '11:40:00' },
  { period: 5, start_time: '14:00:00', end_time: '14:45:00' },
  { period: 6, start_time: '14:55:00', end_time: '15:40:00' },
  { period: 7, start_time: '16:00:00', end_time: '16:45:00' },
  { period: 8, start_time: '16:55:00', end_time: '17:40:00' }
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('schedule_periods', {
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
      period: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      start_time: {
        type: Sequelize.TIME,
        allowNull: false
      },
      end_time: {
        type: Sequelize.TIME,
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

    await queryInterface.addIndex('schedule_periods', ['class_id', 'period'], {
      unique: true,
      name: 'unique_class_schedule_period'
    });

    await queryInterface.createTable('class_special_dates', {
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
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('holiday', 'workday_override'),
        allowNull: false
      },
      label: {
        type: Sequelize.STRING(100),
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

    await queryInterface.addIndex('class_special_dates', ['class_id', 'date'], {
      unique: true,
      name: 'unique_class_special_date'
    });

    await queryInterface.addColumn('schedules', 'location', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: '教室'
    });

    await queryInterface.addColumn('leave_requests', 'request_mode', {
      type: Sequelize.ENUM('today', 'custom', 'weekend'),
      allowNull: false,
      defaultValue: 'custom'
    });

    await queryInterface.addColumn('leave_requests', 'current_location', {
      type: Sequelize.ENUM('dormitory', 'classroom', 'home', 'other'),
      allowNull: true
    });

    await queryInterface.addColumn('leave_requests', 'go_home', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.changeColumn('leave_requests', 'status', {
      type: Sequelize.ENUM('pending', 'approved', 'rejected', 'recorded'),
      allowNull: false,
      defaultValue: 'pending'
    });

    await queryInterface.changeColumn('leave_requests', 'reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: '请假原因'
    });

    await queryInterface.sequelize.query(
      "UPDATE schedules SET location = '教室' WHERE location IS NULL OR location = ''"
    );

    const [classes] = await queryInterface.sequelize.query('SELECT id FROM classes');
    const now = new Date();
    const rows = classes.flatMap((classRow) =>
      DEFAULT_PERIODS.map((period) => ({
        class_id: classRow.id,
        period: period.period,
        start_time: period.start_time,
        end_time: period.end_time,
        created_at: now,
        updated_at: now
      }))
    );

    if (rows.length) {
      await queryInterface.bulkInsert('schedule_periods', rows);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leave_requests', 'reason', {
      type: Sequelize.TEXT,
      allowNull: false,
      comment: '请假原因'
    });

    await queryInterface.changeColumn('leave_requests', 'status', {
      type: Sequelize.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    });

    await queryInterface.removeColumn('leave_requests', 'go_home');
    await queryInterface.removeColumn('leave_requests', 'current_location');
    await queryInterface.removeColumn('leave_requests', 'request_mode');
    await queryInterface.removeColumn('schedules', 'location');

    await queryInterface.removeIndex('class_special_dates', 'unique_class_special_date');
    await queryInterface.dropTable('class_special_dates');

    await queryInterface.removeIndex('schedule_periods', 'unique_class_schedule_period');
    await queryInterface.dropTable('schedule_periods');
  }
};
