import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';

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
      await callIpc('plugin.installFromMarketplace', { plugin, scope: 'personal' });
      setInstallStates((s) => ({ ...s, [plugin.name]: 'done' }));
      setToast({ variant: 'success', message: `${plugin.name} installed` });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setInstallStates((s) => ({ ...s, [plugin.name]: 'idle' }));
      setErrors((e) => ({ ...e, [plugin.name]: message }));
    }
  };

  const plugins = marketplace.manifest?.plugins ?? [];
  const isLocal =
    marketplace.id === SKILLFORGE_LOCAL_ID || marketplace.source.kind === 'directory';
  const label = sourceLabel(marketplace.source);

  return (
    <Container
      component="main"
      data-testid="marketplace-detail"
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
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

      <Paper variant="outlined">
        <List disablePadding>
          {plugins.length === 0 && (
            <ListItem>
              <ListItemText primary="No plugins listed in this marketplace." />
            </ListItem>
          )}
          {plugins.map((plugin) => (
            <ListItem
              key={plugin.name}
              data-testid={`marketplace-plugin-${plugin.name}`}
              divider
              secondaryAction={
                <Button
                  size="small"
                  variant={installStates[plugin.name] === 'done' ? 'outlined' : 'contained'}
                  disabled={installStates[plugin.name] !== undefined && installStates[plugin.name] !== 'idle'}
                  onClick={() => void handleInstall(plugin)}
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
