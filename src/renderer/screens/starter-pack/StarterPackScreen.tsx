import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { SidebarTab } from '../../components/Sidebar.js';
import { PluginInstallPreviewDialog } from '../marketplaces/PluginInstallPreviewDialog.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { EntityDataGrid } from '../../components/EntityDataGrid/index.js';
import type { EntityDef } from '../../components/EntityDataGrid/index.js';

interface MarketplacePlugin {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: unknown;
}

type InstallState = 'idle' | 'loading' | 'done';

const OFFICIAL_REPO = 'anthropics/claude-plugins-official';

export const RECOMMENDED_PLUGIN_NAMES = new Set([
  'feature-dev',
  'code-review',
  'pr-review-toolkit',
  'code-simplifier',
  'code-modernization',
  'frontend-design',
  'commit-commands',
  'claude-code-setup',
  'claude-md-management',
  'hookify',
  'agent-sdk-dev',
  'mcp-server-dev',
  'plugin-dev',
  'example-plugin',
  'explanatory-output-style',
  'learning-output-style',
  'ralph-loop',
  'playground',
  'pyright-lsp',
  'gopls-lsp',
  'clangd-lsp',
  'csharp-lsp',
  'jdtls-lsp',
  'kotlin-lsp',
  'php-lsp',
  'lua-lsp',
  'github',
  'gitlab',
  'linear',
  'atlassian',
  'figma',
  'playwright',
  'context7',
  'greptile',
  'serena',
]);

interface StarterPackScreenProps {
  onNavigate: (tab: SidebarTab) => void;
}

interface StarterData {
  profileConfigured: boolean | null;
  plugins: MarketplacePlugin[];
  marketplaceId: string | null;
  installedIds: Set<string>;
}

const STARTER_QUERY_KEY = ['starter-pack'] as const;

