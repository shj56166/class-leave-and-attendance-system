const { test, expect } = require('@playwright/test');
const bcrypt = require('../../server/node_modules/bcryptjs');
const { Sequelize } = require('../../server/node_modules/sequelize');
const xlsx = require('../../server/node_modules/xlsx');

const TEACHER_BASE_URL = 'http://localhost:5174';

function createTestSequelize() {
  const requiredVars = [
    'TEST_DB_HOST',
    'TEST_DB_PORT',
    'TEST_DB_NAME',
    'TEST_DB_USER',
    'TEST_DB_PASSWORD'
  ];
  const missingVars = requiredVars.filter((name) => !process.env[name]);

  if (missingVars.length > 0) {
    throw new Error(`Refusing to run Playwright against the development database. Missing: ${missingVars.join(', ')}`);
  }

  return new Sequelize(
    process.env.TEST_DB_NAME,
    process.env.TEST_DB_USER,
    process.env.TEST_DB_PASSWORD,
    {
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT),
      dialect: 'mysql',
      logging: false,
      timezone: '+08:00'
    }
  );
}

const sequelize = createTestSequelize();

function toWeekday(date) {
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seedDatabase() {
  const teacherHash = await bcrypt.hash('admin123', 10);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
  const todayWeekday = toWeekday(now);
  const tomorrowWeekday = toWeekday(tomorrow);
  const todayDateKey = toDateKey(now);
  const tomorrowDateKey = toDateKey(tomorrow);

  await sequelize.transaction(async (transaction) => {
    const [classes] = await sequelize.query(
      'SELECT id FROM classes ORDER BY id LIMIT 1',
      { transaction }
    );

    if (!classes.length) {
      throw new Error('No class data found for overview statistics e2e test');
    }

    const classId = classes[0].id;

    await sequelize.query('DELETE FROM classroom_check_submissions', { transaction });
    await sequelize.query('DELETE FROM leave_records', { transaction });
    await sequelize.query('DELETE FROM leave_requests', { transaction });
    await sequelize.query('DELETE FROM leave_history_archives', { transaction });
    await sequelize.query('DELETE FROM schedules WHERE class_id = :classId', {
      transaction,
      replacements: { classId }
    });
    await sequelize.query('DELETE FROM schedule_periods WHERE class_id = :classId', {
      transaction,
      replacements: { classId }
    });
    await sequelize.query('DELETE FROM class_special_dates WHERE class_id = :classId', {
      transaction,
      replacements: { classId }
    });

    await sequelize.query(
      "UPDATE teachers SET password_hash = :passwordHash WHERE username IN ('admin', 'teacher')",
      {
        transaction,
        replacements: { passwordHash: teacherHash }
      }
    );

    await sequelize.query(
      `UPDATE students
       SET is_authenticated = 1,
           is_locked = 0,
           password_fail_count = 0,
           status = 'active'
       WHERE class_id = :classId`,
      {
        transaction,
        replacements: { classId }
      }
    );

    await sequelize.query(
      `INSERT INTO schedule_periods
        (class_id, period, start_time, end_time, created_at, updated_at)
       VALUES
        (:classId, 1, '08:00:00', '08:45:00', NOW(), NOW()),
        (:classId, 2, '09:00:00', '09:45:00', NOW(), NOW())`,
      {
        transaction,
        replacements: { classId }
      }
    );

    await sequelize.query(
      `INSERT INTO schedules
        (class_id, weekday, period, subject, location, teacher_name, created_at, updated_at)
       VALUES
        (:classId, :todayWeekday, 1, '语文', '教室A', '张老师', NOW(), NOW()),
        (:classId, :todayWeekday, 2, '语文', '教室A', '张老师', NOW(), NOW()),
        (:classId, :tomorrowWeekday, 1, '语文', '教室A', '张老师', NOW(), NOW())`,
      {
        transaction,
        replacements: { classId, todayWeekday, tomorrowWeekday }
      }
    );

    const [scheduleRows] = await sequelize.query(
      `SELECT id, weekday, period
       FROM schedules
       WHERE class_id = :classId AND subject = '语文'`,
      {
        transaction,
        replacements: { classId }
      }
    );

    const scheduleTodayPeriod1 = scheduleRows.find((row) => Number(row.weekday) === todayWeekday && Number(row.period) === 1);
    const scheduleTodayPeriod2 = scheduleRows.find((row) => Number(row.weekday) === todayWeekday && Number(row.period) === 2);
    const scheduleTomorrowPeriod1 = scheduleRows.find((row) => Number(row.weekday) === tomorrowWeekday && Number(row.period) === 1);

    await sequelize.query(
      `INSERT INTO leave_requests
        (student_id, class_id, leave_type, request_mode, start_time, end_time, reason, status, current_location, go_home, submitted_at, created_at, updated_at)
       VALUES
        (3, :classId, 'sick', 'today', :todayStart, :todayEnd, 'overview-request-1', 'approved', 'classroom', 0, NOW(), NOW(), NOW()),
        (3, :classId, 'personal', 'custom', :tomorrowStart, :tomorrowEnd, 'overview-request-2', 'approved', 'classroom', 0, NOW(), NOW(), NOW())`,
      {
        transaction,
        replacements: {
          classId,
          todayStart: `${todayDateKey} 08:00:00`,
          todayEnd: `${todayDateKey} 09:45:00`,
          tomorrowStart: `${tomorrowDateKey} 08:00:00`,
          tomorrowEnd: `${tomorrowDateKey} 08:45:00`
        }
      }
    );

    const [leaveRequests] = await sequelize.query(
      `SELECT id, reason
       FROM leave_requests
       WHERE class_id = :classId AND reason IN ('overview-request-1', 'overview-request-2')`,
      {
        transaction,
        replacements: { classId }
      }
    );

    const leaveRequest1 = leaveRequests.find((row) => row.reason === 'overview-request-1');
    const leaveRequest2 = leaveRequests.find((row) => row.reason === 'overview-request-2');

    await sequelize.query(
      `INSERT INTO leave_records
        (leave_request_id, schedule_id, leave_date, weekday, period, subject, subject_snapshot, weekday_snapshot, period_snapshot, start_time_snapshot, end_time_snapshot, created_at, updated_at)
       VALUES
        (:leaveRequest1, :scheduleTodayPeriod1, :todayDateKey, :todayWeekday, 1, '语文', '语文', :todayWeekday, 1, '08:00:00', '08:45:00', NOW(), NOW()),
        (:leaveRequest1, :scheduleTodayPeriod2, :todayDateKey, :todayWeekday, 2, '语文', '语文', :todayWeekday, 2, '09:00:00', '09:45:00', NOW(), NOW()),
        (:leaveRequest2, :scheduleTomorrowPeriod1, :tomorrowDateKey, :tomorrowWeekday, 1, '语文', '语文', :tomorrowWeekday, 1, '08:00:00', '08:45:00', NOW(), NOW())`,
      {
        transaction,
        replacements: {
          leaveRequest1: leaveRequest1.id,
          leaveRequest2: leaveRequest2.id,
          scheduleTodayPeriod1: scheduleTodayPeriod1?.id || null,
          scheduleTodayPeriod2: scheduleTodayPeriod2?.id || null,
          scheduleTomorrowPeriod1: scheduleTomorrowPeriod1?.id || null,
          todayDateKey,
          tomorrowDateKey,
          todayWeekday,
          tomorrowWeekday
        }
      }
    );

    await sequelize.query(
      `INSERT INTO classroom_check_submissions
        (class_id, submitted_by_student_id, submitted_by_name_snapshot, check_date, slot_kind, weekday_snapshot, period_snapshot, subject_snapshot, start_time_snapshot, end_time_snapshot, slot_label_snapshot, selected_students_json, truancy_students_json, question_students_json, submitted_at, created_at, updated_at)
       VALUES
        (:classId, 1, '张三', :todayDateKey, 'active_course', :todayWeekday, 1, '语文', '08:00', '08:45', '星期${todayWeekday} 第1节 语文 08:00-08:45', :selectedStudents1, :truancyStudents1, :questionStudents1, NOW(), NOW(), NOW()),
        (:classId, 2, '李四', :tomorrowDateKey, 'active_course', :tomorrowWeekday, 1, '语文', '08:00', '08:45', '星期${tomorrowWeekday} 第1节 语文 08:00-08:45', :selectedStudents2, :truancyStudents2, :questionStudents2, NOW(), NOW(), NOW())`,
      {
        transaction,
        replacements: {
          classId,
          todayDateKey,
          tomorrowDateKey,
          todayWeekday,
          tomorrowWeekday,
          selectedStudents1: JSON.stringify([{ studentId: 4, studentName: '赵六', studentNumber: '004' }, { studentId: 5, studentName: '孙七', studentNumber: '005' }]),
          truancyStudents1: JSON.stringify([{ studentId: 4, studentName: '赵六', studentNumber: '004' }, { studentId: 5, studentName: '孙七', studentNumber: '005' }]),
          questionStudents1: JSON.stringify([{ studentId: 5, studentName: '孙七', studentNumber: '005' }]),
          selectedStudents2: JSON.stringify([{ studentId: 4, studentName: '赵六', studentNumber: '004' }]),
          truancyStudents2: JSON.stringify([{ studentId: 4, studentName: '赵六', studentNumber: '004' }]),
          questionStudents2: JSON.stringify([])
        }
      }
    );
  });
}

async function teacherLogin(page) {
  await page.goto(`${TEACHER_BASE_URL}/`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard\/approval$/);
}

test.describe('overview statistics metrics', () => {
  test.beforeAll(async () => {
    await seedDatabase();
  });

  test.afterAll(async () => {
    await sequelize.close();
  });

  test('shows updated units, person-day metrics, and export columns', async ({ browser }) => {
    test.setTimeout(120000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await teacherLogin(page);

    await page.goto(`${TEACHER_BASE_URL}/dashboard/overview-statistics`);

    const overviewResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/statistics/overview')
      && response.url().includes('period=month')
      && response.request().method() === 'GET'
    ));
    await page.locator('.overview-hero .period-switch__item').filter({ hasText: '月' }).click();
    const overviewResponse = await overviewResponsePromise;
    const overview = await overviewResponse.json();

    expect(overview.dormitoryRanking[0].leavePersonDays).toBe(2);
    expect(overview.weekdayDistribution.reduce((sum, item) => sum + Number(item.leavePersonDays || 0), 0)).toBe(2);
    expect(overview.courseProbability.bySlot.some((item) => item.subject === '语文' && item.timeSummary)).toBeTruthy();
    expect(overview.courseProbability.bySubject.some((item) => item.subject === '语文' && item.timeSummary)).toBeTruthy();
    expect(overview.classroomCheck.slotRanking.some((item) => item.subject === '语文' && item.timeSummary)).toBeTruthy();
    expect(overview.classroomCheck.subjectRanking.some((item) => item.subject === '语文' && item.timeSummary)).toBeTruthy();

    await expect(page.locator('.ranking-card')).toContainText('人/天');
    await expect(page.locator('.ranking-card')).toContainText('节');
    await expect(page.locator('.course-risk-card')).toContainText('人次');
    await expect(page.locator('.course-risk-card')).not.toContainText('理论应到');

    const exportResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/statistics/export-integrated')
      && response.url().includes('period=month')
      && response.request().method() === 'GET'
      && response.status() === 200
    ));
    await page.getByRole('button', { name: '导出 Excel' }).click();
    const exportResponse = await exportResponsePromise;
    const workbook = xlsx.read(await exportResponse.body(), { type: 'buffer' });
    const courseRiskSheet = xlsx.utils.sheet_to_json(workbook.Sheets.CourseRisk);

    expect(courseRiskSheet.length).toBeGreaterThan(0);
    expect(Object.keys(courseRiskSheet[0])).toContain('TimeSummary');
    expect(Object.keys(courseRiskSheet[0])).toContain('LeavePersonTimes');
    expect(Object.keys(courseRiskSheet[0])).toContain('TruancyPersonTimes');
    expect(Object.keys(courseRiskSheet[0])).not.toContain('TheoreticalAttendance');

    await context.close();
  });
});
