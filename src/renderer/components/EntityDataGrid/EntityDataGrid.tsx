import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import { CardView } from './CardView.js';
import { TableView } from './TableView.js';
import { Toolbar } from './Toolbar.js';
import type { EntityDataGridProps, ViewMode } from './types.js';
import { filterBySearch, paginate, viewStorageKey } from './utils.js';

export function EntityDataGrid<T>({
  entity,
  data,
  isLoading,
  error,
  actions,
  toolbarActions,
  cardSlots,
  pageSize = 12,
  searchPlaceholder,
  emptyState,
  onRowClick,
}: EntityDataGridProps<T>): React.ReactElement {
  const [view, setView] = useState<ViewMode>(() =>
    readPersistedView(entity.name, entity.defaultView ?? 'card'),
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    persistView(entity.name, view);
  }, [entity.name, view]);

  const handleSearchChange = (value: string): void => {
    setSearch(value);
    setPage(1);
  };

  const items = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(
    () => filterBySearch(items, entity.fields, search),
    [items, entity.fields, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => paginate(filtered, safePage, pageSize),
    [filtered, safePage, pageSize],
  );

  return (
    <Box data-testid={`entity-grid-${entity.name}`}>
      <Toolbar
        entityName={entity.name}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={searchPlaceholder}
        view={view}
        onViewChange={setView}
        toolbarActions={toolbarActions}
      />

      {error !== undefined && error !== null && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      )}

      {isLoading && items.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 3,
            gap: 1,
            color: 'text.secondary',
          }}
        >
          <CircularProgress size={20} />
          <Typography variant="body2">Loading…</Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyBlock
          isFiltered={search.length > 0}
          fallback={emptyState}
          entityPlural={entity.pluralName ?? `${entity.name}s`}
        />
      ) : view === 'card' ? (
        <CardView
          entity={entity}
          items={paged}
          actions={actions}
          cardSlots={cardSlots}
          onRowClick={onRowClick}
        />
      ) : (
        <TableView
          entity={entity}
          items={paged}
          actions={actions}
          onRowClick={onRowClick}
        />
      )}

      {filtered.length > pageSize && (
        <Stack
          direction="row"
          sx={{ justifyContent: 'center', mt: 2 }}
          data-testid={`entity-grid-pagination-${entity.name}`}
        >
          <Pagination
            count={totalPages}
            page={safePage}
            onChange={(_, p) => setPage(p)}
            color="primary"
            size="small"
            showFirstButton
            showLastButton
          />
        </Stack>
      )}
    </Box>
  );
}

interface EmptyBlockProps {
  isFiltered: boolean;
  entityPlural: string;
  fallback?: React.ReactNode;
}

function EmptyBlock({
  isFiltered,
  entityPlural,
  fallback,
}: EmptyBlockProps): React.ReactElement {
  if (isFiltered) {
    return (
      <Box
        sx={{
          border: 1,
          borderStyle: 'dashed',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2.5,
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">
          No {entityPlural} match your search.
        </Typography>
      </Box>
    );
  }
  if (fallback) return <>{fallback}</>;
  return (
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
      <Typography variant="body2">No {entityPlural} yet.</Typography>
    </Box>
  );
}

function readPersistedView(name: string, fallback: ViewMode): ViewMode {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(viewStorageKey(name));
    if (raw === 'card' || raw === 'table') return raw;
  } catch {
    /* localStorage may be disabled */
  }
  return fallback;
}

function persistView(name: string, view: ViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(viewStorageKey(name), view);
  } catch {
    /* ignore */
  }
}
