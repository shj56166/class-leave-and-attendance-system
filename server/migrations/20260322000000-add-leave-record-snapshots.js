'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leave_records', 'subject_snapshot', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('leave_records', 'weekday_snapshot', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('leave_records', 'period_snapshot', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('leave_records', 'start_time_snapshot', {
      type: Sequelize.TIME,
      allowNull: true
    });

    await queryInterface.addColumn('leave_records', 'end_time_snapshot', {
      type: Sequelize.TIME,
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      UPDATE leave_records lr
      INNER JOIN leave_requests lq ON lq.id = lr.leave_request_id
      LEFT JOIN schedule_periods sp
        ON sp.class_id = lq.class_id
       AND sp.period = lr.period
      SET
        lr.subject_snapshot = NULLIF(lr.subject, ''),
        lr.weekday_snapshot = lr.weekday,
        lr.period_snapshot = lr.period,
        lr.start_time_snapshot = sp.start_time,
        lr.end_time_snapshot = sp.end_time
      WHERE lr.subject_snapshot IS NULL
         OR lr.weekday_snapshot IS NULL
         OR lr.period_snapshot IS NULL
         OR lr.start_time_snapshot IS NULL
         OR lr.end_time_snapshot IS NULL
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leave_records', 'end_time_snapshot');
    await queryInterface.removeColumn('leave_records', 'start_time_snapshot');
    await queryInterface.removeColumn('leave_records', 'period_snapshot');
    await queryInterface.removeColumn('leave_records', 'weekday_snapshot');
    await queryInterface.removeColumn('leave_records', 'subject_snapshot');
  }
};
