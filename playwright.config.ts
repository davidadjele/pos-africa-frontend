import { defineConfig, devices } from '@playwright/test'

const URL_PREVISUALISATION = 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: URL_PREVISUALISATION,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablette-paysage',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Les tests visent le build de production servi par vite preview, pas le serveur de dev.
  webServer: {
    command: 'npm run build && npm run preview',
    url: URL_PREVISUALISATION,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
