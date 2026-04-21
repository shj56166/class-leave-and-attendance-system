const { test, expect } = require('@playwright/test');

const STUDENT_BASE_URL = 'http://localhost:5173';

const mockStudent = {
  id: 1,
  name: '张三',
  student_name: '张三',
  role: 'student',
  class_id: 1,
  class_name: '演示班级A'
};

const mockLeaveContext = {
  today: {
    available: true,
    reason: '',
    currentLocation: 'dormitory',
    currentLocationLabel: '宿舍',
    currentCourse: {
      subject: '语文',
      period: 3,
      startTime: '14:00',
      endTime: '14:45',
      location: '演示教室A-101'
    },
    presets: [
      {
        id: 'afternoon',
        label: '下午课程',
        fromPeriod: 3,
        toPeriod: 5
      }
    ],
    rangeOptions: [
      { period: 3, label: '第3节', startTime: '14:00', endTime: '14:45' },
      { period: 4, label: '第4节', startTime: '15:00', endTime: '15:45' },
      { period: 5, label: '第5节', startTime: '16:00', endTime: '16:45' }
    ],
    copyText: '系统已识别当前位置，可直接选择今天剩余课程。'
  },
  weekendTargets: []
};

const mockLeaves = [
  {
    id: 101,
    leave_type: 'sick',
    request_mode: 'today',
    start_time: '2026-04-09T14:00:00+08:00',
    end_time: '2026-04-09T16:00:00+08:00',
    reason: '身体不适，需要在宿舍休息。',
    status: 'approved',
    current_location: 'dormitory',
    go_home: false,
    submitted_at: '2026-04-09T08:30:00+08:00',
    reviewed_at: '2026-04-09T09:00:00+08:00',
    teacher_comment: '同意，请注意休息。',
    history_notice: '该记录已归档。',
    records: [
      {
        leave_date: '2026-04-09',
        weekday: 4,
        period: 3,
        subject: '语文',
        startTime: '14:00',
        endTime: '14:45'
      }
    ]
  },
  {
    id: 102,
    leave_type: 'personal',
    request_mode: 'custom',
    start_time: '2026-04-08T09:00:00+08:00',
    end_time: '2026-04-08T11:00:00+08:00',
    reason: '需要外出办理个人事务。',
    status: 'pending',
    current_location: 'other',
    go_home: false,
    submitted_at: '2026-04-08T07:50:00+08:00',
    reviewed_at: null,
    teacher_comment: '',
    history_notice: '',
    records: [
      {
        leave_date: '2026-04-08',
        weekday: 3,
        period: 1,
        subject: '数学',
        startTime: '09:00',
        endTime: '09:45'
      },
      {
        leave_date: '2026-04-08',
        weekday: 3,
        period: 2,
        subject: '英语',
        startTime: '10:00',
        endTime: '10:45'
      }
    ]
  },
  {
    id: 103,
    leave_type: 'other',
    request_mode: 'weekend',
    start_time: '2026-04-06T00:00:00+08:00',
    end_time: '2026-04-07T23:59:00+08:00',
    reason: '',
    status: 'recorded',
    current_location: 'home',
    go_home: true,
    submitted_at: '2026-04-05T18:00:00+08:00',
    reviewed_at: '2026-04-05T18:00:00+08:00',
    teacher_comment: '',
    history_notice: '周末回家报备已完成。',
    records: []
  },
  {
    id: 104,
    leave_type: 'sick',
    request_mode: 'today',
    start_time: '2026-04-04T13:00:00+08:00',
    end_time: '2026-04-04T15:30:00+08:00',
    reason: '上午体温偏高，下午继续观察。',
    status: 'rejected',
    current_location: 'dormitory',
    go_home: false,
    submitted_at: '2026-04-04T11:40:00+08:00',
    reviewed_at: '2026-04-04T12:10:00+08:00',
    teacher_comment: '请先到校医室复查后再补交申请。',
    history_notice: '',
    records: [
      {
        leave_date: '2026-04-04',
        weekday: 5,
        period: 5,
        subject: '物理',
        startTime: '13:00',
        endTime: '13:45'
      }
    ]
  }
];

const mockSchedule = {
  periods: [],
  schedules: [],
  specialDates: []
};

const viewportScenarios = [
  {
    name: 'desktop',
    contextOptions: {
      viewport: { width: 1280, height: 900 }
    },
    scrollY: 220
  },
  {
    name: 'mobile',
    contextOptions: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    },
    scrollY: 220
  }
];

