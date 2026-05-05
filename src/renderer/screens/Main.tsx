import { useState } from 'react';
import { AppBar, Box, IconButton, Tab, Tabs, Toolbar, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { SkillList } from './skills/SkillList.js';
import { AgentList } from './agents/AgentList.js';
import { CommandList } from './commands/CommandList.js';
import { ReferenceList } from './references/ReferenceList.js';
import { GlobalInstructionScreen } from './global-instructions/GlobalInstructionScreen.js';
import { MarketplaceList } from './marketplaces/MarketplaceList.js';
import { PluginList } from './plugins/PluginList.js';

type MainTab =
  | 'skills'
  | 'agents'
  | 'commands'
  | 'references'
  | 'global-instructions'
  | 'plugins'
  | 'marketplaces';

interface MainProps {
  onOpenSettings: () => void;
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<MainTab>('skills');

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
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Skills" value="skills" />
          <Tab label="Agents" value="agents" />
          <Tab label="Commands" value="commands" />
          <Tab label="References" value="references" />
          <Tab label="Global Instructions" value="global-instructions" />
          <Tab label="Plugins" value="plugins" />
          <Tab label="Marketplaces" value="marketplaces" />
        </Tabs>
      </AppBar>
      {activeTab === 'skills' && <SkillList />}
      {activeTab === 'agents' && <AgentList />}
      {activeTab === 'commands' && <CommandList />}
      {activeTab === 'references' && <ReferenceList />}
      {activeTab === 'global-instructions' && <GlobalInstructionScreen />}
      {activeTab === 'plugins' && <PluginList scope="personal" />}
      {activeTab === 'marketplaces' && <MarketplaceList />}
    </Box>
  );
}
