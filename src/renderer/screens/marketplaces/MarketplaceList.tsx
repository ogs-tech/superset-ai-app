import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { AddMarketplaceDialog } from './AddMarketplaceDialog.js';
import { MarketplaceDetail } from './MarketplaceDetail.js';
import { MarketplaceImportDialog } from './MarketplaceImportDialog.js';

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

export function MarketplaceList(): React.ReactElement {
  const [items, setItems] = useState<MarketplaceSummary[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<MarketplaceSummary | null>(null);
  const [selected, setSelected] = useState<MarketplaceSummary | null>(null);

  const load = async (): Promise<void> => {
    try {
      const list = await callIpc<MarketplaceSummary[]>('marketplace.list', {
        scope: 'personal',
      });
      const filtered = Array.isArray(list)
        ? list.filter((m) => m.id !== SKILLFORGE_LOCAL_ID)
        : [];
      setItems(filtered);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRefresh = async (id: string): Promise<void> => {
    try {
      await callIpc('marketplace.refresh', { scope: 'personal', id });
      await load();
      setToast({ variant: 'success', message: `${id} refreshed` });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  const handleRemoveConfirmed = async (): Promise<void> => {
    if (!confirmRemove) return;
    try {
      await callIpc('marketplace.remove', {
        scope: 'personal',
        id: confirmRemove.id,
      });
      setItems((prev) => prev.filter((m) => m.id !== confirmRemove.id));
      setToast({ variant: 'success', message: `${confirmRemove.id} removed` });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setConfirmRemove(null);
    }
  };

  if (selected) {
    return (
      <MarketplaceDetail
        marketplace={selected}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
    <Container
      component="main"
      data-testid="marketplace-list"
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1">
          Marketplaces
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setShowImport(true)}
            data-testid="import-marketplace-button"
          >
            Import from URL
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAdd(true)}
            data-testid="add-marketplace-button"
          >
            Add marketplace
          </Button>
        </Stack>
      </Stack>

      <List disablePadding>
        {items.length === 0 && (
          <Box
            sx={{
              border: 1,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 4,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">No marketplaces configured yet.</Typography>
          </Box>
        )}
        {items.map((m) => {
          const isLocal = m.id === SKILLFORGE_LOCAL_ID || m.source.kind === 'directory';
          const label = sourceLabel(m.source);
          return (
            <ListItem
              key={m.id}
              data-testid={`marketplace-item-${m.id}`}
              divider
              disablePadding
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Refresh">
                    <IconButton
                      size="small"
                      onClick={() => void handleRefresh(m.id)}
                      aria-label="Refresh"
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setConfirmRemove(m)}
                      aria-label="Remove"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
            >
              <ListItemButton onClick={() => setSelected(m)}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box component="strong">{m.manifest?.name ?? m.id}</Box>
                      <Chip
                        label={isLocal ? 'local' : label.badge}
                        size="small"
                        color={isLocal ? 'default' : 'primary'}
                        variant={isLocal ? 'outlined' : 'filled'}
                      />
                    </Stack>
                  }
                  secondary={
                    <>
                      {m.manifest?.description && (
                        <span>{m.manifest.description} · </span>
                      )}
                      {label.href ? (
                        <Link
                          href={label.href}
                          target="_blank"
                          rel="noopener"
                          underline="hover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {label.detail}
                        </Link>
                      ) : (
                        <span>{label.detail}</span>
                      )}
                      {m.manifest?.plugins && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          {m.manifest.plugins.length} plugin
                          {m.manifest.plugins.length === 1 ? '' : 's'}
                        </Typography>
                      )}
                    </>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <AddMarketplaceDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => void load()}
      />

      <MarketplaceImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onMarketplaceAdded={(id) => {
          setShowImport(false);
          setToast({ variant: 'success', message: `Marketplace ${id} added` });
          void load();
        }}
      />

      <Dialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        aria-label="Confirm marketplace removal"
        data-testid="confirm-remove-marketplace-dialog"
      >
        <DialogTitle>Remove marketplace</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove marketplace <strong>{confirmRemove?.id}</strong>? This will not delete
            any installed plugins; only the marketplace registration is removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRemoveConfirmed}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
