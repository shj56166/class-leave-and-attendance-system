'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leave_requests', 'student_name_snapshot', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('leave_requests', 'student_number_snapshot', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await queryInterface.addColumn('leave_requests', 'class_name_snapshot', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('leave_requests', 'reviewer_name_snapshot', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      UPDATE leave_requests lr
      LEFT JOIN students s ON s.id = lr.student_id
      LEFT JOIN classes c ON c.id = lr.class_id
      LEFT JOIN teachers t ON t.id = lr.teacher_id
      SET
        lr.student_name_snapshot = COALESCE(NULLIF(lr.student_name_snapshot, ''), s.student_name, ''),
        lr.student_number_snapshot = COALESCE(NULLIF(lr.student_number_snapshot, ''), s.student_number, ''),
        lr.class_name_snapshot = COALESCE(NULLIF(lr.class_name_snapshot, ''), c.class_name, ''),
        lr.reviewer_name_snapshot = COALESCE(NULLIF(lr.reviewer_name_snapshot, ''), t.real_name, '')
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leave_requests', 'reviewer_name_snapshot');
    await queryInterface.removeColumn('leave_requests', 'class_name_snapshot');
    await queryInterface.removeColumn('leave_requests', 'student_number_snapshot');
    await queryInterface.removeColumn('leave_requests', 'student_name_snapshot');
  }
};
