import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CardView } from './CardView.js';
import { Toolbar } from './Toolbar.js';
import type { EntityDataGridProps } from './types.js';
import { filterBySearch, paginate } from './utils.js';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

export function EntityDataGrid<T>({
  entity,
  data,
  isLoading,
  error,
  actions,
  toolbarActions,
  cardSlots,
  pageSize = 5,
  searchPlaceholder,
  emptyState,
  onRowClick,
}: EntityDataGridProps<T>): React.ReactElement {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  const handleSearchChange = (value: string): void => {
    setSearch(value);
    setPage(1);
  };

  const handlePageSizeChange = (value: number): void => {
    setCurrentPageSize(value);
    setPage(1);
  };

  const items = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(
    () => filterBySearch(items, entity.fields, search),
    [items, entity.fields, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / currentPageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => paginate(filtered, safePage, currentPageSize),
    [filtered, safePage, currentPageSize],
  );

  const pageSizeOptions = useMemo<readonly number[]>(() => {
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(currentPageSize)) {
      return PAGE_SIZE_OPTIONS;
    }
    return [currentPageSize, ...PAGE_SIZE_OPTIONS].sort((a, b) => a - b);
  }, [currentPageSize]);

  const showFooter = filtered.length > Math.min(currentPageSize, ...PAGE_SIZE_OPTIONS);

  return (
    <Box data-testid={`entity-grid-${entity.name}`}>
      <Toolbar
        entityName={entity.name}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={searchPlaceholder}
        view="card"
        onViewChange={() => {}}
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
      ) : (
        <CardView
          entity={entity}
          items={paged}
          actions={actions}
          cardSlots={cardSlots}
          onRowClick={onRowClick}
        />
      )}

      {showFooter && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            mt: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
          data-testid={`entity-grid-pagination-${entity.name}`}
        >
          <TextField
            select
            size="small"
            label="Per page"
            value={currentPageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            slotProps={{
              htmlInput: {
                'data-testid': `entity-grid-page-size-${entity.name}`,
                'aria-label': `Items per page for ${entity.name}`,
              },
            }}
            sx={{ minWidth: 110 }}
          >
            {pageSizeOptions.map((size) => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </TextField>
          {totalPages > 1 ? (
            <Pagination
              count={totalPages}
              page={safePage}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="small"
              showFirstButton
              showLastButton
            />
          ) : (
            <Box />
          )}
          <Typography variant="caption" color="text.secondary">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </Typography>
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

function EmptyBlock({ isFiltered, entityPlural, fallback }: EmptyBlockProps): React.ReactElement {
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
        <Typography variant="body2">No {entityPlural} match your search.</Typography>
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
