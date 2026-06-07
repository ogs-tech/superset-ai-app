import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { McpServer } from '../../shared/mcp.js';

export function mcpListQueryKey(): readonly unknown[] {
  return ['mcp', 'list'] as const;
}

export function useMcpList(): UseQueryResult<McpServer[]> {
  return useQuery<McpServer[]>({
    queryKey: mcpListQueryKey(),
    queryFn: () => callIpc<McpServer[]>('mcp.list', {}),
  });
}
