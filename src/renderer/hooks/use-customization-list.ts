import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { CustomizationType } from '../../shared/customization.js';

export interface CustomizationListItem {
  id: string;
  frontmatter: { name: string; description?: string } & Record<string, unknown>;
  body: string;
  source:
    | { kind: 'workspace' }
    | {
        kind: 'plugin';
        pluginId: string;
        provenance?: 'workspace-managed' | 'claude-code';
      };
}

export type CustomizationScope = 'personal' | 'project';

export function customizationQueryKey(
  type: CustomizationType,
  scope: CustomizationScope = 'personal',
): readonly unknown[] {
  return ['customization', type, scope] as const;
}

export function useCustomizationList(
  type: CustomizationType,
  listMethod: string,
  scope: CustomizationScope = 'personal',
) {
  return useQuery<CustomizationListItem[]>({
    queryKey: customizationQueryKey(type, scope),
    queryFn: async () => {
      const list = await callIpc<CustomizationListItem[]>(listMethod, {
        scope,
      });
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useInvalidateCustomization() {
  const qc = useQueryClient();
  return (
    type: CustomizationType,
    scope: CustomizationScope = 'personal',
  ): Promise<void> =>
    qc.invalidateQueries({ queryKey: customizationQueryKey(type, scope) });
}
