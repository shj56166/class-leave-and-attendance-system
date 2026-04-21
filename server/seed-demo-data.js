require('dotenv').config();

const bcrypt = require('bcryptjs');
const sequelize = require('./src/config/database');
const {
  Class,
  Teacher,
  Student,
  Schedule,
  SchedulePeriod,
  Dormitory,
  ClassSpecialDate
} = require('./src/models');

const DEMO_CLASS = {
  classCode: 'TEST001',
  className: '演示班级A'
};

const DEMO_CREDENTIALS = {
  admin: {
    username: 'admin',
    password: 'admin123',
    realName: '管理员',
    role: 'admin'
  },
  teacher: {
    username: 'teacher',
    password: 'teacher123',
    realName: '演示教师',
    role: 'teacher'
  }
};

const DEMO_DORMITORIES = [
  '宿舍A-101',
  '宿舍A-102'
];

const DEMO_STUDENTS = [
  { studentName: '学生甲', studentNumber: '001', role: 'cadre', dormitoryName: '宿舍A-101' },
  { studentName: '学生乙', studentNumber: '002', role: 'student', dormitoryName: '宿舍A-101' },
  { studentName: '学生丙', studentNumber: '003', role: 'student', dormitoryName: '宿舍A-102' },
  { studentName: '学生丁', studentNumber: '004', role: 'student', dormitoryName: '宿舍A-102' },
  { studentName: '学生戊', studentNumber: '005', role: 'student', dormitoryName: '' }
];

const DEMO_PERIODS = [
  { period: 1, startTime: '08:00:00', endTime: '08:45:00' },
  { period: 2, startTime: '08:55:00', endTime: '09:40:00' },
  { period: 3, startTime: '10:10:00', endTime: '10:55:00' },
  { period: 4, startTime: '11:05:00', endTime: '11:50:00' }
];

const DEMO_SCHEDULES = [
  { weekday: 1, period: 1, subject: '语文基础', teacherName: '教师A', location: '教学楼A-201' },
  { weekday: 1, period: 2, subject: '数学基础', teacherName: '教师B', location: '教学楼A-201' },
  { weekday: 1, period: 3, subject: '职业英语', teacherName: '教师C', location: '教学楼A-202' },
  { weekday: 1, period: 4, subject: '信息技术', teacherName: '教师D', location: '机房1' },
  { weekday: 2, period: 1, subject: '机器人基础', teacherName: '教师E', location: '实训室1' },
  { weekday: 2, period: 2, subject: '电气控制入门', teacherName: '教师F', location: '实训室2' },
  { weekday: 2, period: 3, subject: '机械基础', teacherName: '教师G', location: '教学楼B-101' },
  { weekday: 2, period: 4, subject: '职业素养', teacherName: '教师H', location: '教学楼B-101' },
  { weekday: 3, period: 1, subject: '语文基础', teacherName: '教师A', location: '教学楼A-201' },
  { weekday: 3, period: 2, subject: '数学基础', teacherName: '教师B', location: '教学楼A-201' },
  { weekday: 3, period: 3, subject: '自动化编程', teacherName: '教师E', location: '机房2' },
  { weekday: 3, period: 4, subject: '体育与健康', teacherName: '教师I', location: '操场' },
  { weekday: 4, period: 1, subject: '信息技术', teacherName: '教师D', location: '机房1' },
  { weekday: 4, period: 2, subject: '机器人基础', teacherName: '教师E', location: '实训室1' },
  { weekday: 4, period: 3, subject: '实践活动', teacherName: '教师J', location: '实训室3' },
  { weekday: 4, period: 4, subject: '职业英语', teacherName: '教师C', location: '教学楼A-202' },
  { weekday: 5, period: 1, subject: '应用写作', teacherName: '教师A', location: '教学楼B-102' },
  { weekday: 5, period: 2, subject: '应用写作', teacherName: '教师A', location: '教学楼B-102' },
  { weekday: 5, period: 3, subject: '班会与成长', teacherName: '教师K', location: '教学楼A-203' },
  { weekday: 5, period: 4, subject: '班会与成长', teacherName: '教师K', location: '教学楼A-203' }
];

