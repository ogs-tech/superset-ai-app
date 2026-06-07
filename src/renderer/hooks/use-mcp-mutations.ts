import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import { mcpListQueryKey } from './use-mcp-list.js';
import type { McpServerInput } from '../../shared/mcp.js';

export function useSaveMcp(): UseMutationResult<{ ok: true }, Error, { server: McpServerInput; isCreate?: boolean }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => callIpc<{ ok: true }>('mcp.save', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpListQueryKey() }),
  });
}

export function useDeleteMcp(): UseMutationResult<{ ok: true }, Error, { id: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => callIpc<{ ok: true }>('mcp.delete', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpListQueryKey() }),
  });
}

export function useSetMcpEnabled(): UseMutationResult<{ ok: true }, Error, { id: string; enabled: boolean }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => callIpc<{ ok: true }>('mcp.setEnabled', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpListQueryKey() }),
  });
}
