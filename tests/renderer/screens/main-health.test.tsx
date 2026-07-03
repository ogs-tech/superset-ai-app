import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Main } from '../../../src/renderer/screens/Main.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, fail, renderWithShell, type CallSpy } from '../test-utils.js';

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
    if (method === 'instruction.get') {
      return Promise.resolve(fail('not_found', 'none'));
    }
    return Promise.resolve(ok([]));
  });
};

beforeEach(() => {
  call = mockApi();
});

describe('<Main> — sync status + diagnostics', () => {
  it('paints the TopNav sync pill with the report worst severity', async () => {
    setupRoute('error');
    renderWithShell(<Main onOpenSettings={() => undefined} />);

    const pill = await screen.findByTestId('status-pill-sync');
    expect(pill).toHaveAttribute('data-variant', 'error');
  });

  it('navigates to Diagnóstico from the TopNav', async () => {
    setupRoute('ok');
    renderWithShell(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('nav-diagnostico'));

    expect(await screen.findByTestId('health-screen')).toBeInTheDocument();
  });
});
