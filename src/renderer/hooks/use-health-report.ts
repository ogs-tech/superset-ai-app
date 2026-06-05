import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { HealthReport } from '../../shared/health.js';

export type HealthScope = 'personal' | 'project';

export const HEALTH_POLL_INTERVAL_MS = 30_000;

export function healthQueryKey(scope: HealthScope = 'personal'): readonly unknown[] {
  return ['health', scope] as const;
}

export function useHealthReport(scope: HealthScope = 'personal'): UseQueryResult<HealthReport> {
  return useQuery<HealthReport>({
    queryKey: healthQueryKey(scope),
    queryFn: () => callIpc<HealthReport>('health.getReport', { scope }),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
  });
}
