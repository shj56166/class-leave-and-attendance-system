const { test, expect } = require('@playwright/test');
const bcrypt = require('../../server/node_modules/bcryptjs');
const { Sequelize } = require('../../server/node_modules/sequelize');

const TEACHER_BASE_URL = 'http://localhost:5174';
const STUDENT_BASE_URL = 'http://localhost:5173';

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
    throw new Error(
      `Refusing to run Playwright against the development database. Missing: ${missingVars.join(', ')}`
    );
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

async function seedDatabase() {
  const passwordHash = await bcrypt.hash('123456', 10);
  const teacherHash = await bcrypt.hash('admin123', 10);
  const now = new Date();
  const leaveStart = new Date(now.getTime() - (30 * 60 * 1000));
  const leaveEnd = new Date(now.getTime() + (90 * 60 * 1000));
  const submittedAt = new Date(now.getTime() - (2 * 60 * 60 * 1000));
  const reviewedAt = new Date(now.getTime() - (60 * 60 * 1000));

  await sequelize.transaction(async (transaction) => {
    const [classes] = await sequelize.query(
      'SELECT id, class_code FROM classes ORDER BY id LIMIT 1',
      { transaction }
    );

    if (!classes.length) {
      throw new Error('No class data found for e2e test');
    }

    classCode = classes[0].class_code;

    await sequelize.query('DELETE FROM leave_records', { transaction });
    await sequelize.query('DELETE FROM leave_requests', { transaction });
    await sequelize.query('UPDATE students SET dormitory_id = NULL', { transaction });
    await sequelize.query('DELETE FROM dormitories', { transaction });
    await sequelize.query('UPDATE classes SET login_window_open = 1', { transaction });

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
           status = 'active'
       WHERE id IN (1, 2, 3, 4, 5, 6)`,
      {
        transaction,
        replacements: { passwordHash }
      }
    );

    await sequelize.query(
      `INSERT INTO leave_requests
        (student_id, class_id, leave_type, request_mode, start_time, end_time, reason, status, current_location, go_home, teacher_id, teacher_comment, submitted_at, reviewed_at, created_at, updated_at)
       VALUES
        (1, 1, 'sick', 'today', :leaveStart, :leaveEnd, '宿舍休息中', 'approved', 'dormitory', 0, 1, '同意', :submittedAt, :reviewedAt, NOW(), NOW()),
        (3, 1, 'personal', 'today', :leaveStart, :leaveEnd, '教室请假', 'approved', 'classroom', 0, 1, '同意', :submittedAt, :reviewedAt, NOW(), NOW())`,
      {
        transaction,
        replacements: { leaveStart, leaveEnd, submittedAt, reviewedAt }
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

async function createDormitory(page, name) {
  await page.getByRole('button', { name: '新建宿舍' }).click();
  await page.getByPlaceholder('例如 A101 / 女生 202').fill(name);
  await page.getByRole('button', { name: '创建宿舍' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function assignDormitoryMembers(page, dormitoryName, studentNames) {
  const dormitoryCard = page.locator('.dormitory-card').filter({ hasText: dormitoryName }).first();
  await dormitoryCard.getByRole('button', { name: '分配学生' }).click();

  for (const studentName of studentNames) {
    await page.locator('.student-option').filter({ hasText: studentName }).first().click();
  }

  await page.getByRole('button', { name: '保存宿舍' }).click();
  await expect(dormitoryCard).toContainText(studentNames.join('、'));
}

async function studentLogin(page, targetStudentName) {
  await page.goto(`${STUDENT_BASE_URL}/`);
  await page.getByPlaceholder('请输入教室组代码').fill(classCode);
  await page.getByRole('button', { name: '搜索学生' }).click();
  await page.getByPlaceholder('点击选择你的名字').click();
  await page.locator('.student-option').filter({ hasText: targetStudentName }).first().click();
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByPlaceholder('请输入 6 位数字密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app\/home$/);
}

async function readClipboard(page) {
  return page.evaluate(async () => navigator.clipboard.readText());
}

test.describe('new counselor and dormitory flows', () => {
  test.beforeAll(async () => {
    await seedDatabase();
  });

  test.afterAll(async () => {
    await sequelize.close();
  });

  test('teacher dormitory management + student weekend report + counselor panel', async ({ browser }) => {
    test.setTimeout(240000);

    const teacherContext = await browser.newContext();
    await teacherContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: TEACHER_BASE_URL });
    const teacherPage = await teacherContext.newPage();

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await teacherLogin(teacherPage);
    await teacherPage.goto(`${TEACHER_BASE_URL}/dashboard/students`);

    await createDormitory(teacherPage, 'A101');
    await createDormitory(teacherPage, 'B203');

    await assignDormitoryMembers(teacherPage, 'A101', ['张三', '李四']);
    await assignDormitoryMembers(teacherPage, 'B203', ['王五']);

    await expect(teacherPage.locator('.el-table__row').filter({ hasText: '张三' }).first()).toContainText('A101');
    await expect(teacherPage.locator('.el-table__row').filter({ hasText: '王五' }).first()).toContainText('B203');

    await studentLogin(studentPage, '张三');
    await studentPage.goto(`${STUDENT_BASE_URL}/apply`);

    await studentPage.getByRole('button', { name: /周末 \/ 节假日/ }).click();
    await expect(studentPage.getByText('周末 / 节假日回家报备')).toBeVisible();
    await expect(studentPage.getByText('复制给教官')).toHaveCount(0);
    await expect(studentPage.getByText('是否回家')).toHaveCount(0);

    await studentPage.locator('.target-card').first().click();
    await studentPage.getByRole('button', { name: '提交回家报备' }).click();
    await expect(studentPage).toHaveURL(/\/leaves$/);

    await teacherPage.goto(`${TEACHER_BASE_URL}/dashboard/statistics`);

    const now = new Date();
    const expectedDefaultTab = now.getDay() === 5 && now.getHours() >= 12 ? '周末回家' : '今日请假';
    await expect(teacherPage.locator('.panel-switch__item--active')).toHaveText(expectedDefaultTab);

    await teacherPage.getByRole('button', { name: '今日请假' }).click();
    await expect(teacherPage.getByText('当前正在请假')).toBeVisible();
    await expect(teacherPage.locator('.student-card').filter({ hasText: '张三' }).first()).toContainText('A101');
    await expect(teacherPage.locator('.student-card').filter({ hasText: '王五' }).first()).toContainText('B203');
    await expect(teacherPage.locator('.panel-section').filter({ hasText: '目前在宿舍' })).toContainText('张三');
    await expect(teacherPage.locator('.panel-section').filter({ hasText: '目前在宿舍' })).not.toContainText('王五');

    await teacherPage.getByRole('button', { name: '一键复制给教官' }).click();
    await expect.poll(async () => readClipboard(teacherPage)).toContain('A101 张三');
    await expect.poll(async () => readClipboard(teacherPage)).not.toContain('王五');

    await teacherPage.getByRole('button', { name: '周末回家' }).click();
    await expect(teacherPage.getByText('周末 / 节假日回家')).toBeVisible();
    await expect(teacherPage.locator('.student-card').filter({ hasText: '张三' }).first()).toContainText('A101');
    await expect(teacherPage.locator('.dorm-card').filter({ hasText: 'A101' }).first()).toContainText('张三');

    await teacherPage.getByRole('button', { name: '一键复制给教官' }).click();
    await expect.poll(async () => readClipboard(teacherPage)).toContain('A101 张三');

    await teacherContext.close();
    await studentContext.close();
  });
});