export function StarterPackScreen({
  onNavigate,
}: StarterPackScreenProps): React.ReactElement {
  const [installStates, setInstallStates] = useState<
    Record<string, InstallState>
  >({});
  const [previewPlugin, setPreviewPlugin] = useState<MarketplacePlugin | null>(
    null,
  );
  const [installingAll, setInstallingAll] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const { data, isLoading } = useQuery<StarterData>({
    queryKey: STARTER_QUERY_KEY,
    queryFn: async () => {
      const [marketplaceList, installedPlugins, gi] = await Promise.all([
        callIpc<
          Array<{
            id: string;
            source: { kind: string; repo?: string };
            manifest?: { plugins: MarketplacePlugin[] };
          }>
        >('marketplace.list', { scope: 'personal' }),
        callIpc<Array<{ id: string }>>('plugin.list', { scope: 'personal' }),
        callIpc('global-instruction.get', { id: 'default' }).then(
          () => true,
          (err: unknown) => {
            if (err instanceof IpcCallError && err.kind === 'not_found')
              return false;
            return null;
          },
        ),
      ]);

      const official = marketplaceList.find(
        (m) => m.source.kind === 'github' && m.source.repo === OFFICIAL_REPO,
      );
      const installedIds = new Set(installedPlugins.map((p) => p.id));
      const recommended =
        official?.manifest?.plugins.filter((p) =>
          RECOMMENDED_PLUGIN_NAMES.has(p.name),
        ) ?? [];

      const initial: Record<string, InstallState> = {};
      for (const p of recommended) {
        if (installedIds.has(p.name)) initial[p.name] = 'done';
      }
      setInstallStates((prev) => ({ ...initial, ...prev }));

      return {
        profileConfigured: gi as boolean | null,
        plugins: recommended,
        marketplaceId: official?.id ?? null,
        installedIds,
      };
    },
  });

  const plugins = data?.plugins ?? [];
  const marketplaceId = data?.marketplaceId ?? null;
  const profileConfigured = data?.profileConfigured ?? null;

  const handleConfirmInstall = async (): Promise<void> => {
    if (!previewPlugin) return;
    const plugin = previewPlugin;
    setInstallStates((s) => ({ ...s, [plugin.name]: 'loading' }));
    try {
      const params: Record<string, unknown> = { plugin, scope: 'personal' };
      if (marketplaceId) params['marketplaceId'] = marketplaceId;
      await callIpc('plugin.installFromMarketplace', params);
      setInstallStates((s) => ({ ...s, [plugin.name]: 'done' }));
      setToast({ variant: 'success', message: `${plugin.name} installed` });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setInstallStates((s) => ({ ...s, [plugin.name]: 'idle' }));
      setToast({ variant: 'error', message });
    } finally {
      setPreviewPlugin(null);
    }
  };

  const handleInstallAll = async (): Promise<void> => {
    const pending = plugins.filter(
      (p) => (installStates[p.name] ?? 'idle') === 'idle',
    );
    if (pending.length === 0) return;
    setInstallingAll(true);
    let failed = 0;
    for (const plugin of pending) {
      setInstallStates((s) => ({ ...s, [plugin.name]: 'loading' }));
      try {
        const params: Record<string, unknown> = { plugin, scope: 'personal' };
        if (marketplaceId) params['marketplaceId'] = marketplaceId;
        await callIpc('plugin.installFromMarketplace', params);
        setInstallStates((s) => ({ ...s, [plugin.name]: 'done' }));
      } catch {
        setInstallStates((s) => ({ ...s, [plugin.name]: 'idle' }));
        failed++;
      }
    }
    setInstallingAll(false);
    if (failed > 0) {
      setToast({
        variant: 'error',
        message: `${failed} plugin(s) failed to install`,
      });
    } else {
      setToast({ variant: 'success', message: `All plugins installed` });
    }
  };

  const installedCount = plugins.filter(
    (p) => installStates[p.name] === 'done',
  ).length;
  const totalCount = plugins.length;
  const progress = totalCount > 0 ? (installedCount / totalCount) * 100 : 0;
  const pendingCount = plugins.filter(
    (p) => (installStates[p.name] ?? 'idle') === 'idle',
  ).length;

  const entity: EntityDef<MarketplacePlugin> = {
    name: 'starter-plugin',
    pluralName: 'plugins',
    getKey: (item) => item.name,
    fields: [
      {
        key: 'name',
        label: 'Name',
        primary: true,
        searchable: true,
      },
      {
        key: 'category',
        label: 'Category',
        badge: true,
        searchable: true,
      },
      {
        key: 'description',
        label: 'Description',
        secondary: true,
        searchable: true,
      },
      {
        key: 'author.name',
        label: 'Author',
        searchable: true,
        render: (item) => (item.author?.name ? `by ${item.author.name}` : ''),
      },
    ],
  };

  return (
    <Container
      component="main"
      data-testid="starter-pack-screen"
      maxWidth="lg"
      sx={{ py: 2.5 }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 4 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2b5cff',
            backgroundColor: '#2b5cff1a',
          }}
        >
          <RocketLaunchIcon />
        </Box>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, lineHeight: 1.2 }}
          >
            SDE Starter Pack
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Get your SDE environment ready in minutes
          </Typography>
        </Box>
      </Stack>

      <Paper
        variant="outlined"
        data-testid="starter-pack-profile-card"
        sx={{
          p: 2.5,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            SDE Profile
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Global instructions tailored for software engineers
          </Typography>
        </Box>
        {profileConfigured === null ? (
          <Chip label="Checking…" size="small" />
        ) : profileConfigured ? (
          <Chip
            label="Configured"
            color="success"
            size="small"
            icon={<CheckCircleIcon fontSize="small" />}
          />
        ) : (
          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardIcon />}
            onClick={() => onNavigate('global-instructions')}
          >
            Configure
          </Button>
        )}
      </Paper>

      {!isLoading && totalCount > 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Plugin progress
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {installedCount} of {totalCount} installed
              </Typography>
              {pendingCount > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  disabled={installingAll}
                  onClick={() => void handleInstallAll()}
                >
                  {installingAll
                    ? 'Installing…'
                    : `Install All (${pendingCount})`}
                </Button>
              )}
            </Stack>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Paper>
      )}

      {!isLoading && plugins.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Add the official marketplace to discover SDE plugins.
          </Typography>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon />}
            onClick={() => onNavigate('marketplaces')}
          >
            Browse marketplaces
          </Button>
        </Paper>
      ) : (
        <>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            Recommended plugins
          </Typography>
          <EntityDataGrid<MarketplacePlugin>
            entity={entity}
            data={plugins}
            isLoading={isLoading}
            searchPlaceholder="Search plugins…"
            cardSlots={{
              footer: (item) => {
                const state = installStates[item.name] ?? 'idle';
                return (
                  <Button
                    size="small"
                    variant={state === 'done' ? 'outlined' : 'contained'}
                    disabled={state !== 'idle'}
                    onClick={() => setPreviewPlugin(item)}
                    data-testid={`starter-plugin-install-${item.name}`}
                    sx={{ minWidth: 92 }}
                  >
                    {state === 'done'
                      ? 'Installed'
                      : state === 'loading'
                        ? 'Installing…'
                        : 'Install'}
                  </Button>
                );
              },
            }}
          />

          <Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => onNavigate('marketplaces')}
            >
              Browse all marketplaces
            </Button>
          </Stack>
        </>
      )}

      <PluginInstallPreviewDialog
        open={previewPlugin !== null}
        plugin={previewPlugin}
        installing={
          previewPlugin !== null &&
          installStates[previewPlugin.name] === 'loading'
        }
        onCancel={() => setPreviewPlugin(null)}
        onConfirm={() => void handleConfirmInstall()}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
