import { useState } from 'react';
import { AppBar, Box, IconButton, Toolbar, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { CustomizationList } from './customizations/CustomizationList.js';
import { TopbarSearch } from '../components/TopbarSearch.js';
import type { SearchOutput } from '../../shared/search.js';

interface MainProps {
  onOpenSettings: () => void;
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [searchResults, setSearchResults] = useState<SearchOutput | undefined>(undefined);

  return (
    <Box data-testid="main-screen" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        data-testid="topbar"
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <TopbarSearch onResults={setSearchResults} />
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Open settings">
            <IconButton
              onClick={onOpenSettings}
              aria-label="Open settings"
              data-testid="open-settings-button"
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <CustomizationList searchResults={searchResults} />
    </Box>
  );
}
