import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthScreen } from '../../../../src/renderer/screens/health/HealthScreen.js';
import type { HealthReport } from '../../../../src/shared/health.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

const reportWith = (checks: HealthReport['checks']): HealthReport => ({
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: checks.some((c) => c.severity === 'error')
    ? 'error'
    : checks.some((c) => c.severity === 'warning')
      ? 'warning'
      : 'ok',
  counts: {
    ok: checks.filter((c) => c.severity === 'ok').length,
    warning: checks.filter((c) => c.severity === 'warning').length,
    error: checks.filter((c) => c.severity === 'error').length,
  },
  checks,
});

beforeEach(() => {
  call = mockApi();
});

describe('<HealthScreen>', () => {
  it('shows an all-clear state when there are no warning/error checks', async () => {
    call.mockResolvedValue(ok(reportWith([])));
    renderWithQuery(<HealthScreen />);
    expect(await screen.findByTestId('health-screen')).toBeInTheDocument();
    expect(await screen.findByTestId('health-all-clear')).toBeInTheDocument();
  });

  it('groups checks by category and renders severity chips', async () => {
    call.mockResolvedValue(
      ok(
        reportWith([
          {
            id: 'mcp-auth:Gmail',
            category: 'mcp-auth',
            severity: 'warning',
            title: 'MCP "Gmail" needs authentication',
            target: 'Gmail',
            remediation: 'Run /mcp in Claude Code to authenticate.',
            observedAt: '2026-06-05T10:00:00.000Z',
          },
          {
            id: 'symlink:claude:/x',
            category: 'symlink',
            severity: 'error',
            title: 'Symlink missing: /x',
            target: '/x',
            observedAt: '2026-06-05T10:00:00.000Z',
          },
        ]),
      ),
    );

    renderWithQuery(<HealthScreen />);

    expect(await screen.findByTestId('health-category-mcp-auth')).toBeInTheDocument();
    expect(screen.getByTestId('health-category-symlink')).toBeInTheDocument();
    expect(screen.getByText('MCP "Gmail" needs authentication')).toBeInTheDocument();
    expect(screen.getByText('Run /mcp in Claude Code to authenticate.')).toBeInTheDocument();
  });

  it('refetches when Refresh is clicked', async () => {
    call.mockResolvedValue(ok(reportWith([])));
    renderWithQuery(<HealthScreen />);
    await screen.findByTestId('health-screen');

    call.mockClear();
    await userEvent.click(screen.getByTestId('health-refresh'));

    expect(call).toHaveBeenCalledWith('health.getReport', { scope: 'personal' });
  });
});
