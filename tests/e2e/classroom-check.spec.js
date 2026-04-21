const { test, expect } = require('@playwright/test');
const bcrypt = require('../../server/node_modules/bcryptjs');
const { Sequelize } = require('../../server/node_modules/sequelize');

const TEACHER_BASE_URL = process.env.TEACHER_BASE_URL || 'http://127.0.0.1:5174';
const STUDENT_BASE_URL = process.env.STUDENT_BASE_URL || 'http://127.0.0.1:5175';

const UI = {
  teacherUsername: '请输入用户名',
  teacherPassword: '请输入密码',
  login: '登录',
  classCode: '请输入班级代码',
  searchStudent: '搜索学生',
  chooseStudent: '点击选择你的名字',
  passwordInput: '请输入 6 位数字密码',
  manageTitle: '教室学生核对',
  lockedText: '只有老师任命的班干才能使用实际管理功能',
  openPicker: '勾选未到学生',
  continuePicker: '继续勾选',
  finishPicker: '完成勾选',
  manualSubmit: '手动提交',
  duplicateTitle: '重复提交提醒',
  duplicateConfirm: '继续提交'
};

let classCode = '';

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

function toWeekday(now) {
  const weekday = now.getDay();
  return weekday === 0 ? 7 : weekday;
}

function toTimeText(date) {
  return date.toTimeString().slice(0, 8);
}

async function seedDatabase() {
  const studentPasswordHash = await bcrypt.hash('123456', 10);
  const teacherHash = await bcrypt.hash('admin123', 10);
  const now = new Date();
  const leaveStart = new Date(now.getTime() - (30 * 60 * 1000));
  const leaveEnd = new Date(now.getTime() + (90 * 60 * 1000));
  const submittedAt = new Date(now.getTime() - (2 * 60 * 60 * 1000));
  const periodStart = new Date(now.getTime() - (60 * 60 * 1000));
  const periodEnd = new Date(now.getTime() + (60 * 60 * 1000));

  await sequelize.transaction(async (transaction) => {
    const [classes] = await sequelize.query(
      'SELECT id, class_code FROM classes ORDER BY id LIMIT 1',
      { transaction }
    );

    if (!classes.length) {
      throw new Error('No class data found for classroom check e2e test');
    }

    classCode = classes[0].class_code;

    await sequelize.query('DELETE FROM classroom_check_submissions', { transaction });
    await sequelize.query('DELETE FROM leave_records', { transaction });
    await sequelize.query('DELETE FROM leave_requests', { transaction });
    await sequelize.query('DELETE FROM schedules WHERE class_id = 1', { transaction });
    await sequelize.query('DELETE FROM schedule_periods WHERE class_id = 1', { transaction });
    await sequelize.query('UPDATE classes SET login_window_open = 1', { transaction });

    await sequelize.query(
      `INSERT INTO schedule_periods
        (class_id, period, start_time, end_time, created_at, updated_at)
       VALUES
        (1, 1, :startTime, :endTime, NOW(), NOW())`,
      {
        transaction,
        replacements: {
          startTime: toTimeText(periodStart),
          endTime: toTimeText(periodEnd)
        }
      }
    );

    await sequelize.query(
      `INSERT INTO schedules
        (class_id, weekday, period, subject, location, teacher_name, created_at, updated_at)
       VALUES
        (1, :weekday, 1, '语文', '教室', '李老师', NOW(), NOW())`,
      {
        transaction,
        replacements: { weekday: toWeekday(now) }
      }
    );

    await sequelize.query(
      "UPDATE teachers SET password_hash = :passwordHash WHERE username IN ('admin', 'teacher')",
      {
        transaction,
        replacements: { passwordHash: teacherHash }
      }
    );

    await sequelize.query(
      `UPDATE students
       SET password_hash = :passwordHash,
           is_authenticated = 1,
           is_locked = 0,
           password_fail_count = 0,
           status = 'active',
           role = CASE WHEN id IN (1, 2) THEN 'cadre' ELSE 'student' END
       WHERE id IN (1, 2, 3, 4, 5, 6)`,
      {
        transaction,
        replacements: { passwordHash: studentPasswordHash }
      }
    );

    await sequelize.query(
      `INSERT INTO leave_requests
        (student_id, class_id, leave_type, request_mode, start_time, end_time, reason, status, current_location, go_home, submitted_at, created_at, updated_at)
       VALUES
        (3, 1, 'sick', 'today', :leaveStart, :leaveEnd, 'approved classroom leave', 'approved', 'classroom', 0, :submittedAt, NOW(), NOW()),
        (4, 1, 'personal', 'today', :leaveStart, :leaveEnd, 'pending classroom leave', 'pending', 'classroom', 0, :submittedAt, NOW(), NOW())`,
      {
        transaction,
        replacements: { leaveStart, leaveEnd, submittedAt }
      }
    );
  });
}

async function teacherLogin(page) {
  await page.goto(`${TEACHER_BASE_URL}/`);
  await page.getByPlaceholder(UI.teacherUsername).fill('admin');
  await page.getByPlaceholder(UI.teacherPassword).fill('admin123');
  await page.getByRole('button', { name: UI.login }).click();
  await expect(page).toHaveURL(/\/dashboard\/approval$/);
}

