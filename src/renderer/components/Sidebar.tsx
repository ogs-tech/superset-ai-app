import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Collapse,
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
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TerminalIcon from '@mui/icons-material/Terminal';
import EditNoteIcon from '@mui/icons-material/EditNote';
import WebhookIcon from '@mui/icons-material/Webhook';
import ExtensionIcon from '@mui/icons-material/Extension';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export type SidebarTab =
  | 'starter-pack'
  | 'skills'
  | 'agents'
  | 'commands'
  | 'hooks'
  | 'global-instructions'
  | 'plugins'
  | 'marketplaces'
  | 'diagnostics';

export type SidebarHealthSeverity = 'ok' | 'warning' | 'error';

interface NavLeaf {
  id: SidebarTab;
  label: string;
  icon: React.ReactElement;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactElement;
  children: ReadonlyArray<NavLeaf>;
}

const TOP_ITEM: NavLeaf = {
  id: 'starter-pack',
  label: 'Início',
  icon: <HomeIcon fontSize="small" />,
};

const DIAGNOSTICS_ITEM: NavLeaf = {
  id: 'diagnostics',
  label: 'Diagnostics',
  icon: <MonitorHeartIcon fontSize="small" />,
};

const GROUPS: ReadonlyArray<NavGroup> = [
  {
    id: 'customizations',
    label: 'Customizations',
    icon: <TuneIcon fontSize="small" />,
    children: [
      { id: 'skills', label: 'Skills', icon: <AutoAwesomeIcon fontSize="small" /> },
      { id: 'agents', label: 'Agents', icon: <SmartToyIcon fontSize="small" /> },
      { id: 'commands', label: 'Commands', icon: <TerminalIcon fontSize="small" /> },
      { id: 'hooks', label: 'Hooks', icon: <WebhookIcon fontSize="small" /> },
      {
        id: 'global-instructions',
        label: 'Global Instructions',
        icon: <EditNoteIcon fontSize="small" />,
      },
    ],
  },
  {
    id: 'plugins',
    label: 'Plugins',
    icon: <ExtensionIcon fontSize="small" />,
    children: [
      { id: 'plugins', label: 'Plugins', icon: <ExtensionIcon fontSize="small" /> },
      { id: 'marketplaces', label: 'Marketplaces', icon: <StorefrontIcon fontSize="small" /> },
    ],
  },
];

// Flattened leaf list used by the collapsed (icon-only) rail, where group
// headers have no room to expand.
const FLAT_LEAVES: ReadonlyArray<NavLeaf> = [
  TOP_ITEM,
  DIAGNOSTICS_ITEM,
  ...GROUPS.flatMap((g) => g.children),
];

const BADGE_COLOR: Record<SidebarHealthSeverity, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
};

export const SIDEBAR_WIDTH = 232;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
const STORAGE_KEY = 'sde:sidebar-collapsed';
const GROUPS_STORAGE_KEY = 'sde:sidebar-collapsed-groups';

function readCollapsedGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

interface SidebarProps {
  active: SidebarTab;
  onNavigate: (tab: SidebarTab) => void;
  onOpenSettings: () => void;
  healthSeverity?: SidebarHealthSeverity;
}

export function Sidebar({ active, onNavigate, onOpenSettings, healthSeverity }: SidebarProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(readCollapsedGroups);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  const toggleGroup = (id: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          {collapsed ? (
            FLAT_LEAVES.map((leaf) => (
              <LeafButton
                key={leaf.id}
                leaf={leaf}
                active={active === leaf.id}
                collapsed
                onNavigate={onNavigate}
                {...(leaf.id === 'diagnostics' ? { healthSeverity } : {})}
              />
            ))
          ) : (
            <>
              <LeafButton
                leaf={TOP_ITEM}
                active={active === TOP_ITEM.id}
                collapsed={false}
                onNavigate={onNavigate}
              />
              <LeafButton
                leaf={DIAGNOSTICS_ITEM}
                active={active === DIAGNOSTICS_ITEM.id}
                collapsed={false}
                onNavigate={onNavigate}
                {...(healthSeverity !== undefined ? { healthSeverity } : {})}
              />
              {GROUPS.map((group) => {
                const expanded = !collapsedGroups.has(group.id);
                const hasActiveChild = group.children.some((c) => c.id === active);
                return (
                  <Box key={group.id}>
                    <ListItem disablePadding sx={{ px: 1, mb: 0.5 }}>
                      <ListItemButton
                        data-testid={`sidebar-group-${group.id}`}
                        aria-expanded={expanded}
                        onClick={() => toggleGroup(group.id)}
                        sx={{ borderRadius: 1.5, py: 1, minHeight: 40, px: 1.5 }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 32,
                            justifyContent: 'center',
                            color: hasActiveChild ? 'primary.main' : 'text.secondary',
                          }}
                        >
                          {group.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={group.label}
                          slotProps={{
                            primary: {
                              variant: 'body2',
                              sx: { fontWeight: 600, color: 'text.secondary' },
                            },
                          }}
                        />
                        {expanded ? (
                          <ExpandLessIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        ) : (
                          <ExpandMoreIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        )}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                      <List dense disablePadding>
                        {group.children.map((leaf) => (
                          <LeafButton
                            key={leaf.id}
                            leaf={leaf}
                            active={active === leaf.id}
                            collapsed={false}
                            indented
                            onNavigate={onNavigate}
                          />
                        ))}
                      </List>
                    </Collapse>
                  </Box>
                );
              })}
            </>
          )}
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

interface LeafButtonProps {
  leaf: NavLeaf;
  active: boolean;
  collapsed: boolean;
  indented?: boolean;
  onNavigate: (tab: SidebarTab) => void;
  healthSeverity?: SidebarHealthSeverity;
}

function LeafButton({
  leaf,
  active,
  collapsed,
  indented = false,
  onNavigate,
  healthSeverity,
}: LeafButtonProps): React.ReactElement {
  const icon =
    healthSeverity !== undefined ? (
      <Badge
        data-testid="sidebar-health-badge"
        data-severity={healthSeverity}
        color={BADGE_COLOR[healthSeverity]}
        variant="dot"
        overlap="circular"
      >
        {leaf.icon}
      </Badge>
    ) : (
      leaf.icon
    );

  return (
    <ListItem disablePadding sx={{ px: 1, mb: 0.5 }}>
      <Tooltip
        title={collapsed ? leaf.label : ''}
        placement="right"
        disableHoverListener={!collapsed}
        disableFocusListener={!collapsed}
        disableTouchListener={!collapsed}
      >
        <ListItemButton
          data-testid={`sidebar-${leaf.id}`}
          selected={active}
          onClick={() => onNavigate(leaf.id)}
          sx={{
            borderRadius: 1.5,
            py: 1,
            minHeight: 40,
            justifyContent: collapsed ? 'center' : 'flex-start',
            px: collapsed ? 1 : 1.5,
            ...(indented && !collapsed ? { pl: 3.5 } : {}),
            '&.Mui-selected': {
              backgroundColor: 'action.selected',
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: collapsed ? 0 : 32,
              justifyContent: 'center',
              color: active ? 'primary.main' : 'text.secondary',
            }}
          >
            {icon}
          </ListItemIcon>
          {!collapsed && (
            <ListItemText
              primary={leaf.label}
              slotProps={{
                primary: {
                  variant: 'body2',
                  sx: { fontWeight: active ? 600 : 400 },
                },
              }}
            />
          )}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );
}
