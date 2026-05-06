import type { ReactNode } from 'react';
import {
  Box,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
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
                <SearchIcon fontSize="small" />
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
      <Box sx={{ flex: 0 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, next: ViewMode | null) => {
            if (next) onViewChange(next);
          }}
          aria-label="View mode"
        >
          <Tooltip title="Card view">
            <ToggleButton
              value="card"
              data-testid={`entity-grid-view-card-${entityName}`}
              aria-label="Card view"
            >
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Table view">
            <ToggleButton
              value="table"
              data-testid={`entity-grid-view-table-${entityName}`}
              aria-label="Table view"
            >
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Box>
      {toolbarActions && <Box sx={{ flex: 0 }}>{toolbarActions}</Box>}
    </Stack>
  );
}
