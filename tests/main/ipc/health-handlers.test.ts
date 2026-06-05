import { describe, expect, it, vi } from 'vitest';
import { buildHealthHandlers } from '../../../src/main/ipc/health-handlers.js';
import type { HealthService } from '../../../src/main/application/services/health/health-service.js';
import type { NotificationPort } from '../../../src/main/application/ports/notification-port.js';
import type { HealthReport } from '../../../src/shared/health.js';

const report: HealthReport = {
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: 'ok',
  counts: { ok: 0, warning: 0, error: 0 },
  checks: [],
};

const setup = () => {
  const getReport = vi.fn().mockResolvedValue(report);
  const notify = vi.fn().mockResolvedValue(undefined);
  const handlers = buildHealthHandlers(
    { getReport } as unknown as HealthService,
    { notify } as NotificationPort,
  );
  return { handlers, getReport, notify };
};

describe('health.getReport handler', () => {
  it('passes the validated scope through to the service', async () => {
    const { handlers, getReport } = setup();
    const result = await handlers['health.getReport']!({ scope: 'project' });
    expect(getReport).toHaveBeenCalledWith('project');
    expect(result).toEqual(report);
  });

  it('defaults scope to personal when absent', async () => {
    const { handlers, getReport } = setup();
    await handlers['health.getReport']!({});
    expect(getReport).toHaveBeenCalledWith('personal');
  });

  it('rejects an invalid scope', async () => {
    const { handlers } = setup();
    await expect(handlers['health.getReport']!({ scope: 'nope' })).rejects.toThrow();
  });
});

describe('health.notify handler', () => {
  it('forwards a validated title and body to the notification port', async () => {
    const { handlers, notify } = setup();
    await handlers['health.notify']!({ title: 'T', body: 'B' });
    expect(notify).toHaveBeenCalledWith({ title: 'T', body: 'B' });
  });

  it('rejects when title is missing', async () => {
    const { handlers } = setup();
    await expect(handlers['health.notify']!({ body: 'B' })).rejects.toThrow();
  });
});
