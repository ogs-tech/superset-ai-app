import type { ReactNode } from 'react';
import { Box, InputAdornment, Stack, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
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
      {toolbarActions && <Box sx={{ flex: 0 }}>{toolbarActions}</Box>}
    </Stack>
  );
}
