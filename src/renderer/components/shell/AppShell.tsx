import { useEffect, useState, type ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import { TopNav } from './TopNav.js';
import { SubRail } from './SubRail.js';
import { CommandPalette } from './CommandPalette.js';
import { defaultSubFor, type Area, type LibrarySub, type Nav } from './nav.js';

interface AppShellProps {
  nav: Nav;
  onNavigate: (nav: Nav) => void;
  onOpenSettings: () => void;
  healthSeverity?: 'ok' | 'warning' | 'error';
  children: ReactNode;
}

export function AppShell({
  nav,
  onNavigate,
  onOpenSettings,
  healthSeverity,
  children,
}: AppShellProps): React.ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectArea = (area: Area): void => onNavigate(defaultSubFor(area));
  const createEntity = (sub: LibrarySub): void => onNavigate({ area: 'biblioteca', sub });

  return (
    <Box
      data-testid="main-screen"
      sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}
    >
      <TopNav
        active={nav.area}
        onSelectArea={selectArea}
        onOpenSettings={onOpenSettings}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        {...(healthSeverity !== undefined ? { healthSeverity } : {})}
      />
      <Box data-testid="app-shell" sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SubRail nav={nav} onSelect={onNavigate} />
        <Box component="main" sx={{ flexGrow: 1, minWidth: 0, overflowY: 'auto' }}>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            {children}
          </Container>
        </Box>
      </Box>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(n) => onNavigate(n)}
        onCreate={createEntity}
      />
    </Box>
  );
}
