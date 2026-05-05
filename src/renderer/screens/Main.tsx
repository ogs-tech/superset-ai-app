import { useState } from 'react';
import { AppBar, Box, IconButton, Tab, Tabs, Toolbar, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { CustomizationList } from './customizations/CustomizationList.js';
import { TopbarSearch } from '../components/TopbarSearch.js';
import { PluginList } from './plugins/PluginList.js';
import { PluginEditor } from './plugins/PluginEditor.js';
import type { SearchOutput } from '../../shared/search.js';

type MainTab = 'customizations' | 'plugins';

interface MainProps {
  onOpenSettings: () => void;
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [searchResults, setSearchResults] = useState<SearchOutput | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<MainTab>('customizations');
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null);

  // If editing a plugin, show the editor instead
  if (editingPlugin) {
    return (
      <PluginEditor
        pluginId={editingPlugin}
        onBack={() => setEditingPlugin(null)}
      />
    );
  }

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
        <Tabs
          value={activeTab}
          onChange={(_, v: MainTab) => setActiveTab(v)}
          sx={{ px: 2 }}
        >
          <Tab label="Customizations" value="customizations" />
          <Tab label="Plugins" value="plugins" />
        </Tabs>
      </AppBar>
      {activeTab === 'customizations' && <CustomizationList searchResults={searchResults} />}
      {activeTab === 'plugins' && <PluginList scope="personal" onOpenEditor={setEditingPlugin} />}
    </Box>
  );
}
