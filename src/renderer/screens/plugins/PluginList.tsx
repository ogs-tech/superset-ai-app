import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { PluginListItemIpc } from '../../../shared/plugin-ipc-types.js';
import { PluginImportDialog } from './PluginImportDialog.js';
import { PluginNewDialog } from './PluginNewDialog.js';
import { PublishPluginDialog } from './PublishPluginDialog.js';

interface PluginListProps {
  scope: 'personal' | 'project';
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'import' }
  | { kind: 'new' }
  | { kind: 'publish'; pluginId: string };

interface RowMenuState {
  anchorEl: HTMLElement;
  pluginId: string;
}

export function PluginList({ scope }: PluginListProps): React.ReactElement {
  const [items, setItems] = useState<PluginListItemIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);

  const loadList = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await callIpc<PluginListItemIpc[]>('plugin.list', { scope });
      setItems(list);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, [scope]);

  const handleToggle = async (item: PluginListItemIpc, enabled: boolean): Promise<void> => {
    try {
      await callIpc('plugin.toggle', { id: item.id, scope: item.scope, enabled });
      await loadList();
    } catch (err) {
      // silently fail — user can retry via refresh
    }
  };

  const handleUpdate = async (pluginId: string): Promise<void> => {
    closeRowMenu();
    try {
      await callIpc('plugin.update', { id: pluginId, scope });
      await loadList();
    } catch (err) {
      // errors surfaced in future Toast integration
    }
  };

  const handleRemove = async (pluginId: string): Promise<void> => {
    closeRowMenu();
    try {
      await callIpc('plugin.remove', { id: pluginId, scope });
      await loadList();
    } catch (err) {
      // errors surfaced in future Toast integration
    }
  };

  const handleReconcile = async (pluginId: string): Promise<void> => {
    closeRowMenu();
    // plugin.reconcile is a future IPC — no-op here until wired up
  };

  const openRowMenu = (event: React.MouseEvent<HTMLElement>, pluginId: string): void => {
    setRowMenu({ anchorEl: event.currentTarget, pluginId });
  };

  const closeRowMenu = (): void => {
    setRowMenu(null);
  };

  const activeItem = rowMenu ? items.find((i) => i.id === rowMenu.pluginId) : undefined;

  return (
    <Container component="main" data-testid="plugin-list" maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Plugins
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setDialog({ kind: 'import' })}
          >
            Import plugin
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ kind: 'new' })}
          >
            New plugin
          </Button>
        </Stack>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
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
              <Typography variant="body2">No plugins installed yet.</Typography>
            </Box>
          )}
          {items.map((item) => (
            <Box key={item.id}>
              {item.drift && (
                <Alert severity="warning" sx={{ borderRadius: 0, py: 0.5 }}>
                  {item.drift.details ?? `Drift detected: ${item.drift.kind}`}
                </Alert>
              )}
              <ListItem
                data-testid={`plugin-item-${item.id}`}
                divider
                secondaryAction={
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Switch
                      checked={item.enabled}
                      onChange={(e) => void handleToggle(item, e.target.checked)}
                      slotProps={{ input: { 'aria-label': `Toggle ${item.id}` } }}
                      size="small"
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => openRowMenu(e, item.id)}
                      aria-label={`More options for ${item.id}`}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box component="strong">{item.id}</Box>
                      <Chip
                        label={item.origin}
                        color={item.origin === 'imported' ? 'info' : 'success'}
                        size="small"
                      />
                    </Stack>
                  }
                  secondary={`scope: ${item.scope}`}
                />
              </ListItem>
            </Box>
          ))}
        </List>
      )}

      <Menu
        anchorEl={rowMenu?.anchorEl ?? null}
        open={rowMenu !== null}
        onClose={closeRowMenu}
      >
        {activeItem?.origin === 'imported' && [
          activeItem.installedRef?.kind === 'branch' && (
            <MenuItem
              key="update"
              onClick={() => void handleUpdate(activeItem.id)}
            >
              Update
            </MenuItem>
          ),
          <MenuItem key="remove" onClick={() => void handleRemove(activeItem.id)}>
            Remove
          </MenuItem>,
          activeItem.drift && (
            <MenuItem key="reconcile" onClick={() => void handleReconcile(activeItem.id)}>
              Reconcile
            </MenuItem>
          ),
        ]}
        {activeItem?.origin === 'owned' && [
          <MenuItem
            key="publish"
            onClick={() => {
              closeRowMenu();
              setDialog({ kind: 'publish', pluginId: activeItem.id });
            }}
          >
            Publish
          </MenuItem>,
          <MenuItem key="remove" onClick={() => void handleRemove(activeItem.id)}>
            Remove
          </MenuItem>,
          activeItem.drift && (
            <MenuItem key="reconcile" onClick={() => void handleReconcile(activeItem.id)}>
              Reconcile
            </MenuItem>
          ),
        ]}
      </Menu>

      <PluginImportDialog
        open={dialog.kind === 'import'}
        scope={scope}
        onClose={() => setDialog({ kind: 'closed' })}
        onSuccess={() => {
          setDialog({ kind: 'closed' });
          void loadList();
        }}
      />

      <PluginNewDialog
        open={dialog.kind === 'new'}
        scope={scope}
        onClose={() => setDialog({ kind: 'closed' })}
        onSuccess={() => {
          setDialog({ kind: 'closed' });
          void loadList();
        }}
      />

      <PublishPluginDialog
        open={dialog.kind === 'publish'}
        pluginId={dialog.kind === 'publish' ? dialog.pluginId : ''}
        currentVersion={
          dialog.kind === 'publish'
            ? items.find((i) => i.id === dialog.pluginId)?.publishInfo?.lastPublishedVersion || undefined
            : undefined
        }
        hasPublishInfo={
          dialog.kind === 'publish'
            ? Boolean(items.find((i) => i.id === dialog.pluginId)?.publishInfo)
            : false
        }
        scope={scope}
        onClose={() => setDialog({ kind: 'closed' })}
        onSuccess={() => {
          setDialog({ kind: 'closed' });
          void loadList();
        }}
      />
    </Container>
  );
}