async function createStudentPage(browser, contextOptions) {
  const context = await browser.newContext(contextOptions);

  await context.addInitScript((student) => {
    localStorage.setItem('token', 'playwright-student-token');
    localStorage.setItem('user', JSON.stringify(student));
  }, mockStudent);

  await context.route('**/api/student/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/student/profile')) {
      await route.fulfill({ json: { student: mockStudent } });
      return;
    }

    if (url.pathname.endsWith('/student/schedule')) {
      await route.fulfill({ json: mockSchedule });
      return;
    }

    if (url.pathname.endsWith('/student/leave/context')) {
      await route.fulfill({ json: mockLeaveContext });
      return;
    }

    if (url.pathname.endsWith('/student/leaves')) {
      await route.fulfill({ json: mockLeaves });
      return;
    }

    await route.fulfill({ status: 404, json: { error: `Unexpected mock request: ${url.pathname}` } });
  });

  const page = await context.newPage();
  return { context, page };
}

async function waitForLayoutSync(page, scrollY) {
  await page.evaluate(async (nextScrollY) => {
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    window.scrollTo(0, nextScrollY);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, scrollY);

  await expect.poll(async () => (
    page.locator('.page-nav').last().evaluate((element) => element.classList.contains('page-nav--compact'))
  )).toBe(true);
}

async function readStickyMetrics(page, expectedTitle) {
  return page.evaluate((titleText) => {
    const navCandidates = Array.from(document.querySelectorAll('.page-nav'));
    const nav = navCandidates.find((candidate) => (
      candidate.querySelector('.page-nav__title--target')?.textContent?.trim() === titleText
    )) || navCandidates.at(-1) || null;
    const sharedTitle = nav?.querySelector('.page-nav__shared-title') || null;
    const targetTitle = nav?.querySelector('.page-nav__title--target') || null;
    const scrollingElement = document.scrollingElement || document.documentElement;

    const toRect = (element) => {
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    };

    return {
      appNodeCount: document.querySelectorAll('#app').length,
      navRect: toRect(nav),
      sharedTitleRect: toRect(sharedTitle),
      targetTitleRect: toRect(targetTitle),
      pageWidth: scrollingElement.clientWidth,
      pageScrollWidth: scrollingElement.scrollWidth
    };
  }, expectedTitle);
}

function expectStickyAlignment(metrics) {
  expect(metrics.appNodeCount).toBe(1);
  expect(metrics.navRect).not.toBeNull();
  expect(metrics.sharedTitleRect).not.toBeNull();
  expect(metrics.targetTitleRect).not.toBeNull();

  expect(Math.abs(metrics.navRect.top)).toBeLessThan(1);
  expect(Math.abs(metrics.sharedTitleRect.top - metrics.targetTitleRect.top)).toBeLessThan(1);
  expect(Math.abs(metrics.sharedTitleRect.left - metrics.targetTitleRect.left)).toBeLessThan(4);
  expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.pageWidth + 1);
}

test.describe('student sticky leave headers', () => {
  for (const scenario of viewportScenarios) {
    test(`${scenario.name} keeps leave headers pinned after route navigation`, async ({ browser }) => {
      const { context, page } = await createStudentPage(browser, scenario.contextOptions);

      try {
        await page.goto(`${STUDENT_BASE_URL}/app/home`);
        await expect(page.locator('.info-card__action--blue')).toBeVisible();

        await page.locator('.info-card__action--blue').click();
        await expect(page).toHaveURL(/\/apply$/);
        await expect(page.locator('.page-nav__title--target', { hasText: '请假申请' })).toBeVisible();

        await waitForLayoutSync(page, scenario.scrollY);
        expectStickyAlignment(await readStickyMetrics(page, '请假申请'));

        await page.locator('.page-nav__back').click();
        await expect(page).toHaveURL(/\/app\/home$/);

        await page.locator('.info-card__action--green').click();
        await expect(page).toHaveURL(/\/leaves$/);
        await expect(page.locator('.page-nav__title--target', { hasText: '请假历史' })).toBeVisible();

        await waitForLayoutSync(page, scenario.scrollY);
        expectStickyAlignment(await readStickyMetrics(page, '请假历史'));
      } finally {
        await context.close();
      }
    });
  }
});
