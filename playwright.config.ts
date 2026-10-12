import { defineConfig, devices } from '@playwright/test'
import chromium from '@sparticuz/chromium'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    browserName: 'chromium',
    launchOptions: {
      executablePath: '/tmp/chromium',
      args: chromium.args.filter((a) => !a.includes('headless') && a !== '--single-process'),
    },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'iphone-13',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'pixel-5',
      use: {
        ...devices['Pixel 5'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        defaultBrowserType: 'chromium',
      },
    },
  ],
})
