import { defineConfig, devices } from '@playwright/test'

// Parcours contre le vrai backend (scripts/e2e-reel.sh le démarre avec sa base). Hors CI : le
// backend n'y tourne pas. Vite (serveur de dev) relaie /api vers http://localhost:8080.
const URL_DEV = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e-reel',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: URL_DEV,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  },
  webServer: {
    command: 'npm run dev',
    url: URL_DEV,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
