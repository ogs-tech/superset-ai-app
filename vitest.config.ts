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
        'src/main/infrastructure/settings/in-memory-settings-repository.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
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