async function assertDemoTargetIsEmpty(transaction) {
  const [classCount, teacherCount, studentCount, scheduleCount, periodCount, dormitoryCount, specialDateCount] = await Promise.all([
    Class.count({ transaction }),
    Teacher.count({ transaction }),
    Student.count({ transaction }),
    Schedule.count({ transaction }),
    SchedulePeriod.count({ transaction }),
    Dormitory.count({ transaction }),
    ClassSpecialDate.count({ transaction })
  ]);

  const populatedTables = [];
  if (classCount > 0) populatedTables.push(`classes=${classCount}`);
  if (teacherCount > 0) populatedTables.push(`teachers=${teacherCount}`);
  if (studentCount > 0) populatedTables.push(`students=${studentCount}`);
  if (scheduleCount > 0) populatedTables.push(`schedules=${scheduleCount}`);
  if (periodCount > 0) populatedTables.push(`schedule_periods=${periodCount}`);
  if (dormitoryCount > 0) populatedTables.push(`dormitories=${dormitoryCount}`);
  if (specialDateCount > 0) populatedTables.push(`class_special_dates=${specialDateCount}`);

  if (populatedTables.length > 0) {
    throw new Error(
      `Database already contains seed-related data (${populatedTables.join(', ')}). ` +
      'Use the root-level demo reset script for a full reset before seeding again.'
    );
  }
}

async function seedDemoData(options = {}) {
  const logger = options.logger || console;

  await sequelize.authenticate();

  const summary = await sequelize.transaction(async (transaction) => {
    await assertDemoTargetIsEmpty(transaction);

    const demoClass = await Class.create({
      class_code: DEMO_CLASS.classCode,
      class_name: DEMO_CLASS.className,
      login_window_open: true
    }, { transaction });

    const dormitoryMap = new Map();
    for (const dormitoryName of DEMO_DORMITORIES) {
      const dormitory = await Dormitory.create({
        class_id: demoClass.id,
        name: dormitoryName
      }, { transaction });
      dormitoryMap.set(dormitoryName, dormitory.id);
    }

    const adminPasswordHash = await bcrypt.hash(DEMO_CREDENTIALS.admin.password, 10);
    await Teacher.create({
      username: DEMO_CREDENTIALS.admin.username,
      password_hash: adminPasswordHash,
      real_name: DEMO_CREDENTIALS.admin.realName,
      role: DEMO_CREDENTIALS.admin.role,
      class_id: demoClass.id
    }, { transaction });

    const teacherPasswordHash = await bcrypt.hash(DEMO_CREDENTIALS.teacher.password, 10);
    await Teacher.create({
      username: DEMO_CREDENTIALS.teacher.username,
      password_hash: teacherPasswordHash,
      real_name: DEMO_CREDENTIALS.teacher.realName,
      role: DEMO_CREDENTIALS.teacher.role,
      class_id: demoClass.id
    }, { transaction });

    for (const student of DEMO_STUDENTS) {
      await Student.create({
        class_id: demoClass.id,
        dormitory_id: student.dormitoryName ? (dormitoryMap.get(student.dormitoryName) || null) : null,
        student_name: student.studentName,
        student_number: student.studentNumber,
        password_hash: null,
        is_authenticated: false,
        password_fail_count: 0,
        is_locked: false,
        status: 'active',
        role: student.role
      }, { transaction });
    }

    await SchedulePeriod.bulkCreate(
      DEMO_PERIODS.map((item) => ({
        class_id: demoClass.id,
        period: item.period,
        start_time: item.startTime,
        end_time: item.endTime
      })),
      { transaction }
    );

    await Schedule.bulkCreate(
      DEMO_SCHEDULES.map((item) => ({
        class_id: demoClass.id,
        weekday: item.weekday,
        period: item.period,
        subject: item.subject,
        teacher_name: item.teacherName,
        location: item.location
      })),
      { transaction }
    );

    return {
      classCode: DEMO_CLASS.classCode,
      className: DEMO_CLASS.className,
      adminUsername: DEMO_CREDENTIALS.admin.username,
      adminPassword: DEMO_CREDENTIALS.admin.password,
      teacherUsername: DEMO_CREDENTIALS.teacher.username,
      teacherPassword: DEMO_CREDENTIALS.teacher.password,
      studentCount: DEMO_STUDENTS.length,
      periodCount: DEMO_PERIODS.length,
      scheduleCount: DEMO_SCHEDULES.length,
      dormitoryCount: DEMO_DORMITORIES.length
    };
  });

  logger.log('Demo data seeded successfully.');
  logger.log(`Class: ${summary.className} (${summary.classCode})`);
  logger.log(`Admin: ${summary.adminUsername} / ${summary.adminPassword}`);
  logger.log(`Teacher: ${summary.teacherUsername} / ${summary.teacherPassword}`);
  logger.log(`Students: ${summary.studentCount}, Periods: ${summary.periodCount}, Schedules: ${summary.scheduleCount}`);

  return summary;
}

async function runCli() {
  try {
    await seedDemoData({ logger: console });
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed demo data:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close().catch(() => {});
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  seedDemoData,
  DEMO_CLASS,
  DEMO_CREDENTIALS,
  DEMO_STUDENTS,
  DEMO_PERIODS,
  DEMO_SCHEDULES,
  DEMO_DORMITORIES
};
