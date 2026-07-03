import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import { healthQueryKey, type HealthScope } from './use-health-report.js';
import type { SyncResult } from '../../shared/sync-result.js';

/**
 * Runs the outbound symlink sync (`adapter.syncAll`) then invalidates the
 * health query so the Diagnostics report reflects the freshly reconciled
 * `~/.claude/`. The sync write is surfaced via the returned `SyncResult[]`
 * (see HealthScreen summary) — never silent.
 */
export function useSyncThenRefresh(
  scope: HealthScope = 'personal',
): UseMutationResult<SyncResult[], unknown, void> {
  const qc = useQueryClient();
  return useMutation<SyncResult[], unknown, void>({
    mutationFn: () => callIpc<SyncResult[]>('adapter.syncAll', {}),
    onSettled: async () => {
      // Refresh even on partial/total failure — the report must reflect reality.
      await qc.invalidateQueries({ queryKey: healthQueryKey(scope) });
    },
  });
}
