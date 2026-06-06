import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/main/application/**',
        'src/main/ipc/**',
        'src/main/infrastructure/**',
        'src/renderer/screens/**',
        'src/renderer/App.tsx',
      ],
      exclude: [
        'src/main/infrastructure/dialog/**',
        'src/main/infrastructure/notification/**',
        'src/main/infrastructure/settings/in-memory-settings-repository.ts',
      ],
      // Ratchet floor: set just below the 2026-06-06 baseline (S75 / B63 / F74 / L76)
      // so the gate blocks regression today without blocking merges. Raise toward
      // 80/70 as renderer-screen and IPC-handler coverage improves.
      thresholds: {
        lines: 75,
        functions: 72,
        statements: 74,
        branches: 62,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/main/**/*.test.ts', 'tests/shared/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/renderer/setup.ts'],
        },
      },
    ],
  },
});
