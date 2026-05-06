import { useState } from 'react';
import { Box } from '@mui/material';
import { Sidebar, SIDEBAR_WIDTH, type SidebarTab } from '../components/Sidebar.js';
import { HomeScreen } from './home/HomeScreen.js';
import { SkillList } from './skills/SkillList.js';
import { AgentList } from './agents/AgentList.js';
import { CommandList } from './commands/CommandList.js';
import { HookList } from './hooks/HookList.js';
import { ReferenceList } from './references/ReferenceList.js';
import { GlobalInstructionScreen } from './global-instructions/GlobalInstructionScreen.js';
import { TemplateList } from './templates/TemplateList.js';
import { MarketplaceList } from './marketplaces/MarketplaceList.js';
import { PluginList } from './plugins/PluginList.js';
import { StarterPackScreen } from './starter-pack/StarterPackScreen.js';

interface MainProps {
  onOpenSettings: () => void;
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SidebarTab>('home');

  return (
    <Box
      data-testid="main-screen"
      sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}
    >
      <Sidebar
        active={activeTab}
        onNavigate={setActiveTab}
        onOpenSettings={onOpenSettings}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          width: { sm: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        }}
      >
        {activeTab === 'home' && <HomeScreen onNavigate={setActiveTab} />}
        {activeTab === 'starter-pack' && <StarterPackScreen onNavigate={setActiveTab} />}
        {activeTab === 'skills' && <SkillList />}
        {activeTab === 'agents' && <AgentList />}
        {activeTab === 'commands' && <CommandList />}
        {activeTab === 'hooks' && <HookList />}
        {activeTab === 'references' && <ReferenceList />}
        {activeTab === 'global-instructions' && <GlobalInstructionScreen />}
        {activeTab === 'templates' && <TemplateList />}
        {activeTab === 'plugins' && <PluginList scope="personal" />}
        {activeTab === 'marketplaces' && <MarketplaceList />}
      </Box>
    </Box>
  );
}
