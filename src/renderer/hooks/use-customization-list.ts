import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { Entity, EntityKind, Scope } from '../../shared/entity.js';

export function entityQueryKey(kind: EntityKind, scope: Scope = 'personal'): readonly unknown[] {
  return ['entity', kind, scope] as const;
}

export function useCustomizationList(kind: EntityKind, listMethod: string, scope: Scope = 'personal') {
  return useQuery<Entity[]>({
    queryKey: entityQueryKey(kind, scope),
    queryFn: async () => {
      const list = await callIpc<Entity[]>(listMethod, { scope });
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useInvalidateCustomization() {
  const qc = useQueryClient();
  return (kind: EntityKind, scope: Scope = 'personal'): Promise<void> =>
    qc.invalidateQueries({ queryKey: entityQueryKey(kind, scope) });
}
