import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Container,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';
import TuneIcon from '@mui/icons-material/Tune';
import ExtensionIcon from '@mui/icons-material/Extension';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DataObjectIcon from '@mui/icons-material/DataObject';
import HubIcon from '@mui/icons-material/Hub';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { SidebarTab } from '../../components/Sidebar.js';
import { PluginInstallPreviewDialog } from '../marketplaces/PluginInstallPreviewDialog.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';

interface MarketplacePlugin {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: unknown;
}

type InstallState = 'idle' | 'loading' | 'done';

const OFFICIAL_REPO = 'anthropics/claude-plugins-official';

/**
 * The starter pack is organized into curated groups so the user installs only
 * the slices they want — never everything in one click. Ordering within a group
 * follows the `plugins` array order. Long/optional groups default to collapsed.
 */
interface StarterGroup {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  plugins: string[];
  defaultCollapsed?: boolean;
}

export const STARTER_PACK_GROUPS: StarterGroup[] = [
  {
    id: 'core-dev',
    label: 'Core dev workflow',
    description: 'The everyday loop — build, review, refactor, ship.',
    icon: <TerminalIcon />,
    accent: '#2b5cff',
    plugins: [
      'feature-dev',
      'superpowers',
      'code-review',
      'pr-review-toolkit',
      'code-simplifier',
      'code-modernization',
      'frontend-design',
      'commit-commands',
    ],
  },
  {
    id: 'claude-setup',
    label: 'Claude Code setup',
    description: 'Tune Claude Code itself — config, memory, and guardrails.',
    icon: <TuneIcon />,
    accent: '#6f42c1',
    plugins: ['claude-code-setup', 'claude-md-management', 'hookify'],
  },
  {
    id: 'build-for-claude',
    label: 'Build for Claude',
    description: 'Author your own plugins, agents, and MCP servers.',
    icon: <ExtensionIcon />,
    accent: '#0a7d6b',
    plugins: [
      'agent-sdk-dev',
      'mcp-server-dev',
      'plugin-dev',
      'example-plugin',
      'ralph-loop',
      'playground',
    ],
  },
  {
    id: 'output-styles',
    label: 'Output styles',
    description: 'Change how Claude explains and teaches as it works.',
    icon: <AutoAwesomeIcon />,
    accent: '#c9760a',
    plugins: ['explanatory-output-style', 'learning-output-style'],
  },
  {
    id: 'language-servers',
    label: 'Language servers',
    description: 'Per-language LSPs — add only the ones you code in.',
    icon: <DataObjectIcon />,
    accent: '#2e7d32',
    defaultCollapsed: true,
    plugins: [
      'pyright-lsp',
      'gopls-lsp',
      'clangd-lsp',
      'csharp-lsp',
      'jdtls-lsp',
      'kotlin-lsp',
      'php-lsp',
      'lua-lsp',
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connect external tools and services via MCP.',
    icon: <HubIcon />,
    accent: '#c2255c',
    defaultCollapsed: true,
    plugins: [
      'github',
      'gitlab',
      'linear',
      'atlassian',
      'figma',
      'playwright',
      'context7',
      'greptile',
      'serena',
    ],
  },
];

export const RECOMMENDED_PLUGIN_NAMES = new Set(STARTER_PACK_GROUPS.flatMap((g) => g.plugins));

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

export function StarterPackScreen({ onNavigate }: StarterPackScreenProps): React.ReactElement {
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
  const [previewPlugin, setPreviewPlugin] = useState<MarketplacePlugin | null>(null);
  const [installingGroups, setInstallingGroups] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STARTER_PACK_GROUPS.map((g) => [g.id, Boolean(g.defaultCollapsed)])),
  );
  const [search, setSearch] = useState('');
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
            if (err instanceof IpcCallError && err.kind === 'not_found') return false;
            return null;
          },
        ),
      ]);

      const official = marketplaceList.find(
        (m) => m.source.kind === 'github' && m.source.repo === OFFICIAL_REPO,
      );
      const installedIds = new Set(installedPlugins.map((p) => p.id));
      const recommended =
        official?.manifest?.plugins.filter((p) => RECOMMENDED_PLUGIN_NAMES.has(p.name)) ?? [];

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

  const installPlugins = async (
    list: MarketplacePlugin[],
  ): Promise<{ failed: number; lastError?: string }> => {
    let failed = 0;
    let lastError: string | undefined;
    for (const plugin of list) {
      setInstallStates((s) => ({ ...s, [plugin.name]: 'loading' }));
      try {
        const params: Record<string, unknown> = { plugin, scope: 'personal' };
        if (marketplaceId) params['marketplaceId'] = marketplaceId;
        await callIpc('plugin.installFromMarketplace', params);
        setInstallStates((s) => ({ ...s, [plugin.name]: 'done' }));
      } catch (err) {
        setInstallStates((s) => ({ ...s, [plugin.name]: 'idle' }));
        failed++;
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    return lastError != null ? { failed, lastError } : { failed };
  };

  const handleConfirmInstall = async (): Promise<void> => {
    if (!previewPlugin) return;
    const plugin = previewPlugin;
    try {
      const { failed, lastError } = await installPlugins([plugin]);
      if (failed > 0) {
        setToast({
          variant: 'error',
          message: lastError
            ? `${plugin.name} failed to install — ${lastError}`
            : `${plugin.name} failed to install`,
        });
      } else {
        setToast({ variant: 'success', message: `${plugin.name} installed` });
      }
    } finally {
      setPreviewPlugin(null);
    }
  };

  const handleInstallGroup = async (
    group: StarterGroup,
    groupPlugins: MarketplacePlugin[],
  ): Promise<void> => {
    const pending = groupPlugins.filter((p) => (installStates[p.name] ?? 'idle') === 'idle');
    if (pending.length === 0) return;
    setInstallingGroups((s) => new Set(s).add(group.id));
    const { failed, lastError } = await installPlugins(pending);
    setInstallingGroups((s) => {
      const next = new Set(s);
      next.delete(group.id);
      return next;
    });
    if (failed > 0) {
      setToast({
        variant: 'error',
        message: lastError
          ? `${failed} plugin(s) in ${group.label} failed to install — ${lastError}`
          : `${failed} plugin(s) in ${group.label} failed to install`,
      });
    } else {
      setToast({ variant: 'success', message: `${group.label} installed` });
    }
  };

  const installedCount = plugins.filter((p) => installStates[p.name] === 'done').length;
  const totalCount = plugins.length;
  const progress = totalCount > 0 ? (installedCount / totalCount) * 100 : 0;

  const query = search.trim().toLowerCase();
  const matchesSearch = (p: MarketplacePlugin): boolean =>
    !query ||
    p.name.toLowerCase().includes(query) ||
    (p.description?.toLowerCase().includes(query) ?? false) ||
    (p.category?.toLowerCase().includes(query) ?? false);

  const grouped = STARTER_PACK_GROUPS.map((group) => {
    const order = new Map(group.plugins.map((name, i) => [name, i]));
    const items = plugins
      .filter((p) => order.has(p.name) && matchesSearch(p))
      .sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
    return { group, items };
  }).filter((g) => g.items.length > 0);

  return (
    <Container
      component="main"
      data-testid="starter-pack-screen"
      maxWidth="lg"
      sx={{
        py: 2.5,
        '@keyframes starterFadeIn': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
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
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
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
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { sm: 'center' },
              mb: 1.5,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Recommended plugins
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Install one group at a time — {installedCount} of {totalCount} installed
              </Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Search plugins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { 'data-testid': 'starter-pack-search' },
              }}
              sx={{ minWidth: { sm: 240 } }}
            />
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
      ) : grouped.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No plugins match “{search}”.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {grouped.map(({ group, items }, index) => {
            const groupDone = items.filter((p) => installStates[p.name] === 'done').length;
            const groupPending = items.filter(
              (p) => (installStates[p.name] ?? 'idle') === 'idle',
            ).length;
            const groupInstalling = installingGroups.has(group.id);
            const allDone = groupDone === items.length;
            const isOpen = query ? true : !collapsed[group.id];

            return (
              <Paper
                key={group.id}
                variant="outlined"
                data-testid={`starter-pack-group-${group.id}`}
                sx={{
                  overflow: 'hidden',
                  animation: 'starterFadeIn 320ms ease both',
                  animationDelay: `${index * 55}ms`,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  onClick={() => {
                    if (query) return;
                    setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }));
                  }}
                  sx={{
                    p: 2,
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 120ms',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: group.accent,
                      backgroundColor: `${group.accent}1a`,
                    }}
                  >
                    {group.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {group.label}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${groupDone}/${items.length}`}
                        color={allDone ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {group.description}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {allDone ? (
                      <Chip
                        size="small"
                        color="success"
                        icon={<CheckCircleIcon fontSize="small" />}
                        label="Installed"
                      />
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        disabled={groupInstalling || groupPending === 0}
                        onClick={() => void handleInstallGroup(group, items)}
                        data-testid={`starter-pack-install-group-${group.id}`}
                        sx={{ minWidth: 132 }}
                      >
                        {groupInstalling ? 'Installing…' : `Install group (${groupPending})`}
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      aria-label={isOpen ? 'Collapse group' : 'Expand group'}
                      onClick={() => setCollapsed((c) => ({ ...c, [group.id]: isOpen }))}
                      disabled={Boolean(query)}
                      sx={{
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 160ms',
                      }}
                    >
                      <ExpandMoreIcon />
                    </IconButton>
                  </Stack>
                </Stack>

                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      px: 2,
                      pb: 2,
                      pt: 0.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 1.5,
                    }}
                  >
                    {items.map((p) => {
                      const state = installStates[p.name] ?? 'idle';
                      const done = state === 'done';
                      return (
                        <Card
                          key={p.name}
                          variant="outlined"
                          data-testid={`starter-plugin-card-${p.name}`}
                          sx={{
                            p: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.75,
                            borderColor: done ? 'success.main' : 'divider',
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                            >
                              {p.name}
                            </Typography>
                            {done && <CheckCircleIcon color="success" fontSize="small" />}
                          </Stack>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              flex: 1,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {p.description}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Button
                              size="small"
                              variant={done ? 'outlined' : 'contained'}
                              disableElevation
                              disabled={state !== 'idle'}
                              onClick={() => setPreviewPlugin(p)}
                              data-testid={`starter-plugin-install-${p.name}`}
                              sx={{ minWidth: 92 }}
                            >
                              {done ? 'Installed' : state === 'loading' ? 'Installing…' : 'Install'}
                            </Button>
                          </Box>
                        </Card>
                      );
                    })}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}

          <Stack direction="row" sx={{ mt: 1, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => onNavigate('marketplaces')}
            >
              Browse all marketplaces
            </Button>
          </Stack>
        </Stack>
      )}

      <PluginInstallPreviewDialog
        open={previewPlugin !== null}
        plugin={previewPlugin}
        installing={previewPlugin !== null && installStates[previewPlugin.name] === 'loading'}
        onCancel={() => setPreviewPlugin(null)}
        onConfirm={() => void handleConfirmInstall()}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
