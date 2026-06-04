import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Link,
  Stack,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { DetailDrawer } from '../../components/DetailDrawer.js';
import { MarketplaceDetail } from './MarketplaceDetail.js';
import { MarketplaceImportDialog } from './MarketplaceImportDialog.js';
import { EntityDataGrid } from '../../components/EntityDataGrid/index.js';
import type {
  EntityDef,
  RowAction,
} from '../../components/EntityDataGrid/index.js';

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

const LOCAL_MARKETPLACE_ID = 'local';
const OFFICIAL_REPO = 'anthropics/claude-plugins-official';
const MARKETPLACES_QUERY_KEY = ['marketplaces', 'personal'] as const;

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
  const qc = useQueryClient();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmRemove, setConfirmRemove] =
    useState<MarketplaceSummary | null>(null);
  const [selected, setSelected] = useState<MarketplaceSummary | null>(null);

  const { data, isLoading, error } = useQuery<MarketplaceSummary[]>({
    queryKey: MARKETPLACES_QUERY_KEY,
    queryFn: async () => {
      const list = await callIpc<MarketplaceSummary[]>('marketplace.list', {
        scope: 'personal',
      });
      return Array.isArray(list)
        ? list.filter((m) => m.id !== LOCAL_MARKETPLACE_ID)
        : [];
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: string) => {
      await callIpc('marketplace.refresh', { scope: 'personal', id });
      return id;
    },
    onSuccess: async (id) => {
      setToast({ variant: 'success', message: `${id} refreshed` });
      await qc.invalidateQueries({ queryKey: MARKETPLACES_QUERY_KEY });
    },
    onError: (err) => {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (m: MarketplaceSummary) => {
      await callIpc('marketplace.remove', { scope: 'personal', id: m.id });
      return m;
    },
    onSuccess: async (m) => {
      setToast({ variant: 'success', message: `${m.id} removed` });
      await qc.invalidateQueries({ queryKey: MARKETPLACES_QUERY_KEY });
    },
    onError: (err) => {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    },
  });

  const entity: EntityDef<MarketplaceSummary> = {
    name: 'marketplace',
    pluralName: 'marketplaces',
    getKey: (item) => item.id,
    fields: [
      {
        key: 'manifest.name',
        label: 'Name',
        primary: true,
        searchable: true,
        render: (item) => {
          const isOfficial =
            item.source.kind === 'github' && item.source.repo === OFFICIAL_REPO;
          return (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box component="span">{item.manifest?.name ?? item.id}</Box>
              {isOfficial && (
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
                  label="official"
                  size="small"
                  color="primary"
                  data-testid={`marketplace-${item.id}-official-badge`}
                />
              )}
            </Stack>
          );
        },
      },
      {
        key: 'source.kind',
        label: 'Source',
        badge: true,
        searchable: true,
        render: (item) => {
          const isLocal =
            item.id === LOCAL_MARKETPLACE_ID || item.source.kind === 'directory';
          return isLocal ? 'local' : sourceLabel(item.source).badge;
        },
      },
      {
        key: 'manifest.plugins',
        label: 'Plugins',
        badge: true,
        render: (item) => {
          const count = item.manifest?.plugins.length ?? 0;
          return `${count} plugin${count === 1 ? '' : 's'}`;
        },
      },
      {
        key: 'manifest.description',
        label: 'Description',
        secondary: true,
        searchable: true,
        render: (item) => {
          const label = sourceLabel(item.source);
          return (
            <Box>
              {item.manifest?.description && (
                <span>{item.manifest.description} · </span>
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
            </Box>
          );
        },
      },
    ],
  };

  const actions: RowAction<MarketplaceSummary>[] = [
    {
      label: 'Refresh',
      icon: <RefreshIcon fontSize="small" />,
      onClick: (item) => refreshMutation.mutate(item.id),
    },
    {
      label: 'Remove',
      icon: <DeleteOutlineIcon fontSize="small" />,
      variant: 'destructive',
      onClick: (item) => setConfirmRemove(item),
    },
  ];

  return (
    <Container
      component="main"
      data-testid="marketplace-list"
      maxWidth="lg"
      sx={{ py: 2.5 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h5" component="h1">
          Marketplaces
        </Typography>
      </Stack>

      <EntityDataGrid<MarketplaceSummary>
        entity={entity}
        data={data}
        isLoading={isLoading}
        error={error}
        actions={actions}
        searchPlaceholder="Search marketplaces…"
        onRowClick={(item) => setSelected(item)}
        toolbarActions={
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setShowImport(true)}
            data-testid="import-marketplace-button"
          >
            Import from URL
          </Button>
        }
      />

      <MarketplaceImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onMarketplaceAdded={(id) => {
          setShowImport(false);
          setToast({ variant: 'success', message: `Marketplace ${id} added` });
          void qc.invalidateQueries({ queryKey: MARKETPLACES_QUERY_KEY });
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
            Remove marketplace <strong>{confirmRemove?.id}</strong>? This will
            not delete any installed plugins; only the marketplace registration
            is removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (confirmRemove) removeMutation.mutate(confirmRemove);
              setConfirmRemove(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <DetailDrawer
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          void qc.invalidateQueries({ queryKey: MARKETPLACES_QUERY_KEY });
        }}
        title={selected?.manifest?.name ?? selected?.id ?? ''}
        testId="marketplace"
      >
        {selected && <MarketplaceDetail marketplace={selected} />}
      </DetailDrawer>
    </Container>
  );
}
