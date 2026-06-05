import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHealthNotifications } from '../../../src/renderer/hooks/use-health-notifications.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

let call: CallSpy;

const reportWithErrors = (ids: string[]): HealthReport => ({
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: ids.length > 0 ? 'error' : 'ok',
  counts: { ok: 0, warning: 0, error: ids.length },
  checks: ids.map((id) => ({
    id,
    category: 'symlink',
    severity: 'error',
    title: `Problem ${id}`,
    observedAt: '2026-06-05T10:00:00.000Z',
  })),
});

beforeEach(() => {
  call = mockApi();
  call.mockResolvedValue(ok(undefined));
});

describe('useHealthNotifications', () => {
  it('does not notify on the first report (priming)', () => {
    renderHook(({ report }) => useHealthNotifications(report), {
      initialProps: { report: reportWithErrors(['e1']) },
    });
    expect(call).not.toHaveBeenCalled();
  });

  it('notifies when a NEW error id appears after priming', () => {
    const { rerender } = renderHook(({ report }) => useHealthNotifications(report), {
      initialProps: { report: reportWithErrors(['e1']) as HealthReport | undefined },
    });

    rerender({ report: reportWithErrors(['e1', 'e2']) });

    expect(call).toHaveBeenCalledTimes(1);
    const [method, params] = call.mock.calls[0]!;
    expect(method).toBe('health.notify');
    expect(params).toMatchObject({
      title: expect.any(String),
      body: expect.stringContaining('e2'),
    });
  });

  it('does not re-notify for an error id already seen', () => {
    const { rerender } = renderHook(({ report }) => useHealthNotifications(report), {
      initialProps: { report: reportWithErrors(['e1']) as HealthReport | undefined },
    });
    rerender({ report: reportWithErrors(['e1', 'e2']) });
    call.mockClear();
    rerender({ report: reportWithErrors(['e1', 'e2']) });
    expect(call).not.toHaveBeenCalled();
  });
});
