import { defineConfig, devices } from '@playwright/test';

// WebKit is Safari's engine; iPhone 15 gives the real viewport, touch and user agent.
// MD_BASE_URL points the suite at the live GitHub Pages site instead of a local server.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: process.env.MD_BASE_URL || 'http://127.0.0.1:8137/',
    ...devices['iPhone 15'],
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'iphone-webkit', use: { browserName: 'webkit' } }],
  webServer: process.env.MD_BASE_URL ? undefined : {
    command: 'python -m http.server 8137 --bind 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:8137/index.html',
    reuseExistingServer: true,
  },
});
