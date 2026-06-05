import { defineConfig } from '@playwright/test';

// Electron E2E only — isolated from the real ~/.claude via a temp HOME (see e2e/*.spec.ts).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
