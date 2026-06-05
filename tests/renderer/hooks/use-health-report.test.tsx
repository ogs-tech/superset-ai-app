import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useHealthReport, healthQueryKey } from '../../../src/renderer/hooks/use-health-report.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, makeTestQueryClient, type CallSpy } from '../test-utils.js';

let call: CallSpy;

const report: HealthReport = {
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: 'warning',
  counts: { ok: 1, warning: 1, error: 0 },
  checks: [],
};

beforeEach(() => {
  call = mockApi();
});

describe('useHealthReport', () => {
  it('builds a stable query key per scope', () => {
    expect(healthQueryKey('personal')).toEqual(['health', 'personal']);
  });

  it('calls health.getReport with the scope and returns the report', async () => {
    call.mockResolvedValue(ok(report));
    const client = makeTestQueryClient();

    const { result } = renderHook(() => useHealthReport('personal'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.data).toEqual(report));
    expect(call).toHaveBeenCalledWith('health.getReport', { scope: 'personal' });
  });
});
