import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Main } from '../../../src/renderer/screens/Main.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, fail, renderWithQuery, type CallSpy } from '../test-utils.js';

let call: CallSpy;

const report = (worst: HealthReport['worst']): HealthReport => ({
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst,
  counts: { ok: 0, warning: 0, error: worst === 'error' ? 1 : 0 },
  checks:
    worst === 'error'
      ? [
          {
            id: 'symlink:claude:/x',
            category: 'symlink',
            severity: 'error',
            title: 'Symlink missing: /x',
            target: '/x',
            observedAt: '2026-06-05T10:00:00.000Z',
          },
        ]
      : [],
});

const setupRoute = (worst: HealthReport['worst']) => {
  call.mockImplementation((method: string) => {
    if (method === 'health.getReport') return Promise.resolve(ok(report(worst)));
    if (method === 'global-instruction.get') {
      return Promise.resolve(fail('not_found', 'none'));
    }
    return Promise.resolve(ok([]));
  });
};

beforeEach(() => {
  call = mockApi();
});

describe('<Main> — health badge + diagnostics', () => {
  it('paints the nav badge with the report worst severity', async () => {
    setupRoute('error');
    renderWithQuery(<Main onOpenSettings={() => undefined} />);

    const badge = await screen.findByTestId('sidebar-health-badge');
    expect(badge).toHaveAttribute('data-severity', 'error');
  });

  it('navigates to the Diagnostics screen from the sidebar', async () => {
    setupRoute('ok');
    renderWithQuery(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('sidebar-diagnostics'));

    expect(await screen.findByTestId('health-screen')).toBeInTheDocument();
  });
});
