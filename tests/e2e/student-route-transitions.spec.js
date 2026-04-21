const { test, expect } = require('@playwright/test');

const STUDENT_BASE_URL = 'http://localhost:5173';

const mockStudent = {
  id: 1,
  name: 'Test Student',
  student_name: 'Test Student',
  className: 'Class 1',
  class_name: 'Class 1',
  role: 'student'
};

const mockSchedule = {
  periods: [],
  schedules: [],
  specialDates: []
};

const mockLeaveContext = {
  today: {
    available: true,
    reason: '',
    currentLocation: 'dormitory',
    currentLocationLabel: 'Dormitory',
    currentCourse: null,
    presets: [
      {
        id: 'afternoon',
        label: 'Afternoon',
        fromPeriod: 3,
        toPeriod: 5
      }
    ],
    rangeOptions: [
      { period: 3, label: 'Period 3', startTime: '14:00', endTime: '14:45' },
      { period: 4, label: 'Period 4', startTime: '15:00', endTime: '15:45' },
      { period: 5, label: 'Period 5', startTime: '16:00', endTime: '16:45' }
    ],
    copyText: 'Ready to submit a leave request.'
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
    reason: 'Resting in the dormitory.',
    status: 'approved',
    current_location: 'dormitory',
    go_home: false,
    submitted_at: '2026-04-09T08:30:00+08:00',
    reviewed_at: '2026-04-09T09:00:00+08:00',
    teacher_comment: 'Approved.',
    history_notice: 'Archived record.',
    records: [
      {
        leave_date: '2026-04-09',
        weekday: 4,
        period: 3,
        subject: 'Chinese',
        startTime: '14:00',
        endTime: '14:45'
      }
    ]
  }
];

async function createStudentPage(browser, contextOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...contextOptions
  });

  await context.addInitScript((student) => {
    localStorage.setItem('token', 'playwright-route-token');
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

    await route.fulfill({
      status: 404,
      json: { error: `Unexpected mock request: ${url.pathname}` }
    });
  });

  const page = await context.newPage();
  return { context, page };
}

async function installTransitionSampler(page) {
  await page.evaluate(() => {
    window.__routeTransitionObserver?.disconnect?.();

    const samples = [];
    const record = () => {
      samples.push({
        time: performance.now(),
        root: Array.from(document.querySelectorAll('.route-stage--root > *')).map((element) => element.className),
        tab: Array.from(document.querySelectorAll('.route-stage--tab > *')).map((element) => element.className)
      });

      if (samples.length > 500) {
        samples.splice(0, samples.length - 500);
      }
    };

    const observer = new MutationObserver(record);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });

    record();
    window.__routeTransitionSamples = samples;
    window.__routeTransitionObserver = observer;
    window.__routeTransitionRecord = record;
  });
}

async function markTransitionStart(page) {
  return page.evaluate(() => {
    window.__routeTransitionRecord?.();
    return performance.now();
  });
}

async function readTransitionSamples(page, sinceTime) {
  return page.evaluate((startTime) => (
    (window.__routeTransitionSamples || []).filter((sample) => sample.time >= startTime)
  ), sinceTime);
}

async function readBackgroundSnapshot(page) {
  return page.evaluate(() => {
    const selectors = ['html', 'body', '#app', '.app-root', '.route-stage--root'];
    const scrollingElement = document.scrollingElement || document.documentElement;

    const describe = (selector) => {
      const element = selector === 'html'
        ? document.documentElement
        : selector === 'body'
          ? document.body
          : document.querySelector(selector);

      if (!element) {
        return { selector, missing: true };
      }

      const style = getComputedStyle(element);
      return {
        selector,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage
      };
    };

    return {
      chain: selectors.map(describe),
      pageWidth: scrollingElement.clientWidth,
      pageScrollWidth: scrollingElement.scrollWidth
    };
  });
}

function hasVisibleBackground(entry) {
  return entry.backgroundColor !== 'rgba(0, 0, 0, 0)' || entry.backgroundImage !== 'none';
}

function expectBackgroundSnapshot(snapshot) {
  snapshot.chain.forEach((entry) => {
    expect(entry.missing).not.toBe(true);
    expect(hasVisibleBackground(entry)).toBe(true);
  });

  expect(snapshot.pageScrollWidth).toBeLessThanOrEqual(snapshot.pageWidth + 1);
}

function samplesContainClass(samples, scope, className) {
  return samples.some((sample) => sample[scope].some((value) => value.includes(className)));
}

test.describe('student route transitions', () => {
  test('root routes and shell tabs use fade transitions without exposing a white backdrop', async ({ browser }) => {
    const { context, page } = await createStudentPage(browser);

    try {
      await page.goto(`${STUDENT_BASE_URL}/app/home`);
      await expect(page.locator('.info-card__action--blue')).toBeVisible();
      await installTransitionSampler(page);

      expectBackgroundSnapshot(await readBackgroundSnapshot(page));

      const rootTransitionStart = await markTransitionStart(page);
      await Promise.all([
        page.waitForURL(/\/apply$/),
        page.locator('.info-card__action--blue').click()
      ]);
      await page.waitForTimeout(240);

      const rootSamples = await readTransitionSamples(page, rootTransitionStart);
      expect(samplesContainClass(rootSamples, 'root', 'route-fade-soft-enter-active')).toBe(true);
      expect(samplesContainClass(rootSamples, 'root', 'route-fade-soft-leave-active')).toBe(true);
      expectBackgroundSnapshot(await readBackgroundSnapshot(page));

      await page.goBack();
      await expect(page).toHaveURL(/\/app\/home$/);
      await expect(page.locator('.app-tabbar__item').nth(2)).toBeVisible();

      const tabTransitionStart = await markTransitionStart(page);
      await Promise.all([
        page.waitForURL(/\/app\/settings$/),
        page.locator('.app-tabbar__item').nth(2).click()
      ]);
      await page.waitForTimeout(240);

      const tabSamples = await readTransitionSamples(page, tabTransitionStart);
      expect(samplesContainClass(tabSamples, 'tab', 'route-fade-soft-enter-active')).toBe(true);
      expect(samplesContainClass(tabSamples, 'tab', 'route-fade-soft-leave-active')).toBe(true);
      expectBackgroundSnapshot(await readBackgroundSnapshot(page));
    } finally {
      await context.close();
    }
  });

  test('reduced motion falls back to route-none instead of fade', async ({ browser }) => {
    const { context, page } = await createStudentPage(browser, {
      reducedMotion: 'reduce'
    });

    try {
      await page.goto(`${STUDENT_BASE_URL}/app/home`);
      await expect(page.locator('.info-card__action--blue')).toBeVisible();
      await installTransitionSampler(page);

      const rootTransitionStart = await markTransitionStart(page);
      await Promise.all([
        page.waitForURL(/\/apply$/),
        page.locator('.info-card__action--blue').click()
      ]);
      await page.waitForTimeout(80);

      const rootSamples = await readTransitionSamples(page, rootTransitionStart);
      expect(samplesContainClass(rootSamples, 'root', 'route-fade-soft')).toBe(false);
      expect(samplesContainClass(rootSamples, 'root', 'route-none-enter-active')).toBe(true);
      expect(samplesContainClass(rootSamples, 'root', 'route-none-leave-active')).toBe(true);

      const motionTiers = await page.evaluate(() => (
        Array.from(document.querySelectorAll('.route-scene--root')).map((element) => element.dataset.routeMotionTier)
      ));
      expect(motionTiers.every((value) => value === 'none')).toBe(true);
    } finally {
      await context.close();
    }
  });
});
