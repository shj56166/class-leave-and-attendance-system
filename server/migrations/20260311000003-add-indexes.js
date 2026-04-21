'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // students 表：同班级内学号唯一
    await queryInterface.addIndex('students', ['class_id', 'student_number'], {
      unique: true,
      name: 'unique_class_student_number'
    });

    // schedules 表：同班级同时间段课程唯一
    await queryInterface.addIndex('schedules', ['class_id', 'weekday', 'period'], {
      unique: true,
      name: 'unique_class_schedule'
    });

    // leave_requests 表：加速学生请假查询
    await queryInterface.addIndex('leave_requests', ['student_id', 'status', 'submitted_at'], {
      name: 'idx_student_status_submitted'
    });

    // leave_records 表：加速课时统计
    await queryInterface.addIndex('leave_records', ['leave_request_id', 'leave_date', 'period'], {
      name: 'idx_leave_date_period'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('students', 'unique_class_student_number');
    await queryInterface.removeIndex('schedules', 'unique_class_schedule');
    await queryInterface.removeIndex('leave_requests', 'idx_student_status_submitted');
    await queryInterface.removeIndex('leave_records', 'idx_leave_date_period');
  }
};
