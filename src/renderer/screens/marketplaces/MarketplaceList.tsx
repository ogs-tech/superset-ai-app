import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { AddMarketplaceDialog } from './AddMarketplaceDialog.js';
import { MarketplaceDetail } from './MarketplaceDetail.js';

interface MarketplacePlugin {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: unknown;
}

interface MarketplaceSummary {
  id: string;
  source: { kind: 'directory'; path: string };
  manifest?: {
    name: string;
    description?: string;
    plugins: MarketplacePlugin[];
  };
}

export function MarketplaceList(): React.ReactElement {
  const [items, setItems] = useState<MarketplaceSummary[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<MarketplaceSummary | null>(null);
  const [selected, setSelected] = useState<MarketplaceSummary | null>(null);

  const load = async (): Promise<void> => {
    try {
      const list = await callIpc<MarketplaceSummary[]>('marketplace.list', {
        scope: 'personal',
      });
      setItems(Array.isArray(list) ? list : []);
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAdd(true)}
          data-testid="add-marketplace-button"
        >
          Add marketplace
        </Button>
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
        {items.map((m) => (
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
                primary={<Box component="strong">{m.manifest?.name ?? m.id}</Box>}
                secondary={
                  <>
                    {m.manifest?.description && <span>{m.manifest.description} · </span>}
                    {m.source.path}
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
        ))}
      </List>

      <AddMarketplaceDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => void load()}
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
            the directory on disk; only the registration is removed.
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