async function studentLogin(page, targetStudentName) {
  await page.goto(`${STUDENT_BASE_URL}/`);
  await page.getByPlaceholder(UI.classCode).fill(classCode);
  await page.getByRole('button', { name: UI.searchStudent }).click();
  await page.getByPlaceholder(UI.chooseStudent).click();
  await page.locator('.student-option').filter({ hasText: targetStudentName }).first().click();
  await page.getByRole('button', { name: UI.login }).click();
  await page.getByPlaceholder(UI.passwordInput).fill('123456');
  await page.getByRole('button', { name: UI.login }).click();
  await expect(page).toHaveURL(/\/app\/home$/);
}

test.describe('classroom check management', () => {
  test.beforeAll(async () => {
    await seedDatabase();
  });

  test.afterAll(async () => {
    await sequelize.close();
  });

  test('cadres use preview flow, share latest result, and can re-submit after warning', async ({ browser }) => {
    test.setTimeout(240000);

    const regularStudentContext = await browser.newContext();
    const regularStudentPage = await regularStudentContext.newPage();
    await studentLogin(regularStudentPage, '王五');
    await regularStudentPage.goto(`${STUDENT_BASE_URL}/app/manage`);
    await expect(regularStudentPage.getByText(UI.lockedText)).toBeVisible();
    await expect(regularStudentPage.getByRole('button', { name: UI.openPicker })).toHaveCount(0);

    const firstCadreContext = await browser.newContext();
    await firstCadreContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: STUDENT_BASE_URL });
    const firstCadrePage = await firstCadreContext.newPage();
    await studentLogin(firstCadrePage, '张三');
    await firstCadrePage.goto(`${STUDENT_BASE_URL}/app/manage`);

    await expect(firstCadrePage.getByText(UI.manageTitle)).toBeVisible();
    await firstCadrePage.getByRole('button', { name: UI.openPicker }).click();
    await firstCadrePage.locator('.student-option').filter({ hasText: '王五' }).first().click();
    await firstCadrePage.locator('.student-option').filter({ hasText: '赵六' }).first().click();
    await firstCadrePage.locator('.student-option').filter({ hasText: '孙七' }).first().click();
    await firstCadrePage.getByRole('button', { name: UI.finishPicker }).click();

    const previewPanel = firstCadrePage.locator('.preview-panel');
    await expect(previewPanel).toContainText('王五');
    await expect(previewPanel).toContainText('赵六');
    await expect(previewPanel).toContainText('孙七');

    await firstCadrePage.getByRole('button', { name: UI.manualSubmit }).click();

    const firstResultCard = firstCadrePage.locator('.result-card');
    await expect(firstResultCard).toContainText('张三');
    await expect(firstResultCard).toContainText('王五');
    await expect(firstResultCard).toContainText('赵六');
    await expect(firstResultCard).toContainText('孙七');
    await expect(firstResultCard).toContainText('疑问名单');

    const secondCadreContext = await browser.newContext();
    const secondCadrePage = await secondCadreContext.newPage();
    await studentLogin(secondCadrePage, '李四');
    await secondCadrePage.goto(`${STUDENT_BASE_URL}/app/manage`);

    await expect(secondCadrePage.locator('.slot-reminder')).toContainText('张三');
    const secondResultCard = secondCadrePage.locator('.result-card');
    await expect(secondResultCard).toContainText('张三');
    await expect(secondResultCard).toContainText('王五');
    await expect(secondResultCard).toContainText('孙七');

    await expect(secondCadrePage.locator('.result-card .icon-button')).toHaveCount(1);

    await secondCadrePage.getByRole('button', { name: UI.openPicker }).click();
    await secondCadrePage.locator('.student-option').filter({ hasText: '赵六' }).first().click();
    await secondCadrePage.getByRole('button', { name: UI.finishPicker }).click();
    await expect(secondCadrePage.locator('.preview-panel')).toContainText('赵六');
    await secondCadrePage.getByRole('button', { name: UI.manualSubmit }).click();

    await expect(secondCadrePage.getByText(UI.duplicateTitle)).toBeVisible();
    await expect(secondCadrePage.getByText('张三')).toBeVisible();
    await secondCadrePage.getByRole('button', { name: UI.duplicateConfirm }).click();

    await expect(secondResultCard).toContainText('李四');
    await expect(secondResultCard).toContainText('赵六');

    const teacherContext = await browser.newContext();
    await teacherContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: TEACHER_BASE_URL });
    const teacherPage = await teacherContext.newPage();
    await teacherLogin(teacherPage);

    await teacherPage.goto(`${TEACHER_BASE_URL}/dashboard/statistics`);
    const classroomCheckCard = teacherPage.locator('.classroom-check-card');
    await expect(classroomCheckCard).toContainText('李四');
    await expect(classroomCheckCard).toContainText('赵六');

    await teacherPage.goto(`${TEACHER_BASE_URL}/dashboard/overview-statistics`);
    await expect(teacherPage.getByText('课堂旷课摘要')).toBeVisible();
    await expect(teacherPage.locator('.summary-card--warn')).toContainText('旷课总人次');
    await expect(teacherPage.locator('.overview-main-grid--classroom')).toContainText('赵六');

    await teacherPage.goto(`${TEACHER_BASE_URL}/dashboard/audit-logs`);
    await expect(teacherPage.locator('.el-table')).toContainText('张三');
    await expect(teacherPage.locator('.el-table')).toContainText('李四');

    await regularStudentContext.close();
    await firstCadreContext.close();
    await secondCadreContext.close();
    await teacherContext.close();
  });
});
