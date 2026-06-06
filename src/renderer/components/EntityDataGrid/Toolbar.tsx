import type { ReactNode } from 'react';
import {
  Box,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { LayoutGrid, Search, Table } from 'lucide-react';
import { Icon } from '../ds/Icon.js';
import type { ViewMode } from './types.js';

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string | undefined;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  toolbarActions?: ReactNode | undefined;
  entityName: string;
}

export function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  view,
  onViewChange,
  toolbarActions,
  entityName,
}: ToolbarProps): React.ReactElement {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ mb: 1.5, alignItems: { sm: 'center' } }}
    >
      <TextField
        size="small"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder ?? 'Search…'}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Icon glyph={Search} size={16} />
              </InputAdornment>
            ),
          },
          htmlInput: {
            'data-testid': `entity-grid-search-${entityName}`,
            'aria-label': `Search ${entityName}`,
          },
        }}
        sx={{ flex: 1, minWidth: 220 }}
      />
      <ToggleButtonGroup
        size="small"
        exclusive
        value={view}
        onChange={(_, v: ViewMode | null) => {
          if (v) onViewChange(v);
        }}
        aria-label="View mode"
      >
        <ToggleButton
          value="card"
          data-testid={`entity-grid-view-card-${entityName}`}
          aria-label="Card view"
        >
          <Icon glyph={LayoutGrid} size={16} />
        </ToggleButton>
        <ToggleButton
          value="table"
          data-testid={`entity-grid-view-table-${entityName}`}
          aria-label="Table view"
        >
          <Icon glyph={Table} size={16} />
        </ToggleButton>
      </ToggleButtonGroup>
      {toolbarActions && <Box sx={{ flex: 0 }}>{toolbarActions}</Box>}
    </Stack>
  );
}
