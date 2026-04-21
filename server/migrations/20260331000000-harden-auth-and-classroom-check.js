'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('teachers', 'jwt_version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'JWT版本号，用于让旧教师会话失效'
    });

    await queryInterface.sequelize.query(`
      DELETE older
      FROM classroom_check_submissions AS older
      INNER JOIN classroom_check_submissions AS newer
        ON older.class_id = newer.class_id
       AND older.check_date = newer.check_date
       AND older.slot_kind = newer.slot_kind
       AND (
         older.period_snapshot = newer.period_snapshot
         OR (older.period_snapshot IS NULL AND newer.period_snapshot IS NULL)
       )
       AND (
         older.submitted_at < newer.submitted_at
         OR (older.submitted_at = newer.submitted_at AND older.id < newer.id)
       )
    `);

    await queryInterface.addIndex(
      'classroom_check_submissions',
      ['class_id', 'check_date', 'slot_kind', 'period_snapshot'],
      {
        name: 'uniq_classroom_check_slot',
        unique: true
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('classroom_check_submissions', 'uniq_classroom_check_slot');
    await queryInterface.removeColumn('teachers', 'jwt_version');
  }
};
