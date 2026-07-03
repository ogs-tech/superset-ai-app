import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useSyncThenRefresh } from '../../../src/renderer/hooks/use-sync-then-refresh.js';
import { healthQueryKey } from '../../../src/renderer/hooks/use-health-report.js';
import { mockApi, ok, makeTestQueryClient, type CallSpy } from '../test-utils.js';
import type { SyncResult } from '../../../src/shared/sync-result.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const wrapper = (client = makeTestQueryClient()) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
};

describe('useSyncThenRefresh', () => {
  it('calls adapter.syncAll and returns the SyncResult[]', async () => {
    const results: SyncResult[] = [
      { adapter: 'claude', destination: '/a', status: 'ok' },
      { adapter: 'claude', destination: '/b', status: 'conflict', details: { backupPath: '/b.bak' } },
    ];
    call.mockResolvedValueOnce(ok(results));

    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useSyncThenRefresh('personal'), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(call).toHaveBeenCalledWith('adapter.syncAll', {});
    expect(result.current.data).toEqual(results);
  });

  it('invalidates the health query after a successful sync', async () => {
    call.mockResolvedValueOnce(ok([]));
    const { Wrapper, client } = wrapper();
    let invalidated: readonly unknown[] | null = null;
    const original = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((filters: { queryKey: readonly unknown[] }) => {
      invalidated = filters.queryKey;
      return original(filters);
    }) as typeof client.invalidateQueries;

    const { result } = renderHook(() => useSyncThenRefresh('personal'), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidated).toEqual(healthQueryKey('personal'));
  });
});
