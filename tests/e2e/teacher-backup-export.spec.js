const { test, expect } = require('@playwright/test');
const bcrypt = require('../../server/node_modules/bcryptjs');
const { Sequelize } = require('../../server/node_modules/sequelize');

const TEACHER_BASE_URL = process.env.TEACHER_BASE_URL || 'http://127.0.0.1:5174';

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

async function ensureAdminPassword() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const [result] = await sequelize.query(
    "UPDATE teachers SET password_hash = :passwordHash WHERE username = 'admin'",
    {
      replacements: { passwordHash }
    }
  );

  if (!result?.affectedRows) {
    throw new Error('Admin teacher account not found in test database');
  }
}

async function createTeacherSession(page) {
  const response = await page.request.post(`${TEACHER_BASE_URL}/api/auth/teacher/login`, {
    data: {
      username: 'admin',
      password: 'admin123'
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();

  await page.addInitScript((session) => {
    localStorage.setItem('teacher_token', session.token);
    localStorage.setItem('teacher_user', JSON.stringify(session.teacher));
  }, payload);

  return payload;
}

async function openSettingsPage(page) {
  const session = await createTeacherSession(page);
  await page.goto(`${TEACHER_BASE_URL}/dashboard/settings`);
  await expect(page.locator('.teacher-settings-card--security')).toBeVisible();
  return session;
}

function getExportButton(page) {
  return page.locator('.teacher-settings-card--security .teacher-settings-item').first().locator('button');
}

test.describe('teacher backup export', () => {
  test.beforeAll(async () => {
    await ensureAdminPassword();
  });

  test.afterAll(async () => {
    await sequelize.close();
  });

  test('shows a single error toast when export fails', async ({ page }) => {
    await openSettingsPage(page);

    await page.route('**/api/teacher/backups/export', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ error: '导出数据库失败测试' })
      });
    });

    await getExportButton(page).click();

    const errorMessages = page.locator('.el-message.el-message--error .el-message__content');
    await expect(errorMessages.filter({ hasText: '导出数据库失败测试' })).toHaveCount(1);
    await expect(errorMessages).toHaveCount(1);
  });

  test('exports backup successfully', async ({ page }) => {
    test.setTimeout(120000);

    const session = await openSettingsPage(page);

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/teacher/backups/export') && response.status() === 200
    );

    await getExportButton(page).click();

    const exportResponse = await exportResponsePromise;
    expect(exportResponse.ok()).toBeTruthy();
    await expect(page.locator('.el-message.el-message--success .el-message__content')).toHaveCount(1);

    const statusResponse = await page.request.get(`${TEACHER_BASE_URL}/api/teacher/backups/status`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    expect(statusResponse.ok()).toBeTruthy();
    const statusPayload = await statusResponse.json();
    expect(statusPayload.lastExport).toBeTruthy();
    expect(statusPayload.lastExport.fileName).toMatch(/\.zip$/i);
    expect(statusPayload.lastExport.createdAt).toBeTruthy();
  });
});
