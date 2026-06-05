import { describe, expect, it } from 'vitest';
import { worstSeverity, countBySeverity } from '../../../src/main/domain/health.js';
import type { HealthCheck } from '../../../src/shared/health.js';

const check = (severity: HealthCheck['severity']): HealthCheck => ({
  id: `id-${severity}`,
  category: 'mcp-auth',
  severity,
  title: 't',
  observedAt: '2026-06-05T00:00:00.000Z',
});

describe('worstSeverity', () => {
  it('returns ok for an empty list', () => {
    expect(worstSeverity([])).toBe('ok');
  });

  it('returns the highest-ranked severity present', () => {
    expect(worstSeverity(['ok', 'warning', 'ok'])).toBe('warning');
    expect(worstSeverity(['warning', 'error', 'ok'])).toBe('error');
    expect(worstSeverity(['ok', 'ok'])).toBe('ok');
  });
});

describe('countBySeverity', () => {
  it('counts checks per severity', () => {
    const checks = [check('ok'), check('ok'), check('warning'), check('error')];
    expect(countBySeverity(checks)).toEqual({ ok: 2, warning: 1, error: 1 });
  });

  it('returns all-zero counts for an empty list', () => {
    expect(countBySeverity([])).toEqual({ ok: 0, warning: 0, error: 0 });
  });
});
