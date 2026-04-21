// Root-level Playwright config for cross-app browser regression checks.
const fs = require('fs');
const { defineConfig, devices } = require('@playwright/test');

const localChromePath =
  process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const chromiumProjectUse = {
  ...devices['Desktop Chrome']
};
const localVideoMode = process.env.CI ? 'retain-on-failure' : 'off';

// Fresh Windows environments often have Chrome installed before Playwright's
// bundled browsers are downloaded, so prefer the system channel when present.
if (fs.existsSync(localChromePath)) {
  chromiumProjectUse.channel = 'chrome';
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.PLAYWRIGHT_VIDEO || localVideoMode
  },
  projects: [
    {
      name: 'chromium',
      use: chromiumProjectUse
    }
  ]
});
