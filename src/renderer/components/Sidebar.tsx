import { useEffect, useState } from 'react';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TerminalIcon from '@mui/icons-material/Terminal';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ExtensionIcon from '@mui/icons-material/Extension';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type SidebarTab =
  | 'home'
  | 'skills'
  | 'agents'
  | 'commands'
  | 'references'
  | 'global-instructions'
  | 'templates'
  | 'plugins'
  | 'marketplaces';

interface SidebarItem {
  id: SidebarTab;
  label: string;
  icon: React.ReactElement;
}

const PRIMARY_ITEMS: ReadonlyArray<SidebarItem> = [
  { id: 'home', label: 'Home', icon: <HomeIcon fontSize="small" /> },
  { id: 'skills', label: 'Skills', icon: <AutoAwesomeIcon fontSize="small" /> },
  { id: 'agents', label: 'Agents', icon: <SmartToyIcon fontSize="small" /> },
  { id: 'commands', label: 'Commands', icon: <TerminalIcon fontSize="small" /> },
  { id: 'references', label: 'References', icon: <MenuBookIcon fontSize="small" /> },
  { id: 'global-instructions', label: 'Global Instructions', icon: <EditNoteIcon fontSize="small" /> },
  { id: 'templates', label: 'Templates', icon: <LibraryBooksIcon fontSize="small" /> },
  { id: 'plugins', label: 'Plugins', icon: <ExtensionIcon fontSize="small" /> },
  { id: 'marketplaces', label: 'Marketplaces', icon: <StorefrontIcon fontSize="small" /> },
];

export const SIDEBAR_WIDTH = 232;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
const STORAGE_KEY = 'sde:sidebar-collapsed';

interface SidebarProps {
  active: SidebarTab;
  onNavigate: (tab: SidebarTab) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ active, onNavigate, onOpenSettings }: SidebarProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <Drawer
      data-testid="sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: (theme) =>
          theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter,
          }),
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          borderRight: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          overflowX: 'hidden',
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
        },
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: collapsed ? 0 : 2.5,
          minHeight: 56,
          borderBottom: 1,
          borderColor: 'divider',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 1,
        }}
      >
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 1,
                flexShrink: 0,
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
              SDE
            </Typography>
          </Box>
        )}
        <Tooltip title={collapsed ? 'Expand navigation' : 'Collapse navigation'} placement="right">
          <IconButton
            size="small"
            data-testid="sidebar-toggle"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={() => setCollapsed((c) => !c)}
            sx={{ color: 'text.secondary' }}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <List dense sx={{ pt: 1.5, flex: 1 }}>
          {PRIMARY_ITEMS.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ px: 1, mb: 0.5 }}>
              <Tooltip
                title={collapsed ? item.label : ''}
                placement="right"
                disableHoverListener={!collapsed}
                disableFocusListener={!collapsed}
                disableTouchListener={!collapsed}
              >
                <ListItemButton
                  data-testid={`sidebar-${item.id}`}
                  selected={active === item.id}
                  onClick={() => onNavigate(item.id)}
                  sx={{
                    borderRadius: 1.5,
                    py: 1,
                    minHeight: 40,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 1.5,
                    '&.Mui-selected': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 32,
                      justifyContent: 'center',
                      color: active === item.id ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          variant: 'body2',
                          sx: { fontWeight: active === item.id ? 600 : 400 },
                        },
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>

        <Divider />
        <List dense sx={{ pb: 1.5 }}>
          <ListItem disablePadding sx={{ px: 1, pt: 1 }}>
            <Tooltip
              title={collapsed ? 'Settings' : ''}
              placement="right"
              disableHoverListener={!collapsed}
              disableFocusListener={!collapsed}
              disableTouchListener={!collapsed}
            >
              <ListItemButton
                data-testid="sidebar-settings"
                onClick={onOpenSettings}
                sx={{
                  borderRadius: 1.5,
                  py: 1,
                  minHeight: 40,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 1 : 1.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 32,
                    justifyContent: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary="Settings"
                    slotProps={{ primary: { variant: 'body2' } }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}
