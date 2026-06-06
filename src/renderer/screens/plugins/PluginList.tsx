import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { MoreVertical, Download } from 'lucide-react';
import { Icon } from '../../components/ds/Icon.js';
import { callIpc } from '../../lib/ipc.js';
import type { PluginListItemIpc } from '../../../shared/plugin-ipc-types.js';
import { PluginImportDialog } from './PluginImportDialog.js';
import { PublishPluginDialog } from './PublishPluginDialog.js';
import { PluginDetail } from './PluginDetail.js';
import { DetailDrawer } from '../../components/DetailDrawer.js';
import { EntityDataGrid } from '../../components/EntityDataGrid/index.js';
import type {
  EntityDef,
} from '../../components/EntityDataGrid/index.js';

interface PluginListProps {
  scope: 'personal' | 'project';
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'import' }
  | { kind: 'publish'; pluginId: string };

interface RowMenuState {
  anchorEl: HTMLElement;
  pluginId: string;
}

export function PluginList({ scope }: PluginListProps): React.ReactElement {
  const qc = useQueryClient();
  const queryKey = ['plugins', scope] as const;
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [selected, setSelected] = useState<PluginListItemIpc | null>(null);

  const { data, isLoading, error } = useQuery<PluginListItemIpc[]>({
    queryKey,
    queryFn: async () => {
      const list = await callIpc<PluginListItemIpc[]>('plugin.list', { scope });
      return Array.isArray(list) ? list : [];
    },
  });

  const items = data ?? [];

  const toggleMutation = useMutation({
    mutationFn: async ({
      item,
      enabled,
    }: {
      item: PluginListItemIpc;
      enabled: boolean;
    }) => {
      await callIpc('plugin.toggle', {
        id: item.id,
        scope: item.scope,
        enabled,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: async (pluginId: string) => {
      await callIpc('plugin.update', { id: pluginId, scope });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: async (pluginId: string) => {
      await callIpc('plugin.remove', { id: pluginId, scope });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const openRowMenu = (
    event: React.MouseEvent<HTMLElement>,
    pluginId: string,
  ): void => {
    setRowMenu({ anchorEl: event.currentTarget, pluginId });
  };

  const closeRowMenu = (): void => setRowMenu(null);

  const activeItem = rowMenu
    ? items.find((i) => i.id === rowMenu.pluginId)
    : undefined;

  const entity: EntityDef<PluginListItemIpc> = {
    name: 'plugin',
    pluralName: 'plugins',
    getKey: (item) => item.id,
    fields: [
      {
        key: 'id',
        label: 'Plugin',
        primary: true,
        searchable: true,
      },
      {
        key: 'origin',
        label: 'Origin',
        badge: true,
        searchable: true,
      },
      {
        key: 'scope',
        label: 'Scope',
        badge: true,
        searchable: true,
      },
    ],
  };

  return (
    <Container
      component="main"
      data-testid="plugin-list"
      maxWidth="lg"
      sx={{ py: 2.5 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h5" component="h1">
          Plugins
        </Typography>
      </Stack>

      <EntityDataGrid<PluginListItemIpc>
        entity={entity}
        data={items}
        isLoading={isLoading}
        error={error}
        searchPlaceholder="Search plugins…"
        onRowClick={(item) => setSelected(item)}
        toolbarActions={
          <Button
            variant="outlined"
            startIcon={<Icon glyph={Download} size={16} />}
            onClick={() => setDialog({ kind: 'import' })}
          >
            Import plugin
          </Button>
        }
        cardSlots={{
          topBanner: (item) =>
            item.drift ? (
              <Alert
                severity="warning"
                sx={{ borderRadius: 0, py: 0.5, fontSize: 13 }}
              >
                {item.drift.details ?? `Drift detected: ${item.drift.kind}`}
              </Alert>
            ) : null,
          footer: (item) => (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Switch
                checked={item.enabled}
                onChange={(e) =>
                  toggleMutation.mutate({ item, enabled: e.target.checked })
                }
                slotProps={{ input: { 'aria-label': `Toggle ${item.id}` } }}
                size="small"
              />
              <IconButton
                size="small"
                onClick={(e) => openRowMenu(e, item.id)}
                aria-label={`More options for ${item.id}`}
              >
                <Icon glyph={MoreVertical} size={16} />
              </IconButton>
            </Stack>
          ),
        }}
      />

      <Menu
        anchorEl={rowMenu?.anchorEl ?? null}
        open={rowMenu !== null}
        onClose={closeRowMenu}
      >
        {activeItem?.origin === 'imported' && [
          activeItem.installedRef?.kind === 'branch' && (
            <MenuItem
              key="update"
              onClick={() => {
                closeRowMenu();
                updateMutation.mutate(activeItem.id);
              }}
            >
              Update
            </MenuItem>
          ),
          <MenuItem
            key="remove"
            onClick={() => {
              closeRowMenu();
              removeMutation.mutate(activeItem.id);
            }}
          >
            Remove
          </MenuItem>,
          activeItem.drift && (
            <MenuItem key="reconcile" onClick={closeRowMenu}>
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
          <MenuItem
            key="remove"
            onClick={() => {
              closeRowMenu();
              removeMutation.mutate(activeItem.id);
            }}
          >
            Remove
          </MenuItem>,
          activeItem.drift && (
            <MenuItem key="reconcile" onClick={closeRowMenu}>
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
          void qc.invalidateQueries({ queryKey });
        }}
      />

      <PublishPluginDialog
        open={dialog.kind === 'publish'}
        pluginId={dialog.kind === 'publish' ? dialog.pluginId : ''}
        currentVersion={
          dialog.kind === 'publish'
            ? items.find((i) => i.id === dialog.pluginId)?.publishInfo
                ?.lastPublishedVersion || undefined
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
          void qc.invalidateQueries({ queryKey });
        }}
      />

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.id ?? ''}
        testId="plugin"
      >
        {selected && (
          <PluginDetail pluginId={selected.id} scope={selected.scope} />
        )}
      </DetailDrawer>
    </Container>
  );
}
