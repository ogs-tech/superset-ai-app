import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  InputAdornment,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedIcon from '@mui/icons-material/Verified';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { PluginInstallPreviewDialog } from './PluginInstallPreviewDialog.js';

interface MarketplacePlugin {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: unknown;
}

type MarketplaceSource =
  | { kind: 'directory'; path: string }
  | { kind: 'github'; repo: string; cachePath?: string }
  | { kind: 'git'; url: string; ref?: string; cachePath?: string }
  | { kind: 'url'; url: string; cachePath?: string };

interface MarketplaceSummary {
  id: string;
  source: MarketplaceSource;
  manifest?: {
    name: string;
    description?: string;
    plugins: MarketplacePlugin[];
  };
}

interface MarketplaceDetailProps {
  marketplace: MarketplaceSummary;
  onBack: () => void;
}

type InstallState = 'idle' | 'loading' | 'done';

const SKILLFORGE_LOCAL_ID = 'skillforge-imports';
const OFFICIAL_REPO = 'anthropics/claude-plugins-official';

function sourceLabel(source: MarketplaceSource): {
  badge: string;
  detail: string;
  href?: string;
} {
  if (source.kind === 'directory') {
    return { badge: 'local', detail: source.path };
  }
  if (source.kind === 'github') {
    return {
      badge: 'github',
      detail: source.repo,
      href: `https://github.com/${source.repo}`,
    };
  }
  if (source.kind === 'git') {
    return { badge: 'git', detail: source.url, href: source.url };
  }
  return { badge: 'url', detail: source.url, href: source.url };
}

export function MarketplaceDetail({
  marketplace,
  onBack,
}: MarketplaceDetailProps): React.ReactElement {
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [search, setSearch] = useState('');
  const [previewPlugin, setPreviewPlugin] = useState<MarketplacePlugin | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const installed = await callIpc<Array<{ id: string }>>('plugin.list', {
          scope: 'personal',
        });
        if (cancelled) return;
        const installedIds = new Set(installed.map((p) => p.id));
        setInstallStates((prev) => {
          const next: Record<string, InstallState> = { ...prev };
          for (const plugin of marketplace.manifest?.plugins ?? []) {
            if (installedIds.has(plugin.name) && next[plugin.name] !== 'loading') {
              next[plugin.name] = 'done';
            }
          }
          return next;
        });
      } catch {
        // best-effort: leave install states untouched if the lookup fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketplace]);

  const handleInstall = async (plugin: MarketplacePlugin): Promise<void> => {
    setInstallStates((s) => ({ ...s, [plugin.name]: 'loading' }));
    setErrors((e) => ({ ...e, [plugin.name]: '' }));
    try {
      // Attribute the install to the originating marketplace so Claude Code
      // shows it correctly. The synthetic skillforge-imports marketplace is
      // only used for owned/raw-URL imports — when installing FROM it, omit
      // marketplaceId so the installer falls back to the default.
      const params: Record<string, unknown> = { plugin, scope: 'personal' };
      if (marketplace.id !== SKILLFORGE_LOCAL_ID) {
        params['marketplaceId'] = marketplace.id;
      }
      await callIpc('plugin.installFromMarketplace', params);
      setInstallStates((s) => ({ ...s, [plugin.name]: 'done' }));
      setToast({ variant: 'success', message: `${plugin.name} installed` });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setInstallStates((s) => ({ ...s, [plugin.name]: 'idle' }));
      setErrors((e) => ({ ...e, [plugin.name]: message }));
    }
  };

  const handleConfirmInstall = async (): Promise<void> => {
    if (!previewPlugin) return;
    const plugin = previewPlugin;
    await handleInstall(plugin);
    setPreviewPlugin(null);
  };

  const plugins = marketplace.manifest?.plugins ?? [];
  const isLocal = marketplace.id === SKILLFORGE_LOCAL_ID || marketplace.source.kind === 'directory';
  const isOfficial =
    marketplace.source.kind === 'github' && marketplace.source.repo === OFFICIAL_REPO;
  const label = sourceLabel(marketplace.source);

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter((p) => {
      const haystack = [p.name, p.description, p.author?.name, p.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [plugins, search]);

  return (
    <Container component="main" data-testid="marketplace-detail" maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="h4" component="h1">
              {marketplace.manifest?.name ?? marketplace.id}
            </Typography>
            <Chip
              label={isLocal ? 'local' : label.badge}
              size="small"
              color={isLocal ? 'default' : 'primary'}
              variant={isLocal ? 'outlined' : 'filled'}
            />
            {isOfficial && (
              <Chip
                icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
                label="official"
                size="small"
                color="primary"
                data-testid="marketplace-official-badge"
              />
            )}
          </Stack>
          {marketplace.manifest?.description && (
            <Typography variant="body2" color="text.secondary">
              {marketplace.manifest.description}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {label.href ? (
              <Link href={label.href} target="_blank" rel="noopener" underline="hover">
                {label.detail}
              </Link>
            ) : (
              label.detail
            )}
          </Typography>
        </Box>
        <Button variant="text" startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
      </Stack>

      {!marketplace.manifest && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Marketplace manifest could not be loaded. Try refreshing the marketplace.
        </Alert>
      )}

      {plugins.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <TextField
            size="small"
            placeholder="Search plugins"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              htmlInput: { 'data-testid': 'marketplace-plugin-search' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            {filteredPlugins.length} of {plugins.length}
          </Typography>
        </Stack>
      )}

      <Paper variant="outlined" sx={{ maxHeight: '52vh', overflowY: 'auto' }}>
        <List disablePadding>
          {plugins.length === 0 && (
            <ListItem>
              <ListItemText primary="No plugins listed in this marketplace." />
            </ListItem>
          )}
          {plugins.length > 0 && filteredPlugins.length === 0 && (
            <ListItem>
              <ListItemText primary="No plugins match your search." />
            </ListItem>
          )}
          {filteredPlugins.map((plugin) => (
            <ListItem
              key={plugin.name}
              data-testid={`marketplace-plugin-${plugin.name}`}
              divider
              sx={{ py: 1.5, pr: 14 }}
              secondaryAction={
                <Button
                  size="small"
                  variant={installStates[plugin.name] === 'done' ? 'outlined' : 'contained'}
                  disabled={
                    installStates[plugin.name] !== undefined &&
                    installStates[plugin.name] !== 'idle'
                  }
                  onClick={() => setPreviewPlugin(plugin)}
                >
                  {installStates[plugin.name] === 'done'
                    ? 'Installed'
                    : installStates[plugin.name] === 'loading'
                      ? 'Installing…'
                      : 'Install'}
                </Button>
              }
            >
              <ListItemText
                primary={<Box component="strong">{plugin.name}</Box>}
                secondary={
                  <>
                    {plugin.description}
                    {plugin.author && (
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        by {plugin.author.name}
                      </Typography>
                    )}
                    {errors[plugin.name] && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {errors[plugin.name]}
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <PluginInstallPreviewDialog
        open={previewPlugin !== null}
        plugin={previewPlugin}
        installing={
          previewPlugin !== null && installStates[previewPlugin.name] === 'loading'
        }
        onCancel={() => setPreviewPlugin(null)}
        onConfirm={() => void handleConfirmInstall()}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
