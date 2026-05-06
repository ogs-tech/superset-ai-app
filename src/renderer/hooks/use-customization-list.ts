import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { CustomizationType } from '../../shared/customization.js';

export interface CustomizationListItem {
  id: string;
  frontmatter: { name: string; description?: string } & Record<string, unknown>;
  body: string;
  source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string };
}

export function customizationQueryKey(
  type: CustomizationType,
): readonly unknown[] {
  return ['customization', type, 'personal'] as const;
}

export function useCustomizationList(
  type: CustomizationType,
  listMethod: string,
) {
  return useQuery<CustomizationListItem[]>({
    queryKey: customizationQueryKey(type),
    queryFn: async () => {
      const list = await callIpc<CustomizationListItem[]>(listMethod, {
        scope: 'personal',
      });
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useInvalidateCustomization() {
  const qc = useQueryClient();
  return (type: CustomizationType): Promise<void> =>
    qc.invalidateQueries({ queryKey: customizationQueryKey(type) });
}
