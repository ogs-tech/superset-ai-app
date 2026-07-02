import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import {
  OFFICIAL_REPO,
  RECOMMENDED_PLUGIN_NAMES,
  type MarketplacePlugin,
} from '../screens/starter-pack/groups.js';

export type InstallState = 'idle' | 'loading' | 'done' | 'disabled';

export interface StarterData {
  profileConfigured: boolean | null;
  plugins: MarketplacePlugin[];
  marketplaceId: string | null;
  /** Installed AND enabled — these read as "done". */
  installedIds: ReadonlySet<string>;
  /** Installed but disabled — these read as "disabled" and offer a re-enable action. */
  disabledIds: ReadonlySet<string>;
}

export interface InstallResult {
  failed: number;
  lastError?: string;
}

export interface UseStarterPack {
  isLoading: boolean;
  profileConfigured: boolean | null;
  plugins: MarketplacePlugin[];
  stateFor: (pluginName: string) => InstallState;
  install: (plugins: MarketplacePlugin[]) => Promise<InstallResult>;
  reenable: (pluginName: string) => Promise<void>;
}

export const STARTER_QUERY_KEY = ['starter-pack'] as const;
const INSTALLING_KEY = ['starter-pack', 'installing'] as const;
const EMPTY_SET: ReadonlySet<string> = new Set();

interface MarketplaceListItem {
  id: string;
  source: { kind: string; repo?: string };
  manifest?: { plugins: MarketplacePlugin[] };
}

/** Pure data fetch — no side effects, so a warm react-query cache stays correct. */
async function fetchStarterData(): Promise<StarterData> {
  const [marketplaceList, installedPlugins, gi] = await Promise.all([
    callIpc<MarketplaceListItem[]>('marketplace.list', { scope: 'personal' }),
    callIpc<Array<{ id: string; enabled: boolean }>>('plugin.list', { scope: 'personal' }),
    callIpc('instruction.get', { id: 'default' }).then(
      () => true,
      (err: unknown) => {
        if (err instanceof IpcCallError && err.kind === 'not_found') return false;
        return null;
      },
    ),
  ]);

  const official = marketplaceList.find(
    (m) => m.source.kind === 'github' && m.source.repo === OFFICIAL_REPO,
  );
  // Only enabled plugins read as "installed"; a disabled one becomes actionable
  // again (re-enable) instead of staying marked done.
  const installedIds = new Set(installedPlugins.filter((p) => p.enabled).map((p) => p.id));
  const disabledIds = new Set(installedPlugins.filter((p) => !p.enabled).map((p) => p.id));
  const plugins =
    official?.manifest?.plugins.filter((p) => RECOMMENDED_PLUGIN_NAMES.has(p.name)) ?? [];

  return {
    profileConfigured: gi as boolean | null,
    plugins,
    marketplaceId: official?.id ?? null,
    installedIds,
    disabledIds,
  };
}

function withName(set: ReadonlySet<string>, name: string): ReadonlySet<string> {
  const next = new Set(set);
  next.add(name);
  return next;
}

function withoutName(set: ReadonlySet<string>, name: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(name);
  return next;
}

/**
 * Drives installs through the query cache rather than component state. Because
 * `qc` is the app-level client, this keeps running and keeps mutating the cache
 * even if the screen unmounts mid-install (e.g. the user switches tabs).
 */
async function runInstall(
  qc: QueryClient,
  marketplaceId: string | null,
  plugins: MarketplacePlugin[],
): Promise<InstallResult> {
  let failed = 0;
  let lastError: string | undefined;

  for (const plugin of plugins) {
    qc.setQueryData<ReadonlySet<string>>(INSTALLING_KEY, (s) =>
      withName(s ?? EMPTY_SET, plugin.name),
    );
    try {
      const params: Record<string, unknown> = { plugin, scope: 'personal' };
      if (marketplaceId) params['marketplaceId'] = marketplaceId;
      await callIpc('plugin.installFromMarketplace', params);
      // Optimistically fold the install into server truth so the card flips to
      // "done" with no flicker — survives an unmount because it is cache state.
      qc.setQueryData<StarterData>(STARTER_QUERY_KEY, (prev) =>
        prev ? { ...prev, installedIds: withName(prev.installedIds, plugin.name) } : prev,
      );
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      qc.setQueryData<ReadonlySet<string>>(INSTALLING_KEY, (s) =>
        withoutName(s ?? EMPTY_SET, plugin.name),
      );
    }
  }

  // Reconcile the optimistic state against the server once the batch settles.
  await qc.invalidateQueries({ queryKey: STARTER_QUERY_KEY });
  return lastError != null ? { failed, lastError } : { failed };
}

export function useStarterPack(): UseStarterPack {
  const qc = useQueryClient();

  const query = useQuery<StarterData>({
    queryKey: STARTER_QUERY_KEY,
    queryFn: fetchStarterData,
  });

  // A writable client-cache "store" for in-flight installs. Keeping it in the
  // query cache (above the screen) is what lets the loading state survive
  // navigation — local useState would reset on unmount.
  const { data: installing = EMPTY_SET } = useQuery<ReadonlySet<string>>({
    queryKey: INSTALLING_KEY,
    queryFn: () => EMPTY_SET,
    initialData: EMPTY_SET,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const installedIds = query.data?.installedIds ?? EMPTY_SET;
  const disabledIds = query.data?.disabledIds ?? EMPTY_SET;

  const stateFor = (pluginName: string): InstallState =>
    installing.has(pluginName)
      ? 'loading'
      : installedIds.has(pluginName)
        ? 'done'
        : disabledIds.has(pluginName)
          ? 'disabled'
          : 'idle';

  const install = (plugins: MarketplacePlugin[]): Promise<InstallResult> =>
    runInstall(qc, query.data?.marketplaceId ?? null, plugins);

  const reenable = async (pluginName: string): Promise<void> => {
    await callIpc('plugin.toggle', { id: pluginName, scope: 'personal', enabled: true });
    await qc.invalidateQueries({ queryKey: STARTER_QUERY_KEY });
  };

  return {
    isLoading: query.isLoading,
    profileConfigured: query.data?.profileConfigured ?? null,
    plugins: query.data?.plugins ?? [],
    stateFor,
    install,
    reenable,
  };
}
