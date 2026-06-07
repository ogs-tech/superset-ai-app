import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMcpList, mcpListQueryKey } from '../../../src/renderer/hooks/use-mcp-list.js';
import type { McpServer } from '../../../src/shared/mcp.js';
import { mockApi, ok, makeTestQueryClient, type CallSpy } from '../test-utils.js';

const server: McpServer = {
  id: 'id1', name: 'pencil', transport: 'stdio', def: { command: 'x' },
  scope: 'global', source: { kind: 'workspace' }, enabled: true,
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = makeTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMcpList', () => {
  it('has a stable query key', () => {
    expect(mcpListQueryKey()).toEqual(['mcp', 'list']);
  });

  it('fetches the server list', async () => {
    call.mockResolvedValue(ok([server]));
    const { result } = renderHook(() => useMcpList(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([server]));
    expect(call).toHaveBeenCalledWith('mcp.list', {});
  });
});
